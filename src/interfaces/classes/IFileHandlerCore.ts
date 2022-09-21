import IFileConfigRaw from '@/interfaces/IFileConfigRaw'

export default interface IFileHandlerCore {
  fileConfig: IFileConfigRaw
  path: string
  cid: string
  fid: string

  setIds (idObj: {cid: string, fid: string}): void
  getForUpload (): Promise<File>
  getEnc (): Promise<{iv: Uint8Array, key: Uint8Array}>

}
