import { IFileDownloadHandler } from '@/interfaces/classes'
import { convertFromEncryptedFile } from '@/utils/crypt'

export default class FileDownloadHandler implements IFileDownloadHandler {
  private readonly file: File

  protected constructor(file: File) {
    this.file = file
  }

  static async trackFile(
    file: Blob,
    key: CryptoKey,
    iv: Uint8Array
  ): Promise<IFileDownloadHandler> {
    const decryptedFile: File = await convertFromEncryptedFile(file, key, iv)
    return new FileDownloadHandler(decryptedFile)
  }

  receiveBacon(): File {
    return this.file
  }
}
