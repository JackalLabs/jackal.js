import { IAesBundle } from '@/interfaces'
import { IFileUploadHandler } from '@/interfaces/classes'
import {
  genIv,
  genKey,
  convertToEncryptedFile
} from '@/utils/crypt'
import { hexFullPath, merkleMeBro } from '@/utils/hash'
import { IFileMeta } from '@/interfaces'

export default class FileUploadHandler implements IFileUploadHandler {
  private readonly file: File
  private key: CryptoKey
  private iv: Uint8Array
  private readonly parentPath: string
  private uuid: string
  private cid: string
  private fid: string[]
  readonly isFolder: boolean

  private constructor (file: File, parentPath: string, uuid: string, key: CryptoKey, iv: Uint8Array) {
    this.file = file
    this.key = key
    this.iv = iv
    this.parentPath = parentPath
    this.uuid = uuid
    this.cid = ''
    this.fid = []
    this.isFolder = false
  }
  static async trackFile (file: File, parentPath: string): Promise<IFileUploadHandler> {
    const savedKey = await genKey()
    const savedIv = genIv()
    const uuid = self.crypto.randomUUID()
    return new FileUploadHandler(file, parentPath, uuid, savedKey, savedIv)
  }

  setIds (idObj: { cid: string, fid: string[] }): void {
    this.cid = idObj.cid
    this.fid = idObj.fid
  }
  setUUID (uuid: string): void {
    this.uuid = uuid
  }
  getIds () {
    return { fid: this.fid, cid: this.cid }
  }
  getUUID (): string {
    return this.uuid
  }
  getWhoAmI (): string {
    return this.file.name
  }
  getWhereAmI (): string {
    return this.parentPath
  }
  getForUpload (aes?: IAesBundle): Promise<File> {
    this.key = aes?.key || this.key
    this.iv = aes?.iv || this.iv
    return convertToEncryptedFile(this.file, this.key, this.iv)
  }
  async getEnc (): Promise<IAesBundle> {
    return {
      iv: this.iv,
      key: this.key
    }
  }
  async getFullMerkle (): Promise<string> {
    return await hexFullPath(await this.getMerklePath(), this.getWhoAmI())
  }
  getMerklePath (): Promise<string> {
    return merkleMeBro(this.parentPath)
  }
  getMeta (): IFileMeta {
    return {
      name: this.file.name,
      lastModified: this.file.lastModified,
      size: this.file.size,
      type: this.file.type
    }
  }
}
