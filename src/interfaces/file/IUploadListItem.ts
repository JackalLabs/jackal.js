import { TFileOrFFile } from '@/types/TFoldersAndFiles'
import { IFileConfigFull } from '@/interfaces'

export default interface IUploadListItem {
  data: null | IFileConfigFull,
  exists: boolean,
  handler: TFileOrFFile,
  key: string,
  uploadable: File
}
