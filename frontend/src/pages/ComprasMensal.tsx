import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  calcularComprar, criarCompraMensalItem, excluirCompraMensalItem,
  getComprasMensal, num, putCompraMensalItem,
  type CompraMensalEdicao, type CompraMensalItem,
} from '../api/client';
import { useAuth } from '../auth';
import { BotaoExportar } from '../components/BotaoExportar';
import { BlocoOutrosInsumos, TopoOperacional } from '../components/BlocosOperacionais';
import { Panel, useToast } from '../components/ui';

const COLUNAS = [
  'Categoria', 'Subcategoria', 'Descrição Padronizada', 'Especificação', 'Unidade',
  'Consumo Médio Mensal', 'Tipo de Consumo', 'Estoque atual', 'Comprar', 'Observações',
];

const TIPO_ROTULO: Record<CompraMensalItem['tipo_consumo'], string> = {
  CONTINUO: 'Contínuo', SOB_DEMANDA: 'Sob Demanda',
};

export function comprarDaLinha(estoqueDigitado: string, consumoDigitado: string): number | null {
  const est = estoqueDigitado.trim();
  return calcularComprar(est === '' ? null : Number(est), Number(consumoDigitado) || 0);
}

export function consumoDaEdicao(bruto: string, id: number): number {
  const t = bruto.trim();
  if (t === '') {
    throw new Error(`Consumo médio mensal do item #${id} não pode ficar vazio: apagar não é "não consome nada".`);
  }
  const n = Number(t);
  if (!(n >= 0)) throw new Error(`Consumo médio mensal inválido no item #${id}: nada foi salvo.`);
  return n;
}

export function consumoDoItemNovo(bruto: string): number {
  const t = bruto.trim();
  if (t === '') return 0;
  const n = Number(t);
  if (!(n >= 0)) throw new Error('Consumo médio mensal deve ser um número maior ou igual a zero.');
  return n;
}

export function edicoesDoPayload(
  edits: Record<string, string>,
): Array<{ id: number; body: CompraMensalEdicao }> {
  const ids = [...new Set(Object.keys(edits).map((k) => Number(k.split(':')[0])))];
  return ids.map((id) => {
    const body: CompraMensalEdicao = {};
    const est = edits[`${id}:estoque`];
    if (est !== undefined) {
      const t = est.trim();
      body.estoque_atual = t === '' ? null : Number(t);
    }
    const cons = edits[`${id}:consumo`];
    if (cons !== undefined) body.consumo_medio_mensal = consumoDaEdicao(cons, id);
    const obs = edits[`${id}:obs`];
    if (obs !== undefined) body.observacoes = obs || null;
    return { id, body };
  });
}

export function ComprasMensal() {
  const [versao, setVersao] = useState(0);
  return (
    <>
      <TopoOperacional key={versao} dominio="OUTROS_INSUMOS" id="compras-mensal-insumos" titulo="Ações do dia: Outros insumos">
        {(d) => <BlocoOutrosInsumos insumos={d.insumos} />}
      </TopoOperacional>
      <CorpoComprasMensal aoSalvar={() => setVersao((v) => v + 1)} />
    </>
  );
}

function CorpoComprasMensal({ aoSalvar }: { aoSalvar: () => void }) {
  const { usuario } = useAuth();
  const gestor = usuario?.role == null || usuario.role === 'GESTAO_GERAL';
  const toast = useToast();

  const [itens, setItens] = useState<CompraMensalItem[] | null>(null);
  const [erro, setErro] = useState('');
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);
  const [formNovo, setFormNovo] = useState(false);

  const recarregar = useCallback(() => {
    setErro('');
    getComprasMensal()
      .then((d) => { setItens(d); setEdits({}); })
      .catch((e) => setErro(e?.response?.data?.erro ?? e.message));
  }, []);
  useEffect(recarregar, [recarregar]);

  const grupos = useMemo(() => {
    const porCategoria = new Map<string, CompraMensalItem[]>();
    for (const i of itens ?? []) {
      if (!porCategoria.has(i.categoria)) porCategoria.set(i.categoria, []);
      porCategoria.get(i.categoria)!.push(i);
    }
    return [...porCategoria.entries()];
  }, [itens]);

  if (erro) return <div className="empty">Erro: {erro}</div>;
  if (!itens) return <div className="loading">Carregando o pedido de compras…</div>;

  const valor = (id: number, campo: string, original: number | string | null) =>
    edits[`${id}:${campo}`] ?? (original != null ? String(original) : '');
  const editar = (id: number, campo: string, v: string) =>
    setEdits((prev) => ({ ...prev, [`${id}:${campo}`]: v }));

  const comprarDe = (i: CompraMensalItem): number | null => comprarDaLinha(
    valor(i.id, 'estoque', i.estoque_atual),
    valor(i.id, 'consumo', i.consumo_medio_mensal),
  );

  const salvarInventario = async () => {
    const pendentes = edicoesDoPayload(edits);
    if (pendentes.length === 0) return;
    setSalvando(true);
    try {
      for (const { id, body } of pendentes) {
        await putCompraMensalItem(id, body);
      }
      toast('Inventário salvo.');
      recarregar();
      aoSalvar();
    } catch (e) {
      const err = e as { response?: { data?: { erro?: string } }; message: string };
      toast(err.response?.data?.erro ?? err.message, true);
    } finally {
      setSalvando(false);
    }
  };

  const remover = (i: CompraMensalItem) => {
    setSalvando(true);
    excluirCompraMensalItem(i.id)
      .then(() => { toast(`Item "${i.descricao}" desativado.`); recarregar(); aoSalvar(); })
      .catch((e) => toast(e?.response?.data?.erro ?? e.message, true))
      .finally(() => setSalvando(false));
  };

  return (
    <div className="plan-stack">
      <div className="export-bar">
        {gestor && (
          <button className={formNovo ? 'btn' : 'btn ghost'} onClick={() => setFormNovo(!formNovo)}>
            + Novo item
          </button>
        )}
        <button className="btn" disabled={salvando || Object.keys(edits).length === 0}
          onClick={salvarInventario}>
          {salvando ? 'Salvando…' : 'Salvar inventário'}
        </button>
        <BotaoExportar rotulo="Exportar Excel" />
      </div>

      {formNovo && gestor && (
        <Panel title="Novo item" sub="Cadastra um consumível na lista de compras">
          <FormNovoItem salvando={salvando} onSubmit={async (body) => {
            setSalvando(true);
            try {
              await criarCompraMensalItem(body);
              toast('Item criado.');
              setFormNovo(false);
              recarregar();
              aoSalvar();
            } catch (e) {
              const err = e as { response?: { data?: { erro?: string } }; message: string };
              toast(err.response?.data?.erro ?? err.message, true);
            } finally {
              setSalvando(false);
            }
          }} />
        </Panel>
      )}

      <Panel title="Pedido de Compras" tag={`${itens.length} itens`}
        sub="Colunas idênticas às da planilha, agrupadas por Categoria: Comprar em vermelho = quantidade a comprar">
        <div className="plan-wrap cp">
          <table className="plan cp">
            <thead>
              <tr>
                <th className="rotulo">{COLUNAS[0]}</th>
                {COLUNAS.slice(1).map((c) => <th key={c} className="num">{c}</th>)}
                {gestor && <th className="num" />}
              </tr>
            </thead>
            <tbody>
              {grupos.map(([categoria, doGrupo]) => (
                <LinhasCategoria key={categoria} categoria={categoria} itens={doGrupo}
                  gestor={gestor} salvando={salvando} valor={valor} editar={editar}
                  comprarDe={comprarDe} onRemover={remover} />
              ))}
            </tbody>
          </table>
        </div>
        <div className="obs-tela">
          Rotina mensal (a mesma da planilha): "1 vez por mês fazemos o inventário do
          estoque, preenchemos a coluna Estoque atual e temos na coluna Comprar a
          quantidade a ser comprada", valor negativo significa comprar essa quantidade.
          Digite o inventário e clique em "Salvar inventário". Item com Comprar em
          traço (—) é item SEM inventário: inclua-o na próxima contagem. Zero é
          uma contagem válida ("contei e não tenho nenhum") e continua pedindo compra.
        </div>
      </Panel>
    </div>
  );
}

function LinhasCategoria({ categoria, itens, gestor, salvando, valor, editar, comprarDe, onRemover }: {
  categoria: string;
  itens: CompraMensalItem[];
  gestor: boolean;
  salvando: boolean;
  valor: (id: number, campo: string, original: number | string | null) => string;
  editar: (id: number, campo: string, v: string) => void;
  comprarDe: (i: CompraMensalItem) => number | null;
  onRemover: (i: CompraMensalItem) => void;
}) {
  return (
    <>
      <tr className="ln-grupo">
        <td className="rotulo">{categoria}</td>
        <td colSpan={9 + (gestor ? 1 : 0)} />
      </tr>
      {itens.map((i) => {
        const comprar = comprarDe(i);
        return (
          <tr key={i.id}>
            <td className="rotulo sub-rot" />
            <td className="num">{i.subcategoria ?? ''}</td>
            <td className="num">{i.descricao}</td>
            <td className="num">{i.especificacao ?? ''}</td>
            <td className="num">{i.unidade ?? ''}</td>
            <td className="num">
              {gestor ? (
                <input className="cell-input" type="number" min={0} step="0.1"
                  value={valor(i.id, 'consumo', i.consumo_medio_mensal)}
                  onChange={(e) => editar(i.id, 'consumo', e.target.value)} />
              ) : num(i.consumo_medio_mensal, 2)}
            </td>
            <td className="num">{TIPO_ROTULO[i.tipo_consumo]}</td>
            <td className="num">
              <input className="cell-input" type="number" min={0} step="0.1"
                value={valor(i.id, 'estoque', i.estoque_atual)}
                onChange={(e) => editar(i.id, 'estoque', e.target.value)} />
            </td>
            <td className={`num total ${(comprar ?? 0) < 0 ? 'neg' : ''}`}>{num(comprar, 2)}</td>
            <td className="num">
              {gestor ? (
                <input className="cell-input wide" type="text"
                  value={valor(i.id, 'obs', i.observacoes)}
                  onChange={(e) => editar(i.id, 'obs', e.target.value)} />
              ) : (i.observacoes ?? '')}
            </td>
            {gestor && (
              <td className="num">
                <button className="btn ghost split-btn" disabled={salvando}
                  title="Desativar item (sai da lista, sem apagar o histórico)"
                  onClick={() => onRemover(i)}>✕</button>
              </td>
            )}
          </tr>
        );
      })}
    </>
  );
}

function FormNovoItem({ salvando, onSubmit }: {
  salvando: boolean;
  onSubmit: (b: CompraMensalEdicao & { categoria: string; descricao: string }) => void;
}) {
  const [v, setV] = useState({
    categoria: '', subcategoria: '', descricao: '', especificacao: '',
    unidade: '', consumo: '', tipo: 'CONTINUO' as CompraMensalItem['tipo_consumo'],
    observacoes: '',
  });
  const consumoOk = (() => {
    try { consumoDoItemNovo(v.consumo); return true; } catch { return false; }
  })();
  const ok = v.categoria.trim() !== '' && v.descricao.trim() !== '' && consumoOk;
  return (
    <div className="form-grid c4">
      <div className="fg"><label>Categoria <span className="req">*</span></label>
        <input value={v.categoria} onChange={(e) => setV({ ...v, categoria: e.target.value })}
          placeholder="ex.: Limpeza" /></div>
      <div className="fg"><label>Subcategoria</label>
        <input value={v.subcategoria} onChange={(e) => setV({ ...v, subcategoria: e.target.value })} /></div>
      <div className="fg"><label>Descrição Padronizada <span className="req">*</span></label>
        <input value={v.descricao} onChange={(e) => setV({ ...v, descricao: e.target.value })} /></div>
      <div className="fg"><label>Especificação</label>
        <input value={v.especificacao} onChange={(e) => setV({ ...v, especificacao: e.target.value })}
          placeholder="ex.: Galão 5 litros" /></div>
      <div className="fg"><label>Unidade</label>
        <input value={v.unidade} onChange={(e) => setV({ ...v, unidade: e.target.value })}
          placeholder="UN / PCT / CX / GL…" /></div>
      <div className="fg"><label>Consumo Médio Mensal</label>
        <input type="number" min={0} step="0.1" value={v.consumo}
          onChange={(e) => setV({ ...v, consumo: e.target.value })} /></div>
      <div className="fg"><label>Tipo de Consumo</label>
        <select value={v.tipo}
          onChange={(e) => setV({ ...v, tipo: e.target.value as CompraMensalItem['tipo_consumo'] })}>
          <option value="CONTINUO">Contínuo</option>
          <option value="SOB_DEMANDA">Sob Demanda</option>
        </select></div>
      <div className="fg"><label>Observações</label>
        <input value={v.observacoes} onChange={(e) => setV({ ...v, observacoes: e.target.value })} /></div>
      <div className="fg"><label>&nbsp;</label>
        <button className="btn" disabled={!ok || salvando} onClick={() => onSubmit({
          categoria: v.categoria.trim(),
          subcategoria: v.subcategoria.trim() || null,
          descricao: v.descricao.trim(),
          especificacao: v.especificacao.trim() || null,
          unidade: v.unidade.trim() || null,
          consumo_medio_mensal: consumoDoItemNovo(v.consumo),
          tipo_consumo: v.tipo,
          observacoes: v.observacoes.trim() || null,
        })}>{salvando ? 'Salvando…' : 'Criar item'}</button></div>
    </div>
  );
}
