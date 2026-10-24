import { useRef, useState, type MouseEvent } from 'react';
import { brl, pct } from '../api/client';
import { alertasDaSerie, maioresVariacoes, type AlertasDaSerie, type NivelAlerta } from '../api/alertas';
import type { VisaoNova } from '../api/dreNova';
import { CAMPOS_DA_ESCADA, ehChaveDoGrupo, ehVariedade, getLancamentosDoGrupo, infoDaEscada, rotulosDaEscada, type ChaveDaEscadaPorAtividade, type ChaveDaVariedade, type ChaveDoGrupo, type Escada, type EscadaPorAtividade, type ExecutivoSerieMensal, type FolhaPendente, type LimiaresAlerta, type Regime } from '../api/gerencial';
import { PERGUNTAS } from '../api/perguntasGerenciais';
import { ehAcumuladoDoAno } from './abrirNaDre';
import { serieSemMesesPendentes } from './AvisoDaFolha';
import { rotuloDoMesCurto } from './EvolucaoMensal';
import {
  aplicarLancamentos, FRASE_ESPECIE, LancamentosDaCelula, mesmaCelula, pedidoDaCelula, periodoDaColuna, recorteDaChave, rotuloDoIntervalo,
  type AberturaDaCelula, type AlvoDaCelula, type EstadoDosLancamentos,
} from './LancamentosDaCelula';
import { Panel } from './ui';

export interface CelulaEscadaMensal {
  valor: number | null;
  texto: string;
  nivel: NivelAlerta;
  title: string | null;
}

export interface ColunaEscadaMensal {
  mes: string;
  rotulo: string;
  semFato: boolean;
  melhor: boolean;
  title: string | null;
}

export interface LinhaEscadaMensal {
  campo: keyof Escada;
  rotulo: string;
  tipo: 'valor' | 'total' | 'pct';
  separado: boolean;
  info: { pergunta: string; formula: string } | null;
  celulas: CelulaEscadaMensal[];
  ytd: CelulaEscadaMensal;
}

const GLIFO: Record<Exclude<NivelAlerta, null>, string> = { critico: '‼', atencao: '!', destaque: '▲' };

export function celulasDaEscadaMensal(serie: ExecutivoSerieMensal[], ytd: Escada, alertas: AlertasDaSerie, rotulos: Record<keyof Escada, string>, regime: Regime, mascararReceita = false,
  serieDosAlertas: ExecutivoSerieMensal[] = serie): {
  colunas: ColunaEscadaMensal[]; linhas: LinhaEscadaMensal[];
} {
  const colunas = serie.map<ColunaEscadaMensal>((s) => {
    const melhor = s.mes === alertas.melhor_mes;
    return { mes: s.mes, rotulo: rotuloDoMesCurto(s.mes), semFato: s.escada == null, melhor, title: melhor ? `melhor mês (${rotulos.resultado_competencia.toLowerCase()}): ${alertas.motivo_melhor_mes}` : null };
  });
  const anterior: Array<number | null> = [];
  let ultimo: number | null = null;
  serieDosAlertas.forEach((s, i) => { anterior.push(ultimo); if (s.escada != null) ultimo = i; });

  const celula = (v: number | null, tipo: LinhaEscadaMensal['tipo'], nivel: NivelAlerta = null, title: string | null = null): CelulaEscadaMensal =>
    ({ valor: v, texto: v == null ? '—' : tipo === 'pct' ? pct(v) : brl(v), nivel, title });

  const linhas = CAMPOS_DA_ESCADA.filter((c) => c.soRegime == null || c.soRegime === regime).map<LinhaEscadaMensal>((c) => {
    const oculta = mascararReceita && c.dependeDeReceita === true;
    return {
      campo: c.campo,
      rotulo: rotulos[c.campo],
      tipo: c.tipo,
      separado: c.separado === true,
      info: infoDaEscada(c.campo, regime),
      celulas: serie.map((s, i) => {
        if (oculta) return celula(null, c.tipo);
        if (s.escada == null) return celula(null, c.tipo);
        const a = alertas.celulas[s.mes]?.[c.campo];
        if (a == null || a.nivel == null) return celula(s.escada.total[c.campo], c.tipo);
        const partes = [a.motivo];
        const ant = anterior[i];
        const contas = ant != null ? maioresVariacoes(s, serie[ant], c.campo) : null;
        if (contas) partes.push(contas);
        return celula(s.escada.total[c.campo], c.tipo, a.nivel, partes.join('; '));
      }),
      ytd: oculta ? celula(null, c.tipo) : celula(ytd[c.campo], c.tipo),
    };
  });
  return { colunas, linhas };
}

export type ChaveDaEscada = ChaveDaEscadaPorAtividade | ChaveDaVariedade | 'TOTAL';

export interface SeletorDaEscada {
  colunas: Array<{ chave: ChaveDaEscada; rotulo: string }>;
  chave: ChaveDaEscada;
  onChange: (chave: ChaveDaEscada) => void;
}

function serieDaChave(serie: ExecutivoSerieMensal[], chave: ChaveDaEscada): ExecutivoSerieMensal[] | null {
  if (chave === 'TOTAL') return serie;
  const doMes = (e: EscadaPorAtividade): Escada | undefined => (ehVariedade(chave) ? e.por_variedade?.[chave] : e.por_atividade[chave]);
  if (serie.some((s) => s.escada != null && doMes(s.escada) == null)) return null;
  return serie.map((s) => ({ ...s, escada: s.escada && { ...s.escada, total: doMes(s.escada)! }, linhas: s.linhas_por_chave?.[chave] ?? [] }));
}

function Celula({ c, abre = false, aberta = false }: { c: CelulaEscadaMensal; abre?: boolean; aberta?: boolean }) {
  const cls = ['num', c.nivel && `cel-${c.nivel}`, (c.valor ?? 0) < 0 && 'neg'].filter(Boolean).join(' ');
  const glifo = c.nivel ? GLIFO[c.nivel] : '';
  if (abre) return <td className={cls} title={c.title ?? undefined}><button type="button" className="cel-abrir" aria-expanded={aberta}>{glifo ? `${glifo} ` : ''}{c.texto}</button></td>;
  return <td className={cls} title={c.title ?? undefined}>{glifo ? `${glifo} ` : ''}{c.texto}</td>;
}

export function grupoDaCelula(l: LinhaEscadaMensal, c: CelulaEscadaMensal): ChaveDoGrupo | null {
  return ehChaveDoGrupo(l.campo) && c.valor != null ? l.campo : null;
}

export function alvoDaCelula(colunas: ColunaEscadaMensal[], linhasNaTela: Array<LinhaEscadaMensal | null>, linha: number, coluna: number, periodoYtd: { inicio: string; fim: string }): AlvoDaCelula | null {
  const l = linhasNaTela[linha];
  if (!l || coluna < 1 || coluna > colunas.length + 1) return null;
  const ytd = coluna === colunas.length + 1;
  const c = ytd ? l.ytd : l.celulas[coluna - 1];
  const grupo = grupoDaCelula(l, c);
  if (grupo == null || c.valor == null) return null;
  const { inicio, fim } = ytd ? periodoYtd : periodoDaColuna(colunas[coluna - 1].mes);
  return { grupo, rotuloLinha: l.rotulo, coluna: ytd ? 'YTD' : colunas[coluna - 1].mes, rotuloPeriodo: rotuloDoIntervalo(inicio, fim), inicio, fim, valorCelula: c.valor };
}

export interface LancamentosDoQuadro {
  visao: VisaoNova;
  periodo: { inicio: string; fim: string };
  carregar?: typeof getLancamentosDoGrupo;
  inicial?: { alvo: AlvoDaCelula; estado: EstadoDosLancamentos };
}

export const subMensal = (regime: Regime) => `Uma coluna por mês e o acumulado (YTD). ★ marca o melhor mês (${rotulosDaEscada(regime).resultado_competencia.toLowerCase()}); ‼ e ! marcam piora contra a média dos meses anteriores ou contra o mês anterior, ▲ (verde) marca melhora forte. Passe o mouse ou clique na célula para ver o motivo e as contas que mais mudaram.`;

export function nomeDoAcumulado(serie: Pick<ExecutivoSerieMensal, 'mes'>[]): 'YTD' | 'Período' {
  return ehAcumuladoDoAno(serie.map((s) => s.mes)) ? 'YTD' : 'Período';
}

export function textoDaExplicacao(colunas: ColunaEscadaMensal[], linhasNaTela: Array<LinhaEscadaMensal | null>, linha: number, coluna: number): string | null {
  const l = linhasNaTela[linha];
  const c = coluna >= 1 ? l?.celulas[coluna - 1] : undefined;
  if (!l || !c?.title) return null;
  return `${colunas[coluna - 1].rotulo} · ${l.rotulo}: ${c.title}`;
}

export function EscadaMensal({ serie, ytd, limiares, regime, etiqueta, titulo, sub, seletor, chave, id, pergunta, explicacaoInicial, receitaDividida = true, lancamentos, semYtd = false, folhaPendente }: {
  serie: ExecutivoSerieMensal[]; ytd: Escada; limiares: LimiaresAlerta; regime: Regime; etiqueta: string;
  folhaPendente?: FolhaPendente[];
  titulo: string; sub: string; seletor?: SeletorDaEscada;
  chave?: ChaveDaEscada; id?: string;
  pergunta?: string;
  explicacaoInicial?: string;
  receitaDividida?: boolean;
  lancamentos?: LancamentosDoQuadro;
  semYtd?: boolean;
}) {
  const rotulos = rotulosDaEscada(regime);
  const s = seletor ? serieDaChave(serie, seletor.chave) : chave ? serieDaChave(serie, chave) : serie;
  const chaveAtiva = seletor?.chave ?? chave ?? 'TOTAL';
  const mascararReceita = !receitaDividida && ehVariedade(chaveAtiva);
  const serieDosAlertas = serieSemMesesPendentes(s ?? [], folhaPendente);
  const { colunas, linhas } = celulasDaEscadaMensal(s ?? [], ytd, alertasDaSerie(serieDosAlertas, limiares, rotulos), rotulos, regime, mascararReceita, serieDosAlertas);
  const nCols = colunas.length + (semYtd ? 1 : 2);
  const total = nomeDoAcumulado(serie);
  const subDaTela = total === 'YTD' ? sub : sub.replace('o acumulado (YTD)', 'o acumulado do período');
  const chaveAtual = String(chaveAtiva);
  const [explicacao, setExplicacao] = useState<{ chave: string; texto: string } | null>(explicacaoInicial ? { chave: chaveAtual, texto: explicacaoInicial } : null);
  const textoVisivel = explicacao?.chave === chaveAtual ? explicacao.texto : null;
  const linhasNaTela = [...linhas.filter((l) => !l.separado), null, ...linhas.filter((l) => l.separado)];
  const recorte = lancamentos ? recorteDaChave(chaveAtual) : null;
  const recorteDaRota = recorte != null && recorte !== 'especie' ? recorte : null;
  const carregar = lancamentos?.carregar ?? getLancamentosDoGrupo;
  const [aberta, setAberta] = useState<AberturaDaCelula | null>(lancamentos?.inicial ? { chave: chaveAtual, geracao: 0, ...lancamentos.inicial } : null);
  const geracaoRef = useRef(0);
  const abertaVisivel = recorteDaRota && aberta?.chave === chaveAtual ? aberta : null;
  const alternarLancamentos = (alvo: AlvoDaCelula) => {
    if (!lancamentos || !recorteDaRota) return;
    if (abertaVisivel && mesmaCelula(abertaVisivel.alvo, alvo)) {
      setAberta(null);
      return;
    }
    geracaoRef.current += 1;
    const geracao = geracaoRef.current;
    setAberta({ chave: chaveAtual, geracao, alvo, estado: 'carregando' });
    carregar(pedidoDaCelula(alvo, { visao: lancamentos.visao, atividade: recorteDaRota.atividade, regime }))
      .then((r) => setAberta((a) => aplicarLancamentos(a, geracao, r)))
      .catch((err) => setAberta((a) => aplicarLancamentos(a, geracao, { erro: err?.response?.data?.erro ?? err?.message ?? 'erro' })));
  };
  const aoClicar = (e: MouseEvent<HTMLTableSectionElement>) => {
    const td = (e.target as HTMLElement).closest('td');
    const tr = td?.parentElement;
    if (!td || !(tr instanceof HTMLTableRowElement)) return;
    const texto = textoDaExplicacao(colunas, linhasNaTela, tr.sectionRowIndex, td.cellIndex);
    const alvo = lancamentos && recorteDaRota ? alvoDaCelula(colunas, linhasNaTela, tr.sectionRowIndex, td.cellIndex, lancamentos.periodo) : null;
    if (texto) setExplicacao({ chave: chaveAtual, texto });
    else if (alvo) setExplicacao(null);
    if (alvo) alternarLancamentos(alvo);
  };
  const abreAqui = (l: LinhaEscadaMensal, c: CelulaEscadaMensal) => recorteDaRota != null && grupoDaCelula(l, c) != null;
  const estaAberta = (l: LinhaEscadaMensal, coluna: string) => abertaVisivel != null && abertaVisivel.alvo.grupo === l.campo && abertaVisivel.alvo.coluna === coluna;
  const linha = (l: LinhaEscadaMensal) => (
    <tr key={l.campo} className={l.tipo === 'total' ? 'ln-total' : undefined}>
      <td>
        {l.tipo === 'total' ? <b>{l.rotulo}</b> : l.rotulo}
        {l.info && <> <span className="info" tabIndex={0} aria-label={`${l.info.pergunta} · ${l.info.formula}`} title={`${l.info.pergunta} · ${l.info.formula}`}>ⓘ</span></>}
      </td>
      {l.celulas.map((c, i) => <Celula key={colunas[i].mes} c={c} abre={abreAqui(l, c)} aberta={estaAberta(l, colunas[i].mes)} />)}
      {!semYtd && <Celula c={l.ytd} abre={abreAqui(l, l.ytd)} aberta={estaAberta(l, 'YTD')} />}
    </tr>
  );
  return (
    <Panel title={titulo} tag={etiqueta} sub={subDaTela} id={id} pergunta={pergunta}>
      {seletor && (
        <p className="obs-tela">
          <select className="chip" aria-label="Coluna da escada" style={{ maxWidth: 260 }} value={seletor.chave} onChange={(e) => seletor.onChange(e.target.value as ChaveDaEscada)}>
            {seletor.colunas.map((c) => <option key={c.chave} value={c.chave}>{c.rotulo}</option>)}
          </select>
        </p>
      )}
      {s == null ? (
        <div className="empty">Negócio sem série neste período.</div>
      ) : colunas.length === 0 ? (
        <div className="empty">Sem série mensal no período.</div>
      ) : (
        <>
          {recorte === 'especie' && seletor && <p className="obs-tela">{FRASE_ESPECIE}</p>}
          <div className="tbl-scroll escada-mensal">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Linha</th>
                  {colunas.map((c) => (
                    <th key={c.mes} className={c.melhor ? 'num mes-melhor' : 'num'} title={c.title ?? undefined}>
                      {c.rotulo}{c.melhor ? ' ★' : ''}{c.semFato && <> <span className="neg">sem apuração</span></>}
                    </th>
                  ))}
                  {!semYtd && <th className="num">{total}</th>}
                </tr>
              </thead>
              <tbody onClick={aoClicar}>
                {linhasNaTela.map((l) => (l == null
                  ? <tr key="separador" className="ln-grupo"><td colSpan={nCols}>Movimentam o caixa ou o patrimônio, não o resultado da operação</td></tr>
                  : linha(l)))}
              </tbody>
            </table>
          </div>
          {textoVisivel && (
            <p className="obs-tela" role="status">
              <b>{PERGUNTAS.variacao_do_mes}</b>{` ${textoVisivel} `}
              <button type="button" className="btn ghost split-btn" onClick={() => setExplicacao(null)}>fechar</button>
            </p>
          )}
          {abertaVisivel && <LancamentosDaCelula alvo={abertaVisivel.alvo} estado={abertaVisivel.estado} onFechar={() => setAberta(null)} />}
        </>
      )}
    </Panel>
  );
}
