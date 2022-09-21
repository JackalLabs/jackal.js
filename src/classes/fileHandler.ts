import { hashAndHex } from '@/utils/hash'
import { keyAlgo } from '@/utils/globals'
import IFileBuffer from '@/interfaces/IFileBuffer'
import IFileConfigRaw from '@/interfaces/IFileConfigRaw'
import IFileHandler from '@/interfaces/classes/IFileHandler'
import IFileMeta from '@/interfaces/IFileMeta'

export default class FileHandler implements IFileHandler {
  protected baseFile: File | ArrayBuffer
  protected isUpload: boolean
  protected readonly key: CryptoKey
  protected readonly iv: Uint8Array
  fileConfig: IFileConfigRaw
  path: string
  cid: string
  fid: string

  protected constructor (file: File | ArrayBuffer, mode: boolean, fileConfig: IFileConfigRaw, path: string, key: CryptoKey, iv: Uint8Array) {
    this.baseFile = file
    this.isUpload = mode
    this.key = key
    this.iv = iv
    this.fileConfig = fileConfig
    this.path = path
    this.cid = ''
    this.fid = ''
  }

  static async trackFile (file: File | ArrayBuffer, fileConfig: IFileConfigRaw, path: string, key?: ArrayBuffer, iv?: ArrayBuffer): Promise<IFileHandler> {
    const pendUpload: boolean = !key
    const savedKey: CryptoKey = (key) ? await this.importJackalKey(new Uint8Array(key)) : await this.genKey()
    const savedIv: Uint8Array = new Uint8Array(iv as ArrayBuffer) || this.genIv()
    return new FileHandler(file, pendUpload, fileConfig, path, savedKey, savedIv)
  }
  protected static async exportJackalKey (key: CryptoKey): Promise<Uint8Array> {
    return new Uint8Array(await crypto.subtle.exportKey('raw', key))
  }
  protected static importJackalKey (rawExport: Uint8Array): Promise<CryptoKey> {
    return crypto.subtle.importKey('raw', rawExport, 'AES-GCM', true, ['encrypt', 'decrypt'])
  }
  protected static genKey (): Promise<CryptoKey> {
    return crypto.subtle.generateKey(keyAlgo, true, ['encrypt', 'decrypt'])
  }
  protected static genIv (): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(16))
  }

  async getFile (): Promise<File> {
    if (this.isUpload) {
      return this.baseFile as File
    } else {
      return this.convertToOriginalFile()
    }
  }
  setFile (file: File): void {
    this.baseFile = file
    this.isUpload = true
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
    if (this.isUpload) {
      return this.convertToEncryptedFile()
    } else {
      throw new Error('File not in upload-compatible state. Is this a downloaded file?')
    }
  }
  async getEnc (): Promise<{iv: Uint8Array, key: Uint8Array}> {
    return {
      iv: this.iv,
      key: await FileHandler.exportJackalKey(this.key)
    }
  }

  protected async convertToEncryptedFile (): Promise<File> {
    const read = await this.readFile()
    const chunks = this.encryptPrep(read.content)
    chunks.unshift((new TextEncoder()).encode(JSON.stringify(read.details)).buffer)
    const encChunks: ArrayBuffer[] = await Promise.all(chunks.map((chunk: ArrayBuffer) => this.aesCrypt(chunk, 'encrypt')))
    return await this.assembleEncryptedFile(encChunks, read.details.name)
  }
  protected async convertToOriginalFile (): Promise<File> {
    const decChunks: ArrayBuffer[] = await Promise.all(this.decryptPrep(this.baseFile as ArrayBuffer).map(chunk => this.aesCrypt(chunk, 'decrypt')))
    const rawMeta = decChunks[0]
    const data = decChunks.slice(1)
    const meta = JSON.parse((new TextDecoder()).decode(rawMeta))
    return new File(data, meta.name, meta)
  }

  protected async aesCrypt (data: ArrayBuffer, mode: 'encrypt' | 'decrypt'): Promise<ArrayBuffer> {
    const algo = {
      name: 'AES-GCM',
      iv: this.iv
    }
    if (data.byteLength < 1) {
      return new ArrayBuffer(0)
    } else if (mode?.toLowerCase() === 'encrypt') {
      return await crypto.subtle.encrypt(algo, this.key, data)
        .catch(err => {
          throw new Error(err)
        })
    } else {
      return await crypto.subtle.decrypt(algo, this.key, data)
        .catch(err => {
          throw new Error(err)
        })
    }
  }
  protected encryptPrep (source: ArrayBuffer): ArrayBuffer[] {
    const chunkSize = 33554432 /** in bytes */
    const len = source.byteLength
    const count = Math.ceil(len / chunkSize)

    if (count === 1) {
      return [source]
    } else {
      const ret = []
      for (let i = 0; i < count; i++) {
        const startIndex = i * chunkSize
        const endIndex = (i + 1) * chunkSize
        ret.push(source.slice(startIndex, endIndex))
      }
      return ret
    }
  }
  protected decryptPrep (source: ArrayBuffer): ArrayBuffer[] {
    const parts: ArrayBuffer[] = []
    for (let i = 0; i + 1 < source.byteLength;) {
      const offset = i + 8
      const segSize = Number((new TextDecoder()).decode(source.slice(i, offset)))
      const last = offset + segSize
      const segment = source.slice(offset, last)
      parts.push(segment)
      i = last
    }
    return parts
  }
  protected async assembleEncryptedFile (parts: ArrayBuffer[], name: string): Promise<File> {
    const staged: ArrayBuffer[] = []
    for (let i = 0; i < parts.length; i++) {
      staged.push(
        (new TextEncoder()).encode(parts[i].byteLength.toString().padStart(8, '0')).buffer,
        parts[i]
      )
    }
    return new File(staged, `${await hashAndHex(name + Date.now().toString())}.jkl`, { type: 'text/plain' })
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
