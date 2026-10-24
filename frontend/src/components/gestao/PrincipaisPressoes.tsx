import { useState, type ReactNode } from 'react';
import { rotuloDoMes } from '../../api/alertas';
import { brlK } from '../../api/client';
import type { ExecutivoResposta, ExecutivoSerieMensal } from '../../api/gerencial';
import type { ContaDaDre } from '../abrirNaDre';
import { idsPendentes, linhasPendentesPorMes } from '../AvisoDaFolha';
import { ComoECalculado } from '../ComoECalculado';
import { variacaoComSinal } from '../CustosEDespesasNoTempo';
import { reaisComSinal } from '../GraficosDaVisaoExecutiva';
import { Panel } from '../ui';
import { nomeDaLinha } from './OndeAgirPrimeiro';

export type BlocoDaPressao = 'custos' | 'despesas';
export interface LinhaDePressao {
  conta: ContaDaDre;
  nome: string;
  negocio: string | null;
  atual: number;
  variacao: number | null;
  variacao_pct: number | null;
  impacto: number | null;
}
export type Pressoes =
  | { modo: 'PERIODO_ANTERIOR' | 'SEM_COMPARACAO'; linhas: LinhaDePressao[] }
  | { modo: 'ULTIMO_MES'; atual: string; anterior: string; linhas: LinhaDePressao[] };

const cent = (v: number) => Math.round(v * 100);
const reais = (c: number) => c / 100 + 0;
const NOME_DO_BLOCO = { custos: 'custo', despesas: 'despesa' } as const;
const GRUPOS_DO_BLOCO: Record<BlocoDaPressao, number[]> = { custos: [3], despesas: [4, 5] };
export const porCodigo = (a: LinhaDePressao, b: LinhaDePressao) =>
  (a.conta.codigo_oficial ?? '').localeCompare(b.conta.codigo_oficial ?? '') || a.conta.linha_id.localeCompare(b.conta.linha_id);

function negocioDaLinha(ex: Pick<ExecutivoResposta, 'atividades' | 'composicao'>, bloco: BlocoDaPressao, id: string): string | null {
  let maior: { rotulo: string; c: number } | null = null;
  for (const a of ex.atividades) {
    const l = ex.composicao.por_atividade?.[a.chave]?.[bloco].find((x) => String(x.linha_id) === id);
    const c = l ? Math.abs(cent(l.valor)) : 0;
    if (c > 0 && (!maior || c > maior.c)) maior = { rotulo: a.rotulo, c };
  }
  return maior?.rotulo ?? null;
}

function mesesCompletos(ex: Pick<ExecutivoResposta, 'serie_mensal' | 'meses_sem_fato' | 'folha_pendente'>, hoje: string) {
  const fora = new Set([...ex.meses_sem_fato, ...linhasPendentesPorMes(ex.folha_pendente).keys()]);
  return ex.serie_mensal.filter((s) => !fora.has(s.mes) && s.mes < hoje.slice(0, 7));
}

function comparada(conta: ContaDaDre, nome: string, negocio: string | null, atualDre: number, anteriorDre: number): LinhaDePressao {
  const efeito = atualDre - anteriorDre;
  const anteriorNatural = -anteriorDre;
  return {
    conta, nome, negocio, atual: reais(-atualDre), variacao: reais(-efeito),
    variacao_pct: anteriorNatural === 0 ? null : (-efeito / Math.abs(anteriorNatural)) * 100, impacto: reais(efeito),
  };
}

const tresQueMaisMudaram = (linhas: LinhaDePressao[]) => linhas
  .filter((l) => cent(l.impacto ?? 0) !== 0)
  .sort((a, b) => Math.abs(cent(b.impacto ?? 0)) - Math.abs(cent(a.impacto ?? 0)) || cent(a.impacto ?? 0) - cent(b.impacto ?? 0) || porCodigo(a, b))
  .slice(0, 3);

export function subiuOuCaiu(l: Pick<LinhaDePressao, 'atual' | 'variacao'>): 'Subiu' | 'Caiu' | 'Crédito subiu' | 'Crédito caiu' {
  const variacao = cent(l.variacao ?? 0);
  const credora = cent(l.atual) <= 0 && cent(l.atual) - variacao <= 0;
  if (credora) return variacao > 0 ? 'Crédito caiu' : 'Crédito subiu';
  return variacao > 0 ? 'Subiu' : 'Caiu';
}

export function principaisPressoes(ex: ExecutivoResposta, bloco: BlocoDaPressao, anterior: ExecutivoResposta | null, hoje: string): Pressoes {
  const p = pressoesComparadas(ex, bloco, anterior, hoje);
  return p.modo === 'SEM_COMPARACAO' ? p : { ...p, linhas: tresQueMaisMudaram(p.linhas) };
}

export function pressoesComparadas(ex: ExecutivoResposta, bloco: BlocoDaPressao, anterior: ExecutivoResposta | null, hoje: string): Pressoes {
  const doPeriodo = new Map(ex.composicao[bloco].map((l) => [String(l.linha_id), l]));
  if (anterior) {
    const pendentes = new Set([...idsPendentes(ex.folha_pendente), ...idsPendentes(anterior.folha_pendente)]);
    const doAnterior = new Map(anterior.composicao[bloco].map((l) => [String(l.linha_id), l]));
    const linhas = [...new Set([...doPeriodo.keys(), ...doAnterior.keys()])]
      .filter((id) => !pendentes.has(id))
      .map((id) => {
        const l = (doPeriodo.get(id) ?? doAnterior.get(id))!;
        return comparada({ linha_id: id, codigo_oficial: l.codigo_oficial }, nomeDaLinha(l),
          negocioDaLinha(ex, bloco, id) ?? negocioDaLinha(anterior, bloco, id),
          cent(doPeriodo.get(id)?.valor ?? 0), cent(doAnterior.get(id)?.valor ?? 0));
      });
    return { modo: 'PERIODO_ANTERIOR', linhas };
  }
  const completos = mesesCompletos(ex, hoje);
  if (completos.length >= 2) {
    const [penultimo, ultimo] = completos.slice(-2);
    const grupos = GRUPOS_DO_BLOCO[bloco];
    const dosMeses = new Map([...penultimo.linhas, ...ultimo.linhas]
      .filter((f) => grupos.includes(f.grupo))
      .map((f) => [String(f.linha_id), f]));
    const noMes = (s: ExecutivoSerieMensal, id: string) => cent(s.linhas.find((f) => String(f.linha_id) === id)?.valor ?? 0);
    const linhas = [...dosMeses.keys()].map((id) => {
      const l = doPeriodo.get(id) ?? dosMeses.get(id)!;
      return comparada({ linha_id: id, codigo_oficial: l.codigo_oficial }, nomeDaLinha(l),
        negocioDaLinha(ex, bloco, id), noMes(ultimo, id), noMes(penultimo, id));
    });
    return { modo: 'ULTIMO_MES', atual: ultimo.mes, anterior: penultimo.mes, linhas };
  }
  const pendentes = idsPendentes(ex.folha_pendente);
  const linhas = [...doPeriodo.entries()]
    .filter(([id, l]) => !pendentes.has(id) && cent(l.valor) < 0)
    .map(([id, l]): LinhaDePressao => ({
      conta: { linha_id: id, codigo_oficial: l.codigo_oficial }, nome: nomeDaLinha(l), negocio: negocioDaLinha(ex, bloco, id),
      atual: reais(-cent(l.valor)), variacao: null, variacao_pct: null, impacto: null,
    }))
    .sort((a, b) => cent(b.atual) - cent(a.atual) || porCodigo(a, b))
    .slice(0, 3);
  return { modo: 'SEM_COMPARACAO', linhas };
}

export function PrincipaisPressoes({ ex, anterior = null, rotuloAnterior, hoje, onAbrirConta, evolucao }: {
  ex: ExecutivoResposta;
  anterior?: ExecutivoResposta | null; rotuloAnterior?: string;
  hoje: string;
  onAbrirConta?: (conta: ContaDaDre) => void;
  evolucao?: ReactNode;
}) {
  const [bloco, setBloco] = useState<BlocoDaPressao>('custos');
  const p = principaisPressoes(ex, bloco, anterior, hoje);
  const nome = NOME_DO_BLOCO[bloco];
  const sub = p.modo === 'PERIODO_ANTERIOR'
    ? `Até três linhas de ${nome} que subiram ou caíram e mais mudaram o resultado contra ${rotuloAnterior ?? 'o período anterior'}, em R$.`
    : p.modo === 'ULTIMO_MES'
      ? `Sem o período anterior na base: até três linhas de ${nome} que subiram ou caíram e mais mudaram o resultado de ${rotuloDoMes(p.atual)} contra ${rotuloDoMes(p.anterior)} (o último mês completo contra o anterior).`
      : `Sem mês completo anterior para comparar: até três das maiores linhas de ${nome} do período.`;
  const comparado = p.modo !== 'SEM_COMPARACAO';
  const vazio = comparado ? `Nenhuma linha de ${nome} mudou o resultado nessa comparação.` : `Nenhuma linha de ${nome} no período.`;
  const comPendencia = idsPendentes(ex.folha_pendente).size + idsPendentes(anterior?.folha_pendente).size > 0;
  return (
    <Panel title="Principais pressões sobre o resultado" tag={ex.etiqueta} id="gestao-principais-pressoes" sub={sub}>
      <div className="tabs" role="group" aria-label="Custos ou despesas">
        {(['custos', 'despesas'] as const).map((b) => (
          <button key={b} type="button" className={`tab ${bloco === b ? 'active' : ''}`} aria-pressed={bloco === b} onClick={() => setBloco(b)}>
            {b === 'custos' ? 'Custos' : 'Despesas'}
          </button>
        ))}
      </div>
      {p.linhas.length === 0 ? <p className="obs-tela">{vazio}</p> : (
        <div className="tbl-scroll">
          <table className="tbl">
            <thead>
              <tr>
                <th>Linha da DRE</th><th>Negócio</th><th className="num">{comparado ? 'Valor atual' : 'Valor no período'}</th>
                {comparado && <><th>Subiu ou caiu</th><th className="num">Variação (R$)</th><th className="num">Variação (%)</th><th className="num">Impacto no resultado</th></>}
              </tr>
            </thead>
            <tbody>
              {p.linhas.map((l) => {
                const sinal = subiuOuCaiu(l).startsWith('Crédito') ? -1 : 1;
                return (
                <tr key={l.conta.linha_id}>
                  <td>{onAbrirConta ? <button type="button" className="gr-toggle" onClick={() => onAbrirConta(l.conta)}>{l.nome}</button> : l.nome}</td>
                  <td>{l.negocio ?? '—'}</td>
                  <td className="num">{brlK(l.atual)}</td>
                  {comparado && (
                    <>
                      <td>{subiuOuCaiu(l)}</td>
                      <td className="num">{reaisComSinal(sinal * (l.variacao ?? 0))}</td>
                      <td className="num">{l.variacao_pct == null ? '—' : variacaoComSinal(sinal * l.variacao_pct)}</td>
                      <td className={cent(l.impacto ?? 0) < 0 ? 'num neg' : 'num'}>{reaisComSinal(l.impacto ?? 0)}</td>
                    </>
                  )}
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {comPendencia && (
        <p className="obs-tela">{p.modo === 'ULTIMO_MES' ? 'Mês com folha ainda não apropriada não entra na comparação.' : 'As linhas da folha ainda não apropriada ficam fora desta lista.'}</p>
      )}
      {onAbrirConta && p.linhas.length > 0 && <p className="obs-tela">Clique na linha para abrir a conta e os lançamentos dela na DRE Gerencial.</p>}
      {evolucao != null && (
        <details className="pressoes-evolucao">
          <summary>Ver evolução mês a mês</summary>
          {evolucao}
        </details>
      )}
      <ComoECalculado chave="principais_pressoes" />
    </Panel>
  );
}
