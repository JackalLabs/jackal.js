import { AccountData, OfflineSigner } from '@cosmjs/proto-signing'
import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing/build/directsecp256k1hdwallet'
import { storageTxClient } from '@/raw'
import { OfflineDirectSigner } from '@cosmjs/proto-signing/build/signer'
import { bech32, Decoded } from 'bech32'
import IChainDetails from '@/interfaces/IChainDetails'
import { encrypt, decrypt, PrivateKey } from 'eciesjs'
import * as buffer from 'buffer'


export default class WalletHandler {
  private wallet: DirectSecp256k1HdWallet
  jackalAccount: AccountData
  deconstructedAccount: Decoded
  enabledChains: AccountData[]

  private constructor (wallet: DirectSecp256k1HdWallet, acct: AccountData) {
    this.wallet = wallet
    this.jackalAccount = acct
    this.deconstructedAccount = bech32.decode(acct.address)
    this.enabledChains = this.processStockChains()
  }

  static async trackWallet (seed?: string | DirectSecp256k1HdWallet): Promise<WalletHandler> {
    let wallet
    if (!seed) {
      wallet = await DirectSecp256k1HdWallet.generate(24, { prefix: 'jkl' })
    } else if (typeof seed === 'string') {
      wallet = await DirectSecp256k1HdWallet.fromMnemonic(seed, { prefix: 'jkl' })
    } else {
      wallet = seed
    }
    const baseAccount = (await wallet.getAccounts())[0]
    return new WalletHandler(wallet, baseAccount)
  }

  // getMnemonic () {
  //   return this.wallet.mnemonic
  // }
  getAccounts () {
    return this.wallet.getAccounts()
  }
  getChains () {
    return this.enabledChains
  }
  getPubkey () {
    return this.jackalAccount.pubkey
  }
  asymmetricEncrypt (toEncrypt: ArrayBuffer, pubKey: string) {
    return encrypt(pubKey, Buffer.from(toEncrypt))
  }
  asymmetricDecrypt (toDecrypt: string) {
    const privKey = new PrivateKey(Buffer.from(this.wallet.mnemonic))
    return decrypt(privKey.toHex(), Buffer.from(toDecrypt))
  }

  processStockChains () {
    const chains: IChainDetails[] = [
      {
        name: 'Jackal',
        prefix: 'jkl',
        ticker: 'jkl'
      },
      {
        name: 'Cosmos',
        prefix: 'cosmos',
        ticker: 'atom'
      },
      {
        name: 'Axelar USDC',
        prefix: 'osmo',
        ticker: 'usdc'
      }
    ]
    return chains.map((deets: IChainDetails) => this.processChain(deets))
  }
  private processChain (chainDetails: IChainDetails): AccountData {
    return {...this.jackalAccount, address: bech32.encode(chainDetails.prefix, this.deconstructedAccount.words)}
  }
  addSupportedChain (chainDetails: IChainDetails): void {
    this.enabledChains.push(this.processChain(chainDetails))
  }
  mutate (prefix: string): Promise<DirectSecp256k1HdWallet> {
    return DirectSecp256k1HdWallet.fromMnemonic(this.wallet.mnemonic, { prefix })
  }

}