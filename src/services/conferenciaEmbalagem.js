import { especieDaEmbalagem } from './pesosDeVariedade.js';
import { arredondarKg, dataISO, erroDeValidacao, numeroMaiorQueZero, texto } from './camposDoCiclo.js';

export const TIPOS_DE_COGUMELO = ['SH', 'SP', 'SB', 'SS'];
export const NOME_DO_TIPO = { SH: 'Shiitake', SP: 'Shimeji Preto', SB: 'Shimeji Branco', SS: 'Shimeji Salmão' };
export const APRESENTACOES = [
  { chave: 'BANDEJA_200G', rotulo: 'Bandejas de 200 g', com_peso: true },
  { chave: 'EMBALAGEM_1KG', rotulo: 'Embalagens de 1 kg', com_peso: true },
  { chave: 'CAIXA_PIMENTAO', rotulo: 'Caixas de pimentão', com_peso: false },
];
export const TOLERANCIA_PADRAO_KG = 0.5;
export const DIAS_PARA_FECHAR_PADRAO = 2;

export function apresentacaoDoProduto(p = {}) {
  const g = p.peso_gramas == null ? null : Number(p.peso_gramas);
  if (g === 200) return 'BANDEJA_200G';
  if (g === 1000) return 'EMBALAGEM_1KG';
  if (g == null && /^Piment[aã]o/i.test(String(p.nome ?? ''))) return 'CAIXA_PIMENTAO';
  return null;
}

const dentro = (d, inicio, fim) => Boolean(d) && (!inicio || d >= inicio) && (!fim || d <= fim);
const diasEntre = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
const somaDias = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const kgDe = (p, quantidade) => (p?.peso_gramas == null ? 0 : (Number(quantidade ?? 0) * Number(p.peso_gramas)) / 1000);

export function periodoAnterior({ inicio, fim } = {}) {
  if (!inicio || !fim) return null;
  const dias = diasEntre(inicio, fim) + 1;
  const fimAnterior = somaDias(inicio, -1);
  return { inicio: somaDias(fimAnterior, -(dias - 1)), fim: fimAnterior };
}

export function variacaoPct(atual, anterior) {
  if (!Number.isFinite(atual) || !Number.isFinite(anterior) || anterior === 0) return null;
  return Math.round(((atual - anterior) / Math.abs(anterior)) * 1000) / 10;
}

const totaisVazios = () => ({ bandejas_200g: 0, embalagens_1kg: 0, caixas_pimentao: 0, kg_embalados: 0, kg_desprezados: 0, kg_colhidos: 0 });

export function totaisDaEmbalagem({ produtos = [], registros = [], desprezos = [], colheitas = [], lotes = [] } = {}, { inicio, fim } = {}) {
  const porId = new Map(produtos.map((p) => [p.id, p]));
  const tipoDoLote = new Map(lotes.map((l) => [l.id, l.tipo]));
  const total = totaisVazios();
  const porTipo = Object.fromEntries(TIPOS_DE_COGUMELO.map((t) => [t, totaisVazios()]));
  const porApres = Object.fromEntries(APRESENTACOES.map((a) => [a.chave, { unidades: 0, kg: 0 }]));
  const composicao = Object.fromEntries(TIPOS_DE_COGUMELO.map((t) => [t, new Map()]));
  for (const r of registros) {
    if (!dentro(r.data, inicio, fim)) continue;
    const p = porId.get(r.embalagem_produto_id);
    if (!p) continue;
    const q = Number(r.quantidade ?? 0);
    const apres = apresentacaoDoProduto(p);
    const especie = especieDaEmbalagem(p.nome);
    const kg = kgDe(p, q);
    if (apres === 'BANDEJA_200G') { total.bandejas_200g += q; if (especie) porTipo[especie].bandejas_200g += q; }
    if (especie && (apres === 'BANDEJA_200G' || apres === 'EMBALAGEM_1KG')) {
      const col = composicao[especie].get(p.id) ?? { produto: p.nome, ordem: p.ordem ?? 0, apresentacao: apres, unidades: 0 };
      col.unidades += q;
      composicao[especie].set(p.id, col);
    }
    if (apres === 'EMBALAGEM_1KG') { total.embalagens_1kg += q; if (especie) porTipo[especie].embalagens_1kg += q; }
    if (apres === 'CAIXA_PIMENTAO') total.caixas_pimentao += q;
    if (apres) { porApres[apres].unidades += q; porApres[apres].kg += kg; }
    total.kg_embalados += kg;
    if (especie) porTipo[especie].kg_embalados += kg;
  }
  for (const d of desprezos) {
    if (!dentro(d.data_colheita, inicio, fim)) continue;
    const kg = Number(d.kg ?? 0);
    total.kg_desprezados += kg;
    if (porTipo[d.tipo_cogumelo]) porTipo[d.tipo_cogumelo].kg_desprezados += kg;
  }
  for (const c of colheitas) {
    if (!dentro(c.data_colheita, inicio, fim)) continue;
    const kg = Number(c.total_kg ?? 0);
    const tipo = tipoDoLote.get(c.lote_id);
    total.kg_colhidos += kg;
    if (tipo && porTipo[tipo]) porTipo[tipo].kg_colhidos += kg;
  }
  const kgs = ['kg_embalados', 'kg_desprezados', 'kg_colhidos'];
  for (const k of kgs) total[k] = arredondarKg(total[k]);
  for (const t of TIPOS_DE_COGUMELO) for (const k of kgs) porTipo[t][k] = arredondarKg(porTipo[t][k]);
  return {
    total,
    por_tipo: TIPOS_DE_COGUMELO.map((t) => ({
      tipo: t, nome: NOME_DO_TIPO[t], ...porTipo[t],
      colunas: [...composicao[t].values()].sort((a, b) => a.ordem - b.ordem || a.produto.localeCompare(b.produto))
        .map(({ produto, apresentacao, unidades }) => ({ produto, apresentacao, unidades })),
    })),
    por_apresentacao: APRESENTACOES.map((a) => ({
      chave: a.chave, rotulo: a.rotulo, unidades: porApres[a.chave].unidades,
      kg: a.com_peso ? arredondarKg(porApres[a.chave].kg) : null,
    })),
  };
}

export function comparacaoComAnterior(dados, periodo = {}) {
  const anterior = periodoAnterior(periodo);
  if (!anterior) return null;
  const a = totaisDaEmbalagem(dados, periodo).total;
  const b = totaisDaEmbalagem(dados, anterior).total;
  return {
    periodo_anterior: anterior,
    anterior: b,
    bandejas_200g_pct: variacaoPct(a.bandejas_200g, b.bandejas_200g),
    embalagens_1kg_pct: variacaoPct(a.embalagens_1kg, b.embalagens_1kg),
    kg_embalados_pct: variacaoPct(a.kg_embalados, b.kg_embalados),
    kg_desprezados_pct: variacaoPct(a.kg_desprezados, b.kg_desprezados),
  };
}

export function conferenciaColheitaEmbalagem(
  { produtos = [], registros = [], desprezos = [], colheitas = [], lotes = [] } = {},
  { inicio, fim, hoje = null, toleranciaKg = TOLERANCIA_PADRAO_KG, diasParaFechar = DIAS_PARA_FECHAR_PADRAO } = {},
) {
  const porId = new Map(produtos.map((p) => [p.id, p]));
  const lotePorId = new Map(lotes.map((l) => [l.id, l]));
  const conferiveis = new Set(produtos.filter((p) => p.peso_gramas != null).map((p) => especieDaEmbalagem(p.nome)).filter(Boolean));
  const chaves = new Map();
  const linhaDe = (data, tipo) => {
    const k = `${data}|${tipo}`;
    if (!chaves.has(k)) chaves.set(k, { data_colheita: data, tipo, nome_tipo: NOME_DO_TIPO[tipo] ?? tipo, lotes: [], kg_colhidos: 0, kg_embalados: 0, kg_desprezados: 0 });
    return chaves.get(k);
  };
  for (const c of colheitas) {
    if (!dentro(c.data_colheita, inicio, fim)) continue;
    const lote = lotePorId.get(c.lote_id);
    if (!lote?.tipo || !conferiveis.has(lote.tipo)) continue;
    const ln = linhaDe(c.data_colheita, lote.tipo);
    ln.kg_colhidos += Number(c.total_kg ?? 0);
    if (lote.data_lote && !ln.lotes.includes(lote.data_lote)) ln.lotes.push(lote.data_lote);
  }
  for (const r of registros) {
    if (!dentro(r.data, inicio, fim)) continue;
    const p = porId.get(r.embalagem_produto_id);
    const especie = p ? especieDaEmbalagem(p.nome) : null;
    if (!especie || p.peso_gramas == null) continue;
    const q = Number(r.quantidade ?? 0);
    if (!(q > 0)) continue;
    linhaDe(r.data, especie).kg_embalados += kgDe(p, q);
  }
  for (const d of desprezos) {
    if (!dentro(d.data_colheita, inicio, fim) || !TIPOS_DE_COGUMELO.includes(d.tipo_cogumelo) || !conferiveis.has(d.tipo_cogumelo)) continue;
    linhaDe(d.data_colheita, d.tipo_cogumelo).kg_desprezados += Number(d.kg ?? 0);
  }
  const linhas = [...chaves.values()].map((ln) => {
    const kg_colhidos = arredondarKg(ln.kg_colhidos);
    const kg_embalados = arredondarKg(ln.kg_embalados);
    const kg_desprezados = arredondarKg(ln.kg_desprezados);
    const diferenca = arredondarKg(kg_colhidos - kg_embalados - kg_desprezados);
    const emAberto = hoje ? diasEntre(ln.data_colheita, hoje) < diasParaFechar : false;
    const situacao = Math.abs(diferenca) <= toleranciaKg ? 'FECHADA' : (emAberto ? 'EM_ABERTO' : 'DIVERGENTE');
    return { ...ln, lotes: [...ln.lotes].sort(), kg_colhidos, kg_embalados, kg_desprezados, diferenca, situacao };
  }).sort((a, b) => b.data_colheita.localeCompare(a.data_colheita) || a.tipo.localeCompare(b.tipo));
  const divergentes = linhas.filter((l) => l.situacao === 'DIVERGENTE');
  return {
    parametros: { tolerancia_kg: toleranciaKg, dias_para_fechar: diasParaFechar },
    colheitas: linhas.length,
    fechadas: linhas.filter((l) => l.situacao === 'FECHADA').length,
    em_aberto: linhas.filter((l) => l.situacao === 'EM_ABERTO').length,
    divergentes: divergentes.length,
    kg_diferenca: arredondarKg(divergentes.reduce((s, l) => s + l.diferenca, 0)),
    kg_diferenca_absoluta: arredondarKg(divergentes.reduce((s, l) => s + Math.abs(l.diferenca), 0)),
    linhas,
  };
}

export function blocoColheitaEmbalagem(dadosDeTodos = {}, { corte, hoje, inicio, fim, tipo, toleranciaKg, diasParaFechar } = {}) {
  const janela = { inicio: inicio && inicio > corte ? inicio : corte, fim: fim && fim < hoje ? fim : hoje };
  const dados = doTipo(dadosDeTodos, tipo);
  const conf = conferenciaColheitaEmbalagem(dados, { ...janela, hoje, toleranciaKg, diasParaFechar });
  const somaLinhas = (campo) => arredondarKg(conf.linhas.reduce((s, l) => s + l[campo], 0));
  const datas = [
    ...(dados.registros ?? []).map((r) => r.data),
    ...(dados.colheitas ?? []).map((c) => c.data_colheita),
    ...(dados.desprezos ?? []).map((d) => d.data_colheita),
  ].filter((d) => dentro(d, janela.inicio, janela.fim)).sort();
  const unidades = totaisDaEmbalagem(dados, janela).total;
  const comUnidade = unidades.bandejas_200g + unidades.embalagens_1kg > 0;
  const bandejas_200g = comUnidade ? unidades.bandejas_200g : null;
  const embalagens_1kg = comUnidade ? unidades.embalagens_1kg : null;
  return {
    janela, corte, tipo: tipo || null,
    kg_colhidos: somaLinhas('kg_colhidos'), kg_embalados: somaLinhas('kg_embalados'), kg_desprezados: somaLinhas('kg_desprezados'),
    diferenca: somaLinhas('diferenca'),
    bandejas_200g, embalagens_1kg,
    colheitas: conf.colheitas, fechadas: conf.fechadas, em_aberto: conf.em_aberto, divergentes: conf.divergentes,
    kg_diferenca_absoluta: conf.kg_diferenca_absoluta,
    dado_ate: datas.at(-1) ?? null,
    parametros: conf.parametros,
  };
}

export function conferenciaDoPeriodo(dados, janela = {}, { tipo, ...opcoes } = {}) {
  const lote = janela.modo === 'lote';
  const bloco = blocoColheitaEmbalagem(dados, {
    ...opcoes, tipo: lote ? janela.tipo : tipo, ...(lote ? {} : { inicio: janela.inicio, fim: janela.fim }),
  });
  return { ...bloco, modo: lote ? 'lote' : 'periodo' };
}

export function ultimoDiaDeEmbalagem({ produtos = [], registros = [] } = {}, hoje) {
  const contados = new Set(produtos.filter((p) => ['BANDEJA_200G', 'EMBALAGEM_1KG'].includes(apresentacaoDoProduto(p))).map((p) => p.id));
  return registros.filter((r) => contados.has(r.embalagem_produto_id) && Number(r.quantidade ?? 0) > 0 && r.data && r.data <= hoje)
    .map((r) => r.data).sort().pop() ?? null;
}

function doTipo(dados, tipo) {
  if (!tipo) return dados;
  const lotes = (dados.lotes ?? []).filter((l) => l.tipo === tipo);
  const ids = new Set(lotes.map((l) => l.id));
  const porId = new Map((dados.produtos ?? []).map((p) => [p.id, p]));
  return {
    ...dados, lotes,
    colheitas: (dados.colheitas ?? []).filter((c) => ids.has(c.lote_id)),
    registros: (dados.registros ?? []).filter((r) => especieDaEmbalagem(porId.get(r.embalagem_produto_id)?.nome) === tipo),
    desprezos: (dados.desprezos ?? []).filter((d) => d.tipo_cogumelo === tipo),
  };
}

export function resumoDaEmbalagem(dados = {}, { inicio = null, fim = null, hoje = null, toleranciaKg, diasParaFechar, origens = {} } = {}) {
  const periodo = { inicio: inicio || null, fim: fim || null };
  const t = totaisDaEmbalagem(dados, periodo);
  const conf = conferenciaColheitaEmbalagem(dados, { ...periodo, hoje, toleranciaKg, diasParaFechar });
  return {
    periodo,
    totais: t.total,
    por_tipo: t.por_tipo,
    por_apresentacao: t.por_apresentacao,
    comparacao: comparacaoComAnterior(dados, periodo),
    conferencia: conf,
    parametros: { ...conf.parametros, origens: { tolerancia_kg: origens.tolerancia_kg ?? 'PADRAO', dias_para_fechar: origens.dias_para_fechar ?? 'PADRAO' } },
  };
}

export function camposDoDesprezo(payload = {}, { hoje = null } = {}) {
  const data = (v, campo, opcoes) => { try { return dataISO(v, campo, opcoes); } catch (e) { throw erroDeValidacao(e.message); } };
  const data_colheita = data(payload.data_colheita, 'data_colheita');
  const data_lancamento = data(payload.data_lancamento, 'data_lancamento', { obrigatoria: false }) ?? hoje ?? data_colheita;
  if (data_lancamento < data_colheita) {
    throw erroDeValidacao(`A data do dia (${data_lancamento}) não pode ser antes da data da colheita (${data_colheita}).`);
  }
  const tipo_cogumelo = String(payload.tipo_cogumelo ?? '').trim().toUpperCase();
  if (!TIPOS_DE_COGUMELO.includes(tipo_cogumelo)) throw erroDeValidacao('Tipo de cogumelo inválido: use SH, SP, SB ou SS.');
  const kgBruto = typeof payload.kg === 'string' ? payload.kg.replace(',', '.') : payload.kg;
  let kg;
  try { kg = numeroMaiorQueZero(kgBruto, 'kg desprezados'); } catch (e) { throw erroDeValidacao(e.message); }
  if (kg == null) throw erroDeValidacao('kg desprezados é obrigatório: informe um número maior que zero.');
  kg = arredondarKg(kg);
  if (!(kg > 0)) throw erroDeValidacao('kg desprezados pequeno demais: com três casas decimais vira 0. Informe pelo menos 0,001.');
  const loteBruto = payload.lote_id == null || payload.lote_id === '' ? null : Number(payload.lote_id);
  if (loteBruto != null && (!Number.isSafeInteger(loteBruto) || loteBruto < 1)) throw erroDeValidacao('lote_id inválido.');
  return { data_lancamento, data_colheita, tipo_cogumelo, kg, lote_id: loteBruto, observacao: texto(payload.observacao) };
}

export const CHAVES_ACEITAS_DESPREZO = [
  'data_colheita', 'data_lancamento', 'tipo_cogumelo', 'kg', 'lote_id', 'observacao',
];

/** @param {{ produtos?: Array<{ id: number, nome: string, ordem?: number | null, ativo?: boolean }>, registros?: Array<{ data: string, embalagem_produto_id: number, quantidade: number }> }} [dados] */
export function montarGradeDoSaldo({ produtos = [], registros = [] } = {}) {
  const ativos = produtos.filter((p) => p.ativo !== false)
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0) || Number(a.id) - Number(b.id));
  const porDia = new Map();
  for (const r of registros) {
    const dia = String(r.data).slice(0, 10);
    if (!porDia.has(dia)) porDia.set(dia, new Map());
    porDia.get(dia).set(Number(r.embalagem_produto_id), Number(r.quantidade));
  }
  const dias = [...porDia.keys()].sort((a, b) => b.localeCompare(a)).map((data) => ({
    data,
    valores: Object.fromEntries(ativos.map((p) => [p.id, porDia.get(data).get(Number(p.id)) ?? null])),
  }));
  return { produtos: ativos.map((p) => ({ id: p.id, nome: p.nome })), dias };
}
