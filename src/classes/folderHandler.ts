import { IChildDirInfo, IFileConfigRelevant, IFileMeta, IFolderFileFrame } from '../interfaces'
import { IFolderHandler } from '../interfaces/classes'
import { stripper } from '../utils/misc'
import {
  aesCrypt,
  assembleEncryptedFile,
  decryptPrep,
  encryptPrep,
  exportJackalKey,
  genIv, genKey
} from '../utils/crypt'
import { hexFullPath, merkleMeBro } from '../utils/hash'

export default class FolderHandler implements IFolderHandler {

  fileConfig: IFileConfigRelevant

  private readonly key: CryptoKey
  private readonly iv: Uint8Array
  private folderDetails: IFolderFileFrame
  private cid: string
  private fid: string[]
  private uuid: string


  private constructor (folderDetails: IFolderFileFrame, config: IFileConfigRelevant, jackalKey: CryptoKey, cleanIv: Uint8Array) {
    this.folderDetails = folderDetails
    this.key = jackalKey
    this.iv = cleanIv

    this.fileConfig = config
    this.cid = ''
    this.fid = []
    this.uuid = ''
  }

  static async trackFolder (data: ArrayBuffer, config: IFileConfigRelevant, key: CryptoKey, iv: Uint8Array): Promise<IFolderHandler> {
    const decChunks: ArrayBuffer[] = await Promise.all(
      decryptPrep(data)
        .map((chunk: ArrayBuffer) => aesCrypt(chunk, key, iv, 'decrypt')
    ))
    const folderDetails = JSON.parse((new TextDecoder()).decode(await (new Blob([...decChunks])).arrayBuffer()))
    return new FolderHandler(folderDetails, config, key, iv)
  }
  static async trackNewFolder (dirInfo: IChildDirInfo): Promise<IFolderHandler> {
    const folderDetails: IFolderFileFrame = {
      whoAmI: stripper(dirInfo.myName),
      whereAmI: dirInfo.myParent,
      whoOwnsMe: dirInfo.myOwner,
      dirChildren: [],
      fileChildren: {}
    }
    const startingConfig: IFileConfigRelevant = {
      editAccess: {}, // object of sha256 hash of wallet address:enc aes key
      viewingAccess: {}, // object of sha256 hash of wallet address:enc aes key
      trackingNumber: '' // uuid
    }
    return new FolderHandler(folderDetails, startingConfig, await genKey(), genIv())
  }

  getWhereAmI (): string {
    return this.folderDetails.whereAmI
  }
  getFolderDetails (): IFolderFileFrame {
    return this.folderDetails
  }
  getChildDirs (): string[] {
    return this.folderDetails.dirChildren
  }
  getChildFiles (): {[name: string]: IFileMeta} {
    return this.folderDetails.fileChildren
  }

  makeChildDirInfo (childName: string): IChildDirInfo {
    const myName = stripper(childName)
    const myParent = `${this.folderDetails.whereAmI}/${this.folderDetails.whoAmI}`
    const myOwner = this.folderDetails.whoOwnsMe
    return {myName, myParent, myOwner}
  }
  addChildDirs (dirs: string[]): void {
    this.folderDetails.dirChildren = [...new Set([...this.folderDetails.dirChildren, ...dirs])]
  }
  addChildFiles (newFiles: IFileMeta[]) {
    const midStep = newFiles.reduce((acc: {[name: string]: IFileMeta}, curr: IFileMeta) => {
      acc[stripper(curr.name)] = curr
      return acc
    }, {})
    this.folderDetails.fileChildren = {...this.folderDetails.fileChildren, ...midStep}
  }
  removeChildDirs (toRemove: string[]) {
    this.folderDetails.dirChildren = this.folderDetails.dirChildren.filter((saved: string) => !toRemove.includes(saved))
  }
  removeChildFiles (toRemove: string[]) {
    for (let i = 0; i < toRemove.length; i++) {
      delete this.folderDetails.fileChildren[toRemove[i]]
    }
  }
  async getFullMerkle (): Promise<string> {
    return await hexFullPath(await this.getMerklePath(), this.getWhoAmI())
  }
  async getChildMerkle (child: string): Promise<string> {
    return await hexFullPath(await this.getFullMerkle(), child)
  }

  setIds (idObj: { cid: string, fid: string[] }) {
    this.cid = idObj.cid
    this.fid = idObj.fid
  }
  setUUID (uuid: string) {
    this.uuid = uuid
  }
  getIds () {
    return { fid: this.fid, cid: this.cid }
  }
  getUUID (): string {
    return this.uuid
  }
  getWhoAmI (): string {
    return this.folderDetails.whoAmI
  }
  getWhoOwnsMe (): string {
    return this.folderDetails.whoOwnsMe
  }
  async getForUpload (): Promise<File> {
    const chunks = encryptPrep((new TextEncoder()).encode(JSON.stringify(this.folderDetails)))
    const encChunks: ArrayBuffer[] = await Promise.all(
      chunks.map((chunk: ArrayBuffer) => aesCrypt(chunk, this.key, this.iv, 'encrypt'))
    )
    console.dir(encChunks)
    return await assembleEncryptedFile(encChunks, this.folderDetails.whoAmI)
  }
  async getEnc (): Promise<{iv: Uint8Array, key: Uint8Array}> {
    return {
      iv: this.iv,
      key: await exportJackalKey(this.key)
    }
  }
  getMerklePath () {
    return merkleMeBro(this.folderDetails.whereAmI)
  }
}
