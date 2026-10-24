import { useState, type ReactNode } from 'react';
import { Chart } from 'react-chartjs-2';
import type { ChartData } from 'chart.js';
import { comUmaCasa, dataBr, galpaoCurto, num, pct, rotuloDoGalpao, variacaoEmPontos } from '../api/client';
import type {
  CapacidadeLivre, CapacidadeSala, ColheitaDaSala, ColheitaEmbalagemBloco, IndicadorDoPainel, RankingsDoPainel, IndicadoresDoPainel, LoteComparavel, NomeDoIndicador, PainelOperacionalAberturaLinha, PontoDaQualidade,
  PainelOperacionalAlerta, PainelOperacionalContaNaoFecha, PainelOperacionalEstanteEstourada, PainelOperacionalDivergenciaLote,
  PainelOperacionalResposta, PeriodoDoPainel, SementeFora, UltimosLancamentosDaMaturacao,
} from '../api/client';
import { hojeISO } from '../api/constantes';
import { DIAS_DE_COLHEITA_DA_ESTANTE } from '../../../src/services/etapaDoLote.js';
import type { ViewId } from '../auth';
import { pontosPercentuais } from '../components/gestao/ResumoDaMeta';
import { AMBER, BLUE, GOLD, GOLDS, OLIVEDK } from '../charts/setup';
import { rotuloDoMesCurto } from '../components/EvolucaoMensal';
import { abrirJornadaEm } from './JornadaCogumelo';
import {
  alertasDoDominio, chaveDoAlerta, formatarNumero, ORDEM_TIPO, ROTULO_TIPO, rotuloAlerta, usePainelOperacional,
} from '../components/BlocosOperacionais';
import { Kpi, Panel, useNav } from '../components/ui';
import {
  QuadroDeAlertasExemplo, type CategoriaDeAlerta, type ItemDeAlerta,
} from '../components/QuadroDeAlertasExemplo';
import {
  SEM_FILTRO, contarSemPacotes, filtrarProdutividade, filtrarQualidade, filtroAtivo, kgPorPacote, opcoesDosFiltros, porSemente,
  type FiltroDosRankings, type ForaDoFiltro, type NivelDaSemente,
} from './filtrosDosRankings';

export function blocosVisiveis<T extends { bloco: string }>(semDado: T[]): T[] {
  return semDado;
}

const kg1 = (v: number | null) => (
  v == null ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
);

const pctDoDia = (v: number, total: number | null) => (
  !total ? '—' : `${Math.round((v / total) * 100)} %`
);

export function ColheitaResumoDoDia({ colheita }: {
  colheita: {
    kg_hoje: number | null;
    kg_hoje_por_faixa: { PP?: number; P: number; M: number; G: number; GG: number } | null;
    kg_hoje_por_tipo: { SH: number; SB: number; SP: number; SS: number } | null;
  };
}) {
  const faixa = colheita.kg_hoje_por_faixa;
  const semFaixa = faixa && colheita.kg_hoje != null
    ? Math.round((colheita.kg_hoje - (faixa.PP ?? 0) - faixa.P - faixa.M - faixa.G - faixa.GG) * 100) / 100
    : 0;
  return (
    <>
      {faixa && (
        <div className="obs-tela">
          {`Hoje: ${kg1(colheita.kg_hoje)} kg · `
            + (faixa.PP ? `PP ${pctDoDia(faixa.PP, colheita.kg_hoje)} · ` : '')
            + `P ${pctDoDia(faixa.P, colheita.kg_hoje)} · `
            + `M ${pctDoDia(faixa.M, colheita.kg_hoje)} · `
            + `G ${pctDoDia(faixa.G, colheita.kg_hoje)} · `
            + `GG ${pctDoDia(faixa.GG, colheita.kg_hoje)}`
            + (semFaixa > 0 ? ` · sem faixa ${pctDoDia(semFaixa, colheita.kg_hoje)}` : '')}
        </div>
      )}
      {colheita.kg_hoje_por_tipo && (
        <div className="obs-tela">
          {(['SH', 'SB', 'SP', 'SS'] as const)
            .map((tipo) => `${ROTULO_TIPO[tipo]} ${kg1(colheita.kg_hoje_por_tipo![tipo])} kg`)
            .join(' · ')}
        </div>
      )}
    </>
  );
}

export function lotesEmMaturacao(n: number | null | undefined): string {
  return `${formatarNumero(n)} ${n === 1 ? 'lote' : 'lotes'} em maturação`;
}

type DatasDosLancamentos = PainelOperacionalResposta['ultimos_lancamentos'] | UltimosLancamentosDaMaturacao | null;
const dataCurta = (x: string | null) => (x ? dataBr(x).slice(0, 5) : '—');

export const soDoTipo = (tipo: string | null | undefined): string => (tipo ? `, só ${ROTULO_TIPO[tipo] ?? tipo}` : '');

export function ultimoLancamento(u: DatasDosLancamentos, tipo?: string | null): string {
  if (!u) return '';
  return `último lançamento${tipo ? ', em todos os tipos' : ''}: produção ${dataCurta(u.producao)}, abertura ${dataCurta(u.abertura)}, retirada ${dataCurta(u.retirada)}`;
}

const posicaoDe = (hoje: string, recorte: string, lancamento: string) =>
  `Posição de ${dataBr(hoje)}${recorte}${lancamento ? `, calculada sobre o que foi lançado (${lancamento})` : ''}.`;

export function fraseDaPosicao(hoje: string, u: DatasDosLancamentos, tipo?: string | null): string {
  return posicaoDe(hoje, soDoTipo(tipo), ultimoLancamento(u, tipo));
}

export function fraseDaFila(hoje: string, u: DatasDosLancamentos, tipo?: string | null): string {
  return posicaoDe(hoje, '', ultimoLancamento(u, tipo));
}

export function fraseDaCapacidade(hoje: string, u: DatasDosLancamentos, tipo?: string | null): string {
  return posicaoDe(hoje, tipo ? `, de todos os tipos, não só ${ROTULO_TIPO[tipo] ?? tipo}` : '', ultimoLancamento(u));
}

export function KpiAberturasUrgentes({ cabecalho, onClick }: {
  cabecalho: Pick<PainelOperacionalResposta['cabecalho'], 'aberturas_urgentes' | 'aberturas_vencidas' | 'aberturas_vencem_hoje'>;
  onClick?: () => void;
}) {
  return (
    <Kpi label="Aberturas Urgentes" value={formatarNumero(cabecalho.aberturas_urgentes)} onClick={onClick}
      tone={cabecalho.aberturas_urgentes > 0 ? 'alert' : 'good'}
      delta={`endereços: ${formatarNumero(cabecalho.aberturas_vencidas)} vencidos + ${formatarNumero(cabecalho.aberturas_vencem_hoje)} vencem hoje`} />
  );
}

const divergenciaDo = (a: PainelOperacionalAlerta) =>
  (a.tipo === 'DIVERGENCIA_CONTAGEM' && a.detalhe != null ? a.detalhe as unknown as PainelOperacionalDivergenciaLote : null);

export function ordenarPorGravidade(alertas: PainelOperacionalAlerta[]) {
  const tamanho = (a: PainelOperacionalAlerta) => Math.abs(divergenciaDo(a)?.sobra ?? 0);
  return alertas.map((a, i) => ({ a, i }))
    .sort((x, y) => (x.a.severidade === y.a.severidade ? 0 : x.a.severidade === 'VERMELHO' ? -1 : 1)
      || tamanho(y.a) - tamanho(x.a) || x.i - y.i);
}

export function detalheDoAlerta(a: PainelOperacionalAlerta): string {
  const d = divergenciaDo(a);
  if (!d || d.sobra == null || d.blocos_produzidos == null || d.blocos_abertos == null) return a.mensagem;
  const perdas = (d.blocos_perdidos ?? 0) > 0 ? ` − ${num(d.blocos_perdidos!)} perdas` : '';
  return `${num(d.blocos_produzidos)} produzidos − ${num(d.blocos_contaminados)} contaminados − ${num(d.blocos_abertos)} abertos`
    + `${perdas} = sobra de ${num(d.sobra)}.`;
}

const diferencaComSinal = (n: number) => (n > 0 ? `+${num(n)}` : num(n));

export const NATUREZAS_DA_DIVERGENCIA = {
  SOBRA: { titulo: 'Sobra de blocos no lote', descricao: 'Blocos que deveriam ter sido baixados' },
  ABERTURA: { titulo: 'Abertura maior que produção', descricao: 'Abriu mais blocos do que produziu' },
  SAIDA: { titulo: 'Saída maior que produção', descricao: 'Contaminados, perdas e aberturas passam do que o lote produziu' },
  OUTROS: { titulo: 'Outros alertas', descricao: 'Alertas sem painel próprio que não são de contagem' },
} as const;

export function categoriasDosAlertasOperacionais(alertas: PainelOperacionalAlerta[], nomes: NomesDosGalpoes): CategoriaDeAlerta[] {
  const baldes = { SOBRA: [] as ItemDeAlerta[], ABERTURA: [] as ItemDeAlerta[], SAIDA: [] as ItemDeAlerta[], OUTROS: [] as ItemDeAlerta[] };
  const maior = { SOBRA: 0, ABERTURA: 0, SAIDA: 0 };
  for (const { a, i } of ordenarPorGravidade(alertas)) {
    const d = divergenciaDo(a);
    const nivel = a.severidade === 'VERMELHO' ? 'CRITICO' as const : 'ATENCAO' as const;
    const item = { chave: chaveDoAlerta(a, i), nivel, detalhe: detalheDoAlerta(a) };
    if (!d || d.sobra == null) {
      baldes.OUTROS.push({ ...item, celulas: [rotuloAlerta(a.tipo), '—', '—', '—', '—'] });
      continue;
    }
    const natureza = d.sobra > 0 ? 'SOBRA' : d.inconsistente ? 'ABERTURA' : 'SAIDA';
    if (Math.abs(d.sobra) > Math.abs(maior[natureza])) maior[natureza] = d.sobra;
    baldes[natureza].push({
      ...item,
      celulas: [
        dataBr(d.data_lote), dataBr(d.data_lote), ROTULO_TIPO[d.tipo ?? ''] ?? d.tipo ?? '—',
        d.galpao ? d.galpao.split(', ').map((g) => rotuloDoGalpao(g, nomes)).join(', ') : '—',
        diferencaComSinal(d.sobra),
      ],
    });
  }
  const categoria = (chave: keyof typeof baldes): CategoriaDeAlerta => ({
    chave, ...NATUREZAS_DA_DIVERGENCIA[chave], itens: baldes[chave],
    nivel: baldes[chave].some((x) => x.nivel === 'ATENCAO') && !baldes[chave].some((x) => x.nivel === 'CRITICO') ? 'ATENCAO' : 'CRITICO',
    impacto: chave === 'OUTROS' ? null : `${diferencaComSinal(maior[chave])} blocos`,
  });
  return [
    categoria('SOBRA'), categoria('ABERTURA'),
    ...(baldes.SAIDA.length > 0 ? [categoria('SAIDA')] : []),
    ...(baldes.OUTROS.length > 0 ? [categoria('OUTROS')] : []),
  ];
}

type LinhaDaPosicao = Pick<PainelOperacionalAberturaLinha, 'estante_id' | 'lote_chave' | 'data_lote' | 'tipo' | 'galpao'
  | 'estante' | 'origem_quantidade' | 'blocos_disponiveis' | 'data_prevista' | 'dias_restantes' | 'situacao'>;
export interface EnderecoDaPosicao {
  estante_id: number; endereco: string; blocos: number | null; data_prevista: string | null; situacao: string;
}
export interface LoteDaPosicao {
  lote_chave: string; data_lote: string; tipo: string | null;
  blocos: number | null;
  data_prevista: string | null; situacao: string; dias_restantes: number | null;
  enderecos: EnderecoDaPosicao[];
  outras_salas: string[];
}
export interface SalaDaPosicao {
  galpao: string | null; sala: string; blocos: number | null; enderecos: number; sem_quantidade: number;
  vencidos: number;
  lotes: LoteDaPosicao[];
}

const GRAVIDADE_DA_MATURACAO = ['VENCIDO', 'PROXIMO', 'DATA_INCONSISTENTE', 'SEM_PARAMETRO', 'EM_PRAZO'];
const gravidade = (s: string) => {
  const i = GRAVIDADE_DA_MATURACAO.indexOf(s);
  return i < 0 ? GRAVIDADE_DA_MATURACAO.length : i;
};
const ROTULO_DA_MATURACAO: Record<string, string> = {
  VENCIDO: 'Passou do prazo', PROXIMO: 'Chegando ao prazo', EM_PRAZO: 'Em prazo',
  SEM_PARAMETRO: 'Sem prazo cadastrado', DATA_INCONSISTENTE: 'Data inconsistente',
};
const blocosDoEndereco = (l: LinhaDaPosicao) => (l.origem_quantidade === 'ESTANTE' ? Math.max(0, l.blocos_disponiveis ?? 0) : null);
const porNumeroDaEstante = (a: string, b: string) => a.localeCompare(b, 'pt-BR', { numeric: true });
const SEM_SALA = 'Sem sala informada';

export function posicaoPorSala(linhas: LinhaDaPosicao[], nomes: NomesDosGalpoes): {
  salas: SalaDaPosicao[]; total: { blocos: number; lotes: number; enderecos: number; sem_quantidade: number };
} {
  const salaDe = (l: LinhaDaPosicao) => (l.galpao?.trim() ? galpaoCurto(l.galpao.trim(), nomes) : SEM_SALA);
  const salasDoLote = new Map<string, Set<string>>();
  const porSala = new Map<string, { galpao: string | null; linhas: LinhaDaPosicao[] }>();
  for (const l of linhas) {
    const sala = salaDe(l);
    if (!porSala.has(sala)) porSala.set(sala, { galpao: l.galpao?.trim() || null, linhas: [] });
    porSala.get(sala)!.linhas.push(l);
    if (!salasDoLote.has(l.lote_chave)) salasDoLote.set(l.lote_chave, new Set());
    salasDoLote.get(l.lote_chave)!.add(sala);
  }
  const salas: SalaDaPosicao[] = [...porSala.entries()].map(([sala, { galpao, linhas: daSala }]) => {
    const porLote = new Map<string, LinhaDaPosicao[]>();
    for (const l of daSala) porLote.set(l.lote_chave, [...(porLote.get(l.lote_chave) ?? []), l]);
    const lotes = [...porLote.entries()].map(([chave, ls]): LoteDaPosicao => {
      const pior = [...ls].sort((a, b) => gravidade(a.situacao) - gravidade(b.situacao)
        || (a.dias_restantes ?? Infinity) - (b.dias_restantes ?? Infinity))[0];
      const contados = ls.map(blocosDoEndereco).filter((b): b is number => b != null);
      return {
        lote_chave: chave, data_lote: ls[0].data_lote, tipo: ls[0].tipo,
        blocos: contados.length ? contados.reduce((t, b) => t + b, 0) : null,
        data_prevista: pior.data_prevista, situacao: pior.situacao, dias_restantes: pior.dias_restantes,
        enderecos: ls.map((l) => ({
          estante_id: l.estante_id, endereco: galpao ? (l.estante == null ? `${sala} (sem estante)` : `${sala}/${l.estante}`) : (l.estante ?? '—'),
          blocos: blocosDoEndereco(l), data_prevista: l.data_prevista, situacao: l.situacao,
        })).sort((a, b) => porNumeroDaEstante(a.endereco, b.endereco)),
        outras_salas: [...(salasDoLote.get(chave) ?? [])].filter((s) => s !== sala).sort(porNumeroDaEstante),
      };
    }).sort((a, b) => gravidade(a.situacao) - gravidade(b.situacao)
      || (a.dias_restantes ?? Infinity) - (b.dias_restantes ?? Infinity) || a.data_lote.localeCompare(b.data_lote));
    return {
      galpao, sala,
      blocos: daSala.some((l) => blocosDoEndereco(l) != null) ? daSala.reduce((t, l) => t + (blocosDoEndereco(l) ?? 0), 0) : null,
      enderecos: daSala.length,
      sem_quantidade: daSala.filter((l) => blocosDoEndereco(l) == null).length,
      vencidos: lotes.filter((l) => l.situacao === 'VENCIDO').length,
      lotes,
    };
  }).sort((a, b) => Number(a.sala === SEM_SALA) - Number(b.sala === SEM_SALA) || porNumeroDaEstante(a.sala, b.sala));
  return {
    salas,
    total: {
      blocos: salas.reduce((t, s) => t + (s.blocos ?? 0), 0),
      lotes: salasDoLote.size,
      enderecos: linhas.length,
      sem_quantidade: salas.reduce((t, s) => t + s.sem_quantidade, 0),
    },
  };
}

export function PosicaoDosBlocos({ linhas, nomes, abertosIniciais = [] }: {
  linhas: LinhaDaPosicao[]; nomes: NomesDosGalpoes; abertosIniciais?: string[];
}) {
  const [abertos, setAbertos] = useState(() => new Set(abertosIniciais));
  const alternar = (chave: string) => setAbertos((atual) => {
    const novo = new Set(atual);
    if (novo.has(chave)) novo.delete(chave); else novo.add(chave);
    return novo;
  });
  const { salas, total } = posicaoPorSala(linhas, nomes);
  if (salas.length === 0) return <div className="empty">Nenhum bloco em maturação na fila.</div>;
  const abridor = (chave: string, texto: ReactNode) => (
    <button type="button" className="btn-linha" aria-expanded={abertos.has(chave)} onClick={() => alternar(chave)}>
      <span aria-hidden="true">{abertos.has(chave) ? '▾' : '▸'}</span> {texto}
    </button>
  );
  return (
    <div className="plan-wrap">
      <table className="plan posicao-por-sala">
        <thead>
          <tr>
            <th className="rotulo">Sala, lote e endereço</th>
            <th className="num">Blocos</th><th className="num">Lotes</th><th className="num">Endereços</th>
            <th className="rotulo">Abertura prevista</th><th className="rotulo">Situação</th>
          </tr>
        </thead>
        <tbody>
          {salas.map((s) => {
            const chaveSala = `sala:${s.galpao ?? ''}`;
            return [
              <tr key={chaveSala} className="posicao-sala">
                <td className="rotulo">{abridor(chaveSala, <b>{s.sala}</b>)}</td>
                <td className="num">{formatarNumero(s.blocos)}</td>
                <td className="num">{formatarNumero(s.lotes.length)}</td>
                <td className="num">{formatarNumero(s.enderecos)}</td>
                <td className="rotulo"></td>
                <td className="rotulo">{s.vencidos > 0 ? `${formatarNumero(s.vencidos)} ${s.vencidos === 1 ? 'lote passou' : 'lotes passaram'} do prazo` : ''}</td>
              </tr>,
              ...(!abertos.has(chaveSala) ? [] : s.lotes.flatMap((l) => {
                const chaveLote = `lote:${s.galpao ?? ''}|${l.lote_chave}`;
                const nome = `Lote de ${dataBr(l.data_lote)}${l.tipo ? ` · ${ROTULO_TIPO[l.tipo] ?? l.tipo}` : ''}`;
                return [
                  <tr key={chaveLote} className="posicao-lote">
                    <td className="rotulo">
                      {abridor(chaveLote, nome)}
                      {l.outras_salas.length > 0 && <span className="obs-linha"> · também em {l.outras_salas.join(', ')}</span>}
                    </td>
                    <td className="num">{formatarNumero(l.blocos)}</td>
                    <td className="num"></td>
                    <td className="num">{formatarNumero(l.enderecos.length)}</td>
                    <td className="rotulo">{l.data_prevista ? dataBr(l.data_prevista) : '—'}</td>
                    <td className="rotulo">{ROTULO_DA_MATURACAO[l.situacao] ?? l.situacao}</td>
                  </tr>,
                  ...(!abertos.has(chaveLote) ? [] : l.enderecos.map((e) => (
                    <tr key={`end:${e.estante_id}`} className="posicao-endereco">
                      <td className="rotulo">{e.endereco}</td>
                      <td className="num">{formatarNumero(e.blocos)}</td>
                      <td className="num"></td><td className="num"></td>
                      <td className="rotulo">{e.data_prevista ? dataBr(e.data_prevista) : '—'}</td>
                      <td className="rotulo">{ROTULO_DA_MATURACAO[e.situacao] ?? e.situacao}</td>
                    </tr>
                  ))),
                ];
              })),
            ];
          })}
          <tr>
            <td className="rotulo"><b>Total</b></td>
            <td className="num"><b>{formatarNumero(total.blocos)}</b></td>
            <td className="num"><b>{formatarNumero(total.lotes)}</b></td>
            <td className="num"><b>{formatarNumero(total.enderecos)}</b></td>
            <td className="rotulo" colSpan={2}></td>
          </tr>
        </tbody>
      </table>
      <div className="obs-tela">
        Clique na sala para ver os lotes, e no lote para ver os endereços. O lote em mais de uma sala aparece em cada uma
        com os blocos dela, e conta uma vez só no total de lotes.
        {total.sem_quantidade > 0 && ` ${formatarNumero(total.sem_quantidade)} ${total.sem_quantidade === 1 ? 'endereço' : 'endereços'} sem contagem da própria estante (a contagem ficou só no lote, até abril, ou não foi lançada): o bloco sai em travessão e não entra na soma.`}
      </div>
    </div>
  );
}

export const TIPOS = [{ v: '', rotulo: 'Todos' }, ...ORDEM_TIPO.map((v) => ({ v, rotulo: ROTULO_TIPO[v] }))];
export const PERIODOS: ReadonlyArray<readonly [PeriodoDoPainel, string]> = [
  ['hoje', 'Hoje'], ['7', '7 dias'], ['10', '10 dias'], ['30', '30 dias'], ['mes', 'Mês'], ['ytd', 'Acumulado do ano'], ['ano', 'Ano'], ['lote', 'Lote'],
];

export function linhasDeOutrasRegras(
  regras: { id: string; titulo: string; total: number }[],
): { titulo: string; total: number }[] {
  return regras
    .filter((r) => r.id !== 'QUANTIDADE_INCOMPATIVEL' && r.total > 0)
    .sort((a, b) => b.total - a.total)
    .map((r) => ({ titulo: r.titulo, total: r.total }));
}

function situacaoDaEstourada(l: PainelOperacionalEstanteEstourada): string {
  if (l.em_maturacao) return l.data_abertura ? 'abertura não concluída' : 'em maturação';
  return l.status === 'ENCERRADO' ? 'encerrada' : 'aberta e concluída';
}

function TabelaEstouradas({ linhas, nomes }: { linhas: PainelOperacionalEstanteEstourada[]; nomes: NomesDosGalpoes }) {
  return (
    <div className="plan-wrap cp">
      <table className="plan cp">
        <thead>
          <tr>
            <th className="rotulo">Galpão</th><th className="rotulo">Estante</th>
            <th className="rotulo">Lote</th>
            <th className="num">Produzidos</th><th className="num">Placas</th>
            <th className="num">Abertos</th><th className="num">Saldo</th>
            <th className="rotulo">Situação</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.estante_id}>
              <td className="rotulo">{l.galpao != null ? rotuloDoGalpao(l.galpao, nomes) : '—'}</td>
              <td className="rotulo">{l.estante ?? '—'}</td>
              <td className="rotulo">{dataBr(l.data_lote)} · {l.tipo ?? '—'}</td>
              <td className="num">{num(l.produzidos)}</td>
              <td className="num">{num(l.retirados)}</td>
              <td className="num">{num(l.abertos)}</td>
              <td className="num">{num(l.saldo)} ⚠</td>
              <td className="rotulo">{situacaoDaEstourada(l)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PainelContaNaoFecha({ quadro, nomes }: { quadro: PainelOperacionalContaNaoFecha; nomes: NomesDosGalpoes }) {
  const [abrirHistorico, setAbrirHistorico] = useState(false);
  const { em_maturacao: emMaturacao, ja_abertas: jaAbertas } = quadro;
  const sub = quadro.total === 0
    ? 'Placas mais abertos nunca passam do que a estante tinha'
    : `${formatarNumero(emMaturacao.length)} ainda com bloco para buscar · ${formatarNumero(jaAbertas.length)} já abertas (histórico)`;
  return (
    <Panel title="Estantes em que a conta não fecha" tag={`${formatarNumero(quadro.total)} estante(s)`} sub={sub}>
      {quadro.total === 0 && <div className="empty">Nenhuma estante com placas mais abertos acima do que ela tinha.</div>}
      {emMaturacao.length > 0 && <TabelaEstouradas linhas={emMaturacao} nomes={nomes} />}
      {jaAbertas.length > 0 && (
        <>
          <div className="form-acao no-print">
            <button className="btn ghost" onClick={() => setAbrirHistorico((v) => !v)}>
              {abrirHistorico ? 'Esconder' : 'Mostrar'} as já abertas ({formatarNumero(jaAbertas.length)})
            </button>
          </div>
          {abrirHistorico && <TabelaEstouradas linhas={jaAbertas} nomes={nomes} />}
        </>
      )}
      <div className="obs-tela">
        Placas mais abertos passam do que a estante tinha contado. Nas que ainda têm bloco, a
        contagem de hoje corrige (Editar lote, Nº de blocos Produzidos). Nas já abertas, a
        contagem inicial vira placas mais abertura, com o ok da gestão. A tela
        recusa placa ou abertura que passe do saldo, então a lista não cresce sozinha.
      </div>
    </Panel>
  );
}

const aberturas = (n: number) => `${formatarNumero(n)} ${n === 1 ? 'abertura' : 'aberturas'}`;

const etiquetaLegivel = (e: string) => (e === 'ESTANTE_NAO_INFORMADA' ? 'sem estante informada' : e);
const galpaoLegivel = (g: string) => (g === 'sem galpão informado' ? 'sem galpão' : g);

export type NomesDosGalpoes = Array<{ galpao_codigo: string; observacao: string }>;
export const nomesDasSalas = (salas: CapacidadeSala[]): NomesDosGalpoes =>
  salas.map((s) => ({ galpao_codigo: s.galpao_codigo, observacao: s.nome }));

function TabelaCapacidade({ titulo, salas, total }: {
  titulo: string; salas: CapacidadeSala[]; total: CapacidadeLivre['totais']['maturacao'];
}) {
  const temAcima = (total.acima_da_capacidade ?? 0) > 0 || salas.some((s) => (s.acima_da_capacidade ?? 0) > 0);
  const celulaAcima = (v: number | null) => (v == null ? '—' : v > 0 ? formatarNumero(v) : '');
  const comVaga = (s: CapacidadeSala) => (s.livres == null ? null
    : s.estantes.filter((e) => e.status === 'ATIVA' && (e.livres ?? 0) > 0).length);
  const totalComVaga = salas.some((s) => comVaga(s) == null) ? null : salas.reduce((t, s) => t + (comVaga(s) ?? 0), 0);
  return (
    <div className="plan-wrap">
      <h4 className="rotulo">{titulo}</h4>
      <table className="plan">
        <thead>
          <tr>
            <th className="rotulo">Sala</th>
            <th className="num">Capacidade</th><th className="num">Ocupados</th>
            {temAcima && <th className="num">Acima da capacidade</th>}
            <th className="num">Livres</th><th className="num">%</th>
            <th className="num">Estantes com vaga</th>
            <th className="rotulo">Estantes vazias</th><th className="rotulo">Observações</th>
          </tr>
        </thead>
        <tbody>
          {salas.map((s) => (
            <tr key={s.sala_id}>
              <td className="rotulo">{s.nome} ({galpaoCurto(s.galpao_codigo, nomesDasSalas([s]))})</td>
              <td className="num">{formatarNumero(s.capacidade)}</td>
              <td className="num">{formatarNumero(s.ocupados)}</td>
              {temAcima && <td className="num">{celulaAcima(s.acima_da_capacidade)}</td>}
              <td className="num">{formatarNumero(s.livres)}</td>
              <td className="num">{s.pct_ocupacao == null ? '—' : `${formatarNumero(s.pct_ocupacao)}%`}</td>
              <td className="num">{formatarNumero(comVaga(s))}</td>
              <td className="rotulo">{s.etiquetas_livres.join(', ') || (s.estantes_total > 0 ? 'nenhuma' : '—')}</td>
              <td className="rotulo">
                {s.ativa
                  ? `${formatarNumero(s.estantes_ocupadas)} de ${formatarNumero(s.estantes_total)} estantes ocupadas`
                  : 'sala inativa'}
              </td>
            </tr>
          ))}
          <tr>
            <td className="rotulo"><b>Total</b></td>
            <td className="num"><b>{formatarNumero(total.capacidade)}</b></td>
            <td className="num"><b>{formatarNumero(total.ocupados)}</b></td>
            {temAcima && <td className="num"><b>{celulaAcima(total.acima_da_capacidade)}</b></td>}
            <td className="num"><b>{formatarNumero(total.livres)}</b></td>
            <td className="num"></td>
            <td className="num"><b>{formatarNumero(totalComVaga)}</b></td>
            <td className="num" colSpan={2}></td>
          </tr>
        </tbody>
      </table>
      {temAcima && (
        <div className="obs-tela">Estante lotada conta 0 livres: Livres = Capacidade − Ocupados + Acima da capacidade.</div>
      )}
    </div>
  );
}

export function PainelCapacidade({ quadro, posicao }: { quadro: CapacidadeLivre | null; posicao?: string }) {
  if (!quadro) return null;
  const nomes = nomesDasSalas(quadro.salas);
  const observacoes: string[] = [];
  for (const s of quadro.salas) {
    for (const f of s.fora_da_capacidade) {
      observacoes.push(`${galpaoCurto(s.galpao_codigo, nomes)}/${f.etiqueta} · ${f.status === 'EM_DESATIVACAO' ? 'em desativação' : 'inativa'} · ${formatarNumero(f.ocupados)} blocos, fora da capacidade`);
    }
    if (s.sem_quantidade > 0) observacoes.push(`${galpaoCurto(s.galpao_codigo, nomes)}: ${aberturas(s.sem_quantidade)} sem quantidade`);
  }
  for (const d of quadro.estantes_desconhecidas) {
    observacoes.push(`${galpaoLegivel(galpaoCurto(d.galpao, nomes))}/${etiquetaLegivel(d.etiqueta)}: ${formatarNumero(d.blocos)} blocos numa etiqueta que o cadastro não tem`);
  }
  if (quadro.sem_sala.aberturas > 0) {
    const n = quadro.sem_sala.aberturas;
    const semQuantidade = quadro.sem_sala.sem_quantidade > 0 ? `, ${formatarNumero(quadro.sem_sala.sem_quantidade)} sem quantidade` : '';
    observacoes.push(`${aberturas(n)} (${formatarNumero(quadro.sem_sala.blocos)} blocos${semQuantidade}) registrada${n === 1 ? '' : 's'} antes do cadastro das salas, sem sala informada`);
  }
  return (
    <Panel title="Capacidade livre" tag={`${formatarNumero(quadro.totais.maturacao.livres)} blocos livres na maturação`}
      sub="Maturação: os blocos são o saldo dos lotes na estante (produzidos − abertos − retirados, saldo negativo conta 0; a estante marcada como zerada na abertura conta 0); as estantes ocupadas e vazias são as do quadro do Mapa das Estantes, ocupada é a que tem lote para abrir. Frutificação: as aberturas ainda não liberadas">
      {posicao && <div className="obs-tela">{posicao}</div>}
      <TabelaCapacidade titulo="Maturação" salas={quadro.salas.filter((s) => s.etapa === 'MATURACAO')} total={quadro.totais.maturacao} />
      <TabelaCapacidade titulo="Frutificação" salas={quadro.salas.filter((s) => s.etapa === 'FRUTIFICACAO')} total={quadro.totais.frutificacao} />
      {observacoes.length > 0 && (
        <div className="obs-tela">
          <ul>{observacoes.map((o) => <li key={o}>{o}</li>)}</ul>
        </div>
      )}
    </Panel>
  );
}

const kgUm = (v: number) => `${v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg`;
const kgComSinal = (v: number) => { const r = Math.round(v * 10) / 10; return `${r > 0 ? '+' : r < 0 ? '−' : ''}${kgUm(Math.abs(r))}`; };
const dentroDaTolerancia = (tol: number | undefined) => (Number.isFinite(tol)
  ? `dentro de ${(tol as number).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} kg`
  : 'dentro da tolerância');

export function janelaDaConferencia(q: ColheitaEmbalagemBloco, pedido: { modo: string; inicio?: string } | null): string {
  if (q.corte === undefined) return 'Do corte da produção até hoje.';
  const tipo = q.tipo ? `, só ${ROTULO_TIPO[q.tipo] ?? q.tipo}` : ', todos os tipos';
  if ((q.modo ?? pedido?.modo) === 'lote') return `No modo Lote, do corte da produção até hoje${tipo}: a embalagem é lançada por dia e tipo, sem o lote.`;
  const cortado = inicioAntesDoCorte(q, pedido) != null;
  return `O período e o tipo dos cards${tipo}`
    + (cortado ? `, a partir do corte da produção (${dataBr(q.corte)}): antes dele a colheita e a embalagem vieram da planilha.` : '.');
}

export function inicioAntesDoCorte(q: ColheitaEmbalagemBloco, pedido: { modo: string; inicio?: string } | null): string | null {
  if (q.corte === undefined || (q.modo ?? pedido?.modo) === 'lote') return null;
  return pedido?.inicio != null && pedido.inicio < q.corte ? pedido.inicio : null;
}

export function PainelColheitaEmbalagem({ quadro, onAbrir, pedido = null, ultimos }: {
  quadro: ColheitaEmbalagemBloco | null | undefined; onAbrir: () => void; pedido?: { modo: string; inicio?: string } | null;
  ultimos?: UltimosLancamentos;
}) {
  if (quadro === undefined) {
    return (
      <Panel title="Colheita → Embalagem" id="colheita-embalagem" sub="A conferência entre o que foi colhido e o que foi embalado ou desprezado">
        <div className="empty">Este servidor ainda não calcula a conferência (campo <code>colheita_embalagem</code> ausente). Atualize o backend.</div>
      </Panel>
    );
  }
  if (quadro === null) {
    return (
      <Panel title="Colheita → Embalagem" id="colheita-embalagem" sub="A conferência entre o que foi colhido e o que foi embalado ou desprezado">
        <div className="empty">Não foi possível calcular a conferência agora: a carga da embalagem falhou no servidor.</div>
      </Panel>
    );
  }
  const q = quadro;
  if (q.corte !== undefined && q.janela.fim < q.janela.inicio) {
    return (
      <Panel title="Colheita → Embalagem" id="colheita-embalagem" sub="A conferência entre o que foi colhido e o que foi embalado ou desprezado">
        <div className="empty">{`O período escolhido termina antes do corte da produção (${dataBr(q.corte)}): antes dele a colheita e a embalagem vieram da planilha, e não há conferência.`}</div>
      </Panel>
    );
  }
  const janela = janelaDaConferencia(q, pedido);
  const lancado = datasDoGrupo('colheita', ultimos);
  const desde = inicioAntesDoCorte(q, pedido);
  if (q.colheitas === 0) {
    return (
      <Panel title="Colheita → Embalagem" id="colheita-embalagem" tag={`${dataBr(q.janela.inicio)} a ${dataBr(q.janela.fim)}`}
        sub={`A conferência entre o que foi colhido e o que foi embalado ou desprezado. ${janela}`}>
        <div className="empty">Nenhuma colheita para conferir de {dataBr(q.janela.inicio)} a {dataBr(q.janela.fim)}.</div>
      </Panel>
    );
  }
  return (
    <Panel title="Colheita → Embalagem" id="colheita-embalagem" tag={`${dataBr(q.janela.inicio)} a ${dataBr(q.janela.fim)}`}
      sub={`Kg colhidos − kg embalados − kg desprezados. ${janela}${lancado.length ? ` Lançado até${q.tipo ? ', em todos os tipos' : ''}: ${lancado.join(', ')}.` : ''} O que não fechou vira pendência no Painel de Comando; a lista por colheita está em Dados Embalagem.`}>
      <div className={`kpi-grid ${q.bandejas_200g === undefined ? 'k4' : 'k5'}`}>
        <Kpi label="Kg colhidos" value={kgUm(q.kg_colhidos)}
          delta={'colheitas da Jornada dos tipos com embalagem' + (desde ? `; o card do topo conta o período inteiro, desde ${dataBr(desde)}` : '')} />
        {q.bandejas_200g !== undefined && (
          <Kpi label="Bandejas produzidas" value={q.bandejas_200g == null ? '—' : num(q.bandejas_200g + (q.embalagens_1kg ?? 0))}
            delta={(q.bandejas_200g == null ? 'nenhuma bandeja nem embalagem de 1 kg lançada na mesma janela'
              : `${num(q.bandejas_200g)} ${q.bandejas_200g === 1 ? 'bandeja' : 'bandejas'} de 200 g e ${num(q.embalagens_1kg ?? 0)} ${q.embalagens_1kg === 1 ? 'embalagem' : 'embalagens'} de 1 kg lançadas na mesma janela`)
              + (desde ? `; o card do topo conta o período inteiro, desde ${dataBr(desde)}` : '')} />
        )}
        <Kpi label="Kg embalados" value={kgUm(q.kg_embalados)} delta="pelo peso de cada apresentação" />
        <Kpi label="Kg desprezados" value={kgUm(q.kg_desprezados)} delta="Registrar desprezo" />
        <Kpi label="Diferença" value={kgComSinal(q.diferenca)} tone={q.divergentes > 0 ? 'alert' : 'good'}
          delta={`${q.divergentes} ${q.divergentes === 1 ? 'colheita não fechou' : 'colheitas não fecharam'} (${kgUm(q.kg_diferenca_absoluta)} fora da tolerância) · ${q.fechadas} ${q.fechadas === 1 ? 'fechou' : 'fecharam'} ${dentroDaTolerancia(q.parametros?.tolerancia_kg)} · ${q.em_aberto} ainda no prazo de embalar`} />
      </div>
      <div className="form-acao">
        <button type="button" className="btn ghost" onClick={onAbrir}>Ver as divergências em Dados Embalagem →</button>
        <span className="obs-linha">Lá a lista segue o período escolhido em Dados Embalagem, com todos os tipos.</span>
      </div>
    </Panel>
  );
}

export function TabelaUltimasColheitas({ ultimas }: { ultimas: PainelOperacionalResposta['colheita']['ultimas'] }) {
  return (
    <div className="plan-wrap">
      <h4 className="rotulo">Últimas colheitas: as 10 colheitas mais recentes</h4>
      <table className="plan">
        <thead>
          <tr><th className="rotulo">Data</th><th className="num">Kg</th></tr>
        </thead>
        <tbody>
          {ultimas.map((c) => (
            <tr key={c.id}>
              <td className="rotulo">{dataBr(c.data_colheita)}</td>
              <td className="num">{c.total_kg == null ? '—' : num(c.total_kg, 1)}</td>
            </tr>
          ))}
          {ultimas.length === 0 && (
            <tr><td colSpan={2} className="empty">Nenhuma colheita registrada no período.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function PainelOutrasInconsistencias(
  { regras }: { regras: { id: string; titulo: string; total: number }[] },
) {
  const linhas = linhasDeOutrasRegras(regras);
  if (linhas.length === 0) return null;
  return (
    <div className="obs-tela">
      <p>Outras inconsistências do ciclo hoje, por regra:</p>
      <ul>
        {linhas.map((r) => (
          <li key={r.titulo}>
            {r.titulo}: {formatarNumero(r.total)} ocorrência(s)
          </li>
        ))}
      </ul>
      <p>
        O detalhe completo, com o registro de cada ocorrência, está em{' '}
        <b>Qualidade dos Dados</b>.
      </p>
    </div>
  );
}

export function TabelaDivergencias({ lotes, nomes, onAbrir }: {
  lotes: PainelOperacionalDivergenciaLote[]; nomes: NomesDosGalpoes;
  onAbrir?: (dataLote: string) => void;
}) {
  const comPerdas = lotes.some((l) => (l.blocos_perdidos ?? 0) > 0);
  return (
    <div className="plan-wrap">
      <table className="plan">
        <thead>
          <tr>
            <th className="rotulo">Lote</th><th className="rotulo">Tipo</th>
            <th className="rotulo">Galpão</th>
            <th className="num">Produzidos</th><th className="num">Contaminados</th>
            <th className="num">Abertos</th>
            {comPerdas && <th className="num">Perdas</th>}
            <th className="num">Sobra</th>
            <th className="rotulo">Responsável pela conferência</th>
            {onAbrir && <th></th>}
          </tr>
        </thead>
        <tbody>
          {lotes.map((l) => (
            <tr key={l.lote_chave}>
              <td className="rotulo">{dataBr(l.data_lote)}</td>
              <td className="rotulo">{l.tipo ?? '—'}</td>
              <td className="rotulo">{l.galpao != null ? l.galpao.split(', ').map((g) => rotuloDoGalpao(g, nomes)).join(', ') : '—'}</td>
              <td className="num">{l.blocos_produzidos == null ? '—' : num(l.blocos_produzidos)}</td>
              <td className="num">{l.blocos_contaminados == null ? '—' : num(l.blocos_contaminados)}</td>
              <td className="num">{l.blocos_abertos == null ? '—' : num(l.blocos_abertos)}</td>
              {comPerdas && <td className="num">{num(l.blocos_perdidos ?? 0)}</td>}
              <td className="num">{l.sobra == null ? '—' : num(l.sobra)}</td>
              <td className="rotulo">—</td>
              {onAbrir && (
                <td><button type="button" className="btn ghost" onClick={() => onAbrir(l.data_lote)}>Abrir na Jornada</button></td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const pctDaFracao = (v: number | null) => (v == null ? '—' : pct(v * 100));

type LadosDoRanking = readonly [string, string];
const MELHORES_E_PIORES: LadosDoRanking = ['melhores', 'piores'];
function useCorte<T>(linhas: T[], corte: number, lados: LadosDoRanking = MELHORES_E_PIORES) {
  const [todos, setTodos] = useState(false);
  const comPosicao = linhas.map((l, i) => ({ l, posicao: i + 1 }));
  const cabe = linhas.length <= 2 * corte + 1;
  const botao = !cabe && (
    <button type="button" className="btn ghost" onClick={() => setTodos(!todos)}>
      {todos ? `Mostrar só os ${corte} ${lados[0]} e os ${corte} ${lados[1]}` : `Ver todos os ${linhas.length}`}
    </button>
  );
  const visiveis = todos || cabe ? comPosicao : [...comPosicao.slice(0, corte), ...comPosicao.slice(-corte)];
  const meio = todos || cabe ? 0 : linhas.length - 2 * corte;
  return [visiveis, meio, botao] as const;
}

const linhaDoMeio = (meio: number, colunas: number, lados: LadosDoRanking = MELHORES_E_PIORES) => (
  <tr key="meio" className="meio-do-ranking"><td colSpan={colunas} className="obs-linha">
    {`… ${formatarNumero(meio)} ${meio === 1 ? 'lote' : 'lotes'} no meio do ranking. Acima, os ${lados[0]}; abaixo, os ${lados[1]}.`}
  </td></tr>
);

export function TabelaDeProdutividade({ titulo, linhas, corte, onAbrir }: {
  titulo: string; linhas: RankingsDoPainel['produtividade']; corte: number; onAbrir: (dataLote: string) => void;
}) {
  const [visiveis, meio, botao] = useCorte(linhas, corte);
  return (
    <div className="plan-wrap cp">
      <h4 className="rotulo">{titulo}</h4>
      <table className="plan cp">
        <thead>
          <tr><th className="num">Posição</th><th className="rotulo">Lote</th><th className="num">Blocos abertos</th><th className="num">Kg colhidos</th><th className="num">Kg por bloco aberto</th><th className="num">Semente (pacotes)</th><th className="num">Kg por pacote de semente</th><th></th></tr>
        </thead>
        <tbody>
          {visiveis.map(({ l, posicao }, i) => {
            const porPacote = kgPorPacote(l.kg_colhidos, l.semente_pacotes, 1);
            return [
            meio > 0 && i === corte && linhaDoMeio(meio, 8),
            <tr key={l.chave}>
              <td className="num">{posicao}</td>
              <td className="rotulo">{`${dataBr(l.data_lote)}${l.inconsistente ? ' *' : ''}${l.parcial ? ' (parcial)' : ''}`}</td>
              <td className="num">{num(l.blocos_abertos)}</td>
              <td className="num">{num(l.kg_colhidos, 1)}</td>
              <td className="num">{num(l.kg_por_bloco_aberto, 3)}</td>
              <td className="num">{l.semente_pacotes == null ? '—' : num(l.semente_pacotes)}</td>
              <td className="num">{porPacote == null ? '—' : num(porPacote, 3)}</td>
              <td><button type="button" className="btn ghost" onClick={() => onAbrir(l.data_lote)}>Ver na Jornada</button></td>
            </tr>,
            ];
          })}
        </tbody>
      </table>
      {botao}
    </div>
  );
}

export type ClasseDoRanking = 'pct_m_ou_maior' | 'pct_p' | 'pct_m' | 'pct_g' | 'pct_gg';
const ROTULO_DA_CLASSE: Record<ClasseDoRanking, string> = { pct_m_ou_maior: 'M, G e GG', pct_p: 'P', pct_m: 'M', pct_g: 'G', pct_gg: 'GG' };
export function ordenarPelaClasse<T extends { chave: string } & Record<ClasseDoRanking, number | null>>(linhas: T[], classe: ClasseDoRanking): T[] {
  const sinal = classe === 'pct_p' ? 1 : -1;
  return [...linhas].sort((a, b) => (a[classe] == null ? 1 : 0) - (b[classe] == null ? 1 : 0)
    || sinal * ((a[classe] ?? 0) - (b[classe] ?? 0)) || a.chave.localeCompare(b.chave));
}

const MAIORES_E_MENORES: LadosDoRanking = ['maiores', 'menores'];

export function TabelaDeQualidade({ linhas: doServidor, onAbrir, classe, onClasse, vazio = 'Nenhum Shiitake classificado nos lotes abertos no período.' }: {
  linhas: RankingsDoPainel['qualidade']; onAbrir: (dataLote: string) => void; classe: ClasseDoRanking; onClasse: (c: ClasseDoRanking) => void; vazio?: string;
}) {
  const corte = 5;
  const linhas = classe === 'pct_m_ou_maior' ? doServidor : ordenarPelaClasse(doServidor, classe);
  const lados = classe === 'pct_m' ? MAIORES_E_MENORES : MELHORES_E_PIORES;
  const [visiveis, meio, botao] = useCorte(linhas, corte, lados);
  return (
    <div className="plan-wrap cp">
      <h4 className="rotulo">{`Ranking de qualidade do Shiitake: % de ${ROTULO_DA_CLASSE[classe]} no kg classificado`}</h4>
      <div className="filtros">
        <div className="fg">
          <label>Ordenar pela classe</label>
          <select value={classe} onChange={(e) => onClasse(e.target.value as ClasseDoRanking)}>
            <option value="pct_m_ou_maior">M, G e GG (maior primeiro)</option>
            <option value="pct_p">P (menor primeiro)</option>
            <option value="pct_m">M (maior primeiro)</option>
            <option value="pct_g">G (maior primeiro)</option>
            <option value="pct_gg">GG (maior primeiro)</option>
          </select>
        </div>
      </div>
      <table className="plan cp">
        <thead>
          <tr><th className="num">Posição</th><th className="rotulo">Lote</th><th className="num">Kg classificado</th><th className="num">P</th><th className="num">M</th><th className="num">G</th><th className="num">GG</th><th className="num">M, G e GG</th><th></th></tr>
        </thead>
        <tbody>
          {visiveis.map(({ l, posicao }, i) => [
            meio > 0 && i === corte && linhaDoMeio(meio, 9, lados),
            <tr key={l.chave}>
              <td className="num">{posicao}</td>
              <td className="rotulo">{`${dataBr(l.data_lote)}${l.parcial ? ' (parcial)' : ''}`}</td>
              <td className="num">{num(l.kg_classificado, 1)}</td>
              <ClassesEscritas s={l} />
              <td><button type="button" className="btn ghost" onClick={() => onAbrir(l.data_lote)}>Ver na Jornada</button></td>
            </tr>,
          ])}
          {linhas.length === 0 && <tr><td colSpan={9} className="empty">{vazio}</td></tr>}
        </tbody>
      </table>
      {botao}
      <div className="obs-tela">{NOTA_DAS_CLASSES}</div>
    </div>
  );
}

function ClassesEscritas({ s }: { s: Record<'pct_m' | 'pct_g' | 'pct_gg' | 'pct_m_ou_maior', number | null> }) {
  const partes = composicaoEscrita(s.pct_m_ou_maior, { m: s.pct_m, g: s.pct_g, gg: s.pct_gg });
  return (
    <>
      {CLASSES.map((c, k) => <td key={c} className="num">{partes ? pct(partes[k]) : '—'}</td>)}
      <td className="num"><b>{partes ? pct(partes[1] + partes[2] + partes[3]) : '—'}</b></td>
    </>
  );
}
const NOTA_DAS_CLASSES = 'Em cada linha, P, M, G e GG somam 100% e o M, G e GG é o da coluna, no arredondamento de uma casa: o P fica com o que falta, e o M, o G e o GG se repartem pelo kg de cada um.';

export function totalDasSalas(r: Pick<RankingsDoPainel, 'por_sala' | 'sem_sala'>): ColheitaDaSala {
  const linhas = [...r.por_sala, r.sem_sala];
  const soma = (f: 'kg_colhidos' | 'colheitas' | 'kg_p' | 'kg_m' | 'kg_g' | 'kg_gg') => Math.round(linhas.reduce((t, s) => t + s[f], 0) * 1000) / 1000;
  const [kg_p, kg_m, kg_g, kg_gg] = [soma('kg_p'), soma('kg_m'), soma('kg_g'), soma('kg_gg')];
  const kg_classificado = Math.round((kg_p + kg_m + kg_g + kg_gg) * 1000) / 1000;
  const fr = (v: number) => (kg_classificado ? v / kg_classificado : null);
  return {
    sala: null, kg_colhidos: soma('kg_colhidos'), colheitas: soma('colheitas'), kg_classificado, kg_p, kg_m, kg_g, kg_gg,
    pct_p: fr(kg_p), pct_m: fr(kg_m), pct_g: fr(kg_g), pct_gg: fr(kg_gg), pct_m_ou_maior: fr(kg_m + kg_g + kg_gg),
  };
}

export function TabelaDasSalas({ rankings }: { rankings: Pick<RankingsDoPainel, 'por_sala' | 'sem_sala'> }) {
  const linha = (rotulo: ReactNode, s: ColheitaDaSala) => (
    <>
      <td className="rotulo">{rotulo}</td>
      <td className="num">{num(s.colheitas)}</td>
      <td className="num">{num(s.kg_colhidos, 1)}</td>
      <td className="num">{num(s.kg_classificado, 1)}</td>
      <ClassesEscritas s={s} />
    </>
  );
  return (
    <div className="plan-wrap cp">
      <h4 className="rotulo">Colheita e qualidade por sala de frutificação</h4>
      <table className="plan cp">
        <thead>
          <tr><th className="rotulo">Sala</th><th className="num">Colheitas</th><th className="num">Kg colhidos</th><th className="num">Kg de Shiitake classificado</th><th className="num">P</th><th className="num">M</th><th className="num">G</th><th className="num">GG</th><th className="num">M, G e GG</th></tr>
        </thead>
        <tbody>
          {rankings.por_sala.map((s) => <tr key={s.sala}>{linha(s.sala, s)}</tr>)}
          {rankings.sem_sala.colheitas > 0 && <tr>{linha('Sem sala anotada', rankings.sem_sala)}</tr>}
          <tr>{linha(<b>TOTAL</b>, totalDasSalas(rankings))}</tr>
        </tbody>
      </table>
    </div>
  );
}

const MOTIVO_DA_MARCA = 'abriu mais do que produziu, ou abertos e contaminados passam dos produzidos';

export function TabelaDoRendimentoPorSala({ rendimento, lotesDoRanking }: {
  rendimento: NonNullable<RankingsDoPainel['rendimento_por_sala']>; lotesDoRanking: number;
}) {
  const { linhas, fora } = rendimento;
  const lotes = (n: number) => `${formatarNumero(n)} ${n === 1 ? 'lote' : 'lotes'}`;
  const motivos = [
    fora.sem_sala_na_abertura > 0 && `${lotes(fora.sem_sala_na_abertura)} sem a sala anotada na abertura`,
    fora.soma_diferente > 0 && `${lotes(fora.soma_diferente)} com as aberturas por sala somando diferente dos blocos abertos do lote, ou com abertura sem quantidade`,
    fora.colheita_sem_sala_da_abertura > 0 && `${lotes(fora.colheita_sem_sala_da_abertura)} com colheita numa sala onde o lote não abriu, ou sem sala num lote aberto em mais de uma`,
  ].filter((m): m is string => Boolean(m));
  const foraTotal = fora.sem_sala_na_abertura + fora.soma_diferente + fora.colheita_sem_sala_da_abertura;
  return (
    <div className="plan-wrap cp">
      <h4 className="rotulo">Rendimento por sala de frutificação: kg por bloco aberto</h4>
      <table className="plan cp">
        <thead>
          <tr><th className="rotulo">Sala</th><th className="rotulo">Tipo</th><th className="num">Lotes</th><th className="num">Parciais</th><th className="num">Blocos abertos</th><th className="num">Kg colhidos</th><th className="num">Kg por bloco aberto</th></tr>
        </thead>
        <tbody>
          {linhas.map((s) => (
            <tr key={`${s.sala}|${s.tipo}`}>
              <td className="rotulo">{`${s.sala}${(s.inconsistentes ?? 0) > 0 ? ' *' : ''}`}</td>
              <td className="rotulo">{ROTULO_TIPO[s.tipo] ?? s.tipo}</td>
              <td className="num">{num(s.lotes)}</td>
              <td className="num">{s.parciais == null ? '—' : num(s.parciais)}</td>
              <td className="num">{num(s.blocos_abertos)}</td>
              <td className="num">{num(s.kg_colhidos, 1)}</td>
              <td className="num">{num(s.kg_por_bloco_aberto, 3)}</td>
            </tr>
          ))}
          {linhas.length === 0 && <tr><td colSpan={7} className="empty">Nenhum lote do período entra na conta por sala.</td></tr>}
        </tbody>
      </table>
      <div className="obs-tela">
        {lotesDoRanking === 0
          ? 'Nenhum lote aberto no período está no ranking de produtividade, e por isso nenhum entra na conta por sala.'
          : `Pela sala anotada na abertura, que passou a ser anotada em setembro, com a colheita de cada lote até hoje. Entram ${formatarNumero(lotesDoRanking - foraTotal)} dos ${lotes(lotesDoRanking)} do ranking de produtividade; o lote aberto em mais de uma sala conta em cada uma, com os blocos e o kg dela, e por isso a coluna Lotes pode somar mais. Parciais: lotes ainda em maturação ou colhendo, que entram com o que colheram até hoje e puxam a sala para baixo.`}
        {motivos.length > 0 && ` Ficam fora: ${emLista(motivos)}. Não entram como zero.`}
        {linhas.some((s) => (s.inconsistentes ?? 0) > 0) && ` * Em cada linha marcada entra pelo menos um lote com a conta de blocos que não fecha (${MOTIVO_DA_MARCA}), o mesmo marcado no ranking de produtividade (em Ver todos, se estiver no meio); os blocos e o kg dele entram na conta da linha: confira em Divergências de Contagem.`}
      </div>
    </div>
  );
}

export function repartirEmDecimos(valores: number[], total: number): number[] {
  const partes = valores.map((v) => Math.floor(v));
  if (partes.length === 0) return partes;
  const ordem = valores.map((v, i) => ({ i, resto: v - partes[i] })).sort((a, b) => b.resto - a.resto || a.i - b.i);
  let falta = total - partes.reduce((s, x) => s + x, 0);
  for (let k = 0; falta > 0; k += 1, falta -= 1) partes[ordem[k % ordem.length].i] += 1;
  for (let k = 0; falta < 0; k += 1, falta += 1) partes[ordem[ordem.length - 1 - (k % ordem.length)].i] -= 1;
  return partes;
}

export function composicaoEscrita(pctMgg: number | null, kg: { m: number | null; g: number | null; gg: number | null }): [number, number, number, number] | null {
  if (pctMgg == null) return null;
  const mgg = Math.round(comUmaCasa(pctMgg * 100) * 10);
  const kgs = [kg.m ?? 0, kg.g ?? 0, kg.gg ?? 0];
  const soma = kgs.reduce((s, x) => s + x, 0);
  const [m, g, gg] = soma > 0 ? repartirEmDecimos(kgs.map((x) => (x * mgg) / soma), mgg) : [0, 0, 0];
  return [(1000 - mgg) / 10, m / 10, g / 10, gg / 10];
}

type VariacaoDaQualidade = NonNullable<RankingsDoPainel['variacao_da_qualidade']>;
export function efeitosEscritos(v: VariacaoDaQualidade): number[] | null {
  if (v.atual == null || v.base == null || v.lotes.some((l) => l.efeito == null)) return null;
  const total = Math.round(variacaoEmPontos(v.atual * 100, v.base * 100) * 10);
  return repartirEmDecimos(v.lotes.map((l) => l.efeito! * 1000), total).map((x) => x / 10 + 0);
}

const CLASSES = ['P', 'M', 'G', 'GG'] as const;
const comSinal = (d: number) => `${d > 0 ? '+' : ''}${pontosPercentuais(d)}`;
const tomDaClasse = (i: number, d: number) => (d === 0 || i === 1 ? '' : (d > 0) === (i >= 2) ? 'pos' : 'neg');
const kg3 = (v: number) => Math.round(v * 1000) / 1000;

function BarraDaComposicao({ partes, semDado = [] }: { partes: [number, number, number, number]; semDado?: boolean[] }) {
  return (
    <div className="composicao" role="img" aria-label={CLASSES.map((c, i) => `${c} ${semDado[i] ? 'sem dado' : pct(partes[i])}`).join(', ')}>
      {partes.map((p, i) => <span key={CLASSES[i]} className={`c-${CLASSES[i].toLowerCase()}`} style={{ width: `${p}%` }} />)}
    </div>
  );
}

type KgDasClasses = [number | null, number | null, number | null, number | null];
type MetricasDoPainel = Exclude<IndicadoresDoPainel, { erro: string }>['metricas'];
export function kgDasClasses(m: MetricasDoPainel, k: 'atual' | 'anterior'): KgDasClasses {
  return [m.kg_p[k], m.kg_m[k], m.kg_g[k], m.kg_gg[k]];
}
export const variacaoEmKg = (atual: number | null, anterior: number | null): number | null =>
  (atual == null || anterior == null ? null : kg3(atual - anterior) + 0);
const kgEscrito = (v: number | null) => (v == null ? '—' : `${num(v, 3)} kg`);
const variacaoKgEscrita = (d: number | null) => (d == null ? '—' : `${d > 0 ? '+' : ''}${num(d, 3)} kg`);

export function ComposicaoDoShiitake({ indicadores, tipo }: { indicadores: Exclude<IndicadoresDoPainel, { erro: string }>; tipo: string }) {
  const m = indicadores.metricas;
  const j = indicadores.periodo;
  if (!m.pct_p || j.modo === 'lote') return null;
  const titulo = <h4 className="rotulo">Composição da colheita do Shiitake: P, M, G e GG no kg classificado</h4>;
  if (tipo && tipo !== 'SH') return <div className="plan-wrap cp">{titulo}<div className="empty">Só o Shiitake é classificado por tamanho: com outro tipo escolhido, não há composição.</div></div>;
  const ant = indicadores.anteriores[0];
  const de = (k: 'atual' | 'anterior') => composicaoEscrita(m.pct_m_ou_maior[k], { m: m.kg_m[k], g: m.kg_g[k], gg: m.kg_gg[k] });
  const [atual, anterior] = [de('atual'), de('anterior')];
  const [kgAtual, kgAnterior] = [kgDasClasses(m, 'atual'), kgDasClasses(m, 'anterior')];
  const linha = (rotulo: string, kg: number | null, partes: [number, number, number, number] | null, kgs: KgDasClasses, mgg: number | null) => (
    <tr key={rotulo}>
      <td className="rotulo">{rotulo}</td>
      <td className="num">{num(kg, 3)}</td>
      {CLASSES.map((c, i) => <td key={c} className="num">{partes && kgs[i] != null ? pct(partes[i]) : '—'}{kg != null && <span className="kg-da-classe">{kgEscrito(kgs[i])}</span>}</td>)}
      <td className="num"><b>{partes ? pct(partes[1] + partes[2] + partes[3]) : '—'}</b>{kg != null && <span className="kg-da-classe">{kgEscrito(mgg)}</span>}</td>
      <td>{partes && <BarraDaComposicao partes={partes} semDado={kgs.map((v) => v == null)} />}</td>
    </tr>
  );
  const dif = atual && anterior ? atual.map((a, i) => Math.round((a - anterior[i]) * 10) / 10 + 0) : null;
  const semDado = (i: number) => kgAtual[i] == null || kgAnterior[i] == null;
  const difKg = kgAtual.map((a, i) => variacaoEmKg(a, kgAnterior[i]));
  const mggAtual = m.kg_m_ou_maior.atual;
  const mggAnterior = m.kg_m_ou_maior.anterior;
  const emKg = Boolean(ant && 'inicio' in ant) && m.kg_classificado.atual != null && m.kg_classificado.anterior != null;
  return (
    <div className="plan-wrap cp" id="composicao-do-shiitake">
      {titulo}
      <table className="plan cp">
        <thead>
          <tr><th className="rotulo">Período</th><th className="num">Kg classificado</th>{CLASSES.map((c) => <th key={c} className="num"><i className={`leg c-${c.toLowerCase()}`} />{c}</th>)}<th className="num">M, G e GG</th><th className="rotulo">Composição</th></tr>
        </thead>
        <tbody>
          {linha(intervalo(j), m.kg_classificado.atual, atual, kgAtual, mggAtual)}
          {ant && 'inicio' in ant && linha(`Anterior: ${intervalo(ant)}`, m.kg_classificado.anterior, anterior, kgAnterior, mggAnterior)}
          {(dif || emKg) && (
            <tr>
              <td className="rotulo">Variação</td>
              <td className="num">{variacaoKgEscrita(variacaoEmKg(m.kg_classificado.atual, m.kg_classificado.anterior))}</td>
              {CLASSES.map((c, i) => <td key={c} className="num">{!dif || semDado(i) ? '—' : <span className={tomDaClasse(i, dif[i]) || undefined}>{comSinal(dif[i])}</span>}<span className="kg-da-classe">{variacaoKgEscrita(difKg[i])}</span></td>)}
              <td className="num"><b>{dif ? <span className={tomDaClasse(2, dif[1] + dif[2] + dif[3]) || undefined}>{comSinal(Math.round((dif[1] + dif[2] + dif[3]) * 10) / 10 + 0)}</span> : '—'}</b><span className="kg-da-classe">{variacaoKgEscrita(variacaoEmKg(mggAtual, mggAnterior))}</span></td>
              <td />
            </tr>
          )}
        </tbody>
      </table>
      <div className="obs-tela">
        {'Pela data da colheita, só o Shiitake (o único classificado por tamanho). O M, G e GG é o do card; as quatro classes somam 100% (o P fica com o que falta, e o M, o G e o GG se repartem pelo kg de cada um, no arredondamento de uma casa). Embaixo de cada %, o kg da classe: os quatro somam o kg classificado. A variação é em pontos, tirada dos números da tabela, e em kg, o do período menos o do anterior.'}
        {([['atual', kgAtual], ['anterior', kgAnterior]] as const).some(([k, kgs]) => m.kg_classificado[k] != null && kgs.some((v) => v == null))
          && ' Classe com traço: nenhuma colheita do período a anotou, e ela não entra como zero.'}
        {!anterior && (emKg
          ? ' Um dos dois períodos não tem Shiitake classificado: a variação sai só em kg, sem pontos.'
          : ' Sem comparação: o período anterior começa antes do primeiro lançamento de colheita no sistema.')}
        {atual == null && ' Nenhum Shiitake classificado no período.'}
      </div>
    </div>
  );
}

const COR_DA_CLASSE = ['#8C8C8C', GOLDS, GOLD, OLIVEDK];
const DIA_MS = 86400000;
const diasDe = (p: { inicio: string; fim: string }) => Math.round((Date.parse(p.fim) - Date.parse(p.inicio)) / DIA_MS) + 1;
const ddmm = (d: string) => dataBr(d).slice(0, 5);
const mesInteiro = (p: { inicio: string; fim: string }) => p.inicio.endsWith('-01') && diasDe(p) === diasDe({ inicio: p.inicio, fim: fimDoMes(p.inicio) });
const fimDoMes = (d: string) => new Date(Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)), 0)).toISOString().slice(0, 10);

export function rotuloDoPonto(p: { inicio: string; fim: string }, porMes: boolean): string {
  if (porMes) return mesInteiro(p) ? rotuloDoMesCurto(p.inicio.slice(0, 7)) : `${rotuloDoMesCurto(p.inicio.slice(0, 7))} (${p.inicio.slice(8)} a ${p.fim.slice(8)})`;
  return p.inicio === p.fim ? ddmm(p.inicio) : `${ddmm(p.inicio)} a ${ddmm(p.fim)}`;
}

const kgDoPonto = (p: PontoDaQualidade): KgDasClasses => [p.kg_p, p.kg_m, p.kg_g, p.kg_gg];
export function partesDoPonto(p: PontoDaQualidade): KgDasClasses | null {
  const partes = composicaoEscrita(p.pct_m_ou_maior, { m: p.kg_m, g: p.kg_g, gg: p.kg_gg });
  return partes && (partes.map((x, i) => (kgDoPonto(p)[i] == null ? null : x)) as KgDasClasses);
}

export function dadosDoGrafico(serie: PontoDaQualidade[], porMes: boolean) {
  const partes = serie.map(partesDoPonto);
  return {
    labels: serie.map((p) => rotuloDoPonto(p, porMes)),
    datasets: [
      ...CLASSES.map((c, i) => ({
        type: 'bar' as const, label: c, data: partes.map((x) => (x ? x[i] : null)), backgroundColor: COR_DA_CLASSE[i], stack: 'classes', yAxisID: 'pct', order: 2,
      })),
      { type: 'line' as const, label: 'Kg colhidos', data: serie.map((p) => p.kg_colhidos), borderColor: AMBER, backgroundColor: AMBER, yAxisID: 'kg', order: 1, tension: 0, pointRadius: 3 },
      {
        type: 'line' as const, label: 'Kg por bloco aberto', data: serie.map((p) => p.kg_por_bloco_aberto), borderColor: BLUE, backgroundColor: BLUE, borderDash: [6, 4],
        pointBackgroundColor: serie.map((p) => ((p.parciais ?? 0) > 0 ? '#FFFFFF' : BLUE)), pointRadius: 3, yAxisID: 'bloco', order: 0, tension: 0,
      },
    ],
  };
}

export function dicaDoPonto(p: PontoDaQualidade, conjunto: number, valor: number | null): string {
  if (conjunto < 4) {
    const kg = kgDoPonto(p)[conjunto];
    return kg == null ? `${CLASSES[conjunto]}: não anotado` : `${CLASSES[conjunto]}: ${pct(valor)} (${kgEscrito(kg)})`;
  }
  if (conjunto === 4) return p.kg_colhidos == null ? 'Kg colhidos: antes do primeiro lançamento de colheita' : `Kg colhidos: ${kgEscrito(p.kg_colhidos)}, ${kgEscrito(p.kg_classificado)} classificados`;
  if (p.kg_por_bloco_aberto == null) return 'Kg por bloco aberto: nenhuma estante aberta com colheita';
  const parciais = p.parciais ?? 0;
  return `Kg por bloco aberto: ${num(p.kg_por_bloco_aberto, 3)} (${lotesN(p.lotes_abertos ?? 0)}${parciais > 0 ? `, ${parciais === 1 ? '1 parcial' : `${formatarNumero(parciais)} parciais`}` : ''})`;
}

const somaDaColuna = (xs: Array<number | null>) => (xs.every((x) => x == null) ? null : kg3(xs.reduce<number>((s, x) => s + (x ?? 0), 0)) + 0);

export function GraficoQuantidadeEQualidade({ serie, periodo }: { serie: PontoDaQualidade[]; periodo: { inicio: string; fim: string } }) {
  const titulo = <h4 className="rotulo">Quantidade e qualidade do Shiitake: kg colhidos, composição e kg por bloco aberto</h4>;
  if (serie.every((p) => p.kg_colhidos == null)) {
    return <div className="plan-wrap cp grafico-qualidade" id="quantidade-e-qualidade">{titulo}<div className="empty">Nenhuma colheita lançada no sistema nesse período: não há o que desenhar.</div></div>;
  }
  const porMes = diasDe(periodo) > 31;
  const dados = dadosDoGrafico(serie, porMes);
  const fora = porMes ? serie.filter((p) => !mesInteiro(p)) : serie.filter((p) => diasDe(p) !== diasDe(serie[0]));
  const comParcial = serie.some((p) => (p.parciais ?? 0) > 0);
  const semClasse = serie.some((p) => p.kg_classificado != null && kgDoPonto(p).some((v) => v == null));
  const total = (k: 'kg_colhidos' | 'kg_classificado' | 'kg_p' | 'kg_m' | 'kg_g' | 'kg_gg') => somaDaColuna(serie.map((p) => p[k]));
  return (
    <div className="plan-wrap cp grafico-qualidade" id="quantidade-e-qualidade">
      {titulo}
      <div className="chart-box" style={{ height: 320 }}>
        <Chart type="bar" data={dados as unknown as ChartData<'bar'>}
          options={{
            responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
            plugins: {
              legend: { position: 'bottom', labels: { boxWidth: 12, sort: (a, b) => (a.datasetIndex ?? 0) - (b.datasetIndex ?? 0) } },
              tooltip: { itemSort: (a, b) => a.datasetIndex - b.datasetIndex, callbacks: { label: (c) => dicaDoPonto(serie[c.dataIndex], c.datasetIndex, c.parsed.y) } },
            },
            scales: {
              x: { stacked: true, grid: { display: false } },
              pct: { type: 'linear', position: 'left', stacked: true, min: 0, max: 100, ticks: { callback: (v) => `${v}%` }, title: { display: true, text: '% do kg classificado' } },
              kg: { type: 'linear', position: 'right', beginAtZero: true, grid: { display: false }, title: { display: true, text: 'kg colhidos' } },
              bloco: { type: 'linear', position: 'right', beginAtZero: true, grid: { display: false }, title: { display: true, text: 'kg por bloco aberto' } },
            },
          }} />
      </div>
      <details>
        <summary className="rotulo">Os números do gráfico</summary>
        <table className="plan cp">
          <thead>
            <tr><th className="rotulo">Intervalo</th><th className="num">Kg colhidos</th><th className="num">Kg classificado</th>{CLASSES.map((c) => <th key={c} className="num"><i className={`leg c-${c.toLowerCase()}`} />{c}</th>)}<th className="num">Kg por bloco aberto</th></tr>
          </thead>
          <tbody>
            {serie.map((p, k) => {
              const partes = partesDoPonto(p);
              return (
                <tr key={p.inicio}>
                  <td className="rotulo">{dados.labels[k]}</td>
                  <td className="num">{num(p.kg_colhidos, 3)}</td>
                  <td className="num">{num(p.kg_classificado, 3)}</td>
                  {CLASSES.map((c, i) => <td key={c} className="num">{partes && partes[i] != null ? pct(partes[i]) : '—'}<span className="kg-da-classe">{kgEscrito(kgDoPonto(p)[i])}</span></td>)}
                  <td className="num">{num(p.kg_por_bloco_aberto, 3)}{(p.parciais ?? 0) > 0 ? ' (parcial)' : ''}</td>
                </tr>
              );
            })}
            <tr>
              <td className="rotulo"><b>TOTAL</b></td>
              <td className="num">{num(total('kg_colhidos'), 3)}</td>
              <td className="num">{num(total('kg_classificado'), 3)}</td>
              {(['kg_p', 'kg_m', 'kg_g', 'kg_gg'] as const).map((k) => <td key={k} className="num"><span className="kg-da-classe">{kgEscrito(total(k))}</span></td>)}
              <td />
            </tr>
          </tbody>
        </table>
      </details>
      <div className="obs-tela">
        {'Barras: P, M, G e GG em % do kg classificado de cada intervalo, pela data da colheita, como na Composição. Linha cheia: o kg de Shiitake colhido no intervalo. Linha tracejada: o kg por bloco aberto das estantes de Shiitake abertas no intervalo, com a colheita delas até hoje, como nos rankings; sem estante aberta no intervalo, a linha não tem ponto.'}
        {comParcial && ' Ponto vazado: intervalo com lote ainda em maturação ou colhendo, cujo kg por bloco aberto ainda vai subir.'}
        {fora.length > 0 && ` ${emLista(fora.map((p) => rotuloDoPonto(p, porMes)))}: ${porMes ? 'mês cortado no período' : `${fora.length === 1 ? 'intervalo' : 'intervalos'} com outro número de dias`}, e o kg colhido não se compara direto com o dos outros.`}
        {semClasse && ' Classe com traço: nenhuma colheita do intervalo a anotou, e ela fica fora da barra, nunca como zero.'}
        {serie.some((p) => p.kg_colhidos == null) && ' Intervalo sem número: termina antes do primeiro lançamento de colheita no sistema.'}
        {serie.length === 1 && ' Com um dia só não há evolução: escolha 7 dias ou mais.'}
      </div>
    </div>
  );
}

export function LotesDaVariacao({ v, onAbrir }: { v: VariacaoDaQualidade; onAbrir: (dataLote: string) => void }) {
  if (v.lotes.length === 0) {
    return (
      <details className="plan-wrap cp">
        <summary className="rotulo">Os lotes que colheram Shiitake classificado no período</summary>
        <div className="empty">Nenhum lote colheu Shiitake classificado no período: não há lote para ligar à variação do M, G e GG.</div>
      </details>
    );
  }
  const efeitos = efeitosEscritos(v);
  const d = efeitos && v.atual != null && v.base != null ? variacaoEmPontos(v.atual * 100, v.base * 100) : null;
  return (
    <details className="plan-wrap cp" open={d != null && d < 0}>
      <summary className="rotulo">
        {d == null ? 'Os lotes colhidos no período, com a composição de cada um' : `Os lotes que mexeram no M, G e GG: ${comSinal(d)} contra o anterior`}
      </summary>
      <table className="plan cp">
        <thead>
          <tr>
            <th className="num">Posição</th><th className="rotulo">Lote</th><th className="num">Kg classificado no período</th>
            {CLASSES.map((c) => <th key={c} className="num">{c}</th>)}<th className="num">M, G e GG</th>
            {efeitos && <th className="num">Efeito no M, G e GG</th>}<th></th>
          </tr>
        </thead>
        <tbody>
          {v.lotes.map((l, i) => {
            const partes = composicaoEscrita(l.pct_m_ou_maior, { m: l.kg_m, g: l.kg_g, gg: l.kg_gg });
            const efeito = efeitos ? efeitos[i] : null;
            return (
              <tr key={l.chave}>
                <td className="num">{i + 1}</td>
                <td className="rotulo">{`${l.data_lote ? dataBr(l.data_lote) : 'sem data de produção'}${l.parcial ? ' (parcial)' : ''}`}</td>
                <td className="num">{num(l.kg_classificado, 3)}</td>
                {CLASSES.map((c, k) => <td key={c} className="num">{partes ? pct(partes[k]) : '—'}</td>)}
                <td className="num"><b>{partes ? pct(partes[1] + partes[2] + partes[3]) : '—'}</b></td>
                {efeito != null && <td className="num"><span className={efeito === 0 ? undefined : efeito > 0 ? 'pos' : 'neg'}>{comSinal(efeito)}</span></td>}
                <td>{l.data_lote && <button type="button" className="btn ghost" onClick={() => onAbrir(l.data_lote!)}>Ver na Jornada</button>}</td>
              </tr>
            );
          })}
          <tr>
            <td /><td className="rotulo"><b>TOTAL</b></td>
            <td className="num">{num(kg3(v.lotes.reduce((s, l) => s + l.kg_classificado, 0)), 3)}</td>
            {CLASSES.map((c) => <td key={c} />)}
            <td className="num"><b>{pctDaFracao(v.atual)}</b></td>
            {efeitos && d != null && <td className="num"><b>{comSinal(d)}</b></td>}<td />
          </tr>
        </tbody>
      </table>
      <div className="obs-tela">
        {`Os lotes que colheram Shiitake classificado no período, pela data da colheita: o kg e a composição de cada um são só do período.${efeitos ? ' Primeiro os que mais puxaram para baixo.' : ''}`}
        {efeitos
          ? ` Efeito: quanto o lote mexeu no M, G e GG do período, em pontos. É o kg de M, G e GG dele menos o que ele teria com os ${pctDaFracao(v.base)} do anterior, sobre o kg classificado do período. Negativo puxou para baixo. Somados, dão a variação do card (${comSinal(d!)}), no arredondamento de uma casa. Um lote puxa para baixo com o % abaixo do anterior, e puxa mais quanto mais colheu. O lote que colheu só no período anterior não está na lista: ele pesa só nos ${pctDaFracao(v.base)} do anterior.`
          : ' Sem o efeito de cada lote: o período anterior não tem Shiitake classificado, ou começa antes do primeiro lançamento de colheita no sistema.'}
        {v.lotes.some((l) => l.parcial) && ` ${notaDaParcial(true)}`}
        {v.lotes.length < 3 && ' Poucos lotes para comparar: leia como indício, não como resultado.'}
      </div>
    </details>
  );
}

export function melhoresEPiores<T extends { chave: string }>(lotes: T[], valor: (l: T) => number | null, n = 3): { melhores: T[]; piores: T[] } | null {
  const com = lotes.filter((l) => valor(l) != null).sort((a, b) => valor(b)! - valor(a)! || a.chave.localeCompare(b.chave));
  if (com.length < 2) return null;
  const k = Math.min(n, Math.floor(com.length / 2));
  return { melhores: com.slice(0, k), piores: com.slice(-k) };
}

export function emComum(lotes: LoteComparavel[]): string {
  if (lotes.length === 0) return '';
  const campos: Array<[string, (l: LoteComparavel) => string[] | null]> = [
    ['cepa', (l) => (l.sementes ? [...new Set(l.sementes.map((s) => s.cepa))] : null)],
    ['lote da semente', (l) => (l.sementes ? [...new Set(l.sementes.map((s) => s.lote_semente).filter((x): x is string => Boolean(x)))] : null)],
    ['receita', (l) => l.receitas],
    ['sala', (l) => l.salas],
  ];
  const comuns: string[] = [];
  const diferentes: string[] = [];
  const semDado: string[] = [];
  for (const [nome, de] of campos) {
    const listas = lotes.map(de);
    const faltam = listas.filter((x) => x == null || x.length === 0).length;
    if (faltam > 0) { semDado.push(lotes.length === 1 ? nome : `${nome} (falta em ${faltam === 1 ? '1 lote' : `${faltam} lotes`})`); continue; }
    const juntos = listas.reduce((a, b) => a!.filter((x) => b!.includes(x)))!;
    if (juntos.length) comuns.push(`${nome} ${emLista(juntos)}`);
    else diferentes.push(nome);
  }
  const dias = lotes.map((l) => l.maturacao?.media).filter((x): x is number => x != null).map((x) => Math.round(x));
  const semMaturacao = lotes.length - dias.length;
  return [
    comuns.length > 0 && `${lotes.length === 1 ? 'Tem' : 'Em comum'}: ${emLista(comuns)}.`,
    diferentes.length > 0 && `${comuns.length ? 'Diferem' : 'Nada em comum: diferem'} em ${emLista(diferentes)}.`,
    semDado.length > 0 && (lotes.length === 1 ? `Sem anotação de ${emLista(semDado)}.` : `Sem o dado para comparar: ${emLista(semDado)}.`),
    dias.length > 0 && `Maturação média de ${Math.min(...dias) === Math.max(...dias) ? `${Math.min(...dias)} dias` : `${Math.min(...dias)} a ${Math.max(...dias)} dias`}${semMaturacao > 0 ? ` (falta em ${semMaturacao === 1 ? '1 lote' : `${semMaturacao} lotes`})` : ''}.`,
    lotes.some((l) => l.parcial) && `Inclui lote parcial: ${lotes.every((l) => l.tipo === 'SH') ? 'o kg e os tamanhos ainda vão mudar' : 'o kg ainda vai mudar'}.`,
  ].filter(Boolean).join(' ');
}

type OrdemDaComparacao = 'kg_por_bloco_aberto' | 'pct_m_ou_maior' | 'maturacao';
const valorNaOrdem = (o: OrdemDaComparacao) => (l: LoteComparavel) => (o === 'maturacao' ? l.maturacao?.media ?? null : l[o]);
const textoDaSemente = (l: LoteComparavel) => (l.sementes == null ? 'não carregou' : l.sementes.length === 0 ? 'sem semente lançada'
  : l.sementes.map((s) => (s.lote_semente ? `${s.cepa} (${s.lote_semente})` : s.cepa)).join(', '));
const textoDaMaturacao = (m: LoteComparavel['maturacao']) => (m == null ? '—'
  : m.primeira === m.ultima ? num(m.primeira) : `${num(Math.round(m.media))} (${num(m.primeira)} a ${num(m.ultima)})`);
const gruposDe = (k: number, criterio: string): [string, string] => (k === 1
  ? [`O melhor ${criterio}`, `O pior ${criterio}`] : [`Os ${k} melhores ${criterio}`, `Os ${k} piores ${criterio}`]);
export function quemPuxou<T extends { chave: string }>(lotes: T[], efeito: Map<string, number>, n = 3): { melhores: T[]; piores: T[] } | null {
  const de = (l: T) => efeito.get(l.chave) ?? 0;
  const pelo = (sinal: number) => (a: T, b: T) => sinal * (de(b) - de(a)) || a.chave.localeCompare(b.chave);
  const melhores = lotes.filter((l) => de(l) > 0).sort(pelo(1)).slice(0, n);
  const piores = lotes.filter((l) => de(l) < 0).sort(pelo(-1)).slice(0, n);
  return melhores.length || piores.length ? { melhores, piores } : null;
}
const puxou = (k: number, lado: string) => (k === 1 ? `O que mais puxou o M, G e GG para ${lado}` : `Os ${k} que mais puxaram o M, G e GG para ${lado}`);
const titulosDaQueda = (g: { melhores: unknown[]; piores: unknown[] }): [string, string] => [
  g.melhores.length ? puxou(g.melhores.length, 'cima') : 'Nenhum lote puxou o M, G e GG para cima',
  g.piores.length ? puxou(g.piores.length, 'baixo') : 'Nenhum lote puxou o M, G e GG para baixo',
];
const SALA_FORA: Record<string, string> = {
  sem_sala_na_abertura: 'sem a sala na abertura', soma_diferente: 'aberturas por sala não fecham', colheita_sem_sala_da_abertura: 'colheita fora das salas da abertura',
};

export function ComparacaoDeLotes({ lotes, variacao, tipo }: { lotes: LoteComparavel[]; variacao: VariacaoDaQualidade | null | undefined; tipo: string }) {
  const tipos = [...new Set([...ORDEM_TIPO, ...lotes.map((l) => l.tipo)])].filter((t) => lotes.some((l) => l.tipo === t));
  const [doTipo, setDoTipo] = useState(tipo || tipos[0] || '');
  const [ordem, setOrdem] = useState<OrdemDaComparacao>('kg_por_bloco_aberto');
  const [marcados, setMarcados] = useState<string[]>([]);
  const [grupos, setGrupos] = useState<{ titulos: [string, string]; melhores: string[]; piores: string[] } | null>(null);
  const titulo = <h4 className="rotulo">Comparar lotes: semente, maturação, receita e sala</h4>;
  if (lotes.length === 0) {
    return (
      <div className="plan-wrap cp" id="comparacao-de-lotes">
        {titulo}
        <div className="empty">
          {tipo && tipo !== 'SH'
            ? 'Nenhum lote do período para comparar: nenhum lote desse tipo nos rankings (com estante aberta no período e colheita).'
            : 'Nenhum lote do período para comparar: nenhum lote nos rankings (com estante aberta no período e colheita) e nenhum que colheu Shiitake classificado no período.'}
        </div>
      </div>
    );
  }
  const doFiltro = lotes.filter((l) => l.tipo === doTipo);
  const ordenados = [...doFiltro].sort((a, b) => {
    const [va, vb] = [valorNaOrdem(ordem)(a), valorNaOrdem(ordem)(b)];
    return (va == null ? 1 : 0) - (vb == null ? 1 : 0) || (vb ?? 0) - (va ?? 0) || a.chave.localeCompare(b.chave);
  });
  const linhas = [...ordenados.filter((l) => marcados.includes(l.chave)), ...ordenados.filter((l) => !marcados.includes(l.chave))];
  const comQualidade = doTipo === 'SH';
  const escolher = (titulos: [string, string], g: { melhores: LoteComparavel[]; piores: LoteComparavel[] }) => {
    setGrupos({ titulos, melhores: g.melhores.map((l) => l.chave), piores: g.piores.map((l) => l.chave) });
    setMarcados([...g.melhores, ...g.piores].map((l) => l.chave));
  };
  const porKg = melhoresEPiores(doFiltro, (l) => l.kg_por_bloco_aberto);
  const porQualidade = comQualidade ? melhoresEPiores(doFiltro, (l) => l.pct_m_ou_maior) : null;
  const efeito = new Map((variacao?.lotes ?? []).filter((l) => l.efeito != null).map((l) => [l.chave, l.efeito!]));
  const pelaQueda = comQualidade ? quemPuxou(doFiltro, efeito) : null;
  const escolhidos = (chaves: string[]) => doFiltro.filter((l) => chaves.includes(l.chave));
  const alternar = (chave: string) => {
    setGrupos(null);
    setMarcados(marcados.includes(chave) ? marcados.filter((c) => c !== chave) : [...marcados, chave]);
  };
  const semReceita = doFiltro.filter((l) => l.receitas.length === 0).length;
  const semSalaAnotada = doFiltro.filter((l) => l.sala_fora === 'sem_sala_na_abertura').length;
  const salaQueNaoFecha = doFiltro.filter((l) => !l.salas && l.sala_fora !== 'sem_sala_na_abertura').length;
  const sementesNaoVieram = doFiltro.length > 0 && doFiltro.every((l) => l.sementes == null);
  const nenhumLoteDaSemente = !doFiltro.some((l) => l.sementes?.some((s) => s.lote_semente));
  return (
    <div className="plan-wrap cp" id="comparacao-de-lotes">
      {titulo}
      <div className="filtros">
        {tipos.length > 1 && (
          <div className="fg">
            <label>Tipo de cogumelo</label>
            <select value={doTipo} onChange={(e) => { setDoTipo(e.target.value); setOrdem('kg_por_bloco_aberto'); setMarcados([]); setGrupos(null); }}>
              {tipos.map((t) => <option key={t} value={t}>{ROTULO_TIPO[t] ?? t}</option>)}
            </select>
          </div>
        )}
        <div className="fg">
          <label>Ordenar por</label>
          <select value={ordem} onChange={(e) => setOrdem(e.target.value as OrdemDaComparacao)}>
            <option value="kg_por_bloco_aberto">Kg por bloco aberto</option>
            {comQualidade && <option value="pct_m_ou_maior">M, G e GG</option>}
            <option value="maturacao">Maturação média (mais longa primeiro)</option>
          </select>
        </div>
      </div>
      <div className="form-acao">
        {[
          porKg && ['em kg por bloco aberto', porKg] as const,
          porQualidade && ['em M, G e GG', porQualidade] as const,
        ].map((x) => x && (
          <button key={x[0]} type="button" className="btn ghost" onClick={() => escolher(gruposDe(x[1].melhores.length, x[0]), x[1])}>
            {x[1].melhores.length === 1 ? `O melhor e o pior ${x[0]}` : `Os ${x[1].melhores.length} melhores e os ${x[1].piores.length} piores ${x[0]}`}
          </button>
        ))}
        {pelaQueda && (
          <button type="button" className="btn ghost" onClick={() => escolher(titulosDaQueda(pelaQueda), pelaQueda)}>
            {[pelaQueda.melhores.length > 0 && puxou(pelaQueda.melhores.length, 'cima'), pelaQueda.piores.length > 0 && puxou(pelaQueda.piores.length, 'baixo')]
              .filter((x): x is string => Boolean(x)).map((x, i) => (i === 0 ? x : `e ${x.charAt(0).toLowerCase()}${x.slice(1)}`)).join(' ')}
          </button>
        )}
        {marcados.length > 0 && <button type="button" className="btn ghost" onClick={() => { setMarcados([]); setGrupos(null); }}>Limpar a escolha</button>}
      </div>
      {grupos ? (
        <div className="obs-tela">
          {[grupos.melhores, grupos.piores].map((ch, k) => (
            <div key={grupos.titulos[k]}>{ch.length ? `${grupos.titulos[k]}: ${emComum(escolhidos(ch))}` : `${grupos.titulos[k]}.`}</div>
          ))}
        </div>
      ) : marcados.length >= 2 ? (
        <div className="obs-tela">{`Os ${marcados.length} escolhidos: ${emComum(escolhidos(marcados))}`}</div>
      ) : (
        <div className="obs-tela">Marque dois lotes ou mais, ou use um dos botões, para ver o que eles têm em comum.</div>
      )}
      <table className="plan cp">
        <thead>
          <tr>
            <th className="rotulo">Escolher</th><th className="rotulo">Lote</th><th className="num">Blocos abertos</th><th className="num">Kg colhidos</th><th className="num">Kg por bloco aberto</th>
            {comQualidade && <th className="num">M, G e GG</th>}
            <th className="rotulo">Semente (cepa e lote)</th><th className="num">Maturação (dias)</th><th className="rotulo">Receita</th><th className="rotulo">Salas da abertura</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.chave}>
              <td><input type="checkbox" checked={marcados.includes(l.chave)} onChange={() => alternar(l.chave)} aria-label={`Escolher o lote de ${dataBr(l.data_lote)}`} /></td>
              <td className="rotulo">{`${dataBr(l.data_lote)}${l.inconsistente ? ' *' : ''}${l.parcial ? ' (parcial)' : ''}`}</td>
              <td className="num">{num(l.blocos_abertos)}</td>
              <td className="num">{num(l.kg_colhidos, 1)}</td>
              <td className="num">{num(l.kg_por_bloco_aberto, 3)}</td>
              {comQualidade && <td className="num">{pctDaFracao(l.pct_m_ou_maior)}</td>}
              <td className="rotulo">{textoDaSemente(l)}</td>
              <td className="num">{textoDaMaturacao(l.maturacao)}</td>
              <td className="rotulo">{l.receitas.length ? l.receitas.join(', ') : 'não anotada'}</td>
              <td className="rotulo">{l.salas ? l.salas.join(', ') : SALA_FORA[l.sala_fora ?? ''] ?? '—'}</td>
            </tr>
          ))}
          {linhas.length === 0 && <tr><td colSpan={comQualidade ? 10 : 9} className="empty">Nenhum lote desse tipo para comparar.</td></tr>}
        </tbody>
      </table>
      <div className="obs-tela">
        {`Os lotes dos rankings${tipo && tipo !== 'SH' ? '' : ' e os que colheram Shiitake classificado no período'}, cada um inteiro: todas as estantes e toda a colheita até hoje, mesmo a de fora do período. Por isso o número do lote pode diferir do ranking acima, que conta só as estantes abertas no período. Maturação: os dias da produção até cada abertura; com aberturas em dias diferentes, a média pelos blocos de cada uma e, entre parênteses, a primeira e a última. A abertura sem a quantidade de blocos fica fora da média e da faixa.`}
        {sementesNaoVieram ? ' A semente dos lotes não carregou: recarregue a tela.' : nenhumLoteDaSemente ? ' O lote da semente começa a ser anotado agora, no cadastro do lote.' : ''}
        {semReceita > 0 && ` A receita do composto está anotada em ${formatarNumero(doFiltro.length - semReceita)} dos ${lotesN(doFiltro.length)}.`}
        {semSalaAnotada > 0 && ` ${lotesN(semSalaAnotada)} sem as salas da abertura: a sala da abertura passou a ser anotada em setembro.`}
        {salaQueNaoFecha > 0 && ` ${lotesN(salaQueNaoFecha)} com as salas da abertura que não fecham com os blocos abertos ou com a colheita: o motivo está na coluna Salas da abertura.`}
        {doFiltro.length > 0 && doFiltro.length < 4 && ' Poucos lotes para comparar: leia como indício, não como resultado.'}
        {doFiltro.some((l) => l.inconsistente) && ` * A conta de blocos do lote não fecha (${MOTIVO_DA_MARCA}): confira em Divergências de Contagem.`}
        {doFiltro.some((l) => l.parcial) && ` ${notaDaParcial(doFiltro.every((l) => l.tipo === 'SH'))}`}
      </div>
    </div>
  );
}

export function PainelProdutividadeEQualidade({ indicadores, tipo, onAbrirLote, rodape }: {
  indicadores: IndicadoresDoPainel | undefined; tipo: string; onAbrirLote: (dataLote: string) => void; rodape?: ReactNode;
}) {
  const sub = 'Os rankings: lotes com estante aberta no período, com toda a colheita deles até hoje, o mesmo eixo do rendimento da Visão Executiva. A composição, os lotes que mexeram no M, G e GG e a tabela por sala: pela data da colheita. Clique em Ver na Jornada para seguir a história do lote.';
  if (indicadores && indicadores.erro != null) {
    return <Panel title="Produtividade e Qualidade" id="produtividade-e-qualidade" sub={sub}><div className="empty">{indicadores.erro}</div>{rodape}</Panel>;
  }
  const r = indicadores?.rankings;
  if (r === undefined) {
    return <Panel title="Produtividade e Qualidade" id="produtividade-e-qualidade" sub={sub}><div className="empty">Este servidor ainda não calcula os rankings do período.</div>{rodape}</Panel>;
  }
  if (r === null) {
    return <Panel title="Produtividade e Qualidade" id="produtividade-e-qualidade" sub={sub}><div className="empty">No modo Lote não há ranking: escolha um período para comparar os lotes entre si.</div>{rodape}</Panel>;
  }
  const j = indicadores ? indicadores.periodo : null;
  const doPedido = `${j && j.modo !== 'lote' ? `${j.inicio}|${j.fim}` : ''}|${tipo}`;
  return (
    <Panel title="Produtividade e Qualidade" id="produtividade-e-qualidade" tag={j && j.modo !== 'lote' ? `de ${dataBr(j.inicio)} a ${dataBr(j.fim)}` : undefined} sub={sub}>
      {indicadores && <ComposicaoDoShiitake indicadores={indicadores} tipo={tipo} />}
      {r.serie_da_qualidade && j && j.modo !== 'lote' && <GraficoQuantidadeEQualidade serie={r.serie_da_qualidade} periodo={j} />}
      <RankingsComFiltros key={doPedido} r={r} tipo={tipo} onAbrirLote={onAbrirLote} />
      {r.variacao_da_qualidade && <LotesDaVariacao v={r.variacao_da_qualidade} onAbrir={onAbrirLote} />}
      {r.comparaveis && <ComparacaoDeLotes key={`cmp|${doPedido}|${[...new Set(r.comparaveis.map((l) => l.tipo))].sort().join()}`} lotes={r.comparaveis} variacao={r.variacao_da_qualidade} tipo={tipo} />}
      {rodape}
    </Panel>
  );
}

const lotesN = (n: number) => `${formatarNumero(n)} ${n === 1 ? 'lote' : 'lotes'}`;

export function notaDaSemente(sem: Record<SementeFora, number>, comParcial: boolean, porLinha = false): string {
  if (sem.nao_carregou > 0) return 'A saída de semente não carregou: as colunas de semente ficam sem número. Recarregue a tela.';
  const motivos = [
    sem.sem_saida_no_dia > 0 && `${lotesN(sem.sem_saida_no_dia)} sem saída de semente lançada no dia da semeação`,
    sem.lote_fora_do_recorte > 0 && `${lotesN(sem.lote_fora_do_recorte)} com estante aberta fora do período, ainda na maturação ou encerrada sem abrir (os pacotes são do lote inteiro; o lote entra quando todas as estantes dele abrirem dentro do período, e com estante encerrada sem abrir não entra em período nenhum)`,
    sem.cepa_diferente > 0 && `${lotesN(sem.cepa_diferente)} com saída de semente de uma cepa que não está no cadastro do lote`,
    sem.sala > 0 && `${lotesN(sem.sala)} ${sem.sala === 1 ? 'aberto' : 'abertos'} em mais de uma sala, com a sala escolhida (os pacotes são do lote inteiro)`,
  ].filter((m): m is string => Boolean(m));
  return [
    'Semente (pacotes): a saída de semente lançada no dia da semeação, o dia seguinte à data do lote, do mesmo tipo de cogumelo, porque a saída não leva o lote. Kg por pacote de semente: o Kg colhidos sobre os pacotes.',
    porLinha && 'Na linha, só com a semente de todos os lotes dela. Compare o kg por pacote só entre cepas do mesmo tipo de cogumelo, com o filtro Tipo de cogumelo no topo do painel: o pacote pode pesar diferente de um tipo para outro.',
    motivos.length > 0 && `Sem a semente: ${emLista(motivos)}.`,
    comParcial && 'No lote parcial, que ainda colhe, o kg por pacote ainda sobe.',
  ].filter(Boolean).join(' ');
}

export function notaDosFiltros(opcoes: ReturnType<typeof opcoesDosFiltros>, filtro: FiltroDosRankings, fora: ForaDoFiltro, noRanking: number): string {
  const frases: string[] = [];
  if (opcoes.salasNaoVieram) frases.push('Este servidor ainda não reparte os lotes por sala: o filtro de sala fica vazio.');
  else if (opcoes.salas.length === 0) frases.push('Nenhum lote do período tem a sala anotada na abertura, anotada desde setembro: o filtro de sala fica vazio.');
  if (opcoes.sementesNaoVieram) frases.push('A semente dos lotes não carregou: os filtros por semente ficam vazios. Recarregue a tela.');
  else if (opcoes.cepas.length === 0) frases.push('Nenhum lote do período tem a semente lançada no cadastro: os filtros por semente ficam vazios.');
  else if (opcoes.lotesDaSemente.length === 0) frases.push('O lote da semente começa a ser anotado agora, no cadastro do lote: nenhum lote do período tem esse campo ainda.');
  if (filtroAtivo(filtro)) {
    frases.push(`Com o filtro, ${noRanking === 1 ? 'entra 1 lote' : `entram ${lotesN(noRanking)}`} no ranking de produtividade${filtro.sala ? `, com os blocos, o kg e os tamanhos dele na sala ${filtro.sala}` : ''}.`);
    const motivos = [
      fora.mais_de_uma_semente > 0 && `${lotesN(fora.mais_de_uma_semente)} com estantes de sementes diferentes (o kg do lote não se reparte)`,
      fora.sem_semente > 0 && `${lotesN(fora.sem_semente)} sem semente lançada`,
      fora.sem_conta_por_sala > 0 && `${lotesN(fora.sem_conta_por_sala)} sem a conta por sala (sala da abertura não anotada, ou que não fecha com os blocos)`,
    ].filter((m): m is string => Boolean(m));
    if (motivos.length > 0) frases.push(`Ficam fora: ${emLista(motivos)}. Não entram como zero.`);
    if (noRanking > 0 && noRanking < 3) frases.push('Poucos lotes para comparar: leia como indício, não como resultado.');
    frases.push('A composição, os lotes que mexeram no M, G e GG, a comparação de lotes e as tabelas por sala de frutificação não seguem os filtros.');
  }
  return frases.join(' ');
}

const notaDaParcial = (comTamanhos: boolean) => `(parcial): o lote ainda tem estante na fila de abertura, ou abriu há menos de ${DIAS_DE_COLHEITA_DA_ESTANTE} dias e segue colhendo. ${comTamanhos ? 'O kg e os tamanhos ainda vão mudar' : 'O kg ainda vai mudar'}: não compare como ciclo encerrado.`;

export function TabelaPorSemente({ linhas, sementesNaoVieram }: { linhas: RankingsDoPainel['produtividade']; sementesNaoVieram: boolean }) {
  const [nivel, setNivel] = useState<NivelDaSemente>('cepa');
  const { grupos, fora, semPacotes } = porSemente(linhas, nivel);
  const porLote = nivel === 'lote';
  const tamanho = (v: number | null) => (v == null ? '—' : num(v, 3));
  const motivos = sementesNaoVieram ? [] : [
    fora.mais_de_uma_semente > 0 && `${lotesN(fora.mais_de_uma_semente)} com ${porLote ? 'mais de um lote da semente' : 'mais de uma cepa'} nas estantes (o kg do lote não se reparte)`,
    fora.sem_semente > 0 && `${lotesN(fora.sem_semente)} sem semente lançada`,
  ].filter((m): m is string => Boolean(m));
  return (
    <details className="plan-wrap cp">
      <summary className="rotulo">Por cepa e por lote da semente: kg colhido, kg por bloco aberto e P, M, G e GG</summary>
      <h4 className="rotulo">{porLote ? 'Por lote da semente' : 'Por cepa da semente'}: kg colhido e kg por bloco aberto</h4>
      <div className="form-acao">
        <button type="button" className={porLote ? 'btn ghost' : 'btn'} onClick={() => setNivel('cepa')}>Por cepa</button>
        <button type="button" className={porLote ? 'btn' : 'btn ghost'} onClick={() => setNivel('lote')}>Por lote da semente</button>
      </div>
      <table className="plan cp">
        <thead>
          <tr>
            <th className="rotulo">Cepa</th>{porLote && <th className="rotulo">Lote da semente</th>}<th className="num">Lotes</th><th className="num">Parciais</th>
            <th className="num">Blocos abertos</th><th className="num">Kg colhidos</th><th className="num">Kg por bloco aberto</th>
            <th className="num">Semente (pacotes)</th><th className="num">Kg por pacote de semente</th>
            <th className="num">P (kg)</th><th className="num">M (kg)</th><th className="num">G (kg)</th><th className="num">GG (kg)</th><th className="num">Sem tamanho (kg)</th>
          </tr>
        </thead>
        <tbody>
          {grupos.map((g) => (
            <tr key={g.chave}>
              <td className="rotulo">{`${g.cepa}${g.inconsistentes > 0 ? ' *' : ''}`}</td>
              {porLote && <td className="rotulo">{g.lote_semente ?? 'não anotado'}</td>}
              <td className="num">{`${num(g.lotes)}${g.lotes < 3 ? ' (poucos)' : ''}`}</td>
              <td className="num">{num(g.parciais)}</td>
              <td className="num">{num(g.blocos_abertos)}</td>
              <td className="num">{num(g.kg_colhidos, 3)}</td>
              <td className="num">{g.kg_por_bloco_aberto == null ? '—' : num(g.kg_por_bloco_aberto, 3)}</td>
              <td className="num">{g.semente_pacotes == null ? '—' : num(g.semente_pacotes)}</td>
              <td className="num">{g.kg_por_pacote == null ? '—' : num(g.kg_por_pacote, 3)}</td>
              <td className="num">{tamanho(g.kg_p)}</td><td className="num">{tamanho(g.kg_m)}</td><td className="num">{tamanho(g.kg_g)}</td><td className="num">{tamanho(g.kg_gg)}</td><td className="num">{tamanho(g.kg_sem_tamanho)}</td>
            </tr>
          ))}
          {grupos.length === 0 && (
            <tr><td colSpan={porLote ? 14 : 13} className="empty">
              {sementesNaoVieram ? 'A semente dos lotes não carregou: recarregue a tela.' : `Nenhum lote do ranking com ${porLote ? 'um lote da semente só' : 'uma cepa só'} lançada no cadastro.`}
            </td></tr>
          )}
        </tbody>
      </table>
      <div className="obs-tela">
        {`Os lotes do ranking de produtividade, com os mesmos filtros, somados pela semente das estantes; o kg por bloco aberto é o kg do grupo sobre os blocos do grupo. P, M, G e GG em kg só no Shiitake; o kg colhido sem tamanho anotado vai em Sem tamanho, e as cinco colunas somam o Kg colhidos.${porLote ? ' O lote da semente começa a ser anotado agora: o que veio antes aparece como não anotado.' : ''}`}
        {motivos.length > 0 && ` Ficam fora: ${emLista(motivos)}. Não entram como zero.`}
        {grupos.some((g) => g.lotes < 3) && ' (poucos): menos de 3 lotes, pouco para comparar.'}
        {grupos.some((g) => g.parciais > 0) && ' Parciais: lotes ainda em maturação ou colhendo, que entram com o que colheram até hoje.'}
        {grupos.some((g) => g.inconsistentes > 0) && ` * Na linha marcada entra pelo menos um lote com a conta de blocos que não fecha (${MOTIVO_DA_MARCA}), o mesmo marcado no ranking de produtividade; os blocos e o kg dele entram na conta da linha: confira em Divergências de Contagem.`}
      </div>
      {grupos.length > 0 && <div className="obs-tela">{notaDaSemente(semPacotes, grupos.some((g) => g.parciais > 0 && g.kg_por_pacote != null), true)}</div>}
    </details>
  );
}

function RankingsComFiltros({ r, tipo, onAbrirLote }: { r: RankingsDoPainel; tipo: string; onAbrirLote: (dataLote: string) => void }) {
  const [filtro, setFiltro] = useState<FiltroDosRankings>(SEM_FILTRO);
  const [classe, setClasse] = useState<ClasseDoRanking>('pct_m_ou_maior');
  const opcoes = opcoesDosFiltros([...r.produtividade, ...r.qualidade]);
  const prod = filtrarProdutividade(r.produtividade, filtro);
  const qual = filtrarQualidade(r.qualidade, filtro);
  const comFiltro = filtroAtivo(filtro);
  const doFiltro = `${filtro.sala}|${filtro.cepa}|${filtro.loteSemente}`;
  const lotesDaCepa = opcoes.lotesDaSemente.filter((o) => !filtro.cepa || o.cepa === filtro.cepa);
  const tiposVistos = [...new Set([...ORDEM_TIPO, ...prod.linhas.map((l) => String(l.tipo))])];
  const grupos = (tipo ? [[tipo, prod.linhas] as const]
    : tiposVistos.map((t) => [t, prod.linhas.filter((l) => String(l.tipo) === t)] as const)).filter(([, ls]) => ls.length > 0);
  const { dado_faltante: faltante, sem_colheita: semColheita, sem_abertos: semAbertos = 0, sem_tamanho: semTamanho = 0 } = r.fora;
  const comQualidade = !tipo || tipo === 'SH';
  const notaDeFora = [
    faltante > 0 && `${formatarNumero(faltante)} ${faltante === 1 ? 'lote aberto fica fora' : 'lotes abertos ficam fora'} por falta da contagem de blocos (abertura sem quantidade ou sem produzidos).`,
    semColheita > 0 && `${formatarNumero(semColheita)} ${semColheita === 1 ? 'lote aberto ainda não tem' : 'lotes abertos ainda não têm'} colheita lançada.`,
    semAbertos > 0 && `${formatarNumero(semAbertos)} ${semAbertos === 1 ? 'lote colhido tem' : 'lotes colhidos têm'} 0 blocos abertos na conta, sem kg por bloco.`,
    comQualidade && semTamanho > 0 && `${formatarNumero(semTamanho)} ${semTamanho === 1 ? 'lote de Shiitake colhido fica' : 'lotes de Shiitake colhidos ficam'} fora da qualidade por falta do tamanho anotado.`,
    (faltante > 0 || semColheita > 0 || semAbertos > 0 || (comQualidade && semTamanho > 0)) && 'Não entram como zero.',
    prod.linhas.some((l) => l.inconsistente) && `* A conta de blocos do lote não fecha (${MOTIVO_DA_MARCA}): confira em Divergências de Contagem.`,
    (prod.linhas.some((l) => l.parcial) || (comQualidade && qual.linhas.some((l) => l.parcial))) && notaDaParcial(comQualidade),
  ].filter(Boolean).join(' ');
  const notaDoFiltro = notaDosFiltros(opcoes, filtro, prod.fora, prod.linhas.length);
  const escolher = (campo: keyof FiltroDosRankings) => (e: { target: { value: string } }) => setFiltro({
    ...filtro, [campo]: e.target.value, ...(campo === 'cepa' ? { loteSemente: '' } : {}),
  });
  return (
    <>
      <div className="filtros">
        <div className="fg">
          <label>Sala de frutificação</label>
          <select value={filtro.sala} disabled={opcoes.salas.length === 0} onChange={escolher('sala')}>
            <option value="">Todas</option>
            {opcoes.salas.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="fg">
          <label>Cepa da semente</label>
          <select value={filtro.cepa} disabled={opcoes.cepas.length === 0} onChange={escolher('cepa')}>
            <option value="">Todas</option>
            {opcoes.cepas.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="fg">
          <label>Lote da semente</label>
          <select value={filtro.loteSemente} disabled={lotesDaCepa.length === 0} onChange={escolher('loteSemente')}>
            <option value="">Todos</option>
            {lotesDaCepa.map((o) => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
          </select>
        </div>
        {comFiltro && <button type="button" className="btn ghost" onClick={() => setFiltro(SEM_FILTRO)}>Limpar filtros</button>}
      </div>
      {notaDoFiltro && <div className="obs-tela">{notaDoFiltro}</div>}
      <div className="fsec">Ranking de produtividade: kg por bloco aberto</div>
      {grupos.length === 0 && <div className="empty">{comFiltro ? 'Nenhum lote do período com esse filtro.' : 'Nenhum lote aberto no período com a conta de blocos e colheita.'}</div>}
      {grupos.map(([t, ls]) => (
        <TabelaDeProdutividade key={`${doFiltro}|${t}`} titulo={ROTULO_TIPO[t] ?? 'Sem tipo'} linhas={ls} corte={tipo ? 5 : 3} onAbrir={onAbrirLote} />
      ))}
      {notaDeFora && <div className="obs-tela">{notaDeFora}</div>}
      {prod.linhas.length > 0 && <div className="obs-tela">{notaDaSemente(contarSemPacotes(prod.linhas), prod.linhas.some((l) => l.parcial && l.semente_pacotes != null))}</div>}
      {r.rendimento_por_sala && <TabelaDoRendimentoPorSala rendimento={r.rendimento_por_sala} lotesDoRanking={r.produtividade.length} />}
      <TabelaPorSemente linhas={prod.linhas} sementesNaoVieram={opcoes.sementesNaoVieram} />
      {comQualidade
        ? <TabelaDeQualidade key={doFiltro} linhas={qual.linhas} onAbrir={onAbrirLote} classe={classe} onClasse={setClasse} vazio={comFiltro ? 'Nenhum Shiitake classificado com esse filtro.' : undefined} />
        : <div className="obs-tela">O ranking de qualidade é do Shiitake, o único classificado por tamanho (P, M, G e GG).</div>}
      <TabelaDasSalas rankings={r} />
      <div className="obs-tela">
        {`Por sala, valem as colheitas do período pela sala anotada na colheita, que passou a ser anotada em setembro: o que veio antes fica em Sem sala anotada. O TOTAL fecha com o card Kg colhidos, e o M, G e GG dele com o card e com a Composição.${comQualidade ? '' : ` ${NOTA_DAS_CLASSES}`}`}
      </div>
    </>
  );
}

type FormatoDoIndicador = 'int' | 'kg' | 'dec' | 'taxa';
export type DestinoDoCard = { ancora: string } | { tela: ViewId };
interface CardDoIndicador { nome: NomeDoIndicador; rotulo: string; formato: FormatoDoIndicador; info?: string; destino?: DestinoDoCard }
type Lancamento = 'producao' | 'colheita' | 'retirada' | 'embalagem';
const PRODUTIVIDADE: DestinoDoCard = { ancora: 'produtividade-e-qualidade' };
const EMBALAGEM: DestinoDoCard = { ancora: 'colheita-embalagem' };
const CONTAMINADOS: DestinoDoCard = { tela: 'painel_contaminados' };
export const GRUPOS_DE_INDICADORES: Record<'producao' | 'colheita' | 'contaminacao', { titulo: string; lancamentos: Lancamento[]; cards: CardDoIndicador[] }> = {
  producao: {
    titulo: 'Produção',
    lancamentos: ['producao'],
    cards: [
      { nome: 'blocos_produzidos', rotulo: 'Blocos produzidos', formato: 'int', info: 'Pela data do lote (inoculação).' },
      { nome: 'blocos_por_dia', rotulo: 'Blocos por dia produzido', formato: 'int', info: 'Blocos produzidos divididos pelos dias em que houve produção: compara períodos com um número diferente de dias de trabalho.' },
      { nome: 'lotes_produzidos', rotulo: 'Lotes produzidos', formato: 'int', info: 'O lote é a data de produção com o tipo de cogumelo.' },
      { nome: 'blocos_por_lote', rotulo: 'Média de blocos por lote', formato: 'int' },
    ],
  },
  colheita: {
    titulo: 'Colheita',
    lancamentos: ['colheita', 'embalagem'],
    cards: [
      { nome: 'kg_colhidos', rotulo: 'Kg colhidos', formato: 'kg', info: 'Pela data da colheita.', destino: PRODUTIVIDADE },
      { nome: 'lotes_colhidos', rotulo: 'Lotes colhidos', formato: 'int', info: 'Lotes com alguma colheita no período.', destino: PRODUTIVIDADE },
      { nome: 'kg_por_lote', rotulo: 'Kg por lote colhido', formato: 'dec', destino: PRODUTIVIDADE },
      { nome: 'pct_m_ou_maior', rotulo: 'M, G e GG do Shiitake', formato: 'taxa', info: 'Do Shiitake, o único classificado por tamanho: o kg de M, G e GG sobre o kg classificado (P, M, G e GG), pela data da colheita. Com outro tipo escolhido, travessão.', destino: PRODUTIVIDADE },
      { nome: 'bandejas', rotulo: 'Bandejas produzidas', formato: 'int', info: 'Bandejas de 200 g e embalagens de 1 kg lançadas em Dados Embalagem no período. Sem embalagem lançada, travessão.', destino: EMBALAGEM },
      { nome: 'bandejas_por_lote', rotulo: 'Bandejas por lote colhido', formato: 'dec', destino: EMBALAGEM },
    ],
  },
  contaminacao: {
    titulo: 'Contaminação',
    lancamentos: ['retirada'],
    cards: [
      { nome: 'blocos_contaminados', rotulo: 'Blocos contaminados retirados', formato: 'int', info: 'Pela data da retirada, de qualquer lote. Perda não entra.', destino: CONTAMINADOS },
      { nome: 'lotes_afetados', rotulo: 'Lotes afetados', formato: 'int', info: 'Lotes com alguma retirada por contaminação no período.', destino: CONTAMINADOS },
      { nome: 'taxa_contaminacao', rotulo: 'Taxa de contaminação', formato: 'taxa', info: 'Dos lotes produzidos no período: os blocos contaminados deles até hoje, sobre os blocos produzidos deles (a conta da Visão Executiva). O lote recente ainda não contaminou tudo, e o período em curso tende a sair mais baixo.', destino: CONTAMINADOS },
    ],
  },
};
const DO_LOTE: NomeDoIndicador[] = ['blocos_produzidos', 'kg_colhidos', 'pct_m_ou_maior', 'blocos_contaminados', 'taxa_contaminacao'];

export function valorDoIndicador(v: number | null, f: FormatoDoIndicador): string {
  if (v == null) return '—';
  if (f === 'taxa') return pct(v * 100);
  if (f === 'kg') return `${num(v, 1)} kg`;
  return num(v, f === 'dec' ? 1 : 0);
}

const comoEscrito = (v: number, casas: number) => Number(v.toLocaleString('en-US', { maximumFractionDigits: casas, useGrouping: false }));

export function variacaoDoIndicador(ind: IndicadorDoPainel, contra: 'anterior' | 'media3', f: FormatoDoIndicador): { texto: string; tom: '' | 'pos' | 'neg' } {
  const base = ind[contra];
  if (ind.atual == null || base == null) return { texto: '', tom: '' };
  const casas = f === 'kg' || f === 'dec' ? 1 : 0;
  const [a, b] = [comoEscrito(ind.atual, casas), comoEscrito(base, casas)];
  const d = f === 'taxa' ? variacaoEmPontos(ind.atual * 100, base * 100) : b === 0 ? null : comUmaCasa(((a - b) / Math.abs(b)) * 100) + 0;
  if (d == null) return { texto: 'sem base', tom: '' };
  const texto = `${d > 0 ? '+' : ''}${f === 'taxa' ? pontosPercentuais(d) : pct(d)}`;
  const tom = d === 0 || !ind.melhor ? '' : (d > 0) === (ind.melhor === 'MAIOR') ? 'pos' : 'neg';
  return { texto, tom };
}

const intervalo = (j: { inicio: string; fim: string }) => (j.inicio === j.fim ? dataBr(j.inicio) : `${dataBr(j.inicio)} a ${dataBr(j.fim)}`);
const emLista = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} e ${xs[xs.length - 1]}`);

export function fraseDoPeriodoDoPainel(ind: Exclude<IndicadoresDoPainel, { erro: string }>): string {
  const ant = ind.anteriores;
  if (ind.periodo.modo === 'lote') {
    const lotes = ant.map((a) => ('lote' in a ? dataBr(a.lote.split('|')[0]) : ''));
    return `Lote de ${dataBr(ind.periodo.data_lote)} (${ROTULO_TIPO[ind.periodo.tipo] ?? ind.periodo.tipo}), da produção até hoje. `
      + (lotes.length === 0 ? 'Nenhum lote anterior do mesmo tipo para comparar.'
        : `Anterior: o lote de ${lotes[0]}. Média de 3: ${lotes.length < 3 ? 'menos de três lotes anteriores, sem média' : `os lotes de ${emLista(lotes)}`}.`);
  }
  const janelas = ant.map((a) => ('inicio' in a ? intervalo(a) : ''));
  const inicio = ind.periodo.inicio;
  const parciais = (['producao', 'colheita', 'retirada', 'embalagem'] as const)
    .filter((f) => (ind.historico_desde[f] ?? '') > inicio)
    .map((f) => `${NOME_DO_LANCAMENTO[f]} ${dataBr(ind.historico_desde[f]!)}`);
  return `Período: ${intervalo(ind.periodo)}. Anterior: ${janelas[0]}. Média de 3: ${emLista(janelas)}.`
    + (parciais.length ? ` Lançado no sistema só a partir de: ${emLista(parciais)}.` : '');
}
const NOME_DO_LANCAMENTO = { producao: 'produção', colheita: 'colheita', retirada: 'retirada', embalagem: 'embalagem' } as const;

function LinhaDaComparacao({ rotulo, ind, contra, f }: { rotulo: string; ind: IndicadorDoPainel; contra: 'anterior' | 'media3'; f: FormatoDoIndicador }) {
  const v = variacaoDoIndicador(ind, contra, f);
  return <div>{rotulo}: {valorDoIndicador(ind[contra], f)}{v.texto && <> <span className={v.tom || undefined}>({v.texto})</span></>}</div>;
}

export function CardDoIndicadorDoPainel({ card, metricas, lote, onAbrir }: {
  card: CardDoIndicador; metricas: Record<NomeDoIndicador, IndicadorDoPainel>; lote: boolean; onAbrir?: (d: DestinoDoCard) => void;
}) {
  const ind = metricas[card.nome];
  const extra = card.nome === 'blocos_por_dia' && metricas.dias_produzidos.atual != null
    ? `em ${num(metricas.dias_produzidos.atual)} ${metricas.dias_produzidos.atual === 1 ? 'dia produzido' : 'dias produzidos'}`
    : card.nome === 'taxa_contaminacao' && metricas.contaminados_da_coorte.atual != null && metricas.blocos_produzidos.atual != null
      ? `${num(metricas.contaminados_da_coorte.atual)} de ${num(metricas.blocos_produzidos.atual)} blocos`
      : card.nome === 'pct_m_ou_maior' && ind.atual != null
        ? `${num(metricas.kg_m_ou_maior.atual, 3)} de ${num(metricas.kg_classificado.atual, 3)} kg classificados`
        : null;
  const destino = lote && card.destino === PRODUTIVIDADE ? undefined : card.destino;
  return (
    <Kpi label={card.rotulo} value={valorDoIndicador(ind.atual, card.formato)} info={card.info}
      onClick={destino && onAbrir ? () => onAbrir(destino) : undefined}
      delta={<>
        {extra && <div>{extra}</div>}
        <LinhaDaComparacao rotulo={lote ? 'lote anterior' : 'anterior'} ind={ind} contra="anterior" f={card.formato} />
        <LinhaDaComparacao rotulo={lote ? 'média de 3 lotes' : 'média de 3 períodos'} ind={ind} contra="media3" f={card.formato} />
      </>} />
  );
}

type UltimosLancamentos = PainelOperacionalResposta['ultimos_lancamentos'];

export function datasDoGrupo(grupo: keyof typeof GRUPOS_DE_INDICADORES, u: UltimosLancamentos | undefined): string[] {
  return u ? GRUPOS_DE_INDICADORES[grupo].lancamentos.filter((f) => u[f] !== undefined).map((f) => `${NOME_DO_LANCAMENTO[f]} ${dataCurta(u[f] ?? null)}`) : [];
}

export function tituloDoGrupo(grupo: keyof typeof GRUPOS_DE_INDICADORES, u: UltimosLancamentos): string {
  const { titulo } = GRUPOS_DE_INDICADORES[grupo];
  const datas = datasDoGrupo(grupo, u);
  return datas.length ? `${titulo} · lançado até: ${datas.join(', ')}` : titulo;
}

function GrupoDeIndicadores({ grupo, metricas, lote, ultimos, onAbrir }: {
  grupo: keyof typeof GRUPOS_DE_INDICADORES; metricas: Record<NomeDoIndicador, IndicadorDoPainel>; lote: boolean;
  ultimos: UltimosLancamentos; onAbrir?: (d: DestinoDoCard) => void;
}) {
  const cards = GRUPOS_DE_INDICADORES[grupo].cards.filter((c) => metricas[c.nome]);
  const visiveis = lote ? cards.filter((c) => DO_LOTE.includes(c.nome)) : cards;
  return (
    <div className="grupo-ind">
      <h4 className="rotulo">{tituloDoGrupo(grupo, ultimos)}</h4>
      <div className={`kpi-grid k${visiveis.length}`}>
        {visiveis.map((c) => <CardDoIndicadorDoPainel key={c.nome} card={c} metricas={metricas} lote={lote} onAbrir={onAbrir} />)}
      </div>
    </div>
  );
}

export function IndicadoresPrincipais({ indicadores, maturacao, alertas, ultimos, onAbrir }: {
  indicadores: PainelOperacionalResposta['indicadores']; maturacao: ReactNode; alertas: ReactNode;
  ultimos?: UltimosLancamentos; onAbrir?: (d: DestinoDoCard) => void;
}) {
  const saldo = (titulo: string, filhos: ReactNode, k: string) => (
    <div className="grupo-ind"><h4 className="rotulo">{titulo}</h4><div className={`kpi-grid ${k}`}>{filhos}</div></div>
  );
  if (!indicadores || indicadores.erro != null) {
    return (
      <>
        <div className="empty">{indicadores ? indicadores.erro : 'Este servidor ainda não calcula os indicadores do período.'}</div>
        <div className="linha-ind l-3-1">{saldo('Maturação (posição de hoje)', maturacao, 'k2')}{saldo('Alertas (posição de hoje)', alertas, '')}</div>
      </>
    );
  }
  const { metricas } = indicadores;
  const lote = indicadores.periodo.modo === 'lote';
  return (
    <>
      <div className="obs-tela">{fraseDoPeriodoDoPainel(indicadores)}</div>
      <div className="linha-ind l-2-1">
        <GrupoDeIndicadores grupo="producao" metricas={metricas} lote={lote} ultimos={ultimos} onAbrir={onAbrir} />
        {saldo('Maturação (posição de hoje)', maturacao, 'k2')}
      </div>
      <div className="linha-ind"><GrupoDeIndicadores grupo="colheita" metricas={metricas} lote={lote} ultimos={ultimos} onAbrir={onAbrir} /></div>
      <div className="linha-ind l-3-1">
        <GrupoDeIndicadores grupo="contaminacao" metricas={metricas} lote={lote} ultimos={ultimos} onAbrir={onAbrir} />
        {saldo('Alertas (posição de hoje)', alertas, '')}
      </div>
    </>
  );
}

export function pedidoDoPeriodo(
  s: { periodo: PeriodoDoPainel; mes: string; ano: string; dataLote: string; tipo: string }, hoje: string,
): { periodo?: string; mes?: string; ano?: string; lote?: string } {
  if (s.periodo === 'mes') return /^\d{4}-\d{2}$/.test(s.mes) && s.mes <= hoje.slice(0, 7) ? { periodo: 'mes', mes: s.mes } : { periodo: 'mes' };
  if (s.periodo === 'ano') return /^\d{4}$/.test(s.ano) && s.ano <= hoje.slice(0, 4) ? { periodo: 'ano', ano: s.ano } : { periodo: 'ano' };
  if (s.periodo === 'lote') return /^\d{4}-\d{2}-\d{2}$/.test(s.dataLote) && s.tipo ? { periodo: 'lote', lote: `${s.dataLote}|${s.tipo}` } : {};
  return { periodo: s.periodo };
}

export function subDoPainel(dadoAte: string | null, tipo: string | null | undefined): string {
  const nome = tipo ? ROTULO_TIPO[tipo] ?? tipo : null;
  const ate = `Dado até ${dadoAte ? dataBr(dadoAte) : '—'}`
    + (nome ? (dadoAte ? `, pela última colheita de ${nome}` : `, sem colheita de ${nome} com data até hoje`) : '');
  return `${ate}. Cada card compara o período com o anterior equivalente e com a média dos três anteriores, e o título do grupo diz até quando cada lançamento entrou${nome ? ', de todos os tipos' : ''}. Os cards que têm detalhe levam até ele no clique.`;
}

export function tituloDasUltimasColheitas(dadoAte: string | null, tipo: string | null | undefined): string {
  return `Últimas colheitas lançadas${soDoTipo(tipo)} (dado até ${dadoAte ? dataBr(dadoAte) : '—'})`;
}

const irPara = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

export function PainelOperacional() {
  const [tipo, setTipo] = useState('');
  const [periodo, setPeriodo] = useState<PeriodoDoPainel>('mes');
  const [mes, setMes] = useState('');
  const [ano, setAno] = useState('');
  const [dataLote, setDataLote] = useState('');
  const hoje = hojeISO();
  const { dados, erro } = usePainelOperacional({ tipo, ...pedidoDoPeriodo({ periodo, mes, ano, dataLote, tipo }, hoje) });
  const navegar = useNav();

  if (erro) return <div className="empty">Erro: {erro}</div>;
  if (!dados) return <div className="loading">Montando o painel operacional…</div>;

  const {
    cabecalho, alertas,
    divergencias, conta_nao_fecha, colheita,
  } = dados;

  const nomesDosGalpoes = nomesDasSalas(dados.capacidade?.salas ?? []);
  const servido = dados.indicadores && dados.indicadores.erro == null ? dados.indicadores.periodo : null;
  const desde = dados.indicadores && dados.indicadores.erro == null ? dados.indicadores.historico_desde.producao : null;
  const anos = Array.from({ length: Number(hoje.slice(0, 4)) - Number((desde ?? hoje).slice(0, 4)) + 1 }, (_, i) => String(Number(hoje.slice(0, 4)) - i));

  return (
    <>
      <Panel title="Painel Operacional" tag={`Retrato de ${dataBr(dados.hoje)}`}
        sub={subDoPainel(dados.dado_ate, dados.tipo_do_recorte)}>
        <div className="form-acao">
          {PERIODOS.map(([v, r]) => (
            <button key={v} type="button" className={periodo === v ? 'btn' : 'btn ghost'} onClick={() => setPeriodo(v)}>{r}</button>
          ))}
        </div>
        <div className="filtros">
          <div className="fg">
            <label>Tipo de cogumelo</label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
              {TIPOS.map((t) => <option key={t.v} value={t.v}>{t.rotulo}</option>)}
            </select>
          </div>
          {periodo === 'mes' && (
            <div className="fg">
              <label>Mês</label>
              <input type="month" value={mes || (servido?.modo === 'mes' ? servido.inicio.slice(0, 7) : hoje.slice(0, 7))} max={hoje.slice(0, 7)}
                onChange={(e) => setMes(e.target.value)} />
            </div>
          )}
          {periodo === 'ano' && (
            <div className="fg">
              <label>Ano</label>
              <select value={ano || hoje.slice(0, 4)} onChange={(e) => setAno(e.target.value)}>
                {anos.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          )}
          {periodo === 'lote' && (
            <div className="fg">
              <label>Data de produção do lote</label>
              <input type="date" value={dataLote} max={hoje} onChange={(e) => setDataLote(e.target.value)} />
            </div>
          )}
        </div>
        {periodo === 'lote' && (!dataLote || !tipo) && (
          <p className="nota">Para comparar um lote, escolha a data de produção dele e o tipo de cogumelo. Enquanto isso, os cards mostram o período abaixo.</p>
        )}
        <IndicadoresPrincipais indicadores={dados.indicadores} ultimos={dados.ultimos_lancamentos}
          onAbrir={(d) => ('ancora' in d ? irPara(d.ancora) : navegar(d.tela))}
          maturacao={<>
            <Kpi label="Blocos em maturação" value={formatarNumero(cabecalho.blocos_em_processo)}
              info="O saldo das estantes de maturação: produzidos menos contaminados, perdidos e abertos. É uma posição numa data, calculada sobre o que já foi lançado."
              onClick={() => irPara('posicao-dos-blocos')}
              delta={<>
                {lotesEmMaturacao(cabecalho.lotes_em_maturacao)}{soDoTipo(dados.tipo_do_recorte)} · posição de {dataBr(dados.hoje)}
                {dados.ultimos_lancamentos && <><br />{ultimoLancamento(dados.ultimos_lancamentos, dados.tipo_do_recorte)}</>}
              </>} />
            <KpiAberturasUrgentes cabecalho={cabecalho} onClick={() => navegar('proximas_aberturas')} />
          </>}
          alertas={<Kpi label="Alertas Críticos" value={formatarNumero(cabecalho.alertas_criticos)}
            tone={cabecalho.alertas_criticos > 0 ? 'alert' : 'good'}
            delta="vermelhos + endereços que vencem hoje" />} />
      </Panel>

      <PainelProdutividadeEQualidade indicadores={dados.indicadores} tipo={tipo}
        onAbrirLote={(dataLote) => { abrirJornadaEm(dataLote); navegar('jornada'); }}
        rodape={<>
          <ColheitaResumoDoDia colheita={colheita} />
          <details className="inv-dobravel">
            <summary>{tituloDasUltimasColheitas(colheita.dado_ate, dados.tipo_do_recorte)}</summary>
            <TabelaUltimasColheitas ultimas={colheita.ultimas} />
          </details>
        </>} />

      <PainelColheitaEmbalagem quadro={dados.colheita_embalagem_do_periodo !== undefined ? dados.colheita_embalagem_do_periodo : dados.colheita_embalagem}
        pedido={servido} ultimos={dados.ultimos_lancamentos} onAbrir={() => navegar('embalagem', 'embalagem-divergencias')} />

      <Panel title="Posição dos Blocos" id="posicao-dos-blocos"
        tag={`${formatarNumero(cabecalho.blocos_em_processo)} blocos em maturação`}
        pergunta="Onde estão os blocos em maturação e quais precisam ser abertos primeiro?"
        sub={fraseDaPosicao(dados.hoje, dados.ultimos_lancamentos, dados.tipo_do_recorte)}>
        <PosicaoDosBlocos linhas={dados.proximas_aberturas.linhas} nomes={nomesDosGalpoes} />
      </Panel>

      <PainelCapacidade quadro={dados.capacidade} posicao={fraseDaCapacidade(dados.hoje, dados.ultimos_lancamentos, dados.tipo_do_recorte)} />

      <QuadroDeAlertasExemplo title="Alertas sem painel próprio"
        sub="Divergências de contagem. Os outros alertas do dia estão no painel de cada área."
        categorias={categoriasDosAlertasOperacionais(alertasDoDominio(alertas, 'RESIDUAL'), nomesDosGalpoes)}
        colunas={['Lote', 'Data de produção', 'Espécie', 'Galpões', 'Diferença']} rotuloDoItem={['lote', 'lotes']}
        acao={{ texto: 'Ver conta do lote', href: '#divergencias-de-contagem' }} />

      <Panel title="Divergências de Contagem" id="divergencias-de-contagem" tag={`tolerância ±${formatarNumero(divergencias.tolerancia)} blocos`}
        sub="Lotes cuja soma (produzidos − contaminados − abertos − perdas registradas) passa da tolerância dela">
        {divergencias.lotes.length === 0 ? (
          <div className="empty">Nenhuma divergência de contagem fora da tolerância hoje.</div>
        ) : (
          <TabelaDivergencias lotes={divergencias.lotes} nomes={nomesDosGalpoes} />
        )}
        <div className="obs-tela">
          <b>A coluna Responsável pela conferência ainda vem vazia.</b> O campo existe no banco
          (lotes_producao.responsavel_conferencia), mas esta tabela ainda não o lê.
        </div>
        <PainelOutrasInconsistencias regras={divergencias.regras} />
      </Panel>

      <PainelContaNaoFecha quadro={conta_nao_fecha} nomes={nomesDosGalpoes} />

      <Panel title="Dados que Ainda Faltam" sub="Estes blocos não somem: aparecem declarados até a base trazer o dado">
        {blocosVisiveis(dados.sem_dado).map((b) => (
          <div key={b.bloco} className="obs-tela">
            <b>{b.titulo}.</b> {b.motivo}
          </div>
        ))}
      </Panel>
    </>
  );
}
