[CmdletBinding()]
param(
    [string]$RunId,
    [string]$Repo = 'lockdown-systems/cyd',
    [string]$WorkflowName = 'Release for Windows',
    [switch]$SkipUploadVerification
)

$commonScript = Join-Path $PSScriptRoot 'release-windows-common.ps1'

$commonArgs = @{
    ReleaseEnv = 'prod'
    Repo = $Repo
    WorkflowName = $WorkflowName
}

if (-not [string]::IsNullOrWhiteSpace($RunId)) {
    $commonArgs.RunId = $RunId
}

if ($SkipUploadVerification) {
    $commonArgs.SkipUploadVerification = $true
}

& $commonScript @commonArgs
