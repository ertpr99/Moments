# Moments Test App

Moments Supabase backed test ortamina hazirlanmistir.

## Local env

Supabase baglantisi iki adimlidir:

1. `.env.example` dosyasini `.env.local` olarak kopyala.
2. Supabase Dashboard > Project Settings > API ekranindan asagidaki degerleri `.env.local` icine yapistir.

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY` yani Publishable Key / anon public key
- `STORAGE_BUCKET_NAME`

`.env.local` ornegi:

```bash
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_OR_ANON_PUBLIC_KEY
STORAGE_BUCKET_NAME=moments
```

`SUPABASE_SERVICE_ROLE_KEY` client tarafina koyulmaz. Mevcut build scripti bu secret'i `moments/app/shared/config/env.js` dosyasina yazmaz.

Build config uretimi ve local calistirma:

```bash
npm run build
npm run dev
```

Uygulamanin okudugu dosya:

```text
moments/app/shared/config/env.js
```

Bu dosyayi elle duzenleme. `npm run build` her calistiginda `.env.local` veya Vercel Environment Variables degerlerinden yeniden uretir.

## Supabase

MCP erişimi yoksa SQL Editor'a kod yapistirmadan Supabase CLI ile kur:

Windows:

```powershell
.\scripts\setup-supabase.ps1 -ProjectRef YOUR_PROJECT_REF
```

macOS/Linux:

```bash
chmod +x scripts/setup-supabase.sh
./scripts/setup-supabase.sh YOUR_PROJECT_REF
```

Bu akış:

- Supabase CLI login acar.
- Projeyi linkler.
- `supabase/migrations` altindaki migration'i uygular.
- Tablolari, foreign keyleri, RLS kurallarini, storage bucket/policy'lerini ve realtime publication ayarlarini kurar.

Son kontrol: Supabase Dashboard > Authentication > Providers > Email bolumunde Email provider acik olmali. Hosted Supabase Auth provider ayarlari proje panelinden yonetilir; database migration bunu tam olarak degistiremez.

## Vercel

Build command:

```bash
npm run build
```

Output directory:

```bash
.
```

Vercel env variables:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `STORAGE_BUCKET_NAME`

Opsiyonel server-only secret:

- `SUPABASE_SERVICE_ROLE_KEY`

`SUPABASE_SERVICE_ROLE_KEY` sadece ileride server-side isler icin gerekir. Client bundle'a yazilmaz.

Local CLI ile deploy:

```bash
npm run build
npm run deploy:vercel
```

## Android APK hazirligi

Capacitor ile Android hedefi eklenebilir:

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android
npm run build
npx cap add android
npx cap sync android
npx cap open android
```

Android Studio icinden development/test APK alinabilir. Uygulama acildiginda ayni Supabase backend config'i ile calisir.
