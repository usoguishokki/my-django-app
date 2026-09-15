[CmdletBinding()]
param(
    [ValidateSet("DjangoApp")]
    [string]$AppPoolName = "DjangoApp",

    [ValidateSet("DjangoApp")]
    [string]$SiteName = "DjangoApp",

    [string]$ExpectedPhysicalPath = "C:\inetpub\wwwroot\sitefolder\myproject",

    [ValidateSet("release/static-cache-strategy-v1-20260915")]
    [string]$ExpectedBranch = "release/static-cache-strategy-v1-20260915",

    [string]$Python
)

$ErrorActionPreference = "Stop"
$projectRoot = [System.IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot)).TrimEnd('\')
$expectedRoot = [System.IO.Path]::GetFullPath($ExpectedPhysicalPath).TrimEnd('\')
Set-Location -LiteralPath $projectRoot

function Invoke-Checked {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Command,
        [Parameter(ValueFromRemainingArguments = $true)]
        [string[]]$Arguments
    )

    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$Command failed with exit code $LASTEXITCODE"
    }
}

if ($projectRoot -ne $expectedRoot) {
    throw "Release checkout mismatch. Expected=$expectedRoot Actual=$projectRoot"
}

function Resolve-DjangoPython {
    param(
        [string]$PythonOverride,
        [string]$ProductionRoot
    )

    if ([string]::IsNullOrWhiteSpace($PythonOverride)) {
        # The production virtualenv is intentionally a sibling of the checkout.
        # Do not fall back to PATH: a system Python may not have Django installed.
        $candidate = Join-Path (Split-Path -Parent $ProductionRoot) "django_iis_env\Scripts\python.exe"
    }
    else {
        $candidate = $PythonOverride
    }

    if (-not (Test-Path -LiteralPath $candidate -PathType Leaf)) {
        throw "Django Python executable does not exist: $candidate"
    }

    return (Resolve-Path -LiteralPath $candidate -ErrorAction Stop).Path
}

function New-UniqueReleasePath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Root,
        [Parameter(Mandatory = $true)]
        [string]$BaseName
    )

    $candidate = Join-Path $Root $BaseName
    $suffix = 1
    while (Test-Path -LiteralPath $candidate) {
        $candidate = Join-Path $Root "$BaseName-$suffix"
        [void]$suffix++
    }
    return $candidate
}

if ((git status --porcelain --untracked-files=all)) {
    throw "Release requires a clean Git worktree. Review and commit first."
}

$releaseSha = (git rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0) {
    throw "Unable to record the release Git SHA."
}
$releaseBranch = (git branch --show-current).Trim()
if ($LASTEXITCODE -ne 0 -or $releaseBranch -ne $ExpectedBranch) {
    throw "Release branch mismatch. Expected=$ExpectedBranch Actual=$releaseBranch"
}

$Python = Resolve-DjangoPython -PythonOverride $Python -ProductionRoot $expectedRoot
Write-Host "Using Django Python: $Python"
# This must run before importing or changing IIS state. It prevents an
# accidentally selected interpreter from taking the application offline.
Invoke-Checked $Python "-c" "import django"
Invoke-Checked $Python "manage.py" "check" "--deploy"
Invoke-Checked $Python "manage.py" "shell" "-c" `
    "from django.conf import settings; assert not settings.DEBUG, 'DJANGO_DEBUG must be false'; assert not settings.SASS_PROCESSOR_ENABLED, 'runtime Sass must be disabled'; assert settings.STATICFILES_STORAGE == 'myproject.staticfiles.StaticFilesStorage', 'fingerprinted storage is not active'"

Import-Module WebAdministration
$site = Get-Website -Name $SiteName
if (-not $site) {
    throw "IIS site does not exist: $SiteName"
}
$sitePath = [System.IO.Path]::GetFullPath([Environment]::ExpandEnvironmentVariables($site.PhysicalPath)).TrimEnd('\')
if ($sitePath -ne $expectedRoot) {
    throw "IIS site path mismatch. Expected=$expectedRoot Actual=$sitePath"
}
if ($site.ApplicationPool -ne $AppPoolName) {
    throw "IIS site/app-pool mismatch. Site=$SiteName ExpectedPool=$AppPoolName ActualPool=$($site.ApplicationPool)"
}
$appPool = Get-WebAppPoolState -Name $AppPoolName -ErrorAction Stop
if (-not $appPool) {
    throw "IIS application pool does not exist: $AppPoolName"
}
$initialAppPoolState = $appPool.Value
if ($initialAppPoolState -notin @("Started", "Stopped")) {
    throw "IIS application pool is in an unsafe state: $initialAppPoolState"
}

$staticRoot = Join-Path $projectRoot "staticfiles"
$backupRoot = Join-Path (Split-Path -Parent $projectRoot) "myproject-release-backups"
$releaseStamp = Get-Date -Format "yyyyMMdd-HHmmss"
New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null
$backupPath = New-UniqueReleasePath -Root $backupRoot -BaseName "staticfiles-$releaseStamp-$releaseSha"
$releaseRecordPath = New-UniqueReleasePath -Root $backupRoot -BaseName "static-cache-release-$releaseStamp-$releaseSha.json"
if (Test-Path -LiteralPath $staticRoot) {
    Copy-Item -LiteralPath $staticRoot -Destination $backupPath -Recurse
}
$previousSha = (git rev-parse HEAD^).Trim()
if ($LASTEXITCODE -ne 0) {
    throw "Unable to record the previous release Git SHA."
}
$rollbackRecord = [ordered]@{
    release_sha = $releaseSha
    previous_sha = $previousSha
    static_backup = if (Test-Path -LiteralPath $backupPath) { $backupPath } else { $null }
    created_at = (Get-Date).ToString("o")
    site = $SiteName
    app_pool = $AppPoolName
}
$rollbackRecordJson = $rollbackRecord | ConvertTo-Json
$rollbackRecordJson | Set-Content -LiteralPath $releaseRecordPath -Encoding UTF8
$latestRollbackRecord = Join-Path $backupRoot "latest-static-cache-release.json"
$latestRollbackTemporary = Join-Path $backupRoot "latest-static-cache-release-$PID.tmp"
$rollbackRecordJson | Set-Content -LiteralPath $latestRollbackTemporary -Encoding UTF8
Move-Item -LiteralPath $latestRollbackTemporary -Destination $latestRollbackRecord -Force

if ($initialAppPoolState -eq "Started") {
    Stop-WebAppPool -Name $AppPoolName
}
else {
    Write-Host "IIS application pool is already stopped; continuing with release."
}

try {
    Invoke-Checked $Python "manage.py" "collectstatic" "--clear" "--noinput" `
        "--ignore" "tests" "--ignore" "test.js" `
        "--ignore" "*.scss" "--ignore" "*.map"
    Invoke-Checked $Python "scripts/verify_static_manifest.py" "staticfiles"
    Invoke-Checked $Python "scripts/build_iis_static_config.py" `
        "staticfiles" "deploy/iis-static.web.config"
}
catch {
    Write-Error "Release failed; the IIS application pool remains stopped. $($_.Exception.Message)"
    throw
}

Start-WebAppPool -Name $AppPoolName

$state = (Get-WebAppPoolState -Name $AppPoolName).Value
if ($state -ne "Started") {
    throw "IIS application pool did not start: $state"
}

Write-Host "Release complete. SHA=$releaseSha Site=$SiteName AppPool=$AppPoolName State=$state RollbackRecord=$(Join-Path $backupRoot 'latest-static-cache-release.json')"
