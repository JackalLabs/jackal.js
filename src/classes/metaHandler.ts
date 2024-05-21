import { Merkletree } from '@jackallabs/dogwood-tree'
import { chunkSize } from '@/utils/globalDefaults'
import { hexToInt, intToHex, uintArrayToString } from '@/utils/converters'
import { warnError } from '@/utils/misc'
import { hexToBuffer } from '@/utils/hash'
import type {
  IFileMetaData,
  IFolderMetaData,
  IMetaDataSource,
  IMetaHandler,
  INullMetaData,
  IRefMetaData,
  IShareFolderMetaData,
  IShareMetaData,
  IShareRefMetaData,
} from '@/interfaces'
import type { TFoundationalMetaData } from '@/types'

export class MetaHandler implements IMetaHandler {
  protected readonly path: string
  protected readonly meta: Record<string, any>
  protected readonly baseKeys: string[] = [
    'metaDataType',
    'location',
    'merkleLocation',
  ]
  protected refIndex: string = '-1'

  protected constructor(path: string, meta: TFoundationalMetaData) {
    this.path = path
    this.meta = meta
  }

  static async create(
    path: string,
    source: IMetaDataSource = {},
  ): Promise<IMetaHandler> {
    const pathParts = path.split('/')
    const whoAmI = pathParts.pop() as string
    const base: TFoundationalMetaData = {
      location: source.fileMeta ? `${path}/${source.fileMeta.name}` : path,
      pointsTo: source.pointsTo || '',
      merkleLocation: '',
      removed: true,
      count: intToHex(source.count),
      whoAmI,
      merkleRoot: new Uint8Array(0),
      merkleMem: '',
      fileMeta: source.fileMeta || {
        name: '',
        lastModified: 0,
        size: 0,
        type: '',
      },
      label: source.label || whoAmI,
      owner: source.owner || '',
    }
    if (source.legacyMerkle) {
      base.merkleRoot = hexToBuffer(source.legacyMerkle)
      base.merkleLocation = source.legacyMerkle
      base.merkleMem = uintArrayToString(base.merkleRoot)
    }
    if (source.file) {
      const seed = await source.file.arrayBuffer()
      const tree = await Merkletree.grow({ seed, chunkSize, preserve: false })
      base.merkleRoot = new Uint8Array(tree.getRoot())
      base.merkleLocation = tree.getRootAsHex()
      base.merkleMem = uintArrayToString(base.merkleRoot)
    }
    const finalPath = source.fileMeta ? path : pathParts.join('/')
    return new MetaHandler(finalPath, base)
  }

  addToCount(value: number): number {
    const num = hexToInt(this.meta.count)
    const updatedCount = num + value
    this.meta.count = intToHex(updatedCount)
    return updatedCount
  }

  setRefIndex(refIndex: number): void {
    this.refIndex = intToHex(refIndex)
  }

  getPath(): string {
    return this.path
  }

  getCount(): number {
    return hexToInt(this.meta.count)
  }

  getRefIndex(): string {
    return this.refIndex
  }

  getNullMeta(): INullMetaData {
    if (this.meta.removed) {
      const filtered = [...this.baseKeys, 'removed'].reduce(
        (obj, key) => ({ ...obj, [key]: this.meta[key] }),
        {},
      )
      const ret = filtered as INullMetaData
      ret.metaDataType = 'null'
      return ret
    } else {
      throw new Error(
        warnError(
          'MetaHandler getNullMeta()',
          'Requested MetaData type "Null" unavailable',
        ),
      )
    }
  }

  getFolderMeta(): IFolderMetaData {
    if (this.meta.whoAmI) {
      const filtered = [...this.baseKeys, 'whoAmI', 'count'].reduce(
        (obj, key) => ({ ...obj, [key]: this.meta[key] }),
        {},
      )
      const ret = filtered as IFolderMetaData
      ret.metaDataType = 'folder'
      return ret
    } else {
      throw new Error(
        warnError(
          'MetaHandler getFolderMeta()',
          'Requested MetaData type "Folder" unavailable',
        ),
      )
    }
  }

  getFileMeta(): IFileMetaData {
    if (this.meta.fileMeta.name) {
      const filtered = [
        ...this.baseKeys,
        'merkleRoot',
        'merkleMem',
        'fileMeta',
      ].reduce((obj, key) => ({ ...obj, [key]: this.meta[key] }), {})
      const ret = filtered as IFileMetaData
      ret.metaDataType = 'file'
      return ret
    } else {
      throw new Error(
        warnError(
          'MetaHandler getFileMeta()',
          'Requested MetaData type "File" unavailable',
        ),
      )
    }
  }

  getShareFolderMeta(): IShareFolderMetaData {
    if (this.meta.whoAmI) {
      const filtered = [
        ...this.baseKeys,
        'whoAmI',
        'count',
        'pointsTo',
        'label',
      ].reduce((obj, key) => ({ ...obj, [key]: this.meta[key] }), {})
      const ret = filtered as IShareFolderMetaData
      ret.location = `${this.path}/${this.refIndex}`
      ret.pointsTo = this.meta.location
      ret.metaDataType = 'sharefolder'
      return ret
    } else {
      throw new Error(
        warnError(
          'MetaHandler getShareFolderMeta()',
          'Requested MetaData type "Folder" unavailable',
        ),
      )
    }
  }

  getShareMeta(): IShareMetaData {
    const filtered = [...this.baseKeys, 'pointsTo', 'owner'].reduce(
      (obj, key) => ({ ...obj, [key]: this.meta[key] }),
      {},
    )
    const ret = filtered as IShareMetaData
    ret.metaDataType = 'share'
    return ret
  }

  getRefMeta(): IRefMetaData {
    const filtered = [...this.baseKeys, 'pointsTo'].reduce(
      (obj, key) => ({ ...obj, [key]: this.meta[key] }),
      {},
    )
    const ret = filtered as IRefMetaData
    ret.location = `${this.path}/${this.refIndex}`
    ret.pointsTo = this.meta.location
    ret.metaDataType = 'ref'
    return ret
  }

  getShareRefMeta(): IShareRefMetaData {
    const meta = this.getRefMeta()
    meta.metaDataType = 'shareref'
    return meta
  }
}
