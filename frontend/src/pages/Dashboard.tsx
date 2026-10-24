import { useEffect, useState, type ReactNode } from 'react';
import { Doughnut } from 'react-chartjs-2';
import { brl, brlK, dataBr, hojeISO, num, pct } from '../api/client';
import { DEFINICOES } from '../api/definicoes';
import type { DreNovaResposta, VisaoNova } from '../api/dreNova';
import {
  avisoParaTela, etiquetaDoRegime, fmtPp, getCustosDaProducao, getExecutivo, getIndicadoresDaProducao, infoDaEscada, PERGUNTAS_DAS_TELAS, rotulosDaEscada, tomDaMargem,
  type AtividadeChave, type CardDoBudget, type ChaveDaEscadaPorAtividade, type Escada, type ExecutivoAconteceu, type ExecutivoAtividade, type ExecutivoBudget, type ExecutivoResposta, type Regime,
  type CustosDaProducaoResposta, type IndicadoresDaProducaoResposta,
} from '../api/gerencial';
import { PERGUNTAS } from '../api/perguntasGerenciais';
import { alertasContraOBudget, alertasExecutivosDoMes, rotuloDoMes } from '../api/alertas';
import { CINZA, PALETTE } from '../charts/setup';
import { abrirNaDre, competenciaDoFim, periodoNaDre, type LinhaDaDre } from '../components/abrirNaDre';
import { abrirNaGestao } from '../components/abrirNaGestao';
import { AvisoDaFolha, serieSemMesesPendentes } from '../components/AvisoDaFolha';
import { budgetNoCard, LEITURA_DOS_CARDS, nomeDaMeta, notaDaMetaSemBudget, notaDoBudget, pctDaMeta, ressalvasDoBudget, StatusDoBudget } from '../components/budgetNaTela';
import { Composicao, blocosDaComposicao, proximoAberto, ROTULO_DO_BLOCO, tituloDoAlvo, type AlvoComposicao } from '../components/Composicao';
import { EscadaDoAno, rotuloDoPeriodo } from '../components/EscadaDoAno';
import { EvolucaoMensal } from '../components/EvolucaoMensal';
import { EvolucaoPorAtividade } from '../components/EvolucaoPorAtividade';
import { usePeriodoDaTela, type EscopoDaTela } from '../components/FiltroDoPeriodo';
import { ONDE_SE_EDITA_A_META } from '../components/MetaDaEmpresa';
import { gravarPeriodoAoAbrir } from '../components/periodoAoAbrir';
import { pontoDeEquilibrioDoPeriodo } from '../components/PontoDeEquilibrioDaFrente';
import { QuadroDeAlertasExemplo } from '../components/QuadroDeAlertasExemplo';
import { SinteseDasFrentes } from '../components/SinteseDasFrentes';
import { Kpi, Panel, periodoDoMes, Pill, useNav, usePeriodo } from '../components/ui';
import { intervaloDoPar, mesmosMeses } from '../components/ResultadoSemFolha';

export function resultadoCompetenciaDelta({ resultado_liquido, financeiro_e_ajustes }: {
  resultado_liquido: number | null; financeiro_e_ajustes: number | null;
}, regime: Regime = 'COMPETENCIA'): string | undefined {
  if (resultado_liquido == null) return undefined;
  const r = rotulosDaEscada(regime);
  if (financeiro_e_ajustes == null) {
    return `${r.resultado_competencia} (T06): ${brl(resultado_liquido)}, a diferença para o operacional não foi publicada.`;
  }
  return `Do ${r.resultado_operacional} ao ${r.resultado_competencia}: impostos sobre o resultado e financeiro de ${brl(financeiro_e_ajustes)} `
    + '(T06 = T03 + grupos 6 e 7; ajustes financeiros, patrimônio e sócios ficam fora dos dois).';
}

export function mcUnitaria({ mc, kg, bandejas }: {
  mc: number | null; kg: number | null; bandejas: number | null;
}) {
  const por = (den: number | null) => (mc == null || !den ? null : Math.round((mc / den) * 100) / 100);
  return { por_kg: por(kg), por_bandeja: por(bandejas) };
}

export function resumoDeAtividade(a: ExecutivoAtividade, metaPct: number, minimoPct: number | null = null) {
  return {
    valor: brlK(a.resultado),
    delta: `margem ${pct(a.margem_pct)} · receita ${brlK(a.receita)}`,
    tone: tomDaMargem(a.margem_pct, metaPct, minimoPct),
  };
}

export function rotuloDeJanAte(recente: { ano: number; mes: number }): string {
  const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  return recente.mes === 1 ? `jan/${recente.ano}` : `jan a ${meses[recente.mes - 1]}/${recente.ano}`;
}

export function rotuloDoMesFinal(ex: Pick<ExecutivoResposta, 'periodo'>): string {
  const [ano, mes] = ex.periodo.fim.slice(0, 7).split('-').map(Number);
  return periodoDoMes(ano, mes - 1).rotulo;
}

export function temMovimento(a: ExecutivoAtividade): boolean {
  return a.receita !== 0 || a.custos !== 0 || a.despesas !== 0;
}

export function foraDoRecorte(ex: Pick<ExecutivoResposta, 'visao'>, a: ExecutivoAtividade): boolean {
  return ex.visao !== 'consolidado' && !temMovimento(a);
}

export function semLancamentos(ex: Pick<ExecutivoResposta, 'periodo' | 'meses_sem_fato'>) {
  return ex.periodo.meses.length > 0 && ex.meses_sem_fato.length === ex.periodo.meses.length;
}

const listaDeCodigos = (codigos: (string | null)[]) => {
  const v = codigos.filter((c): c is string => !!c);
  return v.length > 0 ? v.join(', ') : 'nenhum componente cadastrado';
};

const DELTA_T03 = 'T03: antes dos impostos sobre o resultado e do financeiro';
const DELTA_T06 = 'T06, líquido: após impostos sobre o resultado e financeiro; sem ajustes financeiros, patrimônio e sócios';

export function SecaoAconteceu({ ex, titulo = 'O que aconteceu', sub, onAbrir, pergunta, onAbrirDre }: {
  ex: ExecutivoResposta; titulo?: string; sub?: string; onAbrir?: (alvo: AlvoComposicao) => void;
  onAbrirDre?: (linha: LinhaDaDre) => void;
  pergunta?: string;
}) {
  const a = ex.aconteceu;
  const daReceita = (v: number | null) => (v == null ? undefined : `${pct(v)} da receita`);
  const rodape = resultadoCompetenciaDelta(a, ex.regime);
  const tomDoResultado = (v: number | null) => (v == null ? 'info' : (v < 0 ? 'alert' : 'good'));
  const tomDoCusto = (v: number | null) => (v == null ? 'info' : (v < 0 ? 'good' : 'alert'));
  const r = rotulosDaEscada(ex.regime);
  const info = (campo: Parameters<typeof infoDaEscada>[0]) => {
    const i = infoDaEscada(campo, ex.regime);
    return i ? `${i.pergunta} · ${i.formula}` : undefined;
  };
  const abrir = (bloco: 'receita' | 'custos' | 'despesas') => (onAbrir ? () => onAbrir({ tipo: 'bloco', bloco }) : undefined);
  const naDre = (linha: LinhaDaDre, valor: number | null) => (onAbrirDre && ex.regime === 'COMPETENCIA' && valor != null ? () => onAbrirDre(linha) : undefined);
  const competencia = ex.regime === 'COMPETENCIA';
  const infoCustos = competencia ? `${PERGUNTAS.custos} · Custos diretos (grupo 3 da DRE)` : undefined;
  const infoDespesas = competencia ? `${PERGUNTAS.despesas} · Despesas diretas e compartilhadas (grupos 4 e 5 da DRE)` : undefined;
  const pc = ex.budget?.estado === 'COMPARADO' ? ex.budget.por_card ?? {} : null;
  const comBudget = (base: ReactNode, card: CardDoBudget, positivo = false): ReactNode => (!pc ? base : (
    <>{base}{base != null && <br />}{budgetNoCard(pc[card], positivo)}{pc[card]?.cor && <> <StatusDoBudget b={pc[card]} /></>}</>
  ));
  const abaixoDoMinimo = a.margem_minima_pct != null && a.margem_liquida_pct != null && a.margem_liquida_pct < a.margem_minima_pct;
  const pctDoCard = a.meta_origem === 'BUDGET' ? pctDaMeta : pct;
  return (
    <Panel title={titulo} tag={ex.etiqueta} pergunta={pergunta}
      sub={sub ?? `CUSTOS = grupos que a cadeia subtrai de T01 até T02 (códigos ${listaDeCodigos(a.composicao.custos_codigos)}); `
        + `DESPESAS = de T02 até T03 (${listaDeCodigos(a.composicao.despesas_codigos)})`}>
      <div className="kpi-grid k6">
        <Kpi label={r.receita_liquida} info={info('receita_liquida')} value={brlK(a.receita_liquida)} delta={comBudget(undefined, 'receita_liquida')}
          tone={a.receita_liquida == null ? 'info' : undefined} onClick={abrir('receita')} />
        <Kpi label="Custos" info={infoCustos} value={brlK(a.custos)} delta={comBudget(daReceita(a.custos_pct), 'custos', true)} tone={tomDoCusto(a.custos)} onClick={abrir('custos')} />
        <Kpi label="Despesas" info={infoDespesas} value={brlK(a.despesas)} delta={comBudget(daReceita(a.despesas_pct), 'despesas', true)} tone={tomDoCusto(a.despesas)} onClick={abrir('despesas')} />
        <Kpi label={r.resultado_operacional} info={info('resultado_operacional')} value={brlK(a.resultado_operacional)}
          delta={comBudget(a.resultado_operacional == null ? undefined : DELTA_T03, 'resultado_operacional')}
          tone={tomDoResultado(a.resultado_operacional)} onClick={naDre('T03', a.resultado_operacional)} />
        <Kpi label={r.resultado_competencia} info={info('resultado_competencia')} value={brlK(a.resultado_liquido)}
          delta={comBudget(a.resultado_liquido == null ? undefined : DELTA_T06, 'resultado_liquido')}
          tone={tomDoResultado(a.resultado_liquido)} onClick={naDre('T06', a.resultado_liquido)} />
        <Kpi label={r.margem_operacional_pct} info={info('margem_operacional_pct')} value={pctDoCard(a.margem_liquida_pct)}
          delta={`Meta${a.meta_origem === 'BUDGET' ? ' do Budget' : ''}: ${pctDoCard(a.meta_pct)}${a.margem_minima_pct != null ? ` · mínimo ${pct(a.margem_minima_pct)}` : ''} · sobre o resultado operacional${a.atinge_meta && !abaixoDoMinimo ? ' ✓' : ''}`}
          tone={tomDaMargem(a.margem_liquida_pct, a.meta_pct, a.margem_minima_pct ?? null)} onClick={naDre('T03', a.margem_liquida_pct)} />
      </div>
      {rodape && <p className="obs-tela">{rodape}</p>}
      {ex.budget && <p className="obs-tela">{notaDoBudget(ex.budget, LEITURA_DOS_CARDS)}</p>}
    </Panel>
  );
}

export function aconteceuDaEscada(e: Escada, base: Pick<ExecutivoAconteceu, 'meta_pct' | 'meta_origem' | 'margem_minima_pct' | 'composicao'>): ExecutivoAconteceu {
  const rl = e.receita_liquida;
  const pctDaReceita = (v: number) => (rl > 0 ? Math.round((v / rl) * 10000) / 100 : null);
  const custos = -e.custos_diretos;
  const despesas = -(e.despesas_diretas + e.despesas_compartilhadas);
  const margem = rl > 0 ? e.margem_operacional_pct : null;
  return {
    receita_liquida: rl, custos, despesas,
    resultado_operacional: e.resultado_operacional, resultado_liquido: e.resultado_competencia,
    financeiro_e_ajustes: e.resultado_competencia - e.resultado_operacional,
    custos_pct: pctDaReceita(custos), despesas_pct: pctDaReceita(despesas),
    margem_liquida_pct: margem, meta_pct: base.meta_pct, meta_origem: base.meta_origem,
    margem_minima_pct: base.margem_minima_pct,
    atinge_meta: margem == null ? null : margem >= base.meta_pct,
    composicao: base.composicao,
  };
}

export function blocoDoCard(ex: Pick<ExecutivoResposta, 'composicao'>, chave: ChaveDaEscadaPorAtividade | 'TOTAL', bloco: 'receita' | 'custos' | 'despesas') {
  const linhas = chave === 'TOTAL' ? ex.composicao[bloco] : (chave === 'PRODUCAO' ? [] : (ex.composicao.por_atividade[chave]?.[bloco] ?? []));
  return [{ bloco, rotulo: ROTULO_DO_BLOCO[bloco], linhas }];
}

export function cardLevaADre(ex: Pick<ExecutivoResposta, 'escada'>, chave: ChaveDaEscadaPorAtividade | 'TOTAL'): boolean {
  if (chave === 'TOTAL') return true;
  const e = ex.escada.por_atividade[chave];
  const t = ex.escada.total;
  return e != null && e.resultado_operacional === t.resultado_operacional && e.resultado_competencia === t.resultado_competencia;
}

export function dicaDosCards(composicao: boolean, dre: boolean): string {
  if (composicao && dre) return ' Receita, custos e despesas abrem a composição; os resultados e a margem abrem a DRE.';
  if (composicao) return ' Receita, custos e despesas abrem a composição.';
  if (dre) return ' Os resultados e a margem abrem a DRE.';
  return '';
}

export function CardsDoAno({ ex, chave, rotulo, sub, pergunta, abertoInicial = null }: {
  ex: ExecutivoResposta; chave: ChaveDaEscadaPorAtividade | 'TOTAL'; rotulo: string; sub?: string;
  pergunta?: string;
  abertoInicial?: 'receita' | 'custos' | 'despesas' | null;
}) {
  const navegar = useNav();
  const [aberto, setAberto] = useState<'receita' | 'custos' | 'despesas' | null>(abertoInicial);
  const escada = chave === 'TOTAL' ? ex.escada.total : ex.escada.por_atividade[chave];
  const periodo = rotuloDoPeriodo(ex.periodo);
  const atividade = chave === 'TOTAL' || chave === 'PRODUCAO' ? null : chave;
  const temComposicao = ex.composicao != null && ex.regime === 'COMPETENCIA' && chave !== 'PRODUCAO';
  const levaADre = cardLevaADre(ex, chave);
  const recorte = ex.periodo.inicio === competenciaDoFim(ex.periodo.fim) ? 'Mês'
    : ex.periodo.inicio === `${ex.periodo.fim.slice(0, 4)}-01-01` ? 'Acumulado do ano' : 'Período';
  const naDre = levaADre ? periodoNaDre(ex.periodo) : null;
  return (
    <>
      <SecaoAconteceu ex={{ ...ex, aconteceu: aconteceuDaEscada(escada, ex.aconteceu), budget: undefined }}
        titulo={`${recorte}: ${periodo} · ${rotulo}`} pergunta={pergunta}
        sub={sub ?? `${recorte === 'Acumulado do ano' ? `Acumulado de ${periodo}` : `Em ${periodo}`}: receita, custos, despesas, os dois resultados e a margem de ${rotulo}. Custos e despesas aparecem sem o sinal negativo da DRE.${dicaDosCards(temComposicao, naDre != null && ex.regime === 'COMPETENCIA')}`}
        onAbrir={temComposicao ? (alvo) => { if (alvo.tipo === 'bloco') setAberto((a) => (a === alvo.bloco ? null : alvo.bloco)); } : undefined}
        onAbrirDre={naDre ? (linha) => abrirNaDre(navegar, { visao: ex.visao, ...naDre, linha }) : undefined} />
      {aberto && temComposicao && (
        <Composicao titulo={`${ROTULO_DO_BLOCO[aberto]} · ${rotulo}`} rotuloPeriodo={periodo} etiqueta={ex.etiqueta} regime={ex.regime}
          blocos={blocoDoCard(ex, chave, aberto)} periodo={{ inicio: ex.periodo.inicio, fim: ex.periodo.fim }} visao={ex.visao}
          atividade={atividade} onFechar={() => setAberto(null)} />
      )}
    </>
  );
}

export function CardsDoAnoCarregando({ rotulo }: { rotulo: string }) {
  return (
    <Panel title={`Acumulado do ano · ${rotulo}`} sub="Consolidando o acumulado do ano…">
      <div className="kpi-grid k6">
        <Kpi label="Receita líquida" value="…" tone="info" />
        <Kpi label="Custos" value="…" delta="…" tone="info" />
        <Kpi label="Despesas" value="…" delta="…" tone="info" />
        <Kpi label="Resultado operacional" value="…" delta={DELTA_T03} tone="info" />
        <Kpi label="Resultado por competência" value="…" delta={DELTA_T06} tone="info" />
        <Kpi label="Margem operacional" value="…" delta="Meta: … · sobre o resultado operacional" tone="info" />
      </div>
      <p className="obs-tela">…</p>
    </Panel>
  );
}

export function EscadaCarregando({ paineis, soMensal }: { paineis: number; soMensal?: boolean }) {
  return (
    <>
      {Array.from({ length: paineis }, (_, i) => (
        <Panel key={i} title={soMensal || i > 0 ? 'Evolução mensal' : 'Acumulado por Segmento'}
          sub={soMensal || i > 0 ? 'Consolidando os meses…' : 'Consolidando a escada do ano…'}>
          <div style={{ minHeight: 480 }} />
        </Panel>
      ))}
    </>
  );
}

export function SecaoObjetivos({ ex, titulo = 'Os dois objetivos', pergunta, margemDiscreta = false, comMinimo = false }: {
  ex: ExecutivoResposta;
  titulo?: string;
  comMinimo?: boolean;
  margemDiscreta?: boolean;
  pergunta?: string;
}) {
  const o = ex.objetivos;
  const neutro = o.disponivel ? undefined : 'info';
  const seguranca = `margem de segurança ${pct(o.margem_seguranca_pct)}${o.margem_seguranca_reais != null ? ` (${brlK(o.margem_seguranca_reais)})` : ''}`;
  const segurancaEmCard = !margemDiscreta || (o.margem_seguranca_pct != null && o.margem_seguranca_pct < 0);
  const doBudget = ex.aconteceu.meta_origem === 'BUDGET';
  const minima = comMinimo && !doBudget ? ex.aconteceu.margem_minima_pct ?? null : null;
  const deltaDaMeta = doBudget ? 'margem operacional do Budget aprovado no período' : ONDE_SE_EDITA_A_META;
  return (
    <Panel title={titulo} tag={ex.etiqueta} pergunta={pergunta}
      sub={`Sair do prejuízo (ponto de equilíbrio, margem 0%) e chegar à ${nomeDaMeta(ex.aconteceu.meta_origem)}: com a estrutura de custos de hoje`}>
      <div className={`kpi-grid ${segurancaEmCard ? 'k4' : 'k3'}`}>
        <Kpi label={`★ ${pontoDeEquilibrioDoPeriodo(ex.periodo).nome}`} value={brlK(o.ponto_equilibrio)}
          delta={[
            o.margem_contribuicao_pct != null && o.fixos != null ? `MC ${pct(o.margem_contribuicao_pct)} · fixos ${brlK(o.fixos)}` : null,
            segurancaEmCard ? null : seguranca,
          ].filter(Boolean).join(' · ') || undefined}
          tone="info" />
        {segurancaEmCard && (
          <Kpi label="Margem de Segurança" value={pct(o.margem_seguranca_pct)}
            delta={o.margem_seguranca_reais != null ? brlK(o.margem_seguranca_reais) : undefined}
            tone={neutro ?? (o.margem_seguranca_pct == null ? 'info' : (o.margem_seguranca_pct < 0 ? 'alert' : 'good'))} />
        )}
        <Kpi label={doBudget ? 'Meta do Budget' : 'Margem Desejada'} value={pctDaMeta(o.margem_desejada_pct)} tone="info"
          delta={minima == null ? deltaDaMeta : (
            <>
              <div>{`Mínimo ${pctDaMeta(minima)} | desejada ${pctDaMeta(o.margem_desejada_pct)}`}</div>
              {deltaDaMeta}
            </>
          )} />
        <Kpi label="Faturamento para Meta" value={brlK(o.faturamento_para_meta)}
          delta={`para margem de ${pctDaMeta(o.margem_desejada_pct)}`} tone="info" />
      </div>
      {!o.disponivel && (
        <p className="obs-tela">Não calculado por completo: {o.faltas.join('; ')}.</p>
      )}
      {ex.budget && !doBudget && <p className="obs-tela">{notaDaMetaSemBudget(ex.budget)}</p>}
      {ex.budget && doBudget && ressalvasDoBudget(ex.budget) && <p className="obs-tela">{ressalvasDoBudget(ex.budget)}</p>}
    </Panel>
  );
}

const ATIVIDADES_EM_CARD: AtividadeChave[] = ['PRODUCAO_COGUMELO', 'PIMENTAO', 'REVENDA'];
const RODAPE_DA_ATIVIDADE: Partial<Record<AtividadeChave, string>> = {
  CORPORATIVO: 'estrutura não rateada',
  NAO_RATEADO: 'ainda sem divisão por negócio',
};
const centavos = (v: number) => Math.round(v * 100);

export function SecaoAtividades({ ex, onAbrir, titulo = 'Quem forma o resultado', sub = 'Resultado e margem de cada negócio no período; o que não é de nenhum negócio fica em Não atribuído, detalhado abaixo', pergunta }: {
  ex: ExecutivoResposta; onAbrir?: (alvo: AlvoComposicao) => void; titulo?: string; sub?: string;
  pergunta?: string;
}) {
  const meta = ex.aconteceu.meta_pct;
  const minimo = ex.aconteceu.margem_minima_pct ?? null;
  const cards = ATIVIDADES_EM_CARD
    .map((chave) => ex.atividades.find((a) => a.chave === chave))
    .filter((a): a is ExecutivoAtividade => a != null && !foraDoRecorte(ex, a));
  const semQuebra = ex.atividades.find((a) => a.chave === 'PRODUCAO_SEM_QUEBRA' && temMovimento(a));
  const rodape = ex.atividades.filter((a) => RODAPE_DA_ATIVIDADE[a.chave] != null && temMovimento(a));
  const naoAtribuido = rodape.reduce((s, a) => s + a.resultado, 0);
  const nCards = cards.length + (semQuebra ? 1 : 0) + (rodape.length > 0 ? 1 : 0);
  const somaCent = [...cards, ...(semQuebra ? [semQuebra] : []), ...rodape].reduce((s, a) => s + centavos(a.resultado), 0);
  const roCent = ex.aconteceu.resultado_operacional == null ? null : centavos(ex.aconteceu.resultado_operacional);
  const parcelas = (a: ExecutivoAtividade) => [
    a.receita !== 0 ? `receita ${brl(a.receita)}` : null,
    a.custos !== 0 ? `custos ${brl(a.custos)}` : null,
    a.despesas !== 0 ? `despesas ${brl(a.despesas)}` : null,
  ].filter(Boolean).join(', ');
  return (
    <Panel title={titulo} tag={ex.etiqueta} pergunta={pergunta} sub={sub}>
      {nCards === 0 ? (
        <div className="empty">Nenhuma atividade de negócio no período.</div>
      ) : (
        <div className={`kpi-grid k${Math.max(3, nCards)}`}>
          {cards.map((a) => {
            const r = resumoDeAtividade(a, meta, minimo);
            return (
              <Kpi key={a.chave} label={a.rotulo} value={r.valor} delta={r.delta} tone={r.tone}
                onClick={onAbrir ? () => onAbrir({ tipo: 'atividade', chave: a.chave }) : undefined} />
            );
          })}
          {semQuebra && <Kpi label={semQuebra.rotulo} value={brlK(semQuebra.resultado)} delta="sem divisão por produto" />}
          {rodape.length > 0 && (
            <Kpi label="Não atribuído a negócio" value={brlK(naoAtribuido)}
              delta={rodape.map((a) => RODAPE_DA_ATIVIDADE[a.chave]).join(' · ')} />
          )}
        </div>
      )}
      {rodape.map((a) => (
        <p key={a.chave} className="obs-tela"><b>{RODAPE_DA_ATIVIDADE[a.chave]}</b>: {brl(a.resultado)} ({parcelas(a)})</p>
      ))}
      {nCards > 0 && (
        <p className="obs-tela">
          {roCent == null || roCent === somaCent
            ? `Soma dos cards: ${brl(somaCent / 100)}${roCent == null ? '.' : ', igual ao Resultado operacional do período.'}`
            : `Soma dos cards: ${brl(somaCent / 100)}. Resultado operacional do período: ${brl(roCent / 100)} (diferença de ${brl((somaCent - roCent) / 100)}).`}
        </p>
      )}
    </Panel>
  );
}

function ListaDeMix({ titulo, nota, vazio, valores, rotulos, ocultas }: {
  titulo: string; nota?: string; vazio: string; valores: Record<AtividadeChave, number | null>; rotulos: Map<AtividadeChave, string>;
  ocultas: Set<AtividadeChave>;
}) {
  const linhas = (Object.keys(valores) as AtividadeChave[]).filter((k) => valores[k] != null && !ocultas.has(k));
  return (
    <>
      <h4>{titulo}</h4>
      {nota && <p className="obs-tela">{nota}</p>}
      {linhas.length === 0 ? (
        <div className="empty">{vazio}</div>
      ) : (
        <table className="tbl">
          <tbody>
            {linhas.map((k) => {
              const v = valores[k] as number;
              return (
                <tr key={k}>
                  <td>{rotulos.get(k) ?? k}</td>
                  <td style={{ width: '50%' }}>
                    <div style={{
                      height: 8, borderRadius: 4, width: `${Math.min(100, Math.abs(v))}%`,
                      background: v < 0 ? 'var(--red-alert)' : 'var(--gold)',
                    }} />
                  </td>
                  <td className={`num ${v < 0 ? 'neg' : ''}`}>{pct(v)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </>
  );
}

const PILL_DA_ACAO = {
  PRIORIZAR: { tone: 'ok', texto: 'Priorizar' },
  MANTER: { tone: 'neutral', texto: 'Manter' },
  REVISAR: { tone: 'bad', texto: 'Revisar' },
} as const;

export function SecaoMixECaminhos({ ex, pergunta, aviso, comparativo }: {
  ex: ExecutivoResposta; pergunta?: string; aviso?: string;
  comparativo?: ReactNode;
}) {
  return (
    <Panel title="Participação dos negócios e caminhos para a meta" tag={ex.etiqueta} pergunta={pergunta}
      sub={`De onde vem a receita e a margem de contribuição, e três jeitos de chegar à ${nomeDaMeta(ex.aconteceu.meta_origem)}: cada um com as premissas ditas`}>
      {aviso && <p className="obs-tela">⚠ {aviso}</p>}
      <MixDaGestao ex={ex} comparativo={comparativo} />
      <CardsDosCaminhos ex={ex} />
      <PremissasDosCaminhos ex={ex} />
    </Panel>
  );
}

export function MixDaGestao({ ex, comparativo }: { ex: ExecutivoResposta; comparativo?: ReactNode }) {
  const rotulos = new Map(ex.atividades.map((a) => [a.chave, a.rotulo]));
  const ocultas = new Set(ex.atividades.filter((a) => foraDoRecorte(ex, a)).map((a) => a.chave));
  const comBarras = ex.atividades.filter((a) => !ocultas.has(a.chave)).length > 1;
  return (
    <>
      {ex.mix.aviso && <p className="obs-tela">⚠ participação dos negócios: {ex.mix.aviso}</p>}
      {comparativo}
      {comBarras && (
        <div className="row r-1-1">
          <div><ListaDeMix titulo={DEFINICOES.participacao_receita.nome} vazio="Sem receita no período." valores={ex.mix.receita} rotulos={rotulos} ocultas={ocultas} /></div>
          <div>
            <ListaDeMix titulo={DEFINICOES.participacao_contribuicao.nome} nota="Parte de cada atividade na margem de contribuição (receita líquida menos custos e despesas variáveis)."
              vazio="Margem de contribuição por atividade não calculável no período." valores={ex.mix.contribuicao} rotulos={rotulos} ocultas={ocultas} />
          </div>
        </div>
      )}
      {comparativo && comBarras && (
        <p className="obs-tela">Percentuais com uma casa decimal: por arredondamento, a soma das barras pode diferir da tabela acima em 0,1 ponto.</p>
      )}
    </>
  );
}

export function CardsDosCaminhos({ ex }: { ex: ExecutivoResposta }) {
  const c = ex.caminhos;
  const ef = c.melhorando_eficiencia;
  return (
    <div className="kpi-grid k3">
      <Kpi label={DEFINICOES.mantendo_composicao.nome} value={brlK(c.mantendo_mix.faturamento_para_meta)}
        delta="faturamento para a meta, com a composição e a estrutura de hoje" tone="info" />
      <Kpi label="Melhorando a eficiência" value={brlK(ef.recuperar_reais)}
        delta={`a recuperar · perdas recuperáveis ${brlK(ef.perdas_recuperaveis)} · sobre custos e despesas de ${brlK(ef.custos_e_despesas)}`}
        tone="info" />
      <div className="kpi info">
        <div className="lab">{DEFINICOES.desempenho_negocio.nome}</div>
        {c.otimizando_mix.ordem.length === 0 ? (
          <div className="val">—</div>
        ) : (
          <ol style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 12 }}>
            {c.otimizando_mix.ordem.map((i) => (
              <li key={i.chave}>
                {i.rotulo} · {pct(i.margem_pct)} <Pill tone={PILL_DA_ACAO[i.acao].tone}>{PILL_DA_ACAO[i.acao].texto}</Pill>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

export function PremissasDosCaminhos({ ex }: { ex: ExecutivoResposta }) {
  const c = ex.caminhos;
  return (
    <>
      <p className="obs-tela"><b>{`${DEFINICOES.mantendo_composicao.nome}:`}</b> {c.mantendo_mix.premissas.join(' ')}</p>
      <p className="obs-tela"><b>Melhorando a eficiência:</b> {c.melhorando_eficiencia.premissas.join(' ')}</p>
      <p className="obs-tela"><b>{`${DEFINICOES.desempenho_negocio.nome}:`}</b> {c.otimizando_mix.premissas.join(' ')}</p>
    </>
  );
}

export function SecaoCaminhos({ ex, pergunta, aviso }: { ex: ExecutivoResposta; pergunta?: string; aviso?: string }) {
  return (
    <Panel title="Caminhos para a meta" tag={ex.etiqueta} pergunta={pergunta}
      sub={`Três jeitos de chegar à ${nomeDaMeta(ex.aconteceu.meta_origem)}; as premissas ficam em Ver detalhamento`}>
      {aviso && <p className="obs-tela">⚠ {aviso}</p>}
      <CardsDosCaminhos ex={ex} />
    </Panel>
  );
}

type Objetivo = 'EQUILIBRIO' | 'META';
const OBJETIVOS: Objetivo[] = ['EQUILIBRIO', 'META'];

const comSinal = (n: number, texto: string) => (n > 0 ? `+${texto}` : texto);

export const ID_DAS_ALAVANCAS = 'alavancas-da-gestao';

export function SecaoAlavancas({ ex, pergunta, id }: { ex: ExecutivoResposta; pergunta?: string; id?: string }) {
  const [objetivo, setObjetivo] = useState<Objetivo>('META');
  const rotulo: Record<Objetivo, string> = {
    EQUILIBRIO: DEFINICOES.resultado_zero.nome,
    META: `${ex.aconteceu.meta_origem === 'BUDGET' ? 'Meta do Budget' : 'Meta da empresa'} (${pctDaMeta(ex.aconteceu.meta_pct)})`,
  };
  const al = ex.alavancas[objetivo];
  const ct = al?.contaminacao ?? null;
  const cb = al?.combinacao ?? null;
  const avisoDasAlavancas = ex.avisos.filter((a) => /alavancas/i.test(a)).join(' ');
  const deltaContaminacao = ct == null ? undefined : (ct.blocos_recuperaveis > 0
    ? `impacto ${brlK(ct.impacto_reais)} · ${num(ct.blocos_recuperaveis)} blocos · ${fmtPp(ct.taxa_pct - ct.meta_pct)} acima da meta${ct.cobre_gap ? ' · cobre o gap' : ''}`
    : `${fmtPp(Math.abs(ct.taxa_pct - ct.meta_pct))} dentro da meta: nada a recuperar`);
  return (
    <Panel title="Alavancas" tag={ex.etiqueta} pergunta={pergunta} id={id}
      sub="Quanto cada alavanca, SOZINHA, teria de mover para fechar o gap até o objetivo: quantidades constantes">
      <div className="tabs">
        {OBJETIVOS.map((op) => (
          <button key={op} className={`tab ${objetivo === op ? 'active' : ''}`}
            onClick={() => setObjetivo(op)}>{rotulo[op]}</button>
        ))}
      </div>
      {!al ? (
        <p className="obs-tela">Sem alavancas: {avisoDasAlavancas || 'o período não tem receita e resultado apurados.'}</p>
      ) : al.ja_atingido ? (
        <div className="empty">
          Objetivo já atingido no período{al.gap != null ? `: resultado ${brl(-al.gap)} acima do alvo` : ''}
        </div>
      ) : (
        <>
          <p className="obs-tela">Resultado-alvo {brl(al.resultado_alvo)} · gap {brl(al.gap)}</p>
          <div className="kpi-grid k4">
            <Kpi label="Preço" value={al.preco ? comSinal(al.preco.pct, pct(al.preco.pct)) : '—'}
              delta={al.preco
                ? `${comSinal(al.preco.reais, brlK(al.preco.reais))} · receita necessária ${brlK(al.preco.receita_necessaria)}`
                : undefined}
              tone={al.preco ? undefined : 'info'} />
            <Kpi label="Custos" value={pct(al.custos?.pct ?? null)}
              delta={al.custos ? brlK(al.custos.reais) : al.gap != null ? 'sem custos a reduzir' : undefined} tone={al.custos ? undefined : 'info'} />
            <Kpi label="Despesas" value={pct(al.despesas?.pct ?? null)}
              delta={al.despesas ? brlK(al.despesas.reais) : al.gap != null ? 'sem despesas a reduzir' : undefined} tone={al.despesas ? undefined : 'info'} />
            <Kpi label="Contaminação" value={ct ? `${pct(ct.taxa_pct)} → ${pct(ct.meta_pct)}` : '—'}
              delta={deltaContaminacao} tone={ct?.cobre_gap ? 'good' : 'info'} />
          </div>
          {cb && (
            <>
              <h4>Combinação</h4>
              <p className="obs-tela">
                {cb.aplicada === 'CONTAMINACAO' ? 'Contaminação aplicada primeiro' : 'Nenhuma alavanca aplicada primeiro'}:
                {' '}recupera {brl(cb.recupera)}; restante {brl(cb.restante)}, fechado por custos {pct(cb.complementos.custos_pct)},
                {' '}despesas {pct(cb.complementos.despesas_pct)} ou preço {cb.complementos.preco_pct == null ? '—' : comSinal(cb.complementos.preco_pct, pct(cb.complementos.preco_pct))}, cada um sozinho.
              </p>
            </>
          )}
          <p className="obs-tela">{al.premissas.join(' ')}</p>
        </>
      )}
    </Panel>
  );
}

export function SecaoVolume({ ex, pergunta, titulo = 'Volume e margem unitária', sub, semKg = false }: {
  ex: ExecutivoResposta; pergunta?: string; titulo?: string; sub?: string; semKg?: boolean;
}) {
  const mc = ex.objetivos.margem_contribuicao;
  return (
    <Panel title={titulo} tag={ex.etiqueta} pergunta={pergunta}
      sub={sub ?? 'Kg colhidos e bandejas embaladas do período; MC/kg e MC/bandeja dividem a margem de contribuição do consolidado pelo volume da produção'}>
      <div className={`kpi-grid ${semKg ? 'k2' : 'k3'}`}>
        {!semKg && (
          <Kpi label="Kg Colhidos" value={num(ex.volume.kg, 1)}
            delta={`${num(ex.volume.bandejas)} bandejas embaladas`} />
        )}
        <Kpi label="MC por Kg" value={brl(ex.volume.mc_por_kg)}
          delta={semKg ? `MC ${brlK(mc)} ÷ ${num(ex.volume.kg, 1)} kg colhidos` : undefined} />
        <Kpi label="MC por Bandeja" value={brl(ex.volume.mc_por_bandeja)}
          delta={semKg ? `MC ${brlK(mc)} ÷ ${num(ex.volume.bandejas)} bandejas embaladas` : undefined} />
      </div>
    </Panel>
  );
}

export function fatiasDaComposicao(itens: Array<{ rotulo: string | null; linha_id: string; valor: number }>, max = PALETTE.length) {
  const fatias = itens.map((i) => ({ rotulo: i.rotulo ?? i.linha_id, valor: Math.abs(i.valor), cor: '' }));
  const juntas = fatias.length > max ? fatias.splice(max - 1) : [];
  if (juntas.length) fatias.push({ rotulo: `Outras (${juntas.length} contas)`, valor: juntas.reduce((s, f) => s + f.valor, 0), cor: CINZA });
  return { fatias: fatias.map((f, i) => ({ ...f, cor: f.cor || PALETTE[i] })), outras: juntas.map((f) => f.rotulo) };
}

export function SecaoComposicao({ ex, pergunta, topo }: { ex: ExecutivoResposta; pergunta?: string; topo?: ReactNode }) {
  const itens = ex.composicao_custos;
  const total = itens.reduce((s, i) => s + Math.abs(i.valor), 0);
  const { fatias, outras } = fatiasDaComposicao(itens);
  return (
    <Panel title="Composição dos Custos" tag={ex.etiqueta} pergunta={pergunta}
      sub="Participação de cada linha do grupo de custos (grupo 3) no total de custos; quando só uma linha dele tem valor (um produto, a Revenda), as contas dela">
      {topo}
      {itens.length === 0 ? (
        <div className="empty">Sem custos lançados no período.</div>
      ) : (
        <>
          <div className="chart-box">
            <Doughnut
              data={{
                labels: fatias.map((f) => f.rotulo),
                datasets: [{
                  data: fatias.map((f) => f.valor),
                  backgroundColor: fatias.map((f) => f.cor), borderWidth: 2, borderColor: '#fff',
                }],
              }}
              options={{
                responsive: true, maintainAspectRatio: false, cutout: '60%',
                plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } } },
              }}
            />
          </div>
          {outras.length > 0 && <p className="obs-tela">Outras: {outras.join(', ')}.</p>}
          <div className="mini-cards">
            <div className="mini"><div className="lab">Total de custos</div><div className="val">{brlK(total)}</div></div>
            <div className="mini">
              <div className="lab">Maior componente</div>
              <div className="val">{pct(itens[0].participacao_pct)}</div>
            </div>
          </div>
        </>
      )}
    </Panel>
  );
}

export function ConsolidadoDoAno({ ex, rotuloPeriodo, aberto, onAbrir }: {
  ex: ExecutivoResposta; rotuloPeriodo: string; aberto: AlvoComposicao | null; onAbrir: (alvo: AlvoComposicao) => void;
}) {
  const ano = ex.periodo.inicio.slice(0, 4);
  const caixa = ex.regime === 'CAIXA';
  const composicao = aberto && (
    <Composicao titulo={tituloDoAlvo(ex, aberto)} rotuloPeriodo={rotuloPeriodo} etiqueta={ex.etiqueta} regime={ex.regime}
      blocos={blocosDaComposicao(ex, aberto)} periodo={{ inicio: ex.periodo.inicio, fim: ex.periodo.fim }} visao={ex.visao}
      atividade={aberto.tipo === 'atividade' ? aberto.chave : null} onFechar={() => onAbrir(aberto)} />
  );
  return (
    <>
      {ex.avisos.map((a, i) => <p key={i} className="obs-tela">⚠ {avisoParaTela(a)}</p>)}
      <SecaoAconteceu ex={ex} titulo={`Consolidado do Ano ${ano}: ${rotuloPeriodo}`}
        sub={`${PERGUNTAS_DAS_TELAS[caixa ? 'caixa' : 'competencia']} A empresa inteira, de janeiro ao último mês apurado. `
          + `Fonte: base nova do ERP, ${caixa ? 'pelo que foi recebido e pago (caixa)' : 'por competência'}.`}
        onAbrir={onAbrir} />
      {aberto?.tipo === 'bloco' && composicao}
      <EscadaDoAno ex={ex} regime={ex.regime} visao={ex.visao} onAbrir={onAbrir} entreAsDuas={aberto?.tipo === 'atividade' ? composicao : null} />
    </>
  );
}

const mensagemDoErro = (e: { response?: { data?: { erro?: string } }; message: string }) =>
  e?.response?.data?.erro ?? e.message;

export function AlertasDoMes({ ex, mesAberto = hojeISO().slice(0, 7) }: {
  ex: Pick<ExecutivoResposta, 'serie_mensal' | 'limiares_alerta' | 'regime' | 'folha_pendente'>;
  mesAberto?: string;
}) {
  const r = alertasExecutivosDoMes(serieSemMesesPendentes(ex.serie_mensal, ex.folha_pendente), ex.limiares_alerta, rotulosDaEscada(ex.regime), mesAberto);
  if ('semBase' in r) {
    return <Panel title="Alertas do mês" sub="Alertas do último mês apurado contra a média dos meses anteriores."><div className="empty">{r.semBase}</div></Panel>;
  }
  const sub = `${r.ultimoDaSerie ? '' : 'Último mês apurado. '}${rotuloDoMes(r.mes)} contra a média dos meses anteriores e contra ${rotuloDoMes(r.anterior)}. `
    + 'Sinal negativo é piora. Os destaques positivos ficam marcados no comparativo mensal logo abaixo, com ▲ e ★.';
  return (
    <QuadroDeAlertasExemplo title="Alertas do mês" sub={sub} categorias={r.categorias}
      colunas={['Linha da DRE', 'Valor do mês', 'Contra a média', 'Contra o mês anterior']}
      rotuloDoItem={['linha', 'linhas']} tituloDosMotivos="Principais alertas por tema" />
  );
}

export interface DreDoMesAlertado { mes: string; dre?: DreNovaResposta; erro?: string }

export function AlertasContraOBudget({ mes, budgetDoAno, lido }: { mes: string | null; budgetDoAno?: ExecutivoBudget; lido?: DreDoMesAlertado | null }) {
  if (!budgetDoAno || !mes) return null;
  const titulo = 'Alertas do mês contra o Budget';
  const sub = `${rotuloDoMes(mes)}, o último mês apurado, contra o Budget aprovado do mês, linha a linha, como na DRE Gerencial.`;
  const nota = (texto: string) => <Panel title={titulo} sub={sub}><div className="empty">{texto}</div></Panel>;
  if (budgetDoAno.estado === 'SEM_APROVADO' || budgetDoAno.estado === 'ERRO') return nota(notaDoBudget(budgetDoAno));
  const doMes = lido?.mes === mes ? lido : null;
  if (doMes?.erro) return nota(`Comparação com o Budget indisponível (${doMes.erro}).`);
  if (!doMes?.dre) return nota('Carregando a comparação com o Budget…');
  if (doMes.dre.defeito) return nota('A DRE do mês tem defeito de apuração, por isso a comparação com o Budget não aparece. Veja a DRE Gerencial.');
  if (doMes.dre.budget?.estado !== 'COMPARADO') return nota(notaDoBudget(doMes.dre.budget) || 'A DRE do mês não trouxe a comparação com o Budget.');
  const ressalvas = ressalvasDoBudget(doMes.dre.budget);
  return (
    <QuadroDeAlertasExemplo title={titulo} sub={`${sub} Crítico: mais de 5% desfavorável; atenção: até 5%.${ressalvas ? ` ${ressalvas}` : ''}`} categorias={alertasContraOBudget(doMes.dre)}
      colunas={['Linha da DRE', 'Valor do mês', 'Budget do mês', 'Diferença']} rotuloDoItem={['linha', 'linhas']} tituloDosMotivos="Onde o mês saiu do Budget" />
  );
}

export function AcumuladoExecutivo({ ex, exPeriodo = null, escopo = exPeriodo ? 'MES' : 'YTD', abertoInicial = null, doMes = null, indicadores = null, custos = null, mesBuscado = null }: {
  ex: ExecutivoResposta;
  exPeriodo?: ExecutivoResposta | null;
  escopo?: EscopoDaTela;
  abertoInicial?: AlvoComposicao | null;
  doMes?: ExecutivoResposta | { erro: string } | null;
  indicadores?: IndicadoresDaProducaoResposta | { erro: string } | null;
  custos?: CustosDaProducaoResposta | { erro: string } | null;
  mesBuscado?: string | null;
}) {
  const [aberto, setAberto] = useState<AlvoComposicao | null>(abertoInicial);
  const navegar = useNav();
  const corpo = exPeriodo ?? ex;
  const ano = ex.periodo.inicio.slice(0, 4);
  const periodo = rotuloDoPeriodo(ex.periodo);
  const periodoCorpo = rotuloDoPeriodo(corpo.periodo);
  const composicao = aberto && (
    <Composicao titulo={tituloDoAlvo(corpo, aberto)} rotuloPeriodo={periodoCorpo} etiqueta={corpo.etiqueta} regime={corpo.regime}
      blocos={blocosDaComposicao(corpo, aberto)} periodo={{ inicio: corpo.periodo.inicio, fim: corpo.periodo.fim }} visao={corpo.visao}
      atividade={aberto.tipo === 'atividade' ? aberto.chave : null} onFechar={() => setAberto(null)} />
  );
  const abrir = (alvo: AlvoComposicao) => setAberto((a) => proximoAberto(a, alvo));
  if (semLancamentos(ex) && semLancamentos(corpo)) {
    return (
      <div className="empty">
        Sem apuração de janeiro a {periodo}: nenhum mês do período tem fato gravado. Último movimento carregado: {ex.ultimo_lancamento ? dataBr(ex.ultimo_lancamento) : '—'}
      </div>
    );
  }
  const periodoVazio = exPeriodo != null && semLancamentos(exPeriodo);
  const avisos = exPeriodo ? [...new Set([...exPeriodo.avisos, ...ex.avisos])] : ex.avisos;
  const folhaPendente = exPeriodo
    ? [...(exPeriodo.folha_pendente ?? []), ...(ex.folha_pendente ?? []).filter((p) => !exPeriodo.folha_pendente?.some((q) => q.mes === p.mes && q.empresa === p.empresa))]
    : ex.folha_pendente;
  const provisorios = exPeriodo ? [...(exPeriodo.meses_provisorios ?? []), ...(ex.meses_provisorios ?? [])] : ex.meses_provisorios;
  const mes = corpo.periodo.fim.slice(0, 7);
  const par = intervaloDoPar(corpo.periodo.fim);
  const doPar = <T extends { periodo: { inicio: string; fim: string } }>(r: T | { erro: string } | null) =>
    (r && !('erro' in r) && !mesmosMeses(r.periodo, par) ? null : r);
  const exDosCards = doPar(doMes);
  const indDosCards = doPar(indicadores);
  const custosDosCards = doPar(custos);
  const comDado = [exDosCards, indDosCards, custosDosCards].some((r) => r && !('erro' in r));
  const mesDosCards = comDado || !mesBuscado ? mes : mesBuscado;
  const naDre = periodoNaDre(corpo.periodo);
  const titulo = escopo === 'YTD' ? `Consolidado do Ano ${ano}: ${periodo}` : `Consolidado ${escopo === 'MES' ? 'do mês' : 'do período'}: ${periodoCorpo}`;
  const recorte = escopo === 'YTD' ? `no acumulado de ${periodo}` : escopo === 'MES' ? `só o mês de ${periodoCorpo}` : `de ${periodoCorpo}`;
  const exportDoErp = corpo.ultimo_lancamento ? ` Dados atualizados: último movimento carregado do ERP em ${dataBr(corpo.ultimo_lancamento)}.` : '';
  return (
    <>
      {avisos.map((a, i) => <p key={i} className="obs-tela">⚠ {avisoParaTela(a)}</p>)}
      <AvisoDaFolha pendentes={folhaPendente} provisorios={provisorios} />
      <h2 className="nivel-da-visao">Como estamos?</h2>
      {periodoVazio ? (
        <div className="empty">{`Sem apuração em ${periodoCorpo}: ${escopo === 'MES' ? 'o mês não tem' : 'nenhum mês do período tem'} fato gravado.`}</div>
      ) : (
        <>
          <SecaoAconteceu ex={corpo} titulo={titulo} pergunta={PERGUNTAS.visao_executiva}
            onAbrirDre={naDre ? (linha) => abrirNaDre(navegar, { visao: 'consolidado', ...naDre, linha }) : undefined}
            sub={`A empresa inteira, ${recorte}. Fonte: base nova do ERP, por competência.${exportDoErp}`} onAbrir={abrir} />
          {aberto?.tipo === 'bloco' && composicao}
        </>
      )}
      {!periodoVazio && (
        <>
          <h2 className="nivel-da-visao">Onde está o problema e qual é a prioridade?</h2>
          <SinteseDasFrentes ex={corpo} doMes={exDosCards} indicadores={indDosCards} custos={custosDosCards} mes={mesDosCards}
            onInvestigar={(frente) => abrirNaGestao(navegar, { frente, escopo, de: corpo.periodo.inicio.slice(0, 7), ate: corpo.periodo.fim.slice(0, 7) })}
            onAbrirDre={naDre ? () => abrirNaDre(navegar, { visao: 'consolidado', ...naDre }) : undefined} />
          <h2 className="nivel-da-visao">Quem forma e quem destrói o resultado?</h2>
          <SecaoAtividades ex={corpo} titulo={`Quem forma o resultado: ${periodoCorpo}`} pergunta={PERGUNTAS.abertura} onAbrir={abrir}
            sub={`Quanto do resultado ${escopo === 'MES' ? 'do mês' : escopo === 'YTD' ? 'acumulado' : 'do período'} vem de Cogumelo, Pimentão e Revenda: quem gera e quem consome. O que não é negócio (estrutura, sem rateio) fica no rodapé.${exportDoErp}`} />
          {aberto?.tipo === 'atividade' && composicao}
        </>
      )}
      <p className="obs-tela">{'Para ver a evolução mês a mês e os gráficos da empresa: '}<button type="button" className="gr-toggle" onClick={() => { gravarPeriodoAoAbrir(escopo, corpo.periodo); navegar('historico'); }}>Análise Mensal do Resultado</button>{'. Para abrir as contas e o Budget: '}<button type="button" className="gr-toggle" onClick={() => navegar('dre_nova')}>DRE Gerencial</button>.</p>
    </>
  );
}

export function buscaOMesAParte(escopo: Escopo, periodo: { inicio: string; fim: string }): boolean {
  return escopo === 'MES' && periodo.inicio !== `${periodo.fim.slice(0, 4)}-01-01`;
}

export function VisaoExecutivaAcumulada() {
  const { periodo } = usePeriodo();
  const inicio = `${periodo.fim.slice(0, 4)}-01-01`;
  const { escopo, recusa, intervalo, filtro } = usePeriodoDaTela();
  const [ex, setEx] = useState<ExecutivoResposta | null>(null);
  const [erro, setErro] = useState('');
  const [exPeriodo, setExPeriodo] = useState<ExecutivoResposta | null>(null);
  const [erroPeriodo, setErroPeriodo] = useState('');
  useEffect(() => {
    let vivo = true;
    setErro(''); setEx(null);
    getExecutivo(inicio, periodo.fim, 'consolidado', 'COMPETENCIA', undefined, true)
      .then((r) => { if (vivo) setEx(r); })
      .catch((e) => { if (vivo) setErro(mensagemDoErro(e)); });
    return () => { vivo = false; };
  }, [inicio, periodo.fim]);
  const esperaPeriodo = !recusa && (intervalo.inicio !== inicio || intervalo.fim !== periodo.fim);
  useEffect(() => {
    setErroPeriodo(''); setExPeriodo(null);
    if (!esperaPeriodo) return undefined;
    let vivo = true;
    getExecutivo(intervalo.inicio, intervalo.fim, 'consolidado', 'COMPETENCIA', undefined, true)
      .then((r) => { if (vivo) setExPeriodo(r); })
      .catch((e) => { if (vivo) setErroPeriodo(mensagemDoErro(e)); });
    return () => { vivo = false; };
  }, [esperaPeriodo, intervalo.inicio, intervalo.fim]);
  const par = intervaloDoPar(intervalo.fim);
  const chaveDoPar = `${par.inicio}..${par.fim}`;
  const [doMesLido, setDoMes] = useState<{ par: string; r: ExecutivoResposta | { erro: string } } | null>(null);
  const [indicadoresLidos, setIndicadores] = useState<{ par: string; r: IndicadoresDaProducaoResposta | { erro: string } } | null>(null);
  const [custosLidos, setCustos] = useState<{ par: string; r: CustosDaProducaoResposta | { erro: string } } | null>(null);
  useEffect(() => {
    setDoMes(null); setIndicadores(null); setCustos(null);
    if (recusa) return undefined;
    let vivo = true;
    getCustosDaProducao(par.inicio, par.fim)
      .then((r) => { if (vivo) setCustos({ par: chaveDoPar, r }); })
      .catch((e) => { if (vivo) setCustos({ par: chaveDoPar, r: { erro: mensagemDoErro(e) } }); });
    getExecutivo(par.inicio, par.fim, 'consolidado', 'COMPETENCIA')
      .then((r) => { if (vivo) setDoMes({ par: chaveDoPar, r }); })
      .catch((e) => { if (vivo) setDoMes({ par: chaveDoPar, r: { erro: mensagemDoErro(e) } }); });
    getIndicadoresDaProducao(par.inicio, par.fim)
      .then((r) => { if (vivo) setIndicadores({ par: chaveDoPar, r }); })
      .catch((e) => { if (vivo) setIndicadores({ par: chaveDoPar, r: { erro: mensagemDoErro(e) } }); });
    return () => { vivo = false; };
  }, [par.inicio, par.fim, chaveDoPar, recusa]);
  const doMes = doMesLido?.par === chaveDoPar ? doMesLido.r : null;
  const indicadores = indicadoresLidos?.par === chaveDoPar ? indicadoresLidos.r : null;
  const custos = custosLidos?.par === chaveDoPar ? custosLidos.r : null;
  const doAno = ex && ex.periodo.inicio === inicio && ex.periodo.fim === periodo.fim ? ex : null;
  const doPeriodo = exPeriodo && exPeriodo.periodo.inicio === intervalo.inicio && exPeriodo.periodo.fim === intervalo.fim ? exPeriodo : null;
  const pronto = doAno && (!esperaPeriodo || doPeriodo) ? { ex: doAno, exPeriodo: escopo === 'YTD' ? null : esperaPeriodo ? doPeriodo : doAno, escopo } : null;
  const [mostrado, setMostrado] = useState(pronto);
  if (pronto && (pronto.ex !== mostrado?.ex || pronto.exPeriodo !== mostrado?.exPeriodo || pronto.escopo !== mostrado?.escopo)) setMostrado(pronto);
  const tela = pronto ?? mostrado;
  if (recusa) return <>{filtro}<div className="empty">{recusa}</div></>;
  if (erro || (esperaPeriodo && erroPeriodo)) {
    return <>{filtro}<Panel title="Consolidado" tag="[COMPETÊNCIA]"><div className="empty">Consolidado indisponível ({erro || erroPeriodo}).</div></Panel></>;
  }
  if (!tela) return <>{filtro}<CardsDoAnoCarregando rotulo="Consolidado" /></>;
  return (
    <>
      {filtro}
      {!pronto && <p className="aviso-carregando" role="status">Carregando {rotuloDoPeriodo(intervalo)}… Os números abaixo ainda são do período anterior.</p>}
      <div className={pronto ? undefined : 'tela-desatualizada'} aria-busy={!pronto}>
        <AcumuladoExecutivo ex={tela.ex} exPeriodo={tela.exPeriodo} escopo={tela.escopo} doMes={doMes} indicadores={indicadores} custos={custos} mesBuscado={intervalo.fim.slice(0, 7)} />
      </div>
    </>
  );
}

function AcumuladoDoAno({ regime }: { regime: Regime }) {
  const { recente, recenteErro } = usePeriodo();
  const [ex, setEx] = useState<ExecutivoResposta | null>(null);
  const [erro, setErro] = useState('');
  const [aberto, setAberto] = useState<AlvoComposicao | null>(null);
  const inicio = recente ? `${recente.ano}-01-01` : null;
  const fim = recente ? periodoDoMes(recente.ano, recente.mes - 1).fim : null;
  useEffect(() => {
    if (!inicio || !fim) return undefined;
    let vivo = true;
    setErro(''); setEx(null); setAberto(null);
    getExecutivo(inicio, fim, 'consolidado', regime)
      .then((r) => { if (vivo) setEx(r); })
      .catch((e) => { if (vivo) setErro(mensagemDoErro(e)); });
    return () => { vivo = false; };
  }, [inicio, fim, regime]);
  const tag = etiquetaDoRegime(regime);
  if (recenteErro) {
    return <Panel title="Consolidado do Ano" tag={tag}><div className="empty">Não foi possível ler o último mês apurado ({recenteErro}).</div></Panel>;
  }
  if (!recente || !inicio || !fim) {
    return <Panel title="Consolidado do Ano" tag={tag}><div className="empty">Sem mês apurado na base nova ainda.</div></Panel>;
  }
  if (erro) return <Panel title="Consolidado do Ano" tag={tag}><div className="empty">Consolidado indisponível ({erro}).</div></Panel>;
  if (!ex) return <Panel title="Consolidado do Ano" tag={tag}><div className="loading">Consolidando o ano…</div></Panel>;
  return <ConsolidadoDoAno ex={ex} rotuloPeriodo={rotuloDeJanAte(recente)} aberto={aberto} onAbrir={(alvo) => setAberto((a) => proximoAberto(a, alvo))} />;
}

export function VisaoExecutiva({ ex, rotulo, evolucao, erroEvolucao, abertoInicial = null, semVolume = false }: {
  ex: ExecutivoResposta; rotulo: string;
  evolucao?: ExecutivoResposta | null;
  erroEvolucao?: string;
  abertoInicial?: AlvoComposicao | null;
  semVolume?: boolean;
}) {
  const [aberto, setAberto] = useState<AlvoComposicao | null>(abertoInicial);
  const abrir = (alvo: AlvoComposicao) => setAberto((a) => proximoAberto(a, alvo));
  const painelEvolucao = erroEvolucao ? (
    <Panel title="Evolução mensal" tag={ex.etiqueta}><div className="empty">Evolução indisponível ({erroEvolucao}).</div></Panel>
  ) : evolucao ? (
    <EvolucaoMensal id="evolucao-mensal" serie={evolucao.serie_mensal} mesesSemFato={evolucao.meses_sem_fato} folhaPendente={evolucao.folha_pendente} etiqueta={evolucao.etiqueta}
      titulo={`Evolução mensal: 12 meses até ${rotuloDoMesFinal(evolucao)}`}
      sub="Receita, custos, despesas e resultado operacional de cada mês, com o ponto de equilíbrio do mês e a variação contra o mês anterior." />
  ) : null;
  const painelPorNegocio = evolucao && !erroEvolucao ? (
    <EvolucaoPorAtividade id="evolucao-por-negocio"
      atividades={evolucao.atividades.filter((a) => a.serie_mensal != null && temMovimento(a))}
      mesesSemFato={evolucao.meses_sem_fato} etiqueta={evolucao.etiqueta}
      titulo={`Resultado por negócio, mês a mês: 12 meses até ${rotuloDoMesFinal(evolucao)}`} />
  ) : null;
  if (semLancamentos(ex)) {
    return (
      <>
        <div className="empty">
          Sem apuração no período: nenhum mês dele tem fato gravado (mês até o último movimento carregado: o motor recusou
          o mês, falta o peso de vendas; mês depois dele: sem dado). Último movimento carregado: {ex.ultimo_lancamento ? dataBr(ex.ultimo_lancamento) : '—'}
        </div>
        {painelEvolucao}
        {painelPorNegocio}
      </>
    );
  }
  const composicao = aberto && (
    <Composicao titulo={tituloDoAlvo(ex, aberto)} rotuloPeriodo={rotulo} etiqueta={ex.etiqueta} regime={ex.regime}
      blocos={blocosDaComposicao(ex, aberto)} periodo={{ inicio: ex.periodo.inicio, fim: ex.periodo.fim }} visao={ex.visao}
      atividade={aberto.tipo === 'atividade' ? aberto.chave : null} onFechar={() => setAberto(null)} />
  );
  return (
    <>
      {ex.avisos.map((a, i) => <p key={i} className="obs-tela">⚠ {avisoParaTela(a)}</p>)}
      <SecaoAconteceu ex={ex} titulo={`O que aconteceu: ${rotulo}`} onAbrir={abrir} />
      {aberto?.tipo === 'bloco' && composicao}
      {painelEvolucao}
      {painelPorNegocio}
      <SecaoObjetivos ex={ex} />
      <SecaoAtividades ex={ex} onAbrir={abrir} />
      {aberto?.tipo === 'atividade' && composicao}
      <details className="detalhamento-da-gestao">
        <summary>Ver detalhamento</summary>
        <SecaoMixECaminhos ex={ex} />
        <SecaoAlavancas ex={ex} />
        {semVolume ? <SecaoComposicao ex={ex} /> : (
          <div className="row r-2-1">
            <SecaoVolume ex={ex} />
            <SecaoComposicao ex={ex} />
          </div>
        )}
      </details>
    </>
  );
}

export type Escopo = 'MES' | 'YTD' | '12M';

export function intervaloDoEscopo(escopo: Escopo, periodo: { inicio: string; fim: string }) {
  if (escopo === 'MES') return { inicio: periodo.inicio, fim: periodo.fim };
  const fimAno = Number(periodo.fim.slice(0, 4));
  const fimMes0 = Number(periodo.fim.slice(5, 7)) - 1;
  if (escopo === 'YTD') return { inicio: periodoDoMes(fimAno, 0).inicio, fim: periodo.fim };
  const idx = fimMes0 - 11;
  const ano = fimAno + Math.floor(idx / 12);
  const mes0 = ((idx % 12) + 12) % 12;
  return { inicio: periodoDoMes(ano, mes0).inicio, fim: periodo.fim };
}

export function rotuloDoEscopo(escopo: Escopo, periodo: { fim: string; rotulo: string }) {
  if (escopo === 'MES') return periodo.rotulo;
  if (escopo === 'YTD') return `YTD ${periodo.fim.slice(0, 4)}`;
  const fimAno = Number(periodo.fim.slice(0, 4));
  const fimMes0 = Number(periodo.fim.slice(5, 7)) - 1;
  return `12M até ${periodoDoMes(fimAno, fimMes0).rotulo}`;
}

export const ROTULO_BOTAO_ESCOPO: Record<Escopo, string> = { MES: 'MÊS', YTD: 'YTD', '12M': '12M' };
export const ESCOPOS: Escopo[] = ['MES', 'YTD', '12M'];

export function CorpoExecutivo({ visao, regime = 'COMPETENCIA', semVolume = false }: {
  visao: VisaoNova; regime?: Regime; semVolume?: boolean;
}) {
  const { periodo } = usePeriodo();
  const [escopo, setEscopo] = useState<Escopo>('MES');
  const intervalo = intervaloDoEscopo(escopo, periodo);
  const rotuloEscopo = rotuloDoEscopo(escopo, periodo);
  const [ex, setEx] = useState<ExecutivoResposta | null>(null);
  const [erroEx, setErroEx] = useState('');
  const [evolucao, setEvolucao] = useState<ExecutivoResposta | null>(null);
  const [erroEvolucao, setErroEvolucao] = useState('');

  useEffect(() => {
    let vivo = true;
    setErroEx(''); setEx(null);
    getExecutivo(intervalo.inicio, intervalo.fim, visao, regime)
      .then((r) => { if (vivo) setEx(r); })
      .catch((e) => { if (vivo) setErroEx(mensagemDoErro(e)); });
    return () => { vivo = false; };
  }, [intervalo.inicio, intervalo.fim, visao, regime]);

  const janela12 = intervaloDoEscopo('12M', periodo);
  const mesmaJanela = intervalo.inicio === janela12.inicio && intervalo.fim === janela12.fim;
  useEffect(() => {
    setEvolucao(null); setErroEvolucao('');
    if (mesmaJanela) return undefined;
    let vivo = true;
    getExecutivo(janela12.inicio, janela12.fim, visao, regime)
      .then((r) => { if (vivo) setEvolucao(r); })
      .catch((e) => { if (vivo) setErroEvolucao(mensagemDoErro(e)); });
    return () => { vivo = false; };
  }, [janela12.inicio, janela12.fim, visao, mesmaJanela, regime]);

  return (
    <>
      <div className="tabs">
        {ESCOPOS.map((op) => (
          <button key={op} className={`tab ${escopo === op ? 'active' : ''}`}
            onClick={() => setEscopo(op)}>{ROTULO_BOTAO_ESCOPO[op]}</button>
        ))}
      </div>
      {erroEx ? (
        <div className="empty">Visão executiva indisponível ({erroEx}).</div>
      ) : !ex ? (
        <div className="loading">Apurando {regime === 'CAIXA' ? 'o caixa' : 'a competência'} de {rotuloEscopo}…</div>
      ) : (
        <VisaoExecutiva ex={ex} rotulo={rotuloEscopo} evolucao={mesmaJanela ? ex : evolucao} erroEvolucao={erroEvolucao} semVolume={semVolume} />
      )}
    </>
  );
}

export function Dashboard({ regime = 'COMPETENCIA' }: { regime?: Regime } = {}) {
  if (regime === 'CAIXA') {
    return (
      <>
        <AcumuladoDoAno regime={regime} />
        <CorpoExecutivo visao="consolidado" regime={regime} />
      </>
    );
  }
  return <VisaoExecutivaAcumulada />;
}
