import { useCallback, useEffect, useState } from 'react';
import {
  brl, CHAVE_HORIZONTE_PREVISAO, custoPorKgVigente, dataBr, getComprasMp, getComprasPrevistas, getPrevisao,
  hojeISO, num, putComprasMpCustoPorKg,
  putComprasMpEmbalagem, putComprasMpEmTransito, putComprasMpEstoque, putComprasMpIngrediente,
  putComprasMpPesoBloco, putComprasPrevistas, putMetaOperacional, putSementesParametros,
  salvarEstoqueMinimoMp, salvarPrevisao,
  type CompraMpIngrediente, type CompraMpReceita, type CompraPrevista, type ComprasMpResposta,
  type NecessidadeDeSementesResposta, type PrevisaoItem, type PrevisaoResposta, type TipoPrevisao,
} from '../api/client';
import { useAuth } from '../auth';
import { BotaoExportar } from '../components/BotaoExportar';
import { BlocoCoberturaMateriaPrima, TopoOperacional } from '../components/BlocosOperacionais';
import { Kpi, Panel, useToast } from '../components/ui';

const COLUNAS = [
  'Materia Prima', 'Ncm', 'Embalagem', 'Apresentação', 'Custo por apresentação/saco',
  'Custo por kg', 'Qtde de kg por receita', 'Valor $ por receita', 'receita por bloco (KG)',
  'estoque necessario (KG)', 'estoque necessario (POR APRESENTAÇÃO)',
  'estoque disponivel', 'COMPRA',
];

const fm4 = (v: number | null | undefined) =>
  v == null ? '' : v.toLocaleString('pt-BR', { maximumFractionDigits: 4 });

export interface EdicoesPendentes {
  pesoBloco: Record<number, string>;
  estoque: Record<number, string>;
  ingrediente: Record<string, string>;
  embalagem: Record<string, string>;
  emTransito: Record<number, string>;
  estoqueMinimo: Record<number, string>;
  custoPorKg?: Record<number, string>;
}
export function contarPendencias(e: EdicoesPendentes): number {
  return Object.values(e).reduce((n, balde) => n + Object.keys(balde).length, 0);
}

export function semChaveSalva(mapa: Record<number, string>, chave: number): Record<number, string> {
  const proximo = { ...mapa };
  delete proximo[chave];
  return proximo;
}

export function estoquesDoPayload(
  editEstoque: Record<number, string>,
): Array<{ materiaPrimaId: number; estoque: number | null }> {
  return Object.entries(editEstoque).map(([mpId, v]) => {
    const t = v.trim();
    const estoque = t === '' ? null : Number(t);
    if (estoque !== null && !(estoque >= 0)) {
      throw new Error(`Estoque disponível inválido na matéria-prima #${mpId}: nada foi salvo.`);
    }
    return { materiaPrimaId: Number(mpId), estoque };
  });
}

export function emTransitoDoPayload(
  editEmTransito: Record<number, string>,
): Array<{ materiaPrimaId: number; qtde: number | null }> {
  return Object.entries(editEmTransito).map(([mpId, v]) => {
    const qtde = transitoVigente(v, null);
    if (qtde !== null && !(qtde >= 0)) {
      throw new Error(`Em trânsito inválido na matéria-prima #${mpId}: nada foi salvo.`);
    }
    return { materiaPrimaId: Number(mpId), qtde };
  });
}

export function transitoVigente(
  bruto: string | undefined,
  doServidor: number | null | undefined,
): number | null {
  if (bruto === undefined) return doServidor ?? null;
  const t = bruto.trim();
  return t === '' ? null : Number(t);
}

export function custoPorKgDoPayload(
  editCustoPorKg: Record<number, string>,
): Array<{ materiaPrimaId: number; custoPorKg: number | null }> {
  return Object.entries(editCustoPorKg).map(([mpId, v]) => {
    const t = v.trim();
    const custoPorKg = t === '' ? null : Number(t);
    if (custoPorKg !== null && !(custoPorKg > 0)) {
      throw new Error(`Custo por kg inválido na matéria-prima #${mpId}: nada foi salvo.`);
    }
    return { materiaPrimaId: Number(mpId), custoPorKg };
  });
}

export function estoqueMinimoDoPayload(
  editEstoqueMinimo: Record<number, string>,
): Array<{ materiaPrimaId: number; estoqueMinimo: number | null }> {
  return Object.entries(editEstoqueMinimo).map(([mpId, v]) => {
    const t = v.trim();
    const estoqueMinimo = t === '' ? null : Number(t);
    if (estoqueMinimo !== null && !(estoqueMinimo >= 0)) {
      throw new Error(`Estoque mínimo inválido na matéria-prima #${mpId}: nada foi salvo.`);
    }
    return { materiaPrimaId: Number(mpId), estoqueMinimo };
  });
}

export function pesosBlocoDoPayload(
  editPesoBloco: Record<number, string>,
): Array<{ receitaId: number; pesoBlocoKg: number | null }> {
  return Object.entries(editPesoBloco).map(([receitaId, v]) => {
    const t = v.trim();
    const pesoBlocoKg = t === '' ? null : Number(t);
    if (pesoBlocoKg !== null && !(pesoBlocoKg > 0)) {
      throw new Error(`Peso do bloco inválido na receita #${receitaId}: nada foi salvo.`);
    }
    return { receitaId: Number(receitaId), pesoBlocoKg };
  });
}

export function embalagensDoPayload(
  editEmb: Record<string, string>,
): Array<{ id: number; body: { estoque_disponivel?: number | null; estoque_minimo?: number | null } }> {
  const ids = [...new Set(Object.keys(editEmb).map((k) => Number(k.split(':')[0])))];
  const campos = [
    ['disp', 'estoque_disponivel', 'Estoque disponível'],
    ['min', 'estoque_minimo', 'Estoque mínimo'],
  ] as const;
  return ids.map((id) => {
    const body: { estoque_disponivel?: number | null; estoque_minimo?: number | null } = {};
    for (const [sufixo, coluna, rotulo] of campos) {
      const bruto = editEmb[`${id}:${sufixo}`];
      if (bruto === undefined) continue;
      const t = bruto.trim();
      const v = t === '' ? null : Number(t);
      if (v !== null && !(v >= 0)) {
        throw new Error(`${rotulo} inválido no item de embalagem #${id}: nada foi salvo.`);
      }
      body[coluna] = v;
    }
    return { id, body };
  });
}

export function ingredientesDoPayload(
  editIng: Record<string, string>,
): Array<{
  receitaId: number; materiaPrimaId: number;
  campo: 'custo_apresentacao' | 'kg_por_receita'; valor: number;
}> {
  return Object.entries(editIng).map(([chave, v]) => {
    const [receitaId, mpId, campo] = chave.split(':');
    const t = v.trim();
    const valor = t === '' ? NaN : Number(t);
    if (!(valor > 0)) {
      const rotulo = campo === 'kg_por_receita' ? 'Kg por receita' : 'Preço';
      throw new Error(`${rotulo} inválido na matéria-prima #${mpId}: nada foi salvo.`);
    }
    return {
      receitaId: Number(receitaId), materiaPrimaId: Number(mpId),
      campo: campo as 'custo_apresentacao' | 'kg_por_receita', valor,
    };
  });
}

export const AVISO_RECEITA_EM_TESTE = 'RECEITA EM TESTE: não é a receita de produção';

export function receitasDeTesteNoConsolidado(
  receitas: Array<Pick<CompraMpReceita, 'nome' | 'status' | 'ingredientes'>>,
): string[] {
  return receitas
    .filter((r) => r.status === 'TESTE'
      && r.ingredientes.some((i) => (i.necessario_apresentacao ?? 0) !== 0))
    .map((r) => `${r.nome} (${AVISO_RECEITA_EM_TESTE})`);
}

export function tituloDoCartao(receita: Pick<CompraMpReceita, 'nome' | 'status'>): string {
  return receita.status === 'TESTE' ? `${receita.nome} (${AVISO_RECEITA_EM_TESTE})` : receita.nome;
}

export function saldoFinalDoItem(
  { saldo_estoque, necessidade_total, em_transito }:
  { saldo_estoque: number; necessidade_total: number; em_transito: number | null },
) {
  const temTransito = em_transito !== null && em_transito !== undefined;
  const transito = temTransito ? Number(em_transito) : 0;
  const saldoFinal = Number(saldo_estoque) + transito - Number(necessidade_total);
  return { saldoFinal, comprar: saldoFinal < 0 ? -saldoFinal : 0, temTransito };
}

export function PainelPedidoConsolidado({
  receitas, pedidoConsolidado, editEmTransito, onEditEmTransito, editEstoqueMinimo, onEditEstoqueMinimo,
}: {
  receitas: CompraMpReceita[];
  pedidoConsolidado: ComprasMpResposta['pedido_consolidado'];
  editEmTransito: Record<number, string>;
  onEditEmTransito: (materiaPrimaId: number, v: string) => void;
  editEstoqueMinimo: Record<number, string>;
  onEditEstoqueMinimo: (materiaPrimaId: number, v: string) => void;
}) {
  const deTeste = receitasDeTesteNoConsolidado(receitas);
  const embalagemPorMp = new Map(materiasPrimasUnicas(receitas).map((m) => [m.materia_prima_id, m.embalagem]));
  return (
    <Panel id="compras-mp-pedido" title="PEDIDO DE COMPRAS"
      sub={SUB_PEDIDO_CONSOLIDADO}>
      {deTeste.length > 0 && (
        <div className="obs-tela aviso-receita-teste">
          ATENÇÃO: o total abaixo INCLUI {deTeste.join('; ')}. O cartão da receita está acima, para subtrair.
        </div>
      )}
      <div className="plan-wrap cp">
        <table className="plan cp">
          <thead>
            <tr>
              <th className="rotulo">Materia Prima</th>
              <th className="num">ESTOQUE DISPONÍVEL</th>
              <th className="num">NECESSÁRIO NO HORIZONTE</th>
              <th className="num">A CAMINHO</th>
              <th className="num">COMPRA (estoque - soma do necessário + a caminho)</th>
              <th className="num">ESTOQUE MÍNIMO</th>
              <th className="num">COMPRAR (apresentações inteiras)</th>
            </tr>
          </thead>
          <tbody>
            {pedidoConsolidado.map((p) => {
              const mpId = p.materia_prima_id;
              const bruto = mpId != null ? editEmTransito[mpId] : undefined;
              const emTransitoAtual = transitoVigente(bruto, p.em_transito);
              const brutoMinimo = mpId != null ? editEstoqueMinimo[mpId] : undefined;
              const saldoFinal = p.compra_total != null
                ? saldoFinalDoItem({
                  saldo_estoque: p.compra_total, necessidade_total: 0, em_transito: emTransitoAtual,
                }).saldoFinal
                : null;
              if (p.semente_tipo) {
                return (
                  <tr key={p.materia_prima}>
                    <td className="rotulo">{p.materia_prima}</td>
                    <td className="num">
                      {textoDeParcela(p.estoque_disponivel, 'não informado')}
                      <div className="obs-tela-inline">vem da tela Sementes</div>
                    </td>
                    <td className="num">{textoDeParcela(p.necessario_total, 'sem previsão completa')}</td>
                    <td className="num">
                      {textoDeParcela(p.em_transito, 'não informado')}
                      <div className="obs-tela-inline">compras previstas, abaixo</div>
                    </td>
                    <td className={`num total ${saldoFinal != null && saldoFinal < 0 ? 'neg' : ''}`}>
                      {fm4(saldoFinal)}
                    </td>
                    <td className="num">—</td>
                    <td className="num total">{p.comprar != null ? apresentacoesInteiras(p.comprar, 'saco') : '—'}</td>
                  </tr>
                );
              }
              return (
                <tr key={p.materia_prima}>
                  <td className="rotulo">{p.materia_prima}</td>
                  <td className="num">{textoDeParcela(p.estoque_disponivel, 'não informado')}</td>
                  <td className="num">{textoDeParcela(p.necessario_total, 'sem previsão completa')}</td>
                  <td className="num">
                    {mpId != null && (
                      <input className="cell-input" type="number" min={0} step="0.01"
                        placeholder="não informado"
                        title="O que já foi comprado do fornecedor e ainda não chegou, em apresentações (sacos/cx): a mesma unidade de Estoque disponível. Separado do estoque físico, entra só no saldo final."
                        value={bruto ?? (p.em_transito != null ? String(p.em_transito) : '')}
                        onChange={(e) => onEditEmTransito(mpId, e.target.value)} />
                    )}
                  </td>
                  <td className={`num total ${saldoFinal != null && saldoFinal < 0 ? 'neg' : ''}`}>
                    {fm4(saldoFinal)}
                  </td>
                  <td className="num">
                    {mpId != null && (
                      <input className="cell-input" type="number" min={0} step="0.01"
                        placeholder="não informado"
                        title="Quanto você quer manter sempre em estoque, em apresentações (sacos/cx): a mesma unidade de Estoque disponível. Vazio conta 0 no COMPRAR."
                        value={brutoMinimo ?? (p.estoque_minimo != null ? String(p.estoque_minimo) : '')}
                        onChange={(e) => onEditEstoqueMinimo(mpId, e.target.value)} />
                    )}
                  </td>
                  <td className="num total">
                    {p.comprar != null
                      ? apresentacoesInteiras(p.comprar, mpId != null ? embalagemPorMp.get(mpId) : null)
                      : '—'}
                    {(bruto !== undefined || brutoMinimo !== undefined) && (
                      <div className="obs-tela-inline">recalcula ao salvar</div>
                    )}
                  </td>
                </tr>
              );
            })}
            {pedidoConsolidado.length === 0 && (
              <tr><td className="rotulo" /><td colSpan={6}><div className="empty">Sem projeção: nenhuma matéria-prima nas receitas cadastradas.</div></td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

const SUB_PEDIDO_CONSOLIDADO = 'Consolidado por insumo, tudo em apresentações (saco/cx). '
  + 'COMPRA = estoque disponível − necessário no horizonte (a soma entre as receitas) + a caminho; negativo (vermelho) = falta. '
  + 'COMPRAR = estoque mínimo + necessário no horizonte − estoque disponível − a caminho, arredondado para cima em '
  + 'apresentações inteiras; abaixo de zero conta 0, e mínimo ou a caminho vazios contam 0. '
  + 'Sem estoque informado ou sem previsão completa, COMPRAR fica —.';

export function corpoDoSaco(
  tipo: string, bruto: string,
): { tipo_cogumelo: string; gramas_por_saco: number | null } | { erro: string } {
  const t = bruto.trim();
  const v = t === '' ? null : Number(t);
  if (v !== null && !(v > 0)) return { erro: 'Peso do saco inválido: informe os gramas (maior que zero), ou deixe vazio.' };
  return { tipo_cogumelo: tipo, gramas_por_saco: v };
}

export function PainelSementeSacoECompras({ sementes, gestor, aoSalvar }: {
  sementes: NecessidadeDeSementesResposta | null; gestor: boolean; aoSalvar: () => void;
}) {
  const toast = useToast();
  const [editSaco, setEditSaco] = useState<Record<string, string>>({});
  const [previstas, setPrevistas] = useState<CompraPrevista[] | null>(null);
  const [editPrev, setEditPrev] = useState<Record<number, string>>({});
  const [salvando, setSalvando] = useState(false);
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    if (gestor) getComprasPrevistas().then(setPrevistas).catch(() => setPrevistas(null));
  }, [gestor, versao]);

  if (!sementes) return null;

  const salvarSaco = (tipo: string) => {
    const bruto = editSaco[tipo];
    if (bruto === undefined) return;
    const corpo = corpoDoSaco(tipo, bruto);
    if ('erro' in corpo) { toast(corpo.erro, true); return; }
    setSalvando(true);
    putSementesParametros(corpo)
      .then(() => {
        toast(`Peso do saco de ${tipo} atualizado.`);
        setEditSaco((prev) => { const n = { ...prev }; delete n[tipo]; return n; });
        aoSalvar();
      })
      .catch((e) => toast(e?.response?.data?.erro ?? e.message, true))
      .finally(() => setSalvando(false));
  };

  const salvarPrevistas = () => {
    if (!previstas) return;
    const itens = previstas.map((p) => ({
      cepa_id: p.cepa_id,
      quantidade: Number(editPrev[p.cepa_id] ?? p.quantidade) || 0,
    }));
    setSalvando(true);
    putComprasPrevistas(itens)
      .then(() => { toast('Compras previstas atualizadas.'); setEditPrev({}); setVersao((v) => v + 1); aoSalvar(); })
      .catch((e) => toast(e?.response?.data?.erro ?? e.message, true))
      .finally(() => setSalvando(false));
  };

  const valor = (v: number | null, fraseDoNulo: string) => (v == null ? fraseDoNulo : num(v, 2));

  return (
    <Panel id="compras-mp-semente" title="SEMENTE: PESO DO SACO E COMPRAS PREVISTAS"
      sub={'As linhas Semente do pedido, em sacos: necessário no horizonte = blocos previstos × g por bloco ÷ g por saco. '
        + 'O g por bloco é o da semente na receita vigente de cada espécie; o estoque é o saldo da tela Sementes; '
        + 'a caminho são as compras previstas por cepa.'}>
      <div className="plan-wrap cp">
        <table className="plan cp">
          <thead>
            <tr>
              <th className="rotulo">Espécie</th>
              <th className="num">g por bloco (da receita)</th>
              <th className="num">g por saco</th>
              <th className="num">blocos no horizonte (da previsão)</th>
              <th className="num">necessário no horizonte (sacos)</th>
            </tr>
          </thead>
          <tbody>
            {sementes.por_tipo.map((t) => (
              <tr key={t.tipo_cogumelo}>
                <td className="rotulo">{t.tipo_cogumelo}</td>
                <td className="num">{valor(t.gramas_por_bloco,
                  t.sem_dado.includes('gramas_por_bloco') ? 'falta a semente na receita' : '—')}</td>
                <td className="num">
                  {gestor ? (
                    <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                      <input className="cell-input" type="number" min={0} step="any" placeholder="não informado"
                        value={editSaco[t.tipo_cogumelo] ?? (t.gramas_por_saco == null ? '' : String(t.gramas_por_saco))}
                        onChange={(e) => setEditSaco({ ...editSaco, [t.tipo_cogumelo]: e.target.value })} />
                      <button className="btn ghost split-btn" disabled={salvando}
                        onClick={() => salvarSaco(t.tipo_cogumelo)}>ok</button>
                    </span>
                  ) : valor(t.gramas_por_saco, 'não informado')}
                </td>
                <td className="num">{t.blocos_previstos_horizonte == null ? 'sem previsão completa' : num(t.blocos_previstos_horizonte)}</td>
                <td className="num">{valor(t.necessidade_horizonte_sacos, '—')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {gestor && previstas && (
        <div style={{ marginTop: 14 }}>
          <div className="fsec">Compras previstas por cepa, em sacos (gestor)</div>
          <div className="form-acao" style={{ marginTop: 10 }}>
            {previstas.map((p) => (
              <div className="fg" key={p.cepa_id} style={{ minWidth: 150 }}>
                <label>{p.cepa}</label>
                <input className="cell-input wide" type="number" min={0}
                  value={editPrev[p.cepa_id] ?? String(p.quantidade)}
                  onChange={(e) => setEditPrev({ ...editPrev, [p.cepa_id]: e.target.value })} />
              </div>
            ))}
            <div className="fg">
              <label>&nbsp;</label>
              <button className="btn ghost" disabled={salvando} onClick={salvarPrevistas}>
                Salvar compras previstas
              </button>
            </div>
          </div>
        </div>
      )}
    </Panel>
  );
}

function textoDeParcela(v: number | null | undefined, fraseDoNulo: string): string {
  if (v === undefined) return '—';
  if (v === null) return fraseDoNulo;
  return fm4(v);
}

export function apresentacoesInteiras(n: number, embalagem: string | null | undefined): string {
  const e = (embalagem ?? '').trim();
  const plural = n !== 1;
  let unidade = e;
  if (e === '') unidade = plural ? 'apresentações' : 'apresentação';
  else if (/^saco$/i.test(e)) unidade = plural ? 'sacos' : 'saco';
  else if (/^caixa$/i.test(e)) unidade = plural ? 'caixas' : 'caixa';
  return `${num(n)} ${unidade}`;
}

function analisarPedidoParaResultado(
  { receitas, pedido_consolidado }: Pick<ComprasMpResposta, 'receitas' | 'pedido_consolidado'>,
) {
  const precoPorMp = new Map(materiasPrimasUnicas(receitas).map((mp) => [mp.materia_prima_id, mp]));
  let itensAComprar = 0;
  let itensEmDia = 0;
  let itensSemEstoqueInformado = 0;
  let itensSemPrevisao = 0;
  let somaReais = 0;
  const nomesSemPreco: string[] = [];
  for (const p of pedido_consolidado) {
    if (p.necessario_total === null) { itensSemPrevisao += 1; continue; }
    if (p.comprar == null) { itensSemEstoqueInformado += 1; continue; }
    if (p.comprar === 0) { itensEmDia += 1; continue; }
    itensAComprar += 1;
    const idDoPreco = p.materia_prima_id ?? p.preco_materia_prima_id;
    const mp = idDoPreco != null ? precoPorMp.get(idDoPreco) : undefined;
    const kgDaApresentacao = p.semente_tipo ? p.kg_por_saco : mp?.apresentacao_kg;
    const precoPorApresentacao = mp?.custo_kg != null && kgDaApresentacao != null
      ? mp.custo_kg * kgDaApresentacao : null;
    if (precoPorApresentacao == null) { nomesSemPreco.push(p.materia_prima); continue; }
    somaReais += p.comprar * precoPorApresentacao;
  }
  return { itensAComprar, itensEmDia, itensSemEstoqueInformado, itensSemPrevisao, nomesSemPreco, somaReais };
}

export function resumoDoPlanejamento(
  dados: Pick<ComprasMpResposta, 'receitas' | 'pedido_consolidado'>,
): {
  producaoPlanejada: number | null; itensAComprar: number; itensSemPreco: number; itensSemEstoqueInformado: number;
  itensSemPrevisao: number; compraNecessariaReais: number | null;
} {
  const producaoPlanejada = dados.receitas.some((r) => r.blocos_previstos == null)
    ? null
    : dados.receitas.reduce((s, r) => s + (r.blocos_previstos ?? 0), 0);
  const {
    itensAComprar, itensSemEstoqueInformado, itensSemPrevisao, nomesSemPreco, somaReais,
  } = analisarPedidoParaResultado(dados);
  const temDado = dados.pedido_consolidado.length > 0;
  const faltaDado = nomesSemPreco.length > 0 || itensSemEstoqueInformado > 0 || itensSemPrevisao > 0
    || producaoPlanejada == null || !temDado;
  return {
    producaoPlanejada,
    itensAComprar,
    itensSemPreco: nomesSemPreco.length,
    itensSemEstoqueInformado,
    itensSemPrevisao,
    compraNecessariaReais: faltaDado ? null : Math.round(somaReais * 100) / 100,
  };
}

export function insumosSemPrecoParaComprar(
  dados: Pick<ComprasMpResposta, 'receitas' | 'pedido_consolidado'>,
): string[] {
  return analisarPedidoParaResultado(dados).nomesSemPreco;
}

export function itensComSaldoPositivo(
  dados: Pick<ComprasMpResposta, 'receitas' | 'pedido_consolidado'>,
): number {
  return analisarPedidoParaResultado(dados).itensEmDia;
}

function frasesDoQueFalta(resumo: {
  itensSemPreco: number; itensSemEstoqueInformado: number; itensSemPrevisao: number;
  producaoPlanejada: number | null;
}): string[] {
  const frases: string[] = [];
  if (resumo.producaoPlanejada == null || resumo.itensSemPrevisao > 0) {
    frases.push('falta a previsão completa (quadro 1)');
  }
  if (resumo.itensSemPreco > 0) {
    frases.push(`faltam ${resumo.itensSemPreco} preço${resumo.itensSemPreco > 1 ? 's' : ''}`);
  }
  if (resumo.itensSemEstoqueInformado > 0) {
    frases.push(`faltam ${resumo.itensSemEstoqueInformado} `
      + `estoque${resumo.itensSemEstoqueInformado > 1 ? 's' : ''} informado${resumo.itensSemEstoqueInformado > 1 ? 's' : ''}`);
  }
  return frases;
}

export function PainelResultadoAnalise({
  receitas, pedidoConsolidado,
}: {
  receitas: CompraMpReceita[];
  pedidoConsolidado: ComprasMpResposta['pedido_consolidado'];
}) {
  const dados = { receitas, pedido_consolidado: pedidoConsolidado };
  const resumo = resumoDoPlanejamento(dados);
  const semPreco = insumosSemPrecoParaComprar(dados);
  const faltando = frasesDoQueFalta(resumo);
  return (
    <Panel title="4. RESULTADO / ANÁLISE"
      sub="O que a cadeia acima produz, junto: a produção prevista no horizonte, quanto falta comprar e quanto isso custa.">
      <div className="kpi-grid k4">
        <Kpi label="Produção planejada (blocos)" value={num(resumo.producaoPlanejada)}
          delta={resumo.producaoPlanejada == null ? 'sem previsão completa (quadro 1)' : undefined} />
        <Kpi label="Itens a comprar" value={num(resumo.itensAComprar)}
          tone={resumo.itensAComprar > 0 ? 'alert' : 'good'} />
        <Kpi label="Compra necessária"
          value={resumo.compraNecessariaReais != null ? brl(resumo.compraNecessariaReais) : '—'}
          delta={faltando.length > 0 ? faltando.join(' e ') : undefined}
          tone={faltando.length > 0 ? 'alert' : undefined} />
        <Kpi label="Itens em dia" value={num(itensComSaldoPositivo(dados))}
          delta="insumos com estoque suficiente" />
      </div>
      {semPreco.length > 0 && (
        <div className="obs-tela aviso-preco-mp">
          Sem preço cadastrado, e por isso fora da conta acima: {semPreco.join(', ')}.
        </div>
      )}
    </Panel>
  );
}

export function precosEditaveis(usuario: { role?: string | null } | null | undefined): boolean {
  return usuario?.role == null || usuario.role === 'GESTAO_GERAL';
}

export function materiasPrimasUnicas(
  receitas: Array<Pick<CompraMpReceita, 'id' | 'ingredientes'>>,
): Array<CompraMpIngrediente & { receitaId: number }> {
  const vistos = new Set<number>();
  const lista: Array<CompraMpIngrediente & { receitaId: number }> = [];
  for (const r of receitas) {
    for (const i of r.ingredientes) {
      if (vistos.has(i.materia_prima_id)) continue;
      vistos.add(i.materia_prima_id);
      lista.push({ ...i, receitaId: r.id });
    }
  }
  return lista;
}

export function chaveDeIngrediente(
  receitaId: number,
  materiaPrimaId: number,
  campo: 'custo_apresentacao' | 'kg_por_receita',
  receitaDoPrecoPorMp: Record<number, number>,
): string {
  const rid = campo === 'custo_apresentacao' ? (receitaDoPrecoPorMp[materiaPrimaId] ?? receitaId) : receitaId;
  return `${rid}:${materiaPrimaId}:${campo}`;
}

export function mpsComPrecoEditado(editIng: Record<string, string>): number[] {
  const ids = new Set<number>();
  for (const chave of Object.keys(editIng)) {
    const [, mpId, campo] = chave.split(':');
    if (campo === 'custo_apresentacao') ids.add(Number(mpId));
  }
  return [...ids];
}

const CHAVE_DATA_PRECO = (materiaPrimaId: number) => `ex_preco_mp_alterado_em:${materiaPrimaId}`;

export function registrarAlteracaoDePreco(
  materiaPrimaId: number,
  hoje: Date = new Date(),
  armazenamento: Pick<Storage, 'setItem'> | undefined = typeof localStorage !== 'undefined' ? localStorage : undefined,
): void {
  armazenamento?.setItem(CHAVE_DATA_PRECO(materiaPrimaId), hojeISO(hoje));
}
export function dataAlteracaoDePreco(
  materiaPrimaId: number,
  armazenamento: Pick<Storage, 'getItem'> | undefined = typeof localStorage !== 'undefined' ? localStorage : undefined,
): string | null {
  return armazenamento?.getItem(CHAVE_DATA_PRECO(materiaPrimaId)) ?? null;
}

export function vigenteTexto(mp: Pick<CompraMpIngrediente, 'custo_kg' | 'custo_kg_base'>): string | null {
  if (mp.custo_kg == null) return null;
  const base = mp.custo_kg_base === 'INFORMADO' ? 'informado' : 'derivado da apresentação';
  return `Valendo agora: R$ ${fm4(mp.custo_kg)}/kg (${base})`;
}

export function PainelPrecosMateriaPrima({
  receitas, gestor, editIng, onEditIng, editCustoPorKg, onEditCustoPorKg,
}: {
  receitas: CompraMpReceita[];
  gestor: boolean;
  editIng: Record<string, string>;
  onEditIng: (receitaId: number, materiaPrimaId: number, campo: 'custo_apresentacao', v: string) => void;
  editCustoPorKg: Record<number, string>;
  onEditCustoPorKg: (materiaPrimaId: number, v: string) => void;
}) {
  const mps = materiasPrimasUnicas(receitas);
  return (
    <Panel id="compras-mp-precos" title="PREÇOS DA MATÉRIA-PRIMA"
      sub="Um preço por insumo: o mesmo campo que já existe dentro de cada cartão de receita, agora num lugar só. Atualize aqui sempre que houver reajuste.">
      {!gestor && (
        <div className="obs-tela">
          Somente GESTÃO GERAL pode alterar o preço da matéria-prima. Os valores abaixo são só leitura.
        </div>
      )}
      <div className="plan-wrap cp">
        <table className="plan cp">
          <thead>
            <tr>
              <th className="rotulo">Matéria-prima</th>
              <th className="num">Apresentação</th>
              <th className="num">Custo por SACO/CAIXA (a apresentação inteira): não o custo por bloco nem por kg</th>
              <th className="num">Custo por KG (para quem compra a granel)</th>
              <th className="num">Última alteração (neste navegador)</th>
            </tr>
          </thead>
          <tbody>
            {mps.map((mp) => {
              const apresentacaoDaria = mp.custo_kg_base === 'INFORMADO'
                ? custoPorKgVigente(
                  { custo_por_kg: null, custo_apresentacao: mp.custo_apresentacao, apresentacao_kg: mp.apresentacao_kg },
                ).valor
                : null;
              const textoVigente = vigenteTexto(mp);
              return (
                <tr key={mp.materia_prima_id}>
                  <td className="rotulo">{mp.materia_prima}</td>
                  <td className="num">
                    {mp.embalagem ?? ''}{mp.apresentacao_kg != null ? ` (${fm4(mp.apresentacao_kg)} kg)` : ''}
                  </td>
                  <td className="num">
                    {gestor ? (
                      <input className="cell-input" type="number" min={0} step="0.01"
                        title="Preço da apresentação INTEIRA (saco/caixa): não o custo por bloco nem por kg."
                        value={editIng[`${mp.receitaId}:${mp.materia_prima_id}:custo_apresentacao`]
                          ?? (mp.custo_apresentacao != null ? String(mp.custo_apresentacao) : '')}
                        onChange={(e) =>
                          onEditIng(mp.receitaId, mp.materia_prima_id, 'custo_apresentacao', e.target.value)} />
                    ) : brl(mp.custo_apresentacao)}
                  </td>
                  <td className="num">
                    {gestor ? (
                      <input className="cell-input" type="number" min={0} step="0.0001"
                        placeholder="quem compra a granel"
                        title="Custo por KG informado diretamente -- para quem compra a granel (a Serragem, por caminhão) e não tem 'saco' para precificar. Quando preenchido, vence o cálculo pela apresentação."
                        value={editCustoPorKg[mp.materia_prima_id]
                          ?? (mp.custo_por_kg != null ? String(mp.custo_por_kg) : '')}
                        onChange={(e) => onEditCustoPorKg(mp.materia_prima_id, e.target.value)} />
                    ) : (mp.custo_por_kg != null ? brl(mp.custo_por_kg) : '—')}
                    {textoVigente && <div className="obs-tela-inline">{textoVigente}</div>}
                    {apresentacaoDaria != null && (
                      <div className="obs-tela-inline" style={{ color: 'var(--ink-soft)' }}>
                        apresentação daria R$ {fm4(apresentacaoDaria)}/kg
                      </div>
                    )}
                  </td>
                  <td className="num">{dataBr(dataAlteracaoDePreco(mp.materia_prima_id)) || 'sem registro nesta tela'}</td>
                </tr>
              );
            })}
            {mps.length === 0 && (
              <tr><td className="rotulo" /><td colSpan={4}><div className="empty">Nenhuma matéria-prima cadastrada ainda.</div></td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="obs-tela aviso-preco-mp">
        Este campo é o preço da apresentação (o saco, por exemplo), não o preço
        por bloco. Confirme a unidade antes de digitar: os dois números
        são diferentes, e o cálculo em R$ sai do valor da apresentação.
      </div>
    </Panel>
  );
}

export const HORIZONTES_OFERECIDOS = [4, 6, 8, 10, 12];

const TETO_BLOCOS_PREVISAO = 1000000;
export const chaveDaCelula = (semana: string, tipo: TipoPrevisao) => `${semana}|${tipo}`;

export function rotuloDaSemana(segunda: string): string {
  const d = new Date(`${segunda}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 6);
  const domingo = d.toISOString().slice(0, 10);
  const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
  return `${dm(segunda)} a ${dm(domingo)}`;
}

export function valorDoServidor(previsao: Pick<PrevisaoResposta, 'linhas'>, semana: string, tipo: TipoPrevisao): string {
  const linha = previsao.linhas.find((l) => l.semana === semana && l.tipo_cogumelo === tipo);
  return linha ? String(linha.blocos) : '';
}

export function valorDaCelula(
  previsao: Pick<PrevisaoResposta, 'linhas'>, edicoes: Record<string, string>, semana: string, tipo: TipoPrevisao,
): string {
  return edicoes[chaveDaCelula(semana, tipo)] ?? valorDoServidor(previsao, semana, tipo);
}

const blocosDaCelula = (t: string): number | null => {
  if (t === '') return null;
  const n = Number(t);
  return Number.isInteger(n) && n >= 0 && n <= TETO_BLOCOS_PREVISAO ? n : null;
};

export function totaisDaGrade(
  previsao: Pick<PrevisaoResposta, 'semanas' | 'tipos' | 'linhas'>, edicoes: Record<string, string>,
): Array<{ tipo: TipoPrevisao; total: number | null; faltam: number; invalidas: number }> {
  return previsao.tipos.map(({ tipo }) => {
    let soma = 0;
    let faltam = 0;
    let invalidas = 0;
    for (const semana of previsao.semanas) {
      const t = valorDaCelula(previsao, edicoes, semana, tipo).trim();
      if (t === '') { faltam += 1; continue; }
      const n = blocosDaCelula(t);
      if (n == null) { invalidas += 1; continue; }
      soma += n;
    }
    return { tipo, total: faltam === 0 && invalidas === 0 ? soma : null, faltam, invalidas };
  });
}

export function textoDoTotal(t: { total: number | null; faltam: number; invalidas: number }): string {
  if (t.invalidas > 0) return t.invalidas === 1 ? '1 valor inválido' : `${t.invalidas} valores inválidos`;
  if (t.faltam > 0) return t.faltam === 1 ? 'falta 1 semana' : `faltam ${t.faltam} semanas`;
  return num(t.total);
}

function celulasAlteradas(previsao: Pick<PrevisaoResposta, 'semanas' | 'tipos' | 'linhas'>, edicoes: Record<string, string>) {
  const saida: Array<{ semana: string; tipo: TipoPrevisao; nome: string; texto: string }> = [];
  for (const semana of previsao.semanas) {
    for (const { tipo, nome } of previsao.tipos) {
      const bruto = edicoes[chaveDaCelula(semana, tipo)];
      if (bruto === undefined) continue;
      const texto = bruto.trim();
      if (texto === valorDoServidor(previsao, semana, tipo)) continue;
      saida.push({ semana, tipo, nome, texto });
    }
  }
  return saida;
}

export function contarCelulasAlteradas(
  previsao: Pick<PrevisaoResposta, 'semanas' | 'tipos' | 'linhas'> | null, edicoes: Record<string, string>,
): number {
  return previsao ? celulasAlteradas(previsao, edicoes).length : 0;
}

export function previsaoDoPayload(
  previsao: Pick<PrevisaoResposta, 'semanas' | 'tipos' | 'linhas'>, edicoes: Record<string, string>,
): PrevisaoItem[] {
  return celulasAlteradas(previsao, edicoes).map(({ semana, tipo, nome, texto }) => {
    if (texto === '') return { semana, tipo_cogumelo: tipo, blocos: null };
    const blocos = blocosDaCelula(texto);
    if (blocos == null) {
      throw new Error(`Previsão inválida em ${nome}, semana ${rotuloDaSemana(semana)}: use um número inteiro `
        + 'de 0 a 1.000.000, ou deixe vazio: nada foi salvo.');
    }
    return { semana, tipo_cogumelo: tipo, blocos };
  });
}

export function PainelPrevisaoProducao({
  previsao, erro, gestor, edicoes, onEditar, onSalvar, onHorizonte, salvando,
}: {
  previsao: PrevisaoResposta | null;
  erro: string;
  gestor: boolean;
  edicoes: Record<string, string>;
  onEditar: (semana: string, tipo: TipoPrevisao, v: string) => void;
  onSalvar: () => void;
  onHorizonte: (semanas: number) => void;
  salvando: boolean;
}) {
  const titulo = '1. QUANTO EU QUERO PRODUZIR?';
  const sub = 'Blocos planejados por semana e por tipo, informados uma vez só. Daqui sai a necessidade de todas as '
    + 'matérias-primas (pela receita que os lotes novos de cada tipo usam) e a das sementes.';
  if (erro) return <Panel title={titulo} sub={sub}><div className="empty">Erro ao carregar a previsão: {erro}</div></Panel>;
  if (!previsao) return <Panel title={titulo} sub={sub}><div className="loading">Carregando a previsão de produção…</div></Panel>;

  const h = previsao.horizonte_semanas;
  const opcoes = HORIZONTES_OFERECIDOS.includes(h) ? HORIZONTES_OFERECIDOS : [...HORIZONTES_OFERECIDOS, h].sort((a, b) => a - b);
  const semanasTexto = (n: number) => `${n} semana${n === 1 ? '' : 's'}`;
  const totais = totaisDaGrade(previsao, edicoes);
  const alteradas = contarCelulasAlteradas(previsao, edicoes);
  return (
    <Panel id="compras-mp-previsao" title={titulo} sub={sub}>
      <div className="form-acao">
        {gestor ? (
          <div className="fg">
            <label htmlFor="previsao-horizonte">Horizonte</label>
            <select id="previsao-horizonte" value={h} disabled={salvando}
              onChange={(e) => onHorizonte(Number(e.target.value))}>
              {opcoes.map((n) => <option key={n} value={n}>{semanasTexto(n)}</option>)}
            </select>
          </div>
        ) : (
          <div className="fg"><span>Horizonte: {semanasTexto(h)}</span></div>
        )}
      </div>
      <div className="obs-tela">
        Célula vazia = não informado. 0 = não vai produzir naquela semana. O total de um tipo só sai com todas as
        semanas do horizonte preenchidas; enquanto faltar semana, o que depende dele (matéria-prima e semente) fica
        sem número.
      </div>
      <div className="plan-wrap cp">
        <table className="plan cp">
          <thead>
            <tr>
              <th className="rotulo">Semana (segunda a domingo)</th>
              {previsao.tipos.map((t) => <th key={t.tipo} className="num">{t.nome}</th>)}
            </tr>
          </thead>
          <tbody>
            {previsao.semanas.map((semana, i) => (
              <tr key={semana}>
                <td className="rotulo">
                  {rotuloDaSemana(semana)}
                  {i === 0 && <small style={{ color: 'var(--ink-soft)' }}> (semana atual)</small>}
                </td>
                {previsao.tipos.map((t) => (
                  <td key={t.tipo} className="num">
                    <input className="cell-input" type="number" min={0} step={1} placeholder="não informado"
                      aria-label={`${t.nome}, semana ${rotuloDaSemana(semana)}`}
                      value={valorDaCelula(previsao, edicoes, semana, t.tipo)}
                      onChange={(e) => onEditar(semana, t.tipo, e.target.value)} />
                  </td>
                ))}
              </tr>
            ))}
            <tr className="ln-destaque">
              <td className="rotulo">TOTAL</td>
              {totais.map((t) => (
                <td key={t.tipo} className="num total">{textoDoTotal(t)}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <div className="export-bar">
        <button className="btn" disabled={salvando || alteradas === 0} onClick={onSalvar}>
          {alteradas > 0
            ? `Salvar previsão (${alteradas} célula${alteradas > 1 ? 's' : ''} não salva${alteradas > 1 ? 's' : ''})`
            : 'Salvar previsão'}
        </button>
      </div>
    </Panel>
  );
}

export function textoPrevisaoDaReceita(r: Pick<CompraMpReceita, 'blocos_previstos' | 'tipo_previsao'>): string {
  if (r.tipo_previsao == null) return 'fora da previsão (não é a receita usada pelos lotes novos)';
  if (r.blocos_previstos == null) return 'Blocos previstos no horizonte: sem previsão completa';
  return `Blocos previstos no horizonte: ${num(r.blocos_previstos)}`;
}

export function ComprasMateriaPrima() {
  const [versao, setVersao] = useState(0);
  return (
    <>
      <TopoOperacional key={versao} dominio="MATERIA_PRIMA" id="compras-mp-cobertura" titulo="Ações do dia: Matéria-prima">
        {(d) => <BlocoCoberturaMateriaPrima materiaPrima={d.materia_prima} />}
      </TopoOperacional>
      <CorpoComprasMateriaPrima aoSalvar={() => setVersao((v) => v + 1)} />
    </>
  );
}

function CorpoComprasMateriaPrima({ aoSalvar }: { aoSalvar: () => void }) {
  const { usuario } = useAuth();
  const gestor = precosEditaveis(usuario);
  const toast = useToast();

  const [dados, setDados] = useState<ComprasMpResposta | null>(null);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [previsao, setPrevisao] = useState<PrevisaoResposta | null>(null);
  const [erroPrevisao, setErroPrevisao] = useState('');
  const [editPrevisao, setEditPrevisao] = useState<Record<string, string>>({});
  const [editPesoBloco, setEditPesoBloco] = useState<Record<number, string>>({});
  const [editEstoque, setEditEstoque] = useState<Record<number, string>>({});
  const [editIng, setEditIng] = useState<Record<string, string>>({});
  const [editEmb, setEditEmb] = useState<Record<string, string>>({});
  const [editEmTransito, setEditEmTransito] = useState<Record<number, string>>({});
  const [editCustoPorKg, setEditCustoPorKg] = useState<Record<number, string>>({});
  const [editEstoqueMinimo, setEditEstoqueMinimo] = useState<Record<number, string>>({});

  const recarregar = useCallback((limparEdicoes = true) => {
    setErro('');
    getComprasMp()
      .then((d) => {
        setDados(d);
        if (limparEdicoes) {
          setEditPesoBloco({});
          setEditEstoque({}); setEditIng({}); setEditEmb({}); setEditEmTransito({}); setEditCustoPorKg({});
          setEditEstoqueMinimo({});
        }
      })
      .catch((e) => setErro(e?.response?.data?.erro ?? e.message));
  }, []);
  const recarregarPrevisao = useCallback(() => {
    setErroPrevisao('');
    getPrevisao().then(setPrevisao)
      .catch((e) => setErroPrevisao(e?.response?.data?.erro ?? e.message));
  }, []);
  useEffect(() => { recarregar(); recarregarPrevisao(); }, [recarregar, recarregarPrevisao]);

  const pendencias = contarPendencias({
    pesoBloco: editPesoBloco,
    estoque: editEstoque, ingrediente: editIng, embalagem: editEmb, emTransito: editEmTransito,
    estoqueMinimo: editEstoqueMinimo, custoPorKg: editCustoPorKg,
  });
  const pendenciasPrevisao = contarCelulasAlteradas(previsao, editPrevisao);
  const pendenciasTotais = pendencias + pendenciasPrevisao;

  useEffect(() => {
    if (pendenciasTotais === 0) return undefined;
    const avisar = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', avisar);
    return () => window.removeEventListener('beforeunload', avisar);
  }, [pendenciasTotais]);

  if (erro) return <div className="empty">Erro: {erro}</div>;
  if (!dados) return <div className="loading">Carregando compras de matéria-prima…</div>;

  const salvarTudo = async () => {
    setSalvando(true);
    try {
      const pesosBloco = pesosBlocoDoPayload(editPesoBloco);
      const estoques = estoquesDoPayload(editEstoque);
      const embalagens = embalagensDoPayload(editEmb);
      const emTransito = emTransitoDoPayload(editEmTransito);
      const custosPorKg = custoPorKgDoPayload(editCustoPorKg);
      const ingredientes = ingredientesDoPayload(editIng);
      const estoquesMinimos = estoqueMinimoDoPayload(editEstoqueMinimo);
      for (const p of estoques) await putComprasMpEstoque(p);
      for (const p of emTransito) await putComprasMpEmTransito(p);
      for (const p of ingredientes) {
        await putComprasMpIngrediente({
          receitaId: p.receitaId, materiaPrimaId: p.materiaPrimaId, [p.campo]: p.valor,
        });
      }
      for (const p of embalagens) await putComprasMpEmbalagem(p.id, p.body);
      for (const p of pesosBloco) await putComprasMpPesoBloco(p);
      for (const p of custosPorKg) await putComprasMpCustoPorKg(p);
      for (const p of estoquesMinimos) await salvarEstoqueMinimoMp(p);
      for (const mpId of mpsComPrecoEditado(editIng)) registrarAlteracaoDePreco(mpId);
      toast('Inventário salvo: colunas recalculadas.');
      recarregar();
      aoSalvar();
    } catch (e) {
      const err = e as { response?: { data?: { erro?: string } }; message: string };
      toast(err.response?.data?.erro ?? err.message, true);
    } finally {
      setSalvando(false);
    }
  };

  const salvarGradePrevisao = () => {
    if (!previsao) return;
    let itens: PrevisaoItem[];
    try {
      itens = previsaoDoPayload(previsao, editPrevisao);
    } catch (e) {
      toast((e as Error).message, true);
      return;
    }
    if (itens.length === 0) return;
    setSalvando(true);
    salvarPrevisao(itens)
      .then((nova) => {
        toast('Previsão salva: necessidade de matéria-prima e de sementes recalculada.');
        setPrevisao(nova);
        setEditPrevisao({});
        recarregar(false);
        aoSalvar();
      })
      .catch((e) => toast(e?.response?.data?.erro ?? e.message, true))
      .finally(() => setSalvando(false));
  };

  const mudarHorizonte = (semanas: number) => {
    setSalvando(true);
    putMetaOperacional({ chave: CHAVE_HORIZONTE_PREVISAO, valor: semanas })
      .then(() => {
        toast(`Horizonte da previsão: ${semanas} semanas. Grade e compras recalculadas.`);
        recarregarPrevisao();
        recarregar(false);
        aoSalvar();
      })
      .catch((e) => toast(e?.response?.data?.erro ?? e.message, true))
      .finally(() => setSalvando(false));
  };

  const salvarPesoBloco = (receitaId: number) => {
    const bruto = editPesoBloco[receitaId];
    if (bruto === undefined) return;
    let corpo: { receitaId: number; pesoBlocoKg: number | null };
    try {
      [corpo] = pesosBlocoDoPayload({ [receitaId]: bruto });
    } catch (e) {
      toast((e as Error).message, true);
      return;
    }
    setSalvando(true);
    putComprasMpPesoBloco(corpo)
      .then(() => {
        toast('Peso do bloco atualizado.');
        setEditPesoBloco((prev) => semChaveSalva(prev, receitaId));
        recarregar(false);
        aoSalvar();
      })
      .catch((e) => toast(e?.response?.data?.erro ?? e.message, true))
      .finally(() => setSalvando(false));
  };

  const receitaDoPrecoPorMp: Record<number, number> = Object.fromEntries(
    materiasPrimasUnicas(dados.receitas).map((m) => [m.materia_prima_id, m.receitaId]),
  );

  return (
    <div className="plan-stack">
      <div className="export-bar">
        <button className="btn" disabled={salvando || pendencias === 0} onClick={salvarTudo}>
          {salvando ? 'Salvando…'
            : pendencias > 0 ? `Salvar inventário de estoque (${pendencias} não salva${pendencias > 1 ? 's' : ''})`
              : 'Salvar inventário de estoque'}
        </button>
        {pendencias > 0 && (
          <span className="aviso-pendente" role="status">
            O que você digitou ainda não foi para o banco. Recarregar a página perde.
          </span>
        )}
        <BotaoExportar rotulo="Exportar Excel" />
      </div>

      <PainelPrevisaoProducao previsao={previsao} erro={erroPrevisao} gestor={gestor}
        edicoes={editPrevisao} salvando={salvando}
        onEditar={(semana, tipo, v) => setEditPrevisao({ ...editPrevisao, [chaveDaCelula(semana, tipo)]: v })}
        onSalvar={salvarGradePrevisao} onHorizonte={mudarHorizonte} />

      <PainelPedidoConsolidado receitas={dados.receitas} pedidoConsolidado={dados.pedido_consolidado}
        editEmTransito={editEmTransito}
        onEditEmTransito={(mpId, v) => setEditEmTransito({ ...editEmTransito, [mpId]: v })}
        editEstoqueMinimo={editEstoqueMinimo}
        onEditEstoqueMinimo={(mpId, v) => setEditEstoqueMinimo({ ...editEstoqueMinimo, [mpId]: v })} />

      <PainelSementeSacoECompras sementes={dados.sementes} gestor={gestor}
        aoSalvar={() => { recarregar(false); aoSalvar(); }} />

      <PainelResultadoAnalise receitas={dados.receitas} pedidoConsolidado={dados.pedido_consolidado} />

      <PainelPrecosMateriaPrima receitas={dados.receitas} gestor={gestor} editIng={editIng}
        onEditIng={(receitaId, mpId, campo, v) =>
          setEditIng({ ...editIng, [chaveDeIngrediente(receitaId, mpId, campo, receitaDoPrecoPorMp)]: v })}
        editCustoPorKg={editCustoPorKg}
        onEditCustoPorKg={(mpId, v) => setEditCustoPorKg({ ...editCustoPorKg, [mpId]: v })} />

      {dados.receitas.map((r) => (
        <details key={r.id}>
          <summary>{tituloDoCartao(r)} · {textoPrevisaoDaReceita(r)}</summary>
          <CartaoReceita receita={r} gestor={gestor} salvando={salvando}
            editPesoBloco={editPesoBloco[r.id] ?? (r.peso_bloco_kg != null ? String(r.peso_bloco_kg) : '')}
            onEditPesoBloco={(v) => setEditPesoBloco({ ...editPesoBloco, [r.id]: v })}
            onSalvarPesoBloco={() => salvarPesoBloco(r.id)}
            editEstoque={editEstoque}
            onEditEstoque={(mpId, v) => setEditEstoque({ ...editEstoque, [mpId]: v })}
            editIng={editIng}
            receitaDoPrecoPorMp={receitaDoPrecoPorMp}
            onEditIng={(mpId, campo, v) =>
              setEditIng({ ...editIng, [chaveDeIngrediente(r.id, mpId, campo, receitaDoPrecoPorMp)]: v })} />
        </details>
      ))}

      <Panel title="Embalagens"
        sub="Itens de embalagem com estoque mínimo: Comprar se negativo = disponível − mínimo">
        <div className="plan-wrap cp">
          <table className="plan cp">
            <thead>
              <tr>
                <th className="rotulo">Item</th>
                <th className="num">Estoque disponível</th>
                <th className="num">Estoque mínimo</th>
                <th className="num">Comprar se negativo</th>
                <th className="num">Unidade</th>
              </tr>
            </thead>
            <tbody>
              {dados.embalagens.map((e) => (
                <tr key={e.id}>
                  <td className="rotulo">{e.nome}</td>
                  <td className="num">
                    <input className="cell-input" type="number" min={0} step="0.01"
                      value={editEmb[`${e.id}:disp`] ?? (e.estoque_disponivel != null ? String(e.estoque_disponivel) : '')}
                      onChange={(ev) => setEditEmb({ ...editEmb, [`${e.id}:disp`]: ev.target.value })} />
                  </td>
                  <td className="num">
                    {gestor ? (
                      <input className="cell-input" type="number" min={0} step="0.01"
                        value={editEmb[`${e.id}:min`] ?? (e.estoque_minimo != null ? String(e.estoque_minimo) : '')}
                        onChange={(ev) => setEditEmb({ ...editEmb, [`${e.id}:min`]: ev.target.value })} />
                    ) : fm4(e.estoque_minimo)}
                  </td>
                  <td className={`num total ${(e.comprar ?? 0) < 0 ? 'neg' : ''}`}>{fm4(e.comprar)}</td>
                  <td className="num">{e.unidade ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="obs-tela">
          Melhoria vs planilha: o estoque disponível é informado UMA vez por
          matéria-prima e o mesmo valor aparece em todos os cartões de receita (a planilha
          fragmenta o campo por receita, o que permitia valores divergentes do mesmo
          insumo). Rotina semanal: conferir a previsão de produção (quadro 1)
          e a coluna estoque disponivel ao inventariar. A coluna COMPRAR do PEDIDO DE
          COMPRAS diz quanto comprar de cada insumo, em apresentações inteiras.
        </div>
      </Panel>
    </div>
  );
}

export function CartaoReceita({
  receita, gestor, salvando,
  editPesoBloco, onEditPesoBloco, onSalvarPesoBloco,
  editEstoque, onEditEstoque, editIng, onEditIng, receitaDoPrecoPorMp = {},
}: {
  receita: CompraMpReceita;
  gestor: boolean;
  salvando: boolean;
  editPesoBloco: string;
  onEditPesoBloco: (v: string) => void;
  onSalvarPesoBloco: () => void;
  editEstoque: Record<number, string>;
  onEditEstoque: (mpId: number, v: string) => void;
  editIng: Record<string, string>;
  onEditIng: (mpId: number, campo: 'custo_apresentacao' | 'kg_por_receita', v: string) => void;
  receitaDoPrecoPorMp?: Record<number, number>;
}) {
  const ing = (mpId: number, campo: 'custo_apresentacao' | 'kg_por_receita') =>
    editIng[chaveDeIngrediente(receita.id, mpId, campo, receitaDoPrecoPorMp)];
  return (
    <Panel title={tituloDoCartao(receita)}
      tag={`Qtde por receita: ${num(receita.blocos_por_receita)} blocos, observado: `
        + `${num(receita.rendimento_observado, 2)} (${receita.lotes_medidos} lote(s))`}
      sub="Colunas idênticas às da planilha: COMPRA em vermelho = comprar">
      <div className="form-acao">
        <div className="fg" style={{ minWidth: 210 }}>
          <label>Previsão de produção (quadro 1)</label>
          <span className="previsao-da-receita">{textoPrevisaoDaReceita(receita)}</span>
        </div>
        <div className="fg" style={{ minWidth: 210 }}>
          <label htmlFor={`peso-bloco-${receita.id}`}>Peso do bloco (kg)</label>
          <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
            <input id={`peso-bloco-${receita.id}`} className="cell-input wide" type="number" min={0}
              step="0.001" placeholder="vazio = não informado"
              title="Peso do bloco pronto, em kg (2,0 / 1,5…): interfere direto no consumo de matéria-prima. Deixe vazio se ninguém informou."
              value={editPesoBloco}
              onChange={(e) => onEditPesoBloco(e.target.value)} />
            <button className="btn ghost split-btn" disabled={salvando} onClick={onSalvarPesoBloco}>ok</button>
          </span>
        </div>
      </div>
      <div className="plan-wrap cp">
        <table className="plan cp">
          <thead>
            <tr>
              <th className="rotulo">{COLUNAS[0]}</th>
              {COLUNAS.slice(1).map((c) => <th key={c} className="num">{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {receita.ingredientes.map((i) => (
              <tr key={i.materia_prima_id}>
                <td className="rotulo">{i.materia_prima}</td>
                <td className="num">{i.ncm ?? ''}</td>
                <td className="num">{i.embalagem ?? ''}</td>
                <td className="num">{fm4(i.apresentacao_kg)}</td>
                <td className="num">
                  {gestor ? (
                    <input className="cell-input" type="number" min={0} step="0.01"
                      value={ing(i.materia_prima_id, 'custo_apresentacao')
                        ?? (i.custo_apresentacao != null ? String(i.custo_apresentacao) : '')}
                      onChange={(e) => onEditIng(i.materia_prima_id, 'custo_apresentacao', e.target.value)} />
                  ) : brl(i.custo_apresentacao)}
                </td>
                <td className="num">{i.custo_kg != null ? brl(i.custo_kg) : ''}</td>
                <td className="num">
                  {gestor ? (
                    <input className="cell-input" type="number" min={0} step="0.1"
                      value={ing(i.materia_prima_id, 'kg_por_receita')
                        ?? (i.kg_por_receita != null ? String(i.kg_por_receita) : '')}
                      onChange={(e) => onEditIng(i.materia_prima_id, 'kg_por_receita', e.target.value)} />
                  ) : fm4(i.kg_por_receita)}
                </td>
                <td className="num">{i.valor_por_receita != null ? brl(i.valor_por_receita) : ''}</td>
                <td className="num">{fm4(i.kg_por_bloco)}</td>
                <td className="num">{fm4(i.necessario_kg)}</td>
                <td className="num" title={i.custo_kg_base === 'INFORMADO'
                  ? 'Custo informado por KG (compra a granel): esta matéria-prima não é comprada por apresentação/saco.' : undefined}>
                  {i.custo_kg_base === 'INFORMADO' ? '—' : fm4(i.necessario_apresentacao)}
                </td>
                <td className="num">
                  <input className="cell-input" type="number" min={0} step="0.01"
                    title="Estoque em apresentações (sacos/cx): valor único por matéria-prima, refletido em todos os cartões"
                    value={editEstoque[i.materia_prima_id]
                      ?? (i.estoque_disponivel != null ? String(i.estoque_disponivel) : '')}
                    onChange={(e) => onEditEstoque(i.materia_prima_id, e.target.value)} />
                </td>
                <td className={`num total ${(i.compra ?? 0) < 0 ? 'neg' : ''}`}>{fm4(i.compra)}</td>
              </tr>
            ))}
            <tr className="ln-grupo">
              <td className="rotulo">custo por bloco (kg)</td>
              <td className="num" colSpan={7} />
              <td className="num total">{fm4(receita.custo_por_bloco_kg)}</td>
              <td className="num" colSpan={4} />
            </tr>
            <tr className="ln-grupo">
              <td className="rotulo">
                custo por bloco (R$)
                {receita.ingredientes_sem_preco.length > 0 && (
                  <div>
                    <small style={{ color: 'var(--ink-soft)' }}>
                      sem preço: {receita.ingredientes_sem_preco.join(', ')}
                    </small>
                  </div>
                )}
              </td>
              <td className="num" colSpan={6} />
              <td className="num">
                {receita.valor_por_receita != null ? brl(receita.valor_por_receita) : '—'}
              </td>
              <td className="num total">
                {receita.custo_por_bloco_reais != null ? brl(receita.custo_por_bloco_reais) : '—'}
              </td>
              <td className="num" colSpan={4} />
            </tr>
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
