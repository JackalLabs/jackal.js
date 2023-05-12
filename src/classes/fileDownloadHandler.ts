import { IFileConfigRelevant } from '@/interfaces'
import { IFileDownloadHandler } from '@/interfaces/classes'
import { convertFromEncryptedFile } from '@/utils/crypt'

export default class FileDownloadHandler implements IFileDownloadHandler {
  private readonly file: File
  private readonly fileConfig: IFileConfigRelevant
  private readonly iv: Uint8Array
  private readonly key: CryptoKey

  protected constructor(
    file: File,
    fileConfig: IFileConfigRelevant,
    key: CryptoKey,
    iv: Uint8Array
  ) {
    this.file = file
    this.key = key
    this.iv = iv
    this.fileConfig = fileConfig
  }

  static async trackFile(
    file: Blob,
    fileConfig: IFileConfigRelevant,
    key: CryptoKey,
    iv: Uint8Array
  ): Promise<IFileDownloadHandler> {
    const decryptedFile: File = await convertFromEncryptedFile(file, key, iv)
    return new FileDownloadHandler(decryptedFile, fileConfig, key, iv)
  }

  receiveBacon(): File {
    return this.file
  }
}
