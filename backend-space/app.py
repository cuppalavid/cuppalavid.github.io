from __future__ import annotations

import os
import shutil
import threading
import time
import uuid
from collections import defaultdict, deque
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from gradio_client import Client, handle_file


SPACE_ID = "Pepe104/MiniMax-H3-Turbo-Lora-UNCENSORED"
ALLOWED_ORIGINS = {"https://cuppalavid.github.io"}
WORK_ROOT = Path("/tmp/cuppalavid")
MAX_UPLOAD_BYTES = 15 * 1024 * 1024
MAX_JOBS_PER_HOUR = 5
MAX_QUEUED_JOBS = 12
JOB_TTL_SECONDS = 6 * 60 * 60

app = FastAPI(title="Cuppalavid API", docs_url=None, redoc_url=None)
app.add_middleware(
    CORSMiddleware,
    allow_origins=sorted(ALLOWED_ORIGINS),
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type"],
)

executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="cuppalavid")
lock = threading.RLock()
jobs: dict[str, dict[str, Any]] = {}
requests_by_ip: dict[str, deque[float]] = defaultdict(deque)


def now() -> float:
    return time.time()


def client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "")
    return forwarded.split(",")[0].strip() or (request.client.host if request.client else "unknown")


def require_allowed_origin(request: Request) -> None:
    origin = request.headers.get("origin")
    if origin not in ALLOWED_ORIGINS:
        raise HTTPException(status_code=403, detail="Origin not allowed")


def enforce_rate_limit(ip: str) -> None:
    cutoff = now() - 3600
    bucket = requests_by_ip[ip]
    while bucket and bucket[0] < cutoff:
        bucket.popleft()
    if len(bucket) >= MAX_JOBS_PER_HOUR:
        raise HTTPException(status_code=429, detail="Saatlik üretim sınırına ulaşıldı.")
    bucket.append(now())


def cleanup_old_jobs() -> None:
    cutoff = now() - JOB_TTL_SECONDS
    with lock:
        expired = [job_id for job_id, job in jobs.items() if job["created_at"] < cutoff]
        for job_id in expired:
            job_dir = WORK_ROOT / job_id
            shutil.rmtree(job_dir, ignore_errors=True)
            jobs.pop(job_id, None)


async def save_upload(upload: UploadFile | None, destination: Path) -> str | None:
    if upload is None or not upload.filename:
        return None
    if not (upload.content_type or "").startswith("image/"):
        raise HTTPException(status_code=400, detail="Yalnızca görsel dosyaları kabul edilir.")
    data = await upload.read(MAX_UPLOAD_BYTES + 1)
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Görsel dosyası 15 MB sınırını aşıyor.")
    suffix = Path(upload.filename).suffix.lower()[:10] or ".img"
    path = destination.with_suffix(suffix)
    path.write_bytes(data)
    return str(path)


def unwrap_result(result: Any) -> list[Any]:
    value = result
    if isinstance(value, (list, tuple)) and len(value) == 1 and isinstance(value[0], (list, tuple)):
        value = value[0]
    return list(value) if isinstance(value, (list, tuple)) else [value]


def video_path_from(value: Any) -> str | None:
    object_path = getattr(value, "path", None)
    if object_path and Path(object_path).exists():
        return str(object_path)
    if isinstance(value, str):
        return value if Path(value).exists() else None
    if isinstance(value, dict):
        candidate = value.get("path") or value.get("name")
        return candidate if candidate and Path(candidate).exists() else None
    return None


def run_generation(job_id: str, payload: dict[str, Any]) -> None:
    token = os.environ.get("HF_TOKEN", "").strip()
    if not token:
        with lock:
            jobs[job_id].update(status="error", error="Sunucu anahtarı yapılandırılmamış.", finished_at=now())
        return

    with lock:
        if jobs[job_id].get("cancelled"):
            jobs[job_id].update(status="cancelled", finished_at=now())
            return
        jobs[job_id]["status"] = "running"

    try:
        download_dir = WORK_ROOT / job_id / "downloads"
        download_dir.mkdir(parents=True, exist_ok=True)
        client = Client(SPACE_ID, token=token, verbose=False, download_files=str(download_dir))
        remote_job = client.submit(
            prompt=payload["prompt"],
            image_path=handle_file(payload["first_image"]) if payload.get("first_image") else None,
            last_image_path=handle_file(payload["last_image"]) if payload.get("last_image") else None,
            canvas=payload["canvas"],
            duration=payload["duration"],
            steps=payload["steps"],
            seed=payload["seed"],
            upsample=payload["upsample"],
            use_lora=payload["lora"] != "off",
            lora=payload["lora"],
            api_name="/generate",
        )
        with lock:
            jobs[job_id]["remote_job"] = remote_job
            if jobs[job_id].get("cancelled"):
                remote_job.cancel()
        result = remote_job.result()
        parts = unwrap_result(result)
        source = video_path_from(parts[0] if parts else None)
        if not source:
            raise RuntimeError("Video dosyası alınamadı.")
        output_path = WORK_ROOT / job_id / f"result{Path(source).suffix or '.mp4'}"
        shutil.copyfile(source, output_path)
        with lock:
            if jobs[job_id].get("cancelled"):
                jobs[job_id].update(status="cancelled", finished_at=now())
            else:
                jobs[job_id].update(
                    status="done",
                    video_path=str(output_path),
                    report=str(parts[1]) if len(parts) > 1 and parts[1] else "Üretim tamamlandı.",
                    refined=str(parts[2]) if len(parts) > 2 and parts[2] else "",
                    finished_at=now(),
                )
    except Exception as exc:
        with lock:
            jobs[job_id].update(status="error", error=str(exc)[:500], finished_at=now())
    finally:
        with lock:
            jobs.get(job_id, {}).pop("remote_job", None)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Cache-Control"] = "no-store"
    return response


@app.get("/health")
def health() -> dict[str, Any]:
    return {"ready": bool(os.environ.get("HF_TOKEN")), "service": "cuppalavid"}


@app.post("/jobs", status_code=202)
async def create_job(
    request: Request,
    prompt: str = Form(...),
    canvas: str = Form(...),
    duration: int = Form(...),
    steps: int = Form(...),
    seed: int = Form(...),
    upsample: bool = Form(False),
    lora: str = Form("larry"),
    first_image: UploadFile | None = File(None),
    last_image: UploadFile | None = File(None),
) -> dict[str, str]:
    require_allowed_origin(request)
    cleanup_old_jobs()
    clean_prompt = prompt.strip()
    if not clean_prompt or len(clean_prompt) > 4000:
        raise HTTPException(status_code=400, detail="İstek 1–4000 karakter olmalıdır.")
    if duration < 2 or duration > 14 or steps < 2 or steps > 40:
        raise HTTPException(status_code=400, detail="Üretim ayarları geçersiz.")
    if lora not in {"larry", "lightx", "off"}:
        raise HTTPException(status_code=400, detail="Üretim modu geçersiz.")
    with lock:
        active = sum(job.get("status") in {"queued", "running"} for job in jobs.values())
        if active >= MAX_QUEUED_JOBS:
            raise HTTPException(status_code=503, detail="İşlem kuyruğu dolu.")
        enforce_rate_limit(client_ip(request))

    job_id = uuid.uuid4().hex
    job_dir = WORK_ROOT / job_id
    job_dir.mkdir(parents=True, exist_ok=False)
    first_path = await save_upload(first_image, job_dir / "first")
    last_path = await save_upload(last_image, job_dir / "last")
    payload = {
        "prompt": clean_prompt,
        "canvas": canvas,
        "duration": duration,
        "steps": steps,
        "seed": seed,
        "upsample": upsample,
        "lora": lora,
        "first_image": first_path,
        "last_image": last_path,
    }
    with lock:
        jobs[job_id] = {"status": "queued", "created_at": now(), "cancelled": False}
    executor.submit(run_generation, job_id, payload)
    return {"id": job_id, "status": "queued"}


@app.get("/jobs/{job_id}")
def get_job(request: Request, job_id: str) -> dict[str, Any]:
    require_allowed_origin(request)
    with lock:
        job = jobs.get(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="İş bulunamadı.")
        response = {key: job.get(key) for key in ("status", "error", "report", "refined") if job.get(key) is not None}
        if job.get("status") == "done":
            response["video_url"] = f"/jobs/{job_id}/video"
        return response


@app.get("/jobs/{job_id}/video")
def get_video(request: Request, job_id: str):
    require_allowed_origin(request)
    with lock:
        job = jobs.get(job_id)
        path = job.get("video_path") if job else None
    if not path or not Path(path).exists():
        raise HTTPException(status_code=404, detail="Video bulunamadı.")
    return FileResponse(path, media_type="video/mp4", filename=f"cuppalavid-{job_id[:8]}.mp4")


@app.delete("/jobs/{job_id}")
def cancel_job(request: Request, job_id: str) -> dict[str, str]:
    require_allowed_origin(request)
    with lock:
        job = jobs.get(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="İş bulunamadı.")
        job["cancelled"] = True
        remote_job = job.get("remote_job")
        if remote_job:
            remote_job.cancel()
        if job.get("status") == "queued":
            job["status"] = "cancelled"
    return {"status": "cancelled"}
