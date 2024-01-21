import type {
  DDeliverTxResponse,
  DFeed,
  TQueryAllFeedsResponseStrict,
} from '@jackallabs/jackal.js-protos'
import type { IPageRequest } from '@/interfaces'

export interface IOracleHandler {
  getFeed(name: string): Promise<DFeed>
  getAllFeeds(pagination?: IPageRequest): Promise<TQueryAllFeedsResponseStrict>
  createFeed(oracleName: string): Promise<DDeliverTxResponse>
  pushToFeed(
    oracleName: string,
    data: Record<string, any>,
  ): Promise<DDeliverTxResponse>
}
