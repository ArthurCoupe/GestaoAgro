import { Chart } from 'react-chartjs-2';
import type { ChartData } from 'chart.js';
import { brl, pct } from '../api/client';
import { DEFINICOES } from '../api/definicoes';
import type { VendaDeProduto, VendasPorProdutoResposta } from '../api/gerencial';
import { baseOpts, CINZA, GOLD, GREEN, OLIVEDK, PALETTE } from '../charts/setup';
import { rotuloDoPeriodo } from './EscadaDoAno';
import { rotuloDoMesCurto } from './EvolucaoMensal';
import { pilhasDaRevenda, produtosVisiveis, rotuloNaRevenda } from './GraficoRevendaMesAMes';
import { dica, legenda, maoForaDaArea, mesNoEixo, opcoesDeClique, rotulosNoGrafico, type ElementoClicado } from './GraficosDaVisaoExecutiva';
import { chaveDoProduto, FRASE_DO_PRODUTO_DA_REVENDA } from './RevendaPorProduto';
import { Panel } from './ui';

type AoAbrirProduto = ((chaves: string[]) => void) | undefined;
const fraseDoClique = (onAbrirProduto: AoAbrirProduto) => (onAbrirProduto ? FRASE_DO_PRODUTO_DA_REVENDA : '');
const cliquePorSerie = (series: Array<{ chaves: string[] }>, valores: (s: number) => (number | null)[], onAbrirProduto: AoAbrirProduto) =>
  opcoesDeClique((el: ElementoClicado) => (series[el.datasetIndex] && valores(el.datasetIndex)[el.index] != null ? series[el.datasetIndex].chaves : null), onAbrirProduto);

const doMes = (p: VendaDeProduto, mes: string) => p.serie_mensal?.find((s) => s.mes === mes);

export function linhasDaRevenda(v: VendasPorProdutoResposta, max = 5) {
  const meses = v.periodo.meses;
  const produtos = produtosVisiveis(v, max);
  const { unidade, nome } = nomesComUnidade(v, produtos);
  return {
    meses,
    unidade,
    linhas: produtos.map((p) => ({
      rotulo: nome(p),
      chaves: [chaveDoProduto(p)],
      quantidade: meses.map((mes) => doMes(p, mes)?.quantidade ?? null),
      preco: meses.map((mes) => {
        const s = doMes(p, mes);
        if (s?.quantidade == null || s.receita == null || s.quantidade <= 0 || s.receita < 0) return null;
        return Math.round((Math.round(s.receita * 100) / s.quantidade)) / 100;
      }),
    })),
  };
}

function nomesComUnidade(v: VendasPorProdutoResposta, produtos: VendaDeProduto[]) {
  const rotulo = rotuloNaRevenda(v);
  const unidades = new Set(produtos.map((p) => p.unidade));
  const unidade = unidades.size === 1 ? produtos[0].unidade : null;
  return { unidade, nome: (p: VendaDeProduto) => (unidade == null && !rotulo(p).endsWith(`(${p.unidade})`) ? `${rotulo(p)} (${p.unidade})` : rotulo(p)) };
}

export function compraEVendaDaRevenda(v: VendasPorProdutoResposta, max = 5) {
  const comCompra = v.produtos.filter((p) => p.preco_medio_compra != null);
  const produtos = comCompra.filter((p) => (p.preco_medio ?? 0) > 0).slice(0, max);
  const { unidade, nome } = nomesComUnidade(v, produtos);
  return {
    unidade,
    semCompra: v.produtos.length - comCompra.length,
    foraDoGrafico: comCompra.length - produtos.length,
    linhas: produtos.map((p) => ({
      rotulo: nome(p), chaves: [chaveDoProduto(p)], compra: p.preco_medio_compra ?? null, venda: p.preco_medio ?? null,
      margem: p.margem_unitaria ?? null, margemPct: p.margem_pct ?? null,
    })),
  };
}

export function maiorResto(valores: number[], total: number): number[] | null {
  const soma = valores.reduce((s, x) => s + x, 0);
  if (soma <= 0 || valores.some((x) => x < 0)) return null;
  const brutos = valores.map((x) => (x * total) / soma);
  const partes = brutos.map((b) => Math.floor(b));
  let falta = total - partes.reduce((s, x) => s + x, 0);
  const ordem = brutos.map((b, i) => ({ i, resto: b - partes[i] })).sort((a, b) => b.resto - a.resto || a.i - b.i);
  for (const { i } of ordem) {
    if (falta <= 0) break;
    partes[i] += 1;
    falta -= 1;
  }
  return partes;
}

export function mixDaRevenda(v: VendasPorProdutoResposta, max = 5) {
  const { meses, pilhas, totais, parciais } = pilhasDaRevenda(v, max);
  const porMes = meses.map((_, m) => {
    if (totais[m] == null) return null;
    const cent = pilhas.map((p) => Math.round((p.receita[m] ?? 0) * 100));
    return maiorResto(cent, 1000);
  });
  return {
    meses,
    parciais,
    fatias: pilhas.map((p, i) => ({
      rotulo: p.rotulo,
      chaves: p.chaves,
      pct: meses.map((_, m) => (porMes[m] == null || p.receita[m] == null ? null : porMes[m]![i] / 10)),
    })),
  };
}

export function corSobre(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.3 ? OLIVEDK : '#fff';
}

const pct1 = (v: number) => `${v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
const qtd = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 3 });
const rotulosDosMeses = (meses: string[], marcados: boolean[] = []) => {
  const eixo = mesNoEixo(meses);
  return meses.map((m, i) => `${eixo(rotuloDoMesCurto(m))}${marcados[i] ? '*' : ''}`);
};
const linha = (rotulo: string, data: (number | null)[], i: number) => ({
  type: 'line' as const, label: rotulo, data, borderColor: PALETTE[i % PALETTE.length], backgroundColor: PALETTE[i % PALETTE.length],
  tension: 0, pointRadius: 3, pointHitRadius: 8, borderWidth: 2,
});
const semPonto = (xs: (number | null)[][]) => xs.every((x) => x.every((y) => y == null));

export function GraficoQuantidadeDaRevenda({ v, onAbrirProduto }: { v: VendasPorProdutoResposta; onAbrirProduto?: (chaves: string[]) => void }) {
  const { meses, unidade, linhas } = linhasDaRevenda(v);
  if (linhas.length === 0 || semPonto(linhas.map((l) => l.quantidade))) return null;
  const data = { labels: rotulosDosMeses(meses), datasets: linhas.map((l, i) => linha(l.rotulo, l.quantidade, i)) };
  return (
    <Panel title={`Quantidade vendida por produto, mês a mês: ${rotuloDoPeriodo(v.periodo)}`} id="grafico-revenda-quantidade"
      sub={`Quantidade vendida de cada produto de maior receita no período (até cinco), pelo relatório de vendas do ERP${unidade ? `, em ${unidade}` : ', cada um na sua unidade'}. Quantidades de produtos diferentes não se somam. Mês sem relatório de vendas da empresa fica sem ponto.${fraseDoClique(onAbrirProduto)}`}>
      <div className="chart-box" style={{ height: 300 }}>
        <Chart type="line" data={data as unknown as ChartData<'line'>} plugins={[maoForaDaArea]}
          options={{
            ...baseOpts, scales: { ...baseOpts.scales, y: { ...baseOpts.scales.y, beginAtZero: true, ticks: { callback: (x: string | number) => qtd(Number(x)) } } }, plugins: { ...legenda, tooltip: dica(qtd) },
            ...cliquePorSerie(linhas, (s) => linhas[s].quantidade, onAbrirProduto),
          }} />
      </div>
    </Panel>
  );
}

export function GraficoPrecoMedioDaRevenda({ v, onAbrirProduto }: { v: VendasPorProdutoResposta; onAbrirProduto?: (chaves: string[]) => void }) {
  const { meses, unidade, linhas } = linhasDaRevenda(v);
  if (linhas.length === 0 || semPonto(linhas.map((l) => l.preco))) return null;
  const data = { labels: rotulosDosMeses(meses), datasets: linhas.map((l, i) => linha(l.rotulo, l.preco, i)) };
  return (
    <Panel title={`Preço médio de venda por produto, mês a mês: ${rotuloDoPeriodo(v.periodo)}`} id="grafico-revenda-preco-medio"
      sub={`Receita do mês dividida pela quantidade vendida no mês${unidade ? `, em R$ por ${unidade}` : ''}, dos mesmos produtos. Mês sem venda do produto, ou sem relatório de vendas da empresa, fica sem ponto.${fraseDoClique(onAbrirProduto)}`}>
      <div className="chart-box" style={{ height: 300 }}>
        <Chart type="line" data={data as unknown as ChartData<'line'>} plugins={[maoForaDaArea]}
          options={{
            ...baseOpts, scales: { ...baseOpts.scales, y: { ...baseOpts.scales.y, grace: '10%', ticks: { callback: (x: string | number) => brl(Number(x)) } } }, plugins: { ...legenda, tooltip: dica(brl) },
            ...cliquePorSerie(linhas, (s) => linhas[s].preco, onAbrirProduto),
          }} />
      </div>
    </Panel>
  );
}

export function GraficoMixDaRevenda({ v, onAbrirProduto }: { v: VendasPorProdutoResposta; onAbrirProduto?: (chaves: string[]) => void }) {
  const { meses, parciais, fatias } = mixDaRevenda(v);
  if (fatias.length === 0 || semPonto(fatias.map((f) => f.pct))) return null;
  const data = {
    labels: rotulosDosMeses(meses, parciais),
    datasets: fatias.map((f, i) => {
      const cor = f.rotulo.startsWith('Demais (') ? CINZA : PALETTE[i % PALETTE.length];
      return {
        type: 'bar' as const, label: f.rotulo, stack: 'mix', data: f.pct, backgroundColor: cor,
        rotulosMeio: f.pct.map((x) => (x == null ? null : pct1(x))), corDoRotulo: corSobre(cor),
      };
    }),
  };
  return (
    <Panel title={`${DEFINICOES.mix_produtos.nome}, mês a mês: ${rotuloDoPeriodo(v.periodo)}`} id="grafico-revenda-mix"
      sub={`Participação de cada produto na receita da Revenda no mês, pelo relatório de vendas do ERP: os mesmos produtos do gráfico da receita e os demais juntos. Cada barra soma 100%.${fraseDoClique(onAbrirProduto)}`}>
      <div className="chart-box" style={{ height: 320 }}>
        <Chart type="bar" data={data as unknown as ChartData<'bar'>} plugins={[rotulosNoGrafico, maoForaDaArea]}
          options={{
            ...baseOpts,
            scales: { x: { ...baseOpts.scales.x, stacked: true }, y: { ...baseOpts.scales.y, stacked: true, min: 0, max: 100, ticks: { callback: (x: string | number) => `${x}%` } } },
            plugins: { ...legenda, tooltip: dica(pct1) },
            ...cliquePorSerie(fatias, (s) => fatias[s].pct, onAbrirProduto),
          }} />
      </div>
      {parciais.some(Boolean) && (
        <p className="obs-tela">{parciais.filter(Boolean).length === 1 ? 'O mês com * mostra' : 'Os meses com * mostram'} só a empresa que tem relatório de vendas carregado.</p>
      )}
    </Panel>
  );
}

export function notaDaCompraEVenda(semCompra: number, foraDoGrafico: number) {
  const n = (x: number) => `${x} ${x === 1 ? 'produto' : 'produtos'}`;
  const partes = [semCompra > 0 ? `${n(semCompra)} sem compra carregada no período` : '', foraDoGrafico > 0 ? `${n(foraDoGrafico)} com compra` : ''].filter(Boolean);
  if (partes.length === 0) return '';
  const um = semCompra + foraDoGrafico === 1;
  return `${partes.join(' e ')} ${um ? 'fica fora deste gráfico e está' : 'ficam fora deste gráfico e estão'} na tabela, em Ver detalhamento.`;
}

const barra = (label: string, data: (number | null)[], cor: string) => ({ type: 'bar' as const, label, data, backgroundColor: cor, borderRadius: 4 });

export const emLinhas = (s: string, max = 20) => s.split(/\s+/).filter(Boolean).reduce<string[]>((ls, w) => {
  const u = ls.length - 1;
  if (u >= 0 && `${ls[u]} ${w}`.length <= max) ls[u] = `${ls[u]} ${w}`; else ls.push(w);
  return ls;
}, []);
const LARGURA_DO_PRODUTO = 170;

export function GraficoCompraEVendaDaRevenda({ v, onAbrirProduto }: { v: VendasPorProdutoResposta; onAbrirProduto?: (chaves: string[]) => void }) {
  const { unidade, linhas, semCompra, foraDoGrafico } = compraEVendaDaRevenda(v);
  if (v.compras == null || linhas.length === 0) return null;
  const data = {
    labels: linhas.map((l) => emLinhas(l.rotulo)),
    datasets: [
      barra('Preço médio de compra', linhas.map((l) => l.compra), CINZA),
      barra('Preço médio de venda', linhas.map((l) => l.venda), GOLD),
      { ...barra('Margem comercial por unidade', linhas.map((l) => l.margem), GREEN), rotulosTopo: linhas.map((l) => (l.margemPct == null ? null : pct(l.margemPct))) },
    ],
  };
  return (
    <Panel title={`Preço médio de compra x venda e margem comercial por produto: ${rotuloDoPeriodo(v.periodo)}`} id="grafico-revenda-compra-venda"
      sub={`Os produtos com compra carregada, os de maior receita primeiro (até cinco), no período${unidade ? `, em R$ por ${unidade}` : ', em R$ por unidade de venda de cada um'}: o preço médio de compra (Relatório de Compra do ERP), o de venda e a margem comercial por unidade (venda − compra), com a margem comercial % sobre o preço de venda escrita em cima. Pelos valores do ERP, sem descontar frete, perdas, impostos nem crédito de ICMS.${fraseDoClique(onAbrirProduto)}`}>
      <div style={{ overflowX: 'auto' }} tabIndex={0} role="region" aria-label="Compra x venda por produto, role para os lados">
        <div className="chart-box" style={{ height: 320, minWidth: linhas.length * LARGURA_DO_PRODUTO }}>
          <Chart type="bar" data={data as unknown as ChartData<'bar'>} plugins={[rotulosNoGrafico, maoForaDaArea]}
            options={{ ...baseOpts,
              ...opcoesDeClique((el: ElementoClicado) => {
                const l = linhas[el.index];
                return l && data.datasets[el.datasetIndex]?.data[el.index] != null ? l.chaves : null;
              }, onAbrirProduto),
              scales: { ...baseOpts.scales,
              x: { ...baseOpts.scales.x, ticks: { autoSkip: false, maxRotation: 0 } },
              y: { ...baseOpts.scales.y, grace: '10%', ticks: { callback: (x: string | number) => brl(Number(x)) } } },
              plugins: { legend: { ...legenda.legend, align: 'start' as const }, tooltip: dica(brl) } }} />
        </div>
      </div>
      {(semCompra > 0 || foraDoGrafico > 0) && <p className="obs-tela">{notaDaCompraEVenda(semCompra, foraDoGrafico)}</p>}
    </Panel>
  );
}
