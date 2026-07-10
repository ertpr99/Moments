# Moments

Moments gerçek test sürümü. Ana uygulama React + Vite ile kök dizinden çalışır; Developer Preview Dashboard bu pakette kullanılmaz.

## Local Kurulum

```bash
npm install
npm run dev
```

`.env.local` dosyası:

```bash
SUPABASE_URL=
SUPABASE_ANON_KEY=
STORAGE_BUCKET_NAME=moments
```

`SUPABASE_SERVICE_ROLE_KEY` client tarafına koyulmaz.

## Build

```bash
npm run build
npm run preview
```

Build çıktısı:

```text
dist/
```

## Vercel

- Root Directory: repo root
- Install Command: `npm install`
- Build Command: `npm run build`
- Output Directory: `dist`

Environment Variables:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `STORAGE_BUCKET_NAME`

## Supabase

Supabase SQL dosyaları `supabase/manual/` altında tutulur. Momentlerin iki kez açılabilmesi için `open_count` alanını ekleyen dosya:

```text
supabase/manual/08_moment_open_count.sql
```

## Android Hazırlığı

```bash
npm run build
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap add android
npx cap sync android
npx cap open android
```
