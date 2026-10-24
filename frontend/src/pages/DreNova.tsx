import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { brl, dataBr, fmMoeda } from '../api/client';
import { DEFINICOES } from '../api/definicoes';
import {
  ehRollUp, faixaDeIncompletude, getDreNova, getDreNovaCompetencias, linhasComMovimento,
  linhasVisiveis, nomeDaLinhaFora, semValorPublicavel, valorExibido,
  type BudgetDaLinha, type DreNovaCompetencia, type DreNovaIndicadores, type DreNovaLinha,
  type DreNovaResposta, type VisaoNova,
} from '../api/dreNova';
import {
  getExecutivo, getLancamentosDaLinha, getPendenciasDeClassificacao, type ExecutivoResposta, type LinhaDaPendencia, type MesProvisorio,
  type MotivoDaPendencia, type PendenciasDeClassificacaoResposta,
} from '../api/gerencial';
import { PERGUNTAS } from '../api/perguntasGerenciais';
import { useAuth } from '../auth';
import { centavosOuTraco, notaDoBudget, pctDoDesvio, StatusDoBudget } from '../components/budgetNaTela';
import { descartarFiltroDaDre, lerFiltroDaDre, type BlocoDaDre, type EscopoDaDre, type FiltroDaDre, type IndicadorDaDre, type LinhaDaDre } from '../components/abrirNaDre';
import { TabelaDeLancamentos, useLancamentosPorLinha, type EstadoDaLinha } from '../components/Composicao';
import { AvisoDaFolha, seloSemOJaDito } from '../components/AvisoDaFolha';
import { BotaoExportar } from '../components/BotaoExportar';
import { rotuloDoMes } from '../api/alertas';
import { rotuloDoPeriodo } from '../components/EscadaDoAno';
import { EscadaMensal, subMensal } from '../components/EscadaMensal';
import { Panel, periodoDoMes, Pill, SeloRegime } from '../components/ui';
import { SecaoComposicao } from './Dashboard';

const ABAS: Array<{ v: VisaoNova; rotulo: string }> = [
  { v: 'consolidado', rotulo: 'Consolidado' },
  { v: 'producao', rotulo: 'Produção' },
  { v: 'revenda', rotulo: 'Revenda' },
];

function abasDoRole(role: string | null): VisaoNova[] {
  if (role?.startsWith('PRODUCAO')) return ['producao'];
  if (role === 'REVENDA') return ['revenda'];
  return ['consolidado', 'producao', 'revenda'];
}

const lancamentosForaDaDre: typeof getLancamentosDaLinha = (p) => getLancamentosDaLinha({ ...p, fora: 1 });

export const mensagemDeErro = (e: unknown): string => {
  const r = (e as { response?: { data?: { erro?: string; comando?: string } } })?.response?.data;
  if (r?.erro) return r.comando ? `${r.erro}\n\nPara liberar: ${r.comando}` : r.erro;
  return (e as Error)?.message ?? 'Erro desconhecido.';
};

export function FaixaIncompletude({ d, vendo = false, aoVerLancamentos }: {
  d: DreNovaResposta; vendo?: boolean; aoVerLancamentos?: () => void;
}) {
  const itens = useMemo(() => faixaDeIncompletude(d), [d]);
  if (itens.length === 0) return null;
  const temFora = d.reconciliacao.fora.length > 0;
  const temDefeito = itens.some((i) => i.gravidade === 'defeito');
  return (
    <div className={`alert-banner ${temDefeito ? '' : 'media'}`}>
      <div>
        <b>{temDefeito ? '⚠ Esta apuração tem defeito' : '⚠ Esta DRE ainda não está completa'}</b>
        <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
          {itens.map((i, n) => (
            <li key={`${i.chave}-${n}`}>
              {i.valor != null && <b>{brl(i.valor)}</b>}
              {i.linhas?.length
                ? ` em ${i.linhas.slice(0, 3).join(', ')}${i.linhas.length > 3 ? ` e mais ${i.linhas.length - 3} linha(s)` : ''}. `
                : i.valor != null ? ': ' : ''}
              {i.texto}
            </li>
          ))}
        </ul>
        {temFora && aoVerLancamentos && (
          <button type="button" className="btn" style={{ marginTop: 8 }} aria-expanded={vendo} onClick={aoVerLancamentos}>
            {vendo ? 'Esconder lançamentos' : 'Ver lançamentos'}
          </button>
        )}
      </div>
    </div>
  );
}

export function LancamentosForaDaDre({ d, abertas }: { d: DreNovaResposta; abertas: Record<string, EstadoDaLinha> }) {
  const linhas = d.reconciliacao.fora.flatMap((b) => b.linhas);
  return (
    <Panel title="Lançamentos fora desta DRE" sub="O documento é o título do ERP (número e parcela), para achar o lançamento lá.">
      {linhas.map((l) => (
        <div key={l.linha_id} style={{ marginBottom: 12 }}>
          <b>{nomeDaLinhaFora(l)}</b>: {brl(l.valor)}
          {abertas[String(l.linha_id)] && <TabelaDeLancamentos estado={abertas[String(l.linha_id)]} />}
        </div>
      ))}
    </Panel>
  );
}

const ondeDaPendencia = (motivo: MotivoDaPendencia, linha: LinhaDaPendencia | null) => (motivo === 'LINHA_SEM_LUGAR'
  ? `ligada à linha ${[linha?.codigo_oficial, linha?.rotulo].filter(Boolean).join(' ') || 'sem nome'}, sem lugar em nenhuma DRE`
  : motivo === 'SEM_PESO_DE_VENDAS' ? 'conta de vendas sem peso de rateio no mês'
    : motivo === 'PESO_ZERO_DE_VENDAS' ? 'conta de vendas com peso zero em todos os destinos no mês' : 'sem correspondência no plano gerencial');
const SITUACAO_DA_PENDENCIA: Record<MotivoDaPendencia, string> = {
  SEM_CORRESPONDENCIA: 'Sem correspondência', SEM_PESO_DE_VENDAS: 'Sem peso de vendas', PESO_ZERO_DE_VENDAS: 'Peso de vendas zero',
  LINHA_SEM_LUGAR: 'Linha sem lugar',
};

export function PendenciasDeClassificacao({ inicio, fim }: { inicio: string; fim: string }) {
  const [r, setR] = useState<PendenciasDeClassificacaoResposta | { erro: string } | null>(null);
  const [vendo, setVendo] = useState(false);
  useEffect(() => {
    if (!inicio || !fim) return;
    let vivo = true;
    setR(null); setVendo(false);
    getPendenciasDeClassificacao(inicio, fim)
      .then((x) => { if (vivo) setR(x); })
      .catch((e) => { if (vivo) setR({ erro: mensagemDeErro(e) }); });
    return () => { vivo = false; };
  }, [inicio, fim]);
  if (r == null) return null;
  if ('erro' in r) return <p className="obs-tela">⚠ Não foi possível conferir os lançamentos sem classificação ({r.erro}).</p>;
  if (r.quantidade === 0) return null;
  return (
    <>
      <div className="alert-banner media">
        <div>
          <b>⚠ {r.quantidade} lançamento(s) sem classificação, fora da DRE na competência ou no caixa: {brl(r.total)}</b>
          <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
            {r.por_conta.map((c) => (
              <li key={`${c.empresa}|${c.codigo_conta}|${c.motivo}|${c.linha?.linha_id ?? ''}`}>
                {c.empresa} {c.codigo_conta}: <b>{brl(c.valor)}</b> em {c.quantidade} lançamento(s), {ondeDaPendencia(c.motivo, c.linha)}.
              </li>
            ))}
          </ul>
          <div style={{ marginTop: 6 }}>O mês não fecha enquanto houver lançamento aqui. Para resolver, classifique o título no ERP e peça a recarga do mês inteiro, ou peça a inclusão da conta no plano gerencial.{r.por_conta.some((c) => c.motivo === 'SEM_PESO_DE_VENDAS') && ' Conta de vendas sem peso: falta carregar o relatório de vendas por produto do mês.'}{r.por_conta.some((c) => c.motivo === 'PESO_ZERO_DE_VENDAS') && ' Conta de vendas com peso zero: o relatório de vendas por produto do mês veio sem venda nos destinos dela; confira o relatório antes de pedir a recarga.'}</div>
          <button type="button" className="btn" style={{ marginTop: 8 }} aria-expanded={vendo} onClick={() => setVendo(!vendo)}>
            {vendo ? 'Esconder lançamentos' : 'Ver lançamentos'}
          </button>
        </div>
      </div>
      {vendo && (
        <Panel title="Lançamentos sem classificação" sub={`De ${dataBr(r.periodo.inicio)} a ${dataBr(r.periodo.fim)}, pela competência ou pelo pagamento (o fechamento confere os dois). O título é o documento do ERP (número e parcela).`}>
          <div className="tbl-scroll">
            <table className="tbl">
              <thead>
                <tr><th>Empresa</th><th>Conta</th><th>Título</th><th>Competência</th><th>Pagamento</th><th className="num">Valor</th><th>Situação</th><th>Histórico</th></tr>
              </thead>
              <tbody>
                {r.lancamentos.map((l) => (
                  <tr key={l.lancamento_id}>
                    <td>{l.empresa}</td><td>{l.codigo_conta}</td><td>{l.documento ?? '—'}</td>
                    <td>{dataBr(l.data_competencia) || '—'}</td><td>{dataBr(l.data_liquidacao) || '—'}</td>
                    <td className={`num ${l.valor < 0 ? 'neg' : ''}`}>{brl(l.valor)}</td>
                    <td>{SITUACAO_DA_PENDENCIA[l.motivo]}</td>
                    <td>{l.historico ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </>
  );
}

function Conferencia({ d }: { d: DreNovaResposta }) {
  const r = d.reconciliacao;
  return (
    <Panel
      title="Conferência"
      tag={r.confere ? 'fecha' : 'NÃO FECHA'}
      sub={`total da visão = soma das linhas exibidas + o que ficou fora · diferença ${fmMoeda(r.diferenca)} (tolerância ${r.tolerancia})`}
    >
      <details>
        <summary>Ver reconciliação e avisos</summary>
        <table className="tbl" style={{ marginTop: 10 }}>
          <tbody>
            <tr><td>Total das fatias da visão</td><td className="num">{fmMoeda(r.total_fatias_da_visao)}</td><td className="num">{r.quantidade_fatias_da_visao} fatia(s)</td></tr>
            <tr><td>Soma das linhas exibidas</td><td className="num">{fmMoeda(r.soma_linhas_exibidas)}</td><td className="num">{r.quantidade_fatias_exibidas} fatia(s)</td></tr>
            <tr><td>Ficou de fora</td><td className="num">{fmMoeda(r.total_fora)}</td><td className="num">{r.quantidade_fatias_fora} fatia(s)</td></tr>
            <tr>
              <td>Leitura completa</td>
              <td className="num">
                {r.leitura_completa.confere === true ? <Pill tone="ok">sim</Pill> : <Pill tone="bad">NÃO</Pill>}
              </td>
              <td className="num">{r.leitura_completa.fatias_carregadas} de {r.leitura_completa.fatias_na_tabela ?? '?'}</td>
            </tr>
          </tbody>
        </table>

        {r.fora.map((b) => (
          <div key={b.motivo} style={{ marginTop: 12 }}>
            <b>{b.rotulo ?? b.motivo}</b>: {fmMoeda(b.valor)} em {b.quantidade_fatias} fatia(s)
            <div className="sub">{b.descricao}</div>
            <table className="tbl">
              <thead><tr><th>Código</th><th>Linha</th><th className="num">Fatias</th><th className="num">Valor</th></tr></thead>
              <tbody>
                {b.linhas.map((l) => (
                  <tr key={l.linha_id}>
                    <td>{l.codigo_oficial ?? '—'}</td>
                    <td>{l.rotulo ?? '—'}</td>
                    <td className="num">{l.quantidade_fatias}</td>
                    <td className={`num ${l.valor < 0 ? 'neg' : ''}`}>{fmMoeda(l.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

        <div className="obs-tela" style={{ marginTop: 12 }}>
          <b>Como ler esta DRE</b>
          <ul style={{ paddingLeft: 18 }}>{d.avisos.map((a, i) => <li key={i}>{a}</li>)}</ul>
          <div>{d.cadeia_de_totais.motivo}</div>
        </div>
      </details>
    </Panel>
  );
}

export const totalDaLinha = (l: Pick<DreNovaLinha, 'tipo' | 'codigo'>): string | null => {
  if (l.tipo !== 'TOTAL') return null;
  const m = /^total-(t\d+)$/i.exec(String(l.codigo ?? '').trim());
  return m ? m[1].toUpperCase() : null;
};

const LIMITES_DO_BLOCO: Record<BlocoDaDre, [string, string]> = { CUSTOS: ['T01', 'T02'], DESPESAS: ['T02', 'T03'] };

export function linhasDoBloco(linhas: Pick<DreNovaLinha, 'linha_id' | 'tipo' | 'codigo' | 'profundidade'>[], bloco: BlocoDaDre): number[] {
  const [de, ate] = LIMITES_DO_BLOCO[bloco];
  const i = linhas.findIndex((l) => totalDaLinha(l) === de);
  const j = linhas.findIndex((l) => totalDaLinha(l) === ate);
  if (i < 0 || j <= i) return [];
  return linhas.slice(i + 1, j).filter((l) => l.tipo !== 'TOTAL' && (l.profundidade ?? 1) === 1).map((l) => l.linha_id);
}

export const abreLancamentos = (l: Pick<DreNovaLinha, 'tipo' | 'tem_fato'>) => l.tipo === 'CONTA' && Boolean(l.tem_fato);

export function Linha({ l, comColunas, comBudget = false, budget, comMovimento, recolhida, aoAlternar, destacada = false, lancamentos, aoAbrirLancamentos }: {
  l: DreNovaLinha;
  comColunas: boolean;
  comBudget?: boolean;
  budget?: BudgetDaLinha | null;
  comMovimento: ReadonlySet<number>;
  recolhida: boolean;
  aoAlternar: (id: number) => void;
  destacada?: boolean;
  lancamentos?: EstadoDaLinha;
  aoAbrirLancamentos?: () => void;
}) {
  const v = valorExibido(l);
  const grupo = l.tipo === 'GRUPO' || l.tipo === 'SUBGRUPO';
  const prof = l.profundidade ?? 1;
  const col = ehRollUp(l) ? l.colunas_acumuladas : l.colunas;
  const semValor = semValorPublicavel(l);
  const cel = (n: number) => (semValor ? '—' : fmMoeda(n));
  const dim = comMovimento.has(l.linha_id) ? '' : 'dim';
  const dimDoBudget = budget ? '' : dim;

  const total = totalDaLinha(l);
  return (
    <Fragment>
    <tr className={`${grupo ? 'ln-grupo' : ''}${destacada ? ' ln-destaque' : ''}`} id={total ? `dre-linha-${total}` : undefined}
      data-linha-id={l.linha_id}
      style={destacada ? { outline: '2px solid var(--accent, #c9a227)' } : undefined}>
      <td className={`rotulo ${dim}`} style={{ paddingLeft: 10 + (prof - 1) * 16 }} title={l.celula_origem ?? undefined}>
        {grupo ? (
          <button className="gr-toggle" onClick={() => aoAlternar(l.linha_id)}
            title={recolhida ? 'Expandir' : 'Recolher'}>
            <span className="gr-caret">{recolhida ? '▸' : '▾'}</span>{l.rotulo}
          </button>
        ) : aoAbrirLancamentos && abreLancamentos(l) ? (
          <button type="button" className="gr-toggle" aria-expanded={lancamentos != null} onClick={aoAbrirLancamentos}
            title="Ver os lançamentos do ERP desta linha">{l.rotulo}</button>
        ) : l.rotulo}
      </td>
      {comColunas && (
        <>
          <td className={`num ${dim} ${!semValor && (col?.cogumelo ?? 0) < 0 ? 'neg' : ''}`}>{cel(col?.cogumelo ?? 0)}</td>
          <td className={`num ${dim} ${!semValor && (col?.pimentao ?? 0) < 0 ? 'neg' : ''}`}>{cel(col?.pimentao ?? 0)}</td>
          <td className={`num ${dim} ${!semValor && (col?.sem_divisao ?? 0) < 0 ? 'neg' : ''}`}>{cel(col?.sem_divisao ?? 0)}</td>
        </>
      )}
      <td className={`num total ${dim} ${!semValor && v < 0 ? 'neg' : ''}`}>{cel(v)}</td>
      {comBudget && (
        <>
          <td className={`num ${dimDoBudget} ${(budget?.budget_cent ?? 0) < 0 ? 'neg' : ''}`}>{centavosOuTraco(budget?.budget_cent)}</td>
          <td className={`num ${dimDoBudget} ${(budget?.desvio_cent ?? 0) < 0 ? 'neg' : ''}`}>{centavosOuTraco(budget?.desvio_cent)}</td>
          <td className={`num ${dimDoBudget}`}>{pctDoDesvio(budget)}</td>
          <td className={dimDoBudget}><StatusDoBudget b={budget} /></td>
        </>
      )}
    </tr>
    {lancamentos && (
      <tr><td colSpan={2 + (comColunas ? 3 : 0) + (comBudget ? 4 : 0)}><div style={{ width: 0, minWidth: '100%' }}><TabelaDeLancamentos estado={lancamentos} /></div></td></tr>
    )}
    </Fragment>
  );
}

export function PainelIndicadores({ ind, comPe = false }: { ind: DreNovaIndicadores; comPe?: boolean }) {
  const fmCentavos = (c: number | null) => (c === null ? '—' : fmMoeda(c / 100));
  const perc = (p: number | null) => (p === null ? '—' : `${p.toLocaleString('pt-BR', {
    minimumFractionDigits: 1, maximumFractionDigits: 1,
  })}%`);

  return (
    <Panel title="Indicadores" sub={ind.disponivel ? undefined : 'parciais'}>
      {!ind.disponivel && ind.motivo && (
        <div className="alert-banner media">
          <div>
            <b>Indicadores parciais</b>
            <div>{ind.motivo}</div>
          </div>
        </div>
      )}
      <table className="tbl" style={{ marginTop: 10 }}>
        <tbody>
          <tr><td className="rotulo">Margem de Contribuição</td>
            <td className={`num${(ind.margem_contribuicao ?? 0) < 0 ? ' neg' : ''}`}>{fmCentavos(ind.margem_contribuicao)}</td></tr>
          <tr><td className="rotulo">Margem de Contribuição %</td>
            <td className="num">{perc(ind.margem_contribuicao_pct)}</td></tr>
          {comPe && (
            <>
              <tr className="ln-destaque" id="dre-linha-PE"><td className="rotulo">{DEFINICOES.ponto_equilibrio_mes.nome}</td>
                <td className="num">{fmCentavos(ind.ponto_equilibrio)}</td></tr>
              <tr><td className="rotulo">Custos e despesas fixos</td>
                <td className="num">{fmCentavos(ind.custos_e_despesas_fixos ?? null)}</td></tr>
            </>
          )}
        </tbody>
      </table>
      {comPe && (
        <p className="obs-tela">
          {`${DEFINICOES.ponto_equilibrio_mes.nome} = ${DEFINICOES.ponto_equilibrio_mes.formula}: a receita líquida em que a margem de contribuição paga os fixos do mês.`}
        </p>
      )}
    </Panel>
  );
}

export function ComposicaoDaDre({ competencia, visao, desde }: { competencia: string; visao: VisaoNova; desde?: string }) {
  const [ex, setEx] = useState<ExecutivoResposta | null>(null);
  const [erro, setErro] = useState('');
  const [recorte, setRecorte] = useState<RecorteDaComposicao>('TODA');
  const atividade = visao === 'producao' && recorte !== 'TODA' ? recorte : undefined;
  useEffect(() => {
    if (!competencia) return undefined;
    let vivo = true;
    setErro(''); setEx(null);
    const { inicio, fim } = intervaloDaCompetencia(competencia, desde);
    getExecutivo(inicio, fim, visao, 'COMPETENCIA', atividade)
      .then((r) => { if (vivo) setEx(r); })
      .catch((e) => { if (vivo) setErro(mensagemDeErro(e)); });
    return () => { vivo = false; };
  }, [competencia, visao, desde, atividade]);
  return <ComposicaoDaDreCorpo ex={ex} erro={erro} recorte={visao === 'producao' ? { atual: recorte, aoTrocar: setRecorte } : undefined} />;
}

export type RecorteDaComposicao = 'TODA' | 'PRODUCAO_COGUMELO' | 'PIMENTAO';
export const RECORTES_DA_COMPOSICAO: Array<{ chave: RecorteDaComposicao; rotulo: string }> = [
  { chave: 'TODA', rotulo: 'Toda a produção' },
  { chave: 'PRODUCAO_COGUMELO', rotulo: 'Cogumelo' },
  { chave: 'PIMENTAO', rotulo: 'Pimentão' },
];
export const NOTA_DO_RECORTE = 'Só o que já está atribuído ao produto; o custo que a produção ainda não divide por produto aparece só em Toda a produção.';

export function ComposicaoDaDreCorpo({ ex, erro, recorte }: {
  ex: ExecutivoResposta | null; erro: string;
  recorte?: { atual: RecorteDaComposicao; aoTrocar: (r: RecorteDaComposicao) => void };
}) {
  const filtro = recorte && (
    <>
      <div className="tabs" aria-label="Recorte da Composição dos Custos">
        {RECORTES_DA_COMPOSICAO.map((r) => (
          <button key={r.chave} type="button" className={`tab ${recorte.atual === r.chave ? 'active' : ''}`} aria-pressed={recorte.atual === r.chave}
            onClick={() => recorte.aoTrocar(r.chave)}>{r.rotulo}</button>
        ))}
      </div>
      {recorte.atual !== 'TODA' && <p className="obs-tela">{NOTA_DO_RECORTE}</p>}
    </>
  );
  if (erro) return <Panel title="Composição dos Custos">{filtro}<div className="empty">Composição indisponível ({erro}).</div></Panel>;
  if (!ex) return <Panel title="Composição dos Custos">{filtro}<div className="loading">Carregando a composição…</div></Panel>;
  return <SecaoComposicao ex={ex} pergunta={PERGUNTAS.composicao_custos} topo={filtro} />;
}

export const SUB_DO_MES = 'Só o mês escolhido no topo. Para ver de janeiro até ele, mês a mês e com o acumulado, escolha YTD.';

export function EvolucaoMensalDaDre({ competencia, visao, desde, jaDito }: {
  competencia: string; visao: VisaoNova; desde?: string;
  jaDito?: MesProvisorio[];
}) {
  const [ex, setEx] = useState<ExecutivoResposta | null>(null);
  const [erro, setErro] = useState('');
  useEffect(() => {
    if (!competencia) return undefined;
    let vivo = true;
    setErro(''); setEx(null);
    const { inicio, fim } = intervaloDaCompetencia(competencia, desde);
    getExecutivo(inicio, fim, visao, 'COMPETENCIA')
      .then((r) => { if (vivo) setEx(r); })
      .catch((e) => { if (vivo) setErro(mensagemDeErro(e)); });
    return () => { vivo = false; };
  }, [competencia, visao, desde]);
  return <EvolucaoMensalDaDreCorpo ex={ex} erro={erro} soOMes={desde == null} jaDito={jaDito} />;
}

export function EvolucaoMensalDaDreCorpo({ ex, erro, soOMes = false, jaDito }: {
  ex: ExecutivoResposta | null; erro: string; soOMes?: boolean; jaDito?: MesProvisorio[];
}) {
  if (erro) return <Panel title="Evolução Mensal"><div className="empty">Evolução mensal indisponível ({erro}).</div></Panel>;
  if (!ex) return <Panel title="Evolução Mensal"><div className="loading">Carregando a evolução mensal…</div></Panel>;
  const negocio = ABAS.find((a) => a.v === ex.visao)?.rotulo ?? ex.visao;
  return (
    <>
      <AvisoDaFolha pendentes={ex.folha_pendente} provisorios={seloSemOJaDito(ex.meses_provisorios, jaDito)} />
      <EscadaMensal serie={ex.serie_mensal} ytd={ex.escada.total} limiares={ex.limiares_alerta} regime={ex.regime} etiqueta={ex.etiqueta}
        titulo={`Evolução Mensal: ${negocio}, ${rotuloDoPeriodo(ex.periodo)}`} sub={soOMes ? SUB_DO_MES : subMensal(ex.regime)} pergunta={PERGUNTAS.evolucao_mensal}
        lancamentos={{ visao: ex.visao, periodo: ex.periodo }} semYtd={soOMes} folhaPendente={ex.folha_pendente} />
    </>
  );
}

export const intervaloDaCompetencia = (competencia: string, desde?: string) => {
  const { inicio, fim } = periodoDoMes(Number(competencia.slice(0, 4)), Number(competencia.slice(5, 7)) - 1);
  return { inicio: desde ?? inicio, fim };
};

export const desdeDoEscopo = (escopo: EscopoDaDre, competencia: string): string | undefined =>
  (escopo === 'YTD' && competencia ? `${competencia.slice(0, 4)}-01-01` : undefined);

export function avisoDaCompetenciaPedida(filtro: FiltroDaDre | null, aberta: string): string {
  if (!filtro || !aberta || filtro.competencia === aberta) return '';
  const mes = (c: string) => `${c.slice(5, 7)}/${c.slice(0, 4)}`;
  return `O mês pedido (${mes(filtro.competencia)}) não tem apuração; a DRE abriu em ${mes(aberta)}, o mais recente com fato.`;
}

export function competenciaInicial(filtro: FiltroDaDre | null, lista: DreNovaCompetencia[], maisRecente: string | null): string {
  if (filtro && lista.some((c) => c.competencia === filtro.competencia)) return filtro.competencia;
  return maisRecente ?? lista[0]?.competencia ?? '';
}

export function DreNova() {
  const { usuario } = useAuth();
  const abas = useMemo(() => abasDoRole(usuario?.role ?? null), [usuario]);
  const [filtro] = useState<FiltroDaDre | null>(() => lerFiltroDaDre());
  useEffect(() => { descartarFiltroDaDre(); }, []);

  const [visao, setVisao] = useState<VisaoNova>(filtro && abas.includes(filtro.visao) ? filtro.visao : abas[0]);
  const [escopo, setEscopo] = useState<EscopoDaDre>(filtro?.escopo ?? 'MES');
  const [destaque, setDestaque] = useState<LinhaDaDre | BlocoDaDre | IndicadorDaDre | null>(filtro?.linha ?? filtro?.bloco ?? filtro?.indicador ?? null);
  const [contaPedida, setContaPedida] = useState<string | null>(filtro?.conta?.linha_id ?? null);
  const abriuContaRef = useRef(false);
  const [avisoDoRecado, setAvisoDoRecado] = useState('');
  const rolouRef = useRef(false);
  const [competencias, setCompetencias] = useState<DreNovaCompetencia[] | null>(null);
  const [competencia, setCompetencia] = useState<string>('');
  const [dados, setDados] = useState<DreNovaResposta | null>(null);
  const [erro, setErro] = useState('');
  const [recolhidos, setRecolhidos] = useState<Set<number>>(new Set());
  const [ocultarZeradas, setOcultarZeradas] = useState(false);

  useEffect(() => {
    if (!abas.includes(visao)) setVisao(abas[0]);
  }, [abas, visao]);

  useEffect(() => {
    let vivo = true;
    getDreNovaCompetencias()
      .then((r) => {
        if (!vivo) return;
        setCompetencias(r.competencias);
        const inicial = competenciaInicial(filtro, r.competencias, r.mais_recente);
        setCompetencia(inicial);
        setAvisoDoRecado(avisoDaCompetenciaPedida(filtro, inicial));
      })
      .catch((e) => { if (vivo) setErro(mensagemDeErro(e)); });
    return () => { vivo = false; };
  }, []);

  const desde = desdeDoEscopo(escopo, competencia);
  useEffect(() => {
    if (!competencia) return;
    let vivo = true;
    setErro(''); setDados(null);
    getDreNova(competencia, visao, desde)
      .then((d) => { if (vivo) setDados(d); })
      .catch((e) => { if (vivo) setErro(mensagemDeErro(e)); });
    return () => { vivo = false; };
  }, [competencia, visao, desde]);

  const doBloco = useMemo(() => new Set(dados && (destaque === 'CUSTOS' || destaque === 'DESPESAS') ? linhasDoBloco(dados.linhas, destaque) : []),
    [dados, destaque]);

  useEffect(() => {
    if (!dados || !destaque || rolouRef.current) return;
    rolouRef.current = true;
    const alvo = doBloco.size > 0 ? document.querySelector(`tr[data-linha-id="${[...doBloco][0]}"]`) : document.getElementById(`dre-linha-${destaque}`);
    alvo?.scrollIntoView({ block: 'center' });
  }, [dados, destaque, doBloco]);

  const periodoDaDre = competencia ? intervaloDaCompetencia(competencia, desde) : { inicio: '', fim: '' };
  const { abertas, alternar: alternarLancamentos } = useLancamentosPorLinha({ periodo: periodoDaDre, visao, regime: 'COMPETENCIA' });
  const fora = useLancamentosPorLinha({ periodo: periodoDaDre, visao, regime: 'COMPETENCIA', carregar: lancamentosForaDaDre });
  const verFora = Object.keys(fora.abertas).length > 0;
  const podeVerFora = abas.includes('consolidado');
  const alternarFora = () => {
    const abrir = !verFora;
    for (const l of dados?.reconciliacao.fora.flatMap((b) => b.linhas) ?? []) {
      if (Boolean(fora.abertas[String(l.linha_id)]) !== abrir) fora.alternar(String(l.linha_id));
    }
  };

  const contaAusente = !!dados && contaPedida != null && !dados.linhas.some((l) => String(l.linha_id) === contaPedida);
  useEffect(() => {
    if (!dados || contaPedida == null || contaAusente || abriuContaRef.current) return;
    abriuContaRef.current = true;
    document.querySelector(`tr[data-linha-id="${contaPedida}"]`)?.scrollIntoView({ block: 'center' });
    const linhaPedida = dados.linhas.find((l) => String(l.linha_id) === contaPedida);
    if (linhaPedida && abreLancamentos(linhaPedida) && !dados.defeito) alternarLancamentos(contaPedida);
  }, [dados, contaPedida, contaAusente]);

  const alternar = (id: number) =>
    setRecolhidos((prev) => {
      const prox = new Set(prev);
      if (prox.has(id)) prox.delete(id); else prox.add(id);
      return prox;
    });

  const budget = dados?.budget?.estado === 'COMPARADO' ? dados.budget.por_linha ?? {} : null;
  const visiveis = useMemo(
    () => (dados ? linhasVisiveis(dados.linhas, recolhidos, ocultarZeradas, new Set(Object.keys(budget ?? {}))) : []),
    [dados, recolhidos, ocultarZeradas, budget],
  );

  const comMovimento = useMemo(
    () => (dados ? linhasComMovimento(dados.linhas) : new Set<number>()),
    [dados],
  );

  const comColunas = visao === 'producao';

  return (
    <>
      <div className="tabs">
        {ABAS.filter((a) => abas.includes(a.v)).map((a) => (
          <button key={a.v} className={`tab ${visao === a.v ? 'active' : ''}`}
            onClick={() => { setVisao(a.v); setDestaque(null); setContaPedida(null); }}>{a.rotulo}</button>
        ))}
        <span className="tabs-acao" role="group" aria-label="Período da DRE">
          {(['MES', 'YTD'] as const).map((op) => (
            <button key={op} type="button" className={`tab ${escopo === op ? 'active' : ''}`} aria-pressed={escopo === op}
              onClick={() => { setEscopo(op); setDestaque(null); setContaPedida(null); }}>{op === 'MES' ? 'MÊS' : 'YTD'}</button>
          ))}
        </span>
        <span className="tabs-acao">
          <select className="cls-select" value={competencia}
            onChange={(e) => { setCompetencia(e.target.value); setDestaque(null); setContaPedida(null); setAvisoDoRecado(''); }}
            disabled={!competencias?.length}>
            {(competencias ?? []).map((c) => (
              <option key={c.competencia} value={c.competencia}>{rotuloDoMes(c.competencia.slice(0, 7))}</option>
            ))}
          </select>
        </span>
      </div>
      <div className="dre-exportar">
        {abas.length === 3 && (
          <BotaoExportar rotulo="Exportar as 3 visões" />
        )}
        <BotaoExportar />
      </div>

      {erro && <div className="empty" style={{ whiteSpace: 'pre-wrap' }}>{erro}</div>}
      {!erro && !dados && <div className="loading">Carregando a DRE…</div>}

      {avisoDoRecado && <p className="obs-tela">⚠ {avisoDoRecado}</p>}
      {contaAusente && (
        <p className="obs-tela">⚠ A conta pedida{filtro?.conta?.codigo_oficial ? ` (${filtro.conta.codigo_oficial})` : ''} não aparece nesta visão e competência da DRE.</p>
      )}
      {dados && (
        <div className="plan-stack">
          <AvisoDaFolha provisorios={dados.meses_provisorios} />
          <FaixaIncompletude d={dados} vendo={verFora} aoVerLancamentos={podeVerFora ? alternarFora : undefined} />
          {verFora && <LancamentosForaDaDre d={dados} abertas={fora.abertas} />}
          {usuario?.role === 'GESTAO_GERAL' && <PendenciasDeClassificacao inicio={periodoDaDre.inicio} fim={periodoDaDre.fim} />}

          {dados.defeito ? (
            <Panel title="Apuração não apresentada" sub="A API sinalizou defeito nesta resposta.">
              <ul style={{ paddingLeft: 18 }}>{dados.defeitos.map((x, i) => <li key={i}>{x}</li>)}</ul>
            </Panel>
          ) : (
            <>
              <PainelIndicadores ind={dados.indicadores} comPe={destaque === 'PE'} />

              <Panel
                title={`DRE ${ABAS.find((a) => a.v === visao)?.rotulo}`}
                tag={`${rotuloDoPeriodo(dados.periodo ?? intervaloDaCompetencia(dados.competencia))}${dados.meses_provisorios?.length ? ': Provisório' : ''}`}
                sub={`${dados.quantidade_linhas_com_fato} de ${dados.quantidade_linhas} linhas com movimento`}
              >
                <SeloRegime regime={dados.regime} />
                <label style={{ display: 'block', marginBottom: 8, fontSize: 12 }}>
                  <input type="checkbox" checked={ocultarZeradas}
                    onChange={(e) => setOcultarZeradas(e.target.checked)} />
                  {' '}ocultar linhas sem movimento
                </label>
                {dados.budget && <p className="obs-tela">{notaDoBudget(dados.budget)}</p>}
                <div className="plan-wrap cp">
                  <table className="plan cp">
                    <thead>
                      <tr>
                        <th className="rotulo">Linha</th>
                        {comColunas && <><th className="num">Cogumelo</th><th className="num">Pimentão</th><th className="num">Sem divisão</th></>}
                        <th className="num total">Valor</th>
                        {budget && <><th className="num">Budget</th><th className="num">Dif. R$</th><th className="num">Dif. %</th><th>Status</th></>}
                      </tr>
                    </thead>
                    <tbody>
                      {visiveis.map((l) => (
                        <Linha key={`${l.linha_id}-${l.ordem}`} l={l} comColunas={comColunas}
                          comBudget={budget != null} budget={budget?.[String(l.linha_id)]}
                          comMovimento={comMovimento}
                          recolhida={recolhidos.has(l.linha_id)} aoAlternar={alternar}
                          destacada={(destaque != null && totalDaLinha(l) === destaque) || doBloco.has(l.linha_id) || String(l.linha_id) === contaPedida}
                          lancamentos={abertas[String(l.linha_id)]} aoAbrirLancamentos={() => alternarLancamentos(String(l.linha_id))} />
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>

              <ComposicaoDaDre competencia={competencia} visao={visao} desde={desde} />

              <Conferencia d={dados} />

              <EvolucaoMensalDaDre competencia={competencia} visao={visao} desde={desde} jaDito={dados.meses_provisorios} />
            </>
          )}
        </div>
      )}
    </>
  );
}
