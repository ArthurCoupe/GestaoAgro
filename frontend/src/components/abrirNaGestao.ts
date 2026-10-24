import type { FrenteDaGestao } from '../pages/GestaoDoResultado';
import { periodoAoAbrirValido, type PeriodoAoAbrir } from './periodoAoAbrir';

export interface FiltroDaGestao extends PeriodoAoAbrir {
  frente: FrenteDaGestao;
}

const CHAVE = 'exemplo:gestao:abrir-em';
const FRENTES: FrenteDaGestao[] = ['consolidado', 'producao', 'cogumelo', 'pimentao', 'revenda'];
type Arm = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | undefined;
const padrao = (): Arm => (typeof sessionStorage !== 'undefined' ? sessionStorage : undefined);

export function gravarFiltroDaGestao(filtro: FiltroDaGestao, armazenamento: Arm = padrao()): void {
  try { armazenamento?.setItem(CHAVE, JSON.stringify(filtro)); } catch { }
}

export function filtroDaGestaoValido(bruto: unknown): FiltroDaGestao | null {
  if (!bruto || typeof bruto !== 'object') return null;
  const f = bruto as Record<string, unknown>;
  if (!FRENTES.includes(f.frente as FrenteDaGestao)) return null;
  const periodo = periodoAoAbrirValido(f);
  return periodo && { frente: f.frente as FrenteDaGestao, ...periodo };
}

export function lerFiltroDaGestao(armazenamento: Arm = padrao()): FiltroDaGestao | null {
  try {
    const texto = armazenamento?.getItem(CHAVE);
    return texto ? filtroDaGestaoValido(JSON.parse(texto)) : null;
  } catch { return null; }
}

export function descartarFiltroDaGestao(armazenamento: Arm = padrao()): void {
  try { armazenamento?.removeItem(CHAVE); } catch { }
}

export function abrirNaGestao(navegar: (destino: 'gestao_resultado') => void, filtro: FiltroDaGestao, armazenamento: Arm = padrao()): void {
  gravarFiltroDaGestao(filtro, armazenamento);
  navegar('gestao_resultado');
}
