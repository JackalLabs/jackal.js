import { Merkletree } from '@jackallabs/dogwood-tree'
import { ulid } from 'ulid'
import { chunkSize } from '@/utils/globalDefaults'
import {
  intToHex,
  uintArrayToString,
} from '@/utils/converters'
import { bufferToHex } from '@/utils/hash'
import type {
  IFileMeta,
  IFileMetaData,
  IFileMetaDataSource,
  IFileMetaFoundationalData,
  IFileMetaHandler,
  IFolderMetaData,
  IFolderMetaDataSource,
  IFolderMetaFoundationalData,
  IFolderMetaHandler,
  INullMetaData,
  INullMetaHandler,
  IRefMetaData,
  ISharedFolderMetaDataSource,
  ISharedFolderMetaFoundationalData,
  IShareFolderMetaData,
  IShareFolderMetaHandler,
  IShareMetaData,
  IShareMetaDataSource,
  IShareMetaFoundationalData,
  IShareMetaHandler,
  IShareRefMetaData,
} from '@/interfaces'

export class NullMetaHandler implements INullMetaHandler {
  protected readonly location: string
  protected refIndex: number

  protected constructor(path: string, refIndex: number) {
    this.location = path
    this.refIndex = refIndex
  }

  /**
   *
   * @param {string} path
   * @param {number} refIndex
   * @returns {Promise<NullMetaHandler>}
   */
  static async create(path: string, refIndex: number = 0) {
    return new NullMetaHandler(path, refIndex)
  }

  /**
   *
   * @param {number} refIndex
   */
  setRefIndex(refIndex: number): void {
    this.refIndex = refIndex
  }

  /**
   *
   * @returns {number}
   */
  getRefIndex(): number {
    return this.refIndex
  }

  /**
   *
   * @returns {string}
   */
  getRefString(): string {
    return intToHex(this.refIndex)
  }

  /**
   *
   * @returns {string}
   */
  getLocation(): string {
    return this.location
  }

  /**
   *
   * @returns {INullMetaData}
   */
  export(): INullMetaData {
    return {
      location: this.location,
      merkleHex: '',
      metaDataType: 'null',
      removed: true,
    }
  }
}

export class FolderMetaHandler implements IFolderMetaHandler {
  protected count: number
  protected description: string
  protected location: string
  protected refIndex: number
  protected readonly ulid: string
  protected whoAmI: string

  protected constructor(source: IFolderMetaFoundationalData) {
    this.count = source.count
    this.description = source.description
    this.location = source.location
    this.refIndex = source.refIndex
    this.ulid = source.ulid
    this.whoAmI = source.whoAmI
  }

  /**
   *
   * @param {IFolderMetaDataSource} source
   * @returns {Promise<FolderMetaHandler>}
   */
  static async create(source: IFolderMetaDataSource) {
    const rdy: IFolderMetaFoundationalData = {
      count: source.count,
      description: source.description || '',
      location: `s/ulid/${source.location}`,
      refIndex: source.refIndex || 0,
      ulid: source.ulid || ulid(),
      whoAmI: source.name,
    }
    return new FolderMetaHandler(rdy)
  }

  /**
   *
   * @param {number} value
   * @returns {number}
   */
  addAndReturnCount(value: number): number {
    this.count += value
    return this.count
  }

  /**
   *
   * @param {number} count
   */
  setCount(count: number): void {
    this.count = count
  }

  /**
   *
   * @returns {number}
   */
  getCount(): number {
    return this.count
  }

  /**
   *
   * @param {number} refIndex
   */
  setRefIndex(refIndex: number): void {
    this.refIndex = refIndex
  }

  /**
   *
   * @returns {number}
   */
  getRefIndex(): number {
    return this.refIndex
  }

  /**
   *
   * @returns {string}
   */
  getRefString(): string {
    return intToHex(this.refIndex)
  }

  /**
   *
   * @returns {string}
   */
  getUlid(): string {
    return this.ulid
  }

  /**
   *
   * @param {string} location
   */
  setLocation(location: string): void {
    this.location = `s/ulid/${location}`
  }

  /**
   *
   * @returns {string}
   */
  getLocation(): string {
    return this.location
  }

  /**
   *
   * @returns {IFolderMetaData}
   */
  export(): IFolderMetaData {
    return {
      count: intToHex(this.count),
      description: this.description,
      location: this.location,
      merkleHex: '',
      metaDataType: 'folder',
      whoAmI: this.whoAmI,
    }
  }

  /**
   *
   * @returns {IRefMetaData}
   */
  exportRef(): IRefMetaData {
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
  protected readonly thumbnail: string
  protected readonly ulid: string

  protected constructor(source: IFileMetaFoundationalData) {
    this.description = source.description
    this.fileMeta = source.fileMeta
    this.location = source.location
    this.merkleHex = source.merkleHex
    this.merkleMem = source.merkleMem
    this.merkleRoot = source.merkleRoot
    this.refIndex = source.refIndex
    this.thumbnail = source.thumbnail
    this.ulid = source.ulid
  }

  /**
   *
   * @param {IFileMetaDataSource} source
   * @returns {Promise<FileMetaHandler>}
   */
  static async create(source: IFileMetaDataSource) {
    const rdy: IFileMetaFoundationalData = {
      description: source.description || '',
      fileMeta: source.fileMeta,
      location: `s/ulid/${source.location}`,
      merkleHex: '',
      merkleMem: '',
      merkleRoot: new Uint8Array(),
      refIndex: source.refIndex || 0,
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

  /**
   *
   * @param {number} refIndex
   */
  setRefIndex(refIndex: number): void {
    this.refIndex = refIndex
  }

  /**
   *
   * @returns {number}
   */
  getRefIndex(): number {
    return this.refIndex
  }

  /**
   *
   * @returns {string}
   */
  getRefString(): string {
    return intToHex(this.refIndex)
  }

  /**
   *
   * @returns {string}
   */
  getUlid(): string {
    return this.ulid
  }

  /**
   *
   * @param {string} location
   */
  setLocation(location: string): void {
    this.location = `s/ulid/${location}`
  }

  /**
   *
   * @returns {string}
   */
  getLocation(): string {
    return this.location
  }

  /**
   *
   * @returns {IFileMetaData}
   */
  export(): IFileMetaData {
    return {
      description: this.description,
      fileMeta: this.fileMeta,
      location: this.location,
      merkleHex: this.merkleHex,
      merkleMem: this.merkleMem,
      merkleRoot: this.merkleRoot,
      metaDataType: 'file',
      thumbnail: this.thumbnail,
      ulid: this.ulid,
    }
  }

  /**
   *
   * @returns {IRefMetaData}
   */
  exportRef(): IRefMetaData {
    return {
      location: `${this.location}/${intToHex(this.refIndex)}`,
      merkleHex: '',
      metaDataType: 'ref',
      pointsTo: this.ulid,
    }
  }
}

export class ShareFolderMetaHandler implements IShareFolderMetaHandler {
  protected count: number
  protected readonly location: string
  protected refIndex: number
  protected readonly ulid: string
  protected readonly whoAmI: string

  protected constructor(source: ISharedFolderMetaFoundationalData) {
    this.count = source.count
    this.location = source.location
    this.refIndex = source.refIndex
    this.ulid = source.ulid
    this.whoAmI = source.whoAmI
  }

  /**
   *
   * @param {ISharedFolderMetaDataSource} source
   * @returns {Promise<ShareFolderMetaHandler>}
   */
  static async create(source: ISharedFolderMetaDataSource) {
    const rdy: ISharedFolderMetaFoundationalData = {
      count: source.count,
      location: `s/ulid/${source.location}`,
      refIndex: source.refIndex || 0,
      ulid: source.ulid || ulid(),
      whoAmI: source.name,
    }
    return new ShareFolderMetaHandler(rdy)
  }

  /**
   *
   * @param {number} value
   * @returns {number}
   */
  addAndReturnCount(value: number): number {
    this.count += value
    return this.count
  }

  /**
   *
   * @returns {number}
   */
  getCount(): number {
    return this.count
  }

  /**
   *
   * @param {number} refIndex
   */
  setRefIndex(refIndex: number): void {
    this.refIndex = refIndex
  }

  /**
   *
   * @returns {number}
   */
  getRefIndex(): number {
    return this.refIndex
  }

  /**
   *
   * @returns {string}
   */
  getRefString(): string {
    return intToHex(this.refIndex)
  }

  /**
   *
   * @returns {string}
   */
  getUlid(): string {
    return this.ulid
  }

  /**
   *
   * @returns {string}
   */
  getLocation(): string {
    return this.location
  }

  /**
   *
   * @returns {IShareFolderMetaData}
   */
  export(): IShareFolderMetaData {
    return {
      count: intToHex(this.count),
      description: '',
      location: `${this.location}/${intToHex(this.refIndex)}`,
      merkleHex: '',
      metaDataType: 'sharefolder',
      pointsTo: this.ulid,
      whoAmI: this.whoAmI,
    }
  }
}

export class ShareMetaHandler implements IShareMetaHandler {
  protected label: string
  protected readonly location: string
  protected readonly owner: string
  protected readonly pointsTo: string
  protected refIndex: number
  protected readonly ulid: string

  protected constructor(source: IShareMetaFoundationalData) {
    this.label = source.label
    this.location = source.location
    this.owner = source.owner
    this.pointsTo = source.pointsTo
    this.refIndex = source.refIndex
    this.ulid = source.ulid
  }

  /**
   *
   * @param {IShareMetaDataSource} source
   * @returns {Promise<ShareMetaHandler>}
   */
  static async create(source: IShareMetaDataSource) {
    const rdy: IShareMetaFoundationalData = {
      label: source.label,
      location: `s/ulid/${source.location}`,
      owner: source.owner,
      pointsTo: source.pointsTo,
      refIndex: source.refIndex || 0,
      ulid: source.ulid || ulid(),
    }

    return new ShareMetaHandler(rdy)
  }

  /**
   *
   * @param {number} refIndex
   */
  setRefIndex(refIndex: number): void {
    this.refIndex = refIndex
  }

  /**
   *
   * @returns {number}
   */
  getRefIndex(): number {
    return this.refIndex
  }

  /**
   *
   * @returns {string}
   */
  getRefString(): string {
    return intToHex(this.refIndex)
  }

  /**
   *
   * @param {string} label
   */
  setLabel(label: string): void {
    this.label = label
  }

  /**
   *
   * @returns {string}
   */
  getLabel(): string {
    return this.label
  }

  /**
   *
   * @returns {string}
   */
  getUlid(): string {
    return this.ulid
  }

  /**
   *
   * @returns {string}
   */
  getLocation(): string {
    return this.location
  }

  /**
   *
   * @returns {IShareMetaData}
   */
  export(): IShareMetaData {
    return {
      label: '',
      location: this.location,
      merkleHex: '',
      metaDataType: 'share',
      owner: this.owner,
      pointsTo: this.pointsTo,
    }
  }

  /**
   *
   * @returns {IShareRefMetaData}
   */
  exportRef(): IShareRefMetaData {
    return {
      location: `${this.location}/${intToHex(this.refIndex)}`,
      merkleHex: '',
      metaDataType: 'shareref',
      pointsTo: this.ulid,
    }
  }
}
