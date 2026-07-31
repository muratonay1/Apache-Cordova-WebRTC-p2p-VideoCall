======================================================================
     APACHE CORDOVA & WEBRTC P2P VIDEO CALL - KURULUM REHBERİ
======================================================================

Bu proje; Apache Cordova, WebRTC ve Node.js (WebSocket) altyapısı 
kullanılarak geliştirilmiş, Mobil (iOS/Android) ve Web uyumlu P2P 
Sesli ve Görüntülü Arama uygulamasıdır.


----------------------------------------------------------------------
ADIM 1: GLOBAL PAKETLER VE NGROK YAPILANDIRMASI
----------------------------------------------------------------------
1. Terminal veya Komut İstemini (CMD) açın ve gerekli paketleri kurun:

   npm install -g cordova ngrok


2. Ngrok Authtoken anahtarınızı tanımlayın:

   ngrok config add-authtoken TOKEN_BILGINIZI_BURAYA_YAZIN


3. Web/WebSocket sunucusu için 8000 portunu dışarıya açın:

   npx ngrok http 8000

   * NOT: Ngrok ekranında çıkan "https://xxxx.ngrok-free.app" adresini 
     kopyalayın (Mobil cihazlardan bu adresle bağlanılacaktır).


----------------------------------------------------------------------
ADIM 2: SİNYALLEŞME VE WEB SUNUCUSUNU BAŞLATMA
----------------------------------------------------------------------
Yeni bir terminal penceresi açın ve sunucuyu başlatın:

1. Sunucu klasörüne gidin:

   cd src/server


2. Node.js sunucusunu çalıştırın:

   node server.js

   * Sunucu aktifleştiğinde 8000 portu üzerinden hem Web arayüzü 
     hem de WebSocket sinyalleşmesi (Loglama & Meşgul mantığı) çalışacaktır.


----------------------------------------------------------------------
ADIM 3: CORDOVA UYGULAMASINI ÇALIŞTIRMA (BROWSER / MOBİL)
----------------------------------------------------------------------
Yeni bir terminal penceresi açıp projenin ana kök dizininde çalıştırın:

1. Browser platformunu projeye ekleyin:

   cordova platform add browser


2. Uygulamayı tarayıcıda başlatın:

   cordova run browser


----------------------------------------------------------------------
ADIM 4: İPHONE / ANDROID MOBİL CİHAZDAN BAĞLANMA
----------------------------------------------------------------------
1. Mobil cihazınızın (iOS Safari veya Android Chrome) tarayıcısını açın.
2. ADIM 1'de Ngrok'un verdiği "https://xxxx.ngrok-free.app" adresini yazın.
3. Ekrana gelen Kamera ve Mikrofon izinlerini onaylayın.
4. Kullanıcı adınızı yazarak Sesli veya Görüntülü aramayı başlatın!

======================================================================