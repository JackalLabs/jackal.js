import { IFileConfigRaw } from '@/interfaces'
import { IFileUploadHandler } from '@/interfaces/classes'

export default interface IUploadListItem {
  data: null | IFileConfigRaw,
  exists: boolean,
  handler: IFileUploadHandler,
  key: string,
  uploadable: File
}
