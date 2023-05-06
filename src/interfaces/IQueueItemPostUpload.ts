import { IFileUploadHandler } from '@/interfaces/classes'
import { IFileConfigRaw } from '@/interfaces/file'

export default interface IQueueItemPostUpload {
  handler: IFileUploadHandler,
  data: IFileConfigRaw | null
}
