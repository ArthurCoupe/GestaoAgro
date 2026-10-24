const DIA = 86400000;
const deslocar = (iso, dias) => new Date(Date.parse(`${iso}T00:00:00Z`) + dias * DIA).toISOString().slice(0, 10);
const SEM = '—';

export const JANELAS_DE_COMPARACAO = [30, 15];

const porOrdem = (a, b) => (b.atual - a.atual) || (b.anterior - a.anterior)
  || String(a.chave).localeCompare(String(b.chave), 'pt', { numeric: true });

function ranking(mapa, limite) {
  const todos = [...mapa.values()].sort(porOrdem);
  const resto = todos.slice(limite);
  return {
    itens: todos.slice(0, limite),
    demais: resto.length === 0 ? null : {
      quantidade: resto.length,
      atual: resto.reduce((s, i) => s + i.atual, 0),
      anterior: resto.reduce((s, i) => s + i.anterior, 0),
    },
  };
}

/**
 * @param {{lotes: Array, eventos: Array}} dados
 * @param {{hoje: string, dias: number, idsNoEscopo?: Set, fisicaPorLote?: Map, limite?: number}} opcoes
 */
export function contaminacaoPorPeriodo(dados = {}, opcoes = {}) {
  const { hoje, dias, idsNoEscopo = null, fisicaPorLote = null, limite = 10 } = opcoes;
  const atual = { inicio: deslocar(hoje, -(dias - 1)), fim: hoje };
  const anterior = { inicio: deslocar(hoje, -(2 * dias - 1)), fim: deslocar(hoje, -dias) };
  const ladoDe = (d) => (d >= atual.inicio && d <= atual.fim ? 'atual'
    : d >= anterior.inicio && d <= anterior.fim ? 'anterior' : null);

  const loteDe = new Map((dados.lotes ?? []).map((l) => [l.id, l]));
  const totais = {
    atual: { blocos: 0, lancamentos: 0, dias: new Set() },
    anterior: { blocos: 0, lancamentos: 0, dias: new Set() },
  };
  const galpoes = new Map();
  const estantes = new Map();
  const lotes = new Map();
  const somar = (mapa, chave, base, lado, q) => {
    if (!mapa.has(chave)) mapa.set(chave, { chave, ...base, atual: 0, anterior: 0 });
    const item = mapa.get(chave);
    item[lado] += q;
    return item;
  };
  let ultimo = null;

  for (const e of dados.eventos ?? []) {
    if (e.tipo !== 'CONTAMINACAO' || !e.data_evento) continue;
    if (idsNoEscopo && !idsNoEscopo.has(e.lote_id)) continue;
    if (e.data_evento <= hoje && (ultimo === null || e.data_evento > ultimo)) ultimo = e.data_evento;
    const lado = ladoDe(e.data_evento);
    if (!lado) continue;

    const q = Number(e.quantidade) || 0;
    const l = loteDe.get(e.lote_id);
    const galpao = l?.galpao ?? SEM;
    const estante = l?.estante_maturacao ?? SEM;
    const fisica = fisicaPorLote?.get(e.lote_id) ?? null;

    totais[lado].blocos += q;
    totais[lado].lancamentos += 1;
    totais[lado].dias.add(e.data_evento);
    somar(galpoes, galpao, { galpao }, lado, q);
    somar(estantes, `${galpao}|${estante}|${fisica ?? ''}`, { galpao, estante, estante_fisica: fisica }, lado, q);
    const chaveLote = l ? `${l.data_lote}|${l.tipo}` : SEM;
    const itemLote = somar(lotes, chaveLote, { data_lote: l?.data_lote ?? null, tipo: l?.tipo ?? null, galpoes: [] }, lado, q);
    if (l?.galpao && !itemLote.galpoes.includes(l.galpao)) itemLote.galpoes.push(l.galpao);
  }

  const fechar = (t, janela) => ({ ...janela, blocos: t.blocos, lancamentos: t.lancamentos, dias_com_retirada: t.dias.size });
  for (const item of lotes.values()) item.galpoes.sort();
  return {
    dias,
    atual: fechar(totais.atual, atual),
    anterior: fechar(totais.anterior, anterior),
    diferenca: totais.atual.blocos - totais.anterior.blocos,
    variacao: totais.anterior.blocos > 0
      ? (totais.atual.blocos - totais.anterior.blocos) / totais.anterior.blocos : null,
    ultimo_lancamento: ultimo,
    galpoes: ranking(galpoes, Infinity),
    estantes: ranking(estantes, limite),
    lotes: ranking(lotes, limite),
  };
}
