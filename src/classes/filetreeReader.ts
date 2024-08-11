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
  IPrivateNotification,
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
import {
  hashAndHex,
  hashAndHexOwner,
  hashAndHexUserAccess,
  merklePath,
  merklePathPlusIndex,
} from '@/utils/hash'
import {
  hexToInt,
  prepDecompressionForAmino,
  safeDecompressData,
} from '@/utils/converters'
import {
  aesToString,
  compressEncryptString,
  cryptString,
  stringToAes,
} from '@/utils/crypt'
import type { TMerkleParentChild, TMetaDataSets } from '@/types'
import type { IFileContents } from '@/interfaces/jjs_v2'
import {
  FileMetaHandler,
  FolderMetaHandler,
  NullMetaHandler,
} from '@/classes/metaHandlers'

export class FiletreeReader implements IFiletreeReader {
  protected readonly jackalClient: IClientHandler
  protected readonly jackalSigner: TJackalSigningClient
  protected readonly keyPair: PrivateKey
  protected readonly clientAddress: string

  protected redpages: Record<string, Record<string, string>>
  protected bluepages: Record<string, Record<string, IChildMetaDataMap>>
  protected yellowpages: Record<string, Record<string, DQueryFileTreeFile>>
  protected whitepages: Record<string, ILegacyFolderMetaData>

  constructor(
    jackalClient: IClientHandler,
    jackalSigner: TJackalSigningClient,
    keyPair: PrivateKey,
    ownerAddress: string,
  ) {
    this.jackalClient = jackalClient
    this.jackalSigner = jackalSigner
    this.keyPair = keyPair
    this.clientAddress = ownerAddress

    this.redpages = {}
    this.redpages[ownerAddress] = {}
    this.bluepages = {}
    this.bluepages[ownerAddress] = {}
    this.yellowpages = {}
    this.yellowpages[ownerAddress] = {}
    this.whitepages = {}
  }

  /**
   *
   * @param {string} path
   * @param {string} [owner]
   * @returns {string}
   */
  ulidLookup(path: string, owner?: string): string {
    const ownerAddress = owner || this.clientAddress
    return this.redpages[ownerAddress][path]
  }

  /**
   *
   * @param {string} path
   * @param {string} [owner]
   * @returns {IChildMetaDataMap}
   */
  readFolderContents(path: string, owner?: string): IChildMetaDataMap {
    const ownerAddress = owner || this.clientAddress
    return this.bluepages[ownerAddress][path]
  }

  /**
   *
   * @param {string} path
   * @returns {Promise<IFolderMetaData>}
   */
  async loadFolderMeta(path: string): Promise<IFolderMetaData> {
    try {
      const lookup = await this.pathToLookup(path)
      const { file } = await this.jackalSigner.queries.fileTree.file(lookup)
      const { contents } = file
      const access = await this.extractEditAccess(file)
      if (access) {
        const parsed = !contents.includes('metaDataType')
          ? await this.decryptAndParseContents(file)
          : (JSON.parse(contents) as TMetaDataSets)
        if (parsed.metaDataType === 'folder') {
          return parsed
        } else {
          throw new Error('Invalid Meta')
        }
      } else {
        throw new Error('Not Authorized')
      }
    } catch (err) {
      throw warnError('loadFolder()', err)
    }
  }

  /**
   *
   * @param {string} path
   * @returns {Promise<IFolderMetaHandler>}
   */
  async loadFolderMetaHandler(path: string): Promise<IFolderMetaHandler> {
    try {
      const lookup = await this.pathToLookup(path)
      const { file } = await this.jackalSigner.queries.fileTree.file(lookup)
      const { contents } = file
      const access = await this.extractEditAccess(file)
      if (access) {
        const parsed = !contents.includes('metaDataType')
          ? await this.decryptAndParseContents(file)
          : (JSON.parse(contents) as TMetaDataSets)
        if (parsed.metaDataType === 'folder') {
          const { count, description, location, whoAmI } = parsed
          return await FolderMetaHandler.create({
            count: hexToInt(count),
            description,
            location,
            name: whoAmI,
            ulid: this.redpages[this.clientAddress][path],
          })
        } else {
          throw new Error('Invalid Meta')
        }
      } else {
        throw new Error('Not Authorized')
      }
    } catch (err) {
      throw warnError('loadFolder()', err)
    }
  }

  /**
   *
   * @param {string} path
   * @returns {Promise<IShareFolderMetaData>}
   */
  async loadShareFolderMeta(path: string): Promise<IShareFolderMetaData> {
    try {
      const lookup = await this.pathToLookup(path)
      const { file } = await this.jackalSigner.queries.fileTree.file(lookup)
      const { contents } = file
      const access = await this.extractEditAccess(file)
      if (access) {
        const parsed = !contents.includes('metaDataType')
          ? await this.decryptAndParseContents(file)
          : (JSON.parse(contents) as TMetaDataSets)
        if (parsed.metaDataType === 'sharefolder') {
          return parsed
        } else {
          throw new Error('Invalid Meta')
        }
      } else {
        throw new Error('Not Authorized')
      }
    } catch (err) {
      throw warnError('loadShareFolderMeta()', err)
    }
  }

  /**
   *
   * @param {string} path
   * @returns {Promise<IShareMetaData>}
   */
  async loadShareMeta(path: string): Promise<IShareMetaData> {
    try {
      const lookup = await this.pathToLookup(path)
      const { file } = await this.jackalSigner.queries.fileTree.file(lookup)
      const { contents } = file
      const access = await this.extractEditAccess(file)
      if (access) {
        const parsed = !contents.includes('metaDataType')
          ? await this.decryptAndParseContents(file)
          : (JSON.parse(contents) as TMetaDataSets)
        if (parsed.metaDataType === 'share') {
          return parsed
        } else {
          throw new Error('Invalid Meta')
        }
      } else {
        throw new Error('Not Authorized')
      }
    } catch (err) {
      throw warnError('loadShareMeta()', err)
    }
  }

  /**
   *
   * @param {string} ulid
   * @param {number} ref
   * @returns {Promise<IRefMetaData>}
   */
  async loadRefMeta(ulid: string, ref: number): Promise<IRefMetaData> {
    try {
      const hexAddress = await merklePathPlusIndex(`s/ulid/${ulid}`, ref)
      const lookup = {
        address: hexAddress,
        ownerAddress: await hashAndHexOwner(hexAddress, this.clientAddress),
      }
      const { file } = await this.jackalSigner.queries.fileTree.file(lookup)
      return (await this.loadMeta(file)) as IRefMetaData
    } catch (err) {
      throw warnError('loadRefMeta()', err)
    }
  }

  /**
   *
   * @param {Uint8Array[]} legacyMerkles
   * @param {[string, string]} legacyPath
   * @returns {Promise<IFileMetaData>}
   */
  async loadLegacyMeta(
    legacyMerkles: Uint8Array[],
    legacyPath: [string, string],
  ): Promise<IFileMetaData> {
    try {
      const [parentPath, name] = legacyPath
      const parent =
        this.whitepages[parentPath] || (await this.loadMetaByPath(parentPath))
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
      throw warnError('loadLegacyMeta()', err)
    }
  }

  /**
   *
   * @param {string} ulid
   * @returns {Promise<TMetaDataSets>}
   */
  async loadMetaByUlid(ulid: string): Promise<TMetaDataSets> {
    try {
      const hexAddress = await merklePath(`s/ulid/${ulid}`)
      const lookup = {
        address: hexAddress,
        ownerAddress: await hashAndHexOwner(hexAddress, this.clientAddress),
      }
      const { file } = await this.jackalSigner.queries.fileTree.file(lookup)
      return await this.loadMeta(file)
    } catch (err) {
      throw warnError('loadMetaByUlid()', err)
    }
  }

  /**
   *
   * @param {string} path
   * @returns {Promise<TMetaDataSets>}
   */
  async loadMetaByPath(path: string): Promise<TMetaDataSets> {
    return await this.loadMetaByExternalPath(path, this.clientAddress)
  }

  /**
   *
   * @param {string} path
   * @param {string} ownerAddress
   * @returns {Promise<TMetaDataSets>}
   */
  async loadMetaByExternalPath(
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
      throw warnError('loadMetaAsExternal()', err)
    }
  }

  /**
   *
   * @param {string} path
   * @param {string} location
   * @param {IFileMeta} fileMeta
   * @returns {Promise<IFileMetaHandler>}
   */
  async loadFromLegacyMerkles(
    path: string,
    location: string,
    fileMeta: IFileMeta,
  ): Promise<IFileMetaHandler> {
    try {
      const lookup = await this.pathToLookup(path)
      const { file } = await this.jackalSigner.queries.fileTree.file(lookup)
      const { contents } = file
      const access = await this.extractEditAccess(file)

      if (access) {
        const { legacyMerkles } = JSON.parse(contents) as IFileContents
        return await FileMetaHandler.create({
          fileMeta,
          legacyMerkles,
          location,
        })
      } else {
        throw new Error('Not Authorized')
      }
    } catch (err) {
      throw warnError('getLegacyMerkle()', err)
    }
  }

  /**
   *
   * @param {string} path
   * @param {string[]} additionalViewers
   * @returns {Promise<IReconstructedFileTree>}
   */
  async setMetaViewers(
    path: string,
    additionalViewers: string[],
  ): Promise<IReconstructedFileTree> {
    try {
      const allViewers = [this.clientAddress, ...additionalViewers]
      const lookup = await this.pathToLookup(path)
      const { file } = await this.jackalSigner.queries.fileTree.file(lookup)
      const { contents, trackingNumber } = file
      const access = await this.extractEditAccess(file)
      if (access) {
        if (contents.includes('metaDataType')) {
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
      throw warnError('setMetaViewers()', err)
    }
  }

  /**
   *
   * @param {string} path
   * @param {string} ownerAddress
   * @returns {Promise<IAesBundle>}
   */
  async loadKeysByPath(
    path: string,
    ownerAddress: string,
  ): Promise<IAesBundle> {
    try {
      const lookup = await this.pathToLookup(path, ownerAddress)
      const { file } = await this.jackalSigner.queries.fileTree.file(lookup)
      return await this.extractViewAccess(file)
    } catch (err) {
      throw warnError('loadKeysByPath()', err)
    }
  }

  /**
   *
   * @param {string} ulid
   * @param {string} ownerAddress
   * @returns {Promise<IAesBundle>}
   */
  async loadKeysByUlid(
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
      throw warnError('loadKeysByUlid()', err)
    }
  }

  /**
   *
   * @returns {Promise<DMsgProvisionFileTree>}
   */
  async encodeProvisionFileTree(): Promise<DMsgProvisionFileTree> {
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
      throw warnError('encodeProvisionFileTree()', err)
    }
  }

  /**
   *
   * @param {TMerkleParentChild} location
   * @param {TMetaDataSets} meta
   * @param {IFileTreeOptions} [options]
   * @returns {Promise<DMsgFileTreePostFile>}
   */
  async encodePostFile(
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
      const stringedMeta = JSON.stringify(meta)
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
      throw warnError('encodePostFile()', err)
    }
  }

  /**
   *
   * @param {string} path
   * @param {TMerkleParentChild} location
   * @param {string[]} additionalViewers
   * @returns {Promise<DMsgFileTreePostFile>}
   */
  async encodeExistingPostFile(
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
      throw warnError('encodeExistingPostFile()', err)
    }
  }

  /**
   *
   * @param {string} receiverAddress
   * @param {IAesBundle} aes
   * @returns {Promise<string>}
   */
  async protectNotification(
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
  async readShareNotification(
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
      throw warnError('readShareNotification()', err)
    }
  }

  /**
   *
   * @param {string} ulid
   * @returns {Promise<ISharedMetaDataMap>}
   */
  async loadSharingFolder(ulid: string): Promise<ISharedMetaDataMap> {
    try {
      const bundle = await this.loadMetaByUlid(ulid)
      if (bundle.metaDataType === 'sharefolder') {
        return await this.metaToSharingFolder(bundle)
      } else {
        throw new Error('No Match')
      }
    } catch (err) {
      throw warnError('loadSharingFolder()', err)
    }
  }

  /**
   *
   * @param {string} path
   * @param {string} [owner]
   * @returns {Promise<DQueryFileTreeFile>}
   * @protected
   */
  protected async pathToLookup(
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
              console.log(path)
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
              console.log(lookup)
              if (!(ownerAddress in this.redpages)) {
                this.redpages[ownerAddress] = {}
              }
              this.redpages[ownerAddress][path] = lookup.ulid
              if (!(ownerAddress in this.yellowpages)) {
                this.yellowpages[ownerAddress] = {}
              }
              await this.setYellowpages(
                path,
                ownerAddress,
                this.redpages[ownerAddress][path],
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
      throw warnError('pathToLookup()', err)
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
  protected async pathToLookupPostProcess(
    path: string,
    ownerAddress: string,
    lookup: DQueryFileTreeFile,
  ): Promise<void> {
    try {
      const { file } = await this.jackalSigner.queries.fileTree.file(lookup)
      const { contents } = file
      const access = await this.extractEditAccess(file)
      if (access) {
        const parsed = !contents.includes('metaDataType')
          ? await this.decryptAndParseContents(file)
          : (JSON.parse(contents) as TMetaDataSets)
        if (parsed.metaDataType === 'folder') {
          const count = hexToInt(parsed.count)
          this.bluepages[ownerAddress][path] = this.basicFolderShell()
          for (let i = 0; i < count; i++) {
            const refMeta = await this.loadRefMeta(
              this.redpages[ownerAddress][path],
              i,
            )
            const meta = await this.loadMetaByUlid(refMeta.pointsTo)
            if (meta.metaDataType === 'folder') {
              const loopPath = `${path}/${meta.whoAmI}`
              this.redpages[ownerAddress][loopPath] = refMeta.pointsTo
              await this.setYellowpages(
                loopPath,
                ownerAddress,
                refMeta.pointsTo,
              )
              this.bluepages[ownerAddress][path].folders[i] = meta
            } else if (meta.metaDataType === 'file') {
              const loopPath = `${path}/${meta.fileMeta.name}`
              this.redpages[ownerAddress][loopPath] = refMeta.pointsTo
              await this.setYellowpages(
                loopPath,
                ownerAddress,
                refMeta.pointsTo,
              )
              this.bluepages[ownerAddress][path].files[i] = meta
            } else if (meta.metaDataType === 'null') {
              const handler = await NullMetaHandler.create(meta.location, i)
              this.bluepages[ownerAddress][path].nulls[i] = handler
            }
          }
        } else {
          // do nothing
        }
      } else {
        throw new Error('Not Authorized')
      }
    } catch (err) {
      throw warnError('pathToLookupPostProcess()', err)
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
  protected async setYellowpages(
    path: string,
    ownerAddress: string,
    pointsTo: string,
  ): Promise<void> {
    const hexAddress = await merklePath(`s/ulid/${pointsTo}`)
    this.yellowpages[ownerAddress][path] = {
      address: hexAddress,
      ownerAddress: await hashAndHexOwner(hexAddress, ownerAddress),
    }
  }

  /**
   *
   * @param {DFile} file
   * @param {[string, string]} [legacyPath]
   * @returns {Promise<TMetaDataSets>}
   * @protected
   */
  protected async loadMeta(
    file: DFile,
    legacyPath?: [string, string],
  ): Promise<TMetaDataSets> {
    try {
      const { contents } = file
      const access = await this.extractEditAccess(file)

      if (access) {
        switch (true) {
          case contents.includes('metaDataType'):
            return JSON.parse(contents)
          case contents.includes('legacyMerkles'):
            if (!legacyPath) {
              throw new Error('legacyMerkles requires legacyPath')
            }
            const { legacyMerkles } = JSON.parse(contents) as IFileContents
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
      throw warnError('loadMeta()', err)
    }
  }

  /**
   *
   * @param {IShareFolderMetaData} meta
   * @returns {Promise<ISharedMetaDataMap>}
   * @protected
   */
  protected async metaToSharingFolder(
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
      throw warnError('loadSingleSharingFolder()', err)
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
  protected async createViewAccess(
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
              warnError('createViewAccess()', `${viewer} not on chain`)
            }
          }
        } else {
          viewAccess[entry] = 'public'
        }
      }
      return JSON.stringify(viewAccess)
    } catch (err) {
      throw warnError('createViewAccess()', err)
    }
  }

  /**
   *
   * @param {string} trackingNumber
   * @param {string[]} editors
   * @returns {Promise<string>}
   * @protected
   */
  protected async createEditAccess(
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
      throw warnError('createEditAccess()', err)
    }
  }

  /**
   *
   * @param {DFile} data
   * @returns {Promise<IAesBundle>}
   * @protected
   */
  protected async extractViewAccess(data: DFile): Promise<IAesBundle> {
    try {
      const parsedAccess = JSON.parse(data.viewingAccess)
      const user = await hashAndHexUserAccess(
        'v',
        data.trackingNumber,
        this.clientAddress,
      )
      if (user in parsedAccess) {
        return await stringToAes(this.keyPair, parsedAccess[user])
      } else {
        throw new Error('Not an authorized Viewer')
      }
    } catch (err) {
      throw warnError('extractViewAccess()', err)
    }
  }

  /**
   *
   * @param {DFile} data
   * @returns {Promise<boolean>}
   * @protected
   */
  protected async extractEditAccess(data: DFile): Promise<boolean> {
    try {
      const parsedAccess = JSON.parse(data.editAccess)
      const user = await hashAndHexUserAccess(
        'e',
        data.trackingNumber,
        this.clientAddress,
      )
      return user in parsedAccess
    } catch (err) {
      throw warnError('extractEditAccess()', err)
    }
  }

  /**
   *
   * @param {DFile} data
   * @returns {Promise<Record<string, any>>}
   * @protected
   */
  protected async decryptAndParseContents(data: DFile): Promise<TMetaDataSets> {
    try {
      const safe = prepDecompressionForAmino(data.contents)
      const aes = await this.extractViewAccess(data)
      let decrypted = await cryptString(safe, aes, 'decrypt')
      if (decrypted.startsWith('jklpc1')) {
        decrypted = safeDecompressData(decrypted)
      }
      return JSON.parse(decrypted) as TMetaDataSets
    } catch (err) {
      throw warnError('decryptAndParseContents()', err)
    }
  }

  /**
   *
   * @returns {IChildMetaDataMap}
   * @protected
   */
  protected basicFolderShell(): IChildMetaDataMap {
    return {
      files: {},
      folders: {},
      nulls: {},
    }
  }
}
