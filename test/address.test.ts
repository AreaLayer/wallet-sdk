import { describe, it, expect } from 'vitest';
import { ArkAddress } from '../src/core/address';
import fixtures from './fixtures/encoding.json';

describe('ArkAddress', () => {
  describe('valid addresses', () => {
    fixtures.address.valid.forEach((fixture) => {
      it(`should correctly decode and encode address ${fixture.addr}`, () => {
        // Test decoding
        const addr = ArkAddress.decode(fixture.addr);
        
        // Check HRP is valid
        expect(['ark', 'tark']).toContain(addr.hrp);
        
        // Check server public key matches expected
        expect(Buffer.from(addr.serverPubKey).toString('hex')).toBe(fixture.expectedServerKey.slice(2)); // Remove '02' prefix
        
        // Check VTXO taproot key matches expected
        expect(Buffer.from(addr.tweakedPubKey).toString('hex')).toBe(fixture.expectedUserKey.slice(2)); // Remove '02' prefix
        
        // Test encoding
        const encoded = addr.encode();
        expect(encoded).toBe(fixture.addr);
      });
    });
  });

  describe('invalid addresses', () => {
    fixtures.address.invalid.forEach((fixture) => {
      it(`should fail to decode invalid address ${fixture.addr}`, () => {
        expect(() => ArkAddress.decode(fixture.addr)).toThrow();
      });
    });
  });
});