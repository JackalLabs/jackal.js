import { OfflineSigner } from '@cosmjs/proto-signing'
import IMiner from '../IMiner'
import IFileHandler from './IFileHandler'
import IWalletHandler from './IWalletHandler'
import IFolderDownload from '../IFolderDownload'

export default interface IFileIo {
  walletRef: OfflineSigner
  txAddr26657: string
  queryAddr1317: string
  fileTxClient: any
  storageTxClient: any
  availableProviders: IMiner[]
  currentProvider: IMiner

  shuffle (): Promise<void>
  forceProvider (toSet: IMiner): void

  uploadFiles (toUpload: IFileHandler[], wallet: IWalletHandler): Promise<void>
  downloadFile (fileAddress: string, wallet: IWalletHandler, isFolder: boolean): Promise<IFileHandler | IFolderDownload>

}
