export default interface IFileConfigRaw {
  address: string // merkle path of entire file
  contents: string // contents (fid usually)
  owner: string // hashed (uuid + owner)
  editAccess: string // IEditorsViewers, // object of sha256 hash of wallet address:enc aes key
  viewingAccess: string // IEditorsViewers, // object of sha256 hash of wallet address:enc aes key
  trackingNumber: string // uuid
}
