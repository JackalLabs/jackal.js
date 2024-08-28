import { IBroadcastOptions } from '@/interfaces'

export interface IShareOptions {
  receiver: string
  paths: string | string[]
  chain?: true
  broadcastOptions?: IBroadcastOptions
}
