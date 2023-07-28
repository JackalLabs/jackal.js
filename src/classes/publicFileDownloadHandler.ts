import { IFileDownloadHandler } from '@/interfaces/classes'
import { convertFromPublicFile } from '@/utils/crypt'

export class PublicFileDownloadHandler implements IFileDownloadHandler {
  protected readonly file: File

  /**
   * Receives properties from trackFile() to instantiate PublicFileDownloadHandler.
   * @param {File} file - Downloaded File post-processing
   * @protected
   */
  protected constructor(file: File) {
    this.file = file
  }

  /**
   * Creates PublicFileDownloadHandler instance.
   * @param {Blob} file - Raw file data direct from download source.
   * @returns {Promise<IFileDownloadHandler>} - PublicFileDownloadHandler instance.
   */
  static async trackFile(file: Blob): Promise<IFileDownloadHandler> {
    const decryptedFile: File = await convertFromPublicFile(file)
    return new PublicFileDownloadHandler(decryptedFile)
  }

  /**
   * Returns downloaded file in decrypted state.
   * @returns {File}
   */
  receiveBacon(): File {
    return this.file
  }
}
