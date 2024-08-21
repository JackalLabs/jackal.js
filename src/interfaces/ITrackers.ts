export interface IDownloadTracker {
  progress: number
  chunks: Uint8Array[]
}
