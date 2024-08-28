import { IBroadcastOptions } from '@/interfaces'

export interface IDeleteTargetOptions {
  targets: string | string[]
  chain?: true
  broadcastOptions?: IBroadcastOptions
}
