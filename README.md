# Cuppalavid

Yapay zekâ destekli, tamamen statik bir video üretim arayüzü.

## Güvenlik

- Daha önce yetkilendirilmiş Hugging Face erişim anahtarı yalnızca kullanıcının tarayıcısındaki `localStorage` alanında tutulur; GitHub kaynak koduna veya build çıktısına yazılmaz.
- İlk bağlantıdan sonra aynı tarayıcıdaki yeni sekmeler Pro hesabı otomatik kullanır. Kullanıcı “Bağlantıyı kes” dediğinde anahtar silinir.
- Sağ üstteki hesap görseli tıklanabilir değildir ve giriş sayfası açmaz. Kayıtlı Pro bağlantısı yoksa uygulama giriş istemeden Space'in genel API erişimini kullanır.
- Site kaynak kodunda kullanıcı anahtarı veya sunucu sırrı bulunmaz.

## Yayın

GitHub Pages çıktısı `dist/` klasöründedir.
