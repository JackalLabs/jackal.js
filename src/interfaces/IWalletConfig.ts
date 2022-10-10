export default interface IWalletConfig {
  signerChain?: string,
  enabledChains?: string | string[],
  queryAddr?: string,
  txAddr?: string
}
