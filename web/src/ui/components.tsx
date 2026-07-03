// 共享组件：对位 iOS Support 里的 ProgressRing / PointPill / SectionCard / TrendChart / BadgeChip 等。

import type { ReactNode } from 'react'
import type { Badge, DailyScore, ScoreCategory, ScoreEvent } from '../domain/types'
import { categoryDisplayName } from '../domain/types'
import { useApp } from '../state/app'
import { SymbolIcon } from './symbols'

export function SectionCard({ title, children, action }: { title?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="bg-card rounded-2xl p-4 shadow-sm">
      {(title || action) && (
        <div className="flex items-center justify-between mb-3">
          {title && <h2 className="font-semibold text-gray-800">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

export function PointPill({ points }: { points: number }) {
  const positive = points >= 0
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-sm font-semibold ${positive ? 'bg-positive/15 text-positive' : 'bg-negative/15 text-negative'}`}>
      {positive ? `+${points}` : `${points}`}
    </span>
  )
}

const CATEGORY_COLOR: Record<ScoreCategory, string> = {
  learning: 'bg-cat-learning/15 text-cat-learning',
  life: 'bg-cat-life/15 text-cat-life',
  character: 'bg-cat-character/15 text-cat-character',
  other: 'bg-cat-other/15 text-cat-other',
}

export function CategoryChip({ category }: { category: ScoreCategory }) {
  const { t } = useApp()
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_COLOR[category]}`}>
      {t(categoryDisplayName(category))}
    </span>
  )
}

/** 圆环进度（对位 ProgressRing）：fraction 0–1。 */
export function ProgressRing({ fraction, size = 148, stroke = 12, children }: {
  fraction: number
  size?: number
  stroke?: number
  children?: ReactNode
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const clamped = Math.max(0, Math.min(1, fraction))
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f0e8dd" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke="var(--color-accent)" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - clamped)}
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  )
}

export function BadgeChip({ badge }: { badge: Badge }) {
  const { t } = useApp()
  return (
    <div className="flex flex-col items-center gap-1 rounded-2xl bg-accent/10 px-3 py-2 min-w-20">
      <SymbolIcon name={badge.iconName} className="text-2xl" />
      <span className="text-xs font-medium text-gray-700 whitespace-nowrap">{t(badge.title)}</span>
    </div>
  )
}

/** 7 天柱状趋势（对位 TrendChart）：绿正红负。 */
export function TrendChart({ trend }: { trend: DailyScore[] }) {
  const { lang } = useApp()
  const maxAbs = Math.max(1, ...trend.map((d) => Math.abs(d.net)))
  return (
    <div className="flex items-end justify-between gap-2 h-28 pt-2">
      {trend.map((d) => {
        const h = (Math.abs(d.net) / maxAbs) * 72
        const label = d.date.toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', { weekday: 'short' })
        return (
          <div key={d.date.getTime()} className="flex flex-col items-center gap-1 flex-1">
            <span className={`text-xs font-medium ${d.net > 0 ? 'text-positive' : d.net < 0 ? 'text-negative' : 'text-gray-400'}`}>
              {d.net !== 0 ? d.net : ''}
            </span>
            <div
              className={`w-6 rounded-md ${d.net > 0 ? 'bg-positive' : d.net < 0 ? 'bg-negative' : 'bg-gray-200'}`}
              style={{ height: Math.max(4, h) }}
            />
            <span className="text-[10px] text-gray-400">{label}</span>
          </div>
        )
      })}
    </div>
  )
}

export function EventRow({ event }: { event: ScoreEvent }) {
  const { lang, t } = useApp()
  const timeText = event.timestamp.toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-US', {
    month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
  return (
    <div className="flex items-center gap-3 py-2.5">
      <SymbolIcon name={event.category === 'other' ? 'star.fill' : `${event.category === 'learning' ? 'book.fill' : event.category === 'life' ? 'house.fill' : 'heart.fill'}`} className="text-xl" />
      <div className="flex-1 min-w-0">
        <div className="font-medium text-gray-800 truncate">{t(event.ruleName)}</div>
        <div className="text-xs text-gray-400">
          {timeText}
          {event.note ? ` · ${event.note}` : ''}
        </div>
      </div>
      <PointPill points={event.points} />
    </div>
  )
}

export function EmptyHint({ text }: { text: string }) {
  return <p className="text-sm text-gray-400 text-center py-4">{text}</p>
}

export function Modal({ open, onClose, title, children }: {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-card w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {title && <h2 className="text-lg font-semibold text-gray-800 mb-4">{title}</h2>}
        {children}
      </div>
    </div>
  )
}

export function PrimaryButton({ children, onClick, disabled, className = '' }: {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  className?: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-2xl bg-accent text-white font-semibold px-5 py-3 disabled:opacity-40 active:scale-95 transition ${className}`}
    >
      {children}
    </button>
  )
}
