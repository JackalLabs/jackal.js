import { IChildMetaDataMap, IMetaHandler, IUploadPackage } from '@/interfaces'

export interface IStagedUploadPackage {
  children: IChildMetaDataMap
  folderMeta: IMetaHandler
  queue: IUploadPackage[]
}
