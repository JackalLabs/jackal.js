import { parseMsgResponse } from '@jackallabs/jackal.js-protos'
import {
  extractFileMetaData,
  hexToInt,
  stringToUint8Array,
  timestampToBlockHeight,
} from '@/utils/converters'
import { tidyString, warnError } from '@/utils/misc'
import {
  createEditAccess,
  createViewAccess,
  loadFileTreeMetaData,
} from '@/utils/filetree'
import { MetaHandler } from '@/classes/metaHandler'
import { encryptionChunkSize } from '@/utils/globalDefaults'
import {
  aesBlobCrypt,
  compressEncryptString,
  genIv,
  genKey,
} from '@/utils/crypt'
import {
  hashAndHex,
  merkleParentAndChild,
  merkleParentAndIndex,
} from '@/utils/hash'
import {
  DDeliverTxResponse,
  DEncodeObject,
  DMsgBuyStorage,
  DMsgFileTreePostFile,
  DMsgProvisionFileTree,
  DMsgStorageDeleteFile,
  DMsgStoragePostFile,
  DMsgStoragePostFileResponse,
  DUnifiedFile,
  IJackalSigningStargateClient,
} from '@jackallabs/jackal.js-protos'
import type {
  IAesBundle,
  IChildMetaDataMap,
  IClientHandler,
  IDownloadTracker,
  IFileMetaData,
  IFileTreePackage,
  IFolderMetaData,
  IMetaHandler,
  INullMetaData,
  IProviderUploadResponse,
  IRefMetaData,
  IStagedUploadPackage,
  IStorageHandler,
  IUploadPackage,
  IWrappedEncodeObject,
} from '@/interfaces'
import type { TMetaDataSets, TLoadedFolder, TMerkleParentChild } from '@/types'

export class StorageHandler implements IStorageHandler {
  protected readonly basePath: string
  protected readonly privateKey: string
  protected readonly jackalClient: IClientHandler
  protected readonly signingClient: IJackalSigningStargateClient
  protected readonly proofInterval: number
  protected readonly userAddress: string
  protected uploadsInProgress: boolean
  protected uploadQueue: IUploadPackage[]
  protected stagedUploads: Record<string, IStagedUploadPackage>
  protected currentPath: string
  protected indexCount: number
  protected children: IChildMetaDataMap

  protected constructor(
    client: IClientHandler,
    storageAddress: string,
    basePath: string,
    loadedFolder: TLoadedFolder,
  ) {
    const [indexCount, children]: TLoadedFolder = loadedFolder

    this.basePath = basePath
    this.privateKey = client.getPrivateKey()
    this.jackalClient = client
    this.signingClient = client.getSigningClient()
    this.proofInterval = client.getProofWindow()
    this.userAddress = client.getJackalAddress()
    this.uploadsInProgress = false
    this.uploadQueue = []
    this.stagedUploads = {}
    this.currentPath = storageAddress
    this.indexCount = indexCount
    this.children = children

    window.addEventListener('beforeunload', this.beforeUnloadHandler)
  }

  /**
   *
   * @param {IClientHandler} client
   * @param {string} basePath
   * @returns {Promise<IStorageHandler>}
   */
  static async init(
    client: IClientHandler,
    basePath: string = 's/Home',
  ): Promise<IStorageHandler> {
    const storageAddress = ''
    const loadedFolder: TLoadedFolder = await this.loadFolder(
      client.getSigningClient(),
      client.getPrivateKey(),
      client.getJackalAddress(),
      storageAddress,
      basePath,
    ).catch((err) => {
      throw warnError('storageHandler init()', err)
    })
    return new StorageHandler(
      client,
      storageAddress,
      basePath,
      loadedFolder,
    )
  }

  /**
   *
   * @param {IJackalSigningStargateClient} client
   * @param {string} key
   * @param {string} userAddress
   * @param {string} storageAddress
   * @param {string} basePath
   * @returns {Promise<TLoadedFolder>}
   */
  static async loadFolder(
    client: IJackalSigningStargateClient,
    key: string,
    userAddress: string,
    storageAddress: string,
    basePath: string,
  ): Promise<TLoadedFolder> {
    const parsed = await loadFileTreeMetaData(
      client,
      key,
      userAddress,
      storageAddress,
      basePath,
    )
      .then(async (resp: TMetaDataSets) => {
        const { pointsTo } = resp as IRefMetaData
        const pointsToParts = pointsTo.split('/')
        const index = pointsToParts.pop() as string
        const folderAddress = pointsToParts.join('/')
        return await loadFileTreeMetaData(
          client,
          key,
          userAddress,
          '',
          folderAddress,
          hexToInt(index),
        ).catch(async (err) => {
          throw err
        })
      })
      .catch(async (err) => {
        if (err.toString().includes('key not found')) {
          warnError(
            'storageHandler loadFolder()',
            'Hit "key not found", using folder fallback and continuing',
          )
          const path = tidyString(`${basePath}/${storageAddress}`, '/')
          const baseFolderMeta = await MetaHandler.create(path, { count: 0 })
          return baseFolderMeta.getFolderMeta()
        } else {
          throw warnError('storageHandler loadFolder()', err)
        }
      })
    if (parsed && 'count' in parsed) {
      const metaData = parsed as IFolderMetaData
      const indexCount = hexToInt(metaData.count)
      const children: IChildMetaDataMap = this.basicFolderShell()
      for (let i = 0; i < indexCount; i++) {
        const unsorted = await loadFileTreeMetaData(
          client,
          key,
          userAddress,
          storageAddress,
          basePath,
          i,
        ).catch((err) => {
          throw warnError('storageHandler loadFolder()', err)
        })
        if (unsorted.metaDataType === 'file') {
          const fileMeta = unsorted as IFileMetaData
          fileMeta.merkleRoot = stringToUint8Array(fileMeta.merkleMem)
          children.files[i] = fileMeta
        } else if (unsorted.metaDataType === 'folder') {
          children.folders[i] = unsorted as IFolderMetaData
        } else if (unsorted.metaDataType === 'null') {
          children.nulls[i] = unsorted as INullMetaData
        } else {
          warnError(
            'storageHandler loadFolder()',
            `Invalid MetaData for unsorted\n\n${unsorted}\n\nContinuing...`,
          )
        }
      }
      return [indexCount, children]
    } else {
      if ('metaDataType' in parsed) {
        warnError(
          'storageHandler loadFolder()',
          `Wrong MetaData type - ${parsed.metaDataType}. Using folder fallback and continuing`,
        )
        const children: IChildMetaDataMap = this.basicFolderShell()
        return [0, children]
      } else {
        console.dir(parsed)
        throw new Error(
          warnError(
            'storageHandler loadFolder()',
            `Invalid parsed value ${parsed}`,
          ),
        )
      }
    }
  }

  /**
   *
   * @returns {IChildMetaDataMap}
   */
  static basicFolderShell(): IChildMetaDataMap {
    return {
      files: {},
      folders: {},
      nulls: {},
    }
  }

  /**
   *
   * @param {BeforeUnloadEvent} ev
   * @protected
   */
  protected beforeUnloadHandler(ev: BeforeUnloadEvent): void {
    if (this.uploadsInProgress) {
      ev.preventDefault()
      ev.returnValue = true
    }
  }

  /**
   *
   */
  cleanShutdown(): void {
    window.removeEventListener('beforeunload', this.beforeUnloadHandler)
  }

  /**
   *
   * @param {number} mod
   * @returns {Promise<DDeliverTxResponse>}
   */
  async initStorage(mod: number = 10): Promise<DDeliverTxResponse> {
    const trackingNumber = crypto.randomUUID()
    const forInit: DMsgProvisionFileTree = {
      creator: this.userAddress,
      viewers: await createViewAccess(trackingNumber, [this.userAddress]),
      editors: await createEditAccess(trackingNumber, [this.userAddress]),
      trackingNumber: trackingNumber,
    }
    const wrappedInitMsg: IWrappedEncodeObject = {
      encodedObject:
        this.signingClient.txLibrary.fileTree.msgProvisionFileTree(forInit),
      modifier: mod,
    }
    return await this.jackalClient.broadcastsMsgs([wrappedInitMsg])
  }

  /**
   *
   * @param {number} gb
   * @param {number} [days]
   * @returns {Promise<DDeliverTxResponse>}
   */
  async buyStoragePlan(gb: number, days?: number): Promise<DDeliverTxResponse> {
    const durationDays = Number(days) > 30 ? Number(days) : 30
    const bytes = 3 * 1000000000 * (Number(gb) || 1)
    const toBuy: DMsgBuyStorage = {
      creator: this.userAddress,
      forAddress: this.userAddress,
      durationDays,
      bytes,
      paymentDenom: 'ujkl',
    }
    const wrappedBuyMsg: IWrappedEncodeObject = {
      encodedObject: this.signingClient.txLibrary.storage.msgBuyStorage(toBuy),
      modifier: 0,
    }
    return await this.jackalClient.broadcastsMsgs([wrappedBuyMsg])
  }

  async saveFolder(
    bundle: IStagedUploadPackage,
  ): Promise<IWrappedEncodeObject[]> {
    const msgs: IWrappedEncodeObject[] = []
    const blockHeight = await this.jackalClient.getLatestBlockHeight().catch((err) => {
      throw warnError('storageHandler saveFolder()', err)
    })
    let matchedCount = 0
    let foundMatch = false
    const childrenFilesLen = Object.keys(bundle.children.files).length
    for (let pkg of bundle.queue) {
      const meta = pkg.meta.getFileMeta()
      if (matchedCount < childrenFilesLen) {
        for (let index in bundle.children.files) {
          const existingFilesIndex = hexToInt(index)
          if (
            bundle.children.files[index].fileMeta.name === meta.fileMeta.name
          ) {
            pkg.meta.setRefIndex(existingFilesIndex)
            matchedCount++
            const { merkleRoot } = bundle.children.files[index]
            const { files } = await this.signingClient.queries.storage
              .allFilesByMerkle({ merkle: merkleRoot })
              .catch((err) => {
                throw warnError('storageHandler saveFolder()', err)
              })
            const [target] = files.filter(
              (file) => file.owner === this.userAddress,
            )
            const updates = await this.existingPkgToMsgs(
              target,
              pkg,
              blockHeight,
            ).catch((err) => {
              throw warnError('storageHandler saveFolder()', err)
            })
            msgs.push(...updates)
            foundMatch = true
            break
          }
        }
      }
      if (foundMatch) {
        continue
      } else {
        const nulls = Object.keys(bundle.children.nulls)
        if (nulls.length) {
          const nullIndex = hexToInt(nulls[0])
          pkg.meta.setRefIndex(nullIndex)
          const nullReplacement = await this.pkgToMsgs(pkg, blockHeight).catch(
            (err) => {
              throw warnError('storageHandler saveFolder()', err)
            },
          )
          msgs.push(...nullReplacement)
          delete bundle.children.nulls[nullIndex]
        } else {
          const { count } = bundle.folderMeta.getFolderMeta()
          pkg.meta.setRefIndex(hexToInt(count))
          const fresh = await this.pkgToMsgs(pkg, blockHeight).catch((err) => {
            throw warnError('storageHandler saveFolder()', err)
          })
          msgs.push(...fresh)
          bundle.folderMeta.addToCount(1)
        }
      }
      foundMatch = false
    }

    // TODO - fix this later
    bundle.folderMeta.setRefIndex(0)
    const folderMsgs = await this.folderToMsgs({
      meta: bundle.folderMeta,
    }).catch((err) => {
      throw warnError('storageHandler saveFolder()', err)
    })
    msgs.unshift(...folderMsgs)
    return msgs
  }

  /**
   *
   * @param {IFileTreePackage} pkg
   * @returns {Promise<IWrappedEncodeObject[]>}
   * @protected
   */
  protected async folderToMsgs(
    pkg: IFileTreePackage,
  ): Promise<IWrappedEncodeObject[]> {
    const fileTreeFolder = this.encodeFileTreeFolder(pkg).catch((err) => {
      throw warnError('storageHandler folderToMsgs()', err)
    })
    const ref = this.encodeFileTreeRef(pkg).catch((err) => {
      throw warnError('storageHandler folderToMsgs()', err)
    })
    return [
      {
        encodedObject: await fileTreeFolder,
        modifier: 0,
      },
      {
        encodedObject: await ref,
        modifier: 0,
      },
    ]
  }

  /**
   *
   * @param {IUploadPackage} pkg
   * @param {number} blockHeight
   * @returns {Promise<IWrappedEncodeObject[]>}
   * @protected
   */
  protected async pkgToMsgs(
    pkg: IUploadPackage,
    blockHeight: number,
  ): Promise<IWrappedEncodeObject[]> {
    const storageFile = this.encodeStoragePostFile(pkg, blockHeight)
    const fileTreeFile = this.encodeFileTreeFile(pkg).catch((err) => {
      throw warnError('storageHandler pkgToMsgs()', err)
    })
    const ref = this.encodeFileTreeRef(pkg).catch((err) => {
      throw warnError('storageHandler pkgToMsgs()', err)
    })
    return [
      {
        encodedObject: storageFile,
        modifier: 0,
        file: pkg.file,
        merkle: pkg.meta.getFileMeta().merkleLocation,
      },
      {
        encodedObject: await fileTreeFile,
        modifier: 0,
      },
      {
        encodedObject: await ref,
        modifier: 0,
      },
    ]
  }

  /**
   *
   * @param {DUnifiedFile} toReplace
   * @param {IUploadPackage} pkg
   * @param {number} blockHeight
   * @returns {Promise<IWrappedEncodeObject[]>}
   * @protected
   */
  protected async existingPkgToMsgs(
    toReplace: DUnifiedFile,
    pkg: IUploadPackage,
    blockHeight: number,
  ): Promise<IWrappedEncodeObject[]> {
    const removeFile = this.encodeStorageDeleteFile(toReplace)
    const storageFile = this.encodeStoragePostFile(pkg, blockHeight)
    const fileTreeFile = this.encodeFileTreeFile(pkg).catch((err) => {
      throw warnError('storageHandler pkgToMsgs()', err)
    })
    return [
      {
        encodedObject: removeFile,
        modifier: 0,
      },
      {
        encodedObject: storageFile,
        modifier: 0,
        file: pkg.file,
        merkle: pkg.meta.getFileMeta().merkleLocation,
      },
      {
        encodedObject: await fileTreeFile,
        modifier: 0,
      },
    ]
  }

  /**
   *
   * @param {IUploadPackage} item
   * @param {number} currentBlock
   * @returns {DEncodeObject}
   * @protected
   */
  protected encodeStoragePostFile(
    item: IUploadPackage,
    currentBlock: number,
  ): DEncodeObject {
    const forStorage: DMsgStoragePostFile = {
      creator: this.userAddress,
      merkle: item.meta.getFileMeta().merkleRoot,
      fileSize: item.file.size,
      proofInterval: this.proofInterval,
      proofType: 0,
      maxProofs: 3,
      expires: this.createExpiresValue(item.duration, currentBlock),
      note: JSON.stringify({}),
    }
    return this.signingClient.txLibrary.storage.msgPostFile(forStorage)
  }

  /**
   *
   * @param {DUnifiedFile} item
   * @returns {DEncodeObject}
   * @protected
   */
  protected encodeStorageDeleteFile(item: DUnifiedFile): DEncodeObject {
    const { merkle, start } = item
    const forRemoval: DMsgStorageDeleteFile = {
      creator: this.userAddress,
      merkle,
      start,
    }
    return this.signingClient.txLibrary.storage.msgDeleteFile(forRemoval)
  }

  /**
   *
   * @param {TMerkleParentChild} location
   * @param {TMetaDataSets} meta
   * @param {IAesBundle} aes
   * @returns {Promise<DEncodeObject>}
   * @protected
   */
  protected async encodeFileTreePostFile(
    location: TMerkleParentChild,
    meta: TMetaDataSets,
    aes?: IAesBundle,
  ): Promise<DEncodeObject> {
    const [hashParent, hashChild] = location
    const forFileTree: DMsgFileTreePostFile = {
      creator: this.userAddress,
      account: await hashAndHex(this.userAddress),
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
      forFileTree.contents = await compressEncryptString(stringedMeta, aes)
      forFileTree.viewers = await createViewAccess(
        trackingNumber,
        [this.userAddress],
        this.jackalClient,
        aes,
      )
      forFileTree.editors = await createEditAccess(trackingNumber, [
        this.userAddress,
      ])
      forFileTree.trackingNumber = trackingNumber
    } else {
      forFileTree.contents = stringedMeta
      forFileTree.viewers = await createViewAccess(trackingNumber, [
        this.userAddress,
      ])
      forFileTree.editors = await createEditAccess(trackingNumber, [
        this.userAddress,
      ])
      forFileTree.trackingNumber = trackingNumber
    }
    return this.signingClient.txLibrary.fileTree.msgPostFile(forFileTree)
  }

  /**
   *
   * @param {IUploadPackage} item
   * @returns {Promise<DEncodeObject>}
   * @protected
   */
  protected async encodeFileTreeFile(
    item: IUploadPackage,
  ): Promise<DEncodeObject> {
    const meta = item.meta.getFileMeta()
    const parentAndChild = await merkleParentAndIndex(
      item.meta.getPath(),
      item.meta.getRefIndex(),
    )
    return this.encodeFileTreePostFile(parentAndChild, meta, item.aes)
  }

  /**
   *
   * @param {IFileTreePackage} item
   * @returns {Promise<DEncodeObject>}
   * @protected
   */
  protected async encodeFileTreeFolder(
    item: IFileTreePackage,
  ): Promise<DEncodeObject> {
    const meta = item.meta.getFolderMeta()
    const parentAndChild = await merkleParentAndIndex(
      item.meta.getPath(),
      item.meta.getRefIndex(),
    )
    return this.encodeFileTreePostFile(parentAndChild, meta, item.aes)
  }

  /**
   *
   * @param {IUploadPackage | IFileTreePackage} item
   * @returns {Promise<DEncodeObject>}
   * @protected
   */
  protected async encodeFileTreeRef(
    item: IUploadPackage | IFileTreePackage,
  ): Promise<DEncodeObject> {
    const meta = item.meta.getRefMeta()
    const parentAndChild = await merkleParentAndChild(meta.location)
    return this.encodeFileTreePostFile(parentAndChild, meta, item.aes)
  }

  /**
   *
   * @param {number} source
   * @param {number} currentBlock
   * @returns {number}
   * @protected
   */
  protected createExpiresValue(source: number, currentBlock: number): number {
    if (source < 0) {
      const dd = new Date()
      dd.setFullYear(dd.getFullYear() + Math.abs(source))
      return timestampToBlockHeight(dd.getTime(), currentBlock)
    } else {
      return timestampToBlockHeight(source, currentBlock)
    }
  }

  /**
   *
   * @param {string} path
   * @returns {string}
   * @protected
   */
  protected sanitizePath(path: string): string {
    const singleSlashPath = path.replaceAll(/\/+/, '/')
    const rootFreePath = singleSlashPath.replace('s/Home', '')
    return tidyString(rootFreePath, '/')
  }

  /**
   *
   * @returns {string}
   */
  readActivePath(): string {
    return tidyString(`${this.basePath}/${this.currentPath}`, '/')
  }

  /**
   *
   * @param {string} name
   * @returns {string}
   * @protected
   */
  protected assembleLocation(name: string): string {
    return `${this.readActivePath()}/${name}`
  }

  /**
   *
   * @returns {Promise<void>}
   * @protected
   */
  protected async refreshActiveFolder(): Promise<void> {
    const [indexCount, children] = await StorageHandler.loadFolder(
      this.signingClient,
      this.privateKey,
      this.userAddress,
      this.currentPath,
      this.basePath,
    ).catch((err) => {
      throw warnError('storageHandler refreshActiveFolder()', err)
    })
    this.indexCount = indexCount
    this.children = children
  }

  /**
   *
   * @param {string} path
   * @returns {Promise<string>}
   */
  async changeActiveDirectory(path: string): Promise<string> {
    await this.stageQueue()
    this.currentPath = this.sanitizePath(path)
    await this.refreshActiveFolder()
    return this.currentPath
  }

  /**
   *
   * @param {File} toProcess
   * @param {number} duration
   * @returns {Promise<IUploadPackage>}
   * @protected
   */
  protected async processPrivate(
    toProcess: File,
    duration: number = 0,
  ): Promise<IUploadPackage> {
    const aes: IAesBundle = {
      key: await genKey(),
      iv: genIv(),
    }
    const encryptedArray: Blob[] = []
    for (let i = 0; i < toProcess.size; i += encryptionChunkSize) {
      const blobChunk = toProcess.slice(i, i + encryptionChunkSize)
      encryptedArray.push(
        new Blob([(blobChunk.size + 16).toString().padStart(8, '0')]),
        await aesBlobCrypt(blobChunk, aes, 'encrypt'),
      )
    }
    const fileMeta = extractFileMetaData(toProcess)
    const finalName = await hashAndHex(fileMeta.name + Date.now().toString())
    const file = new File(encryptedArray, finalName, { type: 'text/plain' })

    const baseMeta = await MetaHandler.create(this.readActivePath(), {
      file,
      fileMeta,
    })
    return { file, meta: baseMeta, duration, aes }
  }

  /**
   *
   * @param {File | File[]} toQueue
   * @param {number} duration
   * @returns {Promise<number>}
   */
  async queuePrivate(
    toQueue: File | File[],
    duration?: number,
  ): Promise<number> {
    if (toQueue instanceof Array) {
      for (let file of toQueue) {
        this.uploadQueue.push(await this.processPrivate(file, duration))
      }
      return toQueue.length
    } else {
      this.uploadQueue.push(await this.processPrivate(toQueue, duration))
      return 1
    }
  }

  /**
   *
   * @param {File} toProcess
   * @param {number} duration
   * @returns {Promise<IUploadPackage>}
   * @protected
   */
  protected async processPublic(
    toProcess: File,
    duration: number = 0,
  ): Promise<IUploadPackage> {
    const fileMeta = extractFileMetaData(toProcess)
    const baseMeta = await MetaHandler.create(this.readActivePath(), {
      file: toProcess,
      fileMeta,
    })
    return { file: toProcess, meta: baseMeta, duration }
  }

  /**
   *
   * @param {File | File[]} toQueue
   * @param {number} duration
   * @returns {Promise<number>}
   */
  async queuePublic(
    toQueue: File | File[],
    duration?: number,
  ): Promise<number> {
    if (toQueue instanceof Array) {
      for (let file of toQueue) {
        this.uploadQueue.push(await this.processPublic(file, duration))
      }
      return toQueue.length
    } else {
      this.uploadQueue.push(await this.processPublic(toQueue, duration))
      return 1
    }
  }

  /**
   *
   * @returns {Promise<void>}
   * @protected
   */
  protected async stageQueue(): Promise<void> {
    const path = this.readActivePath()
    const instance = this.stagedUploads[path]

    if (instance) {
      instance.queue.push(...this.uploadQueue)
      this.uploadQueue = []
    } else {
      const meta: IMetaHandler = await MetaHandler.create(path, {
        count: this.indexCount,
      })
      const queue: IUploadPackage[] = []
      queue.push(...this.uploadQueue)
      this.uploadQueue = []
      this.stagedUploads[path] = {
        children: this.children,
        folderMeta: meta,
        queue,
      }
    }
  }

  /**
   *
   * @returns {Promise<number>}
   * @protected
   */
  protected async loadLastBlockHeight(): Promise<number> {
    const tm = this.signingClient.baseTmClient()
    if (!tm) {
      throw new Error(
        warnError(
          'storageHandler loadLastBlockHeight()',
          'Invalid baseTmClient()',
        ),
      )
    }
    const { lastBlockHeight } = await tm.abciInfo()
    if (!lastBlockHeight) {
      throw new Error(
        warnError(
          'storageHandler loadLastBlockHeight()',
          'Invalid lastBlockHeight',
        ),
      )
    }
    return lastBlockHeight
  }

  /*
get merkletree root - done
storagepostfile - done
filetreepostfile - done
parse response - done
upload to providers - done
 */

  async wip(): Promise<DDeliverTxResponse> {
    await this.stageQueue()
    const msgs: IWrappedEncodeObject[] = []
    for (let folderName in this.stagedUploads) {
      const readyMsgs = await this.saveFolder(this.stagedUploads[folderName])
      msgs.push(...readyMsgs)
    }

    const meh: DDeliverTxResponse = await this.jackalClient.broadcastsMsgs(msgs)

    const activeUploads: Promise<IProviderUploadResponse>[] = []

    for (let i = 0; i < msgs.length; i++) {
      const { file, merkle } = msgs[i]
      if (file && merkle && meh.data) {
        console.log('meh.data')
        console.log(meh.data)
        const dat = parseMsgResponse(meh.data[i]) as DMsgStoragePostFileResponse
        console.log('dat')
        console.log(dat)
        const { providerIps, startBlock } = dat
        console.log('upload providerIps')
        console.log(providerIps)
        for (let provider of providerIps) {
          this.uploadsInProgress = true
          activeUploads.push(
            this.uploadFile(`${provider}/upload`, startBlock, file, merkle),
          )
        }
      }
    }

    await Promise.all(activeUploads)
      .then(() => {
        this.uploadsInProgress = false
      })
      .catch((err) => {
        throw warnError('storageHandler wip()', err)
      })

    for (let item of activeUploads) {
      console.log(await item)
    }

    await this.refreshActiveFolder()

    return meh
  }

  /**
   *
   * @param {string} url
   * @param {number} startBlock
   * @param {File} file
   * @param {string} merkle
   * @returns {Promise<IProviderUploadResponse>}
   */
  async uploadFile(
    url: string,
    startBlock: number,
    file: File,
    merkle: string,
  ): Promise<IProviderUploadResponse> {
    const fileFormData = new FormData()
    fileFormData.set('file', file)
    fileFormData.set('merkle', merkle)
    fileFormData.set('sender', this.userAddress)
    fileFormData.set('start', startBlock.toString())

    return await fetch(url, { method: 'POST', body: fileFormData })
      .then(async (resp): Promise<IProviderUploadResponse> => {
        if (resp.status !== 200) {
          console.dir(await resp.json())
          throw new Error(`Status Message: ${resp.statusText}`)
        } else {
          return resp.json()
        }
      })
      .catch((err) => {
        throw warnError('storageHandler uploadFile()', err)
      })
  }

  async downloadFile(
    fileDetails: IFileMetaData,
    trackers: IDownloadTracker,
  ): Promise<File> {
    console.log('fileDetails.merkleRoot')
    console.log(fileDetails.merkleRoot)
    const { providerIps } = await this.signingClient.queries.storage.findFile({
      merkle: fileDetails.merkleRoot,
    })
    console.log('providerIps:', providerIps)
    const provider = providerIps[Math.floor(Math.random() * providerIps.length)]
    // const hexMerkle = bufferToHex(fileDetails.merkleRoot)
    const url = `${provider}/download/${fileDetails.merkleLocation}`
    console.log('url:', url)
    return await fetch(url, { method: 'GET' })
      .then(async (resp): Promise<File> => {
        const contentLength = resp.headers.get('Content-Length')
        if (resp.status !== 200) {
          throw new Error(`Status Message: ${resp.statusText}`)
        } else if (!resp.body || !contentLength) {
          throw new Error(`Invalid response body`)
        } else {
          const reader = resp.body.getReader()
          let receivedLength = 0
          while (true) {
            const { done, value } = await reader.read()
            if (done) {
              break
            }
            trackers.chunks.push(value)
            receivedLength += value.length
            trackers.progress =
              Math.floor((receivedLength / Number(contentLength)) * 100) || 1
          }
          const { name, ...meta } = fileDetails.fileMeta
          return new File(trackers.chunks, name, meta)
        }
      })
      .catch((err) => {
        throw warnError('storageHandler downloadFile()', err)
      })
  }

  debug(): IChildMetaDataMap {
    return this.children
  }
}
