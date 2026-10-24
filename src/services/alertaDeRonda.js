import { PARAMETROS } from './parametrosDoPainel.js';

const razao = (a, b) => (Number.isFinite(a) && Number.isFinite(b) && b > 0 ? a / b : null);

const DIA = 86400000;
const diasEntre = (de, ate) => {
  const a = Date.parse(`${de}T00:00:00Z`);
  const b = Date.parse(`${ate}T00:00:00Z`);
  return (Number.isFinite(a) && Number.isFinite(b)) ? Math.round((b - a) / DIA) : null;
};

const dataBr = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : iso);
const pctBr = (f) => (Number.isFinite(f) ? `${Math.round(f * 1000) / 10}%` : '—');

function fraseDaRonda({ estante, galpao, loteId, dataRonda, blocosNaRonda, pctDaRonda }) {
  const onde = estante != null ? `estante ${estante}` : `lote #${loteId}`;
  const galpaoTxt = galpao ? ` (galpão ${galpao})` : '';
  return `A ${onde}${galpaoTxt} teve ${blocosNaRonda} bloco(s) retirado(s) por contaminação `
    + `em uma única ronda, em ${dataBr(dataRonda)}: ${pctBr(pctDaRonda)} do que essa estante `
    + 'produziu nesse lançamento.';
}

/**
 * @param {{lotes: Array, colheitas?: Array, eventos: Array}} dados
 * @param {{hoje?: string, parametros?: object}} opcoes
 * @returns {Array}
 */
export function alertasDeRonda(dados = {}, opcoes = {}) {
  const { lotes = [], eventos = [] } = dados;
  const { hoje, parametros = PARAMETROS, filtro = {} } = opcoes;

  const doEscopo = (l) => !!l && (!filtro.tipo || l.tipo === filtro.tipo);
  const loteDe = new Map(lotes.filter(doEscopo).map((l) => [l.id, l]));

  const acumuladoPorEstante = new Map();
  for (const e of eventos) {
    if (e.tipo !== 'CONTAMINACAO') continue;
    acumuladoPorEstante.set(e.lote_id, (acumuladoPorEstante.get(e.lote_id) ?? 0) + Number(e.quantidade ?? 0));
  }

  const porRonda = new Map();
  for (const e of eventos) {
    if (e.tipo !== 'CONTAMINACAO' || !e.data_evento) continue;
    if (!loteDe.has(e.lote_id)) continue;
    const chave = `${e.lote_id}|${e.data_evento}`;
    if (!porRonda.has(chave)) porRonda.set(chave, { lote_id: e.lote_id, data_ronda: e.data_evento, blocos_na_ronda: 0 });
    porRonda.get(chave).blocos_na_ronda += Number(e.quantidade ?? 0);
  }

  const produzidosDe = (l) => ((l && l.blocos_produzidos != null) ? Number(l.blocos_produzidos) : null);
  const acumuladoDe = (l) => razao(acumuladoPorEstante.get(l.id) ?? 0, produzidosDe(l));

  const estantesDoLote = new Map();
  for (const l of loteDe.values()) {
    const chave = `${l.data_lote}|${l.tipo}`;
    if (!estantesDoLote.has(chave)) estantesDoLote.set(chave, []);
    estantesDoLote.get(chave).push(l);
  }
  const outrasEstantes = (l) => (estantesDoLote.get(`${l.data_lote}|${l.tipo}`) ?? [])
    .filter((o) => o.id !== l.id)
    .map((o) => ({ lote_id: o.id, galpao: o.galpao ?? null, estante: o.estante_maturacao ?? null, pct_acumulado: acumuladoDe(o) }))
    .sort((a, b) => String(a.galpao ?? '').localeCompare(String(b.galpao ?? ''), 'pt-BR', { numeric: true })
      || String(a.estante ?? '').localeCompare(String(b.estante ?? ''), 'pt-BR', { numeric: true }));

  return [...porRonda.values()]
    .map((r) => {
      const l = loteDe.get(r.lote_id);
      const produzidos = produzidosDe(l);
      const pctDaRonda = razao(r.blocos_na_ronda, produzidos);
      const pctAcumulado = razao(acumuladoPorEstante.get(r.lote_id) ?? 0, produzidos);
      return {
        lote_id: r.lote_id,
        galpao: l?.galpao ?? null,
        estante: l?.estante_maturacao ?? null,
        data_lote: l?.data_lote ?? null,
        tipo: l?.tipo ?? null,
        data_ronda: r.data_ronda,
        blocos_na_ronda: r.blocos_na_ronda,
        blocos_produzidos: produzidos,
        pct_da_ronda: pctDaRonda,
        pct_acumulado: pctAcumulado,
        limite: parametros.contaminacaoRondaPct,
        outras_estantes: l ? outrasEstantes(l) : [],
        dias_desde: hoje ? diasEntre(r.data_ronda, hoje) : null,
        frase: fraseDaRonda({
          estante: l?.estante_maturacao ?? null, galpao: l?.galpao ?? null, loteId: r.lote_id,
          dataRonda: r.data_ronda, blocosNaRonda: r.blocos_na_ronda, pctDaRonda,
        }),
      };
    })
    .filter((r) => r.pct_da_ronda != null && r.pct_da_ronda >= parametros.contaminacaoRondaPct)
    .sort((a, b) => b.pct_da_ronda - a.pct_da_ronda);
}
