import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
// The release helper is intentionally executable JavaScript used by CI.
// @ts-expect-error JavaScript release scripts do not publish TypeScript declarations.
import { expectedTagForVersion, prepareReleaseAssets } from '../../../scripts/prepare-release-assets.mjs'

const temporaryRoots: string[] = []

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((path) => rm(path, {
    recursive: true,
    force: true
  })))
})

describe('prepareReleaseAssets', () => {
  it('gera manifesto e checksums apenas para os ativos da versão exata', async () => {
    const root = await releaseFixture('0.2.0-beta.8')

    const manifest = await prepareReleaseAssets({
      projectRoot: root,
      tag: 'v0.2.0-beta.8',
      commit: '0123456789abcdef0123456789abcdef01234567',
      signing: 'unsigned-prerelease'
    })

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

    await expect(prepareReleaseAssets({
      projectRoot: root,
      tag: 'v0.2.0-beta.7',
      commit: '0123456',
      signing: 'unsigned-prerelease'
    })).rejects.toThrow('não corresponde')
  })

  it('recusa versão estável não assinada', async () => {
    const root = await releaseFixture('0.2.0')

    await expect(prepareReleaseAssets({
      projectRoot: root,
      tag: 'v0.2.0',
      commit: '0123456',
      signing: 'unsigned-prerelease'
    })).rejects.toThrow('versão estável')
  })

  it('deriva a tag somente de versões semver válidas', () => {
    expect(expectedTagForVersion('0.2.0-beta.8')).toBe('v0.2.0-beta.8')
    expect(() => expectedTagForVersion('beta 8')).toThrow('versão inválida')
  })
})

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
