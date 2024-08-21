/**
 * This file was automatically generated by @cosmwasm/ts-codegen@0.35.7.
 * DO NOT MODIFY IT BY HAND. Instead, modify the source JSONSchema file,
 * and run the @cosmwasm/ts-codegen generate command to regenerate this file.
 */

export type TxEncoding = "proto3" | "proto3json";
export interface InstantiateMsg {
  admin?: string | null;
  channel_open_init_options?: ChannelOpenInitOptions | null;
}
export interface ChannelOpenInitOptions {
  connection_id: string;
  counterparty_connection_id: string;
  counterparty_port_id?: string | null;
  tx_encoding?: TxEncoding | null;
}
export type ExecuteMsg = {
  create_channel: ChannelOpenInitOptions;
} | {
  create_transfer_channel: ChannelOpenInitOptions;
} | {
  send_cosmos_msgs: {
    messages: CosmosMsgForEmpty[];
    packet_memo?: string | null;
    timeout_seconds?: number | null;
  };
} | {
  send_cosmos_msgs_cli: {
    packet_memo?: string | null;
    path: string;
    timeout_seconds?: number | null;
  };
} | {
  send_transfer_msg: {
    packet_memo?: string | null;
    recipient: string;
    timeout_seconds?: number | null;
  };
};
export type CosmosMsgForEmpty = {
  bank: BankMsg;
} | {
  custom: Empty;
} | {
  stargate: {
    type_url: string;
    value: Binary;
    [k: string]: unknown;
  };
} | {
  ibc: IbcMsg;
} | {
  wasm: WasmMsg;
} | {
  gov: GovMsg;
};
export type BankMsg = {
  send: {
    amount: Coin[];
    to_address: string;
    [k: string]: unknown;
  };
} | {
  burn: {
    amount: Coin[];
    [k: string]: unknown;
  };
};
export type Uint128 = string;
export type Binary = string;
export type IbcMsg = {
  transfer: {
    amount: Coin;
    channel_id: string;
    timeout: IbcTimeout;
    to_address: string;
    [k: string]: unknown;
  };
} | {
  send_packet: {
    channel_id: string;
    data: Binary;
    timeout: IbcTimeout;
    [k: string]: unknown;
  };
} | {
  close_channel: {
    channel_id: string;
    [k: string]: unknown;
  };
};
export type Timestamp = Uint64;
export type Uint64 = string;
export type WasmMsg = {
  execute: {
    contract_addr: string;
    funds: Coin[];
    msg: Binary;
    [k: string]: unknown;
  };
} | {
  instantiate: {
    admin?: string | null;
    code_id: number;
    funds: Coin[];
    label: string;
    msg: Binary;
    [k: string]: unknown;
  };
} | {
  instantiate2: {
    admin?: string | null;
    code_id: number;
    funds: Coin[];
    label: string;
    msg: Binary;
    salt: Binary;
    [k: string]: unknown;
  };
} | {
  migrate: {
    contract_addr: string;
    msg: Binary;
    new_code_id: number;
    [k: string]: unknown;
  };
} | {
  update_admin: {
    admin: string;
    contract_addr: string;
    [k: string]: unknown;
  };
} | {
  clear_admin: {
    contract_addr: string;
    [k: string]: unknown;
  };
};
export type GovMsg = {
  vote: {
    proposal_id: number;
    vote: VoteOption;
    [k: string]: unknown;
  };
} | {
  vote_weighted: {
    options: WeightedVoteOption[];
    proposal_id: number;
    [k: string]: unknown;
  };
};
export type VoteOption = "yes" | "no" | "abstain" | "no_with_veto";
export type Decimal = string;
export interface Coin {
  amount: Uint128;
  denom: string;
  [k: string]: unknown;
}
export interface Empty {
  [k: string]: unknown;
}
export interface IbcTimeout {
  block?: IbcTimeoutBlock | null;
  timestamp?: Timestamp | null;
  [k: string]: unknown;
}
export interface IbcTimeoutBlock {
  height: number;
  revision: number;
  [k: string]: unknown;
}
export interface WeightedVoteOption {
  option: VoteOption;
  weight: Decimal;
  [k: string]: unknown;
}
export type QueryMsg = {
  get_channel: {};
} | {
  get_contract_state: {};
} | {
  get_callback_counter: {};
};
export interface CallbackCounter {
  error: number;
  success: number;
  timeout: number;
}
export type IbcOrder = "ORDER_UNORDERED" | "ORDER_ORDERED";
export type ChannelStatus = "STATE_UNINITIALIZED_UNSPECIFIED" | "STATE_INIT" | "STATE_TRYOPEN" | "STATE_OPEN" | "STATE_CLOSED";
export interface ChannelState {
  channel: IbcChannel;
  channel_status: ChannelStatus;
}
export interface IbcChannel {
  connection_id: string;
  counterparty_endpoint: IbcEndpoint;
  endpoint: IbcEndpoint;
  order: IbcOrder;
  version: string;
  [k: string]: unknown;
}
export interface IbcEndpoint {
  channel_id: string;
  port_id: string;
  [k: string]: unknown;
}
export type Addr = string;
export interface ContractState {
  admin: Addr;
  allow_channel_open_init?: boolean;
  ica_info?: IcaInfo | null;
}
export interface IcaInfo {
  channel_id: string;
  encoding: TxEncoding;
  ica_address: string;
}