import { IChildMetaDataMap, IFolderMetaHandler, IUploadPackage } from '@/interfaces'

export interface IStagedUploadPackage {
  children: IChildMetaDataMap
  folderMeta: IFolderMetaHandler
  queue: IUploadPackage[]
}
