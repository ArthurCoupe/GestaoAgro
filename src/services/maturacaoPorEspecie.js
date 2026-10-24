/**
 * @param {{tipo?: string|null, data_lote?: string|null}} lote
 * @param {{regrasPorEspecie?: Array<{id?: number, tipo_cogumelo: string, dias: number, vigente_desde: string}>, parametrosPorTipo?: Record<string, number>}} [opcoes]
 * @returns {{dias: number|null, origem: 'ESPECIE'|'TIPO'|null, regra_id: number|null}}
 */
export function resolverDiasDeMaturacao(lote, opcoes = {}) {
  const { tipo = null, data_lote: dataLote = null } = lote ?? {};
  const { regrasPorEspecie = [], parametrosPorTipo = {} } = opcoes ?? {};

  if (tipo && dataLote) {
    let escolhida = null;
    for (const r of regrasPorEspecie) {
      if (r?.tipo_cogumelo !== tipo) continue;
      if (!r.vigente_desde || r.vigente_desde > dataLote) continue;
      if (!escolhida || r.vigente_desde > escolhida.vigente_desde) escolhida = r;
    }
    if (escolhida && escolhida.dias != null) {
      return { dias: Number(escolhida.dias), origem: 'ESPECIE', regra_id: escolhida.id ?? null };
    }
  }

  const porTipo = tipo == null ? undefined : parametrosPorTipo[tipo];
  if (porTipo != null) return { dias: Number(porTipo), origem: 'TIPO', regra_id: null };

  return { dias: null, origem: null, regra_id: null };
}

/** @returns {Record<string, number|null>} */
export function prazosVigentesPorTipo(regrasPorEspecie, hoje, parametrosPorTipo) {
  return Object.fromEntries(Object.keys(parametrosPorTipo).map((tipo) => [
    tipo, resolverDiasDeMaturacao({ tipo, data_lote: hoje }, { regrasPorEspecie, parametrosPorTipo }).dias,
  ]));
}
