import { IDownloadTracker, IFileParticulars } from '@/interfaces'

export interface IDownloadStagingOptionsWithPath {
  particulars: IFileParticulars
  provider: string
  trackers: IDownloadTracker
  userAddress: string
  filePath: string
}

export interface IDownloadStagingOptionsWithUlid {
  particulars: IFileParticulars
  provider: string
  trackers: IDownloadTracker
  userAddress: string
  ulid: string
  linkKey?: string
}

export type TDownloadStagingOptions = IDownloadStagingOptionsWithPath | IDownloadStagingOptionsWithUlid
