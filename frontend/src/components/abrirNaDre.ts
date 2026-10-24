import type { VisaoNova } from '../api/dreNova';

export type EscopoDaDre = 'MES' | 'YTD';
export type LinhaDaDre = 'T01' | 'T02' | 'T03' | 'T06';
export type BlocoDaDre = 'CUSTOS' | 'DESPESAS';
export type IndicadorDaDre = 'PE';
export interface ContaDaDre { linha_id: string; codigo_oficial: string | null }

export interface FiltroDaDre {
  visao: VisaoNova;
  competencia: string;
  escopo: EscopoDaDre;
  linha?: LinhaDaDre;
  bloco?: BlocoDaDre;
  indicador?: IndicadorDaDre;
  conta?: ContaDaDre;
}

const CHAVE = 'exemplo:dre:abrir-em';
const VISOES: VisaoNova[] = ['consolidado', 'producao', 'revenda'];
const LINHAS: LinhaDaDre[] = ['T01', 'T02', 'T03', 'T06'];
const BLOCOS: BlocoDaDre[] = ['CUSTOS', 'DESPESAS'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Arm = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | undefined;
const padrao = (): Arm => (typeof sessionStorage !== 'undefined' ? sessionStorage : undefined);

export function gravarFiltroDaDre(filtro: FiltroDaDre, armazenamento: Arm = padrao()): void {
  try { armazenamento?.setItem(CHAVE, JSON.stringify(filtro)); } catch { }
}

export function filtroValido(bruto: unknown): FiltroDaDre | null {
  if (!bruto || typeof bruto !== 'object') return null;
  const f = bruto as Record<string, unknown>;
  if (!VISOES.includes(f.visao as VisaoNova)) return null;
  if (typeof f.competencia !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])-01$/.test(f.competencia)) return null;
  if (f.escopo !== 'MES' && f.escopo !== 'YTD') return null;
  if (f.linha !== undefined && !LINHAS.includes(f.linha as LinhaDaDre)) return null;
  if (f.bloco !== undefined && !BLOCOS.includes(f.bloco as BlocoDaDre)) return null;
  if (f.indicador !== undefined && f.indicador !== 'PE') return null;
  let conta: ContaDaDre | undefined;
  if (f.conta !== undefined) {
    if (!f.conta || typeof f.conta !== 'object') return null;
    const c = f.conta as Record<string, unknown>;
    if (typeof c.linha_id !== 'string' || !UUID.test(c.linha_id)) return null;
    if (c.codigo_oficial != null && (typeof c.codigo_oficial !== 'string' || c.codigo_oficial.length > 20)) return null;
    conta = { linha_id: c.linha_id.toLowerCase(), codigo_oficial: (c.codigo_oficial as string | null | undefined) ?? null };
  }
  return {
    visao: f.visao as VisaoNova, competencia: f.competencia, escopo: f.escopo,
    ...(f.linha ? { linha: f.linha as LinhaDaDre } : {}), ...(f.bloco ? { bloco: f.bloco as BlocoDaDre } : {}),
    ...(f.indicador ? { indicador: f.indicador as IndicadorDaDre } : {}),
    ...(conta ? { conta } : {}),
  };
}

export function lerFiltroDaDre(armazenamento: Arm = padrao()): FiltroDaDre | null {
  try {
    const texto = armazenamento?.getItem(CHAVE);
    return texto ? filtroValido(JSON.parse(texto)) : null;
  } catch { return null; }
}

export function descartarFiltroDaDre(armazenamento: Arm = padrao()): void {
  try { armazenamento?.removeItem(CHAVE); } catch { }
}

export const competenciaDoFim = (fim: string) => `${fim.slice(0, 7)}-01`;

export function periodoNaDre(periodo: { inicio: string; fim: string }): { competencia: string; escopo: EscopoDaDre } | null {
  const competencia = competenciaDoFim(periodo.fim);
  if (periodo.inicio === competencia) return { competencia, escopo: 'MES' };
  if (periodo.inicio === `${periodo.fim.slice(0, 4)}-01-01`) return { competencia, escopo: 'YTD' };
  return null;
}

export function ehAcumuladoDoAno(meses: string[]): boolean {
  return meses.length === 0 || meses[0] === `${meses[meses.length - 1].slice(0, 4)}-01`;
}

export function abrirNaDre(navegar: (destino: 'dre_nova') => void, filtro: FiltroDaDre, armazenamento: Arm = padrao()): void {
  gravarFiltroDaDre(filtro, armazenamento);
  navegar('dre_nova');
}
