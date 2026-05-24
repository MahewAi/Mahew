# E2E test script untuk Lapis 3 (PDF persistence via Vercel Blob).
# Run setelah Matthew setup Vercel Blob (BLOB_READ_WRITE_TOKEN injected).
#
# Usage: .\scripts\test-lapis3-e2e.ps1
# Atau dari PowerShell: pwsh .\scripts\test-lapis3-e2e.ps1
#
# Test scenario:
# 1. Health check — verify fileLibrary=true
# 2. Upload PDF manuskrip ke library
# 3. List library — verify file ada + totalMegabytes accurate
# 4. Chat dengan attachedFileIds — verify Atmaja baca dari Blob
# 5. Delete file dari library

$ErrorActionPreference = 'Continue'
$token = (Get-Content "$PSScriptRoot\..\.env.local" | Select-String 'N8N_WEBHOOK_TOKEN=' | ForEach-Object { ($_ -split '=', 2)[1].Trim() })
$baseUrl = 'https://gerai.mahewwork.com'
$pdfPath = 'C:\Users\PC\Documents\Gerai 1000 Pintu\Gerai 1000 Pintu bab 1-15.pdf'

if (-not $token) {
  Write-Output 'ERROR: N8N_WEBHOOK_TOKEN tidak ditemukan di .env.local'
  exit 1
}

Write-Output '=== TEST 1: Health check ==='
$h = Invoke-RestMethod -Uri "$baseUrl/api/agent/health" -TimeoutSec 10
Write-Output "fileLibrary: $($h.chat.capabilities.fileLibrary)"
Write-Output "longTermMemory: $($h.chat.capabilities.longTermMemory)"
Write-Output "pdfNative: $($h.chat.capabilities.pdfNative)"
if ($h.chat.capabilities.fileLibrary -ne $true) {
  Write-Output 'STOP: fileLibrary belum aktif. Setup Vercel Blob di dashboard dulu.'
  exit 1
}
Write-Output ''

Write-Output '=== TEST 2: Upload PDF ke library ==='
if (-not (Test-Path $pdfPath)) {
  Write-Output "PDF test file tidak ada: $pdfPath"
  Write-Output "Edit script ini, ganti `$pdfPath ke PDF lain (max 2.5 MB)."
  exit 1
}
$bytes = [System.IO.File]::ReadAllBytes($pdfPath)
$base64 = [Convert]::ToBase64String($bytes)
$uploadPayload = @{
  name = (Split-Path $pdfPath -Leaf)
  contentType = 'application/pdf'
  dataBase64 = $base64
  description = 'E2E test upload via script'
} | ConvertTo-Json -Depth 5 -Compress

$up = Invoke-RestMethod -Uri "$baseUrl/api/atmaja/files" -Method POST -Body $uploadPayload -ContentType 'application/json' -Headers @{Authorization="Bearer $token"} -TimeoutSec 60
Write-Output "ok=$($up.ok)"
Write-Output "fileId=$($up.file.id)"
Write-Output "name=$($up.file.name)"
Write-Output "size=$($up.file.size) bytes"
Write-Output "pageCount=$($up.file.pageCount)"
Write-Output "blobUrl=$($up.file.blobUrl)"
$fileId = $up.file.id
Write-Output ''

Write-Output '=== TEST 3: List library ==='
$list = Invoke-RestMethod -Uri "$baseUrl/api/atmaja/files" -Headers @{Authorization="Bearer $token"} -TimeoutSec 10
Write-Output "count=$($list.count) max=$($list.max)"
Write-Output "totalMB=$($list.totalMegabytes)"
Write-Output ''

Write-Output '=== TEST 4: Chat dengan attachedFileIds ==='
$chatPayload = @{
  userMessage = 'Lihat PDF di library yang baru saya upload, kasih saya 3 poin paling penting dari isinya.'
  history = @()
  attachments = @()
  attachedFileIds = @($fileId)
} | ConvertTo-Json -Depth 5 -Compress
$start = Get-Date
$r = Invoke-RestMethod -Uri "$baseUrl/api/atmaja/chat" -Method POST -Body $chatPayload -ContentType 'application/json' -Headers @{Authorization="Bearer $token"} -TimeoutSec 180
$dur = ((Get-Date) - $start).TotalSeconds
Write-Output "Duration: $([math]::Round($dur, 1))s"
Write-Output "ok=$($r.ok) model=$($r.model)"
Write-Output "attachmentsPolicy=$($r.attachmentsPolicy)"
Write-Output "libraryPdfsSent=$($r.attachmentsSummary.libraryPdfsSent)"
Write-Output "Reply preview (500 chars):"
Write-Output $r.text.Substring(0, [Math]::Min(500, $r.text.Length))
Write-Output ''

Write-Output '=== TEST 5: Delete file (optional, comment out kalau mau keep) ==='
Write-Output 'Skip delete by default — uncomment baris di bawah untuk delete.'
# $del = Invoke-RestMethod -Uri "$baseUrl/api/atmaja/files?id=$fileId" -Method DELETE -Headers @{Authorization="Bearer $token"} -TimeoutSec 10
# Write-Output "Delete ok=$($del.ok) remainingCount=$($del.remainingCount)"

Write-Output ''
Write-Output '=== ALL TESTS PASSED kalau ada output reply Atmaja di atas ==='
