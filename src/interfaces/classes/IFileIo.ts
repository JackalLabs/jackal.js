import { EncodeObject } from '@cosmjs/proto-signing'
import { IFileDownloadHandler, IFolderHandler } from '@/interfaces/classes'
import { IDeleteItem, IDownloadDetails, IFolderAdd, IFolderChildFiles, IMiner } from '@/interfaces'
import type { TFileOrFFile } from '@/types/TFoldersAndFiles'

export default interface IFileIo {
  shuffle (): Promise<void>
  refresh (): Promise<void>
  forceProvider (toSet: IMiner): void

  uploadFolders (toUpload: IFolderAdd, owner: string): Promise<void>
  rawUploadFolders (toUpload: IFolderAdd, owner: string): Promise<EncodeObject[]>
  verifyFoldersExist (toCheck: string[]): Promise<number>
  uploadFiles (toUpload: TFileOrFFile[], owner: string, existingChildren: IFolderChildFiles): Promise<void>
  rawUploadFiles (toUpload: TFileOrFFile[], owner: string, existingChildren: IFolderChildFiles): Promise<EncodeObject[]>
  downloadFile (downloadDetails: IDownloadDetails, completion: number): Promise<IFileDownloadHandler | IFolderHandler>
  deleteTargets (targets: IDeleteItem[], parent: IFolderHandler): Promise<void>
  rawDeleteTargets (targets: IDeleteItem[], parent: IFolderHandler): Promise<EncodeObject[]>
  generateInitialDirs (initMsg: EncodeObject, startingDirs?: string[]): Promise<void>
  rawGenerateInitialDirs (initMsg: EncodeObject, startingDirs?: string[]): Promise<EncodeObject[]>
}
