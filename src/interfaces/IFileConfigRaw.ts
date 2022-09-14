export default interface IFileConfigRaw {
  creator: string,  // SHA256 hash of owner wallet address
  hashpath: string, // SHA256 hash of file path
  contents: string, // SHA256 hash of file id
  viewers: { [key: string]: string },  // object of sha256 hash of wallet address:enc aes key
  editors: { [key: string]: string }   // object of sha256 hash of wallet address:enc aes key
}