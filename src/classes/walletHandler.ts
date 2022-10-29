import { AccountData, EncodeObject, OfflineSigner } from '@cosmjs/proto-signing'
import { encrypt, decrypt, PrivateKey } from 'eciesjs'
import { Window as KeplrWindow } from '@keplr-wallet/types'

import { defaultQueryAddr1317, defaultTxAddr26657, jackalMainnetChainId } from '../utils/globals'
import { IWalletHandler } from '../interfaces/classes'
import { bufferToHex, hashAndHex, hexFullPath, merkleMeBro } from '../utils/hash'
import { ICoin, IPayBlock, IPayData, IStorageClientUsage, IWalletConfig } from '../interfaces'
import { finalizeGas } from '../utils/gas'
import { checkResults } from '../utils/misc'
import { DeliverTxResponse } from '@cosmjs/stargate'
import ProtoHandler from './protoHandler'

declare global {
  interface Window extends KeplrWindow {}
}

const defaultChains = [jackalMainnetChainId, 'osmo-1', 'cosmoshub-4']

export default class WalletHandler implements IWalletHandler {
  private signer: OfflineSigner
  private keyPair: PrivateKey
  private initComplete: boolean
  jackalAccount: AccountData
  pH: any

  private constructor (signer: OfflineSigner, keyPair: PrivateKey, initComplete: boolean, acct: AccountData, pH: any) {
    this.signer = signer
    this.keyPair = keyPair
    this.initComplete = initComplete
    this.jackalAccount = acct
    this.pH = pH
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

      const pH = await ProtoHandler.trackProto({ signer, queryAddr1317:qAddr, txAddr26657: tAddr })

      const initComplete = (await pH.rnsQuery.queryInit(acct.address)).data.init

      const secret = await makeSecret(signerChain || jackalMainnetChainId, acct.address)
      const secretAsHex = bufferToHex(Buffer.from(secret, 'base64').subarray(0, 32))
      console.dir(secretAsHex)
      const keyPair = PrivateKey.fromHex(secretAsHex)

      return new WalletHandler(signer, keyPair, !!initComplete, acct, pH)
    }
  }
  static async getAbitraryMerkle (path: string, item: string): Promise<string> {
    return await hexFullPath(await merkleMeBro(path), item)
  }
  static async initAccount (wallet: IWalletHandler, filetreeTxClient: any): Promise<EncodeObject> {
    const { msgInitAll } = await filetreeTxClient
    const initCall = msgInitAll({
      creator: wallet.getJackalAddress(),
      pubkey: wallet.getPubkey()
    })
    return initCall
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
  async getAllBalances (): Promise<ICoin[]> {
    const res: any = await this.pH.bankQuery.queryAllBalances(this.jackalAccount.address)
    return res.balances as ICoin[]
  }
  async getJackalBalance (): Promise<ICoin> {
    const res: any = await this.pH.bankQuery.queryBalance(this.jackalAccount.address, { denom: 'ujkl' })
    console.dir(res)
    return res.data.balance as ICoin
  }
  async getJewelBalance (): Promise<ICoin> {
    const res: any = await this.pH.bankQuery.queryBalance(this.jackalAccount.address, { denom: 'ujwl' })
    return res.balance as ICoin
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

  // billing
  /**
   * msgBuyStorage
   * queryClientUsage
   * queryGetPayData
   * queryPayBlocks
   */
  async buyStorage (forAddress: string, duration: string, bytes: string): Promise<DeliverTxResponse> {
    const { msgBuyStorage } = await this.pH.storageTx

    const msg: EncodeObject = await msgBuyStorage({
      creator: this.jackalAccount.address,
      forAddress,
      duration,
      bytes,
      paymentDenom: 'ujkl'
    })
    // checkResults(await this.pH.broadcaster([msg], { fee: finalizeGas([msg]), memo: '' }))
    return await this.pH.broadcaster([msg], { fee: finalizeGas([msg]), memo: '' })
  }
  async getClientUsage (address: string): Promise<IStorageClientUsage | null> {
    return (await this.pH.storageQuery.queryClientUsage(address)).data.clientUsage as IStorageClientUsage || null

  }
  async getGetPayData (address: string): Promise<IPayData | null> {
    return (await this.pH.storageQuery.queryGetPayData(address)).data as IPayData || null

  }
  async getPayBlocks (blockid: string): Promise<IPayBlock | null> {
    return (await this.pH.storageQuery.queryPayBlocks(blockid)).data.payBlocks as IPayBlock || null
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
