import { IFileMetaData, IFolderMetaData } from '@/interfaces'

export interface IMoveRenameTarget {
  name: string
  ref: number
  location?: string
  folder?: IFolderMetaData
  file?: IFileMetaData
}