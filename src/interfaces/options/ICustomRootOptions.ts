import { IBroadcastOptions } from '@/interfaces'

export interface ICustomRootOptions {
  name: string
  chain?: true
  broadcastOptions?: IBroadcastOptions
}
