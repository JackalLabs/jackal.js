export default interface IWalletConfig {
  selectedWallet: string,
  signerChain?: string,
  enabledChains?: string | string[],
  queryAddr?: string,
  txAddr?: string
}
