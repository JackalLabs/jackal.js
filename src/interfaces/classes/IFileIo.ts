import { EncodeObject } from '@cosmjs/proto-signing'
import { IFileDownloadHandler, IFolderHandler } from '@/interfaces/classes'
import { IDeleteItem, IDownloadDetails, IFolderAdd, IFolderChildFiles, IMiner, IStaggeredTracker, IUploadList } from '@/interfaces'
import type { TFileOrFFile } from '@/types/TFoldersAndFiles'

export default interface IFileIo {
  getCurrentProvider (): IMiner
  getAvailableProviders (): IMiner[]
  forceProvider (toSet: IMiner): void
  clearProblems (exclude: string): Promise<void>
  shuffle (): Promise<void>
  refresh (): Promise<void>

  createFolders (parentDir: IFolderHandler, newDirs: string[]): Promise<void>
  rawCreateFolders (parentDir: IFolderHandler, newDirs: string[]): Promise<EncodeObject[]>
  verifyFoldersExist (toCheck: string[]): Promise<number>
  staggeredUploadFiles (sourceHashMap: IUploadList, parent: IFolderHandler, tracker: IStaggeredTracker): Promise<void>
  downloadFolder (rawPath: string): Promise<IFolderHandler>
  downloadFile (downloadDetails: IDownloadDetails, completion: { track: number }): Promise<IFileDownloadHandler | IFolderHandler>
  deleteTargets (targets: string[], parent: IFolderHandler): Promise<void>
  rawDeleteTargets (targets: string[], parent: IFolderHandler): Promise<EncodeObject[]>
  generateInitialDirs (initMsg: EncodeObject | null, startingDirs?: string[]): Promise<void>
  rawGenerateInitialDirs (initMsg: EncodeObject | null, startingDirs?: string[]): Promise<EncodeObject[]>
  convertFolderType (rawPath: string): Promise<void>
  rawConvertFolderType (rawPath: string): Promise<EncodeObject[]>
  checkFolderIsFileTree (rawPath: string): Promise<boolean>
}
