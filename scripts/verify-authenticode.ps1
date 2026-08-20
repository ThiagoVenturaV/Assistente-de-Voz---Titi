param(
  [Parameter(Mandatory = $true)]
  [string]$AppPath,

  [Parameter(Mandatory = $true)]
  [string]$InstallerPath,

  [switch]$AllowUnsignedPrerelease,

  [string]$ExpectedSubject = ''
)

$ErrorActionPreference = 'Stop'
Import-Module Microsoft.PowerShell.Security -ErrorAction Stop
$results = @()

foreach ($item in @(
  @{ Label = 'aplicativo'; Path = $AppPath },
  @{ Label = 'instalador'; Path = $InstallerPath }
)) {
  if (-not (Test-Path -LiteralPath $item.Path -PathType Leaf)) {
    throw "Arquivo ausente para validar assinatura: $($item.Path)"
  }

  $signature = Get-AuthenticodeSignature -LiteralPath $item.Path
  if ($AllowUnsignedPrerelease -and $signature.Status -eq [System.Management.Automation.SignatureStatus]::NotSigned) {
    $results += [pscustomobject]@{
      label = $item.Label
      status = 'NotSigned'
      thumbprint = $null
      subject = $null
    }
    continue
  }

  if ($signature.Status -ne [System.Management.Automation.SignatureStatus]::Valid) {
    throw "Assinatura Authenticode inválida no $($item.Label): $($signature.Status) - $($signature.StatusMessage)"
  }
  if (-not $signature.SignerCertificate -or [string]::IsNullOrWhiteSpace($signature.SignerCertificate.Thumbprint)) {
    throw "O $($item.Label) não informa um certificado de assinatura válido."
  }

  $results += [pscustomobject]@{
    label = $item.Label
    status = 'Valid'
    thumbprint = $signature.SignerCertificate.Thumbprint
    subject = $signature.SignerCertificate.Subject
  }
}

if ($results[0].status -ne $results[1].status) {
  throw 'O aplicativo e o instalador possuem estados de assinatura diferentes.'
}

if ($results[0].status -eq 'NotSigned') {
  [pscustomobject]@{
    status = 'NotSigned'
    thumbprint = $null
    subject = $null
  } | ConvertTo-Json -Compress
  exit 0
}

if ($results[0].thumbprint -ne $results[1].thumbprint) {
  throw 'O aplicativo e o instalador foram assinados por certificados diferentes.'
}

if (-not [string]::IsNullOrWhiteSpace($ExpectedSubject) -and $results[0].subject -notlike "*$ExpectedSubject*") {
  throw "O editor da assinatura não corresponde ao esperado: $($results[0].subject)"
}

[pscustomobject]@{
  status = 'Valid'
  thumbprint = $results[0].thumbprint
  subject = $results[0].subject
} | ConvertTo-Json -Compress
