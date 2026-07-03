// 应用上下文：repo（数据）+ 语言 + 角色（默认孩子只读，PIN 解锁家长——对位 RoleManager）。

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react'
import type { RewardRepo, DataSnapshot } from '../data/repository'
import { detectLanguage, persistLanguage, translate, type Language } from '../i18n/strings'
import { startOfDay } from '../domain/dates'
import { balance, currentWeekInterval, dailyNetTotals, netPoints, recentEvents } from '../domain/scoringEngine'
import { currentStreak } from '../domain/streakCalculator'
import { earnedBadges, nextMilestone } from '../domain/badgeEngine'
import type { Badge, DailyScore, MilestoneProgress, ScoreEvent } from '../domain/types'

export type AppRole = 'child' | 'parent'
export type DataMode = 'local' | 'cloud'

interface AppContextValue {
  repo: RewardRepo
  mode: DataMode
  lang: Language
  setLang: (l: Language | null) => void
  t: (key: string, params?: Record<string, string | number>) => string
  role: AppRole
  enterParent: () => void
  switchToChild: () => void
  signOut: (() => Promise<void>) | null
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ repo, mode, signOut, children }: {
  repo: RewardRepo
  mode: DataMode
  signOut?: () => Promise<void>
  children: ReactNode
}) {
  const [lang, setLangState] = useState<Language>(detectLanguage())
  const [role, setRole] = useState<AppRole>('child')

  const setLang = useCallback((l: Language | null) => {
    persistLanguage(l)
    setLangState(l ?? detectLanguage())
  }, [])

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => translate(lang, key, params),
    [lang],
  )

  const value = useMemo<AppContextValue>(() => ({
    repo, mode, lang, setLang, t, role,
    enterParent: () => setRole('parent'),
    switchToChild: () => setRole('child'),
    signOut: signOut ?? null,
  }), [repo, mode, lang, setLang, t, role, signOut])

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp outside AppProvider')
  return ctx
}

export function useData(): DataSnapshot {
  const { repo } = useApp()
  const subscribe = useCallback((cb: () => void) => repo.subscribe(cb), [repo])
  const getSnapshot = useCallback(() => repo.getSnapshot(), [repo])
  return useSyncExternalStore(subscribe, getSnapshot)
}

export interface ScoreSummary {
  balance: number
  weeklyNet: number
  streak: number
  badges: Badge[]
  nextMilestone: MilestoneProgress | null
  recent: ScoreEvent[]
  trend: DailyScore[]
}

/** 对位 iOS ScoreSummary：7 个聚合，全部由引擎在渲染时计算。
 *  dayKey：应用挂机跨午夜时按分钟检测日界变化，避免连击/本周/趋势停留在昨天。 */
export function useSummary(): ScoreSummary {
  const snap = useData()
  const [dayKey, setDayKey] = useState(() => startOfDay(new Date()).getTime())
  useEffect(() => {
    const id = setInterval(() => {
      const k = startOfDay(new Date()).getTime()
      setDayKey((prev) => (prev === k ? prev : k))
    }, 60_000)
    return () => clearInterval(id)
  }, [])
  return useMemo(() => {
    const now = new Date()
    return {
      balance: balance(snap.events, snap.redemptions),
      weeklyNet: netPoints(snap.events, currentWeekInterval(now)),
      streak: currentStreak(snap.events, now),
      badges: earnedBadges(snap.events, now),
      nextMilestone: nextMilestone(snap.events),
      recent: recentEvents(snap.events, 8),
      trend: dailyNetTotals(snap.events, 7, now),
    }
  }, [snap, dayKey])
}
