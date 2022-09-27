import IMiner from '../IMiner'
import IFileDownloadHandler from './IFileDownloadHandler'
import IWalletHandler from './IWalletHandler'
import IFolderHandler from './IFolderHandler'
import IFileMeta from '../IFileMeta'
import { TFileOrFFile } from '../../types/TFoldersAndFiles'

export default interface IFileIo {
  walletRef: IWalletHandler
  txAddr26657: string
  queryAddr1317: string
  fileTxClient: any
  storageTxClient: any
  availableProviders: IMiner[]
  currentProvider: IMiner

  shuffle (): Promise<void>
  forceProvider (toSet: IMiner): void

  uploadFiles (toUpload: TFileOrFFile[], owner: string, existingChildren: { [name: string]: IFileMeta }): Promise<void>
  downloadFile (fileAddress: string, owner: string, isFolder: boolean): Promise<IFileDownloadHandler | IFolderHandler>
  generateInitialDirs (startingDirs?: string[]): Promise<void>
}
