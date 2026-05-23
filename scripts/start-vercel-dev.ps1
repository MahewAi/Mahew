# Start vercel dev dengan env vars di-inject dari .env.local ke proses shell.
# Kenapa: vercel dev di linked-project mode tidak baca .env.local untuk serverless functions
# (hanya untuk Vite client). Kita inject ke $env shell supaya child process vercel inherit.

$ErrorActionPreference = 'Stop'

# Refresh PATH (Node baru terinstall, shell session lama belum aware)
$env:Path = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path','User')

$root = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $root

$envFile = Join-Path $root '.env.local'
if (-not (Test-Path $envFile)) {
    Write-Host "ERROR: .env.local tidak ditemukan" -ForegroundColor Red
    exit 1
}

# Parse .env.local — abaikan komentar + baris kosong + baris yang masih punya '#' di depan key
$loaded = @()
Get-Content $envFile | ForEach-Object {
    $line = $_.Trim()
    if ([string]::IsNullOrWhiteSpace($line)) { return }
    if ($line.StartsWith('#')) { return }
    $eqIdx = $line.IndexOf('=')
    if ($eqIdx -lt 1) { return }
    $name = $line.Substring(0, $eqIdx).Trim()
    $value = $line.Substring($eqIdx + 1).Trim()
    # Strip surrounding quotes kalau ada
    if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
        $value = $value.Substring(1, $value.Length - 2)
    }
    [Environment]::SetEnvironmentVariable($name, $value, 'Process')
    $loaded += $name
}

Write-Host "=== Env loaded dari .env.local ===" -ForegroundColor Cyan
foreach ($n in $loaded) {
    $v = [Environment]::GetEnvironmentVariable($n, 'Process')
    if ($n -match 'KEY|TOKEN|SECRET') {
        Write-Host "  $n = <$($v.Length) chars hidden>"
    } else {
        Write-Host "  $n = $v"
    }
}
Write-Host ""
Write-Host "=== Starting vercel dev di port 3000 ===" -ForegroundColor Cyan
Write-Host ""

npx vercel dev --listen 3000
