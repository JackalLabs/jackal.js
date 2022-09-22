import IFileConfigRaw from '../interfaces/IFileConfigRaw'
import IFolderFileFrame from '../interfaces/IFolderFileFrame'
import IFolderFileHandler from '../interfaces/classes/IFolderFileHandler'
import { orderStrings } from '../utils/misc'
import IFileMeta from '../interfaces/IFileMeta'
import IChildDirInfo from '../interfaces/IChildDirInfo'

export default class FolderFileHandler implements IFolderFileHandler {

  private folderDetails: IFolderFileFrame
  fileConfig: IFileConfigRaw
  path: string
  cid: string
  fid: string


  private constructor () {
    //tmp
    this.path = ''
    this.cid = ''
    this.fid = ''
    this.fileConfig = {
      creator: '',
      hashpath: '',
      contents: '',
      viewers: {},
      editors: {}
    }

    this.folderDetails = {
      whoAmI: '',
      whereAmI: '',
      dirChildren: [],
      fileChildren: {}
    }

  }

  static async trackFolder (): Promise<IFolderFileHandler> {
    // const pendUpload: boolean = !key
    // const savedKey: CryptoKey = (key) ? await this.importJackalKey(new Uint8Array(key)) : await this.genKey()
    // const savedIv: Uint8Array = new Uint8Array(iv as ArrayBuffer) || this.genIv()
    return new FolderFileHandler()
  }
  static async trackNewFolder (): Promise<IFolderFileHandler> {
    // const pendUpload: boolean = !key
    // const savedKey: CryptoKey = (key) ? await this.importJackalKey(new Uint8Array(key)) : await this.genKey()
    // const savedIv: Uint8Array = new Uint8Array(iv as ArrayBuffer) || this.genIv()
    return new FolderFileHandler()
  }

  getWhoAmI (): string {
    return this.folderDetails.whoAmI
  }
  getWhereAmI (): string {
    return this.folderDetails.whereAmI
  }
  merkleMeBro (): string[] {
    // await hashAndHex(obj.path)
    return []
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

  async getForUpload (): Promise<File> {
    return new File([], 'tmp')
  }
  async getEnc (): Promise<{iv: Uint8Array, key: Uint8Array}> {
    return {iv: new Uint8Array(1), key: new Uint8Array(1)}
  }
  setIds (idObj: {cid: string, fid: string}): void {

  }



  // static async trackFolder (fileIo: IFileIo, wallet: IWalletHandler, whoAmI: string): Promise<IFolderFileHandler> {
  //   const cleanWhoAmI = whoAmI.endsWith('/') ? whoAmI : `${whoAmI}/`
  //   const { data, config, key, iv } = await fileIo.downloadFile(cleanWhoAmI, wallet, true) as IFolderDownload
  //
  //   if (data) {
  //
  //     return new FolderFileHandler()
  //   } else {
  //
  //     return new FolderFileHandler()
  //   }
  //
  //   const rawDecrypt = await folderCrypt(data, new Uint8Array(key), new Uint8Array(iv), 'decrypt')
  //   const frame: IFolderFileFrame = JSON.parse((new TextDecoder()).decode(rawDecrypt))
  //
  //   return new FolderFileHandler()
  // }
  // static async genFolder () {
  //   const contents = {
  //     path: '',
  //
  //   }
  //   return new File([(new TextEncoder()).encode(JSON.stringify(contents))], 'folder')
  // }

}

// async function readFolder (data: ArrayBuffer): Promise<IFolderFileFrame> {
//   const workingFile = this.baseFile as File
//   const meta = {
//     lastModified: workingFile.lastModified as number,
//     name: workingFile.name,
//     type: workingFile.type
//   }
//   return new Promise((resolve, reject) => {
//     const reader = new FileReader()
//     reader.onload = () => {
//       resolve({
//         meta,
//         content: (reader.result) ? reader.result as ArrayBuffer : new ArrayBuffer(0)
//       })
//     }
//     reader.onerror = reject
//     reader.readAsArrayBuffer(workingFile)
//   })
// }

async function folderCrypt (data: ArrayBuffer, rawKey: Uint8Array, iv: Uint8Array, mode: 'encrypt' | 'decrypt'): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey('raw', rawKey, 'AES-GCM', true, ['encrypt', 'decrypt'])
  const algo = {
    name: 'AES-GCM',
    iv: iv
  }
  if (data.byteLength < 1) {
    return new ArrayBuffer(0)
  } else if (mode?.toLowerCase() === 'encrypt') {
    return await crypto.subtle.encrypt(algo, key, data)
      .catch(err => {
        throw new Error(err)
      })
  } else {
    return await crypto.subtle.decrypt(algo, key, data)
      .catch(err => {
        throw new Error(err)
      })
  }
}
