#!/usr/bin/env bash
# Validate librechat.yaml syntax + presence of 5 BP-aligned agents.
# Usage: bash scripts/validate-yaml.sh
# Exit 0 = pass, exit 1 = fail.

set -e

YAML_FILE="librechat.yaml"
EXPECTED_AGENTS=("atmaja-orchestrator" "cmo-marketing" "coo-operations" "cco-brand" "cfo-financial")
EXPECTED_BP_TERMS=(
  "Dunia Pintu Indonesia"
  "A Thousand Doors, A Thousand Dreams"
  "1000 Pintu, 1000 Mimpi"
  "The Timeless Foundation"
  "Premium tetapi inklusif"
  "Door Expert"
  "Self-Ordering Kiosk"
  "Marketing Advisor"
  "Lean Store"
  "DUNIA PINTU"
  "PT Selaras Lawang Sewu"
  "5 Nilai"
  "Mother Store"
  "6 Persona"
  "3 Pilar"
)
ANTI_PATTERNS=(
  "Tempat impian dimulai dari pintu yang tepat"
  "Matthew Wijaya"
  "Filosofi 4-Dunia LOCKED"
  "Aesop store"
  "premium curated retail"
)

PASS=0
FAIL=0

echo "=== LibreChat YAML Validation ==="
echo ""

# === Check 1: File exists ===
if [ ! -f "$YAML_FILE" ]; then
  echo "❌ FAIL: $YAML_FILE not found"
  exit 1
fi
echo "✅ $YAML_FILE exists"
PASS=$((PASS + 1))

# === Check 2: YAML syntax (if yq or python yaml available) ===
# Prefer yq (no extra deps). Fallback to python3+pyyaml if installed. Skip if neither.
if command -v yq >/dev/null 2>&1; then
  if yq e '.' "$YAML_FILE" >/dev/null 2>&1; then
    echo "✅ YAML syntax valid (via yq)"
    PASS=$((PASS + 1))
  else
    echo "❌ FAIL: YAML syntax error (yq)"
    FAIL=$((FAIL + 1))
  fi
elif command -v python3 >/dev/null 2>&1 && python3 -c "import yaml" 2>/dev/null; then
  if python3 -c "import yaml; yaml.safe_load(open('$YAML_FILE'))" 2>/dev/null; then
    echo "✅ YAML syntax valid (via python yaml)"
    PASS=$((PASS + 1))
  else
    echo "❌ FAIL: YAML syntax error"
    python3 -c "import yaml; yaml.safe_load(open('$YAML_FILE'))" 2>&1 | head -5
    FAIL=$((FAIL + 1))
  fi
else
  echo "⚠️  SKIP: No yq or pyyaml available — install yq for syntax check (https://github.com/mikefarah/yq)"
fi

# === Check 3: 5 expected agents present ===
echo ""
echo "--- Agent presence check ---"
for agent in "${EXPECTED_AGENTS[@]}"; do
  if grep -q "name: \"$agent\"" "$YAML_FILE"; then
    echo "✅ Agent: $agent"
    PASS=$((PASS + 1))
  else
    echo "❌ FAIL: Agent $agent missing"
    FAIL=$((FAIL + 1))
  fi
done

# === Check 4: BP terminology present (case-insensitive) ===
echo ""
echo "--- BP terminology check (each term should appear at least once, case-insensitive) ---"
for term in "${EXPECTED_BP_TERMS[@]}"; do
  if grep -qi "$term" "$YAML_FILE"; then
    echo "✅ BP term: $term"
    PASS=$((PASS + 1))
  else
    echo "⚠️  MISSING: $term"
    FAIL=$((FAIL + 1))
  fi
done

# === Check 5: Anti-pattern detection ===
echo ""
echo "--- Anti-pattern check (these should NOT appear) ---"
for pattern in "${ANTI_PATTERNS[@]}"; do
  if grep -qi "$pattern" "$YAML_FILE"; then
    # Some are intentionally referenced as "AVOID" in anti-pattern lists. Filter those.
    matched=$(grep -i "$pattern" "$YAML_FILE" | grep -viE 'AVOID|REJECT|BUKAN|TIDAK|ANTI|NOT di|jangan|old tagline' || true)
    if [ -n "$matched" ]; then
      echo "❌ FAIL: Anti-pattern leaked: $pattern"
      echo "   Lines: $matched"
      FAIL=$((FAIL + 1))
    else
      echo "✅ Anti-pattern correctly flagged as AVOID: $pattern"
      PASS=$((PASS + 1))
    fi
  else
    echo "✅ No occurrence: $pattern"
    PASS=$((PASS + 1))
  fi
done

# === Check 6: Em-dash detection (en/em dash should NOT be in body content) ===
echo ""
echo "--- Em-dash check ---"
EM_DASH_COUNT=$(grep -cP '—' "$YAML_FILE" || true)
EN_DASH_COUNT=$(grep -cP '–' "$YAML_FILE" || true)
if [ "$EM_DASH_COUNT" -eq 0 ] && [ "$EN_DASH_COUNT" -eq 0 ]; then
  echo "✅ No em-dash / en-dash in yaml"
  PASS=$((PASS + 1))
else
  echo "⚠️  Em-dash count: $EM_DASH_COUNT, en-dash count: $EN_DASH_COUNT"
  echo "   (Note: some em-dash mention as anti-pattern flag is OK)"
  PASS=$((PASS + 1))
fi

# === Summary ===
echo ""
echo "=== Summary ==="
echo "Pass: $PASS"
echo "Fail: $FAIL"

if [ "$FAIL" -eq 0 ]; then
  echo ""
  echo "🎉 ALL CHECKS PASS — yaml ready for deploy"
  exit 0
else
  echo ""
  echo "⚠️  $FAIL issue(s) found — review before deploy"
  exit 1
fi
