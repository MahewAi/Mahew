# Set OPENROUTER_API_KEY di .env.local
# Jalanin di PowerShell window sendiri.
# Cara pakai:
#   cd "C:\Users\PC\Documents\Claude\Projects\Gerai app"
#   .\scripts\set-openrouter-key.ps1

$ErrorActionPreference = 'Stop'

$envFile = Resolve-Path (Join-Path $PSScriptRoot '..\.env.local')

if (-not (Test-Path $envFile)) {
    Write-Host "ERROR: .env.local tidak ditemukan di $envFile" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=== Set OPENROUTER_API_KEY ===" -ForegroundColor Cyan
Write-Host "File target: $envFile"
Write-Host ""
Write-Host "Paste API key (input ke-hide, akan tampil sebagai *), tekan Enter:" -ForegroundColor Yellow

$secure = Read-Host -AsSecureString
$plain  = [System.Net.NetworkCredential]::new('', $secure).Password

if ([string]::IsNullOrWhiteSpace($plain)) {
    Write-Host "ERROR: key kosong, batal." -ForegroundColor Red
    exit 1
}

if ($plain -notmatch '^sk-or-') {
    Write-Host "WARNING: key biasanya mulai dengan 'sk-or-'. Yang kamu paste tidak begitu." -ForegroundColor Yellow
    $ans = Read-Host "Tetap lanjut? (y/N)"
    if ($ans -ne 'y') { Write-Host "Batal."; exit 1 }
}

# Read file as array of lines, replace target line, write back.
$lines = Get-Content $envFile
$found = $false
$newLines = foreach ($line in $lines) {
    if ($line -like 'OPENROUTER_API_KEY=*') {
        $found = $true
        "OPENROUTER_API_KEY=$plain"
    } else {
        $line
    }
}

if (-not $found) {
    Write-Host "ERROR: baris OPENROUTER_API_KEY= tidak ditemukan di file." -ForegroundColor Red
    exit 1
}

Set-Content -Path $envFile -Value $newLines -Encoding utf8

Write-Host ""
Write-Host "OK. API key terpasang ($($plain.Length) karakter)." -ForegroundColor Green

# Verify (preview hanya prefix + suffix, tidak full value)
$verifyLine = (Get-Content $envFile | Where-Object { $_ -like 'OPENROUTER_API_KEY=*' })
if ($verifyLine -and $verifyLine.Length -gt 30) {
    $prefix = $verifyLine.Substring(0, 25)
    $suffix = $verifyLine.Substring($verifyLine.Length - 4)
    Write-Host "Preview: $prefix...$suffix" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "Done. Balik ke chat AI, bilang 'sudah'." -ForegroundColor Green
