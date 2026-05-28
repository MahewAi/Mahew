# LibreChat Scripts

Utility scripts untuk maintain BP alignment + canon compliance LibreChat deployment.

## Scripts

### `validate-yaml.sh`

Cek `librechat.yaml`:
1. File exists
2. YAML syntax (kalau yq atau pyyaml installed — skip kalau tidak ada)
3. 5 BP-aligned agents present (Atmaja, CMO, COO, CCO, CFO)
4. 15 BP terminology terms present (Dunia Pintu Indonesia, tagline, etc.)
5. 5 anti-pattern terms either absent atau flagged sebagai AVOID
6. Em-dash count

**Usage:**
```bash
bash scripts/validate-yaml.sh
```

**Exit code:** 0 = pass, 1 = fail.

**Optional dependency:** `yq` untuk syntax check. Install dari https://github.com/mikefarah/yq.

### `check-canon.sh`

Cek brand canon compliance pada agent output. Cocok kalau Matthew copy output dari LibreChat dan mau verifikasi compliant sebelum publish.

**Usage:**
```bash
# Pipe input
echo "Tagline 1000 Pintu Mimpi" | bash scripts/check-canon.sh

# File input
bash scripts/check-canon.sh path/to/output.txt

# Stdin redirect
bash scripts/check-canon.sh < output.txt
```

**Detection:**

LOCKED violations (must be 0):
- Em-dash
- Old tagline "Tempat impian dimulai dari pintu yang tepat"
- "Matthew Wijaya"
- Aesop/DWR anchor reference
- "4-Dunia LOCKED mandatory archetype"

Warnings (review):
- "rumah" in customer-facing context
- "premium curated" Aesop-style
- Aggressive sales language
- "Mitra Dagang" framed as customer persona
- Commission-based KPI for Door Expert / MA
- Sycophantic language

**Exit code:** 0 = pass (0 violations + ≤2 warnings), 1 = fail.

### `smoke-test.md`

Test scenario manual untuk LibreChat agents post-deploy. 10 scenario per agent × 5 agent = 50 scenario total.

**Usage:** Open di markdown viewer, run scenario satu-satu di LibreChat UI, scoring per scenario. Lihat detail di file.

## Recommended Pre-Deploy Workflow

```bash
# 1. Edit librechat.yaml
$EDITOR librechat.yaml

# 2. Validate syntax + canon
bash scripts/validate-yaml.sh

# 3. Commit + push (Railway auto-deploy)
git add librechat.yaml
git commit -m "feat(librechat): {what changed}"
git push

# 4. Wait Railway build ~2-3 min

# 5. Smoke test post-deploy
# Open scripts/smoke-test.md
# Run sample 2 scenario per agent (10 total)
# Score + log result
```

## Recommended Post-Output Workflow

Setelah agent generate output yang akan publish (caption, press release, copy):

```bash
# Copy output ke file
$EDITOR output.txt   # paste agent output

# Cek canon
bash scripts/check-canon.sh output.txt

# Kalau pass: publish
# Kalau fail: revise + re-check
```

## Future Scripts (Phase D)

- `mcp-test.sh` — test MCP Gerai connection setelah deployed
- `agent-handoff-test.sh` — simulate inter-agent routing
- `cost-monitor.sh` — Railway + provider API spend tracker

Untuk sekarang: 2 script + 1 test doc cukup untuk maintain quality solo.
