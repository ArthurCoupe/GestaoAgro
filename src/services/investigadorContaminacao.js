import { agruparEmLotes } from './painelDoCiclo.js';
import { maturidadeDoLote, MATURIDADE } from './maturidadeDaCoorte.js';
import { contaminacaoDoLocal } from './contaminacaoDoLocal.js';
import { faixasDeTempo } from './painelContaminados.js';
import { chaveDaSemana, intervaloDaSemana, rotuloDaSemana } from './semanaDeProducao.js';
import { PARAMETROS } from './parametrosDoPainel.js';
import { AJUSTE_HISTORICO } from './ajusteHistoricoContaminados.js';

export const BASE_MINIMA = 10;
export const SEM_REGISTRO = 'Sem registro';
export const MAIS_DE_UMA_SEMENTE = 'Mais de uma semente';
export const SEM_LOCAL = '—';
export const CHAVES_DE_FILTRO = ['galpao', 'estante', 'especie', 'pesagem', 'semeacao', 'conferencia', 'autoclave', 'semente', 'cor', 'lote'];
export const CORES = ['VERDE', 'LARANJA', 'PRETA', 'SEM_COR'];

const FATORES = [
  { chave: 'especie', titulo: 'Espécie', um_por_lote: true },
  { chave: 'pesagem', titulo: 'Pesagem', um_por_lote: false },
  { chave: 'semeacao', titulo: 'Semeação', um_por_lote: false },
  { chave: 'conferencia', titulo: 'Conferência', um_por_lote: false },
  { chave: 'autoclave', titulo: 'Autoclave', um_por_lote: false },
  { chave: 'semente', titulo: 'Semente', um_por_lote: true },
];
const COLUNA_DA_PESSOA = { pesagem: 'responsavel_pesagem', semeacao: 'responsavel_semeacao', conferencia: 'responsavel_conferencia' };

export const separarNomes = (texto) => String(texto ?? '').split(',').map((n) => n.trim()).filter((n) => n !== '');

const razao = (x, base) => (base > 0 ? x / base : null);
const ordemPt = (a, b) => a.localeCompare(b, 'pt', { numeric: true });

const pessoasOuSemRegistro = (textos) => {
  const nomes = [...new Set(textos.flatMap(separarNomes))].sort(ordemPt);
  return nomes.length ? nomes : [SEM_REGISTRO];
};

export function atributosDoLote(g, linhasPorId, hoje, parametros, batidasPorId) {
  const linhas = g.estante_ids.map((id) => linhasPorId.get(id)).filter(Boolean);
  const valores = { especie: [g.tipo ?? SEM_REGISTRO] };
  for (const [chave, coluna] of Object.entries(COLUNA_DA_PESSOA)) {
    valores[chave] = pessoasOuSemRegistro(linhas.map((l) => l[coluna]));
  }
  valores.autoclave = pessoasOuSemRegistro(g.estante_ids.flatMap((id) => batidasPorId.get(id) ?? []).map((b) => b.responsavel));
  const sementes = [...new Set(linhas.map((l) => String(l.nf_semente ?? '').trim()).filter(Boolean))].sort(ordemPt);
  valores.semente = [sementes.length === 0 ? SEM_REGISTRO : sementes.length === 1 ? sementes[0] : MAIS_DE_UMA_SEMENTE];
  const m = maturidadeDoLote(g.data_lote, hoje, parametros);
  const categoria = (g.blocos_produzidos == null || m.estado === MATURIDADE.SEM_DATA) ? 'SEM_NUMERO'
    : m.estado === MATURIDADE.MADURO ? 'MADURO' : 'EM_MATURACAO';
  return {
    chave: g.chave, data_lote: g.data_lote ?? null, tipo: g.tipo ?? null, categoria, dias: m.dias,
    blocos_produzidos: g.blocos_produzidos, blocos_contaminados: g.blocos_contaminados,
    taxa: g.blocos_produzidos == null ? null : razao(g.blocos_contaminados, g.blocos_produzidos),
    cores: { VERDE: g.contaminacao_verde, LARANJA: g.contaminacao_laranja, PRETA: g.contaminacao_preta, SEM_COR: g.contaminacao_sem_cor },
    galpoes: g.galpoes, estante_ids: g.estante_ids, valores, sementes, linhas,
  };
}

function passaNoFiltro(lote, filtros) {
  if (filtros.lote != null && lote.chave !== filtros.lote) return false;
  for (const f of FATORES) {
    if (filtros[f.chave] != null && !lote.valores[f.chave].includes(filtros[f.chave])) return false;
  }
  if (filtros.cor != null && !CORES.includes(filtros.cor)) return false;
  if (filtros.cor != null && !(lote.cores[filtros.cor] > 0)) return false;
  if (filtros.galpao != null || filtros.estante != null) {
    return lote.linhas.some((l) => (filtros.galpao == null || (l.galpao ?? SEM_LOCAL) === filtros.galpao)
      && (filtros.estante == null || String(l.estante_maturacao ?? SEM_LOCAL) === filtros.estante));
  }
  return true;
}

export const decimosDaTaxa = (produzidos, contaminados) => (produzidos > 0 ? Math.round((contaminados * 1000) / produzidos) : null);
const contagemAConferir = (l) => l.taxa != null && l.taxa > 1;
const ehCritico = (l, corte) => {
  const decimos = decimosDaTaxa(l.blocos_produzidos, l.blocos_contaminados);
  return decimos != null && !contagemAConferir(l) && decimos >= Math.round(corte * 1000);
};

const somar = (lotes) => {
  const blocos_produzidos = lotes.reduce((s, l) => s + l.blocos_produzidos, 0);
  const blocos_contaminados = lotes.reduce((s, l) => s + l.blocos_contaminados, 0);
  return { lotes: lotes.length, blocos_produzidos, blocos_contaminados, taxa: razao(blocos_contaminados, blocos_produzidos) };
};

const ordemDasLinhas = (a, b) => (a.base_pequena - b.base_pequena)
  || ((b.diferenca_pp ?? -Infinity) - (a.diferenca_pp ?? -Infinity))
  || (b.lotes - a.lotes) || ordemPt(a.valor, b.valor);

function tabelaDoFator(f, maduros, todosDoRecorte, taxaDoRecorte) {
  const porValor = new Map();
  for (const l of maduros) {
    for (const valor of l.valores[f.chave]) {
      if (!porValor.has(valor)) porValor.set(valor, { valor, lotes: 0, blocos_produzidos: 0, blocos_contaminados: 0 });
      const a = porValor.get(valor);
      a.lotes += 1;
      a.blocos_produzidos += l.blocos_produzidos;
      a.blocos_contaminados += l.blocos_contaminados;
    }
  }
  const linhas = [...porValor.values()].map((a) => {
    const taxa = razao(a.blocos_contaminados, a.blocos_produzidos);
    return {
      ...a, taxa,
      diferenca_pp: taxa == null || taxaDoRecorte == null ? null : (taxa - taxaDoRecorte) * 100,
      base_pequena: a.lotes < BASE_MINIMA,
    };
  }).sort(ordemDasLinhas);
  return {
    chave: f.chave, titulo: f.titulo, um_por_lote: f.um_por_lote, linhas,
    soma_lotes: linhas.reduce((s, l) => s + l.lotes, 0),
    lotes_com_mais_de_um: maduros.filter((l) => l.valores[f.chave].length > 1).length,
    cobertura: {
      registrados: todosDoRecorte.filter((l) => !l.valores[f.chave].includes(SEM_REGISTRO)).length,
      total: todosDoRecorte.length,
    },
  };
}

const paraLista = (l) => ({
  chave: l.chave, data_lote: l.data_lote, tipo: l.tipo, categoria: l.categoria, dias: l.dias,
  blocos_produzidos: l.blocos_produzidos, blocos_contaminados: l.blocos_contaminados, taxa: l.taxa,
  galpoes: l.galpoes, pesagem: l.valores.pesagem, semeacao: l.valores.semeacao,
  conferencia: l.valores.conferencia, semente: l.valores.semente[0],
});

function fichaDoLote(l, dados, fisicaPorLote) {
  const porId = new Map(l.linhas.map((x) => [x.id, x]));
  return {
    ...paraLista(l),
    etapas: [
      { etapa: 'Pesagem', quando: 'dia anterior à produção', pessoas: l.valores.pesagem },
      { etapa: 'Produção', quando: l.data_lote, pessoas: [] },
      { etapa: 'Semeação', quando: 'dia seguinte à produção', pessoas: l.valores.semeacao },
      { etapa: 'Conferência', quando: null, pessoas: l.valores.conferencia },
    ],
    sementes: l.sementes,
    linhas: l.linhas.map((x) => ({
      galpao: x.galpao ?? SEM_LOCAL, estante: String(x.estante_maturacao ?? SEM_LOCAL),
      estante_fisica: fisicaPorLote?.get(x.id) ?? null, blocos_produzidos: x.blocos_produzidos ?? null,
    })),
    retiradas: (dados.eventos ?? []).filter((e) => porId.has(e.lote_id)).map((e) => {
      const x = porId.get(e.lote_id);
      return {
        data_evento: e.data_evento ?? null, galpao: x.galpao ?? SEM_LOCAL, estante: String(x.estante_maturacao ?? SEM_LOCAL),
        tipo: e.tipo, blocos: Number(e.quantidade) || 0, cor: e.tipo_contaminado ?? null,
      };
    }).sort((a, b) => String(a.data_evento).localeCompare(String(b.data_evento))),
    autoclave: (dados.autoclaves ?? []).filter((a) => porId.has(a.lote_id))
      .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
      .map(({ lote_id: _loteId, ...resto }) => resto),
  };
}

function semanasDoRecorte(doRecorte, inicioDoPeriodo, fimDoPeriodo) {
  const porSemana = new Map();
  for (const l of doRecorte) {
    const semana = chaveDaSemana(l.data_lote);
    if (!semana) continue;
    if (!porSemana.has(semana)) {
      porSemana.set(semana, {
        semana, rotulo: rotuloDaSemana(semana), ...intervaloDaSemana(semana),
        lotes: 0, maduros: 0, em_maturacao: 0, sem_numero: 0, blocos_produzidos: 0, blocos_contaminados: 0,
      });
    }
    const s = porSemana.get(semana);
    s.lotes += 1;
    if (l.categoria === 'MADURO') {
      s.maduros += 1;
      s.blocos_produzidos += l.blocos_produzidos;
      s.blocos_contaminados += l.blocos_contaminados;
    } else if (l.categoria === 'EM_MATURACAO') s.em_maturacao += 1;
    else s.sem_numero += 1;
  }
  return [...porSemana.values()]
    .sort((a, b) => b.semana.localeCompare(a.semana))
    .map((s) => ({
      ...s, taxa: razao(s.blocos_contaminados, s.blocos_produzidos),
      parcial: s.inicio < inicioDoPeriodo || s.fim > fimDoPeriodo,
    }));
}

function tempoAteARetirada(dados, doRecorte, hoje, parametros) {
  const idsNoEscopo = new Set(doRecorte.flatMap((l) => l.estante_ids));
  const t = faixasDeTempo(dados, { hoje, parametros, idsNoEscopo });
  const semData = {
    retiradas: t.anteriores.lancamentos + t.sem_data_do_lote,
    blocos: t.anteriores.blocos + t.sem_data_do_lote_blocos,
  };
  const total = { retiradas: t.base.lancamentos + semData.retiradas, blocos: t.base.blocos + semData.blocos };
  return {
    eixo: 'dias entre a data do lote e a data da retirada',
    faixas: t.faixas.map((f) => ({
      chave: f.chave, rotulo: f.rotulo, retiradas: f.lancamentos, blocos: f.blocos, pct_blocos: razao(f.blocos, total.blocos),
    })),
    sem_data_valida: { ...semData, pct_blocos: razao(semData.blocos, total.blocos) },
    total,
    universo: {
      lotes: doRecorte.length,
      blocos_produzidos: doRecorte.reduce((s, l) => s + (l.blocos_produzidos ?? 0), 0),
      contaminados_maduros: doRecorte.filter((l) => l.categoria === 'MADURO').reduce((s, l) => s + l.blocos_contaminados, 0),
      contaminados_fora_da_taxa: doRecorte.filter((l) => l.categoria !== 'MADURO').reduce((s, l) => s + l.blocos_contaminados, 0),
      em_maturacao: doRecorte.filter((l) => l.categoria === 'EM_MATURACAO').length,
      sem_numero: doRecorte.filter((l) => l.categoria === 'SEM_NUMERO').length,
    },
  };
}

export function investigarContaminacao(dados = {}, opcoes = {}) {
  const {
    inicio, fim, hoje, filtros = {}, parametros = PARAMETROS, comDivergencia = null, fisicaPorLote = null,
  } = opcoes;
  const linhasValidas = (dados.lotes ?? []).filter((l) => l.lote_pesquisa !== true);
  const linhasPorId = new Map(linhasValidas.map((l) => [l.id, l]));
  const batidasPorId = new Map();
  for (const b of dados.autoclaves ?? []) {
    if (!batidasPorId.has(b.lote_id)) batidasPorId.set(b.lote_id, []);
    batidasPorId.get(b.lote_id).push(b);
  }
  const todos = agruparEmLotes({ lotes: linhasValidas, eventos: dados.eventos ?? [], colheitas: [] }, {})
    .map((g) => atributosDoLote(g, linhasPorId, hoje, parametros, batidasPorId));
  const noPeriodo = (l) => Boolean(l.data_lote) && l.data_lote >= inicio && l.data_lote <= fim;
  const filtrados = todos.filter((l) => passaNoFiltro(l, filtros));
  const doRecorte = filtrados.filter(noPeriodo);
  const maduros = doRecorte.filter((l) => l.categoria === 'MADURO');
  const corteCritico = parametros.contaminacaoVermelho;
  const recorte = {
    ...somar(maduros),
    em_maturacao: doRecorte.filter((l) => l.categoria === 'EM_MATURACAO').length,
    sem_numero: doRecorte.filter((l) => l.categoria === 'SEM_NUMERO').length,
    criticos: maduros.filter((l) => ehCritico(l, corteCritico)).length,
    contagem_a_conferir: maduros.filter(contagemAConferir).length,
    corte_critico: corteCritico,
  };
  const referencia = somar(todos.filter((l) => noPeriodo(l) && l.categoria === 'MADURO'));

  const fatores = FATORES.map((f) => tabelaDoFator(f, maduros, doRecorte, recorte.taxa));
  const cor = {
    total: recorte.blocos_contaminados,
    linhas: CORES.map((c) => {
      const blocos = maduros.reduce((s, l) => s + (l.cores[c] ?? 0), 0);
      return { cor: c, blocos, fracao: razao(blocos, recorte.blocos_contaminados) };
    }),
  };

  const temFiltro = CHAVES_DE_FILTRO.some((c) => filtros[c] != null);
  const idsNoEscopo = temFiltro ? new Set(filtrados.flatMap((l) => l.estante_ids)) : null;
  const local = contaminacaoDoLocal(dados, { inicio, fim, idsNoEscopo, fisicaPorLote, comDivergencia });
  const onde = { dias: local.dias, total: local.total, galpoes: local.galpoes, sem_lote: local.sem_lote, pesquisa: local.pesquisa };

  const lotes = doRecorte.map(paraLista).sort((a, b) => ((b.taxa ?? -1) - (a.taxa ?? -1))
    || String(b.data_lote).localeCompare(String(a.data_lote)));
  const escolhido = filtros.lote != null ? todos.find((l) => l.chave === filtros.lote) : null;
  const ficha = escolhido ? fichaDoLote(escolhido, dados, fisicaPorLote) : null;

  return {
    inicio, fim, hoje, filtros, base_minima: BASE_MINIMA, maturidade_dias: parametros.contaminacaoDiasComparavel,
    recorte, referencia, semanas: semanasDoRecorte(doRecorte, inicio, fim), tempo: tempoAteARetirada(dados, doRecorte, hoje, parametros),
    fatores, cor, onde, lotes, ficha,
    ajuste_historico: AJUSTE_HISTORICO,
  };
}
