import IMiner from '@/interfaces/IMiner'
import IFileDownloadHandler from '@/interfaces/classes/IFileDownloadHandler'
import IFolderHandler from '@/interfaces/classes/IFolderHandler'
import IFileMeta from '@/interfaces/IFileMeta'
import { TFileOrFFile } from '@/types/TFoldersAndFiles'
import IDeleteItem from '@/interfaces/IDeleteItem'
import { EncodeObject } from '@cosmjs/proto-signing'
import { IFolderAdd } from '@/interfaces'

export default interface IFileIo {
  shuffle (): Promise<void>
  refresh (): Promise<void>
  forceProvider (toSet: IMiner): void

  uploadFolders (toUpload: IFolderAdd, owner: string): Promise<void>
  verifyFoldersExist (toCheck: string[]): Promise<number>
  uploadFiles (toUpload: TFileOrFFile[], owner: string, existingChildren: { [name: string]: IFileMeta }): Promise<void>
  downloadFile (fileAddress: string, owner: string, isFolder: boolean): Promise<IFileDownloadHandler | IFolderHandler>
  deleteTargets (targets: IDeleteItem[], parent: IFolderHandler): Promise<void>
  generateInitialDirs (initMsg: EncodeObject, startingDirs?: string[]): Promise<void>
}
