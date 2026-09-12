<#
.SYNOPSIS
  Remora Windows Native Release Builder (PowerShell)
.DESCRIPTION
  Builds Remora desktop client natively on Windows (NSIS executable installer and/or MSI package),
  and archives artifacts to release\desktop\.
.EXAMPLE
  .\build.ps1
  .\build.ps1 -NoBump
  .\build.ps1 -Bundle "msi,nsis"
#>

param(
  [string]$Bundle = "nsis",
  [switch]$NoBump,
  [switch]$Clean,
  [switch]$Debug
)

$ErrorActionPreference = "Stop"

Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "         Remora Windows Release Builder              " -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

# 1. Read Version
$PkgJsonPath = Join-Path $ScriptDir "package.json"
$TauriConfPath = Join-Path $ScriptDir "src-tauri\tauri.conf.json"

$AppVersion = "0.1.0"
if (Test-Path $PkgJsonPath) {
  $pkg = Get-Content $PkgJsonPath -Raw | ConvertFrom-Json
  if ($pkg.version) { $AppVersion = $pkg.version }
}

# 2. Version Bump
if (-not $NoBump) {
  $parts = $AppVersion.Split(".")
  if ($parts.Length -ge 3) {
    $patch = [int]$parts[2] + 1
    $NewVersion = "$($parts[0]).$($parts[1]).$patch"
    Write-Host "[INFO] Bumping version: $AppVersion -> $NewVersion" -ForegroundColor Blue

    # Update package.json
    if (Test-Path $PkgJsonPath) {
      (Get-Content $PkgJsonPath) -replace '"version"\s*:\s*"[^"]+"', ('"version": "' + $NewVersion + '"') | Set-Content $PkgJsonPath
    }
    # Update tauri.conf.json
    if (Test-Path $TauriConfPath) {
      (Get-Content $TauriConfPath) -replace '"version"\s*:\s*"[^"]+"', ('"version": "' + $NewVersion + '"') | Set-Content $TauriConfPath
    }
    # Update Cargo.toml
    $CargoPath = Join-Path $ScriptDir "src-tauri\Cargo.toml"
    if (Test-Path $CargoPath) {
      $cargoContent = Get-Content $CargoPath -Raw
      $cargoContent = [regex]::Replace($cargoContent, '(?m)^version\s*=\s*"[^"]+"', "version = `"$NewVersion`"", 1)
      Set-Content $CargoPath $cargoContent
    }
    $AppVersion = $NewVersion
  }
}

Write-Host "[INFO] Target Version: $AppVersion" -ForegroundColor Green

# 3. Environment Checks
$missing = @()
if (-not (Get-Command "pnpm" -ErrorAction SilentlyContinue)) { $missing += "pnpm" }
if (-not (Get-Command "cargo" -ErrorAction SilentlyContinue)) { $missing += "cargo (Rust)" }
if (-not (Get-Command "rustc" -ErrorAction SilentlyContinue)) { $missing += "rustc" }

if ($missing.Count -gt 0) {
  Write-Error "Missing required build tools: $($missing -join ', '). Please install them first."
}

# 4. Clean Cache if requested
$ReleaseDir = Join-Path $ScriptDir "release\desktop"
if ($Clean) {
  Write-Host "[INFO] Cleaning build cache and dist..." -ForegroundColor Yellow
  if (Test-Path "dist") { Remove-Item -Recurse -Force "dist" }
  if (Test-Path $ReleaseDir) { Remove-Item -Recurse -Force $ReleaseDir }
  Push-Location "src-tauri"
  cargo clean
  Pop-Location
}

if (-not (Test-Path "node_modules")) {
  Write-Host "[INFO] Running pnpm install..." -ForegroundColor Blue
  pnpm install
}

# 5. Build Tauri App
Write-Host "[INFO] Compiling frontend..." -ForegroundColor Blue
pnpm build

Write-Host "[INFO] Building Tauri Windows Application..." -ForegroundColor Blue
$TauriArgs = @("build")
if ($Bundle -ne "all") {
  $TauriArgs += @("--bundles", $Bundle)
}
if ($Debug) {
  $TauriArgs += "--debug"
}

# Check signing key
$KeyFile = Join-Path $HOME ".tauri\remora.key"
if (-not $env:TAURI_SIGNING_PRIVATE_KEY -and -not (Test-Path $KeyFile)) {
  $TauriArgs += "--no-sign"
}

pnpm tauri @TauriArgs

# 6. Collect Artifacts
if (-not (Test-Path $ReleaseDir)) {
  New-Item -ItemType Directory -Force -Path $ReleaseDir | Out-Null
}

$TargetBinary = Join-Path $ScriptDir "src-tauri\target\release\remora.exe"
if (Test-Path $TargetBinary) {
  Copy-Item -Force $TargetBinary (Join-Path $ReleaseDir "remora.exe")
  Copy-Item -Force $TargetBinary (Join-Path $ReleaseDir "remora-windows_x64-v$AppVersion.exe")
  Write-Host "[SUCCESS] Archived binary: remora.exe" -ForegroundColor Green
}

# Collect NSIS and MSI bundles
$BundleDir = Join-Path $ScriptDir "src-tauri\target\release\bundle"
if (Test-Path $BundleDir) {
  Get-ChildItem -Path $BundleDir -Recurse -Include "*.exe", "*.msi", "*.sig" | ForEach-Object {
    Copy-Item -Force $_.FullName $ReleaseDir
    Write-Host "[SUCCESS] Archived bundle: $($_.Name)" -ForegroundColor Green
  }
}

# Compute SHA256 checksums
Write-Host "[INFO] Generating SHA256SUMS.txt..." -ForegroundColor Blue
$checksumFile = Join-Path $ReleaseDir "SHA256SUMS.txt"
if (Test-Path $checksumFile) { Remove-Item $checksumFile }

Get-ChildItem -Path $ReleaseDir -File | Where-Object { $_.Name -ne "SHA256SUMS.txt" } | ForEach-Object {
  $hash = (Get-FileHash -Algorithm SHA256 $_.FullName).Hash.ToLower()
  "$hash  $($_.Name)" | Out-File -FilePath $checksumFile -Append -Encoding ascii
}

Write-Host ""
Write-Host "======================================================" -ForegroundColor Green
Write-Host "         Windows Build Succeeded!                     " -ForegroundColor Green
Write-Host "======================================================" -ForegroundColor Green
Write-Host "Output Directory: $ReleaseDir" -ForegroundColor Green
Get-ChildItem $ReleaseDir | Format-Table Name, Length, LastWriteTime
