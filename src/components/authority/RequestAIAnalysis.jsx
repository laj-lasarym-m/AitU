import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { Sparkles } from 'lucide-react'
import { useAuth } from '../../auth/context.js'
import { canAccessRole } from '../../auth/access.js'
import { createAnalysisController } from '../../requests/ai.js'
import { isRealRequest, requestPriorities } from '../../requests/model.js'

export function AnalysisView({ state, onAnalyze, onRetry }) {
  const { phase, analysis, error } = state
  return <section className="authority-analysis" aria-busy={phase === 'checking' || phase === 'analyzing'}>
    <div className="authority-section-heading"><Sparkles size={24} /><h3>AI-анализ обращения</h3></div>
    {phase === 'checking' && <p role="status">Загружаем AI-анализ...</p>}
    {phase === 'analyzing' && <><p role="status">AI анализирует обращение...</p><button className="authority-primary" disabled>Анализируем...</button></>}
    {phase === 'idle' && <><p>AI-анализ ещё не выполнен</p><button className="authority-primary" onClick={onAnalyze}><Sparkles size={18} />Анализировать обращение</button></>}
    {phase === 'error' && <><p role="alert">{error}</p><button className="authority-secondary" onClick={onRetry}>Повторить</button></>}
    {analysis && <dl>
      <div><dt>Категория</dt><dd>{analysis.category}</dd></div>
      <div><dt>Приоритет</dt><dd>{requestPriorities[analysis.priority]}</dd></div>
      <div><dt>Ответственная служба</dt><dd>{analysis.responsible_service}</dd></div>
      <div><dt>Краткое резюме</dt><dd>{analysis.summary}</dd></div>
      <div><dt>Почему AI так решил</dt><dd>{analysis.reason}</dd></div>
    </dl>}
    <p className="authority-ai-note">Рекомендация AI · требует проверки сотрудником. Статус, приоритет и назначение обращения не изменяются.</p>
  </section>
}

function AuthorizedAnalysis({ request }) {
  const controller = useMemo(() => createAnalysisController(request), [request])
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot)
  useEffect(() => { void controller.load() }, [controller])
  return <AnalysisView state={state} onAnalyze={controller.run} onRetry={controller.retry} />
}

export default function RequestAIAnalysis({ request }) {
  const { account } = useAuth()
  if (!isRealRequest(request)) return null
  if (!canAccessRole(account.user, account.profile, 'authority')) return <p role="alert">AI-анализ доступен только подтверждённым сотрудникам.</p>
  return <AuthorizedAnalysis key={`${account.user.id}/${request.databaseId}`} request={request} />
}
