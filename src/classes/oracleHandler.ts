import { IOracleHandler, IQueryHandler, IWalletHandler } from '@/interfaces/classes'
import { IOracleFeed } from '@/interfaces'

export default class OracleHandler implements IOracleHandler {
  private readonly qH: IQueryHandler

  private constructor(wallet: IWalletHandler) {
    this.qH = wallet.getQueryHandler()
  }

  static async trackOracle(wallet: IWalletHandler): Promise<IOracleHandler> {
    return new OracleHandler(wallet)
  }

  async getFeed(name: string): Promise<IOracleFeed> {
    const result = (await this.qH.oracleQuery.queryFeed({ name })).value.feed
    return result ? result : { owner: 'na', data: 'na', name: 'na' }
  }
  async getAllFeeds(): Promise<IOracleFeed[]> {
    return (await this.qH.oracleQuery.queryAllFeeds({})).value.feed
  }
}
