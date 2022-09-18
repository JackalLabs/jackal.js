import { OfflineSigner } from '@cosmjs/proto-signing'
import IMiner from '@/interfaces/IMiner'
import IFileHandler from '@/interfaces/classes/IFileHandler'
import IWalletHandler from '@/interfaces/classes/IWalletHandler'
import IFolderDownload from '@/interfaces/IFolderDownload'

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
