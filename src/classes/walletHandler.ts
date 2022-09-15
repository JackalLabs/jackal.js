import { AccountData } from '@cosmjs/proto-signing'
import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing/build/directsecp256k1hdwallet'
import { bech32, Decoded } from 'bech32'
import { encrypt, decrypt } from 'eciesjs'
import bs58check from 'bs58check'
import ecc from 'tiny-secp256k1'
import { BIP32Factory } from 'bip32'
import IChainDetails from '@/interfaces/IChainDetails'
import IWalletHandler from '@/interfaces/classes/IWalletHandler'

const Bip32 = BIP32Factory(ecc)

export default class WalletHandler implements IWalletHandler {
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

  getAccounts () {
    return this.wallet.getAccounts()
  }
  getJackalAddress (): string {
    return this.jackalAccount.address
  }
  getChains () {
    return this.enabledChains
  }
  getPubkey () {
    return this.jackalAccount.pubkey
  }
  asymmetricEncrypt (toEncrypt: ArrayBuffer, pubKey: string): string {
    return encrypt(Buffer.from(pubKey), Buffer.from(toEncrypt)).toString('hex')
  }
  asymmetricDecrypt (toDecrypt: string): ArrayBuffer {
    const bipX = Bip32.fromSeed(Buffer.from(this.wallet.mnemonic))
    const dec = Buffer.from(bs58check.decode(bipX.toBase58()))
    const privKey = Bip32.fromBase58(bs58check.encode(dec)).derivePath(`m/44'/118'/0'/0/0`).privateKey
    return new Uint8Array(decrypt(privKey as Buffer, Buffer.from(toDecrypt, 'hex')))
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