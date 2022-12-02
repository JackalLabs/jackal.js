import IMiner from '@/interfaces/IMiner'
import IFileDownloadHandler from '@/interfaces/classes/IFileDownloadHandler'
import IFolderHandler from '@/interfaces/classes/IFolderHandler'
import IFileMeta from '@/interfaces/IFileMeta'
import { TFileOrFFile } from '@/types/TFoldersAndFiles'
import IDeleteItem from '@/interfaces/IDeleteItem'

export default interface IFileIo {
  shuffle (): Promise<void>
  forceProvider (toSet: IMiner): void

  uploadFolders (toUpload: IFolderHandler[], owner: string): Promise<void>
  uploadFiles (toUpload: TFileOrFFile[], owner: string, existingChildren: { [name: string]: IFileMeta }): Promise<void>
  downloadFile (fileAddress: string, owner: string, isFolder: boolean): Promise<IFileDownloadHandler | IFolderHandler>
  deleteTargets (targets: IDeleteItem[], parent: IFolderHandler): Promise<void>
  generateInitialDirs (startingDirs?: string[]): Promise<void>
}
