import IMiner from '../IMiner'
import IFileDownloadHandler from './IFileDownloadHandler'
import IFolderHandler from './IFolderHandler'
import IFileMeta from '../IFileMeta'
import { TFileOrFFile } from '../../types/TFoldersAndFiles'
import IDeleteItem from '../IDeleteItem'

export default interface IFileIo {
  shuffle (): Promise<void>
  forceProvider (toSet: IMiner): void

  uploadFiles (toUpload: TFileOrFFile[], owner: string, existingChildren: { [name: string]: IFileMeta }): Promise<void>
  downloadFile (fileAddress: string, owner: string, isFolder: boolean): Promise<IFileDownloadHandler | IFolderHandler>
  deleteTargets (targets: IDeleteItem[]): Promise<void>
  generateInitialDirs (startingDirs?: string[]): Promise<void>
}
