import { IAesBundle, IFileMeta } from '@/interfaces'
import { IFileUploadHandler } from '@/interfaces/classes'
import { convertToEncryptedFile, genIv, genKey } from '@/utils/crypt'
import { hexFullPath, merkleMeBro } from '@/utils/hash'

export default class FileUploadHandler implements IFileUploadHandler {
  private readonly file: File
  private key: CryptoKey
  private iv: Uint8Array
  private readonly parentPath: string
  private uuid: string
  private cid: string
  private fid: string[]
  readonly isFolder: boolean

  /**
   * Create a FileUploadHandler instance.
   * @param {File} file - File to stage for upload.
   * @param {string} parentPath - Path of folder File will be stored in.
   * @param {string} uuid - Instance UUID.
   * @param {CryptoKey} key - Instance AES key.
   * @param {Uint8Array} iv - Instance AES iv.
   * @private
   */
  private constructor(
    file: File,
    parentPath: string,
    uuid: string,
    key: CryptoKey,
    iv: Uint8Array
  ) {
    this.file = file
    this.key = key
    this.iv = iv
    this.parentPath = parentPath
    this.uuid = uuid
    this.cid = ''
    this.fid = []
    this.isFolder = false
  }

  /**
   * Async wrapper to create a FileUploadHandler instance from a File.
   * @param {File} file - File to stage for uploading.
   * @param {string} parentPath - Path of folder File will be stored in.
   * @returns {Promise<IFileUploadHandler>}
   */
  static async trackFile(
    file: File,
    parentPath: string
  ): Promise<IFileUploadHandler> {
    const savedKey = await genKey()
    const savedIv = genIv()
    const uuid = crypto.randomUUID()
    return new FileUploadHandler(file, parentPath, uuid, savedKey, savedIv)
  }

  /**
   * Update instance CID(s) and FID(s).
   * @param {{cid: string, fid: string[]}} idObj - New CID(s) and FID(s).
   */
  setIds(idObj: { cid: string; fid: string[] }): void {
    this.cid = idObj.cid
    this.fid = idObj.fid
  }

  /**
   * Update instance UUID.
   * @param {string} uuid - New UUID.
   */
  setUUID(uuid: string): void {
    this.uuid = uuid
  }

  /**
   * Get instance CID(s) and FID(s).
   * @returns {{fid: string[], cid: string}}
   */
  getIds() {
    return { fid: this.fid, cid: this.cid }
  }

  /**
   * Get instance UUID.
   * @returns {string}
   */
  getUUID(): string {
    return this.uuid
  }

  /**
   * Get name of the File.
   * @returns {string}
   */
  getWhoAmI(): string {
    return this.file.name
  }

  /**
   * Get path of parent folder.
   * @returns {string}
   */
  getWhereAmI(): string {
    return this.parentPath
  }

  /**
   * Convert staged File to encrypted File for upload.
   * @param {IAesBundle} aes - Bundle of encryption details. (Optional)
   * @returns {Promise<File>}
   */
  getForUpload(aes?: IAesBundle): Promise<File> {
    this.key = aes?.key || this.key
    this.iv = aes?.iv || this.iv
    return convertToEncryptedFile(this.file, this.key, this.iv)
  }

  /**
   * Provide staged File for upload without encryption.
   * @returns {File}
   */
  getForPublicUpload(): File {
    return this.file
  }

  /**
   * Get instance encryption details.
   * @returns {Promise<IAesBundle>}
   */
  async getEnc(): Promise<IAesBundle> {
    return {
      iv: this.iv,
      key: this.key
    }
  }

  /**
   * Get full merkle string of path to File.
   * @returns {Promise<string>}
   */
  async getFullMerkle(): Promise<string> {
    return await hexFullPath(await this.getMerklePath(), this.getWhoAmI())
  }

  /**
   * Get full merkle string of path to parent folder.
   * @returns {Promise<string>}
   */
  getMerklePath(): Promise<string> {
    return merkleMeBro(this.parentPath)
  }

  /**
   * Get File metadata.
   * @returns {IFileMeta}
   */
  getMeta(): IFileMeta {
    return {
      name: this.file.name,
      lastModified: this.file.lastModified,
      size: this.file.size,
      type: this.file.type
    }
  }
}
