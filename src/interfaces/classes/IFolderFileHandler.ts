import IFileConfigRaw from '@/interfaces/IFileConfigRaw'
import IFolderFileFrame from '@/interfaces/IFolderFileFrame'
import IFileMeta from '@/interfaces/IFileMeta'

export default interface IFolderFileHandler {
  fileConfig: IFileConfigRaw
  path: string
  cid: string
  fid: string

  getWhoAmI (): string
  getFolderDetails (): IFolderFileFrame
  getChildDirs (): string[]
  getChildFiles (): {[name: string]: IFileMeta}

  addChildDirs (newDirs: string[]): void
  addChildFiles (newFiles: IFileMeta[]): void
  removeChildDirs (toRemove: string[]): void
  removeChildFiles (toRemove: string[]): void
  getForUpload (): Promise<File>
  getEnc (): Promise<{iv: Uint8Array, key: Uint8Array}>
  setIds (idObj: {cid: string, fid: string}): void


  // getFile (): Promise<File>
  // setFile (file: File): void
  // setConfig (config: IFileConfigRaw): void
  // getForUpload (): Promise<File>

}
