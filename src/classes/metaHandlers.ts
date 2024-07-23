import { Merkletree } from '@jackallabs/dogwood-tree'
import { ulid } from 'ulid'
import { chunkSize } from '@/utils/globalDefaults'
import {
  intToHex,
  maybeMakeThumbnail,
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

  static async create(path: string, refIndex: number = 0) {
    return new NullMetaHandler(path, refIndex)
  }

  setRefIndex(refIndex: number): void {
    this.refIndex = refIndex
  }

  getRefIndex(): number {
    return this.refIndex
  }

  getRefString(): string {
    return intToHex(this.refIndex)
  }

  getLocation(): string {
    return this.location
  }

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

  addAndReturnCount(value: number): number {
    this.count += value
    return this.count
  }

  setCount(count: number): void {
    this.count = count
  }

  getCount(): number {
    return this.count
  }

  setRefIndex(refIndex: number): void {
    this.refIndex = refIndex
  }

  getRefIndex(): number {
    return this.refIndex
  }

  getRefString(): string {
    return intToHex(this.refIndex)
  }

  getUlid(): string {
    return this.ulid
  }

  setLocation(location: string): void {
    this.location = `s/ulid/${location}`
  }

  getLocation(): string {
    return this.location
  }

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
      rdy.thumbnail = await maybeMakeThumbnail(source.file)
    }

    return new FileMetaHandler(rdy)
  }

  setRefIndex(refIndex: number): void {
    this.refIndex = refIndex
  }

  getRefIndex(): number {
    return this.refIndex
  }

  getRefString(): string {
    return intToHex(this.refIndex)
  }

  getUlid(): string {
    return this.ulid
  }

  setLocation(location: string): void {
    this.location = `s/ulid/${location}`
  }

  getLocation(): string {
    return this.location
  }

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

  addAndReturnCount(value: number): number {
    this.count += value
    return this.count
  }

  getCount(): number {
    return this.count
  }

  setRefIndex(refIndex: number): void {
    this.refIndex = refIndex
  }

  getRefIndex(): number {
    return this.refIndex
  }

  getRefString(): string {
    return intToHex(this.refIndex)
  }

  getUlid(): string {
    return this.ulid
  }

  getLocation(): string {
    return this.location
  }

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

  setRefIndex(refIndex: number): void {
    this.refIndex = refIndex
  }

  getRefIndex(): number {
    return this.refIndex
  }

  getRefString(): string {
    return intToHex(this.refIndex)
  }

  setLabel(label: string): void {
    this.label = label
  }

  getLabel(): string {
    return this.label
  }

  getUlid(): string {
    return this.ulid
  }

  getLocation(): string {
    return this.location
  }

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

  exportRef(): IShareRefMetaData {
    return {
      location: `${this.location}/${intToHex(this.refIndex)}`,
      merkleHex: '',
      metaDataType: 'shareref',
      pointsTo: this.ulid,
    }
  }
}
