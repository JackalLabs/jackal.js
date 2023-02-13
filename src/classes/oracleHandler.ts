import { IProtoHandler, IOracleHandler, IWalletHandler } from '@/interfaces/classes'
import { IOracleFeed } from '@/interfaces'

export default class OracleHandler implements IOracleHandler {
  private readonly walletRef: IWalletHandler
  private readonly pH: IProtoHandler

  private constructor (wallet: IWalletHandler) {
    this.walletRef = wallet
    this.pH = wallet.getProtoHandler()
  }

  static async trackOracle (wallet: IWalletHandler): Promise<IOracleHandler> {
    return new OracleHandler(wallet)
  }

  async getFeed (name: string): Promise<IOracleFeed> {
    const result = (await this.pH.oracleQuery.queryFeed({ name })).value.feed
    return (result) ? result : { owner: 'na', data: 'na', name: 'na' }
  }
  async getAllFeeds (): Promise<IOracleFeed[]> {
    return (await this.pH.oracleQuery.queryAllFeeds({})).value.feed
  }
}
