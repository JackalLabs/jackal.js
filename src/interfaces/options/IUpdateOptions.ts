import { IBroadcastOptions, INoCloneRnsMetaDataSource } from '@/interfaces'

/**
 *
 * @interface IUpdateOptions
 * @property {string} rns - RNS address to update.
 * @property {INoCloneRnsMetaDataSource} [data] - Optional object to replace existing contents of data field.
 */
export interface IUpdateOptions {
  rns: string
  data?: INoCloneRnsMetaDataSource
  chain?: true
  broadcastOptions?: IBroadcastOptions
}
