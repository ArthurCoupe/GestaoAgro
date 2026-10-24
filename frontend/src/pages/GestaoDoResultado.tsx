import { Fragment, useEffect, useState, type ReactNode } from 'react';
import { brl, pct } from '../api/client';
import { hojeISO } from '../api/constantes';
import { DEFINICOES } from '../api/definicoes';
import { getDreNova, type VisaoNova } from '../api/dreNova';
import {
  avisoParaTela, getCustosDaProducao, getExecutivo, getIndicadoresDaProducao, getVendasPorProduto, type CustosDaProducaoResposta, type ExecutivoResposta,
  type IndicadoresDaProducaoResposta, type VendasPorProdutoResposta,
} from '../api/gerencial';
import { PERGUNTAS } from '../api/perguntasGerenciais';
import { abrirNaDre, periodoNaDre, type ContaDaDre, type FiltroDaDre, type LinhaDaDre } from '../components/abrirNaDre';
import { descartarFiltroDaGestao, lerFiltroDaGestao } from '../components/abrirNaGestao';
import { gravarPeriodoAoAbrir } from '../components/periodoAoAbrir';
import { AcumuladoContraOBudget } from '../components/AcumuladoContraOBudget';
import { AvisoDaFolha, fraseDoQuadroAfetado } from '../components/AvisoDaFolha';
import { Composicao, blocosDaComposicao, proximoAberto, tituloDoAlvo, type AlvoComposicao } from '../components/Composicao';
import { CustosEDespesasNoTempo } from '../components/CustosEDespesasNoTempo';
import { CustosNaGestao, temCustosNaGestao } from '../components/CustosDaProducao';
import { usePeriodoDaTela } from '../components/FiltroDoPeriodo';
import { EscadaDoAno, rotuloDoPeriodo } from '../components/EscadaDoAno';
import { GraficoDeProdutos } from '../components/GraficoDeProdutos';
import { GraficoQuemForma, TITULO_DO_RESULTADO } from '../components/GraficoQuemForma';
import { IndicadoresNaGestao, temIndicadoresNaGestao } from '../components/IndicadoresDaProducao';
import { LogisticaPorNegocio } from '../components/LogisticaPorNegocio';
import { CenariosDaMeta } from '../components/gestao/CenariosDaMeta';
import { ComparativoMensal, mesDoComparativo } from '../components/gestao/ComparativoMensal';
import { ConclusaoDaRevenda } from '../components/gestao/ConclusaoDaRevenda';
import { ID_DO_RESULTADO_POR_NEGOCIO, OndeAgirPrimeiro } from '../components/gestao/OndeAgirPrimeiro';
import { PrincipaisPressoes } from '../components/gestao/PrincipaisPressoes';
import { ResumoDaMeta } from '../components/gestao/ResumoDaMeta';
import { Panel, useNav, usePeriodo } from '../components/ui';
import {
  buscaOMesAParte, foraDoRecorte, ID_DAS_ALAVANCAS, MixDaGestao, PremissasDosCaminhos, SecaoAlavancas, SecaoCaminhos,
  SecaoObjetivos, semLancamentos, type DreDoMesAlertado,
} from './Dashboard';
import { anteriorComparavel, periodoAnterior, SecaoOndeAgir, SecaoPorQueEstamosAqui, SecaoPorQueMudou, type Comparacao } from './PorQueEstamosAqui';

export type FrenteDaGestao = 'consolidado' | 'producao' | 'cogumelo' | 'pimentao' | 'revenda';

export const FRENTES: Array<{ chave: FrenteDaGestao; rotulo: string }> = [
  { chave: 'consolidado', rotulo: 'Consolidado' },
  { chave: 'producao', rotulo: 'Produção' },
  { chave: 'cogumelo', rotulo: 'Cogumelo' },
  { chave: 'pimentao', rotulo: 'Pimentão' },
  { chave: 'revenda', rotulo: 'Revenda' },
];

export function consultaDaFrente(f: FrenteDaGestao): { visao: VisaoNova; atividade?: 'PRODUCAO_COGUMELO' | 'PIMENTAO' } {
  if (f === 'cogumelo') return { visao: 'producao', atividade: 'PRODUCAO_COGUMELO' };
  if (f === 'pimentao') return { visao: 'producao', atividade: 'PIMENTAO' };
  return { visao: f };
}

export const AVISO_CAPACIDADE = 'Teto da capacidade produtiva: suspenso até a validação da numeração física das estantes (tela Capacidade Produtiva). Enquanto isso, os caminhos abaixo não limitam o crescimento da produção própria.';

const COM_TETO_FISICO: FrenteDaGestao[] = ['consolidado', 'producao', 'cogumelo'];
export const temTetoFisico = (f: FrenteDaGestao) => COM_TETO_FISICO.includes(f);
const comRevendaPorProduto = (f: FrenteDaGestao) => f === 'consolidado' || f === 'revenda';
const DA_PRODUCAO: FrenteDaGestao[] = ['producao', 'cogumelo', 'pimentao'];

export function FiltroDaFrente({ frente, onFrente }: { frente: FrenteDaGestao; onFrente: (f: FrenteDaGestao) => void }) {
  const naProducao = DA_PRODUCAO.includes(frente);
  const botao = (chave: FrenteDaGestao, rotulo: string, ativo = frente === chave) => (
    <button key={chave} type="button" className={`tab ${ativo ? 'active' : ''}`} aria-pressed={ativo} onClick={() => onFrente(chave)}>{rotulo}</button>
  );
  return (
    <>
      <div className="tabs" role="group" aria-label="Frente analisada">
        {botao('consolidado', 'Consolidado')}{botao('producao', 'Produção', naProducao)}{botao('revenda', 'Revenda')}
      </div>
      {naProducao && (
        <div className="tabs" role="group" aria-label="Abertura da Produção">
          {botao('producao', 'Toda a Produção')}{botao('cogumelo', 'Cogumelo')}{botao('pimentao', 'Pimentão')}
        </div>
      )}
    </>
  );
}

const mensagemDoErro = (e: { response?: { data?: { erro?: string } }; message: string }) => e?.response?.data?.erro ?? e.message;

export function LinhaPeriodoAnalisado({ rotulo, frente }: { rotulo: string; frente: FrenteDaGestao }) {
  const rotuloFrente = FRENTES.find((f) => f.chave === frente)?.rotulo ?? '';
  return <p className="obs-tela">Período analisado: {rotulo} · {rotuloFrente}</p>;
}

const NOTA_RECORTE: Record<'cogumelo' | 'pimentao', string> = {
  cogumelo: 'Esta análise considera só o que já está atribuído a Cogumelo; o que a produção ainda não divide por produto entra só na frente Produção.',
  pimentao: 'Esta análise considera só o que já está atribuído a Pimentão; o que a produção ainda não divide por produto entra só na frente Produção.',
};

export type DestinoDaGestao = 'dre_nova' | 'producao' | 'revenda' | 'historico';

export const paineisDaFrente = (f: FrenteDaGestao): Array<'producao' | 'revenda'> =>
  (f === 'consolidado' ? ['producao', 'revenda'] : f === 'revenda' ? ['revenda'] : ['producao']);

const COM_PRODUTO: FrenteDaGestao[] = ['consolidado', 'producao', 'cogumelo'];

export function OndeFicouODetalhe({ onIr, comVolume, paineis }: {
  onIr?: (destino: DestinoDaGestao) => void; comVolume: boolean; paineis: Array<'producao' | 'revenda'>;
}) {
  const mudou = [
    'a Composição dos Custos, por visão (Consolidado, Produção, Revenda), fica na DRE Gerencial',
    comVolume && 'Kg colhidos e a margem de contribuição por kg e por bandeja do Cogumelo, o mesmo cálculo da frente Cogumelo daqui, ficam no Painel da Produção, aba Cogumelo',
    paineis.includes('revenda') && 'a tabela Revenda por produto fica no Painel da Revenda, em Ver detalhamento',
  ].filter(Boolean).join('; ');
  const destinos: Array<[DestinoDaGestao, string]> = [
    ...paineis.map((p): [DestinoDaGestao, string] => [p, p === 'producao' ? 'Painel da Produção' : 'Painel da Revenda']),
    ['historico', 'Análise Mensal do Resultado'],
    ['dre_nova', 'DRE Gerencial'],
  ];
  const botao = (destino: DestinoDaGestao, texto: string) => (onIr
    ? <button type="button" className="gr-toggle" aria-label={`Ir para ${destino === 'dre_nova' || destino === 'historico' ? 'a' : 'o'} ${texto}`} onClick={() => onIr(destino)}>{texto}</button>
    : <b>{texto}</b>);
  return (
    <>
      <p className="obs-tela">{`O detalhe mudou de endereço: ${mudou}.`}</p>
      <p className="obs-tela">{'Para investigar: '}{destinos.map(([d, texto], i) => (
        <Fragment key={d}>{i > 0 && (i === destinos.length - 1 ? ' e ' : ', ')}{botao(d, texto)}</Fragment>
      ))}.</p>
    </>
  );
}

export type Rentabilidade = Pick<ExecutivoResposta, 'aconteceu' | 'objetivos'>;
export interface LinhaDaRentabilidade { indicador: string; tipo: 'reais' | 'pct'; valores: Array<number | null>; dre: { linha?: LinhaDaDre } | null }

export function linhasDaRentabilidade(prod: Rentabilidade, rev: Rentabilidade, cons: Rentabilidade): LinhaDaRentabilidade[] {
  const tres = [prod, rev, cons];
  const comEstrutura = (v: Array<number | null>): Array<number | null> => {
    const [p, r, c] = v;
    return [p, r, p == null || r == null || c == null ? null : Math.round((c - p - r) * 100) / 100, c];
  };
  const receita = comEstrutura(tres.map((x) => x.aconteceu.receita_liquida));
  const mc = comEstrutura(tres.map((x) => x.objetivos.margem_contribuicao ?? null));
  const resultado = comEstrutura(tres.map((x) => x.aconteceu.resultado_operacional));
  const parte = (v: Array<number | null>) => {
    const total = v[3];
    return v.map((x) => (x == null || total == null || total <= 0 ? null : Math.round((x / total) * 10000) / 100));
  };
  const margem = (doPayload: Array<number | null>): Array<number | null> => [doPayload[0], doPayload[1], null, doPayload[2]];
  return [
    { indicador: 'Receita líquida', tipo: 'reais', valores: receita, dre: { linha: 'T01' } },
    { indicador: '% da receita', tipo: 'pct', valores: parte(receita), dre: null },
    { indicador: 'Margem de contribuição', tipo: 'reais', valores: mc, dre: {} },
    { indicador: '% da margem de contribuição', tipo: 'pct', valores: parte(mc), dre: null },
    { indicador: DEFINICOES.margem_contribuicao_pct.nome, tipo: 'pct', valores: margem(tres.map((x) => x.objetivos.margem_contribuicao_pct ?? null)), dre: {} },
    { indicador: 'Resultado operacional', tipo: 'reais', valores: resultado, dre: { linha: 'T03' } },
    { indicador: '% do resultado', tipo: 'pct', valores: parte(resultado), dre: null },
    { indicador: 'Margem operacional %', tipo: 'pct', valores: margem(tres.map((x) => x.aconteceu.margem_liquida_pct)), dre: { linha: 'T03' } },
  ];
}

const VISAO_DA_COLUNA: Array<VisaoNova | null> = ['producao', 'revenda', null, 'consolidado'];
const ROTULO_DA_COLUNA = ['Produção', 'Revenda', 'Estrutura', 'Consolidado'];

const CAB_CLICAVEL = { font: 'inherit', color: 'inherit', textTransform: 'inherit', letterSpacing: 'inherit', textDecoration: 'underline' } as const;

export function RentabilidadeDasFrentes({ prod, rev, cons, onIr, onAbrirDre, semDreNoPeriodo = false }: {
  prod: Rentabilidade; rev: Rentabilidade; cons: Rentabilidade;
  onIr?: (destino: 'producao' | 'revenda') => void;
  onAbrirDre?: (visao: VisaoNova, linha?: LinhaDaDre) => void;
  semDreNoPeriodo?: boolean;
}) {
  const cab = (destino: 'producao' | 'revenda', texto: string) => (onIr
    ? <button type="button" className="gr-toggle" style={CAB_CLICAVEL} aria-label={`Ir para o Painel da ${texto}`} onClick={() => onIr(destino)}>{texto}</button>
    : texto);
  const cel = (l: LinhaDaRentabilidade, v: number | null, i: number) => {
    const texto = v == null ? '—' : l.tipo === 'reais' ? brl(v) : pct(v);
    const visao = VISAO_DA_COLUNA[i];
    if (!onAbrirDre || !l.dre || !visao || v == null) return texto;
    const { linha } = l.dre;
    return (
      <button type="button" className="gr-toggle" style={CAB_CLICAVEL} aria-label={`Abrir na DRE Gerencial: ${l.indicador}, ${ROTULO_DA_COLUNA[i]}`}
        onClick={() => onAbrirDre(visao, linha)}>{texto}</button>
    );
  };
  return (
    <div>
      <h4>Produção x Revenda x Consolidado</h4>
      <div className="tbl-scroll">
        <table className="tbl">
          <thead>
            <tr>
              <th>Indicador</th><th className="num">{cab('producao', 'Produção')}</th><th className="num">{cab('revenda', 'Revenda')}</th>
              <th className="num">Estrutura (sem rateio)</th><th className="num">Consolidado</th>
            </tr>
          </thead>
          <tbody>
            {linhasDaRentabilidade(prod, rev, cons).map((l) => (
              <tr key={l.indicador}>
                <td>{l.indicador}</td>
                {l.valores.map((v, i) => <td key={i} className={`num${v != null && v < 0 ? ' neg' : ''}`}>{cel(l, v, i)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="obs-tela">
        Mesmo período e mesma base da DRE Gerencial nas três colunas. Estrutura é o que fica só no Consolidado (corporativo e
        não rateado): Produção + Revenda + Estrutura = Consolidado, nas linhas em reais. A Estrutura não tem margem
        própria, por isso as margens em % dela ficam em "—". Clique em Produção ou Revenda para abrir o painel da frente.
        {onAbrirDre && ' Clique num valor de Produção, Revenda ou Consolidado para abrir a DRE Gerencial na mesma visão e no mesmo período, na linha do indicador (a margem de contribuição fica no quadro Indicadores, no topo); as participações (%) e a Estrutura não têm linha própria na DRE.'}
        {semDreNoPeriodo && ' Neste período os valores não abrem a DRE Gerencial, que mostra só o mês ou o acumulado do ano.'}
      </p>
    </div>
  );
}

function TabelasDoConsolidado({ ex }: { ex: ExecutivoResposta }) {
  const [aberto, setAberto] = useState<AlvoComposicao | null>(null);
  const periodo = rotuloDoPeriodo(ex.periodo);
  return (
    <EscadaDoAno ex={ex} acumulado={ex.periodo.meses.length === 1 ? ex : null} regime={ex.regime} visao="consolidado" semMensal
      perguntaAcumulado={PERGUNTAS.abertura} onAbrir={(alvo) => setAberto((a) => proximoAberto(a, alvo))}
      entreAsDuas={(
        <>
          {aberto && (
            <Composicao titulo={tituloDoAlvo(ex, aberto)} rotuloPeriodo={periodo} etiqueta={ex.etiqueta} regime={ex.regime}
              blocos={blocosDaComposicao(ex, aberto)} periodo={{ inicio: ex.periodo.inicio, fim: ex.periodo.fim }} visao={ex.visao}
              atividade={aberto.tipo === 'atividade' ? aberto.chave : null} onFechar={() => setAberto(null)} />
          )}
          <AcumuladoContraOBudget ex={ex} periodo={periodo} />
          {ex.logistica && <LogisticaPorNegocio l={ex.logistica} periodo={ex.periodo} etiqueta={ex.etiqueta} />}
        </>
      )} />
  );
}

export function SecoesDaGestao({ ex, frente, onIr, onAbrirDre, frentes = null, comparacao, exAno = null, vendas = null, dreDoMes = null, indicadores = null, custos = null, hoje = hojeISO() }: {
  ex: ExecutivoResposta; frente: FrenteDaGestao;
  indicadores?: IndicadoresDaProducaoResposta | { erro: string } | null;
  custos?: CustosDaProducaoResposta | { erro: string } | null;
  dreDoMes?: DreDoMesAlertado | null;
  onIr?: (destino: DestinoDaGestao) => void;
  onAbrirDre?: (filtro: FiltroDaDre) => void;
  frentes?: { prod: Rentabilidade; rev: Rentabilidade } | { erro: string } | null;
  comparacao?: Comparacao;
  exAno?: ExecutivoResposta | { erro: string } | null;
  vendas?: VendasPorProdutoResposta | { erro: string } | null;
  hoje?: string;
}) {
  const notaRecorte = (frente === 'cogumelo' || frente === 'pimentao') && (
    <p className="obs-tela">{NOTA_RECORTE[frente]}</p>
  );
  const teto = temTetoFisico(frente);
  const paineis = paineisDaFrente(frente);
  const naDre = periodoNaDre(ex.periodo);
  const abrirDre = onAbrirDre && naDre
    ? (visao: VisaoNova, linha?: LinhaDaDre) => onAbrirDre({ visao, ...naDre, ...(linha ? { linha } : {}) })
    : undefined;
  const abrirConta = onAbrirDre && naDre && !notaRecorte
    ? (conta: ContaDaDre) => onAbrirDre({ visao: consultaDaFrente(frente).visao, ...naDre, conta })
    : undefined;
  const anterior = anteriorComparavel(ex, comparacao);
  const doAno = (quadro: (a: ExecutivoResposta) => ReactNode, id?: string) => (!exAno ? <div className="loading" id={id}>Apurando os meses do ano…</div>
    : 'erro' in exAno ? <div className="empty" id={id}>Gráficos do ano indisponíveis ({exAno.erro}).</div>
      : quadro(exAno));
  const comMix = frente === 'consolidado' || !!ex.mix.aviso || ex.atividades.filter((a) => !foraDoRecorte(ex, a)).length > 1;
  if (semLancamentos(ex)) {
    return (
      <>
        {notaRecorte}
        <div className="empty">Sem apuração no período: nenhum mês dele tem fato gravado.</div>
        <OndeFicouODetalhe onIr={onIr} comVolume={teto} paineis={paineis} />
      </>
    );
  }
  return (
    <>
      {notaRecorte}
      {ex.avisos.map((a, i) => <p key={i} className="obs-tela">⚠ {avisoParaTela(a)}</p>)}
      <AvisoDaFolha pendentes={ex.folha_pendente} provisorios={ex.meses_provisorios} />
      <ResumoDaMeta ex={ex} />
      {doAno((a) => (
        <>
          <GraficoQuemForma ex={a} periodo={rotuloDoPeriodo(a.periodo)} titulo={TITULO_DO_RESULTADO[frente]} comEstrutura={frente === 'consolidado'} />
          {(a.folha_pendente?.length ?? 0) > 0 && <p className="obs-tela">{(ex.folha_pendente?.length ?? 0) > 0
            ? `⚠ ${fraseDoQuadroAfetado('Os resultados mês a mês do gráfico acima')}`
            : '⚠ Os resultados mês a mês do gráfico acima incluem mês com folha ainda não apropriada: leia como parcial.'}</p>}
        </>
      ), ID_DO_RESULTADO_POR_NEGOCIO)}
      {COM_PRODUTO.includes(frente) && <GraficoDeProdutos ex={ex} frente={frente} periodo={rotuloDoPeriodo(ex.periodo)} />}
      {comRevendaPorProduto(frente) && <ConclusaoDaRevenda ex={ex} vendas={vendas} onIr={onIr} />}
      <PrincipaisPressoes ex={ex} anterior={anterior} rotuloAnterior={comparacao?.anterior} hoje={hoje} onAbrirConta={abrirConta}
        evolucao={doAno((a) => <CustosEDespesasNoTempo composicao={ex.composicao} serie={a.serie_mensal} mesesSemFato={a.meses_sem_fato}
          etiqueta={ex.etiqueta} periodo={rotuloDoPeriodo(a.periodo)} periodoDasLinhas={rotuloDoPeriodo(ex.periodo)} folhaPendente={a.folha_pendente} />)} />
      <OndeAgirPrimeiro ex={ex} frente={frente} anterior={anterior} rotuloAnterior={comparacao?.anterior} onAbrirConta={abrirConta} onIr={onIr} />
      {temIndicadoresNaGestao(frente) && doAno((a) => <IndicadoresNaGestao ex={a} ind={indicadores} frente={frente} />)}
      {temCustosNaGestao(frente) && doAno((a) => <CustosNaGestao custos={custos} periodo={a.periodo} />)}
      <details className="comparativo-da-gestao">
        <summary>Ver o comparativo mensal das contas, com os alertas do mês</summary>
        {doAno((a) => <ComparativoMensal ex={a} frente={frente} budget={ex.budget} dreDoMes={dreDoMes} hoje={hoje} />)}
      </details>
      <CenariosDaMeta ex={ex} simulacoes={(
        <>
          <SecaoObjetivos ex={ex} titulo="Meta Econômica" pergunta={PERGUNTAS.meta_economica} margemDiscreta comMinimo />
          <SecaoCaminhos ex={ex} pergunta={PERGUNTAS.mix_e_caminhos} aviso={teto ? AVISO_CAPACIDADE : undefined} />
          <SecaoAlavancas ex={ex} pergunta={PERGUNTAS.alavancas} id={ID_DAS_ALAVANCAS} />
        </>
      )} />
      <details className="detalhamento-da-gestao">
        <summary>Ver detalhamento</summary>
        {comMix && (
          <Panel title={frente === 'consolidado' ? 'Produção x Revenda e participação dos negócios' : 'Participação dos negócios'} tag={ex.etiqueta}>
            <MixDaGestao ex={ex}
              comparativo={frente !== 'consolidado' ? undefined
                : !frentes ? <div className="loading">Apurando Produção e Revenda…</div>
                  : 'erro' in frentes ? <div className="empty">Produção x Revenda indisponível ({frentes.erro}).</div>
                    : <RentabilidadeDasFrentes prod={frentes.prod} rev={frentes.rev} cons={ex} onIr={onIr}
                      onAbrirDre={abrirDre} semDreNoPeriodo={onAbrirDre != null && naDre == null} />} />
          </Panel>
        )}
        <SecaoPorQueEstamosAqui ex={ex}
          onAbrirDre={abrirDre && !notaRecorte ? () => abrirDre(consultaDaFrente(frente).visao, 'T03') : undefined} />
        {comparacao && <SecaoPorQueMudou ex={ex} comparacao={comparacao} />}
        {comparacao && <SecaoOndeAgir ex={ex} comparacao={comparacao} />}
        {frente === 'consolidado' && <TabelasDoConsolidado ex={ex} />}
        <Panel title="Premissas e fórmulas" tag={ex.etiqueta}>
          <PremissasDosCaminhos ex={ex} />
        </Panel>
      </details>
      <OndeFicouODetalhe onIr={onIr} comVolume={teto} paineis={paineis} />
    </>
  );
}

export function GestaoDoResultado() {
  const { periodo } = usePeriodo();
  const navegar = useNav();
  const [recado] = useState(() => lerFiltroDaGestao());
  const [frente, setFrente] = useState<FrenteDaGestao>(recado?.frente ?? 'consolidado');
  const { escopo, recusa, intervalo, rotulo, filtro } = usePeriodoDaTela(recado);
  const [ex, setEx] = useState<ExecutivoResposta | null>(null);
  const [erro, setErro] = useState('');
  const consulta = consultaDaFrente(frente);
  const [frentes, setFrentes] = useState<{ prod: ExecutivoResposta; rev: ExecutivoResposta } | { erro: string } | null>(null);
  const anterior = periodoAnterior(escopo, intervalo);
  const [exAnterior, setExAnterior] = useState<ExecutivoResposta | { erro: string } | null>(null);
  const anoAParte = escopo !== 'PERSONALIZADO' && buscaOMesAParte(escopo, periodo);
  const inicioDoAno = `${intervalo.fim.slice(0, 4)}-01-01`;
  const [exDoAno, setExDoAno] = useState<ExecutivoResposta | { erro: string } | null>(null);
  const comVendas = comRevendaPorProduto(frente) && !recusa;
  const [vendas, setVendas] = useState<VendasPorProdutoResposta | { erro: string } | null>(null);

  useEffect(() => { descartarFiltroDaGestao(); }, []);

  useEffect(() => {
    let vivo = true;
    setErro(''); setEx(null);
    if (recusa) return undefined;
    getExecutivo(intervalo.inicio, intervalo.fim, consulta.visao, 'COMPETENCIA', consulta.atividade, frente === 'consolidado')
      .then((r) => { if (vivo) setEx(r); })
      .catch((e) => { if (vivo) setErro(mensagemDoErro(e)); });
    return () => { vivo = false; };
  }, [intervalo.inicio, intervalo.fim, frente, recusa]);

  const comFrentes = frente === 'consolidado' && !recusa;
  useEffect(() => {
    let vivo = true;
    setFrentes(null);
    if (!comFrentes) return undefined;
    Promise.all([
      getExecutivo(intervalo.inicio, intervalo.fim, 'producao', 'COMPETENCIA'),
      getExecutivo(intervalo.inicio, intervalo.fim, 'revenda', 'COMPETENCIA'),
    ])
      .then(([prod, rev]) => { if (vivo) setFrentes({ prod, rev }); })
      .catch((e) => { if (vivo) setFrentes({ erro: mensagemDoErro(e) }); });
    return () => { vivo = false; };
  }, [intervalo.inicio, intervalo.fim, comFrentes]);

  useEffect(() => {
    let vivo = true;
    setExAnterior(null);
    if (recusa) return undefined;
    getExecutivo(anterior.inicio, anterior.fim, consulta.visao, 'COMPETENCIA', consulta.atividade)
      .then((r) => { if (vivo) setExAnterior(r); })
      .catch((e) => { if (vivo) setExAnterior({ erro: mensagemDoErro(e) }); });
    return () => { vivo = false; };
  }, [anterior.inicio, anterior.fim, frente, recusa]);

  useEffect(() => {
    setExDoAno(null);
    if (!anoAParte) return undefined;
    let vivo = true;
    getExecutivo(inicioDoAno, intervalo.fim, consulta.visao, 'COMPETENCIA', consulta.atividade)
      .then((r) => { if (vivo) setExDoAno(r); })
      .catch((e) => { if (vivo) setExDoAno({ erro: mensagemDoErro(e) }); });
    return () => { vivo = false; };
  }, [anoAParte, inicioDoAno, intervalo.fim, frente]);
  const exAno = anoAParte ? exDoAno : ex;

  const mesDoBudget = frente === 'consolidado' && exAno && !('erro' in exAno) ? mesDoComparativo(exAno) : null;
  const buscaDreDoMes = mesDoBudget != null && (ex?.budget?.estado === 'COMPARADO' || ex?.budget?.estado === 'INCOMPLETO');
  const [dreDoMes, setDreDoMes] = useState<DreDoMesAlertado | null>(null);
  useEffect(() => {
    setDreDoMes(null);
    if (!buscaDreDoMes || mesDoBudget == null) return undefined;
    let vivo = true;
    getDreNova(mesDoBudget, 'consolidado')
      .then((dre) => { if (vivo) setDreDoMes({ mes: mesDoBudget, dre }); })
      .catch(() => { if (vivo) setDreDoMes({ mes: mesDoBudget, erro: 'a DRE do mês não pôde ser lida agora' }); });
    return () => { vivo = false; };
  }, [buscaDreDoMes, mesDoBudget]);

  const comIndicadores = temIndicadoresNaGestao(frente) && !recusa;
  const inicioDosIndicadores = anoAParte ? inicioDoAno : intervalo.inicio;
  const [indicadores, setIndicadores] = useState<IndicadoresDaProducaoResposta | { erro: string } | null>(null);
  useEffect(() => {
    setIndicadores(null);
    if (!comIndicadores) return undefined;
    let vivo = true;
    getIndicadoresDaProducao(inicioDosIndicadores, intervalo.fim)
      .then((r) => { if (vivo) setIndicadores(r); })
      .catch((e) => { if (vivo) setIndicadores({ erro: mensagemDoErro(e) }); });
    return () => { vivo = false; };
  }, [comIndicadores, inicioDosIndicadores, intervalo.fim]);
  const comCustos = temCustosNaGestao(frente) && !recusa;
  const [custos, setCustos] = useState<CustosDaProducaoResposta | { erro: string; periodo: { inicio: string; fim: string } } | null>(null);
  useEffect(() => {
    setCustos(null);
    if (!comCustos) return undefined;
    let vivo = true;
    getCustosDaProducao(inicioDosIndicadores, intervalo.fim)
      .then((r) => { if (vivo) setCustos(r); })
      .catch((e) => { if (vivo) setCustos({ erro: mensagemDoErro(e), periodo: { inicio: inicioDosIndicadores, fim: intervalo.fim } }); });
    return () => { vivo = false; };
  }, [comCustos, inicioDosIndicadores, intervalo.fim]);

  useEffect(() => {
    setVendas(null);
    if (!comVendas) return undefined;
    let vivo = true;
    getVendasPorProduto(intervalo.inicio, intervalo.fim)
      .then((r) => { if (vivo) setVendas(r); })
      .catch((e) => { if (vivo) setVendas({ erro: mensagemDoErro(e) }); });
    return () => { vivo = false; };
  }, [intervalo.inicio, intervalo.fim, comVendas]);

  const irPara = (destino: DestinoDaGestao) => {
    if (destino !== 'dre_nova') gravarPeriodoAoAbrir(escopo, intervalo);
    navegar(destino);
  };

  return (
    <>
      <FiltroDaFrente frente={frente} onFrente={setFrente} />
      {filtro}
      {recusa ? <div className="empty">{recusa}</div>
        : erro ? <div className="empty">Gestão do Resultado indisponível ({erro}).</div>
          : !ex ? <div className="loading">Apurando {rotulo}…</div>
            : (
              <>
                <LinhaPeriodoAnalisado rotulo={rotulo} frente={frente} />
                <SecoesDaGestao ex={ex} frente={frente} onIr={irPara}
                  onAbrirDre={(filtro) => abrirNaDre(navegar, filtro)} frentes={frentes}
                  exAno={exAno} vendas={vendas} dreDoMes={dreDoMes} indicadores={indicadores} custos={custos}
                  comparacao={{ atual: rotulo, anterior: anterior.rotulo, ex: exAnterior, escopo }} />
              </>
            )}
    </>
  );
}
