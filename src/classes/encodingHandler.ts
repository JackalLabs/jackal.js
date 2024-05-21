import {
  encodeFileTreePostFile,
  reEncodeFileTreePostFile,
} from '@/utils/filetree'
import { merkleParentAndChild, merkleParentAndIndex } from '@/utils/hash'
import { stringToUint8Array, timestampToBlockHeight } from '@/utils/converters'
import {
  formatShareNotification,
  protectNotification,
} from '@/utils/notifications'
import { cryptString, genAesBundle } from '@/utils/crypt'
import { warnError } from '@/utils/misc'
import {
  DEncodeObject,
  DMsgCreateNotification, DMsgExecuteContract, DMsgInstantiateContract,
  DMsgStorageDeleteFile,
  DMsgStoragePostFile,
  DUnifiedFile, reencodeEncodedObject, THostSigningClient,
  TJackalSigningClient,
} from '@jackallabs/jackal.js-protos'
import type {
  IClientHandler,
  IFileTreeOptions,
  IFileTreePackage,
  INotificationPackage,
  IReconstructedFileTree,
  IUploadPackage,
  IWrappedEncodeObject,
} from '@/interfaces'
import type { TMerkleParentChild, TMetaDataSets } from '@/types'
import { CosmosMsgForEmpty, ExecuteMsg, InstantiateMsg } from '@/types/StorageOutpost.client.types'

export class EncodingHandler {
  protected readonly jackalClient: IClientHandler
  protected readonly jackalSigner: TJackalSigningClient
  protected readonly hostSigner: THostSigningClient
  protected readonly proofInterval: number
  protected readonly jklAddress: string
  protected readonly hostAddress: string

  constructor(client: IClientHandler, jackalSigner: TJackalSigningClient, hostSigner: THostSigningClient, accountAddress?: string) {
    this.jackalClient = client
    this.jackalSigner = jackalSigner
    this.hostSigner = hostSigner
    this.proofInterval = client.getProofWindow()
    this.jklAddress = accountAddress || client.getJackalAddress()
    this.hostAddress = client.getHostAddress()
  }

  /* cosmwasm */

  protected encodeInstantiateContract(
    connectionIdA: string,
    connectionIdB: string,
    codeId: number,
    label: string
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
      funds: []
    }

    return this.hostSigner.txLibrary.cosmwasm.msgInstantiateContract(forInstantiate)
  }

  protected encodeExecuteContract(
    contractAddress: string,
    execMsg: DEncodeObject,
  ): DEncodeObject {
    const rdy = reencodeEncodedObject(execMsg)
    const stargateMsg: CosmosMsgForEmpty = {
      stargate: {
        type_url: rdy.typeUrl,
        value: rdy.value,
      }
    }

    const msgToExecute: ExecuteMsg = {
      send_cosmos_msgs: {
        messages: [stargateMsg],
      }
    }

    const forExecute: DMsgExecuteContract = {
      sender: this.hostAddress,
      contract: contractAddress,
      msg: stringToUint8Array(JSON.stringify(msgToExecute)),
      funds: []
    }

    return this.hostSigner.txLibrary.cosmwasm.msgExecuteContract(forExecute)
  }

  protected instantiateToMsgs(
    connectionIdA: string,
    connectionIdB: string,
    codeId: number
  ): IWrappedEncodeObject[] {
    try {
      const instantiate = this.encodeInstantiateContract(
        connectionIdA,
        connectionIdB,
        codeId,
        `JAICA${this.jklAddress}`
      )
      return [
        {
          encodedObject: instantiate,
          modifier: 0,
        },
      ]
    } catch (err) {
      throw warnError('wasmHandler instantiateToMsgs()', err)
    }
  }

  protected executeToSpecialMsgs(
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
      throw warnError('wasmHandler executeToMsgs()', err)
    }
  }

  /* end cosmwasm */

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
      creator: this.jklAddress,
      merkle: item.meta.getFileMeta().merkleRoot,
      fileSize: item.file.size,
      proofInterval: this.proofInterval,
      proofType: 0,
      maxProofs: 3,
      expires: this.createExpiresValue(item.duration, currentBlock),
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
  protected encodeStorageDeleteFile(item: DUnifiedFile): DEncodeObject {
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
  protected async storageEncodeFileTree(
    location: TMerkleParentChild,
    meta: TMetaDataSets,
    options?: IFileTreeOptions,
  ): Promise<DEncodeObject> {
    return encodeFileTreePostFile(
      this.jackalClient,
      this.jklAddress,
      location,
      meta,
      options,
    )
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
    const parentAndChild = await merkleParentAndChild(meta.location)
    return this.storageEncodeFileTree(parentAndChild, meta, { aes: item.aes })
  }

  /**
   *
   * @param {string} path
   * @param {IReconstructedFileTree} rdy
   * @returns {Promise<DEncodeObject>}
   * @protected
   */
  protected async encodeFileTreeFileShare(
    path: string,
    rdy: IReconstructedFileTree,
  ): Promise<DEncodeObject> {
    try {
      const parentAndChild = await merkleParentAndChild(path)
      const forFileTree = await reEncodeFileTreePostFile(
        this.jklAddress,
        parentAndChild,
        rdy,
      )
      return this.jackalClient.getTxs().fileTree.msgPostFile(forFileTree)
    } catch (err) {
      throw warnError('encodingHandler encodeFileTreeFileShare()', err)
    }
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
    console.log('saving:', meta.location)

    const parentAndChild = await merkleParentAndChild(meta.location)
    return this.storageEncodeFileTree(parentAndChild, meta, { aes: item.aes })
  }

  /**
   *
   * @param {IFileTreePackage} item
   * @returns {Promise<DEncodeObject>}
   * @protected
   */
  protected async encodeFileTreeShared(
    item: IFileTreePackage,
  ): Promise<DEncodeObject> {
    const meta = item.meta.getShareMeta()
    const parentAndChild = await merkleParentAndChild(meta.location)
    return this.storageEncodeFileTree(parentAndChild, meta, { aes: item.aes })
  }

  /**
   *
   * @param {IFileTreePackage} item
   * @returns {Promise<DEncodeObject>}
   * @protected
   */
  protected async encodeFileTreeSharedFolder(
    item: IFileTreePackage,
  ): Promise<DEncodeObject> {
    const meta = item.meta.getShareFolderMeta()
    const parentAndChild = await merkleParentAndIndex(
      item.meta.getPath(),
      item.meta.getRefIndex(),
    )
    return this.storageEncodeFileTree(parentAndChild, meta, { aes: item.aes })
  }

  /**
   *
   * @param {IFileTreePackage} item
   * @returns {Promise<DEncodeObject>}
   * @protected
   */
  protected async encodeFileTreeNull(
    item: IFileTreePackage,
  ): Promise<DEncodeObject> {
    const meta = item.meta.getNullMeta()
    const parentAndChild = await merkleParentAndIndex(
      item.meta.getPath(),
      item.meta.getRefIndex(),
    )
    return this.storageEncodeFileTree(parentAndChild, meta, { aes: item.aes })
  }

  /**
   *
   * @param {IUploadPackage | IFileTreePackage} item
   * @param {boolean} [isShared]
   * @returns {Promise<DEncodeObject>}
   * @protected
   */
  protected async encodeFileTreeRef(
    item: IUploadPackage | IFileTreePackage,
    isShared?: boolean,
  ): Promise<DEncodeObject> {
    const meta = isShared ? item.meta.getShareRefMeta() : item.meta.getRefMeta()
    const parentAndChild = await merkleParentAndIndex(
      item.meta.getPath(),
      item.meta.getRefIndex(),
    )
    return this.storageEncodeFileTree(parentAndChild, meta, { aes: item.aes })
  }

  protected async encodeCreateNotification(
    pkg: INotificationPackage,
  ): Promise<DEncodeObject> {
    try {
      const { isPrivate, receiver, path, isFile } = pkg
      const base = formatShareNotification(path, isFile)
      let contents = JSON.stringify(base)
      if (isPrivate) {
        const aes = await genAesBundle()
        const keys = await protectNotification(
          this.jackalClient,
          this.jklAddress,
          receiver,
          aes,
        )
        const encMsg = await cryptString(base.msg, aes, 'encrypt', false)
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
   * @param {IFileTreePackage} pkg
   * @returns {Promise<IWrappedEncodeObject[]>}
   * @protected
   */
  protected async folderToMsgs(
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
  protected async existingFolderToMsgs(
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

  protected async sharedFolderToMsgs(
    pkg: IFileTreePackage,
  ): Promise<IWrappedEncodeObject[]> {
    try {
      const fileTreeFolder = this.encodeFileTreeFolder(pkg)
      const ref = this.encodeFileTreeSharedFolder(pkg)
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
      throw warnError('storageHandler sharedFolderToMsgs()', err)
    }
  }

  protected async sharedFileToMsgs(
    pkg: IFileTreePackage,
  ): Promise<IWrappedEncodeObject[]> {
    try {
      const fileTreeShared = this.encodeFileTreeShared(pkg)
      const ref = this.encodeFileTreeRef(pkg, true)
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
   * @param {IFileTreePackage} pkg
   * @returns {Promise<IWrappedEncodeObject[]>}
   * @protected
   */
  protected async filetreeDeleteToMsgs(
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
      throw warnError('storageHandler deleteToMsgs()', err)
    }
  }

  /* TODO - finish */
  protected async fileDeleteToMsgs(
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
      throw warnError('storageHandler deleteToMsgs()', err)
    }
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
    try {
      const storageFile = this.encodeStoragePostFile(pkg, blockHeight)
      const fileTreeFile = this.encodeFileTreeFile(pkg)
      const ref = this.encodeFileTreeRef(pkg)
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
    } catch (err) {
      throw warnError('storageHandler pkgToMsgs()', err)
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
  protected async existingPkgToMsgs(
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
          merkle: pkg.meta.getFileMeta().merkleLocation,
        },
        {
          encodedObject: await fileTreeFile,
          modifier: 0,
        },
      ]
    } catch (err) {
      throw warnError('storageHandler pkgToMsgs()', err)
    }
  }

  /**
   *
   * @param {INotificationPackage} pkg
   * @param {IReconstructedFileTree} rdy
   * @returns {Promise<IWrappedEncodeObject[]>}
   * @protected
   */
  protected async shareToMsgs(
    pkg: INotificationPackage,
    rdy: IReconstructedFileTree,
  ): Promise<IWrappedEncodeObject[]> {
    try {
      const share = this.encodeFileTreeFileShare(pkg.path, rdy)
      const notification = this.encodeCreateNotification(pkg)
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
      throw warnError('storageHandler folderToMsgs()', err)
    }
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
}
