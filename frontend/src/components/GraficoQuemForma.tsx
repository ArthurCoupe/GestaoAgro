import { Chart } from 'react-chartjs-2';
import type { ChartData } from 'chart.js';
import { brl, brlK } from '../api/client';
import type { AtividadeChave, ExecutivoResposta } from '../api/gerencial';
import { baseOpts, CINZA, GOLD, OLIVEDK, RED } from '../charts/setup';
import type { FrenteDaGestao } from '../pages/GestaoDoResultado';
import { temMovimento } from '../pages/Dashboard';
import { rotuloDoMesCurto } from './EvolucaoMensal';
import { dica, eixoEmMil, emMil, legenda, mesNoEixo, reaisComSinal, rotulosNoGrafico } from './GraficosDaVisaoExecutiva';
import { Panel } from './ui';

export const NEGOCIOS_DO_GRAFICO: Array<{ chave: AtividadeChave; rotulo: string; cor: string }> = [
  { chave: 'PRODUCAO_COGUMELO', rotulo: 'Produção · Cogumelo', cor: RED },
  { chave: 'PIMENTAO', rotulo: 'Produção · Pimentão', cor: GOLD },
  { chave: 'REVENDA', rotulo: 'Revenda', cor: OLIVEDK },
];

const FORA_DAS_BARRAS: Record<string, string> = {
  CORPORATIVO: 'estrutura',
  PRODUCAO_SEM_QUEBRA: 'produção ainda sem divisão por produto',
  NAO_RATEADO: 'o que ainda não tem divisão por negócio',
};

type Dados = Pick<ExecutivoResposta, 'atividades' | 'serie_mensal' | 'meses_sem_fato'>;
export type BarraDoNegocio = (typeof NEGOCIOS_DO_GRAFICO)[number] & { resultado: (number | null)[]; margem: (number | null)[] };

export function barrasQuemForma(ex: Dados): BarraDoNegocio[] {
  const semFato = new Set(ex.meses_sem_fato);
  return NEGOCIOS_DO_GRAFICO.flatMap((n) => {
    const atividade = ex.atividades.find((a) => a.chave === n.chave);
    if (!atividade?.serie_mensal || !temMovimento(atividade)) return [];
    const serie = atividade.serie_mensal;
    const doMes = ex.serie_mensal.map((s) => (semFato.has(s.mes) ? undefined : serie.find((a) => a.mes === s.mes)));
    return [{
      ...n,
      resultado: doMes.map((a) => a?.resultado ?? null),
      margem: doMes.map((a) => (a?.resultado == null || a.receita == null || a.receita <= 0 ? null : (a.resultado / a.receita) * 100)),
    }];
  });
}

function restoDoMes(ex: Dados, barras: BarraDoNegocio[], m: number): number | null {
  const s = ex.serie_mensal[m];
  const total = s.resultado_operacional;
  if (ex.meses_sem_fato.includes(s.mes) || total == null || barras.some((b) => b.resultado[m] == null)) return null;
  const centavos = (v: number) => Math.round(v * 100);
  return (centavos(total) - barras.reduce((soma, b) => soma + centavos(b.resultado[m] as number), 0)) / 100;
}

export function resultadoForaPorMes(ex: Dados, barras: BarraDoNegocio[]): Array<{ rotulo: string; valor: number }> {
  return ex.serie_mensal.flatMap((s, m) => {
    const valor = restoDoMes(ex, barras, m);
    return valor == null || valor === 0 ? [] : [{ rotulo: rotuloDoMesCurto(s.mes), valor }];
  });
}

export function quemFicaFora(ex: Pick<ExecutivoResposta, 'atividades'>): string[] {
  return Object.entries(FORA_DAS_BARRAS).flatMap(([chave, nome]) => {
    const a = ex.atividades.find((x) => x.chave === chave);
    return a && temMovimento(a) ? [nome] : [];
  });
}

export const TITULO_DO_RESULTADO: Record<FrenteDaGestao, string> = {
  consolidado: 'Resultado por negócio',
  producao: 'Resultado da Produção (Cogumelo x Pimentão)',
  cogumelo: 'Evolução do resultado do Cogumelo',
  pimentao: 'Evolução do resultado do Pimentão',
  revenda: 'Evolução do resultado da Revenda',
};

export function barraDaEstrutura(ex: Dados, barras: BarraDoNegocio[]): BarraDoNegocio | null {
  const resto = ex.serie_mensal.map((_, m) => restoDoMes(ex, barras, m));
  if (resto.every((v) => v == null || v === 0)) return null;
  return { chave: 'CORPORATIVO', rotulo: 'Estrutura e não atribuído', cor: CINZA, resultado: resto, margem: resto.map(() => null) };
}

export const margemComSinal = (v: number) => {
  const n = Math.sign(v) * Math.round(Math.abs(v));
  return n > 0 ? `+${n}%` : `${n}%`;
};

const lista = (itens: string[]) => new Intl.ListFormat('pt-BR', { type: 'conjunction' }).format(itens);

export function GraficoQuemForma({ ex, periodo, titulo = 'Quem forma o resultado', comEstrutura = false }: { ex: ExecutivoResposta; periodo: string; titulo?: string; comEstrutura?: boolean }) {
  const negocios = barrasQuemForma(ex);
  if (negocios.length === 0 || ex.serie_mensal.every((s) => ex.meses_sem_fato.includes(s.mes))) return null;
  const estrutura = comEstrutura ? barraDaEstrutura(ex, negocios) : null;
  const barras = estrutura ? [...negocios, estrutura] : negocios;
  const fora = resultadoForaPorMes(ex, barras);
  const mes = mesNoEixo(ex.serie_mensal.map((s) => s.mes));
  const data = {
    labels: ex.serie_mensal.map((s) => mes(rotuloDoMesCurto(s.mes))),
    datasets: barras.map((b) => ({
      label: b.rotulo, data: b.resultado.map(emMil), backgroundColor: b.cor, borderRadius: 4,
      rotulosTopo: b.resultado.map((v) => (v == null ? null : reaisComSinal(v))),
      rotulosTopo2: b.margem.map((v) => (v == null ? null : margemComSinal(v))),
    })),
  };
  const nomes = lista(barras.map((b) => b.rotulo));
  const quem = quemFicaFora(ex);
  return (
    <Panel title={`${titulo}: ${periodo}`} tag={ex.etiqueta} id="grafico-quem-forma"
      sub={estrutura
        ? 'Resultado em R$ e margem % de cada negócio, mês a mês, e a estrutura e o não atribuído, para as barras somarem o resultado. Negativo fica abaixo do zero.'
        : 'Resultado em R$ e margem % de cada negócio, mês a mês. Negativo fica abaixo do zero.'}>
      <div className="chart-box" style={{ height: 300 }} role="img"
        aria-label={`${titulo}, ${periodo}: resultado em R$ e margem % de ${nomes}, mês a mês.`}>
        <Chart type="bar" data={data as unknown as ChartData<'bar'>} plugins={[rotulosNoGrafico]}
          options={{
            ...baseOpts,
            layout: { padding: { right: 24 } },
            scales: { ...baseOpts.scales, y: { ...baseOpts.scales.y, ...eixoEmMil } },
            plugins: { ...legenda, tooltip: dica((v) => brlK(v * 1000)) },
          }} />
      </div>
      {fora.length > 0 && (
        <p className="obs-tela">As barras somam {nomes}. Resultado fora deles{quem.length > 0 ? ` (${lista(quem)})` : ''}: {fora.map((f) => `${brl(f.valor)} em ${mes(f.rotulo)}`).join(', ')}.</p>
      )}
      {estrutura && quem.length > 0 && <p className="obs-tela">{quem.length === 1 && quem[0] === FORA_DAS_BARRAS.CORPORATIVO
        ? 'A barra Estrutura e não atribuído tem só a estrutura: nada ficou sem divisão por negócio.'
        : `A barra Estrutura e não atribuído soma o resultado fora dos negócios: ${lista(quem)}.`}</p>}
    </Panel>
  );
}
