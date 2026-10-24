import { Chart } from 'react-chartjs-2';
import { Chart as ChartJS } from 'chart.js';
import type { ChartData, Plugin } from 'chart.js';
import { brl, brlK, pct } from '../api/client';
import { DEFINICOES } from '../api/definicoes';
import type { VisaoNova } from '../api/dreNova';
import type { ExecutivoAconteceu, ExecutivoSerieMensal } from '../api/gerencial';
import { AMBER, baseOpts, BLUE, CINZA, GOLD, GREEN, OLIVEDK, RED } from '../charts/setup';
import { ehAcumuladoDoAno, type BlocoDaDre, type EscopoDaDre, type FiltroDaDre, type IndicadorDaDre, type LinhaDaDre } from './abrirNaDre';
import { pctDaMeta } from './budgetNaTela';
import { rotuloDoMesCurto } from './EvolucaoMensal';
import { Panel } from './ui';

export interface PontoDoMes {
  mes: string;
  rotulo: string;
  semFato: boolean;
  receita: number | null;
  producao: number | null;
  revenda: number | null;
  custos: number | null;
  despesas: number | null;
  resultado: number | null;
  pontoEquilibrio: number | null;
  margem: number | null;
  margemAcumulada: number | null;
  competencia: number | null;
  competenciaAcumulada: number | null;
}

const arred = (v: number) => Math.round(v * 100) / 100;

export function pontosDosGraficos(serie: ExecutivoSerieMensal[], mesesSemFato: string[]): PontoDoMes[] {
  const semFato = new Set(mesesSemFato);
  let rec = 0; let res = 0; let comp = 0; let temComp = false;
  return serie.map((s) => {
    const rotulo = rotuloDoMesCurto(s.mes);
    if (semFato.has(s.mes)) {
      return {
        mes: s.mes, rotulo, semFato: true, receita: null, producao: null, revenda: null, custos: null, despesas: null,
        resultado: null, pontoEquilibrio: null, margem: null, margemAcumulada: null, competencia: null, competenciaAcumulada: null,
      };
    }
    const e = s.escada;
    const somou = s.receita_liquida != null && s.resultado_operacional != null;
    if (somou) { rec += s.receita_liquida as number; res += s.resultado_operacional as number; }
    if (e) { comp += e.total.resultado_competencia; temComp = true; }
    return {
      mes: s.mes,
      rotulo,
      semFato: false,
      receita: s.receita_liquida,
      producao: e?.por_atividade.PRODUCAO?.receita_liquida ?? null,
      revenda: e?.por_atividade.REVENDA?.receita_liquida ?? null,
      custos: s.custos,
      despesas: s.despesas,
      resultado: s.resultado_operacional,
      pontoEquilibrio: s.ponto_equilibrio,
      margem: s.margem_pct,
      margemAcumulada: somou && rec > 0 ? arred((res / rec) * 100) : null,
      competencia: e ? e.total.resultado_competencia : null,
      competenciaAcumulada: e && temComp ? arred(comp) : null,
    };
  });
}

export function receitaForaPorMes(pontos: PontoDoMes[]): Array<{ rotulo: string; valor: number }> {
  return pontos.flatMap((p) => {
    if (p.receita == null || p.producao == null || p.revenda == null) return [];
    const valor = arred(p.receita - p.producao - p.revenda);
    return valor === 0 ? [] : [{ rotulo: p.rotulo, valor }];
  });
}

export function parteNaBarra(producao: number | null, revenda: number | null): number | null {
  if (producao == null || revenda == null || producao < 0 || revenda < 0) return null;
  const soma = producao + revenda;
  return soma > 0 ? Math.round((producao / soma) * 100) : null;
}

const passoDoEixo = (v: number) => 10 ** Math.floor(Math.log10(v)) / 2;

function brutoDoTeto(pontos: PontoDoMes[]): number {
  const valores = pontos.flatMap((p) => [p.receita, p.custos, p.despesas]).filter((v): v is number => v != null);
  return valores.length ? Math.max(...valores) * 1.15 : 0;
}

export function tetoDaPerformance(pontos: PontoDoMes[]): number | null {
  const bruto = brutoDoTeto(pontos);
  if (bruto <= 0) return null;
  const passo = passoDoEixo(bruto);
  return Math.ceil(bruto / passo) * passo;
}

export function pisoDaPerformance(pontos: PontoDoMes[], teto: number | null): number | null {
  if (teto == null) return null;
  const desenhados = pontos.flatMap((p) => [p.receita, p.custos, p.despesas, p.resultado, p.pontoEquilibrio]);
  const menor = Math.min(0, ...desenhados.filter((v): v is number => v != null));
  if (menor === 0) return 0;
  const passo = passoDoEixo(brutoDoTeto(pontos));
  return Math.floor((menor * 1.1) / passo) * passo;
}

export function equilibrioForaDaEscala(pontos: PontoDoMes[], teto: number | null): Array<{ rotulo: string; valor: number }> {
  if (teto == null) return [];
  return pontos.filter((p) => p.pontoEquilibrio != null && p.pontoEquilibrio > teto).map((p) => ({ rotulo: p.rotulo, valor: p.pontoEquilibrio as number }));
}

export const reaisComSinal = (v: number) => {
  const s = brlK(v);
  return v > 0 && s !== 'R$ 0k' ? s.replace('R$ ', 'R$ +') : s;
};
export function mesNoEixo(meses: string[]): (rotulo: string) => string {
  const cruzaOAno = new Set(meses.map((m) => m.slice(0, 4))).size > 1;
  return (rotulo) => (cruzaOAno ? `${rotulo.slice(0, 3)}/${rotulo.slice(-2)}` : rotulo.slice(0, 3));
}

const FOLGA = 6;
const ALTURA = 10;

type Rotulos = {
  rotulosTopo?: Array<string | null>; rotulosTopo2?: Array<string | null>; rotulosMeio?: Array<string | null>; corDoRotulo?: string;
  corDoTopo?: string; rotuloNaLinha?: string;
};
type Escrito = { x: number; w: number; alto: number; h: number };

export const rotulosNoGrafico: Plugin = {
  id: 'rotulosExemplo',
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    const fatia = chart.chartArea.width / Math.max(1, chart.data.labels?.length ?? 1);
    const nomes: number[] = [];
    const rotulos = (k: number) => chart.data.datasets[k] as unknown as Rotulos;
    const doGrupo = (k: number) => rotulos(k).rotulosTopo2 != null && chart.isDatasetVisible(k);
    const escritosDoGrupo: Escrito[] = [];
    let curtoDoGrupo: boolean | undefined;
    chart.data.datasets.forEach((ds, i) => {
      const r = ds as unknown as Rotulos;
      if ((!r.rotulosTopo && !r.rotulosMeio && !r.rotuloNaLinha) || !chart.isDatasetVisible(i)) return;
      const pontos = chart.getDatasetMeta(i).data;
      ctx.save();
      ctx.font = '10px "Segoe UI", Arial, sans-serif';
      const naoCabe = (k: number) => (rotulos(k).rotulosTopo ?? []).some((t) => t != null && ctx.measureText(t).width > fatia - FOLGA);
      const curto = doGrupo(i) ? (curtoDoGrupo ??= chart.data.datasets.some((_, k) => doGrupo(k) && naoCabe(k))) : naoCabe(i);
      const caber = (t: string) => (curto ? t.replace('R$ ', '') : t);
      const escritos: Escrito[] = doGrupo(i) ? escritosDoGrupo : [];
      if (r.rotuloNaLinha && pontos.length > 0) {
        const { y } = pontos[pontos.length - 1].getProps(['y'], true) as { y: number };
        const vizinho = nomes.find((o) => Math.abs(y - o) < ALTURA + 1);
        const yNome = vizinho == null ? y : vizinho + (y >= vizinho ? 1 : -1) * (ALTURA + 1);
        ctx.fillStyle = String((ds as { borderColor?: unknown }).borderColor ?? '#3A3B22');
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(r.rotuloNaLinha, chart.chartArea.right + 4, yNome);
        nomes.push(yNome);
      }
      ctx.textAlign = 'center';
      pontos.forEach((el, j) => {
        const { x, y, base, width } = el.getProps(['x', 'y', 'base', 'width'], true) as { x: number; y: number; base?: number; width?: number };
        const valor = Number((ds.data as Array<number | null>)[j]);
        const meio = r.rotulosMeio?.[j];
        if (meio && base != null && Math.abs(base - y) >= 12 && ctx.measureText(meio).width <= (width ?? fatia)) {
          ctx.fillStyle = r.corDoRotulo ?? '#fff';
          ctx.textBaseline = 'middle';
          ctx.fillText(meio, x, (y + base) / 2);
        }
        const topo = r.rotulosTopo?.[j];
        if (topo && Number.isFinite(valor)) {
          const t = caber(topo);
          const t2 = r.rotulosTopo2?.[j];
          const w = Math.max(ctx.measureText(t).width, t2 ? ctx.measureText(t2).width : 0);
          const passo = t2 ? ALTURA + 1 : 0;
          const h = ALTURA + passo;
          const ty = valor < 0 ? y + 4 : y - 4;
          const alto = valor < 0 ? ty : ty - h;
          const encosta = escritos.some((e) => Math.abs(x - e.x) < (w + e.w) / 2 + FOLGA && alto < e.alto + e.h + 1 && e.alto < alto + h + 1);
          if (!encosta) {
            ctx.fillStyle = r.corDoTopo ?? '#3A3B22';
            ctx.textBaseline = valor < 0 ? 'top' : 'bottom';
            const [y1, y2] = valor < 0 ? [ty, ty + passo] : [ty - passo, ty];
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 3;
            ctx.lineJoin = 'round';
            ctx.strokeText(t, x, y1);
            ctx.fillText(t, x, y1);
            if (t2) {
              ctx.strokeText(t2, x, y2);
              ctx.fillText(t2, x, y2);
            }
            escritos.push({ x, w, alto, h });
          }
        }
      });
      ctx.restore();
    });
  },
};

export const emMil = (v: number | null) => (v == null ? null : v / 1000);
export const eixoEmMil = { grace: '12%', ticks: { callback: (v: string | number) => `R$ ${Number(v).toLocaleString('pt-BR')}k` } };
export const legenda = {
  legend: {
    position: 'top' as const,
    labels: {
      boxWidth: 12,
      sort: (a: { datasetIndex?: number }, b: { datasetIndex?: number }) => (a.datasetIndex ?? 0) - (b.datasetIndex ?? 0),
      filter: (item: { datasetIndex?: number }, data: { datasets: unknown[] }) => !(data.datasets[item.datasetIndex ?? 0] as Rotulos).rotuloNaLinha,
    },
  },
};
const legendaOuro = {
  ...legenda.legend,
  labels: {
    ...legenda.legend.labels,
    generateLabels: (chart: ChartJS) =>
      ChartJS.defaults.plugins.legend.labels.generateLabels(chart).map((l) => (l.datasetIndex === 0 ? { ...l, fillStyle: GOLD } : l)),
  },
};
type Dica = { dataset: { label?: string }; parsed: { y: number | null } };
export const dica = (f: (v: number) => string) => ({
  callbacks: { label: (c: Dica) => (c.parsed.y == null ? `${c.dataset.label}` : `${c.dataset.label}: ${f(c.parsed.y)}`) },
});

const TITULO = {
  performance: 'Performance financeira', margem: 'Margem operacional', competencia: 'Resultado por competência', composicao: 'Composição da receita',
} as const;

export type PropsDosGraficos = {
  serie: ExecutivoSerieMensal[]; mesesSemFato: string[]; etiqueta: string; periodo: string;
  aconteceu: Pick<ExecutivoAconteceu, 'margem_minima_pct' | 'meta_pct' | 'meta_origem'>;
  onAbrirDre?: (filtro: FiltroDaDre) => void;
  visao?: VisaoNova;
};

type DreDaSerie = { linha?: LinhaDaDre; bloco?: BlocoDaDre; indicador?: IndicadorDaDre; escopo: EscopoDaDre; visao?: VisaoNova };

export function destinoDoClique(dre: DreDaSerie | undefined, ponto: PontoDoMes | undefined, valor: unknown, visaoDoGrafico: VisaoNova = 'consolidado'): FiltroDaDre | null {
  if (!dre || !ponto || ponto.semFato || valor == null) return null;
  return {
    visao: dre.visao ?? visaoDoGrafico, competencia: `${ponto.mes}-01`, escopo: dre.escopo,
    ...(dre.linha ? { linha: dre.linha } : {}), ...(dre.bloco ? { bloco: dre.bloco } : {}), ...(dre.indicador ? { indicador: dre.indicador } : {}),
  };
}

export const maoForaDaArea: Plugin = {
  id: 'maoForaDaArea',
  afterEvent(chart, args) { if (!args.inChartArea) chart.canvas.style.cursor = 'default'; },
};

export const FRASE_DO_CLIQUE = ' Clique num mês para abrir a DRE dele.';

export type ElementoClicado = { datasetIndex: number; index: number };
type Serie = { dre?: DreDaSerie; data: unknown[] };
export function opcoesDeClique<T>(destino: (el: ElementoClicado) => T | null, abrir?: (t: T) => void) {
  if (!abrir) return {};
  const doPrimeiro = (els: ElementoClicado[]) => (els[0] ? destino(els[0]) : null);
  return {
    onClick: (e: { native?: Event | null } | null, els: ElementoClicado[]) => {
      if ((e?.native as PointerEvent | null | undefined)?.pointerType === 'touch') return;
      const t = doPrimeiro(els);
      if (t != null) abrir(t);
    },
    onHover: (e: { native?: { target?: unknown } | null }, els: ElementoClicado[]) => {
      const alvo = e.native?.target as { style?: { cursor: string } } | undefined;
      if (alvo?.style) alvo.style.cursor = doPrimeiro(els) != null ? 'pointer' : 'default';
    },
  };
}

function cliqueNoMes(datasets: Serie[], pontos: PontoDoMes[], onAbrirDre?: (filtro: FiltroDaDre) => void, visao?: VisaoNova) {
  return opcoesDeClique((el) => {
    const ds = datasets[el.datasetIndex];
    return ds ? destinoDoClique(ds.dre, pontos[el.index], ds.data[el.index], visao) : null;
  }, onAbrirDre);
}

export function equilibrioNoEixo(pontos: PontoDoMes[], teto: number | null): Array<{ real: number | null; desenhado: number | null; acima: boolean }> {
  return pontos.map((p) => {
    const real = p.semFato ? null : p.pontoEquilibrio;
    const acima = real != null && teto != null && real > teto;
    return { real, desenhado: acima ? teto : real, acima };
  });
}

type DicaComReais = { dataset: { label?: string; reais?: Array<number | null> }; parsed: { y: number | null }; dataIndex: number };
const dicaDaPerformance = {
  callbacks: {
    label: (c: DicaComReais) => {
      const v = c.dataset.reais ? c.dataset.reais[c.dataIndex] : c.parsed.y == null ? null : c.parsed.y * 1000;
      return v == null ? `${c.dataset.label}` : `${c.dataset.label}: ${brlK(v)}`;
    },
  },
};

function montarGraficos({ serie, mesesSemFato, aconteceu }: PropsDosGraficos) {
  const pontos = pontosDosGraficos(serie, mesesSemFato);
  if (pontos.every((p) => p.semFato)) return null;
  const eixo = mesNoEixo(serie.map((s) => s.mes));
  const labels = pontos.map((p) => eixo(p.rotulo));
  const ytd = ehAcumuladoDoAno(serie.map((s) => s.mes));
  const acumulado = ytd ? 'YTD' : 'no período';
  const de = (f: (p: PontoDoMes) => number | null) => pontos.map((p) => (p.semFato ? null : f(p)));

  const fora = receitaForaPorMes(pontos);
  const partes = pontos.map((p) => parteNaBarra(p.producao, p.revenda));
  const composicao = {
    labels,
    datasets: [
      {
        type: 'bar' as const, label: 'Produção', dre: { linha: 'T01', escopo: 'MES', visao: 'producao' } as DreDaSerie, data: de((p) => emMil(p.producao)), backgroundColor: GOLD, stack: 'r',
        rotulosMeio: partes.map((v) => (v == null ? null : `${v}%`)),
      },
      {
        type: 'bar' as const, label: 'Revenda', dre: { linha: 'T01', escopo: 'MES', visao: 'revenda' } as DreDaSerie, data: de((p) => emMil(p.revenda)), backgroundColor: OLIVEDK, stack: 'r',
        rotulosMeio: partes.map((v) => (v == null ? null : `${100 - v}%`)),
        rotulosTopo: pontos.map((p) => (p.producao == null || p.revenda == null || p.receita == null ? null : brlK(p.receita))),
      },
    ],
  };

  const teto = tetoDaPerformance(pontos);
  const piso = pisoDaPerformance(pontos, teto);
  const foraDaEscala = equilibrioForaDaEscala(pontos, teto);
  const pe = equilibrioNoEixo(pontos, teto);
  const performance = {
    labels,
    datasets: [
      { type: 'bar' as const, label: 'Receita', dre: { linha: 'T01', escopo: 'MES' } as DreDaSerie, data: de((p) => emMil(p.receita)), backgroundColor: GOLD, borderRadius: 5 },
      { type: 'bar' as const, label: 'Custos', dre: { bloco: 'CUSTOS', escopo: 'MES' } as DreDaSerie, data: de((p) => emMil(p.custos)), backgroundColor: OLIVEDK, borderRadius: 5 },
      { type: 'bar' as const, label: 'Despesas', dre: { bloco: 'DESPESAS', escopo: 'MES' } as DreDaSerie, data: de((p) => emMil(p.despesas)), backgroundColor: CINZA, borderRadius: 5 },
      { type: 'line' as const, label: 'Resultado operacional', dre: { linha: 'T03', escopo: 'MES' } as DreDaSerie, data: de((p) => emMil(p.resultado)), borderColor: AMBER, backgroundColor: AMBER, tension: 0 },
      {
        type: 'line' as const, label: DEFINICOES.ponto_equilibrio_mes.nome, dre: { indicador: 'PE', escopo: 'MES' } as DreDaSerie, data: pe.map((e) => emMil(e.desenhado)), reais: pe.map((e) => e.real),
        borderColor: BLUE, backgroundColor: BLUE, borderDash: [6, 4], borderWidth: 2, tension: 0,
        pointStyle: pe.map((e) => (e.acima ? 'triangle' : 'circle')), pointRadius: pe.map((e) => (e.acima ? 6 : 3)), pointHitRadius: 10,
        rotulosTopo: pe.map((e) => (e.real == null ? null : `PE ${brlK(e.real)}`)), corDoTopo: BLUE,
      },
    ],
  };

  const minima = aconteceu.margem_minima_pct ?? null;
  const meta = aconteceu.meta_pct ?? null;
  const nomeDaMeta = aconteceu.meta_origem === 'BUDGET' ? 'Meta' : 'Desejada';
  const fixa = (v: number | null) => pontos.map(() => v);
  const referencia = (nome: string, v: number, fmt: (x: number) => string) => ({
    type: 'line' as const, label: `${nome} ${fmt(v)}`, rotuloNaLinha: `${nome.toUpperCase()} ${fmt(v)}`, data: fixa(v),
    borderColor: GREEN, backgroundColor: GREEN, borderDash: [5, 4], pointRadius: 0, borderWidth: 1.5,
  });
  const margem = {
    labels,
    datasets: [
      {
        type: 'line' as const, label: 'Margem mensal', dre: { linha: 'T03', escopo: 'MES' } as DreDaSerie, data: de((p) => p.margem), borderColor: RED, backgroundColor: RED, tension: 0, pointHitRadius: 10,
        rotulosTopo: pontos.map((p) => (p.margem == null ? null : pct(p.margem))), corDoTopo: RED,
      },
      { type: 'line' as const, label: ytd ? 'Margem acumulada/YTD' : 'Margem acumulada no período', dre: ytd ? ({ linha: 'T03', escopo: 'YTD' } as DreDaSerie) : undefined, data: de((p) => p.margemAcumulada), borderColor: OLIVEDK, backgroundColor: OLIVEDK, borderDash: [6, 4], pointRadius: 2, pointHitRadius: 10, tension: 0 },
      ...(meta == null ? [] : [referencia(nomeDaMeta, meta, pctDaMeta)]),
      ...(minima == null ? [] : [referencia('Mínima', minima, pct)]),
    ],
  };
  const referencias = [minima == null ? null : `mínima ${pct(minima)}`, meta == null ? null : `${nomeDaMeta.toLowerCase()} ${pctDaMeta(meta)}`].filter(Boolean);

  const competencia = {
    labels,
    datasets: [
      {
        type: 'bar' as const, label: 'Resultado mensal', dre: { linha: 'T06', escopo: 'MES' } as DreDaSerie, data: de((p) => emMil(p.competencia)), borderRadius: 4, order: 2,
        backgroundColor: pontos.map((p) => ((p.competencia ?? 0) < 0 ? RED : GOLD)),
        rotulosTopo: pontos.map((p) => (p.competencia == null ? null : reaisComSinal(p.competencia))),
      },
      { type: 'line' as const, label: `Acumulado ${acumulado}`, dre: ytd ? ({ linha: 'T06', escopo: 'YTD' } as DreDaSerie) : undefined, data: de((p) => emMil(p.competenciaAcumulada)), borderColor: OLIVEDK, backgroundColor: OLIVEDK, tension: 0, order: 1 },
    ],
  };
  const ultimo = [...pontos].reverse().find((p) => p.competenciaAcumulada != null);

  return { pontos, composicao, fora, performance, teto, piso, foraDaEscala, margem, referencias, competencia, ultimo, eixo, ytd, acumulado };
}

const opcoesEmMil = { ...baseOpts, scales: { ...baseOpts.scales, y: { ...baseOpts.scales.y, ...eixoEmMil } }, plugins: { ...legenda, tooltip: dica((v) => brlK(v * 1000)) } };
const grafico = (data: unknown) => data as ChartData<'bar'>;

export function GraficosDaEmpresa(props: PropsDosGraficos) {
  const g = montarGraficos(props);
  if (!g) return null;
  const { etiqueta, periodo, onAbrirDre, visao } = props;
  const { pontos, performance, teto, piso, foraDaEscala, margem, referencias, competencia, ultimo, eixo, ytd, acumulado } = g;
  const clique = onAbrirDre ? FRASE_DO_CLIQUE : '';
  return (
    <>
      <Panel title={`${TITULO.performance}: ${periodo}`} tag={etiqueta} id="grafico-performance"
        sub={`Receita + Custos + Despesas + Resultado Operacional + Ponto de Equilíbrio. Sem margem.${clique}`}>
        {foraDaEscala.length > 0 && (
          <p className="obs-tela">{foraDaEscala.map((f) => `${eixo(f.rotulo)}: PE ${brlK(f.valor)} (fora da escala)`).join(' · ')}</p>
        )}
        <div className="chart-box" style={{ height: 400 }}>
          <Chart type="bar" data={grafico(performance)} plugins={[rotulosNoGrafico, maoForaDaArea]}
            options={{
              ...opcoesEmMil, layout: { padding: { top: 18 } }, plugins: { ...opcoesEmMil.plugins, tooltip: dicaDaPerformance },
              scales: { ...opcoesEmMil.scales, y: { ...opcoesEmMil.scales.y, ...(teto == null || piso == null ? {} : { min: piso / 1000, max: teto / 1000 }) } },
              ...cliqueNoMes(performance.datasets, pontos, onAbrirDre, visao),
            }} />
        </div>
      </Panel>
      <div className="row r-1-1">
        <Panel title={`${TITULO.margem}: ${periodo}`} tag={etiqueta} id="grafico-margem"
          sub={`Margem mensal + acumulada${ytd ? '/YTD' : ' no período'}${referencias.length ? ` + referências fixas: ${referencias.join(' e ')}` : ''}.${clique}`}>
          <div className="chart-box" style={{ height: 280 }}>
            <Chart type="line" data={grafico(margem) as unknown as ChartData<'line'>} plugins={[rotulosNoGrafico, maoForaDaArea]}
              options={{ ...baseOpts, layout: { padding: { right: referencias.length ? 92 : 16 } }, scales: { x: { ...baseOpts.scales.x, offset: true }, y: { ...baseOpts.scales.y, grace: '12%', ticks: { callback: (v: string | number) => pct(Number(v)) } } }, plugins: { ...legenda, tooltip: dica(pct) }, ...cliqueNoMes(margem.datasets, pontos, onAbrirDre, visao) }} />
          </div>
        </Panel>
        <Panel title={`${TITULO.competencia}: ${periodo}`} tag={etiqueta} id="grafico-competencia"
          sub={`Barras = resultado mensal. Linha contínua = acumulado ${acumulado}.${clique}`}>
          {ultimo?.competenciaAcumulada != null && <p className="obs-tela">{`${eixo(ultimo.rotulo)} ${acumulado}: ${brlK(ultimo.competenciaAcumulada)}`}</p>}
          <div className="chart-box" style={{ height: 280 }}>
            <Chart type="bar" data={grafico(competencia)} plugins={[rotulosNoGrafico, maoForaDaArea]} options={{ ...opcoesEmMil, plugins: { ...opcoesEmMil.plugins, legend: legendaOuro }, ...cliqueNoMes(competencia.datasets, pontos, onAbrirDre, visao) }} />
          </div>
        </Panel>
      </div>
    </>
  );
}

export function GraficoComposicaoDaReceita(props: PropsDosGraficos) {
  const g = montarGraficos(props);
  if (!g) return null;
  const { pontos, composicao, fora, eixo } = g;
  return (
    <Panel title={`${TITULO.composicao}: ${props.periodo}`} tag={props.etiqueta} id="grafico-composicao-receita"
      sub={`Receita total + Produção x Revenda.${props.onAbrirDre ? ' Clique na parte de um negócio para abrir a DRE dele no mês.' : ''}`}>
      <div className="chart-box" style={{ height: 280 }}>
        <Chart type="bar" data={grafico(composicao)} plugins={[rotulosNoGrafico, maoForaDaArea]}
          options={{ ...opcoesEmMil, scales: { x: { ...baseOpts.scales.x, stacked: true }, y: { ...baseOpts.scales.y, ...eixoEmMil, stacked: true } }, ...cliqueNoMes(composicao.datasets, pontos, props.onAbrirDre) }} />
      </div>
      {fora.length > 0 && (
        <p className="obs-tela">A barra soma Produção e Revenda. Receita fora dos dois negócios: {fora.map((f) => `${brl(f.valor)} em ${eixo(f.rotulo)}`).join(', ')}.</p>
      )}
    </Panel>
  );
}

export function GraficosCarregando({ comComposicao = true }: { comComposicao?: boolean }) {
  const painel = (t: string, altura: number) => <Panel key={t} title={t} sub="Consolidando os meses…"><div style={{ minHeight: altura }} /></Panel>;
  return (
    <>
      {painel(TITULO.performance, 430)}
      <div className="row r-1-1">{painel(TITULO.margem, 310)}{painel(TITULO.competencia, 310)}</div>
      {comComposicao && painel(TITULO.composicao, 310)}
    </>
  );
}
