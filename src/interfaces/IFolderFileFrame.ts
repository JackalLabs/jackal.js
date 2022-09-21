import IFileMeta from '@/interfaces/IFileMeta'

export default interface IFolderFileFrame {
  whoAmI: string,
  dirChildren: string[],
  fileChildren: { [name: string]: IFileMeta }
}
