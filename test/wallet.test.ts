import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Wallet } from '../src/core/wallet'
import { InMemoryKey } from '../src/core/identity'
import { hex } from '@scure/base'
import type { UTXO } from '../src/types/internal'
import type { VirtualCoin } from '../src/types/wallet'

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock EventSource
const MockEventSource = vi.fn().mockImplementation((url: string) => ({
  url,
  onmessage: null,
  onerror: null,
  close: vi.fn()
}))
vi.stubGlobal('EventSource', MockEventSource)

describe('Wallet', () => {
  // Test vector from BIP340
  const mockPrivKeyHex = 'ce66c68f8875c0c98a502c666303dc183a21600130013c06f9d1edf60207abf2'
  // X-only pubkey (without the 02/03 prefix)
  const mockServerKeyHex = '79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798'
  const mockIdentity = InMemoryKey.fromHex(mockPrivKeyHex)

  beforeEach(() => {
    mockFetch.mockReset()
  })

  describe('getBalance', () => {
    const mockUTXOs: UTXO[] = [{
      txid: hex.encode(new Uint8Array(32).fill(1)),
      vout: 0,
      value: 100000,
      status: {
        confirmed: true,
        block_height: 100,
        block_hash: hex.encode(new Uint8Array(32).fill(2)),
        block_time: 1600000000
      }
    }]

    it('should calculate balance from coins', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockUTXOs)
      })

      const wallet = new Wallet({
        network: 'mutinynet',
        identity: mockIdentity,
      })

      const balance = await wallet.getBalance()
      expect(balance.onchain.confirmed).toBe(100000)
      expect(balance.offchain.total).toBe(0)
    })

    it('should include virtual coins when ARK is configured', async () => {
      const mockServerResponse = {
        spendableVtxos: [{
          outpoint: {
            txid: hex.encode(new Uint8Array(32).fill(3)),
            vout: 0
          },
          amount: "50000",
          address: 'tark1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
          roundTxid: hex.encode(new Uint8Array(32).fill(4)),
          spentBy: null,
          expireAt: null,
          swept: false,
          isPending: false,
          redeemTx: null,
          pubkey: mockServerKeyHex,
          createdAt: '2024-01-01T00:00:00Z',
          spent: false
        }],
        spentVtxos: []
      }

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockUTXOs)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockServerResponse)
        })

      const wallet = new Wallet({
        network: 'mutinynet',
        identity: mockIdentity,
        arkServerUrl: 'http://localhost:7070',
        arkServerPublicKey: mockServerKeyHex
      })

      const balance = await wallet.getBalance()
      expect(balance.onchain.confirmed).toBe(100000)
      expect(balance.offchain.settled).toBe(50000)
    })
  })

  describe('getCoins', () => {
    const mockUTXOs: UTXO[] = [{
      txid: hex.encode(new Uint8Array(32).fill(1)),
      vout: 0,
      value: 100000,
      status: {
        confirmed: true,
        block_height: 100,
        block_hash: hex.encode(new Uint8Array(32).fill(2)),
        block_time: 1600000000
      }
    }]

    it('should return coins from provider', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockUTXOs)
      })

      const wallet = new Wallet({
        network: 'mutinynet',
        identity: mockIdentity,
      })

      const coins = await wallet.getCoins()
      expect(coins).toEqual(mockUTXOs)
    })
  })

  describe('sendBitcoin', () => {
    const mockUTXOs = [{
      txid: hex.encode(new Uint8Array(32).fill(1)),
      vout: 0,
      value: 100000,
      status: {
        confirmed: true,
        block_height: 100,
        block_hash: hex.encode(new Uint8Array(32).fill(2)),
        block_time: 1600000000
      }
    }]

    beforeEach(() => {
      mockFetch.mockReset()
    })

    it('should throw error when amount is less than dust', async () => {
      const wallet = new Wallet({
        network: 'mutinynet',
        identity: mockIdentity
      })

      await expect(wallet.sendBitcoin({
        address: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
        amount: 100  // Less than dust
      })).rejects.toThrow('Amount is below dust limit')
    })

    it('should throw error when amount is negative', async () => {
      const wallet = new Wallet({
        network: 'mutinynet',
        identity: mockIdentity
      })

      await expect(wallet.sendBitcoin({
        address: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
        amount: -1000
      })).rejects.toThrow('Amount must be positive')
    })
  })
})