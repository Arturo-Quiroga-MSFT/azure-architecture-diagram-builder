
import { useEffect, useState, type ReactNode } from 'react';
import { Activity, ArrowDownRight, ArrowUpRight, BarChart3, Boxes, BrainCircuit, ChevronRight, CircleAlert, GitBranch, Lightbulb, MapPin, MessageSquareText, RefreshCw, ShieldCheck, Sparkles, Users } from 'lucide-react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { FeedbackResponse, InsightsResponse, OverviewResponse, Recommendation, TimeRange } from '../shared/contracts';
import { enhanceRecommendations, fetchFeedback, fetchInsights, fetchOverview } from './api';

type View = 'overview' | 'geography' | 'journey' | 'models' | 'findings' | 'reliability' | 'retention' | 'feedback' | 'recommendations';
const ranges: TimeRange[] = ['24h', '7d', '30d', '90d'];
const navigation = [
  ['overview', 'Overview', BarChart3], ['geography', 'Geography', MapPin], ['journey', 'Journey', GitBranch], ['models', 'Models', BrainCircuit],
  ['findings', 'Findings', ShieldCheck], ['reliability', 'Reliability', Activity], ['retention', 'Retention', Users],
  ['feedback', 'Feedback', MessageSquareText], ['recommendations', 'Actions', Lightbulb],
] as const;

export default function Dashboard() {
  const [view, setView] = useState<View>('overview');
  const [range, setRange] = useState<TimeRange>('30d');
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [insights, setInsights] = useState<InsightsResponse | null>(null);
  const [feedback, setFeedback] = useState<FeedbackResponse | null>(null);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setError('');
    Promise.all([fetchOverview(range, controller.signal), fetchInsights(range, controller.signal)])
      .then(([nextOverview, nextInsights]) => { setOverview(nextOverview); setInsights(nextInsights); })
      .catch((reason: Error) => { if (reason.name !== 'AbortError') setError(reason.message); });
    fetchFeedback(controller.signal)
      .then(setFeedback)
      .catch((reason: Error) => {
        if (reason.name !== 'AbortError') setFeedback({ source: 'unavailable', items: [], message: reason.message });
      });
    return () => controller.abort();
  }, [range, refreshKey]);

  const title = navigation.find(([id]) => id === view)?.[1] || 'Overview';
  return <div className="app-shell"><aside className="sidebar"><div className="brand-mark"><Boxes size={20} /><span>AADB</span></div><nav aria-label="Analytics views">{navigation.map(([id, label, Icon]) => <button aria-label={label} title={label} className={`nav-item ${view === id ? 'active' : ''}`} key={id} onClick={() => setView(id)}><Icon size={18} /><span>{label}</span></button>)}</nav><div className="sidebar-foot">Product intelligence<br /><strong>Telemetry v2</strong></div></aside><main>
    <header className="topbar"><div><p className="eyebrow">Azure Architecture Diagram Builder</p><h1>{title}</h1></div><div className="topbar-actions"><div className="segmented" aria-label="Time range">{ranges.map((item) => <button className={range === item ? 'selected' : ''} key={item} onClick={() => setRange(item)}>{item}</button>)}</div><button className="icon-button" title="Refresh analytics" onClick={() => setRefreshKey((value) => value + 1)}><RefreshCw size={18} /></button></div></header>
    {overview?.notices.map((notice) => <div className="notice" key={notice}>{notice}</div>)}{error && <div className="error-state">{error}</div>}
    {!overview || !insights ? <div className="loading-state">Loading analytics...</div> : <ViewContent view={view} overview={overview} insights={insights} feedback={feedback} range={range} onEnhanced={(items) => setInsights({ ...insights, recommendations: items })} />}
  </main></div>;
}

function ViewContent({ view, overview, insights, feedback, range, onEnhanced }: { view: View; overview: OverviewResponse; insights: InsightsResponse; feedback: FeedbackResponse | null; range: TimeRange; onEnhanced: (items: Recommendation[]) => void }) {
  if (view === 'overview') return <OverviewView data={overview} />;
  if (view === 'geography') return <GeographyView data={insights} />;
  if (view === 'journey') return <JourneyView data={insights} />;
  if (view === 'models') return <ModelsView data={insights} />;
  if (view === 'findings') return <FindingsView data={insights} />;
  if (view === 'reliability') return <ReliabilityView data={insights} />;
  if (view === 'retention') return <RetentionView data={insights} />;
  if (view === 'feedback') return <FeedbackView data={feedback} />;
  return <RecommendationsView data={insights} range={range} onEnhanced={onEnhanced} />;
}

function OverviewView({ data }: { data: OverviewResponse }) { return <><section className="metric-grid">{data.metrics.map((metric) => { const change = metric.previous ? ((metric.value - metric.previous) / metric.previous) * 100 : 0; return <article className="metric" key={metric.label}><span>{metric.label}</span><strong>{metric.value.toLocaleString()}</strong><small className={change >= 0 ? 'positive' : 'negative'}>{change >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}{Math.abs(change).toFixed(1)}% vs prior period</small></article>; })}</section><section className="dashboard-grid"><Panel eyebrow="Momentum" title="Usage trajectory" badge={data.source}><ResponsiveContainer width="100%" height={300}><AreaChart data={data.trend} margin={{ top: 12, right: 8, left: -20 }}><defs><linearGradient id="eventsFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#007f77" stopOpacity={0.38} /><stop offset="100%" stopColor="#007f77" stopOpacity={0.02} /></linearGradient></defs><CartesianGrid stroke="#d9d6cc" strokeDasharray="3 5" vertical={false} /><XAxis dataKey="bucket" tickFormatter={shortDate} tickLine={false} axisLine={false} /><YAxis tickLine={false} axisLine={false} /><Tooltip labelFormatter={(value) => new Date(String(value)).toLocaleDateString()} /><Area type="monotone" dataKey="events" stroke="#007f77" strokeWidth={2} fill="url(#eventsFill)" /></AreaChart></ResponsiveContainer></Panel><Panel eyebrow="Reach" title="Feature adoption"><RankList items={data.features.map((item) => ({ name: item.name, sub: `${item.users} users`, value: item.count }))} /></Panel></section></>; }
function GeographyView({ data }: { data: InsightsResponse }) { const topCity = data.cities[0]; const countryCount = new Set(data.cities.map((item) => item.country)).size; return <><section className="geo-summary"><article><span>Top city</span><strong>{topCity?.city || 'No data'}</strong><small>{topCity ? `${topCity.users.toLocaleString()} users · ${topCity.country}` : 'No city telemetry in this period'}</small></article><article><span>Cities represented</span><strong>{data.cities.length.toLocaleString()}</strong><small>Top 30 cities by distinct users</small></article><article><span>Countries represented</span><strong>{countryCount.toLocaleString()}</strong><small>Within the ranked city set</small></article></section><section className="dashboard-grid"><Panel eyebrow="Audience location" title="Users by city"><ResponsiveContainer width="100%" height={420}><BarChart data={data.cities.slice(0, 12)} layout="vertical" margin={{ left: 30, right: 24 }}><CartesianGrid stroke="#d9d6cc" horizontal={false} /><XAxis type="number" allowDecimals={false} /><YAxis dataKey="city" type="category" width={92} tickLine={false} axisLine={false} /><Tooltip formatter={(value) => [Number(value).toLocaleString(), 'Distinct users']} /><Bar dataKey="users" fill="#007f77" /></BarChart></ResponsiveContainer></Panel><Panel eyebrow="City detail" title="Most active locations"><div className="geo-table"><div className="geo-row geo-head"><span>City</span><span>Country</span><span>Users</span><span>Sessions</span><span>Events</span></div>{data.cities.slice(0, 15).map((item) => <div className="geo-row" key={`${item.city}-${item.country}`}><strong>{item.city}</strong><span>{item.country}</span><span>{item.users.toLocaleString()}</span><span>{item.sessions.toLocaleString()}</span><span>{item.events.toLocaleString()}</span></div>)}</div></Panel></section><p className="privacy-note"><MapPin size={14} /> City is inferred by Application Insights from network geography and may be approximate. No raw IP addresses are displayed.</p></>; }
function JourneyView({ data }: { data: InsightsResponse }) {
  const handoff = data.validationHandoff;
  return <section className="wide-grid">
    <Panel eyebrow="Success moment" title="Validation handoff">
      <div className="handoff-metrics">
        <article><span>Prompt shown</span><strong>{handoff.shown.toLocaleString()}</strong><small>Successful generations</small></article>
        <article><span>Validation started</span><strong>{handoff.started.toLocaleString()}</strong><small>CTA selections</small></article>
        <article><span>Dismissed</span><strong>{handoff.dismissed.toLocaleString()}</strong><small>Not now selections</small></article>
        <article><span>Start rate</span><strong>{handoff.startRate}%</strong><small>Started / shown</small></article>
      </div>
    </Panel>
    <Panel eyebrow="Product flow" title="Session conversion"><div className="funnel">{data.funnel.map((step, index) => <div className="funnel-step" key={step.name}><span>{step.name}</span><strong>{step.sessions.toLocaleString()}</strong><small>{step.conversion}%</small>{index < data.funnel.length - 1 && <ChevronRight size={16} />}</div>)}</div></Panel>
    <Panel eyebrow="Drop-off" title="Conversion by stage"><ResponsiveContainer width="100%" height={320}><BarChart data={data.funnel} layout="vertical" margin={{ left: 22 }}><CartesianGrid stroke="#d9d6cc" horizontal={false} /><XAxis type="number" domain={[0, 100]} /><YAxis dataKey="name" type="category" width={110} axisLine={false} tickLine={false} /><Tooltip /><Bar dataKey="conversion" fill="#007f77" /></BarChart></ResponsiveContainer></Panel>
  </section>;
}
function ModelsView({ data }: { data: InsightsResponse }) { return <><section className="metric-grid compact">{data.models.slice(0, 4).map((model) => <article className="metric" key={model.model}><span>{model.model}</span><strong>{model.calls.toLocaleString()}</strong><small>{(model.totalTokens / 1_000_000).toFixed(2)}M tokens</small></article>)}</section><Panel eyebrow="Cost and quality" title="Model efficiency"><div className="data-table"><div className="table-row table-head"><span>Model</span><span>Calls</span><span>Tokens</span><span>Avg latency</span><span>P95</span><span>Critique wins</span></div>{data.models.map((model) => <div className="table-row" key={model.model}><strong>{model.model}</strong><span>{model.calls}</span><span>{model.totalTokens.toLocaleString()}</span><span>{(model.averageLatencyMs / 1000).toFixed(1)}s</span><span>{(model.p95LatencyMs / 1000).toFixed(1)}s</span><span>{model.critiqueWins}</span></div>)}</div></Panel></>; }
function FindingsView({ data }: { data: InsightsResponse }) { return <section className="dashboard-grid"><Panel eyebrow="Well-Architected" title="Recurring architecture gaps"><RankList items={data.findings.map((item) => ({ name: item.label, sub: `${item.pillar} · ${item.severity}`, value: item.occurrences }))} /></Panel><Panel eyebrow="Prioritization" title="Findings by occurrence"><ResponsiveContainer width="100%" height={360}><BarChart data={data.findings.slice(0, 8)} layout="vertical" margin={{ left: 26 }}><XAxis type="number" /><YAxis dataKey="label" type="category" width={130} tickLine={false} axisLine={false} /><Tooltip /><Bar dataKey="occurrences">{data.findings.map((item) => <Cell key={item.id} fill={item.severity === 'high' || item.severity === 'critical' ? '#d65f45' : '#c5962f'} />)}</Bar></BarChart></ResponsiveContainer></Panel></section>; }
function ReliabilityView({ data }: { data: InsightsResponse }) { return <section className="three-grid">{data.reliability.map((item) => <article className="signal" key={item.signal}><CircleAlert size={20} /><p>{item.signal}</p><strong>{item.count}</strong><div><span>{item.failureRate}% failure</span><span>P95 {(item.p95DurationMs / 1000).toFixed(1)}s</span></div></article>)}</section>; }
function RetentionView({ data }: { data: InsightsResponse }) { const cohorts = [...new Set(data.cohorts.map((item) => item.cohort))]; return <section className="wide-grid"><Panel eyebrow="Return behavior" title="Weekly cohort retention"><div className="cohort-grid">{cohorts.map((cohort) => <div className="cohort-row" key={cohort}><strong>{cohort}</strong>{Array.from({ length: 7 }, (_, week) => { const point = data.cohorts.find((item) => item.cohort === cohort && item.week === week); return <span key={week} style={{ opacity: point ? Math.max(.18, point.retention / 100) : .06 }}>{point ? `${point.retention}%` : ''}</span>; })}</div>)}</div></Panel><Panel eyebrow="Release impact" title="Version comparison"><RankList items={data.releases.map((item) => ({ name: item.version, sub: `${item.validationAdoption}% validation · ${item.exportsPerSession} exports/session`, value: item.users }))} /></Panel></section>; }
function FeedbackView({ data }: { data: FeedbackResponse | null }) { if (!data || data.source === 'unavailable') return <div className="empty-state"><MessageSquareText size={28} /><h2>Feedback source unavailable</h2><p>{data?.message || 'Cosmos DB is not configured.'}</p></div>; return <div className="feedback-list">{data.items.map((item) => <article key={item.id}><div><strong>{'★'.repeat(item.rating)}{'☆'.repeat(5 - item.rating)}</strong><span>{item.category}</span></div><p>{item.comment || 'No written comment'}</p><small>{new Date(item.createdAt).toLocaleString()} {item.model ? `· ${item.model}` : ''}</small></article>)}</div>; }
function RecommendationsView({ data, range, onEnhanced }: { data: InsightsResponse; range: TimeRange; onEnhanced: (items: Recommendation[]) => void }) { const [busy, setBusy] = useState(false); const run = async () => { setBusy(true); try { onEnhanced(await enhanceRecommendations(range)); } finally { setBusy(false); } }; return <><div className="action-bar"><span>{data.recommendations.length} evidence-linked actions</span><button onClick={run} disabled={busy}><Sparkles size={16} />{busy ? 'Analyzing...' : 'Enhance with AI'}</button></div><div className="recommendation-list">{data.recommendations.map((item) => <article key={item.id}><span className={`priority ${item.priority}`}>{item.priority}</span><div><h2>{item.title}</h2><p>{item.evidence}</p><strong>{item.action}</strong></div><small>{item.source}</small></article>)}</div></>; }
function Panel({ eyebrow, title, badge, children }: { eyebrow: string; title: string; badge?: string; children: ReactNode }) { return <article className="panel"><div className="panel-heading"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div>{badge && <span className="source-badge">{badge}</span>}</div>{children}</article>; }
function RankList({ items }: { items: Array<{ name: string; sub: string; value: number }> }) { return <div className="rank-list">{items.slice(0, 12).map((item, index) => <div className="rank-row" key={`${item.name}-${index}`}><span className="rank">{String(index + 1).padStart(2, '0')}</span><div><strong>{item.name.replaceAll('_', ' ')}</strong><small>{item.sub}</small></div><b>{item.value.toLocaleString()}</b></div>)}</div>; }
function shortDate(value: string) { return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); }