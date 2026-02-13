#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -f ".env" ]]; then
  echo "[preflight] ❌ .env 不存在，請先建立 .env"
  exit 1
fi

required_vars=(
  "PUBLIC_SUPABASE_URL"
  "PUBLIC_SUPABASE_ANON_KEY"
  "SUPABASE_SERVICE_ROLE_KEY"
)

for var in "${required_vars[@]}"; do
  if ! grep -q "^${var}=" .env; then
    echo "[preflight] ❌ 缺少環境變數: ${var}"
    exit 1
  fi
done

supabase_url="$(grep '^PUBLIC_SUPABASE_URL=' .env | head -n1 | cut -d'=' -f2- | sed 's/^"//;s/"$//')"
if [[ -z "$supabase_url" ]]; then
  echo "[preflight] ❌ PUBLIC_SUPABASE_URL 是空值"
  exit 1
fi

host="$(node -e "const u=new URL(process.argv[1]); console.log(u.hostname);" "$supabase_url" 2>/dev/null || true)"
if [[ -z "$host" ]]; then
  echo "[preflight] ❌ PUBLIC_SUPABASE_URL 格式不正確: $supabase_url"
  exit 1
fi

if ! node -e "require('dns').lookup(process.argv[1], (e)=>process.exit(e?1:0))" "$host"; then
  echo "[preflight] ❌ DNS 無法解析 Supabase 主機: $host"
  echo "[preflight] 建議：切換網路或稍後重試，再執行 npm run test:all:stable"
  exit 1
fi

echo "[preflight] ✅ 環境變數完整"
echo "[preflight] ✅ Supabase DNS 可解析 ($host)"
echo "[preflight] ✅ 可以開始測試"
