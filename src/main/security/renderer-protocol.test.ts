import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  TITI_RENDERER_BASE_URL,
  resolveRendererAssetPath
} from './renderer-protocol'

const rendererRoot = resolve('out/renderer')

describe('packaged renderer protocol', () => {
  it('serves only renderer assets from the fixed app host', () => {
    expect(TITI_RENDERER_BASE_URL).toBe('titi://app/index.html')
    expect(resolveRendererAssetPath('titi://app/', rendererRoot))
      .toBe(join(rendererRoot, 'index.html'))
    expect(resolveRendererAssetPath('titi://app/assets/app.js', rendererRoot))
      .toBe(join(rendererRoot, 'assets', 'app.js'))
  })

  it.each([
    'https://app/index.html',
    'titi://other/index.html',
    'titi://user:secret@app/index.html',
    'titi://app/index.html?token=secret',
    'titi://app/..%2fsecret.txt',
    'titi://app/%5c..%5csecret.txt',
    'not-a-url'
  ])('rejects an unsafe renderer asset request: %s', (value) => {
    expect(resolveRendererAssetPath(value, rendererRoot)).toBeNull()
  })
})
