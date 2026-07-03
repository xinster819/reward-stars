// 首启引导（对位 OnboardingView/OnboardingSetupView）：4 页轮播可跳过 → 必填设置（孩子名 + 4 位 PIN×2）。

import { useState } from 'react'
import { useApp } from '../../state/app'
import { PrimaryButton, ProgressRing } from '../components'

/** 对位 OnboardingSetup.sanitizedPIN：仅数字、≤4 位。 */
export function sanitizedPIN(input: string): string {
  return input.replace(/\D/g, '').slice(0, 4)
}

const SLIDES = [
  { icon: '⭐', title: '欢迎使用「行为奖励」', caption: '用星星鼓励好行为' },
  { icon: '👨‍👧', title: '两种模式', caption: '孩子看进度，家长来管理' },
  { icon: '✏️', title: '记分', caption: '好行为加分，坏习惯减分' },
  { icon: '🎁', title: '兑换奖励', caption: '攒够星星，换心愿礼物' },
]

export function Onboarding({ onComplete }: { onComplete: (childName: string, pin: string) => Promise<void> }) {
  const { t } = useApp()
  const [page, setPage] = useState(0)
  const [inSetup, setInSetup] = useState(false)
  const [name, setName] = useState('')
  const [pin1, setPin1] = useState('')
  const [pin2, setPin2] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function start() {
    const trimmed = name.trim()
    if (!trimmed) {
      setError(t('名字不能为空'))
      return
    }
    if (pin1.length !== 4) {
      setError(t('请输入 4 位数字 PIN'))
      return
    }
    if (pin1 !== pin2) {
      setError(t('PIN 不一致'))
      return
    }
    setBusy(true)
    try {
      await onComplete(trimmed, pin1)
    } catch (e) {
      // 云端 seed/setPIN 失败：恢复按钮并把原因亮出来，不能让用户卡在禁用态
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  if (inSetup) {
    return (
      <div className="min-h-svh flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm flex flex-col gap-4">
          <div className="text-5xl text-center">🧒</div>
          <h1 className="text-xl font-bold text-gray-800 text-center">{t('开始设置')}</h1>

          <label className="flex flex-col gap-1">
            <span className="text-sm text-gray-500">{t('孩子的名字')}</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('给孩子取个名字')}
              className="rounded-2xl border border-gray-200 bg-card px-4 py-3"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm text-gray-500">{t('家长 PIN（4 位数字）')}</span>
            <input
              type="password" inputMode="numeric" autoComplete="off"
              value={pin1}
              onChange={(e) => setPin1(sanitizedPIN(e.target.value))}
              placeholder={t('输入 PIN')}
              className="rounded-2xl border border-gray-200 bg-card px-4 py-3 tracking-widest"
            />
          </label>
          <input
            type="password" inputMode="numeric" autoComplete="off"
            value={pin2}
            onChange={(e) => setPin2(sanitizedPIN(e.target.value))}
            placeholder={t('再次输入')}
            className="rounded-2xl border border-gray-200 bg-card px-4 py-3 tracking-widest"
          />

          {error && <p className="text-sm text-negative">{error}</p>}

          <PrimaryButton onClick={start} disabled={busy || !name.trim() || pin1.length !== 4 || pin2.length !== 4}>
            {t('开始')}
          </PrimaryButton>
        </div>
      </div>
    )
  }

  const slide = SLIDES[page]
  const last = page === SLIDES.length - 1

  return (
    <div className="min-h-svh flex flex-col items-center justify-between p-6">
      <div className="self-end">
        <button onClick={() => setInSetup(true)} className="text-sm text-gray-400 px-3 py-2">{t('跳过')}</button>
      </div>

      <div className="flex flex-col items-center gap-5 text-center">
        {page === 2 ? (
          <ProgressRing fraction={0.74} size={148}>
            <span className="text-4xl font-bold text-gray-800">74</span>
          </ProgressRing>
        ) : (
          <div className="text-7xl">{slide.icon}</div>
        )}
        <h1 className="text-2xl font-bold text-gray-800">{t(slide.title)}</h1>
        <p className="text-gray-500">{t(slide.caption)}</p>
      </div>

      <div className="flex flex-col items-center gap-5 w-full max-w-sm">
        <div className="flex gap-2">
          {SLIDES.map((_, i) => (
            <div key={i} className={`w-2 h-2 rounded-full ${i === page ? 'bg-accent' : 'bg-gray-300'}`} />
          ))}
        </div>
        <PrimaryButton className="w-full" onClick={() => (last ? setInSetup(true) : setPage(page + 1))}>
          {last ? t('开始设置') : t('继续')}
        </PrimaryButton>
      </div>
    </div>
  )
}
