import { IFileConfigFull } from '@/interfaces'
import { IFileUploadHandler } from '@/interfaces/classes'

export default interface IUploadListItem {
  data: null | IFileConfigFull
  exists: boolean
  handler: IFileUploadHandler
  key: string
  uploadable: File
}
