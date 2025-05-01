import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}


// Define constants for swap operations
export const OP_SWAP_A_TO_B = '00';
export const OP_SWAP_B_TO_A = '01';
export const OP_ADD_LIQUIDITY = '02';
export const OP_REMOVE_LIQUIDITY = '03';