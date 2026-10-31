[CmdletBinding()]
param(
    [switch]$Force,
    [switch]$IncludeModels
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
$runtimeRoot = Join-Path $projectRoot 'runtime\lfm3'
$binRoot = Join-Path $runtimeRoot 'bin'
$modelRoot = Join-Path $runtimeRoot 'models'
$temporaryRoot = Join-Path ([IO.Path]::GetTempPath()) 'titi-lfm3-setup'
$archivePath = Join-Path $temporaryRoot 'llama-b11998-bin-win-cpu-x64.zip'

$archiveUrl = 'https://github.com/ggml-org/llama.cpp/releases/download/b11998/llama-b11998-bin-win-cpu-x64.zip'
$archiveSha256 = '2cdb7ff52769dff9bf19c4cf7d6b6e136e7b46249679d5d92ecd92631b8f7fb2'

$requiredBinFiles = [ordered]@{
    'llama-server.exe' = '3a192bd0dfb3aa56bc544b62cb0648d1ad8a9d9147df0e87132404645dce9fce'
    'llama-server-impl.dll' = 'fa68e1cc20394b5fc31ee4c4e0fc19c7ac05fe4171d6e61628f8497d136b8f78'
    'llama-tts.exe' = '1fe2984af88e8e3018915a67fef39261481146bbea55f7c92716f654b8fb269f'
    'llama-mtmd-cli.exe' = '50807cbc6deb8cef5af57eb9b39d732c4c31fd14d39162aac365a997ff6be974'
    'llama-common.dll' = '6411d745267e5ea6fecc6f5e6e851934db8750a02003a5655e15226f74499a29'
    'llama.dll' = '28e64cf797e72589d5a5fcc0790acc07f268947618d95017ebf9474cf3f41526'
    'mtmd.dll' = '11e76d48e12bfc1020ae26c10c39aa5f960749257984273f65b0edd49cf4b36d'
    'ggml.dll' = 'f9e465a3b7a9ed4627a79b3c664a7a3ba3313c3fdb53cad729b6df0c03098eeb'
    'ggml-base.dll' = '462f93a62fae627be8781072eec7b3f140ab791aa5adfc6cc98eebfe987a546f'
    'ggml-cpu-alderlake.dll' = '3f6b49b3da0d371670e6329b6f6f9757533a5daaaeefcf8548ee8049bbc71f4f'
    'ggml-cpu-cannonlake.dll' = '30a150cefb1fc018b5d836ef5a0c2b0f38abf678d5129e5c4ca0e7352d0dabb8'
    'ggml-cpu-cascadelake.dll' = '3c279f800cf037f5c0216224daaf67d7a33a1ecda61ebe7682520c46b0759102'
    'ggml-cpu-cooperlake.dll' = 'efe10098c99d50abf8094c5e27bc045aebf69b2e946ff38a27d2ae32002dbc89'
    'ggml-cpu-haswell.dll' = '963a3fa10586e259741b8fa8d798048d20ff1fef1745256bc44b4e0f13391af8'
    'ggml-cpu-icelake.dll' = '14bd0d95bf235f8e0321163d85ca63728701cfd711a7f95c6aa7dd2890d6733e'
    'ggml-cpu-ivybridge.dll' = '4b1370e26cca0827f4efddaf01fc0ab4886de931fc0c0dece1b3661d6232feb0'
    'ggml-cpu-piledriver.dll' = '3f4651e04b05f0f5f85a3ea6a3c0ab945726d7eaa12a6980a855ca155b090d31'
    'ggml-cpu-sandybridge.dll' = 'bbcdfb2797fdb2d8afc3fe61d162a4ce2299486a8ca9cad9e958e4b2694ba015'
    'ggml-cpu-sapphirerapids.dll' = '30dcb239beea807f54541d96eca88898dc34bba8f30739029b1c74ce340faa56'
    'ggml-cpu-skylakex.dll' = '52b0f8c4f6869faf8a4567b9aa02730f78aff518e390acff9c589d443edbe140'
    'ggml-cpu-sse42.dll' = 'f141df2dc4df8548513f2cead485343133f5d6d9b7de3b6ff4f4e400c35b30c9'
    'ggml-cpu-x64.dll' = 'a199c31fdeb9e42c55900213ec5b809fc48e842e667c729fac4e289a66301f93'
    'ggml-cpu-zen4.dll' = '4d8e9d81b57d039edf229ece6e5abaa80905a16687ed76de57cad1e182bc23c4'
    'libomp.dll' = 'a12116ba72d1d6820407cf30be23da04ce79d6bb8a71a5ee71759c5a1faa6f1c'
    'LICENSE' = '94f29bbed6a22c35b992c5c6ebf0e7c92f13b836b90f36f461c9cf2f0f1d010d'
    'LICENSE-LLVM-OpenMP' = 'fdad1758a9e1f9d5a81e18879b3406772115edc92c24bfa36b70c654f325e8e4'
}

$requiredModelFiles = [ordered]@{
    'LFM3-Audio-2B-Q4_K_M.gguf' = @{
        Url = 'https://huggingface.co/LiquidAI/LFM3-Audio-2B-GGUF/resolve/main/LFM3-Audio-2B-Q4_K_M.gguf'
        Sha256 = '9a773289bd321ed879cd3a76545f6aca506e403851a45fb315420aee45625be2'
    }
    'mmproj-LFM3-Audio-2B-Q8_0.gguf' = @{
        Url = 'https://huggingface.co/LiquidAI/LFM3-Audio-2B-GGUF/resolve/main/mmproj-LFM3-Audio-2B-Q8_0.gguf'
        Sha256 = '2b6648b1fd48af16aa0877b0592b144d15070783673e038a379fdbc51d40e365'
    }
    'LICENSE' = @{
        Url = 'https://huggingface.co/LiquidAI/LFM3-Audio-2B-GGUF/resolve/main/LICENSE'
        Sha256 = '4d28ca14dedc0b3d0fcc2b3339f0e79931faa33874f3d24f522183a8fc70068c'
    }
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

function Test-VerifiedBin {
    foreach ($entry in $requiredBinFiles.GetEnumerator()) {
        if (-not (Test-ExpectedHash -Path (Join-Path $binRoot $entry.Key) -Expected $entry.Value)) {
            return $false
        }
    }
    return $true
}

New-Item -ItemType Directory -Force -Path $temporaryRoot, $modelRoot | Out-Null

if ($Force -or -not (Test-VerifiedBin)) {
    Write-Host 'Baixando llama.cpp b11998 (runtime LFM3)...'
    & curl.exe -L --fail --retry 3 -o $archivePath $archiveUrl
    if ($LASTEXITCODE -ne 0) { throw 'Falha ao baixar o pacote de binários do llama.cpp.' }
    Assert-Hash -Path $archivePath -Algorithm SHA256 -Expected $archiveSha256
    Assert-SafeArchive -Path $archivePath

    $extractTemp = Join-Path $temporaryRoot 'extracted'
    if (Test-Path -LiteralPath $extractTemp) {
        Remove-Item -LiteralPath $extractTemp -Recurse -Force
    }
    New-Item -ItemType Directory -Force -Path $extractTemp | Out-Null
    Expand-Archive -LiteralPath $archivePath -DestinationPath $extractTemp -Force

    if (Test-Path -LiteralPath $binRoot) {
        $resolvedBin = (Resolve-Path -LiteralPath $binRoot).Path
        if (-not $resolvedBin.StartsWith($projectRoot + [IO.Path]::DirectorySeparatorChar)) {
            throw 'O diretório de destino está fora do projeto.'
        }
        Remove-Item -LiteralPath $resolvedBin -Recurse -Force
    }
    New-Item -ItemType Directory -Force -Path $binRoot | Out-Null
    foreach ($entry in $requiredBinFiles.GetEnumerator()) {
        Copy-Item -LiteralPath (Join-Path $extractTemp $entry.Key) -Destination (Join-Path $binRoot $entry.Key) -Force
    }
}

foreach ($entry in $requiredBinFiles.GetEnumerator()) {
    Assert-Hash -Path (Join-Path $binRoot $entry.Key) -Algorithm SHA256 -Expected $entry.Value
}

foreach ($modelEntry in $requiredModelFiles.GetEnumerator()) {
    $fileName = $modelEntry.Key
    if (-not $IncludeModels -and $fileName.EndsWith('.gguf')) {
        continue
    }
    $info = $modelEntry.Value
    $targetPath = Join-Path $modelRoot $fileName
    if ($Force -or -not (Test-ExpectedHash -Path $targetPath -Expected $info.Sha256)) {
        Write-Host "Baixando $fileName (LiquidAI/LFM3-Audio-2B-GGUF)..."
        & curl.exe -L --fail --retry 3 -o $targetPath $info.Url
        if ($LASTEXITCODE -ne 0) { throw "Falha ao baixar $fileName." }
    }
    Assert-Hash -Path $targetPath -Algorithm SHA256 -Expected $info.Sha256
}

Write-Host 'Runtime local de voz LFM3 Audio 2B pronto e verificado.' -ForegroundColor Green
