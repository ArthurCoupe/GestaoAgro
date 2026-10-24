import { Chart } from 'react-chartjs-2';
import type { ChartData } from 'chart.js';
import { brl, brlK } from '../api/client';
import { ehVariedade, ORDEM_DA_VARIEDADE, ROTULO_DA_VARIEDADE } from '../api/gerencial';
import type { Escada, EscadaPorAtividade, ExecutivoResposta } from '../api/gerencial';
import { AMBER, baseOpts, BLUE, CINZA, GOLD, GREEN, RED } from '../charts/setup';
import { resultadoPorEspecieConfiavel } from './EscadaDoAno';
import { rotuloDoMesCurto } from './EvolucaoMensal';
import { margemComSinal } from './GraficoQuemForma';
import { dica, eixoEmMil, emMil, legenda, maoForaDaArea, mesNoEixo, opcoesDeClique, reaisComSinal, rotulosNoGrafico } from './GraficosDaVisaoExecutiva';
import { Panel } from './ui';

type Dados = Pick<ExecutivoResposta, 'serie_mensal' | 'meses_sem_fato' | 'escada'>;
export type BarraDoProduto = { chave: string; rotulo: string; cor: string; resultado: (number | null)[]; margem: (number | null)[] };

const COR: Record<string, string> = { SH: RED, SP: AMBER, SB: BLUE, SS: GREEN, SEM_ESPECIE: CINZA, PRODUCAO_COGUMELO: RED, PIMENTAO: GOLD };
const maiuscula = (s: string) => s[0].toUpperCase() + s.slice(1);

export function barrasDosProdutos(ex: Dados): BarraDoProduto[] {
  const semFato = new Set(ex.meses_sem_fato);
  const escadas = ex.serie_mensal.map((s) => (semFato.has(s.mes) ? null : s.escada));
  const porEspecie = ex.escada.por_variedade != null && resultadoPorEspecieConfiavel(ex.escada);
  const produtos = [
    ...(porEspecie ? ORDEM_DA_VARIEDADE.map((v) => ({ chave: v as string, rotulo: maiuscula(ROTULO_DA_VARIEDADE[v]) })) : [{ chave: 'PRODUCAO_COGUMELO', rotulo: 'Cogumelo' }]),
    { chave: 'PIMENTAO', rotulo: 'Pimentão' },
  ];
  const fatia = (e: EscadaPorAtividade, chave: string): Escada | undefined =>
    ehVariedade(chave) ? e.por_variedade?.[chave] : e.por_atividade[chave as 'PIMENTAO' | 'PRODUCAO_COGUMELO'];
  return produtos.flatMap((p) => {
    const doMes = escadas.map((e) => (e ? fatia(e, p.chave) ?? null : null));
    if (!doMes.some((f) => f != null && (f.receita_liquida !== 0 || f.resultado_operacional !== 0))) return [];
    return [{
      ...p, cor: COR[p.chave],
      resultado: doMes.map((f) => f?.resultado_operacional ?? null),
      margem: doMes.map((f) => f?.margem_operacional_pct ?? null),
    }];
  });
}

export function resultadoForaDaProducao(ex: Dados, barras: BarraDoProduto[]): Array<{ rotulo: string; valor: number }> {
  const semFato = new Set(ex.meses_sem_fato);
  const eixo = mesNoEixo(ex.serie_mensal.map((x) => x.mes));
  return ex.serie_mensal.flatMap((s, m) => {
    const total = semFato.has(s.mes) ? null : s.escada?.por_atividade.PRODUCAO?.resultado_operacional;
    if (total == null || barras.some((b) => b.resultado[m] == null)) return [];
    const cent = Math.round(total * 100) - barras.reduce((soma, b) => soma + Math.round((b.resultado[m] as number) * 100), 0);
    return cent === 0 ? [] : [{ rotulo: eixo(rotuloDoMesCurto(s.mes)), valor: cent / 100 }];
  });
}

const FRASE_DO_PRODUTO = ' Clique num produto para abrir a evolução mensal dele.';

export function GraficoProdutosMesAMes({ ex, periodo, onAbrirProduto }: { ex: ExecutivoResposta; periodo: string; onAbrirProduto?: (chave: string) => void }) {
  const barras = barrasDosProdutos(ex);
  if (barras.length === 0) return null;
  const fora = resultadoForaDaProducao(ex, barras);
  const eixo = mesNoEixo(ex.serie_mensal.map((s) => s.mes));
  const data = {
    labels: ex.serie_mensal.map((s) => eixo(rotuloDoMesCurto(s.mes))),
    datasets: barras.map((b) => ({
      label: b.rotulo, data: b.resultado.map(emMil), backgroundColor: b.cor, borderRadius: 4,
      rotulosTopo: b.resultado.map((v) => (v == null ? null : reaisComSinal(v))),
      rotulosTopo2: b.margem.map((v) => (v == null ? null : margemComSinal(v))),
    })),
  };
  return (
    <Panel title={`Produção por produto, mês a mês: ${periodo}`} tag={ex.etiqueta} id="grafico-produtos-mes-a-mes"
      sub={`Resultado em R$ e margem % de cada espécie do Cogumelo e do Pimentão, mês a mês. Negativo fica abaixo do zero.${onAbrirProduto ? FRASE_DO_PRODUTO : ''}`}>
      <div className="chart-box" style={{ height: 320 }}>
        <Chart type="bar" data={data as unknown as ChartData<'bar'>} plugins={[rotulosNoGrafico, maoForaDaArea]}
          options={{
            ...baseOpts, scales: { ...baseOpts.scales, y: { ...baseOpts.scales.y, ...eixoEmMil } }, plugins: { ...legenda, tooltip: dica((v) => brlK(v * 1000)) },
            ...opcoesDeClique((el) => (barras[el.datasetIndex]?.resultado[el.index] != null ? barras[el.datasetIndex].chave : null), onAbrirProduto),
          }} />
      </div>
      {fora.length > 0 && (
        <p className="obs-tela">Resultado da Produção fora dos produtos (o que ainda não tem divisão por produto): {fora.map((f) => `${brl(f.valor)} em ${f.rotulo}`).join(', ')}.</p>
      )}
    </Panel>
  );
}
