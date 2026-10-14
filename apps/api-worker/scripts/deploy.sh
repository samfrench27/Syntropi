#!/usr/bin/env bash
# Deploy the API Worker to Cloudflare. Run from apps/api-worker, logged in (`npx wrangler login`),
# on Node 22 or newer. Safe to run again: it reuses the Hyperdrive config and updates secrets.
#
#   bash scripts/deploy.sh
#
# Reads .dev.vars (gitignored) so no secret is typed or printed. It:
#   1. creates the Hyperdrive connection to the database (once) and writes its id into wrangler.toml
#   2. deploys the Worker
#   3. uploads the secrets
set -euo pipefail
cd "$(dirname "$0")/.."

node_major=$(node -p "process.versions.node.split('.')[0]")
if [ "$node_major" -lt 22 ]; then
  echo "Wrangler needs Node 22 or newer (you have $(node -v)). Run: nvm use 23.6.1" >&2
  exit 1
fi
[ -f .dev.vars ] || { echo ".dev.vars not found (see .dev.vars.example)" >&2; exit 1; }

set -a; . ./.dev.vars; set +a
: "${WRANGLER_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE:?missing in .dev.vars}"

echo "Checking Cloudflare login..."
npx wrangler whoami 2>&1 | grep -qi "not authenticated" && { echo "Not logged in. Run: npx wrangler login" >&2; exit 1; }

# 1. Hyperdrive: pooled, cached connections to the database
HD_NAME=syntropi-db
HD_ID=$(npx wrangler hyperdrive list 2>/dev/null | grep -E "\b$HD_NAME\b" | grep -oE "[0-9a-f]{32}" | head -1 || true)
if [ -z "$HD_ID" ]; then
  echo "Creating Hyperdrive config $HD_NAME..."
  HD_ID=$(npx wrangler hyperdrive create "$HD_NAME" --connection-string="$WRANGLER_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE" 2>&1 | grep -oE "[0-9a-f]{32}" | head -1)
fi
[ -n "$HD_ID" ] || { echo "Could not create or find the Hyperdrive config" >&2; exit 1; }
echo "Hyperdrive id: $HD_ID"

python3 - "$HD_ID" <<'PY'
import re, sys
p = 'wrangler.toml'
s = open(p).read()
block = f'[[hyperdrive]]\nbinding = "HYPERDRIVE"\nid = "{sys.argv[1]}"\n'
if re.search(r'^\[\[hyperdrive\]\]', s, re.M):
    s = re.sub(r'\[\[hyperdrive\]\]\nbinding = "HYPERDRIVE"\nid = "[^"]*"\n', block, s)
else:
    s = re.sub(r'# \[\[hyperdrive\]\]\n# binding = "HYPERDRIVE"\n# id = "<hyperdrive-id>"\n', block, s)
open(p, 'w').write(s)
PY

# 2. Deploy
echo "Deploying..."
npx wrangler deploy

# 3. Secrets (from .dev.vars, via a temporary file that is deleted straight after)
tmp=$(mktemp); chmod 600 "$tmp"; trap 'rm -f "$tmp"' EXIT
for name in SUPABASE_URL SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY HOSTED_PAGES_JWT_SECRET TOKEN_WEBHOOK_SECRET \
            TOKEN_API_KEY TOKEN_API_BASE_URL YAPILY_CLIENT_ID YAPILY_CLIENT_SECRET STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET; do
  value="${!name:-}"
  [ -n "$value" ] && printf '%s=%s\n' "$name" "$value" >> "$tmp"
done
echo "Uploading $(wc -l < "$tmp" | tr -d ' ') secrets..."
npx wrangler secret bulk "$tmp"

echo
echo "Done. Your API is at the *.workers.dev address printed above."
echo "Check it: curl <that address>/health"
