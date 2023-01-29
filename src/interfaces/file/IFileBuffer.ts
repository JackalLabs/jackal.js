import IFileDetails from '@/interfaces/file/IFileDetails'

export default interface IFileBuffer {
  content: ArrayBuffer,
  details: IFileDetails
}
