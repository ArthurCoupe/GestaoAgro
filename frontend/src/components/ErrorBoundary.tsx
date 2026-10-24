import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props { children: ReactNode }
interface State { erro: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { erro: null };

  static getDerivedStateFromError(erro: Error): State {
    return { erro };
  }

  componentDidCatch(erro: Error, info: ErrorInfo) {
    console.error('[exemplo] erro de render capturado pela cerca:', erro, info.componentStack);
  }

  render() {
    const { erro } = this.state;
    if (!erro) return this.props.children;

    return (
      <div className="panel" style={{ margin: '2rem auto', maxWidth: 640 }}>
        <h3>Esta tela quebrou</h3>
        <div className="sub">
          O sistema não conseguiu montar a página. Não foi nada que você fez de errado.
        </div>
        <p>
          O que já tinha sido salvo continua salvo. O que estava digitado nesta tela e ainda
          não foi salvo se perde ao recarregar.
        </p>
        <p>
          <button className="btn" onClick={() => window.location.reload()}>
            Recarregar a página
          </button>
        </p>
        <p>
          Se acontecer de novo na mesma tela, tira um print desta mensagem e manda,
          incluindo a parte de baixo.
        </p>
        <details>
          <summary>Detalhe técnico</summary>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.8rem' }}>
            {erro.message}
            {erro.stack ? `\n\n${erro.stack}` : ''}
          </pre>
        </details>
      </div>
    );
  }
}
