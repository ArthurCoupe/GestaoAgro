import { useCallback, useEffect, useReducer, useState } from 'react';
import {
  atualizarReceitaSubstrato, criarLotePesquisa, criarVersaoReceita, excluirLotePesquisa,
  getComposicaoDasReceitas, getLotesPesquisa, getReceitaVigente, getReceitasAntigas, getReceitasSubstrato, num,
  type ComposicaoDeReceita, type CriarVersaoReceitaBody, type LotePesquisa, type ReceitaAntiga, type ReceitaSubstrato,
} from '../api/client';
import { CampoData } from '../components/CampoData';
import { Panel, Pill, useConfirmar, useToast } from '../components/ui';
import { AVISO_RECEITA_EM_TESTE } from './ComprasMateriaPrima';

const STATUS = ['PADRAO', 'TESTE', 'INATIVA'] as const;
const TIPOS = ['SH', 'SP', 'SB'];

type CamposElegibilidade = Pick<ReceitaSubstrato, 'id' | 'produto_id' | 'versao' | 'ativa' | 'status'>;

export function elegivelParaLoteNovo(
  r: CamposElegibilidade,
  todasDoProduto: CamposElegibilidade[],
): boolean {
  const passaNoFiltro = (x: CamposElegibilidade) =>
    x.ativa === true && (x.status == null || x.status === 'PADRAO');
  if (!passaNoFiltro(r)) return false;
  const maiorElegivel = todasDoProduto
    .filter((x) => x.produto_id === r.produto_id && passaNoFiltro(x))
    .reduce((max, x) => (x.versao > max ? x.versao : max), -Infinity);
  return r.versao === maiorElegivel;
}

export function CelulaElegivel({ receita, todasDoProduto }: {
  receita: CamposElegibilidade;
  todasDoProduto: CamposElegibilidade[];
}) {
  const elegivel = elegivelParaLoteNovo(receita, todasDoProduto);
  return <Pill tone={elegivel ? 'ok' : 'neutral'}>{elegivel ? 'Sim' : 'Não'}</Pill>;
}

const ROTULO: Record<string, string> = {
  PADRAO: 'Padrão',
  TESTE: 'Em teste',
  INATIVA: 'Inativa',
  '(nulo)': 'Sem classificação',
};

type EstadoLinha = Pick<ReceitaSubstrato, 'nome' | 'vigente_desde'>;

type AcaoLinha =
  | { tipo: 'DIGITAR_NOME'; valor: string }
  | { tipo: 'DIGITAR_DATA'; valor: string }
  | { tipo: 'SINCRONIZAR'; receita: EstadoLinha };

export function reduzEdicaoLinha(estado: EstadoLinha, acao: AcaoLinha): EstadoLinha {
  switch (acao.tipo) {
    case 'DIGITAR_NOME': return { ...estado, nome: acao.valor };
    case 'DIGITAR_DATA': return { ...estado, vigente_desde: acao.valor };
    case 'SINCRONIZAR': return { nome: acao.receita.nome, vigente_desde: acao.receita.vigente_desde };
    default: return estado;
  }
}

export interface EstadoNovaVersao {
  produtoId: number | null;
  nome: string;
}

export function validarNovaVersao(estado: EstadoNovaVersao): string | null {
  if (estado.produtoId == null) return 'Escolha o produto antes de salvar.';
  if (estado.nome.trim() === '') return 'O nome da nova versão é obrigatório.';
  return null;
}

export function montarCorpoVersaoReceita(estado: {
  produtoId: number;
  nome: string;
  motivoAjuste: string;
  ingredientes: Array<{ materiaPrimaId: number; quantidadePorBloco: string; observacao?: string | null }>;
}): CriarVersaoReceitaBody {
  return {
    produtoId: estado.produtoId,
    nome: estado.nome.trim(),
    motivoAjuste: estado.motivoAjuste.trim() || null,
    ingredientes: estado.ingredientes.map((i) => ({
      materiaPrimaId: i.materiaPrimaId,
      quantidadePorBloco: Number(i.quantidadePorBloco) || 0,
      ...(i.observacao ? { observacao: i.observacao } : {}),
    })),
  };
}

export function podePromover(
  r: Pick<ReceitaSubstrato, 'status' | 'ativa'> | ReceitaSubstrato['status'] | null | undefined,
): boolean {
  if (r == null || typeof r === 'string') return r === 'TESTE';
  return r.status === 'TESTE' || (r.status === 'PADRAO' && r.ativa === false);
}

export type AcaoDoSelectDeStatus =
  | { tipo: 'SALVAR'; patch: Partial<Pick<ReceitaSubstrato, 'status'>> }
  | { tipo: 'PROMOVER' };

export function acaoDoSelectDeStatus(
  novoStatus: ReceitaSubstrato['status'],
  receita: Pick<ReceitaSubstrato, 'ativa'>,
): AcaoDoSelectDeStatus {
  if (novoStatus === 'PADRAO' && !receita.ativa) return { tipo: 'PROMOVER' };
  return { tipo: 'SALVAR', patch: { status: novoStatus } };
}

export function textoConfirmacaoPromover(
  receita: Pick<ReceitaSubstrato, 'id' | 'nome' | 'produto_id' | 'produto_nome' | 'versao'>,
  todasDoProduto: ReceitaSubstrato[],
): string {
  const depois = todasDoProduto.map((x) => (x.id === receita.id
    ? { ...x, status: 'PADRAO' as const, ativa: true } : x));
  const euDepois = depois.find((x) => x.id === receita.id);
  const viraEleita = euDepois ? elegivelParaLoteNovo(euDepois, depois) : false;

  const quem = `"${receita.nome}" (v${receita.versao}`
    + `${receita.produto_nome ? `, ${receita.produto_nome}` : ''})`;

  if (viraEleita) {
    const perdeOPosto = todasDoProduto.find((x) => x.produto_id === receita.produto_id
      && x.id !== receita.id && elegivelParaLoteNovo(x, todasDoProduto));
    const base = `Promover ${quem} para PADRÃO: ela passa a ser a receita `
      + 'escolhida automaticamente nos lotes novos deste produto.';
    return perdeOPosto
      ? `${base} A receita "${perdeOPosto.nome}" (v${perdeOPosto.versao}) deixa de ser a eleita.`
      : base;
  }

  const continua = depois.find((x) => x.id !== receita.id && elegivelParaLoteNovo(x, depois));
  const base = `Promover ${quem} para PADRÃO: ela deixa de ser marcada como em teste, `
    + 'mas NÃO passa a ser a escolhida automaticamente nos lotes novos.';
  return continua
    ? `${base} A receita "${continua.nome}" (v${continua.versao}) tem versão maior e continua sendo a eleita.`
    : base;
}

function LinhaReceita({
  receita: r, salvando, onSalvar, onPromover, todasDoProduto,
  composicaoAberta, onToggleComposicao, composicaoDaReceita, carregandoComposicao, erroComposicao,
}: {
  receita: ReceitaSubstrato;
  salvando: boolean;
  onSalvar: (id: number, patch: Partial<Pick<ReceitaSubstrato, 'nome' | 'status' | 'vigente_desde'>>) => void;
  onPromover: (receita: ReceitaSubstrato) => void;
  todasDoProduto: ReceitaSubstrato[];
  composicaoAberta: boolean;
  onToggleComposicao: () => void;
  composicaoDaReceita: ComposicaoDeReceita | undefined;
  carregandoComposicao: boolean;
  erroComposicao: boolean;
}) {
  const [estado, despachar] = useReducer(reduzEdicaoLinha, { nome: r.nome, vigente_desde: r.vigente_desde });

  useEffect(() => {
    despachar({ tipo: 'SINCRONIZAR', receita: { nome: r.nome, vigente_desde: r.vigente_desde } });
  }, [r.nome, r.vigente_desde]);

  return (
    <>
      <tr>
        <td>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              type="button"
              className="btn ghost"
              style={{ padding: '2px 8px' }}
              onClick={onToggleComposicao}
              title={composicaoAberta ? 'Recolher composição' : 'Ver composição'}
            >
              {composicaoAberta ? '▾' : '▸'}
            </button>
            <input
              value={estado.nome}
              disabled={salvando}
              onChange={(e) => despachar({ tipo: 'DIGITAR_NOME', valor: e.target.value })}
              onBlur={(e) => {
                const nome = e.target.value.trim();
                if (nome && nome !== r.nome) onSalvar(r.id, { nome });
              }}
            />
          </div>
          {r.status === 'TESTE' && (
            <div className="sub">{AVISO_RECEITA_EM_TESTE}</div>
          )}
          {podePromover(r) && (
            <button
              type="button"
              className="btn ghost"
              disabled={salvando}
              onClick={() => onPromover(r)}
            >
              Promover para produção
            </button>
          )}
        </td>
        <td>{r.produto_nome ?? '—'}</td>
        <td>v{r.versao}</td>
        <td>
          <select
            value={r.status ?? ''}
            disabled={salvando}
            onChange={(e) => {
              const novoStatus = (e.target.value || null) as ReceitaSubstrato['status'];
              const acao = acaoDoSelectDeStatus(novoStatus, r);
              if (acao.tipo === 'PROMOVER') onPromover(r);
              else onSalvar(r.id, acao.patch);
            }}
          >
            <option value="">{ROTULO['(nulo)']}</option>
            {STATUS.map((s) => <option key={s} value={s}>{ROTULO[s]}</option>)}
          </select>
        </td>
        <td>
          <CampoData
            value={estado.vigente_desde}
            disabled={salvando}
            onChange={(iso) => despachar({ tipo: 'DIGITAR_DATA', valor: iso })}
            onBlurIso={(d) => {
              if (d && d !== r.vigente_desde) onSalvar(r.id, { vigente_desde: d });
            }}
          />
        </td>
        <td><CelulaElegivel receita={r} todasDoProduto={todasDoProduto} /></td>
      </tr>
      {composicaoAberta && (
        <tr>
          <td colSpan={6}>
            {carregandoComposicao ? (
              <div className="sub">Carregando composição…</div>
            ) : erroComposicao ? (
              <div className="empty">Não foi possível carregar a composição.</div>
            ) : !composicaoDaReceita || composicaoDaReceita.ingredientes.length === 0 ? (
              <div className="empty">Nenhum ingrediente cadastrado para esta receita.</div>
            ) : (
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Matéria-prima</th>
                    <th>Quantidade por bloco</th>
                    <th>
                      Total
                      {composicaoDaReceita.blocos_por_receita != null
                        ? ` (${composicaoDaReceita.blocos_por_receita} blocos)` : ''}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {totaisDaComposicao(
                    composicaoDaReceita.ingredientes.map((i) => ({
                      materiaPrimaId: i.materia_prima_id ?? 0,
                      nome: i.nome,
                      unidade: i.unidade,
                      quantidadePorBloco: i.quantidade_por_bloco,
                    })),
                    composicaoDaReceita.blocos_por_receita,
                  ).map((i, idx) => (
                    <tr key={`${i.materiaPrimaId}-${idx}`}>
                      <td>{i.nome}</td>
                      <td>{num(i.quantidadePorBloco, 4)} {i.unidade}</td>
                      <td>{i.total == null ? '—' : `${num(i.total, 3)} ${i.unidade}`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

export function totaisDaComposicao(
  ingredientes: Array<{ materiaPrimaId: number; nome: string; unidade: string; quantidadePorBloco: number }>,
  blocosPorReceita: number | null,
) {
  return ingredientes.map((i) => ({
    ...i,
    total: blocosPorReceita == null
      ? null
      : Math.round(i.quantidadePorBloco * blocosPorReceita * 1000) / 1000,
  }));
}

function produtosDistintos(itens: ReceitaSubstrato[]): Array<{ id: number; nome: string | null }> {
  const vistos = new Map<number, string | null>();
  for (const r of itens) if (!vistos.has(r.produto_id)) vistos.set(r.produto_id, r.produto_nome);
  return [...vistos.entries()]
    .map(([id, nome]) => ({ id, nome }))
    .sort((a, b) => (a.nome ?? '').localeCompare(b.nome ?? '', 'pt-BR'));
}

interface IngredienteForm { materiaPrimaId: number; nome: string; quantidadePorBloco: string }

const FORMULARIO_VAZIO = { produtoId: null as number | null, nome: '', motivoAjuste: '' };

const AVISO_NOVA_VERSAO = 'Correções de receita valem só de agora em diante, nunca retroagem: mudar a '
  + 'composição da versão atual reescreveria o que os lotes já lançados reportam ter usado. Para corrigir, '
  + 'crie uma versão nova: ela nasce em teste e só entra em produção quando alguém a promover. Acrescentar '
  + 'uma matéria-prima que não está na receita vigente não está disponível nesta tela ainda.';

export function TabelaReceitasAntigas({ itens }: { itens: ReceitaAntiga[] }) {
  return (
    <table className="tbl">
      <thead>
        <tr>
          <th>Nome da receita</th><th>Tipo de cogumelo</th><th>Base</th><th>Modelo</th>
          <th>Início de utilização</th><th>Elegível para lote novo</th>
        </tr>
      </thead>
      <tbody>
        {itens.map((r) => (
          <tr key={r.ordem}>
            <td style={{ maxWidth: 420, whiteSpace: 'normal' }}>
              <details className="inv-dobravel">
                <summary><b>{r.nome}</b></summary>
                <div className="sub">{r.descricao ?? 'Sem composição na planilha.'}</div>
              </details>
            </td>
            <td>{r.tipo}</td>
            <td>{r.base ?? ''}</td>
            <td>{r.modelo ?? ''}</td>
            <td>{r.start_obs ?? ''}</td>
            <td><Pill tone="neutral">Não</Pill></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SecaoReceitasAntigas() {
  const [itens, setItens] = useState<ReceitaAntiga[] | null>(null);
  const [erro, setErro] = useState('');

  const recarregar = useCallback(() => {
    setErro('');
    getReceitasAntigas()
      .then(setItens)
      .catch((e) => setErro(e?.response?.data?.erro ?? e.message));
  }, []);
  useEffect(recarregar, [recarregar]);

  if (erro) return <div className="empty">Erro: {erro}</div>;
  if (!itens) return <div className="loading">Carregando receitas antigas…</div>;

  return (
    <Panel title="Receitas antigas da planilha" tag={`${itens.length} receitas`}
      sub="Só para consulta, como estavam na aba Receitas da planilha. Não entram em lote novo. Clique no nome para ver a composição.">
      <div className="tbl-scroll" style={{ maxHeight: 440 }}>
        <TabelaReceitasAntigas itens={itens} />
      </div>
    </Panel>
  );
}

function SecaoLotesPesquisa() {
  const toast = useToast();
  const confirmar = useConfirmar();
  const [itens, setItens] = useState<LotePesquisa[] | null>(null);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [v, setV] = useState({ lote_label: '', tipo: 'SH', base: '' });

  const recarregar = useCallback(() => {
    setErro('');
    getLotesPesquisa()
      .then(setItens)
      .catch((e) => setErro(e?.response?.data?.erro ?? e.message));
  }, []);
  useEffect(recarregar, [recarregar]);

  if (erro) return <div className="empty">Erro: {erro}</div>;
  if (!itens) return <div className="loading">Carregando lotes de pesquisa…</div>;

  const salvar = () => {
    setSalvando(true);
    criarLotePesquisa({ lote_label: v.lote_label, tipo: v.tipo || null, base: v.base || null })
      .then(() => { toast('Lote de pesquisa incluído.'); setV({ ...v, lote_label: '', base: '' }); recarregar(); })
      .catch((e) => toast(e?.response?.data?.erro ?? e.message, true))
      .finally(() => setSalvando(false));
  };

  const remover = async (l: LotePesquisa) => {
    const ok = await confirmar(`Excluir o lote de pesquisa "${l.lote_label}"?\n\nNão dá para desfazer.`);
    if (!ok) return;
    excluirLotePesquisa(l.id).then(() => { toast('Lote excluído.'); recarregar(); })
      .catch((e) => toast(e?.response?.data?.erro ?? e.message, true));
  };

  return (
    <Panel title="Lotes de Pesquisa" tag={`${itens.length} lotes`}
      sub="Lotes experimentais anotados na aba Receitas (Lote, Tipo e Base)">
      <div className="form-grid c4" style={{ marginBottom: 16 }}>
        <div className="fg"><label>Lote <span className="req">*</span></label>
          <input value={v.lote_label} onChange={(e) => setV({ ...v, lote_label: e.target.value })}
            placeholder='ex.: 18/fev ou 03/03/2026' /></div>
        <div className="fg"><label>Tipo</label>
          <select value={v.tipo} onChange={(e) => setV({ ...v, tipo: e.target.value })}>
            {TIPOS.map((t) => <option key={t}>{t}</option>)}
          </select></div>
        <div className="fg"><label>Base</label>
          <input value={v.base} onChange={(e) => setV({ ...v, base: e.target.value })}
            placeholder="ex.: CP10 / S ADITIVO" /></div>
        <div className="fg"><label>&nbsp;</label>
          <button className="btn" disabled={!v.lote_label || salvando} onClick={salvar}>
            {salvando ? 'Salvando…' : '+ Incluir lote'}</button></div>
      </div>

      <div className="tbl-scroll" style={{ maxHeight: 320 }}>
        <table className="tbl">
          <thead>
            <tr><th>Lote</th><th>Tipo</th><th>Base</th><th /></tr>
          </thead>
          <tbody>
            {itens.map((l) => (
              <tr key={l.id}>
                <td><b>{l.lote_label}</b></td>
                <td>{l.tipo ?? ''}</td>
                <td>{l.base ?? ''}</td>
                <td>
                  <button className="btn ghost" style={{ padding: '4px 8px' }}
                    onClick={() => remover(l)}>
                    Excluir
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

export function CadastroReceitas() {
  const toast = useToast();
  const confirmar = useConfirmar();
  const [itens, setItens] = useState<ReceitaSubstrato[] | null>(null);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState<number | null>(null);

  const recarregar = useCallback(() => {
    setErro('');
    getReceitasSubstrato()
      .then(setItens)
      .catch((e) => setErro(e?.response?.data?.erro ?? e.message));
  }, []);

  useEffect(recarregar, [recarregar]);

  const [composicao, setComposicao] = useState<ComposicaoDeReceita[] | null>(null);
  const [erroComposicao, setErroComposicao] = useState(false);
  const recarregarComposicao = useCallback(() => {
    getComposicaoDasReceitas()
      .then((c) => { setComposicao(c); setErroComposicao(false); })
      .catch(() => { setComposicao([]); setErroComposicao(true); });
  }, []);

  useEffect(recarregarComposicao, [recarregarComposicao]);

  const [composicoesAbertas, setComposicoesAbertas] = useState<Set<number>>(new Set());
  const alternarComposicao = (id: number) => setComposicoesAbertas((atual) => {
    const prox = new Set(atual);
    if (prox.has(id)) prox.delete(id); else prox.add(id);
    return prox;
  });

  function salvar(id: number, patch: Partial<Pick<ReceitaSubstrato, 'nome' | 'status' | 'vigente_desde'>>) {
    setSalvando(id);
    atualizarReceitaSubstrato(id, patch)
      .then(() => { toast('Receita atualizada.'); recarregar(); })
      .catch((e) => {
        toast(e?.response?.data?.erro ?? e.message, true);
        recarregar();
      })
      .finally(() => setSalvando(null));
  }

  function promover(r: ReceitaSubstrato) {
    confirmar(textoConfirmacaoPromover(r, itens ?? [])).then((ok) => {
      if (!ok) return;
      setSalvando(r.id);
      atualizarReceitaSubstrato(r.id, { status: 'PADRAO', ativa: true })
        .then(() => { toast(`"${r.nome}" promovida para produção.`); recarregar(); })
        .catch((e) => {
          toast(e?.response?.data?.erro ?? e.message, true);
          recarregar();
        })
        .finally(() => setSalvando(null));
    });
  }

  const [form, setForm] = useState(FORMULARIO_VAZIO);
  const [ingredientes, setIngredientes] = useState<IngredienteForm[]>([]);
  const [carregandoVigente, setCarregandoVigente] = useState(false);
  const [semReceitaVigente, setSemReceitaVigente] = useState(false);
  const [erroFormulario, setErroFormulario] = useState('');
  const [salvandoNovaVersao, setSalvandoNovaVersao] = useState(false);

  useEffect(() => {
    if (form.produtoId == null) { setIngredientes([]); setSemReceitaVigente(false); return undefined; }
    let obsoleta = false;
    setCarregandoVigente(true);
    getReceitaVigente(form.produtoId)
      .then((vigente) => {
        if (obsoleta) return;
        setSemReceitaVigente(!vigente);
        setIngredientes(vigente ? vigente.receita_ingredientes.map((i) => ({
          materiaPrimaId: i.materias_primas.id,
          nome: i.materias_primas.nome,
          quantidadePorBloco: String(i.quantidade_por_bloco),
        })) : []);
      })
      .catch((e) => {
        if (obsoleta) return;
        toast(e?.response?.data?.erro ?? e.message, true);
        setIngredientes([]);
        setSemReceitaVigente(false);
      })
      .finally(() => { if (!obsoleta) setCarregandoVigente(false); });
    return () => { obsoleta = true; };
  }, [form.produtoId, toast]);

  function salvarNovaVersao() {
    const problema = validarNovaVersao(form);
    if (problema) { setErroFormulario(problema); return; }
    setErroFormulario('');
    setSalvandoNovaVersao(true);
    criarVersaoReceita(montarCorpoVersaoReceita({ ...form, produtoId: form.produtoId as number, ingredientes }))
      .then((criada) => {
        toast(`Versão "${criada.nome}" criada em teste (v${criada.versao}).`);
        setForm(FORMULARIO_VAZIO);
        setIngredientes([]);
        recarregar();
        recarregarComposicao();
      })
      .catch((e) => toast(e?.response?.data?.erro ?? e.message, true))
      .finally(() => setSalvandoNovaVersao(false));
  }

  return (
    <>
      <Panel title="Nova versão desta receita" sub={AVISO_NOVA_VERSAO}>
        {itens == null ? <div className="sub">Carregando produtos…</div> : (
          <div className="form-grid c4">
            <div className="fg">
              <label>Produto <span className="req">*</span></label>
              <select
                value={form.produtoId ?? ''}
                disabled={salvandoNovaVersao}
                onChange={(e) => setForm({ ...form, produtoId: e.target.value ? Number(e.target.value) : null })}
              >
                <option value="">Selecione…</option>
                {produtosDistintos(itens).map((p) => (
                  <option key={p.id} value={p.id}>{p.nome ?? `Produto ${p.id}`}</option>
                ))}
              </select>
            </div>
            <div className="fg">
              <label>Nome da nova versão <span className="req">*</span></label>
              <input
                value={form.nome}
                maxLength={200}
                disabled={salvandoNovaVersao}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="ex.: Receita Shiitake (padrão)"
              />
            </div>
            <div className="fg">
              <label>Motivo do ajuste</label>
              <input
                value={form.motivoAjuste}
                maxLength={500}
                disabled={salvandoNovaVersao}
                onChange={(e) => setForm({ ...form, motivoAjuste: e.target.value })}
                placeholder="opcional"
              />
            </div>
            <div className="fg"><label>&nbsp;</label>
              <button className="btn" disabled={salvandoNovaVersao} onClick={salvarNovaVersao}>
                {salvandoNovaVersao ? 'Salvando…' : 'Criar versão em teste'}
              </button>
            </div>
          </div>
        )}

        {erroFormulario && <div className="empty">{erroFormulario}</div>}

        {form.produtoId != null && (
          <>
            {carregandoVigente ? <div className="sub">Carregando ingredientes…</div> : (
              semReceitaVigente ? (
                <div className="empty">Este produto ainda não tem receita vigente: a nova versão nasce sem
                  ingredientes pré-carregados.</div>
              ) : ingredientes.length === 0 ? (
                <div className="empty">Nenhum ingrediente na lista.</div>
              ) : (
                <table className="tbl">
                  <thead>
                    <tr><th>Matéria-prima</th><th>Quantidade por bloco</th><th /></tr>
                  </thead>
                  <tbody>
                    {ingredientes.map((i) => (
                      <tr key={i.materiaPrimaId}>
                        <td>{i.nome}</td>
                        <td>
                          <input
                            type="number" step="0.0001" min={0}
                            value={i.quantidadePorBloco}
                            disabled={salvandoNovaVersao}
                            onChange={(e) => setIngredientes((xs) => xs.map((x) => (
                              x.materiaPrimaId === i.materiaPrimaId
                                ? { ...x, quantidadePorBloco: e.target.value } : x
                            )))}
                          />
                        </td>
                        <td>
                          <button
                            className="btn ghost"
                            disabled={salvandoNovaVersao}
                            onClick={() => setIngredientes((xs) => xs.filter((x) => x.materiaPrimaId !== i.materiaPrimaId))}
                          >
                            Remover
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            )}
          </>
        )}
      </Panel>

      <Panel
        title="Cadastro de Receitas"
        sub="Receitas de substrato. O tipo de cogumelo e a versão não se editam: os lotes já lançados apontam para a versão que usaram."
      >
        {erro && <div className="empty">{erro}</div>}
        {itens == null ? <div className="sub">Carregando…</div> : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Nome da receita</th>
                <th>Tipo de cogumelo</th>
                <th>Versão</th>
                <th>Status</th>
                <th>Início de utilização</th>
                <th>Elegível para lote novo</th>
              </tr>
            </thead>
            <tbody>
              {itens.map((r) => (
                <LinhaReceita
                  key={r.id}
                  receita={r}
                  salvando={salvando === r.id}
                  onSalvar={salvar}
                  onPromover={promover}
                  todasDoProduto={itens}
                  composicaoAberta={composicoesAbertas.has(r.id)}
                  onToggleComposicao={() => alternarComposicao(r.id)}
                  composicaoDaReceita={composicao?.find((c) => c.receita_id === r.id)}
                  carregandoComposicao={composicao === null}
                  erroComposicao={erroComposicao}
                />
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      <SecaoReceitasAntigas />

      <SecaoLotesPesquisa />
    </>
  );
}
