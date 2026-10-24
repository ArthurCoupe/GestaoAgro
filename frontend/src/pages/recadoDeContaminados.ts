export const TIPOS_DE_COGUMELO = ['SH', 'SP', 'SB', 'SS'];
const CHAVE_RECADO_CONTAMINADOS = 'exemplo:contaminados:abrir-em';

export interface RecadoContaminados {
  tipo?: string | null; data_lote?: string | null; galpao?: string | null; lote_id?: number | null;
}
const armazenamentoDaSessao = () => (typeof sessionStorage !== 'undefined' ? sessionStorage : undefined);

export function abrirContaminadosEm(
  recado: RecadoContaminados,
  armazenamento: Pick<Storage, 'setItem'> | undefined = armazenamentoDaSessao(),
): void {
  try { armazenamento?.setItem(CHAVE_RECADO_CONTAMINADOS, JSON.stringify(recado)); } catch { }
}

export function lerRecadoDeContaminados(
  armazenamento: Pick<Storage, 'getItem'> | undefined = armazenamentoDaSessao(),
): RecadoContaminados | null {
  try {
    const bruto = armazenamento?.getItem(CHAVE_RECADO_CONTAMINADOS);
    if (!bruto) return null;
    const r = JSON.parse(bruto) as RecadoContaminados | null;
    if (!r || typeof r !== 'object') return null;
    return {
      tipo: typeof r.tipo === 'string' && TIPOS_DE_COGUMELO.includes(r.tipo) ? r.tipo : null,
      data_lote: typeof r.data_lote === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.data_lote) ? r.data_lote : null,
      galpao: typeof r.galpao === 'string' && r.galpao.trim() !== '' ? r.galpao : null,
      lote_id: Number.isInteger(r.lote_id) && Number(r.lote_id) > 0 ? Number(r.lote_id) : null,
    };
  } catch { return null; }
}

export function descartarRecadoDeContaminados(
  armazenamento: Pick<Storage, 'removeItem'> | undefined = armazenamentoDaSessao(),
): void {
  try { armazenamento?.removeItem(CHAVE_RECADO_CONTAMINADOS); } catch { }
}

export const recadoDaPendencia = (item: {
  especie?: string | null; data_lote: string; galpao: string | null; lote_id: number | null;
}): RecadoContaminados => ({ tipo: item.especie, data_lote: item.data_lote, galpao: item.galpao, lote_id: item.lote_id });

export const ANCORA_ALERTA_DE_RETIRADA = 'contaminados-alerta-retirada';

const CHAVE_RECADO_INVESTIGADOR = 'exemplo:investigador:abrir-no-lote';
const LOTE_DO_INVESTIGADOR = new RegExp(`^\\d{4}-\\d{2}-\\d{2}\\|(${TIPOS_DE_COGUMELO.join('|')})$`);

export function abrirInvestigadorNoLote(
  lote: string,
  armazenamento: Pick<Storage, 'setItem'> | undefined = armazenamentoDaSessao(),
): void {
  try { armazenamento?.setItem(CHAVE_RECADO_INVESTIGADOR, lote); } catch { }
}

export function lerRecadoDoInvestigador(
  armazenamento: Pick<Storage, 'getItem'> | undefined = armazenamentoDaSessao(),
): string | null {
  try {
    const lote = armazenamento?.getItem(CHAVE_RECADO_INVESTIGADOR);
    return lote && LOTE_DO_INVESTIGADOR.test(lote) ? lote : null;
  } catch { return null; }
}

export function descartarRecadoDoInvestigador(
  armazenamento: Pick<Storage, 'removeItem'> | undefined = armazenamentoDaSessao(),
): void {
  try { armazenamento?.removeItem(CHAVE_RECADO_INVESTIGADOR); } catch { }
}

export function filtrosIniciaisDoRecado(recado: RecadoContaminados | null) {
  return {
    fInicio: recado?.data_lote ?? '',
    fFim: recado?.data_lote ?? '',
    fTipo: recado?.tipo ?? '',
    fGalpao: recado?.galpao ?? '',
    fLoteId: recado?.lote_id ?? null,
    fSoSemEstante: recado != null,
  };
}
