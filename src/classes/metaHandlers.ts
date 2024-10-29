import { Merkletree } from '@jackallabs/dogwood-tree'
import { ulid } from 'ulid'
import { chunkSize } from '@/utils/globalDefaults'
import { hexToInt, intToHex, uintArrayToString } from '@/utils/converters'
import { bufferToHex } from '@/utils/hash'
import {
  IFileMeta,
  IFileMetaData,
  IFileMetaFoundationalData,
  IFileMetaHandler,
  IFolderMetaData,
  IFolderMetaFoundationalData,
  IFolderMetaHandler,
  INullMetaData,
  INullMetaDataSource,
  INullMetaFoundationalData,
  INullMetaHandler,
  INullRefMetaData,
  IRefMetaData,
  IShareMetaData,
  IShareMetaDataSource,
  IShareMetaFoundationalData,
  IShareMetaHandler,
  ISharerMetaData,
  ISharerMetaDataSource,
  ISharerMetaFoundationalData,
  ISharerMetaHandler,
  ISharerRefMetaData,
  TFileMetaDataSource,
  TFolderMetaDataSource,
} from '@/interfaces'

export class NullMetaHandler implements INullMetaHandler {
  protected readonly location: string
  protected refIndex: number
  protected readonly ulid: string

  protected constructor (source: INullMetaFoundationalData) {
    this.location = `s/ulid/${source.location}`
    this.refIndex = source.refIndex
    this.ulid = source.ulid
  }

  /**
   *
   * @param {INullMetaDataSource} source
   * @returns {Promise<NullMetaHandler>}
   */
  static async create (source: INullMetaDataSource) {
    return new NullMetaHandler(source)
  }

  /**
   *
   * @param {number} refIndex
   */
  setRefIndex (refIndex: number): void {
    this.refIndex = refIndex
  }

  /**
   *
   * @returns {number}
   */
  getRefIndex (): number {
    return this.refIndex
  }

  /**
   *
   * @returns {string}
   */
  getRefString (): string {
    return intToHex(this.refIndex)
  }

  /**
   *
   * @returns {string}
   */
  getLocation (): string {
    return this.location
  }

  /**
   *
   * @returns {string}
   */
  getSelf (): string {
    return `s/ulid/${this.ulid}`
  }

  /**
   *
   * @returns {INullMetaData}
   */
  export (): INullMetaData {
    return {
      location: this.location,
      merkleHex: '',
      metaDataType: 'null',
      removed: true,
    }
  }

  /**
   *
   * @returns {INullRefMetaData}
   */
  exportRef (): INullRefMetaData {
    return {
      location: `${this.location}/${intToHex(this.refIndex)}`,
      merkleHex: '',
      metaDataType: 'nullref',
      pointsTo: '',
    }
  }
}

export class FolderMetaHandler implements IFolderMetaHandler {
  protected count: number
  protected description: string
  protected location: string
  protected refIndex: number
  protected sharerCount: number
  protected readonly ulid: string
  protected whoAmI: string

  protected constructor (source: IFolderMetaFoundationalData) {
    this.count = source.count
    this.description = source.description
    this.location = source.location
    this.refIndex = source.refIndex
    this.sharerCount = source.sharerCount
    this.ulid = source.ulid
    this.whoAmI = source.whoAmI
  }

  /**
   *
   * @param {TFolderMetaDataSource} source
   * @returns {Promise<FolderMetaHandler>}
   */
  static async create (source: TFolderMetaDataSource) {
    if ('clone' in source) {
      const shortcut: IFolderMetaFoundationalData = {
        ...source.clone,
        count: hexToInt(source.clone.count),
        sharerCount: hexToInt(source.clone.sharerCount || ''),
        ulid: source.ulid,
        refIndex: source.refIndex || 0,
      }
      return new FolderMetaHandler(shortcut)
    } else {
      const rdy: IFolderMetaFoundationalData = {
        count: source.count,
        description: source.description || '',
        location: `s/ulid/${source.location}`,
        refIndex: source.refIndex || 0,
        sharerCount: source.sharerCount || 0,
        ulid: source.ulid || ulid(),
        whoAmI: source.name,
      }
      return new FolderMetaHandler(rdy)
    }
  }

  /**
   *
   * @param {number} value
   * @returns {number}
   */
  addAndReturnCount (value: number): number {
    this.count += value
    return this.count
  }

  /**
   *
   * @param {number} count
   */
  setCount (count: number): void {
    this.count = count
  }

  /**
   *
   * @returns {number}
   */
  getCount (): number {
    return this.count
  }

  /**
   *
   * @param {number} value
   * @returns {number}
   */
  addAndReturnSharerCount (value: number): number {
    this.sharerCount += value
    return this.sharerCount
  }

  /**
   *
   * @param {number} count
   */
  setSharerCount (count: number): void {
    this.sharerCount = count
  }

  /**
   *
   * @returns {number}
   */
  getSharerCount (): number {
    return this.sharerCount
  }

  /**
   *
   * @param {number} refIndex
   */
  setRefIndex (refIndex: number): void {
    this.refIndex = refIndex
  }

  /**
   *
   * @returns {number}
   */
  getRefIndex (): number {
    return this.refIndex
  }

  /**
   *
   * @returns {string}
   */
  getRefString (): string {
    return intToHex(this.refIndex)
  }

  /**
   *
   * @returns {string}
   */
  getUlid (): string {
    return this.ulid
  }

  /**
   *
   * @param {string} location
   */
  setLocation (location: string): void {
    this.location = `s/ulid/${location}`
  }

  /**
   *
   * @returns {string}
   */
  getLocation (): string {
    return this.location
  }

  /**
   *
   * @returns {IFolderMetaData}
   */
  export (): IFolderMetaData {
    return {
      count: intToHex(this.count),
      description: this.description,
      location: this.location,
      merkleHex: '',
      metaDataType: 'folder',
      sharerCount: intToHex(this.sharerCount),
      whoAmI: this.whoAmI,
    }
  }

  /**
   *
   * @returns {IRefMetaData}
   */
  exportRef (): IRefMetaData {
    return {
      location: `${this.location}/${intToHex(this.refIndex)}`,
      merkleHex: '',
      metaDataType: 'ref',
      pointsTo: this.ulid,
    }
  }
}

export class FileMetaHandler implements IFileMetaHandler {
  protected description: string
  protected fileMeta: IFileMeta
  protected location: string
  protected readonly merkleHex: string
  protected readonly merkleMem: string
  protected readonly merkleRoot: Uint8Array
  protected refIndex: number
  protected sharerCount: number
  protected readonly thumbnail: string
  protected readonly ulid: string

  protected constructor (source: IFileMetaFoundationalData) {
    this.description = source.description
    this.fileMeta = source.fileMeta
    this.location = source.location
    this.merkleHex = source.merkleHex
    this.merkleMem = source.merkleMem
    this.merkleRoot = source.merkleRoot
    this.refIndex = source.refIndex
    this.sharerCount = source.sharerCount
    this.thumbnail = source.thumbnail
    this.ulid = source.ulid
  }

  /**
   *
   * @param {TFileMetaDataSource} source
   * @returns {Promise<FileMetaHandler>}
   */
  static async create (source: TFileMetaDataSource) {
    if ('clone' in source) {
      const shortcut: IFileMetaFoundationalData = {
        ...source.clone,
        refIndex: source.refIndex || -1,
        sharerCount: hexToInt(source.clone.sharerCount || ''),
      }
      return new FileMetaHandler(shortcut)
    } else {
      const rdy: IFileMetaFoundationalData = {
        description: source.description || '',
        fileMeta: source.fileMeta,
        location: `s/ulid/${source.location}`,
        merkleHex: '',
        merkleMem: '',
        merkleRoot: new Uint8Array(),
        refIndex: source.refIndex || 0,
        sharerCount: source.sharerCount || 0,
        thumbnail: source.thumbnail || '',
        ulid: source.ulid || ulid(),
      }

      if (!source.legacyMerkles && !source.file) {
        throw new Error('Must supply legacyMerkle or file')
      } else if (source.legacyMerkles) {
        rdy.merkleRoot = source.legacyMerkles[0]
        rdy.merkleHex = bufferToHex(source.legacyMerkles[0])
        rdy.merkleMem = uintArrayToString(rdy.merkleRoot)
      } else if (source.file) {
        const seed = await source.file.arrayBuffer()
        const tree = await Merkletree.grow({ seed, chunkSize, preserve: false })
        rdy.merkleRoot = new Uint8Array(tree.getRoot())
        rdy.merkleHex = tree.getRootAsHex()
        rdy.merkleMem = uintArrayToString(rdy.merkleRoot)
      }
      return new FileMetaHandler(rdy)
    }
  }

  /**
   *
   * @param {number} refIndex
   */
  setRefIndex (refIndex: number): void {
    this.refIndex = refIndex
  }

  /**
   *
   * @returns {number}
   */
  getRefIndex (): number {
    return this.refIndex
  }

  /**
   *
   * @returns {string}
   */
  getRefString (): string {
    return intToHex(this.refIndex)
  }

  /**
   *
   * @param {number} value
   * @returns {number}
   */
  addAndReturnSharerCount (value: number): number {
    this.sharerCount += value
    return this.sharerCount
  }

  /**
   *
   * @param {number} count
   */
  setSharerCount (count: number): void {
    this.sharerCount = count
  }

  /**
   *
   * @returns {number}
   */
  getSharerCount (): number {
    return this.sharerCount
  }

  /**
   *
   * @returns {string}
   */
  getUlid (): string {
    return this.ulid
  }

  /**
   *
   * @param {string} location
   */
  setLocation (location: string): void {
    this.location = `s/ulid/${location}`
  }

  /**
   *
   * @returns {string}
   */
  getLocation (): string {
    return this.location
  }

  /**
   *
   * @returns {IFileMetaData}
   */
  export (): IFileMetaData {
    return {
      description: this.description,
      fileMeta: this.fileMeta,
      location: this.location,
      merkleHex: this.merkleHex,
      merkleMem: this.merkleMem,
      merkleRoot: this.merkleRoot,
      metaDataType: 'file',
      sharerCount: intToHex(this.sharerCount),
      thumbnail: this.thumbnail,
      ulid: this.ulid,
    }
  }

  /**
   *
   * @returns {IRefMetaData}
   */
  exportRef (): IRefMetaData {
    return {
      location: `${this.location}/${intToHex(this.refIndex)}`,
      merkleHex: '',
      metaDataType: 'ref',
      pointsTo: this.ulid,
    }
  }
}

export class ShareMetaHandler implements IShareMetaHandler {
  protected readonly isFile: boolean
  protected readonly location: string
  protected readonly name: string
  protected readonly pointsTo: string
  protected refIndex: number
  protected readonly ulid: string

  protected constructor (source: IShareMetaFoundationalData) {
    this.isFile = source.isFile
    this.location = source.location
    this.name = source.name
    this.pointsTo = source.pointsTo
    this.refIndex = source.refIndex
    this.ulid = source.ulid
  }

  /**
   *
   * @param {IShareMetaDataSource} source
   * @returns {Promise<ShareMetaHandler>}
   */
  static async create (source: IShareMetaDataSource) {
    const rdy: IShareMetaFoundationalData = {
      isFile: source.isFile,
      location: `s/ulid/${source.owner}`,
      name: source.name,
      pointsTo: source.pointsTo,
      refIndex: source.refIndex || -1,
      ulid: source.ulid || ulid(),
    }
    return new ShareMetaHandler(rdy)
  }

  /**
   *
   * @param {number} refIndex
   */
  setRefIndex (refIndex: number): void {
    this.refIndex = refIndex
  }

  /**
   *
   * @returns {number}
   */
  getRefIndex (): number {
    return this.refIndex
  }

  /**
   *
   * @returns {string}
   */
  getRefString (): string {
    return intToHex(this.refIndex)
  }

  /**
   *
   * @returns {boolean}
   */
  getIsFile (): boolean {
    return this.isFile
  }

  /**
   *
   * @returns {string}
   */
  getUlid (): string {
    return this.ulid
  }

  /**
   *
   * @returns {string}
   */
  getLocation (): string {
    return this.location
  }

  /**
   *
   * @returns {IShareMetaData}
   */
  export (): IShareMetaData {
    return {
      isFile: this.isFile,
      location: this.location,
      merkleHex: '',
      metaDataType: 'share',
      name: this.name,
      pointsTo: this.pointsTo,
      ulid: this.ulid,
    }
  }

  /**
   *
   * @returns {IRefMetaData}
   */
  exportRef (): IRefMetaData {
    return {
      location: `${this.location}/${intToHex(this.refIndex)}`,
      merkleHex: '',
      metaDataType: 'ref',
      pointsTo: this.ulid,
    }
  }
}

export class SharerMetaHandler implements ISharerMetaHandler {
  protected readonly location: string
  protected readonly sharer: string
  protected refIndex: number
  protected readonly ulid: string

  protected constructor (source: ISharerMetaFoundationalData) {
    this.location = source.location
    this.sharer = source.sharer
    this.refIndex = source.refIndex
    this.ulid = source.ulid
  }

  /**
   *
   * @param {ISharerMetaDataSource} source
   * @returns {Promise<SharerMetaHandler>}
   */
  static async create (source: ISharerMetaDataSource) {
    const rdy: ISharerMetaFoundationalData = {
      location: `s/ulid/${source.location}`,
      sharer: source.sharer,
      refIndex: source.refIndex || -1,
      ulid: source.ulid || ulid(),
    }
    return new SharerMetaHandler(rdy)
  }

  /**
   *
   * @param {number} refIndex
   */
  setRefIndex (refIndex: number): void {
    this.refIndex = refIndex
  }

  /**
   *
   * @returns {number}
   */
  getRefIndex (): number {
    return this.refIndex
  }

  /**
   *
   * @returns {string}
   */
  getRefString (): string {
    return intToHex(this.refIndex)
  }

  /**
   *
   * @returns {string}
   */
  getUlid (): string {
    return this.ulid
  }

  /**
   *
   * @returns {string}
   */
  getLocation (): string {
    return this.location
  }

  /**
   *
   * @returns {ISharerMetaData}
   */
  export (): ISharerMetaData {
    return {
      location: this.location,
      merkleHex: '',
      metaDataType: 'sharer',
      sharer: this.sharer,
      ulid: this.ulid,
    }
  }

  /**
   *
   * @returns {ISharerRefMetaData}
   */
  exportRef (): ISharerRefMetaData {
    return {
      location: `${this.location}/s-${intToHex(this.refIndex)}`,
      merkleHex: '',
      metaDataType: 'sharerref',
      pointsTo: this.ulid,
    }
  }
}
