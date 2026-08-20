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
const packagedMain = asar.extractFile(
  archivePath,
  join('out', 'main', 'index.js')
).toString('utf8')
const packagedSupertonicWorker = asar.extractFile(
  archivePath,
  join('out', 'main', 'supertonic-worker.js')
).toString('utf8')
const packagedRendererIndex = asar.extractFile(
  archivePath,
  join('out', 'renderer', 'index.html')
).toString('utf8')
const packagedRuntimeCode = `${packagedMain}\n${packagedSupertonicWorker}`

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
  'sherpa-onnx-node',
  'directml',
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

const whisperRuntimeHashes = {
  'parakeet-cli.exe': 'ab2eaca3f855c33386eb1bff404808de8bce19c003baafd8b69611b6c369a339',
  'parakeet.dll': '567c56a3c9b7383982e5777964f37f9f3cb930ef4a7ca907477e4e955f1cd0a4',
  'ggml.dll': '894c6237ee7849843213906a2b6a0b371aaa6234048d465f206d910ae846fafb',
  'ggml-base.dll': '1482359d921b4c1b183d49db1d770f9b5e90d86a618b8b648d4845c2471ad6b0',
  'ggml-cpu-alderlake.dll': 'd1c5411561361f7ce71ff8455ecf01f666f581b0608fa91a1dfe7d3fd6a25bd1',
  'ggml-cpu-cannonlake.dll': '2ef36f05fa252ff4fdcb8d42ebce1ceba4f3d3de12b93bed15bdee6237dccd63',
  'ggml-cpu-cascadelake.dll': '505899aaf3f99c5d714361640f561458ea97f8a09eb0614568a66bead2115cb0',
  'ggml-cpu-haswell.dll': 'f8cf2f35a06498d783d77fde42004dd54d2f8236b0d42ac323b94bba65a603c4',
  'ggml-cpu-icelake.dll': '78ad143ee2e674d037b4840ef33b5748a0659762a26e0ae2b621c4f9451cbde8',
  'ggml-cpu-sandybridge.dll': 'ee47db7dc40fb30eca73e62a05306059c2c3c42aecddf2e8d6ad7e530069b815',
  'ggml-cpu-skylakex.dll': '164e2793897944a43ee071ce6c0b09018088bdf4dd8b14ac0755c58849cf8c50',
  'ggml-cpu-sse42.dll': '7318a9a3b95a85b2453c437b274412bbbae89e5ecdf5babb19b99edc06ded063',
  'ggml-cpu-x64.dll': 'af0f1c2f28ff9e3f472481dd969907bda85fa39d4fde17617d4bb0b389301b60'
}
const supertonicModelHashes = {
  'duration_predictor.int8.onnx': 'c3eb91414d5ff8a7a239b7fe9e34e7e2bf8a8140d8375ffb14718b1c639325db',
  'text_encoder.int8.onnx': 'c7befd5ea8c3119769e8a6c1486c4edc6a3bc8365c67621c881bbb774b9902ff',
  'vector_estimator.int8.onnx': '20cd86fa5c6effedfda0e7cffe5b0569ca401c440a0c3a1d72bf39286c0db3fd',
  'vocoder.int8.onnx': 'e923d60f53f95eb1ce235f1dc33ec56d9c057823c96fa6f8acf98f32b0da6152',
  'tts.json': '42078d3aef1cd43ab43021f3c54f47d2d75ceb4e75f627f118890128b06a0d09',
  'unicode_indexer.bin': '8402ca48e5189a8950138580b0fff64db6f072f24ac07cd54ba8b2fbb9883b30',
  'voice.bin': '67d5209b0ee8ce6c74105ffbe12fe6a7628aea3b4ba2fcb308a4a67938a93ce8'
}
const supertonicModelRoot = join(
  resourcesPath,
  'runtime',
  'supertonic',
  'model-extracted',
  'sherpa-onnx-supertonic-3-tts-int8-2026-05-11'
)
const requiredResources = [
  ...Object.entries(whisperRuntimeHashes).map(([file, sha256]) => ({
    path: join(resourcesPath, 'runtime', 'whisper', 'bin', 'Release', file),
    minimumBytes: 1,
    sha256
  })),
  {
    path: join(resourcesPath, 'runtime', 'whisper', 'models', 'ggml-parakeet-tdt-0.6b-v3-q8_0.bin'),
    minimumBytes: 600_000_000,
    sha256: '4d64e9e96c2792186d072fde0034df0ad670cf680a2f53069052ead827fd600e'
  },
  {
    path: join(resourcesPath, 'runtime', 'windows-ui-automation', 'windows-ui-automation.ps1'),
    minimumBytes: 2_000
  },
  ...Object.entries(supertonicModelHashes).map(([file, sha256]) => ({
    path: join(supertonicModelRoot, file),
    minimumBytes: 1,
    sha256
  })),
  {
    path: join(resourcesPath, 'runtime', 'supertonic', 'directml', 'node_modules', 'sherpa-onnx-win-x64', 'sherpa-onnx-c-api.dll'),
    minimumBytes: 4_000_000,
    sha256: '16e2bf37bcfb8cac1261dd569134538b4c03bd09c87bed9ba63b36e475b6193a'
  },
  {
    path: join(resourcesPath, 'runtime', 'supertonic', 'directml', 'node_modules', 'sherpa-onnx-win-x64', 'onnxruntime.dll'),
    minimumBytes: 15_000_000,
    sha256: 'e7eedec6a6f26dc39dc948276a75ef6d2bee3fff944d874ceed0bbd3b97bff40'
  },
  {
    path: join(resourcesPath, 'runtime', 'supertonic', 'directml', 'node_modules', 'sherpa-onnx-win-x64', 'onnxruntime_providers_shared.dll'),
    minimumBytes: 20_000,
    sha256: '265c8daf29637cb259cac8be9f08f2cd45f3883f0f0e4949cbfddd5b4cbec3b6'
  },
  {
    path: join(resourcesPath, 'runtime', 'supertonic', 'directml', 'node_modules', 'sherpa-onnx-win-x64', 'DirectML.dll'),
    minimumBytes: 15_000_000,
    sha256: '9c9e6d822561c6c41b90e6994b3e8857cf1d66dbfb1e0c4c799c7c89b4e92da1'
  },
  {
    path: join(resourcesPath, 'runtime', 'supertonic', 'directml', 'node_modules', 'sherpa-onnx-win-x64', 'sherpa-onnx.node'),
    minimumBytes: 500_000,
    sha256: 'fe786f8424bd22bc2b1c1394f8c019d06d40aa88410f18ab56d5d225eb10cf51'
  },
  {
    path: join(resourcesPath, 'runtime', 'supertonic', 'directml', 'node_modules', 'sherpa-onnx-win-x64', 'sherpa-onnx-cxx-api.dll'),
    minimumBytes: 250_000,
    sha256: 'bff174e9602cad51b15299ba01a18693367261cd8a35eb55b91a5134c4fca2a6'
  },
  {
    path: join(resourcesPath, 'runtime', 'supertonic', 'directml', 'NOTICE.md'),
    minimumBytes: 1_000
  },
  {
    path: join(resourcesPath, 'runtime', 'supertonic', 'directml', 'licenses', 'onnxruntime-LICENSE.txt'),
    minimumBytes: 1_000
  },
  {
    path: join(resourcesPath, 'runtime', 'supertonic', 'directml', 'licenses', 'sherpa-onnx-LICENSE.txt'),
    minimumBytes: 10_000
  },
  {
    path: join(resourcesPath, 'app.asar.unpacked', 'node_modules', 'sherpa-onnx-win-x64', 'sherpa-onnx.node'),
    minimumBytes: 500_000
  },
  {
    path: join(resourcesPath, 'app.asar.unpacked', 'node_modules', 'sherpa-onnx-win-x64', 'onnxruntime.dll'),
    minimumBytes: 15_000_000
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
  `Pacote verificado: ${packagedPackage.name} ${packagedPackage.version}, ASAR íntegro, fuses restritivos e recursos conferidos.`
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
