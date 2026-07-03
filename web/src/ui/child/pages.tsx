// 孩子端三屏（对位 ChildDashboardView / ChildStoreView / ChildHistoryView），只读 + 请求兑换。

import { useApp, useData, useSummary } from '../../state/app'
import { affordableRewards, canAfford, pointsNeeded } from '../../domain/redemptionPolicy'
import { redemptionStatusDisplayName } from '../../domain/types'
import { BadgeChip, EmptyHint, EventRow, PointPill, PrimaryButton, ProgressRing, SectionCard, TrendChart } from '../components'
import { SymbolIcon } from '../symbols'

export function ChildToday() {
  const { t } = useApp()
  const snap = useData()
  const s = useSummary()
  const weeklyGoalFraction = Math.max(0, Math.min(1, s.weeklyNet / 100))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 pt-2">
        <span className="text-4xl"><SymbolIcon name={snap.child?.avatarSymbol ?? 'DefaultAvatar'} /></span>
        <h1 className="text-xl font-bold text-gray-800">{t('你好，{name}', { name: snap.child?.name ?? '' })}</h1>
      </div>

      <SectionCard>
        <div className="flex flex-col items-center gap-3">
          <ProgressRing fraction={weeklyGoalFraction} size={160}>
            <span className="text-5xl font-bold text-gray-800">{s.balance}</span>
            <span className="text-xs text-gray-400">{t('当前总分')}</span>
          </ProgressRing>
          <div className="flex gap-6 text-center text-sm">
            <div><div className="font-semibold text-gray-800">{s.weeklyNet}</div><div className="text-xs text-gray-400">{t('本周净得')}</div></div>
            <div><div className="font-semibold text-gray-800">{s.streak}</div><div className="text-xs text-gray-400">{t('连击天数')}</div></div>
            <div><div className="font-semibold text-gray-800">{s.badges.length}</div><div className="text-xs text-gray-400">{t('我的徽章')}</div></div>
          </div>
        </div>
      </SectionCard>

      <SectionCard title={t('下一个目标')}>
        {s.nextMilestone ? (
          <div className="flex items-center gap-3">
            <SymbolIcon name={s.nextMilestone.badge.iconName} className="text-3xl" />
            <div className="flex-1">
              <div className="font-medium text-gray-800">{t(s.nextMilestone.badge.title)}</div>
              <div className="h-2 rounded-full bg-gray-100 mt-2">
                <div className="h-2 rounded-full bg-accent" style={{ width: `${s.nextMilestone.fraction * 100}%` }} />
              </div>
              <div className="text-xs text-gray-400 mt-1">{t('还差 {n} 分解锁！', { n: s.nextMilestone.remaining })}</div>
            </div>
          </div>
        ) : (
          <p className="text-gray-600">{t('🎉 全部达成！')}</p>
        )}
      </SectionCard>

      <SectionCard title={t('我的徽章')}>
        {s.badges.length ? (
          <div className="flex gap-2 overflow-x-auto pb-1">{s.badges.map((b) => <BadgeChip key={b.id} badge={b} />)}</div>
        ) : (
          <EmptyHint text={t('还没有徽章，继续加油就能拿到！')} />
        )}
      </SectionCard>

      <SectionCard title={t('最近记录')}>
        {s.recent.length ? (
          <div className="divide-y divide-gray-100">{s.recent.map((e) => <EventRow key={e.id} event={e} />)}</div>
        ) : (
          <EmptyHint text={t('还没有记录')} />
        )}
      </SectionCard>
    </div>
  )
}

export function ChildStore() {
  const { repo, t } = useApp()
  const snap = useData()
  const s = useSummary()
  const pendingRewardIDs = new Set(snap.redemptions.filter((r) => r.status === 'pending').map((r) => r.rewardID))
  const active = snap.rewards.filter((r) => r.isActive).sort((a, b) => a.sortOrder - b.sortOrder)
  const affordable = new Set(affordableRewards(snap.rewards, s.balance).map((r) => r.id))
  const myRedemptions = [...snap.redemptions].sort((a, b) => b.requestedAt.getTime() - a.requestedAt.getTime()).slice(0, 8)

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl bg-accent text-white font-semibold text-center py-3">
        {t('我有 {n} 分', { n: s.balance })}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {active.map((r) => {
          const pending = pendingRewardIDs.has(r.id)
          return (
            <SectionCard key={r.id}>
              <div className="flex flex-col items-center gap-2 text-center">
                <SymbolIcon name={r.iconName} className={`text-4xl ${affordable.has(r.id) ? '' : 'grayscale opacity-60'}`} />
                <div className="font-medium text-gray-800 text-sm">{t(r.name)}</div>
                <div className="text-accent font-bold">{r.cost} ⭐</div>
                {pending ? (
                  <span className="text-xs text-gray-400">{t('等家长确认')}</span>
                ) : canAfford(r, s.balance) ? (
                  <PrimaryButton className="!py-1.5 !px-4 text-sm" onClick={() => void repo.requestRedemption(r.id)}>
                    {t('兑换')}
                  </PrimaryButton>
                ) : (
                  <span className="text-xs text-gray-400">{t('还差 {n} 分', { n: pointsNeeded(r, s.balance) })}</span>
                )}
              </div>
            </SectionCard>
          )
        })}
      </div>

      <SectionCard title={t('我的兑换')}>
        {myRedemptions.length ? (
          <div className="divide-y divide-gray-100">
            {myRedemptions.map((r) => (
              <div key={r.id} className="flex items-center justify-between py-2.5">
                <span className="font-medium text-gray-800">{t(r.rewardName)}</span>
                <span className="flex items-center gap-2 text-sm">
                  <span className="text-gray-400">-{r.cost}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${r.status === 'approved' ? 'bg-positive/15 text-positive' : r.status === 'rejected' ? 'bg-negative/15 text-negative' : 'bg-gray-100 text-gray-500'}`}>
                    {t(redemptionStatusDisplayName(r.status))}
                  </span>
                </span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyHint text={t('还没有记录')} />
        )}
      </SectionCard>
    </div>
  )
}

export function ChildHistory() {
  const { t } = useApp()
  const snap = useData()
  const s = useSummary()
  const all = snap.events.filter((e) => !e.isVoided).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())

  return (
    <div className="flex flex-col gap-4">
      <SectionCard title={t('近七天趋势')}>
        <TrendChart trend={s.trend} />
      </SectionCard>
      <SectionCard title={t('全部记录')}>
        {all.length ? (
          <div className="divide-y divide-gray-100">{all.map((e) => <EventRow key={e.id} event={e} />)}</div>
        ) : (
          <EmptyHint text={t('还没有记录')} />
        )}
      </SectionCard>
    </div>
  )
}

export { PointPill }
