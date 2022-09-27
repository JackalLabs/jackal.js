import { AccountData, OfflineSigner } from '@cosmjs/proto-signing'
import { bech32, Decoded } from 'bech32'
import { encrypt, decrypt, PrivateKey } from 'eciesjs'
import { Window as KeplrWindow } from '@keplr-wallet/types'
import { bankQueryApi, bankQueryClient } from 'jackal.js-protos'

import { defaultQueryAddr1317, defaultTxAddr26657, jackalMainnetChainId } from '../utils/globals'
import { IWalletHandler } from '../interfaces/classes'

declare global {
  interface Window extends KeplrWindow {}
}

const defaultChains = [jackalMainnetChainId, 'osmo-1', 'cosmoshub-4']

export default class WalletHandler implements IWalletHandler {
  private signer: OfflineSigner
  private keyPair: PrivateKey
  private queryClient: bankQueryApi<unknown>
  txAddr26657: string
  queryAddr1317: string
  jackalAccount: AccountData
  deconstructedAccount: Decoded

  private constructor (signer: OfflineSigner, tAddr: string, qAddr: string, queryClient: bankQueryApi<unknown>, keyPair: PrivateKey, acct: AccountData) {
    this.signer = signer
    this.keyPair = keyPair
    this.queryClient = queryClient
    this.txAddr26657 = tAddr
    this.queryAddr1317 = qAddr
    this.jackalAccount = acct
    this.deconstructedAccount = bech32.decode(acct.address)
  }

  static async trackWallet (config: { signerChain?: string, enabledChains?: string | string[], queryAddr?: string, txAddr?: string }): Promise<IWalletHandler> {
    if (!window) {
      throw new Error('Jackal.js is only supported in the browser at this time!')
    } else if (!window.keplr) {
      throw new Error('Jackal.js requires Keplr to be installed!')
    } else {
      const { signerChain, enabledChains, queryAddr, txAddr } = config

      const qAddr = queryAddr || defaultQueryAddr1317
      const tAddr = txAddr || defaultTxAddr26657

      await window.keplr.enable(enabledChains || defaultChains)
      const signer = window.keplr.getOfflineSigner(jackalMainnetChainId)
      const acct = (await signer.getAccounts())[0]

      const bank = await bankQueryClient({addr: qAddr})

      const secret = await makeSecret(signerChain || jackalMainnetChainId, acct.address)
      const secretAsHex = Buffer.from(secret, 'base64').subarray(0, 32).toString('hex')
      const keyPair = PrivateKey.fromHex(secretAsHex)

      return new WalletHandler(signer, tAddr, qAddr, bank, keyPair, acct)
    }
  }

  getAccounts (): Promise<readonly AccountData[]> {
    return this.signer.getAccounts()
  }
  getSigner (): OfflineSigner {
    return this.signer
  }
  getJackalAddress (): string {
    return this.jackalAccount.address
  }
  async getAllBalances (): Promise<any> {
    return await this.queryClient.queryAllBalances(this.jackalAccount.address)
  }
  async getJackalBalance (): Promise<any> {
    return await this.queryClient.queryBalance(this.jackalAccount.address, { denom: 'ujkl' })
  }
  async getJewelBalance (): Promise<any> {
    return await this.queryClient.queryBalance(this.jackalAccount.address, { denom: 'ujwl' })
  }
  getPubkey (): string {
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
