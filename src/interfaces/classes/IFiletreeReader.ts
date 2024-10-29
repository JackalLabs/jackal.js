import type { DMsgFileTreePostFile, DMsgProvisionFileTree, DNotification } from '@jackallabs/jackal.js-protos'
import {
  IAesBundle,
  IChildMetaDataMap,
  IFileMeta,
  IFileMetaData,
  IFileMetaHandler,
  IFileTreeOptions,
  IFolderMetaData,
  IFolderMetaHandler,
  INotificationRecord,
  INullRefMetaData,
  IReadFolderContentOptions,
  IReconstructedFileTree,
  IRefMetaData,
  IShareMetaData,
  IViewerSetAddRemove,
  TSetMetaViewersOptions,
} from '@/interfaces'
import { TConversionPair, TMerkleParentChild, TMetaDataSets } from '@/types'

export interface IFiletreeReader {
  refCountRead (path: string): Promise<number>

  refCountIncrement (path: string): void

  refCountSet (path: string, value: number): void

  sharerCountRead (ulid: string): Promise<number>

  sharerCountIncrement (ulid: string): void

  sharerCountSet (ulid: string, value: number): void

  readSharingRefCount (sharer?: string): Promise<[number, number]>

  getConversionQueueLength (): number

  getConversions (): Promise<TConversionPair[]>

  sharingLookup (sharer?: string): string[]

  viewerSave (ulid: string, access: Record<string, string>): void

  viewerLookup (ulid: string): Promise<Record<string, string>>

  ulidLookup (path: string, owner?: string): string

  findRefIndex (path: string): number

  readFolderContents (path: string, options?: IReadFolderContentOptions): Promise<IChildMetaDataMap>

  loadFolderMetaByPath (path: string): Promise<IFolderMetaData>

  loadFolderMetaByUlid (ulid: string): Promise<IFolderMetaData>

  loadFolderMetaHandler (path: string): Promise<IFolderMetaHandler>

  loadShareMeta (path: string): Promise<IShareMetaData>

  loadRefMeta (ulid: string, ref: number): Promise<IRefMetaData | INullRefMetaData>

  loadLegacyMeta (
    legacyMerkles: Uint8Array[],
    legacyPath: [string, string],
  ): Promise<IFileMetaData>

  loadMetaByUlid (ulid: string): Promise<TMetaDataSets>

  loadMetaByPath (path: string): Promise<TMetaDataSets>

  loadMetaByExternalPath (
    path: string,
    ownerAddress: string,
  ): Promise<TMetaDataSets>

  loadFromLegacyMerkles (
    path: string,
    location: string,
    fileMeta: IFileMeta,
  ): Promise<IFileMetaHandler>

  setMetaViewers (options: TSetMetaViewersOptions): Promise<IReconstructedFileTree>

  loadKeysByPath (path: string, ownerAddress: string): Promise<IAesBundle>

  loadKeysByUlid (ulid: string, ownerAddress: string): Promise<IAesBundle>

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

  protectNotification (receiverAddress: string, aes: IAesBundle): Promise<string>

  readShareNotification (
    notificationData: DNotification,
  ): Promise<INotificationRecord>
}
