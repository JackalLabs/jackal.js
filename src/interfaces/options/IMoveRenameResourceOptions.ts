import { IBroadcastOptions } from '@/interfaces'

export interface IMoveRenameResourceOptions {
  start: string
  finish: string
  chain?: true
  broadcastOptions?: IBroadcastOptions
}
