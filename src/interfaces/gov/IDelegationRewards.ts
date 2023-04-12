import ICoin from '@/interfaces/ICoin'

export default interface IDelegationRewards {
  rewards: {validatorAddress: string, reward: ICoin[]}[];
  total: ICoin[];
}
