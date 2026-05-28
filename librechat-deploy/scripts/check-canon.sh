#!/usr/bin/env bash
# Check brand canon compliance pada output dari agent.
# Usage: bash scripts/check-canon.sh < output.txt
# Atau: cat output.txt | bash scripts/check-canon.sh
# Atau: echo "your text here" | bash scripts/check-canon.sh

set -e

INPUT="${1:-/dev/stdin}"
if [ -f "$INPUT" ]; then
  CONTENT=$(cat "$INPUT")
else
  CONTENT=$(cat)
fi

VIOLATIONS=0
WARNINGS=0

echo "=== Brand Canon Compliance Check ==="
echo ""

# === LOCKED violations ===
echo "--- Strict LOCKED rules (any hit = FAIL) ---"

# Em-dash
EM_COUNT=$(echo "$CONTENT" | grep -cP '—' || true)
if [ "$EM_COUNT" -gt 0 ]; then
  echo "❌ Em-dash detected ($EM_COUNT occurrence)"
  echo "$CONTENT" | grep -nP '—' | head -3 | sed 's/^/   /'
  VIOLATIONS=$((VIOLATIONS + 1))
else
  echo "✅ No em-dash"
fi

# Old tagline
if echo "$CONTENT" | grep -qi "Tempat impian dimulai dari pintu yang tepat"; then
  echo "❌ Old tagline detected: 'Tempat impian dimulai dari pintu yang tepat'"
  VIOLATIONS=$((VIOLATIONS + 1))
else
  echo "✅ No old tagline"
fi

# Matthew Wijaya
if echo "$CONTENT" | grep -qi "Matthew Wijaya"; then
  echo "❌ 'Matthew Wijaya' detected — Matthew preference LOCKED ('Matthew' saja)"
  VIOLATIONS=$((VIOLATIONS + 1))
else
  echo "✅ No 'Matthew Wijaya'"
fi

# Aesop / DWR / Kinfolk as anchor reference (broader pattern)
if echo "$CONTENT" | grep -qiE "(Aesop|Design Within Reach|\bDWR\b|Kinfolk)"; then
  # Filter: OK kalau dalam konteks "AVOID" / "TIDAK" / "BUKAN" / "anti-pattern"
  matched=$(echo "$CONTENT" | grep -iE "(Aesop|Design Within Reach|\bDWR\b|Kinfolk)" | grep -viE 'AVOID|REJECT|TIDAK|BUKAN|ANTI|NOT di|jangan|hindari' || true)
  if [ -n "$matched" ]; then
    echo "❌ Aesop/DWR/Kinfolk reference detected (TIDAK di BP)"
    echo "$matched" | head -3 | sed 's/^/   /'
    VIOLATIONS=$((VIOLATIONS + 1))
  else
    echo "✅ Aesop/DWR/Kinfolk only mentioned as AVOID anti-pattern (OK)"
  fi
else
  echo "✅ No Aesop/DWR/Kinfolk reference"
fi

# 4-Dunia LOCKED mandatory archetype
if echo "$CONTENT" | grep -qiE "(Filosofi 4-Dunia|4-Dunia archetype)\s+(LOCKED|mandatory|wajib|customer archetype)"; then
  echo "❌ '4-Dunia LOCKED mandatory archetype' detected (TIDAK di BP — cultural context only)"
  VIOLATIONS=$((VIOLATIONS + 1))
else
  echo "✅ No '4-Dunia LOCKED mandatory archetype'"
fi

echo ""
echo "--- Warnings (likely issue, manual review) ---"

# "rumah" in customer-facing context
RUMAH_COUNT=$(echo "$CONTENT" | grep -ciP '\brumah\b' || true)
if [ "$RUMAH_COUNT" -gt 0 ]; then
  echo "⚠️  'rumah' detected ($RUMAH_COUNT) — should use 'tempat' if customer-facing"
  echo "$CONTENT" | grep -niP '\brumah\b' | head -3 | sed 's/^/   /'
  WARNINGS=$((WARNINGS + 1))
fi

# "premium curated" Aesop-style
if echo "$CONTENT" | grep -qiE "premium curated retail|premium curated standard|premium curated positioning"; then
  echo "⚠️  'premium curated' Aesop-style detected — BP pakai 'premium tetapi inklusif'"
  WARNINGS=$((WARNINGS + 1))
fi

# Aggressive sales language
if echo "$CONTENT" | grep -qiE "(MURAH|DISKON BESAR|PROMO HEBOH|BURUAN|SEGERA BELI)"; then
  echo "⚠️  Aggressive sales language detected — tone 'advisor yang membantu' preferred"
  WARNINGS=$((WARNINGS + 1))
fi

# Mitra Dagang as customer persona
if echo "$CONTENT" | grep -qiE "Mitra Dagang.*(persona|customer|konsumen target)"; then
  echo "⚠️  'Mitra Dagang' framed as customer persona — they are channel partner (BUKAN persona)"
  WARNINGS=$((WARNINGS + 1))
fi

# Commission-based KPI
if echo "$CONTENT" | grep -qiE "(commission|komisi).*(Door Expert|MA|Marketing Advisor|sales)"; then
  echo "⚠️  Commission-based KPI for Door Expert / MA detected — LOCKED no-commission"
  WARNINGS=$((WARNINGS + 1))
fi

# Sycophantic language
if echo "$CONTENT" | grep -qiE "(perfect|amazing|wonderful|excellent question|great point|brilliant)"; then
  echo "⚠️  Sycophantic phrasing detected — independent synthesis preferred"
  WARNINGS=$((WARNINGS + 1))
fi

echo ""
echo "--- Required canon elements (presence check, if relevant) ---"

REQUIRED_PRESENT=0
for term in "Dunia Pintu" "Door Expert" "Marketing Advisor" "1000 Pintu" "Filosofi"; do
  if echo "$CONTENT" | grep -qi "$term"; then
    REQUIRED_PRESENT=$((REQUIRED_PRESENT + 1))
  fi
done
echo "ℹ️  BP terminology present: $REQUIRED_PRESENT/5 (Dunia Pintu, Door Expert, Marketing Advisor, 1000 Pintu, Filosofi)"

echo ""
echo "=== Summary ==="
echo "LOCKED violations: $VIOLATIONS (must be 0)"
echo "Warnings: $WARNINGS (review)"
echo "BP terminology: $REQUIRED_PRESENT/5"

if [ "$VIOLATIONS" -eq 0 ] && [ "$WARNINGS" -le 2 ]; then
  echo ""
  echo "✅ PASS — canon compliant"
  exit 0
elif [ "$VIOLATIONS" -eq 0 ]; then
  echo ""
  echo "⚠️  WARNINGS only — review then approve"
  exit 0
else
  echo ""
  echo "❌ FAIL — fix LOCKED violations before approve"
  exit 1
fi
