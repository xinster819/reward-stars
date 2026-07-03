// 家长 PIN 门禁（对位 ParentGateView）：4 圆点 + 数字键盘 + 第 4 位自动校验 + 5 错锁 30 秒。
// 锁定状态存模块级 + 墙钟：关闭弹窗再打开不能绕过锁定（刷新页面仍可绕过，属可接受的软防护，见 D24）。

import { useEffect, useRef, useState } from 'react'
import { useApp } from '../../state/app'
import { Modal } from '../components'

export const MAX_ATTEMPTS = 5
export const LOCKOUT_SECONDS = 30

// 模块级锁定态：同一标签页内跨弹窗生命周期保持
let failedAttemptsGlobal = 0
let lockedUntil = 0 // epoch ms

export function PinGate({ open, onClose, onAuthenticated }: {
  open: boolean
  onClose: () => void
  onAuthenticated: () => void
}) {
  const { repo, t } = useApp()
  const [entered, setEntered] = useState('')
  const [lockRemaining, setLockRemaining] = useState(0)
  const [shaking, setShaking] = useState(false)
  const verifying = useRef(false)

  // 打开时从墙钟恢复剩余锁定；每秒刷新
  useEffect(() => {
    if (!open) {
      setEntered('')
      return
    }
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000))
      setLockRemaining(remaining)
      if (remaining === 0 && lockedUntil !== 0) {
        lockedUntil = 0
        failedAttemptsGlobal = 0
      }
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [open])

  const locked = lockRemaining > 0

  async function append(digit: string) {
    if (locked || verifying.current || entered.length >= 4) return
    const next = entered + digit
    setEntered(next)
    if (next.length < 4) return
    verifying.current = true
    const ok = await repo.verifyPIN(next)
    verifying.current = false
    if (ok) {
      setEntered('')
      failedAttemptsGlobal = 0
      onAuthenticated()
    } else {
      failedAttemptsGlobal += 1
      setShaking(true)
      setTimeout(() => {
        setShaking(false)
        setEntered('')
      }, 400)
      if (failedAttemptsGlobal >= MAX_ATTEMPTS) {
        lockedUntil = Date.now() + LOCKOUT_SECONDS * 1000
        setLockRemaining(LOCKOUT_SECONDS)
      }
    }
  }

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫']

  return (
    <Modal open={open} onClose={onClose}>
      <div className={`flex flex-col items-center gap-4 ${locked ? 'opacity-60' : ''}`}>
        <div className="text-5xl">🔒</div>
        <h2 className="text-lg font-semibold text-gray-800">{t('家长验证')}</h2>
        <p className="text-sm text-gray-500">{t('请输入家长 PIN 进入管理界面')}</p>

        <div className={`flex gap-4 my-2 ${shaking ? 'animate-shake' : ''}`}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={`w-[18px] h-[18px] rounded-full ${i < entered.length ? 'bg-accent' : 'bg-gray-300'}`} />
          ))}
        </div>

        {locked && (
          <p className="text-sm text-negative font-medium">{t('尝试次数过多，请 {n} 秒后再试', { n: lockRemaining })}</p>
        )}

        <div className="grid grid-cols-3 gap-3 w-full max-w-[300px]">
          {keys.map((k, i) =>
            k === '' ? (
              <div key={i} />
            ) : (
              <button
                key={i}
                disabled={locked}
                onClick={() => (k === '⌫' ? setEntered((e) => e.slice(0, -1)) : append(k))}
                className="h-14 rounded-2xl bg-gray-100 text-xl font-semibold text-gray-800 active:bg-gray-200 disabled:pointer-events-none"
              >
                {k}
              </button>
            ),
          )}
        </div>

        <button onClick={onClose} className="text-sm text-gray-400 mt-1">{t('取消')}</button>
      </div>
    </Modal>
  )
}
