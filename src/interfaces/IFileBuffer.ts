import IFileDetails from './interfaces/IFileDetails'

export default interface IFileBuffer {
  content: ArrayBuffer,
  details: IFileDetails
}
