import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('CutUp Chroma caught an error:', error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-8 bg-moss-950 text-sand-100 select-none">
          <div className="max-w-md w-full p-6 rounded-xl bg-moss-900 border border-sand-400/25 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-red-900/40 border border-red-500/40 text-red-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-base font-bold text-sand-100 font-gorton tracking-wide">
                {this.props.fallbackTitle || 'Workspace Rendering Interrupted'}
              </h2>
              <p className="text-xs text-sand-400 leading-relaxed">
                An unexpected vector geometry or image parsing error occurred during canvas rendering.
              </p>
            </div>

            {this.state.error && (
              <div className="p-3 rounded-lg bg-moss-950/80 border border-sand-400/15 text-left overflow-hidden">
                <div className="text-[10px] font-mono text-red-300/90 break-all max-h-24 overflow-y-auto">
                  {this.state.error.message || String(this.state.error)}
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={this.handleReset}
              className="w-full py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-md transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Recover Workspace</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
