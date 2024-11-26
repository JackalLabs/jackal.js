import type { DMsgFileTreePostFile, DMsgProvisionFileTree, DNotification } from '@jackallabs/jackal.js-protos'
import {
  IAesBundle,
  IChildMetaDataMap,
  IEncodeExistingRefOptions,
  IFileMeta,
  IFileMetaData,
  IFileMetaHandler,
  IFileTreeOptions,
  IFolderMetaData,
  IFolderMetaHandler,
  ILoadRefMetaOptions,
  IMetaDataByUlidOptions,
  INotificationRecord,
  INullRefMetaData,
  INullSharerRefMetaData,
  IReadFolderContentOptions,
  IReconstructedFileTree,
  IRefMetaData,
  IShareMetaData,
  ISharerRefMetaData,
  ISharingLookupOptions,
  IViewerSetAddRemove,
  TSetMetaViewersOptions,
} from '@/interfaces'
import { TConversionPair, TMerkleParentChild, TMetaDataSets } from '@/types'

export interface IFiletreeReader {
  sharersRead (path: string): Promise<string[]>

  sharerRefRead (path: string, sharer: string): Promise<number>

  refCountRead (path: string): Promise<number>

  refCountIncrement (path: string): void

  refCountSet (path: string, value: number): void

  readSharingRefCount (sharer?: string): Promise<[number, number]>

  sharerCountRead (ulid: string): Promise<number>

  sharerCountIncrement (ulid: string): void

  sharerCountSet (ulid: string, value: number): void

  getConversionQueueLength (): number

  getConversions (): Promise<TConversionPair[]>

  sharingLookup (options?: ISharingLookupOptions): Promise<IFolderMetaData[] | IShareMetaData[]>

  readViewerShares (ulid: string, index?: number): string[]

  viewerSave (ulid: string, access: Record<string, string>, index?: number): void

  viewerLookup (ulid: string, index?: number): Promise<Record<string, string>>

  ulidLookup (path: string, owner?: string): string

  findRefIndex (path: string): number

  readFolderContents (path: string, options?: IReadFolderContentOptions): Promise<IChildMetaDataMap>

  loadFolderMetaByPath (path: string): Promise<IFolderMetaData>

  loadFolderMetaByUlid (ulid: string): Promise<IFolderMetaData>

  loadFolderMetaHandler (path: string): Promise<IFolderMetaHandler>

  loadShareMeta (path: string): Promise<IShareMetaData>

  loadRefMeta (options: ILoadRefMetaOptions): Promise<IRefMetaData | INullRefMetaData>

  loadSharerRefMeta (ulid: string, ref: number): Promise<ISharerRefMetaData | INullSharerRefMetaData>

  loadLegacyMeta (
    legacyMerkles: Uint8Array[],
    legacyPath: [string, string],
  ): Promise<IFileMetaData>

  loadMetaByUlid (options: IMetaDataByUlidOptions): Promise<TMetaDataSets>

  loadMetaByPath (path: string): Promise<TMetaDataSets>

  loadMetaByExternalPath (
    path: string,
    ownerAddress: string,
  ): Promise<TMetaDataSets>

  loadMetaByExternalUlid (
    ulid: string,
    ownerAddress: string,
    linkKey?: string,
  ): Promise<TMetaDataSets>

  loadFromLegacyMerkles (
    path: string,
    location: string,
    fileMeta: IFileMeta,
  ): Promise<IFileMetaHandler>

  setMetaViewers (options: TSetMetaViewersOptions): Promise<IReconstructedFileTree>

  setContents (ulid: string, meta: TMetaDataSets): Promise<IReconstructedFileTree>

  loadKeysByPath (path: string, ownerAddress: string): Promise<IAesBundle>

  loadKeysByUlid (ulid: string, ownerAddress: string, linkKey?: string): Promise<IAesBundle>

  livenessCheck (ulid: string, ownerAddress: string): Promise<boolean>

  encodeProvisionFileTree (): Promise<DMsgProvisionFileTree>

  encodePostFile (
    location: TMerkleParentChild,
    meta: TMetaDataSets,
    options?: IFileTreeOptions,
  ): Promise<DMsgFileTreePostFile>

  encodeExistingPostFile (
    ulid: string,
    location: TMerkleParentChild,
    viewers: IViewerSetAddRemove,
  ): Promise<DMsgFileTreePostFile>

  updateExistingPostFile (
    ulid: string,
    location: TMerkleParentChild,
    meta: TMetaDataSets,
  ): Promise<DMsgFileTreePostFile>

  encodeExistingRef (options: IEncodeExistingRefOptions): Promise<DMsgFileTreePostFile>

  protectNotification (receiverAddress: string, aes: IAesBundle): Promise<string>

  readShareNotification (
    notificationData: DNotification,
  ): Promise<INotificationRecord>
}
