import PLZSU from '@karnthis/plzsu'
import { ISharedTracker } from '@/interfaces'
import { EncodeObject } from '@cosmjs/proto-signing'
import {
  aesToString,
  compressEncryptString,
  decryptDecompressString,
  genIv,
  genKey,
  stringToAes
} from '@/utils/crypt'
import { hashAndHex, merkleMeBro } from '@/utils/hash'
import { Files } from 'jackal.js-protos/dist/postgen/canine_chain/filetree/files'
import { MsgMakeRoot } from 'jackal.js-protos/dist/postgen/canine_chain/filetree/tx'
import { IProtoHandler, IWalletHandler } from '@/interfaces/classes'

const Plzsu = new PLZSU()

export function compressData(input: string): string {
  return `jklpc1${Plzsu.compress(input)}`
}
export function decompressData(input: string): string {
  if (!input.startsWith('jklpc1'))
    throw new Error('Invalid Decompression String')
  return Plzsu.decompress(input.substring(6))
}

export async function saveCompressedFileTree(
  toAddress: string,
  rawPath: string,
  rawContents: { [key: string]: any },
  walletRef: IWalletHandler
): Promise<EncodeObject> {
  const aes = {
    iv: genIv(),
    key: await genKey()
  }
  const msg: any = {
    creator: walletRef.getJackalAddress(),
    contents: await compressEncryptString(
      JSON.stringify(rawContents),
      aes.key,
      aes.iv
    ),
    rootHashPath: await merkleMeBro(`s/Sharing/${toAddress}`),
    trackingNumber: self.crypto.randomUUID()
  }
  msg.account = await hashAndHex(msg.creator)
  const basePerms: any = {
    num: msg.trackingNumber,
    aes
  }
  const selfPubKey = walletRef.getPubkey()
  const destPubKey = walletRef.findPubKey(toAddress)
  const me = await makePermsBlock(
    { ...basePerms, pubKey: selfPubKey, usr: msg.creator },
    walletRef
  )
  const them = await makePermsBlock(
    { ...basePerms, pubKey: destPubKey, usr: toAddress },
    walletRef
  )
  msg.editors = JSON.stringify(me)
  msg.viewers = JSON.stringify({ ...me, ...them })
  return makeSharedBlock(msg, walletRef.getProtoHandler())
}
export async function readCompressedFileTree(
  owner: string,
  rawPath: string,
  walletRef: IWalletHandler
): Promise<{ [key: string]: any }> {
  const hexAddress = await merkleMeBro(rawPath)
  const hexedOwner = await hashAndHex(
    `o${hexAddress}${await hashAndHex(owner)}`
  )
  const result = await walletRef
    .getProtoHandler()
    .fileTreeQuery.queryFiles({ address: hexAddress, ownerAddress: hexedOwner })
  if (!result.success) {
    throw new Error('Share Data Not Found')
  } else {
    try {
      const { contents, viewingAccess, trackingNumber } = result.value
        .files as Files
      const parsedVA = JSON.parse(viewingAccess)
      const viewName = await hashAndHex(
        `s${trackingNumber}${walletRef.getJackalAddress()}`
      )
      const keys = await stringToAes(walletRef, parsedVA[viewName])
      const final = await decryptDecompressString(contents, keys.key, keys.iv)
      return JSON.parse(final)
    } catch (err: any) {
      throw new Error(err)
    }
  }
}
export async function removeCompressedFileTree(
  rawPath: string,
  walletRef: IWalletHandler
): Promise<EncodeObject> {
  const creator = walletRef.getJackalAddress()
  return walletRef.getProtoHandler().fileTreeTx.msgDeleteFile({
    creator,
    hashPath: await merkleMeBro(rawPath),
    account: await hashAndHex(creator)
  })
}

/** Helpers */
function makeSharedBlock(msg: MsgMakeRoot, pH: IProtoHandler): EncodeObject {
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
async function makePermsBlock(
  parts: any,
  walletRef: IWalletHandler
): Promise<{ [user: string]: string }> {
  const perms: { [user: string]: string } = {}
  const user = await hashAndHex(`s${parts.num}${parts.usr}`)
  const value = await aesToString(walletRef, parts.pubKey, parts.aes)
  perms[user] = value
  return perms
}
