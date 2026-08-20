import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { promisify } from 'node:util'
import { afterEach, describe, expect, it } from 'vitest'

const temporaryRoots: string[] = []
const execFileAsync = promisify(execFile)
const releaseScript = resolve('scripts/prepare-release-assets.mjs')
const releaseWorkflow = resolve('.github/workflows/release.yml')

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((path) => rm(path, {
    recursive: true,
    force: true
  })))
})

describe('prepareReleaseAssets', () => {
  it('gera manifesto e checksums apenas para os ativos da versão exata', async () => {
    const root = await releaseFixture('0.2.0-beta.8')

    await runReleaseScript(root, 'v0.2.0-beta.8', 'unsigned-prerelease')
    const manifest = JSON.parse(await readFile(
      join(root, 'release', 'release-manifest.json'),
      'utf8'
    ))

    expect(manifest).toMatchObject({
      version: '0.2.0-beta.8',
      tag: 'v0.2.0-beta.8',
      prerelease: true,
      signing: 'unsigned-prerelease'
    })
    expect(manifest.assets.map((asset: { name: string }) => asset.name)).toEqual([
      'Titi-Setup-0.2.0-beta.8.exe',
      'Titi-Setup-0.2.0-beta.8.exe.blockmap',
      'latest.yml'
    ])
    const checksums = await readFile(join(root, 'release', 'SHA256SUMS.txt'), 'utf8')
    expect(checksums).toContain('Titi-Setup-0.2.0-beta.8.exe')
    expect(checksums).toContain('release-manifest.json')
    expect(checksums).not.toContain('beta.7')
  })

  it('recusa tag de outra versão', async () => {
    const root = await releaseFixture('0.2.0-beta.8')

    await expect(runReleaseScript(root, 'v0.2.0-beta.7', 'unsigned-prerelease'))
      .rejects.toMatchObject({ stderr: expect.stringContaining('não corresponde') })
  })

  it('recusa versão estável não assinada', async () => {
    const root = await releaseFixture('0.2.0')

    await expect(runReleaseScript(root, 'v0.2.0', 'unsigned-prerelease'))
      .rejects.toMatchObject({ stderr: expect.stringContaining('versão estável') })
  })

  it('recusa versão fora do formato semver', async () => {
    const root = await releaseFixture('beta 8')

    await expect(runReleaseScript(root, 'vbeta 8', 'unsigned-prerelease'))
      .rejects.toMatchObject({ stderr: expect.stringContaining('versão inválida') })
  })

  it('aceita o separador repassado pelo gerenciador de pacotes', async () => {
    const root = await releaseFixture('0.2.0-beta.8')

    await expect(runReleaseScript(
      root,
      'v0.2.0-beta.8',
      'unsigned-prerelease',
      true
    )).resolves.toMatchObject({ stdout: expect.stringContaining('Ativos preparados') })
  })

  it('retoma manualmente somente a tag imutável conferida', async () => {
    const workflow = await readFile(releaseWorkflow, 'utf8')

    expect(workflow).toContain('workflow_dispatch:')
    expect(workflow).toContain('ref: ${{ env.TITI_RELEASE_TAG }}')
    expect(workflow).toContain('TITI_RELEASE_COMMIT=$headCommit')
    expect(workflow).toContain('node scripts/prepare-release-assets.mjs')
    expect(workflow).not.toContain('pnpm release:assets --')
  })
})

async function runReleaseScript(
  projectRoot: string,
  tag: string,
  signing: 'signed' | 'unsigned-prerelease',
  includePackageManagerSeparator = false
): Promise<{ stdout: string; stderr: string }> {
  const argumentsList = [
    releaseScript,
    '--project-root', projectRoot,
    '--tag', tag,
    '--commit', '0123456789abcdef0123456789abcdef01234567',
    '--signing', signing
  ]
  if (includePackageManagerSeparator) argumentsList.splice(1, 0, '--')
  return execFileAsync(process.execPath, argumentsList, { encoding: 'utf8', windowsHide: true })
}

async function releaseFixture(version: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'titi-release-assets-'))
  temporaryRoots.push(root)
  const releaseRoot = join(root, 'release')
  await mkdir(releaseRoot)
  await writeFile(join(root, 'package.json'), JSON.stringify({ version }), 'utf8')

  const installerName = `Titi-Setup-${version}.exe`
  const installer = Buffer.from(`installer-${version}`)
  const installerSha512 = createHash('sha512').update(installer).digest('base64')
  await writeFile(join(releaseRoot, installerName), installer)
  await writeFile(join(releaseRoot, `${installerName}.blockmap`), 'blockmap', 'utf8')
  await writeFile(join(releaseRoot, 'latest.yml'), [
    `version: ${version}`,
    'files:',
    `  - url: ${installerName}`,
    `    sha512: ${installerSha512}`,
    `    size: ${installer.length}`,
    `path: ${installerName}`,
    `sha512: ${installerSha512}`,
    `releaseDate: '${new Date(0).toISOString()}'`,
    ''
  ].join('\n'), 'utf8')
  return root
}
