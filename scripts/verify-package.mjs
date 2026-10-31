import { createReadStream } from 'node:fs'
import { readFile, readdir, stat } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import asar from '@electron/asar'
import {
  FuseV1Options,
  FuseVersion,
  getCurrentFuseWire
} from '@electron/fuses'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const archivePath = resolve(
  process.argv[2] ?? join(projectRoot, 'release', 'win-unpacked', 'resources', 'app.asar')
)

const sourcePackage = JSON.parse(
  await readFile(join(projectRoot, 'package.json'), 'utf8')
)
const packagedPackage = JSON.parse(
  asar.extractFile(archivePath, 'package.json').toString('utf8')
)
const packagedMainEntries = asar
  .listPackage(archivePath)
  .map((entry) => entry.replace(/^[/\\]+/, ''))
  .filter(
    (entry) =>
      (entry.startsWith('out/main/') || entry.startsWith('out\\main\\')) &&
      entry.endsWith('.js')
  )
const packagedRuntimeCode = packagedMainEntries
  .map((entry) => asar.extractFile(archivePath, entry).toString('utf8'))
  .join('\n')
const packagedRendererIndex = asar.extractFile(
  archivePath,
  join('out', 'renderer', 'index.html')
).toString('utf8')

for (const directive of [
  "base-uri 'none'",
  "connect-src 'self'",
  "form-action 'none'",
  "frame-src 'none'",
  "media-src 'self' blob:",
  "object-src 'none'",
  "script-src 'self'"
]) {
  if (!packagedRendererIndex.includes(directive)) {
    throw new Error(`Diretiva CSP obrigatória ausente do pacote: ${directive}.`)
  }
}

if (packagedPackage.name !== sourcePackage.name) {
  throw new Error(
    `Pacote incorreto: esperado ${sourcePackage.name}, encontrado ${packagedPackage.name}.`
  )
}

if (packagedPackage.version !== sourcePackage.version) {
  throw new Error(
    `Versão interna incorreta: esperado ${sourcePackage.version}, encontrado ${packagedPackage.version}.`
  )
}

for (const marker of [
  'tool_calls',
  'tool_choice',
  '[SEM_FERRAMENTA]',
  'open_application',
  'computer_observe',
  'computer_look',
  'capture-desktop',
  'TITI_RENDERER_BASE_URL',
  'protocol.handle(TITI_RENDERER_SCHEME',
  'windows-ui-automation.ps1',
  'focusImageBase64',
  'app-skills.json',
  'voice:push-to-talk-requested',
  'voice:synthesize',
  'voice:synthesis-chunk',
  'LFM3-Audio-2B-Q4_K_M.gguf',
  'mmproj-LFM3-Audio-2B-Q8_0.gguf',
  '9a773289bd321ed879cd3a76545f6aca506e403851a45fb315420aee45625be2',
  '2b6648b1fd48af16aa0877b0592b144d15070783673e038a379fdbc51d40e365',
  'llama-server.exe',
  'DADOS LOCAIS CURADOS',
  'windowsHide',
  'keep_alive'
]) {
  if (!packagedRuntimeCode.includes(marker)) {
    throw new Error(`O pacote não contém o marcador obrigatório: ${marker}.`)
  }
}

for (const forbiddenMarker of [
  'TITI_CAPTURE_DIR',
  'captureQaScreens',
  "tool-confirmation-dialog .primary-button"
]) {
  if (packagedRuntimeCode.includes(forbiddenMarker)) {
    throw new Error(
      `Pacote contém um gancho de QA proibido em produção: ${forbiddenMarker}.`
    )
  }
}

const resourcesPath = dirname(archivePath)
const executablePath = join(resourcesPath, '..', `${sourcePackage.build?.productName ?? 'Titi'}.exe`)
const fuseWire = await getCurrentFuseWire(executablePath)
const enabledFuse = '1'.charCodeAt(0)
const disabledFuse = '0'.charCodeAt(0)
const expectedFuses = new Map([
  [FuseV1Options.RunAsNode, disabledFuse],
  [FuseV1Options.EnableCookieEncryption, enabledFuse],
  [FuseV1Options.EnableNodeOptionsEnvironmentVariable, disabledFuse],
  [FuseV1Options.EnableNodeCliInspectArguments, disabledFuse],
  [FuseV1Options.EnableEmbeddedAsarIntegrityValidation, enabledFuse],
  [FuseV1Options.OnlyLoadAppFromAsar, enabledFuse],
  [FuseV1Options.LoadBrowserProcessSpecificV8Snapshot, disabledFuse],
  [FuseV1Options.GrantFileProtocolExtraPrivileges, disabledFuse]
])

if (fuseWire.version !== FuseVersion.V1) {
  throw new Error(`Versão de fuses inesperada no executável: ${fuseWire.version}.`)
}
for (const [fuse, expectedState] of expectedFuses) {
  if (fuseWire[fuse] !== expectedState) {
    throw new Error(`Fuse de segurança incorreto: ${FuseV1Options[fuse]}.`)
  }
}

const unpackedMain = await stat(
  join(resourcesPath, 'app.asar.unpacked', 'out', 'main')
).catch(() => null)
if (unpackedMain) {
  throw new Error('O processo principal não pode ficar fora do ASAR íntegro.')
}

const lfm3BinHashes = {
  'llama-server.exe': '3a192bd0dfb3aa56bc544b62cb0648d1ad8a9d9147df0e87132404645dce9fce',
  'llama-server-impl.dll': 'fa68e1cc20394b5fc31ee4c4e0fc19c7ac05fe4171d6e61628f8497d136b8f78',
  'llama-tts.exe': '1fe2984af88e8e3018915a67fef39261481146bbea55f7c92716f654b8fb269f',
  'llama-mtmd-cli.exe': '50807cbc6deb8cef5af57eb9b39d732c4c31fd14d39162aac365a997ff6be974',
  'llama-common.dll': '6411d745267e5ea6fecc6f5e6e851934db8750a02003a5655e15226f74499a29',
  'llama.dll': '28e64cf797e72589d5a5fcc0790acc07f268947618d95017ebf9474cf3f41526',
  'mtmd.dll': '11e76d48e12bfc1020ae26c10c39aa5f960749257984273f65b0edd49cf4b36d',
  'ggml.dll': 'f9e465a3b7a9ed4627a79b3c664a7a3ba3313c3fdb53cad729b6df0c03098eeb',
  'ggml-base.dll': '462f93a62fae627be8781072eec7b3f140ab791aa5adfc6cc98eebfe987a546f',
  'ggml-cpu-alderlake.dll': '3f6b49b3da0d371670e6329b6f6f9757533a5daaaeefcf8548ee8049bbc71f4f',
  'ggml-cpu-cannonlake.dll': '30a150cefb1fc018b5d836ef5a0c2b0f38abf678d5129e5c4ca0e7352d0dabb8',
  'ggml-cpu-cascadelake.dll': '3c279f800cf037f5c0216224daaf67d7a33a1ecda61ebe7682520c46b0759102',
  'ggml-cpu-cooperlake.dll': 'efe10098c99d50abf8094c5e27bc045aebf69b2e946ff38a27d2ae32002dbc89',
  'ggml-cpu-haswell.dll': '963a3fa10586e259741b8fa8d798048d20ff1fef1745256bc44b4e0f13391af8',
  'ggml-cpu-icelake.dll': '14bd0d95bf235f8e0321163d85ca63728701cfd711a7f95c6aa7dd2890d6733e',
  'ggml-cpu-ivybridge.dll': '4b1370e26cca0827f4efddaf01fc0ab4886de931fc0c0dece1b3661d6232feb0',
  'ggml-cpu-piledriver.dll': '3f4651e04b05f0f5f85a3ea6a3c0ab945726d7eaa12a6980a855ca155b090d31',
  'ggml-cpu-sandybridge.dll': 'bbcdfb2797fdb2d8afc3fe61d162a4ce2299486a8ca9cad9e958e4b2694ba015',
  'ggml-cpu-sapphirerapids.dll': '30dcb239beea807f54541d96eca88898dc34bba8f30739029b1c74ce340faa56',
  'ggml-cpu-skylakex.dll': '52b0f8c4f6869faf8a4567b9aa02730f78aff518e390acff9c589d443edbe140',
  'ggml-cpu-sse42.dll': 'f141df2dc4df8548513f2cead485343133f5d6d9b7de3b6ff4f4e400c35b30c9',
  'ggml-cpu-x64.dll': 'a199c31fdeb9e42c55900213ec5b809fc48e842e667c729fac4e289a66301f93',
  'ggml-cpu-zen4.dll': '4d8e9d81b57d039edf229ece6e5abaa80905a16687ed76de57cad1e182bc23c4',
  'libomp.dll': 'a12116ba72d1d6820407cf30be23da04ce79d6bb8a71a5ee71759c5a1faa6f1c',
  LICENSE: '94f29bbed6a22c35b992c5c6ebf0e7c92f13b836b90f36f461c9cf2f0f1d010d',
  'LICENSE-LLVM-OpenMP': 'fdad1758a9e1f9d5a81e18879b3406772115edc92c24bfa36b70c654f325e8e4'
}

const requiredResources = [
  ...Object.entries(lfm3BinHashes).map(([file, sha256]) => ({
    path: join(resourcesPath, 'runtime', 'lfm3', 'bin', file),
    minimumBytes: 1,
    sha256
  })),
  {
    path: join(resourcesPath, 'runtime', 'lfm3', 'models', 'LICENSE'),
    minimumBytes: 10_000,
    sha256: '4d28ca14dedc0b3d0fcc2b3339f0e79931faa33874f3d24f522183a8fc70068c'
  },
  {
    path: join(resourcesPath, 'runtime', 'windows-ui-automation', 'windows-ui-automation.ps1'),
    minimumBytes: 2_000
  },
  {
    path: join(resourcesPath, 'app.asar.unpacked', 'node_modules', '@koromix', 'koffi-win32-x64', 'win32_x64', 'koffi.node'),
    minimumBytes: 500_000
  }
]
for (const resource of requiredResources) {
  const metadata = await stat(resource.path).catch(() => null)
  if (!metadata?.isFile() || metadata.size < resource.minimumBytes) {
    throw new Error(`Recurso obrigatório ausente ou incompleto: ${resource.path}.`)
  }
  if (resource.sha256) {
    const digest = await sha256File(resource.path)
    if (digest !== resource.sha256) {
      throw new Error(`Recurso obrigatório com hash incorreto: ${resource.path}.`)
    }
  }
}

for (const packagedPath of await filesBelow(join(resourcesPath, 'runtime'))) {
  const sourcePath = join(projectRoot, relative(resourcesPath, packagedPath))
  const sourceMetadata = await stat(sourcePath).catch(() => null)
  if (!sourceMetadata?.isFile()) {
    throw new Error(`Recurso empacotado sem origem verificável: ${packagedPath}.`)
  }
  const [packagedHash, sourceHash] = await Promise.all([
    sha256File(packagedPath),
    sha256File(sourcePath)
  ])
  if (packagedHash !== sourceHash) {
    throw new Error(`Recurso empacotado diverge da origem verificada: ${packagedPath}.`)
  }
}

console.log(
  `Pacote verificado: ${packagedPackage.name} ${packagedPackage.version}, ASAR íntegro, fuses restritivos e recursos LFM3 conferidos.`
)

async function filesBelow(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await filesBelow(path))
    else if (entry.isFile()) files.push(path)
  }
  return files
}

async function sha256File(path) {
  const digest = createHash('sha256')
  for await (const chunk of createReadStream(path)) digest.update(chunk)
  return digest.digest('hex')
}
