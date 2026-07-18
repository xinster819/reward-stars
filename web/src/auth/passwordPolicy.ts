// 新密码校验：纯函数，返回 i18n key（中文，走 translate()）或 null（合法）。
// 长度下限对齐 Supabase Auth 默认（6 位）；长度校验优先于一致性校验。

export const MIN_PASSWORD_LENGTH = 6

export function passwordError(pw: string, confirm: string): string | null {
  if (pw.length === 0) return '请输入新密码'
  if (pw.length < MIN_PASSWORD_LENGTH) return '密码至少 6 位'
  if (pw !== confirm) return '两次输入的密码不一致'
  return null
}
