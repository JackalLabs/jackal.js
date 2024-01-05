import type { DFile } from '@jackallabs/jackal.js-protos'
import type { IFileMetaData, IFolderMetaData, INullMetaData } from '@/interfaces'
import type { TChildMetaData } from '@/types'

export interface IFileTreeStructure extends Omit<DFile, 'contents'> {
  contents: TChildMetaData
}

export interface IFileTreeReturnedFile extends IFileTreeStructure {
  contents: IFileMetaData
}

export interface IFileTreeReturnedFolder extends IFileTreeStructure {
  contents: IFolderMetaData
}

export interface IFileTreeReturnedNull extends IFileTreeStructure {
  contents: INullMetaData
}
