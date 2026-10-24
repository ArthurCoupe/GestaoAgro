import {
  createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode,
} from 'react';
import { dataBr, type RegimePeriodo, type RegimeVigencia } from '../api/client';
import type { ViewId } from '../auth';

export function Kpi({ label, value, delta, tone, onClick, info }: {
  label: string; value: ReactNode; delta?: ReactNode;
  tone?: 'alert' | 'good' | 'info' | 'warn';
  onClick?: () => void;
  info?: string;
}) {
  const filhos = (
    <>
      <div className="lab">{label}{info && <span className="info" tabIndex={0} aria-label={info} title={info} onClick={(e) => e.stopPropagation()}>ⓘ</span>}</div>
      <div className="val">{value}</div>
      {delta != null && <div className="delta">{delta}</div>}
    </>
  );
  if (onClick) {
    return (
      <button type="button" className={['kpi', tone, 'kpi-clicavel'].filter(Boolean).join(' ')} onClick={onClick}>
        {filhos}
      </button>
    );
  }
  return <div className={`kpi ${tone ?? ''}`}>{filhos}</div>;
}

export function Panel({ title, tag, sub, children, id, pergunta }: {
  title: string; tag?: string; sub?: string; children: ReactNode; id?: string;
  pergunta?: string;
}) {
  return (
    <div className="panel" id={id}>
      <h3>{title}{pergunta && <span className="info" tabIndex={0} aria-label={pergunta} title={pergunta}>ⓘ</span>}{tag && <span className="tag">{tag}</span>}</h3>
      {sub && <div className="sub">{sub}</div>}
      {children}
    </div>
  );
}

export function Pill({ tone, children }: {
  tone: 'ok' | 'warn' | 'bad' | 'neutral' | 'info'; children: ReactNode;
}) {
  return <span className={`pill p-${tone}`}>{children}</span>;
}

const NOME_REGIME: Record<string, string> = {
  CAIXA_INTEGRAL: 'regime de caixa',
  COMPETENCIA_INTEGRAL: 'regime de competência',
  AMBOS_POR_LANCAMENTO: 'Competência e caixa por lançamento',
};

export function SeloRegime({ regime }: { regime?: RegimePeriodo | RegimeVigencia | null }) {
  if (!regime) return null;
  const janelas = 'regimes' in regime ? regime.regimes : [regime];
  const misturado = 'misturado' in regime && regime.misturado;
  if (janelas.length === 0) return null;

  if (misturado) {
    const descricao = janelas
      .map((j) => `${NOME_REGIME[j.regime] ?? j.regime}${j.vigente_desde ? ` desde ${dataBr(j.vigente_desde)}` : ''}`)
      .join(' e depois ');
    return (
      <div className="alert-banner media">
        <div>
          <b>⚠ Este período mistura metodologias contábeis</b>
          <div>
            O intervalo atravessa uma troca de critério contábil: {descricao}. O total
            somado não tem uma metodologia única.
          </div>
        </div>
      </div>
    );
  }

  const nome = NOME_REGIME[janelas[0].regime] ?? janelas[0].regime;
  return <Pill tone="neutral">{nome}</Pill>;
}

interface ToastMsg { id: number; texto: string; erro?: boolean }
const ToastCtx = createContext<(texto: string, erro?: boolean) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function duracaoDoToast(erro: boolean): number | null {
  return erro ? null : 3200;
}

export function ToastItem({ msg, remover }: { msg: ToastMsg; remover: (id: number) => void }) {
  return (
    <div
      className={`toast ${msg.erro ? 'err' : ''}`}
      role={msg.erro ? 'alert' : undefined}
      title={msg.erro ? 'clique para fechar' : undefined}
      onClick={msg.erro ? () => remover(msg.id) : undefined}
    >
      {msg.texto}
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msgs, setMsgs] = useState<ToastMsg[]>([]);
  const remover = useCallback((id: number) => setMsgs((m) => m.filter((x) => x.id !== id)), []);
  const push = useCallback((texto: string, erro = false) => {
    const id = Date.now() + Math.random();
    setMsgs((m) => [...m, { id, texto, erro }]);
    const ms = duracaoDoToast(erro);
    if (ms != null) setTimeout(() => remover(id), ms);
  }, [remover]);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toast-wrap">
        {msgs.map((m) => <ToastItem key={m.id} msg={m} remover={remover} />)}
      </div>
    </ToastCtx.Provider>
  );
}

const ConfirmarCtx = createContext<(texto: string) => Promise<boolean>>(async () => false);
export const useConfirmar = () => useContext(ConfirmarCtx);

export function ConfirmarProvider({ children }: { children: ReactNode }) {
  const [pedido, setPedido] = useState<{ texto: string; responder: (ok: boolean) => void } | null>(null);
  const ref = useRef<HTMLDialogElement>(null);

  const confirmar = useCallback(
    (texto: string) => new Promise<boolean>((responder) => setPedido({ texto, responder })),
    [],
  );

  useEffect(() => {
    if (pedido && !ref.current?.open) ref.current?.showModal();
  }, [pedido]);

  const fechar = (ok: boolean) => {
    ref.current?.close();
    pedido?.responder(ok);
    setPedido(null);
  };

  return (
    <ConfirmarCtx.Provider value={confirmar}>
      {children}
      {pedido && (
        <dialog ref={ref} className="confirmar"
          onCancel={(e) => { e.preventDefault(); fechar(false); }}>
          <p className="confirmar-texto">{pedido.texto}</p>
          <div className="confirmar-acoes">
            <button className="btn ghost" autoFocus onClick={() => fechar(false)}>Cancelar</button>
            <button className="btn perigo" onClick={() => fechar(true)}>Confirmar</button>
          </div>
        </dialog>
      )}
    </ConfirmarCtx.Provider>
  );
}

const NavCtx = createContext<(destino: ViewId, ancora?: string | null) => void>(() => {});
export const useNav = () => useContext(NavCtx);
export const NavProvider = NavCtx.Provider;

export const normalizarAncora = (ancora?: string | null): string | null => ancora ?? null;

export function esperarElemento(
  tentar: () => boolean,
  { intervaloMs = 100, limiteTentativas = 40 }: { intervaloMs?: number; limiteTentativas?: number } = {},
): () => void {
  let tentativas = 0;
  const intervalo = setInterval(() => {
    tentativas += 1;
    if (tentar() || tentativas >= limiteTentativas) clearInterval(intervalo);
  }, intervaloMs);
  return () => clearInterval(intervalo);
}

export interface PeriodoState { inicio: string; fim: string; rotulo: string }

export function periodoDoMes(ano: number, mesIndex0: number): PeriodoState {
  const inicio = new Date(Date.UTC(ano, mesIndex0, 1));
  const fim = new Date(Date.UTC(ano, mesIndex0 + 1, 0));
  const abbr = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return {
    inicio: inicio.toISOString().slice(0, 10),
    fim: fim.toISOString().slice(0, 10),
    rotulo: `${abbr[mesIndex0]} ${ano}`,
  };
}

export function idxDoMes(ym: string): number {
  const [ano, mes] = ym.split('-').map(Number);
  return ano * 12 + (mes - 1);
}

export function opcoesDeMes(meses: string[], idxAtual: number): Array<{ idx: number; rotulo: string }> {
  const idxs = new Set(meses.map(idxDoMes));
  idxs.add(idxAtual);
  return [...idxs]
    .sort((a, b) => b - a)
    .map((idx) => ({ idx, rotulo: periodoDoMes(Math.floor(idx / 12), idx % 12).rotulo }));
}

export const PeriodoCtx = createContext<{
  periodo: PeriodoState;
  avancarMes: () => void;
  recente: { ano: number; mes: number } | null;
  recenteErro: string | null;
  mesesDisponiveis: string[];
}>({ periodo: periodoDoMes(2026, 5), avancarMes: () => {}, recente: null, recenteErro: null, mesesDisponiveis: [] });
export const usePeriodo = () => useContext(PeriodoCtx);
