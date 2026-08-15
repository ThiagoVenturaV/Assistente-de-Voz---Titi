import { describe, expect, it, vi } from 'vitest'
import { GlobalPushToTalk, isSafePushToTalkShortcut } from './global-push-to-talk'

describe('GlobalPushToTalk', () => {
  it('registers a replacement before releasing the previous shortcut', () => {
    const order: string[] = []
    const backend = {
      register: vi.fn((value: string) => {
        order.push(`register:${value}`)
        return true
      }),
      unregister: vi.fn((value: string) => order.push(`unregister:${value}`))
    }
    const shortcut = new GlobalPushToTalk(backend, vi.fn())

    shortcut.register('Ctrl+Shift+Space')
    shortcut.register('Alt+Space')

    expect(order).toEqual([
      'register:Ctrl+Shift+Space',
      'register:Alt+Space',
      'unregister:Ctrl+Shift+Space'
    ])
  })

  it('keeps the current shortcut when a replacement conflicts', () => {
    const backend = {
      register: vi.fn((value: string) => value !== 'Alt+Space'),
      unregister: vi.fn()
    }
    const shortcut = new GlobalPushToTalk(backend, vi.fn())
    shortcut.register('Ctrl+Shift+Space')

    expect(() => shortcut.register('Alt+Space')).toThrow(/outro aplicativo/)
    expect(backend.unregister).not.toHaveBeenCalled()
  })
})

describe('isSafePushToTalkShortcut', () => {
  it.each(['Ctrl+Shift+Space', 'Alt+F9', 'CommandOrControl+K'])(
    'accepts %s',
    (value) => expect(isSafePushToTalkShortcut(value)).toBe(true)
  )
  it.each(['Space', 'A', 'Ctrl', 'Ctrl+Alt+A+B', 'Ctrl+Delete'])(
    'rejects unsafe or ambiguous %s',
    (value) => expect(isSafePushToTalkShortcut(value)).toBe(false)
  )
})
