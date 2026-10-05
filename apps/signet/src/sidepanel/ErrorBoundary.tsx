/**
 * Shows a tab's crash (message and where it happened) instead of a blank panel.
 */
import { Component, type ReactNode } from "react"
import { colors } from "~shared/styles/theme"

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <div style={{ padding: '16px', color: colors.danger, fontFamily: 'var(--font-mono)', fontSize: '11px', overflow: 'auto', flex: 1 }}>
        <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>This tab crashed: {error.message}</div>
        <pre style={{ whiteSpace: 'pre-wrap', color: colors.inkMuted, margin: 0 }}>{error.stack}</pre>
        <button type="button" onClick={() => this.setState({ error: null })} style={{ marginTop: '12px', background: 'none', border: `1px solid ${colors.accent}`, color: colors.accent, padding: '6px 10px', cursor: 'pointer' }}>
          TRY AGAIN
        </button>
      </div>
    )
  }
}
