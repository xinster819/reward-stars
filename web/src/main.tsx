import { StrictMode, useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import type { Session, SupabaseClient } from '@supabase/supabase-js'
import './index.css'
import App from './App'
import { makeSupabaseClient } from './data/supabaseClient'
import { LocalRepo } from './data/localRepo'
import { SupabaseRepo } from './data/supabaseRepo'
import { detectLanguage, translate } from './i18n/strings'
import { passwordError } from './auth/passwordPolicy'

const client = makeSupabaseClient()

function domainLocalizer(): (s: string) => string {
  const lang = detectLanguage()
  return (s) => translate(lang, s)
}

function LocalApp() {
  const repo = useMemo(() => new LocalRepo(window.localStorage, undefined, domainLocalizer()), [])
  return <App repo={repo} mode="local" />
}

function CloudGate({ client }: { client: SupabaseClient }) {
  const [session, setSession] = useState<Session | null>(null)
  const [checked, setChecked] = useState(false)
  const [useLocal, setUseLocal] = useState(false)
  const [recovery, setRecovery] = useState(false)

  useEffect(() => {
    void client.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setChecked(true)
    })
    const { data: sub } = client.auth.onAuthStateChange((event, s) => {
      setSession(s)
      // 点开重置邮件链接回到 App 时，supabase-js 触发 PASSWORD_RECOVERY（并给一个临时 session）。
      // 必须拦截去设新密码，否则会直接把人登录进去。
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
    })
    return () => sub.subscription.unsubscribe()
  }, [client])

  if (!checked) return <div className="min-h-svh flex items-center justify-center text-4xl animate-pulse">⭐</div>
  if (recovery) return <ResetPassword client={client} onDone={() => setRecovery(false)} />
  if (useLocal) return <LocalApp />
  if (!session) return <Login client={client} onUseLocal={() => setUseLocal(true)} />
  return <CloudApp client={client} userID={session.user.id} />
}

function ResetPassword({ client, onDone }: { client: SupabaseClient; onDone: () => void }) {
  const lang = detectLanguage()
  const t = (k: string) => translate(lang, k)
  const [pw, setPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  async function submit() {
    const err = passwordError(pw, confirm)
    if (err) { setError(t(err)); return }
    setBusy(true)
    setError('')
    const { error } = await client.auth.updateUser({ password: pw })
    setBusy(false)
    if (error) setError(error.message)
    else setDone(true)
  }

  const field = 'rounded-2xl border border-gray-200 bg-white px-4 py-3'
  return (
    <div className="min-h-svh flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm flex flex-col gap-3">
        <div className="text-6xl text-center mb-2">{done ? '✅' : '🔑'}</div>
        <h1 className="text-xl font-bold text-gray-800 text-center mb-2">{done ? t('密码已更新') : t('设置新密码')}</h1>
        {done ? (
          <button onClick={onDone} className="rounded-2xl bg-accent text-white font-semibold py-3">{t('完成')}</button>
        ) : (
          <>
            <input className={field} type="password" placeholder={t('新密码')} value={pw} onChange={(e) => setPw(e.target.value)} />
            <input className={field} type="password" placeholder={t('确认新密码')} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            {error && <p className="text-sm text-negative">{error}</p>}
            <button
              onClick={() => void submit()}
              disabled={busy || !pw || !confirm}
              className="rounded-2xl bg-accent text-white font-semibold py-3 disabled:opacity-40"
            >
              {t('保存新密码')}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function CloudApp({ client, userID }: { client: SupabaseClient; userID: string }) {
  const [repo, setRepo] = useState<SupabaseRepo | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)

  // 用 effect 构造/销毁：StrictMode 双跑与登出卸载时正确释放 realtime 通道（useMemo 无清理时机）
  useEffect(() => {
    const r = new SupabaseRepo(client, userID, domainLocalizer(), (m) => setSyncError(m))
    setRepo(r)
    return () => {
      r.dispose()
      setRepo(null)
    }
  }, [client, userID])

  if (!repo) return <div className="min-h-svh flex items-center justify-center text-4xl animate-pulse">⭐</div>
  return (
    <>
      {syncError && (
        <div className="fixed top-0 inset-x-0 z-[60] bg-negative text-white text-sm px-4 py-2 flex items-center justify-between">
          <span className="truncate">⚠️ Sync failed: {syncError}</span>
          <button className="underline ml-3 shrink-0" onClick={() => setSyncError(null)}>OK</button>
        </div>
      )}
      <App repo={repo} mode="cloud" signOut={async () => { await client.auth.signOut() }} />
    </>
  )
}

function Login({ client, onUseLocal }: { client: SupabaseClient; onUseLocal: () => void }) {
  const lang = detectLanguage()
  const t = (k: string) => translate(lang, k)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [forgot, setForgot] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit() {
    setBusy(true)
    setError('')
    if (isSignUp) {
      const { data, error } = await client.auth.signUp({ email, password })
      setBusy(false)
      if (error) setError(error.message)
      // Supabase 开启 Confirm email 时：注册成功但无 session，需先去邮箱点确认链接
      else if (!data.session) setError(t('注册成功：请先去邮箱点确认链接，再回来登录'))
    } else {
      const { error } = await client.auth.signInWithPassword({ email, password })
      setBusy(false)
      if (error) setError(error.message)
    }
  }

  async function sendReset() {
    setBusy(true)
    setError('')
    // redirectTo = App 自身 origin；须在 Supabase → Auth → URL Configuration 的 Redirect URLs 白名单里
    const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
    setBusy(false)
    if (error) setError(error.message)
    else setResetSent(true)
  }

  const field = 'rounded-2xl border border-gray-200 bg-white px-4 py-3'

  if (forgot) {
    return (
      <div className="min-h-svh flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm flex flex-col gap-3">
          <div className="text-6xl text-center mb-2">🔑</div>
          <h1 className="text-xl font-bold text-gray-800 text-center mb-2">{t('设置新密码')}</h1>
          {resetSent ? (
            <p className="text-sm text-gray-600 text-center">{t('重置链接已发到邮箱，点开链接回来即可设置新密码')}</p>
          ) : (
            <>
              <input className={field} type="email" placeholder={t('邮箱')} value={email} onChange={(e) => setEmail(e.target.value)} />
              {error && <p className="text-sm text-negative">{error}</p>}
              <button
                onClick={() => void sendReset()}
                disabled={busy || !email}
                className="rounded-2xl bg-accent text-white font-semibold py-3 disabled:opacity-40"
              >
                {t('发送重置邮件')}
              </button>
            </>
          )}
          <button className="text-sm text-gray-500" onClick={() => { setForgot(false); setResetSent(false); setError('') }}>
            {t('返回登录')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-svh flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm flex flex-col gap-3">
        <div className="text-6xl text-center mb-2">⭐</div>
        <h1 className="text-xl font-bold text-gray-800 text-center mb-2">
          {lang === 'zh' ? '行为奖励' : 'Reward Stars'}
        </h1>
        <input className={field} type="email" placeholder={t('邮箱')} value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className={field} type="password" placeholder={t('密码')} value={password} onChange={(e) => setPassword(e.target.value)} />
        {isSignUp && <p className="text-xs text-gray-400">{t('注册即创建一个家庭空间，全家设备用同一账号登录。')}</p>}
        {error && <p className="text-sm text-negative">{error}</p>}
        <button
          onClick={() => void submit()}
          disabled={busy || !email || !password}
          className="rounded-2xl bg-accent text-white font-semibold py-3 disabled:opacity-40"
        >
          {isSignUp ? t('注册') : t('登录')}
        </button>
        <div className="flex items-center justify-between">
          <button className="text-sm text-gray-500" onClick={() => setIsSignUp(!isSignUp)}>
            {isSignUp ? t('登录') : t('注册')}
          </button>
          {!isSignUp && (
            <button className="text-sm text-gray-400" onClick={() => { setForgot(true); setError('') }}>
              {t('忘记密码？')}
            </button>
          )}
        </div>
        <button className="text-xs text-gray-400 mt-2" onClick={onUseLocal}>{t('继续用本地模式')}</button>
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {client ? <CloudGate client={client} /> : <LocalApp />}
  </StrictMode>,
)
