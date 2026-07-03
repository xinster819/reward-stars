// 应用外壳：加载 → 引导（首启）→ 角色 Tab（孩子默认只读 / PIN 解锁家长）——对位 RootView + Child/ParentTabView。

import { useEffect, useState, type ReactNode } from 'react'
import { AppProvider, useApp, useData, type DataMode } from './state/app'
import type { RewardRepo } from './data/repository'
import { PinGate } from './ui/auth/PinGate'
import { Onboarding } from './ui/onboarding/Onboarding'
import { ChildHistory, ChildStore, ChildToday } from './ui/child/pages'
import { ParentHistory, ParentOverview, ParentRewards, ParentRules, ParentScoring, ParentSettings } from './ui/parent/pages'

export default function App({ repo, mode, signOut }: { repo: RewardRepo; mode: DataMode; signOut?: () => Promise<void> }) {
  return (
    <AppProvider repo={repo} mode={mode} signOut={signOut}>
      <Shell />
    </AppProvider>
  )
}

function Shell() {
  const { repo, t, lang, role, enterParent, switchToChild } = useApp()
  const snap = useData()
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [gateOpen, setGateOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [tab, setTab] = useState(0)

  useEffect(() => {
    setLoadState('loading')
    repo.ready().then(() => setLoadState('ready'), () => setLoadState('error'))
  }, [repo])

  // 页面重获焦点/可见时主动校准（云端补 realtime 盲区；本地同步多标签页）
  useEffect(() => {
    const onFocus = () => void repo.refresh()
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [repo])

  if (loadState === 'loading') {
    return <div className="min-h-svh flex items-center justify-center text-4xl animate-pulse">⭐</div>
  }

  if (loadState === 'error') {
    // 首拉失败 ≠ 新家庭：绝不能走引导（会覆盖云端已有 PIN/数据），只给重试
    return (
      <div className="min-h-svh flex flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="text-5xl">📡</div>
        <p className="text-gray-600">Network error / 网络异常</p>
        <button onClick={() => location.reload()} className="rounded-2xl bg-accent text-white font-semibold px-6 py-3">
          Retry / 重试
        </button>
      </div>
    )
  }

  // 引导门：云端若已被别的设备初始化（有孩子+PIN），此条件自然为假 → 本设备直接进应用
  if (!snap.child || !repo.isPINSet()) {
    return (
      <Onboarding
        onComplete={async (childName, pin) => {
          await repo.seedIfEmpty(childName)
          await repo.renameChild(childName)
          await repo.setPIN(pin)
        }}
      />
    )
  }

  const childTabs: [string, string, ReactNode][] = [
    ['🏠', t('今天'), <ChildToday key="t" />],
    ['🎁', t('奖励'), <ChildStore key="s" />],
    ['📊', t('记录'), <ChildHistory key="h" />],
  ]
  const parentTabs: [string, string, ReactNode][] = [
    ['📋', t('总览'), <ParentOverview key="o" />],
    ['✏️', t('记分'), <ParentScoring key="sc" />],
    ['📏', t('规则'), <ParentRules key="ru" />],
    ['🎁', t('奖励'), <ParentRewards key="rw" />],
    ['🕘', t('历史'), <ParentHistory key="hi" />],
  ]
  const tabs = role === 'child' ? childTabs : parentTabs
  const current = Math.min(tab, tabs.length - 1)

  return (
    <div className="min-h-svh max-w-2xl mx-auto flex flex-col">
      <header className="flex items-center justify-between px-4 pt-4 pb-1">
        <span className="font-bold text-gray-800">⭐ {lang === 'zh' ? '行为奖励' : 'Reward Stars'}</span>
        {role === 'child' ? (
          <button onClick={() => setGateOpen(true)} className="text-xl px-2 py-1" title={t('家长入口')}>🔒</button>
        ) : (
          <div className="flex gap-1">
            <button onClick={() => setSettingsOpen(true)} className="text-xl px-2 py-1" title={t('家长设置')}>⚙️</button>
            <button onClick={() => { switchToChild(); setTab(0) }} className="text-xl px-2 py-1" title={t('退出家长模式')}>👋</button>
          </div>
        )}
      </header>

      <main className="flex-1 px-4 py-3 pb-24">
        {tabs[current][2]}
      </main>

      <nav className="fixed bottom-0 inset-x-0 bg-card/95 backdrop-blur border-t border-gray-100">
        <div className="max-w-2xl mx-auto flex">
          {tabs.map(([icon, label], i) => (
            <button
              key={label}
              onClick={() => setTab(i)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] text-xs ${i === current ? 'text-accent font-semibold' : 'text-gray-400'}`}
            >
              <span className="text-xl">{icon}</span>
              {label}
            </button>
          ))}
        </div>
      </nav>

      <PinGate
        open={gateOpen}
        onClose={() => setGateOpen(false)}
        onAuthenticated={() => { setGateOpen(false); enterParent(); setTab(0) }}
      />
      <ParentSettings open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  )
}
