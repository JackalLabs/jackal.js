import { EncodeObject } from '@cosmjs/proto-signing'
import {
  IChildDirInfo,
  IFileMeta,
  IFileMetaHashMap,
  IFolderFrame
} from '@/interfaces'
import { IFolderHandler, IWalletHandler } from '@/interfaces/classes'
import { signerNotEnabled, stripper } from '@/utils/misc'
import { merkleMeBro } from '@/utils/hash'
import { saveFileTreeEntry } from '@/utils/compression'
import { convertFromEncryptedFile } from '@/utils/crypt'

export default class FolderHandler implements IFolderHandler {
  private readonly folderDetails: IFolderFrame
  readonly isFolder: boolean

  /**
   * Create a FolderHandler instance.
   * @param {IFolderFileFrame} folderDetails - Folder metadata.
   * @private
   */
  private constructor(folderDetails: IFolderFrame) {
    this.folderDetails = folderDetails
    this.isFolder = true
  }

  /**
   * Async wrapper to create a FolderHandler instance from a FileTree source.
   * @param {IFolderFileFrame} dirInfo - Folder metadata.
   * @returns {Promise<IFolderHandler>}
   */
  static async trackFolder(dirInfo: IFolderFrame): Promise<IFolderHandler> {
    return new FolderHandler(dirInfo)
  }

  /**
   * Async wrapper to create a FolderHandler instance from a File source.
   * @param {Blob} data - Encrypted Folder metadata.
   * @param {CryptoKey} key - Data encryption key.
   * @param {Uint8Array} iv - Data encryption iv.
   * @returns {Promise<IFolderHandler>}
   */
  static async trackLegacyFolder(
    data: Blob,
    key: CryptoKey,
    iv: Uint8Array
  ): Promise<IFolderHandler> {
    const folderDetails = JSON.parse(
      await (await convertFromEncryptedFile(data, key, iv)).text()
    )
    return new FolderHandler(folderDetails)
  }

  /**
   * Async wrapper to create a FolderHandler instance for a new folder.
   * @param {IChildDirInfo} dirInfo - Initial Folder details.
   * @returns {Promise<IFolderHandler>}
   */
  static async trackNewFolder(dirInfo: IChildDirInfo): Promise<IFolderHandler> {
    const folderDetails: IFolderFrame = {
      whoAmI: stripper(dirInfo.myName),
      whereAmI: dirInfo.myParent,
      whoOwnsMe: dirInfo.myOwner,
      dirChildren: [],
      fileChildren: {}
    }
    return new FolderHandler(folderDetails)
  }

  /**
   * Get name of Folder.
   * @returns {string}
   */
  getWhoAmI(): string {
    return this.folderDetails.whoAmI
  }

  /**
   * Get parent path of Folder.
   * @returns {string}
   */
  getWhereAmI(): string {
    return this.folderDetails.whereAmI
  }

  /**
   * Get Bech32 address of Folder owner.
   * @returns {string}
   */
  getWhoOwnsMe(): string {
    return this.folderDetails.whoOwnsMe
  }

  /**
   * Get full Folder path (parent path + Folder name)
   * @returns {string}
   */
  getMyPath(): string {
    return `${this.getWhereAmI()}/${this.getWhoAmI()}`
  }

  /**
   * Get full path for target child.
   * @param {string} child
   * @returns {string}
   */
  getMyChildPath(child: string): string {
    return `${this.getMyPath()}/${child}`
  }

  /**
   * Get full Folder metadata.
   * @returns {IFolderFileFrame}
   */
  getFolderDetails(): IFolderFrame {
    return this.folderDetails
  }

  /**
   * Get all direct child folders.
   * @returns {string[]}
   */
  getChildDirs(): string[] {
    return this.folderDetails.dirChildren
  }

  /**
   * Get all direct child files.
   * @returns {{[p: string]: IFileMeta}}
   */
  getChildFiles(): { [name: string]: IFileMeta } {
    return this.folderDetails.fileChildren
  }

  /**
   * Creates and returns FileTree EncodeObject for saving Folder to network.
   * @param {IWalletHandler} walletRef - WalletHandler instance.
   * @returns {Promise<EncodeObject>}
   */
  async getForFiletree(walletRef: IWalletHandler): Promise<EncodeObject> {
    if (!walletRef.traits)
      throw new Error(signerNotEnabled('FolderHandler', 'getForFiletree'))
    return await saveFileTreeEntry(
      walletRef.getJackalAddress(),
      this.getWhereAmI(),
      this.getWhoAmI(),
      this.folderDetails,
      walletRef,
      true
    )
  }

  /**
   * Get full merkle string of path to target child.
   * @param {string} child - Name of child Folder or file.
   * @returns {Promise<string>}
   */
  async getChildMerkle(child: string): Promise<string> {
    return await merkleMeBro(
      `${this.getWhereAmI()}/${this.getWhoAmI()}/${child}`
    )
  }

  /**
   * Add direct child Folder(s) to this Folder's metadata.
   * @param {string[]} childNames - Array of names to add as direct child Folders.
   * @param {IWalletHandler} walletRef - WalletHandler instance.
   * @returns {Promise<{encoded: EncodeObject[], existing: string[]}>}
   */
  async addChildDirs(
    childNames: string[],
    walletRef: IWalletHandler
  ): Promise<{ encoded: EncodeObject[]; existing: string[] }> {
    const existing = childNames.filter((name) =>
      this.folderDetails.dirChildren.includes(name)
    )
    const more = childNames.filter(
      (name) => !this.folderDetails.dirChildren.includes(name)
    )
    const handlers: IFolderHandler[] = await Promise.all(
      more.map(
        async (name) =>
          await FolderHandler.trackNewFolder(this.makeChildDirInfo(name))
      )
    )
    const encoded: EncodeObject[] = await Promise.all(
      handlers.map(
        async (handler: IFolderHandler) =>
          await handler.getForFiletree(walletRef)
      )
    )
    if (more.length > 0) {
      this.folderDetails.dirChildren = [
        ...new Set([...this.folderDetails.dirChildren, ...more])
      ]
      encoded.push(await this.getForFiletree(walletRef))
    }
    return { encoded: encoded || [], existing }
  }

  /**
   * Add direct child file(s) to this Folder's metadata.
   * @param {IFileMetaHashMap} newFiles - Map of file metadata using file name as key.
   * @param {IWalletHandler} walletRef - WalletHandler instance.
   * @returns {Promise<EncodeObject>}
   */
  async addChildFileReferences(
    newFiles: IFileMetaHashMap,
    walletRef: IWalletHandler
  ): Promise<EncodeObject> {
    this.folderDetails.fileChildren = {
      ...this.folderDetails.fileChildren,
      ...newFiles
    }
    return await this.getForFiletree(walletRef)
  }

  /**
   * Remove direct child Folder(s) from this Folder's metadata.
   * @param {string[]} toRemove - Array of names to remove as direct child Folders.
   * @param {IWalletHandler} walletRef - WalletHandler instance.
   * @returns {Promise<EncodeObject>}
   */
  async removeChildDirReferences(
    toRemove: string[],
    walletRef: IWalletHandler
  ): Promise<EncodeObject> {
    this.folderDetails.dirChildren = this.folderDetails.dirChildren.filter(
      (saved: string) => !toRemove.includes(saved)
    )
    return await this.getForFiletree(walletRef)
  }

  /**
   * Remove direct child file(s) from this Folder's metadata.
   * @param {string[]} toRemove - Array of names to remove as direct child files.
   * @param {IWalletHandler} walletRef - WalletHandler instance.
   * @returns {Promise<EncodeObject>}
   */
  async removeChildFileReferences(
    toRemove: string[],
    walletRef: IWalletHandler
  ): Promise<EncodeObject> {
    for (let i = 0; i < toRemove.length; i++) {
      delete this.folderDetails.fileChildren[toRemove[i]]
    }
    return await this.getForFiletree(walletRef)
  }

  /**
   * Remove direct child Folder(s) and/or file(s) from this Folder's metadata.
   * @param {string[]} dirs - Array of names to remove as direct child Folders.
   * @param {string[]} files - Array of names to remove as direct child files.
   * @param {IWalletHandler} walletRef - WalletHandler instance.
   * @returns {Promise<EncodeObject>}
   */
  async removeChildDirAndFileReferences(
    dirs: string[],
    files: string[],
    walletRef: IWalletHandler
  ): Promise<EncodeObject> {
    this.folderDetails.dirChildren = this.folderDetails.dirChildren.filter(
      (saved: string) => !dirs.includes(saved)
    )
    for (let i = 0; i < files.length; i++) {
      delete this.folderDetails.fileChildren[files[i]]
    }
    return await this.getForFiletree(walletRef)
  }

  /**
   * Generate metadata bundle to create new direct child Folder. For use with FolderHandler.trackNewFolder().
   * @param {string} childName - Name of Folder to create.
   * @returns {IChildDirInfo}
   */
  makeChildDirInfo(childName: string): IChildDirInfo {
    const myName = stripper(childName)
    const myParent = `${this.folderDetails.whereAmI}/${this.folderDetails.whoAmI}`
    const myOwner = this.folderDetails.whoOwnsMe
    return { myName, myParent, myOwner }
  }
}
