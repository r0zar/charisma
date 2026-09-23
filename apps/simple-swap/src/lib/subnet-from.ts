/**
 * Whether the "from" side of the swap is operating on the subnet token.
 * Triggered swaps (order mode) can only send from a subnet token, so the
 * toggle is forced on there and only user-controlled in swap mode.
 */
export function isSubnetFromActive(mode: 'swap' | 'order', useSubnetFrom: boolean): boolean {
  return mode === 'order' || useSubnetFrom;
}
