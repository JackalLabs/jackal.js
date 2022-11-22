import IValidatorDescription from '@/interfaces/IValidatorDescription'

export default interface IStakingValidator {
  operator_address: string;
  consensus_pubkey: any;
  jailed: boolean;
  status: any;
  tokens: string;
  delegator_shares: string;
  description: IValidatorDescription;
  unbonding_height: string;
  unbonding_time: string;
  commission: {
    commission_rates: {
      rate: string;
      max_rate: string;
      max_change_rate: string;
    };
    update_time: string;
  };
  min_self_delegation: string;
}
