import { EncodeObject } from '@cosmjs/proto-signing'
import { hashAndHex, merkleMeBro } from '@/utils/hash'
import { genIv, genKey, stringToAes } from '@/utils/crypt'
import {
  bruteForceString,
  getFileTreeData,
  getRandomIndex,
  handlePagination,
  setDelay,
  signerNotEnabled,
  stripper
} from '@/utils/misc'
import FileDownloadHandler from '@/classes/fileDownloadHandler'
import FolderHandler from '@/classes/folderHandler'
import {
  IFileDownloadHandler,
  IFileIo,
  IFileUploadHandler,
  IFolderHandler,
  IQueryHandler,
  IWalletHandler
} from '@/interfaces/classes'
import {
  IChildDirInfo,
  IDownloadDetails,
  IFileConfigRaw,
  IFiletreeParsedContents,
  IFolderFrame,
  IMiner,
  IMsgPartialPostFileBundle,
  IProviderModifiedResponse,
  IProviderResponse,
  IProviderVersionResponse,
  IQueueItemPostUpload,
  IStaggeredTracker,
  IUploadList,
  IUploadListItem
} from '@/interfaces'
import IProviderChecks from '@/interfaces/IProviderChecks'
import {
  Contracts,
  FidCid,
  Files,
  QueryFindFileResponse,
  Strays
} from '@jackallabs/jackal.js-protos'
import {
  buildPostFile,
  makePermsBlock,
  readFileTreeEntry,
  removeFileTreeEntry
} from '@/utils/compression'
import IFileMetaHashMap from '@/interfaces/file/IFileMetaHashMap'
import { PublicFileDownloadHandler } from '@/classes/publicFileDownloadHandler'

export default class FileIo implements IFileIo {
  private readonly walletRef: IWalletHandler
  private readonly qH: IQueryHandler
  private availableProviders: IMiner[]
  private currentProvider: IMiner

  /**
   * Receives properties from trackIo() to instantiate FileIo.
   * @param {IWalletHandler} wallet - WalletHandler instance for QueryHandler and ProtoHandler management.
   * @param {IMiner[]} providers - Array of filtered Provider details to cycle through for uploads.
   * @param {IMiner} currentProvider - Starting active upload Provider.
   * @private
   */
  private constructor(
    wallet: IWalletHandler,
    providers: IMiner[],
    currentProvider: IMiner
  ) {
    this.walletRef = wallet
    this.qH = wallet.getQueryHandler()
    this.availableProviders = providers
    this.currentProvider = currentProvider
  }

  /**
   * Creates FileIo instance.
   * @param {IWalletHandler} wallet - WalletHandler instance.
   * @param {string | string[]} versionFilter - Optional minimum chain version flag. Blocks all Providers if undefined. (Optional)
   * @returns {Promise<FileIo>}
   */
  static async trackIo(
    wallet: IWalletHandler,
    versionFilter?: string | string[]
  ): Promise<FileIo> {
    if (!wallet.traits) throw new Error(signerNotEnabled('FileIo', 'trackIo'))
    const providers = await verifyProviders(
      await getProviders(wallet.getProtoHandler()),
      wallet.traits.chainId,
      versionFilter
    )
    // const provider = providers[await random(providers.length)]
    const provider = providers[getRandomIndex(providers.length)]
    return new FileIo(wallet, providers, provider)
  }

  /**
   * Fetches and categorizes all providers registered to network.
   * @param {IWalletHandler} wallet - WalletHandler instance.
   * @param {string | string[]} versionFilter - Optional minimum chain version flag. Blocks all Providers if undefined. (Optional)
   * @returns {Promise<IProviderChecks>}
   */
  static async checkProviders(
    wallet: IWalletHandler,
    versionFilter?: string | string[]
  ): Promise<IProviderChecks> {
    if (!wallet.traits)
      throw new Error(signerNotEnabled('FileIo', 'checkProviders'))
    const raw = await fetchProviders(wallet.getQueryHandler())
    const filtered = await filterProviders(raw)
    return {
      filtered,
      raw,
      verified: versionFilter
        ? await verifyProviders(filtered, wallet.traits.chainId, versionFilter)
        : filtered
    }
  }

  /**
   * Expose active Provider for uploads.
   * @returns {IMiner}
   */
  getCurrentProvider(): IMiner {
    return this.currentProvider
  }

  /**
   * Expose all active Providers available for uploads.
   * @returns {IMiner[]}
   */
  getAvailableProviders(): IMiner[] {
    return this.availableProviders
  }

  /**
   * Set active Provider for uploads.
   * @param {IMiner} toSet
   */
  forceProvider(toSet: IMiner): void {
    this.currentProvider = toSet
  }

  /**
   * Remove problem Provider from list and select new active Provider.
   * @param {string} exclude - Provider address to exclude.
   * @returns {Promise<void>}
   */
  async clearProblems(exclude: string): Promise<void> {
    this.availableProviders = this.availableProviders.filter(
      (prov) => prov.ip !== exclude
    )
    await this.shuffle()
  }

  /**
   * Randomly selects new active Provider from list of active Providers available for uploads.
   * @returns {Promise<void>}
   */
  async shuffle(): Promise<void> {
    this.currentProvider =
      this.availableProviders[getRandomIndex(this.availableProviders.length)]
  }

  /**
   * Re-queries network for Providers and randomly selects new active Provider.
   * @returns {Promise<void>}
   */
  async refresh(): Promise<void> {
    if (!this.walletRef.traits)
      throw new Error(signerNotEnabled('FileIo', 'refresh'))
    this.availableProviders = await verifyProviders(
      await getProviders(this.qH),
      this.walletRef.traits.chainId
    )
    this.currentProvider =
      this.availableProviders[getRandomIndex(this.availableProviders.length)]
  }

  /**
   * Converts File-based folder(s) to FileTree-based folder(s).
   * @param {string[]} toCheck - Folder paths (without s/) to check and convert.
   * @returns {Promise<void>}
   */
  async migrate(toCheck: string[]): Promise<void> {
    if (!this.walletRef.traits)
      throw new Error(signerNotEnabled('FileIo', 'migrate'))
    const owner = this.walletRef.getJackalAddress()
    const toMigrate = []
    const toCreate = []
    for (let name of toCheck) {
      const data = await readFileTreeEntry(
        owner,
        `s/${name}`,
        this.walletRef,
        true
      ).catch((err: Error) => {
        throw err
      })
      if (data.fids) {
        toMigrate.push(`s/${name}`)
      } else if (Object.keys(data).length === 0) {
        toCreate.push(name)
      } else {
        /* All Good */
      }
    }
    const readyToBroadcast: EncodeObject[] = []
    if (toCreate.length > 0) {
      readyToBroadcast.push(
        ...(await this.rawGenerateInitialDirs(null, toCreate))
      )
    }
    for (let path of toMigrate) {
      readyToBroadcast.push(...(await this.rawConvertFolderType(path)))
    }
    if (readyToBroadcast.length > 0) {
      const memo = ``
      await this.walletRef
        .getProtoHandler()
        .debugBroadcaster(readyToBroadcast, { memo, step: false })
    }
  }

  /**
   * Create new Subfolder(s) with single shared parent Folder. Wrapper for rawCreateFolders().
   * @param {IFolderHandler} parentDir - Parent Folder instance.
   * @param {string[]} newDirs - Name(s) of Subfolder(s) to create.
   * @returns {Promise<void>}
   */
  async createFolders(
    parentDir: IFolderHandler,
    newDirs: string[]
  ): Promise<void> {
    if (!this.walletRef.traits)
      throw new Error(signerNotEnabled('FileIo', 'createFolders'))
    const pH = this.walletRef.getProtoHandler()
    const readyToBroadcast = await this.rawCreateFolders(parentDir, newDirs)
    const memo = ``
    await pH.debugBroadcaster(readyToBroadcast, { memo, step: false })
  }

  /**
   * Creates and returns FileTree EncodeObject instances for external consumption by a signAndBroadcast.
   * @param {IFolderHandler} parentDir - Parent Folder instance.
   * @param {string[]} newDirs - Name(s) of Subfolder(s) to create.
   * @returns {Promise<EncodeObject[]>}
   */
  async rawCreateFolders(
    parentDir: IFolderHandler,
    newDirs: string[]
  ): Promise<EncodeObject[]> {
    if (!this.walletRef.traits)
      throw new Error(signerNotEnabled('FileIo', 'rawCreateFolders'))
    const result = await parentDir.addChildDirs(newDirs, this.walletRef)
    if (result.existing.length > 0) {
      console.log(
        'The following duplicate folder names were ignored: ',
        result.existing
      )
    }
    return result.encoded
  }

  /**
   * Check if base Folders exist and create if not found.
   * @param {string[]} toCheck - Name(s) of base Folder(s) to check.
   * @returns {Promise<number>}
   */
  async verifyFoldersExist(toCheck: string[]): Promise<number> {
    if (!this.walletRef.traits)
      throw new Error(signerNotEnabled('FileIo', 'verifyFoldersExist'))
    const toCreate = []
    const owner = this.walletRef.getJackalAddress()
    for (let i = 0; i < toCheck.length; i++) {
      const check = await readFileTreeEntry(
        owner,
        `s/${toCheck[i]}`,
        this.walletRef,
        true
      ).catch((err: Error) => {
        console.warn(`verifyFoldersExist() s/${toCheck[i]}`, err)
        throw err
      })
      if (Object.keys(check).length > 0) {
        console.info(`${toCheck[i]} exists`)
      } else {
        console.warn(`${toCheck[i]} does not exist`)
        toCreate.push(toCheck[i])
      }
    }
    if (toCreate.length) {
      console.log('Creating: ', toCreate)
      await this.generateInitialDirs(null, toCreate)
    }
    return toCreate.length
  }

  /**
   * Uploads file(s) and queues successes into batches for wallet prompts.
   * @param {IUploadList} sourceHashMap - Map of all files, key is file name.
   * @param {IFolderHandler} parent - Folder the files are being uploaded to.
   * @param {IStaggeredTracker} tracker - External access to completion progress. Not yet implemented.
   * @returns {Promise<void>}
   */
  async staggeredUploadFiles(
    sourceHashMap: IUploadList,
    parent: IFolderHandler,
    tracker: IStaggeredTracker
  ): Promise<void> {
    if (!this.walletRef.traits)
      throw new Error(signerNotEnabled('FileIo', 'staggeredUploadFiles'))
    const pH = this.walletRef.getProtoHandler()
    const sourceKeys = Object.keys(sourceHashMap)
    const jackalAddr = this.walletRef.getJackalAddress()
    let queueHashMap: { [key: string]: boolean } = {}
    for (let key of sourceKeys) {
      queueHashMap[key] = false
    }
    await Promise.any(
      Object.values(sourceHashMap).map(async (bundle: IUploadListItem) => {
        const { exists, handler, key, uploadable } = bundle
        const existing = exists
          ? await prepExistingUpload(handler, jackalAddr, this.walletRef).catch(
              (err) => {
                console.warn('prepExistingUpload() Failed')
                console.error(err)
                throw err
              }
            )
          : { cfg: null, file: null }
        bundle.data = existing.cfg
        const prom = await this.tumbleUpload(
          jackalAddr,
          existing.file || uploadable
        ).catch((err) => {
          console.warn('tumbleUpload() Failed')
          console.error(err)
          throw err
        })
        handler.setIds(prom)
        sourceHashMap[key].handler = handler
        queueHashMap[key] = true
        tracker.complete++
        return 'Done'
      })
    ).catch((err) => {
      console.warn('All Uploads Failed')
      console.error(err)
      alert('All Uploads Failed')
    })
    do {
      await statusCheck(sourceKeys.length, tracker)
      const processingNames: any[] = Object.keys(queueHashMap).filter(
        (name) => queueHashMap[name]
      )
      const processValues = processingNames.map((name) => sourceHashMap[name])
      if (processingNames.length === 0) {
        // do nothing
      } else {
        const fileNames = processValues.reduce((acc, curr) => {
          acc[curr.handler.getWhoAmI()] = curr.handler.getMeta()
          return acc
        }, {} as IFileMetaHashMap)
        const readyToBroadcast = await this.rawAfterUpload(processValues)
        readyToBroadcast.push(
          await parent.addChildFileReferences(fileNames, this.walletRef)
        )
        const tmp = readyToBroadcast[1]
        // tmp.value.payOnce = true
        const memo = ``
        await pH
          .debugBroadcaster([tmp], { memo, step: true })
          .catch((err) => {
            throw err
          })
        for (let key of processingNames) {
          delete queueHashMap[key]
        }
      }
    } while (Object.keys(queueHashMap).length > 0)
  }

  /**
   * Saves completed uploads to FileTree.
   * @param {IQueueItemPostUpload[]} ids - Bundle(s) of details on uploaded file(s).
   * @returns {Promise<EncodeObject[]>}
   * @private
   */
  private async rawAfterUpload(
    ids: IQueueItemPostUpload[]
  ): Promise<EncodeObject[]> {
    if (!this.walletRef.traits)
      throw new Error(signerNotEnabled('FileIo', 'rawAfterUpload'))
    const pH = this.walletRef.getProtoHandler()
    const creator = this.walletRef.getJackalAddress()
    const needingReset: EncodeObject[] = []
    const ready = await Promise.all(
      ids.flatMap(async (item: IQueueItemPostUpload) => {
        const { cid, fid } = item.handler.getIds()
        const common = {
          aes: await item.handler.getEnc(),
          num: crypto.randomUUID(),
          pubKey: this.walletRef.getPubkey(),
          usr: this.walletRef.getJackalAddress()
        }

        const msgPostFileBundle: IMsgPartialPostFileBundle = {
          creator,
          account: await hashAndHex(creator),
          hashParent: await item.handler.getMerklePath(),
          hashChild: await hashAndHex(item.handler.getWhoAmI()),
          contents: JSON.stringify({ fids: fid }),
          viewers: JSON.stringify(
            await makePermsBlock({ base: 'v', ...common }, this.walletRef)
          ),
          editors: JSON.stringify(
            await makePermsBlock({ base: 'e', ...common }, this.walletRef)
          ),
          trackingNumber: common.num
        }
        if (item.data) {
          msgPostFileBundle.viewers = item.data.viewingAccess
          msgPostFileBundle.editors = item.data.editAccess
          msgPostFileBundle.trackingNumber = item.data.trackingNumber
          const delItem = await this.makeDelete(creator, [
            `${item.handler.getWhereAmI()}/${item.handler.getWhoAmI()}`
          ])
          needingReset.push(...delItem)
        }
        const msgPost: EncodeObject = await buildPostFile(msgPostFileBundle, pH)
        const msgSign: EncodeObject = pH.storageTx.msgSignContract({
          creator,
          cid,
          payOnce: false
        })
        return [msgPost, msgSign]
      })
    )
    ready.unshift(ready.pop() as EncodeObject[])
    return [...needingReset, ...ready.flat()]
  }

  /**
   * Fetches FileTree data for target Folder and creates Handler instance.
   * @param {string} rawPath - Full path to Folder. Example: s/Home/Pictures.
   * @returns {Promise<IFolderHandler>}
   */
  async downloadFolder(rawPath: string): Promise<IFolderHandler> {
    if (!this.walletRef.traits)
      throw new Error(signerNotEnabled('FileIo', 'downloadFolder'))
    const owner = this.walletRef.getJackalAddress()
    const data = await readFileTreeEntry(
      owner,
      rawPath,
      this.walletRef,
      true
    ).catch((err: Error) => {
      throw err
    })

    if (data.fids) {
      const legacyBundle: IDownloadDetails = {
        rawPath,
        owner,
        isFolder: true
      }
      const legacyHandler = await this.downloadFile(legacyBundle, {
        track: 0
      }).catch((err: Error) => {
        console.error('downloadFolder() : ', err)
      })
      return legacyHandler as IFolderHandler
    } else if (Object.keys(data).length === 0) {
      console.warn('Folder recovery failed. Rebuilding ', rawPath)
      const parts = rawPath.split('/')
      const child = parts.pop() as string
      const folderDetails: IChildDirInfo = {
        myName: child,
        myParent: parts.join('/'),
        myOwner: owner
      }
      return await FolderHandler.trackNewFolder(folderDetails)
    } else {
      return await FolderHandler.trackFolder(data as IFolderFrame)
    }
  }

  /**
   * Download File. Can also download legacy Folder-files.
   * @param {IDownloadDetails} downloadDetails - Details needed to find file.
   * @param {{track: number}} completion - External access to download progress.
   * @returns {Promise<IFileDownloadHandler | IFolderHandler>}
   */
  async downloadFile(
    downloadDetails: IDownloadDetails,
    completion: { track: number }
  ): Promise<IFileDownloadHandler | IFolderHandler> {
    if (!this.walletRef.traits)
      throw new Error(signerNotEnabled('FileIo', 'downloadFile'))
    const { rawPath, owner, isFolder } = downloadDetails
    const {
      success,
      value: { files }
    } = await getFileTreeData(rawPath, owner, this.qH)
    if (!success) throw new Error('No Existing File')
    const { contents, editAccess, viewingAccess, trackingNumber } =
      files as Files
    let parsedContents: IFiletreeParsedContents
    try {
      parsedContents = JSON.parse(contents)
    } catch (err) {
      console.warn('downloadFile() : ', rawPath)
      console.error(err)
      alert(err)
      parsedContents = { fids: [] }
    }
    const fid = parsedContents.fids[0]
    const fileProviders = verifyFileProviderIps(
      (await this.qH.storageQuery.queryFindFile({ fid })).value
    )
    if (fileProviders && fileProviders.length) {
      const config = {
        editAccess: JSON.parse(editAccess),
        viewingAccess: JSON.parse(viewingAccess),
        trackingNumber: trackingNumber
      }
      const requester = await hashAndHex(
        `v${trackingNumber}${this.walletRef.getJackalAddress()}`
      )
      for (let i = 0; i < fileProviders.length; i++) {
        const url = `${fileProviders[i].replace(/\/+$/, '')}/download/${fid}`
        try {
          const resp = await fetch(url)
          const contentLength = resp.headers.get('Content-Length')
          if (!resp.body) throw new Error()
          const reader = resp.body.getReader()
          let receivedLength = 0
          let chunks = []
          while (true) {
            const { done, value } = await reader.read()
            if (done) {
              break
            }
            chunks.push(value)
            receivedLength += value.length
            completion.track =
              Math.floor((receivedLength / Number(contentLength)) * 100) || 1
          }
          const rawFile = new Blob(chunks)
          const { key, iv } = await stringToAes(
            this.walletRef,
            config.viewingAccess[requester]
          )
          if (isFolder) {
            return await FolderHandler.trackLegacyFolder(rawFile, key, iv)
          } else {
            return await FileDownloadHandler.trackFile(rawFile, key, iv)
          }
        } catch (err) {
          const attempt = i + 1
          const remaining = fileProviders.length - attempt
          console.warn(
            `File fetch() failed. Attempt #${attempt}. ${remaining} attempts remaining`
          )
          console.error(err)
          console.warn(`Bad file provider url: ${url}`)
        }
      }
      throw new Error('All file fetch() attempts failed!')
    } else {
      if (isFolder) {
        console.warn(`Critical folder recovery failure. Rebuilding: ${rawPath}`)
        const pathArray = rawPath.split('/')
        const myName = pathArray.pop() || ''
        return await FolderHandler.trackNewFolder({
          myName,
          myParent: pathArray.join('/'),
          myOwner: owner
        })
      } else {
        throw new Error('No available providers!')
      }
    }
  }

  /**
   * Locate and download file using unique FID.
   * @param {string} fid - FID for target File.
   * @param {{track: number}} completion - External access to download progress.
   * @returns {Promise<IFileDownloadHandler>}
   */
  async downloadFileByFid(
    fid: string,
    completion: { track: number }
  ): Promise<IFileDownloadHandler> {
    if (!this.walletRef.traits)
      throw new Error(signerNotEnabled('FileIo', 'downloadFileByFid'))
    const fileProviders = verifyFileProviderIps(
      (await this.qH.storageQuery.queryFindFile({ fid })).value
    )
    if (fileProviders && fileProviders.length) {
      for (let i = 0; i < fileProviders.length; i++) {
        const url = `${fileProviders[i].replace(/\/+$/, '')}/download/${fid}`
        try {
          const resp = await fetch(url)
          const contentLength = resp.headers.get('Content-Length')
          if (!resp.body) throw new Error()
          const reader = resp.body.getReader()
          let receivedLength = 0
          let chunks = []
          while (true) {
            const { done, value } = await reader.read()
            if (done) {
              break
            }
            chunks.push(value)
            receivedLength += value.length
            completion.track =
              Math.floor((receivedLength / Number(contentLength)) * 100) || 1
          }
          const rawFile = new Blob(chunks)
          return await PublicFileDownloadHandler.trackFile(rawFile)
        } catch (err) {
          const attempt = i + 1
          const remaining = fileProviders.length - attempt
          console.warn(
            `File fetch() failed. Attempt #${attempt}. ${remaining} attempts remaining`
          )
          console.error(err)
          console.warn(`Bad file provider url: ${url}`)
        }
      }
      throw new Error('All file fetch() attempts failed!')
    } else {
      throw new Error('No available providers!')
    }
  }

  /**
   * Full wipe of user's s/Home directory and contents. Does NOT reset files or folders outside that tree.
   * @returns {Promise<void>}
   */
  async deleteHome(): Promise<void> {
    if (!this.walletRef.traits)
      throw new Error(signerNotEnabled('FileIo', 'deleteHome'))
    const pH = this.walletRef.getProtoHandler()
    let parent
    try {
      parent = await this.downloadFolder(`s/Home`)
    } catch (err) {
      console.error(err)
      console.warn('Override engaged')
      parent = await FolderHandler.trackNewFolder({
        myName: '',
        myParent: '',
        myOwner: ''
      })
    }
    const moreTargets = [
      ...new Set([
        ...(parent.getChildDirs() || []),
        ...Object.keys(parent.getChildFiles() || {})
      ])
    ]
    const readyToBroadcast = await this.rawDeleteTargets(moreTargets, parent)
    readyToBroadcast.push(
      ...(await this.makeDelete(this.walletRef.getJackalAddress(), [`s/Home`]))
    )
    const memo = ``
    await pH.debugBroadcaster(readyToBroadcast, { memo, step: false })
  }

  /**
   * Deletes target Folder(s) and sub folders/files. Wraps rawDeleteTargets().
   * @param {string[]} targets - Target Folder(s) and/or files and children.
   * @param {IFolderHandler} parent - Parent Folder that is NOT being deleted.
   * @returns {Promise<void>}
   */
  async deleteTargets(
    targets: string[],
    parent: IFolderHandler
  ): Promise<void> {
    if (!this.walletRef.traits)
      throw new Error(signerNotEnabled('FileIo', 'deleteTargets'))
    const pH = this.walletRef.getProtoHandler()
    const readyToBroadcast = await this.rawDeleteTargets(targets, parent)
    const existingDirs = parent.getChildDirs()
    const existingFiles = parent.getChildFiles()
    const dirs = targets.filter((target) => existingDirs.includes(target))
    const files = targets.filter((target) =>
      Object.keys(existingFiles).includes(target)
    )
    readyToBroadcast.push(
      await parent.removeChildDirAndFileReferences(dirs, files, this.walletRef)
    )
    const memo = ``
    await pH.debugBroadcaster(readyToBroadcast, { memo, step: false })
  }

  /**
   * Creates and returns FileTree and Storage EncodeObject instances for external consumption by a signAndBroadcast.
   * @param {string[]} targets - Target Folder(s) and/or files and children.
   * @param {IFolderHandler} parent - Parent Folder that is NOT being deleted.
   * @returns {Promise<EncodeObject[]>}
   */
  async rawDeleteTargets(
    targets: string[],
    parent: IFolderHandler
  ): Promise<EncodeObject[]> {
    if (!this.walletRef.traits)
      throw new Error(signerNotEnabled('FileIo', 'rawDeleteTargets'))
    const existingDirs = parent.getChildDirs()
    const existingFiles = parent.getChildFiles()
    const dirs = targets.filter((target) => existingDirs.includes(target))
    const files = targets.filter((target) =>
      Object.keys(existingFiles).includes(target)
    )
    const location = `${parent.getWhereAmI()}/${parent.getWhoAmI()}`
    const encoded: EncodeObject[] = []
    await Promise.all(
      dirs.map(async (name) => {
        const rawPath = `${location}/${name}`
        if (await this.checkFolderIsFileTree(rawPath).catch(() => true)) {
          encoded.push(await removeFileTreeEntry(rawPath, this.walletRef))
        } else {
          encoded.push(
            ...(await this.makeDelete(this.walletRef.getJackalAddress(), [
              rawPath
            ]))
          )
        }
      })
    )
    await Promise.all(
      files.map(async (name) => {
        encoded.push(
          ...(await this.makeDelete(this.walletRef.getJackalAddress(), [
            `${location}/${name}`
          ]))
        )
      })
    )
    for (let dir of dirs) {
      const folder = await this.downloadFolder(`${location}/${dir}`)
      const moreTargets = [
        ...new Set([
          ...folder.getChildDirs(),
          ...Object.keys(folder.getChildFiles())
        ])
      ]
      encoded.push(...(await this.rawDeleteTargets(moreTargets, folder)))
    }
    return encoded
  }

  /**
   * Creates target base Folders and inits storage if provided. Wraps rawGenerateInitialDirs().
   * @param {EncodeObject | null} initMsg - Msg to init storage if needed.
   * @param {string[]} startingDirs - Base Folders to create. (Optional)
   * @returns {Promise<void>}
   */
  async generateInitialDirs(
    initMsg: EncodeObject | null,
    startingDirs?: string[]
  ): Promise<void> {
    if (!this.walletRef.traits)
      throw new Error(signerNotEnabled('FileIo', 'generateInitialDirs'))
    const pH = this.walletRef.getProtoHandler()
    const readyToBroadcast = await this.rawGenerateInitialDirs(
      initMsg,
      startingDirs
    )
    const memo = ``
    await pH
      .debugBroadcaster(readyToBroadcast, { memo, step: false })
      .catch((err) => {
        console.error('generateInitialDirs() -', err)
      })
  }

  /**
   * Creates and returns FileTree EncodeObject instances for external consumption by a signAndBroadcast.
   * @param {EncodeObject | null} initMsg - Msg to init storage if needed.
   * @param {string[]} startingDirs - Base Folders to create. (Optional)
   * @returns {Promise<EncodeObject[]>}
   */
  async rawGenerateInitialDirs(
    initMsg: EncodeObject | null,
    startingDirs?: string[]
  ): Promise<EncodeObject[]> {
    if (!this.walletRef.traits)
      throw new Error(signerNotEnabled('FileIo', 'rawGenerateInitialDirs'))
    const toGenerate = startingDirs || ['Config', 'Home', 'WWW']
    const creator = this.walletRef.getJackalAddress()
    const dirMsgs: EncodeObject[] = await Promise.all(
      toGenerate.map(async (pathName: string) => {
        return await this.createFileTreeFolderMsg(pathName, 's', creator)
      })
    )
    const readyToBroadcast: EncodeObject[] = []
    if (initMsg) {
      readyToBroadcast.push(initMsg)
    }
    readyToBroadcast.push(await this.createRoot(), ...dirMsgs)
    return readyToBroadcast
  }

  /**
   * Converts File-based Folders to FileTree-based Folders. Wraps rawConvertFolderType().
   * @param {string} rawPath - Full path to the target Folder.
   * @returns {Promise<IFolderHandler>}
   */
  async convertFolderType(rawPath: string): Promise<IFolderHandler> {
    if (!this.walletRef.traits)
      throw new Error(signerNotEnabled('FileIo', 'convertFolderType'))
    const pH = this.walletRef.getProtoHandler()
    const readyToBroadcast = await this.rawConvertFolderType(rawPath)
    const memo = ``
    await pH
      .debugBroadcaster(readyToBroadcast, { memo, step: false })
      .catch((err) => {
        console.error('convertFolderType() -', err)
      })
    return await this.downloadFolder(rawPath)
  }

  /**
   * Creates and returns FileTree and Storage EncodeObject instances for external consumption by a signAndBroadcast.
   * @param {string} rawPath - Full path to the target Folder.
   * @returns {Promise<EncodeObject[]>}
   */
  async rawConvertFolderType(rawPath: string): Promise<EncodeObject[]> {
    if (!this.walletRef.traits)
      throw new Error(signerNotEnabled('FileIo', 'rawConvertFolderType'))
    const base = await this.downloadFolder(rawPath)
    const encoded: EncodeObject[] = []
    if (await this.checkFolderIsFileTree(rawPath)) {
      // do nothing
    } else {
      encoded.push(
        ...(await this.makeDelete(this.walletRef.getJackalAddress(), [
          base.getMyPath()
        ]))
      )
    }
    encoded.push(await base.getForFiletree(this.walletRef))
    for (let dir of base.getChildDirs()) {
      encoded.push(
        ...(await this.rawConvertFolderType(base.getMyChildPath(dir)))
      )
    }
    return encoded
  }

  /**
   * Determine if a Folder is File or FileTree based.
   * @param {string} rawPath - Full path to the target Folder.
   * @returns {Promise<IFolderHandler | null>} - Returns FolderHandler instance if Folder is FileTree-based.
   */
  async checkFolderIsFileTree(rawPath: string): Promise<IFolderHandler | null> {
    if (!this.walletRef.traits)
      throw new Error(signerNotEnabled('FileIo', 'checkFolderIsFileTree'))
    const owner = this.walletRef.getJackalAddress()
    try {
      const data = await readFileTreeEntry(
        owner,
        rawPath,
        this.walletRef,
        true
      ).catch((err: Error) => {
        throw err
      })
      return await FolderHandler.trackFolder(data as IFolderFrame).catch(
        (err: Error) => {
          console.error(err)
          return FolderHandler.trackNewFolder({
            myName: '',
            myParent: '',
            myOwner: ''
          })
        }
      )
    } catch (err) {
      console.warn('checkFolderIsFileTree()', err)
      return null
    }
  }

  /**
   * Generate FolderHandler for target new folder. Used by rawGenerateInitialDirs().
   * @param {string} pathName - Name of Folder.
   * @param {string} parentPath - Full path to parent Folder.
   * @param {string} creator - Bech32 address of owner.
   * @returns {Promise<EncodeObject>}
   * @private
   */
  private async createFileTreeFolderMsg(
    pathName: string,
    parentPath: string,
    creator: string
  ) {
    if (!this.walletRef.traits)
      throw new Error(signerNotEnabled('FileIo', 'createFileTreeFolderMsg'))
    const folderDetails: IChildDirInfo = {
      myName: stripper(pathName),
      myParent: parentPath,
      myOwner: creator
    }
    const handler = await FolderHandler.trackNewFolder(folderDetails)
    return await handler.getForFiletree(this.walletRef)
  }

  /**
   * Creates and returns FileTree and Storage EncodeObject instances for external consumption by a signAndBroadcast.
   * @param {string} creator - Bech32 address of owner.
   * @param {string[]} targets - Full path to deletion target.
   * @returns {Promise<EncodeObject[]>}
   * @private
   */
  private async makeDelete(
    creator: string,
    targets: string[]
  ): Promise<EncodeObject[]> {
    if (!this.walletRef.traits)
      throw new Error(signerNotEnabled('FileIo', 'makeDelete'))
    const pH = this.walletRef.getProtoHandler()
    const readyToDelete: EncodeObject[][] = await Promise.all(
      targets.map(async (rawPath: string) => {
        const fileTreeResult = (
          await getFileTreeData(rawPath, creator, this.qH)
        ).value.files as Files
        let fids
        try {
          fids = JSON.parse(fileTreeResult.contents).fids
        } catch (err) {
          console.error(`[FileIo] makeDelete()`)
          console.error(err)
          console.warn('Proceeding...')
          fids = []
        }
        const { cids } = (
          await this.qH.storageQuery.queryFidCid({ fid: fids[0] })
        ).value.fidCid as FidCid
        const linkedCids = JSON.parse(cids)
        const toRemove: string[] = await Promise.all(
          linkedCids.filter(async (cid: string) => {
            return await matchOwnerToCid(this.qH, cid, creator)
          })
        )
        const cancelContractsMsgs: EncodeObject[] = toRemove.map(
          (cid: string) => pH.storageTx.msgCancelContract({ creator, cid })
        )
        const msgDelFile = pH.fileTreeTx.msgDeleteFile({
          creator,
          hashPath: await merkleMeBro(rawPath),
          account: await hashAndHex(creator)
        })
        return [...cancelContractsMsgs, msgDelFile]
      })
    )
    return readyToDelete.flat()
  }

  /**
   * Upload Files via Fetch and gracefully rollover to next provider if upload fails.
   * @param {string} sender - Bech32 address of owner.
   * @param {File} file - File to upload.
   * @returns {Promise<IProviderModifiedResponse>}
   * @private
   */
  private async tumbleUpload(
    sender: string,
    file: File
  ): Promise<IProviderModifiedResponse> {
    if (!this.walletRef.traits)
      throw new Error(signerNotEnabled('FileIo', 'tumbleUpload'))
    while (this.availableProviders.length > 0) {
      const { ip } = this.currentProvider
      console.log('Current Provider:', ip)
      const url = `${ip.replace(/\/+$/, '')}/upload`
      try {
        return await doUpload(url, sender, file)
      } catch (err) {
        console.warn(err)
        await this.clearProblems(ip)
        continue
      }
    }
    console.log('Provider Options Exhausted')
    return { fid: [''], cid: '' }
  }

  /**
   * Create s/.
   * @returns {Promise<EncodeObject>}
   * @private
   */
  private async createRoot() {
    if (!this.walletRef.traits)
      throw new Error(signerNotEnabled('FileIo', 'createRoot'))
    const pH = this.walletRef.getProtoHandler()
    const common = {
      aes: {
        iv: genIv(),
        key: await genKey()
      },
      num: crypto.randomUUID(),
      pubKey: this.walletRef.getPubkey(),
      usr: this.walletRef.getJackalAddress()
    }
    return pH.fileTreeTx.msgMakeRootV2({
      creator: this.walletRef.getJackalAddress(),
      editors: JSON.stringify(
        await makePermsBlock({ base: 'e', ...common }, this.walletRef)
      ),
      viewers: JSON.stringify(
        await makePermsBlock({ base: 'v', ...common }, this.walletRef)
      ),
      trackingNumber: common.num
    })
  }
}

/** Helpers */
/**
 * Check if File exists on chain and fetch details if so.
 * @param {IFileUploadHandler} data - File to check
 * @param {string} ownerAddr - Bech32 address of owner.
 * @param {IWalletHandler} walletRef - WalletHandler instance.
 * @returns {Promise<{file: File, cfg: IFileConfigRaw}>}
 * @private
 */
async function prepExistingUpload(
  data: IFileUploadHandler,
  ownerAddr: string,
  walletRef: IWalletHandler
): Promise<{ file: File; cfg: IFileConfigRaw }> {
  const hexedOwner = await hashAndHex(
    `o${await data.getFullMerkle()}${await hashAndHex(ownerAddr)}`
  )
  const fileChainResult = await getFileTreeData(
    await data.getFullMerkle(),
    hexedOwner,
    walletRef.getQueryHandler()
  )
  const typedData = fileChainResult.value.files as Files

  const editPool = JSON.parse(typedData.editAccess)
  const editor = await hashAndHex(
    `e${typedData.trackingNumber}${walletRef.getJackalAddress()}`
  )
  const editorKeys = editPool[editor]

  return {
    cfg: typedData,
    file: await data.getForUpload(await stringToAes(walletRef, editorKeys))
  }
}

/**
 * Process upload to Provider via Fetch.
 * @param {string} url - URL of Provider to upload to.
 * @param {string} sender - Bech32 address of owner.
 * @param {File} file - File to upload.
 * @returns {Promise<IProviderModifiedResponse>}
 * @private
 */
async function doUpload(
  url: string,
  sender: string,
  file: File
): Promise<IProviderModifiedResponse> {
  const fileFormData = new FormData()
  fileFormData.set('file', file)
  fileFormData.set('sender', sender)
  return await fetch(url, { method: 'POST', body: fileFormData as FormData })
    .then((resp): Promise<IProviderResponse> => {
      if (resp.status !== 200)
        throw new Error(`Status Message: ${resp.statusText}`)
      return resp.json()
    })
    .then((resp) => {
      return { fid: [resp.fid], cid: resp.cid }
    })
    .catch((err) => {
      throw err
    })
}

/**
 * Query for list of all usable Providers.
 * @param {IQueryHandler} qH - QueryHandler instance.
 * @param {number} max - Maximum number of Providers to return.
 * @returns {Promise<IMiner[]>}
 * @private
 */
async function getProviders(
  qH: IQueryHandler,
  max?: number
): Promise<IMiner[]> {
  const rawProviderList = await fetchProviders(qH)
  console.info('Raw Providers')
  console.dir(rawProviderList)
  return filterProviders(rawProviderList, max)
}

/**
 * Query for list of all registered Providers.
 * @param {IQueryHandler} qH - QueryHandler instance.
 * @returns {Promise<IMiner[]>}
 * @private
 */
async function fetchProviders(qH: IQueryHandler): Promise<IMiner[]> {
  return (
    await handlePagination(qH.storageQuery, 'queryProvidersAll', {})
  ).reduce((acc: IMiner[], curr: any) => {
    acc.push(...curr.providers)
    return acc
  }, [])
}

/**
 * Filters array of Providers to remove invalid addresses.
 * @param {IMiner[]} rawProviderList - Array from providers to filter.
 * @param {number} max - Maximum number of Providers to return.
 * @returns {Promise<IMiner[]>}
 * @private
 */
async function filterProviders(rawProviderList: IMiner[], max?: number) {
  const disallowList = [
    /example/,
    /sample/,
    /0\.0\.0\.0/,
    /127\.\d{1,3}\.\d{1,3}\.\d{1,3}/,
    /192\.168\.\d{1,3}\.\d{1,3}/,
    /placeholder/
  ]
  const filteredProviders = rawProviderList.filter((provider) => {
    const one = provider.ip.toLowerCase()
    if (one.match('localhost')) {
      return true
    } else {
      return one.startsWith('https') && !disallowList.some((rx) => rx.test(one))
    }
  })
  return filteredProviders.slice(0, Number(max) || 1000)
}

/**
 * Check array of Providers are accessible and operating on correct network.
 * @param {IMiner[]} providers - Array from providers to check.
 * @param {string} chainId - Network id to check against.
 * @param {string | string[]} versionFilter - Provider version(s) to check against.
 * @returns {Promise<IMiner[]>}
 * @private
 */
async function verifyProviders(
  providers: IMiner[],
  chainId: string,
  versionFilter?: string | string[]
): Promise<IMiner[]> {
  const versionArray: string[] = []
  if (versionFilter) {
    console.log(`Checking for provider version(s) : ${versionFilter}`)
    typeof versionFilter === 'string'
      ? versionArray.push(versionFilter as string)
      : versionArray.push(...versionFilter)
  }
  const preRegExArray: string[] = versionArray.map((s) => {
    return s.split('.').slice(0, 2).join('.')
  })
  const verRegEx = new RegExp(`(${preRegExArray.join('|')})\\..+$`)
  const staged: boolean[] = await Promise.all(
    providers.map(async (provider) => {
      const result: boolean = await fetch(
        `${provider.ip.replace(/\/+$/, '')}/version`,
        {
          signal: AbortSignal.timeout(1500)
        }
      )
        .then(async (res): Promise<boolean> => {
          const parsed: IProviderVersionResponse = await res.json()
          const chainCheck =
            chainId === undefined || chainId === parsed['chain-id']
          const verCheck =
            versionFilter === undefined || verRegEx.test(parsed.version)
          return res.ok && chainCheck && verCheck
        })
        .catch((err: Error) => {
          console.warn('verifyProviders() Error')
          console.error(err)
          if (err.message.includes('AbortSignal')) {
            alert(
              'AbortSignal.timeout() error! Chromium family version 103+ required!'
            )
          }
          return false
        })
      return result
    })
  )
  const verified = providers.filter((_, index) => staged[index])
  console.info('Verified Providers')
  console.dir(verified)
  return verified
}

/**
 * Sanity check FID host Provider addresses.
 * @param {QueryFindFileResponse} resp - FileTree query response to check.
 * @returns {string[] | false}
 * @private
 */
function verifyFileProviderIps(resp: QueryFindFileResponse): string[] | false {
  if (!resp) {
    console.error('Invalid resp passed to verifyFileProviderIps()')
    return false
  }
  if (!resp.providerIps) {
    console.error('Incomplete resp passed to verifyFileProviderIps()')
    return false
  }
  const brutedString = bruteForceString(resp.providerIps)
  if (!brutedString) {
    console.error(
      'bruteForceString() returned False in verifyFileProviderIps()'
    )
    return false
  }
  try {
    return JSON.parse(resp.providerIps)
  } catch (err) {
    console.error('JSON.parse() failed in verifyFileProviderIps()')
    console.error(err)
    return false
  }
}

/**
 * Verify Msg creator is owner of File contract.
 * @param {IQueryHandler} qH - QueryHandler instance.
 * @param {string} cid - CID to check against.
 * @param {string} owner - Bech32 address of owner to compare to CID.
 * @returns {Promise<boolean>}
 * @private
 */
async function matchOwnerToCid(
  qH: IQueryHandler,
  cid: string,
  owner: string
): Promise<boolean> {
  const contractsResult = (await qH.storageQuery.queryContracts({ cid })).value
    .contracts as Contracts
  if (contractsResult.signee === owner) {
    return true
  }
  const straysResult = (await qH.storageQuery.queryStrays({ cid })).value
    .strays as Strays
  return straysResult.signee === owner
}

/**
 * Timer used by staggeredUploadFiles() to manage queues.
 * @param {number} target - Total to process.
 * @param {IStaggeredTracker} tracker - Current completed.
 * @returns {Promise<void>}
 * @private
 */
async function statusCheck(
  target: number,
  tracker: IStaggeredTracker
): Promise<void> {
  await new Promise<void>(async (resolve) => {
    for (tracker.timer = 120; tracker.timer > 0; tracker.timer--) {
      if (tracker.complete === target) {
        resolve()
      } else {
        await setDelay(500)
      }
    }
    resolve()
  })
}
