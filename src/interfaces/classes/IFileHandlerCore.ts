export default interface IFileHandlerCore {
  isFolder: boolean

  setIds (idObj: { cid: string, fid: string[] }): void
  setUUID (uuid: string): void
  getIds (): { fid: string[], cid: string }
  getUUID (): string
  getWhoAmI (): string
  getWhereAmI (): string
  getForUpload (key?: CryptoKey, iv?: Uint8Array): Promise<File>
  getEnc (): Promise<{iv: Uint8Array, key: Uint8Array}>
  getMerklePath (): Promise<string>

}
