import IFileConfigRelevant from '../interfaces/IFileConfigRelevant'
import IFolderFileFrame from '../interfaces/IFolderFileFrame'
import IFolderHandler from '../interfaces/classes/IFolderHandler'
import { orderStrings, stripper } from '../utils/misc'
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
import { hashAndHex, merkleMeBro } from '../utils/hash'

export default class FolderHandler implements IFolderHandler {

  private folderDetails: IFolderFileFrame
  private key: CryptoKey
  private iv: Uint8Array
  fileConfig: IFileConfigRelevant
  path: string
  private cid: string
  private fid: string
  private uuid: string

  private readonly baseFile: File
  private readonly key: CryptoKey
  private readonly iv: Uint8Array
  private readonly parentPath: string
  private cid: string
  private fid: string


  private constructor (folderDetails: IFolderFileFrame, config: IFileConfigRelevant, jackalKey: CryptoKey, cleanIv: Uint8Array) {
    this.folderDetails = folderDetails
    this.key = jackalKey
    this.iv = cleanIv

    this.fileConfig = config
    this.path = folderDetails.whereAmI
    this.cid = ''
    this.fid = ''
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
      dirChildren: [],
      fileChildren: {}
    }
    const startingConfig: IFileConfigRelevant = {
      creator: '',
      hashpath: '',
      contents: '',
      viewers: {},
      editors: {}
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
    return {myName, myParent}
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

  setIds (idObj: {cid: string, fid: string}) {
    this.cid = idObj.cid
    this.fid = idObj.fid
  }
  setUUID (uuid: string) {
    this.uuid = uuid
  }
  getUUID (): string {
    return this.uuid
  }
  getWhoAmI (): string {
    return this.file.name
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
  getMerklePath () {
    return merkleMeBro(this.folderDetails.whereAmI)
  }
}
