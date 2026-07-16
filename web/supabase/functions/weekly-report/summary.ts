// 周报聚合 —— 零依赖、自包含纯函数（Deno Edge Function 与 Vitest 共用）。
// 口径必须与 web/src/domain/ 权威引擎一致（平价测试守恒）：
//   balance = Σ(非voided points) − Σ(approved cost)；net = 区间内非voided 之和；
//   streak = 连续「净分>0」天数；里程碑 50/100/200/500、连击 3/7。
// 时区：所有按天/按周分桶均按 tz 的【墙上日期】(YYYY-MM-DD) 完成，不依赖运行时默认时区。

export type Cat = 'learning' | 'life' | 'character' | 'other'

export interface EvIn {
  points: number
  category: Cat
  ts: string // ISO 8601
  isVoided: boolean
  ruleName: string
  note: string | null
}

export interface RedIn {
  rewardName: string
  cost: number
  status: 'pending' | 'approved' | 'rejected'
  decidedAt: string | null // ISO 8601
}

export interface ChildIn {
  id: string
  name: string
  avatarSymbol: string
}

export interface BadgeLite {
  id: string
  title: string
  detail: string
}

export interface WeeklySummary {
  child: ChildIn
  weekStartDate: string // 'YYYY-MM-DD' 上周一
  weekEndDate: string // 'YYYY-MM-DD' 上周日
  hasAnyHistory: boolean
  weekHasActivity: boolean
  weekNet: number
  prevWeekNet: number
  netDelta: number
  balance: number
  byCategory: Record<Cat, number>
  dailyTrend: { date: string; net: number }[]
  streak: number
  newBadges: BadgeLite[]
  approvedThisWeek: { rewardName: string; cost: number }[]
  pendingCount: number
  topPositive: { ruleName: string; count: number; total: number }[]
  penalties: { ruleName: string; points: number; note: string | null }[]
}

export type Action = 'send' | 'nudge' | 'skip_empty' | 'skip_disabled' | 'skip_already'

const MILESTONE_THRESHOLDS = [50, 100, 200, 500]
const STREAK_THRESHOLDS = [3, 7]

function milestoneBadge(t: number): BadgeLite {
  switch (t) {
    case 50: return { id: 'milestone_50', title: '起步星', detail: '累计获得 50 分' }
    case 100: return { id: 'milestone_100', title: '百分达人', detail: '累计获得 100 分' }
    case 200: return { id: 'milestone_200', title: '超级明星', detail: '累计获得 200 分' }
    case 500: return { id: 'milestone_500', title: '积分大师', detail: '累计获得 500 分' }
    default: throw new Error(`unknown milestone: ${t}`)
  }
}

function streakBadge(t: number): BadgeLite {
  switch (t) {
    case 3: return { id: 'streak_3', title: '三连击', detail: '连续 3 天表现棒' }
    case 7: return { id: 'streak_7', title: '七日坚持', detail: '连续 7 天表现棒' }
    default: throw new Error(`unknown streak: ${t}`)
  }
}

/** 瞬时 → tz 的墙上日期 'YYYY-MM-DD'。 */
function wallDate(instant: Date, tz: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(instant)
  const get = (t: string) => parts.find((p) => p.type === t)!.value
  return `${get('year')}-${get('month')}-${get('day')}`
}

/** 墙上日期加减 n 天（纯日历运算，UTC Date 仅作日历计算器）。 */
function isoAddDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + n))
  const p = (x: number) => String(x).padStart(2, '0')
  return `${dt.getUTCFullYear()}-${p(dt.getUTCMonth() + 1)}-${p(dt.getUTCDate())}`
}

/** 墙上日期的星期几：1=周一 … 7=周日。 */
function isoWeekday(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay() // 0=周日..6=周六
  return wd === 0 ? 7 : wd
}

export function buildWeeklySummary(a: {
  child: ChildIn
  events: EvIn[]
  redemptions: RedIn[]
  tz: string
  now: Date
}): WeeklySummary {
  const { child, events, redemptions, tz, now } = a

  // 报告周 = 刚结束的上一整周 [上周一, 上周日]
  const todayWall = wallDate(now, tz)
  const thisMonday = isoAddDays(todayWall, -(isoWeekday(todayWall) - 1))
  const weekStartDate = isoAddDays(thisMonday, -7)
  const weekEndDate = isoAddDays(thisMonday, -1)
  const prevWeekStartDate = isoAddDays(weekStartDate, -7)

  const weekDays: string[] = []
  for (let i = 0; i < 7; i++) weekDays.push(isoAddDays(weekStartDate, i))
  const weekDaySet = new Set(weekDays)
  const prevDaySet = new Set<string>()
  for (let i = 0; i < 7; i++) prevDaySet.add(isoAddDays(prevWeekStartDate, i))

  const active = events.filter((e) => !e.isVoided)
  const activeWithWall = active.map((e) => ({ e, wd: wallDate(new Date(e.ts), tz) }))

  // 本周聚合
  let weekNet = 0
  const byCategory: Record<Cat, number> = { learning: 0, life: 0, character: 0, other: 0 }
  const netByDay = new Map<string, number>()
  for (const d of weekDays) netByDay.set(d, 0)
  for (const { e, wd } of activeWithWall) {
    if (weekDaySet.has(wd)) {
      weekNet += e.points
      byCategory[e.category] += e.points
      netByDay.set(wd, (netByDay.get(wd) ?? 0) + e.points)
    }
  }
  const dailyTrend = weekDays.map((d) => ({ date: d, net: netByDay.get(d) ?? 0 }))

  let prevWeekNet = 0
  for (const { e, wd } of activeWithWall) if (prevDaySet.has(wd)) prevWeekNet += e.points

  // 全时余额
  let earned = 0
  for (const e of active) earned += e.points
  let spent = 0
  for (const r of redemptions) if (r.status === 'approved') spent += r.cost
  const balance = earned - spent

  // 全时 net-by-wallDate（连击/期初期末累计用）
  const netByWall = new Map<string, number>()
  for (const { e, wd } of activeWithWall) netByWall.set(wd, (netByWall.get(wd) ?? 0) + e.points)
  const streakAsOf = (endDay: string): number => {
    let s = 0
    let c = endDay
    while ((netByWall.get(c) ?? 0) > 0) { s++; c = isoAddDays(c, -1) }
    return s
  }
  const streak = streakAsOf(weekEndDate)

  // 新解锁徽章 = 期末徽章集 − 期初徽章集
  const cumEarnedBefore = (boundaryExclusive: string): number => {
    let sum = 0
    for (const { e, wd } of activeWithWall) if (e.points > 0 && wd < boundaryExclusive) sum += e.points
    return sum
  }
  const badgeSet = (earnedTotal: number, strk: number): BadgeLite[] => {
    const out: BadgeLite[] = []
    for (const t of MILESTONE_THRESHOLDS) if (earnedTotal >= t) out.push(milestoneBadge(t))
    for (const t of STREAK_THRESHOLDS) if (strk >= t) out.push(streakBadge(t))
    return out
  }
  const startBadges = new Set(
    badgeSet(cumEarnedBefore(weekStartDate), streakAsOf(isoAddDays(weekStartDate, -1))).map((b) => b.id),
  )
  const newBadges = badgeSet(cumEarnedBefore(isoAddDays(weekEndDate, 1)), streak).filter((b) => !startBadges.has(b.id))

  // 兑换
  const approvedThisWeek = redemptions
    .filter((r) => r.status === 'approved' && r.decidedAt !== null && weekDaySet.has(wallDate(new Date(r.decidedAt), tz)))
    .map((r) => ({ rewardName: r.rewardName, cost: r.cost }))
  const pendingCount = redemptions.filter((r) => r.status === 'pending').length

  // 亮点
  const posMap = new Map<string, { count: number; total: number }>()
  for (const { e, wd } of activeWithWall) {
    if (weekDaySet.has(wd) && e.points > 0) {
      const cur = posMap.get(e.ruleName) ?? { count: 0, total: 0 }
      cur.count += 1
      cur.total += e.points
      posMap.set(e.ruleName, cur)
    }
  }
  const topPositive = [...posMap.entries()]
    .map(([ruleName, v]) => ({ ruleName, count: v.count, total: v.total }))
    .sort((x, y) => y.total - x.total)
    .slice(0, 3)
  const penalties = activeWithWall
    .filter(({ e, wd }) => weekDaySet.has(wd) && e.points < 0)
    .map(({ e }) => ({ ruleName: e.ruleName, points: e.points, note: e.note }))

  const weekHasActivity = activeWithWall.some(({ wd }) => weekDaySet.has(wd))

  return {
    child,
    weekStartDate,
    weekEndDate,
    hasAnyHistory: active.length > 0,
    weekHasActivity,
    weekNet,
    prevWeekNet,
    netDelta: weekNet - prevWeekNet,
    balance,
    byCategory,
    dailyTrend,
    streak,
    newBadges,
    approvedThisWeek,
    pendingCount,
    topPositive,
    penalties,
  }
}

export function decideAction(a: {
  enabled: boolean
  alreadySent: boolean
  hasAnyHistory: boolean
  weekHasActivity: boolean
}): Action {
  if (!a.enabled) return 'skip_disabled'
  if (a.alreadySent) return 'skip_already'
  if (!a.hasAnyHistory) return 'skip_empty'
  return a.weekHasActivity ? 'send' : 'nudge'
}
