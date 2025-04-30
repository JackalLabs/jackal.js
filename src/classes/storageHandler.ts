import type {
  DMsgBuyStorage,
  DMsgPostKey,
  DUnifiedFile,
  THostSigningClient,
  TJackalSigningClient,
} from '@jackallabs/jackal.js-protos'
import { PrivateKey } from 'eciesjs'
import { extractFileMetaData, hexToInt, maybeMakeThumbnail } from '@/utils/converters'
import { isItPastDate, shuffleArray, signerNotEnabled, tidyString, warnError } from '@/utils/misc'
import { FileMetaHandler, FolderMetaHandler, NullMetaHandler, ShareMetaHandler } from '@/classes/metaHandlers'
import { encryptionChunkSize, signatureSeed } from '@/utils/globalDefaults'
import { aesBlobCrypt, genAesBundle, genIv, genKey } from '@/utils/crypt'
import { hashAndHex, hexToBuffer, stringToShaHex } from '@/utils/hash'
import { EncodingHandler } from '@/classes/encodingHandler'
import { bech32 } from '@jackallabs/bech32'
import {
  IAesBundle,
  IBroadcastOptions,
  IBroadcastOrChainOptions,
  IBuyStorageOptions,
  IChecks,
  IChildMetaDataMap,
  IClientHandler,
  ICloneSharesOptions,
  ICloneUploadOptions,
  IConversionFolderBundle,
  ICreateFolderOptions,
  ICustomRootOptions,
  IDeleteTargetOptions,
  IDownloadByUlidOptions,
  IDownloadTracker,
  IFileMetaData,
  IFileParticulars,
  IFileTreePackage,
  IFolderMetaData,
  IFolderMetaHandler,
  ILegacyFolderMetaData,
  IMetaDataByUlidOptions,
  IMoveRenameResourceOptions,
  IMoveRenameTarget,
  INotificationRecord,
  IProviderIpSet,
  IProviderPool,
  IProviderUploadResponse,
  IReadFolderContentOptions,
  IRemoveShareRecordOptions,
  IRnsHandler,
  IShareDirectPackage,
  IShareLinkOptions,
  IShareLinkPackage,
  IShareLinks,
  IShareMetaData,
  IShareOptions,
  IShareResults,
  IStagedUploadPackage,
  IStorageHandler,
  IStorageOptions,
  IStorageStatus,
  IUnshareOptions,
  IUnsharePackage,
  IUploadPackage,
  IWrappedEncodeObject,
  TDownloadStagingOptions,
  TLoadThumbnailOptions,
  TSharePackage,
} from '@/interfaces'
import type { TFullSignerState, TMetaDataSets, TMetaHandler } from '@/types'
import { ulid } from 'ulid'
import { UploadHandler } from '@/classes/uploadHandler'

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
  protected notifications: INotificationRecord[]
  protected children: IChildMetaDataMap
  protected upcycleQueue: IWrappedEncodeObject[]

  protected meta: IFolderMetaHandler
  protected providers: IProviderPool

  protected constructor (
    rns: IRnsHandler | null,
    client: IClientHandler,
    jackalSigner: TJackalSigningClient,
    hostSigner: THostSigningClient,
    accountAddress: string,
    fullSignerState: TFullSignerState,
    defaultKeyPair: PrivateKey,
    path: string,
    meta: IFolderMetaHandler,
  ) {
    super(client, jackalSigner, hostSigner, fullSignerState[0], defaultKeyPair, accountAddress)

    this.rns = rns
    this.path = path
    this.keyPair = fullSignerState[0]
    this.fullSigner = fullSignerState[1]
    this.jackalClient = client
    this.proofInterval = client.getProofWindow()

    this.uploadsInProgress = false
    this.uploadQueue = []
    this.stagedUploads = {}
    this.notifications = []

    this.children = {
      files: {},
      folders: {},
      nulls: {},
    }
    this.mustConvert = false
    this.upcycleQueue = []

    this.meta = meta
    this.providers = {}

    if (typeof window !== 'undefined' && 'addEventListener' in window) {
      window.addEventListener('beforeunload', this.beforeUnloadHandler)
    }
  }

  /**
   *
   * @param {IClientHandler} client
   * @param {IStorageOptions} [options]
   * @returns {Promise<IStorageHandler>}
   */
  static async init (
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
      let defaultKeyPair = PrivateKey.fromHex(dummyKey)
      let keyPair: TFullSignerState = [defaultKeyPair, false]
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
        defaultKeyPair,
        path,
        meta,
      )
    } catch (err) {
      throw warnError('storageHandler init()', err)
    }
  }

  /**
   *
   * @param {IClientHandler} client
   * @returns {Promise<TFullSignerState>}
   */
  static async enableFullSigner (
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
        case 'mnemonic':
          break
        default:
          throw new Error(
            'No wallet selected but one is required to init StorageHandler',
          )
      }

      const hostAddress = client.getHostAddress()
      const chainId = client.getHostChainId()
      let signed, signatureAsHex
      switch (selectedWallet) {
        case 'keplr':
          if (!window.keplr) {
            throw 'Missing wallet extension'
          } else {
            signed = await window.keplr.signArbitrary(
              chainId,
              hostAddress,
              signatureSeed,
            )
            signatureAsHex = await stringToShaHex(signed.signature)
          }
          break
        case 'leap':
          if (!window.leap) {
            throw 'Missing wallet extension'
          } else {
            signed = await window.leap.signArbitrary(
              chainId,
              hostAddress,
              signatureSeed,
            )
            signatureAsHex = await stringToShaHex(signed.signature)
          }
          break
        case 'mnemonic':
          let wallet
          if (typeof window !== 'undefined') {
            wallet = window.mnemonicWallet
          } else {
            wallet = global.mnemonicWallet
          }

          if (!wallet) {
            throw new Error('Missing mnemonic wallet')
          } else {
            signed = await wallet.signArbitrary(
              signatureSeed,
            )
            signatureAsHex = await stringToShaHex(signed.signature)
          }
          break
        default:
          throw new Error(
            'No wallet selected but one is required to init StorageHandler',
          )
      }
      return [PrivateKey.fromHex(signatureAsHex), true]
    } catch (err) {
      throw warnError('storageHandler enableFullSigner()', err)
    }
  }

  /**
   *
   */
  cleanShutdown (): void {
    if (typeof window !== 'undefined' && 'removeEventListener' in window) {
      window.removeEventListener('beforeunload', this.beforeUnloadHandler)
    }
  }

  /**
   *
   * @param {IBroadcastOrChainOptions} [options]
   * @returns {Promise<IWrappedEncodeObject[]>}
   */
  async registerPubKey (options?: IBroadcastOrChainOptions): Promise<IWrappedEncodeObject[]> {
    if (await this.checkLocked({ signer: true })) {
      throw new Error('Locked.')
    }
    try {
      const msgs: IWrappedEncodeObject[] = [
        {
          encodedObject: this.encodePostKey(this.keyPair.publicKey.toHex()),
          modifier: 0,
        },
      ]
      if (options?.chain) {
        return msgs
      } else {
        const postBroadcast =
          await this.jackalClient.broadcastAndMonitorMsgs(msgs, options?.broadcastOptions)
        console.log('registerPubKey:', postBroadcast)
        return []
      }
    } catch (err) {
      throw warnError('storageHandler registerPubKey()', err)
    }
  }

  /**
   *
   * @param {IReadFolderContentOptions} [options]
   * @returns {Promise<void>}
   */
  async loadDirectory (options: IReadFolderContentOptions = {}): Promise<void> {
    if (await this.checkLocked({ noConvert: true, signer: true })) {
      throw new Error('Locked.')
    }
    const {
      owner,
      path,
      refresh = true,
    } = options
    // console.log('path:', path)
    try {
      this.path = path || this.path
      this.meta = await this.reader.loadFolderMetaHandler(this.path)
      this.children = await this.reader.readFolderContents(this.path, { owner, refresh })
    } catch (err) {
      throw warnError('storageHandler loadDirectory()', err)
    }
  }

  /**
   *
   * @param {string} path
   * @param {IReadFolderContentOptions} [options]
   * @returns {Promise<IChildMetaDataMap>}
   */
  async readDirectoryContents (path: string, options?: IReadFolderContentOptions): Promise<IChildMetaDataMap> {
    if (await this.checkLocked({ noConvert: true, signer: true })) {
      throw new Error('Locked.')
    }
    // console.log('path:', path)

    return this.reader.readFolderContents(path, options)
  }

  /**
   *
   * @returns {Promise<void>}
   */
  async loadShared (): Promise<void> {
    if (await this.checkLocked({ signer: true })) {
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
  listChildFolders (): string[] {
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
  listChildFolderMetas (): IFolderMetaData[] {
    return Object.values(this.children.folders)
  }

  /**
   *
   * @returns {string[]}
   */
  listChildFiles (): string[] {
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
  listChildFileMetas (): IFileMetaData[] {
    return Object.values(this.children.files)
  }

  /**
   *
   * @returns {Promise<void>}
   */
  async upgradeSigner (): Promise<void> {
    try {
      const [pair, signer] = await StorageHandler.enableFullSigner(
        this.jackalClient,
      )
      this.keyPair = pair
      this.fullSigner = signer
      await this.resetReader(pair)
    } catch (err) {
      throw warnError('storageHandler upgradeSigner()', err)
    }
  }

  /**
   *
   * @returns {Promise<string[]>}
   */
  async getAvailableProviders (): Promise<string[]> {
    try {
      const data = await this.jackalClient.getQueries().storage.activeProviders()
      // console.log(data)
      const final: string[] = []
      for (let value of data.providers) {
        final.push(value.address)
      }
      return final
    } catch (err) {
      throw warnError('storageHandler getAvailableProviders()', err)
    }

  }

  /**
   *
   * @param {string[]} providers
   * @returns {Promise<Record<string, string>>}
   */
  async findProviderIps (providers: string[]): Promise<IProviderIpSet> {
    try {
      const ips: Record<string, string> = {}
      for (let address of providers) {
        // console.log(address)
        const details = await this.jackalClient
          .getQueries()
          .storage.provider({ address })
        // console.log(details)
        ips[details.provider.address] = details.provider.ip
      }
      // console.log(ips)
      return ips
    } catch (err) {
      throw warnError('storageHandler findProviderIps()', err)
    }
  }

  /**
   *
   * @param {IProviderIpSet} providers
   * @returns {Promise<void>}
   */
  async loadProviderPool (providers?: IProviderIpSet): Promise<void> {
    try {
      providers = providers || (await this.loadProvidersFromChain())
      // console.log(providers)
      for (let ip of Object.values(providers)) {
        // console.log(ip)
        const root = ip.split('.').slice(-2).join('.')
        // console.log(root)
        if (!(root in this.providers)) {
          this.providers[root] = []
        }

        this.providers[root].push({
          ip,
          failures: 0,
        })
        // console.log(this.providers)
      }
    } catch (err) {
      throw warnError('storageHandler loadProviderPool()', err)
    }

  }

  /**
   *
   * @param {IBroadcastOrChainOptions} [options]
   * @returns {Promise<IWrappedEncodeObject[]>}
   */
  async initStorage (options?: IBroadcastOrChainOptions): Promise<IWrappedEncodeObject[]> {
    if (await this.checkLocked({ signer: true })) {
      throw new Error('Locked.')
    }
    try {
      await this.loadDirectory()
      return []
    } catch {
      try {
        if (options?.chain) {
          return await this.initUlidHome()
        } else {
          const msgs = await this.initUlidHome()
          const postBroadcast =
            await this.jackalClient.broadcastAndMonitorMsgs(msgs, options?.broadcastOptions)
          console.log('initStorage:', postBroadcast)
          await this.loadDirectory()
          return []
        }
      } catch (err) {
        throw warnError('storageHandler initStorage()', err)
      }
    }
  }

  /**
   *
   * @param {ICustomRootOptions} options
   * @returns {Promise<IWrappedEncodeObject[]>}
   */
  async initCustomRoot (options: ICustomRootOptions): Promise<IWrappedEncodeObject[]> {
    if (await this.checkLocked({ signer: true })) {
      throw new Error('Locked.')
    }
    try {
      const msgs = await this.makeCreateBaseFolderMsgs(options.name)
      if (options?.chain) {
        return msgs
      } else {
        const postBroadcast =
          await this.jackalClient.broadcastAndMonitorMsgs(msgs, options?.broadcastOptions)
        console.log('initCustomRoot:', postBroadcast)
        await this.loadDirectory()
        return []
      }
    } catch (err) {
      throw warnError('storageHandler initCustomRoot()', err)
    }
  }

  /**
   *
   * @param {IBroadcastOrChainOptions} options
   * @returns {Promise<IWrappedEncodeObject[]>}
   */
  async checkAndInitSharing (options?: IBroadcastOrChainOptions): Promise<IWrappedEncodeObject[]> {
    if (await this.checkLocked({ signer: true })) {
      throw new Error('Locked.')
    }
    try {
      const msgs: IWrappedEncodeObject[] = []
      let exists
      try {
        await this.reader.loadKeysByPath('Shared', this.jklAddress)
        exists = true
      } catch {
        exists = false
      }
      if (!exists) {
        msgs.push(...(await this.makeCreateBaseFolderMsgs('Shared')))
        if (options?.chain) {
          return msgs
        } else {
          const postBroadcast =
            await this.jackalClient.broadcastAndMonitorMsgs(msgs, options?.broadcastOptions)
          console.log('checkAndInitSharing:', postBroadcast)
          await this.loadDirectory()
          return []
        }
      } else {
        return msgs
      }
    } catch (err) {
      throw warnError('storageHandler checkAndInitSharing()', err)
    }
  }

  /**
   *
   * @returns {Promise<IStorageStatus>}
   */
  async planStatus (): Promise<IStorageStatus> {
    try {
      const { storagePaymentInfo } =
        await this.jackalSigner.queries.storage.storagePaymentInfo({
          address: this.jklAddress,
        })
      const active = !isItPastDate(new Date(storagePaymentInfo.end))
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
   * @param {IBuyStorageOptions} options
   * @returns {Promise<number>}
   */
  async estimateStoragePlan (options: IBuyStorageOptions): Promise<number> {
    try {
      const { gb, days = 30 } = options
      const result = await this.jackalClient.getQueries().storage.priceCheck({
        duration: Number(days) > 30 ? Number(days) : 30,
        bytes: 3 * 1000000000 * (Number(gb) || 1),
      })
      return result.price
    } catch (err) {
      throw warnError('storageHandler estimateStoragePlan()', err)
    }
  }

  /**
   *
   * @param {IBuyStorageOptions} options
   * @returns {Promise<IWrappedEncodeObject[]>}
   */
  async purchaseStoragePlan (options: IBuyStorageOptions): Promise<IWrappedEncodeObject[]> {
    try {
      const { gb, days = 30, receiver = this.jklAddress, referrer = '' } = options
      const wrappedBuyMsg = this.buyStoragePlan(receiver, referrer, gb, days)
      if (options?.chain) {
        return [wrappedBuyMsg]
      } else {
        const postBroadcast =
          await this.jackalClient.broadcastAndMonitorMsgs(wrappedBuyMsg, options?.broadcastOptions)
        console.log('purchaseStoragePlan:', postBroadcast)
        return []
      }
    } catch (err) {
      throw warnError('storageHandler purchaseStoragePlan()', err)
    }
  }

  /**
   *
   * @param {ICreateFolderOptions} options
   * @returns {Promise<IWrappedEncodeObject[]>}
   */
  async createFolders (options: ICreateFolderOptions): Promise<IWrappedEncodeObject[]> {
    if (
      await this.checkLocked({ noConvert: true, exists: true, signer: true })
    ) {
      throw new Error('Locked.')
    }
    try {
      const { names } = options
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

      if (options?.chain) {
        return msgs
      } else {
        const postBroadcast =
          await this.jackalClient.broadcastAndMonitorMsgs(msgs, options?.broadcastOptions)
        console.log('createFolders:', postBroadcast)
        return []
      }
    } catch (err) {
      throw warnError('storageHandler createFolders()', err)
    }
  }

  /**
   *
   * @param {IStagedUploadPackage} bundle
   * @returns {Promise<IWrappedEncodeObject[]>}
   */
  async saveFolder (
    bundle: IStagedUploadPackage,
  ): Promise<IWrappedEncodeObject[]> {
    if (
      await this.checkLocked({ noConvert: true, exists: true, signer: true })
    ) {
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
                if ((files as DUnifiedFile[]).length === 0) {
                  continue
                }
                const [target] = files.filter(
                  (file: DUnifiedFile) => file.owner === this.jklAddress,
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
      // console.log(bundle.folderMeta)
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
   * @param {IMoveRenameResourceOptions} options
   * @returns {Promise<IWrappedEncodeObject[]>}
   */
  async moveRenameResource (options: IMoveRenameResourceOptions): Promise<IWrappedEncodeObject[]> {
    try {
      const { start, finish } = options
      const msgs: IWrappedEncodeObject[] = []
      let target: IMoveRenameTarget = { name: '', ref: 0 }
      let loop = 0
      while (!target.location && loop < 2) {
        switch (loop) {
          case 0:
            for (let index of Object.keys(this.children.folders)) {
              const folderRef = Number(index)
              const folder = this.children.folders[folderRef]
              if (folder.whoAmI === start) {
                target.location = folder.location
                target.folder = folder
                target.ref = folderRef
                break
              }
            }
            break
          case 1:
            for (let index of Object.keys(this.children.files)) {
              const fileRef = Number(index)
              const file = this.children.files[fileRef]
              if (file.fileMeta.name === start) {
                target.location = file.location
                target.file = file
                target.ref = fileRef
                break
              }
            }
            break
        }
        loop++
      }
      if (!target.location) {
        throw new Error(`Target ${start} not found in current folder`)
      }
      const isMove = finish.includes('/')
      target.name = finish.split('/').slice(-1)[0]
      if (isMove) {
        const dest = finish.split('/').slice(0, -1).join('/')
        const sourceUlid = this.reader.ulidLookup(this.path)
        const destUlid = this.reader.ulidLookup(dest)

        const ulid = this.reader.ulidLookup(`${this.path}/${start}`)
        const ref = this.reader.findRefIndex(`${this.path}/${start}`)
        const nullPkg: IFileTreePackage = {
          meta: await NullMetaHandler.create({
            location: sourceUlid,
            refIndex: ref,
            ulid,
          }),
          aes: await genAesBundle(),
        }
        msgs.push(...(await this.filetreeDeleteToMsgs(nullPkg)))
        const finalPkg = await this.makeRenamePkg(target, destUlid)
        msgs.push(...(await this.movePkgToMsgs(finalPkg)))
        const destMeta = await this.reader.loadFolderMetaByUlid(destUlid)
        const mH = await FolderMetaHandler.create({
          count: (await this.reader.refCountRead(dest)) + 1,
          description: destMeta.description,
          location: destMeta.location.split('/').slice(-1)[0],
          name: destMeta.whoAmI,
          ulid: destUlid,
        })
        const destPkg = {
          meta: mH,
          aes: await this.reader.loadKeysByUlid(destUlid, this.hostAddress),
        }
        msgs.push(...(await this.existingFolderToMsgs(destPkg)))
        this.reader.refCountIncrement(dest)
      } else {
        const finalPkg = await this.makeRenamePkg(target)
        msgs.push(...(await this.existingMetaToMsgs(finalPkg)))
      }
      if (options?.chain) {
        return msgs
      } else {
        const postBroadcast =
          await this.jackalClient.broadcastAndMonitorMsgs(msgs, options?.broadcastOptions)
        console.log('moveRenameResource:', postBroadcast)
        return []
      }
    } catch (err) {
      throw warnError('storageHandler moveRenameResource()', err)
    }
  }

  /**
   *
   * @returns {string}
   */
  readActivePath (): string {
    return this.path
  }

  /**
   *
   * @returns {string}
   */
  readCurrentLocation (): string {
    return this.meta.getLocation()
  }

  /**
   *
   * @returns {string}
   */
  readCurrentUlid (): string {
    return this.meta.getUlid()
  }

  /**
   *
   * @returns {number}
   */
  readChildCount (): number {
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
  readMustConvertStatus (): boolean {
    return this.mustConvert
  }

  /**
   *
   * @returns {string[]}
   */
  readCurrentQueue (): string[] {
    return this.uploadQueue.map((item) => item.file.name)
  }

  /**
   *
   * @param {string} name
   */
  removeFromQueue (name: string): void {
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
  async queuePrivate (
    toQueue: File | File[],
    duration: number = 0,
  ): Promise<number> {
    if (
      await this.checkLocked({ noConvert: true, exists: true, signer: true })
    ) {
      throw new Error('Locked.')
    }
    try {
      if (toQueue instanceof Array) {
        for (let file of toQueue) {
          this.uploadQueue.push(await this.processPrivate(file, duration))
        }
        return toQueue.length
      } else {
        this.uploadQueue.push(await this.processPrivate(toQueue, duration))
        return 1
      }
    } catch (err) {
      throw warnError('storageHandler queuePrivate()', err)
    }
  }

  /**
   *
   * @param {File | File[]} toQueue
   * @param {number} [duration]
   * @returns {Promise<number>}
   */
  async queuePublic (
    toQueue: File | File[],
    duration: number = 0,
  ): Promise<number> {
    if (
      await this.checkLocked({ noConvert: true, exists: true, signer: true })
    ) {
      throw new Error('Locked.')
    }
    try {
      if (toQueue instanceof Array) {
        for (let file of toQueue) {
          this.uploadQueue.push(await this.processPublic(file, duration))
        }
        return toQueue.length
      } else {
        this.uploadQueue.push(await this.processPublic(toQueue, duration))
        return 1
      }
    } catch (err) {
      throw warnError('storageHandler queuePublic()', err)
    }
  }

  /**
   *
   * @param {ICloneSharesOptions} options
   * @returns {Promise<IWrappedEncodeObject[]>}
   */
  async cloneShares (options: ICloneSharesOptions): Promise<IWrappedEncodeObject[]> {
    try {
      const targets = []
      let sharer
      if (options.targets instanceof Array) {
        sharer = options.targets[0].owner
        for (let one of options.targets) {
          const meta = await this.reader.loadMetaByExternalUlid(one.pointsTo, one.owner)
          if ('fileMeta' in meta) {
            targets.push(meta)
          }
        }
      } else {
        sharer = options.targets.owner
        const meta = await this.reader.loadMetaByExternalUlid(options.targets.pointsTo, options.targets.owner)
        if ('fileMeta' in meta) {
          targets.push(meta)
        }
      }
      if (targets.length === 0) {
        throw new Error('No Valid Targets')
      }
      return await this.cloneUpload({ ...options, targets, sharer })
    } catch (err) {
      throw warnError('storageHandler cloneShares()', err)
    }
  }

  /**
   *
   * @param {ICloneUploadOptions} options
   * @returns {Promise<IWrappedEncodeObject[]>}
   */
  async cloneUpload (options: ICloneUploadOptions): Promise<IWrappedEncodeObject[]> {
    try {
      let msgs: IWrappedEncodeObject[] = []
      const blockHeight = await this.jackalClient.getJackalBlockHeight()
      const destUlid = this.reader.ulidLookup(options.destination)
      const destMeta = await this.reader.loadFolderMetaByUlid(destUlid)
      const folderMeta = await FolderMetaHandler.create({
        clone: destMeta,
        ulid: destUlid,
      })
      let refCount = await this.reader.refCountRead(options.destination)
      if (options.targets instanceof Array) {
        for (let target of options.targets) {
          const reps = Math.ceil(target.fileMeta.size / encryptionChunkSize)
          const size = target.fileMeta.size + (reps * 8)
          const meta = await FileMetaHandler.create({ clone: target, refIndex: refCount })
          const aes = await this.reader.loadKeysByUlid(target.ulid, options.sharer)
          meta.setLocation(destUlid)
          const pkg = {
            duration: 0,
            meta,
            size,
            aes,
          }
          refCount++
          const fresh = await this.clonePkgToMsgs(pkg, blockHeight)
          msgs.push(...fresh)
        }
      } else {
        const reps = Math.ceil(options.targets.fileMeta.size / encryptionChunkSize)
        const size = options.targets.fileMeta.size + (reps * 8)
        const meta = await FileMetaHandler.create({ clone: options.targets, refIndex: refCount })
        const aes = await this.reader.loadKeysByUlid(options.targets.ulid, options.sharer)
        meta.setLocation(destUlid)
        const pkg = {
          duration: 0,
          meta,
          size,
          aes,
        }
        refCount++
        const fresh = await this.clonePkgToMsgs(pkg, blockHeight)
        msgs.push(...fresh)
      }
      folderMeta.setCount(refCount)
      const folderMsgs = await this.existingFolderToMsgs({
        meta: folderMeta,
      })
      msgs = [...folderMsgs, ...msgs]
      if (options?.chain) {
        return msgs
      } else {
        const postBroadcast =
          await this.jackalClient.broadcastAndMonitorMsgs(msgs, options?.broadcastOptions)
        console.log('registerPubKey:', postBroadcast)
        return []
      }
    } catch (err) {
      throw warnError('storageHandler cloneUpload()', err)
    }
  }

  /**
   *
   * @param {IBroadcastOptions} [options]
   * @returns {Promise<void>}
   */
  async processAllQueues (options?: IBroadcastOptions): Promise<void> {
    if (
      await this.checkLocked({
        needsProviders: true,
        noConvert: true,
        exists: true,
        signer: true,
      })
    ) {
      throw new Error('Locked.')
    }
    try {
      await this.stageQueue()
      const msgs: IWrappedEncodeObject[] = []
      for (let folderUlid in this.stagedUploads) {
        const readyMsgs = await this.saveFolder(this.stagedUploads[folderUlid])
        msgs.push(...readyMsgs)
      }
      this.stagedUploads = {}
      const postBroadcast =
        await this.jackalClient.broadcastAndMonitorMsgs(msgs, options)

      if (options?.callback) {
        try {
          options.callback()
        } catch (err) {
          console.error(err)
          throw new Error('Callback Failed')
        }
      }

      this.uploadsInProgress = true
      if (!postBroadcast.error) {
        if (!postBroadcast.txEvents.length) {
          throw Error('tx has no events')
        }
        const uploadHeight = postBroadcast.txEvents[0].height
        const activeUploads = await this.batchUploads(msgs, uploadHeight)
        await Promise.allSettled(activeUploads)
      }
      this.uploadsInProgress = false
      await this.loadDirectory()
      console.log('processAllQueues:', postBroadcast)
    } catch (err) {
      throw warnError('storageHandler processAllQueues()', err)
    }
  }

  /**
   *
   * @param {TLoadThumbnailOptions} options
   * @returns {Promise<string>}
   */
  async loadThumbnail (options: TLoadThumbnailOptions): Promise<string> {
    try {
      let meta
      if ('filePath' in options) {
        meta = await this.reader.loadMetaByExternalPath(options.filePath, options.userAddress)
      } else {
        meta = await this.reader.loadMetaByExternalUlid(options.ulid, options.userAddress)
      }
      return ('thumbnail' in meta) ? meta.thumbnail : ''
    } catch (err) {
      throw warnError('storageHandler loadThumbnail()', err)
    }
  }

  /**
   *
   * @param {IMetaDataByUlidOptions} options
   * @returns {Promise<TMetaDataSets>}
   */
  async getMetaDataByUlid (options: IMetaDataByUlidOptions): Promise<TMetaDataSets> {
    try {
      const ica = options.userAddress || this.jackalClient.getICAJackalAddress()
      return await this.reader.loadMetaByExternalUlid(options.ulid, ica, options.linkKey)
    } catch (err) {
      throw warnError('storageHandler getMetaDataByUlid()', err)
    }
  }

  /**
   *
   * @param {IMetaDataByUlidOptions} options
   * @returns {Promise<IChildMetaDataMap>}
   */
  async getFolderDetailsByUlid (options: IMetaDataByUlidOptions): Promise<IChildMetaDataMap> {
    try {
      return await this.reader.readFolderContents(options.ulid, {
        owner: options.userAddress,
        linkKey: options.linkKey,
      })
    } catch (err) {
      throw warnError('storageHandler getFolderDetailsByUlid()', err)
    }
  }

  /**
   *
   * @param {string} path
   * @param {string} address
   * @returns {string}
   */
  findUlid (path: string, address?: string): string {
    try {
      const ica = address || this.jackalClient.getICAJackalAddress()
      return this.reader.ulidLookup(path, ica)
    } catch (err) {
      throw warnError('storageHandler findUlid()', err)
    }
  }

  /**
   *
   * @param {string} filePath
   * @param {string} [address]
   * @returns {Promise<IFileMetaData>}
   */
  async getFileMetaData (filePath: string, address?: string): Promise<IFileMetaData> {
    try {
      const ica = address || this.jackalClient.getICAJackalAddress()
      const ft = await this.reader.loadMetaByExternalPath(filePath, ica)
      if (ft.metaDataType !== 'file') {
        throw new Error('Not a file')
      }
      return ft
    } catch (err) {
      throw warnError('storageHandler getFileMetaData()', err)
    }
  }

  /**
   *
   * @param {string} filePath
   * @param {string} [address]
   * @returns {Promise<IFileParticulars>}
   */
  async getFileParticulars (filePath: string, address?: string): Promise<IFileParticulars> {
    if (await this.checkLocked({ signer: true })) {
      throw new Error('Locked.')
    }
    try {
      const ica = address || this.jackalClient.getICAJackalAddress()
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
      throw warnError('storageHandler getFileParticulars()', err)
    }
  }

  /**
   *
   * @param {string} filePath
   * @param {IDownloadTracker} trackers
   * @returns {Promise<File>}
   */
  async downloadFile (
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
  async downloadExternalFile (
    userAddress: string, // jackal address not ica
    filePath: string, // /cat_turtle.png
    trackers: IDownloadTracker,
  ): Promise<File> {
    if (await this.checkLocked({ signer: true })) {
      throw new Error('Locked.')
    }
    try {
      const particulars = await this.getFileParticulars(filePath)
      if (particulars.providerIps.length === 0) {
        throw new Error('No providers found')
      }
      const providerList = shuffleArray(particulars.providerIps)
      for (const _ of providerList) {
        const provider =
          providerList[Math.floor(Math.random() * providerList.length)]
        if (typeof provider === 'undefined') {
          continue
        }
        try {
          return await this.downloadStaging({
            particulars,
            provider,
            trackers,
            userAddress,
            filePath,
          })
        } catch (err) {
          console.warn(`Error fetching from provider ${provider}: ${err}`)
        }
      }
      throw new Error('Download Failure')
    } catch (err) {
      throw warnError('storageHandler downloadExternalFile()', err)
    }
  }

  /**
   *
   * @param {IDownloadByUlidOptions} options
   * @returns {Promise<File>}
   */
  async downloadByUlid (options: IDownloadByUlidOptions): Promise<File> {
    try {
      const {
        trackers,
        ulid,
        userAddress,
        linkKey,
      } = options
      const ft = await this.reader.loadMetaByExternalUlid(ulid, userAddress, linkKey)
      if (ft.metaDataType !== 'file') {
        throw new Error('Not a file')
      }
      const { providerIps } = await this.jackalSigner.queries.storage.findFile({
        merkle: ft.merkleRoot,
      })
      const particulars = {
        fileMeta: ft.fileMeta,
        merkle: ft.merkleRoot,
        merkleLocation: ft.merkleHex,
        providerIps,
      }
      const providerList = shuffleArray(particulars.providerIps)
      for (const _ of providerList) {
        const provider = providerList[Math.floor(Math.random() * providerList.length)] as string
        try {
          return await this.downloadStaging({
            particulars,
            provider,
            trackers,
            userAddress,
            ulid,
            linkKey,
          })
        } catch (err) {
          console.warn(`Error fetching from provider ${provider}: ${err}`)
        }
      }
      throw new Error('Download Failure')
    } catch (err) {
      throw warnError('storageHandler downloadByUlid()', err)
    }
  }

  /**
   *
   * @param {IDeleteTargetOptions} options
   * @returns {Promise<IWrappedEncodeObject[]>}
   */
  async deleteTargets (options: IDeleteTargetOptions): Promise<IWrappedEncodeObject[]> {
    if (
      await this.checkLocked({ noConvert: true, exists: true, signer: true })
    ) {
      throw new Error('Locked.')
    }
    try {
      const { targets } = options
      const msgs: IWrappedEncodeObject[] = []
      if (targets instanceof Array) {
        for (let target of targets) {
          msgs.push(...(await this.prepDelete(this.assembleLocation(target))))
        }
      } else {
        msgs.push(...(await this.prepDelete(this.assembleLocation(targets))))
      }

      if (options?.chain) {
        return msgs
      } else {
        const postBroadcast =
          await this.jackalClient.broadcastAndMonitorMsgs(msgs, options?.broadcastOptions)
        console.log('deleteTargets:', postBroadcast)
        return []
      }
    } catch (err) {
      throw warnError('storageHandler deleteTargets()', err)
    }
  }

  /**
   *
   * @param {string} path
   * @returns {Promise<string[]>}
   */
  async checkSharedTo (path: string): Promise<string[]> {
    try {
      return await this.reader.sharersRead(path)
    } catch (err) {
      throw warnError('storageHandler checkSharedTo()', err)
    }
  }

  /**
   *
   * @param {IShareOptions} options
   * @returns {Promise<IWrappedEncodeObject[]>}
   */
  async shareDirect (options: IShareOptions): Promise<IWrappedEncodeObject[]> {
    if (
      await this.checkLocked({ noConvert: true, exists: true, signer: true })
    ) {
      throw new Error('Locked.')
    }
    try {
      const { receiver, paths } = options
      const msgs: IWrappedEncodeObject[] = []
      const pkg: IShareDirectPackage = {
        isFile: false,
        isPrivate: true,
        path: 'tbd',
        receiver: await this.possibleRnsToAddress(receiver),
      }
      if (paths instanceof Array) {
        for (let path of paths) {
          pkg.path = path
          const local = await this.prepShare(pkg)
          msgs.push(...local.msgs)
        }
      } else {
        pkg.path = paths
        const local = await this.prepShare(pkg)
        msgs.push(...local.msgs)
      }
      if (options?.chain) {
        return msgs
      } else {
        const postBroadcast =
          await this.jackalClient.broadcastAndMonitorMsgs(msgs, options?.broadcastOptions)
        console.log('shareDirect:', postBroadcast)
        return []
      }
    } catch (err) {
      throw warnError('storageHandler shareDirect()', err)
    }
  }

  /**
   *
   * @param {IShareLinkOptions} options
   * @returns {Promise<IShareLinks>}
   */
  async shareLink (options: IShareLinkOptions): Promise<IShareLinks> {
    if (
      await this.checkLocked({ noConvert: true, exists: true, signer: true })
    ) {
      throw new Error('Locked.')
    }
    try {
      const { paths } = options
      const final: IShareLinks = {
        links: {},
        msgs: [],
      }
      const lUlid = ulid()
      const pkg: IShareLinkPackage = {
        isFile: false,
        link: lUlid,
        path: 'tbd',
      }
      if (paths instanceof Array) {
        for (let path of paths) {
          pkg.path = path
          const local = await this.prepShare(pkg)
          final.links[path] = {
            isFolder: local.isFolder,
            linkKey: lUlid,
          }
          final.msgs.push(...local.msgs)
        }
      } else {
        pkg.path = paths
        const local = await this.prepShare(pkg)
        final.links[paths] = {
          isFolder: local.isFolder,
          linkKey: lUlid,
        }
        final.msgs.push(...local.msgs)
      }
      if (options?.chain) {
        return final
      } else {
        const postBroadcast =
          await this.jackalClient.broadcastAndMonitorMsgs(final.msgs, options?.broadcastOptions)
        console.log('shareLink:', postBroadcast)
        final.msgs = []
        return final
      }
    } catch (err) {
      throw warnError('storageHandler shareLink()', err)
    }
  }

  /**
   *
   * @param {IUnshareOptions} options
   * @returns {Promise<IWrappedEncodeObject[]>}
   */
  async unshare (options: IUnshareOptions): Promise<IWrappedEncodeObject[]> {
    try {
      const msgs: IWrappedEncodeObject[] = []
      const { paths, receivers } = options
      const pkg: IUnsharePackage = {
        removed: [...new Set(receivers)],
        path: 'tbd',
      }
      if (paths instanceof Array) {
        for (let path of paths) {
          pkg.path = path
          msgs.push(...(await this.sendUnshareToMsgs(pkg)))
        }
      } else {
        pkg.path = paths
        msgs.push(...(await this.sendUnshareToMsgs(pkg)))
      }
      if (options?.chain) {
        return msgs
      } else {
        const postBroadcast =
          await this.jackalClient.broadcastAndMonitorMsgs(msgs, options?.broadcastOptions)
        console.log('unshare:', postBroadcast)
        return []
      }
    } catch (err) {
      throw warnError('storageHandler unshare()', err)
    }
  }

  /**
   *
   * @param {IRemoveShareRecordOptions} options
   * @returns {Promise<IWrappedEncodeObject[]>}
   */
  async removeShareRecord (options: IRemoveShareRecordOptions): Promise<IWrappedEncodeObject[]> {
    try {
      const msgs: IWrappedEncodeObject[] = []
      const { location, name, owner, ulid } = options.record
      const loc = location.split('/').slice(-1)[0]
      const refIndex = this.reader.findRefIndex(`Shared/${owner}/${name}`)
      const meta = await NullMetaHandler.create({
        location: loc,
        refIndex,
        ulid,
      })
      const local = await this.filetreeDeleteToMsgs({
        meta,
        aes: await genAesBundle(),
      })
      msgs.push(...local)
      if (options?.chain) {
        return msgs
      } else {
        const postBroadcast =
          await this.jackalClient.broadcastAndMonitorMsgs(msgs, options?.broadcastOptions)
        console.log('removeShareRecord:', postBroadcast)
        return []
      }
    } catch (err) {
      throw warnError('storageHandler removeShareRecord()', err)
    }
  }

  /**
   *
   * @returns {Promise<number>}
   */
  async checkNotifications (): Promise<number> {
    if (await this.checkLocked({ signer: true })) {
      throw new Error('Locked.')
    }
    try {
      const received = []
      const raw =
        await this.jackalSigner.queries.notifications.allNotificationsByAddress(
          { to: this.jklAddress },
        )
      for (let one of raw.notifications) {
        const rec = await this.reader.readShareNotification(one)
        received.push(rec)
      }
      this.notifications = received
      return received.length
    } catch (err) {
      throw warnError('storageHandler checkNotifications()', err)
    }
  }

  /**
   *
   * @param {IBroadcastOrChainOptions} options
   * @returns {Promise<IWrappedEncodeObject[]>}
   */
  async processPendingNotifications (options?: IBroadcastOrChainOptions): Promise<IWrappedEncodeObject[]> {
    if (
      await this.checkLocked({ noConvert: true, exists: true, signer: true })
    ) {
      throw new Error('Locked.')
    }
    try {
      let msgs: IWrappedEncodeObject[] = []
      let pendDelMsgs: IWrappedEncodeObject[] = []
      const senders: Record<string, IFolderMetaHandler> = {}
      const fresh: string[] = []
      const pendLength = await this.checkNotifications()
      if (pendLength > 0) {
        let [errorCode, baseRefCount] = await this.reader.readSharingRefCount()
        let baseUlid
        if (errorCode === 0) {
          try {
            baseUlid = this.reader.ulidLookup('Shared')
          } catch {
            console.warn('No Shared, building...')
          }
        }
        const baseMeta = await FolderMetaHandler.create({
          count: baseRefCount,
          location: 'ulid',
          name: 'Shared',
          ulid: baseUlid,
        })
        const received = Date.now()
        for (let one of this.notifications) {
          if (one.msg.indexOf('|') >= 4) {
            const parts = one.msg.split('|')
            let isFile
            switch (parts[0]) {
              case 'file':
                isFile = true
                break
              case 'folder':
                isFile = false
                break
              default:
                continue
            }
            const healthCheck = await this.reader.livenessCheck(parts[1], one.sender)
            if (healthCheck) {
              let [senderErrorCode, senderRefCount] = await this.reader.readSharingRefCount(one.sender)
              let senderIndex
              if (senderErrorCode > 0) {
                fresh.push(one.sender)
                senderIndex = await this.reader.refCountRead('Shared')
                this.reader.refCountIncrement('Shared')
              }
              if (!senders[one.sender]) {
                let ulid
                try {
                  ulid = this.reader.ulidLookup(`Shared/${one.sender}`)
                } catch {
                  console.log('New Sharer')
                }
                senders[one.sender] = await FolderMetaHandler.create({
                  count: senderRefCount,
                  location: baseMeta.getUlid(),
                  name: one.sender,
                  refIndex: senderIndex,
                  ulid,
                })
              }
              const parent = senders[one.sender]
              const mH = await ShareMetaHandler.create({
                isFile,
                location: parent.getUlid(),
                name: parts[2],
                owner: one.sender,
                pointsTo: parts[1],
                received,
                refIndex: senderRefCount,
              })
              this.reader.refCountIncrement(`Shared/${one.sender}`)
              const shared = await this.receiveShareToMsgs({
                meta: mH,
                aes: await genAesBundle(),
              })
              msgs.push(...shared)
            }
            const tidy = await this.tidyReceivedNotifications({ from: one.sender, time: one.time })
            pendDelMsgs.push(...tidy)
          }
        }
        const sub: IWrappedEncodeObject[] = []
        for (let index of Object.keys(senders)) {
          senders[index].setCount(await this.reader.refCountRead(`Shared/${index}`))
          let some
          if (fresh.includes(index)) {
            some = await this.folderToMsgs({
              meta: senders[index],
              aes: await genAesBundle(),
            })
          } else {
            some = await this.existingFolderToMsgs({
              meta: senders[index],
              aes: await genAesBundle(),
            })
          }
          sub.push(...some)
        }
        msgs = [...sub, ...msgs, ...pendDelMsgs]
        if (errorCode === 1) {
          baseMeta.setCount(await this.reader.refCountRead('Shared'))
          const local = await this.baseFolderToMsgs({
            meta: baseMeta,
            aes: await genAesBundle(),
          })
          msgs = [...local, ...msgs]
        } else {
          const sharedUlid = this.reader.ulidLookup('Shared')
          const meta = await FolderMetaHandler.create({ clone: baseMeta.export(), ulid: sharedUlid })
          meta.setCount(await this.reader.refCountRead('Shared'))
          const local = await this.existingFolderToMsgs({
            meta: meta,
            aes: await this.reader.loadKeysByUlid(sharedUlid, this.hostAddress),
          })
          msgs = [...local, ...msgs]
        }
        if (options?.chain) {
          return msgs
        } else {
          const postBroadcast =
            await this.jackalClient.broadcastAndMonitorMsgs(msgs, options?.broadcastOptions)
          console.log('processPendingNotifications:', postBroadcast)
          return []
        }
      } else {
        return []
      }
    } catch (err) {
      throw warnError('storageHandler processPendingNotifications()', err)
    }
  }

  /**
   *
   * @param {string} [sharer]
   * @returns {Promise<IFolderMetaData[] | IShareMetaData[]>}
   */
  async readSharing (sharer?: string): Promise<IFolderMetaData[] | IShareMetaData[]> {
    try {
      return this.reader.sharingLookup({ sharer, refresh: true })
    } catch (err) {
      throw warnError('storageHandler readSharing()', err)
    }
  }

  /**
   *
   * @param {IBroadcastOrChainOptions} [options]
   * @returns {Promise<IWrappedEncodeObject[]>}
   */
  async convert (options?: IBroadcastOrChainOptions): Promise<IWrappedEncodeObject[]> {
    if (await this.checkLocked({ mustConvert: true, signer: true })) {
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

        if (options?.chain) {
          return msgs
        } else {
          const postBroadcast =
            await this.jackalClient.broadcastAndMonitorMsgs(msgs, options?.broadcastOptions)
          console.log('convert:', postBroadcast)
          return []
        }
      } else {
        throw new Error('Nothing to convert')
      }
    } catch (err) {
      throw warnError('storageHandler convert()', err)
    }
  }

  /**
   *
   * @returns {boolean}
   */
  checkIfUpcycle (): boolean {
    const len = this.reader.getConversionQueueLength()
    console.log('ConversionQueueLength:', len)
    return len > 0
  }

  /**
   *
   * @param {IBroadcastOptions} [options]
   * @returns {Promise<void>}
   */
  async checkAndUpcycle (options?: IBroadcastOptions): Promise<void> {
    try {
      if (this.reader.getConversionQueueLength() > 0) {
        const msgs: IWrappedEncodeObject[] = []
        const prep = await this.reader.getConversions()
        const blockheight = await this.jackalClient.getJackalBlockHeight()

        for (let one of prep) {
          let upcycleMsgs
          switch (one[0]) {
            case 'file':
              try {
                const pkg = await this.upcycleFile(one[1])
                const { files } =
                  await this.jackalSigner.queries.storage.allFilesByMerkle({
                    merkle: one[1].export().merkleRoot,
                  })
                if ((files as DUnifiedFile[]).length === 0) {
                  continue
                }
                const [details] = files
                const sourceMsgs = this.fileDeleteToMsgs({
                  creator: this.jklAddress,
                  merkle: details.merkle,
                  start: details.start,
                })
                upcycleMsgs = await this.pkgToMsgs(pkg, blockheight)
                msgs.push(...sourceMsgs, ...upcycleMsgs)
              } catch {
                console.log(`Skipping ${one[1].export().fileMeta.name}`)
              }
              break
            case 'null':
              upcycleMsgs = await this.filetreeDeleteToMsgs({ meta: one[1], aes: await genAesBundle() })
              msgs.push(...upcycleMsgs)
              break
            case 'folder':
              upcycleMsgs = await this.folderToMsgs({ meta: one[1], aes: await genAesBundle() })
              msgs.push(...upcycleMsgs)
              break
            case 'rootlookup':
              upcycleMsgs = await this.upcycleBaseFolderToMsgs({ meta: one[1], aes: await genAesBundle() })
              msgs.push(...upcycleMsgs)
              break
          }
        }
        const ready = confirm('Are you ready to Upcycle?')
        this.upcycleQueue = msgs
        if (ready) {
          await this.runUpcycleQueue(options)
        }
      }
    } catch (err) {
      throw warnError('storageHandler checkAndUpcycle()', err)
    }
  }

  /**
   *
   * @param {IBroadcastOptions} [options]
   * @returns {Promise<void>}
   */
  async runUpcycleQueue (options?: IBroadcastOptions): Promise<void> {
    try {
      const postBroadcast =
        await this.jackalClient.broadcastAndMonitorMsgs(this.upcycleQueue, options)
      console.log('runUpcycleQueue:', postBroadcast)
      if (!postBroadcast.error) {
        if (!postBroadcast.txEvents.length) {
          throw Error('tx has no events')
        }
        let remaining = [...this.upcycleQueue]
        const uploadHeight = postBroadcast.txEvents[0].height
        while (remaining.length > 0) {
          const activeUploads = await this.batchUploads(remaining, uploadHeight)
          const results = await Promise.allSettled(activeUploads)

          const loop: IWrappedEncodeObject[] = []
          for (let i = 0; i < results.length; i++) {
            if (results[i].status === 'rejected') {
              loop.push(remaining[i])
            }
          }
          remaining = [...loop]
        }
      }
      this.upcycleQueue = []
    } catch (err) {
      throw warnError('storageHandler runUpcycleQueue()', err)
    }
  }

  /**
   *
   * @param {TSharePackage} pkg
   * @returns {Promise<IShareResults>}
   * @protected
   */
  protected async prepShare (pkg: TSharePackage): Promise<IShareResults> {
    try {
      const final: IShareResults = {
        isFolder: true,
        msgs: [],
      }
      const viewers = ('receiver' in pkg) ? [pkg.receiver] : []
      try {
        const contents = await this.reader.readFolderContents(pkg.path)
        if ('link' in pkg) {
          final.msgs.push(...(await this.shareLinkToMsgs(pkg)))
        } else {
          final.msgs.push(...(await this.sendShareToMsgs(pkg, viewers)))
        }
        for (let one of Object.values(contents.folders)) {
          const onePkg = {
            ...pkg,
            path: `${pkg.path}/${one.whoAmI}`,
          }
          const local = await this.prepShare(onePkg)
          final.msgs.push(...local.msgs)
        }
        for (let one of Object.values(contents.files)) {
          const onePkg = {
            ...pkg,
            path: `${pkg.path}/${one.fileMeta.name}`,
            isFile: true,
          }
          let local
          if ('link' in pkg) {
            local = await this.shareLinkToMsgs(onePkg as IShareLinkPackage)
          } else {
            local = await this.sendShareToMsgs(onePkg as IShareDirectPackage, viewers)
          }
          final.msgs.push(...local)
        }
      } catch {
        final.isFolder = false
        pkg.isFile = true
        let local
        if ('link' in pkg) {
          local = await this.shareLinkToMsgs(pkg)
        } else {
          local = await this.sendShareToMsgs(pkg, viewers)
        }
        final.msgs.push(...local)
      }
      return final
    } catch (err) {
      throw warnError('storageHandler prepShare()', err)
    }
  }

  /**
   *
   * @param {TDownloadStagingOptions} options
   * @returns {Promise<File>}
   * @protected
   */
  protected async downloadStaging (options: TDownloadStagingOptions): Promise<File> {
    try {
      const {
        particulars,
        provider,
        trackers,
        userAddress,
      } = options
      const url = `${provider}/download/${particulars.merkleLocation}`
      const resp = await fetch(url, { method: 'GET' })
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
          let aes
          if ('filePath' in options) {
            aes = await this.reader.loadKeysByPath(
              options.filePath,
              userAddress,
            )
          } else {
            aes = await this.reader.loadKeysByUlid(
              options.ulid,
              userAddress,
              options.linkKey,
            )
          }
          for (let i = 0; i < baseFile.size;) {
            const offset = i + 8
            const segSize = Number(await baseFile.slice(i, offset).text())
            const last = offset + segSize
            const segment = baseFile.slice(offset, last)
            parts.push(await aesBlobCrypt(segment, aes, 'decrypt'))
            i = last
          }
          baseFile = new File(parts, name, meta)
        }
        if (baseFile.size == 0) {
          throw new Error('File is empty')
        }
        return baseFile
      }
    } catch (err) {
      throw warnError('storageHandler downloadStaging()', err)
    }
  }

  /**
   *
   * @param {FileMetaHandler} source
   * @returns {Promise<IUploadPackage>}
   * @protected
   */
  protected async upcycleFile (source: FileMetaHandler): Promise<IUploadPackage> {
    try {
      const sourceMeta = source.export()
      const { providerIps } = await this.jackalSigner.queries.storage.findFile({
        merkle: sourceMeta.merkleRoot,
      })
      console.log('providerIps:', providerIps)
      let baseFile
      for (let i = 0; i < providerIps.length; i++) {
        const provider = providerIps[0]
        const url = `${provider}/download/${sourceMeta.merkleHex}`
        try {
          const resp = await fetch(url, { method: 'GET' })
          const contentLength = resp.headers.get('Content-Length')
          if (resp.status !== 200 || resp.body === null || !contentLength) {
            throw new Error('Download failed')
          } else {
            const reader = resp.body.getReader()
            const chunks = []
            let receivedLength = 0
            while (true) {
              const { done, value } = await reader.read()
              if (done) {
                break
              }
              chunks.push(value)
              receivedLength += value.length
            }
            const { name, ...meta } = sourceMeta.fileMeta
            baseFile = new File(chunks, name, meta)
            const tmp = await baseFile.slice(0, 8).text()
            if (Number(tmp) > 0) {
              const parts: Blob[] = []
              const aes = await this.reader.loadKeysByUlid(
                source.getUlid(),
                this.jklAddress,
              )
              for (let i = 0; i < baseFile.size;) {
                const offset = i + 8
                const segSize = Number(await baseFile.slice(i, offset).text())
                const last = offset + segSize
                const segment = baseFile.slice(offset, last)

                parts.push(await aesBlobCrypt(segment, aes, 'decrypt'))
                i = last
              }
              baseFile = new File(parts, name, meta)
            }
          }
        } catch (err) {
          console.warn(`Error fetching ${sourceMeta.fileMeta.name} from provider ${provider}: ${err}`)
        }
      }
      if (!baseFile) {
        throw new Error('Download failed')
      }
      const pkg = await this.processPrivate(baseFile, 0)
      pkg.meta = await FileMetaHandler.create({
        clone: {
          ...pkg.meta.export(),
          location: source.getLocation(),
          ulid: source.getUlid(),
        },
        refIndex: source.getRefIndex(),
      })
      return pkg
    } catch (err) {
      throw warnError('storageHandler upcycleFile()', err)
    }
  }

  /**
   *
   * @param {IMoveRenameTarget} target
   * @param {string} movedTo
   * @returns {Promise<IFileTreePackage>}
   * @protected
   */
  protected async makeRenamePkg (target: IMoveRenameTarget, movedTo?: string): Promise<IFileTreePackage> {
    try {
      let mH: TMetaHandler
      let aes: IAesBundle | undefined
      switch (true) {
        case !!target.folder:
          const folderUlid = this.reader.ulidLookup(`${this.path}/${target.folder?.whoAmI}`)
          let folderRef = 0
          let folderLoc = target.folder?.location.split('/').slice(-1)[0]
          if (movedTo) {
            const meta = await this.reader.loadFolderMetaByUlid(movedTo)
            folderRef = hexToInt(meta.count)
            folderLoc = movedTo
          }
          mH = await FolderMetaHandler.create({
            count: hexToInt(target.folder?.count),
            description: target.folder?.description,
            location: folderLoc,
            name: target.name,
            refIndex: folderRef,
            ulid: folderUlid,
          })
          aes = await this.reader.loadKeysByUlid(folderUlid, this.hostAddress)
          break
        case !!target.file:
          const fileUlid = this.reader.ulidLookup(`${this.path}/${target.file?.fileMeta.name}`)
          let fileRef = 0
          let fileLoc = target.file?.location.split('/').slice(-1)[0]
          if (movedTo) {
            const meta = await this.reader.loadFolderMetaByUlid(movedTo)
            fileRef = hexToInt(meta.count)
            fileLoc = movedTo
          }
          mH = await FileMetaHandler.create({
            clone: {
              ...target.file,
              fileMeta: {
                ...target.file?.fileMeta,
                name: target.name,
              },
              location: `s/ulid/${fileLoc}`,
            },
            refIndex: fileRef,
          })
          try {
            aes = await this.reader.loadKeysByUlid(fileUlid, this.hostAddress)
          } catch {
            // do nothing
          }
          break
        default:
          // failsafe, should never happen
          mH = await NullMetaHandler.create({ location: '', refIndex: -1, ulid: '' })
      }
      return {
        meta: mH,
        aes,
      }
    } catch (err) {
      throw warnError('storageHandler makeRenamePkg()', err)
    }
  }

  /**
   *
   * @returns {Promise<IProviderIpSet>}
   * @protected
   */
  protected async loadProvidersFromChain (): Promise<IProviderIpSet> {
    try {
      const providers = await this.getAvailableProviders()
      // console.log(providers)
      return await this.findProviderIps(providers)
    } catch (err) {
      throw warnError('storageHandler loadProvidersFromChain()', err)
    }
  }

  /**
   *
   * @returns {Promise<IProviderIpSet>}
   * @protected
   */
  protected async getAllProviders (): Promise<IProviderIpSet> {
    try {
      const providers = await this.getAvailableProviders()
      // console.log(providers)
      return await this.findProviderIps(providers)
    } catch (err) {
      throw warnError('storageHandler getAllProviders()', err)
    }
  }

  /**
   *
   * @param {IWrappedEncodeObject[]} msgs
   * @param {number} uploadHeight
   * @returns {Promise<Promise<IProviderUploadResponse>[]>}
   * @protected
   */
  protected async batchUploads (
    msgs: IWrappedEncodeObject[],
    uploadHeight: number,
  ): Promise<Promise<IProviderUploadResponse>[]> {
    try {
      const activeUploads: Promise<IProviderUploadResponse>[] = []
      const uploader = new UploadHandler(this.providers, this.hostAddress)
      this.uploadsInProgress = true
      for (let i = 0; i < msgs.length; i++) {
        if (!msgs[i]) {
          warnError('storageHandler batchUploads()', `msg at ${i} is undefined`)
          continue
        }
        const { file, merkle } = msgs[i]
        if (!(file && merkle)) {
          continue
        }
        const { providerIps } = await this.jackalSigner.queries.storage.findFile({
          merkle: hexToBuffer(merkle),
        })
        const started = uploader.upload({ file, merkle, uploadHeight }, providerIps.length)
        activeUploads.push(started)

      }
      return activeUploads
    } catch (err) {
      throw warnError('storageHandler batchUploads()', err)
    }
  }

  /**
   *
   * @param {string} name
   * @returns {Promise<string>}
   * @protected
   */
  protected async possibleRnsToAddress (name: string): Promise<string> {
    try {
      if (this.rns) {
        return await this.rns.possibleRnsToJklAddress(name)
      } else {
        if (bech32.checkIfValid(name)) {
          return name
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
  protected async initUlidHome (): Promise<IWrappedEncodeObject[]> {
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
      msgs.push(...(await this.makeCreateBaseFolderMsgs('Shared')))
      return msgs
    } catch (err) {
      throw warnError('storageHandler initUlidHome()', err)
    }
  }

  /**
   *
   * @param {string} receiver
   * @param {number} gb
   * @param {number} days
   * @returns {IWrappedEncodeObject}
   * @protected
   */
  protected buyStoragePlan (
    receiver: string,
    referrer: string,
    gb: number,
    days: number,
  ): IWrappedEncodeObject {
    const durationDays = Number(days) > 30 ? Number(days) : 30
    const bytes = 3 * 1000000000 * (Number(gb) || 1)
    const toBuy: DMsgBuyStorage = {
      creator: this.jklAddress,
      forAddress: receiver,
      durationDays,
      bytes,
      paymentDenom: 'ujkl',
      referral: referrer,
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
  protected async makeCreateFolderMsgs (
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
   * @param {number} [count]
   * @returns {Promise<IWrappedEncodeObject[]>}
   * @protected
   */
  protected async makeCreateBaseFolderMsgs (
    name: string,
    count?: number,
  ): Promise<IWrappedEncodeObject[]> {
    try {
      const baseMeta = await FolderMetaHandler.create({
        count: count || 0,
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
  protected async prepDelete (target: string): Promise<IWrappedEncodeObject[]> {
    try {
      const msgs: IWrappedEncodeObject[] = []
      const ft = await this.reader.loadMetaByPath(target)
      if (ft.metaDataType === 'file') {
        const { files } =
          await this.jackalSigner.queries.storage.allFilesByMerkle({
            merkle: ft.merkleRoot,
          })
        if ((files as DUnifiedFile[]).length === 0) {
          console.warn('looks like we\'re deleting a dead file...')
          return msgs
        }
        const [details] = files
        try {
          const deletePkg = {
            creator: this.jklAddress,
            merkle: details.merkle,
            start: details.start,
          }
          const wrapped = this.fileDeleteToMsgs(deletePkg)
          msgs.push(...wrapped)
        } catch (err) {
          console.warn('looks like we\'re deleting a dead file...', err)
        }
      } else if (ft.metaDataType === 'folder') {
        const data = await this.reader.readFolderContents(target)
        for (let file of Object.values(data.files)) {
          const path = tidyString(`${target}/${file.fileMeta.name}`, '/')
          msgs.push(...(await this.prepDelete(path)))
        }
        for (let folder of Object.values(data.folders)) {
          const path = tidyString(`${target}/${folder.whoAmI}`, '/')
          msgs.push(...(await this.prepDelete(path)))
        }
      }
      const ulid = this.reader.ulidLookup(target)
      const ref = this.reader.findRefIndex(target)
      const pkg: IFileTreePackage = {
        meta: await NullMetaHandler.create({
          location: this.reader.ulidLookup(target.split('/').slice(0, -1).join('/')),
          refIndex: ref,
          ulid,
        }),
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
  protected beforeUnloadHandler (ev: BeforeUnloadEvent): void {
    if (this.uploadsInProgress) {
      ev.preventDefault()
      ev.returnValue = true
    }
  }

  /**
   *
   * @param {string} name
   * @returns {string}
   * @protected
   */
  protected assembleLocation (name: string): string {
    return `${this.readActivePath()}/${name}`
  }

  /**
   *
   * @param {File} toProcess
   * @param {number} duration
   * @returns {Promise<IUploadPackage>}
   * @protected
   */
  protected async processPrivate (
    toProcess: File,
    duration: number,
  ): Promise<IUploadPackage> {
    try {
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

      const thumbnail = await maybeMakeThumbnail(toProcess)

      const ulid = this.readCurrentUlid()
      console.log(ulid)
      const baseMeta = await FileMetaHandler.create({
        description: '',
        file,
        fileMeta,
        location: this.readCurrentUlid(),
        thumbnail,
      })
      return { file, meta: baseMeta, duration, aes }
    } catch (err) {
      throw warnError('storageHandler processPrivate()', err)
    }
  }

  /**
   *
   * @param {File} toProcess
   * @param {number} duration
   * @returns {Promise<IUploadPackage>}
   * @protected
   */
  protected async processPublic (
    toProcess: File,
    duration: number,
  ): Promise<IUploadPackage> {
    try {
      const fileMeta = extractFileMetaData(toProcess)
      const baseMeta = await FileMetaHandler.create({
        description: '',
        file: toProcess,
        fileMeta,
        location: this.readCurrentUlid(),
      })
      return { file: toProcess, meta: baseMeta, duration }
    } catch (err) {
      throw warnError('storageHandler processPublic()', err)
    }
  }

  /**
   *
   * @param {IChecks} checkSet
   * @returns {Promise<boolean>}
   * @protected
   */
  protected async checkLocked (checkSet: IChecks): Promise<boolean> {
    try {
      if (checkSet.bought) {
        const status = await this.planStatus()
        // TODO - add bought check
        if (!status.active) {
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
        const status = await this.jackalClient.myPubKeyIsPublished()
        if (!status) {
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
  protected async stageQueue (): Promise<void> {
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
  protected async buildConversion (
    path: string,
  ): Promise<null | IConversionFolderBundle> {
    try {
      const data = await this.reader.loadMetaByPath(path)
      if (data.metaDataType === undefined) {
        const meta = data as ILegacyFolderMetaData
        const msgs: IWrappedEncodeObject[] = []
        let ii = 0
        const parent = await FolderMetaHandler.create({
          count: 0,
          location: '',
          name: meta.whoAmI,
        })

        for (let dir of meta.dirChildren) {
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

        for (let fileMeta of Object.values(meta.fileChildren)) {
          ii++
          const meta = await this.reader.loadFromLegacyMerkles(
            path,
            parent.getUlid(),
            fileMeta,
          )
          const aes = await this.reader.loadKeysByPath(path, this.hostAddress)
          const pkg: IUploadPackage = {
            file: new File([], ''),
            meta,
            duration: 0,
            aes,
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
