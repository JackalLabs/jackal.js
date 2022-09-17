import IFileConfigRaw from '@/interfaces/IFileConfigRaw'

export default interface IFolderFileHandler {
  fileConfig: IFileConfigRaw
  path: string
  cid: string
  fid: string

  getFile (): Promise<File>
  setFile (file: File): void
  setConfig (config: IFileConfigRaw): void
  setIds (idObj: {cid: string, fid: string}): void
  getForUpload (): Promise<File>
  getEnc (): Promise<{iv: Uint8Array, key: Uint8Array}>

}