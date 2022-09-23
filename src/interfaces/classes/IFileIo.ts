import IMiner from '../IMiner'
import IFileHandler from './IFileHandler'
import IWalletHandler from './IWalletHandler'
import IFolderHandler from './IFolderHandler'

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

  uploadFiles (toUpload: IFileHandler[]): Promise<void>
  downloadFile (fileAddress: string, isFolder: boolean): Promise<IFileHandler | IFolderHandler>

}
