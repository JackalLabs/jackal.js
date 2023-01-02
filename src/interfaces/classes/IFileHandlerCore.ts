import { IAesBundle } from '@/interfaces'

export default interface IFileHandlerCore {
  isFolder: boolean

  setIds (idObj: { cid: string, fid: string[] }): void
  setUUID (uuid: string): void
  getIds (): { fid: string[], cid: string }
  getUUID (): string
  getWhoAmI (): string
  getWhereAmI (): string
  getForUpload (aes?: IAesBundle): Promise<File>
  getEnc (): Promise<IAesBundle>
  getMerklePath (): Promise<string>

}
