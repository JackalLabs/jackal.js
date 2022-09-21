import { AccountData, OfflineSigner } from '@cosmjs/proto-signing'
import { bech32, Decoded } from 'bech32'
import { encrypt, decrypt, PrivateKey } from 'eciesjs'
import { Window as KeplrWindow } from '@keplr-wallet/types'

import { jackalChainId } from '../utils/globals'
import IWalletHandler from '../interfaces/classes/IWalletHandler'

declare global {
  interface Window extends KeplrWindow {}
}

const defaultChains = [jackalChainId, 'osmo-1', 'cosmos-1']

export default class WalletHandler implements IWalletHandler {
  private signer: OfflineSigner
  private keyPair: PrivateKey
  jackalAccount: AccountData
  deconstructedAccount: Decoded

  private constructor (signer: OfflineSigner, acct: AccountData, keyPair: PrivateKey) {
    this.signer = signer
    this.keyPair = keyPair
    this.jackalAccount = acct
    this.deconstructedAccount = bech32.decode(acct.address)
  }

  static async trackWallet (enabledChains: string | string[] = defaultChains): Promise<IWalletHandler> {
    if (!window) {
      throw new Error('Jackal.js is only supported in the browser at this time!')
    } else if (!window.keplr) {
      throw new Error('Jackal.js requires Keplr to be installed!')
    } else {

      await window.keplr.enable(enabledChains)
      const signer = window.keplr.getOfflineSigner(jackalChainId)
      const acct = (await signer.getAccounts())[0]
      const secret = await makeSecret(jackalChainId, acct.address)

      const secretAsHex = Buffer.from(secret, 'base64').slice(0, 32).toString('hex')
      const keyPair = PrivateKey.fromHex(secretAsHex)

      return new WalletHandler(signer, acct, keyPair)
    }
  }

  getAccounts (): Promise<readonly AccountData[]> {
    return this.signer.getAccounts()
  }
  getSigner () {
    return this.signer
  }
  getJackalAddress (): string {
    return this.jackalAccount.address
  }
  getPubkey () {
    return this.keyPair.publicKey.toHex()
  }
  asymmetricEncrypt (toEncrypt: ArrayBuffer, pubKey: string): string {
    return encrypt(pubKey, Buffer.from(toEncrypt)).toString('hex')
  }
  asymmetricDecrypt (toDecrypt: string): ArrayBuffer {
    return new Uint8Array(decrypt(this.keyPair.toHex(), Buffer.from(toDecrypt, 'hex')))
  }
}

async function makeSecret (chainId: string, acct: string): Promise<string> {
  const memo = 'Initiate Jackal Session'
  if (!window.keplr) {
    throw new Error('Jackal.js requires Keplr to be installed!')
  } else {
    return (await window.keplr.signArbitrary(chainId, acct, memo)).signature
  }
}
