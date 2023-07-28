import { IFileDownloadHandler } from '@/interfaces/classes'
import { convertFromEncryptedFile } from '@/utils/crypt'
import { PrivateFileDownloadHandler } from '@/classes/privateFileDownloadHandler'
import { deprecated } from '@/utils/misc'

export default class FileDownloadHandler extends PrivateFileDownloadHandler implements IFileDownloadHandler {
  protected constructor(file: File) {
    super(file)
  }

  /**
   * Creates FileDownloadHandler instance.
   * @param {Blob} file - Raw file data direct from download source.
   * @param {CryptoKey} key - AES-256 CryptoKey.
   * @param {Uint8Array} iv - AES-256 iv.
   * @returns {Promise<IFileDownloadHandler>} - FileDownloadHandler instance.
   */
  static async trackFile(
    file: Blob,
    key: CryptoKey,
    iv: Uint8Array
  ): Promise<IFileDownloadHandler> {
    deprecated('FileDownloadHandler', '2.0.7', { replacement: 'PrivateFileDownloadHandler' })
    const decryptedFile: File = await convertFromEncryptedFile(file, key, iv)
    return new FileDownloadHandler(decryptedFile)
  }
}
