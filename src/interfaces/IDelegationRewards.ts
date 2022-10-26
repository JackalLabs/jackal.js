import ICoin from './ICoin'

export default interface IDelegationRewards {
  rewards: {validator_address: string, reward: ICoin[]}[];
  total: ICoin[];
}
