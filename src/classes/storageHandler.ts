import type {
  DDeliverTxResponse,
  DMsgBuyStorage,
  DMsgPostKey,
  THostSigningClient,
  TJackalSigningClient,
} from '@jackallabs/jackal.js-protos'
import { PrivateKey } from 'eciesjs'
import { extractFileMetaData } from '@/utils/converters'
import {
  isItPastDate,
  signerNotEnabled,
  tidyString,
  warnError,
} from '@/utils/misc'
import {
  FileMetaHandler,
  FolderMetaHandler,
  NullMetaHandler,
} from '@/classes/metaHandlers'
import { encryptionChunkSize, signatureSeed } from '@/utils/globalDefaults'
import { aesBlobCrypt, genAesBundle, genIv, genKey } from '@/utils/crypt'
import { hashAndHex, stringToShaHex } from '@/utils/hash'
import { EncodingHandler } from '@/classes/encodingHandler'
import { SharedUpdater } from '@/classes/sharedUpdater'
import { bech32 } from '@jackallabs/bech32'
import {
  IAesBundle,
  IChecks,
  IChildMetaDataMap,
  IClientHandler,
  IDownloadTracker,
  IFileMetaData,
  IFileParticulars,
  IFolderMetaData,
  IFolderMetaHandler,
  INotification,
  INotificationPackage, IProviderIpSet, IProviderPool,
  IProviderUploadResponse,
  IRnsHandler,
  IStagedUploadPackage,
  IStorageHandler,
  IStorageOptions,
  IStorageStatus,
  IUploadPackage,
  IWrappedEncodeObject,
} from '@/interfaces'
import type { TSharedRootMetaDataMap } from '@/types'
import { IConversionFolderBundle } from '@/interfaces/IConversionFolderBundle'
import { TFullSignerState } from '@/types/TFullSignerState'

export class StorageHandler extends EncodingHandler implements IStorageHandler {
  protected readonly rns: IRnsHandler | null
  protected path: string
  protected keyPair: PrivateKey
  protected fullSigner: boolean
  protected readonly jackalClient: IClientHandler
  protected readonly proofInterval: number
  protected mustConvert: boolean
  protected uploadsInProgress: boolean
  protected uploadQueue: IUploadPackage[]
  protected stagedUploads: Record<string, IStagedUploadPackage>
  protected children: IChildMetaDataMap
  protected shared: TSharedRootMetaDataMap

  protected meta: IFolderMetaHandler
  protected providers: IProviderPool

  protected constructor(
    rns: IRnsHandler | null,
    client: IClientHandler,
    jackalSigner: TJackalSigningClient,
    hostSigner: THostSigningClient,
    accountAddress: string,
    fullSignerState: TFullSignerState,
    path: string,
    meta: IFolderMetaHandler,
  ) {
    super(client, jackalSigner, hostSigner, fullSignerState[0], accountAddress)

    this.rns = rns
    this.path = path
    this.keyPair = fullSignerState[0]
    this.fullSigner = fullSignerState[1]
    this.jackalClient = client
    this.proofInterval = client.getProofWindow()

    this.uploadsInProgress = false
    this.uploadQueue = []
    this.stagedUploads = {}

    this.children = {
      files: {},
      folders: {},
      nulls: {},
    }
    this.mustConvert = false
    this.shared = {}

    this.meta = meta
    this.providers = {}

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
      path = 'Home',
      accountAddress = client.getJackalAddress(),
      setFullSigner = false,
    } = options

    const jackalSigner = client.getJackalSigner()
    if (!jackalSigner) {
      throw new Error(signerNotEnabled('StorageHandler', 'init'))
    }
    const hostSigner = client.getHostSigner()
    if (!hostSigner) {
      throw new Error(signerNotEnabled('StorageHandler', 'init'))
    }

    try {
      let dummyKey = await stringToShaHex('')
      let keyPair: TFullSignerState = [PrivateKey.fromHex(dummyKey), false]
      if (setFullSigner) {
        keyPair = await this.enableFullSigner(client)
      }
      const meta = await FolderMetaHandler.create({
        count: -1,
        location: '',
        name: '',
      })
      return new StorageHandler(
        rns,
        client,
        jackalSigner,
        hostSigner,
        accountAddress,
        keyPair,
        path,
        meta,
      )
    } catch (err) {
      throw warnError('storageHandler init()', err)
    }
  }

  static async enableFullSigner(
    client: IClientHandler,
  ): Promise<TFullSignerState> {
    try {
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
      return [PrivateKey.fromHex(signatureAsHex), true]
    } catch (err) {
      throw warnError('storageHandler enableFullSigner()', err)
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
   * @param {string} [path]
   * @returns {Promise<void>}
   */
  async loadDirectory(path?: string): Promise<void> {
    if (this.checkLocked({ noConvert: true, signer: true })) {
      throw new Error('Locked.')
    }
    try {
      this.path = path || this.path
      this.meta = await this.reader.loadFolderMetaHandler(this.path)
      this.children = this.reader.readFolderContents(this.path)
    } catch (err) {
      throw warnError('storageHandler loadDirectory()', err)
    }
  }

  /**
   *
   * @returns {Promise<void>}
   */
  async loadShared(): Promise<void> {
    if (this.checkLocked({ signer: true })) {
      throw new Error('Locked.')
    }
    try {
    } catch (err) {
      throw warnError('storageHandler loadShared()', err)
    }
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
   * @returns {IFolderMetaData[]}
   */
  listChildFolderMetas(): IFolderMetaData[] {
    return Object.values(this.children.folders)
  }

  /**
   *
   * @returns {string[]}
   */
  listChildFiles(): string[] {
    const fileMetas: string[] = []
    for (let child of Object.values(this.children.files)) {
      fileMetas.push(child.fileMeta.name)
    }
    return fileMetas
  }

  /**
   *
   * @returns {IFileMetaData[]}
   */
  listChildFileMetas(): IFileMetaData[] {
    return Object.values(this.children.files)
  }

  /**
   *
   * @returns {Promise<void>}
   */
  async upgradeSigner(): Promise<void> {
    try {
      [this.keyPair, this.fullSigner] = await StorageHandler.enableFullSigner(
        this.jackalClient,
      )
    } catch (err) {
      throw warnError('storageHandler upgradeSigner()', err)
    }
  }

  /**
   *
   * @returns {Promise<string[]>}
   */
  async getAvailableProviders(): Promise<string[]> {
    const data =  await this.jackalClient.getQueries().storage.activeProviders()
    console.log(data)
    const final: string[] = []
    for (let value of data.providers) {
      final.push(value.address)
    }
    return final
  }

  /**
   *
   * @param {string[]} providers
   * @returns {Promise<Record<string, string>>}
   */
  async findProviderIps(providers: string[]): Promise<IProviderIpSet> {
    const ips: Record<string, string> = {}
    for (let address of providers) {
      console.log(address)
      const details = await this.jackalClient.getQueries().storage.provider({ address })
      console.log(details)
      ips[details.provider.address] = details.provider.ip
    }
    console.log(ips)
    return ips
  }

  /**
   *
   * @returns {Promise<IProviderIpSet>}
   * @protected
   */
  protected async loadProvidersFromChain(): Promise<IProviderIpSet> {
    const providers = await this.getAvailableProviders()
    console.log(providers)
    return await this.findProviderIps(providers)
  }

  /**
   *
   * @param {IProviderIpSet} providers
   * @returns {Promise<void>}
   */
  async loadProviderPool(providers?: IProviderIpSet): Promise<void> {
    providers = providers || await this.loadProvidersFromChain()
    console.log(providers)
    for (let ip of Object.values(providers)) {
      console.log(ip)
      const root = ip.split('.').slice(-2).join('.')
      console.log(root)
      if (!(root in this.providers)) {
        this.providers[root] = []
      }

      this.providers[root].push({
        ip,
        failures: 0
      })
      console.log(this.providers)
    }
  }

  /**
   *
   * @returns {Promise<any>}
   */
  async initStorage(): Promise<any> {
    if (this.checkLocked({ signer: true })) {
      throw new Error('Locked.')
    }
    // await this.loadDirectory()
    try {
      const msgs = await this.initUlidHome()
      const postBroadcast =
        await this.jackalClient.broadcastAndMonitorMsgs(msgs)
      return postBroadcast
    } catch (err) {
      throw warnError('storageHandler initStorage()', err)
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
    if (this.checkLocked({ noConvert: true, exists: true, signer: true })) {
      throw new Error('Locked.')
    }
    try {
      const msgs: IWrappedEncodeObject[] = []
      if (names instanceof Array) {
        for (let i = 0; i < names.length; i++) {
          msgs.push(
            ...(await this.makeCreateFolderMsgs(
              names[i],
              this.meta.getCount() + i,
            )),
          )
        }
        this.meta.addAndReturnCount(names.length)
      } else {
        msgs.push(
          ...(await this.makeCreateFolderMsgs(names, this.meta.getCount())),
        )
        this.meta.addAndReturnCount(1)
      }

      const parentMsgs = await this.existingFolderToMsgs({
        meta: this.meta,
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
    if (this.checkLocked({ noConvert: true, exists: true, signer: true })) {
      throw new Error('Locked.')
    }
    try {
      const msgs: IWrappedEncodeObject[] = []
      const blockHeight = await this.jackalClient.getJackalBlockHeight()
      let matchedCount = 0
      let foundMatch = false
      const childrenFilesLen = Object.keys(bundle.children.files).length

      for (let pkg of bundle.queue) {
        const meta = pkg.meta.export()
        if (matchedCount < childrenFilesLen) {
          for (let index in bundle.children.files) {
            const childName = bundle.children.files[index].fileMeta.name
            if (childName === meta.fileMeta.name) {
              matchedCount++
              const { merkleRoot } = bundle.children.files[index]
              if (merkleRoot === meta.merkleRoot) {
                // skip duplicate file
              } else {
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
        }
        if (foundMatch) {
          continue
        } else {
          const nulls = Object.keys(bundle.children.nulls)
          if (nulls.length) {
            pkg.meta.setRefIndex(
              bundle.children.nulls[Number(nulls[0])].getRefIndex(),
            )
            const nullReplacement = await this.pkgToMsgs(pkg, blockHeight)
            msgs.push(...nullReplacement)
            delete bundle.children.nulls[Number(nulls[0])]
          } else {
            pkg.meta.setRefIndex(bundle.folderMeta.getCount())
            const fresh = await this.pkgToMsgs(pkg, blockHeight)
            msgs.push(...fresh)
            bundle.folderMeta.addAndReturnCount(1)
          }
        }
        foundMatch = false
      }
      console.log(bundle.folderMeta)
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
    return this.path
  }

  /**
   *
   * @returns {string}
   */
  readCurrentLocation(): string {
    return this.meta.getLocation()
  }

  /**
   *
   * @returns {string}
   */
  readCurrentUlid(): string {
    return this.meta.getUlid()
  }

  /**
   *
   * @returns {number}
   */
  readChildCount(): number {
    if (this.meta.getCount() < 1) {
      return this.meta.getCount()
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
    if (this.checkLocked({ noConvert: true, exists: true, signer: true })) {
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
    if (this.checkLocked({ noConvert: true, exists: true, signer: true })) {
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
    if (this.checkLocked({ needsProviders: true, noConvert: true, exists: true, signer: true })) {
      throw new Error('Locked.')
    }
    try {
      await this.stageQueue()
      const msgs: IWrappedEncodeObject[] = []
      for (let folderUlid in this.stagedUploads) {
        const readyMsgs = await this.saveFolder(this.stagedUploads[folderUlid])
        msgs.push(...readyMsgs)
      }
      const postBroadcast =
        await this.jackalClient.broadcastAndMonitorMsgs(msgs)


      // tmp fix for archway
      const activeUploads: Promise<IProviderUploadResponse>[] = []
      if (!postBroadcast.error) {
        const startBlock = await this.jackalClient.getJackalBlockHeight()
        const providerTeams = Object.keys(this.providers)
        const copies = Math.min(3, providerTeams.length)

        for (let i = 0; i < msgs.length; i++) {
          const { file, merkle } = msgs[i]
          if (file && merkle) {
            this.uploadsInProgress = true

            const used: number[] = []
            for (let i = 0; i < copies; i++) {
              while (true) {
                const seed = Math.floor(Math.random() * providerTeams.length)
                if (used.includes(seed)) {
                  continue
                } else {
                  used.push(seed)
                  break
                }
              }
              const [seed] = used.slice(-1)
              const selected = this.providers[providerTeams[seed]]
              const one = selected[Math.floor(Math.random() * selected.length)]
              const uploadUrl = `${one.ip}/upload`

              const uploadPromise = this.uploadFile(
                uploadUrl,
                startBlock,
                file,
                merkle,
              )
              activeUploads.push(uploadPromise)
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
      await this.loadDirectory()
      return postBroadcast
    } catch (err) {
      throw warnError('storageHandler processAllQueues()', err)
    }
  }

  /**
   *
   * @param {string} filePath
   * @returns {Promise<IFileParticulars>}
   */
  async getFileParticulars(filePath: string): Promise<IFileParticulars> {
    if (this.checkLocked({ signer: true })) {
      throw new Error('Locked.')
    }
    try {
      const ica = this.jackalClient.getICAJackalAddress()
      const ft = await this.reader.loadMetaByExternalPath(filePath, ica)
      if (ft.metaDataType !== 'file') {
        throw new Error('Not a file')
      }
      const { providerIps } = await this.jackalSigner.queries.storage.findFile({
        merkle: ft.merkleRoot,
      })
      return {
        fileMeta: ft.fileMeta,
        merkle: ft.merkleRoot,
        merkleLocation: ft.merkleHex,
        providerIps,
      }
    } catch (err) {
      throw warnError('storageHandler getFileProviders()', err)
    }
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
    if (this.checkLocked({ signer: true })) {
      throw new Error('Locked.')
    }
    try {
      const particulars = await this.getFileParticulars(filePath)
      const provider =
        particulars.providerIps[
          Math.floor(Math.random() * particulars.providerIps.length)
        ]
      const url = `${provider}/download/${particulars.merkleLocation}`
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
            const { name, ...meta } = particulars.fileMeta
            let baseFile = new File(trackers.chunks, name, meta)
            const tmp = await baseFile.slice(0, 8).text()
            if (Number(tmp) > 0) {
              const parts: Blob[] = []
              const aes = await this.reader.loadKeysByPath(
                filePath,
                userAddress,
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
    if (this.checkLocked({ noConvert: true, exists: true, signer: true })) {
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
    if (this.checkLocked({ noConvert: true, exists: true, signer: true })) {
      throw new Error('Locked.')
    }
    try {
      const rec = await this.possibleRnsToAddress(receiver)
      const msgs: IWrappedEncodeObject[] = []
      const pkg: INotificationPackage = {
        isPrivate: true,
        receiver: rec,
        path: 'tbd',
        isFile: true,
      }
      if (paths instanceof Array) {
        for (let path of paths) {
          pkg.path = path
          msgs.push(...(await this.shareToMsgs(pkg, [rec])))
        }
      } else {
        pkg.path = paths
        msgs.push(...(await this.shareToMsgs(pkg, [rec])))
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
    if (this.checkLocked({ signer: true })) {
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
    if (this.checkLocked({ noConvert: true, exists: true, signer: true })) {
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
        this.loadShared()
        return this.shared
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
   * @returns {Promise<any>}
   */
  async convert(): Promise<any> {
    if (this.checkLocked({ mustConvert: true, signer: true })) {
      throw new Error('Not Locked. Convert Not Available.')
    }
    try {
      const msgs: IWrappedEncodeObject[] = []
      const bundle = await this.buildConversion(this.readActivePath())
      if (bundle) {
        bundle.handler.setLocation(this.meta.getLocation())
        const group = await this.folderToMsgs({
          meta: bundle.handler,
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
   * @param {string} url
   * @param {number} startBlock
   * @param {File} file
   * @param {string} merkle
   * @returns {Promise<IProviderUploadResponse>}
   * @protected
   */
  protected async uploadFile(
    url: string,
    startBlock: number,
    file: File,
    merkle: string,
  ): Promise<IProviderUploadResponse> {
    if (this.checkLocked({ noConvert: true, exists: true, signer: true })) {
      throw new Error('Locked.')
    }
    try {
      const fileFormData = new FormData()
      fileFormData.set('file', file)
      fileFormData.set('merkle', merkle)
      fileFormData.set('sender', this.jklAddress)
      fileFormData.set('start', startBlock.toString())

      return await fetch(url, { method: 'POST', body: fileFormData }).then(
        async (resp): Promise<IProviderUploadResponse> => {
          if (resp.status !== 200) {
            throw new Error(`Status Message: ${resp.statusText}`)
          } else {
            return resp.json()
          }
        },
      )
    } catch (err) {
      throw warnError('storageHandler uploadFile()', err)
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
   * @returns {Promise<IWrappedEncodeObject[]>}
   * @protected
   */
  protected async initUlidHome(): Promise<IWrappedEncodeObject[]> {
    try {
      const msgs: IWrappedEncodeObject[] = []
      const forKey: DMsgPostKey = {
        creator: this.jklAddress,
        key: this.keyPair.publicKey.toHex(),
      }
      msgs.push({
        encodedObject: this.jackalSigner.txLibrary.fileTree.msgPostKey(forKey),
        modifier: 10,
      })
      const forInit = await this.reader.encodeProvisionFileTree()
      msgs.push({
        encodedObject:
          this.jackalSigner.txLibrary.fileTree.msgProvisionFileTree(forInit),
        modifier: 10,
      })
      msgs.push(...(await this.ulidFolderToMsgs()))
      msgs.push(...(await this.makeCreateBaseFolderMsgs('Home')))
      return msgs
    } catch (err) {
      throw warnError('storageHandler initUlidHome()', err)
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
      const baseMeta = await FolderMetaHandler.create({
        count: 0,
        location: this.meta.getUlid(),
        name,
        refIndex: position,
      })
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
   * @returns {Promise<IWrappedEncodeObject[]>}
   * @protected
   */
  protected async makeCreateBaseFolderMsgs(
    name: string,
  ): Promise<IWrappedEncodeObject[]> {
    try {
      const baseMeta = await FolderMetaHandler.create({
        count: 0,
        location: 'ulid',
        name,
      })
      return await this.baseFolderToMsgs({
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
      const ft = await this.reader.loadMetaByPath(target)
      if (ft.metaDataType === 'file') {
        const { files } =
          await this.jackalSigner.queries.storage.allFilesByMerkle({
            merkle: ft.merkleRoot,
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
        const data = this.reader.readFolderContents(target)
        for (let file of Object.values(data.files)) {
          const path = tidyString(`${target}/${file.fileMeta.name}`, '/')
          msgs.push(...(await this.prepDelete(path)))
        }
        for (let folder of Object.values(data.folders)) {
          const path = tidyString(`${target}/${folder.whoAmI}`, '/')
          msgs.push(...(await this.prepDelete(path)))
        }
      }
      const pkg = {
        meta: await NullMetaHandler.create(target),
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
   * @returns {Promise<INotification[]>}
   * @protected
   */
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
          const clean = await this.reader.readShareNotification(data)
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

    const ulid = this.readCurrentUlid()
    console.log(ulid)
    const baseMeta = await FileMetaHandler.create({
      description: '',
      file,
      fileMeta,
      location: this.readCurrentUlid(),
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
    const baseMeta = await FileMetaHandler.create({
      description: '',
      file: toProcess,
      fileMeta,
      location: this.readCurrentLocation(),
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
      if (checkSet.needsProviders) {
        const k = Object.keys(this.providers)
        console.log(k)
        const providerCount = k.length
        if (providerCount === 0) {
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
        if (this.meta.getCount() === -1) {
          throw true
        }
      }
      if (checkSet.keys) {
        // TODO - add keys check
        if (this.meta.getCount() === -1) {
          throw true
        }
      }
      if (checkSet.shared) {
        // TODO - add shared check
        if (!this.mustConvert) {
          throw true
        }
      }
      if (checkSet.signer) {
        if (!this.fullSigner) {
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
    const instance = this.stagedUploads[this.meta.getUlid()]
    if (instance) {
      instance.queue.push(...this.uploadQueue)
      this.uploadQueue = []
    } else {
      const queue: IUploadPackage[] = []
      queue.push(...this.uploadQueue)
      this.uploadQueue = []
      this.stagedUploads[this.meta.getUlid()] = {
        children: this.children,
        folderMeta: this.meta,
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
      const data = await this.reader.loadMetaByPath(path)
      if (data.metaDataType === undefined) {
        const msgs: IWrappedEncodeObject[] = []
        let ii = 0
        const parent = await FolderMetaHandler.create({
          count: 0,
          location: '',
          name: data.whoAmI,
        })

        for (let dir of data.dirChildren) {
          const child = await this.buildConversion(`${path}/${dir}`)
          if (child) {
            child.handler.setLocation(parent.getUlid())
            child.handler.setRefIndex(ii)
            const group = await this.folderToMsgs({
              meta: child.handler,
              aes: await genAesBundle(),
            })
            msgs.push(...group)
            msgs.push(...child.msgs)
          }
        }

        for (let fileMeta of Object.values(data.fileChildren)) {
          ii++
          const meta = await this.reader.loadFromLegacyMerkles(
            path,
            parent.getUlid(),
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

        parent.setCount(ii)
        return {
          msgs,
          handler: parent,
        }
      } else {
        return null
      }
    } catch (err) {
      throw warnError('storageHandler buildConversion()', err)
    }
  }
}
