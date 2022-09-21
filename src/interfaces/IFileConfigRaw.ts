import IEditorsViewers from './interfaces/IEditorsViewers'

export default interface IFileConfigRaw {
  creator: string,  // SHA256 hash of owner wallet address
  hashpath: string, // SHA256 hash of file path
  contents: string, // SHA256 hash of file id
  viewers: IEditorsViewers,  // object of sha256 hash of wallet address:enc aes key
  editors: IEditorsViewers   // object of sha256 hash of wallet address:enc aes key
}
