import IMiner from '../IMiner'
import IFileDownloadHandler from './IFileDownloadHandler'
import IFolderHandler from './IFolderHandler'
import IFileMeta from '../IFileMeta'
import { TFileOrFFile } from '../../types/TFoldersAndFiles'

export default interface IFileIo {
  shuffle (): Promise<void>
  forceProvider (toSet: IMiner): void

  uploadFiles (toUpload: TFileOrFFile[], owner: string, existingChildren: { [name: string]: IFileMeta }): Promise<void>
  downloadFile (fileAddress: string, owner: string, isFolder: boolean): Promise<IFileDownloadHandler | IFolderHandler>
  generateInitialDirs (startingDirs?: string[]): Promise<void>
}
