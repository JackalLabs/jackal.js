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
    expect(tidyString('---hello---', '-', 'both')).toBe('hello');
    expect(tidyString('---hello', '-', 'start')).toBe('hello');
    expect(tidyString('hello---', '-', 'end')).toBe('hello');
  });

  test('setDelay should delay execution', async () => {
    const start = Date.now();
    await setDelay(10); // 10ms
    const diff = Date.now() - start;
    expect(diff).toBeGreaterThanOrEqual(10);
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
