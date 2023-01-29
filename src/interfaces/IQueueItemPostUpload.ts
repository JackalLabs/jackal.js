import { TFileOrFFile } from '@/types/TFoldersAndFiles'
import IFileConfigFull from '@/interfaces/file/IFileConfigFull'

export default interface IQueueItemPostUpload {
  handler: TFileOrFFile,
  data: IFileConfigFull | null
}
