import type { IRnsHandler } from '@/interfaces'

export interface IStorageOptions {
  accountAddress?: string
  path?: string
  rns?: IRnsHandler
  setFullSigner?: boolean
}
