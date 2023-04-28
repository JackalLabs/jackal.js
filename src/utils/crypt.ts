import { keyAlgo } from '@/utils/globals'
import { hashAndHex } from '@/utils/hash'
import { compressData, decompressData } from '@/utils/compression'
import { IWalletHandler } from '@/interfaces/classes'
import { IAesBundle } from '@/interfaces'

export async function exportJackalKey (key: CryptoKey): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.exportKey('raw', key))
}
export function importJackalKey (rawExport: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', rawExport, 'AES-GCM', true, ['encrypt', 'decrypt'])
}
export function genKey (): Promise<CryptoKey> {
  return crypto.subtle.generateKey(keyAlgo, true, ['encrypt', 'decrypt'])
}
export function genIv (): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(16))
}

export async function aesCrypt (data: Blob, key: CryptoKey, iv: Uint8Array, mode: 'encrypt' | 'decrypt'): Promise<Blob> {
  const algo = {
    name: 'AES-GCM',
    iv
  }
  const workingData = await data.arrayBuffer()
  if (workingData.byteLength < 1) {
    return new Blob([])
  } else if (mode?.toLowerCase() === 'encrypt') {
    return await crypto.subtle.encrypt(algo, key, workingData)
      .then(res => {
        return new Blob([res])
      })
      .catch(err => {
        console.error(`aesCrypt(encrypt) - ${err}`)
        throw err
      })
  } else {
    return await crypto.subtle.decrypt(algo, key, workingData)
      .then(res => {
        return new Blob([res])
      })
      .catch(err => {
        console.error(`aesCrypt(decrypt) - ${err}`)
        throw err
      })
  }
}
export async function aesToString (wallet: IWalletHandler, pubKey: string, aes: IAesBundle): Promise<string> {
  console.log(pubKey)
  const theIv = wallet.asymmetricEncrypt(aes.iv, pubKey)
  const theKey = wallet.asymmetricEncrypt(await exportJackalKey(aes.key), pubKey)
  return `${theIv}|${theKey}`
}
export async function stringToAes (wallet: IWalletHandler, source: string): Promise<IAesBundle> {
  if (!source || source.indexOf('|') < 0) {
    throw new Error('stringToAes() : Invalid source string')
  }
  const parts = source.split('|')
  return {
    iv: new Uint8Array(wallet.asymmetricDecrypt(parts[0])),
    key: await importJackalKey(new Uint8Array(wallet.asymmetricDecrypt(parts[1])))
  }
}

export async function convertToEncryptedFile (workingFile: File, key: CryptoKey, iv: Uint8Array): Promise<File> {
  const chunkSize = 32 * Math.pow(1024, 2) /** in bytes */
  const details = {
      name: workingFile.name,
      lastModified: workingFile.lastModified,
      type: workingFile.type,
      size: workingFile.size,
    }
  const detailsBlob = new Blob([JSON.stringify(details)])
  console.log('detailsBlob.size')
  console.log(detailsBlob.size)
  const encryptedArray: Blob[] = [
    new Blob([
      (detailsBlob.size + 16).toString().padStart(8, '0')
    ]),
    await aesCrypt(detailsBlob, key, iv, 'encrypt')
  ]
  for (let i = 0; i < workingFile.size; i += chunkSize) {
    const blobChunk = workingFile.slice(i, i + chunkSize)
    encryptedArray.push(
      new Blob([
        (blobChunk.size + 16).toString().padStart(8, '0')
      ]),
      await aesCrypt(blobChunk, key, iv, 'encrypt')
    )
  }
  const finalName = `${await hashAndHex(details.name + Date.now().toString())}.jkl`
  return new File(encryptedArray, finalName, { type: 'text/plain' })
}
export async function convertFromEncryptedFile (source: Blob, key: CryptoKey, iv: Uint8Array): Promise<File> {
  let detailsBlob = new Blob([])
  const blobParts: Blob[] = []
  for (let i = 0; i < source.size;) {
    const offset = i + 8
    const segSize = Number(await source.slice(i, offset).text())
    const last = offset + segSize
    const segment = source.slice(offset, last)

    const rawBlob = await aesCrypt(segment, key, iv, 'decrypt')
    if (i === 0) {
      detailsBlob = rawBlob
    } else {
      blobParts.push(rawBlob)
    }
    i = last
  }
  const details = JSON.parse(await detailsBlob.text())
  return new File(blobParts, details.name, details)
}

export async function compressEncryptString (input: string, key: CryptoKey, iv: Uint8Array): Promise<string> {
  const compString = compressData(input)
  const cryptBlob = await aesCrypt(new Blob([compString]), key, iv, 'encrypt')
  return await cryptBlob.text()
}
export async function decryptDecompressString (input: string, key: CryptoKey, iv: Uint8Array): Promise<string> {
  console.log('decryptDecompressString()')
  console.log(input)
  const decryptBlob = await aesCrypt(new Blob([input]), key, iv, 'decrypt')
  return decompressData(await decryptBlob.text())
}
export async function encryptString (input: string, key: CryptoKey, iv: Uint8Array): Promise<string> {
  return await (await aesCrypt(new Blob([input]), key, iv, 'encrypt')).text()
}
export async function decryptString (input: string, key: CryptoKey, iv: Uint8Array): Promise<string> {
  return await (await aesCrypt(new Blob([input]), key, iv, 'decrypt')).text()
}
