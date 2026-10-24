import type { ReactNode } from 'react';
import { brl, pct } from '../api/client';
import {
  CAMPOS_DA_ESCADA, ehVariedade, infoDaEscada, rotulosDaEscada,
  type ChaveDaEscadaPorAtividade, type ChaveDaVariedade, type Escada, type EscadaPorAtividade, type Regime,
} from '../api/gerencial';
import type { AlvoComposicao } from './Composicao';
import { Panel } from './ui';

export type ChaveDaColuna = ChaveDaEscadaPorAtividade | ChaveDaVariedade;

const escadaDaChave = (escada: EscadaPorAtividade, chave: ChaveDaColuna): Escada | undefined =>
  ehVariedade(chave) ? escada.por_variedade?.[chave] : escada.por_atividade[chave];

export interface LinhaDaEscada {
  campo: keyof Escada;
  rotulo: string;
  tipo: 'valor' | 'total' | 'pct';
  separado: boolean;
  valores: (number | null)[];
  total: number | null;
}

export function linhasDaEscada(
  escada: EscadaPorAtividade,
  colunas: Array<{ chave: ChaveDaColuna; rotulo: string }>,
  rotulos: Record<keyof Escada, string>,
  regime: Regime,
  receitaDividida = true,
): LinhaDaEscada[] {
  return CAMPOS_DA_ESCADA
    .filter((c) => !c.soRegime || c.soRegime === regime)
    .map((c) => ({
      campo: c.campo,
      rotulo: rotulos[c.campo],
      tipo: c.tipo,
      separado: !!c.separado,
      valores: colunas.map((col) => (!receitaDividida && c.dependeDeReceita && ehVariedade(col.chave))
        ? null
        : escadaDaChave(escada, col.chave)?.[c.campo] ?? null),
      total: escada.total[c.campo],
    }));
}

const classeCelula = (v: number | null) => `num${v != null && v < 0 ? ' neg' : ''}`;

const celula = (l: LinhaDaEscada, v: number | null): ReactNode => {
  const texto = l.tipo === 'pct' ? pct(v) : brl(v);
  return l.tipo === 'total' ? <b>{texto}</b> : texto;
};

const BLOCO_DA_LINHA: Partial<Record<keyof Escada, 'receita' | 'custos' | 'despesas'>> = {
  receita_bruta: 'receita', custos_diretos: 'custos', despesas_diretas: 'despesas', despesas_compartilhadas: 'despesas',
};

export function EscadaPorSegmento({ escada, colunas, rotuloTotal, total, cabecalho, rodape, regime, etiqueta, titulo, sub, id, antes, onAbrir, pergunta, receitaDividida = true }: {
  escada: EscadaPorAtividade;
  colunas: Array<{ chave: ChaveDaColuna; rotulo: string }>;
  rotuloTotal: string;
  total?: Escada;
  cabecalho?: Partial<Record<ChaveDaColuna, ReactNode>>;
  rodape?: string;
  regime: Regime;
  etiqueta: string;
  titulo: string;
  sub?: string;
  id?: string;
  antes?: ReactNode;
  onAbrir?: (alvo: AlvoComposicao) => void;
  pergunta?: string;
  receitaDividida?: boolean;
}) {
  const linhas = linhasDaEscada({ ...escada, total: total ?? escada.total }, colunas, rotulosDaEscada(regime), regime, receitaDividida);
  const nCols = colunas.length + 2;
  const botao = (texto: string, alvo: AlvoComposicao) => (
    <button type="button" className="gr-toggle" onClick={() => onAbrir?.(alvo)}>{texto}</button>
  );
  const linha = (l: LinhaDaEscada) => {
    const info = infoDaEscada(l.campo, regime);
    const bloco = BLOCO_DA_LINHA[l.campo];
    return (
      <tr key={l.campo}>
        <td>
          {l.tipo === 'total' ? <b>{l.rotulo}</b> : onAbrir && bloco ? botao(l.rotulo, { tipo: 'bloco', bloco }) : l.rotulo}
          {info && <span className="info" tabIndex={0} aria-label={`${info.pergunta} · ${info.formula}`} title={`${info.pergunta} · ${info.formula}`}>ⓘ</span>}
        </td>
        {l.valores.map((v, j) => (
          <td key={colunas[j].chave} className={classeCelula(v)}>{celula(l, v)}</td>
        ))}
        <td className={classeCelula(l.total)}>{celula(l, l.total)}</td>
      </tr>
    );
  };
  return (
    <Panel title={titulo} tag={etiqueta} sub={sub} id={id} pergunta={pergunta}>
      {antes}
      {colunas.length === 0 ? (
        <div className="empty">Nenhum negócio com movimento no período.</div>
      ) : (
        <div className="tbl-scroll">
          <table className="tbl">
            <thead>
              <tr>
                <th></th>
                {colunas.map((c) => <th key={c.chave} className="num">{cabecalho?.[c.chave] ?? (onAbrir && c.chave !== 'PRODUCAO' && !ehVariedade(c.chave) ? botao(c.rotulo, { tipo: 'atividade', chave: c.chave }) : c.rotulo)}</th>)}
                <th className="num">{rotuloTotal}</th>
              </tr>
            </thead>
            <tbody>
              {linhas.filter((l) => !l.separado).map(linha)}
              <tr className="ln-grupo"><td colSpan={nCols}>Movimentam o caixa ou o patrimônio, não o resultado da operação</td></tr>
              {linhas.filter((l) => l.separado).map(linha)}
            </tbody>
          </table>
        </div>
      )}
      {rodape && <div className="sub">{rodape}</div>}
    </Panel>
  );
}
