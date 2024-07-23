export interface IProviderPool extends Record<string, IProviderTraits[]> {}

export interface IProviderTraits {
  ip: string
  failures: number
}

export interface IProviderIpSet extends Record<string, string> {}
