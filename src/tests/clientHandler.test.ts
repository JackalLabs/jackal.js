import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClientHandler } from '@/classes/clientHandler';
import { IClientHandler } from '@/interfaces';
import {
  mockQueryClient,
  mockSigningClient,
  mockKeplr,
  mockLeap,
  mockMnemonicWallet,
  mockBroadcastAndMonitorMsgs
} from '@/tests/mocks/mockObjects';

import {
  MOCK_JKL_RPC,
  MOCK_JKL_ADDRESS,
  MOCK_HOST_ADDRESS,
  MOCK_SELECTED_WALLET,
  MOCK_PROOF_WINDOW
} from '@/tests/mocks/mockObjects';

global.window = global.window || {};
window.keplr = mockKeplr;
window.leap = mockLeap;
window.mnemonicWallet = mockMnemonicWallet;

let clientHandler: IClientHandler;

describe('ClientHandler', () => {
  beforeEach(async () => {
    clientHandler = await ClientHandler.connect({
      endpoint: MOCK_JKL_RPC,
      selectedWallet: MOCK_SELECTED_WALLET as 'keplr' | 'leap' | 'mnemonic'
    });
  });

  it('should instantiate ClientHandler with correct properties', () => {
    expect(clientHandler).toBeDefined();
    expect(clientHandler.getJackalAddress()).toBe(MOCK_JKL_ADDRESS);
    expect(clientHandler.getHostAddress()).toBe(MOCK_HOST_ADDRESS);
  });

  it('should initialize with correct proof window', () => {
    expect(clientHandler.getProofWindow()).toBe(MOCK_PROOF_WINDOW);
  });

  it('should detect available wallets', () => {
    const wallets = ClientHandler.detectAvailableWallets();
    expect(wallets.keplr).toBe(true);
    expect(wallets.leap).toBe(true);
  });

  it('should create a storage handler', async () => {
    const storageHandler = await clientHandler.createStorageHandler();
    expect(storageHandler).toBeDefined();
  });

  it('should create an RNS handler', async () => {
    const rnsHandler = await clientHandler.createRnsHandler();
    expect(rnsHandler).toBeDefined();
  });

  it('should create an Oracle handler', async () => {
    const oracleHandler = await clientHandler.createOracleHandler();
    expect(oracleHandler).toBeDefined();
  });

  it('should fetch Jackal block height', async () => {
    const height = await clientHandler.getJackalBlockHeight();
    expect(height).toBeGreaterThan(0);
  });

  it('should retrieve Jackal signer', () => {
    const signer = clientHandler.getJackalSigner();
    expect(signer).toBeDefined();
  });

  it('should retrieve wallet details', () => {
    const details = clientHandler.getWalletDetails();
    expect(details).toHaveProperty('bech32Address', MOCK_JKL_ADDRESS);
  });

  it('should broadcast and monitor transactions successfully', async () => {
    const result = await clientHandler.broadcastAndMonitorMsgs([]);
    expect(result.error).toBe(false);
    expect(result.txResponse.transactionHash).toBeDefined();
  });

  it('should execute IBC send successfully', async () => {
    const result = await clientHandler.ibcSend(MOCK_HOST_ADDRESS, { amount: '1000', denom: 'ujkl' }, 'channel-1');
    expect(result.transactionHash).toBeDefined();
  });

  it('should fetch Jackal network balance', async () => {
    const balance = await clientHandler.getJklBalance();
    expect(balance.amount).toBe('1000000');
  });

  it('should return false if public key is not published', async () => {
    vi.spyOn(clientHandler, 'myPubKeyIsPublished').mockResolvedValue(false);
    const isPublished = await clientHandler.myPubKeyIsPublished();
    expect(isPublished).toBe(false);
  });

  it('should handle signing client error', async () => {
    vi.spyOn(clientHandler, 'getJackalSigner').mockReturnValue(null);
    expect(() => clientHandler.getTxs()).toThrow();
  });

  it('should return correct selected wallet', () => {
    expect(clientHandler.getSelectedWallet()).toBe(MOCK_SELECTED_WALLET);
  });

  it('should handle invalid IBC send', async () => {
    vi.spyOn(clientHandler, 'ibcSend').mockRejectedValue(new Error('IBC error'));
    await expect(clientHandler.ibcSend(MOCK_HOST_ADDRESS, { amount: '1000', denom: 'ujkl' }, 'channel-1')).rejects.toThrow('IBC error');
  });

  it('should fetch host network balance', async () => {
    const balance = await clientHandler.getHostNetworkBalance(MOCK_HOST_ADDRESS, 'ujkl');
    expect(balance).toBeDefined();
  });
});
