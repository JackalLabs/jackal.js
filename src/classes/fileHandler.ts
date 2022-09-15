import { encrypt } from 'eciesjs'

import IFileBuffer from '@/interfaces/IFileBuffer'
import IFileConfigRaw from '@/interfaces/IFileConfigRaw'
import IFileHandler from '@/interfaces/classes/IFileHandler'

const keyAlgo = {
  name: 'AES-GCM',
  length: 256
}

export default class FileHandler implements IFileHandler {
  private baseFile: File | ArrayBuffer
  private isUpload: boolean
  private readonly key: CryptoKey
  private readonly iv: Uint8Array
  fileConfig: IFileConfigRaw
  path: string
  cid: string
  fid: string

  private constructor (file: File | ArrayBuffer, mode: boolean, ownerConfig: IFileConfigRaw, path: string, key: CryptoKey, iv: Uint8Array) {
    this.baseFile = file
    this.isUpload = mode
    this.key = key
    this.iv = iv
    this.fileConfig = ownerConfig
    this.path = ''
    this.cid = ''
    this.fid = ''
  }

  static async trackFile (file: File | ArrayBuffer, ownerConfig: IFileConfigRaw, path: string, creatorPubkey: string, key?: Uint8Array, iv?: Uint8Array): Promise<FileHandler> {
    const isUpload: boolean = !key
    const savedKey: CryptoKey = (key) ? await this.importJackalKey(key) : await this.genKey()
    const savedIv: Uint8Array = iv || this.genIv()
    const encryptedKey = (new TextDecoder()).decode(encrypt(creatorPubkey, new Buffer(await FileHandler.exportJackalKey(savedKey))))
    ownerConfig.editors[ownerConfig.creator] = encryptedKey
    ownerConfig.viewers[ownerConfig.creator] = encryptedKey
    return new FileHandler(file, isUpload, ownerConfig, path, savedKey, savedIv)
  }
  private static async exportJackalKey (key: CryptoKey): Promise<Uint8Array> {
    return new Uint8Array(await crypto.subtle.exportKey('raw', key))
  }
  private static importJackalKey (rawExport: Uint8Array): Promise<CryptoKey> {
    const test = Uint8Array.from(Object.values(rawExport))
    return crypto.subtle.importKey('raw', test, 'AES-GCM', true, ['encrypt', 'decrypt'])
  }
  private static genKey (): Promise<CryptoKey> {
    return crypto.subtle.generateKey(keyAlgo, true, ['encrypt', 'decrypt'])
  }
  private static genIv (): Uint8Array {
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
  setConfig (config: IFileConfigRaw) {
    this.fileConfig = config
  }
  setIds (idObj: {cid: string, fid: string}) {
    this.cid = idObj.cid
    this.fid = idObj.fid
  }
  getUpload (): Promise<File> {
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

  private async convertToEncryptedFile (): Promise<File> {
    const read = await this.readFile()
    const chunks = this.encryptPrep(read.content)
    chunks.unshift((new TextEncoder()).encode(JSON.stringify(read.meta)).buffer)
    const encChunks: ArrayBuffer[] = await Promise.all(chunks.map((chunk: ArrayBuffer) => this.aesCrypt(chunk, 'encrypt')))
    return await this.assembleEncryptedFile(encChunks, read.meta.name)
  }
  private async convertToOriginalFile (): Promise<File> {
    const decChunks: ArrayBuffer[] = await Promise.all(this.decryptPrep(this.baseFile as ArrayBuffer).map(chunk => this.aesCrypt(chunk, 'decrypt')))
    const rawMeta = decChunks[0]
    const data = decChunks.slice(1)
    const meta = JSON.parse((new TextDecoder()).decode(rawMeta))
    return new File(data, meta.name, meta)
  }

  private async aesCrypt (data: ArrayBuffer, mode: 'encrypt' | 'decrypt'): Promise<ArrayBuffer> {
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
  private encryptPrep (source: ArrayBuffer): ArrayBuffer[] {
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
  private decryptPrep (source: ArrayBuffer): ArrayBuffer[] {
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
  private async assembleEncryptedFile (parts: ArrayBuffer[], name: string): Promise<File> {
    const staged: ArrayBuffer[] = []
    for (let i = 0; i < parts.length; i++) {
      staged.push(
        (new TextEncoder()).encode(parts[i].byteLength.toString().padStart(8, '0')).buffer,
        parts[i]
      )
    }
    return new File(staged, `${await oneWayString(name)}.jkl`, { type: 'text/plain' })
  }

  private async readFile (): Promise<IFileBuffer> {
    const workingFile = this.baseFile as File
    const meta = {
      lastModified: workingFile.lastModified as number,
      name: workingFile.name,
      type: workingFile.type
    }
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        resolve({
          meta,
          content: (reader.result) ? reader.result as ArrayBuffer : new ArrayBuffer(0)
        })
      }
      reader.onerror = reject
      reader.readAsArrayBuffer(workingFile)
    })
  }

}

async function oneWayString (toHash: string): Promise<string> {
  return crypto.subtle.digest('sha-256', (new TextEncoder()).encode(toHash).buffer)
    .then(buf => (new TextDecoder()).decode(new Uint8Array(buf)))
}
