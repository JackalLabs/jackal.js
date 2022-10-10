import { AccountData, OfflineSigner } from '@cosmjs/proto-signing'
import { encrypt, decrypt, PrivateKey } from 'eciesjs'
import { Window as KeplrWindow } from '@keplr-wallet/types'
import { bankQueryApi, bankQueryClient, filetreeTxClient, rnsQueryApi, rnsQueryClient } from 'jackal.js-protos'

import { defaultQueryAddr1317, defaultTxAddr26657, jackalMainnetChainId } from '../utils/globals'
import { IWalletHandler } from '../interfaces/classes'
import { finalizeGas } from '../utils/gas'
import { bufferToHex, hashAndHex } from '../utils/hash'
import { IWalletConfig } from '../interfaces'

declare global {
  interface Window extends KeplrWindow {}
}

const defaultChains = [jackalMainnetChainId, 'osmo-1', 'cosmoshub-4']

export default class WalletHandler implements IWalletHandler {
  private signer: OfflineSigner
  private keyPair: PrivateKey
  private bankQueryClient: bankQueryApi<any>
  private rnsQueryClient: rnsQueryApi<any>
  private initComplete: boolean
  txAddr26657: string
  queryAddr1317: string
  jackalAccount: AccountData

  private constructor (signer: OfflineSigner, tAddr: string, qAddr: string, bQueryClient: bankQueryApi<any>, rQueryClient: rnsQueryApi<any>, initComplete: boolean, keyPair: PrivateKey, acct: AccountData) {
    this.signer = signer
    this.keyPair = keyPair
    this.bankQueryClient = bQueryClient
    this.rnsQueryClient = rQueryClient
    this.initComplete = initComplete
    this.txAddr26657 = tAddr
    this.queryAddr1317 = qAddr
    this.jackalAccount = acct
  }

  static async trackWallet (config: IWalletConfig): Promise<IWalletHandler> {
    if (!window) {
      throw new Error('Jackal.js is only supported in the browser at this time!')
    } else if (!window.keplr) {
      throw new Error('Jackal.js requires Keplr to be installed!')
    } else {
      const { signerChain, enabledChains, queryAddr, txAddr } = config

      const qAddr = queryAddr || defaultQueryAddr1317
      const tAddr = txAddr || defaultTxAddr26657

      await window.keplr.enable(enabledChains || defaultChains)
      const signer = window.keplr.getOfflineSigner(signerChain || jackalMainnetChainId)
      const acct = (await signer.getAccounts())[0]

      const bank = await bankQueryClient({addr: qAddr})
      const rns = await rnsQueryClient({addr: qAddr})

      const initComplete = (await rns.queryInit(acct.address)).data.init

      const secret = await makeSecret(signerChain || jackalMainnetChainId, acct.address)
      const secretAsHex = bufferToHex(Buffer.from(secret, 'base64').subarray(0, 32))
      console.dir(secretAsHex)
      const keyPair = PrivateKey.fromHex(secretAsHex)

      return new WalletHandler(signer, tAddr, qAddr, bank, rns, !!initComplete, keyPair, acct)
    }
  }

  async initAccount (): Promise<void> {
    const { msgInitAll, msgInitAccount, signAndBroadcast } = await filetreeTxClient(this.signer, { addr: this.txAddr26657 })
    const initCall = msgInitAll({
      creator: this.jackalAccount.address,
      pubkey: this.keyPair.publicKey.toHex()
    })
    // const initCall = msgInitAccount({
    //   creator: this.jackalAccount.address,
    //   account: this.jackalAccount.address,
    //   rootHashpath: await hashAndHex(await hashAndHex('Home')),
    //   editors: '',
    //   key: '',
    //   trackingNumber: 0
    // })
    const lastStep = await signAndBroadcast([initCall], { fee: {amount: [], gas: '400000'}, memo: '' })
    console.dir(lastStep)
    // const initComplete = (await this.rnsQueryClient.queryInit(this.jackalAccount.address)).data.init
    // if (!initComplete) {
    //   await this.initAccount()
    // } else {
    //   this.initComplete = true
    // }
  }
  checkIfInit (): boolean {
    return this.initComplete
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
  async getHexJackalAddress (): Promise<string> {
    return await hashAndHex(this.jackalAccount.address)
  }
  async getAllBalances (): Promise<any> {
    return await this.bankQueryClient.queryAllBalances(this.jackalAccount.address)
  }
  async getJackalBalance (): Promise<any> {
    return await this.bankQueryClient.queryBalance(this.jackalAccount.address, { denom: 'ujkl' })
  }
  async getJewelBalance (): Promise<any> {
    return await this.bankQueryClient.queryBalance(this.jackalAccount.address, { denom: 'ujwl' })
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
