import { rnsTxClient, rnsQueryApi, rnsQueryClient } from 'jackal.js-protos'
import { IRnsHandler, IWalletHandler } from '../interfaces/classes'
import { RnsNames } from 'jackal.js-protos/dist/protos/jackal-dao/canine/jackaldao.canine.rns/module/rest'

export default class RnsHandler implements IRnsHandler {
  private readonly walletRef: IWalletHandler
  readonly txAddr26657: string
  readonly queryAddr1317: string
  private readonly rnsTxClient: any
  private rnsQueryClient: rnsQueryApi<any>

  private constructor (wallet: IWalletHandler, txAddr: string, queryAddr: string, txClient: any, queryClient: rnsQueryApi<any>) {
    this.walletRef = wallet
    this.txAddr26657 = txAddr
    this.queryAddr1317 = queryAddr
    this.rnsTxClient = txClient
    this.rnsQueryClient = queryClient
  }

  static async trackRns (wallet: IWalletHandler): Promise<IRnsHandler> {
    const txAddr = wallet.txAddr26657
    const queryAddr = wallet.queryAddr1317
    const txClient = await rnsTxClient(wallet.getSigner(), { addr: txAddr })
    const queryClient = await rnsQueryClient({ addr: queryAddr })
    return new RnsHandler(wallet, txAddr, queryAddr, txClient, queryClient)
  }

  async findExistingNames (): Promise<RnsNames[]> {
    return (await this.rnsQueryClient.queryListOwnedNames(this.walletRef.getJackalAddress())).data.names || []
  }
}

