"use client"

import { Component, type ErrorInfo, type ReactNode } from "react"
import { AlertTriangle, RotateCcw } from "lucide-react"

interface PanelErrorBoundaryProps {
  children: ReactNode
  panelName: string
  onReset?: () => void
}

interface PanelErrorBoundaryState {
  error: Error | null
}

export class PanelErrorBoundary extends Component<
  PanelErrorBoundaryProps,
  PanelErrorBoundaryState
> {
  state: PanelErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): PanelErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(
      `[PanelErrorBoundary] ${this.props.panelName} crashed:`,
      error,
      info.componentStack
    )
  }

  handleReset = () => {
    this.setState({ error: null })
    this.props.onReset?.()
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div
        role="alert"
        className="flex flex-col items-start gap-3 rounded-lg border border-[#C23B3B]/30 bg-[#C23B3B]/5 px-4 py-3 text-sm"
      >
        <div className="flex items-start gap-2 text-[#C23B3B]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-semibold">{this.props.panelName} failed to render</p>
            <p className="text-[#6B6B60]">
              This panel hit an unexpected error. The rest of the Warroom is still
              usable. Try again or reload the page.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={this.handleReset}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#E8E5DE] bg-[#FFFFFF] px-3 text-[12px] font-medium text-[#1A1A1A] transition-colors hover:bg-[#F7F7F4]"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          Retry panel
        </button>
      </div>
    )
  }
}
