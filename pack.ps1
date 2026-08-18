# pack.ps1 - Otomatisasi pack extension + update dist/update.xml
# Usage: .\pack.ps1 -Version "1.2.0"

param(
  [Parameter(Mandatory=$true)]
  [string]$Version
)

$ROOT       = $PSScriptRoot
$DIST       = Join-Path $ROOT "dist"
$MANIFEST   = Join-Path $ROOT "manifest.json"
$UPDATE_XML = Join-Path $DIST "update.xml"
$CHROME     = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$KEY        = Join-Path $ROOT "extension.pem"
$CRX_OUT    = Join-Path $DIST "extension.crx"

# 1. Validasi format versi
if ($Version -notmatch '^\d+\.\d+\.\d+$') {
  Write-Error "Format versi salah. Contoh: 1.2.0"
  exit 1
}

# 2. Bump versi di manifest.json
$manifestRaw = Get-Content $MANIFEST -Raw
$manifestRaw = $manifestRaw -replace '"version":\s*"[^"]+"', "`"version`": `"$Version`""
Set-Content $MANIFEST $manifestRaw -Encoding UTF8 -NoNewline
Write-Host "manifest.json diupdate ke versi $Version"

# 3. Cek Chrome
if (-not (Test-Path $CHROME)) {
  Write-Error "Chrome tidak ditemukan di: $CHROME"
  exit 1
}

# 4. Pack extension jadi .crx
Write-Host "Packing extension..."
if (Test-Path $KEY) {
  & $CHROME --pack-extension=$ROOT --pack-extension-key=$KEY --no-message-box 2>$null
} else {
  & $CHROME --pack-extension=$ROOT --no-message-box 2>$null
  $parentDir = Split-Path $ROOT -Parent
  $generatedPem = Join-Path $parentDir "extensionradiuscopier.pem"
  if (Test-Path $generatedPem) {
    Move-Item $generatedPem $KEY -Force
    Write-Host "Key disimpan ke extension.pem (jangan di-commit!)"
  }
}

$parentDir = Split-Path $ROOT -Parent
$generatedCrx = Join-Path $parentDir "extensionradiuscopier.crx"
if (Test-Path $generatedCrx) {
  New-Item -ItemType Directory -Path $DIST -Force | Out-Null
  Move-Item $generatedCrx $CRX_OUT -Force
  Write-Host "extension.crx disimpan ke dist\extension.crx"
} else {
  Write-Error "Pack gagal - .crx tidak ditemukan."
  exit 1
}

# 5. Update dist/update.xml
$xmlRaw = Get-Content $UPDATE_XML -Raw
$extIdMatch = [regex]::Match($xmlRaw, "appid=.([a-z]{32})")
$extId = if ($extIdMatch.Success) { $extIdMatch.Groups[1].Value } else { "EXTENSION_ID_PLACEHOLDER" }

if ($extId -eq "EXTENSION_ID_PLACEHOLDER") {
  Write-Warning "Extension ID belum diisi di dist\update.xml!"
}

$codebase = "https://illhamjb32.github.io/extensionradiuscopier/dist/extension.crx"
$xmlLines = @(
  "<?xml version=`"1.0`" encoding=`"UTF-8`"?>",
  "<gupdate xmlns=`"http://www.google.com/update2/response`" protocol=`"2.0`">",
  "  <app appid=`"$extId`">",
  "    <updatecheck codebase=`"$codebase`"",
  "                 version=`"$Version`" />",
  "  </app>",
  "</gupdate>"
)
Set-Content $UPDATE_XML $xmlLines -Encoding UTF8
Write-Host "dist\update.xml diupdate ke versi $Version"

# 6. Git add + commit + push
git -C $ROOT add $MANIFEST $UPDATE_XML $CRX_OUT
git -C $ROOT commit -m "release: v$Version"
git -C $ROOT push

Write-Host ""
Write-Host "Selesai! Chrome user akan auto-update dalam ~5 jam."
