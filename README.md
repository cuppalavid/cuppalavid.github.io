# Cuppalavid

MiniMax H3 Turbo Hugging Face Space API'sini kullanan, tamamen statik bir video üretim arayüzü.

## Güvenlik

- Hugging Face OAuth, Authorization Code + PKCE akışını kullanır.
- OAuth erişim anahtarı yalnızca kullanıcının tarayıcısındaki `localStorage` alanında tutulur; GitHub kaynak koduna veya build çıktısına yazılmaz.
- İlk bağlantıdan sonra aynı tarayıcıdaki yeni sekmeler Pro hesabı otomatik kullanır. Kullanıcı “Bağlantıyı kes” dediğinde anahtar silinir.
- Site kaynak kodunda kullanıcı anahtarı veya sunucu sırrı bulunmaz.

## Yayın

GitHub Pages çıktısı `dist/` klasöründedir.
