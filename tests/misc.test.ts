import { describe, expect, test } from 'vitest';
import {
  tidyString,
  setDelay,
  signerNotEnabled,
  isItPast,
  isItPastDate,
  shuffleArray
} from '@/utils/misc';

describe('Miscellaneous Functions', () => {
  test('tidyString should correctly remove specified characters', () => {
    const testStr = '---hello---'
    expect(tidyString(testStr, '-', 'both')).toBe('hello');
    expect(tidyString(testStr, '-', 'start')).toBe('hello---');
    expect(tidyString(testStr, '-', 'end')).toBe('---hello');
  });

  test('setDelay should delay execution', { timeout: 12000 }, async () => {
    const start = Date.now();
    await setDelay(10); // 10 seconds
    const diff = Date.now() - start;
    expect(diff).toBeGreaterThanOrEqual(10000);
  });

  test('signerNotEnabled should return correct error message', () => {
    expect(signerNotEnabled('TestModule', 'testFunction')).toContain('Signer has not been enabled');
  });

  test('isItPast should return true for past timestamps', () => {
    expect(isItPast(Date.now() - 1000)).toBe(true);
    expect(isItPast(Date.now() + 1000)).toBe(false);
  });

  test('isItPastDate should return true for past dates', () => {
    expect(isItPastDate(new Date(Date.now() - 1000))).toBe(true);
    expect(isItPastDate(new Date(Date.now() + 1000))).toBe(false);
  });

  test('shuffleArray should return an array of the same length', () => {
    const input = [1, 2, 3, 4, 5];
    const shuffled = shuffleArray([...input]);
    expect(shuffled.length).toBe(input.length);
  });
});
