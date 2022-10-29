import { IRnsHandler, IWalletHandler } from '../interfaces/classes'
import { RnsNames } from 'jackal.js-protos/dist/protos/jackal-dao/canine/jackaldao.canine.rns/module/rest'

export default class RnsHandler implements IRnsHandler {
  private readonly walletRef: IWalletHandler
  private readonly pH: any

  private constructor (wallet: IWalletHandler) {
    this.walletRef = wallet
    this.pH = wallet.pH
  }

  static async trackRns (wallet: IWalletHandler): Promise<IRnsHandler> {
    return new RnsHandler(wallet)
  }

  async findExistingNames (): Promise<RnsNames[]> {
    return (await this.pH.rnsQuery.queryListOwnedNames(this.walletRef.getJackalAddress())).data.names || []
  }
  async findMatchingAddress (rns: string): Promise<string> {
    const trueRns = (rns.endsWith('.jkl')) ? rns : `${rns}.jkl`
    return (await this.pH.rnsQuery.queryNames(trueRns)).data.names?.value || ''
  }
}

