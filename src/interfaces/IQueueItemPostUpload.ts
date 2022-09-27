import { TFileOrFFile } from '../types/TFoldersAndFiles'
import IFileConfigFull from './IFileConfigFull'

export default interface IQueueItemPostUpload {
  handler: TFileOrFFile,
  data: IFileConfigFull | undefined
}
