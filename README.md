# Moments

Moments, Supabase destekli React + Vite beta uygulamasıdır.

## Özellikler

- Email/password kayıt ve giriş
- Kayıt alanları: ad, soyad, kullanıcı adı, e-posta, şifre, profil fotoğrafı
- Sadece arkadaşlık sistemi
- Arkadaş isteği gönderme, kabul etme, reddetme
- Sadece arkadaşlarla sohbet
- Mesaja çift dokununca: Herkesten sil / Kendim için sil
- Kamera ile Moment çekme
- Kendi çektiğin Moment'i cihaza indirme
- Moment gönderme ve açılınca ekrandan çıkışta açılmış sayma
- 24 saat expired kuralına hazır database sorguları
- Karşı tarafın gelen Moment'i açılmadan ona yeni Moment gönderme engeli
- Keşfet puan sıralaması
- Profilde arkadaş sayısı, toplam puan, atılan Moment, açılan Moment
- Light/Dark mode

## Local Kurulum

```bash
npm install
```

`.env.example` dosyasını `.env.local` olarak kopyala:

```bash
SUPABASE_URL=
SUPABASE_ANON_KEY=
STORAGE_BUCKET_NAME=moments
```

Supabase Dashboard > Project Settings > API bölümünden:

- `SUPABASE_URL`: Project URL
- `SUPABASE_ANON_KEY`: Publishable Key / anon public key
- `STORAGE_BUCKET_NAME`: `moments`

## Komutlar

```bash
npm run dev
npm run build
npm run preview
```

## GitHub'a Yükleme

Bu klasörün içindeki dosyaları GitHub repo ana dizinine koy:

```text
package.json
index.html
vite.config.js
vercel.json
README.md
.gitignore
.env.example
src/
public/
supabase/
```

`.env.local` GitHub'a yüklenmemelidir.

## Vercel Deploy

Vercel'de GitHub repo'yu import et.

Ayarlar:

```text
Framework Preset: Vite
Root Directory: repo root
Build Command: npm run build
Output Directory: dist
```

Environment Variables:

```text
SUPABASE_URL
SUPABASE_ANON_KEY
STORAGE_BUCKET_NAME
```

`STORAGE_BUCKET_NAME` değeri:

```text
moments
```

## Android APK Hazırlığı

```bash
npm install
npm run build
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap add android
npx cap sync android
npx cap open android
```

Android Studio içinde development/test APK oluşturabilirsin.

## Supabase

Supabase kurulumu daha önce yapıldıysa tekrar SQL çalıştırmana gerek yok.

Yedek kurulum dosyaları `supabase/` klasöründedir.
