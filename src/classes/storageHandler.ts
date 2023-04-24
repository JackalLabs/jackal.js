import { IProtoHandler, IStorageHandler, IWalletHandler } from '@/interfaces/classes'
import { EncodeObject } from '@cosmjs/proto-signing'
import { IEditorsViewers, IFiletreeParsedContents, IPayData, ISharedTracker, IStoragePaymentInfo } from '@/interfaces'
import { numTo3xTB, numToWholeTB } from '@/utils/misc'
import { DeliverTxResponse } from '@cosmjs/stargate'
import { hashAndHex, merkleMeBro } from '@/utils/hash'
import { aesToString, compressEncryptString, decryptDecompressString, genIv, genKey, stringToAes } from '@/utils/crypt'
import { MsgMakeRoot } from 'jackal.js-protos/dist/postgen/canine_chain/filetree/tx'
import { IQueryFileTree } from 'jackal.js-protos'
import { Files } from 'jackal.js-protos/dist/postgen/canine_chain/filetree/files'

export default class StorageHandler implements IStorageHandler {
  private readonly walletRef: IWalletHandler
  private readonly pH: IProtoHandler

  private constructor (wallet: IWalletHandler) {
    this.walletRef = wallet
    this.pH = wallet.getProtoHandler()
  }

  static async trackStorage (wallet: IWalletHandler): Promise<IStorageHandler> {
    return new StorageHandler(wallet)
  }

  async buyStorage (forAddress: string, duration: number, space: number): Promise<DeliverTxResponse> {
    const msg: EncodeObject = this.pH.storageTx.msgBuyStorage({
      creator: this.walletRef.getJackalAddress(),
      forAddress,
      duration: `${(duration * 720) || 720}h`,
      bytes: numTo3xTB(space),
      paymentDenom: 'ujkl'
    })
    // await this.pH.debugBroadcaster([msg], true)
    return await this.pH.debugBroadcaster([msg], {}) as DeliverTxResponse
  }
  async upgradeStorage (forAddress: string, duration: number, space: number): Promise<DeliverTxResponse> {
    const msg: EncodeObject = this.pH.storageTx.msgUpgradeStorage({
      creator: this.walletRef.getJackalAddress(),
      forAddress,
      duration: `${(duration * 720) || 720}h`,
      bytes: numTo3xTB(space),
      paymentDenom: 'ujkl'
    })
    // await this.pH.debugBroadcaster([msg], true)
    return await this.pH.debugBroadcaster([msg], {}) as DeliverTxResponse
  }
  makeStorageInitMsg (): EncodeObject {
    return this.pH.fileTreeTx.msgPostkey({
      creator: this.walletRef.getJackalAddress(),
      key: this.walletRef.getPubkey()
    })
  }

  async getClientFreeSpace (address: string): Promise<number> {
    return (await this.pH.storageQuery.queryGetClientFreeSpace({ address })).value.bytesfree
  }
  async getStorageJklPrice (space: number, duration: number): Promise<number> {
    const request = {
      bytes: Number(numTo3xTB(space)),
      duration: `${(duration * 720) || 720}h`,
    }
    return (await this.pH.storageQuery.queryPriceCheck(request)).value.price
  }
  async getPayData (address: string): Promise<IPayData> {
    return (await this.pH.storageQuery.queryGetPayData({ address })).value
  }
  async getStoragePaymentInfo (address: string): Promise<IStoragePaymentInfo> {
    const result = (await this.pH.storageQuery.queryStoragePaymentInfo({ address })).value.storagePaymentInfo
    return (result) ? result : { spaceAvailable: 0, spaceUsed: 0, address: '' }
  }

  /** Manage FT Noti */
  async saveSharing (toAddress: string, shared: ISharedTracker): Promise<EncodeObject> {
    const aes = {
      iv: genIv(),
      key: await genKey()
    }
    const msg: any = {
      creator: this.walletRef.getJackalAddress(),
      contents: await compressEncryptString(JSON.stringify(shared), aes.key, aes.iv),
      rootHashPath: await merkleMeBro(`s/Sharing/${toAddress}`),
      trackingNumber: self.crypto.randomUUID()
    }
    msg.account = await hashAndHex(msg.creator)
    const basePerms: any = {
      num: msg.trackingNumber,
      aes
    }
    const selfPubKey = this.walletRef.getPubkey()
    const destPubKey = this.walletRef.findPubKey(toAddress)
    const me = await makePermsBlock({ ...basePerms, pubKey: selfPubKey, usr: msg.creator }, this.walletRef)
    const them = await makePermsBlock({ ...basePerms, pubKey: destPubKey, usr: toAddress }, this.walletRef)
    msg.editors = JSON.stringify(me)
    msg.viewers = JSON.stringify({...me, ...them})
    return makeSharedBlock(msg, this.pH)
  }
  async readSharing (owner: string, rawPath: string): Promise<ISharedTracker> {
    const hexAddress = await merkleMeBro(rawPath)
    const hexedOwner = await hashAndHex(`o${hexAddress}${await hashAndHex(owner)}`)
    const result = await this.pH.fileTreeQuery.queryFiles({ address: hexAddress, ownerAddress: hexedOwner })
    if (!result.success) {
      throw new Error('Share Data Not Found')
    } else {
      try {
        const { contents, viewingAccess, trackingNumber } = result.value.files as Files
        const parsedVA = JSON.parse(viewingAccess)
        const viewName = await hashAndHex(`s${trackingNumber}${this.walletRef.getJackalAddress()}`)
        const keys = await stringToAes(this.walletRef, parsedVA[viewName])
        const final = await decryptDecompressString(contents, keys.key, keys.iv)
        return JSON.parse(final)
      } catch (err) {
        throw new Error(`Storage.Handler - readSharing() JSON Parse Failed: ${err}`)
      }
    }
  }
  async stopSharing (rawPath: string): Promise<EncodeObject> {
    const creator = this.walletRef.getJackalAddress()
    return this.pH.fileTreeTx.msgDeleteFile({
      creator,
      hashPath: await merkleMeBro(rawPath),
      account: await hashAndHex(creator),
    })
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

/** Helpers */
function makeSharedBlock (msg: MsgMakeRoot, pH: IProtoHandler): EncodeObject {
  return pH.fileTreeTx.msgMakeRoot({
    creator: msg.creator,
    account: msg.account,
    rootHashPath: msg.rootHashPath,
    contents: msg.contents,
    editors: msg.editors,
    viewers: msg.viewers,
    trackingNumber: msg.trackingNumber
  })
}
async function makePermsBlock (parts: any, walletRef: IWalletHandler): Promise<{ [user: string]: string }> {
  const perms: { [user: string]: string } = {}
  const user = await hashAndHex(`s${parts.num}${parts.usr}`)
  const value = await aesToString(
    walletRef,
    parts.pubKey,
    parts.aes
  )
  perms[user] = value
  return perms
}
