import { brlK, fmMoeda } from '../api/client';
import type { BudgetDaLinha, DreNovaBudget } from '../api/dreNova';
import { Pill } from './ui';

export const STATUS_DO_BUDGET = {
  VERDE: { tom: 'ok', rotulo: 'Atingiu' },
  AMARELO: { tom: 'warn', rotulo: 'Até 5% desfavorável' },
  VERMELHO: { tom: 'bad', rotulo: 'Mais de 5% desfavorável' },
} as const;

export const centavosOuTraco = (c: number | null | undefined) => (c == null ? '—' : fmMoeda(c / 100));
const pctComDuasCasas = (p: number) => `${p.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}%`;

export const pctDoDesvio = (b?: BudgetDaLinha | null): string => {
  if (b?.desvio_pct == null || b.desvio_cent == null) return '—';
  const sinal = b.desvio_cent > 0 ? '+' : b.desvio_cent < 0 ? '-' : '';
  return `${sinal}${pctComDuasCasas(b.desvio_pct)}`;
};

export function budgetNoCard(b: BudgetDaLinha | undefined, positivo = false): string {
  if (!b) return 'Budget —';
  const s = positivo ? -1 : 1;
  const valor = `Budget ${brlK((s * b.budget_cent) / 100)}`;
  if (b.desvio_cent == null) return valor;
  const d = s * b.desvio_cent;
  if (d === 0) return `${valor} · igual`;
  const direcao = s * b.budget_cent < 0 ? (b.desvio_cent > 0 ? 'melhor' : 'pior') : d > 0 ? 'acima' : 'abaixo';
  return `${valor} · ${b.desvio_pct == null ? '' : `${pctComDuasCasas(b.desvio_pct)} `}${direcao}`;
}

export function StatusDoBudget({ b }: { b?: BudgetDaLinha | null }) {
  return b?.cor ? <Pill tone={STATUS_DO_BUDGET[b.cor].tom}>{STATUS_DO_BUDGET[b.cor].rotulo}</Pill> : <>—</>;
}

export const nomeDaMeta = (origem?: 'BUDGET' | 'MARGEM_DESEJADA') => (origem === 'BUDGET' ? 'margem do Budget aprovado' : 'margem desejada');
export const pctDaMeta = (v: number | null | undefined) => (v == null ? '—' : `${v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`);
export function notaDaMetaSemBudget(b: Pick<DreNovaBudget, 'estado' | 'meses_sem_budget' | 'meses_sem_realizado'>): string {
  if (b.estado === 'ERRO') return 'A meta é a margem desejada porque o Budget aprovado não pôde ser lido agora.';
  if (b.estado === 'SEM_APROVADO' || b.meses_sem_budget?.length) {
    return 'A meta é a margem desejada porque não há Budget aprovado para o período inteiro. Com o Budget aprovado, a meta passa a ser a margem operacional dele.';
  }
  if (b.meses_sem_realizado?.length) {
    return `A meta é a margem desejada porque ainda não há lançamento apurado em ${faixasDeMeses(b.meses_sem_realizado)}. Com o período inteiro apurado, a meta passa a ser a margem operacional do Budget aprovado.`;
  }
  return 'A meta é a margem desejada porque o Budget aprovado não tem receita líquida positiva e resultado operacional apurados no período.';
}

export const LEITURA_DA_DRE = 'Diferença = valor − Budget: positiva é favorável (receita acima ou custo abaixo do Budget).';
export const LEITURA_DOS_CARDS = 'Em cada card, o Budget do mesmo período e quanto o valor ficou acima ou abaixo dele (melhor ou pior, quando o Budget é negativo); o selo diz se é favorável.';

export function faixasDeMeses(meses: readonly string[]): string {
  const ordinal = (m: string) => Number(m.slice(0, 4)) * 12 + Number(m.slice(5, 7));
  const mes = (m: string) => `${m.slice(5, 7)}/${m.slice(0, 4)}`;
  const faixas: string[][] = [];
  for (const m of [...meses].sort()) {
    const ultima = faixas[faixas.length - 1];
    if (ultima && ordinal(m) === ordinal(ultima[ultima.length - 1]) + 1) ultima.push(m);
    else faixas.push([m]);
  }
  return faixas.map((f) => (f.length === 1 ? mes(f[0]) : `${mes(f[0])} a ${mes(f[f.length - 1])}`)).join(', ');
}

export function ressalvasDoBudget(b: Pick<DreNovaBudget, 'meses_reconstruidos' | 'defeitos'>): string {
  return [
    b.meses_reconstruidos?.length ? `Em ${faixasDeMeses(b.meses_reconstruidos)} o Budget foi reconstruído depois do mês, não planejado antes.` : '',
    b.defeitos?.length ? 'A grade do Budget tem aviso de montagem: avise a equipe técnica.' : '',
  ].filter(Boolean).join(' ');
}

export function notaDoBudget(b?: Omit<DreNovaBudget, 'por_linha'>, leitura = LEITURA_DA_DRE): string {
  if (!b) return '';
  if (b.estado === 'COMPARADO') {
    return [`Budget: ${b.versao?.nome ?? 'versão aprovada'}, aprovado. ${leitura} Onde não há Budget aparece traço.`, ressalvasDoBudget(b)].filter(Boolean).join(' ');
  }
  if (b.estado === 'SEM_APROVADO') return `Sem Budget aprovado para ${b.exercicio}. O Budget aparece aqui quando uma versão for aprovada na tela Budget.`;
  if (b.estado === 'INCOMPLETO') {
    return [
      b.meses_sem_budget?.length ? `O Budget aprovado não tem valor em ${faixasDeMeses(b.meses_sem_budget)}.` : '',
      b.meses_sem_realizado?.length ? `Ainda não há lançamento apurado em ${faixasDeMeses(b.meses_sem_realizado)}.` : '',
      'Sem o período inteiro a comparação sairia errada, por isso o Budget não aparece.',
    ].filter(Boolean).join(' ');
  }
  return b.mensagem ?? 'Não foi possível ler o Budget aprovado agora.';
}
