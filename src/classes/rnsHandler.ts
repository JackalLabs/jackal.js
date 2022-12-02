import { IProtoHandler, IRnsHandler, IWalletHandler } from '@/interfaces/classes'
import { INames } from '@/interfaces'
import { EncodeObject } from '@cosmjs/proto-signing'

export default class RnsHandler implements IRnsHandler {
  private readonly walletRef: IWalletHandler
  private readonly pH: IProtoHandler

  private constructor (wallet: IWalletHandler) {
    this.walletRef = wallet
    this.pH = wallet.getProtoHandler()
  }

  static async trackRns (wallet: IWalletHandler): Promise<IRnsHandler> {
    return new RnsHandler(wallet)
  }

  makeFreeRnsMsg (): EncodeObject {
     return this.pH.rnsTx.msgInit({ creator: this.walletRef.getJackalAddress() })
  }
  makeBuyMsg (rns: string): EncodeObject {
    return this.pH.rnsTx.msgBuy({ creator: this.walletRef.getJackalAddress(), name: rns })
  }
  makeDelistMsg (rns: string): EncodeObject {
    return this.pH.rnsTx.msgDelist({ creator: this.walletRef.getJackalAddress(), name: rns })
  }
  makeListMsg (rns: string, price: string): EncodeObject {
    return this.pH.rnsTx.msgList({ creator: this.walletRef.getJackalAddress(), name: rns, price })
  }
  makeTransferMsg (rns: string, receiver: string): EncodeObject {
    return this.pH.rnsTx.msgTransfer({ creator: this.walletRef.getJackalAddress(), name: rns, receiver })
  }

  async findExistingNames (): Promise<INames[]> {
    return (await this.pH.rnsQuery.queryListOwnedNames({ address: this.walletRef.getJackalAddress() })).names
  }
  async findMatchingAddress (rns: string): Promise<string> {
    const trueRns = (rns.endsWith('.jkl')) ? rns.replace(/.jkl$/, '') : rns
    return (await this.pH.rnsQuery.queryNames({ index: trueRns })).names?.value || ''
  }
}
