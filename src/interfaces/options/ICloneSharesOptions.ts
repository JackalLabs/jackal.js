import type { IBroadcastOptions, IShareMetaData } from '@/interfaces'

/**
 *
 * @interface ICloneSharesOptions
 * @property {IShareMetaData | IShareMetaData[]} targets - Shared File metas to clone from.
 * @property {string} destination - Folder to copy files into.
 */
export interface ICloneSharesOptions {
  targets: IShareMetaData | IShareMetaData[]
  destination: string
  chain?: true
  broadcastOptions?: IBroadcastOptions
}
