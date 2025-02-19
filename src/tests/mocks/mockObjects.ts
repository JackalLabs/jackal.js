import mockConfig from "./mockConfig.json";
import { vi } from "vitest";

export const MOCK_JKL_RPC = mockConfig.MOCK_JKL_RPC;
export const MOCK_HOST_RPC = mockConfig.MOCK_HOST_RPC;
export const MOCK_JKL_ADDRESS = mockConfig.MOCK_JKL_ADDRESS;
export const MOCK_HOST_ADDRESS = mockConfig.MOCK_HOST_ADDRESS;
export const MOCK_MNEMONIC = mockConfig.MOCK_MNEMONIC;
export const MOCK_CONTRACT_ADDRESS = mockConfig.MOCK_CONTRACT_ADDRESS;
export const MOCK_CONNECTION_ID_A = mockConfig.MOCK_CONNECTION_ID_A;
export const MOCK_CONNECTION_ID_B = mockConfig.MOCK_CONNECTION_ID_B;
export const MOCK_GAS_MULTIPLIER = mockConfig.MOCK_GAS_MULTIPLIER || 1.5;
export const MOCK_PROOF_WINDOW = mockConfig.MOCK_PROOF_WINDOW || 7200;
export const MOCK_TX_HASH = mockConfig.MOCK_TX_HASH || "mockhash";
export const MOCK_BLOCK_HEIGHT = mockConfig.MOCK_BLOCK_HEIGHT || 123456;
export const MOCK_SELECTED_WALLET = mockConfig.MOCK_SELECTED_WALLET.toLowerCase() as 'keplr' | 'leap' | 'mnemonic';

export const mockQueryClient = {
  queries: {
    storage: {
      params: vi.fn().mockResolvedValue({ params: { proofWindow: MOCK_PROOF_WINDOW } })
    },
    bank: {
      balance: vi.fn().mockResolvedValue({ balance: { amount: "1000000", denom: "ujkl" } })
    },
    oracle: {
      feed: vi.fn().mockResolvedValue({ feed: { name: "test-oracle", value: "42" } }),
      allFeeds: vi.fn().mockResolvedValue({ feeds: [{ name: "test-oracle", value: "42" }] })
    },
    rns: {
      name: vi.fn().mockResolvedValue({ name: { value: MOCK_JKL_ADDRESS, data: "{}" } }),
      primaryName: vi.fn().mockResolvedValue({ name: { value: "primary.jkl", data: "{}" } })
    }
  }
};

export const mockSigningClient = {
  txLibrary: {
    oracle: {
      msgCreateFeed: vi.fn().mockReturnValue({ typeUrl: "/oracle.MsgCreateFeed", value: {} }),
      msgUpdateFeed: vi.fn().mockReturnValue({ typeUrl: "/oracle.MsgUpdateFeed", value: {} })
    },
    rns: {
      msgRegisterName: vi.fn().mockReturnValue({ typeUrl: "/rns.MsgRegisterName", value: {} }),
      msgTransfer: vi.fn().mockReturnValue({ typeUrl: "/rns.MsgTransfer", value: {} })
    },
    cosmwasm: {
      msgExecuteContract: vi.fn().mockReturnValue({ typeUrl: "/cosmwasm.MsgExecuteContract", value: {} })
    }
  },
  signAndBroadcast: vi.fn().mockResolvedValue({ code: 0, height: MOCK_BLOCK_HEIGHT, transactionHash: MOCK_TX_HASH }),
  sendIbcTokens: vi.fn().mockResolvedValue({ code: 0, height: MOCK_BLOCK_HEIGHT, transactionHash: "ibchash" }),
  getHeight: vi.fn().mockResolvedValue(MOCK_BLOCK_HEIGHT)
};

export const mockKeplr = {
  experimentalSuggestChain: vi.fn(),
  enable: vi.fn(),
  getOfflineSignerAuto: vi.fn().mockReturnValue({
    getAccounts: vi.fn().mockResolvedValue([{ address: MOCK_JKL_ADDRESS }]),
    signAmino: vi.fn(),
    signDirect: vi.fn()
  }),
  getKey: vi.fn().mockResolvedValue({ bech32Address: MOCK_JKL_ADDRESS })
};

export const mockLeap = {
  ...mockKeplr,
  getOfflineSigner: vi.fn().mockReturnValue({
    getAccounts: vi.fn().mockResolvedValue([{ address: MOCK_JKL_ADDRESS }]),
    signAmino: vi.fn(),
    signDirect: vi.fn()
  })
};

export const mockMnemonicWallet = {
  getOfflineSigner: vi.fn().mockReturnValue(mockSigningClient),
  getAddress: vi.fn().mockReturnValue(MOCK_JKL_ADDRESS),
  mergedSigner: {},
  signArbitrary: vi.fn(),
  address: MOCK_JKL_ADDRESS
};

export const mockFinalizedGas = vi.fn((msgs, gasMultiplier, override) => ({
  fee: { amount: [{ amount: "5000", denom: "ujkl" }], gas: "200000" },
  msgs
}));

export const mockWarnError = vi.fn((msg, err) => console.warn(msg, err));

export const mockSetDelay = vi.fn().mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 100)));

export const mockMakeConnectionBundles = vi.fn().mockReturnValue([]);

export const mockBroadcastAndMonitorMsgs = vi.fn().mockResolvedValue({
  error: false,
  errorText: "",
  txResponse: { code: 0, height: MOCK_BLOCK_HEIGHT, transactionHash: MOCK_TX_HASH },
  txEvents: []
});
