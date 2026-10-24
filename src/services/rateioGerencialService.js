export const SEGMENTO_NEGOCIO = {
  PRODUCAO: 'PRODUCAO',
  REVENDA: 'REVENDA',
  CORPORATIVO: 'CORPORATIVO',
  NAO_RATEADO: 'NAO_RATEADO',
};

export const SEGMENTO_PRODUTO = {
  COGUMELO: 'COGUMELO',
  PIMENTAO: 'PIMENTAO',
};

export const SEGMENTO_VARIEDADE = Object.freeze({ SH: 'SH', SP: 'SP', SB: 'SB', SS: 'SS' });
export const ORDEM_VARIEDADE = ['SH', 'SP', 'SB', 'SS'];
export const FONTE_DO_DRIVER = Object.freeze({
  BANDEJAS_PRODUZIDAS: 'BANDEJAS_PRODUZIDAS',
  BANDEJAS_EMBALADAS: 'BANDEJAS_PRODUZIDAS',
  BANDEJAS_VENDIDAS: 'BANDEJAS_VENDIDAS',
  BLOCOS_PRODUZIDOS: 'BLOCOS_PRODUZIDOS',
  KG_PRODUZIDOS: 'KG_PRODUZIDOS',
  RECEITA_DA_ESPECIE: 'RECEITA_DA_ESPECIE',
});

export const DIRECIONADOR_NEGOCIO = Object.freeze({
  UNIDADES_COGUMELO_VENDIDAS: 'UNIDADES_COGUMELO_VENDIDAS',
});
export const FONTE_DO_DIRECIONADOR = Object.freeze({
  UNIDADES_COGUMELO_VENDIDAS: 'UNIDADES_COGUMELO_VENDIDAS',
});

export const DESTINO_COMPOSICAO = Object.freeze({
  PRODUCAO_COGUMELO: 'PRODUCAO_COGUMELO',
  PRODUCAO_PIMENTAO: 'PRODUCAO_PIMENTAO',
  COMO_LINHA: 'COMO_LINHA',
});

export const EIXOS_NEGOCIO = [
  { segmento: SEGMENTO_NEGOCIO.PRODUCAO, campo: 'pct_producao' },
  { segmento: SEGMENTO_NEGOCIO.REVENDA, campo: 'pct_revenda' },
  { segmento: SEGMENTO_NEGOCIO.CORPORATIVO, campo: 'pct_corporativo' },
];

export const EIXOS_PRODUCAO = [
  { segmento: SEGMENTO_PRODUTO.COGUMELO, campo: 'pct_cogumelo' },
  { segmento: SEGMENTO_PRODUTO.PIMENTAO, campo: 'pct_pimentao' },
];

export const MOTIVO = {
  RATEADO: 'RATEADO',
  SEM_REGRA_NEGOCIO: 'SEM_REGRA_NEGOCIO',
  REGRA_NEGOCIO_INCOMPLETA: 'REGRA_NEGOCIO_INCOMPLETA',
  REGRA_NEGOCIO_SOMA_INVALIDA: 'REGRA_NEGOCIO_SOMA_INVALIDA',
  VIGENCIA_NEGOCIO_AMBIGUA: 'VIGENCIA_NEGOCIO_AMBIGUA',
  NEGOCIO_SEM_PESO_NO_MES: 'NEGOCIO_SEM_PESO_NO_MES',
  VIGENCIA_DIRECIONADOR_AMBIGUA: 'VIGENCIA_DIRECIONADOR_AMBIGUA',
  DIRECIONADOR_SEM_FONTE: 'DIRECIONADOR_SEM_FONTE',
  COMPOSICAO_INVALIDA: 'COMPOSICAO_INVALIDA',
  COMPOSICAO_COM_PARTE_NAO_RATEADA: 'COMPOSICAO_COM_PARTE_NAO_RATEADA',
  SEM_DEPARA: 'SEM_DEPARA',
};

export const AVISO = {
  PRODUCAO_SEM_REGRA_PRODUTO: 'PRODUCAO_SEM_REGRA_PRODUTO',
  REGRA_PRODUCAO_INCOMPLETA: 'REGRA_PRODUCAO_INCOMPLETA',
  REGRA_PRODUCAO_SOMA_INVALIDA: 'REGRA_PRODUCAO_SOMA_INVALIDA',
  VIGENCIA_PRODUCAO_AMBIGUA: 'VIGENCIA_PRODUCAO_AMBIGUA',
  COGUMELO_SEM_REGRA_VARIEDADE: 'COGUMELO_SEM_REGRA_VARIEDADE',
  VIGENCIA_VARIEDADE_AMBIGUA: 'VIGENCIA_VARIEDADE_AMBIGUA',
  VARIEDADE_DRIVER_SEM_FONTE: 'VARIEDADE_DRIVER_SEM_FONTE',
  VARIEDADE_SEM_DRIVER_NO_MES: 'VARIEDADE_SEM_DRIVER_NO_MES',
};

export const MOTIVOS_NAO_RATEADO = new Set([
  MOTIVO.SEM_REGRA_NEGOCIO,
  MOTIVO.REGRA_NEGOCIO_INCOMPLETA,
  MOTIVO.REGRA_NEGOCIO_SOMA_INVALIDA,
  MOTIVO.VIGENCIA_NEGOCIO_AMBIGUA,
  MOTIVO.NEGOCIO_SEM_PESO_NO_MES,
  MOTIVO.VIGENCIA_DIRECIONADOR_AMBIGUA,
  MOTIVO.DIRECIONADOR_SEM_FONTE,
  MOTIVO.COMPOSICAO_INVALIDA,
  MOTIVO.COMPOSICAO_COM_PARTE_NAO_RATEADA,
]);

export const MOTIVOS_QUE_RECUSAM_O_MES = new Set([
  MOTIVO.NEGOCIO_SEM_PESO_NO_MES,
  MOTIVO.VIGENCIA_DIRECIONADOR_AMBIGUA,
  MOTIVO.DIRECIONADOR_SEM_FONTE,
]);

export const TOLERANCIA_SOMA = 0.001;

/**
 * @param {number|string} valor
 * @returns {number}
 */
export function paraCentavos(valor) {
  if (valor == null) throw new TypeError('paraCentavos: valor nulo.');

  const texto = String(valor).trim();
  const m = /^(-?)(\d+)(?:[.,](\d*))?$/.exec(texto);
  if (m) {
    const sinal = m[1] === '-' ? -1 : 1;
    const inteiros = m[2];
    const dec = (m[3] ?? '').padEnd(3, '0');
    const centavos = Number(inteiros) * 100 + Number(dec.slice(0, 2));
    const terceira = Number(dec[2]);
    return sinal * (centavos + (terceira >= 5 ? 1 : 0));
  }

  const n = Number(valor);
  if (!Number.isFinite(n)) throw new TypeError(`paraCentavos: valor não numérico (${texto}).`);
  return Math.sign(n) * Math.round(Math.abs(n) * 100);
}

export function paraReais(centavos) {
  return Number((centavos / 100).toFixed(2));
}

export function formatarReais(centavos) {
  const neg = centavos < 0;
  const abs = Math.abs(centavos);
  const inteiros = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const cent = String(abs % 100).padStart(2, '0');
  return `${neg ? '-' : ''}R$ ${inteiros},${cent}`;
}

/**
 * @param {number} valorCentavos
 * @param {Array<{segmento: string, peso: number}>} eixos
 * @returns {Array<{segmento: string, centavos: number}>}
 */
export function repartir(valorCentavos, eixos) {
  if (!Number.isInteger(valorCentavos)) {
    throw new TypeError(`repartir: valorCentavos deve ser inteiro (recebido ${valorCentavos}).`);
  }
  if (!Array.isArray(eixos) || eixos.length === 0) {
    throw new TypeError('repartir: informe ao menos um eixo.');
  }

  const sinal = valorCentavos < 0 ? -1 : 1;
  const modulo = BigInt(Math.abs(valorCentavos));

  const pesos = eixos.map((e) => {
    const p = Number(e.peso);
    if (!Number.isFinite(p)) throw new TypeError(`repartir: peso não numérico em ${e.segmento}.`);
    if (p < 0) throw new RangeError(`repartir: peso negativo em ${e.segmento} (${p}).`);
    return BigInt(Math.round(p * 10000));
  });

  const totalPeso = pesos.reduce((s, p) => s + p, 0n);
  if (totalPeso === 0n) {
    throw new RangeError('repartir: a soma dos pesos é zero, não há base para repartir.');
  }

  const pisos = pesos.map((p) => (modulo * p) / totalPeso);
  const restos = pesos.map((p, i) => modulo * p - pisos[i] * totalPeso);

  let sobra = modulo - pisos.reduce((s, v) => s + v, 0n);

  const ordem = pesos
    .map((_, i) => i)
    .sort((a, b) => {
      if (restos[a] !== restos[b]) return restos[a] > restos[b] ? -1 : 1;
      return a - b;
    });

  const centavos = pisos.slice();
  for (const i of ordem) {
    if (sobra <= 0n) break;
    centavos[i] += 1n;
    sobra -= 1n;
  }

  return eixos.map((e, i) => ({
    segmento: e.segmento,
    centavos: sinal * Number(centavos[i]),
  }));
}

const round2 = (v) => Math.round((Number(v) + Number.EPSILON) * 100) / 100;

/** @returns {Array<{chave:any, valor:number, participacao:number}>|null} */
export function distribuir(valor, pesos) {
  const validos = pesos.filter((p) => p.peso > 0);
  const total = validos.reduce((s, p) => s + p.peso, 0);
  if (total <= 0) return null;

  const eixos = validos.map((p) => ({ segmento: p.chave, peso: p.peso }));

  if (eixos.every((e) => Math.round(e.peso * 10000) === 0)) return null;

  const fatias = repartir(Math.round(valor * 100), eixos);
  return validos.map((p, i) => ({
    chave: p.chave,
    valor: fatias[i].centavos / 100,
    participacao: round2((p.peso / total) * 100),
  }));
}

/**
 * @param {object[]} regras
 * @param {string} competencia
 * @returns {{regra: object|null, ambiguas: object[]|null}}
 */
export function selecionarVigente(regras, competencia) {
  const lista = Array.isArray(regras) ? regras : [];
  const valendo = lista.filter((r) => valeNaCompetencia(r, competencia));
  if (valendo.length === 0) return { regra: null, ambiguas: null };
  if (valendo.length > 1) return { regra: null, ambiguas: valendo };
  return { regra: valendo[0], ambiguas: null };
}

function valeNaCompetencia(r, competencia) {
  return String(r.vigente_desde) <= competencia
    && (r.vigente_ate == null || String(r.vigente_ate) > competencia);
}

/** @param {{regras: object[], competencia: string}} args */
export function avaliarComposicao({ regras = [], competencia }) {
  const valendo = (Array.isArray(regras) ? regras : []).filter((r) => valeNaCompetencia(r, competencia));
  if (valendo.length === 0) return { vale: false };

  const vazio = (v) => v == null || (typeof v === 'string' && v.trim() === '');
  const lidos = valendo.map((r) => ({
    ordem: vazio(r.ordem) ? null : Number(r.ordem),
    pct: vazio(r.pct) ? null : Number(r.pct),
    destino: r.destino,
    linha_referencia_id: r.linha_referencia_id ?? null,
    vigente_desde: r.vigente_desde,
    vigente_ate: r.vigente_ate ?? null,
  }));
  const invalida = (porQue, extra = {}) => ({
    vale: true,
    ok: false,
    motivo: MOTIVO.COMPOSICAO_INVALIDA,
    detalhe: { por_que: porQue, competencia, componentes: lidos, ...extra },
  });

  const inicios = [...new Set(lidos.map((c) => String(c.vigente_desde)))].sort();
  if (inicios.length > 1) return invalida('vigencia ambigua: mais de uma composicao vale na competencia', { vigencias: inicios });

  if (lidos.some((c) => !Number.isInteger(c.ordem)) || new Set(lidos.map((c) => c.ordem)).size !== lidos.length) {
    return invalida('ordem ausente ou repetida');
  }
  lidos.sort((a, b) => a.ordem - b.ordem);

  for (const c of lidos) {
    if (!Object.hasOwn(DESTINO_COMPOSICAO, String(c.destino))) return invalida(`destino desconhecido (${c.destino})`, { ordem: c.ordem });
    if (!Number.isFinite(c.pct) || c.pct <= 0 || c.pct > 100 + TOLERANCIA_SOMA) {
      return invalida('percentual vazio, zero, negativo ou acima de 100', { ordem: c.ordem });
    }
    const comoLinha = c.destino === DESTINO_COMPOSICAO.COMO_LINHA;
    if (comoLinha && c.linha_referencia_id == null) return invalida('COMO_LINHA sem linha de referencia', { ordem: c.ordem });
    if (!comoLinha && c.linha_referencia_id != null) return invalida('linha de referencia num destino que nao e COMO_LINHA', { ordem: c.ordem });
  }

  const soma = lidos.reduce((s, c) => s + c.pct, 0);
  if (Math.abs(soma - 100) > TOLERANCIA_SOMA) return invalida('a composicao nao soma 100 (nao se renormaliza)', { soma: Number(soma.toFixed(4)) });

  return {
    vale: true,
    ok: true,
    vigente_desde: inicios[0],
    componentes: lidos.map(({ ordem, pct, destino, linha_referencia_id: ref }) => ({ ordem, pct, destino, linha_referencia_id: ref })),
  };
}

/**
 * @param {object|null} regra
 * @param {Array<{segmento: string, campo: string}>} eixos
 * @returns {{ok: boolean, motivo: string|null, detalhe: object}}
 */
function avaliarRegra(regra, eixos, motivos) {
  if (regra == null) {
    return { ok: false, motivo: motivos.semRegra, detalhe: {} };
  }

  const numeroOuNulo = (v) => {
    if (v == null) return null;
    if (typeof v === 'string' && v.trim() === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const lidos = eixos.map((e) => ({
    segmento: e.segmento,
    campo: e.campo,
    valor: numeroOuNulo(regra[e.campo]),
  }));

  const vazios = lidos.filter((l) => l.valor == null || !Number.isFinite(l.valor));
  if (vazios.length > 0) {
    return {
      ok: false,
      motivo: motivos.incompleta,
      detalhe: {
        eixos_vazios: vazios.map((v) => v.campo),
        percentuais: Object.fromEntries(lidos.map((l) => [l.campo, l.valor])),
      },
    };
  }

  const foraDaFaixa = lidos.filter(
    (l) => l.valor < -TOLERANCIA_SOMA || l.valor > 100 + TOLERANCIA_SOMA,
  );
  if (foraDaFaixa.length > 0) {
    return {
      ok: false,
      motivo: motivos.somaInvalida,
      detalhe: {
        eixos_fora_da_faixa: foraDaFaixa.map((f) => `${f.campo}=${f.valor}`),
        percentuais: Object.fromEntries(lidos.map((l) => [l.campo, l.valor])),
        por_que: 'percentual fora de 0..100: o item vai para quarentena em vez de derrubar a apuracao',
      },
    };
  }

  const soma = lidos.reduce((s, l) => s + l.valor, 0);
  if (Math.abs(soma - 100) > TOLERANCIA_SOMA) {
    return {
      ok: false,
      motivo: motivos.somaInvalida,
      detalhe: {
        soma: Number(soma.toFixed(4)),
        percentuais: Object.fromEntries(lidos.map((l) => [l.campo, l.valor])),
      },
    };
  }

  return {
    ok: true,
    motivo: null,
    detalhe: { percentuais: Object.fromEntries(lidos.map((l) => [l.campo, l.valor])) },
    pesos: lidos.map((l) => ({ segmento: l.segmento, peso: l.valor })),
  };
}

export function avaliarRegraNegocio(regra) {
  return avaliarRegra(regra, EIXOS_NEGOCIO, {
    semRegra: MOTIVO.SEM_REGRA_NEGOCIO,
    incompleta: MOTIVO.REGRA_NEGOCIO_INCOMPLETA,
    somaInvalida: MOTIVO.REGRA_NEGOCIO_SOMA_INVALIDA,
  });
}

export function avaliarRegraProducao(regra) {
  return avaliarRegra(regra, EIXOS_PRODUCAO, {
    semRegra: AVISO.PRODUCAO_SEM_REGRA_PRODUTO,
    incompleta: AVISO.REGRA_PRODUCAO_INCOMPLETA,
    somaInvalida: AVISO.REGRA_PRODUCAO_SOMA_INVALIDA,
  });
}

/** @param {{regras: object[], competencia: string, pesosDoMes: object|null}} args */
export function avaliarDirecionadorNegocio({ regras, competencia, pesosDoMes }) {
  const { regra, ambiguas } = selecionarVigente(regras, competencia);
  if (ambiguas) {
    return {
      vale: true,
      ok: false,
      motivo: MOTIVO.VIGENCIA_DIRECIONADOR_AMBIGUA,
      detalhe: {
        vigencias: ambiguas.map((r) => ({ desde: r.vigente_desde, ate: r.vigente_ate, direcionador: r.direcionador })),
        competencia_do_peso: competencia,
      },
    };
  }
  if (!regra) return { vale: false };

  const { direcionador } = regra;
  const fonte = Object.hasOwn(FONTE_DO_DIRECIONADOR, String(direcionador)) ? FONTE_DO_DIRECIONADOR[direcionador] : null;
  if (!fonte) {
    return { vale: true, ok: false, motivo: MOTIVO.DIRECIONADOR_SEM_FONTE, detalhe: { direcionador, competencia_do_peso: competencia } };
  }

  const semPeso = (porQue, pesos = null) => ({
    vale: true,
    ok: false,
    motivo: MOTIVO.NEGOCIO_SEM_PESO_NO_MES,
    detalhe: { direcionador, competencia_do_peso: competencia, pesos, por_que: porQue },
  });
  const doMes = pesosDoMes?.[fonte];
  if (doMes == null || typeof doMes !== 'object') return semPeso('sem peso do direcionador no mes');

  const lidos = [];
  for (const e of EIXOS_NEGOCIO) {
    if (!Object.hasOwn(doMes, e.segmento)) {
      if (e.segmento !== SEGMENTO_NEGOCIO.CORPORATIVO) return semPeso(`sem peso de ${e.segmento}`, { ...doMes });
      lidos.push({ segmento: e.segmento, peso: 0, presente: false });
      continue;
    }
    const bruto = doMes[e.segmento];
    const n = bruto == null || (typeof bruto === 'string' && bruto.trim() === '') ? Number.NaN : Number(bruto);
    if (!Number.isFinite(n) || n < 0) return semPeso(`peso invalido em ${e.segmento} (${bruto})`, { ...doMes });
    lidos.push({ segmento: e.segmento, peso: n, presente: true });
  }
  const pesosLidos = Object.fromEntries(lidos.filter((l) => l.presente).map((l) => [l.segmento, l.peso]));
  if (lidos.every((l) => Math.round(l.peso * 10000) === 0)) return semPeso('nenhuma unidade no mes', pesosLidos);

  return {
    vale: true,
    ok: true,
    regra,
    pesos: lidos.map((l) => ({ segmento: l.segmento, peso: l.peso })),
    detalhe: { direcionador, competencia_do_peso: competencia, pesos: pesosLidos },
  };
}

/**
 * @param {Array<{mesBalde: string, competenciaDoPeso: string|null, centavos: number}>} itens
 * @returns {Map<string, {n: number, centavos: number, mesesSemPeso: string[]}>}
 */
export function mesesRecusadosPeloDirecionador(itens = []) {
  const porMes = new Map();
  for (const { mesBalde, competenciaDoPeso, centavos } of itens) {
    const k = String(mesBalde);
    if (!porMes.has(k)) porMes.set(k, { n: 0, centavos: 0, meses: new Set() });
    const b = porMes.get(k);
    b.n += 1;
    b.centavos += centavos;
    b.meses.add(String(competenciaDoPeso ?? mesBalde).slice(0, 7));
  }
  return new Map([...porMes]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, b]) => [k, { n: b.n, centavos: b.centavos, mesesSemPeso: [...b.meses].sort() }]));
}

/** @returns {{fatias: Array<{segmento_variedade: string|null, centavos: number}>, aviso: {codigo: string, detalhe: object}|null}} */
export function ratearVariedade({ centavos, competencia, regrasVariedade = [], pesosDoMes = {} }) {
  if (centavos === 0) return { fatias: [], aviso: null };
  const semQuebra = (codigo, detalhe) => ({ fatias: [{ segmento_variedade: null, centavos }], aviso: { codigo, detalhe } });
  const { regra, ambiguas } = selecionarVigente(regrasVariedade, competencia);
  if (ambiguas) {
    return semQuebra(AVISO.VIGENCIA_VARIEDADE_AMBIGUA, { vigencias: ambiguas.map((r) => ({ desde: r.vigente_desde, ate: r.vigente_ate })), competencia });
  }
  if (!regra) return semQuebra(AVISO.COGUMELO_SEM_REGRA_VARIEDADE, { competencia });
  const fonte = FONTE_DO_DRIVER[regra.driver];
  if (!fonte) return semQuebra(AVISO.VARIEDADE_DRIVER_SEM_FONTE, { driver: regra.driver, competencia });
  const pesos = pesosDoMes[fonte] ?? {};
  const eixos = ORDEM_VARIEDADE.filter((v) => Number(pesos[v] ?? 0) > 0).map((v) => ({ segmento: v, peso: Number(pesos[v]) }));
  if (eixos.length === 0) return semQuebra(AVISO.VARIEDADE_SEM_DRIVER_NO_MES, { driver: regra.driver, fonte, competencia });
  return {
    fatias: repartir(centavos, eixos).map((p) => ({ segmento_variedade: p.segmento, centavos: p.centavos })).filter((f) => f.centavos !== 0),
    aviso: null,
  };
}

/**
 * @param {object} args
 * @param {number|string} args.valor
 * @param {string} args.competencia
 * @param {boolean} args.temLinha
 * @param {object[]} [args.regrasNegocio]
 * @param {object[]} [args.regrasProducao]
 * @param {object[]} [args.regrasVariedade]
 * @param {object} [args.pesosVariedade]
 * @param {object[]} [args.regrasNegocioDriver]
 * @param {object|null} [args.pesosNegocio]
 * @param {string|null} [args.competenciaDoPeso]
 * @param {object[]} [args.regrasComposicao]
 * @param {((linhaId: string) => ({regrasNegocio: object[], regrasProducao: object[], regrasVariedade: object[], regrasNegocioDriver: object[], regrasComposicao: object[]}|null))|null} [args.resolverLinha]
 * @returns {{ fatias: Array<{segmento_negocio: string, segmento_produto: string|null, segmento_variedade: string|null, centavos: number}>, motivo: string, avisos: Array<{codigo: string, detalhe: object}>, valorCentavos: number, detalhe: object }}
 */
export function ratearLancamento({ valor, ...resto }) {
  return ratearEmCentavos({ ...resto, valorCentavos: paraCentavos(valor) });
}

function resultadoNaoRateado(valorCentavos, motivo, detalhe) {
  return {
    fatias: valorCentavos === 0 ? [] : [{
      segmento_negocio: SEGMENTO_NEGOCIO.NAO_RATEADO,
      segmento_produto: null,
      segmento_variedade: null,
      centavos: valorCentavos,
    }],
    motivo,
    avisos: [],
    valorCentavos,
    detalhe,
  };
}

function ratearEmCentavos({
  valorCentavos,
  competencia,
  temLinha,
  regrasNegocio = [],
  regrasProducao = [],
  regrasVariedade = [],
  pesosVariedade = {},
  regrasNegocioDriver = [],
  pesosNegocio = null,
  competenciaDoPeso = null,
  regrasComposicao = [],
  resolverLinha = null,
}) {
  if (!temLinha) {
    return {
      fatias: [],
      motivo: MOTIVO.SEM_DEPARA,
      avisos: [],
      valorCentavos,
      detalhe: {},
    };
  }

  const naoRateado = (motivo, detalhe) => resultadoNaoRateado(valorCentavos, motivo, detalhe);

  const composta = avaliarComposicao({ regras: regrasComposicao, competencia });
  if (composta.vale) {
    if (!composta.ok) return naoRateado(composta.motivo, composta.detalhe);
    return ratearPelaComposicao({
      valorCentavos, competencia, composicao: composta, regrasVariedade, pesosVariedade, pesosNegocio, competenciaDoPeso, resolverLinha,
    });
  }

  const porVolume = avaliarDirecionadorNegocio({
    regras: regrasNegocioDriver,
    competencia: competenciaDoPeso ?? competencia,
    pesosDoMes: pesosNegocio,
  });
  let pesosDoNegocio;
  let detalheDoNegocio;
  if (porVolume.vale) {
    if (!porVolume.ok) return naoRateado(porVolume.motivo, porVolume.detalhe);
    pesosDoNegocio = porVolume.pesos;
    detalheDoNegocio = { ...porVolume.detalhe, vigente_desde: porVolume.regra.vigente_desde };
  } else {
    const { regra: regraNegocio, ambiguas } = selecionarVigente(regrasNegocio, competencia);
    if (ambiguas) {
      return naoRateado(MOTIVO.VIGENCIA_NEGOCIO_AMBIGUA, {
        vigencias: ambiguas.map((r) => ({ desde: r.vigente_desde, ate: r.vigente_ate })),
        competencia,
      });
    }

    const aval = avaliarRegraNegocio(regraNegocio);
    if (!aval.ok) return naoRateado(aval.motivo, aval.detalhe);
    pesosDoNegocio = aval.pesos;
    detalheDoNegocio = { ...aval.detalhe, vigente_desde: regraNegocio.vigente_desde };
  }

  const porNegocio = repartir(valorCentavos, pesosDoNegocio);

  const fatiaProducao = porNegocio.find((f) => f.segmento === SEGMENTO_NEGOCIO.PRODUCAO);
  const fatias = [];
  const avisos = [];

  for (const f of porNegocio) {
    if (f.segmento !== SEGMENTO_NEGOCIO.PRODUCAO) {
      fatias.push({ segmento_negocio: f.segmento, segmento_produto: null, segmento_variedade: null, centavos: f.centavos });
    }
  }

  if (fatiaProducao && fatiaProducao.centavos !== 0) {
    const sel = selecionarVigente(regrasProducao, competencia);
    let avalProd;
    if (sel.ambiguas) {
      avalProd = {
        ok: false,
        motivo: AVISO.VIGENCIA_PRODUCAO_AMBIGUA,
        detalhe: {
          vigencias: sel.ambiguas.map((r) => ({ desde: r.vigente_desde, ate: r.vigente_ate })),
          competencia,
        },
      };
    } else {
      avalProd = avaliarRegraProducao(sel.regra);
    }

    if (avalProd.ok) {
      for (const p of repartir(fatiaProducao.centavos, avalProd.pesos)) {
        if (p.segmento === SEGMENTO_PRODUTO.COGUMELO && p.centavos !== 0) {
          const v = ratearVariedade({ centavos: p.centavos, competencia, regrasVariedade, pesosDoMes: pesosVariedade });
          if (v.aviso) avisos.push(v.aviso);
          for (const s of v.fatias) {
            fatias.push({ segmento_negocio: SEGMENTO_NEGOCIO.PRODUCAO, segmento_produto: p.segmento, segmento_variedade: s.segmento_variedade, centavos: s.centavos });
          }
        } else {
          fatias.push({ segmento_negocio: SEGMENTO_NEGOCIO.PRODUCAO, segmento_produto: p.segmento, segmento_variedade: null, centavos: p.centavos });
        }
      }
    } else {
      avisos.push({ codigo: avalProd.motivo, detalhe: avalProd.detalhe });
      fatias.push({
        segmento_negocio: SEGMENTO_NEGOCIO.PRODUCAO,
        segmento_produto: null,
        segmento_variedade: null,
        centavos: fatiaProducao.centavos,
      });
    }
  } else if (fatiaProducao) {
    fatias.push({
      segmento_negocio: SEGMENTO_NEGOCIO.PRODUCAO,
      segmento_produto: null,
      segmento_variedade: null,
      centavos: 0,
    });
  }

  const resultado = {
    fatias: fatias.filter((f) => f.centavos !== 0),
    motivo: MOTIVO.RATEADO,
    avisos,
    valorCentavos,
    detalhe: detalheDoNegocio,
  };

  conferirConservacao(resultado);
  return resultado;
}

function ratearPelaComposicao({
  valorCentavos, competencia, composicao, regrasVariedade, pesosVariedade, pesosNegocio, competenciaDoPeso, resolverLinha,
}) {
  const { componentes, vigente_desde: vigenteDesde } = composicao;
  const invalida = (porQue, c) => resultadoNaoRateado(valorCentavos, MOTIVO.COMPOSICAO_INVALIDA, {
    por_que: porQue, competencia, vigente_desde: vigenteDesde, componentes, ordem: c.ordem, linha_referencia_id: c.linha_referencia_id,
  });

  const regrasDaReferencia = new Map();
  for (const c of componentes) {
    if (c.destino !== DESTINO_COMPOSICAO.COMO_LINHA) continue;
    const regras = typeof resolverLinha === 'function' ? resolverLinha(c.linha_referencia_id) : null;
    if (regras == null || typeof regras !== 'object') return invalida('a linha de referencia nao foi encontrada', c);
    if (!Array.isArray(regras.regrasComposicao)) return invalida('resolverLinha nao informou regrasComposicao da linha de referencia', c);
    if (regras.regrasComposicao.length > 0) return invalida('a linha de referencia tambem tem composicao (um nivel so)', c);
    regrasDaReferencia.set(c.ordem, regras);
  }

  const partes = repartir(valorCentavos, componentes.map((c) => ({ segmento: c.ordem, peso: c.pct })));
  const composicaoComCentavos = [];
  const porChave = new Map();
  const avisoPorCodigo = new Map();
  for (const [i, c] of componentes.entries()) {
    const { centavos } = partes[i];
    let parte;
    if (c.destino === DESTINO_COMPOSICAO.PRODUCAO_COGUMELO) {
      const v = ratearVariedade({ centavos, competencia, regrasVariedade, pesosDoMes: pesosVariedade });
      parte = {
        motivo: MOTIVO.RATEADO,
        detalhe: null,
        avisos: v.aviso ? [v.aviso] : [],
        fatias: v.fatias.map((s) => ({
          segmento_negocio: SEGMENTO_NEGOCIO.PRODUCAO, segmento_produto: SEGMENTO_PRODUTO.COGUMELO, segmento_variedade: s.segmento_variedade, centavos: s.centavos,
        })),
      };
    } else if (c.destino === DESTINO_COMPOSICAO.PRODUCAO_PIMENTAO) {
      parte = {
        motivo: MOTIVO.RATEADO,
        detalhe: null,
        avisos: [],
        fatias: centavos === 0 ? [] : [{ segmento_negocio: SEGMENTO_NEGOCIO.PRODUCAO, segmento_produto: SEGMENTO_PRODUTO.PIMENTAO, segmento_variedade: null, centavos }],
      };
    } else {
      const regras = regrasDaReferencia.get(c.ordem);
      parte = ratearEmCentavos({
        valorCentavos: centavos,
        competencia,
        temLinha: true,
        regrasNegocio: regras.regrasNegocio ?? [],
        regrasProducao: regras.regrasProducao ?? [],
        regrasVariedade: regras.regrasVariedade ?? [],
        regrasNegocioDriver: regras.regrasNegocioDriver ?? [],
        pesosVariedade,
        pesosNegocio,
        competenciaDoPeso,
      });
    }
    composicaoComCentavos.push({
      ordem: c.ordem, pct: c.pct, destino: c.destino, linha_referencia_id: c.linha_referencia_id, centavos, motivo: parte.motivo, detalhe: parte.detalhe, fatias: parte.fatias,
    });
    for (const f of parte.fatias) {
      const chave = JSON.stringify([f.segmento_negocio, f.segmento_produto ?? null, f.segmento_variedade ?? null]);
      const ja = porChave.get(chave);
      if (ja) ja.centavos += f.centavos;
      else porChave.set(chave, { segmento_negocio: f.segmento_negocio, segmento_produto: f.segmento_produto ?? null, segmento_variedade: f.segmento_variedade ?? null, centavos: f.centavos });
    }
    for (const a of parte.avisos) {
      const ja = avisoPorCodigo.get(a.codigo);
      if (!ja) avisoPorCodigo.set(a.codigo, { codigo: a.codigo, detalhe: { ...a.detalhe, componentes: [c.ordem] } });
      else if (!ja.detalhe.componentes.includes(c.ordem)) ja.detalhe.componentes.push(c.ordem);
    }
  }

  const recusa = composicaoComCentavos.find((p) => MOTIVOS_QUE_RECUSAM_O_MES.has(p.motivo));
  if (recusa) {
    return resultadoNaoRateado(valorCentavos, recusa.motivo, {
      ...recusa.detalhe, componente: recusa.ordem, linha_referencia_id: recusa.linha_referencia_id, vigente_desde: vigenteDesde, composicao: composicaoComCentavos,
    });
  }
  const naoRateadas = composicaoComCentavos.filter((p) => p.motivo !== MOTIVO.RATEADO);
  if (naoRateadas.length > 0) {
    return resultadoNaoRateado(valorCentavos, MOTIVO.COMPOSICAO_COM_PARTE_NAO_RATEADA, {
      vigente_desde: vigenteDesde,
      composicao: composicaoComCentavos,
      partes_nao_rateadas: naoRateadas.map((p) => ({ ordem: p.ordem, linha_referencia_id: p.linha_referencia_id, motivo: p.motivo })),
    });
  }

  const resultado = {
    fatias: [...porChave.values()].filter((f) => f.centavos !== 0),
    motivo: MOTIVO.RATEADO,
    avisos: [...avisoPorCodigo.values()],
    valorCentavos,
    detalhe: { vigente_desde: vigenteDesde, composicao: composicaoComCentavos },
  };
  conferirConservacao(resultado);
  return resultado;
}

export function conferirConservacao({ fatias, valorCentavos }) {
  const soma = fatias.reduce((s, f) => s + f.centavos, 0);
  if (soma !== valorCentavos) {
    throw new Error(
      `CONSERVAÇÃO QUEBRADA: as fatias somam ${soma} centavos e o lançamento vale `
      + `${valorCentavos} centavos (diferença de ${soma - valorCentavos}). `
      + 'Nenhum centavo pode nascer nem sumir no rateio.',
    );
  }
  return true;
}
