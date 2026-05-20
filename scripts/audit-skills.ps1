param(
  [string[]]$Roots = @(
    ".agents/skills",
    "$env:USERPROFILE/.codex/skills",
    "$env:USERPROFILE/.codex/plugins/cache"
  )
)

$ErrorActionPreference = "Stop"

function Get-FrontmatterValue {
  param(
    [string]$Yaml,
    [string]$Key
  )

  $match = [regex]::Match($Yaml, "(?ms)^$([regex]::Escape($Key)):\s*(.+?)(?:\r?\n[a-zA-Z_-]+:|\z)")
  if (-not $match.Success) {
    return ""
  }

  return $match.Groups[1].Value.Trim().Trim('"').Trim("'")
}

$skillFiles = foreach ($root in $Roots) {
  if (Test-Path -LiteralPath $root) {
    Get-ChildItem -LiteralPath $root -Recurse -Force -Filter SKILL.md
  }
}

$results = foreach ($file in $skillFiles) {
  $text = Get-Content -Raw -LiteralPath $file.FullName
  $frontmatter = [regex]::Match($text, "^---\s*\r?\n(?<yaml>[\s\S]*?)\r?\n---", "Multiline")
  $yaml = if ($frontmatter.Success) { $frontmatter.Groups["yaml"].Value } else { "" }
  $name = Get-FrontmatterValue -Yaml $yaml -Key "name"
  $description = Get-FrontmatterValue -Yaml $yaml -Key "description"
  $agentsFile = Join-Path $file.DirectoryName "agents/openai.yaml"

  $issues = New-Object System.Collections.Generic.List[string]
  if (-not $frontmatter.Success) { $issues.Add("missing frontmatter") }
  if (-not $name) { $issues.Add("missing name") }
  if (-not $description) { $issues.Add("missing description") }
  if ($name -and $name -notmatch "^[A-Za-z0-9][A-Za-z0-9_-]*$") { $issues.Add("name has unusual characters") }
  if ($description.Length -gt 900) { $issues.Add("description is long") }

  [PSCustomObject]@{
    Status = if ($issues.Count -eq 0) { "OK" } elseif ($frontmatter.Success -and $name -and $description) { "WARN" } else { "FAIL" }
    Name = $name
    Folder = Split-Path $file.DirectoryName -Leaf
    HasAgentsMetadata = Test-Path -LiteralPath $agentsFile
    Issues = if ($issues.Count -eq 0) { "" } else { $issues -join "; " }
    Path = $file.FullName
  }
}

$results | Sort-Object Status, Name | Format-Table -AutoSize

$total = @($results).Count
$ok = @($results | Where-Object Status -eq "OK").Count
$warn = @($results | Where-Object Status -eq "WARN").Count
$fail = @($results | Where-Object Status -eq "FAIL").Count
Write-Host "TOTAL=$total OK=$ok WARN=$warn FAIL=$fail"

if ($fail -gt 0) {
  exit 1
}
