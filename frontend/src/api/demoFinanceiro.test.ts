import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { CHAVES_DOS_GRUPOS, type Escada } from './gerencial';
import {
  getCaixa, getCustosDaProducao, getDreNova, getDreNovaCompetencias, getExecutivo, getIndicadoresDaProducao, getLancamentosDaLinha,
  getLancamentosDoGrupo, getPonte, getTermometro, getVendasPorProduto, razaoDaDemo,
} from './demoFinanceiro';
import type { ChaveDoIndicador, TermometroDoMes } from './objetivos';

const FIXO = vi.hoisted(() => {
  const d = new Date(2026, 9, 15, 12);
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(d);
  return d;
});
afterAll(() => { vi.useRealTimers(); });

const c = (v: number | null | undefined) => Math.round((v ?? 0) * 100);
const somaC = (xs: Array<number | null | undefined>) => xs.reduce<number>((s, v) => s + c(v), 0);
const ultimoDia = (m: string) => `${m}-${new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 0)).getUTCDate()}`;
function janela(hoje: Date) {
  const mes = (delta: number) => {
    const i = hoje.getFullYear() * 12 + hoje.getMonth() + delta;
    return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`;
  };
  return {
    mes,
    hojeIso: `${mes(0)}-${String(hoje.getDate()).padStart(2, '0')}`,
    DOZE: { inicio: `${mes(-12)}-01`, fim: ultimoDia(mes(-1)) },
    PASSADO: { inicio: `${mes(-1)}-01`, fim: ultimoDia(mes(-1)) },
  };
}
const { mes, hojeIso, DOZE, PASSADO } = janela(FIXO);

type Lan = ReturnType<typeof razaoDaDemo>[number];
type Fat = Lan['fatias'][number];
const CAMPO_DO_GRUPO = {
  1: 'receita_bruta', 2: 'deducoes', 3: 'custos_diretos', 4: 'despesas_diretas', 5: 'despesas_compartilhadas',
  6: 'impostos', 7: 'financeiro', 8: 'ajustes_financeiros', 9: 'capex', 10: 'socios',
} as const;
const doRazao = (razao: Lan[], regime: 'COMPETENCIA' | 'CAIXA', p: { inicio: string; fim: string }, filtro: (f: Fat) => boolean = () => true) =>
  razao.flatMap((l) => {
    const data = regime === 'COMPETENCIA' ? (l.soCaixa ? null : l.data_competencia) : l.data_liquidacao;
    return data != null && data.slice(0, 7) >= p.inicio.slice(0, 7) && data.slice(0, 7) <= p.fim.slice(0, 7) ? l.fatias.filter(filtro) : [];
  });
const nos = (fs: Fat[], ...grupos: number[]) => fs.reduce((s, f) => s + (grupos.includes(f.lan.conta.grupo) ? f.cent : 0), 0);
const rlDe = (fs: Fat[]) => nos(fs, 1, 2);
const roDe = (fs: Fat[]) => nos(fs, 1, 2, 3, 4, 5);
const rcDe = (fs: Fat[]) => nos(fs, 1, 2, 3, 4, 5, 6, 7);
const pctDe = (num: number, den: number) => (den === 0 ? null : Math.round((num / den) * 10000) / 100);
function peDe(fs: Fat[]) {
  const rl = rlDe(fs);
  const de = (k: 'FIXO' | 'VARIAVEL') => fs.reduce((s, f) => s + ([3, 4, 5].includes(f.lan.conta.grupo) && f.lan.conta.comportamento === k ? f.cent : 0), 0);
  const fixos = Math.abs(de('FIXO'));
  const mc = rl + de('VARIAVEL');
  return rl > 0 && mc > 0 && fixos !== 0 ? Math.round(fixos / (mc / rl)) : null;
}
const doPimentao = (f: Fat) => f.negocio === 'PRODUCAO' && f.produto === 'PIMENTAO';

describe('razão da demo', () => {
  it('é o mesmo em toda carga e não tem lançamento depois de hoje', () => {
    const r = razaoDaDemo();
    expect(r.length).toBeGreaterThan(1000);
    expect(r.filter((l) => l.data_competencia > hojeIso || (l.data_liquidacao ?? '') > hojeIso)).toEqual([]);
    expect(r.filter((l) => l.fatias.reduce((s, f) => s + f.cent, 0) !== l.cent)).toEqual([]);
  });
});

describe('Visão Executiva: a escada fecha com a série, as atividades e os lançamentos', () => {
  it('12 meses consolidados: escada = Σ dos meses, Σ das atividades e Σ das células de grupo', async () => {
    const ex = await getExecutivo(DOZE.inicio, DOZE.fim, 'consolidado');
    expect(ex.meses_sem_fato).toEqual([]);
    expect(somaC(ex.serie_mensal.map((m) => m.resultado_operacional))).toBe(c(ex.escada.total.resultado_operacional));
    expect(somaC(ex.atividades.map((a) => a.resultado))).toBe(c(ex.escada.total.resultado_operacional));
    expect(c(ex.aconteceu.resultado_operacional)).toBe(c(ex.escada.total.resultado_operacional));
    for (const grupo of CHAVES_DOS_GRUPOS) {
      const g = await getLancamentosDoGrupo({ ...DOZE, visao: 'consolidado', grupo });
      expect(g.total_lancamentos, grupo).toBeGreaterThan(0);
      expect(c(g.soma), grupo).toBe(c(ex.escada.total[grupo as keyof Escada] as number));
    }
  });

  it('as espécies somam o Cogumelo e Cogumelo + Pimentão + sem divisão somam a Produção, em todo campo de valor', async () => {
    const { escada } = await getExecutivo(DOZE.inicio, DOZE.fim, 'consolidado');
    for (const campo of CHAVES_DOS_GRUPOS) {
      const k = campo as keyof Escada;
      expect(somaC(Object.values(escada.por_variedade!).map((e) => e[k] as number)), campo).toBe(c(escada.por_atividade.PRODUCAO_COGUMELO[k] as number));
      expect(somaC([escada.por_atividade.PRODUCAO_COGUMELO[k] as number, escada.por_atividade.PIMENTAO[k] as number, escada.por_atividade.PRODUCAO_SEM_QUEBRA[k] as number]), campo)
        .toBe(c(escada.por_atividade.PRODUCAO[k] as number));
    }
    expect(['SH', 'SP', 'SB'].every((e) => (escada.por_variedade![e as 'SH'].receita_bruta) > 0)).toBe(true);
  });

  it('a composição dos custos soma os custos do card, e cada linha abre os lançamentos que a somam', async () => {
    const ex = await getExecutivo(PASSADO.inicio, PASSADO.fim, 'consolidado');
    expect(-somaC(ex.composicao.custos.map((l) => l.valor))).toBe(c(ex.aconteceu.custos));
    for (const l of ex.composicao.custos) {
      const d = await getLancamentosDaLinha({ ...PASSADO, visao: 'consolidado', linha_id: l.linha_id });
      expect(d.quantidade, l.rotulo ?? '').toBe(l.quantidade_lancamentos);
      expect(somaC(d.lancamentos.map((x) => x.valor_no_periodo)), l.rotulo ?? '').toBe(c(l.valor));
    }
  });

  it('o mês corrente vem marcado provisório, o mais antigo não', async () => {
    const ex = await getExecutivo(`${mes(-6)}-01`, ultimoDia(mes(0)), 'consolidado');
    expect(ex.meses_provisorios?.map((m) => m.mes)).toEqual([mes(-1), mes(0)]);
  });
});

describe('DRE Gerencial: cada grupo é a soma das contas, e os totais são os da escada', () => {
  for (const visao of ['consolidado', 'producao', 'revenda'] as const) {
    it(`mês passado, visão ${visao}`, async () => {
      const d = await getDreNova(`${mes(-1)}-01`, visao);
      const ex = await getExecutivo(PASSADO.inicio, PASSADO.fim, visao);
      const grupos = d.linhas.filter((l) => l.tipo === 'GRUPO');
      for (const g of grupos) {
        expect(somaC(d.linhas.filter((l) => l.linha_pai_id === g.linha_id).map((l) => l.valor)), g.rotulo ?? '').toBe(c(g.valor_acumulado));
      }
      const total = (codigo: string) => d.linhas.find((l) => l.codigo_oficial === codigo)!.valor_acumulado;
      expect(c(total('T01'))).toBe(c(ex.escada.total.receita_liquida));
      expect(c(total('T03'))).toBe(c(ex.escada.total.resultado_operacional));
      expect(c(total('T06'))).toBe(c(ex.escada.total.resultado_competencia));
      expect(d.reconciliacao.confere).toBe(true);
      const conta = d.linhas.find((l) => l.tipo === 'CONTA' && l.tem_fato)!;
      const lans = await getLancamentosDaLinha({ ...PASSADO, visao, linha_id: String(conta.linha_id) });
      expect(somaC(lans.lancamentos.map((x) => x.valor_no_periodo))).toBe(c(conta.valor));
    });
  }

  it('as competências vêm da mais recente para a mais antiga, e a mais recente é a primeira', async () => {
    const r = await getDreNovaCompetencias();
    expect(r.competencias).toHaveLength(24);
    expect(r.mais_recente).toBe(`${mes(0)}-01`);
    expect(r.competencias[23].competencia).toBe(`${mes(-23)}-01`);
  });
});

describe('Caixa e Ponte', () => {
  it('o caixa por atividade e por mês soma o resultado de caixa', async () => {
    const cx = await getCaixa(DOZE.inicio, DOZE.fim, 'consolidado');
    expect(somaC(cx.atividades.map((a) => a.resultado))).toBe(c(cx.resultado_caixa));
    expect(somaC(cx.serie_mensal.map((m) => m.resultado))).toBe(c(cx.resultado_caixa));
    expect(c(cx.contas_a_receber.total_em_aberto)).toBe(somaC(cx.contas_a_receber.por_mes_emissao.map((m) => m.valor)));
  });

  it('a Ponte concilia, com os três baldes em movimento, e os dois lados são os das outras telas', async () => {
    for (const p of [PASSADO, DOZE]) {
      const ponte = await getPonte(p.inicio, p.fim);
      expect(ponte.conciliada).toBe(true);
      expect(c(ponte.baldes.a.total) + c(ponte.baldes.b.total) + c(ponte.baldes.c.total)).toBe(c(ponte.diferenca));
      expect([ponte.baldes.a.a_receber, ponte.baldes.a.a_pagar, ponte.baldes.b.liquidado_fora_do_periodo, ponte.baldes.b.competencia_fora_do_periodo,
        ponte.baldes.c.so_caixa, ponte.baldes.c.fora_do_resultado].every((v) => v !== 0)).toBe(true);
      const ex = await getExecutivo(p.inicio, p.fim, 'consolidado');
      const cx = await getCaixa(p.inicio, p.fim, 'consolidado');
      expect(c(ponte.resultado_competencia)).toBe(c(ex.escada.total.resultado_competencia));
      expect(c(ponte.resultado_caixa)).toBe(c(cx.resultado_caixa));
    }
  });

  it('a série da Ponte tem os 12 meses e a natureza da diferença', async () => {
    const ponte = await getPonte(PASSADO.inicio, PASSADO.fim, undefined, 12);
    expect(ponte.serie_mensal).toHaveLength(12);
    expect(ponte.serie_mensal![11].diferenca).toBe(ponte.diferenca);
    expect(ponte.natureza?.tipo).not.toBe('sem_base');
  });
});

describe('Indicadores e custos da produção: os lotes somam o mês, e o mês fecha com o executivo', () => {
  const g = (kg: number | null | undefined) => Math.round((kg ?? 0) * 1000);

  it('as espécies somam o total, e os lotes de origem fecham o destino dos blocos', async () => {
    const ind = await getIndicadoresDaProducao(DOZE.inicio, DOZE.fim);
    expect(ind.meses).toHaveLength(12);
    for (const m of ind.meses) {
      const t = m.producao.total;
      const es = Object.values(m.producao.por_especie);
      for (const k of ['blocos_produzidos', 'blocos_abertos', 'blocos_contaminados', 'bandejas_produzidas', 'bandejas_vendidas'] as const) {
        expect(es.reduce((s, e) => s + (e[k] ?? 0), 0), `${m.mes} ${k}`).toBe(t[k]);
      }
      expect(es.reduce((s, e) => s + g(e.kg_colhidos), 0), m.mes).toBe(g(t.kg_colhidos));
      expect(es.reduce((s, e) => s + e.rendimento.bandejas, 0), m.mes).toBe(t.rendimento.bandejas);
      expect(t.rendimento.encerradas!.bandejas + t.rendimento.em_colheita!.bandejas).toBe(t.rendimento.bandejas);
      expect(m.producao.vendas_por_especie.reduce((s, v) => s + v.bandejas, 0)).toBe(t.bandejas_vendidas);
      expect(m.revenda.por_especie.reduce((s, v) => s + v.bandejas, 0)).toBe(m.revenda.bandejas_vendidas);
      const f = m.producao.shiitake_colhido;
      expect(g(f.kg_p) + g(f.kg_m) + g(f.kg_g) + g(f.kg_gg), m.mes).toBe(g(m.producao.por_especie.SH.kg_colhidos));
      const o = m.lotes_de_origem;
      for (const x of [...o.lotes, o.total]) {
        expect(x.blocos_contaminados + x.blocos_perdidos + x.blocos_abertos + x.blocos_em_maturacao + x.blocos_sem_destino).toBe(x.blocos_produzidos);
      }
      expect(o.lotes.reduce((s, l) => s + l.blocos_produzidos, 0)).toBe(t.blocos_produzidos);
    }
    const ult = ind.meses[11];
    expect(ult.producao.total.kg_colhidos > 0 && ult.revenda.bandejas_vendidas! > 0 && ind.meses[0].lotes_de_origem.total.lotes_abertura_concluida > 0).toBe(true);
  });

  it('a contaminação do executivo é a dos lotes inoculados nos meses dos indicadores', async () => {
    const ind = await getIndicadoresDaProducao(DOZE.inicio, DOZE.fim);
    const ex = await getExecutivo(DOZE.inicio, DOZE.fim, 'consolidado');
    expect(ind.meses.reduce((s, m) => s + m.producao.total.blocos_produzidos, 0)).toBe(ex.contaminacao.blocos_produzidos);
    expect(ind.meses.reduce((s, m) => s + m.producao.total.blocos_contaminados, 0)).toBe(ex.contaminacao.blocos_contaminados);
  });

  it('os custos: a contaminação em reais e o custo dos blocos são os TOTAIS das tabelas de lotes, e a composição é a da DRE', async () => {
    const cu = await getCustosDaProducao(PASSADO.inicio, PASSADO.fim);
    const m = cu.meses[0];
    expect(c(m.indicadores.contaminacao_em_reais)).toBe(somaC(m.fabricacao.lotes.map((l) => l.custo_dos_contaminados)));
    const comCusto = m.bandeja.lotes.filter((l) => l.custo_dos_blocos != null);
    expect(c(m.bandeja.custo_dos_blocos_abertos)).toBe(somaC(comCusto.map((l) => l.custo_dos_blocos)));
    expect(m.bandeja.bandejas_dos_lotes).toBe(comCusto.reduce((s, l) => s + l.bandejas, 0));
    expect(c(m.indicadores.custo_por_bandeja_produzida)).toBe(c(m.bandeja.custo_dos_blocos_por_bandeja) + c(m.bandeja.embalagens_por_bandeja));
    expect(somaC(m.composicao!.map((x) => x.valor))).toBe(c(m.total_da_composicao));
    const ex = await getExecutivo(PASSADO.inicio, PASSADO.fim, 'consolidado');
    const cog = ex.atividades.find((a) => a.chave === 'PRODUCAO_COGUMELO')!;
    expect(c(m.total_na_dre)).toBe(c(cog.custos) + c(cog.despesas));
    expect(comCusto.length > 0 && (m.indicadores.contaminacao_em_reais ?? 0) > 0).toBe(true);
  });
});

describe('Budget / Projeções: o termômetro sai dos mesmos lotes e vendas, e os quadros se refazem linha a linha', () => {
  const linha = (t: TermometroDoMes, chave: ChaveDoIndicador) => t.indicadores.find((l) => l.chave === chave)!;

  it('o mês fechado: o realizado é o dos indicadores da produção, e os cards são a divisão das linhas', async () => {
    const t = await getTermometro({ mes: mes(-1), especie: 'SH' });
    const sh = (await getIndicadoresDaProducao(PASSADO.inicio, PASSADO.fim)).meses[0].producao;
    const p = sh.por_especie.SH;
    expect(linha(t, 'BLOCOS_FABRICADOS').realizado).toBe(p.blocos_produzidos);
    expect(linha(t, 'BLOCOS_ABERTOS').realizado).toBe(p.blocos_abertos);
    expect(linha(t, 'BANDEJAS_COLHIDAS').realizado).toBe(p.bandejas_produzidas);
    expect(linha(t, 'KG_COLHIDOS').realizado).toBeCloseTo(p.kg_colhidos, 3);
    expect(linha(t, 'BANDEJAS_VENDIDAS').realizado).toBe(sh.vendas_por_especie.find((v) => v.especie === 'SH')!.bandejas);
    for (const l of t.indicadores) {
      expect(l.dias.restantes).toBe(0);
      expect(l.projecao).toBe(Math.round(l.realizado! * 100) / 100);
      expect(l.serie[l.serie.length - 1].acumulado).toBe(l.realizado);
    }
    const r2 = (a: number, b: number) => Math.round((a / b) * 100) / 100;
    expect(t.cards.bandejas_por_bloco.valor).toBe(r2(linha(t, 'BANDEJAS_COLHIDAS').realizado!, linha(t, 'BLOCOS_ABERTOS').realizado!));
    expect(t.cards.preco_medio.valor).toBe(r2(linha(t, 'FATURAMENTO').realizado!, linha(t, 'BANDEJAS_VENDIDAS').realizado!));
    expect(t.cards.contaminacao.valor).toBe(r2(t.cards.contaminacao.contaminados * 100, t.cards.contaminacao.base));
    expect(p.blocos_abertos > 0 && (p.bandejas_produzidas ?? 0) > 0 && linha(t, 'BANDEJAS_VENDIDAS').realizado! > 0 && t.cards.contaminacao.contaminados > 0).toBe(true);
  });

  it('todos os tipos é a soma das espécies, e o mês corrente projeta o realizado mais a média dos dias que faltam', async () => {
    const [todas, ...uma] = await Promise.all((['TODAS', 'SH', 'SP', 'SB'] as const).map((especie) => getTermometro({ mes: mes(0), especie })));
    for (const l of todas.indicadores) {
      const mil = (v: number | null) => Math.round((v ?? 0) * 1000);
      expect(mil(l.realizado)).toBe(uma.reduce((s, t) => s + mil(linha(t, l.chave).realizado), 0));
      if (l.media_por_dia != null) expect(Math.abs(l.projecao! - (l.realizado! + l.media_por_dia * l.dias.restantes))).toBeLessThanOrEqual(0.01 * l.dias.restantes + 0.01);
    }
    expect(todas.indicadores.some((l) => (l.realizado ?? 0) > 0)).toBe(true);
  });

  it('Quadro 1 fecha por mês e encadeia o saldo; Quadro 2 soma as aberturas de cada mês', async () => {
    const { planejamento: p } = await getTermometro({ mes: mes(0), especie: 'SH' });
    p.meses.forEach((m, i) => {
      expect(m.total_maturado).toBe(m.semanas.reduce((s, x) => s + (x.blocos ?? 0), 0));
      expect(m.disponiveis_no_mes).toBe(m.saldo_inicial + m.total_maturado);
      expect(m.saldo_disponivel).toBe(m.disponiveis_no_mes - m.aberturas_viaveis);
      expect(m.aberturas_programadas).toBe(m.aberturas_viaveis + m.deficit);
      if (i > 0) expect(m.saldo_inicial).toBe(p.meses[i - 1].saldo_disponivel);
      const doMes = p.aberturas.filter((a) => a.data.slice(0, 7) === m.mes);
      expect(doMes.reduce((s, a) => s + a.viaveis, 0)).toBe(m.aberturas_viaveis);
      expect(doMes.reduce((s, a) => s + a.falta, 0)).toBe(m.deficit);
    });
    expect(p.aberturas.every((a) => a.falta === a.necessarios - a.viaveis && a.viaveis <= a.disponivel)).toBe(true);
    expect(p.em_maturacao.total).toBe(p.em_maturacao.maturados + p.em_maturacao.maturando);
    expect(p.aberturas.some((a) => a.situacao === 'COBERTA') && p.aberturas.some((a) => a.situacao === 'FABRICAR') && p.fabricacao_por_mes.length > 0).toBe(true);
  });
});

describe('Revenda por produto', () => {
  it('os produtos somam a receita da Revenda na escada', async () => {
    const v = await getVendasPorProduto(DOZE.inicio, DOZE.fim);
    const ex = await getExecutivo(DOZE.inicio, DOZE.fim, 'revenda');
    expect(somaC(v.produtos.map((p) => p.receita))).toBe(c(v.receita_total));
    expect(c(v.receita_total)).toBe(c(ex.escada.por_atividade.REVENDA.receita_bruta));
    expect(v.produtos.every((p) => somaC(p.serie_mensal!.map((m) => m.receita)) === c(p.receita))).toBe(true);
  });
});

describe('o cálculo contra o razão: cada número refeito das fatias, fora do código do módulo', () => {
  const razao = razaoDaDemo();

  it('a escada da competência e a do caixa são as fatias do regime, grupo a grupo, e as duas diferem', async () => {
    for (const regime of ['COMPETENCIA', 'CAIXA'] as const) {
      const { escada } = await getExecutivo(DOZE.inicio, DOZE.fim, 'consolidado', regime);
      const fs = doRazao(razao, regime, DOZE);
      for (const [n, campo] of Object.entries(CAMPO_DO_GRUPO)) expect(c(escada.total[campo]), `${regime} ${campo}`).toBe(nos(fs, Number(n)));
      expect(c(escada.total.receita_liquida), regime).toBe(rlDe(fs));
      expect(c(escada.total.resultado_operacional), regime).toBe(roDe(fs));
      expect(c(escada.total.resultado_competencia), regime).toBe(rcDe(fs));
    }
    const caixa = await getExecutivo(DOZE.inicio, DOZE.fim, 'consolidado', 'CAIXA');
    expect(c(caixa.escada.total.resultado_caixa)).toBe(c((await getCaixa(DOZE.inicio, DOZE.fim, 'consolidado')).resultado_caixa));
    expect(rlDe(doRazao(razao, 'CAIXA', DOZE))).not.toBe(rlDe(doRazao(razao, 'COMPETENCIA', DOZE)));
  });

  it('a série mensal: receita líquida, custos e resultado de cada mês são os do razão naquele mês', async () => {
    const ex = await getExecutivo(DOZE.inicio, DOZE.fim, 'consolidado');
    for (const m of ex.serie_mensal) {
      const fs = doRazao(razao, 'COMPETENCIA', { inicio: m.mes, fim: m.mes });
      expect(c(m.receita_liquida), m.mes).toBe(rlDe(fs));
      expect(c(m.custos), m.mes).toBe(-nos(fs, 3));
      expect(c(m.resultado_operacional), m.mes).toBe(roDe(fs));
    }
    expect(new Set(ex.serie_mensal.map((m) => m.receita_liquida)).size).toBe(12);
  });

  it('os percentuais: a margem da escada e de cada atividade, e a participação na receita', async () => {
    const ex = await getExecutivo(DOZE.inicio, DOZE.fim, 'consolidado');
    const fs = doRazao(razao, 'COMPETENCIA', DOZE);
    expect(ex.escada.total.margem_operacional_pct).toBe(pctDe(roDe(fs), rlDe(fs)));
    expect(ex.escada.total.margem_pct).toBe(pctDe(rcDe(fs), rlDe(fs)));
    expect(ex.aconteceu.custos_pct).toBe(pctDe(-nos(fs, 3), rlDe(fs)));
    for (const a of ex.atividades.filter((x) => x.chave !== 'CORPORATIVO' && x.receita > 0)) {
      expect(a.margem_pct, a.chave).toBe(pctDe(c(a.resultado), c(a.receita)));
      expect(ex.mix.receita[a.chave], a.chave).toBe(pctDe(c(a.receita), somaC(ex.atividades.map((x) => x.receita))));
    }
    const margens = ex.atividades.map((a) => a.margem_pct).filter((m): m is number => m != null);
    expect(margens.length >= 3 && new Set(margens).size === margens.length && margens.every((m) => m !== 0 && Math.abs(m) !== 100)).toBe(true);
  });

  it('o ponto de equilíbrio: fixos ÷ margem de contribuição %, igual no executivo, na série e na DRE do mesmo período', async () => {
    const ex = await getExecutivo(DOZE.inicio, DOZE.fim, 'consolidado');
    const pe = peDe(doRazao(razao, 'COMPETENCIA', DOZE));
    expect(c(ex.objetivos.ponto_equilibrio)).toBe(pe);
    expect(c(ex.objetivos.margem_seguranca_reais)).toBe(c(ex.aconteceu.receita_liquida) - pe!);
    for (const m of ex.serie_mensal) expect(c(m.ponto_equilibrio), m.mes).toBe(peDe(doRazao(razao, 'COMPETENCIA', { inicio: m.mes, fim: m.mes })) ?? 0);
    const dre = await getDreNova(`${mes(-1)}-01`, 'consolidado', DOZE.inicio);
    expect(dre.indicadores.ponto_equilibrio).toBe(pe);
    expect(dre.indicadores.diferenca_para_o_ponto_de_equilibrio).toBe(c(ex.aconteceu.receita_liquida) - pe!);
    expect(pe != null && pe !== c(ex.serie_mensal[11].ponto_equilibrio) && ex.objetivos.margem_seguranca_reais! > 0).toBe(true);
  });

  it('a DRE com "desde" soma todos os meses do intervalo, não só o último', async () => {
    const tres = { inicio: `${mes(-3)}-01`, fim: ultimoDia(mes(-1)) };
    const d = await getDreNova(`${mes(-1)}-01`, 'consolidado', tres.inicio);
    expect(d.periodo?.meses).toEqual([mes(-3), mes(-2), mes(-1)]);
    const fs = doRazao(razao, 'COMPETENCIA', tres);
    const total = (dre: typeof d, codigo: string) => c(dre.linhas.find((l) => l.codigo_oficial === codigo)!.valor_acumulado);
    expect(total(d, 'T01')).toBe(rlDe(fs));
    expect(total(d, 'T03')).toBe(roDe(fs));
    expect(total(d, 'T06')).toBe(rcDe(fs));
    expect(total(await getDreNova(`${mes(-1)}-01`, 'consolidado'), 'T01')).not.toBe(total(d, 'T01'));
  });

  it('o recorte por atividade é a fatia daquela atividade, grupo a grupo', async () => {
    const so = await getExecutivo(DOZE.inicio, DOZE.fim, 'consolidado', 'COMPETENCIA', 'PIMENTAO');
    const todas = await getExecutivo(DOZE.inicio, DOZE.fim, 'consolidado');
    const fs = doRazao(razao, 'COMPETENCIA', DOZE, doPimentao);
    for (const [n, campo] of Object.entries(CAMPO_DO_GRUPO)) {
      expect(c(so.escada.total[campo]), campo).toBe(nos(fs, Number(n)));
      expect(c(so.escada.total[campo]), campo).toBe(c(todas.escada.por_atividade.PIMENTAO[campo]));
    }
    expect(so.escada.total.receita_bruta > 0 && so.escada.total.receita_bruta < todas.escada.total.receita_bruta).toBe(true);
  });

  it('o caixa: entradas são as fatias positivas pagas no período, saídas as negativas, por mês e por atividade', async () => {
    const cx = await getCaixa(DOZE.inicio, DOZE.fim, 'consolidado');
    const fs = doRazao(razao, 'CAIXA', DOZE);
    expect(c(cx.entradas)).toBe(fs.reduce((s, f) => s + Math.max(f.cent, 0), 0));
    expect(c(cx.saidas)).toBe(-fs.reduce((s, f) => s + Math.min(f.cent, 0), 0));
    expect(c(cx.entradas) - c(cx.saidas)).toBe(c(cx.resultado_caixa));
    expect(somaC(cx.serie_mensal.map((m) => m.entradas))).toBe(c(cx.entradas));
    expect(somaC(cx.serie_mensal.map((m) => m.saidas))).toBe(c(cx.saidas));
    expect(somaC(cx.atividades.map((a) => a.entradas))).toBe(c(cx.entradas));
    expect(cx.entradas > 0 && cx.saidas > 0).toBe(true);
  });

  it('por empresa: o caixa, a Ponte e o a receber de cada uma somam o consolidado, e cada lançamento traz a empresa do razão', async () => {
    const cx = await getCaixa(DOZE.inicio, DOZE.fim, 'consolidado');
    const ponte = await getPonte(PASSADO.inicio, PASSADO.fim);
    let somaCaixa = 0;
    let somaPonte = 0;
    for (const empresa of ['AR', 'EXEMPLO'] as const) {
      const daEmpresa = await getCaixa(DOZE.inicio, DOZE.fim, 'consolidado', empresa);
      const fs = doRazao(razao, 'CAIXA', DOZE, (f) => f.lan.empresa === empresa);
      expect(c(daEmpresa.resultado_caixa), empresa).toBe(fs.reduce((s, f) => s + f.cent, 0));
      expect(c(daEmpresa.contas_a_receber.total_em_aberto), empresa).toBe(c(cx.contas_a_receber.por_empresa[empresa]));
      expect(daEmpresa.resultado_caixa !== 0 && daEmpresa.resultado_caixa !== cx.resultado_caixa, empresa).toBe(true);
      somaCaixa += c(daEmpresa.resultado_caixa);
      const p = await getPonte(PASSADO.inicio, PASSADO.fim, empresa);
      expect(p.conciliada, empresa).toBe(true);
      somaPonte += c(p.resultado_competencia);
    }
    expect(somaCaixa).toBe(c(cx.resultado_caixa));
    expect(somaPonte).toBe(c(ponte.resultado_competencia));
    const empresaDe = new Map(razao.map((l) => [l.id, l.empresa]));
    const vistas = new Set<string>();
    for (const linha of (await getExecutivo(PASSADO.inicio, PASSADO.fim, 'consolidado')).composicao.custos) {
      for (const l of (await getLancamentosDaLinha({ ...PASSADO, visao: 'consolidado', linha_id: linha.linha_id })).lancamentos) {
        expect(l.empresa, l.lancamento_id).toBe(empresaDe.get(l.lancamento_id));
        vistas.add(String(l.empresa));
      }
    }
    expect([...vistas].sort()).toEqual(['AR', 'EXEMPLO']);
  });

  it('mês sem movimento de caixa: as saídas são zero positivo, nunca -0 (a tela formataria "-R$ 0,00")', async () => {
    const futuro = { inicio: `${mes(2)}-01`, fim: ultimoDia(mes(2)) };
    const cx = await getCaixa(futuro.inicio, futuro.fim, 'consolidado');
    expect(cx.meses_sem_fato).toEqual([mes(2)]);
    expect([cx.saidas, ...cx.serie_mensal.map((m) => m.saidas), ...cx.atividades.map((a) => a.saidas)].every((v) => Object.is(v, 0))).toBe(true);
    expect((await getCaixa(PASSADO.inicio, PASSADO.fim, 'consolidado')).saidas).toBeGreaterThan(0);
  });
});

describe('a virada do calendário: o módulo carregado de novo em cada data', () => {
  afterEach(() => { vi.setSystemTime(FIXO); });

  for (const [ano, mesDoAno, dia] of [[2026, 11, 1], [2027, 1, 1], [2026, 12, 31], [2028, 2, 29]] as const) {
    it(`${String(dia).padStart(2, '0')}/${String(mesDoAno).padStart(2, '0')}/${ano}`, async () => {
      vi.setSystemTime(new Date(ano, mesDoAno - 1, dia, 12));
      vi.resetModules();
      const m = await import('./demoFinanceiro');
      const j = janela(new Date());
      const razao = m.razaoDaDemo();
      expect(razao.filter((l) => l.data_competencia > j.hojeIso || (l.data_liquidacao ?? '') > j.hojeIso)).toEqual([]);
      const temCorrente = razao.some((l) => !l.soCaixa && l.data_competencia.slice(0, 7) === j.mes(0));
      expect(temCorrente).toBe(dia !== 1);
      const comp = await m.getDreNovaCompetencias();
      expect(comp.competencias.map((x) => x.competencia)).toEqual(Array.from({ length: temCorrente ? 24 : 23 }, (_, i) => `${j.mes(temCorrente ? -i : -i - 1)}-01`));
      expect(comp.mais_recente).toBe(comp.competencias[0].competencia);
      const ex = await m.getExecutivo(`${j.mes(-6)}-01`, ultimoDia(j.mes(0)), 'consolidado');
      expect(ex.meses_provisorios?.map((x) => x.mes)).toEqual(temCorrente ? [j.mes(-1), j.mes(0)] : [j.mes(-1)]);
      const doze = await m.getExecutivo(j.DOZE.inicio, j.DOZE.fim, 'consolidado');
      expect(doze.meses_sem_fato).toEqual([]);
      expect(somaC(doze.serie_mensal.map((x) => x.resultado_operacional))).toBe(c(doze.escada.total.resultado_operacional));
      expect(c(doze.escada.total.resultado_operacional)).toBe(roDe(doRazao(razao, 'COMPETENCIA', j.DOZE)));
      expect((await m.getPonte(j.PASSADO.inicio, j.PASSADO.fim)).conciliada).toBe(true);
      const [todas, ...uma] = await Promise.all((['TODAS', 'SH', 'SP', 'SB'] as const).map((especie) => m.getTermometro({ mes: j.mes(0), especie })));
      for (const l of todas.indicadores) {
        const mil = (v: number | null) => Math.round((v ?? 0) * 1000);
        expect(mil(l.realizado), l.chave).toBe(uma.reduce((s, t) => s + mil(t.indicadores.find((x) => x.chave === l.chave)!.realizado), 0));
      }
    });
  }
});
