export interface IPageRequest {
  key: Uint8Array
  offset: number
  limit: number
  countTotal: boolean
  reverse: boolean
}
