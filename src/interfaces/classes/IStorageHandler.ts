import type { DDeliverTxResponse } from '@jackallabs/jackal.js-protos'
import {
  IChildMetaDataMap,
  IDownloadTracker,
  IFileMetaData,
  IFileParticulars,
  IFolderMetaData, IProviderIpSet,
  IStagedUploadPackage,
  IStorageStatus,
  IWrappedEncodeObject,
} from '@/interfaces'
import type { TSharedRootMetaDataMap } from '@/types'

export interface IStorageHandler {
  cleanShutdown(): void

  loadDirectory(path?: string): Promise<void>

  loadShared(): Promise<void>

  listChildFolders(): string[]

  listChildFolderMetas(): IFolderMetaData[]

  listChildFiles(): string[]

  listChildFileMetas(): IFileMetaData[]

  upgradeSigner(): Promise<void>

  getAvailableProviders(): Promise<string[]>

  findProviderIps(providers: string[]): Promise<IProviderIpSet>

  loadProviderPool(providers?: IProviderIpSet): Promise<void>

  initStorage(): Promise<any>

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

  readCurrentLocation(): string

  readCurrentUlid(): string

  readChildCount(): number

  readMustConvertStatus(): boolean

  readCurrentQueue(): string[]

  removeFromQueue(name: string): void

  queuePrivate(toQueue: File | File[], duration?: number): Promise<number>

  queuePublic(toQueue: File | File[], duration?: number): Promise<number>

  processAllQueues(): Promise<any>

  getFileParticulars(filePath: string): Promise<IFileParticulars>

  downloadFile(filePath: string, trackers: IDownloadTracker): Promise<File>

  downloadExternalFile(
    userAddress: string,
    filePath: string,
    trackers: IDownloadTracker,
  ): Promise<File>

  deleteTargets(targets: string | string[]): Promise<DDeliverTxResponse>

  share(receiver: string, paths: string | string[]): Promise<DDeliverTxResponse>

  checkNotifications(): Promise<number>

  processPendingNotifications(): Promise<TSharedRootMetaDataMap>

  readSharing(): TSharedRootMetaDataMap

  convert(): Promise<any>

  debug(): IChildMetaDataMap
}
