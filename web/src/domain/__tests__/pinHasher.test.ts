import { describe, expect, it } from 'vitest'
import { encodePinBlob, hashPin, makeSalt, verifyPinBlob } from '../pinHasher'

describe('PINHasher', () => {
  const salt = new Uint8Array(16).fill(7)

  it('same input produces same hash', async () => {
    const a = await hashPin('1234', salt)
    const b = await hashPin('1234', salt)
    expect(a).toEqual(b)
  })

  it('different pin produces different hash', async () => {
    const a = await hashPin('1234', salt)
    const b = await hashPin('1235', salt)
    expect(a).not.toEqual(b)
  })

  it('different salt produces different hash', async () => {
    const other = new Uint8Array(16).fill(9)
    const a = await hashPin('1234', salt)
    const b = await hashPin('1234', other)
    expect(a).not.toEqual(b)
  })

  it('hash is SHA-256 length (32 bytes)', async () => {
    expect((await hashPin('1234', salt)).length).toBe(32)
    expect(makeSalt().length).toBe(16)
  })

  it('pin blob roundtrip verifies correct pin only', async () => {
    const blob = await encodePinBlob('1234')
    expect(await verifyPinBlob('1234', blob)).toBe(true)
    expect(await verifyPinBlob('0000', blob)).toBe(false)
    expect(await verifyPinBlob('1234', 'not-a-blob')).toBe(false)
  })
})
