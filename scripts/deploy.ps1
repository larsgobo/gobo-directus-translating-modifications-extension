# One-command deploy: build, zip, upload to VPS, copy into Directus Docker volume.
# Ported from custom-directus-gobo/products-translations-matrix/deploy.ps1
# Copy deploy.config.example.ps1 to deploy.config.ps1 in this scripts folder.

param(
    [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
$scriptDir = $PSScriptRoot
$repoRoot = Split-Path $scriptDir -Parent
Set-Location $repoRoot

$configPath = Join-Path $scriptDir "deploy.config.ps1"
if (-not (Test-Path $configPath)) {
    Write-Host "Missing scripts/deploy.config.ps1. Copy deploy.config.example.ps1 and set VPS host/user/volume." -ForegroundColor Red
    exit 1
}
. $configPath

$extensionFolder = "gobo-translation-modifications"
$useDockerVolume = $DeployDirectusVolumeName -and ($DeployDirectusVolumeName -match "\S")

foreach ($var in @("DeploySshHost", "DeploySshUser")) {
    $val = Get-Variable -Name $var -ValueOnly -ErrorAction SilentlyContinue
    if (-not $val -or $val -match "your-") {
        Write-Host "Please set $var in scripts/deploy.config.ps1." -ForegroundColor Red
        exit 1
    }
}

if (-not $useDockerVolume) {
    Write-Host "Set DeployDirectusVolumeName in scripts/deploy.config.ps1 (e.g. gobo-dk-gtm_directus_extensions)." -ForegroundColor Red
    exit 1
}

$extTmpPath = $DeployExtTmpPath
if (-not $extTmpPath) { $extTmpPath = "/root/ext-tmp" }

$zipName = "$extensionFolder.zip"
$remoteZip = "/tmp/$zipName"
$remoteTmp = "/tmp/gobo-ext-deploy-tmp"
$sshTarget = "$DeploySshUser@$DeploySshHost"
$scpTarget = "${DeploySshUser}@${DeploySshHost}:"

$usePutty = $false
if (Get-Command scp -ErrorAction SilentlyContinue) {
    $scpExe = "scp"
    $sshExe = "ssh"
} else {
    $puttyPaths = @(
        "C:\Program Files\PuTTY\pscp.exe",
        "C:\Program Files (x86)\PuTTY\pscp.exe",
        (Get-Command pscp -ErrorAction SilentlyContinue).Source
    )
    $pscp = $puttyPaths | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
    if (-not $pscp) {
        Write-Host "No SCP found. Install OpenSSH Client or PuTTY." -ForegroundColor Red
        exit 1
    }
    $usePutty = $true
    $scpExe = $pscp
    $sshExe = $pscp -replace "pscp\.exe$", "plink.exe"
}

$sshPort = 22
if ($null -ne $DeploySshPort -and [string]::IsNullOrEmpty($DeploySshPort) -eq $false) { $sshPort = [int]$DeploySshPort }
$sshArgs = @()
if ($sshPort -ne 22) {
    if ($usePutty) { $sshArgs += "-P", $sshPort } else { $sshArgs += "-o", "Port=$sshPort" }
}
if ($DeploySshKeyPath -and (Test-Path $DeploySshKeyPath)) {
    $sshArgs += "-i", $DeploySshKeyPath
}
$sshPassword = $DeploySshPassword
if (-not $sshPassword -and $env:DEPLOY_SSH_PASSWORD) { $sshPassword = $env:DEPLOY_SSH_PASSWORD }
if ($usePutty) {
    $sshArgs += "-batch"
    if ($sshPassword) { $sshArgs += "-pw", $sshPassword }
}
$scpPortArgs = @()
if (-not $usePutty -and $sshPort -ne 22) { $scpPortArgs = @("-P", $sshPort) }

if (-not $SkipBuild) {
    Write-Host "Building extension..." -ForegroundColor Cyan
    npm run build
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

Write-Host "Creating zip..." -ForegroundColor Cyan
$zipPath = Join-Path $repoRoot $zipName
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
$distPath = Join-Path $repoRoot "dist"
$pkgPath = Join-Path $repoRoot "package.json"
if (-not (Test-Path $distPath)) {
    Write-Host "No dist folder. Run without -SkipBuild first." -ForegroundColor Red
    exit 1
}

Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [System.IO.Compression.ZipFile]::Open($zipPath, 'Create')
try {
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $pkgPath, "package.json") | Out-Null
    Get-ChildItem $distPath -Recurse -File | ForEach-Object {
        $entryName = $_.FullName.Substring($distPath.Length + 1).Replace("\", "/")
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $_.FullName, "dist/$entryName") | Out-Null
    }
} finally {
    $archive.Dispose()
}

Write-Host "Uploading to $DeploySshHost..." -ForegroundColor Cyan
if ($usePutty) {
    & $scpExe @sshArgs "$zipPath" "${scpTarget}${remoteZip}"
} else {
    & $scpExe @scpPortArgs @sshArgs "$zipPath" "${scpTarget}${remoteZip}"
}
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$hostExtDir = "$extTmpPath/$extensionFolder"
$vol1 = "-v " + $DeployDirectusVolumeName + ":/directus/extensions"
$vol2 = "-v " + $extTmpPath + ":/tmp/ext"
$remoteScript = @"
set -e
rm -rf $remoteTmp
mkdir -p $remoteTmp
unzip -o -q $remoteZip -d $remoteTmp
rm -rf $hostExtDir
mkdir -p $hostExtDir
cp -R $remoteTmp/dist $hostExtDir/
cp $remoteTmp/package.json $hostExtDir/
rm -rf $remoteTmp $remoteZip
docker run --rm $vol1 $vol2 --user root alpine sh -c '
    set -e
    rm -rf /directus/extensions/$extensionFolder
    cp -R /tmp/ext/$extensionFolder /directus/extensions/
    chown -R 1000:1000 /directus/extensions/$extensionFolder
    echo "Extension installed at /directus/extensions/$extensionFolder/"
    ls -la /directus/extensions/$extensionFolder/dist/
  '
docker service update --force gobo-dk-gtm_directus
echo Done.
"@

$remoteScript | & $sshExe @sshArgs $sshTarget "bash -s"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Remove-Item $zipPath -Force -ErrorAction SilentlyContinue
Write-Host "Deploy finished. Extension is in volume $DeployDirectusVolumeName. Directus service restarted." -ForegroundColor Green
