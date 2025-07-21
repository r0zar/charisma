/**
 * Tests for contract ID validators
 */

import { describe, it, expect } from 'vitest';
import {
  isValidContractId,
  isValidPrincipal,
  isValidContractName,
  areValidContractIds,
  extractPrincipal,
  extractContractName
} from '../../utils/validators';

describe('Contract ID Validators', () => {
  describe('isValidContractId', () => {
    it('should validate real mainnet contract IDs', () => {
      const validIds = [
        'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token',
        'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.zststxbtc-v2_v2-0',
        'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.xyk-pool-stx-shark-v-1-1',
        'SP6P4EJF0VG8V0RB3TQQKJBHDQKEF6NVRD1KZE3C.charisma-token',
        'SP1K1A1PMGW2ZJCNF46NWZWHG8TS1D23EGH1KNK60.crashpunks-v2',
        'SP331D6T77PNS2YZXR03CDC4G3XN0SYBPV69D8JW5.xyk-pool-sbtc-beast1-v-1-1'
      ];

      validIds.forEach(id => {
        expect(isValidContractId(id)).toBe(true);
      });
    });

    it('should reject invalid contract IDs', () => {
      const invalidIds = [
        '', // empty
        'SP123', // no dot
        'SP123.', // empty contract name
        '.contract', // empty principal
        'SP123.contract.extra', // multiple dots
        'SP123.Contract', // uppercase in contract name
        'sp123.contract', // lowercase SP
        'SP123.contract-', // ends with hyphen
        'SP123._contract', // starts with underscore
        'SP123.contract name', // space in name
        'XX123456789ABCDEFGHIJKLMNOP.contract', // invalid principal prefix
        'SP.contract' // principal too short
      ];

      invalidIds.forEach(id => {
        expect(isValidContractId(id)).toBe(false);
      });
    });
  });

  describe('isValidPrincipal', () => {
    it('should validate real mainnet principals', () => {
      const validPrincipals = [
        'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS',
        'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR',
        'SP6P4EJF0VG8V0RB3TQQKJBHDQKEF6NVRD1KZE3C'
      ];

      validPrincipals.forEach(principal => {
        expect(isValidPrincipal(principal)).toBe(true);
      });
    });

    it('should reject invalid principals', () => {
      const invalidPrincipals = [
        'sp123456789abcdefghijklmnop', // lowercase prefix
        'XX123456789ABCDEFGHIJKLMNOP', // invalid prefix
        'SP', // too short
        'SPO123456789ABCDEFGHIJKLMNOP', // contains O (invalid base58)
        'SPI123456789ABCDEFGHIJKLMNOP', // contains I (invalid base58)
        'SPl123456789ABCDEFGHIJKLMNOP', // contains l (invalid base58)
        'SP123@456789ABCDEFGHIJKLMNOP', // contains invalid character
        'SP123 456789ABCDEFGHIJKLMNOP', // contains space
        'SP' + 'A'.repeat(50) // too long
      ];

      invalidPrincipals.forEach(principal => {
        expect(isValidPrincipal(principal)).toBe(false);
      });
    });
  });

  describe('isValidContractName', () => {
    it('should validate real contract names', () => {
      const validNames = [
        'charisma-token',
        'zststxbtc-v2_v2-0',
        'xyk-pool-stx-shark-v-1-1',
        'crashpunks-v2',
        'token123',
        'a', // minimum length
        'a'.repeat(128) // maximum length
      ];

      validNames.forEach(name => {
        expect(isValidContractName(name)).toBe(true);
      });
    });

    it('should reject invalid contract names', () => {
      const invalidNames = [
        '', // empty
        'Contract', // uppercase
        '-contract', // starts with hyphen
        'contract-', // ends with hyphen
        '_contract', // starts with underscore
        'contract_', // ends with underscore
        'contract name', // space
        'contract@name', // invalid character
        'a'.repeat(129) // too long
      ];

      invalidNames.forEach(name => {
        expect(isValidContractName(name)).toBe(false);
      });
    });
  });

  describe('Helper functions', () => {
    it('should extract principal correctly', () => {
      const contractId = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token';
      expect(extractPrincipal(contractId)).toBe('SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS');
      expect(extractPrincipal('invalid')).toBe(null);
    });

    it('should extract contract name correctly', () => {
      const contractId = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token';
      expect(extractContractName(contractId)).toBe('charisma-token');
      expect(extractContractName('invalid')).toBe(null);
    });

    it('should validate arrays of contract IDs', () => {
      const validIds = [
        'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token',
        'SP6P4EJF0VG8V0RB3TQQKJBHDQKEF6NVRD1KZE3C.another-token'
      ];
      
      expect(areValidContractIds(validIds)).toBe(true);
      expect(areValidContractIds(['invalid'])).toBe(false);
      expect(areValidContractIds([])).toBe(false);
    });
  });
});