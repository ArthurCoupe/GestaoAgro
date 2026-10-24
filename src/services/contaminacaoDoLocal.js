import { ocupacaoNoPeriodo } from './ocupacaoDasEstantes.js';

const SEM = '—';
const porTaxa = (a, b) => ((b.taxa ?? -1) - (a.taxa ?? -1)) || (b.contaminados - a.contaminados)
  || String(a.chave).localeCompare(String(b.chave), 'pt', { numeric: true });

export function contaminacaoDoLocal(dados = {}, opcoes = {}) {
  const {
    inicio, fim, idsNoEscopo = null, fisicaPorLote = null, comDivergencia = null, taxaDoLotePorChave = null,
  } = opcoes;
  const { dias, porLinha } = ocupacaoNoPeriodo(dados, { inicio, fim, idsNoEscopo });

  const idsConhecidos = new Set((dados.lotes ?? []).map((l) => l.id));
  const idsPesquisa = new Set((dados.lotes ?? []).filter((l) => l.lote_pesquisa === true).map((l) => l.id));
  const contaminadosPorLinha = new Map();
  let ultimo = null;
  let semLoteContaminados = 0;
  let semLoteEventos = 0;
  let pesquisaContaminados = 0;
  let pesquisaEventos = 0;
  for (const e of dados.eventos ?? []) {
    if (e.tipo !== 'CONTAMINACAO' || !e.data_evento) continue;
    if (e.data_evento < inicio || e.data_evento > fim) continue;
    const quantidade = Number(e.quantidade) || 0;
    const conhecido = e.lote_id != null && idsConhecidos.has(e.lote_id);
    if (!conhecido) {
      semLoteContaminados += quantidade;
      semLoteEventos += 1;
      if (ultimo == null || e.data_evento > ultimo) ultimo = e.data_evento;
      continue;
    }
    if (idsPesquisa.has(e.lote_id)) {
      pesquisaContaminados += quantidade;
      pesquisaEventos += 1;
      continue;
    }
    if (idsNoEscopo && !idsNoEscopo.has(e.lote_id)) continue;
    contaminadosPorLinha.set(e.lote_id, (contaminadosPorLinha.get(e.lote_id) ?? 0) + quantidade);
    if (ultimo == null || e.data_evento > ultimo) ultimo = e.data_evento;
  }

  const estantes = new Map();
  const galpoes = new Map();
  const lotes = new Map();
  const acumular = (mapa, chave, base, x) => {
    if (!mapa.has(chave)) mapa.set(chave, { chave, ...base, contaminados: 0, bloco_dias: 0, divergencia: false });
    const a = mapa.get(chave);
    a.contaminados += x.contaminados;
    a.bloco_dias += x.bloco_dias;
    a.divergencia = a.divergencia || x.divergencia;
  };
  for (const l of dados.lotes ?? []) {
    if (l.lote_pesquisa === true) continue;
    const ocup = porLinha.get(l.id);
    const contaminados = contaminadosPorLinha.get(l.id) ?? 0;
    if (!ocup && contaminados === 0) continue;
    const galpao = l.galpao ?? SEM;
    const estante = l.estante_maturacao ?? SEM;
    const fisica = fisicaPorLote?.get(l.id) ?? null;
    const x = {
      contaminados,
      bloco_dias: ocup?.bloco_dias ?? 0,
      divergencia: Boolean(comDivergencia?.has(l.id)) || Boolean(ocup?.saldo_negativo) || Boolean(ocup?.incompleto),
    };
    acumular(estantes, `${galpao}|${estante}|${fisica ?? ''}`, { galpao, estante, estante_fisica: fisica }, x);
    acumular(galpoes, galpao, { galpao }, x);
    acumular(lotes, `${l.data_lote}|${l.tipo}`, { data_lote: l.data_lote ?? null, tipo: l.tipo ?? null }, x);
  }

  const fechar = (a) => {
    const ocupacao_media = dias > 0 ? a.bloco_dias / dias : 0;
    return { ...a, ocupacao_media, taxa: ocupacao_media > 0 ? a.contaminados / ocupacao_media : null };
  };
  const listaDeEstantes = [...estantes.values()].map(fechar);
  const listaDeGalpoes = [...galpoes.values()].map(fechar).map((g) => ({
    ...g, estantes: listaDeEstantes.filter((e) => e.galpao === g.galpao).sort(porTaxa),
  })).sort(porTaxa);
  const total = fechar({
    chave: 'TOTAL',
    contaminados: listaDeGalpoes.reduce((s, g) => s + g.contaminados, 0),
    bloco_dias: listaDeGalpoes.reduce((s, g) => s + g.bloco_dias, 0),
    divergencia: listaDeGalpoes.some((g) => g.divergencia),
  });
  const listaDeLotes = [...lotes.values()].map(fechar)
    .filter((l) => l.contaminados > 0)
    .map((l) => ({ ...l, taxa_do_lote: taxaDoLotePorChave?.get(l.chave) ?? null }))
    .sort((a, b) => (b.contaminados - a.contaminados) || String(b.data_lote).localeCompare(String(a.data_lote)))
    .slice(0, 10);
  return {
    inicio, fim, dias, ultimo_lancamento: ultimo, total, galpoes: listaDeGalpoes, lotes: listaDeLotes,
    sem_lote: { contaminados: semLoteContaminados, eventos: semLoteEventos },
    pesquisa: { contaminados: pesquisaContaminados, eventos: pesquisaEventos },
  };
}
