import { IProviderUploadResponse, IUploadDetails } from '@/interfaces'

export interface IUploadHandler {
  upload (details: IUploadDetails, existing: number, copies = 2): Promise<IProviderUploadResponse>

  startQueue (): void

  stopQueue (): void
}