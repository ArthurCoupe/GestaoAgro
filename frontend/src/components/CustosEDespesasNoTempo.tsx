import { useState } from 'react';
import { Chart } from 'react-chartjs-2';
import type { ChartData } from 'chart.js';
import { brlK, pct } from '../api/client';
import type { ExecutivoComposicao, ExecutivoSerieMensal, FolhaPendente, LinhaComposicao } from '../api/gerencial';
import { AMBER, baseOpts, GOLD, OLIVEDK } from '../charts/setup';
import { linhasPendentesPorMes } from './AvisoDaFolha';
import { rotuloDoMesCurto } from './EvolucaoMensal';
import { dica, eixoEmMil, emMil, legenda, mesNoEixo } from './GraficosDaVisaoExecutiva';
import { Panel } from './ui';

type Modo = 'reais' | 'pct';
const CORES = [GOLD, OLIVEDK, AMBER];

const ordem = (a: string | null, b: string | null) => ((a ?? '') < (b ?? '') ? -1 : (a ?? '') > (b ?? '') ? 1 : 0);

export function tresMaiores(linhas: LinhaComposicao[]): LinhaComposicao[] {
  return [...linhas]
    .sort((a, b) => Math.abs(b.valor) - Math.abs(a.valor) || ordem(a.codigo_oficial, b.codigo_oficial) || ordem(a.rotulo, b.rotulo) || ordem(a.linha_id, b.linha_id))
    .slice(0, 3);
}

const comSinal = (v: number, unidade: string) => {
  const s = Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return `${s === '0,0' ? '' : v < 0 ? '-' : '+'}${s}${unidade}`;
};

export const variacaoComSinal = (v: number) => comSinal(v, '%');
export const pontosComSinal = (v: number) => comSinal(v, ' p.p.');

function rotuloDaLinha(nome: string, valores: (number | null)[], modo: Modo): string {
  const comValor = valores.filter((v): v is number => v != null);
  if (comValor.length === 0) return nome;
  const ultimo = comValor[comValor.length - 1];
  const anterior = comValor[comValor.length - 2];
  const delta = anterior == null ? null
    : modo === 'pct' ? pontosComSinal(ultimo - anterior)
      : anterior === 0 ? null : variacaoComSinal(((ultimo - anterior) / Math.abs(anterior)) * 100);
  return `${nome}: ${modo === 'pct' ? pct(ultimo) : brlK(ultimo)}${delta == null ? '' : ` | Δ ${delta}`}`;
}

export function seriesDasLinhas(
  linhas: LinhaComposicao[], serie: ExecutivoSerieMensal[], mesesSemFato: string[], modo: Modo,
  pendentes: Map<string, Set<string>> = new Map(),
): Array<{ linha_id: string; nome: string; valores: (number | null)[]; rotulo: string }> {
  const semFato = new Set(mesesSemFato);
  return linhas.map((l) => {
    const nome = l.rotulo || l.codigo_oficial || 'Linha sem nome';
    const valores = serie.map((s) => {
      if (semFato.has(s.mes) || pendentes.get(s.mes)?.has(String(l.linha_id))) return null;
      const naTela = 0 - (s.linhas.find((f) => f.linha_id === l.linha_id)?.valor ?? 0);
      if (modo === 'reais') return naTela;
      return s.receita_liquida != null && s.receita_liquida > 0 ? (naTela / s.receita_liquida) * 100 : null;
    });
    return { linha_id: l.linha_id, nome, valores, rotulo: rotuloDaLinha(nome, valores, modo) };
  });
}

const dicaDaLinha = (f: (v: number) => string) => {
  const base = dica(f).callbacks.label;
  return { callbacks: { label: (c: Parameters<typeof base>[0] & { dataset: { nome?: string } }) => base({ ...c, dataset: { label: c.dataset.nome ?? c.dataset.label } }) } };
};

function BlocoNoTempo({ pergunta, periodo, periodoDasLinhas, id, tipo, linhas, serie, mesesSemFato, etiqueta, pendentes }: {
  pergunta: string; periodo: string; periodoDasLinhas: string; id: string; tipo: 'custo' | 'despesa'; linhas: LinhaComposicao[];
  serie: ExecutivoSerieMensal[]; mesesSemFato: string[]; etiqueta: string; pendentes: Map<string, Set<string>>;
}) {
  const [modo, setModo] = useState<Modo>('reais');
  const series = seriesDasLinhas(tresMaiores(linhas), serie, mesesSemFato, modo, pendentes);
  const mes = mesNoEixo(serie.map((s) => s.mes));
  const data = {
    labels: serie.map((s) => mes(rotuloDoMesCurto(s.mes))),
    datasets: series.map((s, i) => ({
      label: s.rotulo, nome: s.nome, data: modo === 'reais' ? s.valores.map(emMil) : s.valores,
      borderColor: CORES[i], backgroundColor: CORES[i], tension: 0, pointRadius: 3, spanGaps: false,
    })),
  };
  const eixo = modo === 'reais' ? eixoEmMil : { grace: '12%', ticks: { callback: (v: string | number) => pct(Number(v)) } };
  const outroPeriodo = periodoDasLinhas !== periodo;
  const sub = `Até três linhas, as maiores ${outroPeriodo ?`de ${periodoDasLinhas}, mês a mês em ${periodo}` : 'do período, mês a mês'}. `
    + 'Cada linha diz o valor do último mês e a variação contra o mês anterior.';
  return (
    <Panel title={`${pergunta} (${periodo})`} tag={etiqueta} id={id} sub={sub}>
      {series.length === 0 ? <div className="empty">Sem linha de {tipo} com valor {outroPeriodo ? `em ${periodoDasLinhas}` : 'no período'}.</div> : (
        <>
          <div className="tabs" role="group" aria-label="Unidade">
            {(['reais', 'pct'] as const).map((m) => (
              <button key={m} type="button" className={`tab ${modo === m ? 'active' : ''}`} aria-pressed={modo === m} onClick={() => setModo(m)}>
                {m === 'reais' ? 'R$' : '% da Receita'}
              </button>
            ))}
          </div>
          <div className="chart-box" style={{ height: 280 }} role="img"
            aria-label={`${pergunta} Linhas mês a mês de ${periodo}, em ${modo === 'reais' ? 'R$' : '% da Receita'}.`}>
            <Chart type="line" data={data as unknown as ChartData<'line'>}
              options={{
                ...baseOpts,
                scales: { x: { ...baseOpts.scales.x, offset: true }, y: { ...baseOpts.scales.y, ...eixo } },
                plugins: { ...legenda, tooltip: dicaDaLinha(modo === 'reais' ? (v) => brlK(v * 1000) : pct) },
              }} />
          </div>
        </>
      )}
    </Panel>
  );
}

export function CustosEDespesasNoTempo({ composicao, serie, mesesSemFato, etiqueta, periodo, periodoDasLinhas, folhaPendente }: {
  composicao: ExecutivoComposicao; serie: ExecutivoSerieMensal[]; mesesSemFato: string[]; etiqueta: string; periodo: string; periodoDasLinhas: string;
  folhaPendente?: FolhaPendente[];
}) {
  if (serie.every((s) => mesesSemFato.includes(s.mes))) return null;
  const comum = { periodo, periodoDasLinhas, serie, mesesSemFato, etiqueta, pendentes: linhasPendentesPorMes(folhaPendente) };
  return (
    <>
      <BlocoNoTempo pergunta="Quais custos estão subindo ou caindo?" id="grafico-custos-no-tempo" tipo="custo" linhas={composicao.custos} {...comum} />
      <BlocoNoTempo pergunta="Quais despesas estão subindo ou caindo?" id="grafico-despesas-no-tempo" tipo="despesa" linhas={composicao.despesas} {...comum} />
    </>
  );
}
