import type { EscopoDaTela } from './FiltroDoPeriodo';

export interface PeriodoAoAbrir {
  escopo: EscopoDaTela;
  de?: string;
  ate?: string;
}

const CHAVE = 'exemplo:periodo:abrir-em';
const ESCOPOS: EscopoDaTela[] = ['MES', 'YTD', '12M', 'PERSONALIZADO'];
const MES = /^20\d\d-(0[1-9]|1[0-2])$/;
type Arm = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | undefined;
const padrao = (): Arm => (typeof sessionStorage !== 'undefined' ? sessionStorage : undefined);

export function periodoAoAbrirValido(bruto: unknown): PeriodoAoAbrir | null {
  if (!bruto || typeof bruto !== 'object') return null;
  const f = bruto as Record<string, unknown>;
  if (!ESCOPOS.includes(f.escopo as EscopoDaTela)) return null;
  if (f.escopo !== 'PERSONALIZADO') return { escopo: f.escopo as EscopoDaTela };
  if (typeof f.de !== 'string' || typeof f.ate !== 'string' || !MES.test(f.de) || !MES.test(f.ate)) return null;
  return { escopo: 'PERSONALIZADO', de: f.de, ate: f.ate };
}

export function gravarPeriodoAoAbrir(escopo: EscopoDaTela, intervalo: { inicio: string; fim: string }, armazenamento: Arm = padrao()): void {
  const recado: PeriodoAoAbrir = escopo === 'PERSONALIZADO'
    ? { escopo, de: intervalo.inicio.slice(0, 7), ate: intervalo.fim.slice(0, 7) }
    : { escopo };
  try { armazenamento?.setItem(CHAVE, JSON.stringify(recado)); } catch { }
}

export function lerPeriodoAoAbrir(armazenamento: Arm = padrao()): PeriodoAoAbrir | null {
  try {
    const texto = armazenamento?.getItem(CHAVE);
    return texto ? periodoAoAbrirValido(JSON.parse(texto)) : null;
  } catch { return null; }
}

export function descartarPeriodoAoAbrir(armazenamento: Arm = padrao()): void {
  try { armazenamento?.removeItem(CHAVE); } catch { }
}
