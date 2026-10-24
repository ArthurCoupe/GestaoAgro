import { Fragment, useEffect, useState, type ReactNode } from 'react';
import {
  dataBr, fmPctFrac, getPainelContaminados, getRegrasMaturacao, hojeISO, num, rotuloDoGalpao,
  type ComparacaoPorPeriodo, type ContaminacaoDoLocal, type JanelaDoPeriodo, type PainelContaminadosResposta,
  type PainelOperacionalAlerta, type RankingDoPeriodo, type RegraMaturacao, type SemanaContaminacao,
} from '../api/client';
import { alertasDoDominio, ROTULO_TIPO, TONE_SEMAFORO, usePainelOperacional } from '../components/BlocosOperacionais';
import { QuadroDeAlertasExemplo, type CategoriaDeAlerta, type ItemDeAlerta } from '../components/QuadroDeAlertasExemplo';
import { Kpi, Panel, Pill, useNav } from '../components/ui';
import { useAuth } from '../auth';
import { rotuloDaOrigem } from './MetasOperacionais';
import { abrirInvestigadorNoLote, ANCORA_ALERTA_DE_RETIRADA } from './recadoDeContaminados';

const plural = (n: number, um: string, varios: string) => `${num(n)} ${n === 1 ? um : varios}`;
export const pctOuTraco = (v: number | null) => (v == null ? '—' : fmPctFrac(v));

export const rotuloDaMaturidade = (m: string) =>
  (m === 'EM_OBSERVACAO' ? 'Em observação' : m === 'SEM_DATA' ? 'Sem data' : '');

export function leituraDaSemana(l: { semaforo: string | null; maturidade: string }):
  { tipo: 'MATURIDADE' | 'SEMAFORO'; texto: string } {
  if (l.semaforo == null) return { tipo: 'MATURIDADE', texto: rotuloDaMaturidade(l.maturidade) };
  return { tipo: 'SEMAFORO', texto: l.semaforo.toLowerCase() };
}

export function textoDaMeta(resumo: { meta: number; meta_origem: string }): string {
  const origem = resumo.meta_origem === 'PADRAO' ? ` (${rotuloDaOrigem('PADRAO')})` : '';
  return `Meta ≤ ${fmPctFrac(resumo.meta)}${origem}`;
}

export const AVISO_CONTAGEM =
  'Foram retirados mais blocos do que o lote registra como produzidos. '
  + 'O número acima é a conta literal: o cadastro deste lote é que precisa de conferência.';

export const contagemInconsistente = (taxa: number | null): boolean => taxa != null && taxa > 1;

export function textoDosDoisLotes(r: {
  lotes_com_contaminacao: number; pct_lotes_afetados: number | null;
  enderecos: number; enderecos_com_contaminacao: number; pct_enderecos_afetados: number | null;
}): string {
  return `${r.lotes_com_contaminacao} com contaminação (${pctOuTraco(r.pct_lotes_afetados)})`
    + ` · ${r.enderecos_com_contaminacao} de ${r.enderecos} estantes (${pctOuTraco(r.pct_enderecos_afetados)})`;
}

export const toneDaRonda = (r: { pct_da_ronda: number }): 'bad' | 'warn' =>
  (r.pct_da_ronda >= 0.5 ? 'bad' : 'warn');

export const AVISO_RONDA_VAZIA = 'Nenhuma retirada passou do limite: nenhuma estante teve, numa única data, '
  + 'retirada por contaminação acima do limite de Metas e Limiares.';

export function textoDaVerificacao(v: { por: string; em: string } | null | undefined): string | null {
  if (!v) return null;
  const d = new Date(v.em);
  const fuso = { timeZone: 'America/Sao_Paulo' } as const;
  return `Verificado por ${v.por} em ${d.toLocaleDateString('pt-BR', { ...fuso, day: '2-digit', month: '2-digit' })} `
    + d.toLocaleTimeString('pt-BR', { ...fuso, hour: '2-digit', minute: '2-digit' });
}

export function textoDasOutrasEstantes(
  outras: Array<{ galpao: string | null; estante: string | null; pct_acumulado: number | null }> | undefined,
  regras: RegraMaturacao[],
): string {
  if (!outras?.length) return '—';
  return outras.map((o) => `estante ${o.estante ?? '—'}${o.galpao != null ? ` (${rotuloDoGalpao(o.galpao, regras)})` : ''} `
    + pctOuTraco(o.pct_acumulado)).join(' · ');
}

export const TEXTO_EIXO_FAIXAS = 'Tempo entre a produção do lote e a retirada do bloco contaminado.';

export function textoDaFaixa(f: { lancamentos: number; blocos: number; pct_blocos: number | null }): string {
  return `${plural(f.lancamentos, 'lançamento', 'lançamentos')} · ${num(f.blocos)} bloco(s) (${pctOuTraco(f.pct_blocos)})`;
}

export function NotaForaDasFaixas({ faixas }: { faixas: PainelContaminadosResposta['faixas'] }) {
  if (faixas.anteriores.lancamentos === 0 && faixas.sem_data_do_lote === 0) return null;
  const nasFaixas = faixas.faixas.reduce((s, f) => s + f.blocos, 0);
  const semData = faixas.sem_data_do_lote_blocos;
  const fora = faixas.anteriores.blocos + semData;
  return (
    <p className="nota">
      {faixas.anteriores.lancamentos > 0
        && `${plural(faixas.anteriores.lancamentos, 'lançamento', 'lançamentos')} (${plural(faixas.anteriores.blocos, 'bloco', 'blocos')}) com data de lançamento anterior à data de produção do lote (dado a conferir): fora das faixas acima. `}
      {faixas.sem_data_do_lote > 0
        && `${plural(faixas.sem_data_do_lote, 'lançamento', 'lançamentos')} (${plural(semData, 'bloco', 'blocos')}) sem data de produção do lote: também fora das faixas. `}
      {`Faixas ${num(nasFaixas)} + fora das faixas ${num(fora)} = ${plural(nasFaixas + fora, 'bloco contaminado rastreável', 'blocos contaminados rastreáveis')}.`}
    </p>
  );
}

function LeituraSemana({ l }: { l: SemanaContaminacao }) {
  const leitura = leituraDaSemana(l);
  if (leitura.tipo === 'MATURIDADE') return <span className="rotulo">{leitura.texto}</span>;
  return <Pill tone={TONE_SEMAFORO[l.semaforo as string] ?? 'neutral'}>{leitura.texto}</Pill>;
}

export function TabelaRastreabilidade({ r }: { r: PainelContaminadosResposta['rastreabilidade'] }) {
  const c = r.composicao;
  const corte = dataBr(r.corte);
  const linhas: Array<[string, number]> = c ? [
    ['Completos (os sete dados)', c.completos],
    [`Sem estante: importados da planilha de ${corte}`, c.sem_estante_importados],
    ['Sem estante: lançados no sistema', c.sem_estante_lancados],
    ['Sem cor', c.sem_cor],
    ['Sem maturação ou espécie no lote', c.sem_dado_do_lote],
  ] : [['Rastreáveis (a carga não trouxe a estante do registro)', r.rastreaveis]];
  if (r.ajuste_aplicado) {
    linhas.push([`Ajuste histórico sem lote (${num(r.ajuste_registros)} retiradas anteriores a ${corte})`, r.ajuste_historico]);
  }
  const visiveis = linhas.filter(([, blocos], i) => i === 0 || blocos > 0);
  return (
    <>
      <div className="fsec">Rastreabilidade dos contaminados</div>
      <div className="plan-wrap cp">
        <table className="plan cp">
          <thead>
            <tr>
              <th className="rotulo">Contaminados</th>
              <th className="num">Blocos</th>
            </tr>
          </thead>
          <tbody>
            {visiveis.map(([rotulo, blocos]) => (
              <tr key={rotulo}>
                <td className="rotulo">{rotulo}</td>
                <td className="num">{num(blocos)}</td>
              </tr>
            ))}
            <tr>
              <td className="rotulo"><strong>TOTAL</strong></td>
              <td className="num"><strong>{num(r.total)}</strong></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="empty">
        Cobertura de rastreabilidade: {pctOuTraco(r.cobertura)} dos contaminados com os sete dados (lote,
        maturação, estante, espécie, cor, quantidade e data da retirada).
        {c ? ' Cada bloco aparece numa linha só, pelo primeiro dado que falta, nesta ordem.' : ''}
        {r.ajuste_aplicado
          ? ' As demais tabelas desta página contam só os rastreáveis: o ajuste histórico não tem lote.'
          : ' O ajuste histórico não tem espécie e fica fora do filtro por espécie.'}
      </div>
    </>
  );
}

export function TabelaTaxaPorEspecie({ por_tipo }: {
  por_tipo: PainelContaminadosResposta['por_tipo'] | undefined;
}) {
  return (
    <>
      <div className="fsec">Taxa por espécie</div>
      {(por_tipo ?? []).length === 0 ? (
        <div className="empty">Nenhuma espécie no recorte.</div>
      ) : (
        <div className="plan-wrap">
          <table className="plan">
            <thead>
              <tr>
                <th className="rotulo">Espécie</th>
                <th className="num">Blocos produzidos</th>
                <th className="num">Blocos contaminados</th>
                <th className="num">Taxa</th>
                <th className="txt">Leitura</th>
              </tr>
            </thead>
            <tbody>
              {(por_tipo ?? []).map((t) => (
                <tr key={t.tipo}>
                  <td className="rotulo">{ROTULO_TIPO[t.tipo] ?? t.tipo}</td>
                  <td className="num">{num(t.blocos_produzidos)}</td>
                  <td className="num">{num(t.blocos_contaminados)}</td>
                  <td className="num">{pctOuTraco(t.taxa)}</td>
                  <td className="txt"><Pill tone={TONE_SEMAFORO[t.semaforo] ?? 'neutral'}>{t.semaforo.toLowerCase()}</Pill></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export const comSinal = (n: number) => (n > 0 ? `+${num(n)}` : n < 0 ? `-${num(-n)}` : '0');
export const intervaloDaJanela = (j: Pick<JanelaDoPeriodo, 'inicio' | 'fim'>) =>
  `${dataBr(j.inicio).slice(0, 5)} a ${dataBr(j.fim).slice(0, 5)}`;
export const textoDaVariacao = (p: Pick<ComparacaoPorPeriodo, 'variacao'>) =>
  (p.variacao == null ? 'sem retirada no período anterior'
    : `${p.variacao > 0 ? '+' : ''}${fmPctFrac(p.variacao)} sobre o período anterior`);
export function textoDoUltimoLancamento(p: Pick<ComparacaoPorPeriodo, 'ultimo_lancamento' | 'atual'>): string {
  if (p.ultimo_lancamento == null) return 'Nenhuma retirada por contaminação lançada até hoje.';
  const dias = Math.round((Date.parse(`${p.atual.fim}T00:00:00Z`) - Date.parse(`${p.ultimo_lancamento}T00:00:00Z`)) / 86400000);
  const data = `Última retirada lançada: ${dataBr(p.ultimo_lancamento)}`;
  if (dias <= 0) return `${data}.`;
  return `${data}, há ${plural(dias, 'dia', 'dias')}. Se houve retirada depois e ela ainda não foi lançada, `
    + 'o período atual está menor do que foi: ela entra na conta quando for lançada.';
}

export function TabelaDoPeriodo<T>({ p, ranking, colunas, celulas, nomeDosDemais }: {
  p: ComparacaoPorPeriodo;
  ranking: RankingDoPeriodo<T>;
  colunas: string[];
  celulas: (item: RankingDoPeriodo<T>['itens'][number]) => ReactNode[];
  nomeDosDemais: (n: number) => string;
}) {
  if (ranking.itens.length === 0) return <div className="empty">Nenhuma retirada por contaminação nos dois períodos.</div>;
  const classe = (i: number) => (i === 0 ? 'rotulo' : 'txt');
  const vazias = colunas.slice(1).map((c) => <td key={c} className="txt" />);
  return (
    <div className="plan-wrap cp">
      <table className="plan cp">
        <thead>
          <tr>
            {colunas.map((c, i) => <th key={c} className={classe(i)}>{c}</th>)}
            <th className="num">{intervaloDaJanela(p.atual)}</th>
            <th className="num">{intervaloDaJanela(p.anterior)}</th>
            <th className="num">Diferença</th>
          </tr>
        </thead>
        <tbody>
          {ranking.itens.map((item) => (
            <tr key={item.chave}>
              {celulas(item).map((c, i) => <td key={colunas[i]} className={classe(i)}>{c}</td>)}
              <td className="num">{num(item.atual)}</td>
              <td className="num">{num(item.anterior)}</td>
              <td className="num">{comSinal(item.atual - item.anterior)}</td>
            </tr>
          ))}
          {ranking.demais && (
            <tr>
              <td className="rotulo">{nomeDosDemais(ranking.demais.quantidade)}</td>{vazias}
              <td className="num">{num(ranking.demais.atual)}</td>
              <td className="num">{num(ranking.demais.anterior)}</td>
              <td className="num">{comSinal(ranking.demais.atual - ranking.demais.anterior)}</td>
            </tr>
          )}
          <tr className="ln-destaque">
            <td className="rotulo">TOTAL</td>{vazias}
            <td className="num">{num(p.atual.blocos)}</td>
            <td className="num">{num(p.anterior.blocos)}</td>
            <td className="num">{comSinal(p.diferenca)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export const subDaComparacaoPorPeriodo = (comPeriodo: boolean) => (comPeriodo
  ? 'Blocos retirados por contaminação, contados pela data da retirada, como "Onde está concentrado?" e o Top do período.'
  : 'Blocos retirados por contaminação, contados pela data da retirada. É o único quadro deste painel pela data da retirada: os outros contam pela data do lote.');

export function ComparacaoPorPeriodoPainel({ periodos, regras, comPeriodo = false }: {
  periodos: ComparacaoPorPeriodo[]; regras: RegraMaturacao[]; comPeriodo?: boolean;
}) {
  const [dias, setDias] = useState(periodos[0]?.dias);
  const p = periodos.find((x) => x.dias === dias) ?? periodos[0];
  if (!p) return null;
  const galpao = (g: string) => rotuloDoGalpao(g, regras);
  return (
    <Panel id="contaminados-periodo" title="Comparação por período"
      pergunta="A contaminação do último mês (ou dos últimos 15 dias) subiu ou caiu em relação ao período anterior? Em que galpão, estante e lote?"
      sub={subDaComparacaoPorPeriodo(comPeriodo)}>
      <div className="form-acao">
        {periodos.map((x) => (
          <button key={x.dias} className={x.dias === p.dias ? 'btn' : 'btn ghost'}
            onClick={() => setDias(x.dias)}>Últimos {x.dias} dias</button>
        ))}
      </div>
      <div className="kpi-grid k3">
        <Kpi label={`Últimos ${p.dias} dias`} value={num(p.atual.blocos)}
          delta={`${intervaloDaJanela(p.atual)} · ${plural(p.atual.lancamentos, 'lançamento', 'lançamentos')}`} />
        <Kpi label={`${p.dias} dias anteriores`} value={num(p.anterior.blocos)}
          delta={`${intervaloDaJanela(p.anterior)} · ${plural(p.anterior.lancamentos, 'lançamento', 'lançamentos')}`} />
        <Kpi label="Diferença" value={comSinal(p.diferenca)} delta={textoDaVariacao(p)} />
      </div>
      <p className="nota">{textoDoUltimoLancamento(p)}</p>

      <div className="fsec">Por galpão</div>
      <TabelaDoPeriodo p={p} ranking={p.galpoes} colunas={['Galpão']}
        celulas={(g) => [galpao(g.galpao)]} nomeDosDemais={(n) => plural(n, 'outro galpão', 'outros galpões')} />

      <div className="fsec">Por estante</div>
      <TabelaDoPeriodo p={p} ranking={p.estantes} colunas={['Galpão', 'Estante', 'Estante física']}
        celulas={(e) => [galpao(e.galpao), e.estante, e.estante_fisica ?? '']}
        nomeDosDemais={(n) => `Demais ${plural(n, 'estante', 'estantes')}`} />

      <div className="fsec">Por lote</div>
      <TabelaDoPeriodo p={p} ranking={p.lotes} colunas={['Lote', 'Tipo', 'Galpões']}
        celulas={(l) => [l.data_lote ? dataBr(l.data_lote) : '—', ROTULO_TIPO[l.tipo ?? ''] ?? l.tipo ?? '—',
          l.galpoes.map(galpao).join(', ') || '—']}
        nomeDosDemais={(n) => `Demais ${plural(n, 'lote', 'lotes')}`} />
    </Panel>
  );
}

export type ModoDoPeriodo = 'TUDO' | 'D30' | 'D15' | 'PERSONALIZADO';
const DIA_MS = 86400000;
export const menosDias = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) - n * DIA_MS).toISOString().slice(0, 10);

export function periodoDoModo(modo: ModoDoPeriodo, hoje: string, personalizado?: { inicio: string; fim: string }) {
  if (modo === 'D30') return { inicio: menosDias(hoje, 29), fim: hoje };
  if (modo === 'D15') return { inicio: menosDias(hoje, 14), fim: hoje };
  if (modo === 'PERSONALIZADO' && personalizado?.inicio && personalizado?.fim
    && personalizado.inicio <= personalizado.fim && personalizado.fim <= hoje) {
    return { ...personalizado };
  }
  return null;
}

export type MotivoPersonalizadoInvalido = 'INCOMPLETO' | 'DATA_INVALIDA' | null;

export function motivoDoPersonalizadoInvalido(
  personalizado: { inicio: string; fim: string }, hoje: string,
): MotivoPersonalizadoInvalido {
  if (!personalizado.inicio || !personalizado.fim) return 'INCOMPLETO';
  if (personalizado.inicio > personalizado.fim || personalizado.fim > hoje) return 'DATA_INVALIDA';
  return null;
}

export const MSG_PERSONALIZADO_INVALIDO = 'Escolha o início antes do fim, e o fim até hoje.';
export const MSG_PERSONALIZADO_INCOMPLETO =
  'Preencha as duas datas para filtrar. Mostrando “Desde o início” até lá.';

export function semanasParaExibir(semanas: SemanaContaminacao[], periodo: { inicio: string; fim: string } | null) {
  const noPeriodo = periodo ? semanas.filter((s) => s.inicio <= periodo.fim && s.fim >= periodo.inicio) : semanas;
  return [...noPeriodo].sort((a, b) => b.inicio.localeCompare(a.inicio));
}

export function SeletorDePeriodo({ modo, personalizado, hoje, onModo, onPersonalizado }: {
  modo: ModoDoPeriodo; personalizado: { inicio: string; fim: string }; hoje: string;
  onModo: (m: ModoDoPeriodo) => void; onPersonalizado: (p: { inicio: string; fim: string }) => void;
}) {
  const botoes: Array<[ModoDoPeriodo, string]> = [
    ['TUDO', 'Desde o início'], ['D30', 'Últimos 30 dias'], ['D15', 'Últimos 15 dias'], ['PERSONALIZADO', 'Personalizado'],
  ];
  return (
    <div className="form-acao">
      {botoes.map(([m, rotulo]) => (
        <button key={m} type="button" className={m === modo ? 'btn' : 'btn ghost'}
          aria-pressed={m === modo} onClick={() => onModo(m)}>{rotulo}</button>
      ))}
      {modo === 'PERSONALIZADO' && (
        <>
          <label>de <input type="date" value={personalizado.inicio} max={personalizado.fim || hoje}
            onChange={(e) => onPersonalizado({ ...personalizado, inicio: e.target.value })} /></label>
          <label>até <input type="date" value={personalizado.fim}
            min={personalizado.inicio || undefined} max={hoje}
            onChange={(e) => onPersonalizado({ ...personalizado, fim: e.target.value })} /></label>
        </>
      )}
    </div>
  );
}

export function PainelPeriodo({ modo, personalizado, hoje, onModo, onPersonalizado, erroDeCarga }: {
  modo: ModoDoPeriodo; personalizado: { inicio: string; fim: string }; hoje: string;
  onModo: (m: ModoDoPeriodo) => void; onPersonalizado: (p: { inicio: string; fim: string }) => void;
  erroDeCarga?: string;
}) {
  const motivo = modo === 'PERSONALIZADO' ? motivoDoPersonalizadoInvalido(personalizado, hoje) : null;
  return (
    <Panel title="Período" sub="O período vale para Onde está concentrado?, os lotes mais contaminados e as semanas de produção que caem no período.">
      <SeletorDePeriodo modo={modo} personalizado={personalizado} hoje={hoje} onModo={onModo} onPersonalizado={onPersonalizado} />
      {motivo && (
        <div className="empty">{motivo === 'DATA_INVALIDA' ? MSG_PERSONALIZADO_INVALIDO : MSG_PERSONALIZADO_INCOMPLETO}</div>
      )}
      {erroDeCarga && <div className="empty">Erro: {erroDeCarga}</div>}
    </Panel>
  );
}

export const NOTA_TAXA_DO_LOCAL = 'Taxa de contaminação do local no período = contaminados retirados no período '
  + 'dividido pela ocupação média (a soma dos blocos presentes em cada dia, dividida pelo número de dias). '
  + 'É diferente da taxa do lote. Passa de 100% quando a estante ficou ocupada só parte do período e perdeu muito nesse tempo.';
export const NOTA_OCUPACAO_A_CONFERIR = 'Ocupação a conferir: a contagem desta estante não fecha (divergência no '
  + 'Painel Operacional ou dado de abertura faltando), então a ocupação e a taxa dela podem estar distorcidas.';

const ocupacaoTxt = (o: number) => num(o, 1);
const marca = (d: boolean) => (d ? <> <Pill tone="warn">ocupação a conferir</Pill></> : null);

export function ConcentracaoNoPeriodo({ local, regras, abertoInicial = null }: {
  local: ContaminacaoDoLocal; regras: RegraMaturacao[]; abertoInicial?: string | null;
}) {
  const [aberto, setAberto] = useState<string | null>(abertoInicial);
  const galpao = (g: string) => rotuloDoGalpao(g, regras);
  return (
    <>
      <div className="plan-wrap cp">
        <table className="plan cp">
          <thead>
            <tr>
              <th className="rotulo">Galpão / estante</th>
              <th className="txt">Estante física</th>
              <th className="num">Contaminados no período</th>
              <th className="num">Blocos-dia</th>
              <th className="num">Ocupação média</th>
              <th className="num">Taxa do local no período</th>
            </tr>
          </thead>
          {local.galpoes.map((g) => {
            const abertoAqui = aberto === g.galpao;
            const idEstantes = `concentracao-estantes-${g.chave}`;
            return (
              <Fragment key={g.chave}>
                <tbody>
                  <tr className="ln-destaque">
                    <td className="rotulo">
                      <button type="button" className="gr-toggle" aria-expanded={abertoAqui} aria-controls={idEstantes}
                        onClick={() => setAberto(abertoAqui ? null : g.galpao)}>
                        <span className="gr-caret">{abertoAqui ? '▾' : '▸'}</span> {galpao(g.galpao)}
                      </button>
                      {marca(g.divergencia)}
                    </td>
                    <td className="txt" />
                    <td className="num">{num(g.contaminados)}</td>
                    <td className="num">{num(g.bloco_dias)}</td>
                    <td className="num">{ocupacaoTxt(g.ocupacao_media)}</td>
                    <td className="num">{pctOuTraco(g.taxa)}</td>
                  </tr>
                </tbody>
                {abertoAqui && (
                  <tbody id={idEstantes}>
                    {g.estantes.map((e) => (
                      <tr key={e.chave}>
                        <td className="rotulo">Estante {e.estante}{marca(e.divergencia)}</td>
                        <td className="txt">{e.estante_fisica ?? ''}</td>
                        <td className="num">{num(e.contaminados)}</td>
                        <td className="num">{num(e.bloco_dias)}</td>
                        <td className="num">{ocupacaoTxt(e.ocupacao_media)}</td>
                        <td className="num">{pctOuTraco(e.taxa)}</td>
                      </tr>
                    ))}
                  </tbody>
                )}
              </Fragment>
            );
          })}
          <tbody>
            <tr className="ln-destaque">
              <td className="rotulo">TOTAL</td><td className="txt" />
              <td className="num">{num(local.total.contaminados)}</td>
              <td className="num">{num(local.total.bloco_dias)}</td>
              <td className="num">{ocupacaoTxt(local.total.ocupacao_media)}</td>
              <td className="num">{pctOuTraco(local.total.taxa)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      {local.sem_lote.eventos > 0 && (
        <p className="nota">
          {`Mais ${num(local.sem_lote.contaminados)} blocos contaminados retirados no período sem lote informado. `
            + 'Não entram em nenhuma estante nem no total.'}
        </p>
      )}
      {local.pesquisa.eventos > 0 && (
        <p className="nota">
          {`Mais ${num(local.pesquisa.contaminados)} blocos contaminados retirados no período de lotes de pesquisa. `
            + 'Não entram em nenhuma estante nem no total.'}
        </p>
      )}
      <p className="nota">{NOTA_TAXA_DO_LOCAL}</p>
      {local.total.divergencia && <p className="nota">{NOTA_OCUPACAO_A_CONFERIR}</p>}
      <p className="nota">{local.ultimo_lancamento
        ? `Última retirada lançada no período: ${dataBr(local.ultimo_lancamento)}.`
        : 'Nenhuma retirada por contaminação lançada no período.'}</p>
    </>
  );
}

export function TopDoPeriodo({ local, regras }: { local: ContaminacaoDoLocal; regras: RegraMaturacao[] }) {
  void regras;
  if (local.lotes.length === 0) return <div className="empty">Nenhum lote com contaminado retirado no período.</div>;
  return (
    <div className="plan-wrap cp">
      <table className="plan cp">
        <thead>
          <tr>
            <th className="rotulo">Lote</th>
            <th className="txt">Tipo</th>
            <th className="num">Contaminados no período</th>
            <th className="num">Taxa do lote</th>
          </tr>
        </thead>
        <tbody>
          {local.lotes.map((l) => (
            <tr key={l.chave}>
              <td className="rotulo">{l.data_lote ? dataBr(l.data_lote) : '—'}</td>
              <td className="txt">{ROTULO_TIPO[l.tipo ?? ''] ?? l.tipo ?? '—'}</td>
              <td className="num">{num(l.contaminados)}</td>
              <td className="num">
                {pctOuTraco(l.taxa_do_lote ?? null)}
                {contagemInconsistente(l.taxa_do_lote ?? null) && (
                  <> <Pill tone="bad">contagem inconsistente</Pill></>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export type EstadoDoCorpo = 'ERRO_TELA_CHEIA' | 'ERRO_INLINE' | 'CARREGANDO' | 'CONTEUDO';

export function estadoDoCorpo(dados: unknown, erro: string, tocou: boolean): EstadoDoCorpo {
  if (dados) return 'CONTEUDO';
  if (!erro) return 'CARREGANDO';
  return tocou ? 'ERRO_INLINE' : 'ERRO_TELA_CHEIA';
}

export function leituraDoTermometro(estado: string): { tone: 'ok' | 'warn' | 'bad' | 'neutral'; rotulo: string; frase: string } {
  if (estado === 'NORMAL') return { tone: 'ok', rotulo: 'dentro do padrão', frase: 'As semanas recentes estão dentro do padrão.' };
  if (estado === 'EVENTO_PONTUAL') return { tone: 'warn', rotulo: 'atenção', frase: 'Houve um pico numa semana, sem repetição.' };
  if (estado === 'TENDENCIA_DE_PIORA') return { tone: 'bad', rotulo: 'piorando', frase: 'Acima do padrão em semanas seguidas.' };
  if (estado === 'EM_OBSERVACAO') return { tone: 'neutral', rotulo: 'em observação', frase: 'As semanas recentes ainda não têm idade para comparar.' };
  return { tone: 'neutral', rotulo: 'sem dado', frase: 'Ainda não há dado suficiente para a leitura.' };
}

export function TermometroCompacto({ tendencia }: { tendencia: PainelContaminadosResposta['tendencia'] }) {
  const t = leituraDoTermometro(tendencia.estado);
  return (
    <Panel title="Termômetro" sub="A contaminação por semana de produção está piorando?">
      <details>
        <summary><Pill tone={t.tone}>{t.rotulo}</Pill> {t.frase}</summary>
        <p className="nota">{tendencia.frase}</p>
      </details>
    </Panel>
  );
}

export function categoriasDosAlertasDeContaminacao(alertas: PainelOperacionalAlerta[]): CategoriaDeAlerta[] {
  const baldes = { TAXA_ALTA: [] as ItemDeAlerta[], CONTAGEM: [] as ItemDeAlerta[] };
  let maiorTaxa = 0;
  alertas.filter((a) => a.tipo === 'CONTAMINACAO_CRITICA').forEach((a, i) => {
    const d = (a.detalhe ?? {}) as { lote?: string; tipo?: string; blocos_contaminados?: number; total_blocos?: number | null; pct?: number; inconsistente?: boolean };
    const [data] = String(d.lote ?? '').split('|');
    const item: ItemDeAlerta = {
      chave: `${d.lote ?? i}|${i}`,
      nivel: a.severidade === 'VERMELHO' ? 'CRITICO' : 'ATENCAO',
      celulas: [data ? dataBr(data) : '—', ROTULO_TIPO[d.tipo ?? ''] ?? d.tipo ?? '—',
        `${num(d.blocos_contaminados ?? 0)} de ${d.total_blocos == null ? '—' : num(d.total_blocos)}`,
        d.inconsistente ? 'contagem não fecha' : fmPctFrac(d.pct ?? 0)],
      detalhe: a.mensagem,
    };
    if (d.inconsistente) { baldes.CONTAGEM.push(item); return; }
    baldes.TAXA_ALTA.push(item);
    if ((d.pct ?? 0) > maiorTaxa) maiorTaxa = d.pct ?? 0;
  });
  const nivel = (itens: ItemDeAlerta[]) => (itens.some((x) => x.nivel === 'CRITICO') ? 'CRITICO' as const : 'ATENCAO' as const);
  return [
    { chave: 'TAXA_ALTA', titulo: 'Contaminação acima do limite', descricao: 'Lotes com a taxa do lote no vermelho',
      nivel: nivel(baldes.TAXA_ALTA), itens: baldes.TAXA_ALTA, impacto: baldes.TAXA_ALTA.length ? fmPctFrac(maiorTaxa) : null },
    { chave: 'CONTAGEM', titulo: 'Contagem inconsistente', descricao: 'Mais blocos retirados do que produzidos',
      nivel: nivel(baldes.CONTAGEM), itens: baldes.CONTAGEM, impacto: null },
  ].filter((c) => c.itens.length > 0);
}

function AcoesDoDiaDaContaminacao() {
  const { dados, erro } = usePainelOperacional();
  if (erro) return <div className="empty">Ações do dia indisponíveis: {erro}</div>;
  if (!dados) return <p className="nota">Carregando ações do dia…</p>;
  const categorias = categoriasDosAlertasDeContaminacao(alertasDoDominio(dados.alertas, 'CONTAMINADOS'));
  if (categorias.length === 0) return <Panel title="Ações do dia" sub="Contaminação"><div className="empty">Nenhum lote em contaminação crítica hoje.</div></Panel>;
  return (
    <QuadroDeAlertasExemplo title="Ações do dia" sub="Contaminação" categorias={categorias}
      colunas={['Lote', 'Tipo', 'Contaminados', 'Taxa do lote']} rotuloDoItem={['lote', 'lotes']}
      tituloDosMotivos="Principais motivos" />
  );
}

export function BotaoInvestigar({ role, onAbrir }: { role: string | null | undefined; onAbrir: () => void }) {
  if (role !== 'GESTAO_GERAL') return null;
  return (
    <div className="form-acao">
      <button type="button" className="btn" onClick={onAbrir}>Investigar contaminação</button>
    </div>
  );
}

export function PainelContaminados() {
  const { usuario } = useAuth();
  const navegar = useNav();
  return (
    <>
      <BotaoInvestigar role={usuario?.role} onAbrir={() => navegar('investigador_contaminacao')} />
      <div id="contaminados-topo"><AcoesDoDiaDaContaminacao /></div>
      <CorpoPainelContaminados />
    </>
  );
}

export function ConteudoDoPainel({ dados, regras, periodo, onInvestigarLote }: {
  dados: PainelContaminadosResposta; regras: RegraMaturacao[]; periodo: { inicio: string; fim: string } | null;
  onInvestigarLote?: (lote: string) => void;
}) {
  const { semanas, galpoes, por_tipo, top, resumo, escopo, rondas, faixas, periodos, local, rastreabilidade } = dados;
  const acimaDaMeta = rastreabilidade.taxa_geral != null && rastreabilidade.taxa_geral > resumo.meta;

  return (
    <>
      <Panel id="contaminados-resumo" title="Painel de Contaminados"
        sub="Termômetro da contaminação por semana de produção: quanto, se piorou, desde quando e onde">
        <div className="kpi-grid k4">
          <Kpi label="Taxa geral desde o início" value={pctOuTraco(rastreabilidade.taxa_geral)}
            delta={`${textoDaMeta(resumo)}${acimaDaMeta ? ' (acima da meta)' : ''}. Só os rastreáveis: ${pctOuTraco(resumo.taxa)}`}
            tone={acimaDaMeta ? 'alert' : undefined} />
          <Kpi label="Blocos produzidos" value={num(resumo.blocos_produzidos)} />
          <Kpi label="Total de contaminados" value={num(rastreabilidade.total)}
            delta={rastreabilidade.ajuste_aplicado
              ? `${num(rastreabilidade.rastreaveis)} rastreáveis + ${num(rastreabilidade.ajuste_historico)} do ajuste histórico`
              : `${num(rastreabilidade.rastreaveis)} rastreáveis, sem o ajuste histórico`} />
          <Kpi label="Lotes de inoculação" value={plural(resumo.lotes, 'lote', 'lotes')}
            delta={textoDosDoisLotes(resumo)} />
        </div>

        <TabelaRastreabilidade r={rastreabilidade} />
        <TabelaTaxaPorEspecie por_tipo={por_tipo} />
      </Panel>

      <ComparacaoPorPeriodoPainel periodos={periodos} regras={regras} comPeriodo={local != null} />

      <Panel title="Contaminação por semana de produção"
        sub="A semana é a do LOTE, não a da retirada: mede de qual geração de produção vêm os contaminados">
        {semanas.length === 0 ? (
          <div className="empty">Nenhuma semana com lote produzido.</div>
        ) : (
          <div className="plan-wrap">
            <table className="plan">
              <thead>
                <tr>
                  <th className="rotulo">Semana</th>
                  <th className="num">Lotes</th>
                  <th className="num">Com contaminação</th>
                  <th className="num">Blocos produzidos</th>
                  <th className="num">Blocos contaminados</th>
                  <th className="num">Taxa</th>
                  <th className="rotulo">Leitura</th>
                </tr>
              </thead>
              <tbody>
                {semanasParaExibir(semanas, periodo).map((l) => (
                  <tr key={l.semana}>
                    <td className="rotulo">{l.rotulo}</td>
                    <td className="num">{num(l.lotes)}</td>
                    <td className="num">{num(l.lotes_com_contaminacao)}</td>
                    <td className="num">{num(l.blocos_produzidos)}</td>
                    <td className="num">{num(l.blocos_contaminados)}</td>
                    <td className="num">{pctOuTraco(l.taxa)}</td>
                    <td className="rotulo"><LeituraSemana l={l} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel id={ANCORA_ALERTA_DE_RETIRADA} title="Alerta de Retirada Acima do Limite"
        tag={`${rondas.length} retirada${rondas.length === 1 ? '' : 's'}`}
        sub={`Os blocos retirados por contaminação de uma estante numa única data, acima do limite${rondas[0]?.limite != null ? ` de ${fmPctFrac(rondas[0].limite)}` : ''} de Metas e Limiares. O alerta chega no dia seguinte ao lançamento: não é tempo real.`}>
        {rondas.length === 0 ? (
          <div className="empty">{AVISO_RONDA_VAZIA}</div>
        ) : (
          <div className="plan-wrap">
            <table className="plan">
              <thead>
                <tr>
                  <th className="rotulo">Data da retirada</th>
                  <th className="txt">Galpão</th>
                  <th className="txt">Estante</th>
                  <th className="num">Retirados / produzidos</th>
                  <th className="num">Nesta retirada</th>
                  <th className="num">Acumulado da estante</th>
                  <th className="txt">Demais estantes do lote</th>
                  <th className="num">Dias desde</th>
                  <th className="txt">Verificado</th>
                  {onInvestigarLote && <th className="txt">Investigar</th>}
                </tr>
              </thead>
              <tbody>
                {rondas.map((r) => (
                  <tr key={`${r.lote_id}|${r.data_ronda}`}>
                    <td className="rotulo">{dataBr(r.data_ronda)}</td>
                    <td className="txt">{r.galpao != null ? rotuloDoGalpao(r.galpao, regras) : '—'}</td>
                    <td className="txt">{r.estante ?? '—'}</td>
                    <td className="num">
                      {num(r.blocos_na_ronda)} / {r.blocos_produzidos == null ? '—' : num(r.blocos_produzidos)}
                    </td>
                    <td className="num"><Pill tone={toneDaRonda(r)}>{fmPctFrac(r.pct_da_ronda)}</Pill></td>
                    <td className="num">{fmPctFrac(r.pct_acumulado)}</td>
                    <td className="txt">{textoDasOutrasEstantes(r.outras_estantes, regras)}</td>
                    <td className="num">{r.dias_desde == null ? '—' : num(r.dias_desde)}</td>
                    <td className="txt">{textoDaVerificacao(r.verificacao) ?? '—'}</td>
                    {onInvestigarLote && (
                      <td className="txt">
                        {r.data_lote && r.tipo && (
                          <button type="button" className="btn ghost" onClick={() => onInvestigarLote(`${r.data_lote}|${r.tipo}`)}
                            aria-label={`Abrir no Investigador: ${r.estante ? `estante ${r.estante}` : `lote ${r.lote_id}`}, retirada de ${dataBr(r.data_ronda)}`}>
                            Abrir no Investigador
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Tempo entre produção e retirada do contaminado" sub={TEXTO_EIXO_FAIXAS}>
        {faixas.base.lancamentos === 0 ? (
          <div className="empty">Nenhum lançamento de contaminação no período.</div>
        ) : (
          <div className="plan-wrap">
            <table className="plan">
              <thead>
                <tr>
                  <th className="rotulo">Faixa</th>
                  <th className="rotulo">Leitura</th>
                </tr>
              </thead>
              <tbody>
                {faixas.faixas.map((f) => (
                  <tr key={f.chave}>
                    <td className="rotulo">{f.rotulo}</td>
                    <td className="rotulo">{textoDaFaixa(f)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <NotaForaDasFaixas faixas={faixas} />
      </Panel>

      <Panel title="Onde está concentrado?"
        sub={local
          ? 'Contaminados retirados no período e a taxa do local, maior primeiro. Clique no galpão para ver as estantes.'
          : 'Taxa por galpão: um lote espalhado por dois galpões entra inteiro nos dois (não há rateio por endereço)'}>
        {local ? (
          <ConcentracaoNoPeriodo local={local} regras={regras} />
        ) : galpoes.length === 0 ? (
          <div className="empty">Nenhum galpão com lote produzido.</div>
        ) : (
          <div className="plan-wrap">
            <table className="plan">
              <thead>
                <tr>
                  <th className="rotulo">Galpão</th>
                  <th className="num">Lotes</th>
                  <th className="num">Blocos produzidos</th>
                  <th className="num">Blocos contaminados</th>
                  <th className="num">Taxa</th>
                  <th className="rotulo">Leitura</th>
                </tr>
              </thead>
              <tbody>
                {galpoes.map((g, i) => (
                  <tr key={g.galpao} className={i === 0 ? 'ln-destaque' : ''}>
                    <td className="rotulo">{rotuloDoGalpao(g.galpao, regras)}</td>
                    <td className="num">{num(g.lotes)}</td>
                    <td className="num">{num(g.blocos_produzidos)}</td>
                    <td className="num">{num(g.blocos_contaminados)}</td>
                    <td className="num">{pctOuTraco(g.taxa)}</td>
                    <td className="rotulo"><Pill tone={TONE_SEMAFORO[g.semaforo] ?? 'neutral'}>{g.semaforo.toLowerCase()}</Pill></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel id="contaminados-top10" title="Lotes mais contaminados (Top 10)"
        sub={local
          ? 'Os lotes com mais blocos contaminados retirados no período. A taxa do lote é a de sempre: contaminados do lote dividido por produzidos.'
          : 'Ordenado por TAXA, não por quantidade: lotes de tamanhos diferentes distorceriam a comparação'}>
        {local ? (
          <TopDoPeriodo local={local} regras={regras} />
        ) : top.length === 0 ? (
          <div className="empty">Nenhum lote com contaminação registrada.</div>
        ) : (
          <div className="plan-wrap">
            <table className="plan">
              <thead>
                <tr>
                  <th className="num">#</th>
                  <th className="rotulo">Lote</th>
                  <th className="rotulo">Tipo</th>
                  <th className="rotulo">Galpões</th>
                  <th className="num">Blocos produzidos</th>
                  <th className="num">Blocos contaminados</th>
                  <th className="num">Taxa</th>
                  <th className="rotulo">Leitura</th>
                </tr>
              </thead>
              <tbody>
                {top.map((l) => (
                  <tr key={l.chave}>
                    <td className="num">{l.rank}</td>
                    <td className="rotulo">{dataBr(l.data_lote)}</td>
                    <td className="rotulo">{ROTULO_TIPO[l.tipo] ?? l.tipo}</td>
                    <td className="rotulo">{l.galpoes.map((g) => rotuloDoGalpao(g, regras)).join(', ') || '—'}</td>
                    <td className="num">{l.blocos_produzidos == null ? '—' : num(l.blocos_produzidos)}</td>
                    <td className="num">{num(l.blocos_contaminados)}</td>
                    <td className="num">{fmPctFrac(l.taxa_contaminacao)}</td>
                    <td className="rotulo">
                      <Pill tone={TONE_SEMAFORO[l.semaforo] ?? 'neutral'}>{l.semaforo.toLowerCase()}</Pill>
                      {l.contagem_inconsistente && (
                        <> <Pill tone="bad">contagem inconsistente</Pill></>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {(local ? local.lotes.some((l) => contagemInconsistente(l.taxa_do_lote ?? null)) : top.some((l) => l.contagem_inconsistente)) && (
          <p className="nota"><strong>Contagem inconsistente.</strong> {AVISO_CONTAGEM}</p>
        )}

        <p className="nota">
          <strong>O que este painel não cobre.</strong>{' '}
          {escopo.fora.map((item, i) => (
            <span key={item}>{item}{i < escopo.fora.length - 1 ? '; ' : '.'}</span>
          ))}
        </p>
      </Panel>
    </>
  );
}

function CorpoPainelContaminados() {
  const { usuario } = useAuth();
  const navegar = useNav();
  const investigarLote = usuario?.role === 'GESTAO_GERAL'
    ? (lote: string) => { abrirInvestigadorNoLote(lote); navegar('investigador_contaminacao'); }
    : undefined;
  const [dados, setDados] = useState<PainelContaminadosResposta | null>(null);
  const [erro, setErro] = useState('');

  const [modo, setModo] = useState<ModoDoPeriodo>('TUDO');
  const [personalizado, setPersonalizado] = useState({ inicio: '', fim: '' });
  const [tocou, setTocou] = useState(false);
  const hoje = hojeISO();
  const periodo = periodoDoModo(modo, hoje, personalizado);

  useEffect(() => {
    let vivo = true;
    setErro(''); setDados(null);
    getPainelContaminados(periodo ? { inicio: periodo.inicio, fim: periodo.fim } : {})
      .then((r) => { if (vivo) setDados(r); })
      .catch((e) => { if (vivo) setErro(e?.response?.data?.erro ?? e.message); });
    return () => { vivo = false; };
  }, [periodo?.inicio, periodo?.fim]);

  const [regras, setRegras] = useState<RegraMaturacao[]>([]);
  useEffect(() => { getRegrasMaturacao().then(setRegras).catch(() => setRegras([])); }, []);

  const estado = estadoDoCorpo(dados, erro, tocou);
  if (estado === 'ERRO_TELA_CHEIA') return <div className="empty">Erro: {erro}</div>;

  return (
    <>
      {dados && <TermometroCompacto tendencia={dados.tendencia} />}
      <PainelPeriodo modo={modo} personalizado={personalizado} hoje={hoje}
        onModo={(m) => { setTocou(true); setModo(m); }}
        onPersonalizado={(p) => { setTocou(true); setPersonalizado(p); }}
        erroDeCarga={estado === 'ERRO_INLINE' ? erro : undefined} />

      {dados ? (
        <ConteudoDoPainel dados={dados} regras={regras} periodo={periodo} onInvestigarLote={investigarLote} />
      ) : estado === 'CARREGANDO' ? (
        <div className="loading">Montando o painel de contaminados…</div>
      ) : null}
    </>
  );
}
