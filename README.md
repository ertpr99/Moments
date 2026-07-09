# Moments

Moments, Supabase destekli React + Vite uygulamasıdır.

## Özellikler

- E-posta ve şifre ile kayıt/giriş
- Kayıt alanları: ad, soyad, kullanıcı adı, e-posta, şifre
- Profil fotoğrafı kayıt sırasında istenmez; Profil > Ayarlar bölümünden sonradan yüklenir
- Supabase `profiles.is_verified` ve `profiles.verified_type` alanlarına bağlı doğrulanmış hesap rozeti
- Kurucu hesabı için `founder`, resmi Moments hesabı için `official` doğrulama tipi
- Sadece arkadaşlık sistemi
- Arkadaş isteği gönderme, kabul etme, reddetme
- Sadece arkadaşlarla sohbet
- Mesaja çift dokununca: Herkesten sil / Kendim için sil
- Kamera ile Moment çekme
- Kendi çektiğin Moment'i cihaza indirme
- Moment gönderme ve açıldıktan sonra ekrandan çıkışta açılmış sayma
- Açılmamış Moment için 24 saat expired kuralı
- Karşı tarafın gelen Moment'i açılmadan ona yeni Moment gönderme engeli
- Keşfet puan sıralaması
- Profilde arkadaş sayısı, toplam puan, atılan Moment, açılan Moment
- Light/Dark mode
- Profesyonel revizyon v2: açılır arkadaş/istek kutuları, profil düzenleme, hesap türü, tam ekran kurallar, tam ekran kamera ve hesap durumu yönetimi
- Eski hesap uyumluluk akışı: eski kullanıcılar giriş yapabilir, profil/ayarları görebilir ve Profil sayfasındaki karttan yeni sisteme geçebilir

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
Install Command: npm install
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

## Supabase

Yeni Supabase kurulumu için `supabase/manual` içindeki dosyalar sırayla çalıştırılabilir.

Daha önce 01-07 dosyalarını çalıştırdıysan doğrulanmış hesap sistemi için yalnızca şunu çalıştır:

```text
supabase/manual/08_verified_accounts.sql
```

Profesyonel revizyon v2 alanları için ardından şunu çalıştır:

```text
supabase/manual/09_profile_revision_v2.sql
```

Bu dosya:

- `profiles.is_verified` alanını ekler
- `profiles.verified_type` alanını ekler
- Kurucu ve resmi hesap doğrulamasını database trigger'ı ile uygular
- Kullanıcının frontend üzerinden bu alanları sahte şekilde değiştirmesini engeller

`09_profile_revision_v2.sql` dosyası:

- `account_type` ve `business_name` alanlarını ekler
- ad, kullanıcı adı ve hesap türü değişim zamanlarını tutar
- profil dondurma ve silme talebi alanlarını ekler
- arama/keşfet filtreleri için index hazırlar

Eski hesaplarda profil uyumsuzsa uygulama kullanıcıyı engellemez; Profil sayfasında `Profil bilgilerini güncelle` kartı gösterir. Kullanıcı profilini güncelleyene kadar aktif sosyal işlemler sınırlandırılır.

Arkadaş isteği iptali için ardından şunu çalıştır:

```text
supabase/manual/10_friend_request_cancel_policy.sql
```

Arkadaş isteğini kabul ederken friendship RLS hatası almamak için ardından şunu da çalıştır:

```text
supabase/manual/11_friendship_accept_policy.sql
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
