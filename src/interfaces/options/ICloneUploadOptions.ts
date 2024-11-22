import type { IBroadcastOptions, IFileMetaData } from '@/interfaces'

/**
 *
 * @interface ICloneUploadOptions
 * @property {IFileMetaData | IFileMetaData[]} targets - Shared File metas to clone from.
 * @property {string} destination - Folder to copy files into.
 * @property {string} sharer - Bech32 wallet address of source of targets.
 */
export interface ICloneUploadOptions {
  targets: IFileMetaData | IFileMetaData[]
  destination: string
  sharer: string
  chain?: true
  broadcastOptions?: IBroadcastOptions
}
