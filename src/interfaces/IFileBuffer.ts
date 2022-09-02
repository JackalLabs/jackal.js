import IFileMeta from '@/interfaces/IFileMeta'

export default interface IFileBuffer {
  content: ArrayBuffer,
  meta: IFileMeta
}