import { agruparEmLotes } from './painelDoCiclo.js';
import { PARAMETROS } from './parametrosDoPainel.js';
import {
  atributosDoLote, separarNomes, BASE_MINIMA, CORES, SEM_LOCAL,
} from './investigadorContaminacao.js';
import { TIPOS_DE_EVENTO_ATIPICO } from './eventosAtipicos.js';
import { faixasDeTempo } from './painelContaminados.js';

export const FORMATO_DA_CHAVE_DO_LOTE = /^\d{4}-\d{2}-\d{2}\|[A-Za-z0-9]{1,10}$/;
export const MAX_LOTES_NO_CRUZAMENTO = 300;

export const EVENTOS_ATIPICOS = Object.freeze(
  Object.fromEntries(TIPOS_DE_EVENTO_ATIPICO.map((t) => [t.codigo, t.rotulo])),
);

const ROTULO_DA_COR = { VERDE: 'Verde', LARANJA: 'Laranja', PRETA: 'Preta', SEM_COR: 'Sem cor' };

export const SINAIS_DA_AUTOCLAVE = Object.freeze({
  QUEDA_DE_121: 'Houve queda abaixo de 121 °C',
  PRESSAO_FORA_DA_FAIXA: 'Pressão fora de 1,1 a 1,3 bar',
  MENOS_DE_2H_A_121: 'Menos de 2 h a 121 °C',
});
const MINUTOS_A_121 = 120;

const razao = (x, base) => (base > 0 ? x / base : null);
const ordemPt = (a, b) => String(a).localeCompare(String(b), 'pt', { numeric: true });
const unicos = (lista) => [...new Set(lista)];
const agrupar = (lista, campo) => {
  const mapa = new Map();
  for (const x of lista) {
    if (!mapa.has(x[campo])) mapa.set(x[campo], []);
    mapa.get(x[campo]).push(x);
  }
  return mapa;
};

function minutosEntre(de, ate) {
  const a = Date.parse(de);
  const b = Date.parse(ate);
  return Number.isFinite(a) && Number.isFinite(b) ? (b - a) / 60000 : null;
}

export function sinaisDaBatida(b) {
  const sinais = [];
  if (b.houve_queda_121 === true) sinais.push(SINAIS_DA_AUTOCLAVE.QUEDA_DE_121);
  if (b.pressao_na_faixa === false) sinais.push(SINAIS_DA_AUTOCLAVE.PRESSAO_FORA_DA_FAIXA);
  const min = b.atingiu_121 && b.fim_2h ? minutosEntre(b.atingiu_121, b.fim_2h) : null;
  if (min != null && min >= 0 && min < MINUTOS_A_121) sinais.push(SINAIS_DA_AUTOCLAVE.MENOS_DE_2H_A_121);
  return sinais;
}

const pessoasDaEtapa = (coluna) => (c) => unicos(c.linhas.flatMap((l) => separarNomes(l[coluna]))).sort(ordemPt);
const DIMENSOES = [
  { chave: 'semente', titulo: 'Semente', grupo: 'Insumo', valores: (c) => c.lote.sementes },
  { chave: 'especie', titulo: 'Espécie', grupo: 'Lote', valores: (c) => (c.lote.tipo ? [c.lote.tipo] : []) },
  { chave: 'pessoa_pesagem', titulo: 'Pessoa · Pesagem', grupo: 'Pessoas por etapa', valores: pessoasDaEtapa('responsavel_pesagem') },
  { chave: 'pessoa_semeacao', titulo: 'Pessoa · Semeação', grupo: 'Pessoas por etapa', valores: pessoasDaEtapa('responsavel_semeacao') },
  { chave: 'pessoa_conferencia', titulo: 'Pessoa · Conferência', grupo: 'Pessoas por etapa', valores: pessoasDaEtapa('responsavel_conferencia') },
  { chave: 'pessoa_selagem', titulo: 'Pessoa · Selagem', grupo: 'Pessoas por etapa', valores: pessoasDaEtapa('responsavel_selagem') },
  {
    chave: 'pessoa_autoclave', titulo: 'Pessoa · Autoclave', grupo: 'Pessoas por etapa',
    valores: (c) => unicos(c.batidas.flatMap((b) => separarNomes(b.responsavel))).sort(ordemPt),
  },
  { chave: 'galpao', titulo: 'Galpão', grupo: 'Local', valores: (c) => unicos(c.linhas.map((l) => l.galpao).filter(Boolean)).sort(ordemPt) },
  {
    chave: 'estante', titulo: 'Estante', grupo: 'Local',
    valores: (c) => unicos(c.linhas.filter((l) => l.estante_maturacao != null)
      .map((l) => `${l.galpao ?? SEM_LOCAL} · ${l.estante_maturacao}`)).sort(ordemPt),
  },
  {
    chave: 'cor', titulo: 'Cor da contaminação', grupo: 'Contaminação', valores: (c) => CORES.filter((cor) => c.lote.cores[cor] > 0),
    rotulo: (v) => ROTULO_DA_COR[v] ?? v, rotuloSemRegistro: 'Sem blocos contaminados',
  },
  {
    chave: 'capela', titulo: 'Capela ligada', grupo: 'Processo',
    valores: (c) => (c.capela === true ? ['Sim'] : c.capela === false ? ['Não'] : []),
  },
  {
    chave: 'autoclave', titulo: 'Sinais da autoclave', grupo: 'Processo',
    valores: (c) => unicos(c.batidas.flatMap(sinaisDaBatida)),
    temRegistro: (c) => c.batidas.length > 0,
    rotuloSemRegistro: 'Sem batida registrada',
  },
  {
    chave: 'eventos_atipicos', titulo: 'Eventos e condições atípicas', grupo: 'Processo', eventos: true,
    valores: (c) => unicos(c.eventosAtipicos.map((e) => e.tipo)).sort(ordemPt),
    rotulo: (v) => EVENTOS_ATIPICOS[v] ?? v, rotuloSemRegistro: 'Sem evento registrado',
  },
];

function contextoDoLote(l, { batidasPorId, eventosPorId }) {
  const linhas = [...l.linhas].sort((a, b) => a.id - b.id);
  return {
    lote: l,
    linhas,
    capela: linhas[0]?.capela_ligada ?? null,
    batidas: l.estante_ids.flatMap((id) => batidasPorId.get(id) ?? [])
      .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0)),
    eventosAtipicos: eventosPorId ? l.estante_ids.flatMap((id) => eventosPorId.get(id) ?? []) : [],
  };
}

const parDe = (k, n) => ({ k, n });
const diferencaPp = (sel, base) => (sel.n > 0 && base.n > 0 ? (sel.k / sel.n - base.k / base.n) * 100 : null);

function valoresDaDimensao(dim, ctxSelecionados, ctxBase, baseN) {
  const n = ctxSelecionados.length;
  const contar = (contextos) => {
    const porValor = new Map();
    let semRegistro = 0;
    for (const c of contextos) {
      const valores = dim.valores(c);
      if (!(dim.temRegistro ? dim.temRegistro(c) : valores.length > 0)) semRegistro += 1;
      for (const v of valores) porValor.set(v, (porValor.get(v) ?? 0) + 1);
    }
    return { porValor, semRegistro };
  };
  const sel = contar(ctxSelecionados);
  const base = contar(ctxBase);
  const valores = [...sel.porValor.keys()].map((valor) => {
    const selecionados = parDe(sel.porValor.get(valor), n);
    const baseDoValor = parDe(base.porValor.get(valor) ?? 0, baseN);
    return {
      valor, rotulo: dim.rotulo ? dim.rotulo(valor) : valor,
      selecionados, base: baseDoValor,
      base_pequena: baseDoValor.k < BASE_MINIMA,
      diferenca_pp: diferencaPp(selecionados, baseDoValor),
    };
  }).sort((a, b) => (b.selecionados.k - a.selecionados.k) || ((b.diferenca_pp ?? -Infinity) - (a.diferenca_pp ?? -Infinity))
    || ordemPt(a.rotulo, b.rotulo));
  return {
    chave: dim.chave, titulo: dim.titulo, grupo: dim.grupo, disponivel: true, valores,
    sem_registro: { k: sel.semRegistro, n, base: parDe(base.semRegistro, baseN), rotulo: dim.rotuloSemRegistro ?? 'Sem registro' },
  };
}

function detalheDoLote(c, fisicaPorLote) {
  const l = c.lote;
  const pessoas = {
    pesagem: pessoasDaEtapa('responsavel_pesagem')(c),
    semeacao: pessoasDaEtapa('responsavel_semeacao')(c),
    conferencia: pessoasDaEtapa('responsavel_conferencia')(c),
    selagem: pessoasDaEtapa('responsavel_selagem')(c),
    autoclave: unicos(c.batidas.flatMap((b) => separarNomes(b.responsavel))).sort(ordemPt),
  };
  return {
    chave: l.chave, data_lote: l.data_lote, tipo: l.tipo, categoria: l.categoria, dias: l.dias,
    blocos_produzidos: l.blocos_produzidos, blocos_contaminados: l.blocos_contaminados, taxa: l.taxa,
    galpoes: l.galpoes,
    estantes: c.linhas.map((x) => ({
      galpao: x.galpao ?? SEM_LOCAL, estante: x.estante_maturacao == null ? SEM_LOCAL : String(x.estante_maturacao),
      estante_fisica: fisicaPorLote?.get(x.id) ?? null, blocos_produzidos: x.blocos_produzidos ?? null,
    })),
    sementes: l.sementes,
    pessoas,
    capela_ligada: c.capela,
    autoclave: c.batidas.map((b) => ({
      ordem: b.ordem ?? null, responsavel: b.responsavel ?? null, entrada: b.entrada ?? null, atingiu_121: b.atingiu_121 ?? null,
      fim_2h: b.fim_2h ?? null, houve_queda_121: b.houve_queda_121 ?? null, pressao_na_faixa: b.pressao_na_faixa ?? null,
      sinais: sinaisDaBatida(b),
    })),
    cores: { ...l.cores },
    eventos_atipicos: c.eventosAtipicos.map((e) => ({
      id: e.id ?? null, tipo: e.tipo, rotulo: EVENTOS_ATIPICOS[e.tipo] ?? e.tipo, descricao: e.descricao ?? null,
      observacao: e.observacao ?? null, hora_inicio: e.hora_inicio ?? null, hora_retorno: e.hora_retorno ?? null,
    })),
  };
}

export const EMPATE = 'EMPATE';
export const SEM_RETIRADA = 'SEM_RETIRADA';
export const ROTULO_SEM_RETIRADA = 'Sem bloco contaminado nas faixas';
const emLista = (itens) => new Intl.ListFormat('pt-BR', { type: 'conjunction' }).format(itens);

function tempoDoLote(lote, eventosPorLinha, hoje, parametros) {
  const t = faixasDeTempo(
    { lotes: lote.linhas, eventos: lote.estante_ids.flatMap((id) => eventosPorLinha.get(id) ?? []) },
    { hoje, parametros },
  );
  const maior = Math.max(...t.faixas.map((f) => f.blocos));
  const topo = t.faixas.filter((f) => f.blocos === maior);
  const valor = maior <= 0 ? SEM_RETIRADA : topo.length > 1 ? EMPATE : topo[0].chave;
  const rotulo = valor === SEM_RETIRADA ? ROTULO_SEM_RETIRADA
    : valor === EMPATE ? `empate: ${emLista(topo.map((f) => f.rotulo))}` : topo[0].rotulo;
  return {
    faixas: t.faixas,
    sem_data_valida_blocos: t.anteriores.blocos + t.sem_data_do_lote_blocos,
    predominante: { valor, rotulo },
  };
}

function tempoNoCruzamento(tempoDe, escolhidos, base, parametros) {
  const sel = escolhidos.map((l) => tempoDe.get(l.chave));
  const todos = base.map((l) => tempoDe.get(l.chave));
  const conta = (lista, valor) => lista.filter((t) => t.predominante.valor === valor).length;
  const nSel = sel.length - conta(sel, SEM_RETIRADA);
  const nBase = todos.length - conta(todos, SEM_RETIRADA);
  const molde = faixasDeTempo({ lotes: [], eventos: [] }, { parametros }).faixas;
  const blocos = molde.map((_, i) => sel.reduce((s, t) => s + t.faixas[i].blocos, 0));
  const semDataValida = sel.reduce((s, t) => s + t.sem_data_valida_blocos, 0);
  const totalBlocos = blocos.reduce((s, b) => s + b, 0) + semDataValida;
  return {
    eixo: 'dias entre a data do lote e a data da retirada',
    faixas: molde.map((f, i) => {
      const predominante = parDe(conta(sel, f.chave), nSel);
      const baseDaFaixa = parDe(conta(todos, f.chave), nBase);
      return {
        valor: f.chave, rotulo: f.rotulo, blocos: blocos[i], pct_blocos: razao(blocos[i], totalBlocos),
        predominante, base: baseDaFaixa, base_pequena: baseDaFaixa.k < BASE_MINIMA,
        diferenca_pp: diferencaPp(predominante, baseDaFaixa),
      };
    }),
    empate: { predominante: parDe(conta(sel, EMPATE), nSel), base: parDe(conta(todos, EMPATE), nBase) },
    sem_data_valida: { blocos: semDataValida, pct_blocos: razao(semDataValida, totalBlocos) },
    total_blocos: totalBlocos,
    sem_retirada: { k: sel.length - nSel, n: sel.length, base: parDe(todos.length - nBase, todos.length), rotulo: ROTULO_SEM_RETIRADA },
  };
}

export function cruzarLotes(dados = {}, opcoes = {}) {
  const {
    inicio, fim, hoje, chaves = [], parametros = PARAMETROS, fisicaPorLote = null,
  } = opcoes;
  const linhasValidas = (dados.lotes ?? []).filter((l) => l.lote_pesquisa !== true);
  const linhasPorId = new Map(linhasValidas.map((l) => [l.id, l]));
  const batidasPorId = agrupar(dados.autoclaves ?? [], 'lote_id');
  const todos = agruparEmLotes({ lotes: linhasValidas, eventos: dados.eventos ?? [], colheitas: [] }, {})
    .map((g) => atributosDoLote(g, linhasPorId, hoje, parametros, batidasPorId));
  const base = todos.filter((l) => Boolean(l.data_lote) && l.data_lote >= inicio && l.data_lote <= fim);
  const baseDaChave = new Map(base.map((l) => [l.chave, l]));

  const escolhidos = [];
  const naoEncontrados = [];
  const vistas = new Set();
  for (const chave of chaves) {
    if (vistas.has(chave)) continue;
    vistas.add(chave);
    if (baseDaChave.has(chave)) escolhidos.push(baseDaChave.get(chave));
    else naoEncontrados.push(chave);
  }

  const eventosPorId = Array.isArray(dados.eventos_atipicos) ? agrupar(dados.eventos_atipicos, 'lote_id') : null;
  const fontes = { batidasPorId, eventosPorId };
  const ctxSelecionados = escolhidos.map((l) => contextoDoLote(l, fontes));
  const ctxBase = base.map((l) => contextoDoLote(l, fontes));

  const dimensoes = DIMENSOES.map((dim) => (dim.eventos && eventosPorId == null
    ? { chave: dim.chave, titulo: dim.titulo, grupo: dim.grupo, disponivel: false, valores: [], sem_registro: null }
    : valoresDaDimensao(dim, ctxSelecionados, ctxBase, base.length)));

  const coincidencias = escolhidos.length < 2 ? [] : dimensoes.flatMap((d, i) => d.valores
    .filter((v) => v.selecionados.k >= 2)
    .map((v) => ({ dimensao: d.chave, titulo: d.titulo, ordem_da_dimensao: i, ...v })))
    .sort((a, b) => (b.selecionados.k - a.selecionados.k) || ((b.diferenca_pp ?? -Infinity) - (a.diferenca_pp ?? -Infinity))
      || (a.ordem_da_dimensao - b.ordem_da_dimensao) || ordemPt(a.rotulo, b.rotulo))
    .map(({ ordem_da_dimensao: _ordem, ...resto }) => resto);

  const eventosPorLinha = agrupar(dados.eventos ?? [], 'lote_id');
  const tempoDe = new Map(base.map((l) => [l.chave, tempoDoLote(l, eventosPorLinha, hoje, parametros)]));

  return {
    inicio, fim, hoje, base_minima: BASE_MINIMA, base_n: base.length, selecionados: escolhidos.length,
    nao_encontrados: naoEncontrados, coincidencias, dimensoes,
    tempo: tempoNoCruzamento(tempoDe, escolhidos, base, parametros),
    lotes: ctxSelecionados.map((c) => ({
      ...detalheDoLote(c, fisicaPorLote), faixa_predominante: tempoDe.get(c.lote.chave).predominante,
    })),
  };
}
