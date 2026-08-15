import type { TitiDesktopApi } from '../../shared/contracts'

declare global {
  interface Window {
    titi: TitiDesktopApi
  }
}

export {}
