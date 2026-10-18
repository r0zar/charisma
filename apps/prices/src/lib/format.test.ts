import { describe, expect, it } from 'vitest';
import { formatPrice } from './format';

describe('formatPrice', () => {
  it('reads a price just under $1 that rounds up as $1.00', () => {
    expect(formatPrice(0.99996)).toBe('$1.00');
  });

  it('keeps about 4 significant digits below $1', () => {
    expect(formatPrice(0.9358)).toBe('$0.9358');
    expect(formatPrice(0.000001437)).toBe('$0.0₅1437');
  });
});
