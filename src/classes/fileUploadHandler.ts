import { randomUUID } from 'make-random'

import { IFileBuffer } from '../interfaces'
import { IFileUploadHandler } from '../interfaces/classes'
import {
  exportJackalKey,
  genIv,
  genKey,
  aesCrypt,
  encryptPrep,
  assembleEncryptedFile
} from '../utils/crypt'
import { hexFullPath, merkleMeBro } from '../utils/hash'
import { IFileMeta } from '../interfaces'
import { addPadding } from '../utils/misc'

export default class FileUploadHandler implements IFileUploadHandler {
  private readonly file: File
  private key: CryptoKey
  private iv: Uint8Array
  private readonly parentPath: string
  private uuid: string
  private cid: string
  private fid: string[]

  private constructor (file: File, parentPath: string, uuid: string, key: CryptoKey, iv: Uint8Array) {
    this.file = file
    this.key = key
    this.iv = iv
    this.parentPath = parentPath
    this.uuid = uuid
    this.cid = ''
    this.fid = []
  }
  static async trackFile (file: File, parentPath: string): Promise<IFileUploadHandler> {
    const savedKey = await genKey()
    const savedIv = genIv()
    const uuid = await randomUUID()
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
  getForUpload (key?: CryptoKey, iv?: Uint8Array): Promise<File> {
    this.key = key || this.key
    this.iv = iv || this.iv
    return convertToEncryptedFile(this.file, this.key, this.iv)
  }
  async getEnc (): Promise<{iv: Uint8Array, key: Uint8Array}> {
    return {
      iv: this.iv,
      key: await exportJackalKey(this.key)
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

/** Helpers */
async function convertToEncryptedFile (workingFile: File, key: CryptoKey, iv: Uint8Array): Promise<File> {
  const read = await readFile(workingFile)
  const chunks = encryptPrep(read.content)
  chunks.unshift(addPadding((new TextEncoder()).encode(JSON.stringify(read.details)).buffer))
  const encChunks: ArrayBuffer[] = await Promise.all(chunks.map((chunk: ArrayBuffer) => aesCrypt(chunk, key, iv, 'encrypt')))
  console.log('file')
  console.dir(encChunks)
  return await assembleEncryptedFile(encChunks, read.details.name)
}
async function readFile (workingFile: File): Promise<IFileBuffer> {
  const details = {
    name: workingFile.name,
    lastModified: workingFile.lastModified,
    type: workingFile.type,
    size: workingFile.size,
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
