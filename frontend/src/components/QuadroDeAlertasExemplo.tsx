import { Fragment, useEffect, useState, type ReactNode } from 'react';
import { num } from '../api/client';
import { Panel, Pill } from './ui';

export type NivelDoAlerta = 'CRITICO' | 'ATENCAO';

export interface ItemDeAlerta {
  chave: string;
  nivel: NivelDoAlerta;
  celulas: ReactNode[];
  detalhe: ReactNode;
}

export interface CategoriaDeAlerta {
  chave: string;
  titulo: string;
  descricao: string;
  nivel: NivelDoAlerta;
  itens: ItemDeAlerta[];
  impacto: string | null;
}

const plural = (n: number, um: string, varios: string) => `${num(n)} ${n === 1 ? um : varios}`;
const ICONE: Record<NivelDoAlerta, string> = { CRITICO: '⚠', ATENCAO: '!' };
const CLASSE: Record<NivelDoAlerta, string> = { CRITICO: 'critico', ATENCAO: 'atencao' };
const STATUS: Record<NivelDoAlerta, ReactNode> = {
  CRITICO: <Pill tone="bad">Crítico</Pill>, ATENCAO: <Pill tone="warn">Atenção</Pill>,
};

export function contarPorNivel(categorias: Pick<CategoriaDeAlerta, 'itens'>[]) {
  const itens = categorias.flatMap((c) => c.itens);
  const criticos = itens.filter((i) => i.nivel === 'CRITICO').length;
  return { criticos, atencao: itens.length - criticos };
}

export function ordenarCategorias<T extends Pick<CategoriaDeAlerta, 'nivel' | 'itens'>>(categorias: T[]): T[] {
  return categorias.map((c, i) => ({ c, i }))
    .sort((a, b) => (a.c.nivel === b.c.nivel ? 0 : a.c.nivel === 'CRITICO' ? -1 : 1)
      || b.c.itens.length - a.c.itens.length || a.i - b.i)
    .map(({ c }) => c);
}

export function ResumoDeAlertas({ criticos, atencao }: { criticos: number; atencao: number }) {
  if (criticos + atencao === 0) {
    return (
      <div className="alertas-ex-resumo">
        <div className="alertas-ex-card ok">
          <span className="alertas-ex-icone">✓</span>
          <div><div className="alertas-ex-rotulo">Sem inconsistências relevantes</div></div>
        </div>
      </div>
    );
  }
  return (
    <div className="alertas-ex-resumo">
      <div className="alertas-ex-card critico">
        <span className="alertas-ex-icone">{ICONE.CRITICO}</span>
        <div>
          <div className="alertas-ex-num">{num(criticos)}</div>
          <div className="alertas-ex-rotulo">{criticos === 1 ? 'Crítica' : 'Críticas'}</div>
          <div className="alertas-ex-sub">exigem ação imediata</div>
        </div>
      </div>
      <div className="alertas-ex-card atencao">
        <span className="alertas-ex-icone">{ICONE.ATENCAO}</span>
        <div>
          <div className="alertas-ex-num">{num(atencao)}</div>
          <div className="alertas-ex-rotulo">Atenção</div>
          <div className="alertas-ex-sub">monitorar</div>
        </div>
      </div>
    </div>
  );
}

export function GavetaDeAlertas({
  titulo, descricao, nivel, itens, impacto, colunas, rotuloDoItem, acao, onFechar, limite = 5,
}: Omit<CategoriaDeAlerta, 'chave'> & {
  colunas: string[]; rotuloDoItem: [string, string];
  acao?: { texto: string; href: string }; onFechar: () => void; limite?: number;
}) {
  const [todos, setTodos] = useState(false);
  const [abertos, setAbertos] = useState<Set<string>>(() => new Set());
  const alternar = (chave: string) => setAbertos((s) => {
    const n = new Set(s);
    if (n.has(chave)) n.delete(chave); else n.add(chave);
    return n;
  });
  const nCols = colunas.length + 1;
  return (
    <>
      <div className="gaveta-fundo" onClick={onFechar} />
      <aside className="gaveta" role="dialog" aria-modal="true" aria-label={titulo}>
        <div className={`gaveta-cab ${CLASSE[nivel]}`}>
          <span className="alertas-ex-icone">{ICONE[nivel]}</span>
          <div>
            <div className="alertas-ex-tit gaveta-tit">{titulo}</div>
            <div className="alertas-ex-desc">{descricao}</div>
          </div>
          <button type="button" className="gaveta-fechar" aria-label="Fechar" onClick={onFechar} autoFocus>×</button>
        </div>
        <div className="gaveta-resumo">
          {plural(itens.length, 'ocorrência', 'ocorrências')}
          {impacto != null && <> | Maior impacto: <span className="alertas-ex-impacto">{impacto}</span></>}
        </div>
        <div className="gaveta-tabela">
        <table className="tbl">
          <thead>
            <tr>{colunas.map((c) => <th key={c}>{c}</th>)}<th>Status</th></tr>
          </thead>
          <tbody>
            {itens.map((item, i) => {
              const recolhido = !todos && i >= limite;
              return (
                <Fragment key={item.chave}>
                  <tr className="gaveta-item" hidden={recolhido} onClick={() => alternar(item.chave)}>
                    {item.celulas.map((c, j) => <td key={colunas[j]}>{c}</td>)}
                    <td>{STATUS[item.nivel]}</td>
                  </tr>
                  {abertos.has(item.chave) && !recolhido && (
                    <tr className="gaveta-detalhe"><td colSpan={nCols}>{item.detalhe}</td></tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
        </div>
        <div className="gaveta-acoes">
          {itens.length > limite && !todos && (
            <button type="button" className="btn ghost" onClick={() => setTodos(true)}>
              Ver {itens.length === 1 ? 'o' : 'os'} {plural(itens.length, rotuloDoItem[0], rotuloDoItem[1])} →
            </button>
          )}
          {acao && <a className="btn" href={acao.href} onClick={onFechar}>{acao.texto}</a>}
        </div>
      </aside>
    </>
  );
}

export function QuadroDeAlertasExemplo({
  title, sub, categorias, colunas, rotuloDoItem, acao,
  tituloDosMotivos = 'Principais motivos das inconsistências',
}: {
  title: string; sub: string; categorias: CategoriaDeAlerta[]; colunas: string[];
  rotuloDoItem: [string, string]; acao?: { texto: string; href: string }; tituloDosMotivos?: string;
}) {
  const [aberta, setAberta] = useState<string | null>(null);
  useEffect(() => {
    if (aberta == null) return undefined;
    const fechar = (e: KeyboardEvent) => { if (e.key === 'Escape') setAberta(null); };
    window.addEventListener('keydown', fechar);
    return () => window.removeEventListener('keydown', fechar);
  }, [aberta]);

  const { criticos, atencao } = contarPorNivel(categorias);
  const total = criticos + atencao;
  const ordem = ordenarCategorias(categorias);
  const maior = Math.max(1, ...categorias.map((c) => c.itens.length));
  const TODOS = '__todos__';
  const gaveta = aberta === TODOS
    ? { titulo: 'Todos os alertas', descricao: 'Do mais grave para o menos grave', nivel: (criticos > 0 ? 'CRITICO' : 'ATENCAO') as NivelDoAlerta,
      itens: ordem.flatMap((c) => c.itens), impacto: null }
    : ordem.find((c) => c.chave === aberta) ?? null;

  return (
    <Panel title={title} sub={sub}>
      <ResumoDeAlertas criticos={criticos} atencao={atencao} />
      {total > 0 && (
        <>
          <div className="alertas-ex-motivos-tit">{tituloDosMotivos}</div>
          <div className="alertas-ex-cab" aria-hidden="true">
            <span /><span /><span>Ocorrências</span><span /><span>Maior impacto</span><span />
          </div>
          <div className="alertas-ex-motivos">
            {ordem.map((c) => (
              <button type="button" key={c.chave} className={`alertas-ex-linha ${CLASSE[c.nivel]}`}
                onClick={() => setAberta(c.chave)} disabled={c.itens.length === 0}>
                <span className="alertas-ex-icone">{ICONE[c.nivel]}</span>
                <span>
                  <span className="alertas-ex-tit">{c.titulo}</span>
                  <span className="alertas-ex-desc">{c.descricao}</span>
                </span>
                <span className="alertas-ex-n">{num(c.itens.length)}</span>
                <span className="alertas-ex-barra"><span style={{ width: `${(100 * c.itens.length) / maior}%` }} /></span>
                <span className="alertas-ex-impacto">{c.itens.length > 0 && c.impacto != null ? c.impacto : '—'}</span>
                <span className="alertas-ex-seta">›</span>
              </button>
            ))}
          </div>
          <button type="button" className="alertas-ex-todos" onClick={() => setAberta(TODOS)}>
            ▸ Ver {total === 1 ? 'o alerta' : `todos os ${num(total)} alertas`}
          </button>
        </>
      )}
      {gaveta && (
        <GavetaDeAlertas key={aberta ?? ''} titulo={gaveta.titulo} descricao={gaveta.descricao} nivel={gaveta.nivel}
          itens={gaveta.itens} impacto={gaveta.impacto} colunas={colunas} rotuloDoItem={rotuloDoItem}
          acao={acao} onFechar={() => setAberta(null)} />
      )}
    </Panel>
  );
}
