import { IOracleFeed } from '@/interfaces'

export default interface IOracleHandler {
  getFeed(name: string): Promise<IOracleFeed>
  getAllFeeds(): Promise<IOracleFeed[]>
}
