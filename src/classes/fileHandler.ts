import IFileBuffer from '../interfaces/IFileBuffer'
import IFileConfigRaw from '../interfaces/IFileConfigRaw'
import IFileHandler from '../interfaces/classes/IFileHandler'
import IFileMeta from '../interfaces/IFileMeta'
import {
  exportJackalKey,
  genIv,
  genKey,
  importJackalKey,
  aesCrypt,
  encryptPrep,
  decryptPrep,
  assembleEncryptedFile
} from '../utils/crypt'

export default class FileHandler implements IFileHandler {
  protected baseFile: File | ArrayBuffer
  protected pendUpload: boolean
  protected readonly key: CryptoKey
  protected readonly iv: Uint8Array
  fileConfig: IFileConfigRaw
  path: string
  cid: string
  fid: string

  protected constructor (file: File | ArrayBuffer, mode: boolean, fileConfig: IFileConfigRaw, path: string, key: CryptoKey, iv: Uint8Array) {
    this.baseFile = file
    this.pendUpload = mode
    this.key = key
    this.iv = iv
    this.fileConfig = fileConfig
    this.path = path
    this.cid = ''
    this.fid = ''
  }

  static async trackFile (file: File | ArrayBuffer, fileConfig: IFileConfigRaw, path: string, key?: ArrayBuffer, iv?: ArrayBuffer): Promise<IFileHandler> {
    const pendUpload: boolean = !key
    const savedKey: CryptoKey = (key) ? await importJackalKey(new Uint8Array(key)) : await genKey()
    const savedIv: Uint8Array = new Uint8Array(iv as ArrayBuffer) || genIv()
    return new FileHandler(file, pendUpload, fileConfig, path, savedKey, savedIv)
  }

  async getFile (): Promise<File> {
    if (this.pendUpload) {
      // do nothing
    } else {
      this.baseFile = await this.convertToOriginalFile()
    }
    return this.baseFile as File
  }
  setFile (file: File): void {
    this.baseFile = file
    this.pendUpload = true
  }
  getName (): string {
    return (this.baseFile as File).name
  }
  getMetadata (): IFileMeta {
    const prettyFile = this.baseFile as File
    return {
      name: prettyFile.name,
      lastModified: prettyFile.lastModified,
      type: prettyFile.type,
      size: prettyFile.size,
    }
  }
  setConfig (config: IFileConfigRaw) {
    this.fileConfig = config
  }
  setIds (idObj: {cid: string, fid: string}) {
    this.cid = idObj.cid
    this.fid = idObj.fid
  }
  getForUpload (): Promise<File> {
    if (this.pendUpload) {
      return this.convertToEncryptedFile()
    } else {
      throw new Error('File not in upload-compatible state. Is this a downloaded file?')
    }
  }
  async getEnc (): Promise<{iv: Uint8Array, key: Uint8Array}> {
    return {
      iv: this.iv,
      key: await exportJackalKey(this.key)
    }
  }

  protected async convertToEncryptedFile (): Promise<File> {
    const read = await this.readFile()
    const chunks = encryptPrep(read.content)
    chunks.unshift((new TextEncoder()).encode(JSON.stringify(read.details)).buffer)
    const encChunks: ArrayBuffer[] = await Promise.all(chunks.map((chunk: ArrayBuffer) => aesCrypt(chunk, this.key, this.iv, 'encrypt')))
    return await assembleEncryptedFile(encChunks, read.details.name)
  }
  protected async convertToOriginalFile (): Promise<File> {
    const decChunks: ArrayBuffer[] = await Promise.all(decryptPrep(this.baseFile as ArrayBuffer).map(chunk => aesCrypt(chunk, this.key, this.iv, 'decrypt')))
    const rawMeta = decChunks[0]
    const data = decChunks.slice(1)
    const meta = JSON.parse((new TextDecoder()).decode(rawMeta))
    return new File(data, meta.name, meta)
  }

  protected async readFile (): Promise<IFileBuffer> {
    const workingFile = this.baseFile as File
    const details = {
      lastModified: workingFile.lastModified as number,
      name: workingFile.name,
      type: workingFile.type
    }
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        resolve({
          details,
          content: (reader.result) ? reader.result as ArrayBuffer : new ArrayBuffer(0)
        })
      }
      reader.onerror = reject
      reader.readAsArrayBuffer(workingFile)
    })
  }
}
