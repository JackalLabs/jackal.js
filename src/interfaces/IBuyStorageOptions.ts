import { IBroadcastOptions } from '@/interfaces'

export interface IBuyStorageOptions {
  gb: number
  days?: number
  receiver?: string
  referrer?: string
  chain?: true
  broadcastOptions?: IBroadcastOptions
}
