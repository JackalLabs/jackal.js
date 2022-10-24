export default interface IStakingValidator {
  operator_address: string;
  consensus_pubkey: any;
  jailed: boolean;
  status: any;
  tokens: string;
  delegator_shares: string;
  description: any;
  unbonding_height: string;
  unbonding_time: string;
  commission: any;
  min_self_delegation: string;
}
