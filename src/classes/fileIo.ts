import { EncodeObject } from '@cosmjs/proto-signing'
// import { randomUUID, random } from 'make-random'
import { IQueryFileTree, IQueryStorage, ITxFileTree } from 'jackal.js-protos'

import { hashAndHex, hexFullPath, merkleMeBro } from '@/utils/hash'
import { exportJackalKey, genIv, genKey, importJackalKey } from '@/utils/crypt'
import { bruteForceString, setDelay } from '@/utils/misc'
import FileDownloadHandler from '@/classes/fileDownloadHandler'
import FolderHandler from '@/classes/folderHandler'
import {
  IFileDownloadHandler,
  IFileIo,
  IFolderHandler,
  IProtoHandler,
  IWalletHandler
} from '@/interfaces/classes'
import {
  IAesBundle,
  IDeleteItem, IDownloadDetails,
  IEditorsViewers,
  IFileConfigFull,
  IFileConfigRaw,
  IFiletreeParsedContents,
  IFolderAdd,
  IFolderChildFiles,
  IMiner,
  IMsgPartialPostFileBundle,
  IProviderModifiedResponse,
  IProviderResponse,
  IQueueItemPostUpload,
  IUploadList, IUploadListItem
} from '@/interfaces'
import { TFileOrFFile } from '@/types/TFoldersAndFiles'
import IProviderChecks from '@/interfaces/IProviderChecks'
import { QueryFindFileResponse } from 'jackal.js-protos/dist/postgen/canine_chain/storage/query'
import SuccessIncluded from 'jackal.js-protos/dist/types/TSuccessIncluded'

export default class FileIo implements IFileIo {
  private readonly walletRef: IWalletHandler
  private readonly pH: IProtoHandler
  private availableProviders: IMiner[]
  private currentProvider: IMiner

  private constructor (wallet: IWalletHandler, providers: IMiner[], currentProvider: IMiner) {
    this.walletRef = wallet
    this.pH = wallet.getProtoHandler()
    this.availableProviders = providers
    this.currentProvider = currentProvider
  }

  static async trackIo (wallet: IWalletHandler, versionFilter?: string | string[]): Promise<FileIo> {
    const providers = await verifyProviders(await getProviders(wallet.getProtoHandler().storageQuery), versionFilter)
    const provider = providers[await random(providers.length)]
    return new FileIo(wallet, providers, provider)
  }
  static async checkProviders (wallet: IWalletHandler, versionFilter?: string | string[]): Promise<IProviderChecks> {
    const raw = await fetchProviders(wallet.getProtoHandler().storageQuery)
    const filtered = await filterProviders(raw)
    return {
      filtered,
      raw,
      verified: (versionFilter) ? await verifyProviders(filtered, versionFilter) : filtered
    }
  }

  async clearProblems (exclude: string): Promise<void> {
    this.availableProviders = this.availableProviders.filter(prov => prov.ip !== exclude)
    await this.shuffle()
  }
  async shuffle (): Promise<void> {
    this.currentProvider = this.availableProviders[await random(this.availableProviders.length)]
  }
  async refresh (): Promise<void> {
    this.availableProviders = await verifyProviders(await getProviders(this.pH.storageQuery))
    this.currentProvider = this.availableProviders[await random(this.availableProviders.length)]
  }
  forceProvider (toSet: IMiner): void {
    this.currentProvider = toSet
  }
  async uploadFolders (toUpload: IFolderAdd, owner: string): Promise<void> {
    const readyToBroadcast = await this.rawUploadFolders(toUpload, owner)
    // await this.pH.debugBroadcaster(readyToBroadcast, true)
    await this.pH.debugBroadcaster(readyToBroadcast)
  }
  async rawUploadFolders (toUpload: IFolderAdd, owner: string): Promise<EncodeObject[]> {
    const { newDir, parentDir } = toUpload
    const url = `${this.currentProvider.ip.replace(/\/+$/, '')}/upload`
    const jackalAddr = this.walletRef.getJackalAddress()

    newDir.setIds(await this.tumbleUpload(jackalAddr, await newDir.getForUpload()))
    const { cfg, file } = await prepExistingUpload(parentDir, owner, this.walletRef)
    parentDir.setIds(await this.tumbleUpload(jackalAddr, file))

    return await this.rawAfterUpload([
      { handler: newDir, data: null },
      { handler: parentDir, data: cfg }
    ])
  }
  async verifyFoldersExist (toCheck: string[]): Promise<number> {
    const toCreate = []

    for (let i = 0; i < toCheck.length; i++) {
      const folderName = toCheck[i]
      const hexAddress = await merkleMeBro(`s/${folderName}`)
      const hexedOwner = await hashAndHex(`o${hexAddress}${await hashAndHex(this.walletRef.getJackalAddress())}`)
      const { version } = await getFileChainData(hexAddress, hexedOwner, this.pH.fileTreeQuery)
      const fileProviders = verifyFileProviderIps(await this.pH.storageQuery.queryFindFile({ fid: version }))
      if (fileProviders && fileProviders.length) {
        console.info(`${folderName} exists`)
      } else {
        console.warn(`${folderName} does not exist`)
        toCreate.push(folderName)
      }
    }

    if (toCreate.length) {
      console.dir(toCreate)
      await this.generateInitialDirs(null, toCreate)
    }
    return toCreate.length
  }
  async staggeredUploadFiles (sourceHashMap: IUploadList): Promise<void> {
    const sourceKeys = Object.keys(sourceHashMap)
    const jackalAddr = this.walletRef.getJackalAddress()
    let queueHashMap: { [key: string]: boolean } = {}
    let tracker = { num: 0 }
    for (let key of sourceKeys) {
      queueHashMap[key] = false
    }
    await Promise.any(
      Object.values(sourceHashMap).map(async (bundle: IUploadListItem) => {
        const { exists, handler, key, uploadable } = bundle
        let prom
        if (exists && !handler.isFolder) {
          const { cfg, file} = await prepExistingUpload(handler, jackalAddr, this.walletRef)
          bundle.data = cfg
          prom = await this.tumbleUpload(jackalAddr, file)
        } else {
          prom = await this.tumbleUpload(jackalAddr, uploadable)
        }
        handler.setIds(prom as IProviderModifiedResponse)
        sourceHashMap[key].handler = handler
        queueHashMap[key] = true
        tracker.num++
        console.log('Done')
        return 'Done'
      })
    )
      .catch(err => {
        console.warn('All Uploads Failed')
        console.error(err)
      })
    do {
      await statusCheck(sourceKeys.length, tracker)
      const processingNames: any[] = Object.keys(queueHashMap).filter(name => queueHashMap[name])
      const processValues = processingNames.map(name => sourceHashMap[name])
      if (processingNames.length === 0) {
        // do nothing
      } else {
        await this.afterUpload(processValues)
        for (let key of processingNames) {
          delete queueHashMap[key]
        }
      }
    } while (Object.keys(queueHashMap).length > 0)
  }
  async uploadFiles (
    toUpload: TFileOrFFile[],
    owner: string,
    existingChildren: IFolderChildFiles
  ): Promise<void> {
    const readyToBroadcast = await this.rawUploadFiles(toUpload, owner, existingChildren)
      .catch(err => {
        throw err
      })
    // await this.pH.debugBroadcaster(readyToBroadcast, true)
    await this.pH.debugBroadcaster(readyToBroadcast)
  }
  async rawUploadFiles (
    toUpload: TFileOrFFile[],
    owner: string,
    existingChildren: IFolderChildFiles
  ): Promise<EncodeObject[]> {
    if (!toUpload.length) {
      throw new Error('Empty File array submitted for upload')
    } else {
      const jackalAddr = this.walletRef.getJackalAddress()

      const readyToUpload: any[] = []
      for (let i = 0; i < toUpload.length; i++) {
        const itemName = toUpload[i].getWhoAmI()
        const { cfg, file } = (!existingChildren[itemName] && !toUpload[i].isFolder)
          ? { cfg: null, file: await toUpload[i].getForUpload()}
          : await prepExistingUpload(toUpload[i], owner, this.walletRef)
        readyToUpload.push({ uploadable: file, handler: toUpload[i], data: cfg })
      }

      const uploadDone: IQueueItemPostUpload[] = await Promise.all(
        readyToUpload.map(async (bundle) => {
          bundle.handler.setIds(await this.tumbleUpload(jackalAddr, bundle.uploadable))
          return { handler: bundle.handler, data: bundle.data }
        }))

      return await this.rawAfterUpload(uploadDone)
    }
  }
  private async afterUpload (ids: IQueueItemPostUpload[]): Promise<void> {
    const readyToBroadcast = await this.rawAfterUpload(ids)
    // await this.pH.debugBroadcaster(readyToBroadcast, true)
    await this.pH.debugBroadcaster(readyToBroadcast)
      .catch(err => {
        throw err
      })
  }
  private async rawAfterUpload (ids: IQueueItemPostUpload[]): Promise<EncodeObject[]> {
    const creator = this.walletRef.getJackalAddress()

    const needingReset: EncodeObject[] = []
    const ready = await Promise.all(ids.flatMap(async (item: IQueueItemPostUpload) => {
      const { cid, fid } = item.handler.getIds()

      const pubKey = this.walletRef.getPubkey()

      const perms = await aesToString(this.walletRef, pubKey, await item.handler.getEnc())
      const workingUUID = self.crypto.randomUUID()
      const folderView: IEditorsViewers = {}
      folderView[await hashAndHex(`v${workingUUID}${creator}`)] = perms
      const folderEdit: IEditorsViewers = {}
      folderEdit[await hashAndHex(`e${workingUUID}${creator}`)] = perms

      const msgPostFileBundle: IMsgPartialPostFileBundle = {
        creator,
        account: await hashAndHex(creator),
        hashParent: await item.handler.getMerklePath(),
        hashChild: await hashAndHex(item.handler.getWhoAmI()),
        contents: JSON.stringify({ fids: fid }),
        viewers: JSON.stringify(folderView),
        editors: JSON.stringify(folderEdit),
        trackingNumber: workingUUID
      }

      if (item.data) {
        msgPostFileBundle.viewers = JSON.stringify(item.data.viewingAccess)
        msgPostFileBundle.editors = JSON.stringify(item.data.editAccess)
        msgPostFileBundle.trackingNumber = item.data.trackingNumber
        const delItem = await this.makeDelete(
          creator,
          [
            {
              location: item.handler.getWhereAmI(),
              name: item.handler.getWhoAmI()
            }
          ]
        )
        needingReset.push(...delItem)
      }

      const msgPost: EncodeObject = await buildPostFile(msgPostFileBundle, this.pH.fileTreeTx)
      const msgSign: EncodeObject = this.pH.storageTx.msgSignContract({ creator, cid, payOnce: false })
      return [msgPost, msgSign]
    }))

    ready.unshift(ready.pop() as EncodeObject[])
    return [...needingReset, ...ready.flat()]

  }
  async downloadFile (downloadDetails: IDownloadDetails, completion: number): Promise<IFileDownloadHandler | IFolderHandler> {
    const { hexAddress, owner, isFolder } = downloadDetails
    const hexedOwner = await hashAndHex(`o${hexAddress}${await hashAndHex(owner)}`)
    const { version, data } = await getFileChainData(hexAddress, hexedOwner, this.pH.fileTreeQuery)
    if (!version) throw new Error('No Existing File')
    const fileProviders = verifyFileProviderIps(await this.pH.storageQuery.queryFindFile({ fid: version }))
    if (fileProviders && fileProviders.length) {
      const config = {
        editAccess: JSON.parse(data.editAccess),
        viewingAccess: JSON.parse(data.viewingAccess),
        trackingNumber: data.trackingNumber
      }
      const requester = await hashAndHex(`e${config.trackingNumber}${this.walletRef.getJackalAddress()}`)
      for (let i = 0; i < fileProviders.length; i++) {
        const url = `${fileProviders[i].replace(/\/+$/, '')}/download/${version}`
        try {
          const resp = await fetch(url)

          const contentLength = resp.headers.get('Content-Length');
          console.log('content-length')
          console.log(contentLength)

          if (!resp.body) throw new Error()
          const reader = resp.body.getReader();

// Step 2: get total length

// Step 3: read the data
          let receivedLength = 0; // received that many bytes at the moment
          let chunks = []; // array of received binary chunks (comprises the body)
          while(true) {
            const {done, value} = await reader.read();

            if (done) {
              break;
            }

            chunks.push(value);
            receivedLength += value.length;
            completion = Math.floor((receivedLength / Number(contentLength)) * 100) || 1
            console.log(`${completion}% Complete`)
          }
// Step 4: concatenate chunks into single Uint8Array
//           let chunksAll = new Uint8Array(receivedLength); // (4.1)
//           let position = 0;
//           for(let chunk of chunks) {
//             chunksAll.set(chunk, position); // (4.2)
//             position += chunk.length;
//           }


          const rawFile = new Blob(chunks)
          // return resp.arrayBuffer()




          console.log('config.editAccess[requester]')
          console.log(config.editAccess[requester])
          const { key, iv } = await stringToAes(this.walletRef, config.editAccess[requester])
          if (isFolder) {
            return await FolderHandler.trackFolder(rawFile, config, key, iv)
          } else {
            return await FileDownloadHandler.trackFile(rawFile, config, key, iv)
          }
        } catch (err) {
          console.warn(`File fetch() failed. Attempt #${i + 1}. ${2 - i} attempts remaining`)
          console.error(err)
          console.warn(`Bad file provider url: ${url}`)
        }
      }
      throw new Error('All file fetch() attempts failed!')
    } else {
      throw new Error('No available providers!')
    }
  }
  async deleteTargets (targets: IDeleteItem[], parent: IFolderHandler): Promise<void> {
    const readyToBroadcast = await this.rawDeleteTargets(targets, parent)
    // await this.pH.debugBroadcaster(readyToBroadcast, true)
    await this.pH.debugBroadcaster(readyToBroadcast)
  }
  async rawDeleteTargets (targets: IDeleteItem[], parent: IFolderHandler): Promise<EncodeObject[]> {
    const url = `${this.currentProvider.ip.replace(/\/+$/, '')}/upload`
    const names = targets.map((target:IDeleteItem) => target.name)

    parent.removeChildDirs(names)
    parent.removeChildFiles(names)
    const msgs = await this.makeDelete(this.walletRef.getJackalAddress(), targets)

    const { cfg, file } = await prepExistingUpload(parent, parent.getWhoOwnsMe(), this.walletRef)
    parent.setIds(await this.tumbleUpload(parent.getWhoOwnsMe(), file))
    const uploadMsg = await this.rawAfterUpload([{ handler: parent, data: cfg }])
    msgs.push(...uploadMsg)

    return msgs
  }
  async generateInitialDirs (initMsg: EncodeObject | null, startingDirs?: string[]): Promise<void> {
    const readyToBroadcast = await this.rawGenerateInitialDirs(initMsg, startingDirs)
    // await this.pH.debugBroadcaster(readyToBroadcast, true)
    await this.pH.debugBroadcaster(readyToBroadcast)
  }
  async rawGenerateInitialDirs (
    initMsg: EncodeObject | null,
    startingDirs?: string[]
  ): Promise<EncodeObject[]> {
    const url = `${this.currentProvider.ip.replace(/\/+$/, '')}/upload`
    const toGenerate = startingDirs || ['Config', 'Home', 'WWW']

    const creator = this.walletRef.getJackalAddress()
    const pubKey = this.walletRef.getPubkey()
    const account = await hashAndHex(creator)

    const rootTrackingNumber = self.crypto.randomUUID()
    const rootPermissions: IEditorsViewers = {}
    rootPermissions[await hashAndHex(`e${rootTrackingNumber}${creator}`)] = await aesToString(
      this.walletRef,
      pubKey,
      {
        iv: genIv(),
        key: await genKey()
      })
    const msgRoot = this.pH.fileTreeTx.msgMakeRoot({
      creator,
      account,
      rootHashPath: await merkleMeBro('s'),
      contents: JSON.stringify({ fids: [] }),
      editors: JSON.stringify(rootPermissions),
      viewers: JSON.stringify(rootPermissions),
      trackingNumber: rootTrackingNumber
    })

    const folderHandlerList: TFileOrFFile[] = []
    for (let i = 0; i < toGenerate.length; i++) {
      const folder = await FolderHandler.trackNewFolder(
        { myName: toGenerate[i], myParent: 's', myOwner: this.walletRef.getJackalAddress()
        })
      folderHandlerList.push(folder)
    }

    const msgs: EncodeObject[][] = await Promise.all(folderHandlerList.map(async (item: TFileOrFFile) => {
      const { cid, fid } = await this.tumbleUpload(this.walletRef.getJackalAddress(), await item.getForUpload())
      const folderView: any = {}
      const folderEdit: any = {}
      const perms = await aesToString(this.walletRef, pubKey, await item.getEnc())
      const workingUUID = self.crypto.randomUUID()
      folderView[await hashAndHex(`v${workingUUID}${creator}`)] = perms
      folderEdit[await hashAndHex(`e${workingUUID}${creator}`)] = perms

      const msgPost: EncodeObject = await buildPostFile({
        creator,
        account,
        hashParent: await item.getMerklePath(),
        hashChild: await hashAndHex(item.getWhoAmI()),
        contents: JSON.stringify({ fids: fid }),
        viewers: JSON.stringify(folderView),
        editors: JSON.stringify(folderEdit),
        trackingNumber: workingUUID
      }, this.pH.fileTreeTx)

      const msgSign: EncodeObject = this.pH.storageTx.msgSignContract({ creator, cid, payOnce: false })
      return [ msgPost, msgSign ]
    }))
    const readyToBroadcast: EncodeObject[] = []
    if (initMsg) {
      readyToBroadcast.push(initMsg)
    }
    readyToBroadcast.push(
      msgRoot,
      ...msgs.flat()
    )
    return readyToBroadcast
  }

  private async makeDelete (creator: string, targets: IDeleteItem[]): Promise<EncodeObject[]> {
    const readyToDelete: EncodeObject[][] = await Promise.all(targets.map(async (target: IDeleteItem) => {
      const hexPath = await hexFullPath(await merkleMeBro(target.location), target.name)
      const hexOwner = await hashAndHex(`o${hexPath}${await hashAndHex(creator)}`)
      const { version } = await getFileChainData(hexPath, hexOwner, this.pH.fileTreeQuery)
      const linkedCids  = JSON.parse((await this.pH.storageQuery.queryFidCid({ fid: version })).value.fidCid?.cids || '[]')
      const toRemove: string[] = await Promise.all(linkedCids.filter(async (cid: string) => {
        return await matchOwnerToCid(this.pH, cid, creator)
      }))
      const cancelContractsMsgs: EncodeObject[] = toRemove.map((cid: string) => this.pH.storageTx.msgCancelContract({ creator, cid }))
      const msgDelFile = this.pH.fileTreeTx.msgDeleteFile({
        creator,
        hashPath: hexPath,
        account: await hashAndHex(creator),
      })
      return [...cancelContractsMsgs, msgDelFile]
    }))
    return readyToDelete.flat()
  }
  private async tumbleUpload (sender: string, file: File): Promise<IProviderModifiedResponse> {
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
}

/** Helpers */
 async function prepExistingUpload (data: TFileOrFFile, ownerAddr: string, walletRef: IWalletHandler): Promise<{ file: File, cfg: IFileConfigFull }> {
  const hexedOwner = await hashAndHex(`o${await data.getFullMerkle()}${await hashAndHex(ownerAddr)}`)
  const fileChainResult = await getFileChainData(await data.getFullMerkle(), hexedOwner, walletRef.getProtoHandler().fileTreeQuery)
  const typedData = fileChainResult.data as IFileConfigRaw

  const configData: IFileConfigFull = {
    address: typedData.address,
    contents: JSON.parse(typedData.contents),
    owner: typedData.owner,
    editAccess: JSON.parse(typedData.editAccess),
    viewingAccess: JSON.parse(typedData.viewingAccess),
    trackingNumber: typedData.trackingNumber
  }

  const editorKeys = configData.editAccess[
    await hashAndHex(`e${configData.trackingNumber}${walletRef.getJackalAddress()}`)
    ]

  return {
    cfg: configData,
    file: await data.getForUpload(await stringToAes(walletRef, editorKeys))
  }
}


async function doUpload (url: string, sender: string, file: File): Promise<IProviderModifiedResponse> {
  console.log('file.size')
  console.log(file.size)
  const fileFormData = new FormData()
  fileFormData.set('file', file)
  fileFormData.set('sender', sender)
  return await fetch(url, { method: 'POST', body: fileFormData as FormData })
    .then((resp): Promise<IProviderResponse> => {
      if (resp.status !== 200) throw new Error(`Status Message: ${resp.statusText}`)
      return resp.json()
    })
    .then((resp) => {
      console.log('resp:', resp)
      return { fid: [resp.fid], cid: resp.cid }
    })
    .catch(err => {
      throw err
    })
}

async function getProviders (queryClient: IQueryStorage, max?: number): Promise<IMiner[]> {
  const rawProviderList = await fetchProviders(queryClient)
  console.info('Raw Providers')
  console.dir(rawProviderList)
  return filterProviders(rawProviderList, max)
}
async function fetchProviders (queryClient: IQueryStorage): Promise<IMiner[]> {
  const rawProviderReturn = await queryClient.queryProvidersAll({})
  if (!rawProviderReturn || !rawProviderReturn.value.providers) throw new Error('Unable to get Storage Provider list!')
  return rawProviderReturn.value.providers as IMiner[]
}
async function filterProviders (rawProviderList: IMiner[], max?: number) {
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
      return one.startsWith('https') && !disallowList.some(rx => rx.test(one))
    }
  })
  return filteredProviders.slice(0, Number(max) || 100)
}
async function verifyProviders (providers: IMiner[], versionFilter?: string | string[]): Promise<IMiner[]> {
  let versionArray: string[] = []
  if (versionFilter) {
    console.log(`Checking for provider version(s) : ${versionFilter}`);
    (typeof versionFilter === 'string') ? versionArray.push(versionFilter as string) : versionArray.push(...versionFilter)
  }
  const staged: boolean[] = await Promise.all(
    providers.map(async (provider) => {
      const result: boolean = await fetch(
        `${provider.ip.replace(/\/+$/, '')}/version`,
        {
          signal: AbortSignal.timeout(1500)
        })
        .then(async (res): Promise<boolean> => {
          return res.ok && (versionFilter) ? versionArray.includes((await res.json()).version) : true
        })
        .catch(() => false)
      return result
  }))
  const verified = providers.filter((provider, index) => staged[index])
  console.info('Verified Providers')
  console.dir(verified)
  return verified
}
function verifyFileProviderIps (resp: SuccessIncluded<QueryFindFileResponse>): string[] | false {
  if (!resp) {
    console.error('Invalid resp passed to verifyFileProviderIps()')
    return false
  }
  if (!resp.value?.providerIps) {
    console.error('Incomplete resp passed to verifyFileProviderIps()')
    return false
  }
  const brutedString = bruteForceString(resp.value.providerIps)
  if (!brutedString) {
    console.error('bruteForceString() returned False in verifyFileProviderIps()')
    return false
  }
  try {
    return JSON.parse(resp.value.providerIps)
  } catch (err) {
    console.error('JSON.parse() failed in verifyFileProviderIps()')
    console.error(err)
    return false
  }
}
async function getFileChainData (hexAddress: string, owner: string, fileTreeQuery: IQueryFileTree) {
  console.log('getFileChainData')
  console.log(hexAddress)
  console.log(owner)
  const fileResp = await fileTreeQuery.queryFiles({ address: hexAddress, ownerAddress: owner })
  console.log(fileResp)
  if (!fileResp.value || !fileResp.value.files) throw new Error('No address found!')
  const fileData = fileResp.value.files
  if (!fileResp.success) {
    fileData.contents = '{ "fids": [] }'
  }
  const parsedContents: IFiletreeParsedContents = JSON.parse(fileData.contents)
  return {
    version: parsedContents.fids[parsedContents.fids.length - 1],
    data: fileData
  }
}
async function matchOwnerToCid (pH: IProtoHandler, cid: string, owner: string): Promise<boolean> {
   if ((await pH.storageQuery.queryContracts({ cid })).value.contracts?.signee == owner) {
     return true
   } else if ((await pH.storageQuery.queryStrays({ cid })).value.strays?.signee == owner) {
     return true
   } else {
     return false
   }
}
async function aesToString (wallet: IWalletHandler, pubKey: string, aes: IAesBundle): Promise<string> {
  const theIv = wallet.asymmetricEncrypt(aes.iv, pubKey)
  const theKey = wallet.asymmetricEncrypt(await exportJackalKey(aes.key), pubKey)
  return `${theIv}|${theKey}`
}
async function stringToAes (wallet: IWalletHandler, source: string): Promise<IAesBundle> {
  if (source.indexOf('|') < 0) throw new Error('stringToAes() : Invalid source string')

  const parts = source.split('|')
  return {
    iv: new Uint8Array(wallet.asymmetricDecrypt(parts[0])),
    key: await importJackalKey(new Uint8Array(wallet.asymmetricDecrypt(parts[1])))
  }
}
async function buildPostFile (data: IMsgPartialPostFileBundle, fileTreeTx: ITxFileTree): Promise<EncodeObject> {
  return fileTreeTx.msgPostFile({
    creator: data.creator,
    account: data.account,
    hashParent: data.hashParent,
    hashChild: data.hashChild,
    contents: data.contents,
    editors: data.editors,
    viewers: data.viewers,
    trackingNumber: data.trackingNumber
  })
}
async function random (max: number) {
   return Math.floor(Math.random() * max)
}
async function statusCheck (target: number, current: any): Promise<void> {
  await new Promise<void>(async (resolve) => {
    for (let i = 0; i < 120; i++) {
      if (current.num === target) {
        resolve()
      } else {
        await setDelay(500)
      }
    }
    resolve()
  })
}
