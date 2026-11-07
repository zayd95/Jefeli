#!/usr/bin/env bash
# Runs every SQL block of docs/PILOT_METRICS.md (each one a read-only transaction) and stops at
# the first error. Default target: the local Supabase database. Against the pilot project, pass
# its connection string: DB_URL='postgresql://…' scripts/check-pilot-metrics.sh
set -euo pipefail
DB_URL="${DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
DOC="$(dirname "$0")/../docs/PILOT_METRICS.md"
n=0
while IFS= read -r -d '' block; do
  n=$((n + 1))
  echo "── query block $n"
  printf '%s\n' "$block" | psql "$DB_URL" -X -q -v ON_ERROR_STOP=1 -P pager=off
done < <(awk '/^```sql$/{f=1; b=""; next} /^```$/{if(f){printf "%s%c", b, 0}; f=0; next} f{b=b $0 "\n"}' "$DOC")
echo "$n query blocks ran without error."
