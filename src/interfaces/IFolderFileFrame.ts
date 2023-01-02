import IFileMeta from '@/interfaces/IFileMeta'

export default interface IFolderFileFrame {
  whoAmI: string,
  whereAmI: string,
  whoOwnsMe: string,
  dirChildren: string[],
  fileChildren: { [name: string]: IFileMeta }
}
