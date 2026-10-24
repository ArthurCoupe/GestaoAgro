const arredondar2 = (x) => Math.round(x * 100) / 100;

/** @param {{ parametros?: Array<{tipo_cogumelo:string, gramas_por_bloco:?number, gramas_por_saco:?number}>, estoque?: Array<{tipo_cogumelo:string, saldo:number}>, compras_previstas?: Array<{tipo_cogumelo:string, quantidade:number}>, previsao: { horizonte_semanas:number, semanas:string[], porTipo: Map<string, { total:?number, semanas_sem_previsao:string[] }> } }} dados */
export function necessidadeDeSementes(
  { parametros = [], estoque = [], compras_previstas = [], previsao } = {},
) {
  if (!previsao?.porTipo) throw new Error('necessidadeDeSementes: sem a previsao de producao (porTipo).');
  const horizonte = previsao.horizonte_semanas;
  const saldoPorTipo = new Map(estoque.map((e) => [e.tipo_cogumelo, e.saldo]));
  const comprasPorTipo = new Map();
  for (const c of compras_previstas) {
    comprasPorTipo.set(c.tipo_cogumelo, (comprasPorTipo.get(c.tipo_cogumelo) ?? 0) + (c.quantidade ?? 0));
  }

  const por_tipo = parametros.map((p) => {
    const tipo = p.tipo_cogumelo;
    const semDado = [];
    const gramasPorBloco = p.gramas_por_bloco ?? null;
    const gramasPorSaco = p.gramas_por_saco ?? null;
    const previsto = previsao.porTipo.get(tipo) ?? { total: null, semanas_sem_previsao: [...previsao.semanas] };
    const blocosPrevistos = previsto.total;
    const gramasPorBlocoValido = gramasPorBloco != null && gramasPorBloco > 0;
    const gramasPorSacoValido = gramasPorSaco != null && gramasPorSaco > 0;
    if (!gramasPorBlocoValido) semDado.push('gramas_por_bloco');
    if (!gramasPorSacoValido) semDado.push('gramas_por_saco');
    if (blocosPrevistos == null) semDado.push('previsao');

    let necessidadeHorizonteSacos = null;
    let necessidadeSemanaSacos = null;
    if (gramasPorBlocoValido && gramasPorSacoValido && blocosPrevistos != null) {
      const sacos = (blocosPrevistos * gramasPorBloco) / gramasPorSaco;
      necessidadeHorizonteSacos = arredondar2(sacos);
      necessidadeSemanaSacos = arredondar2(sacos / horizonte);
    }

    const temEstoque = saldoPorTipo.has(tipo);
    const saldo = temEstoque ? (saldoPorTipo.get(tipo) ?? null) : null;
    if (!temEstoque) semDado.push('estoque');

    let duraSemanas = null;
    if (necessidadeSemanaSacos != null && saldo != null && necessidadeSemanaSacos !== 0) {
      duraSemanas = saldo / necessidadeSemanaSacos;
    }

    const compras = comprasPorTipo.get(tipo) ?? 0;
    let comprarAgoraSacos = null;
    if (necessidadeHorizonteSacos != null && saldo != null) {
      comprarAgoraSacos = Math.max(0, Math.ceil(arredondar2(necessidadeHorizonteSacos - saldo - compras)));
    }

    return {
      tipo_cogumelo: tipo,
      gramas_por_bloco: gramasPorBloco,
      gramas_por_saco: gramasPorSaco,
      blocos_previstos_horizonte: blocosPrevistos,
      semanas_sem_previsao: previsto.semanas_sem_previsao,
      necessidade_horizonte_sacos: necessidadeHorizonteSacos,
      necessidade_semana_sacos: necessidadeSemanaSacos,
      saldo,
      dura_semanas: duraSemanas,
      compras_previstas_sacos: compras,
      comprar_agora_sacos: comprarAgoraSacos,
      sem_dado: semDado,
    };
  });

  return { horizonte_semanas: horizonte, semanas: previsao.semanas, por_tipo };
}
