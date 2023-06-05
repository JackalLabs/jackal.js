import PLZSU from '@karnthis/plzsu'
import { IEditorsViewers, IMsgPartialPostFileBundle, IPermsParts } from '@/interfaces'
import { EncodeObject } from '@cosmjs/proto-signing'
import {
  aesToString,
  compressEncryptString,
  cryptString,
  decryptDecompressString,
  genIv,
  genKey,
  stringToAes
} from '@/utils/crypt'
import { hashAndHex, merkleMeBro } from '@/utils/hash'
import { Files } from 'jackal.js-protos'
import { IProtoHandler, IWalletHandler } from '@/interfaces/classes'
import { getFileTreeData } from '@/utils/misc'

const Plzsu = new PLZSU()

export function compressData(input: string): string {
  return `jklpc1${Plzsu.compress(input)}`
}
export function decompressData(input: string): string {
  if (!input.startsWith('jklpc1'))
    throw new Error('Invalid Decompression String')
  return Plzsu.decompress(input.substring(6))
}

export async function saveFileTreeEntry(
  toAddress: string,
  rawPath: string,
  rawTarget: string,
  rawContents: { [key: string]: any },
  walletRef: IWalletHandler,
  compress?: boolean
): Promise<EncodeObject> {
  const aes = {
    iv: genIv(),
    key: await genKey()
  }
  const creator = walletRef.getJackalAddress()
  const account = await hashAndHex(creator)
  const msg: IMsgPartialPostFileBundle = {
    account,
    creator,
    contents: '',
    hashParent: await merkleMeBro(rawPath),
    hashChild: await hashAndHex(rawTarget),
    trackingNumber: self.crypto.randomUUID(),
    editors: '',
    viewers: ''
  }
  if (compress) {
    msg.contents = await compressEncryptString(
      JSON.stringify(rawContents),
      aes.key,
      aes.iv
    )
  } else {
    msg.contents = await cryptString(
      JSON.stringify(rawContents),
      aes.key,
      aes.iv,
      'encrypt'
    )
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
  msg.editors = JSON.stringify(
    await makePermsBlock({ base: 'e', ...me }, walletRef)
  )
  if (toAddress === creator) {
    msg.viewers = JSON.stringify(
      await makePermsBlock({ base: 'v', ...me }, walletRef)
    )
  } else {
    const destPubKey = await walletRef.findPubKey(toAddress)
    const them = {
      ...basePerms,
      pubKey: destPubKey,
      usr: toAddress
    }
    msg.viewers = JSON.stringify({
      ...await makePermsBlock({ base: 'v', ...me }, walletRef),
      ...await makePermsBlock({ base: 'v', ...them }, walletRef)
    })
  }
  return buildPostFile(msg, walletRef.getProtoHandler())
}
export async function readFileTreeEntry(
  owner: string,
  rawPath: string,
  walletRef: IWalletHandler,
  decompress?: boolean
): Promise<{ [key: string]: any }> {
  const result = await getFileTreeData(
    rawPath,
    owner,
    walletRef.getQueryHandler()
  )
  if (!result.success) {
    throw new Error('Share Data Not Found')
  } else {
    try {
      const { contents, viewingAccess, trackingNumber } = result
        .value.files as Files
      const parsedVA = JSON.parse(viewingAccess)
      const viewName = await hashAndHex(
        `v${trackingNumber}${walletRef.getJackalAddress()}`
      )
      const keys = await stringToAes(walletRef, parsedVA[viewName])
      if (decompress) {
        const final = await decryptDecompressString(contents, keys.key, keys.iv)
        return JSON.parse(final)
      } else {
        const final = await cryptString(contents, keys.key, keys.iv, 'decrypt')
        return JSON.parse(final)
      }
    } catch (err: any) {
      throw err
    }
  }
}
export async function removeFileTreeEntry(
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
  const perms: IEditorsViewers = {}
  const user = await hashAndHex(`${parts.base}${parts.num}${parts.usr}`)
  perms[user] = await aesToString(walletRef, parts.pubKey, parts.aes)
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
