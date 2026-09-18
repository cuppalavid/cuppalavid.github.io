# Cuppalavid

MiniMax H3 Turbo Hugging Face Space API'sini kullanan, tamamen statik bir video üretim arayüzü.

## Güvenlik

- Hugging Face OAuth, Authorization Code + PKCE akışını kullanır.
- OAuth erişim anahtarı yalnızca `sessionStorage` içinde, açık tarayıcı sekmesi boyunca tutulur.
- İlk üretimde hesap bağlantısı otomatik açılır; erişim anahtarı yalnızca sekme belleğinde saklanır.
- Site kaynak kodunda kullanıcı anahtarı veya sunucu sırrı bulunmaz.

## Yayın

GitHub Pages çıktısı `dist/` klasöründedir.
