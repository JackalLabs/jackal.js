export default interface IFileConfig {
  creator: string,  // SHA256 hash of owner wallet address
  hashpath: string, // SHA256 hash of file path
  contents: string, // SHA256 hash of file id
  viewers: string,  // stringified json of sha256 hash of wallet address:enc aes key
  editors: string   // stringified json of sha256 hash of wallet address:enc aes key
}