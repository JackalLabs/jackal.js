import type { DDeliverTxResponse } from '@jackallabs/jackal.js-protos'
import type {
  IChildMetaDataMap,
  IDownloadTracker,
  IFileMetaData,
  IProviderUploadResponse,
  IStagedUploadPackage,
  IWrappedEncodeObject,
} from '@/interfaces'

export interface IStorageHandler {
  cleanShutdown(): void

  initStorage(mod?: number): Promise<DDeliverTxResponse>
  buyStoragePlan(gb: number, days?: number): Promise<DDeliverTxResponse>
  saveFolder(bundle: IStagedUploadPackage): Promise<IWrappedEncodeObject[]>

  readActivePath(): string
  changeActiveDirectory(path: string): Promise<string>
  queuePrivate(toQueue: File | File[], duration?: number): Promise<number>
  queuePublic(toQueue: File | File[], duration?: number): Promise<number>
  uploadFile(
    url: string,
    startBlock: number,
    file: File,
    merkle: string,
  ): Promise<IProviderUploadResponse>
  downloadFile(
    fileDetails: IFileMetaData,
    trackers: IDownloadTracker,
  ): Promise<File>

  processAllQueues(): Promise<DDeliverTxResponse>
  debug(): IChildMetaDataMap
}
