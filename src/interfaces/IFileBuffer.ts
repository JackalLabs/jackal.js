import IFileDetails from './IFileDetails'

export default interface IFileBuffer {
  content: ArrayBuffer,
  details: IFileDetails
}
