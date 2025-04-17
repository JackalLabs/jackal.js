import { IProviderUploadResponse, IUploadDetails } from '@/interfaces'

export interface IUploadHandler {
  upload (details: IUploadDetails, existing: number, copies: number): Promise<IProviderUploadResponse>

  startQueue (): void

  stopQueue (): void
}