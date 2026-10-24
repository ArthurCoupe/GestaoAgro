import { agruparEmLotes, totaisDoPeriodo } from './painelDoCiclo.js';
import { NOME_DO_TIPO, TIPOS_DE_COGUMELO, totaisDaEmbalagem, variacaoPct } from './conferenciaEmbalagem.js';
import { etapaDoLote } from './etapaDoLote.js';

const DIA = 86400000;
const somaDias = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * DIA).toISOString().slice(0, 10);
const diasEntre = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DIA);
const ultimoDia = (ano, mes) => new Date(Date.UTC(ano, mes, 0)).getUTCDate();
const pad = (v) => String(v).padStart(2, '0');
const iso = (ano, mes, dia) => `${ano}-${pad(mes)}-${pad(dia)}`;
const dataValida = (v) => {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const t = Date.parse(`${v}T00:00:00Z`);
  return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === v;
};
const dentro = (d, j) => Boolean(d) && d >= j.inicio && d <= j.fim;

export const PERIODOS_DO_PAINEL = ['hoje', '7', '10', '30', 'mes', 'ytd', 'ano', 'lote'];
export const TIPOS_DO_PAINEL = TIPOS_DE_COGUMELO;
const MOVEIS = { hoje: 1, 7: 7, 10: 10, 30: 30 };

export function janelaDoPeriodo({ periodo, hoje, mes, ano, lote } = {}) {
  const p = periodo == null || periodo === '' ? 'hoje' : periodo;
  if (typeof p !== 'string' || !PERIODOS_DO_PAINEL.includes(p)) return { erro: `Período inválido: use ${PERIODOS_DO_PAINEL.join(', ')}.` };
  const [aH, mH] = [Number(hoje.slice(0, 4)), Number(hoje.slice(5, 7))];
  if (MOVEIS[p]) return { modo: p, inicio: somaDias(hoje, -(MOVEIS[p] - 1)), fim: hoje };
  if (p === 'mes') {
    const m = mes == null || mes === '' ? hoje.slice(0, 7) : mes;
    if (typeof m !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(m)) return { erro: 'Mês inválido: use AAAA-MM.' };
    const [a, mm] = [Number(m.slice(0, 4)), Number(m.slice(5, 7))];
    if (a * 12 + mm > aH * 12 + mH) return { erro: 'O mês pedido ainda não começou.' };
    const fimDoMes = iso(a, mm, ultimoDia(a, mm));
    return { modo: 'mes', inicio: iso(a, mm, 1), fim: fimDoMes < hoje ? fimDoMes : hoje };
  }
  if (p === 'ytd') return { modo: 'ytd', inicio: iso(aH, 1, 1), fim: hoje };
  if (p === 'ano') {
    const a = ano == null || ano === '' ? String(aH) : ano;
    if (typeof a !== 'string' || !/^\d{4}$/.test(a)) return { erro: 'Ano inválido: use AAAA.' };
    if (Number(a) > aH) return { erro: 'O ano pedido ainda não começou.' };
    return { modo: 'ano', inicio: `${a}-01-01`, fim: Number(a) === aH ? hoje : `${a}-12-31` };
  }
  const [data, tipo] = typeof lote === 'string' ? lote.split('|') : [];
  if (!dataValida(data) || !TIPOS_DO_PAINEL.includes(tipo)) return { erro: 'Lote inválido: use a data de produção e o tipo (AAAA-MM-DD|SH).' };
  return { modo: 'lote', lote: `${data}|${tipo}`, data_lote: data, tipo };
}

export function janelasAnteriores(j, n = 3) {
  const out = [];
  for (let k = 1; k <= n; k += 1) {
    if (MOVEIS[j.modo]) {
      const tam = diasEntre(j.inicio, j.fim) + 1;
      out.push({ inicio: somaDias(j.inicio, -k * tam), fim: somaDias(j.fim, -k * tam) });
    } else if (j.modo === 'mes') {
      const [a, m, dFim] = [Number(j.fim.slice(0, 4)), Number(j.fim.slice(5, 7)), Number(j.fim.slice(8, 10))];
      const total = a * 12 + (m - 1) - k;
      const [aa, mm] = [Math.floor(total / 12), (total % 12) + 1];
      const fechado = dFim === ultimoDia(a, m);
      out.push({ inicio: iso(aa, mm, 1), fim: iso(aa, mm, fechado ? ultimoDia(aa, mm) : Math.min(dFim, ultimoDia(aa, mm))) });
    } else {
      const a = Number(j.inicio.slice(0, 4)) - k;
      const [mF, dF] = [Number(j.fim.slice(5, 7)), Number(j.fim.slice(8, 10))];
      out.push({ inicio: `${a}-01-01`, fim: iso(a, mF, Math.min(dF, ultimoDia(a, mF))) });
    }
  }
  return out;
}

const somaOuNull = (xs) => (xs.some((x) => x == null) ? null : xs.reduce((t, x) => t + x, 0));
const razao = (a, b) => (a == null || !b ? null : a / b);

function somasDaJanela(dados, embalagem, j, tipo, inicioDe, atual = false) {
  const t = totaisDoPeriodo(dados, { inicio: j.inicio, fim: j.fim, tipo });
  const doTipo = (l) => l && (!tipo || l.tipo === tipo);
  const loteDe = new Map((dados.lotes ?? []).map((l) => [l.id, l]));
  const chave = (l) => `${l.data_lote}|${l.tipo}`;
  const comHistorico = (fonte) => inicioDe[fonte] != null && (atual ? j.fim >= inicioDe[fonte] : j.inicio >= inicioDe[fonte]);

  const doPeriodo = (dados.lotes ?? []).filter((l) => doTipo(l) && dentro(l.data_lote, j));
  const idsDoPeriodo = new Set(doPeriodo.map((l) => l.id));
  const daCoorte = (dados.eventos ?? []).filter((e) => e.tipo === 'CONTAMINACAO' && idsDoPeriodo.has(e.lote_id))
    .reduce((t, e) => t + Number(e.quantidade ?? 0), 0);
  const lotesColhidos = new Set((dados.colheitas ?? []).filter((c) => dentro(c.data_colheita, j))
    .map((c) => loteDe.get(c.lote_id)).filter((l) => doTipo(l) && l.data_lote).map(chave));
  const afetados = new Set((dados.eventos ?? []).filter((e) => e.tipo === 'CONTAMINACAO' && dentro(e.data_evento, j))
    .map((e) => loteDe.get(e.lote_id)).filter((l) => doTipo(l) && l.data_lote).map(chave));

  const tamanhos = tipo && tipo !== 'SH' ? null : tamanhosDoShiitake((dados.colheitas ?? [])
    .filter((c) => dentro(c.data_colheita, j) && loteDe.get(c.lote_id)?.tipo === 'SH'));

  let bandejas = null;
  if (embalagem && comHistorico('embalagem')) {
    const e = totaisDaEmbalagem({ produtos: embalagem.produtos ?? [], registros: embalagem.registros ?? [] }, j);
    const b = tipo ? e.por_tipo.find((x) => x.tipo === tipo) : e.total;
    const unidades = b ? b.bandejas_200g + b.embalagens_1kg : 0;
    bandejas = unidades > 0 ? unidades : null;
  }
  const producao = comHistorico('producao');
  const colheita = comHistorico('colheita');
  const retirada = comHistorico('retirada');
  return {
    blocos_produzidos: producao ? t.blocos_produzidos : null,
    lotes_produzidos: producao ? new Set(doPeriodo.map(chave)).size : null,
    dias_produzidos: producao ? new Set(doPeriodo.map((l) => l.data_lote)).size : null,
    kg_colhidos: colheita ? t.kg_colhidos : null,
    lotes_colhidos: colheita ? lotesColhidos.size : null,
    ...doShiitake(colheita ? tamanhos : null),
    bandejas,
    blocos_contaminados: retirada ? t.blocos_contaminados : null,
    lotes_afetados: retirada ? afetados.size : null,
    contaminados_da_coorte: producao ? daCoorte : null,
  };
}

function somasDoLote(dados, chaveDoLote, inicioDe) {
  const linhas = (dados.lotes ?? []).filter((l) => `${l.data_lote}|${l.tipo}` === chaveDoLote);
  const ids = new Set(linhas.map((l) => l.id));
  const soma = (xs) => xs.reduce((t, x) => t + Number(x ?? 0), 0);
  const colheitas = (dados.colheitas ?? []).filter((c) => ids.has(c.lote_id));
  const colheuForaDoSistema = inicioDe.colheita == null || linhas.some((l) => l.data_abertura && l.data_abertura < inicioDe.colheita);
  const kg = colheitas.length && !colheuForaDoSistema ? Math.round(soma(colheitas.map((c) => c.total_kg)) * 1000) / 1000 : null;
  const [dataDoLote, tipoDoLote] = chaveDoLote.split('|');
  const contaminados = inicioDe.retirada == null || dataDoLote < inicioDe.retirada ? null
    : soma((dados.eventos ?? []).filter((e) => e.tipo === 'CONTAMINACAO' && ids.has(e.lote_id)).map((e) => e.quantidade));
  const tamanhos = kg != null && tipoDoLote === 'SH' ? tamanhosDoShiitake(colheitas) : null;
  return {
    blocos_produzidos: soma(linhas.map((l) => l.blocos_produzidos)),
    lotes_produzidos: null, dias_produzidos: null,
    kg_colhidos: kg,
    lotes_colhidos: null,
    ...doShiitake(tamanhos),
    bandejas: null,
    blocos_contaminados: contaminados,
    lotes_afetados: null,
    contaminados_da_coorte: contaminados,
  };
}

const METRICAS = {
  blocos_produzidos: { melhor: 'MAIOR' },
  lotes_produzidos: { melhor: null },
  dias_produzidos: { melhor: null },
  blocos_por_lote: { melhor: null, num: 'blocos_produzidos', den: 'lotes_produzidos' },
  blocos_por_dia: { melhor: 'MAIOR', num: 'blocos_produzidos', den: 'dias_produzidos' },
  kg_colhidos: { melhor: 'MAIOR' },
  lotes_colhidos: { melhor: null },
  kg_por_lote: { melhor: 'MAIOR', num: 'kg_colhidos', den: 'lotes_colhidos' },
  kg_classificado: { melhor: null },
  kg_m_ou_maior: { melhor: null },
  pct_m_ou_maior: { melhor: 'MAIOR', num: 'kg_m_ou_maior', den: 'kg_classificado' },
  kg_p: { melhor: null }, kg_m: { melhor: null }, kg_g: { melhor: null }, kg_gg: { melhor: null },
  pct_p: { melhor: 'MENOR', num: 'kg_p', den: 'kg_classificado' },
  pct_m: { melhor: null, num: 'kg_m', den: 'kg_classificado' },
  pct_g: { melhor: 'MAIOR', num: 'kg_g', den: 'kg_classificado' },
  pct_gg: { melhor: 'MAIOR', num: 'kg_gg', den: 'kg_classificado' },
  bandejas: { melhor: 'MAIOR' },
  bandejas_por_lote: { melhor: 'MAIOR', num: 'bandejas', den: 'lotes_colhidos' },
  blocos_contaminados: { melhor: 'MENOR' },
  lotes_afetados: { melhor: 'MENOR' },
  contaminados_da_coorte: { melhor: 'MENOR' },
  taxa_contaminacao: { melhor: 'MENOR', num: 'contaminados_da_coorte', den: 'blocos_produzidos' },
};

const valorDe = (somas, def, nome) => (def.num ? razao(somas[def.num], somas[def.den]) : somas[nome]);
const mediaDe = (lista, def, nome) => {
  if (lista.length < 3 || lista.some((s) => s == null)) return null;
  if (!def.num) {
    const t = somaOuNull(lista.map((s) => s[nome]));
    return t == null ? null : t / lista.length;
  }
  return razao(somaOuNull(lista.map((s) => s[def.num])), somaOuNull(lista.map((s) => s[def.den])));
};

const kg3 = (v) => Math.round(v * 1000) / 1000;
const salaDaColheita = (estante) => {
  const m = /^\s*F\s*(\d)(?!\d)/i.exec(estante ?? '');
  return m ? `F${Number(m[1])}` : null;
};
function tamanhosDoShiitake(colheitas) {
  const soma = (f) => (colheitas.length > 0 && colheitas.every((c) => c[f] == null) ? null
    : kg3(colheitas.reduce((t, c) => t + Number(c[f] ?? 0), 0)));
  const [p, m, g, gg] = ['kg_p', 'kg_m', 'kg_g', 'kg_gg'].map(soma);
  const mais = (...xs) => kg3(xs.reduce((t, x) => t + (x ?? 0), 0));
  return { kg_classificado: mais(p, m, g, gg), kg_m_ou_maior: mais(m, g, gg), kg_p: p, kg_m: m, kg_g: g, kg_gg: gg };
}
const CAMPOS_DO_SHIITAKE = ['kg_classificado', 'kg_m_ou_maior', 'kg_p', 'kg_m', 'kg_g', 'kg_gg'];
const doShiitake = (t) => Object.fromEntries(CAMPOS_DO_SHIITAKE.map((k) => [k, t ? t[k] : null]));

const TAMANHOS = ['kg_p', 'kg_m', 'kg_g', 'kg_gg'];
const porLinha = (xs) => xs.reduce((m, x) => m.set(String(x.lote_id), [...(m.get(String(x.lote_id)) ?? []), x]), new Map());

function salasDoLote(l, aberturas, colheitas) {
  const doLote = (m) => l.estante_ids.flatMap((id) => m.get(String(id)) ?? []);
  const blocos = new Map();
  const ab = doLote(aberturas);
  for (const a of ab) blocos.set(a.sala_destino ?? null, (blocos.get(a.sala_destino ?? null) ?? 0) + Number(a.quantidade ?? 0));
  if (blocos.size === 0 || blocos.has(null)) return { fora: 'sem_sala_na_abertura' };
  if (ab.some((a) => a.quantidade == null) || [...blocos.values()].reduce((t, q) => t + q, 0) !== l.blocos_abertos) return { fora: 'soma_diferente' };
  const unica = blocos.size === 1 ? [...blocos.keys()][0] : null;
  const salaDe = (c) => salaDaColheita(c.estante) ?? unica;
  const cs = doLote(colheitas);
  if (cs.some((c) => !blocos.has(salaDe(c)))) return { fora: 'colheita_sem_sala_da_abertura' };
  const salas = new Map([...blocos].map(([sala, q]) => [sala, { sala, blocos_abertos: q, kg_colhidos: 0, kg_p: 0, kg_m: 0, kg_g: 0, kg_gg: 0 }]));
  for (const c of cs) {
    const s = salas.get(salaDe(c));
    s.kg_colhidos += Number(c.total_kg ?? 0);
    for (const f of TAMANHOS) s[f] += Number(c[f] ?? 0);
  }
  return { salas: [...salas.values()] };
}

function estantesPorLote(dados) {
  const estantes = new Map();
  for (const e of dados.lotes ?? []) {
    const k = `${e.data_lote}|${e.tipo}`;
    estantes.set(k, [...(estantes.get(k) ?? []), e.id]);
  }
  return estantes;
}

function sementesPorLote(dados) {
  if (!Array.isArray(dados.sementesDosLotes)) return () => null;
  const codigo = new Map((dados.cepas ?? []).map((c) => [Number(c.id), c.codigo]));
  const porEstante = porLinha(dados.sementesDosLotes);
  const estantesDoLote = estantesPorLote(dados);
  return (l) => {
    const linhas = (estantesDoLote.get(l.chave) ?? l.estante_ids).flatMap((id) => porEstante.get(String(id)) ?? []);
    const anotadas = new Set(linhas.filter((s) => s.lote_semente != null).map((s) => `${s.cepa_id}|${s.nf}`));
    const vistas = new Map();
    for (const s of linhas.filter((x) => x.lote_semente != null || !anotadas.has(`${x.cepa_id}|${x.nf}`))) {
      const cepa = codigo.get(Number(s.cepa_id)) ?? `cepa ${s.cepa_id}`;
      vistas.set(JSON.stringify([cepa, s.lote_semente ?? null]), { cepa, lote_semente: s.lote_semente ?? null });
    }
    return [...vistas.values()].sort((a, b) => a.cepa.localeCompare(b.cepa) || String(a.lote_semente ?? '').localeCompare(String(b.lote_semente ?? '')));
  };
}

function sementeUsadaPorLote(dados) {
  if (!Array.isArray(dados.sementesMovimentos)) return () => ({ semente_pacotes: null, semente_fora: 'nao_carregou' });
  const siglaDoTipo = new Map(Object.entries(NOME_DO_TIPO).map(([sigla, nome]) => [nome, sigla]));
  const pacotes = new Map();
  const cepasDaSaida = new Map();
  for (const m of dados.sementesMovimentos) {
    if (m.tipo !== 'SAIDA' || m.ajuste || !dataValida(m.data)) continue;
    const k = `${somaDias(m.data, -1)}|${siglaDoTipo.get(m.tipo_cogumelo)}`;
    pacotes.set(k, (pacotes.get(k) ?? 0) + Number(m.quantidade ?? 0));
    if (m.cepa_id != null) cepasDaSaida.set(k, new Set([...(cepasDaSaida.get(k) ?? []), Number(m.cepa_id)]));
  }
  const estantesDoLote = estantesPorLote(dados);
  const cadastro = porLinha(Array.isArray(dados.sementesDosLotes) ? dados.sementesDosLotes : []);
  return (l) => {
    if (!(pacotes.get(l.chave) > 0)) return { semente_pacotes: null, semente_fora: 'sem_saida_no_dia' };
    const estantes = estantesDoLote.get(l.chave) ?? [];
    const noRecorte = new Set(l.estante_ids.map(String));
    if (estantes.some((id) => !noRecorte.has(String(id)))) return { semente_pacotes: null, semente_fora: 'lote_fora_do_recorte' };
    const doCadastro = new Set(estantes.flatMap((id) => cadastro.get(String(id)) ?? []).map((s) => Number(s.cepa_id)));
    if (doCadastro.size > 0 && [...(cepasDaSaida.get(l.chave) ?? [])].some((c) => !doCadastro.has(c))) return { semente_pacotes: null, semente_fora: 'cepa_diferente' };
    return { semente_pacotes: pacotes.get(l.chave), semente_fora: null };
  };
}

function rendimentoPorSala(lotes, salasDe, etapa) {
  const salas = new Map();
  const fora = { sem_sala_na_abertura: 0, soma_diferente: 0, colheita_sem_sala_da_abertura: 0 };
  for (const l of lotes) {
    const d = salasDe(l);
    if (d.fora) { fora[d.fora] += 1; continue; }
    for (const s of d.salas) {
      const k = `${s.sala}|${l.tipo}`;
      if (!salas.has(k)) salas.set(k, { sala: s.sala, tipo: l.tipo, lotes: 0, parciais: 0, inconsistentes: 0, blocos_abertos: 0, kg_colhidos: 0 });
      const acc = salas.get(k);
      acc.lotes += 1; acc.parciais += etapa(l.chave) ? 1 : 0; acc.inconsistentes += l.inconsistente ? 1 : 0;
      acc.blocos_abertos += s.blocos_abertos; acc.kg_colhidos += s.kg_colhidos;
    }
  }
  const ordemDoTipo = (t) => (['SH', 'SB', 'SP', 'SS'].indexOf(t) + 5) % 5;
  const linhas = [...salas.values()]
    .map((s) => ({ ...s, kg_colhidos: kg3(s.kg_colhidos), kg_por_bloco_aberto: razao(s.kg_colhidos, s.blocos_abertos) }))
    .sort((a, b) => ordemDoTipo(a.tipo) - ordemDoTipo(b.tipo) || (b.kg_por_bloco_aberto ?? -1) - (a.kg_por_bloco_aberto ?? -1) || a.sala.localeCompare(b.sala));
  return { linhas, fora };
}

function qualidadeDe(kg) {
  const total = kg3(kg.kg_p + kg.kg_m + kg.kg_g + kg.kg_gg);
  const pct = (v) => razao(v, total);
  return {
    kg_classificado: total,
    pct_p: pct(kg.kg_p), pct_m: pct(kg.kg_m), pct_g: pct(kg.kg_g), pct_gg: pct(kg.kg_gg),
    pct_m_ou_maior: pct(kg.kg_m + kg.kg_g + kg.kg_gg),
  };
}

function variacaoDaQualidade(dados, j, anterior, tipo, inicioDe, etapa) {
  if (tipo && tipo !== 'SH') return null;
  const loteDe = new Map((dados.lotes ?? []).map((l) => [l.id, l]));
  const doShiitakeEm = (w) => (dados.colheitas ?? []).filter((c) => dentro(c.data_colheita, w) && loteDe.get(c.lote_id)?.tipo === 'SH');
  const daJanela = doShiitakeEm(j);
  const t = tamanhosDoShiitake(daJanela);
  const b = anterior && inicioDe.colheita != null && anterior.inicio >= inicioDe.colheita ? tamanhosDoShiitake(doShiitakeEm(anterior)) : null;
  const base = b && b.kg_classificado > 0 ? b.kg_m_ou_maior / b.kg_classificado : null;
  const porLote = new Map();
  for (const c of daJanela) {
    const l = loteDe.get(c.lote_id);
    const chave = `${l.data_lote}|${l.tipo}`;
    if (!porLote.has(chave)) porLote.set(chave, { chave, data_lote: l.data_lote, tipo: l.tipo, kg_p: 0, kg_m: 0, kg_g: 0, kg_gg: 0 });
    const a = porLote.get(chave);
    for (const f of TAMANHOS) a[f] += Number(c[f] ?? 0);
  }
  const classificado = [...porLote.values()].reduce((s, a) => s + a.kg_p + a.kg_m + a.kg_g + a.kg_gg, 0);
  const lotes = [...porLote.values()]
    .map((a) => ({
      ...a, kg_p: kg3(a.kg_p), kg_m: kg3(a.kg_m), kg_g: kg3(a.kg_g), kg_gg: kg3(a.kg_gg), ...qualidadeDe(a),
      parcial: etapa(a.chave),
      efeito: base == null || !classificado ? null : (a.kg_m + a.kg_g + a.kg_gg - base * (a.kg_p + a.kg_m + a.kg_g + a.kg_gg)) / classificado,
    }))
    .filter((a) => a.kg_classificado > 0)
    .sort((x, y) => (x.efeito ?? 0) - (y.efeito ?? 0) || x.chave.localeCompare(y.chave));
  return {
    atual: t.kg_classificado > 0 ? t.kg_m_ou_maior / t.kg_classificado : null,
    base,
    kg_classificado: t.kg_classificado,
    kg_classificado_anterior: b ? b.kg_classificado : null,
    lotes,
  };
}

export function intervalosDoGrafico(j) {
  const dias = diasEntre(j.inicio, j.fim) + 1;
  const out = [];
  if (dias <= 31) {
    const passo = dias <= 12 ? 1 : 10;
    for (let k = 0; k < dias; k += passo) {
      const ate = dias - (k + passo) <= 2 && passo > 1 ? dias : Math.min(k + passo, dias);
      out.push({ inicio: somaDias(j.inicio, k), fim: somaDias(j.inicio, ate - 1) });
      if (ate === dias) break;
    }
    return out;
  }
  for (let d = j.inicio; d <= j.fim;) {
    const [a, m] = [Number(d.slice(0, 4)), Number(d.slice(5, 7))];
    const fimDoMes = iso(a, m, ultimoDia(a, m));
    out.push({ inicio: d, fim: fimDoMes < j.fim ? fimDoMes : j.fim });
    d = somaDias(fimDoMes, 1);
  }
  return out;
}

function serieDaQualidade(dados, j, tipo, inicioDe, etapa) {
  if (tipo && tipo !== 'SH') return null;
  const loteDe = new Map((dados.lotes ?? []).map((l) => [l.id, l]));
  return intervalosDoGrafico(j).map((w) => {
    if (inicioDe.colheita == null || w.fim < inicioDe.colheita) {
      return { ...w, kg_colhidos: null, ...doShiitake(null), pct_p: null, pct_m: null, pct_g: null, pct_gg: null, pct_m_ou_maior: null,
        lotes_abertos: null, blocos_abertos: null, kg_dos_abertos: null, kg_por_bloco_aberto: null, parciais: null };
    }
    const daJanela = (dados.colheitas ?? []).filter((c) => dentro(c.data_colheita, w) && loteDe.get(c.lote_id)?.tipo === 'SH');
    const t = tamanhosDoShiitake(daJanela);
    const pct = (v) => (v == null ? null : razao(v, t.kg_classificado));
    const abertos = agruparEmLotes(dados, { inicio: w.inicio, fim: w.fim, tipo: 'SH', eixo: 'ABERTURA' }).filter((l) => l.kg_por_bloco_aberto != null);
    const blocos = abertos.reduce((s, l) => s + l.blocos_abertos, 0);
    const kg = kg3(abertos.reduce((s, l) => s + l.kg_colhidos, 0));
    return {
      ...w,
      kg_colhidos: kg3(daJanela.reduce((s, c) => s + Number(c.total_kg ?? 0), 0)),
      ...t,
      pct_p: pct(t.kg_p), pct_m: pct(t.kg_m), pct_g: pct(t.kg_g), pct_gg: pct(t.kg_gg), pct_m_ou_maior: razao(t.kg_m_ou_maior, t.kg_classificado),
      lotes_abertos: abertos.length, blocos_abertos: blocos, kg_dos_abertos: kg, kg_por_bloco_aberto: razao(kg, blocos),
      parciais: abertos.filter((l) => etapa(l.chave)).length,
    };
  });
}

function lotesComparaveis(dados, chaves, tipo, etapa, sementesDe, aberturas, colheitas) {
  const estantes = new Map();
  for (const e of dados.lotes ?? []) {
    const k = `${e.data_lote}|${e.tipo}`;
    if (chaves.has(k)) estantes.set(k, [...(estantes.get(k) ?? []), e]);
  }
  return agruparEmLotes(dados, { tipo, eixo: 'LOTE' }).filter((l) => chaves.has(l.chave)).map((l) => {
    const doLote = estantes.get(l.chave) ?? [];
    const abertas = doLote.flatMap((e) => {
      const ab = aberturas.get(String(e.id)) ?? [];
      if (ab.length > 0 && ab.every((a) => a.data && a.quantidade != null)) return ab.map((a) => ({ dias: diasEntre(l.data_lote, a.data), blocos: Number(a.quantidade) }));
      return e.data_abertura ? [{ dias: diasEntre(l.data_lote, e.data_abertura), blocos: Number(e.blocos_abertos ?? 0) }] : [];
    });
    const comBlocos = abertas.filter((a) => a.blocos > 0);
    const usadas = comBlocos.length > 0 ? comBlocos : abertas;
    const pesos = comBlocos.reduce((s, a) => s + a.blocos, 0);
    const dias = usadas.map((a) => a.dias);
    const salas = salasDoLote(l, aberturas, colheitas);
    return {
      chave: l.chave, data_lote: l.data_lote, tipo: l.tipo, parcial: etapa(l.chave), inconsistente: l.inconsistente,
      blocos_abertos: l.blocos_abertos, kg_colhidos: l.kg_colhidos, kg_por_bloco_aberto: l.kg_por_bloco_aberto,
      ...(l.tipo === 'SH' && l.kg_colhidos != null ? qualidadeDe(l) : { kg_classificado: null, pct_p: null, pct_m: null, pct_g: null, pct_gg: null, pct_m_ou_maior: null }),
      sementes: sementesDe(l),
      receitas: [...new Set(doLote.map((e) => String(e.receita ?? '').trim()).filter(Boolean))].sort(),
      salas: salas.salas ? salas.salas.map((s) => s.sala).sort() : null,
      sala_fora: salas.fora ?? null,
      maturacao: dias.length === 0 ? null : {
        primeira: Math.min(...dias), ultima: Math.max(...dias),
        media: pesos > 0 ? comBlocos.reduce((s, a) => s + a.dias * a.blocos, 0) / pesos : dias.reduce((s, d) => s + d, 0) / dias.length,
      },
    };
  });
}

function rankingsDoPeriodo(dados, j, tipo, hoje, anterior, inicioDe) {
  const lotes = agruparEmLotes(dados, { inicio: j.inicio, fim: j.fim, tipo, eixo: 'ABERTURA' });
  const ordem = (campo) => (a, b) => (b[campo] ?? -1) - (a[campo] ?? -1) || a.chave.localeCompare(b.chave);
  const etapa = etapaDoLote(dados, hoje);
  const sementesDe = sementesPorLote(dados);
  const sementeUsadaDe = sementeUsadaPorLote(dados);
  const [aberturas, colheitas] = [porLinha(dados.aberturasPorLote ?? []), porLinha(dados.colheitas ?? [])];
  const divisao = new Map();
  const salasDe = (l) => {
    if (!divisao.has(l.chave)) divisao.set(l.chave, salasDoLote(l, aberturas, colheitas));
    return divisao.get(l.chave);
  };
  const doLote = (l) => {
    const d = salasDe(l);
    return {
      parcial: etapa(l.chave),
      sementes: sementesDe(l),
      salas: d.salas ? d.salas.map((s) => ({ ...s, kg_colhidos: kg3(s.kg_colhidos), kg_p: kg3(s.kg_p), kg_m: kg3(s.kg_m), kg_g: kg3(s.kg_g), kg_gg: kg3(s.kg_gg) })) : null,
      sala_fora: d.fora ?? null,
    };
  };
  const produtividade = lotes.filter((l) => l.kg_por_bloco_aberto != null)
    .map((l) => ({
      chave: l.chave, data_lote: l.data_lote, tipo: l.tipo, blocos_abertos: l.blocos_abertos,
      kg_colhidos: l.kg_colhidos, kg_por_bloco_aberto: l.kg_por_bloco_aberto, inconsistente: l.inconsistente,
      kg_p: l.kg_p, kg_m: l.kg_m, kg_g: l.kg_g, kg_gg: l.kg_gg, ...doLote(l), ...sementeUsadaDe(l),
    }))
    .sort(ordem('kg_por_bloco_aberto'));
  const shColhidos = lotes.filter((l) => l.tipo === 'SH' && l.kg_colhidos != null)
    .map((l) => ({ chave: l.chave, data_lote: l.data_lote, tipo: l.tipo, kg_p: l.kg_p, kg_m: l.kg_m, kg_g: l.kg_g, kg_gg: l.kg_gg, ...qualidadeDe(l), ...doLote(l) }));
  const qualidade = shColhidos.filter((l) => l.kg_classificado > 0).sort(ordem('pct_m_ou_maior'));

  const loteDe = new Map((dados.lotes ?? []).map((l) => [l.id, l]));
  const salas = new Map([[null, { sala: null, kg_colhidos: 0, colheitas: 0, kg_p: 0, kg_m: 0, kg_g: 0, kg_gg: 0 }]]);
  for (const c of dados.colheitas ?? []) {
    const l = loteDe.get(c.lote_id);
    if (!l || (tipo && l.tipo !== tipo) || !dentro(c.data_colheita, j)) continue;
    const sala = salaDaColheita(c.estante);
    if (!salas.has(sala)) salas.set(sala, { sala, kg_colhidos: 0, colheitas: 0, kg_p: 0, kg_m: 0, kg_g: 0, kg_gg: 0 });
    const s = salas.get(sala);
    s.kg_colhidos += Number(c.total_kg ?? 0); s.colheitas += 1;
    if (l.tipo === 'SH') for (const f of ['kg_p', 'kg_m', 'kg_g', 'kg_gg']) s[f] += Number(c[f] ?? 0);
  }
  const [sem_sala, ...por_sala] = [...salas.values()]
    .map((s) => ({ ...s, kg_colhidos: kg3(s.kg_colhidos), kg_p: kg3(s.kg_p), kg_m: kg3(s.kg_m), kg_g: kg3(s.kg_g), kg_gg: kg3(s.kg_gg), ...qualidadeDe(s) }));
  por_sala.sort((a, b) => (b.pct_m_ou_maior ?? -1) - (a.pct_m_ou_maior ?? -1) || Number(a.sala.slice(1)) - Number(b.sala.slice(1)));
  const variacao = variacaoDaQualidade(dados, j, anterior, tipo, inicioDe, etapa);
  const chaves = new Set([...produtividade, ...qualidade, ...(variacao?.lotes ?? [])].map((l) => l.chave));

  return {
    variacao_da_qualidade: variacao,
    serie_da_qualidade: serieDaQualidade(dados, j, tipo, inicioDe, etapa),
    comparaveis: lotesComparaveis(dados, chaves, tipo, etapa, sementesDe, aberturas, colheitas),
    produtividade,
    qualidade,
    fora: {
      sem_colheita: lotes.filter((l) => l.mensuravel && l.kg_colhidos == null).length,
      dado_faltante: lotes.filter((l) => !l.mensuravel).length,
      sem_abertos: lotes.filter((l) => l.mensuravel && l.kg_colhidos != null && l.kg_por_bloco_aberto == null).length,
      sem_tamanho: shColhidos.length - qualidade.length,
    },
    por_sala,
    sem_sala,
    rendimento_por_sala: rendimentoPorSala(lotes.filter((l) => l.kg_por_bloco_aberto != null), salasDe, etapa),
  };
}

/**
 * @param {{ lotes?: Array<any>, colheitas?: Array<any>, eventos?: Array<any>, aberturasPorLote?: Array<any>, sementesDosLotes?: Array<any> | null, cepas?: Array<any>, sementesMovimentos?: Array<any> | null }} [dados]
 * @param {{ produtos?: Array<any>, registros?: Array<any> } | null} [embalagem]
 * @param {{ periodo?: any, hoje: string, mes?: any, ano?: any, lote?: any, tipo?: any }} [opcoes]
 */
export function indicadoresDoPainel(dados = {}, embalagem = null, { periodo, hoje, mes, ano, lote, tipo } = {}) {
  const j = janelaDoPeriodo({ periodo, hoje, mes, ano, lote });
  if (j.erro) return { erro: j.erro };
  const primeiro = (datas) => datas.filter(Boolean).sort()[0] ?? null;
  const inicioDe = {
    producao: primeiro((dados.lotes ?? []).map((l) => l.data_lote)),
    colheita: primeiro((dados.colheitas ?? []).map((c) => c.data_colheita)),
    retirada: primeiro((dados.eventos ?? []).filter((e) => e.tipo === 'CONTAMINACAO').map((e) => e.data_evento)),
    embalagem: primeiro((embalagem?.registros ?? []).map((r) => r.data)),
  };

  let atual; let anteriores; let janelas; let rankings = null;
  if (j.modo === 'lote') {
    const doTipo = [...new Set((dados.lotes ?? []).filter((l) => l.tipo === j.tipo && l.data_lote).map((l) => l.data_lote))].sort();
    if (!doTipo.includes(j.data_lote)) return { erro: 'Lote não encontrado: nenhuma linha com essa data de produção e tipo.' };
    const antes = doTipo.filter((d) => d < j.data_lote).reverse().slice(0, 3).map((d) => `${d}|${j.tipo}`);
    atual = somasDoLote(dados, j.lote, inicioDe);
    anteriores = antes.map((c) => somasDoLote(dados, c, inicioDe));
    janelas = antes.map((c) => ({ lote: c }));
  } else {
    const filtroTipo = TIPOS_DO_PAINEL.includes(tipo) ? tipo : undefined;
    janelas = janelasAnteriores(j);
    atual = somasDaJanela(dados, embalagem, j, filtroTipo, inicioDe, true);
    anteriores = janelas.map((w) => somasDaJanela(dados, embalagem, w, filtroTipo, inicioDe));
    rankings = rankingsDoPeriodo(dados, j, filtroTipo, hoje, janelas[0], inicioDe);
  }

  const metricas = Object.fromEntries(Object.entries(METRICAS).map(([nome, def]) => {
    const v = valorDe(atual, def, nome);
    const ant = anteriores[0] ? valorDe(anteriores[0], def, nome) : null;
    const media3 = mediaDe(anteriores, def, nome);
    return [nome, {
      atual: v, anterior: ant, media3,
      var_anterior: v == null || ant == null ? null : variacaoPct(v, ant),
      var_media: v == null || media3 == null ? null : variacaoPct(v, media3),
      melhor: def.melhor,
    }];
  }));
  return { periodo: j, anteriores: janelas, historico_desde: inicioDe, metricas, rankings };
}
