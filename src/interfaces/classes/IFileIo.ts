import { OfflineSigner } from '@cosmjs/proto-signing'
import { Miners } from '@/protos/storage/types/storage/miners'
import { Api } from '@/protos/storage/rest'
import IFileHandler from '@/interfaces/classes/IFileHandler'
import IWalletHandler from '@/interfaces/classes/IWalletHandler'
import IFolderDownload from '@/interfaces/IFolderDownload'

export default interface IFileIo {

  walletRef: OfflineSigner
  txAddr26657: string
  queryAddr1317: string
  fileTxClient: any
  storageTxClient: any
  availableProviders: Miners[]
  currentProvider: Miners

  shuffle (): Promise<void>
  forceProvider (toSet: Miners): void

  uploadFiles (toUpload: IFileHandler[], wallet: IWalletHandler): Promise<void>
  downloadFile (fileAddress: string, wallet: IWalletHandler, isFolder: boolean): Promise<IFileHandler | IFolderDownload>
}
