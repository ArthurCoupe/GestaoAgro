import { Fragment, useEffect, useRef, useState } from 'react';
import { brl, dataBr, pct } from '../api/client';
import { PRODUTOS_PRODUCAO } from '../api/catalogo';
import type { VisaoNova } from '../api/dreNova';
import {
  getLancamentosDaLinha,
  type AtividadeChave, type BlocoComposicao, type ExecutivoResposta, type FatiaDoLancamento, type LancamentoDaLinha, type LancamentosDaLinhaResposta,
  type LinhaComposicao, type Regime,
} from '../api/gerencial';
import { Panel } from './ui';
import { NOTA_DO_VALOR_CHEIO } from './valorCheio';

export type AlvoComposicao =
  | { tipo: 'bloco'; bloco: BlocoComposicao }
  | { tipo: 'atividade'; chave: AtividadeChave };

export interface BlocoDaComposicao { bloco: BlocoComposicao; rotulo: string; linhas: LinhaComposicao[] }

export const ROTULO_DO_BLOCO: Record<BlocoComposicao, string> = { receita: 'Receita', custos: 'Custos', despesas: 'Despesas' };
const BLOCOS: BlocoComposicao[] = ['receita', 'custos', 'despesas'];

export function blocosDaComposicao(
  ex: Pick<ExecutivoResposta, 'composicao' | 'atividades'>, alvo: AlvoComposicao,
): BlocoDaComposicao[] {
  if (alvo.tipo === 'bloco') return [{ bloco: alvo.bloco, rotulo: ROTULO_DO_BLOCO[alvo.bloco], linhas: ex.composicao[alvo.bloco] }];
  const da = ex.composicao.por_atividade[alvo.chave] ?? { receita: [], custos: [], despesas: [] };
  return BLOCOS.map((b) => ({ bloco: b, rotulo: ROTULO_DO_BLOCO[b], linhas: da[b] ?? [] }));
}

export function proximoAberto(atual: AlvoComposicao | null, clique: AlvoComposicao): AlvoComposicao | null {
  return atual != null && JSON.stringify(atual) === JSON.stringify(clique) ? null : clique;
}

export function tituloDoAlvo(ex: Pick<ExecutivoResposta, 'atividades'>, alvo: AlvoComposicao): string {
  if (alvo.tipo === 'bloco') return ROTULO_DO_BLOCO[alvo.bloco];
  return ex.atividades.find((a) => a.chave === alvo.chave)?.rotulo ?? alvo.chave;
}

export type EstadoDaLinha = LancamentosDaLinhaResposta | { erro: string } | 'carregando';

export function aplicarResposta(
  abertas: Record<string, EstadoDaLinha>,
  linhaId: string,
  resposta: LancamentosDaLinhaResposta | { erro: string },
  geracaoDaResposta: number,
  geracaoAtual: number,
): Record<string, EstadoDaLinha> {
  if (abertas[linhaId] !== 'carregando' || geracaoDaResposta !== geracaoAtual) return abertas;
  return { ...abertas, [linhaId]: resposta };
}

export function useLancamentosPorLinha({ periodo, visao, atividade = null, regime, carregar = getLancamentosDaLinha, iniciais }: {
  periodo: { inicio: string; fim: string }; visao: VisaoNova; atividade?: AtividadeChave | null; regime?: Regime;
  carregar?: typeof getLancamentosDaLinha; iniciais?: Record<string, LancamentosDaLinhaResposta>;
}) {
  const [abertas, setAbertas] = useState<Record<string, EstadoDaLinha>>(iniciais ?? {});
  const geracaoRef = useRef<Record<string, number>>({});
  const recorte = `${periodo.inicio}|${periodo.fim}|${visao}|${atividade ?? ''}|${regime ?? ''}`;
  const recorteRef = useRef(recorte);
  useEffect(() => {
    if (recorteRef.current === recorte) return;
    recorteRef.current = recorte;
    setAbertas({});
  }, [recorte]);
  const alternar = (linhaId: string) => {
    if (abertas[linhaId]) {
      setAbertas((a) => { const { [linhaId]: _fora, ...resto } = a; return resto; });
      return;
    }
    const geracao = (geracaoRef.current[linhaId] ?? 0) + 1;
    geracaoRef.current[linhaId] = geracao;
    setAbertas((a) => ({ ...a, [linhaId]: 'carregando' }));
    carregar({ inicio: periodo.inicio, fim: periodo.fim, visao, linha_id: linhaId, atividade: atividade ?? undefined, regime })
      .then((r) => setAbertas((a) => aplicarResposta(a, linhaId, r, geracao, geracaoRef.current[linhaId])))
      .catch((e) => setAbertas((a) => aplicarResposta(
        a, linhaId, { erro: e?.response?.data?.erro ?? e?.message ?? 'erro' }, geracao, geracaoRef.current[linhaId],
      )));
  };
  return { abertas, alternar };
}

const dinheiro = (v: number | null) => (v == null ? '—' : brl(v));

const FRENTE: Record<FatiaDoLancamento['frente'], string> = { PRODUCAO: 'Produção', REVENDA: 'Revenda', CORPORATIVO: 'Corporativo', NAO_RATEADO: 'Não rateado' };
const PRODUTO: Record<NonNullable<FatiaDoLancamento['produto']>, string> = { COGUMELO: 'Cogumelo', PIMENTAO: 'Pimentão' };

export function rotuloDaFatia(f: Pick<FatiaDoLancamento, 'frente' | 'produto' | 'especie'>): string {
  const especie = f.especie ? `${PRODUTOS_PRODUCAO.find((p) => p.codigo === f.especie)?.nome ?? f.especie} (${f.especie})` : null;
  return [FRENTE[f.frente] ?? f.frente, f.produto ? PRODUTO[f.produto] ?? f.produto : null, especie].filter(Boolean).join(' · ');
}
const classeNum = (v: number | null) => `num${v != null && v < 0 ? ' neg' : ''}`;
export const AVISO_REGRA_NAO_CONFERE = 'As partes deste lançamento não seguem esta regra: o mês foi calculado com uma regra anterior.';

export function TabelaDeLancamentos({ estado }: { estado: EstadoDaLinha }) {
  if (estado === 'carregando') return <div className="loading">Buscando os lançamentos…</div>;
  if ('erro' in estado) return <div className="empty">Lançamentos indisponíveis ({estado.erro}).</div>;
  const r = estado;
  if (r.lancamentos.length === 0) return <div className="empty">Nenhum lançamento desta linha no período.</div>;
  const caixa = r.regime === 'CAIXA';
  const data = (l: LancamentoDaLinha) => dataBr(caixa ? l.data_liquidacao : l.data_competencia) || '—';
  const comFatias = r.lancamentos.some((l) => (l.fatias?.length ?? 0) > 0);
  const comCheio = !r.valor_cheio_so_gestao;
  const comRegra = r.lancamentos.some((l) => l.regra != null);
  return (
    <>
      <div className="tbl-scroll">
        <table className="tbl">
          <thead>
            <tr>
              <th>{caixa ? 'Pago/recebido em' : 'Competência'}</th><th>Empresa</th><th>Conta</th><th>Documento</th><th>Histórico</th>
              <th className="num">Valor no período</th>{comCheio && <th className="num">Valor do lançamento</th>}
              {comFatias && <th>Frente · produto · espécie</th>}
              {comRegra && <th>Regra de rateio</th>}
            </tr>
          </thead>
          <tbody>
            {r.lancamentos.map((l) => (
              <tr key={l.lancamento_id}>
                <td>{data(l)}</td>
                <td>{l.empresa ?? '—'}</td>
                <td title={l.codigo_conta_erp ? `No ERP: ${l.codigo_conta_erp}` : undefined}>{l.codigo_conta ?? '—'}</td>
                <td>{l.documento ?? '—'}</td>
                <td>{l.historico ?? '—'}</td>
                <td className={classeNum(l.valor_no_periodo)}>{dinheiro(l.valor_no_periodo)}</td>
                {comCheio && <td className={classeNum(l.valor_lancamento)}>{dinheiro(l.valor_lancamento)}</td>}
                {comFatias && (
                  <td>{(l.fatias ?? []).length === 1 ? rotuloDaFatia(l.fatias![0])
                    : (l.fatias ?? []).map((f) => `${rotuloDaFatia(f)}: ${brl(f.valor)}`).join('; ') || '—'}</td>
                )}
                {comRegra && (
                  <td>
                    {l.regra ? l.regra.etapas.map((e) => <div key={e}>{e}</div>) : '—'}
                    {l.regra?.confere === false && <div className="neg">{AVISO_REGRA_NAO_CONFERE}</div>}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="obs-tela">
        {r.quantidade} {r.quantidade === 1 ? 'lançamento' : 'lançamentos'}, total {brl(r.total)} no período.{r.truncado ? ` Mostrando os ${r.limite} maiores.` : ''}
      </p>
      {r.valor_cheio_so_gestao && <p className="obs-tela">{NOTA_DO_VALOR_CHEIO}</p>}
    </>
  );
}

export function Composicao({
  titulo, rotuloPeriodo, etiqueta, blocos, periodo, visao, atividade = null, regime, onFechar,
  carregar = getLancamentosDaLinha, lancamentosIniciais,
}: {
  titulo: string;
  rotuloPeriodo: string;
  etiqueta: string;
  blocos: BlocoDaComposicao[];
  periodo: { inicio: string; fim: string };
  visao: VisaoNova;
  atividade?: AtividadeChave | null;
  regime?: Regime;
  onFechar?: () => void;
  carregar?: typeof getLancamentosDaLinha;
  lancamentosIniciais?: Record<string, LancamentosDaLinhaResposta>;
}) {
  const { abertas, alternar } = useLancamentosPorLinha({ periodo, visao, atividade, regime, carregar, iniciais: lancamentosIniciais });

  return (
    <Panel title={`Composição: ${titulo} (${rotuloPeriodo})`} tag={etiqueta}
      sub="Linhas com movimento no período, maior primeiro. Clique no nome da linha para ver os lançamentos do ERP por trás dela.">
      {onFechar && <button type="button" className="btn ghost" onClick={onFechar}>Fechar</button>}
      {blocos.map((b) => (
        <div key={b.bloco}>
          <h4>{b.rotulo}</h4>
          {b.linhas.length === 0 ? (
            <div className="empty">Sem movimento em {b.rotulo.toLowerCase()} no período.</div>
          ) : (
            <div className="tbl-scroll">
              <table className="tbl">
                <thead>
                  <tr><th>Código</th><th>Linha</th><th className="num">Valor</th><th className="num">% do bloco</th><th className="num">Lançamentos</th></tr>
                </thead>
                <tbody>
                  {b.linhas.map((l) => (
                    <Fragment key={l.linha_id}>
                      <tr>
                        <td>{l.codigo_oficial ?? '—'}</td>
                        <td><button type="button" className="gr-toggle" onClick={() => alternar(l.linha_id)}>{l.rotulo ?? l.linha_id}</button></td>
                        <td className={classeNum(l.valor)}>{brl(l.valor)}</td>
                        <td className="num">{l.participacao_pct == null ? '—' : pct(l.participacao_pct)}</td>
                        <td className="num">{l.quantidade_lancamentos}</td>
                      </tr>
                      {abertas[l.linha_id] && (
                        <tr><td colSpan={5}><TabelaDeLancamentos estado={abertas[l.linha_id]} /></td></tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </Panel>
  );
}
