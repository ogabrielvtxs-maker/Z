// @ts-nocheck
import React, { ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Copy, Check } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  copied: boolean;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      copied: false
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null, copied: false };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error caught by ErrorBoundary:", error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleCopyError = () => {
    if (this.state.error) {
      navigator.clipboard.writeText(
        `Error: ${this.state.error.message}\n\nStack:\n${this.state.error.stack || ""}\n\nComponent Stack:\n${
          this.state.errorInfo?.componentStack || ""
        }`
      );
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#070b14] font-sans text-slate-100 flex flex-col items-center justify-center p-6 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] opacity-10" />
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl relative z-10 space-y-6">
            <div className="flex items-center gap-4 border-b border-slate-800 pb-4">
              <div className="inline-flex items-center justify-center p-3 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-500">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-lg font-extrabold text-white uppercase tracking-wider">Ocorreu um Erro Inesperado</h2>
                <p className="text-slate-400 text-xs">A plataforma encontrou uma falha de renderização que impediu a exibição correta desta tela.</p>
              </div>
            </div>

            <div className="bg-slate-950 rounded-xl border border-slate-850 p-4 space-y-3">
              <span className="text-[10px] uppercase font-bold text-rose-400 block font-mono">Diagnóstico Técnico:</span>
              <p className="text-xs text-rose-300 font-mono bg-rose-500/5 border border-rose-500/10 p-3 rounded-lg overflow-x-auto max-h-[120px]">
                {this.state.error?.toString() || "Erro desconhecido"}
              </p>
              {this.state.errorInfo?.componentStack && (
                <div className="space-y-1.5">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block font-mono">Rastro do Erro:</span>
                  <pre className="text-[10px] text-slate-500 font-mono bg-slate-900/50 p-3 rounded-lg overflow-auto max-h-[150px] leading-relaxed">
                    {this.state.errorInfo.componentStack}
                  </pre>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <button
                onClick={this.handleCopyError}
                className="w-full sm:w-auto px-5 py-3 bg-slate-950 hover:bg-slate-850 border border-slate-800 text-slate-300 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
              >
                {this.state.copied ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span className="text-emerald-400">Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copiar Detalhes do Erro</span>
                  </>
                )}
              </button>
              
              <button
                onClick={() => {
                  // Clear potentially corrupted items if requested, or just reload page
                  window.location.reload();
                }}
                className="w-full sm:w-auto px-5 py-3 bg-amber-400 hover:bg-amber-500 text-slate-950 rounded-xl text-xs font-extrabold transition flex items-center justify-center gap-2 cursor-pointer shadow-md"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Recarregar a Página</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
