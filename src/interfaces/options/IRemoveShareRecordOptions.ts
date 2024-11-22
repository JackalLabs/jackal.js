import { IBroadcastOptions, IShareMetaData } from '@/interfaces'

/**
 *
 * @interface IRemoveShareRecordOptions
 * @property {IShareMetaData} record - Share meta data to remove.
 */
export interface IRemoveShareRecordOptions {
  record: IShareMetaData
  chain?: true
  broadcastOptions?: IBroadcastOptions
}
