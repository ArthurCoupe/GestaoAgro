import { brl } from '../api/client';
import type { BudgetDaLinha } from '../api/dreNova';
import type { CardDoBudget, ExecutivoResposta } from '../api/gerencial';
import { notaDoBudget, pctDoDesvio, StatusDoBudget } from './budgetNaTela';
import { Panel } from './ui';

export const MARGEM_MINIMA_DO_PEDIDO = 15;

const LINHAS: Array<{ card: Exclude<CardDoBudget, 'resultado_liquido'>; rotulo: string; sinal: 1 | -1 }> = [
  { card: 'receita_liquida', rotulo: 'Receita líquida', sinal: 1 },
  { card: 'custos', rotulo: 'Custos', sinal: -1 },
  { card: 'despesas', rotulo: 'Despesas', sinal: -1 },
  { card: 'resultado_operacional', rotulo: 'Resultado operacional', sinal: 1 },
];

export interface LinhaDoAcumulado { rotulo: string; budget: number; realizado: number; diferenca: number; b: BudgetDaLinha }
export interface Distancia { pp: number; reais: number }
export interface AcumuladoContraOBudgetCalc {
  linhas: LinhaDoAcumulado[];
  fecha: { budget: boolean; realizado: boolean };
  margem: { budget: number | null; realizado: number | null };
  distancias: Array<{ rotulo: string; budget: Distancia | null; realizado: Distancia | null }>;
}

const cent = (v: number) => Math.round(v * 100);
const duasCasas = (v: number) => Math.round(v * 100) / 100 + 0;
const pctAlvo = (v: number) => `${v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;

export function acumuladoContraOBudget(ex: Pick<ExecutivoResposta, 'aconteceu' | 'budget'>): AcumuladoContraOBudgetCalc | null {
  const pc = ex.budget?.estado === 'COMPARADO' ? ex.budget.por_card ?? {} : null;
  if (!pc) return null;
  const linhas: LinhaDoAcumulado[] = [];
  for (const { card, rotulo, sinal } of LINHAS) {
    const b = pc[card];
    const r = ex.aconteceu[card];
    if (!b || b.desvio_cent == null || r == null) return null;
    linhas.push({ rotulo, budget: b.budget_cent / 100, realizado: (sinal * cent(r)) / 100 + 0, diferenca: b.desvio_cent / 100, b });
  }
  const [receita, custos, despesas, resultado] = linhas;
  const fechaNa = (k: 'budget' | 'realizado') => cent(receita[k]) + cent(custos[k]) + cent(despesas[k]) === cent(resultado[k]);
  const margem = (res: number, rec: number) => (rec > 0 ? duasCasas((res / rec) * 100) : null);
  const distancia = (res: number, rec: number, alvo: number): Distancia | null => (rec > 0
    ? { pp: duasCasas((res / rec) * 100 - alvo), reais: (cent(res) - Math.round((alvo / 100) * cent(rec))) / 100 + 0 }
    : null);
  const minima = ex.aconteceu.margem_minima_pct ?? MARGEM_MINIMA_DO_PEDIDO;
  const desejavel = ex.aconteceu.margem_desejada_configurada_pct;
  const alvos = [
    { pct: minima, rotulo: `Distância para a margem mínima de ${pctAlvo(minima)}` },
    ...(desejavel == null ? [] : [{ pct: desejavel, rotulo: `Distância para a margem desejável de ${pctAlvo(desejavel)}` }]),
  ];
  return {
    linhas,
    fecha: { budget: fechaNa('budget'), realizado: fechaNa('realizado') },
    margem: { budget: margem(resultado.budget, receita.budget), realizado: margem(resultado.realizado, receita.realizado) },
    distancias: alvos.map(({ pct, rotulo }) => ({
      rotulo,
      budget: distancia(resultado.budget, receita.budget, pct),
      realizado: distancia(resultado.realizado, receita.realizado, pct),
    })),
  };
}

export function leituraDoQuadro(fecha: AcumuladoContraOBudgetCalc['fecha']): string {
  const naoFecham = [!fecha.budget && 'Budget', !fecha.realizado && 'Realizado'].filter(Boolean);
  return 'Diferença = realizado − Budget: positiva é favorável (receita acima ou custo abaixo do Budget).'
    + (naoFecham.length === 0
      ? ' Receita, custos e despesas somam o resultado operacional nas duas colunas.'
      : ` Na coluna ${naoFecham.join(' e na coluna ')}, receita, custos e despesas não somam o resultado operacional nesta apuração: avise a equipe técnica.`)
    + ' Margem operacional = resultado operacional ÷ receita líquida. A distância é a margem menos a margem alvo, em'
    + ' pontos percentuais, e entre parênteses o resultado operacional menos o alvo sobre a receita do período:'
    + ' positiva, acima do alvo; negativa, quanto falta. Sem receita positiva, a margem e a distância aparecem como'
    + ' traço. A margem mínima é a de Meta da empresa, na tela Budget, a mesma do card da margem; a desejável é a margem desejada, também de Meta da empresa.';
}

const pctMargem = (v: number | null) => (v == null ? '—' : `${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`);
function textoDaDistancia(d: Distancia | null): string {
  if (d == null) return '—';
  const pp = d.pp === 0 && d.reais !== 0
    ? `menos de 0,01 p.p. ${d.reais > 0 ? 'acima' : 'abaixo'}`
    : `${d.pp > 0 ? '+' : ''}${d.pp.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} p.p.`;
  return `${pp} (${brl(d.reais)})`;
}
const celulaDaDistancia = (d: Distancia | null) => <td className={`num${d && d.reais < 0 ? ' neg' : ''}`}>{textoDaDistancia(d)}</td>;
const celula = (v: number) => <td className={`num${v < 0 ? ' neg' : ''}`}>{brl(v)}</td>;

export function AcumuladoContraOBudget({ ex, periodo }: { ex: Pick<ExecutivoResposta, 'aconteceu' | 'budget' | 'etiqueta'>; periodo: string }) {
  if (!ex.budget) return null;
  const titulo = `Consolidado contra o Budget: ${periodo}`;
  const sub = 'O Budget é do Consolidado (por negócio ainda não há Budget): o mesmo período da tabela acima, contra o Budget aprovado do mesmo período.';
  const v = acumuladoContraOBudget(ex);
  if (!v) {
    const nota = ex.budget.estado === 'COMPARADO' ? 'O Budget aprovado ou o realizado do período não tem uma das linhas do resultado operacional, por isso a comparação não aparece.' : notaDoBudget(ex.budget);
    return <Panel title={titulo} tag={ex.etiqueta} sub={sub}><div className="empty">{nota}</div></Panel>;
  }
  return (
    <Panel title={titulo} tag={ex.etiqueta} sub={sub}>
      <div className="tbl-scroll">
        <table className="tbl">
          <thead><tr><th>Linha</th><th className="num">Budget</th><th className="num">Realizado</th><th className="num">Diferença R$</th><th className="num">Diferença %</th><th>Status</th></tr></thead>
          <tbody>
            {v.linhas.map((l) => (
              <tr key={l.rotulo} className={l.rotulo === 'Resultado operacional' ? 'ln-total' : undefined}>
                <td>{l.rotulo}</td>{celula(l.budget)}{celula(l.realizado)}{celula(l.diferenca)}<td className="num">{pctDoDesvio(l.b)}</td><td><StatusDoBudget b={l.b} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="tbl-scroll">
        <table className="tbl">
          <thead><tr><th>Margem</th><th className="num">Budget</th><th className="num">Realizado</th></tr></thead>
          <tbody>
            <tr><td>Margem operacional</td><td className="num">{pctMargem(v.margem.budget)}</td><td className="num">{pctMargem(v.margem.realizado)}</td></tr>
            {v.distancias.map((d) => (
              <tr key={d.rotulo}><td>{d.rotulo}</td>{celulaDaDistancia(d.budget)}{celulaDaDistancia(d.realizado)}</tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="obs-tela">{notaDoBudget(ex.budget, leituraDoQuadro(v.fecha))}</p>
    </Panel>
  );
}
