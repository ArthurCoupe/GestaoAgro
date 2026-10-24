import { Chart } from 'react-chartjs-2';
import type { ChartData } from 'chart.js';
import { brlK } from '../api/client';
import type { Escada, EscadaPorAtividade, ExecutivoResposta } from '../api/gerencial';
import { baseOpts, OLIVEDK, RED } from '../charts/setup';
import type { FrenteDaGestao } from '../pages/GestaoDoResultado';
import { fraseDoQuadroAfetado } from './AvisoDaFolha';
import { ComoECalculado } from './ComoECalculado';
import { colunasDaVariedade, FRASE_RECEITA_NAO_DIVIDIDA, resultadoPorEspecieConfiavel } from './EscadaDoAno';
import { emMil, eixoEmMil, maoForaDaArea, reaisComSinal, rotulosNoGrafico } from './GraficosDaVisaoExecutiva';
import { Panel } from './ui';

const LARGURA_DO_PRODUTO = 120;

export interface ProdutoDaProducao {
  chave: string;
  rotulo: string;
  receita: number;
  resultado: number;
  margem: number | null;
  resto: boolean;
}

const produto = (chave: string, rotulo: string, e: Escada, resto = false): ProdutoDaProducao => ({
  chave, rotulo, receita: e.receita_liquida, resultado: e.resultado_operacional, margem: e.margem_operacional_pct, resto,
});

export function produtosDaProducao(escada: EscadaPorAtividade, frente: FrenteDaGestao): ProdutoDaProducao[] {
  if (frente === 'revenda') return [];
  const pv = escada.por_variedade;
  const especies = pv && resultadoPorEspecieConfiavel(escada)
    ? colunasDaVariedade(escada).map((c) => produto(c.chave, c.rotulo, pv[c.chave], c.chave === 'SEM_ESPECIE'))
    : [];
  const comMovimento = (p: ProdutoDaProducao) => p.receita !== 0 || p.resultado !== 0;
  const cogumelo = especies.length > 0 ? especies : [produto('PRODUCAO_COGUMELO', 'Cogumelo', escada.por_atividade.PRODUCAO_COGUMELO)].filter(comMovimento);
  const pimentao = [produto('PIMENTAO', 'Pimentão', escada.por_atividade.PIMENTAO)].filter(comMovimento);
  const lista = [...(frente === 'pimentao' ? [] : cogumelo), ...(frente === 'cogumelo' ? [] : pimentao)];
  const ranqueadas = lista.filter((p) => !p.resto).sort((a, b) => Math.round(a.resultado * 100) - Math.round(b.resultado * 100));
  return [...ranqueadas, ...lista.filter((p) => p.resto)];
}

const umaCasa = (v: number) => Math.round(v * 10) / 10;

export const margemComUmaCasa = (v: number) => {
  const r = umaCasa(v);
  if (r === 0) return '0,0%';
  const s = r.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return r > 0 ? `+${s}%` : `${s}%`;
};

const textoDaDica = (p: ProdutoDaProducao) =>
  `Resultado ${reaisComSinal(p.resultado)} · ${p.margem == null ? 'Sem margem' : `Margem ${margemComUmaCasa(p.margem)}`} · Receita ${brlK(p.receita)}`;

export function GraficoDeProdutos({ ex, frente, periodo }: {
  ex: Pick<ExecutivoResposta, 'escada' | 'etiqueta' | 'folha_pendente'>; frente: FrenteDaGestao; periodo: string;
}) {
  const produtos = produtosDaProducao(ex.escada, frente);
  if (produtos.length === 0) return null;
  const data = {
    labels: produtos.map((p) => [p.rotulo, p.margem == null ? 'Sem margem' : `Margem ${margemComUmaCasa(p.margem)}`, `Receita ${brlK(p.receita)}`]),
    datasets: [{
      label: 'Resultado', borderRadius: 4,
      data: produtos.map((p) => emMil(p.resultado)),
      backgroundColor: produtos.map((p) => (Math.round(p.resultado * 100) < 0 ? RED : OLIVEDK)),
      rotulosTopo: produtos.map((p) => reaisComSinal(p.resultado)),
    }],
  };
  const semDivisao = frente !== 'pimentao' && ex.escada.por_variedade != null && !resultadoPorEspecieConfiavel(ex.escada);
  const comResto = produtos.some((p) => p.resto);
  return (
    <Panel title={`Resultado por produto/espécie: ${periodo}`} tag={ex.etiqueta} id="grafico-produtos"
      sub={`Do maior resultado negativo para o maior positivo, em R$${comResto ? '; o que não tem espécie vem depois' : ''}. Embaixo de cada produto, a margem e a receita do período.`}>
      <div style={{ overflowX: 'auto' }} tabIndex={0} role="region" aria-label="Resultado por produto/espécie, role para os lados">
        <div className="chart-box" style={{ height: 320, minWidth: produtos.length * LARGURA_DO_PRODUTO }} role="img"
          aria-label={`Resultado por produto/espécie, ${periodo}: o resultado de cada produto em R$, do mais negativo para o mais positivo, com a margem e a receita embaixo.`}>
          <Chart type="bar" data={data as unknown as ChartData<'bar'>} plugins={[rotulosNoGrafico, maoForaDaArea]}
            options={{
              ...baseOpts,
              layout: { padding: { top: 16 } },
              scales: {
                x: { ...baseOpts.scales.x, ticks: { padding: 16, autoSkip: false, maxRotation: 0 } },
                y: { ...baseOpts.scales.y, ...eixoEmMil },
              },
              plugins: {
                legend: { display: false },
                tooltip: { callbacks: { title: (i: Array<{ dataIndex: number }>) => produtos[i[0].dataIndex].rotulo, label: (c: { dataIndex: number }) => textoDaDica(produtos[c.dataIndex]) } },
              },
            }} />
        </div>
      </div>
      {(ex.folha_pendente?.length ?? 0) > 0 && <p className="obs-tela">{`⚠ ${fraseDoQuadroAfetado('O resultado e a margem por produto')}`}</p>}
      {semDivisao && <p className="obs-tela">{FRASE_RECEITA_NAO_DIVIDIDA}</p>}
      <ComoECalculado chave="resultado_produto" />
    </Panel>
  );
}
