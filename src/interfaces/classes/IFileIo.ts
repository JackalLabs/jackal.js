import { EncodeObject } from '@cosmjs/proto-signing'
import { IFileDownloadHandler, IFolderHandler } from '@/interfaces/classes'
import { IDeleteItem, IFolderAdd, IFolderChildFiles, IMiner } from '@/interfaces'
import type { TFileOrFFile } from '@/types/TFoldersAndFiles'

export default interface IFileIo {
  shuffle (): Promise<void>
  refresh (): Promise<void>
  forceProvider (toSet: IMiner): void

  uploadFolders (toUpload: IFolderAdd, owner: string): Promise<void>
  verifyFoldersExist (toCheck: string[]): Promise<number>
  uploadFiles (toUpload: TFileOrFFile[], owner: string, existingChildren: IFolderChildFiles): Promise<void>
  downloadFile (fileAddress: string, owner: string, isFolder: boolean): Promise<IFileDownloadHandler | IFolderHandler>
  deleteTargets (targets: IDeleteItem[], parent: IFolderHandler): Promise<void>
  generateInitialDirs (initMsg: EncodeObject, startingDirs?: string[]): Promise<void>
}
