import { AccountData, OfflineSigner } from '@cosmjs/proto-signing'
import { bech32, Decoded } from 'bech32'
import { encrypt, decrypt, PrivateKey } from 'eciesjs'
import { Window as KeplrWindow } from '@keplr-wallet/types'
import { bankQueryApi, bankQueryClient } from 'jackal.js-protos'

import { defaultQueryAddr1317, jackalChainId } from '../utils/globals'
import IWalletHandler from '../interfaces/classes/IWalletHandler'

declare global {
  interface Window extends KeplrWindow {}
}

const defaultChains = [jackalChainId, 'osmo-1', 'cosmoshub-4']

export default class WalletHandler implements IWalletHandler {
  private signer: OfflineSigner
  private keyPair: PrivateKey
  private queryClient: bankQueryApi<unknown>
  jackalAccount: AccountData
  deconstructedAccount: Decoded

  private constructor (signer: OfflineSigner, queryClient: bankQueryApi<unknown>, keyPair: PrivateKey, acct: AccountData) {
    this.signer = signer
    this.keyPair = keyPair
    this.queryClient = queryClient
    this.jackalAccount = acct
    this.deconstructedAccount = bech32.decode(acct.address)
  }

  static async trackWallet (enabledChains: string | string[] = defaultChains, queryAddr?: string): Promise<IWalletHandler> {
    if (!window) {
      throw new Error('Jackal.js is only supported in the browser at this time!')
    } else if (!window.keplr) {
      throw new Error('Jackal.js requires Keplr to be installed!')
    } else {
      const qAddr = queryAddr || defaultQueryAddr1317

      await window.keplr.enable(enabledChains)
      const signer = window.keplr.getOfflineSigner(jackalChainId)
      const acct = (await signer.getAccounts())[0]

      const bank = await bankQueryClient({addr: qAddr})

      const secret = await makeSecret(jackalChainId, acct.address)
      const secretAsHex = Buffer.from(secret, 'base64').subarray(0, 32).toString('hex')
      const keyPair = PrivateKey.fromHex(secretAsHex)

      return new WalletHandler(signer, bank, keyPair, acct)
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
  async getAllBalances () {
    return await this.queryClient.queryAllBalances(this.jackalAccount.address)
  }
  async getJackalBalance () {
    return await this.queryClient.queryBalance(this.jackalAccount.address, { denom: 'ujkl' })
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
