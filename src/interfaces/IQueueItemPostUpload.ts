import { TFileOrFFile } from '@/types/TFoldersAndFiles'
import IFileConfigFull from '@/interfaces/file/IFileConfigFull'
import { IFileUploadHandler } from '@/interfaces/classes'

export default interface IQueueItemPostUpload {
  handler: IFileUploadHandler
  data: IFileConfigFull | null
}
