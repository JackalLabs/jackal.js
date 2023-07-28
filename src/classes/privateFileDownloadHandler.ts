import { IFileDownloadHandler } from '@/interfaces/classes'
import { convertFromEncryptedFile } from '@/utils/crypt'

export class PrivateFileDownloadHandler implements IFileDownloadHandler {
  protected readonly file: File

  /**
   * Receives properties from trackFile() to instantiate PrivateFileDownloadHandler.
   * @param {File} file - Downloaded File post-processing
   * @protected
   */
  protected constructor(file: File) {
    this.file = file
  }

  /**
   * Creates PrivateFileDownloadHandler instance.
   * @param {Blob} file - Raw file data direct from download source.
   * @param {CryptoKey} key - AES-256 CryptoKey.
   * @param {Uint8Array} iv - AES-256 iv.
   * @returns {Promise<IFileDownloadHandler>} - PrivateFileDownloadHandler instance.
   */
  static async trackFile(
    file: Blob,
    key: CryptoKey,
    iv: Uint8Array
  ): Promise<IFileDownloadHandler> {
    const decryptedFile: File = await convertFromEncryptedFile(file, key, iv)
    return new PrivateFileDownloadHandler(decryptedFile)
  }

  /**
   * Returns downloaded file in decrypted state.
   * @returns {File}
   */
  receiveBacon(): File {
    return this.file
  }
}
