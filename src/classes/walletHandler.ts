import { AccountData, OfflineSigner } from '@cosmjs/proto-signing'
import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing/build/directsecp256k1hdwallet'
import { storageTxClient } from '@/raw'
import { OfflineDirectSigner } from '@cosmjs/proto-signing/build/signer'
import { bech32, Decoded } from 'bech32'
import IChainDetails from '@/interfaces/IChainDetails'

export default class WalletHandler {
  wallet: DirectSecp256k1HdWallet
  jackalAccount: AccountData
  deconstructedAccount: Decoded
  enabledChains: AccountData[]

  private constructor (wallet: DirectSecp256k1HdWallet, acct: AccountData) {
    this.wallet = wallet
    this.jackalAccount = acct
    this.deconstructedAccount = bech32.decode(acct.address)
    this.enabledChains = this.processStockChains()
  }

  static async trackWallet (seed?: string): Promise<WalletHandler> {
    const wallet = (seed) ? await DirectSecp256k1HdWallet.fromMnemonic(seed, { prefix: 'jkl' }) : await DirectSecp256k1HdWallet.generate(24, { prefix: 'jkl' })
    const baseAccount = (await wallet.getAccounts())[0]
    return new WalletHandler(wallet, baseAccount)
  }

  getMnemonic () {
    return this.wallet.mnemonic
  }
  getAccounts () {
    return this.wallet.getAccounts()
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
        prefix: 'atom',
        ticker: 'cosmos'
      },
      {
        name: 'Axelar USDC',
        prefix: 'usdc',
        ticker: 'osmo'
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

}