import { describe, it, expect } from 'vitest'
import { passwordError, MIN_PASSWORD_LENGTH } from '../passwordPolicy'

describe('passwordError', () => {
  it('空密码 → 提示输入', () => {
    expect(passwordError('', '')).toBe('请输入新密码')
  })
  it('不足最小长度 → 提示长度', () => {
    expect(passwordError('12345', '12345')).toBe('密码至少 6 位')
    expect(MIN_PASSWORD_LENGTH).toBe(6)
  })
  it('两次不一致 → 提示不一致（即使各自都合法）', () => {
    expect(passwordError('123456', '123457')).toBe('两次输入的密码不一致')
  })
  it('合法且一致 → null', () => {
    expect(passwordError('123456', '123456')).toBeNull()
    expect(passwordError('a-longer-pass', 'a-longer-pass')).toBeNull()
  })
  it('长度校验优先于一致性校验（短密码先报长度）', () => {
    expect(passwordError('123', '456')).toBe('密码至少 6 位')
  })
  it('恰好达到最小长度 → 通过', () => {
    expect(passwordError('123456', '123456')).toBeNull()
  })
})
