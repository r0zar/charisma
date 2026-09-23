import { describe, it, expect } from 'vitest';
import { isSubnetFromActive } from './subnet-from';

describe('isSubnetFromActive', () => {
  it('is always on in order mode, since triggered swaps must send from a subnet token', () => {
    expect(isSubnetFromActive('order', false)).toBe(true);
    expect(isSubnetFromActive('order', true)).toBe(true);
  });

  it('follows the user toggle in swap mode', () => {
    expect(isSubnetFromActive('swap', false)).toBe(false);
    expect(isSubnetFromActive('swap', true)).toBe(true);
  });
});
