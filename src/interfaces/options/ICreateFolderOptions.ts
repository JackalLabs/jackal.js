import { IBroadcastOptions } from '@/interfaces'

export interface ICreateFolderOptions {
  names: string | string[]
  chain?: true
  broadcastOptions?: IBroadcastOptions
}
