# Set OPENAI_API_KEY di .env.local + .env.development.local
# Jalanin di PowerShell window:
#   cd "C:\Users\PC\Documents\Claude\Projects\Gerai app"
#   .\scripts\set-openai-key.ps1

$ErrorActionPreference = 'Stop'

$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$files = @(
    (Join-Path $root '.env.local'),
    (Join-Path $root '.env.development.local')
)

foreach ($f in $files) {
    if (-not (Test-Path $f)) {
        Write-Host "WARN: $f tidak ada, skip." -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "=== Set OPENAI_API_KEY ===" -ForegroundColor Cyan
Write-Host "Target: .env.local + .env.development.local"
Write-Host ""
Write-Host "Paste API key dari OpenAI (input ke-hide, tampil sebagai *), tekan Enter:" -ForegroundColor Yellow

$secure = Read-Host -AsSecureString
$plain  = [System.Net.NetworkCredential]::new('', $secure).Password

if ([string]::IsNullOrWhiteSpace($plain)) {
    Write-Host "ERROR: key kosong, batal." -ForegroundColor Red
    exit 1
}

if ($plain -notmatch '^sk-') {
    Write-Host "WARNING: OpenAI key biasanya mulai dengan 'sk-' atau 'sk-proj-'. Yang kamu paste tidak begitu." -ForegroundColor Yellow
    $ans = Read-Host "Tetap lanjut? (y/N)"
    if ($ans -ne 'y') { Write-Host "Batal."; exit 1 }
}

$utf8NoBom = New-Object System.Text.UTF8Encoding $false

foreach ($envFile in $files) {
    if (-not (Test-Path $envFile)) { continue }
    $lines = Get-Content $envFile
    $found = $false
    $newLines = foreach ($line in $lines) {
        if ($line -like 'OPENAI_API_KEY=*') {
            $found = $true
            "OPENAI_API_KEY=$plain"
        } else {
            $line
        }
    }
    if (-not $found) {
        Write-Host "WARN: baris OPENAI_API_KEY= tidak ada di $envFile, append." -ForegroundColor Yellow
        $newLines = @($lines, '', '# === OpenAI ===', "OPENAI_API_KEY=$plain")
    }
    [System.IO.File]::WriteAllLines($envFile, $newLines, $utf8NoBom)
    Write-Host "OK: $envFile updated." -ForegroundColor Green
}

Write-Host ""
Write-Host "Key terpasang ($($plain.Length) karakter). Restart vercel dev:" -ForegroundColor Green
Write-Host "  .\scripts\start-vercel-dev.ps1" -ForegroundColor Cyan
Write-Host ""
Write-Host "Lalu balik ke chat AI, bilang 'openai siap'." -ForegroundColor Green
