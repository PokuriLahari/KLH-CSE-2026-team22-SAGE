import { Component, type ErrorInfo, type ReactNode } from "react"
import { Button } from "@fluentui/react-button"
import { recordDiagnostic } from "./diagnostics"

type Props = { children: ReactNode }
type State = { error: Error | null }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }
  static getDerivedStateFromError(error: Error): State { return { error } }
  componentDidCatch(error: Error, info: ErrorInfo): void {
    recordDiagnostic({ severity: "error", source: "Frontend", title: "React component error", message: error.message, observed: true, details: { componentStack: info.componentStack, stack: error.stack } })
  }
  render(): ReactNode {
    if (!this.state.error) return this.props.children
    return <main style={{ padding: "3rem", maxWidth: "44rem", margin: "0 auto" }}><h1>SAGE needs to recover</h1><p>A screen failed to render. The developer diagnostics record has the sanitized details.</p><Button appearance="primary" onClick={() => { this.setState({ error: null }); window.location.assign("/") }}>Return to SAGE</Button></main>
  }
}
