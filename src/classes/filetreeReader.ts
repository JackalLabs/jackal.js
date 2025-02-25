import {
  IAesBundle,
  IChildMetaDataMap,
  IClientHandler,
  ICreateViewAccessOptions,
  IEncodeExistingRefOptions,
  IFileMeta,
  IFileMetaData,
  IFileMetaHandler,
  IFileTreeOptions,
  IFiletreeReader,
  IFolderMetaData,
  IFolderMetaHandler,
  ILegacyFolderMetaData,
  ILoadMetaOptions,
  ILoadRefMetaOptions,
  IMetaDataByUlidOptions,
  INotificationRecord,
  INullRefMetaData,
  INullSharerRefMetaData,
  IPathToLookupOptions,
  IPrivateNotification,
  IReadFolderContentOptions,
  IReconstructedFileTree,
  IRefMetaData,
  IShareMetaData,
  ISharerRefMetaData,
  ISharingLookupOptions,
  IViewerSetAddRemove,
  TSetMetaViewersOptions,
} from '@/interfaces'
import type { PrivateKey } from 'eciesjs'
import type {
  DFile,
  DMsgFileTreePostFile,
  DMsgProvisionFileTree,
  DNotification,
  DQueryFileTreeFile,
  TJackalSigningClient,
} from '@jackallabs/jackal.js-protos'
import { warnError } from '@/utils/misc'
import { hashAndHex, hashAndHexOwner, hashAndHexUserAccess, merklePath, merklePathPlusIndex } from '@/utils/hash'
import {
  hexToInt,
  intToHex,
  prepDecompressionForAmino,
  safeDecompressData,
  safeParseFileTree,
  safeParseLegacyMerkles,
  safeStringifyFileTree,
} from '@/utils/converters'
import {
  aesToString,
  compressEncryptString,
  cryptString,
  genAesBundle,
  linkPrivateKey,
  stringToAes,
} from '@/utils/crypt'
import { TConversionPair, TExtractedViewAccess, TMerkleParentChild, TMetaDataSets } from '@/types'
import { FileMetaHandler, FolderMetaHandler, NullMetaHandler } from '@/classes/metaHandlers'

export class FiletreeReader implements IFiletreeReader {
  protected readonly jackalClient: IClientHandler
  protected readonly jackalSigner: TJackalSigningClient
  protected readonly keyPair: PrivateKey
  protected readonly defaultKeyPair: PrivateKey
  protected readonly clientAddress: string

  protected ulidLeaves: Record<string, Record<string, string>>
  protected sharerRefs: Record<string, Record<string, number>>
  protected sharers: Record<string, IFolderMetaData>
  protected sharingLeaves: Record<string, IShareMetaData[]>
  protected viewerLeaves: Record<string, Record<string, string>>
  protected viewerShares: Record<string, string[]>
  protected directoryLeaves: Record<string, Record<string, IChildMetaDataMap>>
  protected directoriesByUlid: Record<string, Record<string, IChildMetaDataMap>>
  protected yellowpages: Record<string, Record<string, DQueryFileTreeFile>>
  protected legacyMetaLeaves: Record<string, ILegacyFolderMetaData>
  protected refCounts: Record<string, number>
  protected sharerCounts: Record<string, number>
  protected conversionQueue: string[]
  protected nullConversions: string[]

  constructor (
    jackalClient: IClientHandler,
    jackalSigner: TJackalSigningClient,
    keyPair: PrivateKey,
    defaultKeyPair: PrivateKey,
    ownerAddress: string,
  ) {
    this.jackalClient = jackalClient
    this.jackalSigner = jackalSigner
    this.keyPair = keyPair
    this.defaultKeyPair = defaultKeyPair
    this.clientAddress = ownerAddress

    this.ulidLeaves = {}
    this.ulidLeaves[ownerAddress] = {}
    this.sharerRefs = {}
    this.sharers = {}
    this.sharingLeaves = {}
    this.viewerLeaves = {}
    this.viewerShares = {}
    this.directoryLeaves = {}
    this.directoryLeaves[ownerAddress] = {}
    this.directoriesByUlid = {}
    this.directoriesByUlid[ownerAddress] = {}
    this.yellowpages = {}
    this.yellowpages[ownerAddress] = {}
    this.legacyMetaLeaves = {}
    this.refCounts = {}
    this.sharerCounts = {}
    this.conversionQueue = []
    this.nullConversions = []
  }

  /**
   *
   * @param {string} path
   * @returns {Promise<string[]>}
   */
  async sharersRead (path: string): Promise<string[]> {
    try {
      return await this.loadSharerRefs(path)
    } catch (err) {
      throw warnError('filetreeReader sharersRead()', err)
    }
  }

  /**
   *
   * @param {string} path
   * @param {string} sharer
   * @returns {Promise<number>}
   */
  async sharerRefRead (path: string, sharer: string): Promise<number> {
    try {
      await this.loadSharerRefs(path)
      if (sharer in this.sharerRefs[path]) {
        return this.sharerRefs[path][sharer]
      } else {
        throw new Error('Invalid Ref')
      }
    } catch (err) {
      throw warnError('filetreeReader sharerRefRead()', err)
    }
  }

  /**
   *
   * @param {string} path
   * @returns {Promise<number>}
   */
  async refCountRead (path: string): Promise<number> {
    try {
      if (path in this.refCounts) {
        return this.refCounts[path]
      } else {
        const meta = await this.loadFolderMetaByPath(path)
        const count = hexToInt(meta.count)
        this.refCountSet(path, count)
        return count
      }
    } catch (err) {
      throw warnError('filetreeReader refCountRead()', err)
    }
  }

  /**
   *
   * @param {string} path
   */
  refCountIncrement (path: string): void {
    if (this.refCounts[path]) {
      this.refCounts[path]++
    } else {
      this.refCounts[path] = 1
    }
  }

  /**
   *
   * @param {string} path
   * @param {number} value
   */
  refCountSet (path: string, value: number): void {
    if (!this.refCounts[path]) {
      this.refCounts[path] = value
    }
  }

  /**
   *
   * @param {string} [sharer]
   * @returns {Promise<[number, number]>}
   */
  async readSharingRefCount (sharer?: string): Promise<[number, number]> {
    try {
      if (!sharer) {
        try {
          const count = await this.refCountRead('Shared')
          return [0, count]
        } catch {
          this.refCountSet('Shared', 0)
          return [1, 0]
        }
      } else {
        const target = `Shared/${sharer}`
        try {
          const targetCount = await this.refCountRead(target)
          return [0, targetCount]
        } catch {
          try {
            await this.refCountRead('Shared')
            this.refCountSet(target, 0)
            return [2, 0]
          } catch {
            this.refCountSet('Shared', 0)
            this.refCountSet(target, 0)
            return [1, 0]
          }
        }
      }
    } catch (err) {
      throw warnError('filetreeReader readSharingRefCount()', err)
    }
  }

  /**
   *
   * @param {string} ulid
   * @returns {Promise<number>}
   */
  async sharerCountRead (ulid: string): Promise<number> {
    try {
      if (ulid in this.sharerCounts) {
        return this.sharerCounts[ulid]
      } else {
        let meta = await this.loadMetaByUlid({ ulid })
        if (meta.metaDataType === 'folder' || meta.metaDataType === 'file') {
          meta = meta as IFolderMetaData | IFileMetaData
          const count = hexToInt(meta.sharerCount || '')
          this.sharerCountSet(ulid, count)
          return count
        } else {
          throw new Error('Invalid meta type')
        }
      }
    } catch (err) {
      throw warnError('filetreeReader sharerCountRead()', err)
    }
  }

  /**
   *
   * @param {string} ulid
   */
  sharerCountIncrement (ulid: string): void {
    if (this.sharerCounts[ulid]) {
      this.sharerCounts[ulid]++
    } else {
      this.sharerCounts[ulid] = 1
    }
  }

  /**
   *
   * @param {string} ulid
   * @param {number} value
   */
  sharerCountSet (ulid: string, value: number): void {
    if (!this.sharerCounts[ulid]) {
      this.sharerCounts[ulid] = value
    }
  }

  /**
   *
   * @returns {number}
   */
  getConversionQueueLength (): number {
    return this.conversionQueue.length
  }

  /**
   *
   * @returns {Promise<TConversionPair[]>}
   */
  async getConversions (): Promise<TConversionPair[]> {
    try {
      const final: TConversionPair[] = []
      for (let ulid of this.conversionQueue) {
        if (ulid === '-1') {
          continue
        }
        const meta = await this.loadMetaByUlid({ ulid })

        if (meta.metaDataType === 'file') {
          const parent = meta.location.split('/').slice(-1)[0]
          const { files } = this.readDirectoryLeafByUlid(parent)
          for (let index of Object.keys(files)) {
            if (files[Number(index)].fileMeta.name === meta.fileMeta.name) {
              const refIndex = Number(index)
              const handler = await FileMetaHandler.create({ clone: meta, refIndex })
              final.push([meta.metaDataType, handler])
              break
            }
          }
        } else if (meta.metaDataType === 'null') {
          const parent = meta.location.split('/').slice(-1)[0]
          if (this.nullConversions.includes(parent)) {
            const handler = await NullMetaHandler.create({
              location: parent,
              refIndex: -1,
              ulid,
            })
            final.push([meta.metaDataType, handler])
          } else {
            this.nullConversions.push(parent)
            const { nulls } = this.readDirectoryLeafByUlid(parent)
            for (let index of Object.keys(nulls)) {
              const handler = await NullMetaHandler.create({
                location: parent,
                refIndex: Number(index),
                ulid,
              })
              final.push([meta.metaDataType, handler])
            }
          }
        } else if (meta.metaDataType === 'folder') {
          const parent = meta.location.split('/').slice(-1)[0]
          if (parent.length < 26) {
            const handler = await FolderMetaHandler.create({
              count: hexToInt(meta.count),
              description: meta.description,
              location: meta.whoAmI,
              name: meta.whoAmI,
              refIndex: 0,
              ulid,
            })
            final.push([meta.metaDataType, handler])
          } else {
            const { folders } = this.readDirectoryLeafByUlid(parent)
            for (let index of Object.keys(folders)) {
              if (folders[Number(index)].whoAmI === meta.whoAmI) {
                const refIndex = Number(index)
                const handler = await FolderMetaHandler.create({
                  count: hexToInt(meta.count),
                  description: meta.description,
                  location: parent,
                  name: meta.whoAmI,
                  refIndex,
                  ulid,
                })
                final.push([meta.metaDataType, handler])
                break
              }
            }
          }

        } else if (meta.metaDataType === 'rootlookup') {
          const handler = await FolderMetaHandler.create({
            count: 0,
            location: 'ulid',
            name: 'Home',
            ulid: meta.ulid,
          })
          final.push([meta.metaDataType, handler])
        }
      }
      this.conversionQueue = []
      this.nullConversions = []
      return final
    } catch (err) {
      throw warnError('filetreeReader getConversions()', err)
    }
  }

  /**
   *
   * @param {ISharingLookupOptions} [options]
   * @returns {Promise<string[]>}
   */
  async sharingLookup (options: ISharingLookupOptions = {}): Promise<IFolderMetaData[] | IShareMetaData[]> {
    try {
      if (!options.sharer) {
        let sharers = Object.values(this.sharers)
        if (options.refresh || sharers.length === 0) {
          await this.pathToLookup({ path: 'Shared' })
          return Object.values(this.sharers)
        } else {
          return sharers
        }
      } else {
        if (options.refresh) {
          await this.sharingToLookup(options.sharer)
        }
        if (this.sharingLeaves[`Shared/${options.sharer}`]) {
          return this.sharingLeaves[`Shared/${options.sharer}`]
        } else {
          throw new Error('No Sharer Found')
        }
      }
    } catch (err) {
      throw warnError('filetreeReader sharingLookup()', err)
    }
  }

  /**
   *
   * @param {string} ulid
   * @param {number} [index]
   * @returns {string[]}
   */
  readViewerShares (ulid: string, index?: number): string[] {
    const reference = (typeof index !== 'undefined') ? `${ulid}/${intToHex(index)}` : ulid
    if (this.viewerShares[reference]) {
      return this.viewerShares[reference]
    } else {
      throw warnError('filetreeReader readViewerShares()', new Error('Not Found'))
    }
  }

  /**
   *
   * @param {string} ulid
   * @param {Record<string, string>} access
   * @param {number} [index]
   */
  viewerSave (ulid: string, access: Record<string, string>, index?: number): void {
    const reference = (typeof index !== 'undefined') ? `${ulid}/${intToHex(index)}` : ulid
    this.viewerLeaves[reference] = access
  }

  /**
   *
   * @param {string} ulid
   * @param {number} [index]
   * @returns {Promise<Record<string, string>>}
   */
  async viewerLookup (ulid: string, index?: number): Promise<Record<string, string>> {
    try {
      const reference = (typeof index !== 'undefined') ? `${ulid}/${intToHex(index)}` : ulid
      if (!this.viewerLeaves[reference]) {
        let hexAddress
        if (typeof index !== 'undefined') {
          hexAddress = await merklePathPlusIndex(`s/ulid/${ulid}`, index)
        } else {
          hexAddress = await merklePath(`s/ulid/${ulid}`)
        }
        const lookup = {
          address: hexAddress,
          ownerAddress: await hashAndHexOwner(hexAddress, this.clientAddress),
        }
        const { file } = await this.jackalSigner.queries.fileTree.file(lookup)
        const viewAccess: Record<string, string> = JSON.parse(file.viewingAccess)
        await this.loadSharedWith(ulid, index)
        this.viewerSave(reference, viewAccess)
        return viewAccess
      } else {
        return this.viewerLeaves[reference]
      }
    } catch (err) {
      throw warnError('filetreeReader viewerLookup()', err)
    }
  }

  /**
   * Look up Filetree ulid by path.
   * @param {string} path - Path of resource.
   * @param {string} [owner] - Optional owner in case of 3rd party owner.
   * @returns {string} - Found ulid.
   */
  ulidLookup (path: string, owner?: string): string {
    const ownerAddress = owner || this.clientAddress
    if (this.ulidLeaves[ownerAddress][path]) {
      return this.ulidLeaves[ownerAddress][path]
    } else {
      throw warnError('filetreeReader ulidLookup()', new Error('No Resource Found'))
    }
  }

  /**
   * Use path to find ref index of resource.
   * @param {string} path - Path of resource to find.
   * @returns {number}
   */
  findRefIndex (path: string): number {
    const segments = path.split('/')
    const parentPath = segments.slice(0, -1).join('/')
    const target = segments.slice(-1)[0]
    const details = this.readDirectoryLeafByPath(parentPath)

    for (let index of Object.keys(details.folders)) {
      const ref = Number(index)
      if (details.folders[ref].whoAmI === target) {
        return ref
      }
    }

    for (let index of Object.keys(details.files)) {
      const ref = Number(index)
      if (details.files[ref].fileMeta.name === target) {
        return ref
      }
    }

    return -1
  }

  /**
   * Look up contents of folder.
   * @param {string} path - Path of resource.
   * @param {IReadFolderContentOptions} [options] - Optional options of owner in case of 3rd party owner and if folder contents should be refreshed.
   * @returns {IChildMetaDataMap} - Contents structure.
   */
  async readFolderContents (path: string, options: IReadFolderContentOptions = {}): Promise<IChildMetaDataMap> {
    const {
      owner = this.clientAddress,
      refresh = false,
      linkKey,
    } = options
    try {
      if (this.directoryLeaves[owner] && this.directoryLeaves[owner][path] && !refresh) {
        return this.readDirectoryLeafByPath(path, owner)
      } else {
        if (!this.yellowpages[owner] || !this.yellowpages[owner][path]) {
          await this.pathToLookup({ linkKey, owner, path })
        } else {
          await this.pathToLookupPostProcess(path, owner, this.yellowpages[owner][path], linkKey)
        }
        return this.readDirectoryLeafByPath(path, owner)
      }
    } catch (err) {
      throw warnError('filetreeReader readFolderContents()', err)
    }
  }

  /**
   * Look up folder meta data by path.
   * @param {string} path - Path of resource.
   * @returns {Promise<IFolderMetaData>}
   */
  async loadFolderMetaByPath (path: string): Promise<IFolderMetaData> {
    try {
      const lookup = await this.pathToLookup({ path })
      const { file } = await this.jackalSigner.queries.fileTree.file(lookup)
      const id = this.ulidLookup(path)
      return await this.loadFolderMeta(file, id)
    } catch (err) {
      throw warnError('filetreeReader loadFolderMetaByPath()', err)
    }
  }

  /**
   * Look up folder meta data by ulid.
   * @param {string} ulid - ULID of resource.
   * @returns {Promise<IFolderMetaData>}
   */
  async loadFolderMetaByUlid (ulid: string): Promise<IFolderMetaData> {
    try {
      const hexRootAddress = await merklePath(`s/ulid/${ulid}`)
      const lookup = {
        address: hexRootAddress,
        ownerAddress: await hashAndHexOwner(
          hexRootAddress,
          this.clientAddress,
        ),
      }
      const { file } = await this.jackalSigner.queries.fileTree.file(lookup)
      return await this.loadFolderMeta(file, ulid)
    } catch (err) {
      throw warnError('filetreeReader loadFolderMetaByUlid()', err)
    }
  }

  /**
   * Look up folder meta data handler.
   * @param {string} path - Path of resource.
   * @returns {Promise<IFolderMetaHandler>}
   */
  async loadFolderMetaHandler (path: string): Promise<IFolderMetaHandler> {
    try {
      const lookup = await this.pathToLookup({ path })
      // console.log("lookup:", lookup)
      const { file } = await this.jackalSigner.queries.fileTree.file(lookup)
      // console.log("File: ", file)
      const { contents } = file
      const isCleartext = contents.includes('metaDataType')
      const access = await this.checkViewAuthorization(file, isCleartext)
      if (access) {
        let parsed
        if (!isCleartext) {
          const id = this.ulidLookup(path)
          parsed = await this.decryptAndParseContents(file, id)
        } else {
          parsed = safeParseFileTree(contents)
        }
        if (parsed.metaDataType === 'folder') {
          const { count, description, location, whoAmI } = parsed
          return await FolderMetaHandler.create({
            count: hexToInt(count),
            description,
            location,
            name: whoAmI,
            ulid: this.ulidLeaves[this.clientAddress][path],
          })
        } else {
          throw new Error('Invalid Meta')
        }
      } else {
        throw new Error('Not Authorized')
      }
    } catch (err) {
      throw warnError('filetreeReader loadFolderMetaHandler()', err)
    }
  }

  /**
   * Look up sharing meta data.
   * @param {string} path - Path of resource.
   * @returns {Promise<IShareMetaData>}
   */
  async loadShareMeta (path: string): Promise<IShareMetaData> {
    try {
      const lookup = await this.pathToLookup({ path })
      const { file } = await this.jackalSigner.queries.fileTree.file(lookup)
      const { contents } = file
      const isCleartext = contents.includes('metaDataType')
      const access = await this.checkViewAuthorization(file, isCleartext)
      if (access) {
        let parsed
        if (!isCleartext) {
          const id = this.ulidLookup(path)
          parsed = await this.decryptAndParseContents(file, id)
        } else {
          parsed = safeParseFileTree(contents)
        }
        if (parsed.metaDataType === 'share') {
          return parsed
        } else {
          throw new Error('Invalid Meta')
        }
      } else {
        throw new Error('Not Authorized')
      }
    } catch (err) {
      throw warnError('filetreeReader loadShareMeta()', err)
    }
  }

  /**
   * Look up ref meta data by ulid.
   * @param {ILoadRefMetaOptions} options
   * @returns {Promise<IRefMetaData | INullRefMetaData>}
   */
  async loadRefMeta (options: ILoadRefMetaOptions): Promise<IRefMetaData | INullRefMetaData> {
    try {
      const {
        ref,
        ulid,
        linkKey,
        ownerAddress = this.clientAddress,
      } = options
      const hexAddress = await merklePathPlusIndex(`s/ulid/${ulid}`, ref)
      const lookup = {
        address: hexAddress,
        ownerAddress: await hashAndHexOwner(hexAddress, ownerAddress),
      }
      const { file } = await this.jackalSigner.queries.fileTree.file(lookup)
      const meta = await this.loadMeta({ file, linkKey, ulid: '-1' })
      return (meta.metaDataType === 'ref') ? meta as IRefMetaData : meta as INullRefMetaData
    } catch (err) {
      throw warnError('filetreeReader loadRefMeta()', err)
    }
  }

  /**
   *
   * @param {string} ulid
   * @param {number} ref
   * @returns {Promise<ISharerRefMetaData | INullSharerRefMetaData>}
   */
  async loadSharerRefMeta (ulid: string, ref: number): Promise<ISharerRefMetaData | INullSharerRefMetaData> {
    try {
      const hexAddress = await merklePath(`s/ulid/${ulid}/s-${intToHex(ref)}`)
      const lookup = {
        address: hexAddress,
        ownerAddress: await hashAndHexOwner(hexAddress, this.clientAddress),
      }
      const { file } = await this.jackalSigner.queries.fileTree.file(lookup)
      const meta = await this.loadMeta({ file, ulid: '-1' })
      return (meta.metaDataType === 'sharerref') ? meta as ISharerRefMetaData : meta as INullSharerRefMetaData
    } catch (err) {
      throw warnError('filetreeReader loadSharerRefMeta()', err)
    }
  }

  /**
   * Look up legacy file meta data.
   * @param {Uint8Array[]} legacyMerkles - Array of legacy file merkle tree hashes.
   * @param {[string, string]} legacyPath - Tuple of legacy path structure.
   * @returns {Promise<IFileMetaData>}
   */
  async loadLegacyMeta (
    legacyMerkles: Uint8Array[],
    legacyPath: [string, string],
  ): Promise<IFileMetaData> {
    try {
      const [parentPath, name] = legacyPath
      const parent =
        this.legacyMetaLeaves[parentPath] || (await this.loadMetaByPath(parentPath))
      if (parent.fileChildren) {
        const meta = await FileMetaHandler.create({
          fileMeta: parent.fileChildren[name],
          legacyMerkles,
          location: '',
        })
        return meta.export()
      } else {
        throw new Error()
      }
    } catch (err) {
      throw warnError('filetreeReader loadLegacyMeta()', err)
    }
  }

  /**
   *
   * @param {IMetaDataByUlidOptions} options
   * @returns {Promise<TMetaDataSets>}
   */
  async loadMetaByUlid (options: IMetaDataByUlidOptions): Promise<TMetaDataSets> {
    try {
      const {
        ulid,
        userAddress = this.clientAddress,
        linkKey,
      } = options
      const hexAddress = await merklePath(`s/ulid/${ulid}`)
      const lookup = {
        address: hexAddress,
        ownerAddress: await hashAndHexOwner(hexAddress, userAddress),
      }
      const { file } = await this.jackalSigner.queries.fileTree.file(lookup)
      return await this.loadMeta({ file, linkKey, ulid })
    } catch (err) {
      throw warnError('filetreeReader loadMetaByUlid()', err)
    }
  }

  /**
   * Look up meta data by path (self owned).
   * @param {string} path - Path of resource.
   * @returns {Promise<TMetaDataSets>}
   */
  async loadMetaByPath (path: string): Promise<TMetaDataSets> {
    try {
      return await this.loadMetaByExternalPath(path, this.clientAddress)
    } catch (err) {
      throw warnError('filetreeReader loadMetaByPath()', err)
    }
  }

  /**
   * Look up meta data by path (3rd party owner).
   * @param {string} path - Path of resource.
   * @param {string} ownerAddress
   * @returns {Promise<TMetaDataSets>}
   */
  async loadMetaByExternalPath (
    path: string,
    ownerAddress: string,
  ): Promise<TMetaDataSets> {
    try {
      const lookup = await this.pathToLookup({ owner: ownerAddress, path })
      const { file } = await this.jackalSigner.queries.fileTree.file(lookup)
      const pathSet = path.split('/')
      const legacyPath: [string, string] = [
        pathSet.slice(0, -1).join('/'),
        pathSet.slice(-1)[0],
      ]
      const id = this.ulidLookup(path, ownerAddress)
      return await this.loadMeta({ file, ulid: id, legacyPath })
    } catch (err) {
      throw warnError('filetreeReader loadMetaByExternalPath()', err)
    }
  }

  /**
   *
   * @param {string} ulid
   * @param {string} ownerAddress
   * @param {string} [linkKey]
   * @returns {Promise<TMetaDataSets>}
   */
  async loadMetaByExternalUlid (
    ulid: string,
    ownerAddress: string,
    linkKey?: string,
  ): Promise<TMetaDataSets> {
    try {
      const hexAddress = await merklePath(`s/ulid/${ulid}`)
      const lookup = {
        address: hexAddress,
        ownerAddress: await hashAndHexOwner(hexAddress, ownerAddress),
      }
      const { file } = await this.jackalSigner.queries.fileTree.file(lookup)
      return await this.loadMeta({ file, ulid, linkKey })
    } catch (err) {
      throw warnError('filetreeReader loadMetaByExternalUlid()', err)
    }
  }

  /**
   * Look up file meta data handler for legacy file.
   * @param {string} path - Path of resource.
   * @param {string} location - Parent ulid of nested folder.
   * @param {IFileMeta} fileMeta - File details.
   * @returns {Promise<IFileMetaHandler>} - File meta data handler.
   */
  async loadFromLegacyMerkles (
    path: string,
    location: string,
    fileMeta: IFileMeta,
  ): Promise<IFileMetaHandler> {
    try {
      const lookup = await this.pathToLookup({ path })
      const { file } = await this.jackalSigner.queries.fileTree.file(lookup)
      const { contents } = file
      const access = await this.checkViewAuthorization(file, false)

      if (access) {
        const { legacyMerkles } = safeParseLegacyMerkles(contents)
        return await FileMetaHandler.create({
          fileMeta,
          legacyMerkles,
          location,
        })
      } else {
        throw new Error('Not Authorized')
      }
    } catch (err) {
      throw warnError('filetreeReader loadFromLegacyMerkles()', err)
    }
  }

  /**
   * Write list of authorized readers of Filetree data.
   * @param {TSetMetaViewersOptions} options
   * @returns {Promise<IReconstructedFileTree>}
   */
  async setMetaViewers (options: TSetMetaViewersOptions): Promise<IReconstructedFileTree> {
    try {
      let lookup, curr, ulid
      if ('path' in options) {
        curr = options.path
        ulid = this.ulidLookup(options.path)
        lookup = await this.pathToLookup({ path: options.path })
      } else {
        const hexAddress = await merklePath(`s/ulid/${options.ulid}`)
        curr = options.ulid
        ulid = options.ulid
        lookup = {
          address: hexAddress,
          ownerAddress: await hashAndHexOwner(hexAddress, this.clientAddress),
        }
      }
      const { file } = await this.jackalSigner.queries.fileTree.file(lookup)
      let { contents, trackingNumber } = file
      const isCleartext = contents.includes('metaDataType')
      const access = await this.checkViewAuthorization(file, isCleartext)

      if (access) {
        if (isCleartext) {
          if (ulid in this.sharerCounts) {
            const working = JSON.parse(contents)
            let mH
            if ('count' in working) {
              mH = await FolderMetaHandler.create({ clone: working, ulid })
            } else {
              mH = await FileMetaHandler.create({ clone: working })
            }
            const sharers = await this.sharerCountRead(ulid)
            mH.setSharerCount(sharers)
            const ready = mH.export()
            contents = JSON.stringify(ready)
          }
          return {
            contents,
            viewers: await this.createViewAccess({ trackingNumber, viewers: options.viewers, ulid }),
            editors: await this.createEditAccess(trackingNumber),
            trackingNumber,
          }
        } else if (contents.length > 0) {
          const aes = await this.extractViewAccess(file)
          if (aes[1]) {
            throw new Error('Requires rekey')
          }
          if (ulid in this.sharerCounts) {
            const safeContents = prepDecompressionForAmino(contents)
            let decrypted = await cryptString(safeContents, aes[0], 'decrypt')
            if (decrypted.startsWith('jklpc')) {
              decrypted = safeDecompressData(decrypted)
            }
            const working = safeParseFileTree(decrypted)
            let mH
            if ('count' in working) {
              mH = await FolderMetaHandler.create({ clone: working, ulid })
            } else {
              mH = await FileMetaHandler.create({ clone: working as IFileMetaData })
            }
            const sharers = await this.sharerCountRead(ulid)
            mH.setSharerCount(sharers)
            const ready = JSON.stringify(mH.export())
            contents = await compressEncryptString(
              ready,
              aes[0],
              this.jackalClient.getIsLedger(),
            )
          }
          return {
            contents,
            viewers: await this.createViewAccess({
              trackingNumber,
              viewers: options.viewers,
              aes: aes[0],
              ulid,
            }),
            editors: await this.createEditAccess(trackingNumber),
            trackingNumber,
          }
        } else {
          throw new Error(`Empty contents for ${curr}`)
        }
      } else {
        throw new Error('Not Authorized')
      }
    } catch (err) {
      throw warnError('filetreeReader setMetaViewers()', err)
    }
  }

  async setContents (ulid: string, meta: TMetaDataSets): Promise<IReconstructedFileTree> {
    try {
      let lookup
      const hexAddress = await merklePath(`s/ulid/${ulid}`)
      lookup = {
        address: hexAddress,
        ownerAddress: await hashAndHexOwner(hexAddress, this.clientAddress),
      }
      const { file } = await this.jackalSigner.queries.fileTree.file(lookup)
      let { contents, viewingAccess, editAccess, trackingNumber } = file
      const isCleartext = contents.includes('metaDataType')
      const access = await this.checkViewAuthorization(file, isCleartext)
      if (access) {
        if (isCleartext) {
          return {
            contents: JSON.stringify(meta),
            viewers: viewingAccess,
            editors: editAccess,
            trackingNumber,
          }
        } else if (contents.length > 0) {
          const aes = await this.extractViewAccess(file)
          if (aes[1]) {
            throw new Error('Requires rekey')
          }
          const ready = JSON.stringify(meta)
          contents = await compressEncryptString(
            ready,
            aes[0],
            this.jackalClient.getIsLedger(),
          )
          return {
            contents,
            viewers: viewingAccess,
            editors: editAccess,
            trackingNumber,
          }
        } else {
          throw new Error(`Empty contents for ${ulid}`)
        }
      } else {
        throw new Error('Not Authorized')
      }
    } catch (err) {
      throw warnError('filetreeReader setContents()', err)
    }
  }

  /**
   * Look up AES keys for Filetree item by path.
   * @param {string} path - Path of resource.
   * @param {string} ownerAddress - Owner of resource.
   * @returns {Promise<IAesBundle>}
   */
  async loadKeysByPath (
    path: string,
    ownerAddress: string,
  ): Promise<IAesBundle> {
    try {
      const lookup = await this.pathToLookup({ owner: ownerAddress, path })
      const { file } = await this.jackalSigner.queries.fileTree.file(lookup)
      const aes = await this.extractViewAccess(file)
      return aes[0]
    } catch (err) {
      throw warnError('filetreeReader loadKeysByPath()', err)
    }
  }

  /**
   * Look up AES keys for Filetree item by ulid.
   * @param {string} ulid - Ulid of resource.
   * @param {string} ownerAddress - Owner of resource.
   * @param {string} [linkKey] - Key to unlock link shared data.
   * @returns {Promise<IAesBundle>}
   */
  async loadKeysByUlid (
    ulid: string,
    ownerAddress: string,
    linkKey?: string,
  ): Promise<IAesBundle> {
    try {
      const hexAddress = await merklePath(`s/ulid/${ulid}`)
      const lookup = {
        address: hexAddress,
        ownerAddress: await hashAndHexOwner(hexAddress, ownerAddress),
      }
      const { file } = await this.jackalSigner.queries.fileTree.file(lookup)
      const aes = await this.extractViewAccess(file, linkKey)
      return aes[0]
    } catch (err) {
      throw warnError('filetreeReader loadKeysByUlid()', err)
    }
  }

  /**
   *
   * @param {string} ulid
   * @param {string} ownerAddress
   * @returns {Promise<boolean>}
   */
  async livenessCheck (ulid: string, ownerAddress: string): Promise<boolean> {
    try {
      const hexAddress = await merklePath(`s/ulid/${ulid}`)
      const lookup = {
        address: hexAddress,
        ownerAddress: await hashAndHexOwner(hexAddress, ownerAddress),
      }
      const { file } = await this.jackalSigner.queries.fileTree.file(lookup)
      let ready
      try {
        ready = await this.loadMeta({ file, ulid: '-1' })
      } catch {
        ready = {}
      }
      const accepted = ['file', 'folder']
      if (ready.metaDataType && accepted.includes(ready.metaDataType)) {
        return true
      } else {
        return false
      }
    } catch (err) {
      throw warnError('filetreeReader livenessCheck()', err)
    }
  }

  /**
   *
   * @returns {Promise<DMsgProvisionFileTree>}
   */
  async encodeProvisionFileTree (): Promise<DMsgProvisionFileTree> {
    try {
      const trackingNumber = crypto.randomUUID()
      return {
        creator: this.clientAddress,
        viewers: await this.createViewAccess({ trackingNumber, viewers: { overwrite: [] } }),
        editors: await this.createEditAccess(trackingNumber),
        trackingNumber: trackingNumber,
      }
    } catch (err) {
      throw warnError('filetreeReader encodeProvisionFileTree()', err)
    }
  }

  /**
   *
   * @param {TMerkleParentChild} location
   * @param {TMetaDataSets} meta
   * @param {IFileTreeOptions} [options]
   * @returns {Promise<DMsgFileTreePostFile>}
   */
  async encodePostFile (
    location: TMerkleParentChild,
    meta: TMetaDataSets,
    options: IFileTreeOptions = {},
  ): Promise<DMsgFileTreePostFile> {
    try {
      const { additionalViewers = [], aes = null } = options
      const [hashParent, hashChild] = location
      const forFileTree: DMsgFileTreePostFile = {
        creator: this.clientAddress,
        account: await hashAndHex(this.clientAddress),
        hashParent,
        hashChild,
        contents: '',
        viewers: '',
        editors: '',
        trackingNumber: '',
      }
      const trackingNumber = crypto.randomUUID()
      const stringedMeta = safeStringifyFileTree(meta)
      if (aes) {
        forFileTree.contents = await compressEncryptString(
          stringedMeta,
          aes,
          this.jackalClient.getIsLedger(),
        )
        forFileTree.viewers = await this.createViewAccess({
          trackingNumber,
          viewers: { overwrite: additionalViewers },
          aes,
        })
        forFileTree.editors = await this.createEditAccess(trackingNumber)
        forFileTree.trackingNumber = trackingNumber
      } else {
        forFileTree.contents = stringedMeta
        forFileTree.viewers = await this.createViewAccess({
          trackingNumber,
          viewers: { overwrite: additionalViewers },
        })
        forFileTree.editors = await this.createEditAccess(trackingNumber)
        forFileTree.trackingNumber = trackingNumber
      }
      return forFileTree
    } catch (err) {
      throw warnError('filetreeReader encodePostFile()', err)
    }
  }

  /**
   *
   * @param {string} ulid
   * @param {TMerkleParentChild} location
   * @param {IViewerSetAddRemove} viewers
   * @returns {Promise<DMsgFileTreePostFile>}
   */
  async encodeExistingPostFile (
    ulid: string,
    location: TMerkleParentChild,
    viewers: IViewerSetAddRemove,
  ): Promise<DMsgFileTreePostFile> {
    try {
      const [hashParent, hashChild] = location
      const ready = await this.setMetaViewers({ ulid, viewers })
      return {
        creator: this.clientAddress,
        account: await hashAndHex(this.clientAddress),
        hashParent,
        hashChild,
        ...ready,
      }
    } catch (err) {
      throw warnError('filetreeReader encodeExistingPostFile()', err)
    }
  }

  async updateExistingPostFile (
    ulid: string,
    location: TMerkleParentChild,
    meta: TMetaDataSets,
  ): Promise<DMsgFileTreePostFile> {
    try {
      const [hashParent, hashChild] = location
      const ready = await this.setContents(ulid, meta)
      return {
        creator: this.clientAddress,
        account: await hashAndHex(this.clientAddress),
        hashParent,
        hashChild,
        ...ready,
      }
    } catch (err) {
      throw warnError('filetreeReader updateExistingPostFile()', err)
    }
  }

  /**
   *
   * @param {IEncodeExistingRefOptions} options
   * @returns {Promise<DMsgFileTreePostFile>}
   */
  async encodeExistingRef (options: IEncodeExistingRefOptions): Promise<DMsgFileTreePostFile> {
    try {
      const {
        location: [hashParent, hashChild],
        ref,
        ulid,
        viewers,
        ownerAddress = this.clientAddress,
      } = options
      const hexAddress = await merklePathPlusIndex(`s/ulid/${ulid}`, ref)
      const lookup = {
        address: hexAddress,
        ownerAddress: await hashAndHexOwner(hexAddress, ownerAddress),
      }
      const { file } = await this.jackalSigner.queries.fileTree.file(lookup)
      let { contents, trackingNumber } = file
      const isCleartext = contents.includes('metaDataType')
      const access = await this.checkViewAuthorization(file, isCleartext)
      let ready
      if (access) {
        if (isCleartext) {
          ready = {
            contents,
            viewers: await this.createViewAccess({ trackingNumber, viewers, index: ref, ulid }),
            editors: await this.createEditAccess(trackingNumber),
            trackingNumber,
          }
        } else if (contents.length > 0) {
          const aes = await this.extractViewAccess(file)
          if (aes[1]) {
            throw new Error('Requires rekey')
          }
          ready = {
            contents,
            viewers: await this.createViewAccess({
              trackingNumber,
              viewers,
              aes: aes[0],
              index: ref,
              ulid,
            }),
            editors: await this.createEditAccess(trackingNumber),
            trackingNumber,
          }
        } else {
          throw new Error(`Empty contents`)
        }
        return {
          creator: this.clientAddress,
          account: await hashAndHex(ownerAddress),
          hashParent,
          hashChild,
          ...ready,
        }
      } else {
        throw new Error('Not Authorized')
      }
    } catch (err) {
      throw warnError('filetreeReader encodeExistingRef()', err)
    }
  }

  /**
   *
   * @param {string} receiverAddress
   * @param {IAesBundle} aes
   * @returns {Promise<string>}
   */
  async protectNotification (
    receiverAddress: string,
    aes: IAesBundle,
  ): Promise<string> {
    return await this.createViewAccess({
      trackingNumber: '',
      viewers: { overwrite: [receiverAddress] },
      aes,
    })
  }

  /**
   *
   * @param {DNotification} notificationData
   * @returns {Promise<INotificationRecord>}
   */
  async readShareNotification (
    notificationData: DNotification,
  ): Promise<INotificationRecord> {
    try {
      const contents: IPrivateNotification = JSON.parse(
        notificationData.contents,
      )
      const bundle = {
        address: '',
        contents: '',
        owner: '',
        viewingAccess: contents.keys,
        editAccess: '',
        trackingNumber: '',
      }
      const aes = await this.extractViewAccess(bundle)
      const msg = await cryptString(contents.msg, aes[0], 'decrypt', false)
      return {
        sender: notificationData.from,
        receiver: notificationData.to,
        time: notificationData.time,
        msg,
      }
    } catch (err) {
      throw warnError('filetreeReader readShareNotification()', err)
    }
  }

  /**
   *
   * @param {string} path
   * @returns {Promise<string[]>}
   * @protected
   */
  protected async loadSharerRefs (path: string): Promise<string[]> {
    try {
      if (!this.sharerRefs[path]) {
        this.sharerRefs[path] = {}
      }
      const meta = await this.loadMetaByPath(path)
      const ulid = this.ulidLookup(path)
      if ('sharerCount' in meta) {
        const count = hexToInt(meta.sharerCount || '')
        for (let i = 0; i < count; i++) {
          try {
            const loopMeta = await this.loadSharerRefMeta(ulid, i)
            if (loopMeta.type !== 'null') {
              this.sharerRefs[path][loopMeta.sharer] = i
            }
          } catch {
            console.warn('Bad Sharer Ref')
          }
        }
      }
      return Object.keys(this.sharerRefs[path])
    } catch (err) {
      throw warnError('filetreeReader loadSharerRefs()', err)
    }
  }

  /**
   *
   * @param {string} sharer
   * @returns {Promise<void>}
   * @protected
   */
  protected async sharingToLookup (sharer: string): Promise<void> {
    const pool = this.yellowpages[this.clientAddress]
    const path = `Shared/${sharer}`
    if (!pool[path]) {
      await this.pathToLookup({ owner: this.clientAddress, path: 'Shared' })
    }
    await this.pathToLookupPostProcess(
      path,
      this.clientAddress,
      pool[path],
    )
  }

  /**
   *
   * @param {IPathToLookupOptions} options
   * @returns {Promise<DQueryFileTreeFile>}
   * @protected
   */
  protected async pathToLookup (
    options: IPathToLookupOptions,
  ): Promise<DQueryFileTreeFile> {
    try {
      const {
        linkKey,
        owner,
        path,
      } = options
      const ownerAddress = owner || this.clientAddress
      let pool = this.yellowpages[ownerAddress] || {}
      if (path in pool) {
        return pool[path]
      } else {
        switch (true) {
          case path.startsWith('/'):
            throw new Error('Paths cannot start with /')
          case path.startsWith('s/'):
            throw new Error('Storage prefix not required')
          case !path.includes('/'):
            if (pool[path]) {
              return pool[path]
            } else {
              const hexRootAddress = await merklePath(`s/ulid/${path}`)
              const rootLookup = {
                address: hexRootAddress,
                ownerAddress: await hashAndHexOwner(
                  hexRootAddress,
                  ownerAddress,
                ),
              }
              const { file } =
                await this.jackalSigner.queries.fileTree.file(rootLookup)
              let lookup
              if (file.contents.includes('metaDataType')) {
                lookup = safeParseFileTree(file.contents)
              } else {
                lookup = await this.decryptAndParseContents(
                  file,
                  path,
                  linkKey,
                )
              }
              if (!(ownerAddress in this.ulidLeaves)) {
                this.ulidLeaves[ownerAddress] = {}
              }
              if ('ulid' in lookup) {
                this.ulidLeaves[ownerAddress][path] = lookup.ulid
              } else {
                this.ulidLeaves[ownerAddress][path] = path
              }
              if (!(ownerAddress in this.yellowpages)) {
                this.yellowpages[ownerAddress] = {}
                pool = this.yellowpages[ownerAddress]
              }
              await this.setYellowpages(
                path,
                ownerAddress,
                this.ulidLeaves[ownerAddress][path],
              )
              await this.pathToLookupPostProcess(
                path,
                ownerAddress,
                pool[path],
                linkKey,
              )
              return pool[path]
            }
          default:
            if (pool[path]) {
              return pool[path]
            } else {
              const parentPath = path.split('/').slice(0, -1).join('/')
              await this.pathToLookup({ linkKey, owner: ownerAddress, path: parentPath })
              await this.pathToLookupPostProcess(
                path,
                ownerAddress,
                pool[path],
                linkKey,
              )
              return pool[path]
            }
        }
      }
    } catch (err) {
      throw warnError('filetreeReader pathToLookup()', err)
    }
  }

  /**
   *
   * @param {string} ulid
   * @param {number} [index]
   * @returns {Promise<void>}
   */
  protected async loadSharedWith (ulid: string, index?: number): Promise<void> {
    try {
      let reference
      if (typeof index !== 'undefined') {
        reference = `${ulid}/${intToHex(index)}`
        this.viewerShares[reference] = []
        return
      } else {
        reference = ulid
      }
      let file
      try {
        let hexAddress
        if (typeof index !== 'undefined') {
          hexAddress = await merklePathPlusIndex(`s/ulid/${ulid}`, index)
        } else {
          hexAddress = await merklePath(`s/ulid/${ulid}`)
        }
        const lookup = {
          address: hexAddress,
          ownerAddress: await hashAndHexOwner(
            hexAddress,
            this.clientAddress,
          ),
        }
        const result = await this.jackalSigner.queries.fileTree.file(lookup)
        file = result.file
      } catch {
        console.warn(`loadSharedWith(): ${reference} Not yet shared`)
        this.viewerShares[reference] = []
        return
      }
      const { contents } = file
      const isCleartext = contents.includes('metaDataType')
      const access = await this.checkViewAuthorization(file, isCleartext)
      if (access) {
        let parsed
        if (!isCleartext) {
          parsed = await this.decryptAndParseContents(file, '-1')
        } else {
          parsed = JSON.parse(contents) as TMetaDataSets
        }
        if ('sharerCount' in parsed) {
          const count = hexToInt(parsed.sharerCount || '')
          for (let i = 0; i < count; i++) {
            let file
            try {
              const hexSubAddress = await merklePath(`s/ulid/${ulid}/s-${intToHex(i)}`)
              const subLookup = {
                address: hexSubAddress,
                ownerAddress: await hashAndHexOwner(hexSubAddress, this.clientAddress),
              }
              const sub = await this.jackalSigner.queries.fileTree.file(subLookup)
              file = sub.file
            } catch {
              console.warn(`No match for ${reference} - ${i} of count ${parsed.sharerCount}`)
              continue
            }
            const { contents } = file
            const isCleartext = contents.includes('metaDataType')
            const access = await this.checkViewAuthorization(file, isCleartext)
            if (access) {
              let parsed
              if (!isCleartext) {
                parsed = await this.decryptAndParseContents(file, '-1')
              } else {
                parsed = JSON.parse(contents) as TMetaDataSets
              }
              parsed = parsed as ISharerRefMetaData
              if (reference in this.viewerShares) {
                this.viewerShares[reference].push(parsed.sharer)
              } else {
                this.viewerShares[reference] = []
                this.viewerShares[reference].push(parsed.sharer)
              }
            } else {
              throw new Error('Ref Not Authorized')
            }
          }
        }
      } else {
        throw new Error('Not Authorized')
      }
    } catch (err) {
      throw warnError('filetreeReader loadSharedWith()', err)
    }
  }

  /**
   *
   * @param {string} path
   * @param {string} ownerAddress
   * @param {DQueryFileTreeFile} lookup
   * @param {string} [linkKey]
   * @returns {Promise<void>}
   * @protected
   */
  protected async pathToLookupPostProcess (
    path: string,
    ownerAddress: string,
    lookup: DQueryFileTreeFile,
    linkKey?: string,
  ): Promise<void> {
    try {
      const { file } = await this.jackalSigner.queries.fileTree.file(lookup)
      const { contents } = file
      const isCleartext = contents.includes('metaDataType')
      const access = await this.checkViewAuthorization(file, isCleartext, linkKey)
      if (access) {
        const id = this.ulidLookup(path, ownerAddress)
        let parsed
        if (!isCleartext) {
          parsed = await this.decryptAndParseContents(file, id, linkKey)
        } else {
          let ready = contents
          if (contents.startsWith('jklpc')) {
            ready = safeDecompressData(contents)
          }
          parsed = JSON.parse(ready) as TMetaDataSets
        }
        if (parsed.metaDataType === 'folder') {
          const count = hexToInt(parsed.count)
          if (ownerAddress === this.clientAddress) {
            this.refCountSet(path, count)
          }
          if (!path.startsWith('Shared')) {
            this.startDirectoryLeaf(path, id, ownerAddress)
          } else {
            this.sharingLeaves[path] = []
          }
          const post = []
          for (let i = 0; i < count; i++) {
            post.push(this.singleLoadMeta(path, ownerAddress, i, linkKey))
          }
          const final = await Promise.allSettled(post)
          console.dir(final)
        } else {
          // do nothing
        }
      }
    } catch (err) {
      throw warnError('filetreeReader pathToLookupPostProcess()', err)
    }
  }

  /**
   *
   * @param {string} path
   * @param {string} ownerAddress
   * @param {number} index
   * @param {string} [linkKey]
   * @returns {Promise<void>}
   * @protected
   */
  protected async singleLoadMeta (path: string, ownerAddress: string, index: number, linkKey?: string): Promise<void> {
    try {
      const ulidPool = this.ulidLeaves[ownerAddress]
      const refMeta = await this.loadRefMeta({
        ulid: ulidPool[path],
        ref: index,
        linkKey,
        ownerAddress,
      })
      if (refMeta.metaDataType === 'nullref') {
        return
      }
      const meta = await this.loadMetaByUlid({ ulid: refMeta.pointsTo, userAddress: ownerAddress, linkKey })
      if (path.startsWith('Shared')) {
        if (meta.metaDataType === 'folder') {
          const loopPath = `${path}/${meta.whoAmI}`
          ulidPool[loopPath] = refMeta.pointsTo
          await this.setYellowpages(
            loopPath,
            ownerAddress,
            refMeta.pointsTo,
          )
          this.sharers[meta.whoAmI] = meta
          if (!this.sharingLeaves[loopPath]) {
            this.sharingLeaves[loopPath] = []
          }
        } else if (meta.metaDataType === 'share') {
          const loopPath = `${path}/${meta.name}`
          ulidPool[loopPath] = refMeta.pointsTo
          await this.setYellowpages(
            loopPath,
            ownerAddress,
            refMeta.pointsTo,
          )
          if (!this.sharingLeaves[path]) {
            this.sharingLeaves[path] = [meta]
          } else {
            const compat = this.sharingLeaves[path] as IShareMetaData[]
            compat.push(meta)
            this.sharingLeaves[path] = compat
          }
        }
      } else {
        const leaf = this.readDirectoryLeafByPath(path, ownerAddress)
        if (meta.metaDataType === 'folder') {
          const loopPath = `${path}/${meta.whoAmI}`
          ulidPool[loopPath] = refMeta.pointsTo
          await this.setYellowpages(
            loopPath,
            ownerAddress,
            refMeta.pointsTo,
          )
          leaf.folders[index] = meta
        } else if (meta.metaDataType === 'file') {
          const loopPath = `${path}/${meta.fileMeta.name}`
          ulidPool[loopPath] = refMeta.pointsTo
          await this.setYellowpages(
            loopPath,
            ownerAddress,
            refMeta.pointsTo,
          )
          leaf.files[index] = meta
        } else if (meta.metaDataType === 'null') {
          leaf.nulls[index] = await NullMetaHandler.create({
            location: this.ulidLookup(path),
            refIndex: index,
            ulid: refMeta.pointsTo,
          })
        }
      }
    } catch (err) {
      throw warnError('filetreeReader singleLoadMeta()', err)
    }
  }

  /**
   *
   * @param {string} path
   * @param {string} ulid
   * @param {string} [ownerAddress]
   * @protected
   */
  protected startDirectoryLeaf (path: string, ulid: string, ownerAddress?: string): void {
    const owner = ownerAddress || this.clientAddress
    const shell = this.basicFolderShell()
    if (!this.directoryLeaves[owner]) {
      this.directoryLeaves[owner] = {}
    }
    if (!this.directoriesByUlid[owner]) {
      this.directoriesByUlid[owner] = {}
    }
    this.directoryLeaves[owner][path] = shell
    this.directoriesByUlid[owner][ulid] = shell
  }

  /**
   *
   * @param {string} path
   * @param {string} [ownerAddress]
   * @returns {IChildMetaDataMap}
   * @protected
   */
  protected readDirectoryLeafByPath (path: string, ownerAddress?: string): IChildMetaDataMap {
    const owner = ownerAddress || this.clientAddress
    return this.directoryLeaves[owner][path]
  }

  /**
   *
   * @param {string} ulid
   * @param {string} [ownerAddress]
   * @returns {IChildMetaDataMap}
   * @protected
   */
  protected readDirectoryLeafByUlid (ulid: string, ownerAddress?: string): IChildMetaDataMap {
    const owner = ownerAddress || this.clientAddress
    return this.directoriesByUlid[owner][ulid]
  }

  /**
   *
   * @param {string} path
   * @param {string} ownerAddress
   * @param {string} pointsTo
   * @returns {Promise<void>}
   * @protected
   */
  protected async setYellowpages (
    path: string,
    ownerAddress: string,
    pointsTo: string,
  ): Promise<void> {
    try {
      const hexAddress = await merklePath(`s/ulid/${pointsTo}`)
      this.yellowpages[ownerAddress][path] = {
        address: hexAddress,
        ownerAddress: await hashAndHexOwner(hexAddress, ownerAddress),
      }
    } catch (err) {
      throw warnError('filetreeReader setYellowpages()', err)
    }
  }

  /**
   *
   * @param {ILoadMetaOptions} options
   * @returns {Promise<TMetaDataSets>}
   * @protected
   */
  protected async loadMeta (
    options: ILoadMetaOptions,
  ): Promise<TMetaDataSets> {
    try {
      const { file, ulid } = options
      const { contents } = file
      const isCleartext = contents.includes('metaDataType')
      const access = await this.checkViewAuthorization(file, isCleartext, options.linkKey)
      if (access) {
        switch (true) {
          case isCleartext:
            return safeParseFileTree(contents)
          case contents.includes('legacyMerkles'):
            if (!options.legacyPath) {
              throw new Error('legacyMerkles requires legacyPath')
            }
            const { legacyMerkles } = safeParseLegacyMerkles(contents)
            return this.loadLegacyMeta(legacyMerkles, options.legacyPath)
          case contents.length > 0:
            return await this.decryptAndParseContents(file, ulid, options.linkKey)
          default:
            throw new Error(`Empty contents`)
        }
      } else {
        throw new Error('Not Authorized')
      }
    } catch (err) {
      throw warnError('filetreeReader loadMeta()', err)
    }
  }

  /**
   *
   * @param {ICreateViewAccessOptions} options
   * @returns {Promise<string>}
   * @protected
   */
  protected async createViewAccess (
    options: ICreateViewAccessOptions,
  ): Promise<string> {
    try {
      const {
        index,
        ulid,
        trackingNumber,
        viewers,
        aes,
      } = options
      let groupViewers
      let viewAccess = ulid ? await this.viewerLookup(ulid, index) : {}
      if ('overwrite' in viewers) {
        groupViewers = [...new Set([...viewers.overwrite, this.clientAddress])]
        viewAccess = {}
      } else {
        groupViewers = [...new Set(viewers.add || [])]
        for (let old of viewers.remove || []) {
          const toPurge = await hashAndHexUserAccess('v', trackingNumber, old)
          delete viewAccess[toPurge]
        }
      }
      for (let viewer of groupViewers) {
        const entry = await hashAndHexUserAccess('v', trackingNumber, viewer)
        if (aes) {
          if (!viewer.startsWith('jkl')) {
            const key = await linkPrivateKey(viewer)
            const pubKey = key.publicKey.toHex()
            viewAccess[entry] = await aesToString(pubKey, aes)
          } else if (viewer === this.clientAddress) {
            const pubKey = this.keyPair.publicKey.toHex()
            viewAccess[entry] = await aesToString(pubKey, aes)
          } else {
            try {
              const pubKey = await this.jackalClient.findPubKey(viewer)
              viewAccess[entry] = await aesToString(pubKey, aes)
            } catch {
              warnError('filetreeReader ulidLookup()', `${viewer} not on chain`)
            }
          }
        } else {
          viewAccess[entry] = 'public'
        }
      }
      if (ulid) {
        this.viewerSave(ulid, viewAccess)
      }
      return JSON.stringify(viewAccess)
    } catch (err) {
      throw warnError('filetreeReader createViewAccess()', err)
    }
  }

  /**
   *
   * @param {string} trackingNumber
   * @param {string[]} [editors]
   * @returns {Promise<string>}
   * @protected
   */
  protected async createEditAccess (
    trackingNumber: string,
    editors: string[] = [],
  ): Promise<string> {
    try {
      const editAccess: Record<string, 'valid'> = {}
      const finalEditors = [...new Set([...editors, this.clientAddress])]
      for (let editor of finalEditors) {
        const entry = await hashAndHexUserAccess('e', trackingNumber, editor)
        editAccess[entry] = 'valid'
      }
      return JSON.stringify(editAccess)
    } catch (err) {
      throw warnError('filetreeReader createEditAccess()', err)
    }
  }

  /**
   *
   * @param {DFile} data
   * @param {boolean} isPublic
   * @param {string} [linkKey]
   * @returns {Promise<boolean>}
   * @protected
   */
  protected async checkViewAuthorization (data: DFile, isPublic: boolean, linkKey?: string): Promise<boolean> {
    try {
      if (isPublic) {
        return isPublic
      } else {
        const parsedAccess = JSON.parse(data.viewingAccess)
        const user = await hashAndHexUserAccess(
          'v',
          data.trackingNumber,
          linkKey || this.clientAddress,
        )
        return user in parsedAccess
      }
    } catch (err) {
      throw warnError('filetreeReader checkViewAuthorization()', err)
    }
  }

  /**
   *
   * @param {DFile} data
   * @param {string} [linkKey]
   * @returns {Promise<IAesBundle>}
   * @protected
   */
  protected async extractViewAccess (data: DFile, linkKey?: string): Promise<TExtractedViewAccess> {
    try {
      const parsedAccess = JSON.parse(data.viewingAccess)
      const user = await hashAndHexUserAccess(
        'v',
        data.trackingNumber,
        linkKey || this.clientAddress,
      )
      let key
      if (linkKey) {
        key = await linkPrivateKey(linkKey)
      } else {
        key = this.keyPair
      }
      if (user in parsedAccess) {
        if (parsedAccess[user] === 'public') {
          return [await genAesBundle(), false]
        } else {
          try {
            const parsed = await stringToAes(key, parsedAccess[user])
            return [parsed, false]
          } catch {
            try {
              const parsed = await stringToAes(this.defaultKeyPair, parsedAccess[user])
              return [parsed, true]
            } catch (err) {
              throw err
            }
          }
        }
      } else {
        throw new Error('Not an authorized Viewer')
      }
    } catch (err) {
      throw warnError('filetreeReader extractViewAccess()', err)
    }
  }

  /**
   *
   * @param {DFile} data
   * @returns {Promise<boolean>}
   * @protected
   */
  protected async extractEditAccess (data: DFile): Promise<boolean> {
    try {
      const parsedAccess = JSON.parse(data.editAccess)
      const user = await hashAndHexUserAccess(
        'e',
        data.trackingNumber,
        this.clientAddress,
      )
      return user in parsedAccess
    } catch (err) {
      throw warnError('filetreeReader extractEditAccess()', err)
    }
  }

  /**
   * Convert DFile from filetree to metadata.
   * @param {DFile} file - Filetree file.
   * @param {string} id
   * @returns {Promise<IFolderMetaData>}
   * @protected
   */
  protected async loadFolderMeta (file: DFile, id: string): Promise<IFolderMetaData> {
    try {
      const { contents } = file
      const isCleartext = contents.includes('metaDataType')
      const access = await this.checkViewAuthorization(file, isCleartext)
      if (access) {
        let parsed
        if (!isCleartext) {
          parsed = await this.decryptAndParseContents(file, id)
        } else {
          parsed = safeParseFileTree(contents)
        }
        if (parsed.metaDataType === 'folder') {
          return parsed
        } else {
          throw new Error('Invalid Meta')
        }
      } else {
        throw new Error('Not Authorized')
      }
    } catch (err) {
      throw warnError('filetreeReader loadFolderMeta()', err)
    }
  }

  /**
   *
   * @param {DFile} data
   * @param {string} id
   * @param {string} [linkKey]
   * @returns {Promise<TMetaDataSets>}
   * @protected
   */
  protected async decryptAndParseContents (data: DFile, id: string, linkKey?: string): Promise<TMetaDataSets> {
    try {
      const safe = prepDecompressionForAmino(data.contents)
      const aes = await this.extractViewAccess(data, linkKey)
      if (id !== '-1' && aes[1]) {
        this.conversionQueue = [...new Set([...this.conversionQueue, id])]
      }
      let decrypted = await cryptString(safe, aes[0], 'decrypt')
      if (decrypted.startsWith('jklpc')) {
        decrypted = safeDecompressData(decrypted)
      }
      return safeParseFileTree(decrypted)
    } catch (err) {
      throw warnError('filetreeReader decryptAndParseContents()', err)
    }
  }

  /**
   *
   * @returns {IChildMetaDataMap}
   * @protected
   */
  protected basicFolderShell (): IChildMetaDataMap {
    return {
      files: {},
      folders: {},
      nulls: {},
    }
  }
}
