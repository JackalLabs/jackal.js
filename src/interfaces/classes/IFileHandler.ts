import IFileConfigRaw from '@/interfaces/IFileConfigRaw'
import IFileMeta from '@/interfaces/IFileMeta'

export default interface IFileHandler {
  fileConfig: IFileConfigRaw
  path: string
  cid: string
  fid: string

  getFile (): Promise<File>
  setFile (file: File): void
  getName (): string
  getMetadata (): IFileMeta
  setConfig (config: IFileConfigRaw): void
  setIds (idObj: {cid: string, fid: string}): void
  getForUpload (): Promise<File>
  getEnc (): Promise<{iv: Uint8Array, key: Uint8Array}>

}
