import type { LoteDoRanking, LoteNaSala, QualidadeDoPainel, RankingsDoPainel, SementeFora } from '../api/client';

export interface FiltroDosRankings { sala: string; cepa: string; loteSemente: string }
export const SEM_FILTRO: FiltroDosRankings = { sala: '', cepa: '', loteSemente: '' };
export const chaveDaSemente = (cepa: string, loteSemente: string | null) => JSON.stringify([cepa, loteSemente]);
export const filtroAtivo = (f: FiltroDosRankings) => Boolean(f.sala || f.cepa || f.loteSemente);

type Produtividade = RankingsDoPainel['produtividade'][number];
type Qualidade = RankingsDoPainel['qualidade'][number];
const kg3 = (v: number) => Math.round(v * 1000) / 1000;

export function opcoesDosFiltros(linhas: LoteDoRanking[]) {
  const salas = new Set<string>();
  const cepas = new Set<string>();
  const lotes = new Map<string, { valor: string; cepa: string; rotulo: string }>();
  for (const l of linhas) {
    for (const s of l.salas ?? []) salas.add(s.sala);
    for (const s of l.sementes ?? []) {
      cepas.add(s.cepa);
      if (s.lote_semente != null) {
        const valor = chaveDaSemente(s.cepa, s.lote_semente);
        lotes.set(valor, { valor, cepa: s.cepa, rotulo: `${s.lote_semente} (${s.cepa})` });
      }
    }
  }
  return {
    salas: [...salas].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)) || a.localeCompare(b)),
    cepas: [...cepas].sort((a, b) => a.localeCompare(b)),
    lotesDaSemente: [...lotes.values()].sort((a, b) => a.rotulo.localeCompare(b.rotulo)),
    salasNaoVieram: linhas.length > 0 && linhas.every((l) => l.salas === undefined),
    sementesNaoVieram: linhas.length > 0 && linhas.every((l) => !Array.isArray(l.sementes)),
  };
}

export interface ForaDoFiltro { sem_semente: number; mais_de_uma_semente: number; sem_conta_por_sala: number }

function casaSemente(l: LoteDoRanking, f: FiltroDosRankings): 'sim' | 'nao' | 'mistura' | 'sem_semente' {
  if (!f.cepa && !f.loteSemente) return 'sim';
  const ss = l.sementes;
  if (!ss || ss.length === 0) return 'sem_semente';
  const doFiltro = ss.filter((s) => (!f.cepa || s.cepa === f.cepa) && (!f.loteSemente || chaveDaSemente(s.cepa, s.lote_semente) === f.loteSemente));
  if (doFiltro.length === 0) return 'nao';
  return doFiltro.length === ss.length ? 'sim' : 'mistura';
}

function recortar<T extends LoteDoRanking>(linhas: T[], f: FiltroDosRankings, naSala: (l: T, s: LoteNaSala) => T | null) {
  const fora: ForaDoFiltro = { sem_semente: 0, mais_de_uma_semente: 0, sem_conta_por_sala: 0 };
  const dentro: T[] = [];
  for (const l of linhas) {
    const c = casaSemente(l, f);
    if (c === 'nao') continue;
    if (c === 'mistura') { fora.mais_de_uma_semente += 1; continue; }
    if (c === 'sem_semente') { fora.sem_semente += 1; continue; }
    if (!f.sala) { dentro.push(l); continue; }
    if (!l.salas) { fora.sem_conta_por_sala += 1; continue; }
    const s = l.salas.find((x) => x.sala === f.sala);
    const v = s ? naSala(l, s) : null;
    if (v) dentro.push(v);
  }
  return { linhas: dentro, fora };
}

const pelo = <T extends { chave: string }>(campo: (l: T) => number | null) => (a: T, b: T) => (campo(b) ?? -1) - (campo(a) ?? -1) || a.chave.localeCompare(b.chave);

const semPacotesNaSala = (l: Produtividade, s: LoteNaSala) => (
  l.semente_pacotes != null && !(s.blocos_abertos === l.blocos_abertos && kg3(s.kg_colhidos) === kg3(l.kg_colhidos))
    ? { semente_pacotes: null, semente_fora: 'sala' as const } : {});

export function filtrarProdutividade(linhas: Produtividade[], f: FiltroDosRankings) {
  const r = recortar(linhas, f, (l, s) => (s.blocos_abertos > 0
    ? { ...l, blocos_abertos: s.blocos_abertos, kg_colhidos: s.kg_colhidos, kg_p: s.kg_p, kg_m: s.kg_m, kg_g: s.kg_g, kg_gg: s.kg_gg, kg_por_bloco_aberto: s.kg_colhidos / s.blocos_abertos, ...semPacotesNaSala(l, s) }
    : null));
  return { ...r, linhas: r.linhas.sort(pelo((l) => l.kg_por_bloco_aberto)) };
}

export const kgPorPacote = (kg: number, pacotes: number | null | undefined, casas: number) =>
  (pacotes != null && pacotes > 0 ? Math.round(kg * 10 ** casas) / 10 ** casas / pacotes : null);

export function contarSemPacotes(linhas: Produtividade[]): Record<SementeFora, number> {
  const c: Record<SementeFora, number> = { nao_carregou: 0, sem_saida_no_dia: 0, lote_fora_do_recorte: 0, cepa_diferente: 0, sala: 0 };
  for (const l of linhas) if (l.semente_pacotes == null) c[l.semente_fora ?? 'nao_carregou'] += 1;
  return c;
}

export function qualidadeDosTamanhos(kg: { kg_p: number; kg_m: number; kg_g: number; kg_gg: number }): QualidadeDoPainel {
  const total = kg3(kg.kg_p + kg.kg_m + kg.kg_g + kg.kg_gg);
  const fr = (v: number) => (total ? v / total : null);
  return {
    kg_classificado: total, kg_p: kg.kg_p, kg_m: kg.kg_m, kg_g: kg.kg_g, kg_gg: kg.kg_gg,
    pct_p: fr(kg.kg_p), pct_m: fr(kg.kg_m), pct_g: fr(kg.kg_g), pct_gg: fr(kg.kg_gg), pct_m_ou_maior: fr(kg.kg_m + kg.kg_g + kg.kg_gg),
  };
}

export function filtrarQualidade(linhas: Qualidade[], f: FiltroDosRankings) {
  const r = recortar(linhas, f, (l, s) => {
    const q = qualidadeDosTamanhos(s);
    return q.kg_classificado > 0 ? { ...l, ...q } : null;
  });
  return { ...r, linhas: r.linhas.sort(pelo((l) => l.pct_m_ou_maior)) };
}

export type NivelDaSemente = 'cepa' | 'lote';
export interface GrupoDaSemente {
  chave: string; cepa: string; lote_semente: string | null;
  lotes: number; parciais: number; inconsistentes: number; blocos_abertos: number; kg_colhidos: number; kg_por_bloco_aberto: number | null;
  kg_p: number | null; kg_m: number | null; kg_g: number | null; kg_gg: number | null; kg_sem_tamanho: number | null;
  semente_pacotes: number | null; kg_por_pacote: number | null;
}

export function porSemente(linhas: Produtividade[], nivel: NivelDaSemente) {
  const grupos = new Map<string, { chave: string; cepa: string; lote_semente: string | null; lotes: number; parciais: number; inconsistentes: number; blocos_abertos: number; kg: number; p: number; m: number; g: number; gg: number; soShiitake: boolean; pacotes: number; semPacotes: number }>();
  const fora = { sem_semente: 0, mais_de_uma_semente: 0 };
  const nosGrupos: Produtividade[] = [];
  for (const l of linhas) {
    const ss = l.sementes;
    if (!ss || ss.length === 0) { fora.sem_semente += 1; continue; }
    const chaves = new Set(ss.map((s) => chaveDaSemente(s.cepa, nivel === 'cepa' ? null : s.lote_semente)));
    if (chaves.size > 1) { fora.mais_de_uma_semente += 1; continue; }
    const [chave] = chaves;
    const g = grupos.get(chave) ?? { chave, cepa: ss[0].cepa, lote_semente: nivel === 'cepa' ? null : ss[0].lote_semente, lotes: 0, parciais: 0, inconsistentes: 0, blocos_abertos: 0, kg: 0, p: 0, m: 0, g: 0, gg: 0, soShiitake: true, pacotes: 0, semPacotes: 0 };
    grupos.set(chave, g);
    nosGrupos.push(l);
    if (l.semente_pacotes != null) g.pacotes += l.semente_pacotes; else g.semPacotes += 1;
    g.lotes += 1;
    g.parciais += l.parcial ? 1 : 0;
    g.inconsistentes += l.inconsistente ? 1 : 0;
    g.blocos_abertos += l.blocos_abertos;
    g.kg += l.kg_colhidos;
    g.p += l.kg_p ?? 0; g.m += l.kg_m ?? 0; g.g += l.kg_g ?? 0; g.gg += l.kg_gg ?? 0;
    if (l.tipo !== 'SH') g.soShiitake = false;
  }
  const tamanho = (g: { soShiitake: boolean }, v: number) => (g.soShiitake ? kg3(v) || 0 : null);
  const linhasDosGrupos: GrupoDaSemente[] = [...grupos.values()].map((g) => ({
    chave: g.chave, cepa: g.cepa, lote_semente: g.lote_semente, lotes: g.lotes, parciais: g.parciais, inconsistentes: g.inconsistentes, blocos_abertos: g.blocos_abertos,
    kg_colhidos: kg3(g.kg),
    kg_por_bloco_aberto: g.blocos_abertos > 0 ? g.kg / g.blocos_abertos : null,
    kg_p: tamanho(g, g.p), kg_m: tamanho(g, g.m), kg_g: tamanho(g, g.g), kg_gg: tamanho(g, g.gg),
    kg_sem_tamanho: tamanho(g, kg3(g.kg) - kg3(g.p) - kg3(g.m) - kg3(g.g) - kg3(g.gg)),
    semente_pacotes: g.semPacotes === 0 ? g.pacotes : null,
    kg_por_pacote: g.semPacotes === 0 ? kgPorPacote(g.kg, g.pacotes, 3) : null,
  }));
  linhasDosGrupos.sort((a, b) => (b.kg_por_bloco_aberto ?? -1) - (a.kg_por_bloco_aberto ?? -1) || a.chave.localeCompare(b.chave));
  return { grupos: linhasDosGrupos, fora, semPacotes: contarSemPacotes(nosGrupos) };
}
