import { IFileMeta, IFileMetaHashMap, IFolderFileFrame } from '@/interfaces'
import { IWalletHandler } from '@/interfaces/classes/index'
import { EncodeObject } from '@cosmjs/proto-signing'

export default interface IFolderHandler {
  isFolder: boolean

  getWhoAmI (): string
  getWhereAmI (): string
  getWhoOwnsMe (): string
  getFolderDetails (): IFolderFileFrame
  getChildDirs (): string[]
  getChildFiles (): { [name: string]: IFileMeta }
  getForFiletree (walletRef: IWalletHandler): Promise<EncodeObject>
  getChildMerkle (child: string): Promise<string>

  addChildDirs (childNames: string[], walletRef: IWalletHandler): Promise<EncodeObject[]>
  addChildFiles (newFiles: IFileMetaHashMap, walletRef: IWalletHandler): Promise<EncodeObject>
  removeChildDirs (toRemove: string[], walletRef: IWalletHandler): Promise<EncodeObject>
  removeChildFiles (toRemove: string[], walletRef: IWalletHandler): Promise<EncodeObject>
  removeChildDirsAndFiles (dirs: string[], files: string[], walletRef: IWalletHandler): Promise<EncodeObject>
}
