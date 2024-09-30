import { IBroadcastOptions, IRnsData } from '@/interfaces'

/**
 *
 * @interface IUpdateOptions
 * @property {string} rns - RNS address to update.
 * @property {IRnsData} [data] - Optional object to replace existing contents of data field.
 */
export interface IUpdateOptions {
  rns: string
  data?: IRnsData
  chain?: true
  broadcastOptions?: IBroadcastOptions
}