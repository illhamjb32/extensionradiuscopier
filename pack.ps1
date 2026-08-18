# pack.ps1 — Otomatisasi pack extension + update dist/update.xml
# Usage: .\pack.ps1 -Version "1.2.0"

param(
  [Parameter(Mandatory=$true)]
  [string]$Version
)

$ROOT    = $PSScriptRoot
$DIST    = "$ROOT\dist"
$MANIFEST = "$ROOT\manifest.json"
$UPDATE_XML = "$DIST\update.xml"
$CHROME  = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$KEY     = "$ROOT\extension.pem"

# 1. Validasi format versi
if ($Version -notmatch '^\d+\.\d+\.\d+$') {
  Write-Error "Format versi salah. Contoh: 1.2.0"
  exit 1
}

# 2. Bump versi di manifest.json
$manifest = Get-Content $MANIFEST -Raw | ConvertFrom-Json
$oldVersion = $manifest.version
$manifest.version = $Version
$manifest | ConvertTo-Json -Depth 10 | Set-Content $MANIFEST -Encoding UTF8
Write-Host "manifest.json: $oldVersion -> $Version"

# 3. Pack extension jadi .crx menggunakan Chrome
if (-not (Test-Path $CHROME)) {
  Write-Error "Chrome tidak ditemukan di: $CHROME`nEdit variabel `$CHROME di pack.ps1"
  exit 1
}

$crxOut = "$DIST\extension.crx"
Write-Host "Packing extension..."

if (Test-Path $KEY) {
  & "$CHROME" --pack-extension="$ROOT" --pack-extension-key="$KEY" --no-message-box 2>$null
} else {
  & "$CHROME" --pack-extension="$ROOT" --no-message-box 2>$null
  # Chrome akan generate .pem di folder parent ROOT
  $generatedPem = "$ROOT\..\extensionradiuscopier.pem"
  if (Test-Path $generatedPem) {
    Move-Item $generatedPem "$KEY" -Force
    Write-Host "Key disimpan ke: $KEY (jangan di-commit!)"
  }
}

# Chrome output .crx di folder parent
$generatedCrx = "$ROOT\..\extensionradiuscopier.crx"
if (Test-Path $generatedCrx) {
  New-Item -ItemType Directory -Path $DIST -Force | Out-Null
  Move-Item $generatedCrx $crxOut -Force
  Write-Host "extension.crx disimpan ke: dist\extension.crx"
} else {
  Write-Error "Pack gagal — .crx tidak ditemukan. Coba pack manual via chrome://extensions."
  exit 1
}

# 4. Update dist/update.xml dengan versi baru
# Baca extension ID dari update.xml yang ada
$xmlContent = Get-Content $UPDATE_XML -Raw
$extId = [regex]::Match($xmlContent, "appid='([^']+)'").Groups[1].Value

if ($extId -eq 'EXTENSION_ID_PLACEHOLDER') {
  Write-Warning "Extension ID belum diisi di dist\update.xml!"
  Write-Warning "Isi EXTENSION_ID_PLACEHOLDER dengan ID extension dari chrome://extensions"
}

$newXml = @"
<?xml version='1.0' encoding='UTF-8'?>
<gupdate xmlns='http://www.google.com/update2/response' protocol='2.0'>
  <app appid='$extId'>
    <updatecheck codebase='https://illhamjb32.github.io/extensionradiuscopier/dist/extension.crx'
                 version='$Version' />
  </app>
</gupdate>
"@
Set-Content $UPDATE_XML $newXml -Encoding UTF8
Write-Host "dist\update.xml diupdate ke versi $Version"

# 5. Git commit + push otomatis
Write-Host ""
Write-Host "Siap di-push. Jalankan:"
Write-Host "  git add manifest.json dist/update.xml dist/extension.crx"
Write-Host "  git commit -m `"release: v$Version`""
Write-Host "  git push"
Write-Host ""
Write-Host "Selesai! Chrome user akan auto-update dalam ~5 jam."
