[CmdletBinding()]
param(
    [switch]$Force
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

function Assert-Hash {
    param(
        [Parameter(Mandatory)] [string]$Path,
        [Parameter(Mandatory)] [string]$Algorithm,
        [Parameter(Mandatory)] [string]$Expected
    )
    $hasher = [Security.Cryptography.HashAlgorithm]::Create($Algorithm)
    if ($null -eq $hasher) {
        throw "Algoritmo de hash não suportado: $Algorithm."
    }
    $stream = [IO.File]::OpenRead($Path)
    try {
        $actual = [BitConverter]::ToString($hasher.ComputeHash($stream)).Replace('-', '').ToLowerInvariant()
    }
    finally {
        $stream.Dispose()
        $hasher.Dispose()
    }
    if ($actual -ne $Expected.ToLowerInvariant()) {
        throw "Hash inválido para $Path. Esperado $Expected; encontrado $actual."
    }
}

function Assert-SafeArchive {
    param([Parameter(Mandatory)] [string]$Path)
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $archive = [IO.Compression.ZipFile]::OpenRead($Path)
    try {
        foreach ($entry in $archive.Entries) {
            if ($entry.FullName -match '(^[\\/]|\.\.[\\/])') {
                throw "Entrada insegura no arquivo: $($entry.FullName)"
            }
        }
    }
    finally {
        $archive.Dispose()
    }
}

$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$runtimeRoot = Join-Path $projectRoot 'runtime\whisper'
$binRoot = Join-Path $runtimeRoot 'bin'
$modelRoot = Join-Path $runtimeRoot 'models'
$modelPath = Join-Path $modelRoot 'ggml-parakeet-tdt-0.6b-v3-q8_0.bin'
$temporaryRoot = Join-Path ([IO.Path]::GetTempPath()) 'titi-whisper-setup'
$archivePath = Join-Path $temporaryRoot 'whisper-bin-x64.zip'

$archiveUrl = 'https://github.com/ggml-org/whisper.cpp/releases/download/v1.9.2/whisper-bin-x64.zip'
$archiveSha256 = '49dcc16de826f20bd53d44f947a1ae49dfa81f86cad67a64d80820cb192d674a'
$modelUrl = 'https://huggingface.co/ggml-org/parakeet-GGUF/resolve/main/ggml-parakeet-tdt-0.6b-v3-q8_0.bin'
$modelSha256 = '4d64e9e96c2792186d072fde0034df0ad670cf680a2f53069052ead827fd600e'
$requiredRuntimeFiles = [ordered]@{
    'Release\parakeet-cli.exe' = 'ab2eaca3f855c33386eb1bff404808de8bce19c003baafd8b69611b6c369a339'
    'Release\parakeet.dll' = '567c56a3c9b7383982e5777964f37f9f3cb930ef4a7ca907477e4e955f1cd0a4'
    'Release\ggml.dll' = '894c6237ee7849843213906a2b6a0b371aaa6234048d465f206d910ae846fafb'
    'Release\ggml-base.dll' = '1482359d921b4c1b183d49db1d770f9b5e90d86a618b8b648d4845c2471ad6b0'
    'Release\ggml-cpu-alderlake.dll' = 'd1c5411561361f7ce71ff8455ecf01f666f581b0608fa91a1dfe7d3fd6a25bd1'
    'Release\ggml-cpu-cannonlake.dll' = '2ef36f05fa252ff4fdcb8d42ebce1ceba4f3d3de12b93bed15bdee6237dccd63'
    'Release\ggml-cpu-cascadelake.dll' = '505899aaf3f99c5d714361640f561458ea97f8a09eb0614568a66bead2115cb0'
    'Release\ggml-cpu-haswell.dll' = 'f8cf2f35a06498d783d77fde42004dd54d2f8236b0d42ac323b94bba65a603c4'
    'Release\ggml-cpu-icelake.dll' = '78ad143ee2e674d037b4840ef33b5748a0659762a26e0ae2b621c4f9451cbde8'
    'Release\ggml-cpu-sandybridge.dll' = 'ee47db7dc40fb30eca73e62a05306059c2c3c42aecddf2e8d6ad7e530069b815'
    'Release\ggml-cpu-skylakex.dll' = '164e2793897944a43ee071ce6c0b09018088bdf4dd8b14ac0755c58849cf8c50'
    'Release\ggml-cpu-sse42.dll' = '7318a9a3b95a85b2453c437b274412bbbae89e5ecdf5babb19b99edc06ded063'
    'Release\ggml-cpu-x64.dll' = 'af0f1c2f28ff9e3f472481dd969907bda85fa39d4fde17617d4bb0b389301b60'
}

function Test-ExpectedHash {
    param(
        [Parameter(Mandatory)] [string]$Path,
        [Parameter(Mandatory)] [string]$Expected
    )
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $false }
    try {
        Assert-Hash -Path $Path -Algorithm SHA256 -Expected $Expected
        return $true
    }
    catch {
        return $false
    }
}

function Test-VerifiedRuntime {
    foreach ($entry in $requiredRuntimeFiles.GetEnumerator()) {
        if (-not (Test-ExpectedHash -Path (Join-Path $binRoot $entry.Key) -Expected $entry.Value)) {
            return $false
        }
    }
    return $true
}

New-Item -ItemType Directory -Force -Path $temporaryRoot, $modelRoot | Out-Null

if ($Force -or -not (Test-VerifiedRuntime)) {
    Write-Host 'Baixando whisper.cpp v1.9.2...'
    Invoke-WebRequest -UseBasicParsing -Uri $archiveUrl -OutFile $archivePath
    Assert-Hash -Path $archivePath -Algorithm SHA256 -Expected $archiveSha256
    Assert-SafeArchive -Path $archivePath

    if (Test-Path -LiteralPath $binRoot) {
        $resolvedBin = (Resolve-Path -LiteralPath $binRoot).Path
        if (-not $resolvedBin.StartsWith($projectRoot + [IO.Path]::DirectorySeparatorChar)) {
            throw 'O diretório de destino está fora do projeto.'
        }
        Remove-Item -LiteralPath $resolvedBin -Recurse -Force
    }
    New-Item -ItemType Directory -Force -Path $binRoot | Out-Null
    Expand-Archive -LiteralPath $archivePath -DestinationPath $binRoot -Force
}
foreach ($entry in $requiredRuntimeFiles.GetEnumerator()) {
    Assert-Hash -Path (Join-Path $binRoot $entry.Key) -Algorithm SHA256 -Expected $entry.Value
}

if ($Force -or -not (Test-ExpectedHash -Path $modelPath -Expected $modelSha256)) {
    Write-Host 'Baixando Parakeet TDT 0.6B v3 Q8 multilíngue...'
    Invoke-WebRequest -UseBasicParsing -Uri $modelUrl -OutFile $modelPath
}
Assert-Hash -Path $modelPath -Algorithm SHA256 -Expected $modelSha256

Write-Host 'Runtime local de voz pronto.' -ForegroundColor Green
