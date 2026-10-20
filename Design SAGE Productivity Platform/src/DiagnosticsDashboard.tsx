import { useEffect, useMemo, useState } from "react"
import { Badge } from "@fluentui/react-badge"
import { Button } from "@fluentui/react-button"
import { Card } from "@fluentui/react-card"
import { Input } from "@fluentui/react-input"
import { Text } from "@fluentui/react-text"
import { clearDiagnostics, getDiagnostics, redact, type DiagnosticEntry } from "./diagnostics"

type Health = { name: string; state: "Healthy" | "Unavailable" | "Unknown"; latencyMs?: number; detail?: string }

export default function DiagnosticsDashboard() {
  const [entries, setEntries] = useState<DiagnosticEntry[]>(getDiagnostics)
  const [health, setHealth] = useState<Health[]>([])
  const [query, setQuery] = useState("")
  const [severity, setSeverity] = useState("all")
  const refresh = async () => {
    setEntries(getDiagnostics())
    try { const response = await fetch("/api/dev/diagnostics/health", { signal: AbortSignal.timeout(3500) }); setHealth(response.ok ? (await response.json()).services || [] : []) } catch { setHealth([]) }
  }
  useEffect(() => { refresh(); const listener = () => setEntries(getDiagnostics()); window.addEventListener("sage:diagnostic", listener); return () => window.removeEventListener("sage:diagnostic", listener) }, [])
  const visible = useMemo(() => entries.filter((entry) => (severity === "all" || entry.severity === severity) && JSON.stringify(entry).toLowerCase().includes(query.toLowerCase())), [entries, query, severity])
  const counts = useMemo(() => ({ error: entries.filter((x) => x.severity === "error").length, warning: entries.filter((x) => x.severity === "warning").length, info: entries.filter((x) => x.severity === "info").length }), [entries])
  const exportReport = () => { const blob = new Blob([JSON.stringify(redact({ exportedAt: new Date().toISOString(), entries, health }), null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `sage-diagnostics-${Date.now()}.json`; link.click(); URL.revokeObjectURL(url) }
  return <main className="diagnostics-page">
    <header className="diagnostics-header"><div><Text className="eyebrow">DEVELOPER DIAGNOSTICS · LOCAL HISTORY</Text><h1>Application diagnostics</h1><p>Observed browser failures and development health probes. Backend logs and root causes are not exposed here.</p></div><div className="diagnostics-actions"><Button onClick={refresh}>Refresh health</Button><Button onClick={exportReport}>Export sanitized JSON</Button><Button appearance="secondary" onClick={() => { clearDiagnostics(); setEntries([]) }}>Clear history</Button><Button appearance="subtle" onClick={() => history.back()}>Back to app</Button></div></header>
    <section className="diagnostics-metrics">{(["error", "warning", "info"] as const).map((level) => <Card key={level} className="diagnostic-metric"><Text weight="semibold">{level.toUpperCase()}</Text><strong>{counts[level]}</strong></Card>)}</section>
    <section><div className="section-title"><div><h2>Service availability</h2><Text>Actual lightweight probes only; unavailable means the development server could not reach it.</Text></div></div><div className="health-grid">{health.length ? health.map((service) => <Card key={service.name} className="health-card"><Badge color={service.state === "Healthy" ? "success" : service.state === "Unavailable" ? "danger" : "informative"}>{service.state}</Badge><Text weight="semibold">{service.name}</Text><Text size={200}>{service.latencyMs != null ? `${service.latencyMs} ms` : service.detail || "No timing available"}</Text></Card>) : <Text>No health data is available. Start Vite in development mode to enable local probes.</Text>}</div></section>
    <section className="diagnostic-list-section"><div className="diagnostic-toolbar"><Input value={query} onChange={(_, data) => setQuery(data.value)} placeholder="Search message, endpoint, request ID" aria-label="Search diagnostics" /><select value={severity} onChange={(event) => setSeverity(event.target.value)} aria-label="Filter severity"><option value="all">All severities</option><option value="error">Errors</option><option value="warning">Warnings</option><option value="info">Info</option></select></div><h2>Observed events ({visible.length})</h2>{visible.length ? visible.map((entry) => <Card className="diagnostic-entry" key={entry.id}><div className="diagnostic-entry-top"><Badge color={entry.severity === "error" ? "danger" : entry.severity === "warning" ? "warning" : "informative"}>{entry.severity}</Badge><Text weight="semibold">{entry.source} · {entry.title}</Text><Text size={200}>{new Date(entry.timestamp).toLocaleString()}</Text></div><Text>{entry.message}</Text><div className="diagnostic-meta">{entry.method && <span>{entry.method} {entry.endpoint}</span>}{entry.status != null && <span>HTTP {entry.status || "network"}</span>}{entry.durationMs != null && <span>{entry.durationMs} ms</span>}{entry.requestId && <span>Request ID: <code>{entry.requestId}</code></span>}</div><details><summary>Sanitized details</summary><pre>{JSON.stringify(redact(entry.details || {}), null, 2)}</pre></details><Button size="small" appearance="subtle" onClick={() => navigator.clipboard?.writeText(JSON.stringify(redact(entry), null, 2))}>Copy details</Button></Card>) : <Card className="diagnostic-entry"><Text>No browser events match these filters.</Text></Card>}</section>
  </main>
}
