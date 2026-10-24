import { brlK } from '../api/client';
import type { BudgetDaLinha } from '../api/dreNova';
import type { CardDoBudget, CustosDaProducaoResposta, ExecutivoResposta, IndicadoresDaProducaoResposta } from '../api/gerencial';
import type { FrenteDaGestao } from '../pages/GestaoDoResultado';
import { fraseDoQuadroAfetado } from './AvisoDaFolha';
import { budgetNoCard } from './budgetNaTela';
import { CardDosCustos } from './CustosDaProducao';
import { CardsDosIndicadores } from './IndicadoresDaProducao';
import { ResultadoSemFolha } from './ResultadoSemFolha';
import { Pill } from './ui';

export type StatusDoBudget = 'CRITICO' | 'ATENCAO' | 'SAUDAVEL';
export interface CardDoBudgetNaSintese { titulo: string; status: StatusDoBudget | null; linhas: string[]; link: string }
type Aconteceu = ExecutivoResposta['aconteceu'];
type Lido<T> = T | { erro: string } | null;

const STATUS_DO_BUDGET = { VERMELHO: 'CRITICO', AMARELO: 'ATENCAO', VERDE: 'SAUDAVEL' } as const;

const LINHAS_DO_BUDGET: Array<{ card: CardDoBudget; rotulo: string; valor: (a: Aconteceu) => number | null; positivo: boolean }> = [
  { card: 'receita_liquida', rotulo: 'Receita líquida', valor: (a) => a.receita_liquida, positivo: false },
  { card: 'custos', rotulo: 'Custos', valor: (a) => a.custos, positivo: true },
  { card: 'despesas', rotulo: 'Despesas', valor: (a) => a.despesas, positivo: true },
  { card: 'resultado_liquido', rotulo: 'Resultado por competência', valor: (a) => a.resultado_liquido, positivo: false },
];

export function cardDoBudget(ex: ExecutivoResposta): CardDoBudgetNaSintese | null {
  const b = ex.budget;
  const ro = b?.estado === 'COMPARADO' ? b.por_card?.resultado_operacional : undefined;
  if (!b || !ro) return null;
  const frase = (rotulo: string, valor: number | null, linha: BudgetDaLinha, positivo: boolean) => `${rotulo} ${brlK(valor)}: ${budgetNoCard(linha, positivo)}.`;
  const linhas = [frase('Resultado operacional', ex.aconteceu.resultado_operacional, ro, false)];
  for (const l of LINHAS_DO_BUDGET) {
    const x = b.por_card?.[l.card];
    if (x && (x.cor === 'VERMELHO' || x.cor === 'AMARELO')) linhas.push(frase(l.rotulo, l.valor(ex.aconteceu), x, l.positivo));
  }
  return { titulo: 'Budget', status: ro.cor ? STATUS_DO_BUDGET[ro.cor] : null, linhas, link: 'Abrir a DRE com o Budget' };
}

const TOM = { CRITICO: 'bad', ATENCAO: 'warn', SAUDAVEL: 'ok' } as const;
const ROTULO_DO_STATUS = { CRITICO: 'CRÍTICO', ATENCAO: 'ATENÇÃO', SAUDAVEL: 'SAUDÁVEL' } as const;

export function SinteseDasFrentes({ ex, doMes = null, indicadores = null, custos = null, mes, onInvestigar, onAbrirDre }: {
  ex: ExecutivoResposta; doMes?: Lido<ExecutivoResposta>; indicadores?: Lido<IndicadoresDaProducaoResposta>; custos?: Lido<CustosDaProducaoResposta>; mes: string;
  onInvestigar?: (frente: FrenteDaGestao) => void;
  onAbrirDre?: () => void;
}) {
  const budget = cardDoBudget(ex);
  return (
    <>
      {budget && ex.folha_pendente?.length ? <p className="obs-tela">{`⚠ ${fraseDoQuadroAfetado('Os números do card do Budget abaixo')}`}</p> : null}
      <div id="sintese-das-frentes" className="sintese-das-frentes">
        <ResultadoSemFolha ex={doMes} mes={mes} meta={ex.aconteceu.meta_pct} onInvestigar={onInvestigar && (() => onInvestigar('consolidado'))} />
        <CardsDosIndicadores ex={doMes} ind={indicadores} mes={mes} onInvestigar={onInvestigar} />
        <CardDosCustos custos={custos} mes={mes} onInvestigar={onInvestigar} />
        {budget && (
          <div className={`sintese-card${budget.status ? ` sintese-${budget.status.toLowerCase()}` : ''}`}>
            <h4>{`${budget.titulo} `}{budget.status && <Pill tone={TOM[budget.status]}>{ROTULO_DO_STATUS[budget.status]}</Pill>}</h4>
            <ul>{budget.linhas.map((l) => <li key={l}>{l}</li>)}</ul>
            {onAbrirDre && <button type="button" className="gr-toggle" onClick={onAbrirDre}>{budget.link}</button>}
          </div>
        )}
      </div>
    </>
  );
}
