/**
 * Shows a tab's crash (message and where it happened) instead of a blank panel.
 */
import { Component, type ReactNode } from "react"
import { Card } from "~shared/ui"

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <div className="w-page">
        <Card title="This tab crashed">
          <div className="w-stack">
            <p className="w-error">{error.message}</p>
            <pre className="w-mono" style={{ whiteSpace: "pre-wrap", fontSize: "11px", lineHeight: "16px", color: "var(--ink-muted)", margin: 0, maxHeight: "240px", overflow: "auto" }}>{error.stack}</pre>
            <button type="button" className="cx-btn" onClick={() => this.setState({ error: null })}>Try again</button>
          </div>
        </Card>
      </div>
    )
  }
}
