import { Chart } from 'react-chartjs-2';
import { brl, type DreColuna } from '../api/client';
import { gastosTotais, seriesInvisiveis } from './series';
import { AMBER, CREAM, GOLD, OLIVEDK } from './setup';

const BARRA = { categoryPercentage: 0.62, barPercentage: 0.86 };

function eixoCompacto(v: number): string {
  const abs = Math.abs(v);
  const sinal = v < 0 ? '−' : '';
  if (abs >= 1000) return `${sinal}R$ ${Math.round(abs / 1000).toLocaleString('pt-BR')}k`;
  return `${sinal}R$ ${Math.round(abs).toLocaleString('pt-BR')}`;
}

interface LinhaColuna {
  nome: string; receita: number; gastos: number; resultado: number; margem: number | null;
}

const montarLinhas = (colunas: DreColuna[]): LinhaColuna[] => colunas.map((c) => ({
  nome: c.nome,
  receita: c.dre.receita_liquida,
  gastos: gastosTotais(c),
  resultado: c.dre.resultado_gerencial,
  margem: c.dre.receita_liquida > 0 ? (c.dre.resultado_gerencial / c.dre.receita_liquida) * 100 : null,
}));

function Avisos({ colunas, linhas }: { colunas: DreColuna[]; linhas: LinhaColuna[] }) {
  const receitaSemDono = colunas.find((c) => c.tipo === 'bucket')?.dre.receita_liquida ?? 0;
  const invisiveis = seriesInvisiveis([
    { label: 'Receita líquida', data: linhas.map((l) => l.receita) },
    { label: 'Gastos totais', data: linhas.map((l) => l.gastos) },
    { label: 'Resultado', data: linhas.map((l) => l.resultado) },
  ]);
  return (
    <>
      {receitaSemDono > 0 && (
        <p className="obs-tela">
          <b>{brl(receitaSemDono)}</b> de receita caiu em <b>Não atribuído</b> em vez de ir para os
          negócios. As linhas <i>COGUMELO / PIMENTÃO / REVENDA</i> do DRE CONSOLIDADO da planilha
          gerencial são <b>digitadas a cada mês</b>; quando o mês está sem essa divisão, a receita
          inteira fica sem dono e cada negócio aparece com o gasto sem a receita correspondente: o
          resultado deles fica negativo por construção. A atribuição da receita a cada negócio vem da
          planilha na importação. Se faltar, peça a reimportação do mês; a divisão digitada em DRE
          Gerencial vale só para aquela tela.
        </p>
      )}
      {invisiveis.length > 0 && (
        <p className="obs-tela">
          Sem valor no período: <b>{invisiveis.join(', ')}</b>.
        </p>
      )}
    </>
  );
}

export function TabelaColunasDre({ colunas, alturaMax = 260 }: {
  colunas: DreColuna[];
  alturaMax?: number;
}) {
  const linhas = montarLinhas(colunas);
  return (
    <>
      <div className="tbl-scroll" style={{ maxHeight: alturaMax }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>Negócio</th>
              <th className="num">Receita líquida</th>
              <th className="num">Gastos totais</th>
              <th className="num">Resultado</th>
              <th className="num">Margem</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.nome} className={l.resultado < 0 ? 'alert-row' : ''}>
                <td><b>{l.nome}</b></td>
                <td className="num">{brl(l.receita)}</td>
                <td className="num neg">{brl(-l.gastos)}</td>
                <td className={`num ${l.resultado < 0 ? 'neg' : ''}`}>{brl(l.resultado)}</td>
                <td className="num">
                  {l.margem == null ? '—' : `${l.margem.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Avisos colunas={colunas} linhas={linhas} />
    </>
  );
}

export function GraficoColunasDre({ colunas, altura }: {
  colunas: DreColuna[];
  altura?: number;
}) {
  const alturaEfetiva = altura ?? (colunas.length > 8 ? 430 : 320);
  const linhas = montarLinhas(colunas);

  return (
    <>
      <div className="chart-box" style={{ height: alturaEfetiva }}>
        <Chart
          type="bar"
          data={{
            labels: linhas.map((l) => l.nome),
            datasets: [
              {
                label: 'Receita líquida', data: linhas.map((l) => l.receita),
                backgroundColor: GOLD, borderRadius: 4, ...BARRA,
              },
              {
                label: 'Gastos totais', data: linhas.map((l) => -l.gastos),
                backgroundColor: OLIVEDK, borderRadius: 4, ...BARRA,
              },
              {
                label: 'Resultado', data: linhas.map((l) => l.resultado),
                backgroundColor: AMBER, borderRadius: 4, ...BARRA,
              },
            ],
          }}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              x: { grid: { display: false }, stacked: false },
              y: {
                grid: { color: CREAM },
                ticks: { callback: (v) => eixoCompacto(Number(v)) },
                grace: '8%',
              },
            },
            plugins: {
              legend: { position: 'bottom', labels: { boxWidth: 12 } },
              tooltip: {
                callbacks: {
                  label: (ctx) => `${ctx.dataset.label}: ${brl(Number(ctx.raw))}`,
                },
              },
            },
          }}
        />
      </div>
      <div style={{ marginTop: 12 }}>
        <TabelaColunasDre colunas={colunas} alturaMax={200} />
      </div>
    </>
  );
}
