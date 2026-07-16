// 家长端五屏 + 编辑/备注/设置模态（对位 ParentDashboardView / ScoreEntryView / RulesAdminView /
// RewardsAdminView / HistoryView / ParentSettingsView）。

import { useEffect, useRef, useState } from 'react'
import { useApp, useData, useSummary } from '../../state/app'
import type { BehaviorRule, Reward, ScoreCategory } from '../../domain/types'
import { ALL_CATEGORIES, categoryDisplayName, RULE_DETAILS_MAX_LENGTH } from '../../domain/types'
import { netPoints, currentWeekInterval } from '../../domain/scoringEngine'
import type { RuleInput, RewardInput } from '../../data/repository'
import { CategoryChip, EmptyHint, EventRow, Modal, PointPill, PrimaryButton, SectionCard, TrendChart } from '../components'
import { Avatar, AVATAR_EMOJI_SYMBOLS, fileToAvatarDataURL, PICKABLE_SYMBOLS, SymbolIcon } from '../symbols'
import { sanitizedPIN } from '../onboarding/Onboarding'

/** 数字输入：valueAsNumber（locale 无关）+ isFinite + 整数 + 区间闸（教训 #8）。 */
function clampInt(raw: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(raw)) return fallback
  return Math.max(min, Math.min(max, Math.trunc(raw)))
}

// ---------- 总览 ----------
export function ParentOverview() {
  const { t } = useApp()
  const snap = useData()
  const s = useSummary()
  const pending = snap.redemptions.filter((r) => r.status === 'pending')

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        {[
          [t('当前总分'), s.balance],
          [t('本周净得'), s.weeklyNet],
          [t('连击天数'), s.streak],
          [t('待审批'), pending.length],
        ].map(([label, value]) => (
          <SectionCard key={label as string}>
            <div className="text-2xl font-bold text-gray-800">{value}</div>
            <div className="text-xs text-gray-400">{label}</div>
          </SectionCard>
        ))}
      </div>

      <PendingRedemptions />

      <SectionCard title={t('近七天趋势')}>
        <TrendChart trend={s.trend} />
      </SectionCard>

      <SectionCard title={t('最近记录')}>
        {s.recent.length ? (
          <div className="divide-y divide-gray-100">{s.recent.map((e) => <EventRow key={e.id} event={e} />)}</div>
        ) : (
          <EmptyHint text={t('还没有记录')} />
        )}
      </SectionCard>

      <UndoButton />
      <div className="h-2" />
    </div>
  )
}

export function PendingRedemptions() {
  const { repo, t } = useApp()
  const snap = useData()
  const s = useSummary()
  const pending = snap.redemptions.filter((r) => r.status === 'pending')
  if (!pending.length) return null
  return (
    <SectionCard title={t('待审批兑换')}>
      <div className="divide-y divide-gray-100">
        {pending.map((r) => {
          const insufficient = s.balance < r.cost
          return (
            <div key={r.id} className="py-2.5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="font-medium text-gray-800">{r.rewardName}</div>
                  <div className="text-xs text-gray-400">-{r.cost} ⭐</div>
                </div>
                <div className="flex gap-2">
                  <button
                    disabled={insufficient}
                    onClick={() => void repo.approveRedemption(r.id)}
                    className="rounded-xl bg-positive/15 text-positive font-medium px-3 py-1.5 text-sm disabled:opacity-40"
                  >
                    {t('通过')}
                  </button>
                  <button
                    onClick={() => void repo.rejectRedemption(r.id)}
                    className="rounded-xl bg-negative/15 text-negative font-medium px-3 py-1.5 text-sm"
                  >
                    {t('驳回')}
                  </button>
                </div>
              </div>
              {insufficient && (
                <p className="text-xs text-negative mt-1">{t('积分不足（需 {need}，余 {have}）', { need: r.cost, have: s.balance })}</p>
              )}
            </div>
          )
        })}
      </div>
    </SectionCard>
  )
}

function UndoButton() {
  const { repo, t } = useApp()
  const snap = useData()
  const hasUndoable = snap.events.some((e) => !e.isVoided)
  if (!hasUndoable) return null
  return (
    <button
      onClick={() => void repo.undoLastEvent()}
      className="rounded-2xl border border-gray-300 text-gray-600 font-medium py-2.5"
    >
      ↩︎ {t('撤销最近一次记分')}
    </button>
  )
}

// ---------- 记分 ----------
export function ParentScoring() {
  const { repo, t } = useApp()
  const snap = useData()
  const s = useSummary()
  const [noteFor, setNoteFor] = useState<BehaviorRule | null>(null)
  const [note, setNote] = useState('')
  const [banner, setBanner] = useState<{ points: number; name: string } | null>(null)
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const activeRules = snap.rules.filter((r) => r.isActive).sort((a, b) => a.sortOrder - b.sortOrder)
  const rewards = activeRules.filter((r) => r.points >= 0)
  const penalties = activeRules.filter((r) => r.points < 0)

  function showBanner(points: number, name: string) {
    setBanner({ points, name })
    if (bannerTimer.current) clearTimeout(bannerTimer.current)
    bannerTimer.current = setTimeout(() => setBanner(null), 3000)
  }

  async function record(rule: BehaviorRule, withNote: string | null) {
    const ok = await repo.recordScore(rule.id, withNote)
    if (ok) showBanner(rule.points, rule.name)
  }

  const grid = (rules: BehaviorRule[]) => (
    <div className="grid grid-cols-2 gap-3">
      {rules.map((r) => (
        <button
          key={r.id}
          onClick={() => void record(r, null)}
          onContextMenu={(e) => { e.preventDefault(); setNoteFor(r); setNote('') }}
          className="bg-card rounded-2xl p-3 flex flex-col items-center gap-1.5 shadow-sm active:scale-95 transition text-center"
        >
          <SymbolIcon name={r.iconName} className="text-3xl" />
          <span className="text-sm font-medium text-gray-800">{r.name}</span>
          <PointPill points={r.points} />
        </button>
      ))}
    </div>
  )

  return (
    <div className="flex flex-col gap-4">
      {banner && (
        <div className="rounded-2xl bg-positive text-white px-4 py-3 flex items-center justify-between">
          <span>✓ {t('已记录 {points} · {name}', { points: banner.points >= 0 ? `+${banner.points}` : banner.points, name: banner.name })}</span>
          <button className="underline text-sm" onClick={() => { void repo.undoLastEvent(); setBanner(null) }}>{t('撤销')}</button>
        </div>
      )}

      <div className="text-center text-gray-600">{t('当前总分')} <span className="font-bold text-gray-800">{s.balance}</span></div>

      <SectionCard title={`🟢 ${t('加分行为')}`}>{rewards.length ? grid(rewards) : <EmptyHint text={t('还没有记录')} />}</SectionCard>
      <SectionCard title={`🔴 ${t('扣分行为')}`}>{penalties.length ? grid(penalties) : <EmptyHint text={t('还没有记录')} />}</SectionCard>
      <p className="text-xs text-gray-400 text-center">{t('备注（可选）')}：长按 / 右键行为卡片</p>

      <Modal open={noteFor !== null} onClose={() => setNoteFor(null)} title={noteFor ? noteFor.name : ''}>
        {noteFor && (
          <div className="flex flex-col gap-3">
            <PointPill points={noteFor.points} />
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('例如今天主动整理了书桌')}
              rows={3}
              className="rounded-2xl border border-gray-200 px-4 py-3"
            />
            <div className="flex gap-2 justify-end">
              <button className="px-4 py-2 text-gray-500" onClick={() => setNoteFor(null)}>{t('取消')}</button>
              <PrimaryButton onClick={() => { void record(noteFor, note.trim() || null); setNoteFor(null) }}>{t('记一次')}</PrimaryButton>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

// ---------- 规则管理 ----------
export function ParentRules() {
  const { repo, t } = useApp()
  const snap = useData()
  const [editing, setEditing] = useState<BehaviorRule | 'new' | null>(null)
  const rules = [...snap.rules].sort((a, b) => a.sortOrder - b.sortOrder)

  return (
    <div className="flex flex-col gap-4">
      <SectionCard
        title={t('规则')}
        action={<PrimaryButton className="!py-1.5 !px-4 text-sm" onClick={() => setEditing('new')}>＋ {t('添加')}</PrimaryButton>}
      >
        <div className="divide-y divide-gray-100">
          {rules.map((r) => (
            <div key={r.id} className="flex items-center gap-3 py-2.5">
              <button className="flex-1 min-w-0 text-left flex items-center gap-3" onClick={() => setEditing(r)}>
                <SymbolIcon name={r.iconName} className="text-2xl" />
                <div className="flex-1 min-w-0">
                  <div className={`font-medium truncate ${r.isActive ? 'text-gray-800' : 'text-gray-400 line-through'}`}>{r.name}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <CategoryChip category={r.category} />
                    {r.details && <span className="text-xs text-gray-400 truncate">{r.details}</span>}
                  </div>
                </div>
                <PointPill points={r.points} />
                <span className="text-gray-300 text-sm" title={t('编辑')}>✏️</span>
              </button>
              <input
                type="checkbox"
                checked={r.isActive}
                onChange={(e) => void repo.setRuleActive(r.id, e.target.checked)}
                className="w-5 h-5 accent-accent"
              />
            </div>
          ))}
        </div>
      </SectionCard>

      <RuleEditModal editing={editing} onClose={() => setEditing(null)} />
    </div>
  )
}

function RuleEditModal({ editing, onClose }: { editing: BehaviorRule | 'new' | null; onClose: () => void }) {
  const { repo, t } = useApp()
  const isNew = editing === 'new'
  const base = isNew || !editing ? null : editing
  const [name, setName] = useState('')
  const [details, setDetails] = useState('')
  const [category, setCategory] = useState<ScoreCategory>('learning')
  const [magnitude, setMagnitude] = useState(5)
  const [isPenalty, setIsPenalty] = useState(false)
  const [iconName, setIconName] = useState<string | null>(null)

  useEffect(() => {
    if (!editing) return
    setName(base ? base.name : '')
    setDetails(base?.details ?? '')
    setCategory(base ? base.category : 'learning')
    setMagnitude(base ? Math.min(9999, Math.max(1, Math.abs(base.points))) : 5)
    setIsPenalty(base ? base.points < 0 : false)
    setIconName(base ? base.iconName : null)
  }, [editing])

  async function save() {
    const input: RuleInput = {
      name: name.trim(),
      details: details.trim() ? details.trim().slice(0, RULE_DETAILS_MAX_LENGTH) : null,
      category,
      points: isPenalty ? -magnitude : magnitude,
      iconName,
    }
    if (isNew) await repo.addRule(input)
    else if (base) await repo.updateRule(base.id, input)
    onClose()
  }

  async function remove() {
    if (base && window.confirm(`${t('删除')}「${t(base.name)}」?`)) {
      await repo.deleteRule(base.id)
      onClose()
    }
  }

  return (
    <Modal open={editing !== null} onClose={onClose} title={isNew ? t('新增规则') : t('编辑规则')}>
      <div className="flex flex-col gap-3">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('规则名称')} className="rounded-2xl border border-gray-200 px-4 py-3" />
        <textarea value={details} onChange={(e) => setDetails(e.target.value.slice(0, RULE_DETAILS_MAX_LENGTH))} placeholder={t('说明（可选）')} rows={2} className="rounded-2xl border border-gray-200 px-4 py-3" />

        <div className="flex gap-2 flex-wrap">
          {ALL_CATEGORIES.map((c) => (
            <button key={c} onClick={() => setCategory(c)} className={`rounded-full px-3 py-1.5 text-sm ${category === c ? 'bg-accent text-white' : 'bg-gray-100 text-gray-600'}`}>
              {t(categoryDisplayName(c))}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex rounded-full bg-gray-100 p-1">
            <button onClick={() => setIsPenalty(false)} className={`rounded-full px-3 py-1 text-sm ${!isPenalty ? 'bg-positive text-white' : 'text-gray-500'}`}>{t('加分')}</button>
            <button onClick={() => setIsPenalty(true)} className={`rounded-full px-3 py-1 text-sm ${isPenalty ? 'bg-negative text-white' : 'text-gray-500'}`}>{t('扣分')}</button>
          </div>
          <input
            type="number" min={1} max={9999} value={magnitude}
            onChange={(e) => setMagnitude(clampInt(e.target.valueAsNumber, 1, 9999, 1))}
            className="w-24 rounded-2xl border border-gray-200 px-3 py-2"
          />
          <PointPill points={isPenalty ? -magnitude : magnitude} />
        </div>

        <IconPicker value={iconName} onChange={setIconName} />

        <div className="flex justify-between items-center pt-1">
          {!isNew ? <button className="text-negative text-sm" onClick={() => void remove()}>{t('删除')}</button> : <span />}
          <div className="flex gap-2">
            <button className="px-4 py-2 text-gray-500" onClick={onClose}>{t('取消')}</button>
            <PrimaryButton disabled={!name.trim()} onClick={() => void save()}>{t('保存')}</PrimaryButton>
          </div>
        </div>
      </div>
    </Modal>
  )
}

function IconPicker({ value, onChange }: { value: string | null; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {PICKABLE_SYMBOLS.map((s) => (
        <button key={s} onClick={() => onChange(s)} className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center ${value === s ? 'bg-accent/20 ring-2 ring-accent' : 'bg-gray-50'}`}>
          <SymbolIcon name={s} />
        </button>
      ))}
    </div>
  )
}

// ---------- 奖励管理 ----------
export function ParentRewards() {
  const { repo, t } = useApp()
  const snap = useData()
  const [editing, setEditing] = useState<Reward | 'new' | null>(null)
  const rewards = [...snap.rewards].sort((a, b) => a.sortOrder - b.sortOrder)

  return (
    <div className="flex flex-col gap-4">
      <PendingRedemptions />
      <SectionCard
        title={t('奖励')}
        action={<PrimaryButton className="!py-1.5 !px-4 text-sm" onClick={() => setEditing('new')}>＋ {t('添加')}</PrimaryButton>}
      >
        <div className="divide-y divide-gray-100">
          {rewards.map((r) => (
            <div key={r.id} className="flex items-center gap-3 py-2.5">
              <button className="flex-1 min-w-0 text-left flex items-center gap-3" onClick={() => setEditing(r)}>
                <SymbolIcon name={r.iconName} className="text-2xl" />
                <span className={`flex-1 min-w-0 truncate font-medium ${r.isActive ? 'text-gray-800' : 'text-gray-400 line-through'}`}>{r.name}</span>
                <span className="text-accent font-bold">{r.cost} ⭐</span>
                <span className="text-gray-300 text-sm" title={t('编辑')}>✏️</span>
              </button>
              <input
                type="checkbox"
                checked={r.isActive}
                onChange={(e) => void repo.setRewardActive(r.id, e.target.checked)}
                className="w-5 h-5 accent-accent"
              />
            </div>
          ))}
        </div>
      </SectionCard>

      <RewardEditModal editing={editing} onClose={() => setEditing(null)} />
    </div>
  )
}

function RewardEditModal({ editing, onClose }: { editing: Reward | 'new' | null; onClose: () => void }) {
  const { repo, t } = useApp()
  const isNew = editing === 'new'
  const base = isNew || !editing ? null : editing
  const [name, setName] = useState('')
  const [cost, setCost] = useState(20)
  const [iconName, setIconName] = useState<string | null>(null)

  useEffect(() => {
    if (!editing) return
    setName(base ? base.name : '')
    setCost(base ? base.cost : 20)
    setIconName(base ? base.iconName : null)
  }, [editing])

  async function save() {
    const input: RewardInput = { name: name.trim(), cost, iconName }
    if (isNew) await repo.addReward(input)
    else if (base) await repo.updateReward(base.id, input)
    onClose()
  }

  async function remove() {
    if (base && window.confirm(`${t('删除')}「${t(base.name)}」?`)) {
      await repo.deleteReward(base.id)
      onClose()
    }
  }

  return (
    <Modal open={editing !== null} onClose={onClose} title={isNew ? t('新增奖励') : t('编辑奖励')}>
      <div className="flex flex-col gap-3">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('奖励名称')} className="rounded-2xl border border-gray-200 px-4 py-3" />
        <label className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{t('所需积分')}</span>
          <input
            type="number" min={1} max={9999} value={cost}
            onChange={(e) => setCost(clampInt(e.target.valueAsNumber, 1, 9999, 1))}
            className="w-28 rounded-2xl border border-gray-200 px-3 py-2"
          />
        </label>
        <IconPicker value={iconName} onChange={setIconName} />
        <div className="flex justify-between items-center pt-1">
          {!isNew ? <button className="text-negative text-sm" onClick={() => void remove()}>{t('删除')}</button> : <span />}
          <div className="flex gap-2">
            <button className="px-4 py-2 text-gray-500" onClick={onClose}>{t('取消')}</button>
            <PrimaryButton disabled={!name.trim()} onClick={() => void save()}>{t('保存')}</PrimaryButton>
          </div>
        </div>
      </div>
    </Modal>
  )
}

// ---------- 历史 ----------
export function ParentHistory() {
  const { t } = useApp()
  const snap = useData()
  const s = useSummary()
  const [filter, setFilter] = useState<'all' | 'reward' | 'penalty'>('all')

  const active = snap.events.filter((e) => !e.isVoided)
  const week = currentWeekInterval(new Date())
  const byCategory = ALL_CATEGORIES.map((c) => ({
    category: c,
    net: netPoints(active.filter((e) => e.category === c), week),
  }))
  const filtered = active
    .filter((e) => (filter === 'all' ? true : filter === 'reward' ? e.points >= 0 : e.points < 0))
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())

  return (
    <div className="flex flex-col gap-4">
      <SectionCard title={t('近七天趋势')}>
        <TrendChart trend={s.trend} />
      </SectionCard>

      <SectionCard title={`${t('按类目')}（${t('本周净得')}）`}>
        <div className="divide-y divide-gray-100">
          {byCategory.map(({ category, net }) => (
            <div key={category} className="flex items-center justify-between py-2">
              <CategoryChip category={category} />
              <span className={`font-semibold ${net > 0 ? 'text-positive' : net < 0 ? 'text-negative' : 'text-gray-400'}`}>{net}</span>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title={t('全部记录')}>
        <div className="flex gap-2 mb-2">
          {([['all', t('全部')], ['reward', t('加分')], ['penalty', t('扣分')]] as const).map(([k, label]) => (
            <button key={k} onClick={() => setFilter(k)} className={`rounded-full px-3 py-1 text-sm ${filter === k ? 'bg-accent text-white' : 'bg-gray-100 text-gray-500'}`}>
              {label}
            </button>
          ))}
        </div>
        {filtered.length ? (
          <div className="divide-y divide-gray-100">{filtered.map((e) => <EventRow key={e.id} event={e} />)}</div>
        ) : (
          <EmptyHint text={t('还没有记录')} />
        )}
      </SectionCard>

      <UndoButton />
    </div>
  )
}

// ---------- 设置 ----------
function WeeklyReportToggle({ open }: { open: boolean }) {
  const { repo, t, mode } = useApp()
  const [enabled, setEnabled] = useState(true)
  useEffect(() => { if (open) setEnabled(repo.getWeeklyReportEnabled()) }, [open])
  return (
    <div>
      <h3 className="text-sm text-gray-400 mb-2">{t('通知')}</h3>
      <div className="w-full rounded-2xl bg-gray-50 px-4 py-3 font-medium text-gray-700 flex items-center justify-between">
        <span>{t('每周积分周报邮件')}</span>
        <button
          onClick={async () => { const next = !enabled; setEnabled(next); await repo.setWeeklyReportEnabled(next) }}
          className={`rounded-full px-4 py-1.5 text-sm font-semibold ${enabled ? 'bg-accent text-white' : 'bg-gray-200 text-gray-500'}`}
        >
          {enabled ? t('开') : t('关')}
        </button>
      </div>
      {mode === 'local' && <p className="text-xs text-gray-400 mt-1 px-1">{t('本地模式不发送邮件')}</p>}
    </div>
  )
}

export function ParentSettings({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { repo, mode, t, lang, setLang, switchToChild, signOut } = useApp()
  const snap = useData()
  const [name, setName] = useState('')
  const [showChangePin, setShowChangePin] = useState(false)
  const fileInput = useRef<HTMLInputElement | null>(null)
  const avatarInput = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (open) setName(snap.child?.name ?? '')
  }, [open])

  function importBackup(file: File) {
    const reader = new FileReader()
    reader.onload = async () => {
      try {
        const raw = JSON.parse(String(reader.result))
        if (!window.confirm(t('导入将覆盖当前全部数据，确定？'))) return
        // 兼容两种日期编码：Web 的 ISO 字符串 / iOS Swift Codable 默认的「2001-01-01 纪元秒」数值
        const SWIFT_REF_EPOCH_MS = 978307200000
        const toDate = (v: unknown) => (typeof v === 'number' ? new Date(SWIFT_REF_EPOCH_MS + v * 1000) : new Date(String(v)))
        const revive = (arr: any[], dateKeys: string[]) =>
          (arr ?? []).map((x) => {
            const y = { ...x }
            for (const k of dateKeys) if (y[k] != null) y[k] = toDate(y[k])
            return y
          })
        await repo.importBundle({
          schemaVersion: raw.schemaVersion ?? '1.0.0',
          exportedAt: raw.exportedAt ?? new Date().toISOString(),
          children: revive(raw.children, ['createdAt']),
          rules: revive(raw.rules, ['createdAt']),
          events: revive(raw.events, ['timestamp']),
          rewards: revive(raw.rewards, ['createdAt']),
          redemptions: revive(raw.redemptions, ['requestedAt', 'decidedAt']),
        }, true)
      } catch {
        window.alert('Invalid backup file')
      }
    }
    reader.readAsText(file)
  }

  function exportBackup() {
    const bundle = repo.exportBundle()
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `reward-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const row = 'w-full text-left rounded-2xl bg-gray-50 px-4 py-3 font-medium text-gray-700'

  return (
    <Modal open={open} onClose={onClose} title={t('家长设置')}>
      <div className="flex flex-col gap-4">
        <div>
          <h3 className="text-sm text-gray-400 mb-2">{t('孩子')}</h3>
          <div className="flex items-center gap-3 mb-3">
            <Avatar symbol={snap.child?.avatarSymbol ?? 'DefaultAvatar'} sizeClass="w-14 h-14 text-5xl" />
            <button className="rounded-xl bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700" onClick={() => avatarInput.current?.click()}>
              📷 {t('上传照片')}
            </button>
            <input
              ref={avatarInput} type="file" accept="image/*" hidden
              onChange={async (e) => {
                const f = e.target.files?.[0]
                if (!f) return
                try {
                  await repo.setAvatar(await fileToAvatarDataURL(f))
                } catch {
                  window.alert('Invalid image')
                }
                e.target.value = ''
              }}
            />
          </div>
          <div className="flex gap-1.5 flex-wrap mb-3">
            {AVATAR_EMOJI_SYMBOLS.map((s) => (
              <button
                key={s}
                onClick={() => void repo.setAvatar(s)}
                className={`w-10 h-10 rounded-full text-xl flex items-center justify-center ${snap.child?.avatarSymbol === s ? 'bg-accent/20 ring-2 ring-accent' : 'bg-gray-50'}`}
              >
                <SymbolIcon name={s} />
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={name} onChange={(e) => setName(e.target.value)} className="flex-1 rounded-2xl border border-gray-200 px-4 py-3" placeholder={t('名字')} />
            <PrimaryButton onClick={() => void repo.renameChild(name)}>{t('保存')}</PrimaryButton>
          </div>
        </div>

        <div>
          <h3 className="text-sm text-gray-400 mb-2">{t('安全')}</h3>
          <button className={row} onClick={() => setShowChangePin(true)}>{t('修改家长 PIN')}</button>
        </div>

        <div>
          <h3 className="text-sm text-gray-400 mb-2">{t('语言')}</h3>
          <div className="flex gap-2">
            {([['zh', '中文'], ['en', 'English']] as const).map(([code, label]) => (
              <button key={code} onClick={() => setLang(code)} className={`rounded-full px-4 py-2 text-sm ${lang === code ? 'bg-accent text-white' : 'bg-gray-100 text-gray-600'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <WeeklyReportToggle open={open} />

        <div>
          <h3 className="text-sm text-gray-400 mb-2">{t('数据')}</h3>
          <div className="flex flex-col gap-2">
            <p className="text-xs text-gray-400">
              {mode === 'local' ? t('本地演示模式（数据仅存本机浏览器）') : t('云端已连接（家庭多设备共享）')}
            </p>
            <button className={row} onClick={exportBackup}>{t('导出备份')}</button>
            <button className={row} onClick={() => fileInput.current?.click()}>{t('导入备份')}</button>
            <input ref={fileInput} type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && importBackup(e.target.files[0])} />
            <button
              className={`${row} !text-negative`}
              onClick={() => window.confirm(t('清空后规则与奖励保留，流水与兑换将删除，且无法恢复。')) && void repo.clearScores()}
            >
              {t('清空积分记录')}
            </button>
            <button
              className={`${row} !text-negative`}
              onClick={() => window.confirm(t('将删除全部数据并恢复到初始示例，无法恢复。')) && void repo.resetAndSeed(snap.child?.name ?? '')}
            >
              {t('重置为示例数据')}
            </button>
          </div>
        </div>

        <div>
          <h3 className="text-sm text-gray-400 mb-2">{t('关于')}</h3>
          <div className="flex flex-col gap-2">
            <a className={row} href="mailto:xinster819ca@gmail.com">{t('联系我们')}</a>
            <p className="text-xs text-gray-400 px-1">{t('版本')} 1.0.0 (web)</p>
          </div>
        </div>

        {signOut && (
          <button className={`${row} !text-negative`} onClick={() => void signOut()}>{t('退出登录')}</button>
        )}

        <PrimaryButton onClick={() => { onClose(); switchToChild() }}>{t('退出家长模式')}</PrimaryButton>
      </div>

      <ChangePinModal open={showChangePin} onClose={() => setShowChangePin(false)} />
    </Modal>
  )
}

function ChangePinModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { repo, t } = useApp()
  const [current, setCurrent] = useState('')
  const [pin1, setPin1] = useState('')
  const [pin2, setPin2] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setCurrent(''); setPin1(''); setPin2(''); setError('')
    }
  }, [open])

  async function save() {
    if (!(await repo.verifyPIN(current))) {
      setError(t('PIN 错误'))
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
    await repo.setPIN(pin1)
    onClose()
  }

  const field = 'rounded-2xl border border-gray-200 px-4 py-3 tracking-widest'
  return (
    <Modal open={open} onClose={onClose} title={t('修改家长 PIN')}>
      <div className="flex flex-col gap-3">
        <input type="password" inputMode="numeric" placeholder={t('当前 PIN')} value={current} onChange={(e) => setCurrent(sanitizedPIN(e.target.value))} className={field} />
        <input type="password" inputMode="numeric" placeholder={t('输入新 PIN')} value={pin1} onChange={(e) => setPin1(sanitizedPIN(e.target.value))} className={field} />
        <input type="password" inputMode="numeric" placeholder={t('再次输入')} value={pin2} onChange={(e) => setPin2(sanitizedPIN(e.target.value))} className={field} />
        {error && <p className="text-sm text-negative">{error}</p>}
        <div className="flex gap-2 justify-end">
          <button className="px-4 py-2 text-gray-500" onClick={onClose}>{t('取消')}</button>
          <PrimaryButton onClick={() => void save()}>{t('保存')}</PrimaryButton>
        </div>
      </div>
    </Modal>
  )
}
