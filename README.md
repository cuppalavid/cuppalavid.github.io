# Cuppalavid

Yapay zekâ destekli, tamamen statik bir video üretim arayüzü.

## Güvenlik

- Tarayıcıya Hugging Face anahtarı gönderilmez ve GitHub kaynak kodunda sunucu sırrı bulunmaz.
- Üretim istekleri, kaynak kodu korumalı `Anil465423/cuppalavid-api` Space'i üzerinden iletilir.
- Pro çalışma anahtarı yalnızca Space'in `HF_TOKEN` gizli değişkeninde tutulur.
- Aracı servis IP başına saatte 5 üretim, 12 bekleyen iş ve tek eşzamanlı üretim sınırı uygular.

## Yayın

GitHub Pages çıktısı `dist/` klasöründedir.

Aracı servis kaynakları `backend-space/` klasöründedir.
