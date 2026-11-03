import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ShieldAlert, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export interface ErrorBoundary {
  state: State;
  props: Props;
  setState(state: Partial<State> | ((prevState: State, props: Props) => Partial<State>)): void;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught application error:', error, errorInfo);
  }

  private handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full flex flex-col items-center justify-center bg-slate-900 text-white p-6 font-sans">
          <div className="max-w-md w-full bg-slate-800/90 backdrop-blur-xl border border-slate-700/80 rounded-3xl p-8 shadow-2xl text-center space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center mx-auto shadow-lg">
              <ShieldAlert size={32} />
            </div>

            <div>
              <h2 className="text-xl font-black text-white tracking-tight">
                Instabilidade Temporária Detetada
              </h2>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                O BalcãoPOS recuperou de um erro inesperado de interface. Clique abaixo para recarregar o ecossistema com estado limpo.
              </p>
            </div>

            {this.state.error && (
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3 text-left overflow-x-auto text-[11px] font-mono text-rose-300 max-h-28 custom-scrollbar">
                {this.state.error.message}
              </div>
            )}

            <button
              onClick={this.handleReload}
              className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl bg-indigo-600 hover:bg-indigo-500 active:scale-98 text-white font-extrabold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-lg shadow-indigo-600/30"
            >
              <RefreshCw size={15} />
              <span>Recarregar BalcãoPOS</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
