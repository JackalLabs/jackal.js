export default interface IEncryptedPack {
  encFile: File,
  iv: Uint8Array,
  key: Uint8Array
}