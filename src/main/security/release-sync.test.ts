import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
// The release helper is executable JavaScript used by CI.
// @ts-expect-error JavaScript release scripts do not publish TypeScript declarations.
import { checkReleaseSync, expectedBadgeForVersion } from '../../../scripts/check-release-sync.mjs'

const temporaryRoots: string[] = []

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((path) => rm(path, {
    recursive: true,
    force: true
  })))
})

describe('checkReleaseSync', () => {
  it('confere todas as réplicas públicas da versão candidata', async () => {
    const root = await syncFixture()

    await expect(checkReleaseSync(root)).resolves.toEqual({
      version: '0.2.0-beta.8',
      tag: 'v0.2.0-beta.8',
      expectedDownload: 'Titi-Setup-0.2.0-beta.8.exe'
    })
  })

  it('recusa lockfile da landing com versão herdada', async () => {
    const root = await syncFixture()
    await writeFile(join(root, 'landing', 'package-lock.json'), JSON.stringify({
      version: '0.2.0-beta.7',
      packages: { '': { version: '0.2.0-beta.7' } }
    }), 'utf8')

    await expect(checkReleaseSync(root)).rejects.toThrow('package-lock.json')
  })

  it('formata o selo visível da pré-release', () => {
    expect(expectedBadgeForVersion('0.2.0-beta.8')).toBe('V0.2.0 BETA.8')
  })
})

async function syncFixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'titi-release-sync-'))
  temporaryRoots.push(root)
  await mkdir(join(root, 'landing', 'app'), { recursive: true })
  await mkdir(join(root, 'release'), { recursive: true })
  const version = '0.2.0-beta.8'
  const installer = `Titi-Setup-${version}.exe`
  await Promise.all([
    writeFile(join(root, 'package.json'), JSON.stringify({ version }), 'utf8'),
    writeFile(join(root, 'landing', 'package.json'), JSON.stringify({ version }), 'utf8'),
    writeFile(join(root, 'landing', 'package-lock.json'), JSON.stringify({
      version,
      packages: { '': { version } }
    }), 'utf8'),
    writeFile(join(root, 'landing', 'app', 'page.tsx'), [
      `const DOWNLOAD = "/releases/download/v${version}/${installer}"`,
      `const RELEASE = "/releases/tag/v${version}"`,
      `const app = { softwareVersion: "${version}" }`,
      expectedBadgeForVersion(version)
    ].join('\n'), 'utf8'),
    writeFile(join(root, 'release', 'latest.yml'), `version: ${version}\npath: ${installer}\n`, 'utf8'),
    writeFile(join(root, 'RELEASE_NOTES.md'), `# Titi Beta ${version}\n\n## Mudanças\n`, 'utf8'),
    writeFile(join(root, 'README.md'), `> **Estado atual:** pré-release \`${version}\`\n`, 'utf8'),
    writeFile(join(root, 'QA_PLAN.md'), `# Gate de QA — Titi \`${version}\`\n`, 'utf8'),
    writeFile(join(root, 'BACKLOG.md'), `## Auditoria multidisciplinar atual — \`${version}\`\n`, 'utf8'),
    writeFile(join(root, 'MARKETING_PLAN.md'), `Plano público da versão ${version}.\n`, 'utf8')
  ])
  return root
}
