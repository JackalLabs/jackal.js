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
  INotificationRecord, INullRefMetaData,
  IReadFolderContentOptions,
  IReconstructedFileTree,
  IRefMetaData,
  ISharedMetaDataMap,
  IShareFolderMetaData,
  IShareMetaData,
} from '@/interfaces'
import type { TMerkleParentChild, TMetaDataSets } from '@/types'

export interface IFiletreeReader {
  ulidLookup (path: string, owner?: string): string

  findRefIndex (path: string): number

  readFolderContents (path: string, options?: IReadFolderContentOptions): Promise<IChildMetaDataMap>

  loadFolderMetaByPath (path: string): Promise<IFolderMetaData>

  loadFolderMetaByUlid (ulid: string): Promise<IFolderMetaData>

  loadFolderMetaHandler (path: string): Promise<IFolderMetaHandler>

  loadShareFolderMeta (path: string): Promise<IShareFolderMetaData>

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

  setMetaViewers (
    path: string,
    additionalViewers: string[],
  ): Promise<IReconstructedFileTree>

  loadKeysByPath (path: string, ownerAddress: string): Promise<IAesBundle>

  loadKeysByUlid (ulid: string, ownerAddress: string): Promise<IAesBundle>

  encodeProvisionFileTree (): Promise<DMsgProvisionFileTree>

  encodePostFile (
    location: TMerkleParentChild,
    meta: TMetaDataSets,
    options?: IFileTreeOptions,
  ): Promise<DMsgFileTreePostFile>

  encodeExistingPostFile (
    path: string,
    location: TMerkleParentChild,
    additionalViewers: string[],
  ): Promise<DMsgFileTreePostFile>

  protectNotification (receiverAddress: string, aes: IAesBundle): Promise<string>

  readShareNotification (
    notificationData: DNotification,
  ): Promise<INotificationRecord>

  loadSharingFolder (ulid: string): Promise<ISharedMetaDataMap>
}
