import { IFileConfigRelevant } from '@/interfaces'
import { IFileDownloadHandler } from '@/interfaces/classes'
import { aesCrypt, decryptPrep } from '@/utils/crypt'
import { removePadding } from '@/utils/misc'

export default class FileDownloadHandler implements IFileDownloadHandler {
  private readonly file: File
  private readonly fileConfig: IFileConfigRelevant
  private readonly iv: Uint8Array
  private readonly key: CryptoKey

  protected constructor (file: File, fileConfig: IFileConfigRelevant, key: CryptoKey, iv: Uint8Array) {
    this.file = file
    this.key = key
    this.iv = iv
    this.fileConfig = fileConfig
  }

  static async trackFile (file: ArrayBuffer, fileConfig: IFileConfigRelevant, key: CryptoKey, iv: Uint8Array): Promise<IFileDownloadHandler> {
    const decryptedFile: File = await convertToOriginalFile(file, key, iv)
    return new FileDownloadHandler(decryptedFile, fileConfig, key, iv)
  }

  receiveBacon (): File {
    return this.file
  }
}

/** Helpers */
async function convertToOriginalFile (file: ArrayBuffer, key: CryptoKey, iv: Uint8Array): Promise<File> {
  const decChunks: ArrayBuffer[] = await Promise.all(decryptPrep(file).map(async (chunk) => {
    // const preppedChunk = removePadding(chunk)
    // console.log('preppedChunk')
    // console.log(preppedChunk)
    // return aesCrypt(preppedChunk, key, iv, 'decrypt')
    return removePadding(await aesCrypt(chunk, key, iv, 'decrypt'))
  }))
  const rawMeta = decChunks[0]
  const data = decChunks.slice(1)
  const meta = JSON.parse((new TextDecoder()).decode(rawMeta))
  return new File(data, meta.name, meta)
}
