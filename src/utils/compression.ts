import PLZSU from '@karnthis/plzsu'
import {
  IEditorsViewers,
  IMsgPartialPostFileBundle,
  IPermsParts
} from '@/interfaces'
import { EncodeObject } from '@cosmjs/proto-signing'
import {
  aesToString,
  compressEncryptString,
  decryptDecompressString,
  cryptString,
  genIv,
  genKey,
  stringToAes
} from '@/utils/crypt'
import { hashAndHex, merkleMeBro } from '@/utils/hash'
import { Files } from 'jackal.js-protos/src/postgen/canine_chain/filetree/files'
import { IProtoHandler, IWalletHandler } from '@/interfaces/classes'
import { getFileTreeData } from '@/utils/misc'

const Plzsu = new PLZSU()

export function compressData(input: string): string {
  return `jklpc1${Plzsu.compress(input)}`
}
export function decompressData(input: string): string {
  if (!input.startsWith('jklpc1'))
    throw new Error('Invalid Decompression String')
  console.log('decompressData()')
  console.log(input)
  return Plzsu.decompress(input.substring(6))
}

export async function saveCompressedFileTree(
  toAddress: string,
  rawPath: string,
  rawTarget: string,
  rawContents: { [key: string]: any },
  walletRef: IWalletHandler
): Promise<EncodeObject> {
  const aes = {
    iv: genIv(),
    key: await genKey()
  }
  const creator = walletRef.getJackalAddress()
  const account = await hashAndHex(creator)
  console.log(`${rawTarget} : `, JSON.stringify(rawContents))
  const msg: IMsgPartialPostFileBundle = {
    account,
    creator,
    contents: await cryptString(
      JSON.stringify(rawContents),
      aes.key,
      aes.iv,
      'encrypt'
    ),
    hashParent: await merkleMeBro(rawPath),
    hashChild: await hashAndHex(rawTarget),
    trackingNumber: self.crypto.randomUUID(),
    editors: '',
    viewers: ''
  }
  const basePerms: any = {
    num: msg.trackingNumber,
    aes
  }
  const selfPubKey = walletRef.getPubkey()
  const me = {
    ...basePerms,
    pubKey: selfPubKey,
    usr: creator
  }
  console.log(basePerms.aes)
  console.log('start')
  msg.editors = JSON.stringify(
    await makePermsBlock({ base: 'e', ...me }, walletRef)
  )
  if (toAddress === creator) {
    msg.viewers = JSON.stringify(
      await makePermsBlock({ base: 'v', ...me }, walletRef)
    )
  } else {
    console.log('bad')
    // const destPubKey = await walletRef.findPubKey(toAddress)
    // const them = {
    //   ...basePerms,
    //   pubKey: destPubKey,
    //   usr: toAddress
    // }
    // msg.viewers = JSON.stringify({
    //   ...await makePermsBlock({ base: 'v', ...me }, walletRef),
    //   ...await makePermsBlock({ base: 'v', ...them }, walletRef)
    // })
  }
  console.log('end')
  return buildPostFile(msg, walletRef.getProtoHandler())
}
export async function readCompressedFileTree(
  owner: string,
  rawPath: string,
  walletRef: IWalletHandler
): Promise<{ [key: string]: any }> {
  const result = await getFileTreeData(
    rawPath,
    owner,
    walletRef.getProtoHandler()
  )
  console.log(result)
  if (!result.success) {
    throw new Error('Share Data Not Found')
  } else {
    try {
      const { contents, editAccess, viewingAccess, trackingNumber } = result
        .value.files as Files
      console.log('For... ', rawPath)
      const parsedEA = JSON.parse(editAccess)
      console.log('parsedEA')
      console.log(parsedEA)
      const editName = await hashAndHex(
        `e${trackingNumber}${walletRef.getJackalAddress()}`
      )
      console.log(parsedEA[editName])
      const parsedVA = JSON.parse(viewingAccess)
      console.log('parsedVA')
      console.log(parsedVA)
      const viewName = await hashAndHex(
        `v${trackingNumber}${walletRef.getJackalAddress()}`
      )
      console.log(parsedVA[viewName])
      const keys = await stringToAes(walletRef, parsedEA[editName])
      // const keys = await stringToAes(walletRef, parsedVA[viewName])
      console.log(keys)
      const final = await cryptString(contents, keys.key, keys.iv, 'decrypt')
      console.log(final)
      return JSON.parse(final)
    } catch (err: any) {
      throw err
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
export async function makePermsBlock(
  parts: IPermsParts,
  walletRef: IWalletHandler
): Promise<IEditorsViewers> {
  console.log(parts.aes)
  const perms: IEditorsViewers = {}
  const user = await hashAndHex(`${parts.base}${parts.num}${parts.usr}`)
  const value = await aesToString(walletRef, parts.pubKey, parts.aes)
  console.log(parts.aes)
  console.log(`${user} = ${value}`)
  perms[user] = value
  return perms
}

export async function buildPostFile(
  data: IMsgPartialPostFileBundle,
  pH: IProtoHandler
): Promise<EncodeObject> {
  return pH.fileTreeTx.msgPostFile({
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
