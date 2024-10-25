import { merkleParentAndChild, merkleParentAndIndex, stringToShaHex } from '@/utils/hash'
import { stringToUint8Array, timestampToBlockHeight } from '@/utils/converters'
import { formatShareNotification } from '@/utils/notifications'
import { cryptString, genAesBundle } from '@/utils/crypt'
import { warnError } from '@/utils/misc'
import {
  DEncodeObject,
  DMsgCreateNotification,
  DMsgDeleteNotification,
  DMsgExecuteContract,
  DMsgInstantiateContract,
  DMsgPostKey,
  DMsgStorageDeleteFile,
  DMsgStoragePostFile,
  DUnifiedFile,
  reencodeEncodedObject,
  THostSigningClient,
  TJackalSigningClient,
} from '@jackallabs/jackal.js-protos'
import {
  IClientHandler,
  IFileDeletePackage,
  IFileMetaHandler,
  IFileTreeOptions,
  IFileTreePackage,
  IFiletreeReader,
  IFolderMetaHandler,
  INotificationDeletePackage,
  INotificationPackage,
  INullMetaHandler,
  IRootLookupMetaData,
  IShareMetaHandler,
  ISharePackage,
  IUploadPackage,
  IWrappedEncodeObject,
} from '@/interfaces'
import type { TMerkleParentChild, TMetaDataSets } from '@/types'
import { CosmosMsgForEmpty, ExecuteMsg, InstantiateMsg } from '@/types/StorageOutpost.client.types'
import { PrivateKey } from 'eciesjs'
import { FiletreeReader } from '@/classes/filetreeReader'
import { FolderMetaHandler } from '@/classes/metaHandlers'

export class EncodingHandler {
  protected readonly jackalClient: IClientHandler
  protected readonly jackalSigner: TJackalSigningClient
  protected readonly hostSigner: THostSigningClient
  protected readonly proofInterval: number
  protected readonly jklAddress: string
  protected readonly hostAddress: string

  protected reader: IFiletreeReader

  constructor (
    client: IClientHandler,
    jackalSigner: TJackalSigningClient,
    hostSigner: THostSigningClient,
    keyPair: PrivateKey,
    defaultKeyPair: PrivateKey,
    accountAddress?: string,
  ) {
    this.jackalClient = client
    this.jackalSigner = jackalSigner
    this.hostSigner = hostSigner
    this.proofInterval = client.getProofWindow()
    this.jklAddress = accountAddress || client.getICAJackalAddress()
    this.hostAddress = client.getHostAddress()

    this.reader = new FiletreeReader(
      client,
      jackalSigner,
      keyPair,
      defaultKeyPair,
      client.getICAJackalAddress(),
    )
  }

  /**
   *
   * @param {PrivateKey} keyPair
   * @returns {Promise<void>}
   * @protected
   */
  protected async resetReader (keyPair: PrivateKey): Promise<void> {
    let dummyKey = await stringToShaHex('')
    let defaultKeyPair = PrivateKey.fromHex(dummyKey)

    this.reader = new FiletreeReader(
      this.jackalClient,
      this.jackalSigner,
      keyPair,
      defaultKeyPair,
      this.jackalClient.getICAJackalAddress(),
    )
  }

  /* cosmwasm */
  /**
   *
   * @param {string} connectionIdA
   * @param {string} connectionIdB
   * @param {number} codeId
   * @param {string} label
   * @returns {DEncodeObject}
   * @protected
   */
  protected encodeInstantiateContract (
    connectionIdA: string,
    connectionIdB: string,
    codeId: number,
    label: string,
  ): DEncodeObject {
    const initMsg: InstantiateMsg = {
      admin: this.hostAddress,
      channel_open_init_options: {
        connection_id: connectionIdA,
        counterparty_connection_id: connectionIdB,
        tx_encoding: 'proto3',
      },
    }

    const forInstantiate: DMsgInstantiateContract = {
      sender: this.hostAddress,
      admin: this.hostAddress,
      codeId,
      label,
      msg: stringToUint8Array(JSON.stringify(initMsg)),
      funds: [],
    }

    return this.hostSigner.txLibrary.cosmwasm.msgInstantiateContract(
      forInstantiate,
    )
  }

  /**
   *
   * @param {string} contractAddress
   * @param {DEncodeObject} execMsg
   * @returns {DEncodeObject}
   * @protected
   */
  protected encodeExecuteContract (
    contractAddress: string,
    execMsg: DEncodeObject,
  ): DEncodeObject {
    const rdy = reencodeEncodedObject(execMsg)
    const stargateMsg: CosmosMsgForEmpty = {
      stargate: {
        type_url: rdy.typeUrl,
        value: rdy.value,
      },
    }

    const msgToExecute: ExecuteMsg = {
      send_cosmos_msgs: {
        messages: [stargateMsg],
      },
    }

    const forExecute: DMsgExecuteContract = {
      sender: this.hostAddress,
      contract: contractAddress,
      msg: stringToUint8Array(JSON.stringify(msgToExecute)),
      funds: [],
    }

    return this.hostSigner.txLibrary.cosmwasm.msgExecuteContract(forExecute)
  }

  /**
   *
   * @param {string} connectionIdA
   * @param {string} connectionIdB
   * @param {number} codeId
   * @returns {IWrappedEncodeObject[]}
   * @protected
   */
  protected instantiateToMsgs (
    connectionIdA: string,
    connectionIdB: string,
    codeId: number,
  ): IWrappedEncodeObject[] {
    try {
      const instantiate = this.encodeInstantiateContract(
        connectionIdA,
        connectionIdB,
        codeId,
        `JAICA${this.jklAddress}`,
      )
      return [
        {
          encodedObject: instantiate,
          modifier: 0,
        },
      ]
    } catch (err) {
      throw warnError('encodingHandler instantiateToMsgs()', err)
    }
  }

  /**
   *
   * @param {string} contractAddress
   * @param {DEncodeObject | DEncodeObject[]} execs
   * @returns {DEncodeObject[]}
   * @protected
   */
  protected executeToSpecialMsgs (
    contractAddress: string,
    execs: DEncodeObject | DEncodeObject[],
  ): DEncodeObject[] {
    try {
      const msgs: DEncodeObject[] = []
      if (execs instanceof Array) {
        for (let exec of execs) {
          msgs.push(this.encodeExecuteContract(contractAddress, exec))
        }
      } else {
        msgs.push(this.encodeExecuteContract(contractAddress, execs))
      }
      return msgs
    } catch (err) {
      throw warnError('encodingHandler executeToSpecialMsgs()', err)
    }
  }

  /* end cosmwasm */
  /**
   *
   * @param {string} key
   * @returns {DEncodeObject}
   * @protected
   */
  protected encodePostKey (key: string): DEncodeObject {
    const forKey: DMsgPostKey = {
      creator: this.jackalClient.getICAJackalAddress(),
      key,
    }
    return this.jackalSigner.txLibrary.fileTree.msgPostKey(forKey)
  }

  /**
   *
   * @param {IUploadPackage} pkg
   * @param {number} currentBlock
   * @returns {DEncodeObject}
   * @protected
   */
  protected encodeStoragePostFile (
    pkg: IUploadPackage,
    currentBlock: number,
  ): DEncodeObject {
    const forStorage: DMsgStoragePostFile = {
      creator: this.jklAddress,
      merkle: pkg.meta.export().merkleRoot,
      fileSize: pkg.file.size,
      proofInterval: this.proofInterval,
      proofType: 0,
      maxProofs: 3,
      expires: this.createExpiresValue(pkg.duration, currentBlock),
      note: JSON.stringify({}),
    }
    return this.jackalSigner.txLibrary.storage.msgPostFile(forStorage)
  }

  /**
   *
   * @param {DUnifiedFile} item
   * @returns {DEncodeObject}
   * @protected
   */
  protected encodeStorageDeleteFile (item: DUnifiedFile): DEncodeObject {
    const { merkle, start } = item
    const forRemoval: DMsgStorageDeleteFile = {
      creator: this.jklAddress,
      merkle,
      start,
    }
    return this.jackalSigner.txLibrary.storage.msgDeleteFile(forRemoval)
  }

  /**
   *
   * @param {TMerkleParentChild} location
   * @param {TMetaDataSets} meta
   * @param {IFileTreeOptions} [options]
   * @returns {Promise<DEncodeObject>}
   * @protected
   */
  protected async storageEncodeFileTree (
    location: TMerkleParentChild,
    meta: TMetaDataSets,
    options?: IFileTreeOptions,
  ): Promise<DEncodeObject> {
    try {
      const forFileTree = await this.reader.encodePostFile(
        location,
        meta,
        options,
      )
      return this.jackalClient.getTxs().fileTree.msgPostFile(forFileTree)
    } catch (err) {
      throw warnError('encodingHandler storageEncodeFileTree()', err)
    }
  }

  /**
   *
   * @param {IUploadPackage} pkg
   * @returns {Promise<DEncodeObject>}
   * @protected
   */
  protected async encodeFileTreeFile (
    pkg: IUploadPackage,
  ): Promise<DEncodeObject> {
    try {
      const meta = pkg.meta.export()
      const parentAndChild = await merkleParentAndChild(
        `s/ulid/${meta.ulid}`,
      )
      return await this.storageEncodeFileTree(parentAndChild, meta, { aes: pkg.aes })
    } catch (err) {
      throw warnError('encodingHandler encodeFileTreeFile()', err)
    }
  }

  /**
   *
   * @param {string} ulid
   * @param {string[]} addViewers
   * @param {string[]} removeViewers
   * @returns {Promise<DEncodeObject>}
   * @protected
   */
  protected async encodeFileTreeFileShare (
    ulid: string,
    addViewers: string[],
    removeViewers: string[],
  ): Promise<DEncodeObject> {
    try {
      const parentAndChild = await merkleParentAndChild(`s/ulid/${ulid}`)
      const forFileTree = await this.reader.encodeExistingPostFile(
        ulid,
        parentAndChild,
        { add: addViewers, remove: removeViewers },
      )
      return this.jackalClient.getTxs().fileTree.msgPostFile(forFileTree)
    } catch (err) {
      throw warnError('encodingHandler encodeFileTreeFileShare()', err)
    }
  }

  /**
   *
   * @param {IFileTreePackage} pkg
   * @returns {Promise<DEncodeObject>}
   * @protected
   */
  protected async encodeFileTreeBaseFolder (
    pkg: IFileTreePackage,
  ): Promise<DEncodeObject> {
    try {
      const mH = pkg.meta as IFolderMetaHandler
      const meta = mH.export()
      // console.log('saving:', meta.whoAmI)

      const lookup: IRootLookupMetaData = {
        metaDataType: 'rootlookup',
        ulid: mH.getUlid(),
      }

      const parentAndChild = await merkleParentAndChild(`s/ulid/${meta.whoAmI}`)
      return await this.storageEncodeFileTree(parentAndChild, lookup, { aes: pkg.aes })
    } catch (err) {
      throw warnError('encodingHandler encodeFileTreeBaseFolder()', err)
    }
  }

  /**
   *
   * @param {IFileTreePackage} pkg
   * @returns {Promise<DEncodeObject>}
   * @protected
   */
  protected async encodeFileTreeFolder (
    pkg: IFileTreePackage,
  ): Promise<DEncodeObject> {
    try {
      const mH = pkg.meta as IFolderMetaHandler
      const meta = mH.export()
      // console.log('saving:', meta.whoAmI)

      const parentAndChild = await merkleParentAndChild(`s/ulid/${mH.getUlid()}`)
      return await this.storageEncodeFileTree(parentAndChild, meta, { aes: pkg.aes })
    } catch (err) {
      throw warnError('encodingHandler encodeFileTreeFolder()', err)
    }
  }

  /**
   *
   * @param {IFileTreePackage} pkg
   * @returns {Promise<DEncodeObject>}
   * @protected
   */
  protected async encodeFileTreeShared (
    pkg: IFileTreePackage,
  ): Promise<DEncodeObject> {
    try {
      const mH = pkg.meta as IShareMetaHandler
      const meta = mH.export()
      const parentAndChild = await merkleParentAndChild(`s/ulid/${mH.getUlid()}`)
      return await this.storageEncodeFileTree(parentAndChild, meta, { aes: pkg.aes })
    } catch (err) {
      throw warnError('encodingHandler encodeFileTreeShared()', err)
    }
  }

  /**
   *
   * @param {IFileTreePackage} pkg
   * @returns {Promise<DEncodeObject>}
   * @protected
   */
  protected async encodeFileTreeNull (
    pkg: IFileTreePackage,
  ): Promise<DEncodeObject> {
    try {
      const mH = pkg.meta as INullMetaHandler
      const meta = mH.export()
      const parentAndChild = await merkleParentAndChild(mH.getSelf())
      return await this.storageEncodeFileTree(parentAndChild, meta, { aes: pkg.aes })
    } catch (err) {
      throw warnError('encodingHandler encodeFileTreeNull()', err)
    }
  }

  /**
   *
   * @param {IUploadPackage | IFileTreePackage} pkg
   * @returns {Promise<DEncodeObject>}
   * @protected
   */
  protected async encodeFileTreeRef (
    pkg: IUploadPackage | IFileTreePackage,
  ): Promise<DEncodeObject> {
    try {
      const mH = pkg.meta as
        | IShareMetaHandler
        | IFolderMetaHandler
        | IFileMetaHandler
      const meta = mH.exportRef()
      const parentAndChild = await merkleParentAndIndex(
        mH.getLocation(),
        mH.getRefString(),
      )
      return await this.storageEncodeFileTree(parentAndChild, meta as TMetaDataSets, {
        aes: pkg.aes,
      })
    } catch (err) {
      throw warnError('encodingHandler encodeFileTreeRef()', err)
    }

  }

  /**
   *
   * @param {INotificationPackage} pkg
   * @returns {Promise<DEncodeObject>}
   * @protected
   */
  protected async encodeCreateNotification (
    pkg: INotificationPackage,
  ): Promise<DEncodeObject> {
    try {
      const { isPrivate, receiver, msg } = pkg
      let { contents } = pkg
      if (isPrivate) {
        const aes = await genAesBundle()
        const keys = await this.reader.protectNotification(receiver, aes)
        const encMsg = await cryptString(msg, aes, 'encrypt', false)
        contents = JSON.stringify({
          private: true,
          keys,
          msg: encMsg,
        })
      }
      const data: DMsgCreateNotification = {
        creator: this.jklAddress,
        to: receiver,
        contents,
        privateContents: new Uint8Array(),
      }
      return this.jackalSigner.txLibrary.notifications.msgCreateNotification(
        data,
      )
    } catch (err) {
      throw warnError('storageHandler encodeCreateNotification()', err)
    }
  }

  /**
   *
   * @param {INotificationDeletePackage} pkg
   * @returns {Promise<DEncodeObject>}
   * @protected
   */
  protected async encodeDeleteNotification (
    pkg: INotificationDeletePackage,
  ): Promise<DEncodeObject> {
    try {
      const { from, time } = pkg
      const data: DMsgDeleteNotification = {
        creator: this.jklAddress,
        from,
        time,
      }
      return this.jackalSigner.txLibrary.notifications.msgDeleteNotification(
        data,
      )
    } catch (err) {
      throw warnError('storageHandler encodeDeleteNotification()', err)
    }
  }

  /**
   *
   * @param {IFileTreePackage} pkg
   * @returns {Promise<IWrappedEncodeObject[]>}
   * @protected
   */
  protected async upcycleBaseFolderToMsgs (
    pkg: IFileTreePackage,
  ): Promise<IWrappedEncodeObject[]> {
    try {
      const fileTreeBaseFolder = this.encodeFileTreeBaseFolder(pkg)
      return [
        {
          encodedObject: await fileTreeBaseFolder,
          modifier: 0,
        },
      ]
    } catch (err) {
      throw warnError('storageHandler upcycleBaseFolderToMsgs()', err)
    }
  }

  /**
   *
   * @param {IFileTreePackage} pkg
   * @returns {Promise<IWrappedEncodeObject[]>}
   * @protected
   */
  protected async baseFolderToMsgs (
    pkg: IFileTreePackage,
  ): Promise<IWrappedEncodeObject[]> {
    try {
      const fileTreeBaseFolder = this.encodeFileTreeBaseFolder(pkg)
      const fileTreeFolder = this.encodeFileTreeFolder(pkg)
      return [
        {
          encodedObject: await fileTreeBaseFolder,
          modifier: 0,
        },
        {
          encodedObject: await fileTreeFolder,
          modifier: 0,
        },
      ]
    } catch (err) {
      throw warnError('storageHandler baseFolderToMsgs()', err)
    }
  }

  /**
   *
   * @param {IFileTreePackage} pkg
   * @returns {Promise<IWrappedEncodeObject[]>}
   * @protected
   */
  protected async folderToMsgs (
    pkg: IFileTreePackage,
  ): Promise<IWrappedEncodeObject[]> {
    try {
      const fileTreeFolder = this.encodeFileTreeFolder(pkg)
      const ref = this.encodeFileTreeRef(pkg)
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
    } catch (err) {
      throw warnError('storageHandler folderToMsgs()', err)
    }
  }

  /**
   *
   * @param {IFileTreePackage} pkg
   * @returns {Promise<IWrappedEncodeObject[]>}
   * @protected
   */
  protected async existingFolderToMsgs (
    pkg: IFileTreePackage,
  ): Promise<IWrappedEncodeObject[]> {
    try {
      const fileTreeFolder = this.encodeFileTreeFolder(pkg)
      return [
        {
          encodedObject: await fileTreeFolder,
          modifier: 0,
        },
      ]
    } catch (err) {
      throw warnError('storageHandler existingFolderToMsgs()', err)
    }
  }

  /**
   *
   * @returns {Promise<IWrappedEncodeObject[]>}
   * @protected
   */
  protected async ulidFolderToMsgs (): Promise<IWrappedEncodeObject[]> {
    try {
      const aes = await genAesBundle()
      const ulidMeta = await FolderMetaHandler.create({
        count: 0,
        location: '',
        name: 'ulid',
      })
      const parentAndChild = await merkleParentAndChild('s/ulid')
      const fileTreeFolder = this.storageEncodeFileTree(
        parentAndChild,
        ulidMeta.export(),
        { aes },
      )

      return [
        {
          encodedObject: await fileTreeFolder,
          modifier: 0,
        },
      ]
    } catch (err) {
      throw warnError('storageHandler ulidFolderToMsgs()', err)
    }
  }

  /**
   *
   * @param {IFileTreePackage} pkg
   * @returns {Promise<IWrappedEncodeObject[]>}
   * @protected
   */
  protected async filetreeDeleteToMsgs (
    pkg: IFileTreePackage,
  ): Promise<IWrappedEncodeObject[]> {
    try {
      const fileTreeNull = this.encodeFileTreeNull(pkg)
      const ref = this.encodeFileTreeRef(pkg)
      return [
        {
          encodedObject: await fileTreeNull,
          modifier: 0,
        },
        {
          encodedObject: await ref,
          modifier: 0,
        },
      ]
    } catch (err) {
      throw warnError('storageHandler filetreeDeleteToMsgs()', err)
    }
  }

  /**
   *
   * @param {IFileDeletePackage} filePkg
   * @returns {IWrappedEncodeObject[]}
   * @protected
   */
  protected fileDeleteToMsgs (
    filePkg: IFileDeletePackage,
  ): IWrappedEncodeObject[] {
    try {
      return [
        {
          encodedObject:
            this.jackalSigner.txLibrary.storage.msgDeleteFile(filePkg),
          modifier: 0,
        },
      ]
    } catch (err) {
      throw warnError('storageHandler fileDeleteToMsgs()', err)
    }
  }

  /**
   *
   * @param {IUploadPackage} pkg
   * @param {number} blockHeight
   * @returns {Promise<IWrappedEncodeObject[]>}
   * @protected
   */
  protected async pkgToMsgs (
    pkg: IUploadPackage,
    blockHeight: number,
  ): Promise<IWrappedEncodeObject[]> {
    try {
      const storageFile = this.encodeStoragePostFile(pkg, blockHeight)
      const fileTreeFile = this.encodeFileTreeFile(pkg)
      const ref = this.encodeFileTreeRef(pkg)
      return [
        {
          encodedObject: storageFile,
          modifier: 0,
          file: pkg.file,
          merkle: pkg.meta.export().merkleHex,
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
    } catch (err) {
      throw warnError('storageHandler pkgToMsgs()', err)
    }
  }

  /**
   *
   * @param {IFileTreePackage} pkg
   * @returns {Promise<IWrappedEncodeObject[]>}
   * @protected
   */
  protected async movePkgToMsgs (
    pkg: IFileTreePackage,
  ): Promise<IWrappedEncodeObject[]> {
    try {
      const fileTreeFile = this.encodeFileTreeFolder(pkg)
      const ref = this.encodeFileTreeRef(pkg)
      return [
        {
          encodedObject: await fileTreeFile,
          modifier: 0,
        },
        {
          encodedObject: await ref,
          modifier: 0,
        },
      ]
    } catch (err) {
      throw warnError('storageHandler movePkgToMsgs()', err)
    }
  }

  /**
   *
   * @param {IUploadPackage} pkg
   * @returns {Promise<IWrappedEncodeObject[]>}
   * @protected
   */
  protected async legacyPkgToMsgs (
    pkg: IUploadPackage,
  ): Promise<IWrappedEncodeObject[]> {
    try {
      const fileTreeFile = this.encodeFileTreeFile(pkg)
      const ref = this.encodeFileTreeRef(pkg)
      return [
        {
          encodedObject: await fileTreeFile,
          modifier: 0,
        },
        {
          encodedObject: await ref,
          modifier: 0,
        },
      ]
    } catch (err) {
      throw warnError('storageHandler legacyPkgToMsgs()', err)
    }
  }

  /**
   *
   * @param {DUnifiedFile} toReplace
   * @param {IUploadPackage} pkg
   * @param {number} blockHeight
   * @returns {Promise<IWrappedEncodeObject[]>}
   * @protected
   */
  protected async existingPkgToMsgs (
    toReplace: DUnifiedFile,
    pkg: IUploadPackage,
    blockHeight: number,
  ): Promise<IWrappedEncodeObject[]> {
    try {
      const removeFile = this.encodeStorageDeleteFile(toReplace)
      const storageFile = this.encodeStoragePostFile(pkg, blockHeight)
      const fileTreeFile = this.encodeFileTreeFile(pkg)
      return [
        {
          encodedObject: removeFile,
          modifier: 0,
        },
        {
          encodedObject: storageFile,
          modifier: 0,
          file: pkg.file,
          merkle: pkg.meta.export().merkleHex,
        },
        {
          encodedObject: await fileTreeFile,
          modifier: 0,
        },
      ]
    } catch (err) {
      throw warnError('storageHandler existingPkgToMsgs()', err)
    }
  }

  /**
   *
   * @param {IFileTreePackage} pkg
   * @returns {Promise<IWrappedEncodeObject[]>}
   * @protected
   */
  protected async existingMetaToMsgs (
    pkg: IFileTreePackage,
  ): Promise<IWrappedEncodeObject[]> {
    try {
      const fileTreeFile = this.encodeFileTreeFolder(pkg)
      return [
        {
          encodedObject: await fileTreeFile,
          modifier: 0,
        },
      ]
    } catch (err) {
      throw warnError('storageHandler existingMetaToMsgs()', err)
    }
  }

  /**
   *
   * @param {INotificationPackage} pkg
   * @param {string[]} [additionalViewers]
   * @returns {Promise<IWrappedEncodeObject[]>}
   * @protected
   */
  protected async sendShareToMsgs (
    pkg: ISharePackage,
    additionalViewers: string[] = [],
  ): Promise<IWrappedEncodeObject[]> {
    try {
      const id = this.reader.ulidLookup(pkg.path)
      const name = pkg.path.split('/').slice(-1)[0]
      const baseNoti = formatShareNotification(id, name, pkg.isFile)
      const share = this.encodeFileTreeFileShare(id, additionalViewers, [])
      const notification = this.encodeCreateNotification({
        isPrivate: pkg.isPrivate,
        receiver: pkg.receiver,
        msg: baseNoti.msg,
        contents: JSON.stringify(baseNoti),
      })
      return [
        {
          encodedObject: await share,
          modifier: 0,
        },
        {
          encodedObject: await notification,
          modifier: 0,
        },
      ]
    } catch (err) {
      throw warnError('storageHandler shareToMsgs()', err)
    }
  }

  /**
   *
   * @param {IFileTreePackage} pkg
   * @returns {Promise<IWrappedEncodeObject[]>}
   * @protected
   */
  protected async receiveShareToMsgs (
    pkg: IFileTreePackage,
  ): Promise<IWrappedEncodeObject[]> {
    try {
      const fileTreeShared = this.encodeFileTreeShared(pkg)
      const ref = this.encodeFileTreeRef(pkg)
      return [
        {
          encodedObject: await fileTreeShared,
          modifier: 0,
        },
        {
          encodedObject: await ref,
          modifier: 0,
        },
      ]
    } catch (err) {
      throw warnError('storageHandler sharedFileToMsgs()', err)
    }
  }

  /**
   *
   * @param {INotificationDeletePackage} pkg
   * @returns {Promise<IWrappedEncodeObject[]>}
   * @protected
   */
  protected async tidyReceivedNotifications (
    pkg: INotificationDeletePackage,
  ): Promise<IWrappedEncodeObject[]> {
    try {
      const delNotification = this.encodeDeleteNotification(pkg)
      return [
        {
          encodedObject: await delNotification,
          modifier: 0,
        },
      ]
    } catch (err) {
      throw warnError('storageHandler tidyReceivedNotifications()', err)
    }
  }

  /**
   *
   * @param {number} source
   * @param {number} currentBlock
   * @returns {number}
   * @protected
   */
  protected createExpiresValue (source: number, currentBlock: number): number {
    if (source < 0) {
      const dd = new Date()
      dd.setFullYear(dd.getFullYear() + Math.abs(source))
      return timestampToBlockHeight(dd.getTime(), currentBlock)
    } else {
      return timestampToBlockHeight(source, currentBlock)
    }
  }
}
