import type {
  DDeliverTxResponse,
  DMsgBuyStorage,
  DMsgPostKey,
  DMsgProvisionFileTree,
  THostSigningClient,
  TJackalSigningClient,
} from '@jackallabs/jackal.js-protos'
import { PrivateKey } from 'eciesjs'
import {
  extractFileMetaData,
  hexToInt,
  stringToUint8Array,
} from '@/utils/converters'
import {
  isItPastDate,
  signerNotEnabled,
  tidyString,
  warnError,
} from '@/utils/misc'
import {
  createEditAccess,
  createViewAccess,
  getLegacyMerkle,
  loadExternalFileTreeMetaData,
  loadFileTreeMetaData,
  loadFolderFileTreeMetaData,
  loadKeysFromFileTree,
  reconstructFileTreeMetaData,
} from '@/utils/filetree'
import { MetaHandler } from '@/classes/metaHandler'
import {
  encryptionChunkSize,
  sharedPath,
  signatureSeed,
} from '@/utils/globalDefaults'
import { aesBlobCrypt, genAesBundle, genIv, genKey } from '@/utils/crypt'
import { hashAndHex, stringToShaHex } from '@/utils/hash'

import {
  loadSingleSharingFolder,
  readShareNotification,
} from '@/utils/notifications'
import { EncodingHandler } from '@/classes/encodingHandler'
import { SharedUpdater } from '@/classes/sharedUpdater'
import { bech32 } from '@jackallabs/bech32'
import type {
  IAesBundle,
  IChecks,
  IChildMetaDataMap,
  IClientHandler,
  IDownloadTracker,
  IFileMeta,
  IFileMetaData,
  IFolderMetaData,
  IMetaHandler,
  INotification,
  INotificationPackage,
  INullMetaData,
  IProviderUploadResponse,
  IRefMetaData,
  IRnsHandler,
  IShareFolderMetaData,
  IStagedUploadPackage,
  IStorageHandler,
  IStorageOptions,
  IStorageStatus,
  IUploadPackage,
  IWrappedEncodeObject,
} from '@/interfaces'
import type { TLoadedFolder, TSharedRootMetaDataMap } from '@/types'
import { IConversionFolderBundle } from '@/interfaces/IConversionFolderBundle'

export class StorageHandler extends EncodingHandler implements IStorageHandler {
  protected readonly rns: IRnsHandler | null
  protected readonly basePath: string
  protected readonly keyPair: PrivateKey
  protected readonly jackalClient: IClientHandler
  protected readonly proofInterval: number
  protected mustConvert: boolean
  protected uploadsInProgress: boolean
  protected uploadQueue: IUploadPackage[]
  protected stagedUploads: Record<string, IStagedUploadPackage>
  protected currentPath: string
  protected indexCount: number
  protected children: IChildMetaDataMap
  protected shared: TSharedRootMetaDataMap

  protected constructor(
    rns: IRnsHandler | null,
    client: IClientHandler,
    jackalSigner: TJackalSigningClient,
    hostSigner: THostSigningClient,
    accountAddress: string,
    keyPair: PrivateKey,
    storageAddress: string,
    basePath: string,
    loadedFolder: TLoadedFolder,
    shared: TSharedRootMetaDataMap,
  ) {
    super(client, jackalSigner, hostSigner, accountAddress)
    const [indexCount, children, mustConvert]: TLoadedFolder = loadedFolder

    this.rns = rns
    this.basePath = basePath
    this.keyPair = keyPair
    this.jackalClient = client
    this.proofInterval = client.getProofWindow()

    this.uploadsInProgress = false
    this.uploadQueue = []
    this.stagedUploads = {}
    this.currentPath = storageAddress
    this.indexCount = indexCount
    this.children = children
    this.mustConvert = mustConvert
    this.shared = shared

    window.addEventListener('beforeunload', this.beforeUnloadHandler)
  }

  /**
   *
   * @param {IClientHandler} client
   * @param {IStorageOptions} [options]
   * @returns {Promise<IStorageHandler>}
   */
  static async init(
    client: IClientHandler,
    options: IStorageOptions = {},
  ): Promise<IStorageHandler> {
    const {
      rns = null,
      basePath = 's/Home',
      accountAddress = client.getJackalAddress(),
    } = options

    const jackalSigner = client.getJackalSigner()
    if (!jackalSigner) {
      throw new Error(signerNotEnabled('StorageHandler', 'init'))
    }
    const hostSigner = client.getHostSigner()
    if (!hostSigner) {
      throw new Error(signerNotEnabled('StorageHandler', 'init'))
    }
    const selectedWallet = client.getSelectedWallet()
    switch (selectedWallet) {
      case 'keplr':
        if (!window.keplr) {
          throw new Error('Keplr Wallet selected but unavailable')
        }
        break
      case 'leap':
        if (!window.leap) {
          throw new Error('Leap Wallet selected but unavailable')
        }
        break
      default:
        throw new Error(
          'No wallet selected but one is required to init StorageHandler',
        )
    }

    try {
      const hostAddress = client.getHostAddress()
      const chainId = client.getHostChainId()
      let signatureAsHex = ''
      switch (selectedWallet) {
        case 'keplr':
          if (!window.keplr) {
            throw 'Missing wallet extension'
          } else {
            const { signature } = await window.keplr.signArbitrary(
              chainId,
              hostAddress,
              signatureSeed,
            )
            signatureAsHex = await stringToShaHex(signature)
          }
          break
        case 'leap':
          if (!window.leap) {
            throw 'Missing wallet extension'
          } else {
            const { signature } = await window.leap.signArbitrary(
              chainId,
              hostAddress,
              signatureSeed,
            )
            signatureAsHex = await stringToShaHex(signature)
          }
          break
      }
      const keyPair = PrivateKey.fromHex(signatureAsHex)
      const storageAddress = ''
      let loadedFolder: TLoadedFolder = [-1, this.basicFolderShell(), false]
      let shared: TSharedRootMetaDataMap = {}
      try {
        loadedFolder = await this.loadFolder(
          jackalSigner,
          keyPair,
          accountAddress,
          storageAddress,
          basePath,
        )
        shared = await this.loadShared(jackalSigner, keyPair, accountAddress)
      } catch (err) {
        warnError('Nonfatal StorageHandler init()', err)
      }
      return new StorageHandler(
        rns,
        client,
        jackalSigner,
        hostSigner,
        accountAddress,
        keyPair,
        storageAddress,
        basePath,
        loadedFolder,
        shared,
      )
    } catch (err) {
      throw warnError('storageHandler init()', err)
    }
  }

  /**
   *
   * @param {TJackalSigningClient} client
   * @param {string} key
   * @param {string} userAddress
   * @param {string} storageAddress
   * @param {string} basePath
   * @returns {Promise<TLoadedFolder>}
   */
  static async loadFolder(
    client: TJackalSigningClient,
    key: PrivateKey,
    userAddress: string,
    storageAddress: string,
    basePath: string,
  ): Promise<TLoadedFolder> {
    try {
      const bundle = await loadFolderFileTreeMetaData(
        client,
        key,
        userAddress,
        storageAddress,
        basePath,
      )
      if (bundle.requiresConversion) {
        return [-1, this.basicFolderShell(), true]
      } else if (bundle && 'count' in bundle.metaData) {
        const metaData = bundle.metaData as IFolderMetaData
        // console.log('metaData:', metaData)
        const indexCount = hexToInt(metaData.count)
        const children: IChildMetaDataMap = this.basicFolderShell()
        for (let i = 0; i < indexCount; i++) {
          const ref = await loadFileTreeMetaData(
            client,
            key,
            userAddress,
            storageAddress,
            basePath,
            i,
          )
          const unsorted = await loadFileTreeMetaData(
            client,
            key,
            userAddress,
            '',
            (ref as IRefMetaData).pointsTo,
          ).catch(() => {
            /* do nothing */
          })
          if (!unsorted) {
            continue
          }
          // console.log('unsorted:', unsorted)
          if (unsorted.metaDataType === 'file') {
            const fileMeta = unsorted as IFileMetaData
            fileMeta.merkleRoot = stringToUint8Array(fileMeta.merkleMem)
            children.files[i] = fileMeta
          } else if (unsorted.metaDataType === 'folder') {
            children.folders[i] = unsorted as IFolderMetaData
          } else if (unsorted.metaDataType === 'null') {
            children.nulls[i] = unsorted as INullMetaData
          } else {
            console.dir(unsorted)
          }
        }
        return [indexCount, children, false]
      } else {
        console.dir(bundle)
        throw new Error('Invalid parsed value')
      }
    } catch (err) {
      throw warnError('storageHandler loadFolder()', err)
    }
  }

  /**
   *
   * @param {TJackalSigningClient} client
   * @param {PrivateKey} key
   * @param {string} userAddress
   * @returns {Promise<TSharedRootMetaDataMap>}
   */
  static async loadShared(
    client: TJackalSigningClient,
    key: PrivateKey,
    userAddress: string,
  ): Promise<TSharedRootMetaDataMap> {
    try {
      const data: TSharedRootMetaDataMap = {}
      const parsed = await loadFileTreeMetaData(
        client,
        key,
        userAddress,
        sharedPath,
        's',
      )
      // console.log('parsed:', parsed)
      if (parsed && 'count' in parsed) {
        const metaData = parsed as IFolderMetaData
        const indexCount = hexToInt(metaData.count)
        for (let i = 0; i < indexCount; i++) {
          const ref = await loadFileTreeMetaData(
            client,
            key,
            userAddress,
            sharedPath,
            's',
            i,
          ).catch(() => {
            console.log('caught')
          })
          if (!ref) {
            continue
          }
          const wedgeRef = ref as IShareFolderMetaData
          // console.log('wedgeRef:', wedgeRef)
          const wedge = await loadSingleSharingFolder(
            client,
            key,
            userAddress,
            wedgeRef.pointsTo,
          ).catch(() => {
            console.log('caught')
          })
          if (!wedge) {
            continue
          }
          // console.log('wedge:', wedge)
          data[wedgeRef.label] = wedge
        }
      }
      return data
    } catch (err) {
      throw warnError('storageHandler loadShared()', err)
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
   */
  cleanShutdown(): void {
    window.removeEventListener('beforeunload', this.beforeUnloadHandler)
  }

  /**
   *
   * @param {string} path
   * @returns {Promise<string>}
   */
  async changeActiveDirectory(path: string): Promise<string> {
    if (this.checkLocked({ noConvert: true })) {
      throw new Error('Locked. Must Convert.')
    }
    await this.stageQueue()
    this.currentPath = this.sanitizePath(path)
    await this.refreshActiveFolder()
    return this.currentPath
  }

  /**
   *
   * @returns {string[]}
   */
  listChildFolders(): string[] {
    const folders: string[] = []
    for (let child of Object.values(this.children.folders)) {
      folders.push(child.whoAmI)
    }
    return folders
  }

  /**
   *
   * @returns {IFileMeta[]}
   */
  listChildFileMeta(): IFileMeta[] {
    const fileMetas: IFileMeta[] = []
    for (let child of Object.values(this.children.files)) {
      fileMetas.push(child.fileMeta)
    }
    return fileMetas
  }

  /**
   *
   * @returns {IFileMetaData[]}
   */
  listChildFiles(): IFileMetaData[] {
    const files: IFileMetaData[] = []
    for (let child of Object.values(this.children.files)) {
      files.push(child)
    }
    return files
  }

  /**
   *
   * @returns {Promise<DDeliverTxResponse>}
   */
  async initStorage(): Promise<any> {
    try {
      const msgs = await this.initStorageBase()
      const postBroadcast =
        await this.jackalClient.broadcastAndMonitorMsgs(msgs)
      return postBroadcast
    } catch (err) {
      throw warnError('storageHandler initStorage()', err)
    }
  }

  /**
   *
   * @param {string} name
   * @param {number} [mod]
   * @returns {Promise<DDeliverTxResponse>}
   */
  async initStorageCustom(
    name: string,
    mod?: number,
  ): Promise<DDeliverTxResponse> {
    try {
      const msgs = await this.initStorageBase(name, mod)
      const postBroadcast =
        await this.jackalClient.broadcastAndMonitorMsgs(msgs)
      return postBroadcast.txResponse
    } catch (err) {
      throw warnError('storageHandler initStorageCustom()', err)
    }
  }

  /**
   *
   * @returns {Promise<IStorageStatus>}
   */
  async planStatus(): Promise<IStorageStatus> {
    try {
      const { storagePaymentInfo } =
        await this.jackalSigner.queries.storage.storagePaymentInfo({
          address: this.jklAddress,
        })
      const active = storagePaymentInfo.end
        ? !isItPastDate(storagePaymentInfo.end)
        : false
      return {
        active,
        info: storagePaymentInfo,
      }
    } catch (err) {
      throw warnError('storageHandler planStatus()', err)
    }
  }

  /**
   *
   * @param {number} gb
   * @param {number} [days]
   * @returns {Promise<any>}
   */
  async buyMyStoragePlan(gb: number, days?: number): Promise<any> {
    const wrappedBuyMsg = this.buyStoragePlan(this.jklAddress, gb, days)
    const postBroadcast =
      await this.jackalClient.broadcastAndMonitorMsgs(wrappedBuyMsg)
    return postBroadcast
  }

  /**
   *
   * @param {string} receiver
   * @param {number} gb
   * @param {number} [days]
   * @returns {Promise<any>}
   */
  async buyOthersStoragePlan(
    receiver: string,
    gb: number,
    days?: number,
  ): Promise<any> {
    const wrappedBuyMsg = this.buyStoragePlan(receiver, gb, days)
    const postBroadcast =
      await this.jackalClient.broadcastAndMonitorMsgs(wrappedBuyMsg)
    return postBroadcast
  }

  /**
   *
   * @param {string | string[]} names
   * @returns {Promise<DDeliverTxResponse>}
   */
  async createFolders(names: string | string[]): Promise<DDeliverTxResponse> {
    if (this.checkLocked({ noConvert: true, exists: true })) {
      throw new Error('Locked.')
    }
    try {
      const msgs: IWrappedEncodeObject[] = []
      if (names instanceof Array) {
        for (let i = 0; i < names.length; i++) {
          msgs.push(
            ...(await this.makeCreateFolderMsgs(names[i], this.indexCount + i)),
          )
        }
        this.indexCount += names.length
      } else {
        msgs.push(...(await this.makeCreateFolderMsgs(names, this.indexCount)))
        this.indexCount++
      }

      const parentMeta = await MetaHandler.create(this.readActivePath(), {
        count: this.indexCount,
      })
      const parentMsgs = await this.existingFolderToMsgs({
        meta: parentMeta,
        aes: await genAesBundle(),
      })
      msgs.unshift(...parentMsgs)
      const postBroadcast =
        await this.jackalClient.broadcastAndMonitorMsgs(msgs)
      return postBroadcast.txResponse
    } catch (err) {
      throw warnError('storageHandler createFolders()', err)
    }
  }

  /**
   *
   * @param {IStagedUploadPackage} bundle
   * @returns {Promise<IWrappedEncodeObject[]>}
   */
  async saveFolder(
    bundle: IStagedUploadPackage,
  ): Promise<IWrappedEncodeObject[]> {
    if (this.checkLocked({ noConvert: true, exists: true })) {
      throw new Error('Locked.')
    }
    try {
      const msgs: IWrappedEncodeObject[] = []
      const blockHeight = await this.jackalClient.getJackalBlockHeight()
      let matchedCount = 0
      let foundMatch = false
      const childrenFilesLen = Object.keys(bundle.children.files).length

      for (let pkg of bundle.queue) {
        const meta = pkg.meta.getFileMeta()
        if (matchedCount < childrenFilesLen) {
          for (let index in bundle.children.files) {
            if (
              bundle.children.files[index].fileMeta.name === meta.fileMeta.name
            ) {
              matchedCount++
              const { merkleRoot } = bundle.children.files[index]
              const { files } =
                await this.jackalSigner.queries.storage.allFilesByMerkle({
                  merkle: merkleRoot,
                })
              const [target] = files.filter(
                (file) => file.owner === this.jklAddress,
              )
              const updates = await this.existingPkgToMsgs(
                target,
                pkg,
                blockHeight,
              )
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
            const nullReplacement = await this.pkgToMsgs(pkg, blockHeight)
            msgs.push(...nullReplacement)
            delete bundle.children.nulls[nullIndex]
          } else {
            const { count } = bundle.folderMeta.getFolderMeta()
            pkg.meta.setRefIndex(hexToInt(count))
            const fresh = await this.pkgToMsgs(pkg, blockHeight)
            msgs.push(...fresh)
            bundle.folderMeta.addToCount(1)
          }
        }
        foundMatch = false
      }

      const folderMsgs = await this.existingFolderToMsgs({
        meta: bundle.folderMeta,
      })
      msgs.unshift(...folderMsgs)
      return msgs
    } catch (err) {
      throw warnError('storageHandler saveFolder()', err)
    }
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
   * @returns {number}
   */
  readChildCount(): number {
    if (this.indexCount < 1) {
      return this.indexCount
    } else {
      const folders = this.listChildFolders()
      const files = this.listChildFiles()
      return folders.length + files.length
    }
  }

  /**
   *
   * @returns {string}
   */
  readMustConvertStatus(): boolean {
    return this.mustConvert
  }

  /**
   *
   * @returns {string[]}
   */
  readCurrentQueue(): string[] {
    return this.uploadQueue.map((item) => item.file.name)
  }

  /**
   *
   * @param {string} name
   */
  removeFromQueue(name: string): void {
    const filtered = []
    for (let item of this.uploadQueue) {
      if (item.file.name !== name) {
        filtered.push(item)
      }
    }
    this.uploadQueue = filtered
  }

  /**
   *
   * @param {File | File[]} toQueue
   * @param {number} [duration]
   * @returns {Promise<number>}
   */
  async queuePrivate(
    toQueue: File | File[],
    duration: number = 0,
  ): Promise<number> {
    if (this.checkLocked({ noConvert: true, exists: true })) {
      throw new Error('Locked.')
    }
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
   * @param {File | File[]} toQueue
   * @param {number} [duration]
   * @returns {Promise<number>}
   */
  async queuePublic(
    toQueue: File | File[],
    duration: number = 0,
  ): Promise<number> {
    if (this.checkLocked({ noConvert: true, exists: true })) {
      throw new Error('Locked.')
    }
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
   * @returns {Promise<any>}
   */
  async processAllQueues(): Promise<any> {
    if (this.checkLocked({ noConvert: true, exists: true })) {
      throw new Error('Locked.')
    }
    try {
      await this.stageQueue()
      const msgs: IWrappedEncodeObject[] = []
      for (let folderName in this.stagedUploads) {
        const readyMsgs = await this.saveFolder(this.stagedUploads[folderName])
        msgs.push(...readyMsgs)
      }
      const postBroadcast =
        await this.jackalClient.broadcastAndMonitorMsgs(msgs)

      // console.log("post broadcast: ", postBroadcast)

      // tmp fix for archway
      const activeUploads: Promise<IProviderUploadResponse>[] = []
      if (!postBroadcast.error) {
        const startBlock = await this.jackalClient.getJackalBlockHeight()
        const group = await this.jackalClient
          .getQueries()
          .storage.allProviders()
        // console.log(group)
        for (let i = 0; i < msgs.length; i++) {
          const { file, merkle } = msgs[i]
          if (file && merkle) {
            if (group.providers.length > 0) {
              this.uploadsInProgress = true
              activeUploads.push(
                this.uploadFile(
                  `${group.providers[0].ip}/upload`,
                  startBlock,
                  file,
                  merkle,
                ),
              )
            }
          }
        }
      }

      // const activeUploads: Promise<IProviderUploadResponse>[] = []
      // for (let i = 0; i < msgs.length; i++) {
      //   const { file, merkle } = msgs[i]
      //   if (file && merkle && postBroadcast.txEvents[i]) {
      //     const dat = postBroadcast.txEvents[i].parsed as DMsgStoragePostFileResponse
      //     const { providerIps, startBlock } = dat
      //     for (let provider of providerIps) {
      //       this.uploadsInProgress = true
      //       activeUploads.push(
      //         this.uploadFile(`${provider}/upload`, startBlock, file, merkle),
      //       )
      //     }
      //   }
      // }
      await Promise.all(activeUploads).then(() => {
        this.uploadsInProgress = false
      })
      await this.refreshActiveFolder()
      return postBroadcast
    } catch (err) {
      throw warnError('storageHandler processAllQueues()', err)
    }
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
    if (this.checkLocked({ noConvert: true, exists: true })) {
      throw new Error('Locked.')
    }
    const fileFormData = new FormData()
    fileFormData.set('file', file)
    fileFormData.set('merkle', merkle)
    fileFormData.set('sender', this.jklAddress)
    fileFormData.set('start', startBlock.toString())

    return await fetch(url, { method: 'POST', body: fileFormData })
      .then(async (resp): Promise<IProviderUploadResponse> => {
        if (resp.status !== 200) {
          throw new Error(`Status Message: ${resp.statusText}`)
        } else {
          return resp.json()
        }
      })
      .catch((err) => {
        throw warnError('storageHandler uploadFile()', err)
      })
  }

  /**
   *
   * @param {string} filePath
   * @param {IDownloadTracker} trackers
   * @returns {Promise<File>}
   */
  async downloadFile(
    filePath: string,
    trackers: IDownloadTracker,
  ): Promise<File> {
    return this.downloadExternalFile(this.jklAddress, filePath, trackers)
  }

  /**
   *
   * @param {string} userAddress
   * @param {string} filePath
   * @param {IDownloadTracker} trackers
   * @returns {Promise<File>}
   */
  async downloadExternalFile(
    userAddress: string, // jackal address not ica
    filePath: string, // /cat_turtle.png
    trackers: IDownloadTracker,
  ): Promise<File> {
    const ica = this.jackalClient.getICAJackalAddress()
    // console.log("ica address: ", ica)
    try {
      const ft = await loadExternalFileTreeMetaData(
        this.jackalSigner,
        this.keyPair,
        ica,
        ica,
        '',
        filePath,
      )
      if (ft.metaDataType !== 'file') {
        throw new Error('Not a file')
      }
      const workingMetadata = ft as IFileMetaData
      const { providerIps } = await this.jackalSigner.queries.storage.findFile({
        merkle: workingMetadata.merkleRoot,
      })
      const provider =
        providerIps[Math.floor(Math.random() * providerIps.length)]
      const url = `${provider}/download/${workingMetadata.merkleLocation}`
      return await fetch(url, { method: 'GET' }).then(
        async (resp): Promise<File> => {
          const contentLength = resp.headers.get('Content-Length')
          if (resp.status !== 200) {
            throw new Error(`Status Message: ${resp.statusText}`)
          } else if (resp.body === null || !contentLength) {
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
            const { name, ...meta } = workingMetadata.fileMeta
            let baseFile = new File(trackers.chunks, name, meta)
            const tmp = await baseFile.slice(0, 8).text()
            if (Number(tmp) > 0) {
              const parts: Blob[] = []
              const aes = await loadKeysFromFileTree(
                this.jackalSigner,
                this.keyPair,
                userAddress,
                this.jklAddress,
                '',
                filePath,
              )
              for (let i = 0; i < baseFile.size; ) {
                const offset = i + 8
                const segSize = Number(await baseFile.slice(i, offset).text())
                const last = offset + segSize
                const segment = baseFile.slice(offset, last)

                parts.push(await aesBlobCrypt(segment, aes, 'decrypt'))
                i = last
              }
              baseFile = new File(parts, name, meta)
            }
            return baseFile
          }
        },
      )
    } catch (err) {
      throw warnError('storageHandler downloadFile()', err)
    }
  }

  /**
   *
   * @param {string | string[]} targets
   * @returns {Promise<DDeliverTxResponse>}
   */
  async deleteTargets(targets: string | string[]): Promise<DDeliverTxResponse> {
    if (this.checkLocked({ noConvert: true, exists: true })) {
      throw new Error('Locked.')
    }
    try {
      const msgs: IWrappedEncodeObject[] = []
      if (targets instanceof Array) {
        for (let target of targets) {
          msgs.push(...(await this.prepDelete(this.assembleLocation(target))))
        }
      } else {
        msgs.push(...(await this.prepDelete(this.assembleLocation(targets))))
      }
      const postBroadcast =
        await this.jackalClient.broadcastAndMonitorMsgs(msgs)
      return postBroadcast.txResponse
    } catch (err) {
      throw warnError('storageHandler deleteTargets()', err)
    }
  }

  debug(): IChildMetaDataMap {
    return this.children
  }

  /**
   *
   * @param {string} receiver
   * @param {string | string[]} paths
   * @returns {Promise<DDeliverTxResponse>}
   */
  async share(
    receiver: string,
    paths: string | string[],
  ): Promise<DDeliverTxResponse> {
    if (this.checkLocked({ noConvert: true, exists: true })) {
      throw new Error('Locked.')
    }
    try {
      const msgs: IWrappedEncodeObject[] = []
      const pkg: INotificationPackage = {
        isPrivate: true,
        receiver: await this.possibleRnsToAddress(receiver),
        path: 'tbd',
        isFile: true,
      }
      if (paths instanceof Array) {
        for (let path of paths) {
          const rdy = await reconstructFileTreeMetaData(
            this.jackalClient,
            this.jackalSigner,
            this.keyPair,
            this.jklAddress,
            [await this.possibleRnsToAddress(receiver)],
            path,
          )
          pkg.path = path
          msgs.push(...(await this.shareToMsgs(pkg, rdy)))
        }
      } else {
        const rdy = await reconstructFileTreeMetaData(
          this.jackalClient,
          this.jackalSigner,
          this.keyPair,
          this.jklAddress,
          [await this.possibleRnsToAddress(receiver)],
          paths,
        )
        pkg.path = paths
        msgs.push(...(await this.shareToMsgs(pkg, rdy)))
      }
      const postBroadcast =
        await this.jackalClient.broadcastAndMonitorMsgs(msgs)
      return postBroadcast.txResponse
    } catch (err) {
      throw warnError('storageHandler notify()', err)
    }
  }

  /**
   *
   * @returns {Promise<number>}
   */
  async checkNotifications(): Promise<number> {
    try {
      const updater = new SharedUpdater(
        this.jackalClient,
        this.jackalSigner,
        this.jackalSigner,
        this.keyPair,
        this.shared,
      )
      return await updater.fetchNotifications()
    } catch (err) {
      throw warnError('storageHandler checkNotifications()', err)
    }
  }

  /**
   *
   * @returns {Promise<TSharedRootMetaDataMap>}
   */
  async processPendingNotifications(): Promise<TSharedRootMetaDataMap> {
    if (this.checkLocked({ noConvert: true, exists: true })) {
      throw new Error('Locked.')
    }
    try {
      const updater = new SharedUpdater(
        this.jackalClient,
        this.jackalSigner,
        this.jackalSigner,
        this.keyPair,
        this.shared,
      )
      const count = await updater.fetchNotifications()
      if (count > 0) {
        await updater.digest()
        return this.refreshSharing()
      } else {
        return this.shared
      }
    } catch (err) {
      throw warnError('storageHandler processPendingNotifications()', err)
    }
  }

  /**
   *
   * @returns {TSharedRootMetaDataMap}
   */
  readSharing(): TSharedRootMetaDataMap {
    return this.shared
  }

  /**
   *
   * @returns {Promise<TSharedRootMetaDataMap>}
   */
  async refreshSharing(): Promise<TSharedRootMetaDataMap> {
    try {
      this.shared = await StorageHandler.loadShared(
        this.jackalSigner,
        this.keyPair,
        this.jklAddress,
      )
      return this.shared
    } catch (err) {
      throw warnError('storageHandler refreshNotifications()', err)
    }
  }

  /**
   *
   * @returns {Promise<any>}
   */
  async convert(): Promise<any> {
    if (this.checkLocked({ mustConvert: true })) {
      throw new Error('Not Locked. Convert Not Available.')
    }
    try {
      const msgs: IWrappedEncodeObject[] = []
      const bundle = await this.buildConversion(this.readActivePath())
      if (bundle) {
        const meta = await MetaHandler.create(this.readActivePath(), {
          count: bundle.count,
        })
        meta.setRefIndex(0)
        const group = await this.folderToMsgs({
          meta: meta,
          aes: await genAesBundle(),
        })
        msgs.push(...group)
        msgs.push(...bundle.msgs)

        const postBroadcast =
          await this.jackalClient.broadcastAndMonitorMsgs(msgs)
        return postBroadcast
      }
    } catch (err) {
      throw warnError('storageHandler convert()', err)
    }
  }

  /**
   *
   * @param {string} name
   * @returns {Promise<string>}
   * @protected
   */
  protected async possibleRnsToAddress(name: string): Promise<string> {
    try {
      if (bech32.checkIfValid(name)) {
        return name
      } else {
        if (this.rns) {
          return await this.rns.rnsToAddress(name)
        } else {
          throw new Error('Invalid name')
        }
      }
    } catch (err) {
      throw warnError('storageHandler possibleRnsToAddress()', err)
    }
  }

  /**
   *
   * @param {string} [name]
   * @param {number} [mod]
   * @returns {Promise<IWrappedEncodeObject[]>}
   * @protected
   */
  protected async initStorageBase(
    name: string = 'Home',
    mod: number = 10,
  ): Promise<IWrappedEncodeObject[]> {
    try {
      const forKey: DMsgPostKey = {
        creator: this.jklAddress,
        key: this.keyPair.publicKey.toHex(),
      }
      const msg: IWrappedEncodeObject = {
        encodedObject: this.jackalSigner.txLibrary.fileTree.msgPostKey(forKey),
        modifier: mod,
      }
      await this.jackalClient.broadcastAndMonitorMsgs(msg)

      const trackingNumber = crypto.randomUUID()
      const forInit: DMsgProvisionFileTree = {
        creator: this.jklAddress,
        viewers: await createViewAccess(trackingNumber, [this.jklAddress]),
        editors: await createEditAccess(trackingNumber, [this.jklAddress]),
        trackingNumber: trackingNumber,
      }
      const msgs: IWrappedEncodeObject[] = [
        {
          encodedObject:
            this.jackalSigner.txLibrary.fileTree.msgProvisionFileTree(forInit),
          modifier: mod,
        },
      ]
      msgs.push(...(await this.makeCreateBaseFolderMsgs(name, 0)))
      msgs.push(...(await this.makeCreateBaseFolderMsgs(sharedPath, 1)))
      return msgs
    } catch (err) {
      throw warnError('storageHandler initStorageBase()', err)
    }
  }

  /**
   *
   * @param {string} receiver
   * @param {number} gb
   * @param {number} [days]
   * @returns {IWrappedEncodeObject}
   * @protected
   */
  protected buyStoragePlan(
    receiver: string,
    gb: number,
    days?: number,
  ): IWrappedEncodeObject {
    const durationDays = Number(days) > 30 ? Number(days) : 30
    const bytes = 3 * 1000000000 * (Number(gb) || 1)
    const toBuy: DMsgBuyStorage = {
      creator: this.jklAddress,
      forAddress: receiver,
      durationDays,
      bytes,
      paymentDenom: 'ujkl',
    }
    return {
      encodedObject: this.jackalSigner.txLibrary.storage.msgBuyStorage(toBuy),
      modifier: 0,
    }
  }

  /**
   *
   * @param {string} name
   * @param {number} position
   * @returns {Promise<IWrappedEncodeObject[]>}
   * @protected
   */
  protected async makeCreateFolderMsgs(
    name: string,
    position: number,
  ): Promise<IWrappedEncodeObject[]> {
    try {
      const baseMeta = await MetaHandler.create(
        `${this.readActivePath()}/${name}`,
        {
          count: 0,
        },
      )
      baseMeta.setRefIndex(position)
      return await this.folderToMsgs({
        meta: baseMeta,
        aes: await genAesBundle(),
      })
    } catch (err) {
      throw warnError('storageHandler makeCreateFolderMsgs()', err)
    }
  }

  /**
   *
   * @param {string} name
   * @param {number} position
   * @returns {Promise<IWrappedEncodeObject[]>}
   * @protected
   */
  protected async makeCreateBaseFolderMsgs(
    name: string,
    position: number,
  ): Promise<IWrappedEncodeObject[]> {
    try {
      const baseMeta = await MetaHandler.create(`s/${name}`, {
        count: 0,
      })
      baseMeta.setRefIndex(position)
      return await this.folderToMsgs({
        meta: baseMeta,
        aes: await genAesBundle(),
      })
    } catch (err) {
      throw warnError('storageHandler makeCreateBaseFolderMsgs()', err)
    }
  }

  /**
   *
   * @param {string} target
   * @returns {Promise<IWrappedEncodeObject[]>}
   * @protected
   */
  protected async prepDelete(target: string): Promise<IWrappedEncodeObject[]> {
    try {
      const msgs: IWrappedEncodeObject[] = []
      const ft = await loadFileTreeMetaData(
        this.jackalSigner,
        this.keyPair,
        this.jklAddress,
        '',
        target,
      )
      if (ft.metaDataType === 'file') {
        const workingMetadata = ft as IFileMetaData
        const { files } =
          await this.jackalSigner.queries.storage.allFilesByMerkle({
            merkle: workingMetadata.merkleRoot,
          })
        const [details] = files
        const deletePkg = {
          creator: this.jklAddress,
          merkle: details.merkle,
          start: details.start,
        }
        const wrapped = {
          encodedObject:
            this.jackalSigner.txLibrary.storage.msgDeleteFile(deletePkg),
          modifier: 0,
        }
        msgs.push(wrapped)
      } else if (ft.metaDataType === 'folder') {
        const [_, children] = await StorageHandler.loadFolder(
          this.jackalSigner,
          this.keyPair,
          this.jklAddress,
          '',
          target,
        )
        for (let file of Object.values(children.files)) {
          const path = tidyString(`${target}/${file.fileMeta.name}`, '/')
          msgs.push(...(await this.prepDelete(path)))
        }
        for (let folder of Object.values(children.folders)) {
          const path = tidyString(`${target}/${folder.whoAmI}`, '/')
          msgs.push(...(await this.prepDelete(path)))
        }
      }
      const pkg = {
        meta: await MetaHandler.create(target),
        aes: await genAesBundle(),
      }
      msgs.push(...(await this.filetreeDeleteToMsgs(pkg)))
      return msgs
    } catch (err) {
      throw warnError('storageHandler prepDelete()', err)
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
   * @returns {Promise<void>}
   * @protected
   */
  protected async refreshActiveFolder(): Promise<void> {
    try {
      const [indexCount, children, mustConvert] =
        await StorageHandler.loadFolder(
          this.jackalSigner,
          this.keyPair,
          this.jklAddress,
          this.currentPath,
          this.basePath,
        )
      this.indexCount = indexCount
      this.children = children
      this.mustConvert = mustConvert
    } catch (err) {
      throw warnError('storageHandler refreshActiveFolder()', err)
    }
  }

  protected async loadMyNotifications(): Promise<INotification[]> {
    try {
      const noti =
        await this.jackalSigner.queries.notifications.allNotificationsByAddress(
          { to: this.jklAddress },
        )

      const messages: INotification[] = []
      for (let data of noti.notifications) {
        const contents = JSON.parse(data.contents)
        if ('private' in contents) {
          const clean = await readShareNotification(
            this.keyPair,
            data,
            this.jklAddress,
          )
          messages.push(clean)
        } else {
          messages.push(contents)
        }
      }
      return messages
    } catch (err) {
      throw warnError('storageHandler loadMyNotifications()', err)
    }
  }

  /**
   *
   * @param {string} path
   * @returns {string}
   * @protected
   */
  protected sanitizePath(path: string): string {
    const singleSlashPath = path.replaceAll(/\/+/g, '/')
    const rootFreePath = singleSlashPath.replace('s/Home', '')
    return tidyString(rootFreePath, '/')
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
   * @param {File} toProcess
   * @param {number} duration
   * @returns {Promise<IUploadPackage>}
   * @protected
   */
  protected async processPrivate(
    toProcess: File,
    duration: number,
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
   * @param {File} toProcess
   * @param {number} duration
   * @returns {Promise<IUploadPackage>}
   * @protected
   */
  protected async processPublic(
    toProcess: File,
    duration: number,
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
   * @param {IChecks} checkSet
   * @returns {boolean}
   * @protected
   */
  protected checkLocked(checkSet: IChecks): boolean {
    try {
      if (checkSet.bought) {
        // TODO - add bought check
        if (!this.mustConvert) {
          throw true
        }
      }
      if (checkSet.noConvert) {
        if (this.mustConvert) {
          throw true
        }
      }
      if (checkSet.mustConvert) {
        if (!this.mustConvert) {
          throw true
        }
      }
      if (checkSet.exists) {
        if (this.indexCount === -1) {
          throw true
        }
      }
      if (checkSet.keys) {
        // TODO - add keys check
        if (this.indexCount === -1) {
          throw true
        }
      }
      if (checkSet.shared) {
        // TODO - add shared check
        if (!this.mustConvert) {
          throw true
        }
      }
      return false
    } catch {
      return true
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
   * @param {string} path
   * @returns {Promise<IConversionFolderBundle | null>}
   * @protected
   */
  protected async buildConversion(
    path: string,
  ): Promise<null | IConversionFolderBundle> {
    try {
      const data = await loadFolderFileTreeMetaData(
        this.jackalSigner,
        this.keyPair,
        this.jklAddress,
        '',
        path,
      )

      if (!data.requiresConversion) {
        return null
      } else {
        const msgs: IWrappedEncodeObject[] = []
        let ii = 0

        for (let dir of data.metaData.dirChildren) {
          const child = await this.buildConversion(`${path}/${dir}`)
          if (child) {
            const meta = await MetaHandler.create(`${path}/${dir}`, {
              count: child.count,
            })
            meta.setRefIndex(ii)
            const group = await this.folderToMsgs({
              meta: meta,
              aes: await genAesBundle(),
            })
            msgs.push(...group)
            msgs.push(...child.msgs)
          }
        }

        for (let fileMeta of Object.values(data.metaData.fileChildren)) {
          const meta = await getLegacyMerkle(
            this.jackalSigner,
            this.jklAddress,
            fileMeta.name,
            path,
            fileMeta,
          )
          const pkg: IUploadPackage = {
            file: new File([], ''),
            meta,
            duration: 0,
            aes: await genAesBundle(),
          }
          const group = await this.legacyPkgToMsgs(pkg)
          msgs.push(...group)
        }

        return {
          count: ii,
          msgs,
        }
      }
    } catch (err) {
      throw warnError('storageHandler buildConversion()', err)
    }
  }
}
