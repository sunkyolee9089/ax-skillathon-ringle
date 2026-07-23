$taskSecretFile = Join-Path (Split-Path $PSScriptRoot -Parent) '.mailchimp-api-key'
$taskKey = Read-Host 'Paste your Mailchimp API key here (it will not be displayed)' -AsSecureString

if ($taskKey.Length -eq 0) {
    Write-Host 'No key was saved.'
    exit 1
}

$taskCredential = New-Object System.Management.Automation.PSCredential 'mailchimp', $taskKey
$taskPlaintext = [System.Net.NetworkCredential]::new('', $taskCredential.Password).Password
Set-Content -LiteralPath $taskSecretFile -Value $taskPlaintext -Encoding ASCII -NoNewline
Write-Host 'Mailchimp key saved in the local skill folder.'
Start-Sleep -Seconds 2
