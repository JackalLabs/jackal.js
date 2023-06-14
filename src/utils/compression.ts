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

const { crypto } = window ? window : globalThis
const Plzsu = new PLZSU()

/**
 * Compresses string using PLZSU compression library.
 * @param {string} input - String to compress.
 * @returns {string} - Compressed string.
 */
export function compressData(input: string): string {
  return `jklpc1${Plzsu.compress(input)}`
}

/**
 * Decompresses string using PLZSU compression library.
 * @param {string} input - String to decompress.
 * @returns {string} - Decompressed string.
 */
export function decompressData(input: string): string {
  if (!input.startsWith('jklpc1'))
    throw new Error('Invalid Decompression String')
  return Plzsu.decompress(input.substring(6))
}

/**
 * Save encrypted data to FileTree path with optional compression.
 * @param {string} toAddress - Jkl address of owner.
 * @param {string} rawPath - Parent path to store to.
 * @param {string} rawTarget - Specific entry to store to.
 * @param {{[p: string]: any}} rawContents - Data object to store.
 * @param {IWalletHandler} walletRef - Wallet instance for accessing functions.
 * @param {boolean} compress - Optional boolean to flag if rawContents should be compressed.
 * @returns {Promise<EncodeObject>} - FileTree msg to save entry.
 */
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
    trackingNumber: crypto.randomUUID(),
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
      ...(await makePermsBlock({ base: 'v', ...me }, walletRef)),
      ...(await makePermsBlock({ base: 'v', ...them }, walletRef))
    })
  }
  return buildPostFile(msg, walletRef.getProtoHandler())
}

/**
 * Read encrypted data from FileTree path with optional decompression.
 * @param {string} owner - Jkl address of owner.
 * @param {string} rawPath - Path to stored data.
 * @param {IWalletHandler} walletRef - Wallet instance for accessing functions.
 * @param {boolean} decompress - Optional boolean to flag if retrieved data should be decompressed.
 * @returns {Promise<{[p: string]: any}>} - Stored data object.
 */
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
    console.warn(`'Share Data Not Found for: ${rawPath}`)
    return {}
  } else {
    try {
      const { contents, viewingAccess, trackingNumber } = result.value
        .files as Files
      const parsedVA = JSON.parse(viewingAccess)
      const viewName = await hashAndHex(
        `v${trackingNumber}${walletRef.getJackalAddress()}`
      )
      const keys = await stringToAes(walletRef, parsedVA[viewName])
      if (decompress) {
        const final = await decryptDecompressString(
          contents,
          keys.key,
          keys.iv
        ).catch((err: Error) => {
          console.error(err)
          return contents
        })
        return JSON.parse(final)
      } else {
        const final = await cryptString(
          contents,
          keys.key,
          keys.iv,
          'decrypt'
        ).catch((err: Error) => {
          console.error(err)
          return '{}'
        })
        return JSON.parse(final)
      }
    } catch (err: any) {
      throw err
    }
  }
}

/**
 *
 * @param {string} rawPath - Path to FileTree entry to remove.
 * @param {IWalletHandler} walletRef
 * @returns {Promise<EncodeObject>}
 */
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
/**
 * Creates properly formatted data block for use in IMsgPartialPostFileBundle.editors and viewers.
 * @param {IPermsParts} parts - All elements needed to build IEditorsViewers.
 * @param {IWalletHandler} walletRef - Wallet instance for accessing functions.
 * @returns {Promise<IEditorsViewers>} - Completed permissions block.
 */
export async function makePermsBlock(
  parts: IPermsParts,
  walletRef: IWalletHandler
): Promise<IEditorsViewers> {
  const perms: IEditorsViewers = {}
  const user = await hashAndHex(`${parts.base}${parts.num}${parts.usr}`)
  perms[user] = await aesToString(walletRef, parts.pubKey, parts.aes)
  return perms
}

/**
 * Map data object to specific order of properties required by PostFile msg.
 * @param {IMsgPartialPostFileBundle} data - Data object to map.
 * @param {IProtoHandler} pH - ProtoHandler instance for accessing msgPostFile function.
 * @returns {Promise<EncodeObject>} - Encoded msgPostFile in correct order.
 */
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
