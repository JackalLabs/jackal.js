import { describe, expect, test } from 'vitest';
import { estimateGas, finalizeGas } from '@/utils/gas';
import { IWrappedEncodeObject } from '@/interfaces';
import { EncodeObject } from '@cosmjs/proto-signing';

const mockEncodedObject: EncodeObject = {
  typeUrl: '/canine_chain.filetree.MsgPostFile',
  value: {}, 
};

describe('Gas Calculation', () => {
  test('estimateGas should return expected values', () => {
    const mockMsgArray: IWrappedEncodeObject[] = [
      { encodedObject: mockEncodedObject, modifier: 0 }
    ];
    expect(estimateGas(mockMsgArray)).toBe(326); 
  });

  test('finalizeGas should return structured gas object', () => {
    const mockMsgArray: IWrappedEncodeObject[] = [
      { encodedObject: mockEncodedObject, modifier: 0 }
    ];
    const gasObj = finalizeGas(mockMsgArray, 1);
    expect(gasObj).toHaveProperty('fee');
    expect(gasObj.fee.amount[0].denom).toBe('ujkl');
    expect(gasObj.msgs).toHaveLength(1);
  });

  test('finalizeGas should correctly apply gas multiplier', () => {
    const mockMsgArray: IWrappedEncodeObject[] = [
      { encodedObject: mockEncodedObject, modifier: 0 }
    ];
    const gasObj = finalizeGas(mockMsgArray, 2);
    expect(parseInt(gasObj.fee.gas)).toBe(652); 
  });

  test('estimateGas should correctly handle unknown messages', () => {
    const unknownMsg: IWrappedEncodeObject = {
      encodedObject: { typeUrl: '/unknown.MsgType', value: {} }, 
      modifier: 0
    };
    expect(estimateGas([unknownMsg])).toBe(198); 
  });

  test('finalizeGas should apply override when provided', () => {
    const mockMsgArray: IWrappedEncodeObject[] = [
      { encodedObject: mockEncodedObject, modifier: 0 }
    ];
    const gasObj = finalizeGas(mockMsgArray, 1, 500);
    expect(parseInt(gasObj.fee.gas)).toBe(500);
  });

  test('estimateGas should throw an error for invalid objects', () => {
    expect(() => estimateGas([{ encodedObject: {} as any, modifier: 0 }])).toThrow();
  });
});
