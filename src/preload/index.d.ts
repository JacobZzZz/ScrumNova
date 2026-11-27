import type { ScrumNovaApi } from '@shared/types'

declare global {
  interface Window {
    scrumNova: ScrumNovaApi
  }
}

export {}
