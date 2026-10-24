import { PARAMETROS, semaforoDeContaminacao } from './parametrosDoPainel.js';
import { agruparEmLotes } from './painelDoCiclo.js';
import { contaminacaoPorSemana, tendenciaDaContaminacao } from './contaminacaoPorSemana.js';
import { alertasDeRonda } from './alertaDeRonda.js';
import { contaminacaoPorPeriodo, JANELAS_DE_COMPARACAO } from './contaminacaoPorPeriodo.js';
import { diasEntre } from './maturidadeDaCoorte.js';
import { contaminacaoDoLocal } from './contaminacaoDoLocal.js';
import { AJUSTE_HISTORICO } from './ajusteHistoricoContaminados.js';

const razao = (a, b) => (Number.isFinite(a) && Number.isFinite(b) && b > 0 ? a / b : null);

function estantesFisicasDaLinha(valor) {
  if (valor == null) return 1;
  const itens = String(valor).split(',').map((s) => s.trim()).filter((s) => s !== '');
  return itens.length || 1;
}

export function coberturaDoCampo(lotes = [], campo, { minimo = 0.6 } = {}) {
  const total = lotes.length;
  if (total === 0) {
    return { preenchidos: 0, total: 0, pct: null, suficiente: false, campo_ausente_na_fonte: false };
  }

  const campoNaFonte = lotes.some((l) => campo in l);
  if (!campoNaFonte) {
    return { preenchidos: 0, total, pct: null, suficiente: false, campo_ausente_na_fonte: true };
  }

  const preenchidos = lotes.filter((l) => String(l[campo] ?? '').trim() !== '').length;
  const pct = preenchidos / total;
  return { preenchidos, total, pct, suficiente: pct != null && pct >= minimo, campo_ausente_na_fonte: false };
}

export function concentracaoPorGalpao(lotes = [], opcoes = {}) {
  const { parametros = PARAMETROS } = opcoes;
  const porGalpao = new Map();
  for (const l of lotes) {
    for (const g of (l.galpoes ?? []).length ? l.galpoes : ['—']) {
      if (!porGalpao.has(g)) porGalpao.set(g, { galpao: g, blocos_produzidos: 0, blocos_contaminados: 0, lotes: 0 });
      const a = porGalpao.get(g);
      a.blocos_produzidos += Number(l.blocos_produzidos ?? 0);
      a.blocos_contaminados += Number(l.blocos_contaminados ?? 0);
      a.lotes += 1;
    }
  }
  return [...porGalpao.values()]
    .map((a) => {
      const taxa = razao(a.blocos_contaminados, a.blocos_produzidos);
      return { ...a, taxa, semaforo: semaforoDeContaminacao(taxa, parametros) };
    })
    .sort((a, b) => (b.taxa ?? -1) - (a.taxa ?? -1));
}

export function concentracaoPorTipo(lotes = [], opcoes = {}) {
  const { parametros = PARAMETROS } = opcoes;
  const porTipo = new Map();
  for (const l of lotes) {
    const t = l.tipo ?? '—';
    if (!porTipo.has(t)) porTipo.set(t, { tipo: t, blocos_produzidos: 0, blocos_contaminados: 0, lotes: 0 });
    const a = porTipo.get(t);
    a.blocos_produzidos += Number(l.blocos_produzidos ?? 0);
    a.blocos_contaminados += Number(l.blocos_contaminados ?? 0);
    a.lotes += 1;
  }
  return [...porTipo.values()]
    .map((a) => {
      const taxa = razao(a.blocos_contaminados, a.blocos_produzidos);
      return { ...a, taxa, semaforo: semaforoDeContaminacao(taxa, parametros) };
    })
    .sort((a, b) => (b.taxa ?? -1) - (a.taxa ?? -1));
}

export function topLotesContaminados(lotes = [], opcoes = {}) {
  const { limite = 10, parametros = PARAMETROS } = opcoes;
  return lotes
    .filter((l) => l.taxa_contaminacao != null)
    .sort((a, b) => b.taxa_contaminacao - a.taxa_contaminacao)
    .slice(0, limite)
    .map((l, i) => ({
      ...l,
      rank: i + 1,
      semaforo: semaforoDeContaminacao(l.taxa_contaminacao, parametros),
      contagem_inconsistente: l.taxa_contaminacao > 1,
    }));
}

export function faixasDeTempo(dados = {}, { hoje = null, parametros = PARAMETROS, idsNoEscopo = null } = {}) {
  const cortes = [
    parametros.contaminacaoFaixa1 ?? 10,
    parametros.contaminacaoFaixa2 ?? 15,
    parametros.contaminacaoFaixa3 ?? 20,
    parametros.contaminacaoFaixa4 ?? 30,
  ];
  const dataDoLote = new Map();
  for (const l of dados.lotes ?? []) dataDoLote.set(l.id, l.data_lote ?? null);

  const ultimo = cortes[cortes.length - 1];
  const baldes = [
    ...cortes.map((ate, i) => {
      const de = i === 0 ? 0 : cortes[i - 1] + 1;
      return { chave: `${de}-${ate}`, rotulo: `${de} a ${ate} dias`, lancamentos: 0, blocos: 0 };
    }),
    { chave: `+${ultimo}`, rotulo: `acima de ${ultimo} dias`, lancamentos: 0, blocos: 0 },
  ];
  const anteriores = { lancamentos: 0, blocos: 0 };
  let semDataDoLote = 0;
  let semDataDoLoteBlocos = 0;

  for (const e of dados.eventos ?? []) {
    if (idsNoEscopo && !idsNoEscopo.has(e.lote_id)) continue;
    if (e.tipo !== 'CONTAMINACAO') continue;
    const q = Number(e.quantidade) || 0;
    const dl = dataDoLote.get(e.lote_id);
    if (!dl) { semDataDoLote += 1; semDataDoLoteBlocos += q; continue; }
    const dias = diasEntre(dl, e.data_evento);
    if (dias == null) { semDataDoLote += 1; semDataDoLoteBlocos += q; continue; }
    if (dias < 0) { anteriores.lancamentos += 1; anteriores.blocos += q; continue; }
    const achou = cortes.findIndex((ate) => dias <= ate);
    const i = achou === -1 ? cortes.length : achou;
    baldes[i].lancamentos += 1;
    baldes[i].blocos += q;
  }

  const base = {
    lancamentos: baldes.reduce((s, b) => s + b.lancamentos, 0),
    blocos: baldes.reduce((s, b) => s + b.blocos, 0),
  };
  return {
    faixas: baldes.map((b) => ({ ...b, pct_blocos: razao(b.blocos, base.blocos) })),
    base,
    anteriores,
    sem_data_do_lote: semDataDoLote,
    sem_data_do_lote_blocos: semDataDoLoteBlocos,
    eixo: 'data_evento - data_inoculacao',
  };
}

export function rastreabilidadeDosContaminados(eventos = [], lotes = [], { blocosProduzidos = 0, comAjuste = true } = {}) {
  const lotePorId = new Map(lotes.map((l) => [l.id, l]));
  const vazio = (v) => String(v ?? '').trim() === '';
  const fonteCompleta = eventos.every((e) => 'estante_registrada' in e);
  const baldes = {
    completos: 0, sem_estante_importados: 0, sem_estante_lancados: 0, sem_cor: 0, sem_dado_do_lote: 0,
  };
  let rastreaveis = 0;
  for (const e of eventos) {
    const q = Number(e.quantidade) || 0;
    rastreaveis += q;
    const l = lotePorId.get(e.lote_id) ?? {};
    const balde = !e.estante_registrada ? (e.importado ? 'sem_estante_importados' : 'sem_estante_lancados')
      : vazio(e.tipo_contaminado) ? 'sem_cor'
        : vazio(l.galpao) || vazio(l.tipo) ? 'sem_dado_do_lote'
          : 'completos';
    baldes[balde] += q;
  }
  const ajuste = comAjuste ? AJUSTE_HISTORICO.blocos : 0;
  const total = rastreaveis + ajuste;
  return {
    rastreaveis,
    ajuste_aplicado: comAjuste,
    ajuste_historico: ajuste,
    ajuste_registros: comAjuste ? AJUSTE_HISTORICO.registros : 0,
    corte: AJUSTE_HISTORICO.corte,
    total,
    taxa_geral: razao(total, blocosProduzidos),
    composicao: fonteCompleta ? baldes : null,
    cobertura: fonteCompleta ? razao(baldes.completos, total) : null,
  };
}

export function montarPainelContaminados(dados = {}, opcoes = {}) {
  const {
    hoje, filtro = {}, parametros = PARAMETROS, fisicaPorLote = null, periodo = null, comDivergencia = null,
  } = opcoes;
  const lotes = agruparEmLotes(dados, filtro);
  const semanas = contaminacaoPorSemana(lotes, { hoje, parametros });

  const blocosProduzidos = lotes.reduce((t, l) => t + Number(l.blocos_produzidos ?? 0), 0);
  const blocosContaminados = lotes.reduce((t, l) => t + Number(l.blocos_contaminados ?? 0), 0);
  const afetados = lotes.filter((l) => Number(l.blocos_contaminados ?? 0) > 0).length;

  const idsNoEscopo = new Set(lotes.flatMap((l) => l.estante_ids ?? []));
  const lotesNoEscopo = (dados.lotes ?? []).filter((l) => idsNoEscopo.has(l.id));
  const eventosNoEscopo = (dados.eventos ?? [])
    .filter((e) => e.tipo === 'CONTAMINACAO' && idsNoEscopo.has(e.lote_id));
  const enderecosAfetados = new Set(eventosNoEscopo.map((e) => e.lote_id)).size;

  const comColuna = eventosNoEscopo.filter((e) => 'local_no_bloco' in e);
  const anotados = comColuna.filter((e) => e.local_no_bloco != null && String(e.local_no_bloco).trim() !== '').length;
  const fraseDoLocal = eventosNoEscopo.length > 0 && comColuna.length === 0
    ? 'localização no bloco: a carga deste painel ainda não lê a coluna'
    : `localização no bloco: coluna existe, ${anotados} de ${eventosNoEscopo.length} eventos anotados`;

  return {
    hoje,
    semanas,
    tendencia: tendenciaDaContaminacao(semanas, { parametros }),
    galpoes: concentracaoPorGalpao(lotes, { parametros }),
    por_tipo: concentracaoPorTipo(lotes, { parametros }),
    top: topLotesContaminados(lotes, { limite: 10, parametros }),
    rondas: alertasDeRonda(dados, { hoje, parametros, filtro }),
    faixas: faixasDeTempo(dados, { hoje, parametros, idsNoEscopo }),
    periodos: JANELAS_DE_COMPARACAO.map((dias) => contaminacaoPorPeriodo(dados, {
      hoje, dias, idsNoEscopo, fisicaPorLote,
    })),
    local: periodo ? contaminacaoDoLocal(dados, {
      inicio: periodo.inicio, fim: periodo.fim, idsNoEscopo, fisicaPorLote, comDivergencia,
      taxaDoLotePorChave: new Map(lotes.map((l) => [l.chave, l.taxa_contaminacao ?? null])),
    }) : null,
    resumo: {
      lotes: lotes.length,
      lotes_com_contaminacao: afetados,
      pct_lotes_afetados: razao(afetados, lotes.length),
      enderecos: idsNoEscopo.size,
      estantes_fisicas: lotesNoEscopo.reduce((t, l) => t + estantesFisicasDaLinha(l.estante_maturacao), 0),
      enderecos_com_contaminacao: enderecosAfetados,
      pct_enderecos_afetados: razao(enderecosAfetados, idsNoEscopo.size),
      blocos_produzidos: blocosProduzidos,
      blocos_contaminados: blocosContaminados,
      taxa: razao(blocosContaminados, blocosProduzidos),
      meta: parametros.contaminacaoMeta,
      meta_origem: parametros.origens?.contaminacaoMeta ?? 'PADRAO',
      corte_amarelo: parametros.contaminacaoAmarelo,
      corte_vermelho: parametros.contaminacaoVermelho,
    },
    rastreabilidade: rastreabilidadeDosContaminados(eventosNoEscopo, lotesNoEscopo, {
      blocosProduzidos, comAjuste: !filtro.tipo,
    }),
    cobertura: {
      responsavel_semeacao: coberturaDoCampo(lotesNoEscopo, 'responsavel_semeacao'),
      blocos_guardados: coberturaDoCampo(lotesNoEscopo, 'blocos_guardados'),
    },
    escopo: {
      cobre: ['semana de producao', 'maturidade', 'tendencia', 'concentracao por galpao', 'top 10',
        'alerta de ronda por estante', 'comparacao por periodo pela data da retirada'],
      fora: [
        'autoclave (responsavel, tempo, temperatura, pressao, desvios): nao existe no banco',
        fraseDoLocal,
        'sala de maturacao: sem vinculo entre galpao e sala cadastrada',
        'ranking de recorrencia por pessoa: responsavel_semeacao cobre 40% dos lotes',
      ],
    },
  };
}
