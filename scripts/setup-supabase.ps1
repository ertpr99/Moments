param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectRef
)

$ErrorActionPreference = "Stop"

Write-Host "Moments Supabase backend kurulumu basliyor..." -ForegroundColor Cyan
Write-Host "Project ref: $ProjectRef" -ForegroundColor DarkCyan

if (-not (Get-Command npx -ErrorAction SilentlyContinue)) {
  throw "npx bulunamadi. Node.js/npm kurulu olmali."
}

Write-Host "Supabase CLI oturumu kontrol ediliyor..." -ForegroundColor Cyan
npx supabase@latest login

Write-Host "Supabase projesi linkleniyor..." -ForegroundColor Cyan
npx supabase@latest link --project-ref $ProjectRef

Write-Host "Migration uygulaniyor: tablolar, indexler, RLS, storage ve realtime..." -ForegroundColor Cyan
npx supabase@latest db push

Write-Host "Kurulum tamamlandi." -ForegroundColor Green
Write-Host "Son adim: Supabase Dashboard > Authentication > Providers > Email bolumunde Email provider'in acik oldugunu kontrol et." -ForegroundColor Yellow
