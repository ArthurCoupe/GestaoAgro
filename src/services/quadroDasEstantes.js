import { filaDeAbertura } from './previsaoDeAbertura.js';

const etiq = (v) => (v == null ? '' : String(v).trim());
const capacidade = (v) => (v == null || v === '' || !Number.isInteger(Number(v)) || Number(v) <= 0 ? null : Number(v));
const ordemNumerica = (a, b) => (Number(a) - Number(b)) || a.localeCompare(b);

export const chaveDaEstante = (v) => {
  const e = etiq(v);
  return /^\d+$/.test(e) ? e.replace(/^0+(?=\d)/, '') : e;
};

/**
 * @param {{lotes?:Array, eventos?:Array, aberturasPorLote?:Array}} dados
 * @param {string} hoje
 */
export function ultimosLancamentosDaMaturacao(dados, hoje) {
  const ultima = (datas) => datas.filter((d) => d && d <= hoje).sort().at(-1) ?? null;
  return {
    producao: ultima((dados.lotes ?? []).map((l) => l.data_lote)),
    abertura: ultima([...(dados.lotes ?? []).map((l) => l.data_abertura), ...(dados.aberturasPorLote ?? []).map((a) => a.data)]),
    retirada: ultima((dados.eventos ?? []).map((e) => e.data_evento)),
  };
}

/**
 * @param {{salas?:Array, estantes?:Array}} cadastro
 * @param {Array<{galpao:string|null, estante:string|null, lote_chave:string}>} linhasDaFila
 */
export function quadroDasEstantes({ salas = [], estantes = [] } = {}, linhasDaFila = []) {
  const comLote = new Map();
  const lotesSemEstante = new Set();
  for (const l of linhasDaFila) {
    const galpao = etiq(l.galpao);
    const itens = etiq(l.estante).split(',').map(etiq).filter((e) => e !== '');
    if (!galpao || itens.length === 0) { lotesSemEstante.add(l.lote_chave); continue; }
    if (!comLote.has(galpao)) comLote.set(galpao, new Map());
    const daFila = comLote.get(galpao);
    itens.forEach((e) => { if (!daFila.has(chaveDaEstante(e))) daFila.set(chaveDaEstante(e), e); });
  }

  const usadas = new Set();
  const galpoes = salas
    .filter((s) => s.etapa === 'MATURACAO' && s.ativa !== false)
    .sort((a, b) => (Number(a.ordem ?? 0) - Number(b.ordem ?? 0)) || (Number(a.id) - Number(b.id)))
    .map((s) => {
      const codigo = etiq(s.galpao_codigo);
      const porChave = new Map();
      estantes
        .filter((e) => String(e.sala_id) === String(s.id) && (e.status ?? 'ATIVA') === 'ATIVA')
        .map((e) => ({ etiqueta: etiq(e.etiqueta), capacidade: capacidade(e.capacidade_blocos) }))
        .filter((e) => e.etiqueta !== '').sort((a, b) => ordemNumerica(a.etiqueta, b.etiqueta))
        .forEach((e) => { if (!porChave.has(chaveDaEstante(e.etiqueta))) porChave.set(chaveDaEstante(e.etiqueta), e); });
      const ativas = [...porChave.values()];
      const daFila = comLote.get(codigo) ?? new Map();
      const ocupadas = ativas.filter((e) => daFila.has(chaveDaEstante(e.etiqueta)));
      ocupadas.forEach((e) => usadas.add(`${codigo}|${chaveDaEstante(e.etiqueta)}`));
      const vazias = ativas.filter((e) => !daFila.has(chaveDaEstante(e.etiqueta)));
      const semCapacidade = vazias.some((e) => e.capacidade == null);
      return {
        sala_id: s.id, galpao_codigo: codigo, nome: s.nome ?? null, estantes: ativas.length, ocupadas: ocupadas.length, vazias: vazias.length,
        etiquetas_vazias: vazias.map((e) => e.etiqueta),
        capacidade_das_vazias: vazias.map((e) => ({ etiqueta: e.etiqueta, capacidade_blocos: e.capacidade })),
        capacidade_vazia: semCapacidade ? null : vazias.reduce((t, e) => t + e.capacidade, 0),
      };
    });

  const fora_do_cadastro = [];
  for (const [galpao, daFila] of comLote) {
    for (const [chave, estante] of daFila) if (!usadas.has(`${galpao}|${chave}`)) fora_do_cadastro.push({ galpao, estante });
  }
  fora_do_cadastro.sort((a, b) => a.galpao.localeCompare(b.galpao) || ordemNumerica(a.estante, b.estante));

  const somar = (campo) => galpoes.reduce((t, g) => t + g[campo], 0);
  return {
    galpoes,
    totais: {
      estantes: somar('estantes'), ocupadas: somar('ocupadas'), vazias: somar('vazias'),
      capacidade_vazia: galpoes.some((g) => g.capacidade_vazia == null) ? null : somar('capacidade_vazia'),
    },
    fora_do_cadastro,
    lotes_sem_estante: lotesSemEstante.size,
  };
}

/**
 * @param {{salas?:Array, estantes?:Array}} cadastro
 * @param {object} dados
 * @param {{hoje:string, horizonte?:number, regrasPorEspecie?:object}} opcoes
 */
export function quadroDaJornada(cadastro, dados, { hoje, horizonte, regrasPorEspecie } = {}) {
  return quadroDasEstantes(cadastro, filaDeAbertura(dados, { hoje, filtro: {}, horizonte, regrasPorEspecie }).linhas);
}
