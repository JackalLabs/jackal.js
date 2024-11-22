import { IDownloadTracker } from '@/interfaces'

/**
 *
 * @interface IDownloadByUlidOptions
 * @property {IDownloadTracker} trackers
 * @property {string} ulid
 * @property {string} userAddress
 * @property {string} [linkKey]
 */
export interface IDownloadByUlidOptions {
  trackers: IDownloadTracker
  ulid: string
  userAddress: string
  linkKey?: string
}
