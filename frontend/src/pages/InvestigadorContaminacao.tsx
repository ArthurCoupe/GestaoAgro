import { useEffect, useMemo, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import type { ChartOptions } from 'chart.js';
import {
  dataBr, getInvestigadorContaminacao, getRegrasMaturacao, hojeISO, num, rotuloDoGalpao,
  type ChaveDoFiltro, type FatorDoInvestigador, type FichaDoLoteInvestigador, type FiltrosDoInvestigador,
  type InvestigadorContaminacaoResposta, type LinhaDoLocal, type LoteDoInvestigador, type RegraMaturacao,
  type SemanaDoInvestigador, type TempoDoInvestigador,
} from '../api/client';
import { ROTULO_TIPO } from '../components/BlocosOperacionais';
import { Dica } from '../components/Dica';
import { Kpi, Panel, Pill, useNav } from '../components/ui';
import { GRID, OLIVE } from '../charts/setup';
import {
  contagemInconsistente, menosDias, motivoDoPersonalizadoInvalido, MSG_PERSONALIZADO_INVALIDO, periodoDoModo, type ModoDoPeriodo,
} from './PainelContaminados';
import { CruzamentoDeLotes } from './CruzamentoDeLotes';
import { descartarRecadoDoInvestigador, lerRecadoDoInvestigador } from './recadoDeContaminados';
import {
  Diferenca, MAX_LOTES_NO_CRUZAMENTO, pct, pctDoLote, Quadro, ROTULO_DA_COR, rotuloDaChaveDoLote, rotuloDoLote, textoDaDiferenca,
} from './investigadorComum';

export { textoDaDiferenca };

export type ModoDoInvestigador = 'D90' | 'D30' | 'D15' | 'PERSONALIZADO';

const diasDoIntervalo = (inicio: string, fim: string) => (Date.parse(fim) - Date.parse(inicio)) / 86400000 + 1;
export const MSG_PERSONALIZADO_MAIS_DE_366_DIAS = 'Período inválido: escolha no máximo 366 dias.';

export type MotivoDoInvestigadorInvalido = 'INCOMPLETO' | 'DATA_INVALIDA' | 'MAIOR_QUE_366' | null;
export function motivoDoInvestigadorInvalido(
  personalizado: { inicio: string; fim: string }, hoje: string,
): MotivoDoInvestigadorInvalido {
  const motivo = motivoDoPersonalizadoInvalido(personalizado, hoje);
  if (motivo) return motivo;
  return diasDoIntervalo(personalizado.inicio, personalizado.fim) > 366 ? 'MAIOR_QUE_366' : null;
}

export function periodoDoInvestigador(modo: ModoDoInvestigador, hoje: string, personalizado: { inicio: string; fim: string }) {
  if (modo === 'PERSONALIZADO') {
    if (motivoDoInvestigadorInvalido(personalizado, hoje) === null) return { ...personalizado };
  } else if (modo !== 'D90') {
    const doModo = periodoDoModo(modo as ModoDoPeriodo, hoje, personalizado);
    if (doModo) return doModo;
  }
  return { inicio: menosDias(hoje, 89), fim: hoje };
}
export function periodoInicialDoRecado(lote: string | null, hoje: string): {
  modo: ModoDoInvestigador; personalizado: { inicio: string; fim: string };
} {
  const dataDoLote = lote?.slice(0, 10);
  if (!dataDoLote || dataDoLote >= menosDias(hoje, 89)) return { modo: 'D90', personalizado: { inicio: '', fim: '' } };
  const maisAntigo = menosDias(hoje, 365);
  return { modo: 'PERSONALIZADO', personalizado: { inicio: dataDoLote < maisAntigo ? maisAntigo : dataDoLote, fim: hoje } };
}
export const textoDoPeriodo = (p: { inicio: string; fim: string }) => `Período: ${dataBr(p.inicio)} a ${dataBr(p.fim)}`;
export const MSG_PERSONALIZADO_INCOMPLETO_90 = 'Preencha as duas datas. Até lá, a consulta fica nos últimos 90 dias.';

export const ORDEM_DA_TRILHA: ChaveDoFiltro[] = ['galpao', 'estante', 'especie', 'pesagem', 'semeacao', 'conferencia', 'autoclave', 'semente', 'cor', 'lote'];
export const ROTULO_DO_FILTRO: Record<ChaveDoFiltro, string> = {
  galpao: 'Galpão', estante: 'Estante', especie: 'Espécie', pesagem: 'Pesagem',
  semeacao: 'Semeação', conferencia: 'Conferência', autoclave: 'Autoclave', semente: 'Semente', cor: 'Cor', lote: 'Lote',
};

export function comFiltro(f: FiltrosDoInvestigador, chave: ChaveDoFiltro, valor: string): FiltrosDoInvestigador {
  const novo: FiltrosDoInvestigador = { ...f, [chave]: valor };
  if (chave === 'galpao' && f.galpao !== valor) delete novo.estante;
  return novo;
}
export function semFiltro(f: FiltrosDoInvestigador, chave: ChaveDoFiltro): FiltrosDoInvestigador {
  const novo: FiltrosDoInvestigador = { ...f };
  delete novo[chave];
  if (chave === 'galpao') delete novo.estante;
  return novo;
}
export function paramsDoInvestigador(periodo: { inicio: string; fim: string }, filtros: FiltrosDoInvestigador): Record<string, string> {
  const params: Record<string, string> = { inicio: periodo.inicio, fim: periodo.fim };
  for (const c of ORDEM_DA_TRILHA) if (filtros[c] != null) params[c] = filtros[c] as string;
  return params;
}

export const textoDaCobertura = (f: Pick<FatorDoInvestigador, 'titulo' | 'cobertura'>) =>
  `${f.titulo} registrada em ${num(f.cobertura.registrados)} de ${num(f.cobertura.total)} lotes`;
export const NOTA_PESSOA = 'Lote com mais de uma pessoa conta em cada uma.';
export const NOTA_SEMENTE = 'A semente vem do texto do caderno: a mesma semente pode aparecer escrita de jeitos diferentes.';
const rotuloDoValor = (chave: ChaveDoFiltro, valor: string) => (chave === 'especie' ? ROTULO_TIPO[valor] ?? valor : valor);

const plural = (n: number, um: string, varios: string) => `${num(n)} ${n === 1 ? um : varios}`;

export function fraseSemMaduro(r: { em_maturacao: number; sem_numero: number }, dias: number, comFiltro: boolean): string {
  const alvo = comFiltro ? 'recorte' : 'período';
  if (r.em_maturacao === 0 && r.sem_numero === 0) return `Nenhum lote foi produzido neste ${alvo}.`;
  if (r.em_maturacao > 0) return `Nenhum lote deste ${alvo} completou ${dias} dias; a taxa aparece quando completarem.`;
  return `Nenhum lote deste ${alvo} tem número de produzidos para calcular a taxa.`;
}

export function linhaDoForaDaTaxa(r: { em_maturacao: number; sem_numero: number }): string | null {
  const a = r.em_maturacao > 0 ? plural(r.em_maturacao, 'lote em observação', 'lotes em observação') : null;
  const b = r.sem_numero > 0 ? plural(r.sem_numero, 'lote sem número de produzidos', 'lotes sem número de produzidos') : null;
  if (a && b) return `${a} e ${b} ficam fora da taxa.`;
  if (a) return `${a} ${r.em_maturacao === 1 ? 'fica' : 'ficam'} fora da taxa.`;
  if (b) return `${b} ${r.sem_numero === 1 ? 'fica' : 'ficam'} fora da taxa.`;
  return null;
}

export function fraseDoDenominadorDoTempo(t: TempoDoInvestigador): string {
  const { total, universo } = t;
  const produzidos = `${plural(universo.lotes, 'lote produzido', 'lotes produzidos')} no período (${plural(universo.blocos_produzidos, 'bloco produzido', 'blocos produzidos')})`;
  if (total.retiradas === 0) return `Nenhum bloco contaminado foi retirado dos ${produzidos}.`;
  const origem = universo.contaminados_fora_da_taxa > 0
    ? `: ${num(universo.contaminados_maduros)} de lotes maduros e ${num(universo.contaminados_fora_da_taxa)} de lotes em observação ou sem número`
    : ': todos de lotes maduros';
  return `${plural(total.blocos, 'bloco contaminado', 'blocos contaminados')} em ${plural(total.retiradas, 'retirada', 'retiradas')}, de ${produzidos}${origem}.`;
}

export const rotuloDaSemana = (s: Pick<SemanaDoInvestigador, 'rotulo' | 'parcial'>) => (s.parcial ? `${s.rotulo} (parcial)` : s.rotulo);
export const semanaComForaDaTaxa = (s: Pick<SemanaDoInvestigador, 'em_maturacao' | 'sem_numero'>) => s.em_maturacao > 0 || s.sem_numero > 0;
export const rotuloDaSemanaNoGrafico = (s: SemanaDoInvestigador) => `${rotuloDaSemana(s)}${semanaComForaDaTaxa(s) ? ' *' : ''}`;

export type OrdemDosLotes = 'TAXA' | 'CONTAMINADOS';
const PESO_DA_CATEGORIA: Record<LoteDoInvestigador['categoria'], number> = { MADURO: 0, EM_MATURACAO: 1, SEM_NUMERO: 2 };
export function ordenarLotes(lotes: LoteDoInvestigador[], ordem: OrdemDosLotes): LoteDoInvestigador[] {
  const taxa = (l: LoteDoInvestigador) => l.taxa ?? -1;
  return [...lotes].sort((a, b) => {
    const porCategoria = ordem === 'TAXA' ? PESO_DA_CATEGORIA[a.categoria] - PESO_DA_CATEGORIA[b.categoria] : 0;
    if (porCategoria !== 0) return porCategoria;
    const porContaminados = b.blocos_contaminados - a.blocos_contaminados;
    const porTaxa = taxa(b) - taxa(a);
    const principal = a.categoria === 'MADURO' && ordem === 'TAXA' ? porTaxa || porContaminados : porContaminados || porTaxa;
    return principal || a.chave.localeCompare(b.chave);
  });
}

const entraNoTopPorTaxa = (l: LoteDoInvestigador) => l.categoria === 'MADURO' && !(l.taxa != null && l.taxa > 1);
export const topN = (ordenados: LoteDoInvestigador[], n: number, ordem: OrdemDosLotes): string[] =>
  ordenados.filter((l) => l.blocos_contaminados > 0 && (ordem !== 'TAXA' || entraNoTopPorTaxa(l))).slice(0, n).map((l) => l.chave);
export const chavesDeTodos = (ordenados: LoteDoInvestigador[]): string[] => ordenados.map((l) => l.chave);
export const alternarChave = (chaves: string[], chave: string): string[] =>
  (chaves.includes(chave) ? chaves.filter((c) => c !== chave) : [...chaves, chave]);
export const selecaoValida = (chaves: string[]) => chaves.length >= 1 && chaves.length <= MAX_LOTES_NO_CRUZAMENTO;

export function textoDaSelecao(chaves: string[], lotes: LoteDoInvestigador[]): string {
  const marcadas = new Set(chaves);
  const dosMarcados = lotes.filter((l) => marcadas.has(l.chave));
  const emMaturacao = dosMarcados.filter((l) => l.categoria === 'EM_MATURACAO').length;
  const semNumero = dosMarcados.filter((l) => l.categoria === 'SEM_NUMERO').length;
  const partes = [emMaturacao > 0 ? `${num(emMaturacao)} em observação` : '', semNumero > 0 ? `${num(semNumero)} sem número` : ''].filter(Boolean);
  const base = plural(chaves.length, 'lote selecionado', 'lotes selecionados');
  return partes.length ? `${base}, ${partes.join(' e ')}` : base;
}

export type SelecaoDeLotes = { consulta: string; chaves: string[]; caiu: boolean };
export const SELECAO_VAZIA: SelecaoDeLotes = { consulta: '', chaves: [], caiu: false };
export function selecaoDaConsulta(selecao: SelecaoDeLotes, consulta: string): { chaves: string[]; caiu: boolean } {
  if (selecao.consulta === consulta) return { chaves: selecao.chaves, caiu: selecao.caiu };
  return { chaves: [], caiu: selecao.chaves.length > 0 };
}
export function selecaoAposMudanca(selecao: SelecaoDeLotes, consulta: string): SelecaoDeLotes {
  if (selecao.consulta === consulta) return selecao;
  return { consulta, chaves: [], caiu: selecao.chaves.length > 0 };
}
export type CruzamentoAberto = { consulta: string; chaves: string[] };
export const cruzamentoAposMudanca = (c: CruzamentoAberto | null, consulta: string): CruzamentoAberto | null =>
  (c && c.consulta !== consulta ? null : c);

export const rotuloDaSituacao = (l: Pick<LoteDoInvestigador, 'categoria' | 'dias'>) => (l.categoria === 'MADURO' ? 'maduro'
  : l.categoria === 'EM_MATURACAO' ? `em observação, ${num(l.dias)} dias` : 'sem número de produzidos');

export function CorpoDoFator({ fator, onEscolher }: {
  fator: FatorDoInvestigador; onEscolher: (chave: ChaveDoFiltro, valor: string) => void;
}) {
  return (
    <>
      <p className="inv-aviso">{textoDaCobertura(fator)}</p>
      {fator.linhas.length === 0 ? <div className="empty">Nenhum lote maduro no recorte.</div> : (
        <div className="plan-wrap cp">
          <table className="plan cp">
            <thead>
              <tr>
                <th className="rotulo">{fator.titulo}</th><th className="num">Lotes</th>
                <th className="num">Produzidos</th><th className="num">Contaminados</th>
                <th className="num">Taxa</th><th className="num">Diferença</th>
              </tr>
            </thead>
            <tbody>
              {fator.linhas.map((l) => (
                <tr key={l.valor}>
                  <td className="rotulo">
                    <button type="button" className="btn ghost" onClick={() => onEscolher(fator.chave, l.valor)}>
                      {rotuloDoValor(fator.chave, l.valor)}
                    </button>
                  </td>
                  <td className="num">{num(l.lotes)}</td>
                  <td className="num">{num(l.blocos_produzidos)}</td>
                  <td className="num">{num(l.blocos_contaminados)}</td>
                  <td className="num">{pct(l.taxa)}</td>
                  <td className="num"><Diferenca pp={l.diferenca_pp} basePequena={l.base_pequena} /></td>
                </tr>
              ))}
              <tr className="ln-destaque">
                <td className="rotulo">Soma</td><td className="num">{num(fator.soma_lotes)}</td><td colSpan={4} />
              </tr>
            </tbody>
          </table>
        </div>
      )}
      {!fator.um_por_lote && (
        <p className="inv-aviso">{NOTA_PESSOA}{fator.lotes_com_mais_de_um > 0
          ? ` ${num(fator.lotes_com_mais_de_um)} ${fator.lotes_com_mais_de_um === 1 ? 'lote tem' : 'lotes têm'} mais de uma pessoa.` : ''}</p>
      )}
      {fator.chave === 'semente' && <p className="inv-aviso">{NOTA_SEMENTE}</p>}
    </>
  );
}

export function TabelaDeFator({ fator, onEscolher }: {
  fator: FatorDoInvestigador; onEscolher: (chave: ChaveDoFiltro, valor: string) => void;
}) {
  return <Panel title={fator.titulo}><CorpoDoFator fator={fator} onEscolher={onEscolher} /></Panel>;
}

function TabelaDeCor({ cor, onEscolher }: {
  cor: InvestigadorContaminacaoResposta['cor']; onEscolher: (chave: ChaveDoFiltro, valor: string) => void;
}) {
  return (
    <>
      <p className="inv-aviso">Fração dos blocos contaminados do recorte por cor da retirada. A cor é da retirada, não do lote.</p>
      <div className="plan-wrap cp">
        <table className="plan cp">
          <thead><tr><th className="rotulo">Cor</th><th className="num">Blocos</th><th className="num">Fração</th></tr></thead>
          <tbody>
            {cor.linhas.map((c) => (
              <tr key={c.cor}>
                <td className="rotulo">
                  <button type="button" className="btn ghost" onClick={() => onEscolher('cor', c.cor)}>{ROTULO_DA_COR[c.cor] ?? c.cor}</button>
                </td>
                <td className="num">{num(c.blocos)}</td><td className="num">{pct(c.fracao)}</td>
              </tr>
            ))}
            <tr className="ln-destaque"><td className="rotulo">Total</td><td className="num">{num(cor.total)}</td><td /></tr>
          </tbody>
        </table>
      </div>
    </>
  );
}

type AbaDoPerfil = 'semente' | 'especie' | 'cor';
function QuadroDeSementeEspecieCor({ dados, onEscolher }: {
  dados: InvestigadorContaminacaoResposta; onEscolher: (chave: ChaveDoFiltro, valor: string) => void;
}) {
  const [aba, setAba] = useState<AbaDoPerfil>('semente');
  const abas: Array<[AbaDoPerfil, string]> = [['semente', 'Semente'], ['especie', 'Espécie'], ['cor', 'Cor']];
  const fator = aba === 'cor' ? undefined : dados.fatores.find((f) => f.chave === aba);
  return (
    <Quadro
      titulo="Semente, espécie e cor"
      dica="Lotes produzidos no período, só os maduros na taxa. Clique numa linha para filtrar a tela. A diferença é a taxa da linha contra a do período inteiro, em pontos percentuais; linha com menos de 10 lotes maduros é base pequena e fica sem cor."
    >
      <div className="inv-abas" role="group" aria-label="Ver por">
        {abas.map(([a, rotulo]) => (
          <button key={a} type="button" className={a === aba ? 'btn' : 'btn ghost'} aria-pressed={a === aba} onClick={() => setAba(a)}>{rotulo}</button>
        ))}
      </div>
      {aba === 'cor' ? <TabelaDeCor cor={dados.cor} onEscolher={onEscolher} />
        : fator ? <CorpoDoFator fator={fator} onEscolher={onEscolher} /> : <div className="empty">Sem dado para este recorte.</div>}
    </Quadro>
  );
}

function TabelaOnde({ onde, filtros, regras, onEscolher }: {
  onde: InvestigadorContaminacaoResposta['onde']; filtros: FiltrosDoInvestigador; regras: RegraMaturacao[];
  onEscolher: (chave: ChaveDoFiltro, valor: string) => void;
}) {
  const galpao = filtros.galpao != null ? onde.galpoes.find((g) => g.galpao === filtros.galpao) : undefined;
  const linhas: LinhaDoLocal[] = galpao ? galpao.estantes : onde.galpoes;
  const totalDaLista: LinhaDoLocal = galpao ?? onde.total;
  const foraDaTabela = [
    onde.sem_lote.contaminados > 0 ? `${plural(onde.sem_lote.contaminados, 'bloco', 'blocos')} sem lote reconhecido` : '',
    onde.pesquisa.contaminados > 0 ? `${plural(onde.pesquisa.contaminados, 'bloco', 'blocos')} de lote de pesquisa` : '',
  ].filter(Boolean);
  return (
    <Quadro
      titulo={galpao ? `Onde: estantes de ${rotuloDoGalpao(galpao.galpao, regras)}` : 'Onde: galpões'}
      dica={'Este quadro conta pela data da RETIRADA do bloco contaminado no período, a mesma conta do Painel de Contaminados; os outros quadros contam pelos lotes produzidos no período. '
        + 'Clique num galpão para ver as estantes, numa estante para ver os lotes dela na lista.'}
    >
      <p className="inv-aviso">Pela data da retirada do bloco contaminado no período, não pela data do lote.</p>
      {linhas.length === 0 ? <div className="empty">Nenhuma retirada no período para este recorte.</div> : (
        <div className="plan-wrap cp">
          <table className="plan cp">
            <thead>
              <tr>
                <th className="rotulo">{galpao ? 'Estante' : 'Galpão'}</th><th className="num">Contaminados</th>
                <th className="num">Ocupação média</th><th className="num">Taxa do local</th><th className="rotulo">Leitura</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => {
                const chave: ChaveDoFiltro = galpao ? 'estante' : 'galpao';
                const valor = (galpao ? l.estante : l.galpao) ?? '—';
                return (
                  <tr key={l.chave}>
                    <td className="rotulo">
                      <button type="button" className="btn ghost" onClick={() => onEscolher(chave, valor)}>
                        {galpao ? `${valor}${l.estante_fisica ? ` (${l.estante_fisica})` : ''}` : rotuloDoGalpao(valor, regras)}
                      </button>
                    </td>
                    <td className="num">{num(l.contaminados)}</td>
                    <td className="num">{num(l.ocupacao_media)}</td>
                    <td className="num">{pct(l.taxa)}</td>
                    <td className="rotulo">{l.divergencia ? 'ocupação a conferir' : ''}</td>
                  </tr>
                );
              })}
              <tr className="ln-destaque">
                <td className="rotulo">Total</td><td className="num">{num(totalDaLista.contaminados)}</td>
                <td className="num">{num(totalDaLista.ocupacao_media)}</td><td className="num">{pct(totalDaLista.taxa)}</td><td />
              </tr>
            </tbody>
          </table>
        </div>
      )}
      {foraDaTabela.length > 0 && !galpao && <p className="inv-aviso">Fora desta tabela: {foraDaTabela.join(' e ')}.</p>}
    </Quadro>
  );
}

const OPCOES_DO_GRAFICO: ChartOptions<'bar'> = {
  responsive: true,
  maintainAspectRatio: false,
  indexAxis: 'y',
  plugins: { legend: { display: false } },
  scales: {
    x: { beginAtZero: true, grid: GRID, ticks: { callback: (v) => `${v}%` } },
    y: { grid: { display: false } },
  },
};

function QuadroDasSemanas({ semanas, recorte, maturidadeDias }: {
  semanas: SemanaDoInvestigador[]; recorte: InvestigadorContaminacaoResposta['recorte']; maturidadeDias: number;
}) {
  const grafico = {
    labels: semanas.map(rotuloDaSemanaNoGrafico),
    datasets: [{
      label: 'Taxa dos lotes maduros (%)',
      data: semanas.map((s) => (s.taxa == null ? null : Math.round(s.taxa * 1000) / 10)),
      backgroundColor: OLIVE, borderRadius: 4,
    }],
  };
  return (
    <Quadro
      titulo="Evolução por semana de produção"
      dica={`Cada barra é uma semana de PRODUÇÃO (segunda a domingo), da mais recente para a mais antiga, e conta os lotes produzidos nela. A taxa só considera os lotes com ${maturidadeDias} dias ou mais desde a produção (os dias mínimos de Metas Operacionais, que não são a maturação do galpão); semana sem lote maduro fica sem barra.`}
    >
      {semanas.length === 0 ? <div className="empty">Nenhum lote produzido no período para este recorte.</div> : (
        <>
          <div className="chart-box" style={{ height: `${Math.max(120, semanas.length * 26 + 36)}px` }}>
            <Bar data={grafico} options={OPCOES_DO_GRAFICO} />
          </div>
          {semanas.some(semanaComForaDaTaxa) && (
            <p className="inv-aviso">* Semana com lote em observação ou sem número: a taxa dela considera só os lotes maduros.</p>
          )}
          {semanas.some((s) => s.parcial) && (
            <p className="inv-aviso">(parcial): o período começa ou termina no meio dessa semana.</p>
          )}
          <details className="inv-dobravel">
            <summary>Números por semana</summary>
            <div className="plan-wrap cp">
              <table className="plan cp">
                <thead>
                  <tr>
                    <th className="rotulo">Semana de produção</th><th className="num">Lotes maduros</th><th className="num">Produzidos</th>
                    <th className="num">Contaminados</th><th className="num">Taxa</th><th className="rotulo">Fora da taxa</th>
                  </tr>
                </thead>
                <tbody>
                  {semanas.map((s) => (
                    <tr key={s.semana}>
                      <td className="rotulo">{rotuloDaSemana(s)}</td><td className="num">{num(s.maduros)}</td><td className="num">{num(s.blocos_produzidos)}</td>
                      <td className="num">{num(s.blocos_contaminados)}</td><td className="num">{pct(s.taxa)}</td>
                      <td className="rotulo">{linhaDoForaDaTaxa(s) ?? ''}</td>
                    </tr>
                  ))}
                  <tr className="ln-destaque">
                    <td className="rotulo">Total</td><td className="num">{num(recorte.lotes)}</td><td className="num">{num(recorte.blocos_produzidos)}</td>
                    <td className="num">{num(recorte.blocos_contaminados)}</td><td className="num">{pct(recorte.taxa)}</td><td />
                  </tr>
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </Quadro>
  );
}

function QuadroDoTempo({ tempo }: { tempo: TempoDoInvestigador }) {
  const larguraMax = Math.max(0, ...tempo.faixas.map((f) => f.pct_blocos ?? 0));
  return (
    <Quadro
      titulo="Tempo até a retirada"
      dica={'Dias entre a produção do lote e a retirada do bloco contaminado, nos lotes produzidos no período (todos, maduros ou não). A porcentagem é sobre os blocos contaminados desses lotes. '
        + 'Retirada sem data, ou com data anterior à do lote, fica numa linha à parte e entra no total. Sem cor: o tempo mostra quando acontece, não julga.'}
    >
      <p className="inv-aviso">{fraseDoDenominadorDoTempo(tempo)}</p>
      {tempo.total.retiradas > 0 && (
        <div className="plan-wrap cp">
          <table className="plan cp">
            <thead>
              <tr><th className="rotulo">Tempo</th><th className="num">Blocos</th><th className="num">% dos blocos</th><th className="num">Retiradas</th><th className="rotulo" /></tr>
            </thead>
            <tbody>
              {tempo.faixas.map((f) => (
                <tr key={f.chave}>
                  <td className="rotulo">{f.rotulo}</td><td className="num">{num(f.blocos)}</td><td className="num">{pct(f.pct_blocos)}</td><td className="num">{num(f.retiradas)}</td>
                  <td className="rotulo">
                    <span className="inv-barra-faixa" style={{ width: `${larguraMax > 0 ? Math.round(((f.pct_blocos ?? 0) / larguraMax) * 80) : 0}px` }} />
                  </td>
                </tr>
              ))}
              {tempo.sem_data_valida.retiradas > 0 && (
                <tr>
                  <td className="rotulo">Sem data válida</td><td className="num">{num(tempo.sem_data_valida.blocos)}</td>
                  <td className="num">{pct(tempo.sem_data_valida.pct_blocos)}</td><td className="num">{num(tempo.sem_data_valida.retiradas)}</td><td />
                </tr>
              )}
              <tr className="ln-destaque">
                <td className="rotulo">Total</td><td className="num">{num(tempo.total.blocos)}</td><td className="num">{pct(1)}</td><td className="num">{num(tempo.total.retiradas)}</td><td />
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </Quadro>
  );
}

export const AVISO_CONTAGEM_A_CONFERIR = 'Contagem a conferir: foram retirados mais blocos do que o lote registra como produzidos. A taxa é a conta literal, e o cadastro do lote precisa de conferência.';

export function TabelaDeLotes({ lotes, regras, chaves, onMudarSelecao, onCruzar, onEscolher, selecaoCaiu, ordem: ordemDeFora, onMudarOrdem }: {
  lotes: LoteDoInvestigador[]; regras: RegraMaturacao[]; chaves: string[];
  onMudarSelecao: (chaves: string[]) => void; onCruzar: () => void;
  onEscolher: (chave: ChaveDoFiltro, valor: string) => void; selecaoCaiu: boolean;
  ordem?: OrdemDosLotes; onMudarOrdem?: (o: OrdemDosLotes) => void;
}) {
  const [ordemLocal, setOrdemLocal] = useState<OrdemDosLotes>('TAXA');
  const ordem = ordemDeFora ?? ordemLocal;
  const setOrdem = onMudarOrdem ?? setOrdemLocal;
  const ordenados = useMemo(() => ordenarLotes(lotes, ordem), [lotes, ordem]);
  const marcadas = new Set(chaves);
  const temContagemAConferir = lotes.some((l) => l.categoria === 'MADURO' && contagemInconsistente(l.taxa));
  return (
    <Quadro
      titulo="Lotes do período"
      dica={'Lotes produzidos no período e no recorte. Marque os lotes e clique em CRUZAR SELECIONADOS para ver o que eles têm em comum. '
        + 'Top 5 e Top 10 marcam os primeiros da lista que têm bloco contaminado; em Maior taxa só entram lotes maduros. '
        + 'Clicar na linha abre a ficha do lote. Em observação e sem número ficam fora da taxa.'}
    >
      <div className="inv-ferramentas">
        <div className="inv-abas" role="group" aria-label="Ordenar por" style={{ marginBottom: 0 }}>
          <button type="button" className={ordem === 'TAXA' ? 'btn' : 'btn ghost'} aria-pressed={ordem === 'TAXA'} onClick={() => setOrdem('TAXA')}>Maior taxa</button>
          <button type="button" className={ordem === 'CONTAMINADOS' ? 'btn' : 'btn ghost'} aria-pressed={ordem === 'CONTAMINADOS'} onClick={() => setOrdem('CONTAMINADOS')}>Mais contaminados</button>
        </div>
        <button type="button" className="btn ghost" onClick={() => onMudarSelecao(topN(ordenados, 5, ordem))}>Top 5</button>
        <button type="button" className="btn ghost" onClick={() => onMudarSelecao(topN(ordenados, 10, ordem))}>Top 10</button>
        <button type="button" className="btn ghost" onClick={() => onMudarSelecao(chavesDeTodos(ordenados))}>Todos</button>
        <button type="button" className="btn ghost" aria-label="Limpar seleção" onClick={() => onMudarSelecao([])}>Limpar</button>
        <button type="button" className="btn" disabled={!selecaoValida(chaves)} onClick={onCruzar}>CRUZAR SELECIONADOS ({num(chaves.length)})</button>
        <span className="inv-contagem">{textoDaSelecao(chaves, lotes)}</span>
      </div>
      {chaves.length > MAX_LOTES_NO_CRUZAMENTO && (
        <p className="inv-aviso">O cruzamento aceita no máximo {MAX_LOTES_NO_CRUZAMENTO} lotes por vez. Desmarque alguns.</p>
      )}
      {selecaoCaiu && <p className="inv-aviso">A seleção foi desfeita porque o período ou o filtro mudou.</p>}
      {lotes.length === 0 ? <div className="empty">Nenhum lote produzido no período para este recorte.</div> : (
        <div className="plan-wrap cp">
          <table className="plan cp">
            <thead>
              <tr>
                <th aria-label="Selecionar" /><th className="rotulo">Lote</th><th className="num">Produzidos</th><th className="num">Contaminados</th><th className="num">Taxa</th>
                <th className="rotulo">Galpão</th><th className="rotulo">Semente</th><th className="rotulo">Semeação</th><th className="rotulo">Situação</th>
              </tr>
            </thead>
            <tbody>
              {ordenados.map((l) => {
                const rotulo = rotuloDoLote(l);
                const marcado = marcadas.has(l.chave);
                const alternar = () => onMudarSelecao(alternarChave(chaves, l.chave));
                return (
                  <tr key={l.chave} className={marcado ? 'inv-clicavel inv-marcada' : 'inv-clicavel'} onClick={() => onEscolher('lote', l.chave)}>
                    <td className="inv-celula-checagem" onClick={(e) => { e.stopPropagation(); if (e.target === e.currentTarget) alternar(); }}>
                      <input
                        type="checkbox" className="inv-checagem" checked={marcado} aria-label={`Selecionar o lote ${rotulo}`}
                        onClick={(e) => e.stopPropagation()} onChange={alternar}
                      />
                    </td>
                    <td className="rotulo">
                      <button type="button" className="btn ghost">{rotulo}</button>
                      {l.categoria === 'MADURO' && contagemInconsistente(l.taxa) && <> <Pill tone="warn">contagem a conferir</Pill></>}
                    </td>
                    <td className="num">{l.categoria === 'SEM_NUMERO' ? '—' : num(l.blocos_produzidos)}</td>
                    <td className="num">{num(l.blocos_contaminados)}</td>
                    <td className="num">{l.categoria === 'MADURO' ? pctDoLote(l) : '—'}</td>
                    <td className="rotulo">{l.galpoes.map((g) => rotuloDoGalpao(g, regras)).join(', ')}</td>
                    <td className="rotulo">{l.semente}</td>
                    <td className="rotulo">{l.semeacao.join(', ')}</td>
                    <td className="rotulo">{rotuloDaSituacao(l)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {temContagemAConferir && <p className="inv-aviso">{AVISO_CONTAGEM_A_CONFERIR}</p>}
    </Quadro>
  );
}

export function subtituloDaFicha(f: Pick<LoteDoInvestigador, 'categoria' | 'dias' | 'taxa' | 'blocos_produzidos' | 'blocos_contaminados'>): string {
  if (f.categoria === 'MADURO') {
    const aConferir = contagemInconsistente(f.taxa) ? ' · contagem a conferir' : '';
    return `Taxa do lote ${pctDoLote(f)} · ${num(f.blocos_contaminados)} de ${num(f.blocos_produzidos)} blocos${aConferir}`;
  }
  const blocos = f.categoria === 'SEM_NUMERO'
    ? `${plural(f.blocos_contaminados, 'bloco contaminado', 'blocos contaminados')}`
    : `${num(f.blocos_contaminados)} de ${num(f.blocos_produzidos)} blocos`;
  return `${rotuloDaSituacao(f)} · ${blocos}`;
}

export function FichaDoLote({ ficha, regras }: { ficha: FichaDoLoteInvestigador; regras: RegraMaturacao[] }) {
  return (
    <Panel title={`Lote ${rotuloDoLote(ficha)}`}
      sub={subtituloDaFicha(ficha)}>
      <div className="plan-wrap">
        <table className="plan">
          <thead><tr><th className="rotulo">Etapa</th><th className="rotulo">Quando</th><th className="rotulo">Quem</th></tr></thead>
          <tbody>
            {ficha.etapas.map((e) => (
              <tr key={e.etapa}>
                <td className="rotulo">{e.etapa}</td>
                <td className="rotulo">{e.quando == null ? '—' : /^\d{4}-\d{2}-\d{2}$/.test(e.quando) ? dataBr(e.quando) : e.quando}</td>
                <td className="rotulo">{e.pessoas.join(', ') || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="nota">Semente: {ficha.sementes.join(' · ') || 'Sem registro'}</p>
      <div className="plan-wrap">
        <table className="plan">
          <thead><tr><th className="rotulo">Galpão</th><th className="rotulo">Estante</th><th className="num">Blocos produzidos</th></tr></thead>
          <tbody>
            {ficha.linhas.map((l, i) => (
              <tr key={i}><td className="rotulo">{rotuloDoGalpao(l.galpao, regras)}</td><td className="rotulo">{l.estante}{l.estante_fisica ? ` (${l.estante_fisica})` : ''}</td><td className="num">{num(l.blocos_produzidos)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      {ficha.retiradas.length > 0 && (
        <div className="plan-wrap">
          <table className="plan">
            <thead><tr><th className="rotulo">Retirada</th><th className="rotulo">Galpão</th><th className="rotulo">Estante</th><th className="rotulo">Tipo</th><th className="num">Blocos</th><th className="rotulo">Cor</th></tr></thead>
            <tbody>
              {ficha.retiradas.map((r, i) => (
                <tr key={i}>
                  <td className="rotulo">{dataBr(r.data_evento)}</td><td className="rotulo">{rotuloDoGalpao(r.galpao, regras)}</td><td className="rotulo">{r.estante}</td>
                  <td className="rotulo">{r.tipo === 'CONTAMINACAO' ? 'Contaminação' : 'Perda'}</td><td className="num">{num(r.blocos)}</td>
                  <td className="rotulo">{r.cor ? ROTULO_DA_COR[r.cor] ?? r.cor : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {ficha.autoclave.length > 0 && (
        <div className="plan-wrap">
          <table className="plan">
            <thead><tr><th className="num">Batida</th><th className="rotulo">Responsável</th><th className="rotulo">Entrada</th><th className="rotulo">Atingiu 121</th><th className="rotulo">Fim 2h</th><th className="rotulo">Queda de 121</th><th className="rotulo">Pressão na faixa</th></tr></thead>
            <tbody>
              {ficha.autoclave.map((a, i) => (
                <tr key={i}>
                  <td className="num">{a.ordem ?? '—'}</td><td className="rotulo">{a.responsavel ?? '—'}</td><td className="rotulo">{a.entrada ?? '—'}</td>
                  <td className="rotulo">{a.atingiu_121 ?? '—'}</td><td className="rotulo">{a.fim_2h ?? '—'}</td>
                  <td className="rotulo">{a.houve_queda_121 == null ? '—' : a.houve_queda_121 ? 'Sim' : 'Não'}</td>
                  <td className="rotulo">{a.pressao_na_faixa == null ? '—' : a.pressao_na_faixa ? 'Sim' : 'Não'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

export const notaDoAjusteHistorico = (a: InvestigadorContaminacaoResposta['ajuste_historico']) =>
  `Fora desta análise: o ajuste histórico de ${num(a.blocos)} blocos (${num(a.registros)} retiradas anteriores a ${dataBr(a.corte)}, sem lote, galpão, estante, espécie e cor). Ele entra só no total e na taxa geral do Painel de Contaminados.`;

export function ConteudoDoInvestigador({
  dados, regras, onEscolher, chaves = [], onMudarSelecao = () => {}, onCruzar = () => {},
  cruzando = null, onVoltarDoCruzamento = () => {}, selecaoCaiu = false,
}: {
  dados: InvestigadorContaminacaoResposta; regras: RegraMaturacao[];
  onEscolher: (chave: ChaveDoFiltro, valor: string) => void;
  chaves?: string[]; onMudarSelecao?: (chaves: string[]) => void; onCruzar?: () => void;
  cruzando?: string[] | null; onVoltarDoCruzamento?: () => void; selecaoCaiu?: boolean;
}) {
  const { recorte, referencia } = dados;
  const semMaduro = recorte.lotes === 0;
  const foraDaTaxa = linhaDoForaDaTaxa(recorte);
  const comFiltro = ORDEM_DA_TRILHA.some((c) => dados.filtros?.[c] != null);
  const [ordem, setOrdem] = useState<OrdemDosLotes>('TAXA');
  return (
    <>
      <div className="inv-linha-discreta">
        Ajuste histórico de {num(dados.ajuste_historico.blocos)} blocos fora desta análise.
        <Dica rotulo="Sobre o ajuste histórico">{notaDoAjusteHistorico(dados.ajuste_historico)}</Dica>
      </div>
      <div className="kpi-grid k4">
        <Kpi label="Produzidos" value={semMaduro ? '—' : num(recorte.blocos_produzidos)} delta={`${plural(recorte.lotes, 'lote maduro', 'lotes maduros')}`} />
        <Kpi label="Contaminados" value={semMaduro ? '—' : num(recorte.blocos_contaminados)} delta="só dos lotes maduros" />
        <Kpi label="Taxa" value={pct(recorte.taxa)} delta={`período inteiro, sem filtros: ${pct(referencia.taxa)} (${plural(referencia.lotes, 'lote maduro', 'lotes maduros')})`} />
        <Kpi
          label="Lotes críticos" tone={recorte.criticos > 0 ? 'warn' : undefined}
          value={semMaduro ? '—' : `${num(recorte.criticos)} de ${num(recorte.lotes)}`}
          delta={`maduros com taxa de ${pct(recorte.corte_critico)} ou mais`}
        />
      </div>
      {semMaduro && <p className="inv-linha-discreta">{fraseSemMaduro(recorte, dados.maturidade_dias, comFiltro)}</p>}
      {foraDaTaxa && <p className="inv-linha-discreta">{foraDaTaxa}</p>}
      {recorte.contagem_a_conferir > 0 && (
        <p className="inv-linha-discreta">
          {plural(recorte.contagem_a_conferir, 'lote maduro tem', 'lotes maduros têm')} contagem a conferir (mais blocos retirados do que produzidos) e não {recorte.contagem_a_conferir === 1 ? 'entra' : 'entram'} em Lotes críticos.
        </p>
      )}
      {dados.ficha && <FichaDoLote ficha={dados.ficha} regras={regras} />}
      <div className="row r-1-1">
        <QuadroDasSemanas semanas={dados.semanas} recorte={recorte} maturidadeDias={dados.maturidade_dias} />
        <QuadroDoTempo tempo={dados.tempo} />
      </div>
      <div className="row r-1-1">
        <TabelaOnde onde={dados.onde} filtros={dados.filtros} regras={regras} onEscolher={onEscolher} />
        <QuadroDeSementeEspecieCor dados={dados} onEscolher={onEscolher} />
      </div>
      {cruzando ? (
        <CruzamentoDeLotes inicio={dados.inicio} fim={dados.fim} chaves={cruzando} regras={regras} onVoltar={onVoltarDoCruzamento} />
      ) : (
        <TabelaDeLotes
          lotes={dados.lotes} regras={regras} chaves={chaves} onMudarSelecao={onMudarSelecao} onCruzar={onCruzar}
          onEscolher={onEscolher} selecaoCaiu={selecaoCaiu} ordem={ordem} onMudarOrdem={setOrdem}
        />
      )}
      <Quadro
        titulo="Pessoas por etapa"
        dica="Taxa dos lotes maduros por quem fez cada etapa. É um padrão para investigar, nunca uma avaliação: lote com mais de uma pessoa conta em cada uma, e base pequena fica sem cor."
      >
        <details className="inv-dobravel">
          <summary>Ver pesagem, semeação, conferência e autoclave</summary>
          {dados.fatores.filter((f) => ['pesagem', 'semeacao', 'conferencia', 'autoclave'].includes(f.chave)).map((f) => (
            <div key={f.chave}>
              <h4>{f.titulo}</h4>
              <CorpoDoFator fator={f} onEscolher={onEscolher} />
            </div>
          ))}
        </details>
      </Quadro>
    </>
  );
}

export type EstadoDoInvestigador = 'CARREGANDO' | 'ERRO' | 'CONTEUDO';
export function estadoDoInvestigador(dados: InvestigadorContaminacaoResposta | null, erro: string): EstadoDoInvestigador {
  if (dados) return 'CONTEUDO';
  return erro ? 'ERRO' : 'CARREGANDO';
}

export function Trilha({ filtros, regras, onTirar, onLimpar }: {
  filtros: FiltrosDoInvestigador; regras: RegraMaturacao[];
  onTirar: (c: ChaveDoFiltro) => void; onLimpar: () => void;
}) {
  const ativos = ORDEM_DA_TRILHA.filter((c) => filtros[c] != null);
  if (ativos.length === 0) return <p className="nota">Sem filtros: todos os lotes do período. Clique numa linha para filtrar.</p>;
  return (
    <div className="form-acao">
      {ativos.map((c) => {
        const v = filtros[c] as string;
        const texto = c === 'galpao' ? rotuloDoGalpao(v, regras)
          : c === 'especie' ? ROTULO_TIPO[v] ?? v
          : c === 'cor' ? ROTULO_DA_COR[v] ?? v
          : c === 'lote' ? rotuloDaChaveDoLote(v)
          : v;
        return (
          <button key={c} type="button" className="btn ghost" aria-label={`Tirar o filtro ${ROTULO_DO_FILTRO[c]}`} onClick={() => onTirar(c)}>
            {ROTULO_DO_FILTRO[c]}: {texto} ×
          </button>
        );
      })}
      <button type="button" className="btn ghost" aria-label="Limpar filtros" onClick={onLimpar}>Limpar</button>
    </div>
  );
}

export function InvestigadorContaminacao() {
  const navegar = useNav();
  const hoje = hojeISO();
  const [recado] = useState(() => {
    const lote = lerRecadoDoInvestigador();
    return { lote, ...periodoInicialDoRecado(lote, hoje) };
  });
  const [modo, setModo] = useState<ModoDoInvestigador>(recado.modo);
  const [personalizado, setPersonalizado] = useState(recado.personalizado);
  const [filtros, setFiltros] = useState<FiltrosDoInvestigador>(recado.lote ? { lote: recado.lote } : {});
  useEffect(() => { descartarRecadoDoInvestigador(); }, []);
  const [dados, setDados] = useState<InvestigadorContaminacaoResposta | null>(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);
  const periodo = periodoDoInvestigador(modo, hoje, personalizado);
  const consulta = JSON.stringify(paramsDoInvestigador(periodo, filtros));

  const [selecao, setSelecao] = useState<SelecaoDeLotes>(SELECAO_VAZIA);
  const [cruzamento, setCruzamento] = useState<CruzamentoAberto | null>(null);
  const { chaves, caiu } = selecaoDaConsulta(selecao, consulta);
  const cruzando = cruzamento && cruzamento.consulta === consulta ? cruzamento.chaves : null;
  useEffect(() => {
    setSelecao((s) => selecaoAposMudanca(s, consulta));
    setCruzamento((c) => cruzamentoAposMudanca(c, consulta));
  }, [consulta]);

  useEffect(() => {
    let vivo = true;
    setErro('');
    setCarregando(true);
    getInvestigadorContaminacao(JSON.parse(consulta) as Record<string, string>)
      .then((r) => { if (vivo) { setDados(r); setCarregando(false); } })
      .catch((e) => { if (vivo) { setDados(null); setErro(e?.response?.data?.erro ?? e.message); setCarregando(false); } });
    return () => { vivo = false; };
  }, [consulta]);

  const [regras, setRegras] = useState<RegraMaturacao[]>([]);
  useEffect(() => { getRegrasMaturacao().then(setRegras).catch(() => setRegras([])); }, []);

  const motivo = modo === 'PERSONALIZADO' ? motivoDoInvestigadorInvalido(personalizado, hoje) : null;
  const estado = estadoDoInvestigador(dados, erro);
  const botoes: Array<[ModoDoInvestigador, string]> = [
    ['D15', 'Últimos 15 dias'], ['D30', 'Últimos 30 dias'], ['D90', 'Últimos 90 dias'], ['PERSONALIZADO', 'Personalizado'],
  ];
  return (
    <>
      <div className="form-acao">
        <button type="button" className="btn ghost" onClick={() => navegar('painel_contaminados')}>Voltar ao Painel de Contaminados</button>
      </div>
      <Quadro
        titulo="Período e filtros"
        dica="O período escolhe os lotes PRODUZIDOS nele (a data do lote), e tudo na tela obedece: os cards, as semanas, o tempo, a lista de lotes e o cruzamento. Só entram na taxa os lotes que já completaram os dias mínimos de observação de Metas Operacionais, que não são a maturação do galpão. O quadro de galpões é a exceção e conta pela data da retirada. Cada clique numa linha entra como filtro; o × tira o filtro."
      >
        <div className="form-acao">
          {botoes.map(([m, rotulo]) => (
            <button key={m} type="button" className={m === modo ? 'btn' : 'btn ghost'} aria-pressed={m === modo} onClick={() => setModo(m)}>{rotulo}</button>
          ))}
          {modo === 'PERSONALIZADO' && (
            <>
              <label>de <input type="date" value={personalizado.inicio} max={personalizado.fim || hoje}
                onChange={(e) => setPersonalizado({ ...personalizado, inicio: e.target.value })} /></label>
              <label>até <input type="date" value={personalizado.fim} min={personalizado.inicio || undefined} max={hoje}
                onChange={(e) => setPersonalizado({ ...personalizado, fim: e.target.value })} /></label>
            </>
          )}
        </div>
        {motivo && (
          <div className="empty">
            {motivo === 'DATA_INVALIDA' ? MSG_PERSONALIZADO_INVALIDO
              : motivo === 'MAIOR_QUE_366' ? MSG_PERSONALIZADO_MAIS_DE_366_DIAS
              : MSG_PERSONALIZADO_INCOMPLETO_90}
          </div>
        )}
        <p className="inv-aviso" data-testid="periodo-resolvido">{textoDoPeriodo(periodo)}</p>
        <Trilha filtros={filtros} regras={regras} onTirar={(c) => setFiltros((f) => semFiltro(f, c))} onLimpar={() => setFiltros({})} />
        {erro && <div className="empty">Erro: {erro}</div>}
        {carregando && dados && <p className="inv-carregando" role="status">Atualizando…</p>}
      </Quadro>
      {estado === 'CONTEUDO' && dados && (
        <div className={carregando ? 'inv-atualizando' : undefined} aria-busy={carregando}>
          <ConteudoDoInvestigador
            dados={dados} regras={regras} onEscolher={(c, v) => { if (!carregando) setFiltros((f) => comFiltro(f, c, v)); }}
            chaves={chaves} selecaoCaiu={caiu}
            onMudarSelecao={(novas) => { if (!carregando) setSelecao({ consulta, chaves: novas, caiu: false }); }}
            onCruzar={() => { if (!carregando && selecaoValida(chaves)) setCruzamento({ consulta, chaves }); }}
            cruzando={cruzando} onVoltarDoCruzamento={() => setCruzamento(null)}
          />
        </div>
      )}
      {estado === 'CARREGANDO' && <div className="loading">Carregando…</div>}
    </>
  );
}
