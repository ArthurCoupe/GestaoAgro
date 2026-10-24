import { brl, num, pct } from './client';
import { valorExibido, type BudgetDaLinha, type DreNovaLinha, type DreNovaResposta } from './dreNova';
import { periodoDoMes } from '../components/ui';
import { pctDoDesvio, STATUS_DO_BUDGET } from '../components/budgetNaTela';
import { CAMPOS_DA_ESCADA, fmtPp, type Escada, type ExecutivoLinhaFolha, type ExecutivoSerieMensal, type LimiaresAlerta } from './gerencial';
import type { CategoriaDeAlerta, ItemDeAlerta } from '../components/QuadroDeAlertasExemplo';

export const rotuloDoMes = (mes: string) => periodoDoMes(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)) - 1).rotulo;

export type NivelAlerta = 'critico' | 'atencao' | 'destaque' | null;

export interface AlertaCelula {
  nivel: NivelAlerta;
  motivo: string | null;
  desvio_media_pct: number | null;
  desvio_anterior_pct: number | null;
}

export interface AlertasDaSerie {
  celulas: Record<string, Partial<Record<keyof Escada, AlertaCelula>>>;
  melhor_mes: string | null;
  motivo_melhor_mes: string | null;
}

export const LIMIARES_MARGEM_PP = { atencao: 3, critico: 5, piso: 3 } as const;

const RUBRICAS = CAMPOS_DA_ESCADA.filter((c) => !c.separado).map((c) => ({ ...c, pp: c.tipo === 'pct', custo: c.grupo != null && c.grupo >= 2 }));

type Apurado = { mes: string; e: Escada };

function desvio(v: number | null, base: number | null, pp: boolean, piso: number): number | null {
  if (v == null || base == null) return null;
  if (pp) return Math.abs(v - base) < LIMIARES_MARGEM_PP.piso ? null : v - base;
  if (Math.abs(base) < piso || Math.abs(v - base) < piso) return null;
  return ((v - base) * 100) / Math.abs(base);
}

function nivel(ds: Array<number | null>, atencao: number, critico: number): NivelAlerta {
  const validos = ds.filter((d): d is number => d != null);
  if (validos.length === 0) return null;
  const pior = Math.min(...validos);
  if (pior <= -critico) return 'critico';
  if (pior <= -atencao) return 'atencao';
  return pior >= critico ? 'destaque' : null;
}

const media = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

function frase(d: number, pp: boolean, custo: boolean, v: number, base: number, alvo: string): string {
  const n = pp ? fmtPp(Math.abs(d)) : `${Math.abs(Math.round(d))}%`;
  if (custo && Math.sign(v) !== Math.sign(base)) return `${n} ${d < 0 ? 'pior' : 'melhor'} que ${alvo}`;
  const abaixo = custo ? Math.abs(v) < Math.abs(base) : v < base;
  return `${n} ${abaixo ? 'abaixo' : 'acima'} ${alvo.startsWith('a ') ? `d${alvo}` : `de ${alvo}`}`;
}

const fmtBase = (b: number, pp: boolean) => (pp ? pct(b) : `R$ ${num(b)}`);

export function alertasDaSerie(serie: ExecutivoSerieMensal[], limiares: LimiaresAlerta, rotulos: Record<keyof Escada, string>): AlertasDaSerie {
  const celulas: AlertasDaSerie['celulas'] = {};
  const apurados: Apurado[] = [];
  for (const s of serie) {
    const cel: Partial<Record<keyof Escada, AlertaCelula>> = {};
    celulas[s.mes] = cel;
    if (s.escada == null) continue;
    const e = s.escada.total;
    if (apurados.length >= limiares.minimo_meses) {
      const ant = apurados[apurados.length - 1];
      for (const r of RUBRICAS) {
        const { pp, custo } = r;
        const v = e[r.campo];
        const hist = apurados.map((a) => a.e[r.campo]).filter((x): x is number => x != null);
        const m = hist.length >= limiares.minimo_meses ? media(hist) : null;
        const va = ant.e[r.campo];
        const dm = desvio(v, m, pp, limiares.piso_reais);
        const da = desvio(v, va, pp, limiares.piso_reais);
        const lim = pp ? LIMIARES_MARGEM_PP : { atencao: limiares.atencao_pct, critico: limiares.critico_pct };
        const n = nivel([dm, da], lim.atencao, lim.critico);
        const partes: string[] = [];
        if (dm != null && m != null && v != null && Math.abs(dm) >= lim.atencao) partes.push(frase(dm, pp, custo, v, m, `a média dos ${hist.length} meses anteriores (${fmtBase(m, pp)})`));
        if (da != null && va != null && v != null && Math.abs(da) >= lim.atencao) partes.push(frase(da, pp, custo, v, va, rotuloDoMes(ant.mes)));
        cel[r.campo] = { nivel: n, motivo: n == null ? null : partes.join('; '), desvio_media_pct: dm, desvio_anterior_pct: da };
      }
    } else {
      for (const r of RUBRICAS) cel[r.campo] = { nivel: null, motivo: null, desvio_media_pct: null, desvio_anterior_pct: null };
    }
    apurados.push({ mes: s.mes, e });
  }

  let melhor: Apurado | null = null;
  for (const a of apurados) if (melhor == null || a.e.resultado_competencia > melhor.e.resultado_competencia) melhor = a;
  if (melhor == null || apurados.length < 2) return { celulas, melhor_mes: null, motivo_melhor_mes: null };

  const outros = apurados.filter((a) => a !== melhor);
  const favoraveis: string[] = [];
  for (const r of RUBRICAS) {
    const hist = outros.map((a) => a.e[r.campo]).filter((x): x is number => x != null);
    const v = melhor.e[r.campo];
    if (hist.length === 0 || v == null) continue;
    const m = media(hist);
    const d = desvio(v, m, r.pp, limiares.piso_reais);
    if (d != null && d >= (r.pp ? LIMIARES_MARGEM_PP.atencao : limiares.atencao_pct)) {
      favoraveis.push(`${rotulos[r.campo]} ${frase(d, r.pp, r.custo, v, m, 'a média')}`);
    }
  }
  return { celulas, melhor_mes: melhor.mes, motivo_melhor_mes: favoraveis.length > 0 ? favoraveis.join('; ') : 'sem rubrica fora da média' };
}

export const GRUPOS_DO_TOTAL: Partial<Record<keyof Escada, readonly number[]>> = {
  receita_liquida: [1, 2],
  resultado_operacional: [1, 2, 3, 4, 5],
  margem_operacional_pct: [1, 2, 3, 4, 5],
  resultado_competencia: [1, 2, 3, 4, 5, 6, 7],
  margem_pct: [1, 2, 3, 4, 5, 6, 7],
};

export function linhasQueMaisMudaram(atual: ExecutivoLinhaFolha[], anterior: ExecutivoLinhaFolha[], grupo: number | readonly number[], n = 3): Array<{ rotulo: string; delta: number }> {
  const grupos: readonly number[] = typeof grupo === 'number' ? [grupo] : grupo;
  const porId = new Map<string, { rotulo: string; delta: number }>();
  for (const l of atual) if (grupos.includes(l.grupo)) porId.set(l.linha_id, { rotulo: l.rotulo, delta: l.valor });
  for (const l of anterior) {
    if (!grupos.includes(l.grupo)) continue;
    const x = porId.get(l.linha_id) ?? { rotulo: l.rotulo, delta: 0 };
    porId.set(l.linha_id, { rotulo: x.rotulo, delta: x.delta - l.valor });
  }
  return [...porId.values()].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, n);
}

const fmtDelta = (d: number) => (d > 0 ? `+R$ ${num(d)}` : `R$ ${num(d)}`);

export function maioresVariacoes(atual: ExecutivoSerieMensal, anterior: ExecutivoSerieMensal, campo: keyof Escada): string | null {
  const grupo = CAMPOS_DA_ESCADA.find((c) => c.campo === campo)?.grupo;
  const grupos = grupo != null ? [grupo] : GRUPOS_DO_TOTAL[campo];
  if (!grupos) return null;
  const top = linhasQueMaisMudaram(atual.linhas, anterior.linhas, grupos);
  return top.length > 0 ? `maiores variações contra ${rotuloDoMes(anterior.mes)}: ${top.map((l) => `${l.rotulo} ${fmtDelta(l.delta)}`).join('; ')}` : null;
}

export const TEMAS_EXECUTIVOS: ReadonlyArray<{ chave: string; titulo: string; descricao: string; campos: ReadonlyArray<keyof Escada> }> = [
  { chave: 'RESULTADO', titulo: 'Resultado e margem', descricao: 'Resultado e margens fora do padrão',
    campos: ['resultado_operacional', 'margem_operacional_pct', 'resultado_competencia', 'margem_pct'] },
  { chave: 'RECEITA', titulo: 'Receita', descricao: 'Receita e deduções fora do padrão',
    campos: ['receita_bruta', 'deducoes', 'receita_liquida'] },
  { chave: 'CUSTOS', titulo: 'Custos e despesas', descricao: 'Custos, despesas, financeiro e impostos fora do padrão',
    campos: ['custos_diretos', 'despesas_diretas', 'despesas_compartilhadas', 'financeiro', 'impostos'] },
];

export const desvioComSinal = (d: number | null, pp: boolean) => {
  if (d == null) return '—';
  if (pp) return `${d > 0 ? '+' : d < 0 ? '-' : ''}${fmtPp(Math.abs(d))}`;
  const r = Math.round(d);
  return `${r > 0 ? '+' : r < 0 ? '-' : ''}${Math.abs(r)}%`;
};

export type AlertasDoMes = { mes: string; anterior: string; ultimoDaSerie: boolean; categorias: CategoriaDeAlerta[] } | { semBase: string };

export function alertasExecutivosDoMes(serie: ExecutivoSerieMensal[], limiares: LimiaresAlerta, rotulos: Record<keyof Escada, string>, mesAberto?: string): AlertasDoMes {
  const fechada = mesAberto ? serie.filter((s) => s.mes < mesAberto) : serie;
  const apurados = fechada.flatMap((s, i) => (s.escada != null ? [i] : []));
  if (apurados.length === 0) return { semBase: 'Nenhum mês do período tem apuração.' };
  const i = apurados[apurados.length - 1];
  const s = fechada[i];
  const antes = apurados.length - 1;
  if (antes < limiares.minimo_meses) {
    return { semBase: `Os alertas comparam ${rotuloDoMes(s.mes)} com a média dos meses anteriores e precisam de ${limiares.minimo_meses} meses apurados antes dele; há ${antes}.` };
  }
  const ant = fechada[apurados[apurados.length - 2]];
  const celulas = alertasDaSerie(fechada, limiares, rotulos).celulas[s.mes] ?? {};
  const categorias: CategoriaDeAlerta[] = [];
  for (const t of TEMAS_EXECUTIVOS) {
    const itens: Array<ItemDeAlerta & { pior: number; pp: boolean }> = [];
    for (const campo of t.campos) {
      const a = celulas[campo];
      if (a == null || (a.nivel !== 'critico' && a.nivel !== 'atencao')) continue;
      const pp = CAMPOS_DA_ESCADA.find((c) => c.campo === campo)?.tipo === 'pct';
      const v = s.escada!.total[campo];
      itens.push({
        chave: campo,
        nivel: a.nivel === 'critico' ? 'CRITICO' : 'ATENCAO',
        celulas: [rotulos[campo], pp ? pct(v) : brl(v), desvioComSinal(a.desvio_media_pct, pp), desvioComSinal(a.desvio_anterior_pct, pp)],
        detalhe: [a.motivo, maioresVariacoes(s, ant, campo)].filter(Boolean).join('; '),
        pior: Math.min(...[a.desvio_media_pct, a.desvio_anterior_pct].filter((d): d is number => d != null)),
        pp,
      });
    }
    if (itens.length === 0) continue;
    itens.sort((x, y) => (x.nivel === y.nivel ? 0 : x.nivel === 'CRITICO' ? -1 : 1) || x.pior - y.pior);
    categorias.push({
      chave: t.chave, titulo: t.titulo, descricao: t.descricao,
      nivel: itens.some((x) => x.nivel === 'CRITICO') ? 'CRITICO' : 'ATENCAO',
      impacto: desvioComSinal(itens[0].pior, itens[0].pp),
      itens: itens.map(({ pior: _pior, pp: _pp, ...item }) => item),
    });
  }
  return { mes: s.mes, anterior: ant.mes, ultimoDaSerie: s.mes === serie[serie.length - 1]?.mes, categorias };
}

export function mesDosAlertas(serie: ExecutivoSerieMensal[], mesAberto?: string): string | null {
  const fechada = mesAberto ? serie.filter((s) => s.mes < mesAberto) : serie;
  return [...fechada].reverse().find((s) => s.escada != null)?.mes ?? null;
}

export const GRUPOS_SEM_CONTA = 'Grupos com desvio fora das contas com Budget';
const FOLGA_DO_GRUPO_CENT = 100;
type ForaDoBudget = BudgetDaLinha & { desvio_cent: number; cor: 'VERMELHO' | 'AMARELO' };
export function alertasContraOBudget(dre: Pick<DreNovaResposta, 'linhas' | 'budget'>): CategoriaDeAlerta[] {
  const porLinha = dre.budget?.estado === 'COMPARADO' ? dre.budget.por_linha ?? {} : {};
  const fora = (l: DreNovaLinha): ForaDoBudget | null => {
    const b = porLinha[String(l.linha_id)];
    return b?.desvio_cent != null && (b.cor === 'VERMELHO' || b.cor === 'AMARELO') ? (b as ForaDoBudget) : null;
  };
  const pai = new Map(dre.linhas.map((l) => [l.linha_id, l.linha_pai_id]));
  const explicado = new Map<number, number>();
  const subir = (id: number, cent: number) => {
    const vistos = new Set<number>();
    for (let p = pai.get(id); p != null && !vistos.has(p); p = pai.get(p)) { vistos.add(p); explicado.set(p, (explicado.get(p) ?? 0) + cent); }
  };
  for (const l of dre.linhas) {
    const d = l.tipo === 'CONTA' ? porLinha[String(l.linha_id)]?.desvio_cent : null;
    if (d != null) subir(l.linha_id, d);
  }
  const restoDoGrupo = new Map<number, number>();
  const grupos = dre.linhas.filter((l) => l.tipo !== 'CONTA' && l.tipo !== 'TOTAL' && fora(l)).sort((x, y) => (y.profundidade ?? 1) - (x.profundidade ?? 1));
  for (const g of grupos) {
    const resto = fora(g)!.desvio_cent - (explicado.get(g.linha_id) ?? 0);
    if (Math.abs(resto) <= FOLGA_DO_GRUPO_CENT) continue;
    restoDoGrupo.set(g.linha_id, resto);
    subir(g.linha_id, resto);
  }
  const temas = new Map<string, Array<ItemDeAlerta & { desvio: number }>>();
  let grupo = 'Outras linhas';
  for (const l of dre.linhas) {
    if (l.tipo === 'GRUPO' && (l.profundidade ?? 1) === 1) grupo = l.rotulo ?? grupo;
    const b = fora(l);
    if (!b) continue;
    const resto = restoDoGrupo.get(l.linha_id);
    const tema = l.tipo === 'TOTAL' ? 'Totais da DRE' : l.tipo === 'CONTA' ? grupo : resto != null ? GRUPOS_SEM_CONTA : null;
    if (!tema) continue;
    const status = STATUS_DO_BUDGET[b.cor].rotulo;
    const itens = temas.get(tema) ?? [];
    itens.push({
      chave: String(l.linha_id),
      nivel: b.cor === 'VERMELHO' ? 'CRITICO' : 'ATENCAO',
      celulas: [l.rotulo, brl(valorExibido(l)), brl(b.budget_cent / 100), `${brl(b.desvio_cent / 100)} (${pctDoDesvio(b)})`],
      detalhe: resto != null ? `${status}; ${brl(resto / 100)} do desvio ficam fora das contas com Budget: veja o grupo na DRE Gerencial` : status,
      desvio: resto ?? b.desvio_cent,
    });
    temas.set(tema, itens);
  }
  return [...temas].map(([tema, itens]) => {
    itens.sort((x, y) => (x.nivel === y.nivel ? 0 : x.nivel === 'CRITICO' ? -1 : 1) || x.desvio - y.desvio);
    return {
      chave: tema, titulo: tema, descricao: 'Linhas fora do Budget do mês',
      nivel: itens.some((x) => x.nivel === 'CRITICO') ? 'CRITICO' : 'ATENCAO',
      impacto: brl(Math.min(...itens.map((x) => x.desvio)) / 100),
      itens: itens.map(({ desvio: _desvio, ...item }) => item),
    };
  });
}
