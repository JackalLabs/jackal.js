import type { DDeliverTxResponse } from '@jackallabs/jackal.js-protos'
import type {
  IChildMetaDataMap,
  IDownloadTracker,
  IFileMeta, IFileMetaData,
  IProviderUploadResponse,
  IStagedUploadPackage,
  IStorageStatus,
  IWrappedEncodeObject,
} from '@/interfaces'
import type { TSharedRootMetaDataMap } from '@/types'

export interface IStorageHandler {
  cleanShutdown(): void

  initStorage(): Promise<any>

  initStorageCustom(name: string, mod?: number): Promise<DDeliverTxResponse>

  planStatus(): Promise<IStorageStatus>

  buyMyStoragePlan(gb: number, days?: number): Promise<any>

  buyOthersStoragePlan(
    receiver: string,
    gb: number,
    days?: number,
  ): Promise<any>

  createFolders(names: string | string[]): Promise<DDeliverTxResponse>

  saveFolder(bundle: IStagedUploadPackage): Promise<IWrappedEncodeObject[]>

  readActivePath(): string

  readChildCount(): number

  readMustConvertStatus(): boolean

  readCurrentQueue(): string[]

  removeFromQueue(name: string): void

  changeActiveDirectory(path: string): Promise<string>

  listChildFolders(): string[]

  listChildFileMeta(): IFileMeta[]
  listChildFiles(): IFileMetaData[]

  queuePrivate(toQueue: File | File[], duration?: number): Promise<number>

  queuePublic(toQueue: File | File[], duration?: number): Promise<number>

  uploadFile(
    url: string,
    startBlock: number,
    file: File,
    merkle: string,
  ): Promise<IProviderUploadResponse>

  downloadFile(filePath: string, trackers: IDownloadTracker): Promise<File>

  downloadExternalFile(
    userAddress: string,
    filePath: string,
    trackers: IDownloadTracker,
  ): Promise<File>

  processAllQueues(): Promise<any>

  deleteTargets(targets: string | string[]): Promise<DDeliverTxResponse>

  debug(): IChildMetaDataMap

  share(receiver: string, paths: string | string[]): Promise<DDeliverTxResponse>

  checkNotifications(): Promise<number>

  processPendingNotifications(): Promise<TSharedRootMetaDataMap>

  readSharing(): TSharedRootMetaDataMap

  refreshSharing(): Promise<TSharedRootMetaDataMap>

  convert(): Promise<any>
}
