[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('dev', 'prod')]
    [string]$ReleaseEnv,

    [string]$Repo = 'lockdown-systems/cyd',

    [string]$WorkflowName = 'Release for Windows',

    [string]$RunId,

    [switch]$SkipUploadVerification
)

$ErrorActionPreference = 'Stop'

function Write-Step {
    param([string]$Message)
    Write-Host "[] $Message"
}

function Test-TagMatchesEnv {
    param(
        [string]$Tag,
        [string]$Env
    )

    if ([string]::IsNullOrWhiteSpace($Tag)) {
        return $false
    }

    if (-not $Tag.StartsWith('v')) {
        return $false
    }

    if ($Env -eq 'dev') {
        return $Tag.EndsWith('-dev')
    }

    return -not $Tag.EndsWith('-dev')
}

function Assert-Command {
    param([string]$Name)

    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Required command '$Name' is not installed or not in PATH"
    }
}

function Get-LatestRunId {
    param(
        [string]$RepoName,
        [string]$Workflow,
        [string]$Env
    )

    Write-Step "Finding latest successful '$Workflow' run for $Env"

    $runsJson = gh run list `
        --repo $RepoName `
        --workflow $Workflow `
        --status completed `
        --limit 100 `
        --json databaseId,headBranch,event,conclusion,createdAt,url

    $runs = $runsJson | ConvertFrom-Json

    $matching = $runs | Where-Object {
        $_.conclusion -eq 'success' -and
        $_.event -eq 'push' -and
        (Test-TagMatchesEnv -Tag $_.headBranch -Env $Env)
    }

    if (-not $matching -or $matching.Count -eq 0) {
        throw "Could not find a successful tag-push run for '$Workflow' in environment '$Env'"
    }

    $selected = $matching | Sort-Object createdAt -Descending | Select-Object -First 1
    Write-Step "Using run $($selected.databaseId) ($($selected.headBranch))"
    Write-Step "Run URL: $($selected.url)"
    return [string]$selected.databaseId
}

function Get-ManifestPath {
    param(
        [string]$DownloadRoot,
        [string]$Env
    )

    $manifestDir = Join-Path $DownloadRoot "windows-release-manifest-$Env"
    $manifestPath = Join-Path $manifestDir 'windows-release-manifest.json'

    if (-not (Test-Path $manifestPath)) {
        throw "Manifest file not found at: $manifestPath"
    }

    return $manifestPath
}

function Assert-ExpectedArtifacts {
    param(
        [string]$DownloadRoot,
        [string]$Env
    )

    $required = @(
        "windows-unsigned-$Env-x64",
        "windows-unsigned-$Env-arm64",
        "windows-release-manifest-$Env"
    )

    foreach ($name in $required) {
        $path = Join-Path $DownloadRoot $name
        if (-not (Test-Path $path)) {
            throw "Expected artifact folder missing: $path"
        }
    }
}

function Assert-ManifestChecksums {
    param(
        [string]$DownloadRoot,
        [string]$ManifestPath,
        [string]$Env
    )

    $manifest = Get-Content $ManifestPath -Raw | ConvertFrom-Json

    if ($manifest.env -ne $Env) {
        throw "Manifest env '$($manifest.env)' does not match expected env '$Env'"
    }

    foreach ($artifact in $manifest.artifacts) {
        $artifactPath = Join-Path $DownloadRoot $artifact.name
        if (-not (Test-Path $artifactPath)) {
            throw "Manifest artifact folder missing: $artifactPath"
        }

        foreach ($item in $artifact.checksums) {
            $normalized = ($item.path -replace '/', '\\')
            $targetPath = Join-Path $artifactPath $normalized
            if (-not (Test-Path $targetPath)) {
                throw "Expected file from manifest not found: $targetPath"
            }

            $actualHash = (Get-FileHash -Path $targetPath -Algorithm SHA256).Hash.ToLower()
            if ($actualHash -ne $item.sha256) {
                throw "Checksum mismatch for $targetPath. Expected $($item.sha256), got $actualHash"
            }
        }
    }
}

function Invoke-FinalizeBothArchitectures {
    param(
        [string]$Env,
        [string]$RepoRoot
    )

    $arches = @('x64', 'arm64')

    Write-Step 'Preparing workspace for local finalization'
    Push-Location $RepoRoot
    try {
        node ./scripts/clean.mjs

        foreach ($arch in $arches) {
            Write-Step "Finalizing signed release for $arch"
            npm run finalize-windows-release -- $Env $arch --skip-clean
        }
    }
    finally {
        Pop-Location
    }
}

function Assert-UploadReachable {
    param([string]$Env)

    $arches = @('x64', 'arm64')

    foreach ($arch in $arches) {
        $url = "https://releases.lockdown.systems/cyd/$Env/windows/$arch/RELEASES"
        Write-Step "Verifying uploaded RELEASES: $url"

        try {
            $response = Invoke-WebRequest -Uri $url -Method Get -TimeoutSec 30
        }
        catch {
            throw "Upload verification failed for $url: $($_.Exception.Message)"
        }

        if ($response.StatusCode -lt 200 -or $response.StatusCode -ge 300) {
            throw "Upload verification returned status code $($response.StatusCode) for $url"
        }
    }
}

Assert-Command -Name 'gh'
Assert-Command -Name 'node'
Assert-Command -Name 'npm'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')

if ([string]::IsNullOrWhiteSpace($RunId)) {
    $RunId = Get-LatestRunId -RepoName $Repo -Workflow $WorkflowName -Env $ReleaseEnv
}
else {
    Write-Step "Using provided run id: $RunId"
}

$downloadRoot = Join-Path $repoRoot "build/windows-release/$ReleaseEnv/$RunId"

if (Test-Path $downloadRoot) {
    Write-Step "Cleaning previous download folder: $downloadRoot"
    Remove-Item -Path $downloadRoot -Recurse -Force
}

New-Item -ItemType Directory -Path $downloadRoot -Force | Out-Null

Write-Step "Downloading artifacts for run $RunId"
gh run download $RunId -R $Repo -D $downloadRoot

Assert-ExpectedArtifacts -DownloadRoot $downloadRoot -Env $ReleaseEnv
$manifestPath = Get-ManifestPath -DownloadRoot $downloadRoot -Env $ReleaseEnv

Write-Step "Verifying artifact checksums from manifest"
Assert-ManifestChecksums -DownloadRoot $downloadRoot -ManifestPath $manifestPath -Env $ReleaseEnv

Write-Step 'Checksums verified successfully'
Write-Step 'Running local finalization for x64 + arm64'
Invoke-FinalizeBothArchitectures -Env $ReleaseEnv -RepoRoot $repoRoot

if (-not $SkipUploadVerification) {
    Assert-UploadReachable -Env $ReleaseEnv
    Write-Step 'Upload verification completed'
}

Write-Step 'Windows release flow completed successfully'
