const SPACE_ORIGIN = "https://pepe104-minimax-h3-turbo-lora-uncensored.hf.space";
const API_ORIGIN = "https://anil465423-cuppalavid-api.hf.space";
const HISTORY_KEY = "cuppalavid_history_v1";

const DEFAULT_CANVASES = [
  "960x544 · 16:9 fast", "1024x576 · 16:9 fast", "1152x640 · 16:9", "1280x704 · 16:9",
  "1344x768 · 16:9 full", "544x960 · 9:16 fast", "640x1152 · 9:16", "768x1344 · 9:16 full",
  "544x544 · 1:1 fast", "768x768 · 1:1 full", "768x576 · 4:3 fast", "1024x768 · 4:3 full",
  "576x768 · 3:4 fast", "768x1024 · 3:4 full", "1152x512 · 21:9 fast", "1536x672 · 21:9 full"
];

const $ = (id) => document.getElementById(id);
const state = {
  first: null,
  last: null,
  firstUrl: "",
  lastUrl: "",
  jobId: "",
  stopped: false,
  busy: false,
  timer: null,
  startedAt: 0,
  toastTimer: null,
};

function showToast(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => { toast.hidden = true; }, 3600);
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function safeJson(value, fallback) {
  try {
    const parsed = JSON.parse(value);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function truncate(value, length = 42) {
  return value.length > length ? `${value.slice(0, length).trim()}…` : value;
}

function sanitizeServiceText(value) {
  return String(value || "")
    .replace(/MiniMax(?:[-\s]?H?3)?(?:\s+Turbo)?/gi, "üretim sistemi")
    .replace(/Hugging\s*Face/gi, "servis")
    .replace(/ZeroGPU/gi, "öncelikli altyapı")
    .replace(/\bSpace\b/gi, "sistem");
}

function openModal(id) {
  $(id).hidden = false;
  document.body.style.overflow = "hidden";
}

function closeModal(id) {
  $(id).hidden = true;
  document.body.style.overflow = "";
}

function positionFloatingPanels() {
  const settings = $("settings-popover");
  const attach = $("attachment-menu");
  if (!settings.hidden && window.innerWidth > 660) {
    const rect = $("settings-button").getBoundingClientRect();
    settings.style.left = `${Math.min(rect.left, window.innerWidth - settings.offsetWidth - 18)}px`;
    settings.style.right = "auto";
    settings.style.bottom = `${window.innerHeight - rect.top + 10}px`;
  }
  if (!attach.hidden && window.innerWidth > 660) {
    const rect = $("attach-button").getBoundingClientRect();
    attach.style.left = `${rect.left}px`;
    attach.style.bottom = `${window.innerHeight - rect.top + 10}px`;
  }
}

function resizePrompt() {
  const prompt = $("prompt");
  prompt.style.height = "auto";
  prompt.style.height = `${Math.min(prompt.scrollHeight, 180)}px`;
}

function canvasRatio(label) {
  const match = label.match(/(\d+):(\d+)/);
  return match ? `${match[1]}:${match[2]}` : "16:9";
}

function refreshSettingsSummary() {
  $("settings-summary").textContent = `${canvasRatio($("canvas-select").value)} · ${$("duration-range").value} sn`;
  $("duration-output").textContent = `${$("duration-range").value} sn`;
  $("steps-output").textContent = $("steps-range").value;
}

function setProgress(percent, indeterminate = false) {
  const bar = $("progress-bar");
  bar.classList.toggle("indeterminate", indeterminate);
  if (!indeterminate) bar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
}

function showLoading(title, detail) {
  $("result-card").hidden = false;
  $("welcome").hidden = true;
  $("result-video").removeAttribute("src");
  $("result-video").load();
  $("video-loading").hidden = false;
  $("download-button").style.visibility = "hidden";
  $("result-meta").textContent = "";
  $("refined-wrap").hidden = true;
  $("job-title").textContent = title;
  $("job-detail").textContent = detail;
  setProgress(15, true);
  requestAnimationFrame(() => $("result-card").scrollIntoView({ behavior: "smooth", block: "start" }));
}

function setBusy(busy) {
  state.busy = busy;
  $("generate-button").disabled = busy;
  $("stop-button").hidden = !busy;
  if (!busy) {
    clearInterval(state.timer);
    state.timer = null;
  }
}

function saveHistory(prompt, url, report) {
  const history = safeJson(localStorage.getItem(HISTORY_KEY), []);
  history.unshift({ prompt, url, report, createdAt: Date.now() });
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 8)));
  renderHistory();
}

function renderHistory() {
  const history = safeJson(localStorage.getItem(HISTORY_KEY), []);
  const list = $("history-list");
  if (!history.length) {
    list.innerHTML = '<div class="history-empty">Ürettiğin videolar burada görünür.</div>';
    return;
  }
  list.innerHTML = "";
  for (const item of history) {
    const button = document.createElement("button");
    button.className = "history-item";
    button.innerHTML = `<span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 7 8 5-8 5z"/></svg></span><span><b></b><small></small></span>`;
    button.querySelector("b").textContent = truncate(item.prompt);
    button.querySelector("small").textContent = new Date(item.createdAt).toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
    button.addEventListener("click", () => {
      $("welcome").hidden = true;
      $("result-card").hidden = false;
      $("video-loading").hidden = true;
      $("result-video").src = item.url;
      $("download-button").href = item.url;
      $("download-button").style.visibility = "visible";
      $("result-meta").textContent = sanitizeServiceText(item.report || item.prompt);
      $("result-title").textContent = truncate(item.prompt, 54);
      if (window.innerWidth <= 900) closeSidebar();
    });
    list.appendChild(button);
  }
}

function readableError(error) {
  const raw = typeof error === "string" ? error : error?.message || String(error);
  if (/quota|exceeded|GPU/i.test(raw)) return "Üretim kotası şu anda yeterli değil veya geçici olarak dolu.";
  if (/queue.*full|503/i.test(raw)) return "İşlem kuyruğu şu anda dolu. Biraz sonra tekrar dene.";
  if (/loading|starting|wake/i.test(raw)) return "Sistem hâlâ hazırlanıyor. Hazır olduğunda tekrar dene.";
  if (/unauthorized|401|token/i.test(raw)) return "Bağlantı doğrulanamadı. Biraz sonra tekrar dene.";
  return sanitizeServiceText(raw).slice(0, 360);
}

async function generateVideo() {
  const prompt = $("prompt").value.trim();
  if (!prompt) { showToast("Önce videonu birkaç cümleyle anlat."); $("prompt").focus(); return; }
  if (state.busy) return;
  state.stopped = false;
  setBusy(true);
  showLoading("Video hazırlanıyor", "İsteğin sıraya alınıyor…");
  $("result-title").textContent = truncate(prompt, 58);
  state.startedAt = Date.now();
  state.timer = setInterval(() => {
    $("elapsed").textContent = formatTime((Date.now() - state.startedAt) / 1000);
  }, 500);

  try {
    const form = new FormData();
    form.append("prompt", prompt);
    form.append("canvas", $("canvas-select").value);
    form.append("duration", $("duration-range").value);
    form.append("steps", $("steps-range").value);
    form.append("seed", $("seed-input").value);
    form.append("upsample", String($("upsample-input").checked));
    form.append("lora", $("lora-select").value);
    if (state.first) form.append("first_image", state.first, state.first.name);
    if (state.last) form.append("last_image", state.last, state.last.name);

    const createResponse = await fetch(`${API_ORIGIN}/jobs`, { method: "POST", body: form });
    const created = await createResponse.json().catch(() => ({}));
    if (!createResponse.ok || !created.id) throw new Error(created.detail || "Üretim başlatılamadı.");
    state.jobId = created.id;
    $("job-title").textContent = "Sırada bekliyor";
    $("job-detail").textContent = "Öncelikli üretim kullanılıyor.";
    setProgress(22, true);

    let result = null;
    while (!state.stopped) {
      await new Promise((resolve) => setTimeout(resolve, 1800));
      const statusResponse = await fetch(`${API_ORIGIN}/jobs/${state.jobId}`, { cache: "no-store" });
      const status = await statusResponse.json().catch(() => ({}));
      if (!statusResponse.ok) throw new Error(status.detail || "Üretim durumu alınamadı.");
      if (status.status === "queued") {
        $("job-title").textContent = "Sırada bekliyor";
        $("job-detail").textContent = "İsteğin güvenli üretim kuyruğunda.";
        setProgress(24, true);
      } else if (status.status === "running") {
        $("job-title").textContent = "Sahne üretiliyor";
        $("job-detail").textContent = "Görüntü ve ses birlikte işleniyor…";
        const elapsed = (Date.now() - state.startedAt) / 1000;
        setProgress(Math.min(92, 34 + elapsed / 4), true);
      } else if (status.status === "done") {
        result = status;
        break;
      } else if (status.status === "cancelled") {
        throw new Error("Üretim durduruldu.");
      } else if (status.status === "error") {
        throw new Error(status.error || "Üretim başarısız oldu.");
      }
    }
    if (state.stopped) return;
    if (!result?.video_url) throw new Error("Video sonucu alınamadı.");
    const videoUrl = `${API_ORIGIN}${result.video_url}`;
    $("result-video").src = videoUrl;
    $("download-button").href = videoUrl;
    $("download-button").style.visibility = "visible";
    const cleanReport = sanitizeServiceText(result.report || "Üretim tamamlandı.");
    $("result-meta").textContent = cleanReport;
    if (result.refined) {
      $("refined-text").textContent = sanitizeServiceText(result.refined);
      $("refined-wrap").hidden = false;
    }
    setProgress(100, false);
    $("video-loading").hidden = true;
    saveHistory(prompt, videoUrl, cleanReport);
    showToast("Videon hazır.");
  } catch (error) {
    if (state.stopped) return;
    $("job-title").textContent = "Üretim tamamlanamadı";
    $("job-detail").textContent = readableError(error);
    $("video-loading").hidden = false;
    $("video-loading").querySelector(".loader-ring").style.animation = "none";
    $("video-loading").querySelector(".loader-ring").style.borderColor = "rgba(255,120,120,.55)";
    setProgress(0, false);
  } finally {
    state.jobId = "";
    setBusy(false);
  }
}

async function stopGeneration() {
  if (!state.jobId) return;
  state.stopped = true;
  try { await fetch(`${API_ORIGIN}/jobs/${state.jobId}`, { method: "DELETE" }); } catch { /* best effort */ }
  $("job-title").textContent = "Üretim durduruldu";
  $("job-detail").textContent = "Yeni bir promptla tekrar deneyebilirsin.";
  setProgress(0, false);
  state.jobId = "";
  setBusy(false);
}

function setSpaceStatus(ready, text, error = false) {
  const pill = $("space-status");
  pill.classList.toggle("ready", ready);
  pill.classList.toggle("error", error);
  pill.querySelector(".status-text").textContent = text;
}

async function pollSpace() {
  try {
    const response = await fetch(`${API_ORIGIN}/health`, { cache: "no-store" });
    if (!response.ok) throw new Error();
    const info = await response.json();
    setSpaceStatus(Boolean(info.ready), info.ready ? "Hazır" : "Hazırlanıyor", /failed/i.test(info.status || ""));
  } catch {
    setSpaceStatus(false, "Bağlantı kurulamadı", true);
  }
}

async function loadConfig() {
  let config = { canvases: DEFAULT_CANVASES, default_canvas: DEFAULT_CANVASES[0], min_duration: 2, max_duration: 14 };
  try {
    const response = await fetch(`${SPACE_ORIGIN}/studio-config`);
    if (response.ok) config = { ...config, ...(await response.json()) };
  } catch { /* defaults match the current public API */ }
  const select = $("canvas-select");
  select.innerHTML = "";
  for (const label of config.canvases) {
    const option = new Option(label, label, false, label === config.default_canvas);
    select.add(option);
  }
  $("duration-range").min = config.min_duration;
  $("duration-range").max = config.max_duration;
  refreshSettingsSummary();
}

function setFrame(kind, file) {
  if (!file || !file.type.startsWith("image/")) { showToast("Lütfen bir görsel dosyası seç."); return; }
  const urlKey = `${kind}Url`;
  if (state[urlKey]) URL.revokeObjectURL(state[urlKey]);
  state[kind] = file;
  state[urlKey] = URL.createObjectURL(file);
  const preview = $(`${kind}-preview`);
  preview.querySelector("img").src = state[urlKey];
  preview.hidden = false;
  $("attachment-previews").hidden = false;
}

function clearFrame(kind) {
  if (state[`${kind}Url`]) URL.revokeObjectURL(state[`${kind}Url`]);
  state[kind] = null;
  state[`${kind}Url`] = "";
  $(`${kind}-preview`).hidden = true;
  $("attachment-previews").hidden = !state.first && !state.last;
  $(`${kind}-file`).value = "";
}

function closeSidebar() {
  $("sidebar").classList.remove("open");
  $("sidebar-scrim").classList.remove("open");
}

function wireEvents() {
  $("prompt").addEventListener("input", resizePrompt);
  $("prompt").addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      generateVideo();
    }
  });
  $("generate-button").addEventListener("click", generateVideo);
  $("stop-button").addEventListener("click", stopGeneration);
  $("new-project").addEventListener("click", () => {
    $("prompt").value = "";
    resizePrompt();
    $("welcome").hidden = false;
    $("result-card").hidden = true;
    $("prompt").focus();
    closeSidebar();
  });
  document.querySelectorAll(".suggestion").forEach((button) => button.addEventListener("click", () => {
    $("prompt").value = button.dataset.prompt;
    resizePrompt();
    $("prompt").focus();
  }));
  $("settings-button").addEventListener("click", () => {
    const panel = $("settings-popover");
    panel.hidden = !panel.hidden;
    $("attachment-menu").hidden = true;
    $("settings-button").setAttribute("aria-expanded", String(!panel.hidden));
    requestAnimationFrame(positionFloatingPanels);
  });
  document.querySelector('[data-close="settings"]').addEventListener("click", () => { $("settings-popover").hidden = true; });
  $("attach-button").addEventListener("click", () => {
    const menu = $("attachment-menu");
    menu.hidden = !menu.hidden;
    $("settings-popover").hidden = true;
    requestAnimationFrame(positionFloatingPanels);
  });
  document.querySelectorAll("[data-file]").forEach((button) => button.addEventListener("click", () => {
    $(`${button.dataset.file}-file`).click();
    $("attachment-menu").hidden = true;
  }));
  ["first", "last"].forEach((kind) => {
    $(`${kind}-file`).addEventListener("change", (event) => setFrame(kind, event.target.files[0]));
  });
  document.querySelectorAll("[data-clear]").forEach((button) => button.addEventListener("click", () => clearFrame(button.dataset.clear)));
  ["canvas-select", "duration-range", "steps-range"].forEach((id) => $(id).addEventListener("input", refreshSettingsSummary));
  $("lora-select").addEventListener("change", () => {
    const suggested = { larry: 6, lightx: 4, off: 28 }[$("lora-select").value];
    $("steps-range").value = suggested;
    refreshSettingsSummary();
  });
  $("random-seed").addEventListener("click", () => { $("seed-input").value = Math.floor(Math.random() * 2147483647); });
  $("menu-button").addEventListener("click", () => { $("sidebar").classList.add("open"); $("sidebar-scrim").classList.add("open"); });
  $("sidebar-close").addEventListener("click", closeSidebar);
  $("sidebar-scrim").addEventListener("click", closeSidebar);
  window.addEventListener("resize", positionFloatingPanels);
  document.addEventListener("click", (event) => {
    if (!$("settings-popover").hidden && !$("settings-popover").contains(event.target) && !$("settings-button").contains(event.target)) {
      $("settings-popover").hidden = true;
      $("settings-button").setAttribute("aria-expanded", "false");
    }
    if (!$("attachment-menu").hidden && !$("attachment-menu").contains(event.target) && !$("attach-button").contains(event.target)) {
      $("attachment-menu").hidden = true;
    }
  });
}

async function initialize() {
  wireEvents();
  renderHistory();
  await Promise.allSettled([loadConfig(), pollSpace()]);
  setInterval(pollSpace, 30000);
}

initialize();
