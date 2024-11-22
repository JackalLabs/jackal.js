import { IBroadcastOptions } from '@/interfaces'

export interface IUnshareOptions {
  receivers: string[]
  paths: string | string[]
  chain?: true
  broadcastOptions?: IBroadcastOptions
}
