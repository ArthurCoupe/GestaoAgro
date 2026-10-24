import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Bar } from 'react-chartjs-2';
import {
  brl, getIndicadoresCiclo, getPainelCiclo, getPimentaoConsolidado,
  hojeISO, num, type IndicadoresCicloResposta,
  type PainelCicloMetricas, type PainelCicloResposta, type PainelCicloTotais, type PimentaoConsolidadoLinha,
} from '../api/client';
import { getExecutivo, type Escada, type ExecutivoResposta } from '../api/gerencial';
import { PERGUNTAS } from '../api/perguntasGerenciais';
import { useAuth, viewsDoPerfil } from '../auth';
import { baseOpts, GOLD, legB } from '../charts/setup';
import { abrirNaDre } from '../components/abrirNaDre';
import { AvisoDaFolha } from '../components/AvisoDaFolha';
import { DetalheDasEspecies, EconomiaPorEspecie } from '../components/EconomiaPorEspecie';
import { colunasDaVariedade, DirecionadorDaEspecie, FRASE_RECEITA_NAO_DIVIDIDA, receitaDivididaPorEspecie, rotuloDoPeriodo, subPorEspecie, ytdDaChave } from '../components/EscadaDoAno';
import { EscadaMensal, subMensal, type ChaveDaEscada } from '../components/EscadaMensal';
import { usePeriodoDaTela } from '../components/FiltroDoPeriodo';
import { EscadaPorSegmento } from '../components/EscadaPorSegmento';
import { GraficoDeProdutos } from '../components/GraficoDeProdutos';
import { GraficoProdutosMesAMes } from '../components/GraficoProdutosMesAMes';
import { GraficosCarregando, GraficosDaEmpresa } from '../components/GraficosDaVisaoExecutiva';
import { descartarPeriodoAoAbrir, lerPeriodoAoAbrir } from '../components/periodoAoAbrir';
import { PontoDeEquilibrioDaFrente } from '../components/PontoDeEquilibrioDaFrente';
import { Kpi, Panel, Pill, useNav, usePeriodo } from '../components/ui';
import { CardsDoAno, CardsDoAnoCarregando, SecaoVolume } from './Dashboard';
import { abrirIndicadoresEm } from './IndicadoresCiclo';

const NOME_POR_TIPO: Record<string, string> = {
  SH: 'Shiitake', SP: 'Shimeji Preto', SB: 'Shimeji Branco', SS: 'Shimeji Salmão',
};
const ORDEM_TIPOS = ['SH', 'SP', 'SB', 'SS'];
const nomeDoTipo = (t: string) => NOME_POR_TIPO[t] ?? t;

export const fracPct = (v: number | null | undefined) =>
  (v == null ? '—' : `${(v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`);

export function linhasPorVariedade(
  pivot: IndicadoresCicloResposta | null,
  eficienciaPorTipo: Array<{ tipo: string } & PainelCicloMetricas>,
  volumePorTipo: Map<string, { kg: number | null }>,
) {
  const doCiclo = new Map((pivot?.grupos ?? []).map((g) => [g.tipo, g]));
  const daEficiencia = new Map(eficienciaPorTipo.map((e) => [e.tipo, e]));
  const tipos = [...new Set([...ORDEM_TIPOS, ...doCiclo.keys(), ...volumePorTipo.keys()])]
    .filter((t) => doCiclo.has(t) || volumePorTipo.has(t));
  return tipos.map((tipo) => {
    const g = doCiclo.get(tipo);
    const e = daEficiencia.get(tipo);
    const v = volumePorTipo.get(tipo);
    return {
      tipo,
      nome: nomeDoTipo(tipo),
      kgPeriodo: g?.total.total_kg_colhidos ?? null,
      kgAno: v?.kg ?? null,
      contaminacao: g?.total.taxa_contaminacao ?? null,
      aproveitamento: e?.taxa_aproveitamento ?? null,
      kgPorBloco: e?.kg_por_bloco_aberto ?? null,
      eficiencia: e?.eficiencia_total ?? null,
      lotes: g?.linhas.length ?? 0,
    };
  });
}

export function volumeDoAnoPorTipo(totaisAno: PainelCicloTotais | null): Map<string, { kg: number | null }> {
  return new Map((totaisAno?.por_tipo ?? []).map((t) => [t.tipo, { kg: t.kg_colhidos }]));
}

export function rotuloDoKgAno({ erroAno, totaisAno }: {
  erroAno: string; totaisAno: PainelCicloTotais | null;
}): { value: string; delta?: string } {
  if (erroAno) return { value: '—', delta: `não foi possível ler as colheitas do período (${erroAno})` };
  return { value: totaisAno ? num(totaisAno.kg_colhidos, 1) : '—' };
}

export function coorteMadura(fimDoPeriodo: string, hoje: string, diasMinimos: number): boolean {
  const dias = (Date.parse(`${hoje}T00:00:00Z`) - Date.parse(`${fimDoPeriodo}T00:00:00Z`)) / 86400000;
  return Number.isFinite(dias) && dias >= diasMinimos;
}

export function toneDaContaminacao(
  taxa: number | null | undefined, madura: boolean,
): 'alert' | 'good' | undefined {
  if (taxa == null || !madura) return undefined;
  return taxa > 0.2 ? 'alert' : 'good';
}

export type AbaDaProducao = 'PRODUCAO' | 'COGUMELO' | 'PIMENTAO';
export const ABAS_DA_PRODUCAO: Array<{ chave: AbaDaProducao; rotulo: string }> = [
  { chave: 'PRODUCAO', rotulo: 'Produção consolidada' },
  { chave: 'COGUMELO', rotulo: 'Cogumelo' },
  { chave: 'PIMENTAO', rotulo: 'Pimentão' },
];

export function temProducaoSemQuebra(semQuebra: Escada): boolean {
  return semQuebra.receita_liquida !== 0 || semQuebra.resultado_operacional !== 0;
}

export function FinanceiroDaProducao({ ex, aba, onTrocarAba, porQue, detalhe, comProdutos }: { ex: ExecutivoResposta; aba: AbaDaProducao; onTrocarAba?: (aba: AbaDaProducao) => void; porQue?: ReactNode; detalhe?: ReactNode; comProdutos?: boolean }) {
  const periodo = rotuloDoPeriodo(ex.periodo);
  const [chaveCogumelo, setChaveCogumelo] = useState<ChaveDaEscada>('PRODUCAO_COGUMELO');
  const navegar = useNav();
  const especies = colunasDaVariedade(ex.escada);
  const [rolarPara, setRolarPara] = useState<string | null>(null);
  useEffect(() => {
    if (!rolarPara) return;
    const alvo = document.getElementById(rolarPara);
    const detalhes = alvo?.closest('details');
    if (detalhes) detalhes.open = true;
    alvo?.scrollIntoView({ block: 'start' });
    setRolarPara(null);
  }, [rolarPara, aba]);
  const abrirProduto = onTrocarAba && ((chave: string) => {
    if (chave === 'PIMENTAO') {
      onTrocarAba('PIMENTAO');
      setRolarPara('evolucao-pimentao');
      return;
    }
    setChaveCogumelo(especies.find((v) => v.chave === chave)?.chave ?? 'PRODUCAO_COGUMELO');
    onTrocarAba('COGUMELO');
    setRolarPara('evolucao-cogumelo');
  });
  const comum = { serie: ex.serie_mensal, limiares: ex.limiares_alerta, regime: ex.regime, etiqueta: ex.etiqueta, sub: subMensal(ex.regime), lancamentos: { visao: ex.visao, periodo: ex.periodo }, folhaPendente: ex.folha_pendente };
  const aviso = <AvisoDaFolha pendentes={ex.folha_pendente} provisorios={ex.meses_provisorios} />;
  if (aba === 'PRODUCAO') {
    const semQuebra = ex.escada.por_atividade.PRODUCAO_SEM_QUEBRA;
    return (
      <>
        {aviso}
        <CardsDoAno ex={ex} chave="TOTAL" rotulo="Produção" pergunta={PERGUNTAS.acumulado_producao} />
        <PontoDeEquilibrioDaFrente ex={ex} recorte="da Produção" />
        <GraficosDaEmpresa serie={ex.serie_mensal} mesesSemFato={ex.meses_sem_fato} etiqueta={ex.etiqueta} periodo={periodo} aconteceu={ex.aconteceu}
          visao={ex.visao} onAbrirDre={(filtro) => abrirNaDre(navegar, filtro)} />
        <h2 className="nivel-da-visao">Quem formou o resultado da Produção?</h2>
        <GraficoProdutosMesAMes ex={ex} periodo={periodo} onAbrirProduto={abrirProduto} />
        {temProducaoSemQuebra(semQuebra) && (
          <p className="obs-tela">
            Da Produção, {brl(semQuebra.resultado_operacional)} de resultado ainda não está dividido entre
            Cogumelo e Pimentão: são linhas que a planilha de rateios ainda não reparte por produto.
          </p>
        )}
        <details className="detalhamento-da-gestao">
          <summary>Ver detalhamento</summary>
          <EscadaMensal {...comum} ytd={ex.escada.total} id="evolucao-producao"
            titulo={`Evolução mensal da produção: ${periodo}`} pergunta={PERGUNTAS.evolucao_producao} />
          {comProdutos && <GraficoDeProdutos ex={ex} frente="producao" periodo={periodo} />}
        </details>
      </>
    );
  }
  if (aba === 'PIMENTAO') {
    return (
      <>
        {aviso}
        <CardsDoAno ex={ex} chave="PIMENTAO" rotulo="Pimentão" pergunta={PERGUNTAS.acumulado_pimentao} />
        <details className="detalhamento-da-gestao">
          <summary>Ver detalhamento</summary>
          <EscadaMensal {...comum} ytd={ex.escada.por_atividade.PIMENTAO} chave="PIMENTAO" id="evolucao-pimentao"
            titulo={`Evolução mensal · Pimentão: ${periodo}`} pergunta={PERGUNTAS.evolucao_pimentao} />
        </details>
      </>
    );
  }
  const seletor = especies.length > 0 ? {
    colunas: [{ chave: 'PRODUCAO_COGUMELO' as const, rotulo: 'Cogumelo · todas as espécies' }, ...especies.map((v) => ({ chave: v.chave, rotulo: `Cogumelo · ${v.rotulo}` }))],
    chave: chaveCogumelo, onChange: setChaveCogumelo,
  } : undefined;
  const receitaDividida = receitaDivididaPorEspecie(ex.escada);
  return (
    <>
      {aviso}
      <CardsDoAno ex={ex} chave="PRODUCAO_COGUMELO" rotulo="Cogumelo" pergunta={PERGUNTAS.acumulado_cogumelo} />
      {porQue}
      <details className="detalhamento-da-gestao">
        <summary>Ver detalhamento</summary>
        <EscadaMensal {...comum} ytd={ytdDaChave(ex.escada, chaveCogumelo)} chave="PRODUCAO_COGUMELO" seletor={seletor} id="evolucao-cogumelo"
          titulo={`Evolução mensal · Cogumelo: ${periodo}`} pergunta={PERGUNTAS.evolucao_cogumelo} receitaDividida={receitaDividida} />
        {chaveCogumelo !== 'PRODUCAO_COGUMELO' && !receitaDividida && (
          <p className="obs-tela">{FRASE_RECEITA_NAO_DIVIDIDA}</p>
        )}
      </details>
      <details className="detalhamento-da-gestao">
        <summary>Ver detalhamento por espécie</summary>
        {especies.length > 0 && (
          <EscadaPorSegmento escada={ex.escada} colunas={especies} rotuloTotal="Total Cogumelo" total={ex.escada.por_atividade.PRODUCAO_COGUMELO}
            regime={ex.regime} etiqueta={ex.etiqueta} titulo={`Cogumelo por espécie: ${periodo}`} pergunta={PERGUNTAS.especies} sub={subPorEspecie(ex.escada)}
            receitaDividida={receitaDividida} />
        )}
        {especies.length > 0 && <DirecionadorDaEspecie periodos={ex.direcionador_especie} />}
        {detalhe}
      </details>
    </>
  );
}

export function consultaDaMargemUnitaria(aba: AbaDaProducao, intervalo: { inicio: string; fim: string }): { inicio: string; fim: string } | null {
  return aba === 'COGUMELO' ? { inicio: intervalo.inicio, fim: intervalo.fim } : null;
}

export function MargemUnitariaDoCogumelo({ ex, erro }: { ex: ExecutivoResposta | null; erro: string }) {
  const titulo = 'Margem de contribuição por kg e por bandeja';
  if (erro) return <Panel title={titulo}><div className="empty">Margem unitária indisponível ({erro}).</div></Panel>;
  if (!ex) return <Panel title={titulo}><div className="loading">Calculando a margem unitária…</div></Panel>;
  return (
    <SecaoVolume ex={ex} semKg pergunta={PERGUNTAS.volume_e_margem} titulo={`${titulo}: Cogumelo, ${rotuloDoPeriodo(ex.periodo)}`}
      sub="A margem de contribuição do Cogumelo no período dividida pelos kg colhidos e pelas bandejas embaladas no mesmo período. O mesmo cálculo que a Gestão do Resultado mostrava na frente Cogumelo." />
  );
}

export function PainelProducao() {
  const { periodo } = usePeriodo();
  const { usuario } = useAuth();
  const ehGestor = (usuario?.role ?? '') === 'GESTAO_GERAL';
  const comProdutos = !viewsDoPerfil(usuario?.role ?? null).includes('gestao_resultado');
  const [recado] = useState(() => lerPeriodoAoAbrir());
  const { recusa, intervalo, rotulo: rotuloDaTela, filtro } = usePeriodoDaTela(recado);
  useEffect(() => { descartarPeriodoAoAbrir(); }, []);
  const navegar = useNav();
  const irAoCiclo = () => { abrirIndicadoresEm(periodo); navegar('indicadores_ciclo'); };

  const [ciclo, setCiclo] = useState<IndicadoresCicloResposta | null>(null);
  const [painel, setPainel] = useState<PainelCicloResposta | null>(null);
  const [totaisAno, setTotaisAno] = useState<PainelCicloTotais | null>(null);
  const [erroAno, setErroAno] = useState('');
  const [pimentao, setPimentao] = useState<PimentaoConsolidadoLinha[] | null>(null);
  const [erro, setErro] = useState('');
  const [avisoPimentao, setAvisoPimentao] = useState('');
  const [exEscada, setExEscada] = useState<ExecutivoResposta | null>(null);
  const [erroEscada, setErroEscada] = useState('');
  const [aba, setAba] = useState<AbaDaProducao>('PRODUCAO');
  const [exCogumelo, setExCogumelo] = useState<ExecutivoResposta | null>(null);
  const [erroCogumelo, setErroCogumelo] = useState('');

  useEffect(() => {
    let vivo = true;
    setErro(''); setCiclo(null); setPainel(null);
    const params = { inicio: periodo.inicio, fim: periodo.fim };
    Promise.all([getIndicadoresCiclo(params), getPainelCiclo(params)])
      .then(([i, p]) => { if (vivo) { setCiclo(i); setPainel(p); } })
      .catch((e) => { if (vivo) setErro(e?.response?.data?.erro ?? e.message); });
    return () => { vivo = false; };
  }, [periodo]);

  useEffect(() => {
    let vivo = true;
    setErroAno(''); setTotaisAno(null);
    if (recusa) return undefined;
    getPainelCiclo({ inicio: intervalo.inicio, fim: intervalo.fim })
      .then((p) => { if (vivo) setTotaisAno(p.totais); })
      .catch((e) => { if (vivo) setErroAno(e?.response?.data?.erro ?? e.message); });
    return () => { vivo = false; };
  }, [intervalo.inicio, intervalo.fim, recusa]);

  useEffect(() => {
    let vivo = true;
    setErroEscada(''); setExEscada(null);
    if (recusa) return undefined;
    getExecutivo(intervalo.inicio, intervalo.fim, 'producao', 'COMPETENCIA')
      .then((r) => { if (vivo) setExEscada(r); })
      .catch((e) => { if (vivo) setErroEscada(e?.response?.data?.erro ?? e.message); });
    return () => { vivo = false; };
  }, [intervalo.inicio, intervalo.fim, recusa]);

  useEffect(() => {
    setErroCogumelo(''); setExCogumelo(null);
    const c = consultaDaMargemUnitaria(aba, intervalo);
    if (!c || recusa) return undefined;
    let vivo = true;
    getExecutivo(c.inicio, c.fim, 'producao', 'COMPETENCIA', 'PRODUCAO_COGUMELO')
      .then((r) => { if (vivo) setExCogumelo(r); })
      .catch((e) => { if (vivo) setErroCogumelo(e?.response?.data?.erro ?? e.message); });
    return () => { vivo = false; };
  }, [aba, intervalo.inicio, intervalo.fim, recusa]);

  useEffect(() => {
    setAvisoPimentao(''); setPimentao(null);
    getPimentaoConsolidado()
      .then(setPimentao)
      .catch((e) => setAvisoPimentao(e?.response?.data?.erro ?? e.message));
  }, []);

  const volumePorTipo = useMemo(() => volumeDoAnoPorTipo(totaisAno), [totaisAno]);

  const variedades = useMemo(
    () => linhasPorVariedade(ciclo, painel?.eficiencia.por_tipo ?? [], volumePorTipo),
    [ciclo, painel, volumePorTipo],
  );

  const geral = ciclo?.total_geral;
  const ef = painel?.eficiencia.total;
  const madura = painel != null && coorteMadura(periodo.fim, hojeISO(), painel.parametros.contaminacao_dias_comparavel);
  const kgAnoCard = rotuloDoKgAno({ erroAno, totaisAno });
  const kgLotesDoPeriodo = geral?.total_kg_colhidos ?? null;

  const pim = useMemo(() => {
    const linhas = pimentao ?? [];
    const soma = (f: (l: PimentaoConsolidadoLinha) => number | null | undefined) =>
      linhas.reduce((s, l) => s + (f(l) ?? 0), 0);
    const kg = soma((l) => l.total_kg);
    const perdas = soma((l) => l.perdas_kg);
    return {
      plantios: linhas.length,
      caixas: soma((l) => l.total_caixas),
      kg,
      perdas,
      pctPerdas: kg > 0 ? perdas / (kg + perdas) : null,
      plantado: soma((l) => l.total_plantado),
    };
  }, [pimentao]);

  const abas = (
    <div className="tabs" aria-label="Nível da produção">
      {ABAS_DA_PRODUCAO.map((a) => (
        <button key={a.chave} type="button" className={`tab ${aba === a.chave ? 'active' : ''}`} onClick={() => setAba(a.chave)}>{a.rotulo}</button>
      ))}
    </div>
  );
  if (recusa) return <>{abas}{filtro}<div className="empty">{recusa}</div></>;

  return (
    <>
      {abas}
      {filtro}

      {erroEscada ? <div className="empty">Financeiro da produção indisponível ({erroEscada})</div>
        : !exEscada ? (<><CardsDoAnoCarregando rotulo={ABAS_DA_PRODUCAO.find((a) => a.chave === aba)!.rotulo} />{aba === 'PRODUCAO' && <GraficosCarregando comComposicao={false} />}</>)
          : <FinanceiroDaProducao ex={exEscada} aba={aba} onTrocarAba={setAba} comProdutos={comProdutos}
              porQue={aba === 'COGUMELO' ? (
                <>
                  <PontoDeEquilibrioDaFrente ex={exCogumelo} comFisico recorte="do Cogumelo" erro={erroCogumelo} />
                  <EconomiaPorEspecie ex={exEscada} ciclo={variedades} />
                </>
              ) : undefined}
              detalhe={aba === 'COGUMELO' ? (
                <>
                  <MargemUnitariaDoCogumelo ex={exCogumelo} erro={erroCogumelo} />
                  <DetalheDasEspecies ex={exEscada} ciclo={variedades} rotuloCiclo={periodo.rotulo} />
                </>
              ) : undefined} />}

      {aba === 'COGUMELO' && (erro ? <div className="empty">Erro ao carregar o ciclo produtivo: {erro}</div>
        : !ciclo || !painel ? <div className="loading">Consolidando o ciclo produtivo…</div>
          : (
            <>
              <div className="kpi-grid k4">
                <Kpi label={`Kg colhidos: ${rotuloDaTela}`} value={kgAnoCard.value}
                  delta={kgAnoCard.delta ?? `lotes de ${periodo.rotulo}: ${num(kgLotesDoPeriodo, 1)} kg`} />
                <Kpi label="Taxa de Contaminação" value={fracPct(geral?.taxa_contaminacao)}
                  delta={madura ? `lotes de ${periodo.rotulo}`
                    : `lotes de ${periodo.rotulo}: coorte em observação, a taxa ainda sobe`}
                  tone={toneDaContaminacao(geral?.taxa_contaminacao, madura)} onClick={irAoCiclo} />
                <Kpi label="Taxa de Aproveitamento" value={fracPct(ef?.taxa_aproveitamento)}
                  delta="blocos abertos ÷ produzidos, nos lotes que já abriram" tone="info" onClick={irAoCiclo} />
                <Kpi label="Kg por Bloco Aberto" value={num(ef?.kg_por_bloco_aberto, 3)}
                  delta={`eficiência ${num(ef?.eficiencia_total, 3)} kg/bloco produzido`} onClick={irAoCiclo} />
              </div>

              <details className="detalhamento-da-gestao">
                <summary>Ver detalhamento do ciclo por variedade</summary>
                <Panel title="Cogumelos por Variedade" tag={periodo.rotulo}
                  sub={`Indicadores do ciclo por data do lote, no mês do topo; kg colhidos por data de colheita, em ${rotuloDaTela}`}>
                  {variedades.length === 0 ? (
                    <div className="empty">
                      Nenhum lote no período: lance os lotes na <b>Jornada do Cogumelo</b>.
                    </div>
                  ) : (
                    <>
                      <div className="tbl-scroll" style={{ maxHeight: 300 }}>
                        <table className="tbl">
                          <thead>
                            <tr>
                              <th>Variedade</th>
                              <th className="num">Kg no mês</th>
                              <th className="num">{`Kg colhidos (${rotuloDaTela})`}</th>
                              <th className="num">Contaminação</th>
                              <th className="num">Aproveitamento</th>
                              <th className="num">Kg/bloco aberto</th>
                              <th className="num">Datas de lote</th>
                            </tr>
                          </thead>
                          <tbody>
                            {variedades.map((v) => (
                              <tr key={v.tipo} className={toneDaContaminacao(v.contaminacao, madura) === 'alert' ? 'warn-row' : ''}>
                                <td><b>{v.nome}</b> <small style={{ color: 'var(--ink-soft)' }}>{v.tipo}</small></td>
                                <td className="num">{num(v.kgPeriodo, 1)}</td>
                                <td className="num">{num(v.kgAno, 1)}</td>
                                <td className="num">{fracPct(v.contaminacao)}</td>
                                <td className="num">{fracPct(v.aproveitamento)}</td>
                                <td className="num">{num(v.kgPorBloco, 3)}</td>
                                <td className="num">{v.lotes || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="chart-box" style={{ height: 260, marginTop: 12 }}>
                        <Bar
                          data={{
                            labels: variedades.map((v) => v.nome),
                            datasets: [
                              { label: `Kg colhidos (${rotuloDaTela})`, data: variedades.map((v) => v.kgAno ?? 0), backgroundColor: GOLD, borderRadius: 4 },
                            ],
                          }}
                          options={{ ...baseOpts, ...legB }}
                        />
                      </div>

                      <p className="obs-tela">
                        <b>Rendimento:</b> o &quot;rendimento por quilo&quot; ainda não tem
                        definição fechada. A tela mostra as duas medidas que existem hoje:{' '}
                        <b>Kg/bloco aberto</b> (kg colhidos ÷ blocos abertos) e a <b>eficiência</b> nos KPIs
                        (kg colhidos ÷ blocos produzidos). Falta definir qual das duas é a oficial.
                      </p>
                    </>
                  )}
                </Panel>
              </details>
            </>
          ))}

      {aba === 'PIMENTAO' && (
        <Panel title="Pimentão" tag={pim.plantios ? `${pim.plantios} plantios` : undefined}
          sub="Consolidado por plantio (safra): a planilha de origem não separa por mês">
          {avisoPimentao ? (
            <div className="empty">Dados do pimentão indisponíveis ({avisoPimentao}).</div>
          ) : !pimentao ? (
            <div className="loading">Carregando o pimentão…</div>
          ) : pim.plantios === 0 ? (
            <div className="empty">Nenhum plantio registrado.</div>
          ) : (
            <>
              <div className="kpi-grid k4">
                <Kpi label="Caixas Embaladas" value={num(pim.caixas)} />
                <Kpi label="Kg Embalados" value={num(pim.kg, 1)} />
                <Kpi label="Perdas" value={num(pim.perdas, 1)}
                  delta={pim.pctPerdas != null ? fracPct(pim.pctPerdas) : undefined}
                  tone={(pim.pctPerdas ?? 0) > 0.1 ? 'alert' : 'good'} />
                <Kpi label="Mudas Plantadas" value={num(pim.plantado)} />
              </div>
              <p className="obs-tela">
                O pimentão é consolidado por plantio (caixas e kg embalados), e os plantios da planilha vão de
                2023 a 2025: não cruzam com o período financeiro de 2026 exibido acima. Para
                acompanhar o pimentão mês a mês em 2026, os registros diários precisam ser lançados na
                tela <b>Indicadores Pimentão</b>.
              </p>
            </>
          )}
        </Panel>
      )}

      {!ehGestor && (
        <Panel title="Sobre este painel" sub="O que a frente de produção acompanha aqui">
          <ul style={{ fontSize: 12, color: 'var(--ink-soft)', paddingLeft: 18, lineHeight: 1.7 }}>
            <li>
              Os números vêm do que a própria produção lança: <b>Jornada do Cogumelo</b> (lotes,
              aberturas e colheitas), <b>Contaminados</b> e <b>Dados Embalagem</b>.
            </li>
            <li>
              O resultado financeiro da produção (receita, custos, despesas e margem) aparece no topo
              de cada aba, pela base nova do ERP; as análises de decisão sobre ele ficam com a
              gestão geral, no painel Gestão do Resultado.
            </li>
            <li>
              Encontrou número estranho? Confira primeiro o lançamento na Jornada: aproveitamento e
              kg por bloco contam só os lotes que já abriram com a quantidade anotada. Lote ainda em
              maturação não derruba a taxa, e abertura sem quantidade fica de fora dela.
            </li>
          </ul>
        </Panel>
      )}

      <Panel title="Como ler estes números" sub="Cada bloco tem uma base temporal diferente">
        <div className="tbl-scroll" style={{ maxHeight: 220 }}>
          <table className="tbl">
            <thead>
              <tr><th>Bloco</th><th>Base temporal</th><th>Origem</th></tr>
            </thead>
            <tbody>
              <tr>
                <td><b>Indicadores por variedade</b></td>
                <td>Data do <b>lote</b> (inoculação)</td>
                <td>Jornada do Cogumelo + Contaminados</td>
              </tr>
              <tr>
                <td><b>Kg colhidos</b></td>
                <td>Data da <b>colheita</b></td>
                <td>colheitas (Jornada do Cogumelo), por data da colheita, no período escolhido acima (MÊS, YTD, 12M ou Período)</td>
              </tr>
              <tr>
                <td><b>Pimentão</b></td>
                <td><b>Plantio</b> (safra, 2023 a 2025)</td>
                <td>Planilha Indicadores Pimentão</td>
              </tr>
              <tr>
                <td><b>Financeiro da produção</b></td>
                <td>Data de <b>competência</b></td>
                <td>base nova do ERP, por competência (o mesmo executivo da Visão Executiva)</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="obs-tela">
          Um bloco aberto hoje veio de um lote inoculado há ~140 dias. Por isso o mês corrente quase
          nunca tem aproveitamento nem kg por bloco: os lotes dele ainda estão em maturação, e a
          tela mostra travessão, não zero. Compare períodos longos, não dias soltos.
          {' '}<Pill tone="info">documentado</Pill>
        </p>
      </Panel>
    </>
  );
}
