import { CORES_DE_CONTAMINADO, etiquetasDoEndereco } from './camposDoCiclo.js';
import { notasDaNf } from './notaFiscalDaSemente.js';

const ZERO_POR_COR = Object.fromEntries(CORES_DE_CONTAMINADO.map((cor) => [cor, 0]));

export const mesDe = (iso) => (iso ? String(iso).slice(0, 7) : null);

const dentro = (data, inicio, fim) =>
  Boolean(data) && (!inicio || data >= inicio) && (!fim || data <= fim);

const numero = (v) => (v == null ? 0 : Number(v));

const kg3 = (v) => Math.round(v * 1000) / 1000;

export function totaisDoPeriodo({ lotes = [], colheitas = [], eventos = [] } = {}, filtro = {}) {
  const { inicio, fim, tipo } = filtro;
  const loteDe = new Map(lotes.map((l) => [l.id, l]));
  const doTipo = (l) => !tipo || l?.tipo === tipo;

  const zero = () => ({
    blocos_produzidos: 0, blocos_contaminados: 0, blocos_abertos: 0,
    kg_colhidos: 0,
  });
  const geral = zero();
  const porTipo = new Map();
  const balde = (t) => {
    if (!porTipo.has(t)) porTipo.set(t, zero());
    return porTipo.get(t);
  };
  const somar = (l, campo, valor) => {
    geral[campo] += valor;
    balde(l.tipo ?? '(sem tipo)')[campo] += valor;
  };

  for (const l of lotes) {
    if (!doTipo(l)) continue;
    if (dentro(l.data_lote, inicio, fim)) somar(l, 'blocos_produzidos', numero(l.blocos_produzidos));
    if (dentro(l.data_abertura, inicio, fim)) somar(l, 'blocos_abertos', numero(l.blocos_abertos));
  }
  for (const c of colheitas) {
    const l = loteDe.get(c.lote_id);
    if (!l || !doTipo(l) || !dentro(c.data_colheita, inicio, fim)) continue;
    somar(l, 'kg_colhidos', numero(c.total_kg));
  }
  for (const e of eventos) {
    const l = loteDe.get(e.lote_id);
    if (!l || !doTipo(l) || !dentro(e.data_evento, inicio, fim)) continue;
    if (e.tipo !== 'CONTAMINACAO') continue;
    somar(l, 'blocos_contaminados', numero(e.quantidade));
  }

  const doPeriodo = lotes.filter((l) => doTipo(l) && dentro(l.data_lote, inicio, fim));

  const arredondar = (b) => ({
    ...b,
    kg_colhidos: kg3(b.kg_colhidos),
  });
  return {
    ...arredondar(geral),
    por_tipo: [...porTipo.entries()].sort(([a], [b]) => a.localeCompare(b))
      .map(([t, b]) => ({ tipo: t, ...arredondar(b) })),
    cobertura: {
      estantes: doPeriodo.length,
      estantes_com_abertura: doPeriodo.filter((l) => l.blocos_abertos != null).length,
      estantes_com_data_abertura: doPeriodo.filter((l) => l.data_abertura).length,
      estantes_sem_quantidade: doPeriodo.filter((l) => l.data_abertura && l.blocos_abertos == null).length,
    },
  };
}

const ANO_MINIMO_VALIDO = 2000;

export function mesesDoIntervalo({ lotes = [], colheitas = [], eventos = [] } = {}, filtro = {}) {
  const { inicio, fim, tipo } = filtro;
  const loteDe = new Map(lotes.map((l) => [l.id, l]));
  const doTipo = (l) => !tipo || l?.tipo === tipo;
  const todas = [
    ...lotes.filter(doTipo).flatMap((l) => [l.data_lote, l.data_abertura]),
    ...colheitas.filter((c) => doTipo(loteDe.get(c.lote_id))).map((c) => c.data_colheita),
    ...eventos.filter((e) => doTipo(loteDe.get(e.lote_id))).map((e) => e.data_evento),
  ].filter(Boolean);
  const valida = (d) => Number(String(d).slice(0, 4)) >= ANO_MINIMO_VALIDO;
  const datas = todas.filter(valida).sort();
  const ignoradas = todas.length - datas.length;

  const de = mesDe(inicio) ?? mesDe(datas.at(0));
  const ate = mesDe(fim) ?? mesDe(datas.at(-1));
  if (!de || !ate || de > ate) return { meses: [], ignoradas, truncado: false };

  const meses = [];
  let [ano, mes] = de.split('-').map(Number);
  for (let guarda = 0; guarda < 600; guarda += 1) {
    const atual = `${ano}-${String(mes).padStart(2, '0')}`;
    meses.push(atual);
    if (atual >= ate) break;
    mes += 1;
    if (mes > 12) { mes = 1; ano += 1; }
  }
  const truncado = meses[meses.length - 1] < ate;
  return { meses, ignoradas, truncado };
}

const razao = (num, den) => (den ? num / den : null);

const mediana = (valores) => {
  if (!valores.length) return null;
  const ordenados = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ordenados.length / 2);
  return ordenados.length % 2 ? ordenados[meio] : (ordenados[meio - 1] + ordenados[meio]) / 2;
};

const diasEntre = (de, ate) => {
  if (!de || !ate) return null;
  return Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86400000);
};

export function serieMensal(dados = {}, filtro = {}) {
  const { meses } = mesesDoIntervalo(dados, filtro);
  return meses.map((mes) => {
    const inicio = filtro.inicio && filtro.inicio > `${mes}-01` ? filtro.inicio : `${mes}-01`;
    const fim = filtro.fim && filtro.fim < `${mes}-31` ? filtro.fim : `${mes}-31`;
    const t = totaisDoPeriodo(dados, { ...filtro, inicio, fim });
    return {
      mes,
      blocos_produzidos: t.blocos_produzidos,
      blocos_contaminados: t.blocos_contaminados,
      blocos_abertos: t.blocos_abertos,
      kg_colhidos: t.kg_colhidos,
    };
  });
}

export const TOLERANCIA_BLOCOS = 10;

export const EIXOS_DO_FILTRO = ['LOTE', 'ABERTURA'];

export function estantesColhidasDoLote(colheitasDoLote = []) {
  const porEstante = new Map();
  let kgSemEstante = 0;
  let colheitasSemEstante = 0;

  for (const c of colheitasDoLote) {
    const kg = numero(c.total_kg);
    const etiquetas = etiquetasDoEndereco(c.estante);
    for (const et of etiquetas) {
      if (!porEstante.has(et)) porEstante.set(et, { kg: 0, colheitas: 0 });
    }
    if (etiquetas.length === 1) {
      const a = porEstante.get(etiquetas[0]);
      a.kg += kg;
      a.colheitas += 1;
    } else {
      kgSemEstante += kg;
      colheitasSemEstante += 1;
    }
  }

  const estantes = [...porEstante.keys()]
    .sort((a, b) => a.localeCompare(b, 'pt', { numeric: true }));
  const kgPorEstante = estantes.map((estante) => {
    const a = porEstante.get(estante);
    return { estante, kg: kg3(a.kg), colheitas: a.colheitas };
  }).sort((a, b) => b.kg - a.kg || a.estante.localeCompare(b.estante, 'pt', { numeric: true }));

  return {
    estantes,
    total: estantes.length,
    kg_por_estante: kgPorEstante,
    kg_sem_estante: kg3(kgSemEstante),
    colheitas_sem_estante: colheitasSemEstante,
  };
}

export function agruparEmLotes({ lotes = [], colheitas = [], eventos = [] } = {}, filtro = {}, opcoes = {}) {
  const { inicio, fim, tipo, eixo = 'LOTE' } = filtro;
  if (!EIXOS_DO_FILTRO.includes(eixo)) {
    throw new Error(`eixo inválido: use ${EIXOS_DO_FILTRO.join(' | ')}.`);
  }
  const { toleranciaBlocos = TOLERANCIA_BLOCOS } = opcoes;
  const campoDoEixo = eixo === 'ABERTURA' ? 'data_abertura' : 'data_lote';

  const porEstante = new Map();
  const colheitasCruasPorLinha = new Map();
  for (const c of colheitas) {
    if (!porEstante.has(c.lote_id)) porEstante.set(c.lote_id, { kg: 0, kg_p: 0, kg_m: 0, kg_g: 0, kg_gg: 0, colheu: false });
    const a = porEstante.get(c.lote_id);
    a.kg += numero(c.total_kg);
    a.kg_p += numero(c.kg_p);
    a.kg_m += numero(c.kg_m);
    a.kg_g += numero(c.kg_g);
    a.kg_gg += numero(c.kg_gg);
    a.colheu = true;
    if (!colheitasCruasPorLinha.has(c.lote_id)) colheitasCruasPorLinha.set(c.lote_id, []);
    colheitasCruasPorLinha.get(c.lote_id).push(c);
  }
  const coresPorEstante = new Map();
  for (const e of eventos) {
    if (!coresPorEstante.has(e.lote_id)) coresPorEstante.set(e.lote_id, { ...ZERO_POR_COR, total: 0, perdidos: 0, semCor: 0 });
    const c = coresPorEstante.get(e.lote_id);
    const q = numero(e.quantidade);
    if (e.tipo !== 'CONTAMINACAO') { c.perdidos += q; continue; }
    c.total += q;
    if (CORES_DE_CONTAMINADO.includes(e.tipo_contaminado)) c[e.tipo_contaminado] += q;
    else c.semCor += q;
  }

  const grupos = new Map();
  for (const l of lotes) {
    if (tipo && !String(tipo).split(',').includes(l.tipo)) continue;
    if (!dentro(l[campoDoEixo], inicio, fim)) continue;
    const chave = `${l.data_lote}|${l.tipo}`;
    if (!grupos.has(chave)) {
      grupos.set(chave, {
        chave,
        data_lote: l.data_lote,
        tipo: l.tipo,
        estantes: 0,
        estante_ids: [],
        galpoes: new Set(),
        estantes_maturacao: [],
        nfs: new Set(),
        nf_notas_set: new Set(),
        blocos_produzidos: 0,
        temNumero: false,
        blocos_abertos: 0,
        temAbertura: false,
        estantesSemQuantidade: 0,
        data_abertura: null,
        kg_colhidos: 0,
        kg_p: 0, kg_m: 0, kg_g: 0, kg_gg: 0,
        colheu: false,
        blocos_contaminados: 0,
        contaminacao_verde: 0,
        contaminacao_laranja: 0,
        contaminacao_preta: 0,
        contaminacao_sem_cor: 0,
        blocosPerdidos: 0,
        colheitasBrutas: [],
      });
    }
    const g = grupos.get(chave);
    g.estantes += 1;
    g.estante_ids.push(l.id);
    if (l.galpao) g.galpoes.add(l.galpao);
    if (l.estante_maturacao != null) g.estantes_maturacao.push(String(l.estante_maturacao));
    if (l.nf_semente) g.nfs.add(String(l.nf_semente).trim());
    for (const n of notasDaNf(l.nf_semente)) g.nf_notas_set.add(n);
    if (numero(l.blocos_produzidos) > 0) g.temNumero = true;
    g.blocos_produzidos += numero(l.blocos_produzidos);
    if (l.blocos_abertos != null) { g.blocos_abertos += numero(l.blocos_abertos); g.temAbertura = true; }
    if (l.data_abertura && l.blocos_abertos == null) g.estantesSemQuantidade += 1;
    if (l.data_abertura && (!g.data_abertura || l.data_abertura < g.data_abertura)) g.data_abertura = l.data_abertura;

    const colh = porEstante.get(l.id);
    if (colh) {
      g.kg_colhidos += colh.kg; g.kg_p += colh.kg_p; g.kg_m += colh.kg_m;
      g.kg_g += colh.kg_g; g.kg_gg += colh.kg_gg; g.colheu = true;
    }
    const colheitasDaLinha = colheitasCruasPorLinha.get(l.id);
    if (colheitasDaLinha) g.colheitasBrutas.push(...colheitasDaLinha);
    const cor = coresPorEstante.get(l.id);
    if (cor) {
      g.blocos_contaminados += cor.total;
      g.contaminacao_verde += cor.VERDE;
      g.contaminacao_laranja += cor.LARANJA;
      g.contaminacao_preta += cor.PRETA;
      g.contaminacao_sem_cor += cor.semCor;
      g.blocosPerdidos += cor.perdidos;
    }
  }

  return [...grupos.values()]
    .sort((a, b) => a.chave.localeCompare(b.chave))
    .map((g) => {
      const abertos = g.temAbertura ? g.blocos_abertos : null;
      const kg = g.colheu ? kg3(g.kg_colhidos) : null;
      const produzidos = g.temNumero ? g.blocos_produzidos : null;
      const inconsistente = abertos != null && produzidos > 0
        && (abertos > produzidos
          || abertos + g.blocos_contaminados > produzidos);

      const mensuravel = abertos != null && g.estantesSemQuantidade === 0 && produzidos != null;

      const estado = !g.data_abertura ? 'EM_MATURACAO'
        : abertos == null ? 'ABERTURA_SEM_QUANTIDADE'
          : g.estantesSemQuantidade > 0 ? 'ABERTURA_PARCIAL'
            : 'ABERTO';

      const perdaBlocos = mensuravel ? produzidos - g.blocos_contaminados - g.blocosPerdidos - abertos : null;

      return {
        chave: g.chave,
        data_lote: g.data_lote,
        tipo: g.tipo,
        estantes: g.estantes,
        estante_ids: g.estante_ids,
        galpoes: [...g.galpoes].sort(),
        estantes_maturacao: g.estantes_maturacao,
        estantes_colhidas: estantesColhidasDoLote(g.colheitasBrutas),
        nf_semente: [...g.nfs].sort().join(' · ') || null,
        nf_notas: [...g.nf_notas_set].sort(),
        blocos_produzidos: produzidos,
        blocos_abertos: abertos,
        blocos_contaminados: g.blocos_contaminados,
        contaminacao_verde: g.contaminacao_verde,
        contaminacao_laranja: g.contaminacao_laranja,
        contaminacao_preta: g.contaminacao_preta,
        contaminacao_sem_cor: g.contaminacao_sem_cor,
        blocos_perdidos: g.blocosPerdidos,
        data_abertura: g.data_abertura,
        dias_ate_abertura: diasEntre(g.data_lote, g.data_abertura),
        kg_colhidos: kg,
        kg_p: kg3(g.kg_p), kg_m: kg3(g.kg_m), kg_g: kg3(g.kg_g), kg_gg: kg3(g.kg_gg),
        estantes_sem_quantidade: g.estantesSemQuantidade,
        estado,
        mensuravel,
        inconsistente,
        divergente: perdaBlocos != null && Math.abs(perdaBlocos) > toleranciaBlocos,
        tolerancia_blocos: toleranciaBlocos,
        perda_total_blocos: perdaBlocos,
        perda_total_pct: (perdaBlocos == null || !produzidos)
          ? null : perdaBlocos / produzidos,
        taxa_contaminacao: razao(g.blocos_contaminados, produzidos),
        taxa_aproveitamento: mensuravel ? razao(abertos, produzidos) : null,
        kg_por_bloco_aberto: (mensuravel && abertos && kg != null) ? razao(kg, abertos) : null,
        eficiencia_total: kg == null ? null : razao(kg, produzidos),
      };
    });
}

export function eficienciaPorCoorte(dados = {}, filtro = {}) {
  const doPeriodo = agruparEmLotes(dados, filtro);

  const metricas = (grupo) => {
    const comAbertura = grupo.filter((l) => l.blocos_abertos != null);
    const mensuraveis = grupo.filter((l) => l.mensuravel);
    const soma = (lista, f) => lista.reduce((s, l) => s + f(l), 0);
    const contar = (estado) => grupo.filter((l) => l.estado === estado).length;

    const produzidos = soma(grupo, (l) => l.blocos_produzidos);
    const contaminados = soma(grupo, (l) => l.blocos_contaminados);
    const kg = kg3(soma(grupo, (l) => l.kg_colhidos ?? 0));

    const produzidosCA = soma(mensuraveis, (l) => l.blocos_produzidos);
    const abertosCA = soma(mensuraveis, (l) => l.blocos_abertos);
    const kgCA = kg3(soma(mensuraveis, (l) => l.kg_colhidos ?? 0));
    const perdaBlocosCA = soma(mensuraveis, (l) => l.perda_total_blocos);

    return {
      blocos_produzidos: produzidos,
      blocos_contaminados: contaminados,
      blocos_abertos: abertosCA,
      kg_colhidos: kg,
      lotes: grupo.length,
      estantes: soma(grupo, (l) => l.estantes),
      lotes_com_abertura: comAbertura.length,
      lotes_mensuraveis: mensuraveis.length,
      lotes_em_maturacao: contar('EM_MATURACAO'),
      lotes_abertura_sem_quantidade: contar('ABERTURA_SEM_QUANTIDADE'),
      lotes_com_abertura_parcial: contar('ABERTURA_PARCIAL'),
      lotes_com_dado_faltante: contar('ABERTURA_SEM_QUANTIDADE') + contar('ABERTURA_PARCIAL'),
      nao_mensuraveis: {
        em_maturacao: grupo.filter((l) => !l.mensuravel && l.estado === 'EM_MATURACAO').length,
        dado_faltante: grupo.filter((l) => !l.mensuravel
          && (l.estado === 'ABERTURA_SEM_QUANTIDADE' || l.estado === 'ABERTURA_PARCIAL')).length,
        sem_contagem_de_produzidos: grupo.filter((l) => !l.mensuravel && l.estado === 'ABERTO').length,
      },
      estantes_sem_quantidade: soma(grupo, (l) => l.estantes_sem_quantidade),
      lotes_com_colheita: grupo.filter((l) => l.kg_colhidos != null).length,
      lotes_inconsistentes: grupo.filter((l) => l.inconsistente).length,
      lotes_divergentes: grupo.filter((l) => l.divergente).length,
      lotes_dentro_da_tolerancia: mensuraveis.filter((l) => !l.divergente).length,
      taxa_contaminacao: razao(contaminados, produzidos),
      eficiencia_total: razao(kg, produzidos),
      taxa_aproveitamento: razao(abertosCA, produzidosCA),
      perda_total_blocos: mensuraveis.length ? perdaBlocosCA : null,
      perda_total_pct: razao(perdaBlocosCA, produzidosCA),
      kg_por_bloco_aberto: razao(kgCA, abertosCA),
      dias_ate_abertura_mediana: mediana(
        grupo.map((l) => l.dias_ate_abertura).filter((v) => v != null),
      ),
    };
  };

  const agrupar = (chave) => {
    const mapa = new Map();
    for (const l of doPeriodo) {
      const k = chave(l);
      if (!mapa.has(k)) mapa.set(k, []);
      mapa.get(k).push(l);
    }
    return [...mapa.entries()].sort(([a], [b]) => String(a).localeCompare(String(b)));
  };

  return {
    total: metricas(doPeriodo),
    por_mes: agrupar((l) => mesDe(l.data_lote)).map(([mes, g]) => ({ mes, ...metricas(g) })),
    por_tipo: agrupar((l) => l.tipo ?? '(sem tipo)').map(([t, g]) => ({ tipo: t, ...metricas(g) })),
  };
}

export function melhorPerformance(dados = {}, filtro = {}) {
  const ef = eficienciaPorCoorte(dados, filtro);
  const porMes = new Map();
  for (const l of agruparEmLotes(dados, filtro)) {
    const mes = mesDe(l.data_lote);
    if (!porMes.has(mes)) porMes.set(mes, { kg_p: 0, kg_m: 0, kg_g: 0, kg_gg: 0, tipos: new Set() });
    const a = porMes.get(mes);
    a.kg_p += l.kg_p; a.kg_m += l.kg_m; a.kg_g += l.kg_g; a.kg_gg += l.kg_gg;
    a.tipos.add(l.tipo);
  }

  return ef.por_mes.map((m) => {
    const a = porMes.get(m.mes) ?? { kg_p: 0, kg_m: 0, kg_g: 0, kg_gg: 0, tipos: new Set() };
    const kgP = kg3(a.kg_p);
    const kgM = kg3(a.kg_m);
    const kgG = kg3(a.kg_g);
    const kgGG = kg3(a.kg_gg);
    const kgFaixas = kgP + kgM + kgG + kgGG;
    const soSH = a.tipos.size === 1 && a.tipos.has('SH');
    return {
      mes: m.mes,
      blocos_produzidos: m.blocos_produzidos,
      kg_colhidos: m.kg_colhidos,
      kg_p: kgP,
      kg_m: kgM,
      kg_g: kgG,
      kg_gg: kgGG,
      pct_p: soSH ? razao(kgP, kgFaixas) : null,
      pct_m: soSH ? razao(kgM, kgFaixas) : null,
      pct_g: soSH ? razao(kgG, kgFaixas) : null,
      pct_gg: soSH ? razao(kgGG, kgFaixas) : null,
      kg_por_bloco_aberto: m.kg_por_bloco_aberto,
      eficiencia_total: m.eficiencia_total,
      taxa_contaminacao: m.taxa_contaminacao,
      perda_total_pct: m.perda_total_pct,
      lotes: m.lotes,
      lotes_com_abertura: m.lotes_com_abertura,
      lotes_mensuraveis: m.lotes_mensuraveis,
      lotes_inconsistentes: m.lotes_inconsistentes,
    };
  });
}

export function rankingDeLotes(dados = {}, filtro = {}) {
  const { limite = 10 } = filtro;
  const doPeriodo = agruparEmLotes(dados, filtro);

  const ordenar = (campo, direcao) => [...doPeriodo]
    .filter((d) => d[campo] != null)
    .sort((a, b) => (direcao === 'asc' ? a[campo] - b[campo] : b[campo] - a[campo])
      || String(a.data_lote).localeCompare(String(b.data_lote)))
    .slice(0, limite);

  return {
    limite,
    menor_contaminacao: ordenar('taxa_contaminacao', 'asc'),
    maior_kg_por_bloco_aberto: ordenar('kg_por_bloco_aberto', 'desc'),
    maior_eficiencia: ordenar('eficiencia_total', 'desc'),
    maior_kg: ordenar('kg_colhidos', 'desc'),
    excluidos: {
      em_maturacao: doPeriodo.filter((d) => d.estado === 'EM_MATURACAO').length,
      dado_faltante: doPeriodo.filter((d) => d.estado === 'ABERTURA_SEM_QUANTIDADE'
        || d.estado === 'ABERTURA_PARCIAL').length,
      sem_colheita: doPeriodo.filter((d) => d.kg_colhidos == null).length,
      inconsistentes: doPeriodo.filter((d) => d.inconsistente).length,
    },
  };
}

export const PARAMETRO_ABERTURA_DIAS = { SH: 90, SB: 30, SP: 30, SS: 30 };

export function prazosPorTipo(dados = {}, filtro = {}, parametros = PARAMETRO_ABERTURA_DIAS) {
  const porTipo = new Map();
  for (const l of agruparEmLotes(dados, filtro)) {
    const t = l.tipo ?? '(sem tipo)';
    if (!porTipo.has(t)) porTipo.set(t, { validos: [], invertidas: 0, semAbertura: 0 });
    const g = porTipo.get(t);
    if (l.dias_ate_abertura == null) { g.semAbertura += 1; continue; }
    if (l.dias_ate_abertura < 0) { g.invertidas += 1; continue; }
    g.validos.push(l.dias_ate_abertura);
  }

  return [...porTipo.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([tipo, g]) => {
    const parametro = parametros[tipo] ?? null;
    const med = mediana(g.validos);
    const acima = parametro == null ? null : g.validos.filter((v) => v > parametro).length;
    return {
      tipo,
      parametro_dias: parametro,
      lotes: g.validos.length,
      lotes_sem_abertura: g.semAbertura,
      datas_invertidas: g.invertidas,
      mediana_dias: med,
      minimo_dias: g.validos.length ? Math.min(...g.validos) : null,
      maximo_dias: g.validos.length ? Math.max(...g.validos) : null,
      acima_do_parametro: acima,
      pct_acima: (acima == null || !g.validos.length) ? null : acima / g.validos.length,
      desvio_mediana: (parametro == null || med == null) ? null : med - parametro,
    };
  });
}
