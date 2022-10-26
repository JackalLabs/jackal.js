import IEditorsViewers from './IEditorsViewers'
import IFiletreeParsedContents from './IFiletreeParsedContents'

export default interface IFileConfigFull {
  address: string; // merkle path of entire file
  contents: IFiletreeParsedContents; // contents (fid usually)
  owner: string; // hashed (uuid + owner)
  editAccess: IEditorsViewers, // object of sha256 hash of wallet address:enc aes key
  viewingAccess: IEditorsViewers, // object of sha256 hash of wallet address:enc aes key
  trackingNumber: string // uuid
}
