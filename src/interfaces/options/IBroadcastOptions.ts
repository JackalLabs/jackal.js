import { TSocketSet } from '@/types'

export interface IBroadcastOptions {
  gasOverride?: number
  memo?: string
  broadcastTimeoutHeight?: bigint
  monitorTimeout?: number
  socketOverrides?: TSocketSet
  queryOverride?: string
  callback?: () => void
}
