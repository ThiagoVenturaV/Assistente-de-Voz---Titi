#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { readFile, stat, writeFile } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'

function expect(condition, message) {
  if (!condition) {
    throw new Error(`Candidato de release inválido: ${message}`)
  }
}

export function expectedTagForVersion(version) {
  expect(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version), `versão inválida: ${version}`)
  return `v${version}`
}

export function readManifestScalar(source, key) {
  return new RegExp(`^\\s*${key}:\\s*['\"]?(.+?)['\"]?\\s*$`, 'm').exec(source)?.[1]
}

export async function hashFile(path, algorithm, encoding = 'hex') {
  return createHash(algorithm).update(await readFile(path)).digest(encoding)
}

function parseArguments(args) {
  const values = new Map()
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index]
    const value = args[index + 1]
    expect(key?.startsWith('--') && value, `argumento incompleto: ${key ?? '(ausente)'}`)
    values.set(key.slice(2), value)
  }
  return values
}

export async function prepareReleaseAssets({ projectRoot, tag, commit, signing }) {
  const packageJson = JSON.parse(await readFile(join(projectRoot, 'package.json'), 'utf8'))
  const version = packageJson.version
  const expectedTag = expectedTagForVersion(version)
  expect(tag === expectedTag, `tag ${tag} não corresponde a ${expectedTag}`)
  expect(/^[0-9a-f]{7,40}$/i.test(commit), `commit inválido: ${commit}`)
  expect(['signed', 'unsigned-prerelease'].includes(signing), `estado de assinatura inválido: ${signing}`)
  expect(signing === 'signed' || version.includes('-'), 'versão estável não pode ser marcada como não assinada')

  const releaseRoot = join(projectRoot, 'release')
  const installerName = `Titi-Setup-${version}.exe`
  const assetNames = [installerName, `${installerName}.blockmap`, 'latest.yml']
  const assetPaths = assetNames.map((name) => join(releaseRoot, name))
  const latestYaml = await readFile(join(releaseRoot, 'latest.yml'), 'utf8')
  const installerPath = assetPaths[0]
  const installerStats = await stat(installerPath)
  const manifestVersion = readManifestScalar(latestYaml, 'version')
  const manifestPath = readManifestScalar(latestYaml, 'path')
  const manifestSize = Number(readManifestScalar(latestYaml, 'size'))
  const manifestHashes = [...latestYaml.matchAll(/^\s*sha512:\s*([^\s]+)\s*$/gm)].map((match) => match[1])
  const installerSha512 = await hashFile(installerPath, 'sha512', 'base64')

  expect(manifestVersion === version, `latest.yml declara ${manifestVersion ?? 'versão ausente'}`)
  expect(basename(manifestPath ?? '') === installerName, 'latest.yml aponta para outro instalador')
  expect(manifestSize === installerStats.size, 'tamanho do instalador diverge do latest.yml')
  expect(manifestHashes.length >= 2, 'latest.yml não contém os hashes esperados')
  expect(manifestHashes.every((hash) => hash === installerSha512), 'SHA-512 do instalador diverge do latest.yml')
  expect(latestYaml.includes(`- url: ${installerName}`), 'lista de arquivos do latest.yml aponta para outro ativo')

  const assets = []
  for (let index = 0; index < assetNames.length; index += 1) {
    const name = assetNames[index]
    const path = assetPaths[index]
    const fileStats = await stat(path)
    assets.push({
      name,
      bytes: fileStats.size,
      sha256: await hashFile(path, 'sha256'),
      sha512: await hashFile(path, 'sha512')
    })
  }

  const releaseManifest = {
    schemaVersion: 1,
    version,
    tag,
    commit: commit.toLowerCase(),
    prerelease: version.includes('-'),
    signing,
    assets
  }
  const releaseManifestPath = join(releaseRoot, 'release-manifest.json')
  await writeFile(
    releaseManifestPath,
    `${JSON.stringify(releaseManifest, null, 2)}\n`,
    'utf8'
  )

  const manifestSha256 = await hashFile(releaseManifestPath, 'sha256')
  const checksums = `${[
    ...assets.map((asset) => `${asset.sha256}  ${asset.name}`),
    `${manifestSha256}  release-manifest.json`
  ].join('\n')}\n`
  await writeFile(join(releaseRoot, 'SHA256SUMS.txt'), checksums, 'utf8')

  return releaseManifest
}

const isMainModule = process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)
if (isMainModule) {
  const args = parseArguments(process.argv.slice(2))
  const manifest = await prepareReleaseAssets({
    projectRoot: resolve(args.get('project-root') ?? resolve(import.meta.dirname, '..')),
    tag: args.get('tag'),
    commit: args.get('commit'),
    signing: args.get('signing')
  })
  console.log(
    `Ativos preparados para ${manifest.tag}: ${manifest.assets.map((asset) => asset.name).join(', ')}.`
  )
}
