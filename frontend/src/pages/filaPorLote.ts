import { galpaoCurto, num, type PrevisaoAberturaLinha } from '../api/client';

export interface LinhaPorLote {
  chave: string;
  data_lote: string; tipo: string | null;
  data_prevista: string | null; dias_restantes: number | null;
  situacao: PrevisaoAberturaLinha['situacao'];
  parametro_origem: PrevisaoAberturaLinha['parametro_origem'];
  galpoes: string[];
  estantes_por_galpao: Array<{ galpao: string | null; estantes: string[] }>;
  enderecos: number;
  blocos_disponiveis: number | null;
  sem_contagem: number;
  saldo_negativo: boolean;
}

const porNumero = (a: string, b: string) => a.localeCompare(b, 'pt', { numeric: true });

export function linhaPorGrupo(grupo: { chave: string; linhas: PrevisaoAberturaLinha[] }): LinhaPorLote {
  const p = grupo.linhas[0];
  const porGalpao = new Map<string | null, string[]>();
  for (const l of grupo.linhas) {
    if (!porGalpao.has(l.galpao)) porGalpao.set(l.galpao, []);
    if (l.estante != null) porGalpao.get(l.galpao)!.push(l.estante);
  }
  const comValor = grupo.linhas.filter((l) => l.blocos_disponiveis != null);
  return {
    chave: grupo.chave,
    data_lote: p.data_lote, tipo: p.tipo,
    data_prevista: p.data_prevista, dias_restantes: p.dias_restantes,
    situacao: p.situacao, parametro_origem: p.parametro_origem,
    galpoes: [...porGalpao.keys()].filter((g): g is string => g != null),
    estantes_por_galpao: [...porGalpao.entries()].map(([galpao, estantes]) => ({ galpao, estantes: [...estantes].sort(porNumero) })),
    enderecos: grupo.linhas.length,
    blocos_disponiveis: comValor.length === 0 ? null : comValor.reduce((s, l) => s + Math.max(0, l.blocos_disponiveis ?? 0), 0),
    sem_contagem: grupo.linhas.filter((l) => l.origem_quantidade !== 'ESTANTE').length,
    saldo_negativo: grupo.linhas.some((l) => l.saldo_negativo),
  };
}

export const linhasPorLote = (grupos: Array<{ chave: string; linhas: PrevisaoAberturaLinha[] }>): LinhaPorLote[] =>
  grupos.map(linhaPorGrupo);

const porDataDeProducao = (a: LinhaPorLote, b: LinhaPorLote) =>
  a.data_lote.localeCompare(b.data_lote) || (a.tipo ?? '').localeCompare(b.tipo ?? '') || (a.data_prevista ?? '').localeCompare(b.data_prevista ?? '');
const porDataPrevista = (a: LinhaPorLote, b: LinhaPorLote) =>
  (a.data_prevista ?? '').localeCompare(b.data_prevista ?? '') || a.data_lote.localeCompare(b.data_lote);

export function vencidos(lotes: LinhaPorLote[]): LinhaPorLote[] {
  return lotes.filter((l) => l.situacao === 'VENCIDO').sort(porDataDeProducao);
}

export function proximosAVencer(lotes: LinhaPorLote[], n = 5): LinhaPorLote[] {
  return lotes
    .filter((l) => l.dias_restantes != null && l.dias_restantes >= 0 && l.data_prevista != null)
    .sort(porDataPrevista)
    .slice(0, n);
}

export function proximosAAbrir(lotes: LinhaPorLote[], n = 5): LinhaPorLote[] {
  return [...vencidos(lotes), ...proximosAVencer(lotes, Number.POSITIVE_INFINITY)].slice(0, n);
}

export function situacaoDoGrupo(diasRestantes: number | null): string {
  if (diasRestantes == null) return '—';
  if (diasRestantes < 0) return `${-diasRestantes} dia(s) de atraso`;
  if (diasRestantes === 0) return 'vence hoje';
  return `em ${diasRestantes} dia(s)`;
}

export function textoDasEstantes(l: LinhaPorLote, regras: Parameters<typeof galpaoCurto>[1] = []): string {
  const partes = l.estantes_por_galpao.filter((g) => g.estantes.length > 0);
  if (partes.length === 0) return '—';
  if (partes.length === 1) return partes[0].estantes.join(', ');
  return partes.map((g) => `${g.galpao != null ? galpaoCurto(g.galpao, regras) : '—'}: ${g.estantes.join(', ')}`).join(' · ');
}

export function textoDosBlocos(l: LinhaPorLote): string {
  if (l.blocos_disponiveis == null) return '—';
  const base = num(l.blocos_disponiveis);
  const comSemContagem = l.sem_contagem > 0 ? `${base} (+${l.sem_contagem} sem contagem)` : base;
  return l.saldo_negativo ? `${comSemContagem} ⚠` : comSemContagem;
}
