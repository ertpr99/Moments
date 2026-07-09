#!/usr/bin/env bash
set -euo pipefail

PROJECT_REF="${1:-}"

if [ -z "$PROJECT_REF" ]; then
  echo "Kullanim: ./scripts/setup-supabase.sh <project-ref>"
  exit 1
fi

echo "Moments Supabase backend kurulumu basliyor..."
echo "Project ref: $PROJECT_REF"

if ! command -v npx >/dev/null 2>&1; then
  echo "npx bulunamadi. Node.js/npm kurulu olmali."
  exit 1
fi

npx supabase@latest login
npx supabase@latest link --project-ref "$PROJECT_REF"
npx supabase@latest db push

echo "Kurulum tamamlandi."
echo "Son adim: Supabase Dashboard > Authentication > Providers > Email bolumunde Email provider'in acik oldugunu kontrol et."
