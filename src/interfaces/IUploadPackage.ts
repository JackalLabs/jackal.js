import { IAesBundle, IFileMetaHandler } from '@/interfaces'

export interface IUploadPackage {
  file: File
  meta: IFileMetaHandler
  duration: number
  aes?: IAesBundle
}
