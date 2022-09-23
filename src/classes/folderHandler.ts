import IFileConfigRaw from '../interfaces/IFileConfigRaw'
import IFolderFileFrame from '../interfaces/IFolderFileFrame'
import IFolderHandler from '../interfaces/classes/IFolderHandler'
import { orderStrings } from '../utils/misc'
import IFileMeta from '../interfaces/IFileMeta'
import IChildDirInfo from '../interfaces/IChildDirInfo'
import {
  aesCrypt,
  assembleEncryptedFile,
  decryptPrep,
  encryptPrep,
  exportJackalKey, genIv, genKey,
  importJackalKey
} from '../utils/crypt'
import { hashAndHex } from '../utils/hash'

export default class FolderHandler implements IFolderHandler {

  private folderDetails: IFolderFileFrame
  private key: CryptoKey
  private iv: Uint8Array
  fileConfig: IFileConfigRaw
  path: string
  cid: string
  fid: string


  private constructor (folderDetails: IFolderFileFrame, config: IFileConfigRaw, jackalKey: CryptoKey, cleanIv: Uint8Array) {
    this.folderDetails = folderDetails
    this.key = jackalKey
    this.iv = cleanIv

    this.fileConfig = config
    this.path = folderDetails.whereAmI
    this.cid = ''
    this.fid = ''
  }

  static async trackFolder (data: ArrayBuffer, config: IFileConfigRaw, key: ArrayBuffer, iv: ArrayBuffer): Promise<IFolderHandler> {
    const jackalKey = await importJackalKey(new Uint8Array(key))
    const cleanIv = new Uint8Array(iv)

    const decChunks: ArrayBuffer[] = await Promise.all(
      decryptPrep(data)
        .map((chunk: ArrayBuffer) => aesCrypt(chunk, jackalKey, cleanIv, 'decrypt')
    ))
    const folderDetails = JSON.parse((new TextDecoder()).decode(await (new Blob([...decChunks])).arrayBuffer()))

    return new FolderHandler(folderDetails, config, jackalKey, cleanIv)
  }
  static async trackNewFolder (dirInfo: IChildDirInfo): Promise<IFolderHandler> {
    const folderDetails: IFolderFileFrame = {
      whoAmI: dirInfo.myName,
      whereAmI: dirInfo.myParent,
      dirChildren: [],
      fileChildren: {}
    }
    const startingConfig: IFileConfigRaw = {
      creator: '',
      hashpath: '',
      contents: '',
      viewers: {},
      editors: {}
    }
    return new FolderHandler(folderDetails, startingConfig, await genKey(), genIv())
  }

  getWhoAmI (): string {
    return this.folderDetails.whoAmI
  }
  getWhereAmI (): string {
    return this.folderDetails.whereAmI
  }
  async merkleMeBro (): Promise<string> {
    const pathArray = this.folderDetails.whereAmI.split('/')
    let merkle = ''
    for (let i = 0; i < pathArray.length; i++) {
      if (i === 0) {
        merkle = await hashAndHex(pathArray[i])
      } else {
        merkle = await hashAndHex(`${merkle}${await hashAndHex(pathArray[i])}`)
      }
    }
    return merkle
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
    const myName = (childName.endsWith('/')) ? childName.replace(/\/+$/, '') : childName
    const myParent = `${this.folderDetails.whereAmI}/${this.folderDetails.whoAmI}`
    return {myName, myParent}
  }
  addChildDirs (newDirs: string[]) {
    this.folderDetails.dirChildren = orderStrings([...this.folderDetails.dirChildren, ...newDirs])
  }
  addChildFiles (newFiles: IFileMeta[]) {
    const midStep = newFiles.reduce((acc: {[name: string]: IFileMeta}, curr: IFileMeta) => {
      acc[curr.name] = curr
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

  setIds (idObj: {cid: string, fid: string}) {
    this.cid = idObj.cid
    this.fid = idObj.fid
  }
  async getForUpload (): Promise<File> {
    const chunks = encryptPrep((new TextEncoder()).encode(JSON.stringify(this.folderDetails)))
    const encChunks: ArrayBuffer[] = await Promise.all(
      chunks.map((chunk: ArrayBuffer) => aesCrypt(chunk, this.key, this.iv, 'encrypt'))
    )
    return await assembleEncryptedFile(encChunks, this.folderDetails.whoAmI)
  }
  async getEnc (): Promise<{iv: Uint8Array, key: Uint8Array}> {
    return {
      iv: this.iv,
      key: await exportJackalKey(this.key)
    }
  }
}
