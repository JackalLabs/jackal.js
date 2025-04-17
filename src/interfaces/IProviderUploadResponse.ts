export interface IProviderUploadResponse {
  merkle: ArrayBuffer
  owner: string
  start: number
  cid?: string
}

export interface IProviderUploadV2Response {
  job_id: string
}

export interface IProviderStatusResponse {
  merkle: ArrayBuffer
  owner: string
  start: number
  cid: string
  progress: number
}

export type TMergedProviderResponse = IProviderUploadResponse | IProviderUploadV2Response
