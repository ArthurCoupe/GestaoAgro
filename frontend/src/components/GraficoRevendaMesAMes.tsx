import { Chart } from 'react-chartjs-2';
import type { ChartData } from 'chart.js';
import { brlK } from '../api/client';
import type { VendaDeProduto, VendasPorProdutoResposta } from '../api/gerencial';
import { baseOpts, CINZA, PALETTE } from '../charts/setup';
import { rotuloDoPeriodo } from './EscadaDoAno';
import { rotuloDoMesCurto } from './EvolucaoMensal';
import { dica, eixoEmMil, emMil, legenda, maoForaDaArea, mesNoEixo, opcoesDeClique, rotulosNoGrafico } from './GraficosDaVisaoExecutiva';
import { chaveDoProduto, FRASE_DO_PRODUTO_DA_REVENDA, NOME_DA_EMPRESA, rotuloDoMes } from './RevendaPorProduto';
import { Panel } from './ui';

export const FRASE_SEM_MARGEM_DA_REVENDA = 'A margem comercial por produto da Revenda entra quando a compra de cada produto estiver extraída até o fim dos meses com venda.';

const somaCent = (xs: (number | null)[]) => (xs.every((x) => x == null) ? null : xs.reduce<number>((s, x) => s + Math.round((x ?? 0) * 100), 0) / 100);

export function rotuloNaRevenda(v: VendasPorProdutoResposta) {
  const conta = (f: (p: VendaDeProduto) => string) => (p: VendaDeProduto) => v.produtos.filter((o) => f(o) === f(p)).length;
  const repeteNome = conta((p) => p.descricao);
  const repeteNaEmpresa = conta((p) => `${p.descricao}|${p.empresa}`);
  return (p: VendaDeProduto) =>
    repeteNome(p) === 1 ? p.descricao : `${p.descricao} · ${NOME_DA_EMPRESA[p.empresa]}${repeteNaEmpresa(p) > 1 ? ` (${p.unidade})` : ''}`;
}

export const produtosVisiveis = (v: VendasPorProdutoResposta, max = 5) => (v.produtos.length > max + 1 ? v.produtos.slice(0, max) : v.produtos);

export function pilhasDaRevenda(v: VendasPorProdutoResposta, max = 5) {
  const meses = v.periodo.meses;
  const receitas = (p: VendaDeProduto) => meses.map((mes) => p.serie_mensal?.find((s) => s.mes === mes)?.receita ?? null);
  const rotulo = rotuloNaRevenda(v);
  const visiveis = produtosVisiveis(v, max);
  const resto = v.produtos.slice(visiveis.length);
  const pilhas = visiveis.map((p) => ({ rotulo: rotulo(p), receita: receitas(p), chaves: [chaveDoProduto(p)] }));
  if (resto.length > 0) {
    const dosOutros = resto.map(receitas);
    pilhas.push({ rotulo: `Demais (${resto.length})`, receita: meses.map((_, m) => somaCent(dosOutros.map((r) => r[m]))), chaves: resto.map(chaveDoProduto) });
  }
  const todos = v.produtos.map(receitas);
  const totais = meses.map((_, m) => somaCent(todos.map((r) => r[m])));
  const comProduto = new Set(v.produtos.map((p) => p.empresa));
  const faltas = v.meses_sem_relatorio.filter((f) => comProduto.has(f.empresa));
  return {
    meses, pilhas, totais,
    parciais: meses.map((mes, m) => totais[m] != null && faltas.some((f) => f.mes === mes)),
    semRelatorio: faltas.map((f) => `${NOME_DA_EMPRESA[f.empresa]} ${rotuloDoMes(f.mes)}`),
  };
}

export function semGraficoDaRevenda(v: VendasPorProdutoResposta): boolean {
  const { pilhas, totais } = pilhasDaRevenda(v);
  return pilhas.length === 0 || totais.every((t) => t == null);
}

export function GraficoRevendaMesAMes({ v, onAbrirProduto }: { v: VendasPorProdutoResposta; onAbrirProduto?: (chaves: string[]) => void }) {
  const { meses, pilhas, totais, parciais, semRelatorio } = pilhasDaRevenda(v);
  if (semGraficoDaRevenda(v)) return null;
  const ultima = pilhas.length - 1;
  const eixo = mesNoEixo(meses);
  const data = {
    labels: meses.map((m) => eixo(rotuloDoMesCurto(m))),
    datasets: pilhas.map((p, i) => ({
      type: 'bar' as const, label: p.rotulo, stack: 'r',
      backgroundColor: p.rotulo.startsWith('Demais (') ? CINZA : PALETTE[i % PALETTE.length],
      data: p.receita.map((r, m) => emMil(r ?? (i === ultima && totais[m] != null ? 0 : null))),
      ...(i === ultima ? { rotulosTopo: totais.map((t, m) => (t == null ? null : `${brlK(t)}${parciais[m] ? '*' : ''}`)) } : {}),
    })),
  };
  return (
    <Panel title={`Revenda por produto, mês a mês: ${rotuloDoPeriodo(v.periodo)}`} id="grafico-revenda-mes-a-mes"
      sub={`Receita de cada produto revendido, mês a mês: os cinco de maior receita no período e os demais juntos. Em cima, a soma dos produtos no mês, pelo relatório de vendas do ERP.${onAbrirProduto ? FRASE_DO_PRODUTO_DA_REVENDA : ''}`}>
      <div className="chart-box" style={{ height: 320 }}>
        <Chart type="bar" data={data as unknown as ChartData<'bar'>} plugins={[rotulosNoGrafico, maoForaDaArea]}
          options={{
            ...baseOpts, layout: { padding: { top: 12 } },
            scales: { x: { ...baseOpts.scales.x, stacked: true }, y: { ...baseOpts.scales.y, ...eixoEmMil, stacked: true } },
            plugins: { ...legenda, tooltip: dica((x) => brlK(x * 1000)) },
            ...opcoesDeClique((el) => (pilhas[el.datasetIndex]?.receita[el.index] != null ? pilhas[el.datasetIndex].chaves : null), onAbrirProduto),
          }} />
      </div>
      {semRelatorio.length > 0 && (
        <p className="obs-tela">Sem relatório de vendas carregado: {semRelatorio.join(', ')}.{parciais.some(Boolean) ? ' O total com * soma só a empresa com relatório.' : ''}</p>
      )}
      {v.compras == null && <p className="obs-tela">{FRASE_SEM_MARGEM_DA_REVENDA}</p>}
    </Panel>
  );
}
