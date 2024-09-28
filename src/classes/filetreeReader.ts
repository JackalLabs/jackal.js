import {
  IAesBundle,
  IChildMetaDataMap,
  IClientHandler,
  IFileMeta,
  IFileMetaData,
  IFileMetaHandler,
  IFileTreeOptions,
  IFiletreeReader,
  IFolderMetaData,
  IFolderMetaHandler,
  ILegacyFolderMetaData,
  INotificationRecord,
  INullRefMetaData,
  IPrivateNotification,
  IReadFolderContentOptions,
  IReconstructedFileTree,
  IRefMetaData,
  IRootLookupMetaData,
  ISharedMetaDataMap,
  IShareFolderMetaData,
  IShareMetaData,
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
  prepDecompressionForAmino,
  safeDecompressData,
  safeParseFileTree,
  safeParseLegacyMerkles,
  safeStringifyFileTree,
} from '@/utils/converters'
import { aesToString, compressEncryptString, cryptString, genAesBundle, stringToAes } from '@/utils/crypt'
import type { TMerkleParentChild, TMetaDataSets } from '@/types'
import { FileMetaHandler, FolderMetaHandler, NullMetaHandler } from '@/classes/metaHandlers'

export class FiletreeReader implements IFiletreeReader {
  protected readonly jackalClient: IClientHandler
  protected readonly jackalSigner: TJackalSigningClient
  protected readonly keyPair: PrivateKey
  protected readonly clientAddress: string

  protected ulidLeaves: Record<string, Record<string, string>>
  protected directoryLeaves: Record<string, Record<string, IChildMetaDataMap>>
  protected yellowpages: Record<string, Record<string, DQueryFileTreeFile>>
  protected legacyMetaLeaves: Record<string, ILegacyFolderMetaData>
  protected refCounts: Record<string, number>

  constructor (
    jackalClient: IClientHandler,
    jackalSigner: TJackalSigningClient,
    keyPair: PrivateKey,
    ownerAddress: string,
  ) {
    this.jackalClient = jackalClient
    this.jackalSigner = jackalSigner
    this.keyPair = keyPair
    this.clientAddress = ownerAddress

    this.ulidLeaves = {}
    this.ulidLeaves[ownerAddress] = {}
    this.directoryLeaves = {}
    this.directoryLeaves[ownerAddress] = {}
    this.yellowpages = {}
    this.yellowpages[ownerAddress] = {}
    this.legacyMetaLeaves = {}
    this.refCounts = {}
  }

  async refCountRead (path: string): Promise<number> {
    if (path in this.refCounts) {
      return this.refCounts[path]
    } else {
      const meta = await this.loadFolderMetaByPath(path)
      const count = hexToInt(meta.count)
      this.refCountSet(path, count)
      return count
    }
  }

  refCountIncrement (path: string): void {
    if (this.refCounts[path]) {
      this.refCounts[path]++
    } else {
      this.refCounts[path] = 1
    }
  }

  refCountSet (path: string, value: number): void {
    if (!this.refCounts[path]) {
      this.refCounts[path] = value
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
    const details = this.directoryLeaves[this.clientAddress][parentPath]

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
    // console.log(path)
    const {
      owner = this.clientAddress,
      refresh = false,
    } = options
    // console.log(options)
    // console.log(this.directoryLeaves[owner])
    // console.log(this.yellowpages[owner])

    try {
      if (this.directoryLeaves[owner][path] && !refresh) {
        return this.directoryLeaves[owner][path]
      } else {
        await this.pathToLookupPostProcess(path, owner, this.yellowpages[owner][path])
        return this.directoryLeaves[owner][path]
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
      const lookup = await this.pathToLookup(path)
      const { file } = await this.jackalSigner.queries.fileTree.file(lookup)
      return await this.loadFolderMeta(file)
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
      return await this.loadFolderMeta(file)
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
      const lookup = await this.pathToLookup(path)
      // console.log("lookup:", lookup)
      const { file } = await this.jackalSigner.queries.fileTree.file(lookup)
      // console.log("File: ", file)
      const { contents } = file
      const isCleartext = contents.includes('metaDataType')
      const access = await this.checkViewAuthorization(file, isCleartext)
      if (access) {
        const parsed = !isCleartext
          ? await this.decryptAndParseContents(file)
          : safeParseFileTree(contents)
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
   * Look up sharing folder meta data.
   * @param {string} path - Path of resource.
   * @returns {Promise<IShareFolderMetaData>}
   */
  async loadShareFolderMeta (path: string): Promise<IShareFolderMetaData> {
    try {
      const lookup = await this.pathToLookup(path)
      const { file } = await this.jackalSigner.queries.fileTree.file(lookup)
      const { contents } = file
      const isCleartext = contents.includes('metaDataType')
      const access = await this.checkViewAuthorization(file, isCleartext)
      if (access) {
        const parsed = !isCleartext
          ? await this.decryptAndParseContents(file)
          : safeParseFileTree(contents)
        if (parsed.metaDataType === 'sharefolder') {
          return parsed
        } else {
          throw new Error('Invalid Meta')
        }
      } else {
        throw new Error('Not Authorized')
      }
    } catch (err) {
      throw warnError('filetreeReader loadShareFolderMeta()', err)
    }
  }

  /**
   * Look up sharing meta data.
   * @param {string} path - Path of resource.
   * @returns {Promise<IShareMetaData>}
   */
  async loadShareMeta (path: string): Promise<IShareMetaData> {
    try {
      const lookup = await this.pathToLookup(path)
      const { file } = await this.jackalSigner.queries.fileTree.file(lookup)
      const { contents } = file
      const isCleartext = contents.includes('metaDataType')
      const access = await this.checkViewAuthorization(file, isCleartext)
      if (access) {
        const parsed = !isCleartext
          ? await this.decryptAndParseContents(file)
          : safeParseFileTree(contents)
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
   * @param {string} ulid
   * @param {number} ref
   * @returns {Promise<IRefMetaData | INullRefMetaData>}
   */
  async loadRefMeta (ulid: string, ref: number): Promise<IRefMetaData | INullRefMetaData> {
    try {
      const hexAddress = await merklePathPlusIndex(`s/ulid/${ulid}`, ref)
      const lookup = {
        address: hexAddress,
        ownerAddress: await hashAndHexOwner(hexAddress, this.clientAddress),
      }
      const { file } = await this.jackalSigner.queries.fileTree.file(lookup)
      const meta = await this.loadMeta(file)
      return (meta.metaDataType === 'ref') ? meta as IRefMetaData : meta as INullRefMetaData
    } catch (err) {
      throw warnError('filetreeReader loadRefMeta()', err)
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
   * Look up meta data by ulid.
   * @param {string} ulid
   * @returns {Promise<TMetaDataSets>}
   */
  async loadMetaByUlid (ulid: string): Promise<TMetaDataSets> {
    try {
      const hexAddress = await merklePath(`s/ulid/${ulid}`)
      const lookup = {
        address: hexAddress,
        ownerAddress: await hashAndHexOwner(hexAddress, this.clientAddress),
      }
      const { file } = await this.jackalSigner.queries.fileTree.file(lookup)
      return await this.loadMeta(file)
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
    return await this.loadMetaByExternalPath(path, this.clientAddress)
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
      const lookup = await this.pathToLookup(path, ownerAddress)
      const { file } = await this.jackalSigner.queries.fileTree.file(lookup)

      const pathSet = path.split('/')
      const legacyPath: [string, string] = [
        pathSet.slice(0, -1).join('/'),
        pathSet.slice(-1)[0],
      ]

      return await this.loadMeta(file, legacyPath)
    } catch (err) {
      throw warnError('filetreeReader loadMetaByExternalPath()', err)
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
      const lookup = await this.pathToLookup(path)
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
   * @param {string} path - Path of resource.
   * @param {string[]} additionalViewers - Array of wallet addresses.
   * @returns {Promise<IReconstructedFileTree>}
   */
  async setMetaViewers (
    path: string,
    additionalViewers: string[],
  ): Promise<IReconstructedFileTree> {
    try {
      const allViewers = [this.clientAddress, ...additionalViewers]
      const lookup = await this.pathToLookup(path)
      const { file } = await this.jackalSigner.queries.fileTree.file(lookup)
      const { contents, trackingNumber } = file
      const isCleartext = contents.includes('metaDataType')
      const access = await this.checkViewAuthorization(file, isCleartext)
      if (access) {
        if (isCleartext) {
          return {
            contents,
            viewers: await this.createViewAccess(trackingNumber, allViewers),
            editors: await this.createEditAccess(trackingNumber),
            trackingNumber,
          }
        } else if (contents.length > 0) {
          const aes = await this.extractViewAccess(file)
          return {
            contents,
            viewers: await this.createViewAccess(
              trackingNumber,
              allViewers,
              aes,
            ),
            editors: await this.createEditAccess(trackingNumber),
            trackingNumber,
          }
        } else {
          throw new Error(`Empty contents for ${path}`)
        }
      } else {
        throw new Error('Not Authorized')
      }
    } catch (err) {
      throw warnError('filetreeReader setMetaViewers()', err)
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
      const lookup = await this.pathToLookup(path, ownerAddress)
      const { file } = await this.jackalSigner.queries.fileTree.file(lookup)
      return await this.extractViewAccess(file)
    } catch (err) {
      throw warnError('filetreeReader loadKeysByPath()', err)
    }
  }

  /**
   * Look up AES keys for Filetree item by ulid.
   * @param {string} ulid - Ulid of resource.
   * @param {string} ownerAddress - Owner of resource.
   * @returns {Promise<IAesBundle>}
   */
  async loadKeysByUlid (
    ulid: string,
    ownerAddress: string,
  ): Promise<IAesBundle> {
    try {
      const hexAddress = await merklePath(`s/ulid/${ulid}`)
      const lookup = {
        address: hexAddress,
        ownerAddress: await hashAndHexOwner(hexAddress, ownerAddress),
      }
      const { file } = await this.jackalSigner.queries.fileTree.file(lookup)
      return await this.extractViewAccess(file)
    } catch (err) {
      throw warnError('filetreeReader loadKeysByUlid()', err)
    }
  }

  /**
   *
   * @returns {Promise<DMsgProvisionFileTree>}
   */
  async encodeProvisionFileTree (): Promise<DMsgProvisionFileTree> {
    try {
      const trackingNumber = crypto.randomUUID()
      const forFileTree: DMsgProvisionFileTree = {
        creator: this.clientAddress,
        viewers: await this.createViewAccess(trackingNumber, [
          this.clientAddress,
        ]),
        editors: await this.createEditAccess(trackingNumber, [
          this.clientAddress,
        ]),
        trackingNumber: trackingNumber,
      }
      return forFileTree
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
      const allViewers = [this.clientAddress, ...additionalViewers]

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
        forFileTree.viewers = await this.createViewAccess(
          trackingNumber,
          allViewers,
          aes,
        )
        forFileTree.editors = await this.createEditAccess(trackingNumber)
        forFileTree.trackingNumber = trackingNumber
      } else {
        forFileTree.contents = stringedMeta
        forFileTree.viewers = await this.createViewAccess(
          trackingNumber,
          allViewers,
        )
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
   * @param {string} path
   * @param {TMerkleParentChild} location
   * @param {string[]} additionalViewers
   * @returns {Promise<DMsgFileTreePostFile>}
   */
  async encodeExistingPostFile (
    path: string,
    location: TMerkleParentChild,
    additionalViewers: string[],
  ): Promise<DMsgFileTreePostFile> {
    try {
      const [hashParent, hashChild] = location
      const ready = await this.setMetaViewers(path, additionalViewers)
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
    return await this.createViewAccess(
      '',
      [this.clientAddress, receiverAddress],
      aes,
    )
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
      const msg = await cryptString(contents.msg, aes, 'decrypt', false)
      return {
        sender: notificationData.from,
        receiver: notificationData.to,
        msg,
      }
    } catch (err) {
      throw warnError('filetreeReader readShareNotification()', err)
    }
  }

  /**
   *
   * @param {string} ulid
   * @returns {Promise<ISharedMetaDataMap>}
   */
  async loadSharingFolder (ulid: string): Promise<ISharedMetaDataMap> {
    try {
      const bundle = await this.loadMetaByUlid(ulid)
      if (bundle.metaDataType === 'sharefolder') {
        return await this.metaToSharingFolder(bundle)
      } else {
        throw new Error('No Match')
      }
    } catch (err) {
      throw warnError('filetreeReader loadSharingFolder()', err)
    }
  }

  /**
   *
   * @param {string} path
   * @param {string} [owner]
   * @returns {Promise<DQueryFileTreeFile>}
   * @protected
   */
  protected async pathToLookup (
    path: string,
    owner?: string,
  ): Promise<DQueryFileTreeFile> {
    try {
      const ownerAddress = owner || this.clientAddress
      if (path in this.yellowpages[ownerAddress]) {
        return this.yellowpages[ownerAddress][path]
      } else {
        switch (true) {
          case path.startsWith('/'):
            throw new Error('Paths cannot start with /')
          case path.startsWith('s/'):
            throw new Error('Storage prefix not required')
          case !path.includes('/'):
            if (this.yellowpages[ownerAddress][path]) {
              return this.yellowpages[ownerAddress][path]
            } else {
              // console.log(path)
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
              const lookup = (await this.decryptAndParseContents(
                file,
              )) as IRootLookupMetaData
              // console.log(lookup)
              if (!(ownerAddress in this.ulidLeaves)) {
                this.ulidLeaves[ownerAddress] = {}
              }
              this.ulidLeaves[ownerAddress][path] = lookup.ulid
              if (!(ownerAddress in this.yellowpages)) {
                this.yellowpages[ownerAddress] = {}
              }
              await this.setYellowpages(
                path,
                ownerAddress,
                this.ulidLeaves[ownerAddress][path],
              )
              await this.pathToLookupPostProcess(
                path,
                ownerAddress,
                this.yellowpages[ownerAddress][path],
              )
              return this.yellowpages[ownerAddress][path]
            }
          default:
            if (this.yellowpages[ownerAddress][path]) {
              return this.yellowpages[ownerAddress][path]
            } else {
              const parentPath = path.split('/').slice(0, -1).join('/')
              await this.pathToLookup(parentPath, ownerAddress)
              await this.pathToLookupPostProcess(
                path,
                ownerAddress,
                this.yellowpages[ownerAddress][path],
              )
              return this.yellowpages[ownerAddress][path]
            }
        }
      }
    } catch (err) {
      throw warnError('filetreeReader pathToLookup()', err)
    }
  }

  /**
   *
   * @param {string} path
   * @param {string} ownerAddress
   * @param {DQueryFileTreeFile} lookup
   * @returns {Promise<void>}
   * @protected
   */
  protected async pathToLookupPostProcess (
    path: string,
    ownerAddress: string,
    lookup: DQueryFileTreeFile,
  ): Promise<void> {
    try {
      const { file } = await this.jackalSigner.queries.fileTree.file(lookup)
      const { contents } = file
      const isCleartext = contents.includes('metaDataType')
      const access = await this.checkViewAuthorization(file, isCleartext)
      if (access) {
        const parsed = !isCleartext
          ? await this.decryptAndParseContents(file)
          : (JSON.parse(contents) as TMetaDataSets)
        if (parsed.metaDataType === 'folder') {
          const count = hexToInt(parsed.count)
          if (ownerAddress === this.clientAddress) {
            this.refCountSet(path, count)
          }
          this.directoryLeaves[ownerAddress][path] = this.basicFolderShell()
          const post = []
          for (let i = 0; i < count; i++) {
            post.push(this.singleLoadMeta(path, ownerAddress, i))
          }
          const final = await Promise.allSettled(post)
          console.dir(final)
        } else {
          // do nothing
        }
      } else {
        throw new Error('Not Authorized')
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
   * @returns {Promise<void>}
   * @protected
   */
  protected async singleLoadMeta (path: string, ownerAddress: string, index: number): Promise<void> {
    try {
      const refMeta = await this.loadRefMeta(
        this.ulidLeaves[ownerAddress][path],
        index,
      )
      if (refMeta.metaDataType === 'nullref') {
        return
      }
      const leaf = this.directoryLeaves[ownerAddress][path]
      const meta = await this.loadMetaByUlid(refMeta.pointsTo)
      if (meta.metaDataType === 'folder') {
        const loopPath = `${path}/${meta.whoAmI}`
        this.ulidLeaves[ownerAddress][loopPath] = refMeta.pointsTo
        await this.setYellowpages(
          loopPath,
          ownerAddress,
          refMeta.pointsTo,
        )
        leaf.folders[index] = meta
      } else if (meta.metaDataType === 'file') {
        const loopPath = `${path}/${meta.fileMeta.name}`
        this.ulidLeaves[ownerAddress][loopPath] = refMeta.pointsTo
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
    } catch (err) {
      throw warnError('filetreeReader singleLoadMeta()', err)
    }
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
   * @param {DFile} file
   * @param {[string, string]} [legacyPath]
   * @returns {Promise<TMetaDataSets>}
   * @protected
   */
  protected async loadMeta (
    file: DFile,
    legacyPath?: [string, string],
  ): Promise<TMetaDataSets> {
    try {
      const { contents } = file
      const isCleartext = contents.includes('metaDataType')
      const access = await this.checkViewAuthorization(file, isCleartext)

      if (access) {
        switch (true) {
          case isCleartext:
            return safeParseFileTree(contents)
          case contents.includes('legacyMerkles'):
            if (!legacyPath) {
              throw new Error('legacyMerkles requires legacyPath')
            }
            const { legacyMerkles } = safeParseLegacyMerkles(contents)
            return this.loadLegacyMeta(legacyMerkles, legacyPath)
          case contents.length > 0:
            return await this.decryptAndParseContents(file)
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
   * @param {IShareFolderMetaData} meta
   * @returns {Promise<ISharedMetaDataMap>}
   * @protected
   */
  protected async metaToSharingFolder (
    meta: IShareFolderMetaData,
  ): Promise<ISharedMetaDataMap> {
    try {
      const data: ISharedMetaDataMap = {}
      const count = hexToInt(meta.count)
      for (let i = 0; i < count; i++) {
        const ref = await this.loadRefMeta(meta.pointsTo, i)
        const found = await this.loadMetaByUlid(ref.pointsTo)
        if (found.metaDataType === 'sharefolder') {
          data[found.whoAmI] = await this.metaToSharingFolder(found)
        } else if (found.metaDataType === 'share') {
          data[found.label] = found
        } else {
          throw new Error('No Match')
        }
      }
      return data
    } catch (err) {
      throw warnError('filetreeReader metaToSharingFolder()', err)
    }
  }

  /**
   *
   * @param {string} trackingNumber
   * @param {string[]} viewers
   * @param {IAesBundle} aes
   * @returns {Promise<string>}
   * @protected
   */
  protected async createViewAccess (
    trackingNumber: string,
    viewers: string[],
    aes?: IAesBundle,
  ): Promise<string> {
    try {
      const viewAccess: Record<string, string> = {}
      for (let viewer of viewers) {
        const entry = await hashAndHexUserAccess('v', trackingNumber, viewer)
        if (aes) {
          if (viewer === this.clientAddress) {
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
      return JSON.stringify(viewAccess)
    } catch (err) {
      throw warnError('filetreeReader createViewAccess()', err)
    }
  }

  /**
   *
   * @param {string} trackingNumber
   * @param {string[]} editors
   * @returns {Promise<string>}
   * @protected
   */
  protected async createEditAccess (
    trackingNumber: string,
    editors?: string[],
  ): Promise<string> {
    try {
      const editAccess: Record<string, 'valid'> = {}
      const finalEditors = editors || [this.clientAddress]
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
   * @returns {Promise<boolean>}
   * @protected
   */
  protected async checkViewAuthorization (data: DFile, isPublic: boolean): Promise<boolean> {
    try {
      if (isPublic) {
        return isPublic
      } else {
        const parsedAccess = JSON.parse(data.viewingAccess)
        const user = await hashAndHexUserAccess(
          'v',
          data.trackingNumber,
          this.clientAddress,
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
   * @returns {Promise<IAesBundle>}
   * @protected
   */
  protected async extractViewAccess (data: DFile): Promise<IAesBundle> {
    try {
      const parsedAccess = JSON.parse(data.viewingAccess)
      const user = await hashAndHexUserAccess(
        'v',
        data.trackingNumber,
        this.clientAddress,
      )
      if (user in parsedAccess) {
        if (parsedAccess[user] === 'public') {
          return await genAesBundle()
        } else {
          return await stringToAes(this.keyPair, parsedAccess[user])
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
   * @returns {Promise<IFolderMetaData>}
   * @protected
   */
  protected async loadFolderMeta (file: DFile): Promise<IFolderMetaData> {
    try {
      const { contents } = file
      const isCleartext = contents.includes('metaDataType')
      const access = await this.checkViewAuthorization(file, isCleartext)
      if (access) {
        const parsed = !isCleartext
          ? await this.decryptAndParseContents(file)
          : safeParseFileTree(contents)
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
   * @returns {Promise<Record<string, any>>}
   * @protected
   */
  protected async decryptAndParseContents (data: DFile): Promise<TMetaDataSets> {
    try {
      const safe = prepDecompressionForAmino(data.contents)
      const aes = await this.extractViewAccess(data)
      let decrypted = await cryptString(safe, aes, 'decrypt')
      if (decrypted.startsWith('jklpc1')) {
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
