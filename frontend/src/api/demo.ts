import type {
  IndicadoresDoPainel,
  Alerta, ApiComprasMp, Apoio, CapacidadeLivre, CategoriaGerencial, CategoriaGerencialPatch,
  ColheitaDoDia, ColheitaEmbalagemBloco, ColheitaSalva, Comportamento, CompraMensalEdicao, CompraMensalItem,
  CompraPrevista, ContaminacaoDoLocal, ContaminacaoSalva, ContaminadoLinha, DesempenhoCelula, Divergencia,
  BatidaDaAutoclave, DesempenhoOperacao, DesempenhoProduto, DesempenhoResposta, DetalhesDoLoteJornada, DreColuna,
  DreConta, DreContasResposta, DreGerencialBloco, DreGerencialResposta,
  DreGerencialVisao, DreResposta, DreSplitMes, DesprezoBody, DiaSemColheita,
  EmbalagemDesprezo, EmbalagemGrade, EmbalagemProduto, EmbalagemResumo, EmbalagemSalva, EstruturaisResposta, SaldoDeBandejasGrade, SaldoDeBandejasSalvo,
  ExclusaoColheita, ExclusaoContaminacao, ExclusaoEventoAtipico, ExclusaoLoteJornada,
  EventoAtipico, CorpoDoEventoAtipico, CruzamentoDeLotesResposta,
  GalpaoDoLocal, IndicadoresCicloMetricas, IndicadoresCicloResposta, InvestigadorContaminacaoResposta,
  JornadaLinha, Liberacao, LinhaDoLocal, LoteCriado,
  LocalNoBloco,
  LotePesquisa, MetaOperacional, MetaOperacionalSalva, MetasOperacionaisResposta,
  PainelCicloLote, PainelCicloMetricas, PainelCicloResposta, PainelCicloValidacoes,
  AberturaGravada,
  ConversaoGrupo, ConversaoLote, ConversaoSoma, PainelCicloConversao,
  PainelContaminadosResposta,
  PainelDeComando,
  PainelKpis,
  PainelOperacionalAberturaLinha, PainelOperacionalAlerta, PainelOperacionalContaminacaoLinha,
  PainelOperacionalDivergenciaLote, PainelOperacionalEstanteEstourada,
  PainelOperacionalInsumoLinha, PainelOperacionalInsumoSemConsumo, PainelOperacionalResposta,
  PainelOperacionalSementeProxima,
  PendenciasDeLancamento,
  Pessoa,
  PimentaoConsolidadoLinha, PrevisaoAberturaLinha, PrevisaoAberturaResposta,
  PrevisaoItem, PrevisaoResposta, TipoPrevisao,
  PimentaoFinanceiroResposta, PimentaoPlantiosResposta, PimentaoRegistro,
  ComposicaoDeReceita,
  CriarVersaoReceitaBody, ReceitaAntiga, ReceitaSubstrato, ReceitaVigente,
  ReceitaVigenteIngrediente, RegraMaturacao, RegraMaturacaoEspecie, SalaComEtapa, VersaoReceitaCriada,
  SemanaContaminacao,
  NecessidadeDeSementesResposta, PedidoConsolidadoItem,
  SementeCepa, SementeMovimento, SementesEstoqueResposta,
  TipoContaminado, Transacao, TransferenciaSalva, VerificacaoDeRetirada,
} from './client';
import {
  FX_COMPRAS_MENSAL, FX_MP_EMBALAGENS, FX_MP_ESTOQUE, FX_MP_RECEITAS,
  FX_PIMENTAO_CONSOLIDADO, FX_PIMENTAO_ESTUFAS, FX_PIMENTAO_FINANCEIRO,
  FX_PIMENTAO_PLANTIOS, FX_PIMENTAO_PLANTIOS_TOTAL, FX_PIMENTAO_REGISTROS,
  FX_PIMENTAO_TOTAL_GERAL,
} from './fixturesOperacionais';
import { gerador } from './semente';
import { MESES_ANO } from './constantes';
import { painelDeComando } from '../../../src/services/painelDeComando.js';
import {
  LOCAIS_NO_BLOCO, ERRO_LOCAL_NO_BLOCO, baseDoCodigoDoLote, exigirSaldoParaAbertura,
  quantidadeDoSaldoTotal, motivoDaPerda,
  estanteDaContaminacao,
  ERRO_ESTANTE_DA_RETIRADA, ERRO_ESTANTE_OBRIGATORIA,
  exigirConfirmacaoDeAberturaIgual,
} from '../../../src/services/camposDoCiclo.js';
import { capacidadeLivre } from '../../../src/services/capacidadeLivre.js';
import { quadroDasEstantes } from '../../../src/services/quadroDasEstantes.js';
import { indicadoresDoPainel, janelaDoPeriodo } from '../../../src/services/indicadoresDoPainel.js';
import { galpaoDoCaderno } from '../../../src/services/galpaoDoCaderno.js';
import { pendenciasDeLancamento } from '../../../src/services/pendenciasDeLancamento.js';
import { necessidadeDeSementes } from '../../../src/services/necessidadeDeSementes.js';
import { apresentacaoDoProduto, resumoDaEmbalagem, blocoColheitaEmbalagem, conferenciaDoPeriodo, montarGradeDoSaldo } from '../../../src/services/conferenciaEmbalagem.js';
import { investigarContaminacao } from '../../../src/services/investigadorContaminacao.js';
import { cruzarLotes } from '../../../src/services/cruzamentoDeLotes.js';
import { AJUSTE_HISTORICO } from '../../../src/services/ajusteHistoricoContaminados.js';
import { camposDoEventoAtipico } from '../../../src/services/eventosAtipicos.js';
import { dataBr, hojeISO, ultimoMesComDado } from './constantes';

const round2 = (v: number) => Math.round(v * 100) / 100;

function fator(inicio: string) {
  const mes = Number(inicio.slice(5, 7));
  return 0.82 + ((mes + 2) % 6) * 0.07;
}

interface LinhaSpec { cod: string; nome: string; grupo: 'CUSTO_VARIAVEL' | 'DESPESA_OPERACIONAL' | 'OUTROS'; metodo: string; valor: number }

function coluna(chave: string, nome: string, tipo: string, receitaBruta: number, linhas: LinhaSpec[]): DreColuna {
  const deducoes = { glosa: 0, pis: 0, cofins: 0, outras: 0, total: 0 };
  const rl = round2(receitaBruta);
  const cv = linhas.filter((l) => l.grupo === 'CUSTO_VARIAVEL');
  const desp = linhas.filter((l) => l.grupo === 'DESPESA_OPERACIONAL');
  const outros = linhas.filter((l) => l.grupo === 'OUTROS');
  const toLinha = (l: LinhaSpec) => ({ categoria_codigo: l.cod, categoria: l.nome, valor: round2(l.valor), rateio: { criterio: l.metodo, metodo: l.metodo } });
  const soma = (arr: LinhaSpec[]) => round2(arr.reduce((s, l) => s + l.valor, 0));
  const totCv = soma(cv);
  const totDesp = soma(desp);
  const totOutros = soma(outros);
  const mc = round2(rl - totCv);
  const resultado = round2(mc - totDesp - totOutros);
  const pct = (v: number) => (rl !== 0 ? round2((v / rl) * 100) : null);
  return {
    chave, nome, tipo,
    dre: {
      receita_bruta: rl, deducoes, receita_liquida: rl,
      custos_variaveis: { linhas: cv.map(toLinha), total: totCv },
      margem_contribuicao: mc, margem_contribuicao_pct: pct(mc),
      despesas_operacionais: { linhas: desp.map(toLinha), total: totDesp },
      outros: outros.length ? { linhas: outros.map(toLinha), total: totOutros } : undefined,
      resultado_gerencial: resultado, resultado_gerencial_pct: pct(resultado),
    },
  };
}

function linhasSegmento(tipo: 'COGUMELOS' | 'PIMENTAO' | 'REVENDA', f: number): LinhaSpec[] {
  if (tipo === 'REVENDA') {
    return [
      { cod: 'CMV_REVENDA', nome: 'Custo de mercadoria (revenda)', grupo: 'CUSTO_VARIAVEL', metodo: 'DIRETO', valor: 150000 * f },
      { cod: 'PESSOAL', nome: 'Salários e benefícios', grupo: 'DESPESA_OPERACIONAL', metodo: 'PERCENTUAL_FIXO', valor: 16500 * f },
      { cod: 'MARKETING', nome: 'Marketing', grupo: 'DESPESA_OPERACIONAL', metodo: 'PROPORCIONAL_RECEITA_LIQUIDA', valor: 5200 * f },
    ];
  }
  if (tipo === 'PIMENTAO') {
    return [
      { cod: 'CUSTO_DIRETO', nome: 'Custos diretos de produto', grupo: 'CUSTO_VARIAVEL', metodo: 'DIRETO', valor: 12000 * f },
      { cod: 'PESSOAL', nome: 'Salários e benefícios', grupo: 'DESPESA_OPERACIONAL', metodo: 'PERCENTUAL_FIXO', valor: 8200 * f },
      { cod: 'MARKETING', nome: 'Marketing', grupo: 'DESPESA_OPERACIONAL', metodo: 'PROPORCIONAL_RECEITA_LIQUIDA', valor: 900 * f },
    ];
  }
  return [
    { cod: 'MP_SUBSTRATO', nome: 'Matéria-prima (substrato)', grupo: 'CUSTO_VARIAVEL', metodo: 'PROPORCIONAL_BLOCOS', valor: 38000 * f },
    { cod: 'ENERGIA_INSUMOS', nome: 'Energia e insumos operacionais', grupo: 'CUSTO_VARIAVEL', metodo: 'PROPORCIONAL_BANDEJAS', valor: 9000 * f },
    { cod: 'PESSOAL', nome: 'Salários e benefícios', grupo: 'DESPESA_OPERACIONAL', metodo: 'PERCENTUAL_FIXO', valor: 37000 * f },
    { cod: 'MARKETING', nome: 'Marketing', grupo: 'DESPESA_OPERACIONAL', metodo: 'PROPORCIONAL_RECEITA_LIQUIDA', valor: 3000 * f },
  ];
}

const RECEITA = { COGUMELOS: 96000, PIMENTAO: 22000, REVENDA: 208000 };

function mergeLinhas(...conjuntos: LinhaSpec[][]): LinhaSpec[] {
  const mapa = new Map<string, LinhaSpec>();
  for (const conj of conjuntos) {
    for (const l of conj) {
      const ex = mapa.get(l.cod);
      if (ex) ex.valor += l.valor;
      else mapa.set(l.cod, { ...l });
    }
  }
  return [...mapa.values()];
}

export function dre(params: Record<string, string | number | undefined>): Promise<DreResposta> {
  const inicio = String(params.inicio ?? '2026-06-01');
  const fim = String(params.fim ?? '2026-06-30');
  const f = fator(inicio);
  const visao = String(params.visao ?? 'consolidado');

  const seg = {
    COGUMELOS: coluna('COGUMELOS', 'Cogumelos (Produção)', 'segmento', RECEITA.COGUMELOS * f, linhasSegmento('COGUMELOS', f)),
    PIMENTAO: coluna('PIMENTAO', 'Pimentão (Produção)', 'segmento', RECEITA.PIMENTAO * f, linhasSegmento('PIMENTAO', f)),
    REVENDA: coluna('REVENDA', 'Revenda (Exemplo Alimentos)', 'segmento', RECEITA.REVENDA * f, linhasSegmento('REVENDA', f)),
  };

  const op = params.operacao ? String(params.operacao).toUpperCase() : null;

  let colunas: DreColuna[];
  if (visao === 'segmento') {
    colunas = op === 'REVENDA' ? [seg.REVENDA]
      : (op === 'PRODUCAO' ? [seg.COGUMELOS, seg.PIMENTAO] : [seg.COGUMELOS, seg.PIMENTAO, seg.REVENDA]);
  } else if (visao === 'operacao') {
    const producao = coluna('PRODUCAO', 'Produção (Aurora Rural)', 'operacao', (RECEITA.COGUMELOS + RECEITA.PIMENTAO) * f,
      mergeLinhas(linhasSegmento('COGUMELOS', f), linhasSegmento('PIMENTAO', f)));
    const revenda = coluna('REVENDA', 'Revenda (Exemplo Alimentos)', 'operacao', RECEITA.REVENDA * f, linhasSegmento('REVENDA', f));
    colunas = op === 'REVENDA' ? [revenda] : (op === 'PRODUCAO' ? [producao] : [producao, revenda]);
  } else if (visao === 'produto') {
    colunas = [
      coluna('PRODUTO_1', 'Shiitake (Produção)', 'produto', 52000 * f, linhasSegmento('COGUMELOS', f).map((l) => ({ ...l, valor: l.valor * 0.55 }))),
      coluna('PRODUTO_2', 'Shimeji Preto (Produção)', 'produto', 44000 * f, linhasSegmento('COGUMELOS', f).map((l) => ({ ...l, valor: l.valor * 0.45 }))),
    ];
  } else {
    colunas = [
      coluna('EXEMPLO_CONSOLIDADA', 'Exemplo Alimentos Consolidada', 'consolidado',
        (RECEITA.COGUMELOS + RECEITA.PIMENTAO + RECEITA.REVENDA) * f,
        mergeLinhas(linhasSegmento('COGUMELOS', f), linhasSegmento('PIMENTAO', f), linhasSegmento('REVENDA', f))),
    ];
  }

  return Promise.resolve({
    periodo: { inicio, fim }, visao, colunas, rateios_aplicados: [],
    observacoes: [
      'Dados de DEMONSTRAÇÃO: números ilustrativos, não reais.',
      'No modo real, estes valores vêm das transações via motor de rateio.',
    ],
  });
}

export function painelKpis(params: Record<string, string | number | undefined>): Promise<PainelKpis> {
  const inicio = String(params.inicio ?? '2026-06-01');
  const fim = String(params.fim ?? '2026-06-30');
  const f = fator(inicio);

  const op = params.operacao ? String(params.operacao).toUpperCase() : null;
  const segs: Array<keyof typeof RECEITA> = op === 'REVENDA' ? ['REVENDA']
    : (op === 'PRODUCAO' ? ['COGUMELOS', 'PIMENTAO'] : ['COGUMELOS', 'PIMENTAO', 'REVENDA']);
  const escopo = op === 'REVENDA' ? { visao: 'operacao', nome: 'Revenda (Exemplo Alimentos)', chave: 'REVENDA' }
    : (op === 'PRODUCAO' ? { visao: 'operacao', nome: 'Produção (Aurora Rural)', chave: 'PRODUCAO' }
      : { visao: 'consolidado', nome: 'Exemplo Alimentos Consolidada', chave: 'EXEMPLO_CONSOLIDADA' });

  const rl = round2(segs.reduce((s, k) => s + RECEITA[k] * f, 0));
  const linhas = mergeLinhas(...segs.map((k) => linhasSegmento(k, f)));
  const variaveis = round2(linhas.filter((l) => l.grupo === 'CUSTO_VARIAVEL' || l.cod === 'MARKETING').reduce((s, l) => s + l.valor, 0));
  const fixas = round2(linhas.filter((l) => l.cod === 'PESSOAL').reduce((s, l) => s + l.valor, 0));
  const mc = round2(rl - variaveis);
  const mcPct = round2((mc / rl) * 100);
  const temVolume = op !== 'REVENDA';
  const kg = temVolume ? round2(1750 * f) : 0;
  const bandejas = temVolume ? Math.round(8800 * f) : 0;
  const quantidade = temVolume ? bandejas : Math.round(11000 * f);
  const mcFrac = mc / rl;

  return Promise.resolve({
    periodo: { inicio, fim },
    escopo,
    margem_contribuicao: {
      receita_liquida: rl, custos_despesas_variaveis: variaveis, custos_despesas_fixas: fixas,
      margem_contribuicao: mc, margem_contribuicao_pct: mcPct,
      volume: { kg, bandejas },
      margem_contribuicao_unitaria: {
        por_kg: kg > 0 ? round2(mc / kg) : null,
        por_bandeja: bandejas > 0 ? round2(mc / bandejas) : null,
      },
      sem_despesa_no_periodo: false,
      meses_sem_despesa: [],
    },
    indicadores_prioritarios: ['margem_contribuicao', 'ponto_equilibrio', 'geracao_caixa'],
    ponto_equilibrio: {
      custos_despesas_fixas: fixas, margem_contribuicao_pct: mcPct,
      sem_despesa_no_periodo: false,
      ponto_equilibrio_reais: round2(fixas / mcFrac),
      ponto_equilibrio_kg: kg > 0 ? round2(fixas / (mc / kg)) : null,
      ponto_equilibrio_bandejas: bandejas > 0 ? Math.ceil(fixas / (mc / bandejas)) : null,
      margem_seguranca_pct: round2(((rl - fixas / mcFrac) / rl) * 100),
      receita_liquida: rl,
    },
    geracao_caixa: {
      recebimentos_operacionais: round2(rl * 0.92),
      pagamentos_operacionais: round2((variaveis + fixas) * 0.88),
      geracao_caixa: round2(rl * 0.92 - (variaveis + fixas) * 0.88),
      resultado_operacional: round2(mc - fixas),
      caixa_operacao: round2(rl * 0.92 - (variaveis + fixas) * 0.88),
      variacao_liquida_caixa: round2(rl * 0.92 - (variaveis + fixas) * 0.88 - 4200),
    },
    preco_medio: { preco_medio: round2((rl * 1.02) / quantidade), receita_bruta: round2(rl * 1.02), quantidade },
    investimentos: [
      { investimento: { id: 1, descricao: 'Sala de incubação climatizada', valor_capex: 50000 }, roi_pct: 200, payback_meses: 20 },
    ],
  });
}

export function alertas(inicio: string, fim: string): Promise<{ total_alertas: number; alertas: Alerta[] }> {
  const f = fator(inicio);
  const arr: Alerta[] = [];
  const margemCog = round2(((RECEITA.COGUMELOS * f) - linhasSegmento('COGUMELOS', f).filter((l) => l.grupo === 'CUSTO_VARIAVEL' || l.cod === 'MARKETING').reduce((s, l) => s + l.valor, 0)) / (RECEITA.COGUMELOS * f) * 100);
  if (margemCog < 30) {
    arr.push({ indicador: 'MARGEM_CONTRIBUICAO_PCT', severidade: 'MEDIA', valor_atual: margemCog, valor_limite: 30,
      mensagem: `MARGEM_CONTRIBUICAO_PCT (COGUMELOS) = ${margemCog} < 30: Margem de contribuição de Cogumelos abaixo de 30%.` });
  }
  void fim;
  return Promise.resolve({ total_alertas: arr.length, alertas: arr });
}

export const apoioDemo: Apoio = {
  unidades: [
    { id: 1, codigo: 'AURORA_RURAL', nome: 'Aurora Rural', tipo_atuacao: 'PRODUCAO' },
    { id: 2, codigo: 'EXEMPLO', nome: 'Exemplo Alimentos', tipo_atuacao: 'REVENDA' },
  ],
  produtos: [
    { id: 1, nome: 'Shiitake', codigo: 'SH', tipo_operacao: 'PRODUCAO', unidade_negocio_id: 1 },
    { id: 2, nome: 'Shimeji Preto', codigo: 'SP', tipo_operacao: 'PRODUCAO', unidade_negocio_id: 1 },
    { id: 3, nome: 'Shimeji Branco', codigo: 'SB', tipo_operacao: 'PRODUCAO', unidade_negocio_id: 1 },
    { id: 7, nome: 'Champignon em conserva', codigo: 'CH', tipo_operacao: 'REVENDA', unidade_negocio_id: 2 },
    { id: 8, nome: 'Cogumelo Paris', codigo: 'PL', tipo_operacao: 'REVENDA', unidade_negocio_id: 2 },
  ],
  centros_custo: [
    { id: 1, codigo: 'CC-COG', nome: 'Produção de Cogumelos', unidade_negocio_id: 1 },
    { id: 2, codigo: 'CC-PIM', nome: 'Produção de Pimentão', unidade_negocio_id: 1 },
    { id: 3, codigo: 'CC-REV', nome: 'Revenda', unidade_negocio_id: 2 },
    { id: 4, codigo: 'CC-ADM', nome: 'Administrativo (compartilhado)', unidade_negocio_id: null },
  ],
  categorias_gerenciais: [
    { id: 1, codigo: 'MP_SUBSTRATO', nome: 'Matéria-prima (substrato)', grupo_dre: 'CUSTO_VARIAVEL', comportamento: 'VARIAVEL' },
    { id: 5, codigo: 'PESSOAL', nome: 'Salários e benefícios', grupo_dre: 'DESPESA_OPERACIONAL', comportamento: 'FIXO' },
    { id: 6, codigo: 'MARKETING', nome: 'Marketing', grupo_dre: 'DESPESA_OPERACIONAL', comportamento: 'VARIAVEL' },
  ],
};

let SEQ = 1000;
const store: Transacao[] = [
  linhaTx(1, 'RECEITA', '2026-06-05', 'Venda bandejas: feira do bairro', 11800, 'Shiitake', null, false, 'IMPORTACAO'),
  linhaTx(2, 'DESPESA', '2026-06-08', 'Conta de energia', 4200, null, { codigo: 'ENERGIA_INSUMOS', nome: 'Energia e insumos operacionais' }, true, 'MANUAL'),
  linhaTx(3, 'DESPESA', '2026-06-10', 'Compra de serragem', 2600, null, null, true, 'MANUAL'),
  linhaTx(4, 'RECEITA', '2026-06-15', 'Revenda champignon: mercado', 9100, 'Champignon em conserva', null, false, 'IMPORTACAO'),
];

function linhaTx(id: number, natureza: 'RECEITA' | 'DESPESA', data: string, descricao: string, valor: number,
  produto: string | null, categoria: { codigo: string; nome: string } | null, manual: boolean, origem: string): Transacao {
  return {
    id, natureza, descricao, data_competencia: data, receita_bruta: valor,
    receita_liquida: valor, total_deducoes: 0, quantidade: natureza === 'RECEITA' ? Math.round(valor / 18) : null,
    inserido_manualmente: manual, origem,
    produtos: produto ? { nome: produto } : null,
    centros_custo: null,
    categorias_gerenciais: categoria,
  };
}

export function transacoes(): Promise<Transacao[]> {
  return Promise.resolve([...store].sort((a, b) => b.data_competencia.localeCompare(a.data_competencia)));
}

export function criarTransacao(body: Record<string, unknown>): Promise<Transacao> {
  const nova = linhaTx(
    (SEQ += 1),
    (body.natureza as 'RECEITA' | 'DESPESA') ?? 'DESPESA',
    String(body.dataCompetencia ?? '2026-06-20'),
    String(body.descricao ?? 'Lançamento demo'),
    Number(body.receitaBruta ?? 0),
    null,
    body.categoriaGerencialId ? { codigo: 'MANUAL', nome: 'Classificada' } : null,
    true, 'MANUAL',
  );
  store.unshift(nova);
  return Promise.resolve(nova);
}

export function lancamentosManuais(params: Record<string, string | number | undefined>): Promise<{ total: number; lancamentos: Transacao[] }> {
  const itens = params.semCategoria === 'true'
    ? store.filter((t) => !t.categorias_gerenciais && t.natureza === 'DESPESA')
    : store.filter((t) => t.inserido_manualmente);
  return Promise.resolve({ total: itens.length, lancamentos: itens });
}

export function corrigirLancamento(id: number, body: Record<string, unknown>): Promise<{ lancamento: Transacao; alteracoes: number }> {
  const t = store.find((x) => x.id === id);
  if (t && !t.inserido_manualmente && (body.centroCustoId != null || body.produtoId != null)) {
    return Promise.reject(new Error('Lançamento importado da planilha: só a categoria gerencial pode ser corrigida por aqui.'));
  }
  if (t && body.categoriaGerencialId) {
    t.categorias_gerenciais = { codigo: 'CORRIGIDA', nome: 'Reclassificada (demo)' };
  }
  return Promise.resolve({ lancamento: t ?? store[0], alteracoes: 1 });
}

const categoriasStore: CategoriaGerencial[] = [
  { id: 1, codigo: 'MP_SUBSTRATO', nome: 'Matéria-prima (substrato)', grupo_dre: 'CUSTO_VARIAVEL', comportamento: 'VARIAVEL', eh_operacional: true },
  { id: 5, codigo: 'PESSOAL', nome: 'Salários e benefícios', grupo_dre: 'DESPESA_OPERACIONAL', comportamento: 'FIXO', eh_operacional: true },
  { id: 6, codigo: 'MARKETING', nome: 'Marketing', grupo_dre: 'DESPESA_OPERACIONAL', comportamento: 'VARIAVEL', eh_operacional: true },
  { id: 7, codigo: 'IMPOSTOS', nome: 'Impostos', grupo_dre: 'DESPESA_OPERACIONAL', comportamento: 'FIXO', eh_operacional: true },
  { id: 9, codigo: 'FINANCEIRA', nome: 'Financeira', grupo_dre: 'OUTROS', comportamento: 'FIXO', eh_operacional: false },
];

export function categoriasGerenciais(): Promise<CategoriaGerencial[]> {
  return Promise.resolve(categoriasStore.map((c) => ({ ...c })));
}

export function atualizarCategoriaGerencial(id: number, body: CategoriaGerencialPatch): Promise<CategoriaGerencial> {
  const c = categoriasStore.find((x) => x.id === id);
  if (!c) return Promise.reject(new Error(`categoria gerencial ${id} não encontrada.`));
  if (body.comportamento !== undefined) c.comportamento = body.comportamento;
  if (body.grupo_dre !== undefined) c.grupo_dre = body.grupo_dre;
  if (body.eh_operacional !== undefined) c.eh_operacional = body.eh_operacional;
  return Promise.resolve({ ...c });
}

type LinhaFx = [number, string, 'moeda' | 'pct', string, Array<number | null>, number | null];
type BlocoFx = [id: string, titulo: string | null, linhas: LinhaFx[]];

const MESES_COM_DADOS_DRE = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI'];

function blocoFx([id, titulo, linhas]: BlocoFx): DreGerencialBloco {
  return {
    id, titulo,
    linhas: linhas.map(([nivel, label, tipo, flags, vals, total], i) => {
      const grupo = flags.includes('g');
      const comp: Comportamento | 'MISTO' | null =
        flags.includes('m') ? 'MISTO' : flags.includes('v') ? 'VARIAVEL' : flags.includes('f') ? 'FIXO' : null;
      return {
        id: `${id}:${i}`, label, tipo, nivel,
        grupo: grupo || undefined,
        destaque: flags.includes('d') || undefined,
        comportamento: !grupo && (comp === 'FIXO' || comp === 'VARIAVEL') ? comp : undefined,
        comportamento_resumo: grupo && comp ? comp : undefined,
        valores: Object.fromEntries(MESES_ANO.map((m, j) => [m, vals[j] ?? null])),
        total,
      };
    }),
  };
}

type FolhaDre = [number, string, string, number | number[] | null];
const gDre = gerador(202605);
const serieDre = (base: number) => MESES_COM_DADOS_DRE.map(() => round2(base * gDre.entre(0.86, 1.14)));
const RECEITA_COG_DRE = serieDre(72000);
const RECEITA_PIM_DRE = [0, 0, ...serieDre(31000).slice(2)];
const RECEITA_REV_DRE = serieDre(236000);
const somaSeries = (...series: number[][]) => MESES_COM_DADOS_DRE.map((_, k) => round2(series.reduce((t, s) => t + s[k], 0)));

function demonstrativoDre(folhas: FolhaDre[]): LinhaFx[] {
  const linhas: LinhaFx[] = folhas.map(([nivel, label, flags, v]) => [nivel, label, 'moeda', flags,
    v == null ? [] : (Array.isArray(v) ? [...v] : serieDre(v)), null]);
  for (let i = linhas.length - 1; i >= 0; i -= 1) {
    if (folhas[i][3] != null) continue;
    const filhas: LinhaFx[] = [];
    if (linhas[i][1] === 'Total Geral') filhas.push(...linhas.slice(0, i).filter((l) => l[0] === 0));
    else for (let j = i + 1; j < linhas.length && linhas[j][0] > linhas[i][0]; j += 1) if (linhas[j][0] === linhas[i][0] + 1) filhas.push(linhas[j]);
    linhas[i][4] = somaSeries(...filhas.map((l) => l[4] as number[]));
  }
  for (const l of linhas) l[5] = round2(l[4].reduce<number>((t, v) => t + (v ?? 0), 0));
  return linhas;
}

const pctDre = (num: Array<number | null>, den: Array<number | null>): Array<number | null> =>
  num.map((v, k) => (den[k] ? Math.round(((v ?? 0) / (den[k] as number)) * 10000) / 10000 : null));
const totalDre = (v: Array<number | null>) => round2(v.reduce<number>((t, x) => t + (x ?? 0), 0));
const linhaDre = (nivel: number, label: string, flags: string, v: Array<number | null>): LinhaFx => [nivel, label, 'moeda', flags, v, totalDre(v)];
const pctLinhaDre = (nivel: number, num: Array<number | null>, den: Array<number | null>): LinhaFx => {
  const tn = totalDre(num); const td = totalDre(den);
  return [nivel, '%', 'pct', '', pctDre(num, den), td ? Math.round((tn / td) * 10000) / 10000 : null];
};

function resumoDre(titulo: string, folhas: FolhaDre[], d: LinhaFx[]): BlocoFx {
  const das = (marca: string) => somaSeries(...d.filter((l, i) => folhas[i][3] != null && l[3].includes(marca)).map((l) => l[4] as number[]));
  const receitas = d[0][4];
  const variaveis = das('v');
  const fixos = das('f');
  const mc = somaSeries(receitas as number[], variaveis);
  const gastos = somaSeries(variaveis, fixos);
  const resultado = somaSeries(receitas as number[], gastos);
  return ['resumo', titulo, [
    linhaDre(0, 'RECEITAS', 'd', receitas), linhaDre(0, '(−) CUSTOS + DESPESAS VARIÁVEIS', '', variaveis),
    linhaDre(0, '(=) MARGEM DE CONTRIBUIÇÃO', 'd', mc), linhaDre(0, '(−) CUSTOS + DESPESAS FIXOS', '', fixos),
    linhaDre(0, 'GASTOS GERAIS (CUSTOS + DESPESAS)', 'd', gastos), pctLinhaDre(0, gastos, receitas),
    linhaDre(0, 'RESULTADO OPERACIONAL', 'd', resultado), pctLinhaDre(0, resultado, receitas),
  ]];
}

const FOLHAS_CONSOLIDADO: FolhaDre[] = [
  [0, '1. RECEITAS', 'g', null], [1, 'RECEITAS', 'g', null], [2, 'Receitas', '', somaSeries(RECEITA_COG_DRE, RECEITA_PIM_DRE, RECEITA_REV_DRE)],
  [0, '2. CUSTOS GERAIS', 'gv', null], [1, 'Custos Gerais', 'gv', null],
  [2, 'Custo Produção Cogumelo', 'v', -16000], [2, 'Custo Produção Pimentão', 'v', -9000], [2, 'Custo Revenda', 'v', -166000],
  [0, '3. DESPESAS GERAIS', 'gm', null], [1, 'OPERACIONAL', 'gf', null],
  [2, 'Operacional Cogumelo', 'f', -4200], [2, 'Operacional Pimentão', 'f', -2800], [2, 'Operacional Revenda', 'f', -600],
  [2, 'Operacional Produção', 'f', -2100], [2, 'Operacional Compartilhado', 'f', -17500],
  [1, 'PESSOAL', 'gf', null], [2, 'Pessoal Produção', 'f', -31000], [2, 'Pessoal Compartilhado', 'f', -19500],
  [1, 'IMPOSTOS', 'gv', null], [2, 'Impostos Revenda', 'v', -8200], [2, 'Impostos Produção', 'v', -1500],
  [0, '4. FINANCEIRA', 'gf', null], [1, 'FINANCEIRA', 'gf', null], [2, 'Financeira Produção', 'f', -2000], [2, 'Financeira Revenda', 'f', -1300],
  [0, '5. PATRIMÔNIO', 'g', null], [1, 'PATRIMÔNIO', 'g', null],
  [2, 'Patrimônio Cogumelo', '', -3000], [2, 'Patrimônio Pimentão', '', -1100], [2, 'Patrimônio Produção', '', -1900], [2, 'Capex', '', -6500],
  [0, '6. RETIRADAS', 'g', null], [1, 'RETIRADAS', 'g', null], [2, 'Retiradas', '', -15000],
  [0, '7. APORTE', 'g', null], [1, 'APORTE', 'g', null], [2, 'APORTE', '', 5000],
  [0, 'Total Geral', 'd', null],
];
const FOLHAS_PRODUCAO: FolhaDre[] = [
  [0, '1. RECEITAS', 'g', null], [1, '1.1. COGUMELO', '', RECEITA_COG_DRE], [1, '1.1. PIMENTÃO', '', RECEITA_PIM_DRE],
  [0, '2. CUSTOS GERAIS', 'gv', null], [1, 'Custo Produção Cogumelo', 'v', -16000], [1, 'Custo Produção Pimentão', 'v', -9000],
  [0, '3. DESPESAS GERAIS', 'gf', null],
  [1, '3.1 COGUMELO', 'gf', null], [2, 'OPERACIONAL', 'f', -6000], [2, 'PESSOAL', 'f', -21000], [2, 'IMPOSTOS', '', -1000],
  [1, '3.2 PIMENTÃO', 'gf', null], [2, 'OPERACIONAL', 'f', -4000], [2, 'PESSOAL', 'f', -11500], [2, 'IMPOSTOS', '', -500],
  [0, '4. FINANCEIRA', 'gf', null], [1, '4.1 COGUMELO', 'gf', null], [2, 'FINANCEIRA', 'f', -1200], [1, '4.2 PIMENTÃO', 'gf', null], [2, 'FINANCEIRA', 'f', -800],
  [0, '5. PATRIMÔNIO', 'g', null],
  [1, '5.1 COGUMELO', 'g', null], [2, 'Patrimônio Cogumelo', '', -3000], [2, 'Patrimônio Produção', '', -950],
  [1, '5.1 PIMENTÃO', 'g', null], [2, 'Patrimônio Pimentão', '', -1100], [2, 'Patrimônio Produção', '', -950],
];
const FOLHAS_REVENDA: FolhaDre[] = [
  [0, '1. RECEITAS', 'g', null], [1, '1.1 REVENDA', '', RECEITA_REV_DRE],
  [0, '2. CUSTOS GERAIS', 'gv', null], [1, 'Custo Revenda', 'v', -166000],
  [0, '3. DESPESAS GERAIS', 'gm', null], [1, '3.1 REVENDA', 'gm', null], [2, 'OPERACIONAL', 'f', -7000], [2, 'PESSOAL', 'f', -17000], [2, 'IMPOSTOS', 'v', -8200],
  [0, '4. FINANCEIRA', 'gf', null], [1, '4.1 REVENDA', 'gf', null], [2, 'Financeira Revenda', 'f', -1300],
];

function visaoDre(titulo: string, folhas: FolhaDre[], extra: (d: LinhaFx[]) => BlocoFx[]): BlocoFx[] {
  const d = demonstrativoDre(folhas);
  return [resumoDre(titulo, folhas, d), ...extra(d), ['demonstrativo', 'DEMONSTRATIVO POR CATEGORIA', d]];
}
const producaoDre = somaSeries(RECEITA_COG_DRE, RECEITA_PIM_DRE);
const receitaTotalDre = somaSeries(producaoDre, RECEITA_REV_DRE);
const splitProducaoDre: LinhaFx[] = [
  linhaDre(1, 'COGUMELO', '', RECEITA_COG_DRE), pctLinhaDre(1, RECEITA_COG_DRE, producaoDre),
  linhaDre(1, 'PIMENTÃO', '', RECEITA_PIM_DRE), pctLinhaDre(1, RECEITA_PIM_DRE, producaoDre),
];
const linhaPorRotulo = (d: LinhaFx[], rotulo: string) => d.find((l) => l[1] === rotulo)![4] as number[];
const resumoDaFrente = (id: string, titulo: string, d: LinhaFx[], receita: string, grupos: string[], comPctGastos: boolean): BlocoFx => {
  const r = linhaPorRotulo(d, receita);
  const gastos = somaSeries(...grupos.map((g) => linhaPorRotulo(d, g)));
  const resultado = somaSeries(r, gastos);
  return [id, titulo, [
    linhaDre(0, 'RECEITAS', 'd', r), linhaDre(0, 'GASTOS GERAIS (CUSTOS + DESPESAS)', 'd', gastos),
    ...(comPctGastos ? [pctLinhaDre(0, gastos, r)] : []),
    linhaDre(0, 'RESULTADO OPERACIONAL', 'd', resultado), pctLinhaDre(0, resultado, r),
  ]];
};

const FX_DRE2026: Record<DreGerencialVisao, BlocoFx[]> = {
  consolidado: visaoDre('RESULTADO OPERACIONAL CONSOLIDADO 2026', FOLHAS_CONSOLIDADO, () => [['split', null, [
    linhaDre(0, 'PRODUÇÃO', '', producaoDre), pctLinhaDre(0, producaoDre, receitaTotalDre), ...splitProducaoDre,
    linhaDre(0, 'REVENDA - EXEMPLO ALIMENTOS', '', RECEITA_REV_DRE), pctLinhaDre(0, RECEITA_REV_DRE, receitaTotalDre),
  ]]]),
  producao: visaoDre('RESULTADO OPERACIONAL PRODUÇÃO 2026', FOLHAS_PRODUCAO, (d) => [
    resumoDaFrente('resumo_cogumelo', 'RESULTADO OPERACIONAL COGUMELO 2026', d, '1.1. COGUMELO', ['Custo Produção Cogumelo', '3.1 COGUMELO', '4.1 COGUMELO'], true),
    resumoDaFrente('resumo_pimentao', 'RESULTADO OPERACIONAL PIMENTÃO 2026', d, '1.1. PIMENTÃO', ['Custo Produção Pimentão', '3.2 PIMENTÃO', '4.2 PIMENTÃO'], false),
    ['split', null, [linhaDre(0, 'PRODUÇÃO', '', producaoDre), pctLinhaDre(0, producaoDre, receitaTotalDre), ...splitProducaoDre]],
  ]),
  revenda: visaoDre('RESULTADO OPERACIONAL REVENDA 2026', FOLHAS_REVENDA, () => [['split', null, [
    linhaDre(0, 'REVENDA - EXEMPLO ALIMENTOS', '', RECEITA_REV_DRE), pctLinhaDre(0, RECEITA_REV_DRE, receitaTotalDre),
  ]]]),
};

const OBS_DRE2026: Record<DreGerencialVisao, string[]> = {
  consolidado: [
    'Dados de DEMONSTRAÇÃO: valores inventados (JAN a MAI), no formato da planilha gerencial.',
    'No modo demonstração o demonstrativo mostra até o nível de categoria; as contas individuais aparecem no modo real.',
  ],
  producao: [
    'Dados de DEMONSTRAÇÃO: valores inventados (JAN a MAI), no formato da planilha gerencial.',
    'Meses sem divisão de receita (split) ficam sem valores nesta visão até o gestor informar a divisão.',
  ],
  revenda: [
    'Dados de DEMONSTRAÇÃO: valores inventados (JAN a MAI), no formato da planilha gerencial.',
    'Meses sem divisão de receita (split) ficam sem valores nesta visão até o gestor informar a divisão.',
  ],
};

export function dreGerencial(ano: number, visao: DreGerencialVisao): Promise<DreGerencialResposta> {
  const blocos = (FX_DRE2026[visao] ?? FX_DRE2026.consolidado).map(blocoFx);
  return Promise.resolve({
    ano, visao,
    meses: [...MESES_ANO],
    mesesComDados: MESES_COM_DADOS_DRE,
    blocos,
    observacoes: OBS_DRE2026[visao] ?? OBS_DRE2026.consolidado,
  });
}

const splitStore: DreSplitMes[] = MESES_COM_DADOS_DRE.map((_, k) => ({
  mes: k + 1, cogumelo: RECEITA_COG_DRE[k], pimentao: RECEITA_PIM_DRE[k], revenda: RECEITA_REV_DRE[k],
}));

export function dreGerencialSplit(_ano: number): Promise<DreSplitMes[]> {
  return Promise.resolve(splitStore.map((s) => ({ ...s })));
}

export function dreGerencialPutSplit(body: { ano: number; mes: number; cogumelo: number; pimentao: number; revenda: number }): Promise<DreSplitMes> {
  const item = { mes: body.mes, cogumelo: body.cogumelo, pimentao: body.pimentao, revenda: body.revenda };
  const idx = splitStore.findIndex((s) => s.mes === body.mes);
  if (idx >= 0) splitStore[idx] = item;
  else { splitStore.push(item); splitStore.sort((a, b) => a.mes - b.mes); }
  return Promise.resolve({ ...item });
}

type ContaFx = [conta: string, descricao: string, c1: string, c2: string, c3: string, comp: Comportamento | null];
const CONTAS_FX: ContaFx[] = [
  ['1.01.001 - VENDA DE COGUMELOS', 'Venda de cogumelos', 'RECEITAS', 'RECEITAS', 'Receitas', null],
  ['1.01.002 - VENDA DE PIMENTAO', 'Venda de pimentão', 'RECEITAS', 'RECEITAS', 'Receitas', null],
  ['1.01.010 - REVENDA DE MERCADORIAS', 'Revenda de mercadorias', 'RECEITAS', 'RECEITAS', 'Receitas', null],
  ['3.01.001 - MATERIA-PRIMA DO SUBSTRATO', 'Matéria-prima do substrato', 'CUSTOS GERAIS', 'Custos Gerais', 'Custo Produção Cogumelo', 'VARIAVEL'],
  ['3.01.002 - SEMENTES (SPAWN)', 'Sementes (spawn)', 'CUSTOS GERAIS', 'Custos Gerais', 'Custo Produção Cogumelo', 'VARIAVEL'],
  ['3.01.004 - EMBALAGENS', 'Embalagens', 'CUSTOS GERAIS', 'Custos Gerais', 'Custo Produção Cogumelo', 'VARIAVEL'],
  ['3.01.008 - INSUMOS DO PIMENTAO', 'Insumos do pimentão', 'CUSTOS GERAIS', 'Custos Gerais', 'Custo Produção Pimentão', 'VARIAVEL'],
  ['3.05.001 - MERCADORIAS PARA REVENDA', 'Mercadorias para revenda', 'CUSTOS GERAIS', 'Custos Gerais', 'Custo Revenda', 'VARIAVEL'],
  ['4.01.001 - FRETES DE ENTREGA', 'Fretes de entrega', 'CUSTOS GERAIS', 'Custos Gerais', 'Custo Revenda', 'VARIAVEL'],
  ['3.03.001 - MAO DE OBRA DA PRODUCAO', 'Mão de obra da produção', 'DESPESAS GERAIS', 'PESSOAL', 'Pessoal Produção', 'FIXO'],
  ['5.01.001 - SALARIOS ADMINISTRATIVOS', 'Salários administrativos', 'DESPESAS GERAIS', 'PESSOAL', 'Pessoal Compartilhado', 'FIXO'],
  ['4.03.001 - COMISSOES DE VENDA', 'Comissões de venda', 'DESPESAS GERAIS', 'PESSOAL', 'Pessoal Compartilhado', 'VARIAVEL'],
  ['3.02.001 - ENERGIA ELETRICA DA PRODUCAO', 'Energia elétrica da produção', 'DESPESAS GERAIS', 'OPERACIONAL', 'Operacional Produção', 'FIXO'],
  ['4.02.001 - MANUTENCAO DE EQUIPAMENTOS', 'Manutenção de equipamentos', 'DESPESAS GERAIS', 'OPERACIONAL', 'Operacional Cogumelo', 'FIXO'],
  ['4.01.003 - COMBUSTIVEL E VEICULOS', 'Combustível e veículos', 'DESPESAS GERAIS', 'OPERACIONAL', 'Operacional Compartilhado', 'VARIAVEL'],
  ['5.02.001 - ALUGUEL E CONDOMINIO', 'Aluguel e condomínio', 'DESPESAS GERAIS', 'OPERACIONAL', 'Operacional Compartilhado', 'FIXO'],
  ['5.03.001 - CONTABILIDADE', 'Contabilidade', 'DESPESAS GERAIS', 'OPERACIONAL', 'Operacional Compartilhado', 'FIXO'],
  ['5.03.004 - SISTEMAS E INTERNET', 'Sistemas e internet', 'DESPESAS GERAIS', 'OPERACIONAL', 'Operacional Compartilhado', 'FIXO'],
  ['5.03.007 - SEGUROS', 'Seguros', 'DESPESAS GERAIS', 'OPERACIONAL', 'Operacional Compartilhado', 'FIXO'],
  ['2.01.001 - IMPOSTOS SOBRE VENDAS', 'Impostos sobre vendas', 'DESPESAS GERAIS', 'IMPOSTOS', 'Impostos Revenda', null],
  ['6.01.001 - IRPJ E CSLL', 'IRPJ e CSLL', 'DESPESAS GERAIS', 'IMPOSTOS', 'Impostos Produção', null],
  ['7.02.001 - JUROS E TARIFAS BANCARIAS', 'Juros e tarifas bancárias', 'FINANCEIRA', 'FINANCEIRA', 'Financeira Produção', null],
  ['9.01.001 - MAQUINAS E EQUIPAMENTOS', 'Máquinas e equipamentos', 'PATRIMÔNIO', 'PATRIMÔNIO', 'Patrimônio Produção', null],
  ['9.01.002 - OBRAS E INSTALACOES', 'Obras e instalações', 'PATRIMÔNIO', 'PATRIMÔNIO', 'Capex', null],
  ['10.01.001 - DISTRIBUICAO DE LUCROS', 'Distribuição de lucros', 'RETIRADAS', 'RETIRADAS', 'Retiradas', null],
  ['10.01.002 - APORTE DOS SOCIOS', 'Aporte dos sócios', 'APORTE', 'APORTE', 'APORTE', null],
];

const dreContasStore: DreConta[] = CONTAS_FX.map(([conta, descricao, c1, c2, c3, comp], i) => ({
  id: i + 1, conta, descricao,
  categoria1: c1, categoria2: c2, categoria3: c3,
  comportamento: comp, comportamento_manual: false, grupo_manual: false, ordem: (i + 1) * 10,
}));

export function dreContas(_ano: number): Promise<DreContasResposta> {
  const contas = dreContasStore.map((c) => ({ ...c }));
  const distintos = (sel: (c: DreConta) => string | null) =>
    [...new Set(contas.map(sel).filter((v): v is string => !!v))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  return Promise.resolve({
    contas,
    opcoes: {
      categoria1: distintos((c) => c.categoria1),
      categoria2: distintos((c) => c.categoria2),
      categoria3: distintos((c) => c.categoria3),
    },
  });
}

export function drePutConta(id: number, body: {
  comportamento?: Comportamento | null; categoria1?: string; categoria2?: string; categoria3?: string;
}): Promise<DreConta> {
  const conta = dreContasStore.find((c) => c.id === id);
  if (!conta) return Promise.reject(new Error('Conta não encontrada.'));
  if (body.comportamento !== undefined) { conta.comportamento = body.comportamento; conta.comportamento_manual = true; }
  if (body.categoria1 !== undefined || body.categoria2 !== undefined || body.categoria3 !== undefined) {
    if (body.categoria1 !== undefined) conta.categoria1 = body.categoria1;
    if (body.categoria2 !== undefined) conta.categoria2 = body.categoria2;
    if (body.categoria3 !== undefined) conta.categoria3 = body.categoria3;
    conta.grupo_manual = true;
  }
  return Promise.resolve({ ...conta });
}

type JornadaFx = [string, string, string | null, number | null, string, string,
  number, string | null, number | null, string | null, number | null, number | null, number | null,
  (number | null)?, (number | null)?];

const JORNADA_FX: JornadaFx[] = [
  ['2025-10-16', 'SH', '20.101', 180, 'A', '4', 12, '2026-04-10', 160, '2026-04-20', 14.25, 2.18, null],
  ['2025-10-16', 'SH', '20.101', 120, 'A', '6', 0, '2026-04-10', 104, '2026-04-16', 6.84, 0.73, null],
  ['2025-10-16', 'SH', '20.101', 120, 'A', '6', 0, '2026-04-10', 104, '2026-04-18', 9.37, 1.12, null],
  ['2025-10-16', 'SH', '20.101', 140, 'A', '15', 6, '2026-04-09', 120, '2026-04-17', 11.02, 1.95, null],
  ['2025-10-16', 'SH', '20.101', 140, 'A', '15', 6, '2026-04-09', 120, '2026-04-16', 4.61, 0.38, null],
  ['2025-10-16', 'SH', '20.101', 90, 'A', '16', 0, '2026-04-09', 82, '2026-04-15', 7.43, 0.86, null],
  ['2025-10-16', 'SH', '20.101', 200, 'A', '17', 9, '2026-04-09', 176, '2026-04-15', 15.6, 2.47, null],
  ['2025-10-16', 'SH', '20.101', 200, 'A', '17', 9, '2026-04-09', 176, '2026-04-16', 5.12, 3.06, 0.74, 0.31],
  ['2026-02-08', 'SB', null, 150, 'A', '41', 46, '2026-04-20', null, '2026-05-06', 4.12, null, null],
  ['2026-02-08', 'SB', null, 120, 'A', '44', 19, '2026-04-20', null, '2026-05-08', 3.27, null, null],
  ['2026-02-14', 'SB', '20.214', 240, 'A', '47', 96, '2026-04-20', null, '2026-05-06', 5.48, null, null],
  ['2026-02-14', 'SB', '20.214', 240, 'A', '50', 132, '2026-04-20', null, '2026-05-08', 4.95, null, null],
  ['2026-02-14', 'SB', '20.214', 260, 'A', '51', 0, '2026-04-20', null, '2026-05-29', 2.35, null, null],
  ['2026-03-26', 'SP', null, 180, 'B', '41', 150, '2026-04-25', null, '2026-05-18', 2.86, null, null],
  ['2026-03-26', 'SP', null, 180, 'B', '42', 31, '2026-04-25', 140, '2026-05-13', 0.93, null, null],
  ['2026-03-26', 'SP', null, 180, 'B', '43', 8, '2026-04-25', 165, '2026-05-11', 1.27, null, null],
  ['2026-03-26', 'SP', null, 90, 'B', '45', 14, '2026-04-25', 150, '2026-05-14', 3.41, null, null],
  ['2026-04-02', 'SS', null, 110, 'A', '22', 0, '2026-06-14', 34, '2026-06-20', 3.88, null, null],
  ['2026-04-02', 'SS', null, 104, 'A', '25', 0, '2026-06-14', 30, '2026-06-19', 1.06, null, null],
  ['2026-09-01', 'SH', '20.388', 610, 'A', '8', 0, null, null, null, null, null, null, null, 680],
];

const diasEntre = (a: string, b: string) =>
  Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

const LOTE_ENCERRADO_DEMO = '2025-10-16|SH|A|17';
const DATA_ENCERRAMENTO_DEMO = '2026-04-16';

function recusaSeEncerrado(lote: JornadaLinha | undefined, permitir?: boolean): Error | null {
  if (lote?.status !== 'ENCERRADO' || permitir === true) return null;
  const erro = `Este lote está encerrado desde ${dataBr(DATA_ENCERRAMENTO_DEMO)}. `
    + 'Confirme para lançar mesmo assim, ou reabra o lote em "Editar lote" (botão "Reabrir lote").';
  return Object.assign(new Error(erro), { response: { status: 409, data: { erro, codigo: 'LOTE_ENCERRADO' } } });
}

interface AberturaDemo {
  lote_id: number; tipo: 'ABERTURA'; data: string;
  sala_destino: string | null; estante_destino: string; quantidade: number | null;
  id?: number; registrado_por?: string | null; created_at?: string | null;
}
const aberturasStore: AberturaDemo[] = [
  { id: 9001, lote_id: 1, tipo: 'ABERTURA', data: '2026-04-10', sala_destino: 'F1', estante_destino: '2', quantidade: 90, registrado_por: 'Rosa', created_at: '2026-04-10T18:10:00Z' },
  { id: 9002, lote_id: 1, tipo: 'ABERTURA', data: '2026-04-10', sala_destino: 'F1', estante_destino: '5', quantidade: 70, registrado_por: 'Rosa', created_at: '2026-04-10T18:10:00Z' },
];
let proximaAberturaDemo = 9100;

export function producaoListarAberturas(loteId: number): Promise<{ linhas: AberturaGravada[]; blocos_abertos: number | null }> {
  const linha = jornadaStore.find((l) => l.lote_id === loteId);
  if (!linha) return Promise.reject(erroHttp(404, `Lote ${loteId} não encontrado.`));
  const linhas = aberturasStore
    .filter((a) => a.lote_id === loteId)
    .map((a) => ({
      id: a.id ?? 0, data: a.data, estante_origem: linha.estante_maturacao ?? null, sala_destino: a.sala_destino,
      estante_destino: a.estante_destino, quantidade: a.quantidade, registrado_por: a.registrado_por ?? null, created_at: a.created_at ?? null,
    }))
    .sort((x, y) => y.data.localeCompare(x.data) || y.id - x.id);
  return Promise.resolve({ linhas, blocos_abertos: linha.blocos_abertos ?? null });
}

const textoDosDestinos = (loteId: number): string | null => {
  const achados = aberturasStore
    .filter((a) => a.lote_id === loteId)
    .map((a) => (a.sala_destino ? `${a.sala_destino}/${a.estante_destino}` : a.estante_destino));
  if (achados.length === 0) return null;
  return [...new Set(achados)].sort((a, b) => a.localeCompare(b, 'pt', { numeric: true })).join(', ');
};

function montarJornada(): JornadaLinha[] {
  const loteIds = new Map<string, number>();
  let seqColheita = 1;
  const linhas = JORNADA_FX.map((fx): JornadaLinha => {
    const [dataLote, tipo, nf, prod, galpao, estante, cont, abertura, abertos, colheita, p, m, g, gg, semeados] = fx;
    const chave = `${dataLote}|${tipo}|${galpao}|${estante}`;
    if (!loteIds.has(chave)) loteIds.set(chave, loteIds.size + 1);
    const total = colheita ? Math.round(((p ?? 0) + (m ?? 0) + (g ?? 0) + (gg ?? 0)) * 1000) / 1000 : null;
    return {
      lote_id: loteIds.get(chave)!,
      colheita_id: colheita ? seqColheita++ : null,
      data_lote: dataLote, tipo, nf_semente: nf,
      receita: tipo === 'SH' ? 'S/ ADITIVO' : null,
      receita_id: null,
      responsavel_semeacao: null,
      responsavel_conferencia: null,
      responsavel_pesagem: null,
      responsavel_selagem: null,
      blocos_produzidos: prod, misturas: null, blocos_guardados: semeados != null ? prod : null,
      blocos_semeados: semeados ?? null,
      galpao, estante_maturacao: estante,
      estante_fisica: null,
      blocos_contaminados: cont,
      dias_ate_abertura: abertura ? diasEntre(dataLote, abertura) : null,
      data_abertura: abertura, blocos_abertos: abertos,
      estante_abertura: null, zerou_estante: abertura ? true : null,
      lote_pesquisa: null,
      capela_ligada: null,
      estante_frutificacao: null,
      abertura_por_estante: false,
      data_colheita: colheita, estante_colheita: null,
      kg_pp: null, kg_p: p, kg_m: m, kg_g: g, kg_gg: gg ?? null, total_kg: total,
      status: chave === LOTE_ENCERRADO_DEMO ? 'ENCERRADO' : (abertura ? 'FRUTIFICACAO' : 'INCUBACAO'),
      data_encerramento: chave === LOTE_ENCERRADO_DEMO ? DATA_ENCERRAMENTO_DEMO : null,
    };
  });
  for (const l of linhas) {
    const texto = textoDosDestinos(l.lote_id);
    if (texto != null) {
      l.estante_frutificacao = texto;
      l.abertura_por_estante = true;
    }
  }
  return linhas;
}

const jornadaStore: JornadaLinha[] = montarJornada();
let seqLote = 100;
let seqColh = 100;

export function producaoJornada(params: Record<string, string | undefined>): Promise<JornadaLinha[]> {
  let linhas = jornadaStore.map((l) => ({ ...l }));
  if (params.tipo) linhas = linhas.filter((l) => l.tipo === params.tipo);
  if (params.galpao) linhas = linhas.filter((l) => l.galpao === params.galpao);
  if (params.inicio) linhas = linhas.filter((l) => l.data_lote >= params.inicio!);
  if (params.fim) linhas = linhas.filter((l) => l.data_lote <= params.fim!);
  return Promise.resolve(linhas);
}

const erroHttp = (status: number, erro: string) =>
  Object.assign(new Error(erro), { response: { status, data: { erro } } });

export function producaoCriarLote(body: {
  data_lote: string; tipo: string; nf_semente?: string; receita?: string;
  blocos_produzidos?: number; galpao?: string; estante_maturacao?: string;
  receitaId?: number;
  misturas?: number;
  blocos_guardados?: number;
  blocos_semeados?: number;
  sementes?: Array<{ cepaId: number; nf: string; loteSemente?: string | null; vencimento?: string | null }>;
  permitir_duplicata?: boolean;
  lote_pesquisa?: boolean;
  capela_ligada?: boolean;
  autoclave?: Array<{
    ordem: number;
    responsavel?: string;
    entrada?: string;
    atingiu_121?: string;
    fim_2h?: string;
    houve_queda_121?: boolean;
    pressao_na_faixa?: boolean;
    ocorrido?: string;
    observacoes?: string;
    conferido_por?: string;
  }>;
}): Promise<LoteCriado> {
  const linha: JornadaLinha = {
    lote_id: (seqLote += 1), colheita_id: null,
    data_lote: body.data_lote, tipo: body.tipo,
    nf_semente: body.nf_semente ?? null, receita: body.receita ?? null,
    receita_id: body.receitaId ?? null,
    responsavel_semeacao: null,
    responsavel_conferencia: null,
    responsavel_pesagem: null,
    responsavel_selagem: null,
    blocos_produzidos: body.blocos_produzidos ?? null,
    misturas: body.misturas ?? null,
    blocos_guardados: body.blocos_guardados ?? null,
    blocos_semeados: body.blocos_semeados ?? null,
    galpao: body.galpao ?? null, estante_maturacao: body.estante_maturacao ?? null,
    estante_fisica: null,
    blocos_contaminados: 0, dias_ate_abertura: null, data_abertura: null,
    blocos_abertos: null, estante_abertura: null, zerou_estante: null,
    lote_pesquisa: body.lote_pesquisa ?? null,
    capela_ligada: body.capela_ligada ?? null,
    estante_frutificacao: null, abertura_por_estante: false,
    data_colheita: null, estante_colheita: null,
    kg_pp: null, kg_p: null, kg_m: null, kg_g: null, kg_gg: null, total_kg: null,
    status: 'INCUBACAO',
    data_encerramento: null,
  };
  const codigo = codigoDoLote(linha);
  const existente = jornadaStore.find((l) => codigoDoLote(l) === codigo);
  if (existente && !body.permitir_duplicata) {
    return Promise.reject(erroHttp(409,
      `Já existe um lote neste mesmo endereço: ${codigo} (lote #${existente.lote_id}). `
      + 'Se você está corrigindo um lançamento, edite ou exclua esse lote em vez de criar outro: '
      + 'criar de novo duplica os blocos nos indicadores. '
      + 'Se for mesmo uma SEGUNDA estante com o mesmo endereço, reenvie com permitir_duplicata.'));
  }
  jornadaStore.unshift(linha);
  return Promise.resolve({ id: linha.lote_id, codigo });
}

export function producaoAtualizarLote(loteId: number, body: {
  data_abertura?: string | null; blocos_abertos?: number | null;
  estante_abertura?: string | null; zerou_estante?: boolean | null;
  estante_frutificacao?: string | null;
  nf_semente?: string | null; receita?: string | null;
  receitaId?: number | null;
  blocos_produzidos?: number | null; blocos_guardados?: number | null;
  misturas?: number | null;
  blocos_semeados?: number | null;
  galpao?: string | null;
  estante_maturacao?: string | null;
  lote_pesquisa?: boolean | null;
  capela_ligada?: boolean | null;
  data_lote?: string;
  tipo?: string;
  sementes?: Array<{ cepaId: number; nf: string; loteSemente?: string | null; vencimento?: string | null }>;
  autoclave?: BatidaDaAutoclave[];
}): Promise<{ atualizadas: number }> {
  const alvo = jornadaStore.find((x) => x.lote_id === loteId);
  if (!alvo) return Promise.reject(erroHttp(404, `Lote ${loteId} não encontrado.`));
  const doLote = (d: string, t: string) => jornadaStore.filter((x) => x.data_lote === d && x.tipo === t);
  const dataNova = body.data_lote ?? alvo.data_lote;
  const tipoNovo = body.tipo ?? alvo.tipo;
  if (dataNova !== alvo.data_lote || tipoNovo !== alvo.tipo) {
    const destino = doLote(dataNova, tipoNovo)[0];
    if (destino) {
      return Promise.reject(erroHttp(400, `Já existe um lote de ${dataBr(dataNova)} (${tipoNovo}), o nº ${destino.lote_id}. `
        + 'Mudar este lote para essa data e esse tipo juntaria os dois lotes. Corrija um deles primeiro.'));
    }
    for (const x of doLote(alvo.data_lote, alvo.tipo)) { x.data_lote = dataNova; x.tipo = tipoNovo; }
  }
  if (body.autoclave !== undefined) {
    const ancora = Math.min(...doLote(dataNova, tipoNovo).map((x) => x.lote_id));
    autoclaveDemo.set(ancora, (body.autoclave ?? []).map((b) => ({
      responsavel: null, entrada: null, atingiu_121: null, fim_2h: null, houve_queda_121: null,
      pressao_na_faixa: null, ocorrido: null, observacoes: null, conferido_por: null, ...b,
    })));
  }
  if (body.sementes !== undefined) sementesDemo.set(loteId, body.sementes.map((x) => ({ cepa_id: x.cepaId, nf: x.nf, lote_semente: x.loteSemente ?? null, vencimento: x.vencimento ?? null })));
  let n = 0;
  for (const l of jornadaStore) {
    if (l.lote_id !== loteId) continue;
    if (body.receitaId != null) l.receita_id = body.receitaId;
    if (body.data_abertura !== undefined) {
      l.data_abertura = body.data_abertura;
      l.dias_ate_abertura = body.data_abertura ? diasEntre(l.data_lote, body.data_abertura) : null;
    }
    if (body.blocos_abertos !== undefined) l.blocos_abertos = body.blocos_abertos;
    if (body.estante_abertura !== undefined) l.estante_abertura = body.estante_abertura;
    if (body.zerou_estante !== undefined) l.zerou_estante = body.zerou_estante;
    if (body.lote_pesquisa !== undefined) l.lote_pesquisa = body.lote_pesquisa;
    if (body.estante_frutificacao !== undefined) l.estante_frutificacao = body.estante_frutificacao;
    if (body.nf_semente !== undefined) l.nf_semente = body.nf_semente;
    if (body.receita !== undefined) l.receita = body.receita;
    if (body.galpao !== undefined) l.galpao = body.galpao;
    if (body.estante_maturacao !== undefined) l.estante_maturacao = body.estante_maturacao;
    if (body.blocos_produzidos !== undefined && n === 0) l.blocos_produzidos = body.blocos_produzidos;
    if (body.blocos_guardados !== undefined && n === 0) l.blocos_guardados = body.blocos_guardados;
    if (body.misturas !== undefined && n === 0) l.misturas = body.misturas;
    if (body.blocos_semeados !== undefined && n === 0) l.blocos_semeados = body.blocos_semeados;
    if (body.capela_ligada !== undefined && n === 0) l.capela_ligada = body.capela_ligada;
    n += 1;
  }
  return Promise.resolve({ atualizadas: n });
}

const autoclaveDemo = new Map<number, DetalhesDoLoteJornada['autoclave']>();
const sementesDemo = new Map<number, DetalhesDoLoteJornada['sementes']>();
export function producaoDetalhesDoLote(loteId: number): Promise<DetalhesDoLoteJornada> {
  const alvo = jornadaStore.find((x) => x.lote_id === loteId);
  if (!alvo) return Promise.reject(erroHttp(404, `Lote ${loteId} não encontrado.`));
  const ids = [...new Set(jornadaStore.filter((x) => x.data_lote === alvo.data_lote && x.tipo === alvo.tipo).map((x) => x.lote_id))];
  const ancora = Math.min(...ids);
  return Promise.resolve({
    lote_id: loteId, ancora_id: ancora, estantes_do_lote: ids.length,
    autoclave: autoclaveDemo.get(ancora) ?? [], sementes: sementesDemo.get(loteId) ?? [],
  });
}

export function producaoAcrescentarEstantes(loteId: number, body: {
  estantes: Array<{ galpao?: string; estante: string; blocos: number }>;
  permitir_duplicata?: boolean;
}): Promise<{ linhas: Array<{
  id: number; codigo: string; galpao: string | null; estante_maturacao: string | null; qtd_blocos: number;
}> }> {
  const origem = jornadaStore.find((l) => l.lote_id === loteId);
  if (!origem) return Promise.reject(erroHttp(404, `Lote ${loteId} não encontrado.`));
  const linhas: Array<{
    id: number; codigo: string; galpao: string | null; estante_maturacao: string | null; qtd_blocos: number;
  }> = [];
  for (const e of body.estantes) {
    const galpao = e.galpao?.trim() || null;
    const estante = e.estante.trim();
    const linha: JornadaLinha = {
      ...origem,
      lote_id: (seqLote += 1), colheita_id: null,
      galpao, estante_maturacao: estante,
      blocos_produzidos: e.blocos, blocos_guardados: e.blocos,
      misturas: null, blocos_semeados: null, lote_pesquisa: null, capela_ligada: null,
      estante_fisica: null, blocos_contaminados: 0, dias_ate_abertura: null,
      data_abertura: null, blocos_abertos: null, estante_abertura: null, zerou_estante: null,
      estante_frutificacao: null, abertura_por_estante: false,
      data_colheita: null, estante_colheita: null,
      kg_pp: null, kg_p: null, kg_m: null, kg_g: null, kg_gg: null, total_kg: null,
      status: 'INCUBACAO', data_encerramento: null,
    };
    const codigo = codigoDoLote(linha);
    const existente = jornadaStore.find((l) => codigoDoLote(l) === codigo);
    if (existente && !body.permitir_duplicata) {
      return Promise.reject(erroHttp(409,
        `Já existe um lote neste mesmo endereço: ${codigo} (lote #${existente.lote_id}). `
        + 'Se você está corrigindo um lançamento, edite ou exclua esse lote em vez de criar outro: '
        + 'criar de novo duplica os blocos nos indicadores. '
        + 'Se for mesmo uma SEGUNDA estante com o mesmo endereço, reenvie com permitir_duplicata.'));
    }
    jornadaStore.unshift(linha);
    linhas.push({ id: linha.lote_id, codigo, galpao, estante_maturacao: estante, qtd_blocos: e.blocos });
  }
  return Promise.resolve({ linhas });
}

export function producaoRegistrarAbertura(loteId: number, body: {
  data_abertura: string; zerou_estante?: boolean;
  destinos: Array<{ sala: string; estante: string; quantidade?: number }>; permitir_reabertura?: boolean;
  permitir_encerrado?: boolean; substituir?: boolean;
  registrado_por?: string | null; permitir_duplicata?: boolean;
}): Promise<{ lote: { id: number; blocos_abertos: number | null; data_abertura: string; zerou_estante: boolean | null }; destinos: typeof body.destinos }> {
  const linhas = jornadaStore.filter((l) => l.lote_id === loteId);
  if (linhas.length === 0) return Promise.reject(erroHttp(404, `Lote ${loteId} não encontrado.`));
  const validas = salasDeFrutificacaoAtivas().map((s) => s.galpao_codigo as string);
  for (const [i, d] of body.destinos.entries()) {
    const sala = d.sala?.trim().toUpperCase();
    if (!sala) return Promise.reject(erroHttp(400, `destinos[${i}].sala é obrigatória: informe a sala de frutificação (${validas.join(', ').replace(/, ([^,]+)$/, ' ou $1')}).`));
    if (!validas.includes(sala)) return Promise.reject(erroHttp(400, `destinos[${i}].sala "${sala}" não é uma sala de frutificação ativa (aceitas: ${validas.join(', ')}).`));
  }
  const encerrado = recusaSeEncerrado(linhas[0], body.permitir_encerrado);
  if (encerrado) return Promise.reject(encerrado);
  if (linhas[0].zerou_estante === true && !body.permitir_reabertura) {
    return Promise.reject(erroHttp(409, 'Esta estante já está com a abertura concluída (SIM).'));
  }
  const comNumero = body.destinos.filter((d) => d.quantidade != null);
  const soma = comNumero.length === 0 ? null : comNumero.reduce((s, d) => s + (d.quantidade ?? 0), 0);
  const substituir = body.substituir === true;
  if (!substituir) {
    try {
      exigirConfirmacaoDeAberturaIgual(
        aberturasStore.filter((a) => a.lote_id === loteId && a.data === body.data_abertura),
        body.destinos.map((d) => ({ sala: d.sala.trim().toUpperCase(), estante: d.estante.trim(), quantidade: d.quantidade ?? null })),
        body.permitir_duplicata,
      );
    } catch (e) {
      const err = e as Error & { codigo_erro?: string };
      return Promise.reject(Object.assign(new Error(err.message), {
        response: { status: 409, data: { erro: err.message, codigo: err.codigo_erro } },
      }));
    }
  }
  const anterior = linhas[0].blocos_abertos;
  try {
    exigirSaldoParaAbertura(linhas[0].blocos_produzidos, linhas[0].blocos_contaminados ?? 0, soma,
      substituir ? 0 : (Number(anterior) || 0));
  } catch (e) {
    const err = e as Error & { codigo_erro?: string; detalhe?: unknown };
    return Promise.reject(Object.assign(new Error(err.message), {
      response: { status: 400, data: { erro: err.message, codigo: err.codigo_erro, detalhe: err.detalhe } },
    }));
  }
  const total = substituir ? soma : (soma == null ? (anterior ?? null) : (Number(anterior) || 0) + soma);
  const dataGravada = linhas[0].data_abertura;
  const data = !substituir && dataGravada && dataGravada < body.data_abertura ? dataGravada : body.data_abertura;
  if (substituir) {
    for (let i = aberturasStore.length - 1; i >= 0; i -= 1) {
      if (aberturasStore[i].lote_id === loteId) aberturasStore.splice(i, 1);
    }
  }
  for (const d of body.destinos) {
    aberturasStore.push({
      id: proximaAberturaDemo++, lote_id: loteId, tipo: 'ABERTURA', data: body.data_abertura,
      sala_destino: d.sala.trim().toUpperCase(), estante_destino: d.estante.trim(), quantidade: d.quantidade ?? null,
      registrado_por: body.registrado_por ?? null, created_at: new Date().toISOString(),
    });
  }
  for (const l of linhas) {
    l.data_abertura = data;
    l.dias_ate_abertura = diasEntre(l.data_lote, data);
    l.blocos_abertos = total;
    if (body.zerou_estante !== undefined) l.zerou_estante = body.zerou_estante;
    l.estante_frutificacao = textoDosDestinos(loteId);
    l.abertura_por_estante = true;
  }
  const { lote_id: id, blocos_abertos, zerou_estante } = linhas[0];
  return Promise.resolve({
    lote: { id, blocos_abertos, data_abertura: data, zerou_estante }, destinos: body.destinos,
  });
}

export function producaoRegistrarColheita(loteId: number, body: {
  data: string; kg_p?: number | null; kg_m?: number | null; kg_g?: number | null;
  kg_gg?: number | null;
  kg_pp?: number | null;
  estante?: string | null;
  permitir_duplicata?: boolean;
  permitir_encerrado?: boolean;
  permitir_dia_sem_colheita?: boolean;
}): Promise<JornadaLinha> {
  const base = jornadaStore.find((l) => l.lote_id === loteId);
  if (!base) return Promise.reject(new Error('Lote não encontrado.'));
  const encerrado = recusaSeEncerrado(base, body.permitir_encerrado);
  if (encerrado) return Promise.reject(encerrado);
  const diaMarcado = recusaSeDiaSemColheita(body.data, body.permitir_dia_sem_colheita);
  if (diaMarcado) return Promise.reject(diaMarcado);
  if (body.estante?.includes(',')) {
    return Promise.reject(erroHttp(400, 'A colheita é de UMA estante só. '
      + 'Se colheu de mais de uma, lance uma colheita para cada, com o kg de cada uma.'));
  }
  const total = Math.round(
    ((body.kg_pp ?? 0) + (body.kg_p ?? 0) + (body.kg_m ?? 0) + (body.kg_g ?? 0) + (body.kg_gg ?? 0)) * 1000,
  ) / 1000;
  const nova: JornadaLinha = {
    ...base, colheita_id: (seqColh += 1), data_colheita: body.data,
    kg_p: body.kg_p ?? null, kg_m: body.kg_m ?? null, kg_g: body.kg_g ?? null,
    kg_gg: body.kg_gg ?? null,
    kg_pp: body.kg_pp ?? null,
    total_kg: total,
    estante_colheita: body.estante ?? null,
  };
  if (base.data_colheita == null && base.colheita_id == null) {
    Object.assign(base, nova);
    return Promise.resolve({ ...base });
  }
  const idx = jornadaStore.lastIndexOf(
    jornadaStore.filter((l) => l.lote_id === loteId).slice(-1)[0],
  );
  jornadaStore.splice(idx + 1, 0, nova);
  return Promise.resolve({ ...nova });
}

const codigoDoLote = (l: JornadaLinha) =>
  `${l.data_lote}-${l.tipo}-${l.galpao ?? 'X'}${l.estante_maturacao ?? '0'}`.replace(/\s+/g, '');

export function producaoExcluirLote(loteId: number): Promise<ExclusaoLoteJornada> {
  const linhas = jornadaStore.filter((l) => l.lote_id === loteId);
  if (!linhas.length) return Promise.reject(new Error('Lote não encontrado.'));
  const colheitas = linhas.filter((l) => l.colheita_id != null).length;
  let eventos = 0;
  for (let i = contaminadosStore.length - 1; i >= 0; i -= 1) {
    if (contaminadosStore[i].lote_id !== loteId) continue;
    contaminadosStore.splice(i, 1);
    eventos += 1;
  }
  for (let i = jornadaStore.length - 1; i >= 0; i -= 1) {
    if (jornadaStore[i].lote_id === loteId) jornadaStore.splice(i, 1);
  }
  for (let i = aberturasStore.length - 1; i >= 0; i -= 1) {
    if (aberturasStore[i].lote_id === loteId) aberturasStore.splice(i, 1);
  }
  let atipicas = 0;
  for (let i = eventosAtipicosStore.length - 1; i >= 0; i -= 1) {
    if (eventosAtipicosStore[i].lote_id !== loteId) continue;
    eventosAtipicosStore.splice(i, 1);
    atipicas += 1;
  }
  return Promise.resolve({
    id: loteId, codigo: codigoDoLote(linhas[0]),
    colheitas_apagadas: colheitas, eventos_apagados: eventos,
    sementes_apagadas: 0, estantes_apagadas: 0,
    transferencias_apagadas: 0, autoclaves_apagadas: 0,
    ocorrencias_atipicas_apagadas: atipicas, divergencias_apagadas: 0,
    verificacoes_apagadas: 0,
  });
}

export function producaoAtualizarColheita(colheitaId: number, body: {
  data?: string; kg_p?: number | null; kg_m?: number | null; kg_g?: number | null;
  kg_gg?: number | null;
  kg_pp?: number | null;
  estante?: string | null;
  permitir_dia_sem_colheita?: boolean;
}): Promise<ColheitaSalva> {
  const linha = jornadaStore.find((l) => l.colheita_id === colheitaId);
  if (!linha) return Promise.reject(new Error('Colheita não encontrada.'));
  const diaMarcado = body.data !== linha.data_colheita
    ? recusaSeDiaSemColheita(body.data, body.permitir_dia_sem_colheita) : null;
  if (diaMarcado) return Promise.reject(diaMarcado);
  if (body.data !== undefined) linha.data_colheita = body.data;
  if (body.estante !== undefined) linha.estante_colheita = body.estante;
  if (body.kg_p !== undefined) linha.kg_p = body.kg_p;
  if (body.kg_m !== undefined) linha.kg_m = body.kg_m;
  if (body.kg_g !== undefined) linha.kg_g = body.kg_g;
  if (body.kg_gg !== undefined) linha.kg_gg = body.kg_gg;
  if (body.kg_pp !== undefined) linha.kg_pp = body.kg_pp;
  linha.total_kg = Math.round(
    ((linha.kg_pp ?? 0) + (linha.kg_p ?? 0) + (linha.kg_m ?? 0) + (linha.kg_g ?? 0) + (linha.kg_gg ?? 0)) * 1000,
  ) / 1000;
  return Promise.resolve({
    id: colheitaId, lote_id: linha.lote_id,
    data_colheita: linha.data_colheita!, peso_kg: linha.total_kg,
    kg_pp: linha.kg_pp, kg_p: linha.kg_p, kg_m: linha.kg_m, kg_g: linha.kg_g, kg_gg: linha.kg_gg,
  });
}

export function producaoExcluirColheita(colheitaId: number): Promise<ExclusaoColheita> {
  const idx = jornadaStore.findIndex((l) => l.colheita_id === colheitaId);
  if (idx < 0) return Promise.reject(new Error('Colheita não encontrada.'));
  const linha = jornadaStore[idx];
  const loteId = linha.lote_id;
  const irmas = jornadaStore.filter((l) => l.lote_id === loteId && l.colheita_id != null).length;
  if (irmas > 1) jornadaStore.splice(idx, 1);
  else Object.assign(linha, {
    colheita_id: null, data_colheita: null, estante_colheita: null,
    kg_pp: null, kg_p: null, kg_m: null, kg_g: null, kg_gg: null, total_kg: null,
  });
  return Promise.resolve({ id: colheitaId, lote_id: loteId });
}

let seqTransf = 0;
const transferenciasStore: TransferenciaSalva[] = [];

export function producaoRegistrarTransferencias(loteId: number, transferencias: Array<{
  data: string; estante_origem: string; estante_destino: string;
  quantidade?: number | null; observacao?: string | null; registrado_por?: string | null;
}>): Promise<TransferenciaSalva[]> {
  const lote = jornadaStore.find((l) => l.lote_id === loteId);
  if (!lote) return Promise.reject(new Error(`Lote ${loteId} não encontrado.`));
  if (!transferencias || transferencias.length === 0) {
    return Promise.reject(new Error(
      'Informe ao menos uma transferência: { data, estante_origem, estante_destino }.',
    ));
  }

  const vistas = new Set<string>();
  for (let i = 0; i < transferencias.length; i += 1) {
    const t = transferencias[i];
    const onde = `transferencias[${i}]`;

    const data = String(t.data ?? '').trim();
    if (!data) {
      return Promise.reject(new Error(`${onde}.data é obrigatória (YYYY-MM-DD).`));
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
      return Promise.reject(new Error(`${onde}.data inválida: use YYYY-MM-DD.`));
    }

    const estanteOrigem = String(t.estante_origem ?? '').replace(/\s+/g, ' ').trim();
    if (!estanteOrigem) {
      return Promise.reject(new Error(
        `${onde}.estante_origem é obrigatória: informe a etiqueta da estante de origem.`,
      ));
    }

    const estanteDestino = String(t.estante_destino ?? '').replace(/\s+/g, ' ').trim();
    if (!estanteDestino) {
      return Promise.reject(new Error(
        `${onde}.estante_destino é obrigatória: informe a etiqueta da estante de destino.`,
      ));
    }

    if (estanteOrigem === estanteDestino) {
      return Promise.reject(new Error(
        `${onde}: origem e destino são a mesma estante (${estanteOrigem}). Informe estantes diferentes: isso não é uma transferência.`,
      ));
    }

    const chave = JSON.stringify([data, estanteOrigem, estanteDestino]);
    if (vistas.has(chave)) {
      return Promise.reject(new Error(
        `${onde}: a transferência de ${estanteOrigem} para ${estanteDestino} em ${data} já aparece nesta lista. Informe cada transferência uma vez só.`,
      ));
    }
    vistas.add(chave);

    if (t.quantidade != null) {
      const q = Number(t.quantidade);
      if (!Number.isInteger(q) || q < 1) {
        return Promise.reject(new Error(`${onde}.quantidade inválido: informe um inteiro ≥ 1.`));
      }
    }
  }

  const novas: TransferenciaSalva[] = transferencias.map((t) => ({
    id: (seqTransf += 1), lote_id: loteId, data: t.data,
    estante_origem: t.estante_origem, estante_destino: t.estante_destino,
    quantidade: t.quantidade ?? null, observacao: t.observacao ?? null,
    registrado_por: t.registrado_por ?? null,
  }));
  transferenciasStore.unshift(...novas);
  return Promise.resolve(novas);
}

export function producaoListarTransferencias(loteId: number): Promise<TransferenciaSalva[]> {
  return Promise.resolve(
    transferenciasStore.filter((t) => t.lote_id === loteId).map((t) => ({ ...t })),
  );
}

let seqCont = 50;
const LOTE_DEMO_SP_PENDENCIA = 900003;
const contaminadosStore: ContaminadoLinha[] = ([
  ['2025-10-20', 'SH', 'A', '11', '2025-11-02', 'VERDE', 31, null],
  ['2025-10-20', 'SH', 'A', '11', '2025-12-02', 'VERDE', 18, null],
  ['2025-10-20', 'SH', 'A', '11', '2025-12-15', 'VERDE', 4, null],
  ['2025-10-20', 'SH', 'A', '11', '2026-02-23', 'VERDE', 3, null],
  ['2025-10-20', 'SH', 'A', '13', '2025-11-02', 'VERDE', 55, null],
  ['2025-10-20', 'SH', 'A', '13', '2025-12-02', 'VERDE', 22, null],
  ['2025-10-20', 'SH', 'A', '13', '2026-01-10', 'VERDE', 7, null],
  ['2025-10-20', 'SH', 'A', '13', '2026-02-26', 'VERDE', 5, null],
  ['2025-10-20', 'SH', 'A', '13', '2026-04-03', 'VERDE', 1, null],
  ['2026-02-14', 'SB', 'A', '50', '2026-03-31', 'LARANJA', 132, 'FUNDO'],
  ['2026-02-08', 'SB', 'A', '41', '2026-04-04', 'VERDE', 46, null],
  ['2026-03-26', 'SP', 'B', '41', '2026-04-12', 'VERDE', 150, 'TOPO'],
] as Array<[string, string, string, string, string, TipoContaminado, number, LocalNoBloco | null]>).map(
  ([dataLote, tipo, galpao, estante, retirada, tc, qtd, local], i): ContaminadoLinha => ({
    id: i + 1, lote_id: dataLote === '2026-03-26' && tipo === 'SP' ? LOTE_DEMO_SP_PENDENCIA : null, data_lote: dataLote, tipo, estante, galpao,    data_retirada: retirada, tipo_contaminado: tc, quantidade: qtd,
    tipo_evento: 'CONTAMINACAO' as const, estante_retirada: null, local_no_bloco: local,
    estante_registrada: false, importado: true,
  }),
).concat([{
  id: 13, lote_id: LOTE_DEMO_SP_PENDENCIA, data_lote: '2026-03-26', tipo: 'SP', estante: '41', galpao: 'B',
  data_retirada: '2026-04-14', tipo_contaminado: 'VERDE', quantidade: 7,
  tipo_evento: 'CONTAMINACAO', estante_retirada: null, local_no_bloco: null,
  estante_registrada: false, importado: false,
}]);

export function producaoContaminados(params: {
  inicio?: string; fim?: string; tipo?: string;
} = {}): Promise<ContaminadoLinha[]> {
  return Promise.resolve(contaminadosStore
    .filter((c) => (!params.inicio || (c.data_lote ?? '') >= params.inicio)
      && (!params.fim || (c.data_lote ?? '') <= params.fim)
      && (!params.tipo || c.tipo === params.tipo))
    .map((c) => ({ ...c })));
}

export function producaoRegistrarContaminado(body: {
  lote_id?: number; data_lote?: string; tipo?: string; estante?: string;
  data_retirada: string;
  quantidade?: number; saldo_total?: true; motivo?: string;
  tipo_evento?: 'PERDA'; tipo_contaminado?: TipoContaminado;
  local_no_bloco?: LocalNoBloco;
  permitir_duplicata?: boolean;
  permitir_encerrado?: boolean;
}): Promise<ContaminacaoSalva> {
  const tipoEvento = body.tipo_evento == null || (body.tipo_evento as string) === ''
    ? 'CONTAMINACAO' : String(body.tipo_evento).trim().toUpperCase();
  if (!['CONTAMINACAO', 'PERDA'].includes(tipoEvento)) {
    return Promise.reject(new Error(
      `tipo_evento inválido: use CONTAMINACAO ou PERDA (recebido: ${JSON.stringify(body.tipo_evento)}).`,
    ));
  }
  const tipoContaminado = tipoEvento === 'PERDA' ? null
    : String(body.tipo_contaminado ?? '').trim().toUpperCase();
  if (tipoEvento === 'CONTAMINACAO' && !['VERDE', 'LARANJA', 'PRETA'].includes(tipoContaminado as string)) {
    return Promise.reject(new Error('tipo_contaminado inválido: use VERDE, LARANJA ou PRETA.'));
  }
  const localNoBloco = String(body.local_no_bloco ?? '').trim().toUpperCase();
  if (localNoBloco && !(LOCAIS_NO_BLOCO as readonly string[]).includes(localNoBloco)) {
    return Promise.reject(new Error(ERRO_LOCAL_NO_BLOCO));
  }
  const lote = body.lote_id != null
    ? jornadaStore.find((l) => l.lote_id === body.lote_id)
    : jornadaStore.find((l) => l.data_lote === body.data_lote && l.tipo === body.tipo
      && (l.estante_maturacao ?? '') === String(body.estante ?? '').trim());
  if (lote) {
    try {
      estanteDaContaminacao(tipoEvento, String(body.estante ?? '').trim() || null,
        { galpao: lote.galpao, tipo_cogumelo: lote.tipo });
    } catch (e) {
      return Promise.reject(e);
    }
  }
  const encerrado = recusaSeEncerrado(lote, body.permitir_encerrado);
  if (encerrado) return Promise.reject(encerrado);

  const saldoTotal = body.saldo_total === true;
  if (saldoTotal && tipoEvento !== 'PERDA') {
    return Promise.reject(new Error('O saldo total só vale para perda ou descarte.'));
  }
  if (saldoTotal && body.quantidade != null) {
    return Promise.reject(new Error('Informe a quantidade ou marque o saldo total do lote, não os dois.'));
  }
  let quantidade = body.quantidade;
  if (saldoTotal) {
    const perdasDoLote = contaminadosStore
      .filter((c) => c.lote_id === (lote?.lote_id ?? null) && c.tipo_evento === 'PERDA')
      .reduce((s, c) => s + (Number(c.quantidade) || 0), 0);
    const retirados = (lote?.blocos_contaminados ?? 0) + perdasDoLote;
    try {
      quantidade = quantidadeDoSaldoTotal(lote?.blocos_produzidos, retirados, lote?.blocos_abertos ?? 0);
    } catch (e) {
      return Promise.reject(e);
    }
  }
  let motivo: string | null;
  try {
    motivo = motivoDaPerda(body.motivo, tipoEvento);
  } catch (e) {
    return Promise.reject(e);
  }

  const salvo: ContaminacaoSalva = {
    id: (seqCont += 1), lote_id: body.lote_id ?? null,
    qtd_blocos: quantidade as number, tipo_contaminado: tipoContaminado as TipoContaminado | null,
    data_evento: body.data_retirada,
  };
  const novo: ContaminadoLinha = {
    id: salvo.id, lote_id: salvo.lote_id,
    data_lote: lote?.data_lote ?? body.data_lote ?? null,
    tipo: lote?.tipo ?? body.tipo ?? null,
    estante: lote?.estante_maturacao ?? body.estante ?? null,
    estante_retirada: body.estante ?? null,
    estante_registrada: String(body.estante ?? '').trim() !== '',
    importado: false,
    galpao: lote?.galpao ?? null,
    data_retirada: body.data_retirada,
    tipo_contaminado: tipoContaminado as TipoContaminado | null, quantidade: quantidade as number,
    tipo_evento: tipoEvento as 'CONTAMINACAO' | 'PERDA',
    local_no_bloco: (localNoBloco || null) as LocalNoBloco | null,
    motivo,
  };
  contaminadosStore.unshift(novo);
  if (tipoEvento === 'CONTAMINACAO') {
    for (const l of jornadaStore) {
      if (body.lote_id != null && l.lote_id === body.lote_id) l.blocos_contaminados += (quantidade as number);
    }
  }
  return Promise.resolve(salvo);
}

export function producaoAtualizarContaminado(eventoId: number, body: {
  data_retirada?: string; tipo_contaminado?: TipoContaminado | null; quantidade?: number;
  local_no_bloco?: LocalNoBloco | '';
  estante?: string;
}): Promise<ContaminacaoSalva> {
  const evento = contaminadosStore.find((c) => c.id === eventoId);
  if (!evento) return Promise.reject(new Error('Contaminação não encontrada.'));
  if (body.estante !== undefined) {
    const estante = body.estante.trim();
    if (estante.includes(',')) return Promise.reject(new Error(ERRO_ESTANTE_DA_RETIRADA));
    if (estante === '' && evento.tipo_evento === 'CONTAMINACAO') return Promise.reject(new Error(ERRO_ESTANTE_OBRIGATORIA));
    evento.estante_retirada = estante || null;
    evento.estante_registrada = estante !== '';
  }
  if (body.data_retirada !== undefined) evento.data_retirada = body.data_retirada;
  if (body.tipo_contaminado !== undefined) evento.tipo_contaminado = body.tipo_contaminado;
  if (body.local_no_bloco !== undefined) {
    const local = String(body.local_no_bloco).trim().toUpperCase();
    if (local && !(LOCAIS_NO_BLOCO as readonly string[]).includes(local)) {
      return Promise.reject(new Error(ERRO_LOCAL_NO_BLOCO));
    }
    evento.local_no_bloco = (local || null) as LocalNoBloco | null;
  }
  if (body.quantidade !== undefined) {
    const delta = body.quantidade - evento.quantidade;
    evento.quantidade = body.quantidade;
    if (evento.tipo_evento === 'CONTAMINACAO') {
      for (const l of jornadaStore) {
        if (evento.lote_id != null && l.lote_id === evento.lote_id) l.blocos_contaminados += delta;
      }
    }
  }
  return Promise.resolve({
    id: evento.id, lote_id: evento.lote_id, qtd_blocos: evento.quantidade,
    tipo_contaminado: evento.tipo_contaminado, data_evento: evento.data_retirada!,
  });
}

export function producaoExcluirContaminado(eventoId: number): Promise<ExclusaoContaminacao> {
  const idx = contaminadosStore.findIndex((c) => c.id === eventoId);
  if (idx < 0) return Promise.reject(new Error('Contaminação não encontrada.'));
  const [evento] = contaminadosStore.splice(idx, 1);
  if (evento.tipo_evento === 'CONTAMINACAO') {
    for (const l of jornadaStore) {
      if (evento.lote_id != null && l.lote_id === evento.lote_id) {
        l.blocos_contaminados = Math.max(0, l.blocos_contaminados - evento.quantidade);
      }
    }
  }
  return Promise.resolve({ id: evento.id, lote_id: evento.lote_id });
}

let seqEventoAtipico = 1;
const eventosAtipicosStore: EventoAtipico[] = [{
  id: 1, lote_id: 1, tipo: 'FALTA_DE_ENERGIA', descricao: null,
  observacao: 'Queda geral na rede (exemplo).', hora_inicio: '10:05', hora_retorno: '10:40',
  created_at: '2026-10-01T12:00:00+00:00',
}];

const recusaDoEventoAtipico = (e: unknown) => {
  const { status, message } = e as { status?: number; message?: string };
  return erroHttp(status ?? 400, message ?? 'Ocorrência inválida.');
};

export function producaoListarEventosAtipicos(loteId: number): Promise<EventoAtipico[]> {
  if (!jornadaStore.some((l) => l.lote_id === loteId)) {
    return Promise.reject(erroHttp(404, `Lote ${loteId} não encontrado.`));
  }
  return Promise.resolve(eventosAtipicosStore.filter((e) => e.lote_id === loteId).map((e) => ({ ...e })));
}

export function producaoRegistrarEventoAtipico(loteId: number, body: CorpoDoEventoAtipico): Promise<EventoAtipico> {
  if (!jornadaStore.some((l) => l.lote_id === loteId)) {
    return Promise.reject(erroHttp(404, `Lote ${loteId} não encontrado.`));
  }
  try {
    const nova: EventoAtipico = {
      id: (seqEventoAtipico += 1), lote_id: loteId, ...camposDoEventoAtipico(body),
      created_at: new Date().toISOString(),
    };
    eventosAtipicosStore.push(nova);
    return Promise.resolve({ ...nova });
  } catch (e) { return Promise.reject(recusaDoEventoAtipico(e)); }
}

export function producaoRegistrarEventoAtipicoNoLoteInteiro(loteId: number, body: CorpoDoEventoAtipico): Promise<EventoAtipico[]> {
  const escolhida = jornadaStore.find((l) => l.lote_id === loteId);
  if (!escolhida) return Promise.reject(erroHttp(404, `Lote ${loteId} não encontrado.`));
  try {
    const campos = camposDoEventoAtipico(body);
    const ids = [...new Set(jornadaStore
      .filter((l) => l.data_lote === escolhida.data_lote && l.tipo === escolhida.tipo).map((l) => l.lote_id))];
    const novas: EventoAtipico[] = ids.map((id) => ({
      id: (seqEventoAtipico += 1), lote_id: id, ...campos, created_at: new Date().toISOString(),
    }));
    eventosAtipicosStore.push(...novas);
    return Promise.resolve(novas.map((n) => ({ ...n })));
  } catch (e) { return Promise.reject(recusaDoEventoAtipico(e)); }
}

export function producaoAtualizarEventoAtipico(id: number, body: CorpoDoEventoAtipico): Promise<EventoAtipico> {
  const atual = eventosAtipicosStore.find((e) => e.id === id);
  if (!atual) return Promise.reject(erroHttp(404, 'Ocorrência não encontrada.'));
  try {
    Object.assign(atual, camposDoEventoAtipico(body, atual));
    return Promise.resolve({ ...atual });
  } catch (e) { return Promise.reject(recusaDoEventoAtipico(e)); }
}

export function producaoExcluirEventoAtipico(id: number): Promise<ExclusaoEventoAtipico> {
  const idx = eventosAtipicosStore.findIndex((e) => e.id === id);
  if (idx < 0) return Promise.reject(erroHttp(404, 'Ocorrência não encontrada.'));
  const [apagada] = eventosAtipicosStore.splice(idx, 1);
  return Promise.resolve({ id: apagada.id, lote_id: apagada.lote_id });
}

const PESO_DA_EMBALAGEM: Record<string, number | null> = {
  'Shiitake Bdj (200gr)': 200, 'Shiitake Fat (200gr)': 200, 'Shimeji Preto (200g)': 200, 'Shimeji Preto (1kg)': 1000,
  'Shimeji Branco (200g)': 200, 'Shimeji Branco (1kg)': 1000, 'Shiitake Baby (1kg)': 1000,
  'Pimentão Amarelo (CXS)': null, 'Pimentão Vermelho (CXS)': null, 'Pimentão Verde (CXS)': null,
};
const EMBALAGEM_PRODUTOS: EmbalagemProduto[] = [
  'Shiitake Bdj (200gr)', 'Shiitake Fat (200gr)', 'Shimeji Preto (200g)',
  'Shimeji Preto (1kg)', 'Shimeji Branco (200g)', 'Shimeji Branco (1kg)',
  'Shiitake Baby (1kg)', 'Pimentão Amarelo (CXS)', 'Pimentão Vermelho (CXS)',
  'Pimentão Verde (CXS)',
].map((nome, i) => ({ id: i + 1, nome, ordem: i + 1, peso_gramas: PESO_DA_EMBALAGEM[nome], apresentacao: apresentacaoDoProduto({ nome, peso_gramas: PESO_DA_EMBALAGEM[nome] }) as EmbalagemProduto['apresentacao'] }));

const HOJE_EMBALAGEM_DEMO = '2026-09-28';

const embalagemStore: Array<{ data: string; data_lancamento: string | null; valores: Record<number, number>; f54?: number | null }> = ([
  ['2026-04-19', [96, 0, 0, 0, 0, 0, 0, 0, 0, 0]],
  ['2026-04-20', [81, 7, 9, 0, 0, 0, 0, 0, 0, 0]],
  ['2026-04-22', [143, 3, 6, 0, 0, 0, 0, 0, 0, 0]],
  ['2026-04-24', [102, 5, 0, 0, 0, 0, 0, 0, 0, 0]],
  ['2026-04-25', [127, 1, 0, 0, 0, 0, 0, 0, 0, 0]],
  ['2026-04-27', [74, 4, 0, 0, 0, 0, 0, 0, 0, 0]],
  ['2026-04-29', [118, 2, 0, 0, 0, 0, 0, 0, 0, 0]],
  ['2026-05-01', [109, 6, 0, 0, 0, 0, 0, 0, 0, 0]],
  ['2026-05-02', [131, 2, 0, 0, 31, 0, 0, 0, 0, 0]],
  ['2026-05-06', [214, 0, 0, 0, 86, 0, 0, 0, 0, 0]],
  ['2026-05-08', [122, 0, 0, 0, 94, 0, 0, 0, 0, 0]],
  ['2026-08-21', [47, 0, 0, 0, 0, 0, 33, 0, 0, 0]],
  ['2026-08-25', [0, 0, 0, 0, 196, 0, 0, 0, 0, 0]],
  ['2026-08-27', [262, 0, 0, 0, 0, 0, 0, 0, 0, 0]],
  ['2026-08-28', [118, 0, 0, 0, 0, 0, 0, 0, 8, 0]],
] as Array<[string, number[]]>).map(([data, vals]) => ({
  data, data_lancamento: data >= '2026-08-14' ? data : null, valores: Object.fromEntries(vals.map((v, i) => [i + 1, v])),
  f54: data === '2026-08-27' ? 95 : null,
}));
const PRODUTO_F54_DEMO = 1;

export function producaoEmbalagem(params: Record<string, string | undefined>): Promise<EmbalagemGrade> {
  let dias = embalagemStore.map((d) => ({ data: d.data, data_lancamento: d.data_lancamento, valores: { ...d.valores }, f54: d.f54 ?? null }));
  if (params.inicio) dias = dias.filter((d) => d.data >= params.inicio!);
  if (params.fim) dias = dias.filter((d) => d.data <= params.fim!);
  dias.sort((a, b) => b.data.localeCompare(a.data));
  return Promise.resolve({ produtos: EMBALAGEM_PRODUTOS, produto_f54_id: PRODUTO_F54_DEMO, dias });
}

export function producaoSalvarEmbalagem(
  body: { data: string; data_lancamento?: string | null; valores: Record<number, number>; f54?: number | null },
): Promise<EmbalagemSalva> {
  const dia = embalagemStore.find((d) => d.data === body.data);
  const valoresFinais: Record<number, number> = dia ? { ...dia.valores } : {};
  const f54 = 'f54' in body ? (body.f54 ?? null) : (dia?.f54 ?? null);
  const totalBdj = Number(body.valores[PRODUTO_F54_DEMO] ?? valoresFinais[PRODUTO_F54_DEMO] ?? 0);
  if (f54 != null && f54 > totalBdj) {
    return Promise.reject(new Error(`A F54 (${f54}) não pode passar do total de Shiitake Bdj (200gr) do dia (${totalBdj}).`));
  }
  const data_lancamento = body.data_lancamento ?? null;
  let gravados = 0;
  let removidos = 0;
  for (const [chave, bruto] of Object.entries(body.valores)) {
    const produtoId = Number(chave);
    const qtd = Math.max(Number(bruto) || 0, 0);
    if (qtd > 0) { valoresFinais[produtoId] = qtd; gravados += 1; } else { delete valoresFinais[produtoId]; removidos += 1; }
  }
  if (Object.keys(valoresFinais).length === 0) {
    if (dia) embalagemStore.splice(embalagemStore.indexOf(dia), 1);
  } else if (dia) {
    dia.valores = valoresFinais;
    dia.data_lancamento = data_lancamento;
    dia.f54 = f54;
  } else {
    embalagemStore.push({ data: body.data, data_lancamento, valores: valoresFinais, f54 });
  }
  return Promise.resolve({ data: body.data, data_lancamento, gravados, removidos });
}

const diaDoSaldoDemo = (dias: number) => {
  const d = new Date(`${hojeISO()}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
};
let saldoStore: Array<{ data: string; embalagem_produto_id: number; quantidade: number }> | null = null;
const saldosDemo = () => (saldoStore ??= [
  { data: diaDoSaldoDemo(-1), embalagem_produto_id: 1, quantidade: 84 },
  { data: diaDoSaldoDemo(-1), embalagem_produto_id: 2, quantidade: 0 },
  { data: diaDoSaldoDemo(-1), embalagem_produto_id: 5, quantidade: 22 },
  { data: diaDoSaldoDemo(-2), embalagem_produto_id: 1, quantidade: 120 },
  { data: diaDoSaldoDemo(-2), embalagem_produto_id: 2, quantidade: 6 },
]);

export function producaoSaldoDeBandejas(params: { inicio?: string; fim?: string }): Promise<SaldoDeBandejasGrade> {
  const registros = saldosDemo().filter((r) => (!params.inicio || r.data >= params.inicio) && (!params.fim || r.data <= params.fim));
  return Promise.resolve(montarGradeDoSaldo({ produtos: EMBALAGEM_PRODUTOS, registros }) as SaldoDeBandejasGrade);
}

export function producaoSalvarSaldoDeBandejas(body: { data: string; valores: Record<number, string | null> }): Promise<SaldoDeBandejasSalvo> {
  const recusa = (erro: string) => Promise.reject(Object.assign(new Error(erro), { response: { status: 400, data: { erro } } }));
  if (body.data > hojeISO()) return recusa(`O dia ${body.data.slice(8, 10)}/${body.data.slice(5, 7)} ainda não chegou: o saldo é a contagem do fim do dia.`);
  const entradas = Object.entries(body.valores).map(([chave, bruto]) => [chave, String(bruto ?? '').trim()] as const);
  const invalida = entradas.find(([, texto]) => texto !== '' && !/^\d+$/.test(texto));
  if (invalida) {
    const nome = EMBALAGEM_PRODUTOS.find((p) => p.id === Number(invalida[0]))?.nome ?? `produto ${invalida[0]}`;
    return recusa(`Saldo de ${nome} inválido: informe um inteiro ≥ 0.`);
  }
  const store = saldosDemo();
  let gravados = 0;
  let apagados = 0;
  for (const [chave, texto] of entradas) {
    const produtoId = Number(chave);
    const i = store.findIndex((r) => r.data === body.data && r.embalagem_produto_id === produtoId);
    if (texto === '') {
      if (i >= 0) { store.splice(i, 1); apagados += 1; }
      continue;
    }
    if (i >= 0) store[i].quantidade = Number(texto);
    else store.push({ data: body.data, embalagem_produto_id: produtoId, quantidade: Number(texto) });
    gravados += 1;
  }
  return Promise.resolve({ data: body.data, gravados, apagados });
}

const desprezosStore: EmbalagemDesprezo[] = [
  { id: 1, data_lancamento: '2026-08-28', data_colheita: '2026-08-27', tipo_cogumelo: 'SH', kg: 1, lote_id: null, observacao: null, origem: 'TELA', created_at: '2026-08-28T10:00:00Z' },
  { id: 2, data_lancamento: '2026-08-27', data_colheita: '2026-08-25', tipo_cogumelo: 'SB', kg: 1.2, lote_id: null, observacao: 'baldes molhados', origem: 'TELA', created_at: '2026-08-27T10:00:00Z' },
];
let proximoDesprezo = 3;

function colheitasELotesDaDemo() {
  const lotes = new Map<number, { id: number; tipo: string; data_lote: string }>();
  const colheitas: Array<{ id: number; lote_id: number; data_colheita: string; total_kg: number | null }> = [];
  for (const l of jornadaStore) {
    if (!lotes.has(l.lote_id)) lotes.set(l.lote_id, { id: l.lote_id, tipo: l.tipo, data_lote: l.data_lote });
    if (l.data_colheita && l.colheita_id != null) colheitas.push({ id: l.colheita_id, lote_id: l.lote_id, data_colheita: l.data_colheita, total_kg: l.total_kg });
  }
  return { colheitas, lotes: [...lotes.values()] };
}
const dadosDaConferenciaDemo = () => ({
  produtos: EMBALAGEM_PRODUTOS,
  registros: embalagemStore.flatMap((d) => Object.entries(d.valores).filter(([, q]) => Number(q) > 0)
    .map(([id, q]) => ({ data: d.data, data_lancamento: d.data_lancamento, embalagem_produto_id: Number(id), quantidade: q }))),
  desprezos: desprezosStore,
  ...colheitasELotesDaDemo(),
});

export function producaoEmbalagemResumo(params: Record<string, string | undefined>): Promise<EmbalagemResumo> {
  const hoje = HOJE_EMBALAGEM_DEMO;
  const opcoes = { inicio: params.inicio || null, fim: params.fim || null, hoje, origens: { tolerancia_kg: 'PADRAO', dias_para_fechar: 'PADRAO' } };
  const r = resumoDaEmbalagem(dadosDaConferenciaDemo(), opcoes as unknown as Parameters<typeof resumoDaEmbalagem>[1]);
  return Promise.resolve({ ...(r as unknown as Omit<EmbalagemResumo, 'hoje' | 'corte'>), hoje, corte: '2026-04-05' });
}

export function producaoDesprezos(params: Record<string, string | undefined>): Promise<EmbalagemDesprezo[]> {
  return Promise.resolve(desprezosStore
    .filter((d) => (!params.inicio || d.data_colheita >= params.inicio) && (!params.fim || d.data_colheita <= params.fim))
    .sort((a, b) => b.data_colheita.localeCompare(a.data_colheita) || b.id - a.id));
}

export function producaoRegistrarDesprezo(body: DesprezoBody): Promise<EmbalagemDesprezo> {
  const kg = Number(String(body.kg).replace(',', '.'));
  if (!(kg > 0)) return Promise.reject(new Error('kg desprezados inválido: informe um número maior que zero.'));
  const data_lancamento = body.data_lancamento || HOJE_PAINEL_DEMO;
  if (data_lancamento < body.data_colheita) return Promise.reject(new Error(`A data do dia (${data_lancamento}) não pode ser antes da data da colheita (${body.data_colheita}).`));
  const novo: EmbalagemDesprezo = { id: proximoDesprezo++, data_lancamento, data_colheita: body.data_colheita, tipo_cogumelo: body.tipo_cogumelo, kg: Math.round(kg * 1000) / 1000, lote_id: body.lote_id ?? null, observacao: body.observacao || null, origem: 'TELA', created_at: new Date().toISOString() };
  desprezosStore.push(novo);
  return Promise.resolve(novo);
}

export function producaoAtualizarDesprezo(id: number, body: DesprezoBody): Promise<EmbalagemDesprezo> {
  const i = desprezosStore.findIndex((d) => d.id === id);
  if (i < 0) return Promise.reject(new Error(`Desprezo ${id} não encontrado.`));
  const atual = desprezosStore[i];
  const corpo: DesprezoBody = { data_lancamento: atual.data_lancamento, lote_id: atual.lote_id, observacao: atual.observacao, ...body };
  return producaoRegistrarDesprezo(corpo).then((novo) => {
    desprezosStore.pop();
    desprezosStore[i] = { ...novo, id, created_at: desprezosStore[i].created_at };
    return desprezosStore[i];
  });
}

export function producaoExcluirDesprezo(id: number): Promise<{ id: number }> {
  const i = desprezosStore.findIndex((d) => d.id === id);
  if (i < 0) return Promise.reject(new Error(`Desprezo ${id} não encontrado.`));
  desprezosStore.splice(i, 1);
  return Promise.resolve({ id });
}

export function producaoColheitasDoDia({ data, tipo }: { data: string; tipo: string }): Promise<ColheitaDoDia[]> {
  return Promise.resolve(jornadaStore
    .filter((l) => l.data_colheita === data && l.tipo === tipo.toUpperCase() && l.colheita_id != null)
    .map((l) => ({ colheita_id: l.colheita_id as number, lote_id: l.lote_id, codigo: null, data_lote: l.data_lote, estante: l.estante_colheita ?? l.estante_maturacao ?? null, kg: l.total_kg })));
}

type IndFx = Array<number | null>;
const mkInd = (v: IndFx): IndicadoresCicloMetricas => ({
  taxa_contaminacao: v[0], taxa_aproveitamento: v[1], kg_por_bloco_aberto: v[2],
  eficiencia_total: v[3], perda_invisivel: v[4], total_kg_colhidos: v[5],
  pct_p: v[6], pct_m: v[7], pct_g: v[8],
  pct_gg: v[9] ?? (v[6] == null ? null : 0),
});

export function producaoIndicadores(_params: Record<string, string | undefined>): Promise<IndicadoresCicloResposta> {
  const linhaSH = (rotulo: string, v: IndFx) => ({ rotulo, ...mkInd(v) });
  return Promise.resolve({
    grupos: [
      {
        tipo: 'SH',
        total: mkInd([0.1588, 0.334, 0.1251, 0.0397, 16840, 1215.73, 0.8237, 0.1561, 0.0202]),
        linhas: [
          linhaSH('2025-10-16', [0.0385, 0.9412, 0.1137, 0.1071, -190, 87.41, 0.8466, 0.1384, 0.015]),
          linhaSH('2025-10-17', [0, 0.265, 0.2614, 0.0693, 540, 49.83, 0.8712, 0.1288, 0]),
          linhaSH('2025-10-20', [0.0921, 0.2104, 0.0711, 0.015, 655, 15.62, 0.9035, 0.0965, 0]),
          linhaSH('2025-10-21', [null, null, 0.1205, null, -142, 11.37, 0.948, 0.052, 0]),
          linhaSH('2025-11-05', [0.0512, 0.4266, 0.1388, 0.0592, 433, 55.9, 0.9214, 0.0786, 0]),
          linhaSH('2025-12-13', [0.0631, 0.881, 0.1702, 0.1499, -75, 128.46, 0.889, 0.0904, 0.0206]),
          linhaSH('2026-01-28', [0.124, 0.3622, 0.1318, 0.0477, 512, 46.08, 0.702, 0.2296, 0.0684]),
          linhaSH('2026-03-16', [0.0973, 0.695, 0, 0, 104, 0, null, null, null]),
        ],
      },
      {
        tipo: 'SP',
        total: mkInd([0.387, 0.7108, 0.0215, 0.0139, -121, 7.84, null, null, null]),
        linhas: [linhaSH('2026-03-26', [0.387, 0.7108, 0.0215, 0.0139, -121, 7.84, null, null, null])],
      },
      {
        tipo: 'SB',
        total: mkInd([0.441, 0, null, 0.0246, 466, 19.58, null, null, null]),
        linhas: [
          linhaSH('2026-02-08', [0.3962, 0, null, 0.0318, 128, 7.39, null, null, null]),
          linhaSH('2026-02-14', [0.4705, 0, null, 0.0201, 338, 12.19, null, null, null]),
        ],
      },
    ],
    total_geral: mkInd([0.1874, 0.3512, 0.1179, 0.0371, 17185, 1243.15, 0.8237, 0.1561, 0.0202]),
  });
}

const VALIDACOES_DO_CICLO_DEMO: PainelCicloValidacoes = {
  hoje: '2026-07-15',
  regras: [
    { id: 'ABERTURA_ANTES_DO_LOTE', titulo: 'Abertura anterior à data de produção do lote',
      nivel: 'BLOQUEIO' as const, unidade: 'estante' as const, total: 2,
      ocorrencias: [
        { data_lote: '2026-04-24', tipo: 'SB', galpao: 'A', estante: '33', campo: 'data_abertura', valor: '2026-04-09', referencia: '2026-04-24' },
        { data_lote: '2026-04-24', tipo: 'SB', galpao: 'A', estante: '36', campo: 'data_abertura', valor: '2026-04-09', referencia: '2026-04-24' },
      ] },
    { id: 'COLHEITA_ANTES_DA_ABERTURA', titulo: 'Colheita anterior à abertura ou à produção',
      nivel: 'BLOQUEIO' as const, unidade: 'colheita' as const, total: 3, ocorrencias: [] },
    { id: 'CONTAMINACAO_ANTES_DO_LOTE', titulo: 'Retirada de contaminado anterior à produção do lote',
      nivel: 'BLOQUEIO' as const, unidade: 'evento' as const, total: 5, ocorrencias: [] },
    { id: 'DATA_FUTURA', titulo: 'Data posterior a hoje',
      nivel: 'ALERTA' as const, unidade: 'registro' as const, total: 8, ocorrencias: [] },
    { id: 'DATA_POSSIVELMENTE_INVERTIDA', titulo: 'Data que a inversão de dia/mês explicaria',
      nivel: 'ALERTA' as const, unidade: 'registro' as const, total: 13,
      ocorrencias: [
        { data_lote: '2025-12-04', tipo: 'SH', galpao: 'N', estante: '3', campo: 'data_evento', valor: '2026-10-01', valor_invertido: '2026-01-10', regra_de_origem: 'DATA_FUTURA' },
        { data_lote: '2026-04-24', tipo: 'SB', galpao: 'A', estante: '33', campo: 'data_abertura', valor: '2026-04-09', valor_invertido: '2026-09-04', regra_de_origem: 'ABERTURA_ANTES_DO_LOTE' },
      ] },
    { id: 'ABERTURA_SEM_QUANTIDADE', titulo: 'Abertura registrada sem o número de blocos abertos',
      nivel: 'BLOQUEIO' as const, unidade: 'estante' as const, total: 6, ocorrencias: [] },
    { id: 'QUANTIDADE_INCOMPATIVEL', titulo: 'A conta de blocos do lote não fecha',
      nivel: 'ALERTA' as const, unidade: 'lote' as const, total: 9,
      ocorrencias: [
        { chave: '2026-01-18|SH', data_lote: '2026-01-18', tipo: 'SH', galpao: 'A, N', estantes: 7, blocos_produzidos: 120, blocos_contaminados: 95, blocos_abertos: 410, sobra: -385 },
      ] },
  ],
  resumo: { total: 46, bloqueios: 16, alertas: 30, regras_com_ocorrencia: 7 },
};

const LOTES_CONVERSAO_DEMO: Array<Omit<ConversaoLote, 'bandejas' | 'taxa' | 'kg_colhidos'>> = [
  { chave: '2025-11-11|SH', data_lote: '2025-11-11', tipo: 'SH', data_abertura: '2026-03-31', ultima_colheita: '2026-05-14',
    nf_semente: '20.120', nf: { chave: '20120', rotulo: 'NF 20120' },
    blocos_abertos: 540, gramas_colhidas: 104160 },
  { chave: '2026-01-10|SH', data_lote: '2026-01-10', tipo: 'SH', data_abertura: '2026-04-24', ultima_colheita: '2026-06-21',
    nf_semente: 'CP10 - 20155', nf: { chave: '20155', rotulo: 'NF 20155' },
    blocos_abertos: 580, gramas_colhidas: 113400 },
  { chave: '2026-04-01|SH', data_lote: '2026-04-01', tipo: 'SH', data_abertura: '2026-06-27', ultima_colheita: '2026-07-07',
    nf_semente: 'CP10 - 20190 CP20-20190 CP20- 20233', nf: { chave: 'MAIS_DE_UMA', rotulo: 'Mais de uma NF' },
    blocos_abertos: 450, gramas_colhidas: 39270 },
  { chave: '2026-04-08|SB', data_lote: '2026-04-08', tipo: 'SB', data_abertura: '2026-05-23', ultima_colheita: '2026-06-09',
    nf_semente: '20233', nf: { chave: '20233', rotulo: 'NF 20233' },
    blocos_abertos: 660, gramas_colhidas: 61950 },
  { chave: '2026-05-16|SP', data_lote: '2026-05-16', tipo: 'SP', data_abertura: '2026-06-24', ultima_colheita: '2026-07-14',
    nf_semente: 'CP30-20155 CP30-20170', nf: { chave: 'MAIS_DE_UMA', rotulo: 'Mais de uma NF' },
    blocos_abertos: 420, gramas_colhidas: 10500 },
];
const ORDEM_TIPO_DEMO = ['SH', 'SB', 'SP', 'SS'];
function somaConversaoDemo(xs: ConversaoLote[]): ConversaoSoma {
  const blocos_abertos = xs.reduce((s, l) => s + l.blocos_abertos, 0);
  const gramas = xs.reduce((s, l) => s + l.gramas_colhidas, 0);
  const bandejas = xs.reduce((s, l) => s + l.bandejas, 0);
  return { lotes: xs.length, blocos_abertos, gramas_colhidas: gramas, kg_colhidos: gramas / 1000, bandejas,
    taxa: blocos_abertos > 0 ? bandejas / blocos_abertos : null };
}
function gruposConversaoDemo(xs: ConversaoLote[], chave: (l: ConversaoLote) => { chave: string; rotulo: string }): ConversaoGrupo[] {
  const mapa = new Map<string, { tipo: string; chave: string; rotulo: string; lotes: ConversaoLote[] }>();
  for (const l of xs) {
    const c = chave(l);
    const k = `${l.tipo}|${c.chave}`;
    if (!mapa.has(k)) mapa.set(k, { tipo: l.tipo, ...c, lotes: [] });
    mapa.get(k)!.lotes.push(l);
  }
  return [...mapa.values()]
    .sort((a, b) => ORDEM_TIPO_DEMO.indexOf(a.tipo) - ORDEM_TIPO_DEMO.indexOf(b.tipo) || a.chave.localeCompare(b.chave, 'pt', { numeric: true }))
    .map((g) => ({ tipo: g.tipo, chave: g.chave, rotulo: g.rotulo, ...somaConversaoDemo(g.lotes) }));
}
export function conversaoDemo(params: Record<string, string | undefined> = {}): PainelCicloConversao {
  const gramas = METAS_PADRAO_DEMO.gramas_por_bandeja.valor ?? 210;
  const lotes: ConversaoLote[] = LOTES_CONVERSAO_DEMO
    .filter((l) => !params.tipo || l.tipo === params.tipo)
    .map((l) => {
      const bandejas = Math.round(l.gramas_colhidas / gramas);
      return { ...l, kg_colhidos: l.gramas_colhidas / 1000, bandejas, taxa: bandejas / l.blocos_abertos };
    });
  const mes = (l: ConversaoLote) => {
    const m = (params.eixo === 'ABERTURA' ? l.data_abertura : l.data_lote)?.slice(0, 7) ?? 'sem data';
    return { chave: m, rotulo: m };
  };
  const fora = { em_maturacao: 37, abertura_sem_quantidade: 6, abertos_sem_colheita: 3, abertura_com_zero_blocos: 0 };
  const foraTotal = Object.values(fora).reduce((s, n) => s + n, 0);
  return {
    gramas_por_bandeja: gramas,
    gramas_origem: 'PADRAO',
    eixo: params.eixo === 'ABERTURA' ? 'ABERTURA' : 'LOTE',
    lotes,
    por_tipo: gruposConversaoDemo(lotes, (l) => ({ chave: l.tipo, rotulo: l.tipo })),
    por_mes: gruposConversaoDemo(lotes, mes),
    por_nf: gruposConversaoDemo(lotes, (l) => l.nf),
    total: somaConversaoDemo(lotes),
    fora_da_conta: { ...fora, total: foraTotal },
    lotes_do_periodo: lotes.length + foraTotal,
  };
}

export function producaoPainelCiclo(
  params: Record<string, string | undefined>,
): Promise<PainelCicloResposta> {
  const doTipo = <T extends { tipo: string | null }>(xs: T[]) => (params.tipo ? xs.filter((x) => x.tipo === params.tipo) : xs);
  const doGalpao = <T extends { galpoes: string[] }>(xs: T[]) => (params.galpao ? xs.filter((x) => x.galpoes.includes(params.galpao!)) : xs);
  const lotesDoFiltro = (xs: PainelCicloLote[]) => doGalpao(doTipo(xs));
  const meses = ['2026-03', '2026-04', '2026-05', '2026-06', '2026-07'];
  const serie = meses.map((mes, i) => ({
    mes,
    blocos_produzidos: [3100, 5400, 7200, 6100, 4700][i],
    blocos_contaminados: [420, 980, 1260, 1140, 760][i],
    blocos_abertos: [0, 900, 2300, 2800, 1700][i],
    kg_colhidos: [0, 0, 380, 640, 410][i],
  }));
  const metricas = (over: Partial<PainelCicloMetricas> = {}): PainelCicloMetricas => ({
    blocos_produzidos: 26500, blocos_contaminados: 4560, blocos_abertos: 7700,
    kg_colhidos: 1430, lotes: 56, estantes: 310,
    lotes_com_abertura: 27, lotes_com_colheita: 24,
    lotes_mensuraveis: 21, lotes_em_maturacao: 29, lotes_abertura_sem_quantidade: 3,
    lotes_com_abertura_parcial: 4, lotes_com_dado_faltante: 6, estantes_sem_quantidade: 8,
    nao_mensuraveis: { em_maturacao: 29, dado_faltante: 6, sem_contagem_de_produzidos: 0 },
    lotes_inconsistentes: 7,
    lotes_divergentes: 15, lotes_dentro_da_tolerancia: 6,
    taxa_contaminacao: 0.172, taxa_aproveitamento: 0.581, kg_por_bloco_aberto: 0.186,
    eficiencia_total: 0.054,
    perda_total_blocos: 1820, perda_total_pct: 0.112,
    dias_ate_abertura_mediana: 97, ...over,
  });
  const lote = (n: number, over: Partial<PainelCicloLote> = {}): PainelCicloLote => ({
    chave: `2026-04-0${n}|SH`, data_lote: `2026-04-0${n}`, tipo: 'SH',
    estantes: 3, estante_ids: [n * 10, n * 10 + 1, n * 10 + 2],
    galpoes: ['A', 'N'], estantes_maturacao: ['3', '9', '15'], nf_semente: '20.140',
    blocos_produzidos: 720, blocos_contaminados: 36, contaminacao_verde: 20,
    contaminacao_laranja: 11, contaminacao_preta: 5, contaminacao_sem_cor: 0, blocos_perdidos: 0,
    blocos_abertos: 660,
    data_abertura: '2026-06-16', dias_ate_abertura: 76,
    kg_colhidos: 132, kg_p: 104, kg_m: 23, kg_g: 5, kg_gg: 0,
    estantes_sem_quantidade: 0, mensuravel: true, estado: 'ABERTO' as const,
    perda_total_blocos: 24, perda_total_pct: 0.0333,
    inconsistente: false, divergente: true, tolerancia_blocos: 10,
    taxa_contaminacao: 0.05, taxa_aproveitamento: 0.9167,
    kg_por_bloco_aberto: 0.2, eficiencia_total: 0.1833,
    estantes_colhidas: {
      estantes: [], total: 0, kg_por_estante: [],
      kg_sem_estante: 132, colheitas_sem_estante: 12,
    }, ...over,
  });
  const tres = [
    lote(1, {
      estantes_colhidas: {
        estantes: ['3', '8', '9'], total: 3,
        kg_por_estante: [
          { estante: '8', kg: 61, colheitas: 4 },
          { estante: '3', kg: 44, colheitas: 3 },
          { estante: '9', kg: 27, colheitas: 2 },
        ],
        kg_sem_estante: 0, colheitas_sem_estante: 0,
      },
    }),
    lote(2, {
      taxa_contaminacao: 0.06, kg_por_bloco_aberto: 0.18, kg_colhidos: 118,
      estantes_colhidas: {
        estantes: [], total: 0, kg_por_estante: [],
        kg_sem_estante: 118, colheitas_sem_estante: 12,
      },
    }),
    lote(3, {
      taxa_contaminacao: 0.09, kg_por_bloco_aberto: 0.15, kg_colhidos: 101,
      blocos_produzidos: 48, blocos_abertos: 96, taxa_aproveitamento: 2,
      perda_total_blocos: -84, perda_total_pct: -1.75,
      inconsistente: true,
      estantes_colhidas: {
        estantes: [], total: 0, kg_por_estante: [],
        kg_sem_estante: 101, colheitas_sem_estante: 9,
      },
    }),
  ];
  return Promise.resolve({
    totais: {
      blocos_produzidos: 26500, blocos_contaminados: 4560, blocos_abertos: 7700,
      kg_colhidos: 1430,
      por_tipo: doTipo([
        { tipo: 'SB', blocos_produzidos: 5300, blocos_contaminados: 1010, blocos_abertos: 1200, kg_colhidos: 190 },
        { tipo: 'SH', blocos_produzidos: 16400, blocos_contaminados: 2780, blocos_abertos: 5100, kg_colhidos: 1020 },
        { tipo: 'SP', blocos_produzidos: 4800, blocos_contaminados: 770, blocos_abertos: 1400, kg_colhidos: 220 },
      ]),
      cobertura: { estantes: 310, estantes_com_abertura: 128, estantes_com_data_abertura: 139, estantes_sem_quantidade: 8 },
    },
    serie_mensal: serie,
    eixo: { ignoradas: 0, truncado: false },
    parametros: { contaminacao_dias_comparavel: 20 },
    conversao: conversaoDemo(params),
    prazos: doTipo([
      { tipo: 'SB', parametro_dias: 30, lotes: 24, lotes_sem_abertura: 7, datas_invertidas: 1,
        mediana_dias: 52, minimo_dias: 34, maximo_dias: 69, acima_do_parametro: 21,
        pct_acima: 0.88, desvio_mediana: 22 },
      { tipo: 'SH', parametro_dias: 90, lotes: 81, lotes_sem_abertura: 19, datas_invertidas: 0,
        mediana_dias: 97, minimo_dias: 81, maximo_dias: 139, acima_do_parametro: 58,
        pct_acima: 0.72, desvio_mediana: 7 },
      { tipo: 'SP', parametro_dias: 30, lotes: 22, lotes_sem_abertura: 5, datas_invertidas: 0,
        mediana_dias: 38, minimo_dias: 29, maximo_dias: 51, acima_do_parametro: 17,
        pct_acima: 0.77, desvio_mediana: 8 },
    ]),
    eficiencia: {
      total: metricas(),
      por_mes: meses.map((mes, i) => ({ mes, ...metricas({ lotes: [9, 13, 15, 12, 7][i] }) })),
      por_tipo: doTipo([
        { tipo: 'SB', ...metricas({
          lotes: 11, estantes: 64, lotes_com_abertura: 0, lotes_mensuraveis: 0,
          lotes_em_maturacao: 11, blocos_abertos: 0,
          taxa_aproveitamento: null, kg_por_bloco_aberto: null, eficiencia_total: null,
        }) },
        { tipo: 'SH', ...metricas({ lotes: 33, estantes: 186 }) },
        { tipo: 'SP', ...metricas({ lotes: 12, estantes: 60 }) },
      ]),
    },
    melhor_performance: meses.map((mes, i) => ({
      mes,
      blocos_produzidos: serie[i].blocos_produzidos,
      kg_colhidos: serie[i].kg_colhidos,
      kg_p: serie[i].kg_colhidos * 0.75,
      kg_m: serie[i].kg_colhidos * 0.19,
      kg_g: serie[i].kg_colhidos * 0.06,
      kg_gg: 0,
      pct_p: serie[i].kg_colhidos ? 0.75 : null,
      pct_m: serie[i].kg_colhidos ? 0.19 : null,
      pct_g: serie[i].kg_colhidos ? 0.06 : null,
      pct_gg: serie[i].kg_colhidos ? 0 : null,
      kg_por_bloco_aberto: serie[i].blocos_abertos ? 0.19 : null,
      eficiencia_total: serie[i].kg_colhidos / serie[i].blocos_produzidos,
      taxa_contaminacao: serie[i].blocos_contaminados / serie[i].blocos_produzidos,
      perda_total_pct: 0.284,
      lotes: [9, 13, 15, 12, 7][i],
      lotes_com_abertura: [3, 6, 7, 7, 4][i],
      lotes_mensuraveis: [2, 5, 6, 5, 3][i],
      lotes_inconsistentes: [1, 2, 2, 1, 1][i],
    })),
    rankings: {
      limite: 10,
      menor_contaminacao: lotesDoFiltro(tres),
      maior_kg_por_bloco_aberto: lotesDoFiltro(tres),
      maior_eficiencia: lotesDoFiltro(tres),
      maior_kg: lotesDoFiltro(tres),
      excluidos: { em_maturacao: 29, dado_faltante: 6, sem_colheita: 27, inconsistentes: 7 },
    },
  });
}

function resumoDasLinhasDaFila(linhas: PrevisaoAberturaLinha[]): PrevisaoAberturaResposta['resumo'] {
  type Acum = { enderecos: number; lotes: Set<string>; blocos: number };
  const vazio = (): Acum => ({ enderecos: 0, lotes: new Set(), blocos: 0 });
  const acumular = (a: Acum, l: PrevisaoAberturaLinha) => {
    a.enderecos += 1;
    a.lotes.add(l.lote_chave);
    if (l.blocos_disponiveis != null && l.blocos_disponiveis > 0) a.blocos += l.blocos_disponiveis;
  };
  const fechar = (a: Acum) => ({ enderecos: a.enderecos, lotes: a.lotes.size, blocos: a.blocos });
  const situacoes = ['VENCIDO', 'PROXIMO', 'EM_PRAZO', 'SEM_PARAMETRO', 'DATA_INCONSISTENTE'] as const;
  const porSituacao = Object.fromEntries(situacoes.map((s) => [s, vazio()])) as Record<typeof situacoes[number], Acum>;
  const porTipo = new Map<string, Acum>();
  let comQuantidade = 0; let quantidadeNoLote = 0; let semQuantidade = 0; let blocosSomados = 0;
  for (const l of linhas) {
    acumular(porSituacao[l.situacao], l);
    const t = l.tipo ?? '(sem tipo)';
    if (!porTipo.has(t)) porTipo.set(t, vazio());
    acumular(porTipo.get(t)!, l);
    if (l.origem_quantidade === 'ESTANTE') { comQuantidade += 1; blocosSomados += Math.max(0, l.blocos_disponiveis ?? 0); }
    else if (l.origem_quantidade === 'LOTE') quantidadeNoLote += 1;
    else semQuantidade += 1;
  }
  return {
    por_situacao: Object.fromEntries(situacoes.map((s) => [s, fechar(porSituacao[s])])) as PrevisaoAberturaResposta['resumo']['por_situacao'],
    por_tipo: [...porTipo.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([tipo, a]) => ({ tipo, ...fechar(a) })),
    cobertura: {
      enderecos: linhas.length, com_quantidade: comQuantidade, quantidade_no_lote: quantidadeNoLote,
      sem_quantidade: semQuantidade, blocos_somados: blocosSomados,
    },
  };
}

const HOJE_FILA_DEMO = '2026-07-15';
const comPrazoDaFila = (l: PrevisaoAberturaLinha, hoje: string = HOJE_FILA_DEMO): PrevisaoAberturaLinha => {
  if (l.parametro_dias == null) return l;
  const prevista = somaDias(l.data_lote, l.parametro_dias);
  const restantes = diasEntre(hoje, prevista);
  return {
    ...l, data_prevista: prevista, dias_restantes: restantes, dias_decorridos: diasEntre(l.data_lote, hoje),
    situacao: restantes < 0 ? 'VENCIDO' : restantes <= 7 ? 'PROXIMO' : 'EM_PRAZO',
  };
};
const linhaDaFilaDemo = (
  id: number, over: Partial<PrevisaoAberturaLinha> = {},
): PrevisaoAberturaLinha => comPrazoDaFila({
  estante_id: id, lote_chave: '2026-03-27|SH', data_lote: '2026-03-27', tipo: 'SH',
  galpao: 'N', estante: String(id), blocos_guardados: 154, blocos_guardados_lote: 770,
  origem_quantidade: 'ESTANTE', blocos_contaminados: 27,
  blocos_abertos: null,
  blocos_disponiveis: 127, parametro_dias: 90, data_prevista: null,
  parametro_origem: 'TIPO', regra_id: null,
  dias_restantes: 0, dias_decorridos: 0, situacao: 'VENCIDO',
  sem_quantidade: false, saldo_negativo: false, lote_parcialmente_aberto: false,
  motivo_fora: null,
  estante_parcialmente_aberta: false, ...over,
});

function linhasDaFilaDemo(): PrevisaoAberturaLinha[] {
  const linha = linhaDaFilaDemo;
  const linhas: PrevisaoAberturaLinha[] = [
    linha(20, {
      lote_chave: '2026-05-06|SB', data_lote: '2026-05-06', tipo: 'SB', galpao: 'A',
      estante: '29', blocos_guardados: 84, blocos_contaminados: 11, blocos_disponiveis: 73,
      parametro_dias: 30,
    }),
    linha(3), linha(4),
    linha(5, {
      blocos_guardados: null, blocos_disponiveis: null, origem_quantidade: 'LOTE',
    }),
    linha(6, {
      blocos_guardados: 36, blocos_contaminados: 71, blocos_disponiveis: -35, saldo_negativo: true,
    }),
    linha(8, {
      lote_chave: '2026-04-02|SH', data_lote: '2026-04-02', estante: '16', galpao: 'A',
      blocos_guardados: null, blocos_guardados_lote: null, blocos_disponiveis: null,
      origem_quantidade: 'AUSENTE', sem_quantidade: true,
    }),
    linha(21, {
      lote_chave: '2026-04-18|SH', data_lote: '2026-04-18', tipo: 'SH', galpao: 'A',
      estante: '21', lote_parcialmente_aberto: true,
      parametro_origem: 'ESPECIE', regra_id: 1,
    }),
  ];
  return linhas;
}

export function producaoPrevisaoAbertura(
  params: Record<string, string | undefined>,
): Promise<PrevisaoAberturaResposta> {
  const doTipo = <T extends { tipo: string | null }>(xs: T[]) => (params.tipo ? xs.filter((x) => params.tipo!.split(',').includes(x.tipo ?? '')) : xs);
  const doFiltro = (xs: PrevisaoAberturaLinha[]) => doTipo(xs)
    .filter((l) => !params.galpao || l.galpao === params.galpao);
  const linha = linhaDaFilaDemo;
  const linhas = linhasDaFilaDemo();
  const linhasDoFiltro = doFiltro(linhas);
  return Promise.resolve({
    linhas: linhasDoFiltro,
    fora_da_fila: doFiltro([linha(70, {
      lote_chave: '2026-05-14|SH', data_lote: '2026-05-14', tipo: 'SH', galpao: 'A',
      estante: '58', blocos_guardados: 4, blocos_contaminados: 12, blocos_disponiveis: -8,
      saldo_negativo: true, motivo_fora: 'SALDO_NEGATIVO',
    }),
    linha(90, {
      lote_chave: '2026-03-09|SB', data_lote: '2026-03-09', tipo: 'SB', galpao: 'A',
      estante: '53', blocos_guardados: null, blocos_guardados_lote: 760,
      origem_quantidade: 'LOTE', blocos_contaminados: 18, blocos_disponiveis: null,
      motivo_fora: 'ENCERRADO_SEM_CONTAGEM', parametro_dias: 90,
      lote_parcialmente_aberto: true,
    })]),
    concluidas_com_sobra: doTipo([{
      estante_id: 91, data_lote: '2026-03-12', tipo: 'SH', galpao: 'N', estante: '22',
      data_abertura: '2026-06-15', blocos_guardados: 130, blocos_contaminados: 9,
      blocos_perdidos: 0, blocos_abertos: 108, blocos_na_conta: 13,
    }]).filter((l) => !params.galpao || l.galpao === params.galpao),
    resumo: resumoDasLinhasDaFila(linhasDoFiltro),
    prazos: doTipo([
      { tipo: 'SB', parametro_dias: 30, lotes: 5, lotes_sem_abertura: 4, datas_invertidas: 0,
        mediana_dias: 49, minimo_dias: 41, maximo_dias: 61, acima_do_parametro: 5,
        pct_acima: 1, desvio_mediana: 19 },
      { tipo: 'SH', parametro_dias: 90, lotes: 21, lotes_sem_abertura: 22, datas_invertidas: 0,
        mediana_dias: 96, minimo_dias: 83, maximo_dias: 131, acima_do_parametro: 17,
        pct_acima: 0.81, desvio_mediana: 6 },
      { tipo: 'SP', parametro_dias: 30, lotes: 5, lotes_sem_abertura: 3, datas_invertidas: 0,
        mediana_dias: 37, minimo_dias: 33, maximo_dias: 45, acima_do_parametro: 4,
        pct_acima: 0.8, desvio_mediana: 7 },
    ]),
    dado_ate: '2026-06-21',
    ultimos_lancamentos: { producao: '2026-07-08', abertura: '2026-06-21', retirada: '2026-07-12' },
    ...(params.quadro === '1'
      ? { quadro: quadroDasEstantes({ salas: salasDaCapacidade, estantes: estantesStore }, linhas) }
      : {}),
    hoje: HOJE_FILA_DEMO,
  });
}

export function painelContaminados(
  params: { inicio?: string; fim?: string } = {},
): Promise<PainelContaminadosResposta> {
  const semana = (
    over: Partial<SemanaContaminacao> & Pick<SemanaContaminacao, 'semana' | 'rotulo' | 'inicio' | 'fim'>,
  ): SemanaContaminacao => ({
    lotes: 0, lotes_com_contaminacao: 0, pct_lotes_afetados: null,
    blocos_produzidos: 0, blocos_contaminados: 0, taxa: null,
    semaforo: null, maturidade: 'SEM_DATA', dias_da_semana: null, fracao_esperada: null,
    lote_chaves: [], ...over,
  });
  const semanas: SemanaContaminacao[] = [
    semana({
      semana: '2026-W29', rotulo: '13/07 a 19/07', inicio: '2026-07-13', fim: '2026-07-19',
      lotes: 5, lotes_com_contaminacao: 3, pct_lotes_afetados: 0.6,
      blocos_produzidos: 2600, blocos_contaminados: 160, taxa: 0.0615,
      semaforo: 'VERDE', maturidade: 'MADURO', dias_da_semana: 46, fracao_esperada: 0.908,
      lote_chaves: ['2026-07-13|SH', '2026-07-15|SB', '2026-07-17|SP'],
    }),
    semana({
      semana: '2026-W30', rotulo: '20/07 a 26/07', inicio: '2026-07-20', fim: '2026-07-26',
      lotes: 6, lotes_com_contaminacao: 4, pct_lotes_afetados: 0.6667,
      blocos_produzidos: 3300, blocos_contaminados: 250, taxa: 0.0758,
      semaforo: 'VERDE', maturidade: 'MADURO', dias_da_semana: 39, fracao_esperada: 0.908,
      lote_chaves: ['2026-07-21|SH', '2026-07-22|SB', '2026-07-24|SH', '2026-07-25|SP'],
    }),
    semana({
      semana: '2026-W31', rotulo: '27/07 a 02/08', inicio: '2026-07-27', fim: '2026-08-02',
      lotes: 7, lotes_com_contaminacao: 6, pct_lotes_afetados: 0.8571,
      blocos_produzidos: 4100, blocos_contaminados: 470, taxa: 0.1146,
      semaforo: 'AMARELO', maturidade: 'MADURO', dias_da_semana: 32, fracao_esperada: 0.799,
      lote_chaves: ['2026-07-28|SH', '2026-07-30|SB', '2026-08-01|SP'],
    }),
    semana({
      semana: '2026-W32', rotulo: '03/08 a 09/08', inicio: '2026-08-03', fim: '2026-08-09',
      lotes: 5, lotes_com_contaminacao: 4, pct_lotes_afetados: 0.8,
      blocos_produzidos: 3500, blocos_contaminados: 430, taxa: 0.1229,
      semaforo: 'AMARELO', maturidade: 'MADURO', dias_da_semana: 25, fracao_esperada: 0.57,
      lote_chaves: ['2026-08-04|SH', '2026-08-06|SB'],
    }),
    semana({
      semana: '2026-W33', rotulo: '10/08 a 16/08', inicio: '2026-08-10', fim: '2026-08-16',
      lotes: 4, lotes_com_contaminacao: 2, pct_lotes_afetados: 0.5,
      blocos_produzidos: 2000, blocos_contaminados: 55, taxa: 0.0275,
      semaforo: null, maturidade: 'EM_OBSERVACAO', dias_da_semana: 18, fracao_esperada: 0.345,
      lote_chaves: ['2026-08-11|SH', '2026-08-13|SB'],
    }),
    semana({
      semana: '2026-W34', rotulo: '17/08 a 23/08', inicio: '2026-08-17', fim: '2026-08-23',
      lotes: 2, lotes_com_contaminacao: 1, pct_lotes_afetados: 0.5,
      blocos_produzidos: 800, blocos_contaminados: 12, taxa: 0.015,
      semaforo: null, maturidade: 'EM_OBSERVACAO', dias_da_semana: 11, fracao_esperada: 0.235,
      lote_chaves: ['2026-08-19|SH'],
    }),
  ];

  const somaLotes = semanas.reduce((t, s) => t + s.lotes, 0);
  const somaAfetados = semanas.reduce((t, s) => t + s.lotes_com_contaminacao, 0);
  const somaProduzidos = semanas.reduce((t, s) => t + s.blocos_produzidos, 0);
  const somaContaminados = semanas.reduce((t, s) => t + s.blocos_contaminados, 0);

  const DIAS_DO_LOCAL = 15;
  const t = (c: number, o: number) => (o > 0 ? c / o : null);
  const linhaDoLocal = (
    over: Partial<LinhaDoLocal> & { chave: string; contaminados: number; ocupacao_media: number },
  ): LinhaDoLocal => ({
    bloco_dias: over.ocupacao_media * DIAS_DO_LOCAL, divergencia: false, ...over,
    taxa: t(over.contaminados, over.ocupacao_media),
  });
  const somarLinhas = (chave: string, linhas: LinhaDoLocal[]): LinhaDoLocal => {
    const contaminados = linhas.reduce((s, l) => s + l.contaminados, 0);
    const ocupacao_media = linhas.reduce((s, l) => s + l.ocupacao_media, 0);
    return linhaDoLocal({ chave, contaminados, ocupacao_media, divergencia: linhas.some((l) => l.divergencia) });
  };
  const nEstantes: LinhaDoLocal[] = [
    linhaDoLocal({
      chave: 'N|01|', galpao: 'N', estante: '01', estante_fisica: null,
      contaminados: 38, ocupacao_media: 95, divergencia: true,
    }),
    linhaDoLocal({
      chave: 'N|02|', galpao: 'N', estante: '02', estante_fisica: null,
      contaminados: 26, ocupacao_media: 0,
    }),
    linhaDoLocal({
      chave: 'N|03|', galpao: 'N', estante: '03', estante_fisica: null,
      contaminados: 14, ocupacao_media: 70,
    }),
  ];
  const aEstantes: LinhaDoLocal[] = [
    linhaDoLocal({
      chave: 'A|01|', galpao: 'A', estante: '01', estante_fisica: null,
      contaminados: 22, ocupacao_media: 110,
    }),
    linhaDoLocal({
      chave: 'A|02|', galpao: 'A', estante: '02', estante_fisica: null,
      contaminados: 9, ocupacao_media: 45,
    }),
  ];
  const galpaoN: GalpaoDoLocal = { ...somarLinhas('N', nEstantes), galpao: 'N', estantes: nEstantes };
  const galpaoA: GalpaoDoLocal = { ...somarLinhas('A', aEstantes), galpao: 'A', estantes: aEstantes };
  const galpoesDoLocal = [galpaoN, galpaoA];
  const local: ContaminacaoDoLocal = {
    inicio: '2026-08-20', fim: '2026-09-03', dias: DIAS_DO_LOCAL, ultimo_lancamento: '2026-08-31',
    total: somarLinhas('TOTAL', galpoesDoLocal),
    galpoes: galpoesDoLocal,
    lotes: [
      { ...linhaDoLocal({ chave: '2026-07-28|SH', data_lote: '2026-07-28', tipo: 'SH', contaminados: 52, ocupacao_media: 130 }), taxa_do_lote: 0.3308 },
      { ...linhaDoLocal({ chave: '2026-07-15|SB', data_lote: '2026-07-15', tipo: 'SB', contaminados: 37, ocupacao_media: 95 }), taxa_do_lote: 0.295 },
      { ...linhaDoLocal({ chave: '2026-08-01|SP', data_lote: '2026-08-01', tipo: 'SP', contaminados: 20, ocupacao_media: 95 }), taxa_do_lote: 0.21 },
    ],
    sem_lote: { contaminados: 9, eventos: 2 },
    pesquisa: { contaminados: 3, eventos: 1 },
  };

  return Promise.resolve({
    hoje: '2026-09-03',
    semanas,
    tendencia: {
      estado: 'TENDENCIA_DE_PIORA', desde: '2026-W31', semanas_comparadas: 4,
      frase: 'A contaminação ficou acima do padrão em semanas consecutivas. A mudança começa nos lotes produzidos em 27/07 a 02/08 (2026-W31).',
    },
    galpoes: [
      { galpao: 'N', blocos_produzidos: 3400, blocos_contaminados: 890, taxa: 0.2618, semaforo: 'VERMELHO', lotes: 10 },
      { galpao: 'A', blocos_produzidos: 9200, blocos_contaminados: 1010, taxa: 0.1098, semaforo: 'AMARELO', lotes: 17 },
      { galpao: 'B', blocos_produzidos: 4300, blocos_contaminados: 115, taxa: 0.0267, semaforo: 'VERDE', lotes: 7 },
    ],
    por_tipo: [
      { tipo: 'SP', blocos_produzidos: 1500, blocos_contaminados: 330, taxa: 0.22, semaforo: 'VERMELHO', lotes: 5 },
      { tipo: 'SH', blocos_produzidos: 9900, blocos_contaminados: 1020, taxa: 0.103, semaforo: 'AMARELO', lotes: 17 },
      { tipo: 'SB', blocos_produzidos: 4900, blocos_contaminados: 27, taxa: 0.0055, semaforo: 'VERDE', lotes: 7 },
    ],
    top: [
      { chave: '2026-02-11|SH', rank: 1, data_lote: '2026-02-11', tipo: 'SH', galpoes: ['N'],
        blocos_produzidos: 70, blocos_contaminados: 104, taxa_contaminacao: 1.4857,
        nf_semente: 'CP10', semaforo: 'VERMELHO', contagem_inconsistente: true },
      { chave: '2026-07-28|SH', rank: 2, data_lote: '2026-07-28', tipo: 'SH', galpoes: ['N'],
        blocos_produzidos: 1300, blocos_contaminados: 430, taxa_contaminacao: 0.3308,
        nf_semente: 'CP10', semaforo: 'VERMELHO', contagem_inconsistente: false },
      { chave: '2026-07-15|SB', rank: 3, data_lote: '2026-07-15', tipo: 'SB', galpoes: ['N'],
        blocos_produzidos: 800, blocos_contaminados: 236, taxa_contaminacao: 0.295,
        nf_semente: 'CP 30', semaforo: 'VERMELHO', contagem_inconsistente: false },
      { chave: '2026-07-21|SH', rank: 4, data_lote: '2026-07-21', tipo: 'SH', galpoes: ['A'],
        blocos_produzidos: 2200, blocos_contaminados: 297, taxa_contaminacao: 0.135,
        nf_semente: 'CP20', semaforo: 'AMARELO', contagem_inconsistente: false },
    ],
    rondas: [
      { lote_id: 501, galpao: 'N', estante: 'N-12', data_lote: '2026-07-15', tipo: 'SB',
        data_ronda: '2026-08-17', blocos_na_ronda: 76, blocos_produzidos: 76,
        pct_da_ronda: 1, pct_acumulado: 1, dias_desde: 17, limite: 0.25, verificacao: null,
        outras_estantes: [
          { lote_id: 503, galpao: 'N', estante: 'N-13', pct_acumulado: 0.05 },
          { lote_id: 504, galpao: 'N', estante: 'N-14', pct_acumulado: null },
        ],
        frase: 'A estante N-12 (galpão N) teve 76 bloco(s) retirado(s) por contaminação em uma '
          + 'única ronda, em 17/08/2026: 100% do que essa estante produziu nesse lançamento.' },
      { lote_id: 502, galpao: 'N', estante: 'N-07', data_lote: '2026-07-28', tipo: 'SH',
        data_ronda: '2026-08-12', blocos_na_ronda: 112, blocos_produzidos: 280,
        pct_da_ronda: 0.4, pct_acumulado: 0.7, dias_desde: 22, limite: 0.25, verificacao: null, outras_estantes: [],
        frase: 'A estante N-07 (galpão N) teve 112 bloco(s) retirado(s) por contaminação em uma '
          + 'única ronda, em 12/08/2026: 40% do que essa estante produziu nesse lançamento.' },
      { ...retiradaDemo(hojeISO()), dias_desde: 0,
        verificacao: verificadosDeRetiradaDemo.get(`900002|${hojeISO()}`) ?? null,
        frase: 'A estante 12 (galpão B) teve 60 bloco(s) retirado(s) por contaminação em uma '
          + `única ronda, em ${dataBr(hojeISO())}: 30% do que essa estante produziu nesse lançamento.` },
      { lote_id: 502, galpao: 'N', estante: 'N-07', data_lote: '2026-07-28', tipo: 'SH',
        data_ronda: '2026-08-21', blocos_na_ronda: 84, blocos_produzidos: 280,
        pct_da_ronda: 0.3, pct_acumulado: 0.7, dias_desde: 13, limite: 0.25, verificacao: null, outras_estantes: [],
        frase: 'A estante N-07 (galpão N) teve 84 bloco(s) retirado(s) por contaminação em uma '
          + 'única ronda, em 21/08/2026: 30% do que essa estante produziu nesse lançamento.' },
    ],
    resumo: {
      lotes: somaLotes, lotes_com_contaminacao: somaAfetados,
      pct_lotes_afetados: somaAfetados / somaLotes,
      enderecos: somaLotes * 5, enderecos_com_contaminacao: somaAfetados * 4,
      pct_enderecos_afetados: (somaAfetados * 4) / (somaLotes * 5),
      blocos_produzidos: somaProduzidos, blocos_contaminados: somaContaminados,
      taxa: somaContaminados / somaProduzidos,
      meta: 0.05, meta_origem: 'PADRAO', corte_amarelo: 0.1, corte_vermelho: 0.2,
    },
    rastreabilidade: (() => {
      const sem_estante_importados = Math.round(somaContaminados * 0.6);
      const sem_estante_lancados = Math.round(somaContaminados * 0.05);
      const sem_cor = Math.round(somaContaminados * 0.02);
      const completos = somaContaminados - sem_estante_importados - sem_estante_lancados - sem_cor;
      const total = somaContaminados + AJUSTE_HISTORICO.blocos;
      return {
        rastreaveis: somaContaminados, ajuste_aplicado: true, ajuste_historico: AJUSTE_HISTORICO.blocos,
        ajuste_registros: AJUSTE_HISTORICO.registros, corte: AJUSTE_HISTORICO.corte, total, taxa_geral: total / somaProduzidos,
        composicao: { completos, sem_estante_importados, sem_estante_lancados, sem_cor, sem_dado_do_lote: 0 },
        cobertura: completos / total,
      };
    })(),
    faixas: {
      faixas: [
        { chave: '0-10', rotulo: '0 a 10 dias', lancamentos: 14, blocos: 410, pct_blocos: 0.3083 },
        { chave: '11-15', rotulo: '11 a 15 dias', lancamentos: 9, blocos: 265, pct_blocos: 0.1992 },
        { chave: '16-20', rotulo: '16 a 20 dias', lancamentos: 7, blocos: 190, pct_blocos: 0.1429 },
        { chave: '21-30', rotulo: '21 a 30 dias', lancamentos: 11, blocos: 255, pct_blocos: 0.1917 },
        { chave: '+30', rotulo: 'acima de 30 dias', lancamentos: 5, blocos: 210, pct_blocos: 0.1579 },
      ],
      base: { lancamentos: 46, blocos: 1330 },
      anteriores: { lancamentos: 1, blocos: 12 },
      sem_data_do_lote: 3,
      sem_data_do_lote_blocos: 35,
      eixo: 'data_evento - data_inoculacao',
    },
    periodos: [
      {
        dias: 30,
        atual: { inicio: '2026-08-05', fim: '2026-09-03', blocos: 1080, lancamentos: 101, dias_com_retirada: 8 },
        anterior: { inicio: '2026-07-06', fim: '2026-08-04', blocos: 870, lancamentos: 84, dias_com_retirada: 6 },
        diferenca: 210, variacao: 210 / 870, ultimo_lancamento: '2026-08-31',
        galpoes: { itens: [
          { chave: 'N', galpao: 'N', atual: 560, anterior: 330 },
          { chave: 'A', galpao: 'A', atual: 420, anterior: 470 },
          { chave: 'B', galpao: 'B', atual: 100, anterior: 70 },
        ], demais: null },
        estantes: { itens: [
          { chave: 'N|07|', galpao: 'N', estante: '07', estante_fisica: null, atual: 196, anterior: 90 },
          { chave: 'A|13|', galpao: 'A', estante: '13', estante_fisica: null, atual: 172, anterior: 95 },
          { chave: 'N|12|', galpao: 'N', estante: '12', estante_fisica: null, atual: 76, anterior: 0 },
          { chave: 'B|7|31', galpao: 'B', estante: '7', estante_fisica: '31', atual: 64, anterior: 31 },
        ], demais: { quantidade: 17, atual: 572, anterior: 654 } },
        lotes: { itens: [
          { chave: '2026-07-28|SH', data_lote: '2026-07-28', tipo: 'SH', galpoes: ['N'], atual: 430, anterior: 0 },
          { chave: '2026-07-13|SH', data_lote: '2026-07-13', tipo: 'SH', galpoes: ['A'], atual: 180, anterior: 360 },
          { chave: '2026-07-15|SB', data_lote: '2026-07-15', tipo: 'SB', galpoes: ['A', 'N'], atual: 160, anterior: 76 },
          { chave: '2026-08-01|SP', data_lote: '2026-08-01', tipo: 'SP', galpoes: ['B'], atual: 100, anterior: 0 },
        ], demais: { quantidade: 7, atual: 210, anterior: 434 } },
      },
      {
        dias: 15,
        atual: { inicio: '2026-08-20', fim: '2026-09-03', blocos: 560, lancamentos: 51, dias_com_retirada: 4 },
        anterior: { inicio: '2026-08-05', fim: '2026-08-19', blocos: 520, lancamentos: 50, dias_com_retirada: 4 },
        diferenca: 40, variacao: 40 / 520, ultimo_lancamento: '2026-08-31',
        galpoes: { itens: [
          { chave: 'N', galpao: 'N', atual: 300, anterior: 260 },
          { chave: 'A', galpao: 'A', atual: 210, anterior: 210 },
          { chave: 'B', galpao: 'B', atual: 50, anterior: 50 },
        ], demais: null },
        estantes: { itens: [
          { chave: 'N|07|', galpao: 'N', estante: '07', estante_fisica: null, atual: 84, anterior: 112 },
          { chave: 'A|13|', galpao: 'A', estante: '13', estante_fisica: null, atual: 92, anterior: 80 },
          { chave: 'B|7|31', galpao: 'B', estante: '7', estante_fisica: '31', atual: 34, anterior: 28 },
        ], demais: { quantidade: 15, atual: 350, anterior: 300 } },
        lotes: { itens: [
          { chave: '2026-07-28|SH', data_lote: '2026-07-28', tipo: 'SH', galpoes: ['N'], atual: 250, anterior: 180 },
          { chave: '2026-07-15|SB', data_lote: '2026-07-15', tipo: 'SB', galpoes: ['A', 'N'], atual: 90, anterior: 70 },
          { chave: '2026-08-01|SP', data_lote: '2026-08-01', tipo: 'SP', galpoes: ['B'], atual: 50, anterior: 50 },
        ], demais: { quantidade: 5, atual: 170, anterior: 220 } },
      },
    ],
    escopo: {
      cobre: ['semana de produção', 'maturidade', 'tendência', 'concentração por galpão', 'top 10'],
      fora: [
        'autoclave (responsável, tempo, temperatura, pressão, desvios): não existe no banco',
        'localização da contaminação no bloco: não existe no banco',
        'sala de maturação: sem vínculo entre galpão e sala cadastrada',
        'ranking de recorrência por pessoa: o responsável pela semeação só está anotado em parte dos lotes',
      ],
    },
    local: params.inicio ? local : null,
  });
}

function dadosSinteticosDoInvestigador(hoje: string) {
  const lotes: Array<Record<string, unknown>> = [];
  const eventos: Array<Record<string, unknown>> = [];
  const autoclaves: Array<Record<string, unknown>> = [];
  const eventosAtipicos: Array<Record<string, unknown>> = [];
  const somarDias = (iso: string, d: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + d * 86400000).toISOString().slice(0, 10);
  const cores = ['VERDE', 'LARANJA', 'VERDE', 'PRETA', null];
  const retiradaAposDias = [3, 8, 12, 15, 17, 19, 22, 26, 29, 33, 41, 14];
  const doGrupo = (i: number) => i % 4 === 3;
  for (let i = 0; i < 12; i += 1) {
    const dia = somarDias(hoje, -(30 + i * 4));
    const id = 9000 + i;
    lotes.push({
      id, data_lote: dia, tipo: i % 3 === 0 ? 'SB' : 'SH', galpao: i % 2 ? 'M2' : 'M1', estante_maturacao: String(4 + (i % 5)),
      blocos_produzidos: 200, blocos_abertos: 0, data_abertura: null, zerou_estante: null, status: 'ATIVO',
      data_encerramento: null, lote_pesquisa: null, nf_semente: i % 4 === 0 ? 'NF 20.460' : 'NF 20.520',
      responsavel_pesagem: i < 3 ? 'Pessoa P' : null,
      responsavel_semeacao: i < 9 ? 'Pessoa A' : 'Pessoa B', responsavel_conferencia: i % 2 ? 'Pessoa C' : null,
      responsavel_selagem: i % 2 ? 'Pessoa F' : 'Pessoa G', capela_ligada: !doGrupo(i),
    });
    eventos.push({
      lote_id: id, tipo: 'CONTAMINACAO', quantidade: 6 + (i % 5) * 4 + (doGrupo(i) ? 24 : 0),
      data_evento: somarDias(dia, retiradaAposDias[i]), tipo_contaminado: cores[i % 5], local_no_bloco: null,
    });
    if (i === 3) eventos.push({ lote_id: id, tipo: 'CONTAMINACAO', quantidade: 6, data_evento: somarDias(dia, 25), tipo_contaminado: 'LARANJA', local_no_bloco: null });
    if (i === 7) eventos.push({ lote_id: id, tipo: 'CONTAMINACAO', quantidade: 3, data_evento: somarDias(dia, -2), tipo_contaminado: 'VERDE', local_no_bloco: null });
    if (i < 9) {
      autoclaves.push({
        lote_id: id, ordem: 1, responsavel: i % 2 ? 'Pessoa D' : 'Pessoa E', entrada: `${dia}T08:30:00Z`, atingiu_121: `${dia}T09:00:00Z`,
        fim_2h: doGrupo(i) ? `${dia}T10:45:00Z` : `${dia}T11:05:00Z`, houve_queda_121: doGrupo(i), pressao_na_faixa: i !== 2,
      });
    }
  }
  const novo = somarDias(hoje, -8);
  lotes.push({
    id: 9020, data_lote: novo, tipo: 'SH', galpao: 'M1', estante_maturacao: '9', blocos_produzidos: 200, blocos_abertos: 0,
    data_abertura: null, zerou_estante: null, status: 'ATIVO', data_encerramento: null, lote_pesquisa: null, nf_semente: 'NF 20.520',
    responsavel_pesagem: null, responsavel_semeacao: 'Pessoa A', responsavel_conferencia: null, responsavel_selagem: 'Pessoa G', capela_ligada: true,
  });
  eventos.push({ lote_id: 9020, tipo: 'CONTAMINACAO', quantidade: 30, data_evento: somarDias(novo, 6), tipo_contaminado: 'VERDE', local_no_bloco: null });
  const semNumero = somarDias(hoje, -45);
  lotes.push({
    id: 9021, data_lote: semNumero, tipo: 'SP', galpao: 'M2', estante_maturacao: '3', blocos_produzidos: 0, blocos_abertos: 0,
    data_abertura: null, zerou_estante: null, status: 'ATIVO', data_encerramento: null, lote_pesquisa: null, nf_semente: null,
    responsavel_pesagem: null, responsavel_semeacao: null, responsavel_conferencia: null, responsavel_selagem: null, capela_ligada: null,
  });
  eventos.push({ lote_id: 9021, tipo: 'CONTAMINACAO', quantidade: 5, data_evento: somarDias(semNumero, 12), tipo_contaminado: 'VERDE', local_no_bloco: null });
  const evento = (lote_id: number, tipo: string, descricao: string | null = null) => ({
    id: 100 + eventosAtipicos.length, lote_id, tipo, descricao, observacao: null, hora_inicio: null, hora_retorno: null, created_at: null,
  });
  for (const i of [3, 7, 11]) eventosAtipicos.push(evento(9000 + i, 'OCORRENCIA_NA_AUTOCLAVE'));
  eventosAtipicos.push(evento(9003, 'FALTA_DE_ENERGIA'), evento(9004, 'COMPOSTO_MUITO_MOLHADO'), evento(9009, 'COMPOSTO_MUITO_MOLHADO'),
    evento(9000, 'OUTROS', 'Lote de teste do novo fornecedor'));
  return { lotes, eventos, colheitas: [], autoclaves, eventos_atipicos: eventosAtipicos };
}

export function investigadorContaminacao(params: Record<string, string>): Promise<InvestigadorContaminacaoResposta> {
  const hoje = params.hoje ?? hojeISO();
  const filtros = Object.fromEntries(Object.entries(params).filter(([k]) => !['hoje', 'inicio', 'fim'].includes(k)));
  return Promise.resolve(investigarContaminacao(dadosSinteticosDoInvestigador(hoje),
    { inicio: params.inicio, fim: params.fim, hoje, filtros }) as unknown as InvestigadorContaminacaoResposta);
}

export function cruzamentoDeLotes(params: Record<string, string>): Promise<CruzamentoDeLotesResposta> {
  const hoje = params.hoje ?? hojeISO();
  const chaves = (params.lotes ?? '').split(',').filter(Boolean);
  return Promise.resolve(cruzarLotes(dadosSinteticosDoInvestigador(hoje),
    { inicio: params.inicio, fim: params.fim, hoje, chaves }) as unknown as CruzamentoDeLotesResposta);
}

const CEPAS = [
  { id: 1, codigo: 'SH - CP10 CP12', tipo: 'Shiitake', ativo: true },
  { id: 2, codigo: 'SH CP20- LX', tipo: 'Shiitake', ativo: true },
  { id: 3, codigo: 'CP 30 - BR', tipo: 'Shimeji Branco', ativo: true },
  { id: 4, codigo: 'SP - CP40', tipo: 'Shimeji Preto', ativo: true },
  { id: 5, codigo: 'SP - CP45 SP/JP', tipo: 'Shimeji Preto', ativo: true },
  { id: 6, codigo: 'SH - ANTIGA (inativa)', tipo: 'Shiitake', ativo: false },
];
const sementesSacoStore: Record<string, number | null> = {
  Shiitake: 1000, 'Shimeji Branco': 1500, 'Shimeji Preto': null,
};
const comprasPrevistasStore: CompraPrevista[] = [
  { cepa_id: 1, cepa: 'SH - CP10 CP12', tipo_cogumelo: 'Shiitake', quantidade: 90 },
  { cepa_id: 2, cepa: 'SH CP20- LX', tipo_cogumelo: 'Shiitake', quantidade: 88 },
  { cepa_id: 3, cepa: 'CP 30 - BR', tipo_cogumelo: 'Shimeji Branco', quantidade: 68 },
  { cepa_id: 4, cepa: 'SP - CP40', tipo_cogumelo: 'Shimeji Preto', quantidade: 40 },
  { cepa_id: 5, cepa: 'SP - CP45 SP/JP', tipo_cogumelo: 'Shimeji Preto', quantidade: 40 },
];

const somaDias = (iso: string, dias: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
};

let seqMov = 200;
const movimentosStore: SementeMovimento[] = ([
  ['2026-05-06', '2026-05-04', 'ENTRADA', 'CP 30 - BR', '30117', '2026-05-02', 25],
  ['2026-05-20', null, 'ENTRADA', 'SH - CP10 CP12', '30164', '2026-05-15', 50],
  ['2026-05-20', null, 'ENTRADA', 'SH CP20- LX', '30164', '2026-05-18', 30],
  ['2026-05-20', null, 'ENTRADA', 'SP - CP40', '30164', '2026-05-16', 12],
  ['2026-05-22', null, 'SAIDA', 'SH - CP10 CP12', '30164', '2026-05-15', 14],
  ['2026-05-23', null, 'SAIDA', 'CP 30 - BR', '30117', '2026-05-02', 9],
  ['2026-05-26', null, 'SAIDA', 'SH CP20- LX', '30164', '2026-05-18', 11],
  ['2026-05-27', null, 'SAIDA', 'SH - CP10 CP12', '30164', '2026-05-15', 16],
  ['2026-05-29', 'AJUSTE', 'ENTRADA', 'CP 30 - BR', '30117', '2026-05-02', 3],
  ['2026-06-03', null, 'ENTRADA', 'SH - CP10 CP12', '30209', '2026-05-30', 35],
  ['2026-06-03', null, 'ENTRADA', 'SP - CP45 SP/JP', '30209', '2026-05-28', 10],
  ['2026-06-03', null, 'ENTRADA', 'SP - CP45 SP/JP', '30209', '2026-06-01', 4],
  ['2026-06-03', null, 'ENTRADA', 'CP 30 - BR', '30209', '2026-06-01', 18],
  ['2026-06-05', null, 'SAIDA', 'SP - CP40', '30164', '2026-05-16', 5],
  ['2026-06-06', null, 'SAIDA', 'SP - CP45 SP/JP', '30209', '2026-05-28', 6],
  ['2026-06-08', 'AJUSTE', 'SAIDA', 'SH CP20- LX', '30164', '2026-05-18', 2],
  ['2026-06-10', null, 'SAIDA', 'SH - CP10 CP12', '30164', '2026-05-15', 20],
  ['2026-06-12', null, 'SAIDA', 'CP 30 - BR', '30117', '2026-05-02', 19],
  ['2026-06-15', null, 'SAIDA', 'SH - CP10 CP12', '30209', '2026-05-30', 12],
  ['2026-06-17', null, 'SAIDA', 'CP 30 - BR', '30209', '2026-06-01', 7],
  ['2026-06-18', null, 'SAIDA', 'SP - CP40', '30164', '2026-05-16', 4],
  ['2026-06-19', null, 'SAIDA', 'SP - CP45 SP/JP', '30209', '2026-06-01', 4],
] as Array<[string, string | null, 'ENTRADA' | 'SAIDA', string, string, string, number]>).map(
  ([data, dataNf, tipo, cepa, nf, producao, qtd], i) => ({
    id: i + 1, data,
    data_nf: dataNf === 'AJUSTE' ? null : dataNf,
    ajuste: dataNf === 'AJUSTE',
    tipo, tipo_cogumelo: CEPAS.find((c) => c.codigo === cepa)?.tipo ?? '',
    cepa, cepa_id: CEPAS.find((c) => c.codigo === cepa)?.id ?? 0,
    nf, data_producao: producao, validade: somaDias(producao, 30),
    quantidade: qtd,
  }),
);

export function sementesMovimentos(): Promise<SementeMovimento[]> {
  return Promise.resolve(movimentosStore.map((m) => ({ ...m })));
}

export function sementesCepas(): Promise<SementeCepa[]> {
  return Promise.resolve(CEPAS.map((c) => ({
    id: c.id, codigo: c.codigo, tipo_cogumelo: c.tipo, ativo: c.ativo,
  })));
}

export function sementesRegistrarMovimento(body: {
  data: string; data_nf?: string; ajuste?: boolean; tipo: 'ENTRADA' | 'SAIDA';
  cepa_id?: number; cepa?: string; nf?: string; data_producao?: string; quantidade: number;
}): Promise<SementeMovimento> {
  const achada = body.cepa_id != null
    ? CEPAS.find((c) => c.id === body.cepa_id)
    : CEPAS.find((c) => c.codigo === body.cepa);
  if (!achada) {
    return Promise.reject(new Error(body.cepa_id != null
      ? `Cepa ${body.cepa_id} não encontrada.`
      : `Cepa "${body.cepa ?? ''}" não encontrada.`));
  }
  const novo: SementeMovimento = {
    id: (seqMov += 1), data: body.data,
    data_nf: body.ajuste ? null : (body.data_nf ?? null),
    ajuste: body.ajuste ?? false, tipo: body.tipo,
    tipo_cogumelo: achada.tipo,
    cepa: achada.codigo,
    cepa_id: achada.id,
    nf: body.nf ?? null,
    data_producao: body.data_producao ?? null,
    validade: body.data_producao ? somaDias(body.data_producao, 30) : null,
    quantidade: body.quantidade,
  };
  movimentosStore.push(novo);
  return Promise.resolve({ ...novo });
}

export function sementesAtualizarMovimento(id: number, body: {
  data?: string; data_nf?: string | null; ajuste?: boolean;
  tipo?: 'ENTRADA' | 'SAIDA'; cepa?: string; cepa_id?: number; nf?: string | null;
  data_producao?: string; quantidade?: number;
}): Promise<SementeMovimento> {
  const m = movimentosStore.find((x) => x.id === id);
  if (!m) return Promise.reject(new Error('Movimento não encontrado.'));
  if (body.data !== undefined) m.data = body.data;
  if (body.tipo !== undefined) m.tipo = body.tipo;
  if (body.cepa_id !== undefined) {
    const c = CEPAS.find((x) => x.id === body.cepa_id);
    if (!c) return Promise.reject(new Error(`Cepa ${body.cepa_id} não encontrada.`));
    m.cepa_id = c.id;
    m.cepa = c.codigo;
    m.tipo_cogumelo = c.tipo;
  } else if (body.cepa !== undefined) {
    const c = CEPAS.find((x) => x.codigo === body.cepa);
    if (!c) return Promise.reject(new Error(`Cepa "${body.cepa}" não encontrada.`));
    m.cepa = body.cepa;
    m.cepa_id = c.id;
    m.tipo_cogumelo = c.tipo;
  }
  if (body.nf !== undefined) m.nf = body.nf;
  if (body.quantidade !== undefined) m.quantidade = body.quantidade;
  if (body.ajuste !== undefined || body.data_nf !== undefined) {
    const ajuste = body.ajuste ?? m.ajuste;
    m.ajuste = ajuste;
    m.data_nf = ajuste ? null : (body.data_nf ?? m.data_nf);
  }
  if (body.data_producao !== undefined) {
    m.data_producao = body.data_producao;
    m.validade = body.data_producao ? somaDias(body.data_producao, 30) : null;
  }
  return Promise.resolve({ ...m });
}

export function sementesExcluirMovimento(id: number): Promise<{ id: number }> {
  const i = movimentosStore.findIndex((x) => x.id === id);
  if (i < 0) return Promise.reject(new Error('Movimento não encontrado.'));
  movimentosStore.splice(i, 1);
  return Promise.resolve({ id });
}

function saldosSementes() {
  const mapa = new Map<string, { cepa: string; nf: string; validade: string; saldo: number }>();
  for (const m of movimentosStore) {
    if (!m.validade || !m.nf) continue;
    const chave = `${m.cepa}|${m.nf}|${m.validade}`;
    const item = mapa.get(chave) ?? { cepa: m.cepa, nf: m.nf, validade: m.validade, saldo: 0 };
    item.saldo += m.tipo === 'ENTRADA' ? m.quantidade : -m.quantidade;
    mapa.set(chave, item);
  }
  return [...mapa.values()];
}

export function sementesEstoque(): Promise<SementesEstoqueResposta> {
  const saldos = saldosSementes();
  const validades = [...new Set(saldos.map((s) => s.validade))].sort();
  const vazio = () => Object.fromEntries(validades.map((v) => [v, null])) as Record<string, number | null>;

  const cepas = CEPAS.filter((c) => saldos.some((s) => s.cepa === c.codigo)).map((c) => {
    const doCepa = saldos.filter((s) => s.cepa === c.codigo);
    const valores = vazio();
    for (const s of doCepa) valores[s.validade] = (valores[s.validade] ?? 0) + s.saldo;
    const nfs = [...new Set(doCepa.map((s) => s.nf))].sort().map((nf) => {
      const doNf = doCepa.filter((s) => s.nf === nf);
      const vNf = vazio();
      for (const s of doNf) vNf[s.validade] = (vNf[s.validade] ?? 0) + s.saldo;
      return { nf, valores: vNf, total: doNf.reduce((t, s) => t + s.saldo, 0) };
    });
    return {
      cepa: c.codigo, tipo_cogumelo: c.tipo, valores,
      total: doCepa.reduce((t, s) => t + s.saldo, 0), nfs,
    };
  });

  const totalValores = vazio();
  for (const s of saldos) totalValores[s.validade] = (totalValores[s.validade] ?? 0) + s.saldo;

  const proximas: SementesEstoqueResposta['proximas'] = [];
  for (const tipo of ['Shiitake', 'Shimeji Branco', 'Shimeji Preto']) {
    const comSaldo = saldos
      .filter((s) => CEPAS.find((c) => c.codigo === s.cepa)?.tipo === tipo && s.saldo > 0)
      .sort((a, b) => a.validade.localeCompare(b.validade));
    if (comSaldo.length) proximas.push({ tipo_cogumelo: tipo, cepa: comSaldo[0].cepa, validade: comSaldo[0].validade });
  }

  const hoje = hojeISO();
  const diasParaVencer = (validade: string) =>
    Math.round((Date.parse(`${validade}T00:00:00Z`) - Date.parse(`${hoje}T00:00:00Z`)) / 86400000);
  const a_separar: SementesEstoqueResposta['a_separar'] = saldos
    .filter((s) => s.saldo > 0)
    .map((s) => ({
      tipo_cogumelo: CEPAS.find((c) => c.codigo === s.cepa)?.tipo ?? null,
      cepa: s.cepa, nf: s.nf, validade: s.validade, saldo: s.saldo,
      dias_para_vencer: diasParaVencer(s.validade),
    }))
    .sort((a, b) => a.validade.localeCompare(b.validade) || a.cepa.localeCompare(b.cepa));

  return Promise.resolve({
    validades, cepas,
    total_geral: { valores: totalValores, total: saldos.reduce((t, s) => t + s.saldo, 0) },
    proximas,
    a_separar,
  });
}

export function sementesPutParametros(body: { tipo_cogumelo: string; gramas_por_saco: number | null }): Promise<{ ok: true }> {
  sementesSacoStore[body.tipo_cogumelo] = body.gramas_por_saco;
  return Promise.resolve({ ok: true });
}

export function sementesNecessidade(): Promise<NecessidadeDeSementesResposta> {
  return Promise.resolve(contaSementesDemo());
}

export function sementesComprasPrevistas(): Promise<CompraPrevista[]> {
  return Promise.resolve(comprasPrevistasStore.map((c) => ({ ...c })));
}

export function sementesPutComprasPrevistas(itens: Array<{ cepa_id: number; quantidade: number; observacao?: string }>): Promise<{ ok: true }> {
  for (const item of itens) {
    const existente = comprasPrevistasStore.find((c) => c.cepa_id === item.cepa_id);
    if (existente) { existente.quantidade = item.quantidade; existente.observacao = item.observacao ?? null; }
  }
  return Promise.resolve({ ok: true });
}

const receitasAntigasStore: ReceitaAntiga[] = ([
  [1, 'SH base trigo', 'SH', 'Tr + Calc', 'Serragem 70 kg, Farelo de trigo 18 kg, Calcário 1,5 kg, Gesso 1 kg', 'PADRAO', null],
  [2, 'SP arroz', 'SP', 'Arroz', 'Serragem 72 kg, Farelo de arroz 20 kg, Calcário 1 kg', 'PADRAO', 'a partir de 12/05'],
  [3, 'SP arroz e soja', 'SP', 'Arroz + So', 'Serragem 70 kg, Farelo de arroz 15 kg, Farelo de soja 4 kg, Gesso 1,2 kg', 'FORNECEDOR', null],
  [4, 'SP trigo', 'SP', 'Tr', 'Serragem 74 kg, Farelo de trigo 16 kg, Calcário 1,2 kg, Gesso 1 kg', 'PROPRIA', null],
  [5, 'SB trigo e arroz', 'SB', 'Tr + Arroz', 'Serragem 71 kg, Farelo de trigo 8 kg, Farelo de arroz 10 kg, Gesso 1,4 kg', 'PADRAO', 'a partir de 03/02'],
  [7, 'SP completa', 'SP', 'Tr + Mi + So', 'Serragem 69 kg, Farelo de trigo 10 kg, Milho moído 4 kg, Farelo de soja 3 kg, Calcário 0,8 kg', 'FORNECEDOR', null],
  [9, 'SH sem aditivo', 'SH', 'S/ ADITIVO', 'Sem aditivo', null, null],
  [10, 'SB milho', 'SB', 'Mi', 'Serragem 73 kg, Milho moído 12 kg, Calcário 1 kg, Gesso 1,5 kg', null, null],
] as Array<[number, string, string, string, string, string | null, string | null]>).map(
  ([ordem, nome, tipo, base, descricao, modelo, start]) => ({ ordem, nome, tipo, base, descricao, modelo, start_obs: start }),
);

export function receitasAntigas(): Promise<ReceitaAntiga[]> {
  return Promise.resolve(receitasAntigasStore.map((r) => ({ ...r })));
}

let seqLotePesq = 100;
const lotesPesquisaStore: LotePesquisa[] = ([
  ['09/mar', 'SH', 'CP10'], ['14/mar', 'SH', 'CP10 / S ADITIVO'],
  ['02/04/2026', 'SH', 'CP20'], ['08/04/2026', 'SH', 'CP10 / S ADITIVO'],
  ['21/05/2026', 'SB', 'CP 30'], ['04/jun', 'SH', 'CP20 / S ADITIVO'],
] as Array<[string, string, string]>).map(([lote, tipo, base], i) => ({
  id: i + 1, lote_label: lote, tipo, base,
}));

export function lotesPesquisa(): Promise<LotePesquisa[]> {
  return Promise.resolve(lotesPesquisaStore.map((l) => ({ ...l })));
}
export function lotesPesquisaCriar(body: Omit<LotePesquisa, 'id'>): Promise<LotePesquisa> {
  const novo = { id: (seqLotePesq += 1), ...body };
  lotesPesquisaStore.push(novo);
  return Promise.resolve({ ...novo });
}
export function lotesPesquisaExcluir(id: number): Promise<{ ok: true }> {
  const idx = lotesPesquisaStore.findIndex((x) => x.id === id);
  if (idx >= 0) lotesPesquisaStore.splice(idx, 1);
  return Promise.resolve({ ok: true });
}

const receitasSubstratoStore: ReceitaSubstrato[] = [
  {
    id: 1, nome: 'Shiitake - Padrão', versao: 3, produto_id: 1, produto_nome: 'Shiitake',
    status: 'PADRAO', ativa: true, vigente_desde: '2025-11-15', motivo_ajuste: null, receita_base_id: null,
  },
  {
    id: 2, nome: 'Shiitake - Receita Antiga', versao: 2, produto_id: 1, produto_nome: 'Shiitake',
    status: 'TESTE', ativa: false, vigente_desde: '2025-03-19', motivo_ajuste: 'Substituída pela v3', receita_base_id: 1,
  },
  {
    id: 3, nome: 'Shiitake - Inativa 2024', versao: 1, produto_id: 1, produto_nome: 'Shiitake',
    status: 'INATIVA', ativa: false, vigente_desde: '2023-10-10', motivo_ajuste: 'Descontinuada', receita_base_id: null,
  },
  {
    id: 4, nome: 'Shimeji Preto - Padrão (2kg)', versao: 2, produto_id: 2, produto_nome: 'Shimeji Preto',
    status: 'PADRAO', ativa: true, vigente_desde: '2025-12-11', motivo_ajuste: null, receita_base_id: null,
  },
  {
    id: 10, nome: 'Shimeji Preto - Padrão (1kg)', versao: 3, produto_id: 2, produto_nome: 'Shimeji Preto',
    status: 'PADRAO', ativa: true, vigente_desde: '2026-07-14', motivo_ajuste: 'Novo formato de bandeja', receita_base_id: 4,
  },
  {
    id: 5, nome: 'Shimeji Preto - Inativa', versao: 1, produto_id: 2, produto_nome: 'Shimeji Preto',
    status: 'INATIVA', ativa: false, vigente_desde: '2024-08-22', motivo_ajuste: null, receita_base_id: null,
  },
  {
    id: 6, nome: 'Shimeji Branco - Padrão', versao: 1, produto_id: 3, produto_nome: 'Shimeji Branco',
    status: 'PADRAO', ativa: true, vigente_desde: '2026-01-31', motivo_ajuste: null, receita_base_id: null,
  },
  {
    id: 7, nome: 'Shimeji Branco - Inativa', versao: 1, produto_id: 3, produto_nome: 'Shimeji Branco',
    status: 'INATIVA', ativa: false, vigente_desde: '2023-02-05', motivo_ajuste: 'Fórmula descartada', receita_base_id: null,
  },
  {
    id: 8, nome: 'Shiitake - Em avaliação', versao: 1, produto_id: 1, produto_nome: 'Shiitake',
    status: null, ativa: true, vigente_desde: '2026-07-05', motivo_ajuste: null, receita_base_id: 1,
  },
  {
    id: 9, nome: 'Shiitake - Formulação em teste', versao: 4, produto_id: 1, produto_nome: 'Shiitake',
    status: 'TESTE', ativa: true, vigente_desde: '2026-07-25', motivo_ajuste: 'Ensaio de proporção', receita_base_id: 1,
  },
];

export function receitasSubstrato(): Promise<ReceitaSubstrato[]> {
  return Promise.resolve(receitasSubstratoStore.map((r) => ({ ...r })));
}
export function receitasSubstratoAtualizar(
  id: number,
  body: Partial<Pick<ReceitaSubstrato, 'nome' | 'status' | 'vigente_desde' | 'ativa'>>,
): Promise<ReceitaSubstrato> {
  const r = receitasSubstratoStore.find((x) => x.id === id);
  if (r) Object.assign(r, body);
  return Promise.resolve({ ...(r as ReceitaSubstrato) });
}

const receitaIngredientesStore: Record<number, ReceitaVigenteIngrediente[]> = {
  1: [
    { quantidade_por_bloco: 0.8, observacao: null, materias_primas: { id: 1, codigo: 'SERRAGEM', nome: 'Serragem', unidade_medida: 'kg' } },
    { quantidade_por_bloco: 0.15, observacao: 'Peneirado', materias_primas: { id: 2, codigo: 'FARELO_TRIGO', nome: 'Farelo de Trigo', unidade_medida: 'kg' } },
  ],
  3: [
    { quantidade_por_bloco: 0.82, observacao: null, materias_primas: { id: 1, codigo: 'SERRAGEM', nome: 'Serragem', unidade_medida: 'kg' } },
    { quantidade_por_bloco: 0.14, observacao: null, materias_primas: { id: 2, codigo: 'FARELO_TRIGO', nome: 'Farelo de Trigo', unidade_medida: 'kg' } },
    { quantidade_por_bloco: 0.03, observacao: 'Fórmula de 2024', materias_primas: { id: 6, codigo: 'GESSO', nome: 'Gesso', unidade_medida: 'kg' } },
    { quantidade_por_bloco: 0.01, observacao: null, materias_primas: { id: 4, codigo: 'PAINCO', nome: 'Painço', unidade_medida: 'kg' } },
  ],
  6: [
    { quantidade_por_bloco: 0.8, observacao: null, materias_primas: { id: 1, codigo: 'SERRAGEM', nome: 'Serragem', unidade_medida: 'kg' } },
    { quantidade_por_bloco: 0.1, observacao: null, materias_primas: { id: 6, codigo: 'GESSO', nome: 'Gesso', unidade_medida: 'kg' } },
  ],
  10: [
    { quantidade_por_bloco: 0.75, observacao: null, materias_primas: { id: 1, codigo: 'SERRAGEM', nome: 'Serragem', unidade_medida: 'kg' } },
    { quantidade_por_bloco: 0.2, observacao: 'Formato novo de bandeja', materias_primas: { id: 4, codigo: 'PAINCO', nome: 'Painço', unidade_medida: 'kg' } },
  ],
};

let seqReceitaSubstrato = 10;

export function criarVersaoReceita(body: CriarVersaoReceitaBody): Promise<VersaoReceitaCriada> {
  const doProduto = receitasSubstratoStore.filter((r) => r.produto_id === body.produtoId);
  const maiorVersao = doProduto.reduce((max, r) => (r.versao > max ? r.versao : max), 0);
  const produtoNome = doProduto[0]?.produto_nome ?? null;
  const nova: ReceitaSubstrato = {
    id: (seqReceitaSubstrato += 1),
    nome: body.nome,
    versao: maiorVersao + 1,
    produto_id: body.produtoId,
    produto_nome: produtoNome,
    status: 'TESTE',
    ativa: false,
    vigente_desde: new Date().toISOString().slice(0, 10),
    motivo_ajuste: body.motivoAjuste ?? null,
    receita_base_id: null,
  };
  receitasSubstratoStore.push(nova);
  return Promise.resolve({ id: nova.id, nome: nova.nome, versao: nova.versao });
}

export function getReceitaVigente(produtoId: number): Promise<ReceitaVigente | null> {
  const elegivel = (r: ReceitaSubstrato) => r.ativa === true && (r.status == null || r.status === 'PADRAO');
  const eleita = receitasSubstratoStore
    .filter((r) => r.produto_id === produtoId && elegivel(r))
    .reduce<ReceitaSubstrato | null>((max, r) => (!max || r.versao > max.versao ? r : max), null);
  if (!eleita) return Promise.resolve(null);
  return Promise.resolve({
    id: eleita.id,
    nome: eleita.nome,
    versao: eleita.versao,
    motivo_ajuste: eleita.motivo_ajuste,
    vigente_desde: eleita.vigente_desde,
    receita_base_id: eleita.receita_base_id,
    receita_ingredientes: (receitaIngredientesStore[eleita.id] ?? [])
      .map((i) => ({ ...i, materias_primas: { ...i.materias_primas } })),
  });
}

const blocosPorReceitaDemo: Record<number, number> = { 1: 90, 6: 60, 10: 48 };

export function composicaoDasReceitas(): Promise<ComposicaoDeReceita[]> {
  return Promise.resolve(receitasSubstratoStore.map((r) => ({
    receita_id: r.id,
    blocos_por_receita: blocosPorReceitaDemo[r.id] ?? null,
    ingredientes: (receitaIngredientesStore[r.id] ?? []).map((i) => ({
      materia_prima_id: i.materias_primas.id,
      nome: i.materias_primas.nome,
      unidade: i.materias_primas.unidade_medida,
      quantidade_por_bloco: i.quantidade_por_bloco,
      observacao: i.observacao,
    })),
  })));
}

const regrasMaturacaoStore: RegraMaturacao[] = [
  { id: 1, galpao_codigo: 'A', dias: 90, vigente_desde: '2025-10-16', observacao: 'Maturação 1' },
  { id: 2, galpao_codigo: 'B', dias: 30, vigente_desde: '2025-10-16', observacao: 'Maturação 2' },
  { id: 3, galpao_codigo: 'N', dias: 90, vigente_desde: '2025-10-16', observacao: 'Maturação 3' },
  { id: 4, galpao_codigo: 'M3', dias: 90, vigente_desde: '2025-10-16', observacao: 'Maturação 4' },
];

export function regrasMaturacao(): Promise<RegraMaturacao[]> {
  return Promise.resolve(regrasMaturacaoStore.map((r) => ({ ...r })));
}

const NOME_DA_ESPECIE_DEMO: Record<string, string> = {
  SH: 'Shiitake', SB: 'Shimeji Branco', SP: 'Shimeji Preto', SS: 'Shimeji Salmão',
};
let seqRegraEspecie = 4;
const regrasEspecieStore: RegraMaturacaoEspecie[] = [
  { id: 1, tipo_cogumelo: 'SH', dias: 90, vigente_desde: '2025-10-16', observacao: 'Prazo padrão da espécie' },
  { id: 2, tipo_cogumelo: 'SB', dias: 30, vigente_desde: '2025-10-16', observacao: 'Prazo padrão da espécie' },
  { id: 3, tipo_cogumelo: 'SP', dias: 30, vigente_desde: '2025-10-16', observacao: 'Prazo padrão da espécie' },
  { id: 4, tipo_cogumelo: 'SS', dias: 30, vigente_desde: '2025-10-16', observacao: 'Prazo padrão da espécie' },
];

export function regrasMaturacaoEspecie(): Promise<RegraMaturacaoEspecie[]> {
  return Promise.resolve(regrasEspecieStore.map((r) => ({ ...r })));
}

export function regrasMaturacaoEspecieCriar(body: {
  tipoCogumelo: string; dias: number; vigenteDesde: string; observacao?: string;
}): Promise<RegraMaturacaoEspecie> {
  const diasNum = Number(body.dias);
  if (!Number.isInteger(diasNum) || diasNum <= 0) {
    return Promise.reject(erroHttp(400,
      `dias deve ser um número inteiro maior que zero (recebido: ${body.dias}).`));
  }
  const tipo = body.tipoCogumelo.trim().toUpperCase();
  if (!Object.prototype.hasOwnProperty.call(NOME_DA_ESPECIE_DEMO, tipo)) {
    return Promise.reject(erroHttp(400, 'Espécie inválida: use SH, SB, SP ou SS.'));
  }
  if (body.vigenteDesde < hojeISO()) {
    return Promise.reject(erroHttp(400, 'vigente_desde inválido: a regra vale a partir de hoje ou de uma data futura. '
      + 'Uma data no passado mudaria o prazo de lotes já guardados.'));
  }
  if (regrasEspecieStore.some((r) => r.tipo_cogumelo === tipo && r.vigente_desde === body.vigenteDesde)) {
    return Promise.reject(erroHttp(400,
      `Regra inválida: já existe uma regra de ${NOME_DA_ESPECIE_DEMO[tipo]} com vigência em ${dataBr(body.vigenteDesde)}. `
      + 'Regras não se editam: cadastre uma nova a partir de outra data.'));
  }
  const nova: RegraMaturacaoEspecie = {
    id: (seqRegraEspecie += 1),
    tipo_cogumelo: tipo,
    dias: diasNum,
    vigente_desde: body.vigenteDesde,
    observacao: body.observacao?.trim() || null,
  };
  regrasEspecieStore.push(nova);
  return Promise.resolve({ ...nova });
}

const galpaoDaDemo = (g: string) => g.split(', ')
  .map((c) => galpaoDoCaderno(c, salasDaCapacidade.find((s) => s.galpao_codigo === c)?.nome)).join(', ');

const salasDaCapacidade: SalaComEtapa[] = [
  { id: 6, nome: 'Maturação 1', ordem: 1, galpao_codigo: 'A', etapa: 'MATURACAO', ativa: true, num_estantes: 64, capacidade_blocos: 12600 },
  { id: 4, nome: 'Maturação 2', ordem: 2, galpao_codigo: 'B', etapa: 'MATURACAO', ativa: true, num_estantes: 22, capacidade_blocos: 4400 },
  { id: 5, nome: 'Maturação 3', ordem: 3, galpao_codigo: 'N', etapa: 'MATURACAO', ativa: true, num_estantes: 40, capacidade_blocos: 11200 },
  { id: 7, nome: 'Maturação 4', ordem: 4, galpao_codigo: 'M3', etapa: 'MATURACAO', ativa: true, num_estantes: 12, capacidade_blocos: 2480 },
  { id: 1, nome: 'Frutificação 1', ordem: 5, galpao_codigo: 'F1', etapa: 'FRUTIFICACAO', ativa: true, num_estantes: 5, capacidade_blocos: 810 },
  { id: 2, nome: 'Frutificação 2', ordem: 6, galpao_codigo: 'F2', etapa: 'FRUTIFICACAO', ativa: true, num_estantes: 5, capacidade_blocos: 810 },
  { id: 3, nome: 'Frutificação 3', ordem: 7, galpao_codigo: 'F3', etapa: 'FRUTIFICACAO', ativa: true, num_estantes: 5, capacidade_blocos: 810 },
  { id: 8, nome: 'Frutificação 4', ordem: 8, galpao_codigo: 'F4', etapa: 'FRUTIFICACAO', ativa: false, num_estantes: 5, capacidade_blocos: 810 },
  { id: 9, nome: 'Frutificação 5', ordem: 9, galpao_codigo: 'F5', etapa: 'FRUTIFICACAO', ativa: true, num_estantes: 8, capacidade_blocos: 1280 },
];
const salasDeFrutificacaoAtivas = () => salasDaCapacidade.filter((s) => s.etapa === 'FRUTIFICACAO' && s.ativa);

export function producaoSalas(): Promise<{ salas: SalaComEtapa[] }> {
  return Promise.resolve({ salas: salasDaCapacidade.map((s) => ({ ...s })) });
}

type EstanteDemo = { sala_id: number; etiqueta: string; capacidade_blocos: number; status: 'ATIVA' | 'INATIVA' };
const faixaDeEstantes = (galpao: string, de: number, ate: number, capacidade: (n: number) => number): EstanteDemo[] => {
  const sala = salasDaCapacidade.find((s) => s.galpao_codigo === galpao) as SalaComEtapa;
  return Array.from({ length: ate - de + 1 }, (_, i) => de + i).map((n) => ({
    sala_id: sala.id, etiqueta: String(n), capacidade_blocos: capacidade(n), status: sala.ativa ? 'ATIVA' : 'INATIVA',
  }));
};
const estantesStore: EstanteDemo[] = [
  ...faixaDeEstantes('A', 1, 64, (n) => (n === 19 || n === 20 ? 100 : 200)),
  ...faixaDeEstantes('B', 34, 55, () => 200),
  ...faixaDeEstantes('N', 1, 40, () => 280),
  ...faixaDeEstantes('M3', 1, 12, (n) => (n <= 8 ? 200 : 220)),
  ...['F1', 'F2', 'F3', 'F4'].flatMap((f) => faixaDeEstantes(f, 1, 5, (n) => (n <= 2 ? 150 : 170))),
  ...faixaDeEstantes('F5', 1, 8, () => 160),
];

let seqLiberacao = 0;
const liberacoesStore: Array<Liberacao & { sala_id: number }> = [];

export function producaoRegistrarLiberacao(body: {
  sala: string; estante: string; data: string; observacao?: string;
}): Promise<Liberacao> {
  const codigo = body.sala?.trim().toUpperCase() || null;
  const etiqueta = body.estante?.trim() || null;
  if (body.data > hojeISO()) return Promise.reject(erroHttp(400, 'A data da liberação não pode ser futura.'));
  const ativas = salasDeFrutificacaoAtivas();
  const sala = codigo ? ativas.find((s) => s.galpao_codigo === codigo) : undefined;
  if (!sala) return Promise.reject(erroHttp(400, `Sala "${codigo ?? ''}" não é uma sala de frutificação ativa (aceitas: ${ativas.map((s) => s.galpao_codigo).join(', ')}).`));
  if (etiqueta == null) return Promise.reject(erroHttp(400, 'Informe a estante liberada.'));
  const estante = estantesStore.find((e) => e.sala_id === sala.id && e.etiqueta === etiqueta);
  if (!estante) return Promise.reject(erroHttp(400, `A estante ${etiqueta} não existe no cadastro da ${sala.nome} (${sala.galpao_codigo}).`));
  if (estante.status !== 'ATIVA') return Promise.reject(erroHttp(400, `A estante ${etiqueta} da ${sala.nome} está ${estante.status}; não há o que liberar.`));
  const linha = {
    id: (seqLiberacao += 1), sala_id: sala.id, sala: sala.galpao_codigo, estante: etiqueta, data: body.data,
    observacao: body.observacao?.trim() || null, created_at: new Date().toISOString(),
  };
  liberacoesStore.push(linha);
  return Promise.resolve({ ...linha });
}

export function producaoListarLiberacoes(sala?: string): Promise<{ liberacoes: Liberacao[] }> {
  const codigo = sala?.trim().toUpperCase() || null;
  const daSala = codigo ? salasDaCapacidade.find((s) => s.etapa === 'FRUTIFICACAO' && s.galpao_codigo === codigo) : null;
  if (codigo && !daSala) return Promise.reject(erroHttp(400, `Sala "${codigo}" não existe.`));
  const linhas = liberacoesStore
    .filter((l) => (daSala ? l.sala_id === daSala.id : true))
    .sort((a, b) => b.data.localeCompare(a.data) || b.id - a.id)
    .map((l) => ({ ...l }));
  return Promise.resolve({ liberacoes: linhas });
}

let seqPessoa = 4;
const pessoasStore: Pessoa[] = ['Rosa', 'Tânia', 'Bruna', 'Cida']
  .map((nome, i) => ({ id: i + 1, nome, ativa: true }));

export function producaoListarPessoas(): Promise<Pessoa[]> {
  return Promise.resolve(
    pessoasStore.filter((p) => p.ativa).map((p) => ({ ...p })).sort((a, b) => a.nome.localeCompare(b.nome)),
  );
}

export function producaoCriarPessoa(nome: string): Promise<{ id: number; nome: string }> {
  const limpo = nome?.trim();
  if (!limpo) return Promise.reject(erroHttp(400, 'Informe o nome da pessoa.'));
  const existente = pessoasStore.find((p) => p.nome === limpo);
  if (existente) return Promise.resolve({ id: existente.id, nome: existente.nome });
  const p = { id: (seqPessoa += 1), nome: limpo, ativa: true };
  pessoasStore.push(p);
  return Promise.resolve({ id: p.id, nome: p.nome });
}

let seqDivergencia = 0;
const divergenciasStore: Divergencia[] = [];
const TIPOS_DIVERGENCIA = ['ABERTURA', 'RETIRADA', 'GUARDA'];

export function producaoRegistrarDivergencia(body: {
  lote_id: number; tipo: 'ABERTURA' | 'RETIRADA' | 'GUARDA'; data: string;
  esperado?: number; informado: number; responsavel?: string; observacao?: string;
}): Promise<Divergencia> {
  if (!TIPOS_DIVERGENCIA.includes(body.tipo)) {
    return Promise.reject(erroHttp(400, `tipo deve ser um de: ${TIPOS_DIVERGENCIA.join(', ')}.`));
  }
  if (body.data > hojeISO()) return Promise.reject(erroHttp(400, 'A data da divergência não pode ser futura.'));
  const linhaLote = jornadaStore.find((l) => l.lote_id === body.lote_id);
  const codigo = linhaLote
    ? baseDoCodigoDoLote({
      dataLote: linhaLote.data_lote, tipo: linhaLote.tipo, galpao: linhaLote.galpao, estante: linhaLote.estante_maturacao,
    })
    : null;
  const linha: Divergencia = {
    id: (seqDivergencia += 1), lote_id: body.lote_id, codigo, tipo: body.tipo, data: body.data,
    esperado: body.esperado ?? null, informado: body.informado,
    responsavel: body.responsavel?.trim() || null, observacao: body.observacao?.trim() || null,
    resolvida_em: null,
  };
  divergenciasStore.push(linha);
  return Promise.resolve({ ...linha });
}

export function producaoListarDivergencias(abertas?: boolean): Promise<{ divergencias: Divergencia[] }> {
  const linhas = divergenciasStore
    .filter((d) => (abertas ? d.resolvida_em == null : true))
    .sort((a, b) => b.id - a.id)
    .map((d) => ({ ...d }));
  return Promise.resolve({ divergencias: linhas });
}

export function producaoResolverDivergencia(id: number): Promise<Divergencia> {
  const linha = divergenciasStore.find((d) => d.id === id);
  if (!linha) return Promise.reject(erroHttp(404, `Divergência ${id} não encontrada.`));
  linha.resolvida_em = new Date().toISOString();
  return Promise.resolve({ ...linha });
}

const quadroDeCapacidade = capacidadeLivre as unknown as (dados: {
  salas: SalaComEtapa[]; estantes: EstanteDemo[]; lotes: object[]; eventos: object[];
  transferencias: AberturaDemo[]; liberacoes: Array<Liberacao & { sala_id: number }>; quadro: object;
}) => CapacidadeLivre;
function capacidadeDemo(): CapacidadeLivre {
  const primeiras = new Map<number, JornadaLinha>();
  for (const l of jornadaStore) if (!primeiras.has(l.lote_id)) primeiras.set(l.lote_id, l);
  const lotes = [...primeiras.values()].map((l) => ({
    id: l.lote_id, codigo: codigoDoLote(l), galpao: l.galpao, estante_maturacao: l.estante_maturacao,
    blocos_produzidos: l.blocos_produzidos, blocos_abertos: l.blocos_abertos, status: l.status,
  }));
  const eventos = [...primeiras.values()]
    .filter((l) => l.blocos_contaminados > 0)
    .map((l) => ({ lote_id: l.lote_id, tipo: 'CONTAMINACAO', quantidade: l.blocos_contaminados }));
  return quadroDeCapacidade({
    salas: salasDaCapacidade, estantes: estantesStore, lotes, eventos, transferencias: aberturasStore, liberacoes: liberacoesStore,
    quadro: quadroDasEstantes({ salas: salasDaCapacidade, estantes: estantesStore }, linhasDaFilaDemo()),
  });
}

const quadroDePendencias = pendenciasDeLancamento as unknown as (dados: {
  lotes: object[]; autoclaves: object[]; transferencias: object[]; divergencias: object[];
  embalagem?: {
    registros: object[]; inicio: string; diasParaFechar: number; diasComColheita?: string[]; dispensados?: string[];
  } | null;
  eventos?: object[];
  retiradas?: { alertas: object[]; verificados: { get(chave: string): { blocos: number } | undefined } | null; inicio: string } | null;
  salas?: object[];
}, opcoes: { hoje: string }) => PendenciasDeLancamento;

const transferenciasDemoSemSala: Array<{ id: number; lote_id: number; tipo: 'ABERTURA'; data: string; estante_origem: string; estante_destino: string; sala_destino: string | null; quantidade: number }> = [
  { id: 900901, lote_id: 900002, tipo: 'ABERTURA', data: '2026-09-03', estante_origem: '12', estante_destino: '3', sala_destino: null, quantidade: 50 },
];
export async function producaoDefinirSalaDaAbertura(transferenciaId: number, sala_destino: string) {
  const t = transferenciasDemoSemSala.find((x) => x.id === transferenciaId);
  if (!t) throw Object.assign(new Error(`Abertura ${transferenciaId} não encontrada.`), { response: { status: 404, data: { erro: `Abertura ${transferenciaId} não encontrada.` } } });
  t.sala_destino = sala_destino.toUpperCase();
  return { ...t, observacao: null, registrado_por: null };
}

const diasSemColheitaDemo = new Set<string>();
export async function producaoMarcarDiaSemColheita(data: string): Promise<DiaSemColheita> {
  const ja = diasSemColheitaDemo.has(data);
  diasSemColheitaDemo.add(data);
  return { data, marcado_em: new Date().toISOString(), ja_marcado: ja };
}

const diaMarcadoSemColheitaDemo = (data: string) =>
  data === somaDias(HOJE_PAINEL_DEMO, -3) || diasSemColheitaDemo.has(data);

function recusaSeDiaSemColheita(data: string | undefined, permitir?: boolean) {
  if (!data || permitir || !diaMarcadoSemColheitaDemo(data)) return null;
  const erro = `O dia ${data.slice(8, 10)}/${data.slice(5, 7)} está marcado como "Não houve colheita". Confirma a data da colheita?`;
  return Object.assign(new Error(erro), { response: { status: 409, data: { erro, codigo: 'DIA_SEM_COLHEITA' } } });
}

const verificadosDeRetiradaDemo = new Map<string, { por: string; em: string; blocos: number }>();
const retiradaDemo = (data: string) => ({
  lote_id: 900002, galpao: 'B', estante: '12', data_lote: '2026-08-30', tipo: 'SB', data_ronda: data,
  blocos_na_ronda: 60, blocos_produzidos: 200, pct_da_ronda: 0.3, pct_acumulado: 0.35, limite: 0.25,
  outras_estantes: [{ lote_id: 900004, galpao: 'B', estante: '13', pct_acumulado: 0.05 }],
});
export async function producaoVerificarAlertaDeRetirada(lote_id: number, data_retirada: string): Promise<VerificacaoDeRetirada> {
  const chave = `${lote_id}|${data_retirada}`;
  const blocos = retiradaDemo(data_retirada).blocos_na_ronda;
  const ja = verificadosDeRetiradaDemo.has(chave);
  if (!ja) verificadosDeRetiradaDemo.set(chave, { por: 'Gestão (demo)', em: new Date().toISOString(), blocos });
  const { por, em } = verificadosDeRetiradaDemo.get(chave)!;
  return { lote_id, data_retirada, blocos_na_retirada: blocos, verificado_por_nome: por, verificado_em: em, ja_verificado: ja };
}

function pendenciasDemo(hoje: string): PendenciasDeLancamento {
  return quadroDePendencias({
    lotes: [
      {
        id: 900001, codigo: 'L-2609-A', data_lote: '2026-09-11', tipo: 'SH', galpao: 'A', estante_maturacao: '41',
        capela_ligada: null, responsavel_semeacao: 'Bruna', blocos_semeados: null, blocos_guardados: null,
      },
      {
        id: 900002, codigo: 'L-2608-B', data_lote: '2026-08-30', tipo: 'SB', galpao: 'B', estante_maturacao: '12',
        capela_ligada: true, responsavel_semeacao: 'Tânia', blocos_semeados: 216, blocos_guardados: 108,
      },
      {
        id: LOTE_DEMO_SP_PENDENCIA, codigo: 'L-2603-C', data_lote: '2026-03-26', tipo: 'SP', galpao: 'B', estante_maturacao: '41',
        capela_ligada: true, responsavel_semeacao: 'Bruna', blocos_semeados: null, blocos_guardados: null,
      },
    ],
    autoclaves: [
      {
        lote_id: 900001, ordem: 1, responsavel: 'Ana', entrada: '08:00', atingiu_121: '08:30',
        fim_2h: '10:30', houve_queda_121: false, pressao_na_faixa: true,
      },
    ],
    transferencias: transferenciasDemoSemSala,
    divergencias: [],
    embalagem: {
      registros: [], inicio: somaDias(hoje, -4), diasParaFechar: 2,
      diasComColheita: [somaDias(hoje, -4), somaDias(hoje, -3)], dispensados: [somaDias(hoje, -3), ...diasSemColheitaDemo],
    },
    eventos: contaminadosStore
      .filter((c) => c.lote_id === LOTE_DEMO_SP_PENDENCIA)
      .map((c) => ({
        lote_id: LOTE_DEMO_SP_PENDENCIA, tipo: c.tipo_evento, quantidade: c.quantidade, data_evento: c.data_retirada,
        estante_registrada: c.estante_registrada, importado: c.importado,
      })),
    retiradas: { alertas: [retiradaDemo(hojeISO())], verificados: verificadosDeRetiradaDemo, inicio: '2026-10-04' },
    salas: salasDaCapacidade,
  }, { hoje });
}

const METAS_PADRAO_DEMO: Record<string, { valor: number | null; unidade: string; nota: string }> = {
  produtividade_kg_por_bloco: { valor: 0.24, unidade: 'kg/bloco', nota: 'média do Shiitake nos lotes fechados (exemplo)' },
  aproveitamento_pct: { valor: 75, unidade: '%', nota: 'blocos abertos sobre semeados, em lotes já fechados (exemplo)' },
  perda_aceitavel_pct: { valor: 12, unidade: '%', nota: 'contaminação aceitável sobre os blocos produzidos (exemplo)' },
  qualidade_mg_pct: { valor: 30, unidade: '%', nota: 'M+G+GG sobre o total colhido do Shiitake' },
  ocupacao_alerta_pct: { valor: 80, unidade: '%', nota: 'a partir daqui a capacidade vira atenção' },
  margem_operacional_minima_pct: { valor: 12, unidade: '%', nota: 'Margem operacional mínima: abaixo dela o card fica vermelho; entre ela e a margem desejada, amarelo.' },
  contaminacao_meta_pct: { valor: 5, unidade: '%',
    nota: 'Meta da empresa para contaminação. É LINHA DE REFERÊNCIA na tela, não o corte que pinta vermelho -- quem pinta são as duas chaves abaixo.' },
  contaminacao_atencao_pct: { valor: 10, unidade: '%', nota: 'A partir daqui o lote fica AMARELO.' },
  contaminacao_critico_pct: { valor: 20, unidade: '%', nota: 'A partir daqui o lote fica VERMELHO e gera alerta.' },
  contaminacao_dias_comparavel: { valor: 20, unidade: 'dias', nota: 'Idade mínima para uma semana entrar em comparação.' },
  contaminacao_dias_estavel: { valor: 35, unidade: 'dias', nota: 'Idade em que a contaminação do lote estabiliza.' },
  contaminacao_semanas_comparacao: { valor: 4, unidade: 'semanas', nota: 'Quantas semanas maduras a tendência compara.' },
  contaminacao_ronda_pct: { valor: 25, unidade: '%', nota: 'Alerta de ronda: dispara quando uma única ronda retira este percentual ou mais dos blocos produzidos pela estante.' },
  contaminacao_faixa1_dias: { valor: 10, unidade: 'dias', nota: 'Primeiro corte das faixas de tempo desde a produção: 0 a 10 dias.' },
  contaminacao_faixa2_dias: { valor: 15, unidade: 'dias', nota: 'Segundo corte: 11 a 15 dias.' },
  contaminacao_faixa3_dias: { valor: 20, unidade: 'dias', nota: 'Terceiro corte: 16 a 20 dias.' },
  contaminacao_faixa4_dias: { valor: 30, unidade: 'dias', nota: 'Quarto corte: 21 a 30 dias. Acima dele é a quinta faixa.' },
  embalagem_tolerancia_kg: { valor: 0.5, unidade: 'kg', nota: 'Até esta diferença, em kg, a colheita conta como fechada na conferência colheita × embalagem.' },
  embalagem_dias_para_fechar: { valor: 2, unidade: 'dias', nota: 'Colheita mais nova que isto ainda está sendo embalada: aparece como "em aberto", não como divergência.' },
  previsao_horizonte_semanas: { valor: 4, unidade: 'semanas', nota: 'Quantas semanas a previsão única de produção cobre, a contar da semana de hoje. Um horizonte só, para matéria-prima e sementes.' },
  semeacao_pacotes_shiitake: { valor: 18, unidade: 'pacotes', nota: 'Pacotes de semente a separar para uma semeação de Shiitake.' },
  semeacao_pacotes_shimeji: { valor: 24, unidade: 'pacotes', nota: 'Pacotes de semente a separar para uma semeação de Shimeji, Branco ou Preto.' },
  gramas_por_bandeja: { valor: 200, unidade: 'g', nota: 'Peso usado para transformar o kg colhido em bandejas na Taxa de Conversão de Blocos.' },
  meta_mes_blocos_abertos: { valor: null, unidade: 'blocos', nota: 'Meta de blocos abertos no mês (Budget / Projeções).' },
  meta_mes_bandejas_produzidas: { valor: null, unidade: 'bandejas', nota: 'Meta de bandejas produzidas no mês (Budget / Projeções).' },
  meta_mes_bandejas_vendidas: { valor: null, unidade: 'bandejas', nota: 'Meta de bandejas vendidas no mês (Budget / Projeções).' },
  ref_preco_medio_bandeja: { valor: null, unidade: 'R$', nota: 'Referência de preço médio por bandeja (Budget / Projeções).' },
  ref_bandejas_por_bloco: { valor: 1.2, unidade: 'bandejas/bloco', nota: 'Meta de bandejas colhidas por bloco aberto no mês.' },
  ref_kg_por_bloco: { valor: 0.3, unidade: 'kg/bloco', nota: 'Referência de kg colhido por bloco aberto no mês.' },
  limite_contaminacao_abertos_pct: { valor: 8, unidade: '%', nota: 'Limite de contaminação dos lotes abertos no mês.' },
  abertura_blocos_por_sala: { valor: 800, unidade: 'blocos', nota: 'Blocos de uma abertura numa sala.' },
  abertura_ciclo_dias: { valor: 12, unidade: 'dias', nota: 'Intervalo entre duas aberturas da mesma sala.' },
  abertura_salas: { valor: 4, unidade: 'salas', nota: 'Salas de frutificação em funcionamento.' },
  fabricacao_blocos_por_dia: { valor: 720, unidade: 'blocos', nota: 'Blocos fabricados por dia de fabricação.' },
  fabricacao_margem_contaminacao_pct: { valor: 8, unidade: '%', nota: 'Contaminação prevista dos blocos novos na fabricação necessária.' },
};
const metasBancoStore = new Map<string, { valor: number; vigente_desde: string }>();

export function metasOperacionais(): Promise<MetasOperacionaisResposta> {
  const metas: Record<string, MetaOperacional> = {};
  for (const [chave, def] of Object.entries(METAS_PADRAO_DEMO)) {
    const banco = metasBancoStore.get(chave);
    metas[chave] = banco
      ? { valor: banco.valor, unidade: def.unidade, nota: def.nota, origem: 'BANCO', vigente_desde: banco.vigente_desde }
      : { valor: def.valor, unidade: def.unidade, nota: def.nota, origem: 'PADRAO', vigente_desde: null };
  }
  return Promise.resolve({ hoje: new Date().toISOString().slice(0, 10), metas });
}

export function putMetaOperacional(body: {
  chave: string; valor: number; vigenteDesde?: string; observacao?: string;
}): Promise<MetaOperacionalSalva> {
  const def = METAS_PADRAO_DEMO[body.chave];
  if (!def) {
    return Promise.reject(erroHttp(400, `chave desconhecida: use uma de ${Object.keys(METAS_PADRAO_DEMO).join(', ')}.`));
  }
  const valor = Number(body.valor);
  if (!Number.isFinite(valor)) {
    return Promise.reject(erroHttp(400, `valor inválido para ${body.chave}: informe um número.`));
  }
  if (!(valor > 0)) {
    return Promise.reject(erroHttp(400,
      `valor de ${body.chave} deve ser maior que zero (para voltar ao padrão, exclua a linha).`));
  }
  if (def.unidade === '%' && valor > 100) {
    return Promise.reject(erroHttp(400, `valor de ${body.chave} deve estar entre 0 e 100.`));
  }
  if ((body.chave === CHAVE_HORIZONTE_DEMO || body.chave.startsWith('semeacao_pacotes_')) && !Number.isInteger(valor)) {
    return Promise.reject(erroHttp(400, `valor de ${body.chave} deve ser um número inteiro.`));
  }
  if (body.chave === CHAVE_HORIZONTE_DEMO && valor > 26) {
    return Promise.reject(erroHttp(400, `valor de ${body.chave} deve ser no máximo 26.`));
  }
  const vigente_desde = body.vigenteDesde ?? new Date().toISOString().slice(0, 10);
  metasBancoStore.set(body.chave, { valor, vigente_desde });
  return Promise.resolve({
    chave: body.chave, valor, unidade: def.unidade, vigente_desde,
    observacao: body.observacao?.trim() || null,
  });
}

const CHAVE_HORIZONTE_DEMO = 'previsao_horizonte_semanas';
const TIPOS_PREVISAO_DEMO: Array<{ tipo: TipoPrevisao; nome: string }> = [
  { tipo: 'SH', nome: 'Shiitake' }, { tipo: 'SB', nome: 'Shimeji Branco' }, { tipo: 'SP', nome: 'Shimeji Preto' },
];

function segundaDaSemanaDemo(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
const horizonteDemo = () => {
  const banco = metasBancoStore.get(CHAVE_HORIZONTE_DEMO);
  return banco
    ? { semanas: banco.valor, origem: 'BANCO' as const }
    : { semanas: METAS_PADRAO_DEMO[CHAVE_HORIZONTE_DEMO].valor ?? 4, origem: 'PADRAO' as const };
};
const semanasDoHorizonteDemo = () => {
  const segunda = segundaDaSemanaDemo(hojeISO());
  return Array.from({ length: horizonteDemo().semanas }, (_, i) => somaDias(segunda, 7 * i));
};

const previsaoStore = new Map<string, number>();
const chavePrevisao = (semana: string, tipo: TipoPrevisao) => `${semana}|${tipo}`;
{
  const segunda = segundaDaSemanaDemo(hojeISO());
  const SH = [940, 940, 1034, 846, 940, 1128, 940, 940, 846, 1034, 940, 940];
  const SB = [188, 282, 0, 188, 188, 282, 188, 188, 282, 188, 188, 188];
  const SP = [376, null, 470, 376, 376, 470, 376, 376, 470, 376, 376, 376];
  for (let i = 0; i < 12; i++) {
    const semana = somaDias(segunda, 7 * i);
    previsaoStore.set(chavePrevisao(semana, 'SH'), SH[i]);
    previsaoStore.set(chavePrevisao(semana, 'SB'), SB[i]);
    const sp = SP[i];
    if (sp != null) previsaoStore.set(chavePrevisao(semana, 'SP'), sp);
  }
}

export function previsao(): Promise<PrevisaoResposta> {
  return Promise.resolve(previsaoAtualDemo());
}
function previsaoAtualDemo(): PrevisaoResposta {
  const { semanas: horizonte, origem } = horizonteDemo();
  const semanas = semanasDoHorizonteDemo();
  const linhas: PrevisaoResposta['linhas'] = [];
  for (const semana of semanas) {
    for (const { tipo } of TIPOS_PREVISAO_DEMO) {
      const blocos = previsaoStore.get(chavePrevisao(semana, tipo));
      if (blocos !== undefined) linhas.push({ semana, tipo_cogumelo: tipo, blocos });
    }
  }
  const totais = TIPOS_PREVISAO_DEMO.map(({ tipo }) => {
    const semanas_sem_previsao = semanas.filter((s) => !previsaoStore.has(chavePrevisao(s, tipo)));
    const total = semanas_sem_previsao.length > 0 ? null
      : semanas.reduce((t, s) => t + (previsaoStore.get(chavePrevisao(s, tipo)) ?? 0), 0);
    return { tipo_cogumelo: tipo, total, semanas_sem_previsao };
  });
  return {
    horizonte_semanas: horizonte, horizonte_origem: origem, semanas,
    tipos: TIPOS_PREVISAO_DEMO.map((t) => ({ ...t })), linhas, totais,
  };
}

export function salvarPrevisao(itens: PrevisaoItem[]): Promise<PrevisaoResposta> {
  if (!Array.isArray(itens) || itens.length === 0) {
    return Promise.reject(erroHttp(400, 'itens deve ser uma lista com ao menos uma célula da previsão.'));
  }
  const vistos = new Set<string>();
  for (const [i, item] of itens.entries()) {
    const semana = String(item.semana ?? '').trim();
    const data = new Date(`${semana}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(semana) || Number.isNaN(data.getTime()) || data.toISOString().slice(0, 10) !== semana) {
      return Promise.reject(erroHttp(400, `itens[${i}].semana deve ser uma data aaaa-mm-dd; veio "${semana}".`));
    }
    if (segundaDaSemanaDemo(semana) !== semana) {
      return Promise.reject(erroHttp(400, `itens[${i}].semana deve ser a segunda-feira da semana; ${semana} não é segunda.`));
    }
    if (!TIPOS_PREVISAO_DEMO.some((t) => t.tipo === item.tipo_cogumelo)) {
      return Promise.reject(erroHttp(400, `itens[${i}].tipo_cogumelo deve ser SH, SB, SP; veio "${item.tipo_cogumelo ?? ''}".`));
    }
    const chave = chavePrevisao(semana, item.tipo_cogumelo);
    if (vistos.has(chave)) {
      return Promise.reject(erroHttp(400, `itens[${i}]: a semana ${semana} do ${item.tipo_cogumelo} aparece duas vezes.`));
    }
    vistos.add(chave);
    if (item.blocos !== null && !(Number.isInteger(item.blocos) && item.blocos >= 0 && item.blocos <= 1000000)) {
      return Promise.reject(erroHttp(400,
        `itens[${i}].blocos deve ser um número inteiro de 0 a 1.000.000, ou vazio para "não informado".`));
    }
  }
  for (const item of itens) {
    const chave = chavePrevisao(item.semana, item.tipo_cogumelo);
    if (item.blocos === null) previsaoStore.delete(chave);
    else previsaoStore.set(chave, item.blocos);
  }
  return Promise.resolve(previsaoAtualDemo());
}

const salasStore: Array<{
  id: number; nome: string; num_estantes: number | null;
  capacidade_blocos: number | null; dias_medios: number | null;
  galpao_codigo: string | null; apelido: string | null;
}> = [
  { id: 1, nome: 'Frutificação Shimeji A', num_estantes: 6, capacidade_blocos: 900, dias_medios: 25, galpao_codigo: null, apelido: null },
  { id: 2, nome: 'Frutificação Shimeji B', num_estantes: 6, capacidade_blocos: 860, dias_medios: 25, galpao_codigo: null, apelido: null },
  { id: 3, nome: 'Frutificação Shiitake', num_estantes: 30, capacidade_blocos: 1800, dias_medios: 35, galpao_codigo: null, apelido: null },
  { id: 4, nome: 'Maturação Shimeji', num_estantes: 160, capacidade_blocos: 90, dias_medios: 60, galpao_codigo: null, apelido: null },
  { id: 5, nome: 'Maturação Shiitake', num_estantes: 90, capacidade_blocos: 70, dias_medios: 80, galpao_codigo: null, apelido: null },
  { id: 6, nome: 'Maturação reserva', num_estantes: 150, capacidade_blocos: 1500, dias_medios: null, galpao_codigo: null, apelido: null },
];
const mensaisStore: Array<{ sala_id: number; ano: number; mes: number; blocos_abertos: number | null; bandejas_produzidas: number | null }> = [
  { sala_id: 1, ano: 2026, mes: 1, blocos_abertos: 60, bandejas_produzidas: 72 },
  { sala_id: 1, ano: 2026, mes: 3, blocos_abertos: 75, bandejas_produzidas: 99 },
  { sala_id: 4, ano: 2026, mes: 1, blocos_abertos: 50, bandejas_produzidas: 58 },
];

export function estruturais(ano: number): Promise<EstruturaisResposta> {
  const biologica = salasStore.map((s) => {
    const blocos: Array<number | null> = Array(12).fill(null);
    const bandejas: Array<number | null> = Array(12).fill(null);
    const cb: Array<number | null> = Array(12).fill(null);
    for (const m of mensaisStore) {
      if (m.sala_id !== s.id || m.ano !== ano) continue;
      blocos[m.mes - 1] = m.blocos_abertos;
      bandejas[m.mes - 1] = m.bandejas_produzidas;
      cb[m.mes - 1] = m.blocos_abertos && m.bandejas_produzidas != null
        ? m.bandejas_produzidas / m.blocos_abertos : null;
    }
    return { sala_id: s.id, nome: s.nome, blocos_abertos: blocos, bandejas_produzidas: bandejas, cb };
  });

  const abertura = salasStore.map((s) => ({
    sala_id: s.id, nome: s.nome,
    capac_blocos: s.capacidade_blocos, dias_medios: s.dias_medios,
    capac_mensal: s.capacidade_blocos != null && s.dias_medios
      ? round2((s.capacidade_blocos / s.dias_medios) * 30) : null,
  }));

  const bandejas = salasStore.map((s) => {
    const ab = abertura.find((a) => a.sala_id === s.id);
    const cbSerie = biologica.find((b) => b.sala_id === s.id)?.cb ?? [];
    const mes = ultimoMesComDado(cbSerie);
    const cb = mes != null ? cbSerie[mes - 1] : null;
    return {
      sala_id: s.id, nome: s.nome,
      cf_mensal: ab?.capac_mensal ?? null, cb, cb_mes: mes,
      cpb_mes: s.capacidade_blocos != null && s.dias_medios && cb != null
        ? (s.capacidade_blocos / s.dias_medios) * 30 * cb : null,
    };
  });

  return Promise.resolve({ ano, biologica, fisica: salasStore.map((s) => ({ ...s })), abertura, bandejas });
}

const textoDemo = (v: string | null | undefined): string | null =>
  (v == null ? null : v.replace(/\s+/g, ' ').trim() || null);

export function estruturaisPutSala(body: {
  salaId: number; num_estantes?: number | null; capacidade_blocos?: number | null; dias_medios?: number | null;
  galpao_codigo?: string | null; apelido?: string | null;
}): Promise<{ ok: true }> {
  const s = salasStore.find((x) => x.id === body.salaId);
  if (s) {
    if (body.num_estantes !== undefined) s.num_estantes = body.num_estantes;
    if (body.capacidade_blocos !== undefined) s.capacidade_blocos = body.capacidade_blocos;
    if (body.dias_medios !== undefined) s.dias_medios = body.dias_medios;
    if (body.galpao_codigo !== undefined) s.galpao_codigo = textoDemo(body.galpao_codigo);
    if (body.apelido !== undefined) s.apelido = textoDemo(body.apelido);
  }
  return Promise.resolve({ ok: true });
}

export function estruturaisPutMensal(body: {
  salaId: number; ano: number; mes: number;
  blocos_abertos?: number | null; bandejas_produzidas?: number | null;
}): Promise<{ ok: true }> {
  const m = mensaisStore.find((x) => x.sala_id === body.salaId && x.ano === body.ano && x.mes === body.mes);
  if (m) {
    if (body.blocos_abertos !== undefined) m.blocos_abertos = body.blocos_abertos;
    if (body.bandejas_produzidas !== undefined) m.bandejas_produzidas = body.bandejas_produzidas;
  } else {
    mensaisStore.push({
      sala_id: body.salaId, ano: body.ano, mes: body.mes,
      blocos_abertos: body.blocos_abertos ?? null,
      bandejas_produzidas: body.bandejas_produzidas ?? null,
    });
  }
  return Promise.resolve({ ok: true });
}

const ATIVOS_DESEMP = 5;
const round4 = (v: number) => Math.round(v * 10000) / 10000;

const celulaDesempVazia = (): DesempenhoCelula => ({
  receita: null, quantidade: null, preco_medio: null, participacao_pct: null,
  kg: null, rs_por_kg: null,
});

function linhaDesemp(
  nome: string,
  base: { receita?: number; qtd?: number; kg?: number },
  extra: { produto_id?: number; especie?: string; agregado?: boolean } = {},
): DesempenhoProduto {
  const valores: Record<string, DesempenhoCelula> = {};
  const total = celulaDesempVazia();
  const soma = (a: number | null, b: number | null) => (b == null ? a : round2((a ?? 0) + b));
  MESES_ANO.forEach((rot, i) => {
    const c = celulaDesempVazia();
    if (i < ATIVOS_DESEMP) {
      const f = 0.85 + ((i + 3) % 5) * 0.08;
      c.receita = base.receita != null ? round2(base.receita * f) : null;
      c.quantidade = base.qtd != null ? Math.round(base.qtd * f) : null;
      c.kg = base.kg != null ? round2(base.kg * f) : null;
      if (c.receita != null && c.quantidade) c.preco_medio = round2(c.receita / c.quantidade);
      if (c.receita != null && c.kg) c.rs_por_kg = round2(c.receita / c.kg);
      total.receita = soma(total.receita, c.receita);
      total.quantidade = soma(total.quantidade, c.quantidade);
      total.kg = soma(total.kg, c.kg);
    }
    valores[rot] = c;
  });
  if (total.receita != null && total.quantidade) total.preco_medio = round2(total.receita / total.quantidade);
  if (total.receita != null && total.kg) total.rs_por_kg = round2(total.receita / total.kg);
  return {
    produto_id: extra.produto_id ?? null, nome,
    especie: extra.especie ?? null, agregado: extra.agregado ?? false,
    valores, total,
  };
}

function aplicarParticipacaoDesemp(produtos: DesempenhoProduto[]) {
  for (const rot of MESES_ANO) {
    const somaMes = produtos.reduce((s, p) => s + (p.valores[rot]?.receita ?? 0), 0);
    if (somaMes <= 0) continue;
    for (const p of produtos) {
      const c = p.valores[rot];
      if (c?.receita != null) c.participacao_pct = round4(c.receita / somaMes);
    }
  }
  const somaAno = produtos.reduce((s, p) => s + (p.total.receita ?? 0), 0);
  if (somaAno > 0) {
    for (const p of produtos) {
      if (p.total.receita != null) p.total.participacao_pct = round4(p.total.receita / somaAno);
    }
  }
}

export function desempenho(operacao: DesempenhoOperacao, ano: number): Promise<DesempenhoResposta> {
  const produtos = operacao === 'PRODUCAO'
    ? [
      linhaDesemp('Cogumelos (agregado)', { receita: 96000, qtd: 5300, kg: 1500 }, { produto_id: 10, agregado: true }),
      linhaDesemp('Pimentão (agregado)', { receita: 22000, qtd: 800 }, { produto_id: 11, agregado: true }),
      linhaDesemp('Shiitake', { kg: 820 }, { produto_id: 1, especie: 'SH' }),
      linhaDesemp('Shimeji Preto', { kg: 680 }, { produto_id: 2, especie: 'SP' }),
    ]
    : [linhaDesemp('Revenda (agregado)', { receita: 208000, qtd: 11000 }, { produto_id: 12, agregado: true })];
  aplicarParticipacaoDesemp(produtos);
  return Promise.resolve({
    ano, operacao,
    meses: [...MESES_ANO],
    mesesComDados: MESES_ANO.slice(0, ATIVOS_DESEMP),
    produtos,
    observacoes: [
      'Dados de DEMONSTRAÇÃO: números ilustrativos, não reais.',
      'A receita importada é por SEGMENTO (produtos agregados). O desempenho de cada produto individual da revenda depende do import mensal das vendas por produto do ERP.',
      operacao === 'PRODUCAO'
        ? 'Kg colhidos por espécie vêm da Jornada do Cogumelo (colheitas × lotes); a receita por espécie aparece quando houver venda vinculada ao produto.'
        : 'Quando o import por produto for feito, cada item da revenda aparece aqui com receita, quantidade e preço médio próprios.',
    ],
  });
}

const clonar = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

type CompraMensalCrua = Omit<CompraMensalItem, 'comprar'>;
const comprasMensalStore: CompraMensalCrua[] =
  clonar(FX_COMPRAS_MENSAL).map((i) => ({ ...i, inventariado_em: null }));
let seqCompraMensal = 100;

export function comprasMensal(): Promise<CompraMensalCrua[]> {
  return Promise.resolve(clonar(comprasMensalStore));
}

export function comprasMensalAtualizar(id: number, body: CompraMensalEdicao): Promise<{ ok: true }> {
  const item = comprasMensalStore.find((i) => i.id === id);
  if (item) {
    Object.assign(item, body);
    if (body.estoque_atual !== undefined) {
      item.inventariado_em = new Date().toISOString().slice(0, 10);
    }
  }
  return Promise.resolve({ ok: true });
}

export function comprasMensalCriar(body: CompraMensalEdicao & { categoria: string; descricao: string }): Promise<CompraMensalCrua> {
  const item: CompraMensalCrua = {
    id: (seqCompraMensal += 1),
    categoria: body.categoria,
    subcategoria: body.subcategoria ?? null,
    descricao: body.descricao,
    especificacao: body.especificacao ?? null,
    unidade: body.unidade ?? null,
    consumo_medio_mensal: body.consumo_medio_mensal ?? 0,
    tipo_consumo: body.tipo_consumo ?? 'CONTINUO',
    estoque_atual: body.estoque_atual ?? null,
    inventariado_em: null,
    observacoes: body.observacoes ?? null,
  };
  comprasMensalStore.push(item);
  return Promise.resolve({ ...item });
}

export function comprasMensalExcluir(id: number): Promise<{ ok: true }> {
  const idx = comprasMensalStore.findIndex((i) => i.id === id);
  if (idx >= 0) comprasMensalStore.splice(idx, 1);
  return Promise.resolve({ ok: true });
}

const mpReceitasStore = clonar(FX_MP_RECEITAS);
const mpEstoqueStore: Record<number, number | null> = { ...FX_MP_ESTOQUE };
const mpEmbalagensStore = clonar(FX_MP_EMBALAGENS);
const mpPesoBlocoStore: Record<number, number | null> = {};
const mpEmTransitoStore: Record<number, number | null> = {};
const mpCustoPorKgStore: Record<number, number | null> = {};
const mpEstoqueMinimoStore: Record<number, number | null> = {};

const RECEITA_VIGENTE_DEMO: Record<TipoPrevisao, number> = { SH: 1, SB: 4, SP: 3 };

function contaSementesDemo(): NecessidadeDeSementesResposta {
  const prev = previsaoAtualDemo();
  const saldos = saldosSementes();
  const estoquePorCepa = (codigo: string) => saldos.filter((x) => x.cepa === codigo).reduce((t, x) => t + x.saldo, 0);
  const parametros: Array<{ tipo_cogumelo: string; gramas_por_bloco: number | null; gramas_por_saco: number | null }> = [];
  const porTipo = new Map<string, { total: number | null; semanas_sem_previsao: string[] }>();
  for (const { tipo, nome } of prev.tipos) {
    const rec = mpReceitasStore.find((r) => r.id === RECEITA_VIGENTE_DEMO[tipo]);
    const ing = rec?.ingredientes.find((i) => i.materia_prima === 'Semente');
    const dose = ing?.kg_por_receita != null && rec?.blocos_por_receita
      ? Math.round((ing.kg_por_receita / rec.blocos_por_receita) * 1000 * 10000) / 10000 : null;
    parametros.push({ tipo_cogumelo: nome, gramas_por_bloco: dose, gramas_por_saco: sementesSacoStore[nome] ?? null });
    const t = prev.totais.find((x) => x.tipo_cogumelo === tipo);
    porTipo.set(nome, { total: t?.total ?? null, semanas_sem_previsao: t?.semanas_sem_previsao ?? [] });
  }
  const estoque = parametros.map((p) => ({
    tipo_cogumelo: p.tipo_cogumelo,
    saldo: CEPAS.filter((c) => c.tipo === p.tipo_cogumelo).reduce((t, c) => t + estoquePorCepa(c.codigo), 0),
  }));
  const compras_previstas = comprasPrevistasStore.map((c) => ({ tipo_cogumelo: c.tipo_cogumelo, quantidade: c.quantidade }));
  return necessidadeDeSementes({
    parametros, estoque, compras_previstas,
    previsao: { horizonte_semanas: prev.horizonte_semanas, semanas: prev.semanas, porTipo },
  });
}

export function comprasMp(): Promise<ApiComprasMp> {
  const r4 = (v: number) => Math.round(v * 10000) / 10000;
  const prev = previsaoAtualDemo();
  const totalDoTipo = new Map(prev.totais.map((t) => [t.tipo_cogumelo, t.total]));
  const receitas = mpReceitasStore.map((r) => {
    const tipo = (Object.keys(RECEITA_VIGENTE_DEMO) as TipoPrevisao[])
      .find((t) => RECEITA_VIGENTE_DEMO[t] === r.id) ?? null;
    const blocosPrevistos = tipo == null ? 0 : (totalDoTipo.get(tipo) ?? null);
    return {
      id: r.id, nome: r.nome,
      status: r.status,
      blocos_por_receita: r.blocos_por_receita,
      blocos_previstos: blocosPrevistos,
      tipo_previsao: tipo,
      peso_bloco_kg: mpPesoBlocoStore[r.id] ?? null,
      ingredientes: r.ingredientes.map((i) => {
        const kgBloco = i.kg_por_receita != null && r.blocos_por_receita
          ? i.kg_por_receita / r.blocos_por_receita : null;
        const necKg = kgBloco != null && blocosPrevistos != null ? r4(kgBloco * blocosPrevistos) : null;
        const necApres = necKg != null && i.apresentacao_kg ? r4(necKg / i.apresentacao_kg) : null;
        return {
          ...i,
          necessario_kg: necKg,
          necessario_apresentacao: necApres,
          estoque_disponivel: mpEstoqueStore[i.materia_prima_id] ?? null,
          custo_por_kg: mpCustoPorKgStore[i.materia_prima_id] ?? null,
        };
      }),
    };
  });

  const porMp = new Map<number, { materia_prima: string; necessario: number; semPrevisao: boolean }>();
  for (const rec of receitas) {
    const receitaFx = mpReceitasStore.find((x) => x.id === rec.id);
    for (const i of rec.ingredientes) {
      if (i.materia_prima === 'Semente') continue;
      const calculavel = i.kg_por_receita != null && !!receitaFx?.blocos_por_receita && !!i.apresentacao_kg;
      const atual = porMp.get(i.materia_prima_id)
        ?? { materia_prima: i.materia_prima, necessario: 0, semPrevisao: false };
      if (rec.blocos_previstos == null && calculavel) {
        atual.semPrevisao = true;
        porMp.set(i.materia_prima_id, atual);
        continue;
      }
      if (i.necessario_apresentacao == null) continue;
      atual.necessario += i.necessario_apresentacao;
      porMp.set(i.materia_prima_id, atual);
    }
  }
  const pedido_consolidado: PedidoConsolidadoItem[] = [...porMp.entries()].map(([mpId, { materia_prima, necessario, semPrevisao }]) => {
    const necessario_total = semPrevisao ? null : r4(necessario);
    const estoque = mpEstoqueStore[mpId] ?? null;
    const em_transito = mpEmTransitoStore[mpId] ?? null;
    const estoque_minimo = mpEstoqueMinimoStore[mpId] ?? null;
    const comprar = estoque == null || necessario_total == null ? null
      : Math.max(0, Math.ceil(r4((estoque_minimo ?? 0) + necessario_total - estoque - (em_transito ?? 0))));
    return {
      materia_prima_id: mpId, materia_prima,
      compra_total: estoque == null || necessario_total == null ? null : r4(estoque - necessario_total),
      em_transito, estoque_disponivel: estoque, necessario_total, estoque_minimo, comprar,
    };
  });
  const sementes = contaSementesDemo();
  const idSemente = mpReceitasStore.flatMap((r) => r.ingredientes).find((i) => i.materia_prima === 'Semente')?.materia_prima_id ?? null;
  for (const t of sementes.por_tipo) {
    const necessario = t.necessidade_horizonte_sacos;
    pedido_consolidado.push({
      materia_prima_id: null, materia_prima: `Semente ${t.tipo_cogumelo}`, semente_tipo: t.tipo_cogumelo,
      compra_total: t.saldo == null || necessario == null ? null : r4(t.saldo - necessario),
      em_transito: t.compras_previstas_sacos, estoque_disponivel: t.saldo, necessario_total: necessario,
      estoque_minimo: null, comprar: t.comprar_agora_sacos,
      preco_materia_prima_id: idSemente, kg_por_saco: t.gramas_por_saco == null ? null : t.gramas_por_saco / 1000,
    });
  }

  return Promise.resolve({
    receitas,
    pedido_consolidado,
    sementes,
    embalagens: clonar(mpEmbalagensStore),
    previsao: {
      horizonte_semanas: prev.horizonte_semanas,
      semanas: prev.semanas,
      sem_previsao: prev.totais.map((t) => ({ tipo_cogumelo: t.tipo_cogumelo, semanas: t.semanas_sem_previsao })),
    },
  });
}

export function comprasMpPutEstoqueMinimo(
  body: { materiaPrimaId: number; estoqueMinimo: number | null },
): Promise<{ id: number; estoque_minimo_informado: number | null }> {
  mpEstoqueMinimoStore[body.materiaPrimaId] = body.estoqueMinimo;
  return Promise.resolve({ id: body.materiaPrimaId, estoque_minimo_informado: body.estoqueMinimo });
}

export function comprasMpPutEstoque(body: { materiaPrimaId: number; estoque: number | null }): Promise<{ ok: true }> {
  mpEstoqueStore[body.materiaPrimaId] = body.estoque;
  return Promise.resolve({ ok: true });
}

export function comprasMpPutEmTransito(body: { materiaPrimaId: number; qtde: number | null }): Promise<{ ok: true }> {
  mpEmTransitoStore[body.materiaPrimaId] = body.qtde;
  return Promise.resolve({ ok: true });
}

export function comprasMpPutPesoBloco(body: { receitaId: number; pesoBlocoKg: number | null }): Promise<{ ok: true }> {
  mpPesoBlocoStore[body.receitaId] = body.pesoBlocoKg;
  return Promise.resolve({ ok: true });
}

export function comprasMpPutEmbalagem(
  id: number,
  body: { estoque_disponivel?: number | null; estoque_minimo?: number | null },
): Promise<{ ok: true }> {
  const e = mpEmbalagensStore.find((x) => x.id === id);
  if (e) {
    if (body.estoque_disponivel !== undefined) e.estoque_disponivel = body.estoque_disponivel;
    if (body.estoque_minimo !== undefined) e.estoque_minimo = body.estoque_minimo;
  }
  return Promise.resolve({ ok: true });
}

export function comprasMpPutIngrediente(body: {
  receitaId: number; materiaPrimaId: number;
  custo_apresentacao?: number; kg_por_receita?: number;
}): Promise<{ ok: true }> {
  const r = mpReceitasStore.find((x) => x.id === body.receitaId);
  const i = r?.ingredientes.find((x) => x.materia_prima_id === body.materiaPrimaId);
  if (i) {
    if (body.custo_apresentacao !== undefined) i.custo_apresentacao = body.custo_apresentacao;
    if (body.kg_por_receita !== undefined) i.kg_por_receita = body.kg_por_receita;
  }
  return Promise.resolve({ ok: true });
}

export function comprasMpPutCustoPorKg(body: { materiaPrimaId: number; custoPorKg: number | null }): Promise<{ ok: true }> {
  mpCustoPorKgStore[body.materiaPrimaId] = body.custoPorKg;
  return Promise.resolve({ ok: true });
}

const pimRegistrosStore = clonar(FX_PIMENTAO_REGISTROS);
const pimFinanceiroStore = clonar(FX_PIMENTAO_FINANCEIRO);
const pimPlantiosStore = clonar(FX_PIMENTAO_PLANTIOS);
const pimConsolidadoStore = clonar(FX_PIMENTAO_CONSOLIDADO);
let seqPimRegistro = 1000;

export function pimentaoRegistros(params: { inicio?: string; fim?: string }): Promise<PimentaoRegistro[]> {
  let linhas = clonar(pimRegistrosStore);
  if (params.inicio != null) linhas = linhas.filter((l) => l.data >= String(params.inicio));
  if (params.fim != null) linhas = linhas.filter((l) => l.data <= String(params.fim));
  linhas.sort((a, b) => a.data.localeCompare(b.data) || a.id - b.id);
  return Promise.resolve(linhas);
}

export function pimentaoCriarRegistro(body: {
  data: string; estufa: number; plantio: string; tipo: string; cliente: string;
  caixas: number; desp_kg?: number; preco_caixa?: number;
}): Promise<PimentaoRegistro> {
  const registro: PimentaoRegistro = {
    id: (seqPimRegistro += 1),
    data: body.data, estufa: body.estufa, plantio: body.plantio,
    tipo: body.tipo, cliente: body.cliente,
    caixas: body.caixas,
    kg: round2(body.caixas * 8),
    desp_kg: body.desp_kg ?? 0,
    preco_caixa: body.preco_caixa ?? null,
    faturamento: body.preco_caixa != null ? round2(body.caixas * body.preco_caixa) : null,
    origem: 'SISTEMA',
  };
  pimRegistrosStore.push(registro);
  return Promise.resolve({ ...registro });
}

export function pimentaoExcluirRegistro(id: number): Promise<{ ok: true }> {
  const idx = pimRegistrosStore.findIndex((r) => r.id === id);
  if (idx >= 0) pimRegistrosStore.splice(idx, 1);
  return Promise.resolve({ ok: true });
}

export function pimentaoConsolidado(): Promise<PimentaoConsolidadoLinha[]> {
  return Promise.resolve(clonar(pimConsolidadoStore));
}

export function pimentaoFinanceiro(ano: number): Promise<PimentaoFinanceiroResposta> {
  return Promise.resolve({
    ano,
    meses: clonar(pimFinanceiroStore).filter((m) => m.ano === ano),
    estufas: clonar(FX_PIMENTAO_ESTUFAS),
    total_geral: clonar(FX_PIMENTAO_TOTAL_GERAL),
  });
}

export function pimentaoPutFinanceiro(body: {
  ano: number; mes: number; gastos_mp?: number | null; demais_custos?: number | null;
}): Promise<{ ok: true }> {
  let m = pimFinanceiroStore.find((x) => x.ano === body.ano && x.mes === body.mes);
  if (!m) {
    m = {
      ano: body.ano, mes: body.mes,
      fat_atacado: null, kg_atacado: null, fat_amarelo_atacado: null, kg_amarelo_atacado: null,
      fat_vermelho_atacado: null, kg_vermelho_atacado: null, fat_verde_atacado: null, kg_verde_atacado: null,
      fat_ceasa: null, kg_ceasa: null, fat_amarelo_ceasa: null, kg_amarelo_ceasa: null,
      fat_vermelho_ceasa: null, kg_vermelho_ceasa: null, fat_verde_ceasa: null, kg_verde_ceasa: null,
      total_kg: null, preco_medio_kg: null, faturamento_total: null,
      gastos_mp: null, demais_custos: null, custos_totais: null,
      margem_bruta: null, margem_pct: null,
    };
    pimFinanceiroStore.push(m);
  }
  if ('gastos_mp' in body) m.gastos_mp = body.gastos_mp ?? null;
  if ('demais_custos' in body) m.demais_custos = body.demais_custos ?? null;
  m.custos_totais = round2((m.gastos_mp ?? 0) + (m.demais_custos ?? 0));
  m.margem_bruta = m.faturamento_total != null ? round2(m.faturamento_total + m.custos_totais) : null;
  m.margem_pct = m.faturamento_total
    ? Math.round(((m.margem_bruta ?? 0) / m.faturamento_total) * 10000) / 10000
    : null;
  return Promise.resolve({ ok: true });
}

export function pimentaoPlantios(): Promise<PimentaoPlantiosResposta> {
  return Promise.resolve({
    estufas: clonar(pimPlantiosStore),
    total_geral: clonar(FX_PIMENTAO_PLANTIOS_TOTAL),
  });
}

export function pimentaoPutPlantio(id: number, body: {
  total_plantado?: number; inicio?: string; fim?: string | null; cor?: string;
}): Promise<{ ok: true }> {
  for (const estufa of pimPlantiosStore) {
    const p = estufa.plantios.find((x) => x.id === id);
    if (!p) continue;
    if (body.total_plantado !== undefined) p.total_plantado = body.total_plantado;
    if (body.inicio !== undefined) p.inicio = body.inicio;
    if (body.fim !== undefined) p.fim = body.fim;
    if (body.cor !== undefined) p.cor = body.cor;
  }
  const c = pimConsolidadoStore.find((x) => x.id === id);
  if (c) {
    if (body.total_plantado !== undefined) c.total_plantado = body.total_plantado;
    if (body.inicio !== undefined) c.inicio = body.inicio;
    if (body.fim !== undefined) c.fim = body.fim;
    if (body.cor !== undefined) c.cor = body.cor;
  }
  return Promise.resolve({ ok: true });
}

function semaforoAberturaDemo(dias: number | null): PainelOperacionalAberturaLinha['semaforo'] {
  if (!Number.isFinite(dias)) return 'SEM_DADO';
  const n = dias as number;
  if (n < 0) return 'VERMELHO';
  return n <= 7 ? 'AMARELO' : 'VERDE';
}

function semaforoContaminacaoDemo(pct: number): 'VERDE' | 'AMARELO' | 'VERMELHO' | 'SEM_DADO' {
  if (!Number.isFinite(pct)) return 'SEM_DADO';
  if (pct >= 0.2) return 'VERMELHO';
  return pct >= 0.1 ? 'AMARELO' : 'VERDE';
}

const ptBr = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 1 });

const NOME_TIPO_DEMO: Record<string, string> = {
  SH: 'Shiitake', SB: 'Shimeji Branco', SP: 'Shimeji Preto', SS: 'Shimeji Salmão',
};
function chaveLoteDemo(chave: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})\|([A-Za-z]+)$/.exec(chave ?? '');
  if (!m) return chave;
  const nome = NOME_TIPO_DEMO[m[4].toUpperCase()];
  return nome ? `${m[3]}/${m[2]}/${m[1]} (${nome})` : chave;
}

function insumosDoPainelDemo() {
  const linhas: PainelOperacionalInsumoLinha[] = [];
  const sem_consumo: PainelOperacionalInsumoSemConsumo[] = [];
  for (const i of comprasMensalStore) {
    const base = {
      id: i.id, categoria: i.categoria, descricao: i.descricao,
      especificacao: i.especificacao ?? null, unidade: i.unidade,
      estoque_atual: i.estoque_atual, consumo_medio_mensal: i.consumo_medio_mensal,
    };
    if (i.estoque_atual == null || !(i.consumo_medio_mensal > 0)) {
      sem_consumo.push({
        ...base,
        motivo: i.estoque_atual == null ? 'sem estoque informado' : 'sem consumo medio cadastrado',
      });
      continue;
    }
    const dias = Math.round((i.estoque_atual / (i.consumo_medio_mensal / 30)) * 10) / 10;
    linhas.push({
      ...base,
      dias_de_cobertura: dias,
      semaforo: dias <= 15 ? 'VERMELHO' : (dias <= 30 ? 'AMARELO' : 'VERDE'),
    });
  }
  linhas.sort((a, b) => a.dias_de_cobertura - b.dias_de_cobertura);
  return {
    linhas,
    sem_consumo,
    resumo: {
      itens: comprasMensalStore.length, calculados: linhas.length, sem_dado: sem_consumo.length,
    },
  };
}

const HOJE_PAINEL_DEMO = '2026-08-25';

const ABERTURAS_INDICADORES_DEMO: Record<number, { data_abertura: string; blocos_abertos: number | null }> = {
  199: { data_abertura: '2026-04-07', blocos_abertos: 360 }, 200: { data_abertura: '2026-06-01', blocos_abertos: 390 },
  201: { data_abertura: '2026-06-30', blocos_abertos: 380 }, 202: { data_abertura: '2026-07-07', blocos_abertos: 390 },
  203: { data_abertura: '2026-08-04', blocos_abertos: 260 }, 204: { data_abertura: '2026-08-01', blocos_abertos: 420 },
  205: { data_abertura: '2026-08-10', blocos_abertos: 190 }, 206: { data_abertura: '2026-08-18', blocos_abertos: null },
  207: { data_abertura: '2026-08-20', blocos_abertos: 400 },
};
const LOTES_INDICADORES_DEMO = ([
  [199, '2026-03-02', 'SH', 400], [200, '2026-04-06', 'SH', 420],
  [201, '2026-05-04', 'SH', 420], [202, '2026-05-11', 'SH', 380], [203, '2026-05-18', 'SB', 300],
  [204, '2026-06-02', 'SH', 450], [205, '2026-06-09', 'SP', 216], [206, '2026-06-16', 'SH', 400],
  [207, '2026-07-06', 'SH', 430], [208, '2026-07-13', 'SB', 280], [209, '2026-07-20', 'SH', 410],
  [210, '2026-08-03', 'SH', 460], [211, '2026-08-10', 'SH', 440], [212, '2026-08-17', 'SB', 300], [213, '2026-08-24', 'SH', 200],
] as const).map(([id, data_lote, tipo, blocos_produzidos]) => ({ id, data_lote, tipo, blocos_produzidos, ...ABERTURAS_INDICADORES_DEMO[id] }));
const COLHEITAS_INDICADORES_DEMO = ([
  [199, '2026-04-14', 18.2, null, 8.2, 6, 4, 0], [199, '2026-05-12', 32.5, null, 14.5, 11, 6, 1], [199, '2026-05-20', 18.0, null, 9, 6, 3, 0],
  [200, '2026-06-08', 35.2, null, 15.2, 12, 7, 1], [200, '2026-06-15', 21.4, null, 11.4, 6, 4, 0], [199, '2026-06-22', 6.1, null, 4.1, 2, 0, 0],
  [201, '2026-07-07', 30.8, null, 12.8, 10, 7, 1], [202, '2026-07-14', 27.5, null, 15.5, 8, 4, 0], [201, '2026-07-21', 12.2, null, 6.2, 4, 2, 0],
  [204, '2026-08-04', 36.4, 'F1/3', 13.4, 12, 9, 2], [203, '2026-08-11', 22.0, 'F3/2', null, null, null, null],
  [202, '2026-08-18', 15.3, 'F2/1', 8.3, 5, 2, 0], [204, '2026-08-19', 14.1, 'F1/5', 6.1, 5, 3, 0],
] as const).map(([lote_id, data_colheita, total_kg, estante, kg_p, kg_m, kg_g, kg_gg]) => ({ lote_id, data_colheita, total_kg, estante, kg_p, kg_m, kg_g, kg_gg }));
const EVENTOS_INDICADORES_DEMO = ([
  [199, 'CONTAMINACAO', 15, '2026-04-10'], [199, 'CONTAMINACAO', 20, '2026-05-08'], [200, 'CONTAMINACAO', 12, '2026-05-22'],
  [201, 'CONTAMINACAO', 25, '2026-06-05'], [203, 'CONTAMINACAO', 30, '2026-06-19'],
  [204, 'CONTAMINACAO', 18, '2026-07-03'], [205, 'CONTAMINACAO', 16, '2026-07-17'], [206, 'CONTAMINACAO', 9, '2026-07-24'],
  [207, 'CONTAMINACAO', 22, '2026-08-06'], [208, 'CONTAMINACAO', 14, '2026-08-13'], [208, 'PERDA', 5, '2026-08-14'],
  [210, 'CONTAMINACAO', 11, '2026-08-20'],
] as const).map(([lote_id, tipo, quantidade, data_evento]) => ({ lote_id, tipo, quantidade, data_evento }));
const EMBALAGEM_INDICADORES_DEMO = ([
  ['2026-04-14', 1, 85], ['2026-05-12', 1, 150], ['2026-05-20', 1, 80], ['2026-06-08', 1, 160], ['2026-06-15', 1, 95],
  ['2026-07-07', 1, 140], ['2026-07-14', 1, 120], ['2026-07-21', 1, 55],
  ['2026-08-04', 1, 170], ['2026-08-11', 5, 100], ['2026-08-18', 1, 70], ['2026-08-19', 1, 65],
] as const).map(([data, embalagem_produto_id, quantidade]) => ({ data, embalagem_produto_id, quantidade }));

const ABERTURAS_POR_SALA_DEMO = [
  { lote_id: 204, sala_destino: 'F1', estante_destino: '3', data: '2026-08-01', quantidade: 420 },
  { lote_id: 203, sala_destino: 'F3', estante_destino: '2', data: '2026-08-04', quantidade: 260 },
];

const SEMENTES_INDICADORES_DEMO = ([
  [199, 1, '20155', null, null], [200, 1, '20155', null, null], [201, 2, '20388', null, null], [202, 1, '20388', null, null],
  [203, 3, '20388', null, null], [204, 1, '20460', 'LS-0601', '2026-09-28'], [205, 4, '20460', 'LS-0415', '2026-09-08'],
  [206, 1, '20488', 'LS-0601', '2026-09-28'], [206, 2, '20488', 'LS-0510', '2026-10-09'], [207, 1, '20488', 'LS-0702', '2026-10-19'],
  [208, 3, '20520', 'LS-0322', '2026-10-06'], [209, 2, '20520', 'LS-0510', '2026-10-09'], [210, 1, '20577', 'LS-0702', '2026-10-19'],
  [211, 1, '20577', 'LS-0803', '2026-11-04'], [212, 3, '20577', 'LS-0322', '2026-10-06'],
] as const).map(([lote_id, cepa_id, nf, lote_semente, vencimento], i) => ({ id: i + 1, lote_id, cepa_id, nf, lote_semente, vencimento }));

const SAIDAS_DE_SEMENTE_INDICADORES_DEMO = ([
  ['2026-03-03', 'Shiitake', 25, false], ['2026-03-03', 'Shiitake', 30, true], ['2026-04-07', 'Shiitake', 26, false],
  ['2026-05-05', 'Shiitake', 26, false], ['2026-05-19', 'Shimeji Branco', 19, false], ['2026-06-03', 'Shiitake', 28, false],
] as const).map(([data, tipo_cogumelo, quantidade, ajuste]) => ({ data, tipo: 'SAIDA', ajuste, tipo_cogumelo, quantidade }));

export function indicadoresDemo(params: Record<string, string | undefined>): IndicadoresDoPainel {
  return indicadoresDoPainel(
    {
      lotes: LOTES_INDICADORES_DEMO, colheitas: COLHEITAS_INDICADORES_DEMO, eventos: EVENTOS_INDICADORES_DEMO, aberturasPorLote: ABERTURAS_POR_SALA_DEMO,
      sementesDosLotes: SEMENTES_INDICADORES_DEMO, cepas: CEPAS, sementesMovimentos: SAIDAS_DE_SEMENTE_INDICADORES_DEMO,
    },
    { produtos: EMBALAGEM_PRODUTOS, registros: EMBALAGEM_INDICADORES_DEMO },
    { periodo: params.periodo, mes: params.mes, ano: params.ano, lote: params.lote, tipo: params.tipo, hoje: HOJE_PAINEL_DEMO },
  ) as IndicadoresDoPainel;
}

const FX_PAINEL_MATERIA_PRIMA: NonNullable<PainelOperacionalResposta['materia_prima']> = {
  linhas: [
    {
      materia_prima_id: 2, materia_prima: 'Farelo de Trigo', estoque_informado: 7,
      unidade: 'apresentacao', consumo_apresentacao_dia: 3.5,
      dias_de_cobertura: 2, semaforo: 'VERMELHO',
    },
    {
      materia_prima_id: 1, materia_prima: 'Serragem', estoque_informado: 120,
      unidade: 'apresentacao', consumo_apresentacao_dia: 24,
      dias_de_cobertura: 5, semaforo: 'VERDE',
    },
    {
      materia_prima_id: 7, materia_prima: 'Semente Shiitake', semente_tipo: 'Shiitake',
      estoque_informado: 38, unidade: 'apresentacao', consumo_apresentacao_dia: 2.86,
      dias_de_cobertura: 13.3, semaforo: 'VERDE',
    },
    {
      materia_prima_id: 7, materia_prima: 'Semente Shimeji Branco', semente_tipo: 'Shimeji Branco',
      estoque_informado: 67, unidade: 'apresentacao', consumo_apresentacao_dia: 0.5,
      dias_de_cobertura: 134, semaforo: 'VERDE',
    },
    {
      materia_prima_id: 8, materia_prima: 'Saquinho', estoque_informado: 3,
      unidade: 'apresentacao', consumo_apresentacao_dia: 0.004,
      dias_de_cobertura: 750, semaforo: 'VERDE',
    },
  ],
  sem_cobertura: [
    {
      materia_prima_id: 5, materia_prima: 'Calcário',
      estoque_informado: -2, motivo: 'estoque negativo',
    },
    {
      materia_prima_id: 3, materia_prima: 'Germen de Milho', estoque_informado: 9,
      motivo: 'previsao incompleta',
      receitas_sem_ritmo: ['Receita Shimeji Branco', 'Shiitake - Receita Antiga (RECEITA EM TESTE)'],
    },
    {
      materia_prima_id: 6, materia_prima: 'Gesso',
      estoque_informado: 5, motivo: 'nao consumida hoje',
    },
    {
      materia_prima_id: 4, materia_prima: 'Painço',
      estoque_informado: null, motivo: 'sem apresentacao cadastrada',
    },
    {
      materia_prima_id: 7, materia_prima: 'Semente Shimeji Preto', semente_tipo: 'Shimeji Preto',
      estoque_informado: 30, motivo: 'previsao incompleta',
    },
    {
      materia_prima_id: 9, materia_prima: 'Vermiculita',
      estoque_informado: 12, motivo: 'nenhuma receita usa',
    },
  ],
  resumo: { itens: 11, calculados: 5, sem_cobertura: 6 },
};

const FRASE_PENDENCIA_MP_DEMO = '4 matéria(s)-prima(s) estão sem cobertura calculável; o motivo '
  + 'de cada uma está no bloco Cobertura de Matéria-Prima. Falta a apresentação das '
  + 'matérias-primas (quantos kg tem o saco ou a caixa). Falta o estoque atual de cada uma. '
  + 'Falta a previsão de produção de todas as semanas do horizonte (em Compras de '
  + 'Matéria-Prima). Cadastro de matéria-prima não se ajusta por esta tela. 1 matéria(s)-prima(s) '
  + 'não entram em receita nenhuma. Para essas, não há nada a informar aqui: ou alguma receita '
  + 'passa a usá-las, ou elas saem do cadastro. 1 matéria(s)-prima(s) fora do cálculo são as que '
  + 'não rodam hoje, e isso ela já informou.';

export async function painelOperacional(
  params: Record<string, string | undefined>,
): Promise<PainelOperacionalResposta> {
  const [ciclo, fila, sementesEst] = await Promise.all([
    producaoPainelCiclo(params), producaoPrevisaoAbertura(params), sementesEstoque(),
  ]);
  const hoje = HOJE_PAINEL_DEMO;

  const filaNoDia = fila.linhas.map((l) => comPrazoDaFila(l, hoje));
  const aberturas: PainelOperacionalAberturaLinha[] = filaNoDia.map((l) => ({
    ...l, semaforo: semaforoAberturaDemo(l.dias_restantes),
  }));

  const proximas: PainelOperacionalSementeProxima[] = sementesEst.proximas.map((p) => {
    const daCepa = sementesEst.cepas.find((c) => c.cepa === p.cepa);
    const nfDaValidade = daCepa?.nfs.find((n) => (n.valores[p.validade] ?? 0) > 0)?.nf ?? null;
    return {
      cepa_id: CEPAS.find((c) => c.codigo === p.cepa)?.id ?? null,
      codigo: p.cepa,
      tipo_cogumelo: p.tipo_cogumelo,
      saldo: daCepa?.valores[p.validade] ?? 0,
      validade: p.validade,
      nf: nfDaValidade,
      vencida: p.validade < hoje,
    };
  });

  const emMaturacao = new Set(aberturas.map((l) => l.lote_chave));
  const posicao_blocos = {
    ...ciclo.totais,
    enderecos: ciclo.totais.cobertura.estantes,
    lotes: ciclo.eficiencia.total.lotes,
    em_maturacao_enderecos: aberturas.length,
    em_maturacao_lotes: emMaturacao.size,
    vencidos: aberturas.filter((l) => l.situacao === 'VENCIDO').length,
    proximos: aberturas.filter((l) => l.situacao === 'PROXIMO').length,
  };

  const lotesDivergentesDemo: PainelOperacionalDivergenciaLote[] = ciclo.rankings.menor_contaminacao
    .filter((l) => l.divergente)
    .map((l) => ({
      lote_chave: l.chave,
      data_lote: l.data_lote,
      tipo: l.tipo,
      galpao: l.galpoes.join(', ') || null,
      estantes: l.estantes,
      blocos_produzidos: l.blocos_produzidos,
      blocos_contaminados: l.blocos_contaminados,
      blocos_abertos: l.blocos_abertos,
      blocos_perdidos: l.blocos_perdidos,
      sobra: l.perda_total_blocos,
      inconsistente: l.inconsistente,
    }));
  const divergencias = { tolerancia: 10, ...VALIDACOES_DO_CICLO_DEMO, hoje, lotes: lotesDivergentesDemo };

  const estourada = (l: PrevisaoAberturaLinha): PainelOperacionalEstanteEstourada => ({
    estante_id: l.estante_id, lote_chave: l.lote_chave, data_lote: l.data_lote, tipo: l.tipo,
    galpao: l.galpao, estante: l.estante, status: l.estante_parcialmente_aberta ? 'FRUTIFICACAO' : 'INCUBACAO',
    produzidos: l.blocos_guardados ?? 0, retirados: l.blocos_contaminados, abertos: l.blocos_abertos ?? 0,
    saldo: l.blocos_disponiveis ?? 0, data_abertura: l.estante_parcialmente_aberta ? hoje : null,
    abertura_concluida: false, em_maturacao: true,
  });
  const emMaturacaoEstouradas = [...fila.linhas, ...fila.fora_da_fila]
    .filter((l) => l.blocos_disponiveis != null && l.blocos_disponiveis < 0)
    .map(estourada)
    .sort((a, b) => a.saldo - b.saldo);
  const conta_nao_fecha = { total: emMaturacaoEstouradas.length, em_maturacao: emMaturacaoEstouradas, ja_abertas: [] };

  const top: PainelOperacionalContaminacaoLinha[] = ciclo.rankings.menor_contaminacao
    .filter((l) => l.taxa_contaminacao != null)
    .map((l) => ({
      lote: l.chave,
      tipo: l.tipo,
      estantes: l.estantes_maturacao,
      blocos_contaminados: l.blocos_contaminados,
      total_blocos: l.blocos_produzidos,
      pct: l.taxa_contaminacao as number,
      semaforo: semaforoContaminacaoDemo(l.taxa_contaminacao as number),
      inconsistente: Boolean(l.inconsistente) || (l.taxa_contaminacao as number) > 1,
    }))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 10);
  const razao = (n: number, d: number) => (d > 0 ? n / d : null);
  const geralContaminacao = razao(ciclo.totais.blocos_contaminados, ciclo.totais.blocos_produzidos);
  const contaminacao = {
    top,
    por_tipo: ciclo.totais.por_tipo,
    geral: geralContaminacao,
    por_tipo_taxa: ciclo.totais.por_tipo.map((t) => ({
      tipo: t.tipo, pct: razao(t.blocos_contaminados, t.blocos_produzidos),
    })),
  };

  const colheitasAteHoje = COLHEITAS_INDICADORES_DEMO
    .filter((c) => c.data_colheita <= hoje)
    .sort((a, b) => b.data_colheita.localeCompare(a.data_colheita));
  const daSemana = colheitasAteHoje.filter((c) => c.data_colheita >= somaDias(hoje, -6));
  const colheita = {
    dado_ate: colheitasAteHoje[0]?.data_colheita ?? null,
    kg_hoje: null,
    kg_hoje_por_faixa: null,
    kg_hoje_por_tipo: null,
    kg_7_dias: daSemana.length ? Math.round(daSemana.reduce((s, c) => s + c.total_kg, 0) * 100) / 100 : null,
    ultimas: colheitasAteHoje.slice(0, 10).map((c, i) => ({
      id: i + 1, lote_id: c.lote_id, data_colheita: c.data_colheita,
      kg_p: c.kg_p, kg_m: c.kg_m, kg_g: c.kg_g, kg_gg: c.kg_gg, total_kg: c.total_kg,
    })),
    melhores: ciclo.rankings.maior_kg_por_bloco_aberto,
    piores: [...ciclo.rankings.maior_kg_por_bloco_aberto].reverse(),
    excluidos: ciclo.rankings.excluidos,
  };

  const insumos = insumosDoPainelDemo();
  const materia_prima = clonar(FX_PAINEL_MATERIA_PRIMA);

  const alertas: PainelOperacionalAlerta[] = [];
  const add = (
    tipo: string, severidade: 'VERMELHO' | 'AMARELO',
    mensagem: string, detalhe: Record<string, unknown> | null,
  ) => { alertas.push({ tipo, severidade, mensagem, detalhe }); };

  for (const l of aberturas) {
    const onde = { galpao: l.galpao, estante: l.estante, tipo: l.tipo };
    const ondeTxt = [l.galpao ? `galpao ${galpaoDaDemo(l.galpao)}` : null, l.estante ? `estante ${l.estante}` : null]
      .filter(Boolean).join(', ');
    const suf = ondeTxt ? `, ${ondeTxt}` : '';
    if (l.semaforo === 'VERMELHO') {
      add('ABERTURA_VENCIDA', 'VERMELHO',
        `Lote ${chaveLoteDemo(l.lote_chave)} atrasado para abertura ha ${ptBr(Math.abs(l.dias_restantes as number))} dia(s)${suf}`,
        onde);
    } else if (l.semaforo === 'AMARELO') {
      add('ABERTURA_PROXIMA', 'AMARELO',
        l.dias_restantes === 0
          ? `Lote ${chaveLoteDemo(l.lote_chave)} abre hoje${suf}`
          : `Lote ${chaveLoteDemo(l.lote_chave)} abre em ${ptBr(l.dias_restantes as number)} dia(s)${suf}`,
        onde);
    }
  }
  for (const s of proximas) {
    if (s.vencida) {
      add('SEMENTE_VENCIDA', 'VERMELHO',
        `Semente ${s.codigo} passou do limite de utilizacao`,
        { codigo: s.codigo, validade: s.validade, saldo: s.saldo });
    }
  }
  for (const c of top) {
    if (c.semaforo === 'VERMELHO') {
      add('CONTAMINACAO_CRITICA', 'VERMELHO',
        `Contaminacao de ${ptBr(c.pct * 100)}% no lote ${chaveLoteDemo(c.lote)}`,
        { lote: c.lote, pct: c.pct });
    }
  }
  for (const l of divergencias.lotes) {
    const galpaoTxt = l.galpao ? `, galpao ${galpaoDaDemo(l.galpao)}` : '';
    const direcao = l.inconsistente ? ': abriu mais blocos do que produziu' : '';
    add('DIVERGENCIA_CONTAGEM', 'VERMELHO',
      `Divergencia de ${ptBr(l.sobra ?? 0)} blocos no lote ${chaveLoteDemo(l.lote_chave)}${galpaoTxt}${direcao} (tolerancia ${ptBr(divergencias.tolerancia)})`,
      { ...l });
  }
  for (const m of materia_prima.linhas) {
    if (m.semaforo === 'VERMELHO') {
      add('MATERIA_PRIMA_BAIXA', 'VERMELHO',
        `COMPRA URGENTE: ${m.materia_prima} com ${ptBr(m.dias_de_cobertura)} dia(s) de cobertura`,
        { materia_prima: m.materia_prima, dias_de_cobertura: m.dias_de_cobertura });
    }
  }
  for (const i of insumos.linhas) {
    const detalhe = { id: i.id, descricao: i.descricao, dias_de_cobertura: i.dias_de_cobertura };
    const espec = i.especificacao ? ` (${i.especificacao})` : '';
    if (i.semaforo === 'VERMELHO') {
      add('INSUMO_BAIXO', 'VERMELHO',
        `COMPRA URGENTE: ${i.descricao}${espec} com ${ptBr(i.dias_de_cobertura)} dia(s) de cobertura`, detalhe);
    } else if (i.semaforo === 'AMARELO') {
      add('INSUMO_ATENCAO', 'AMARELO',
        `PROGRAMAR COMPRA: ${i.descricao}${espec} com ${ptBr(i.dias_de_cobertura)} dia(s) de cobertura`, detalhe);
    }
  }
  alertas.sort((a, b) => (a.severidade === 'VERMELHO' ? 0 : 1) - (b.severidade === 'VERMELHO' ? 0 : 1));

  const venceHoje = aberturas.filter((l) => l.dias_restantes === 0).length;

  const sem_dado = [
    {
      bloco: 'MATERIA_PRIMA',
      titulo: 'Alerta de compra de matéria-prima',
      motivo: FRASE_PENDENCIA_MP_DEMO,
    },
    {
      bloco: 'MANUTENCOES',
      titulo: 'Manutenções e higienizações pendentes',
      motivo: 'Não existe cadastro de manutenção no sistema. Segunda etapa.',
    },
  ];

  const colheita_embalagem = blocoColheitaEmbalagem(dadosDaConferenciaDemo(), { corte: '2026-04-05', hoje: HOJE_EMBALAGEM_DEMO }) as ColheitaEmbalagemBloco;
  const indicadores = indicadoresDemo(params);
  const janela = janelaDoPeriodo({ periodo: params.periodo, mes: params.mes, ano: params.ano, lote: params.lote, hoje: HOJE_PAINEL_DEMO });
  const colheita_embalagem_do_periodo = conferenciaDoPeriodo(dadosDaConferenciaDemo(), janela,
    { corte: '2026-04-05', hoje: HOJE_EMBALAGEM_DEMO, tipo: params.tipo }) as ColheitaEmbalagemBloco;

  const resposta = {
    hoje,
    dado_ate: colheita.dado_ate,
    ultimos_lancamentos: { producao: '2026-08-21', abertura: '2026-08-18', retirada: '2026-08-25', colheita: colheita.dado_ate, embalagem: '2026-08-19' },
    indicadores,
    colheita_embalagem_do_periodo,
    proximas_aberturas: {
      linhas: aberturas,
      resumo: resumoDasLinhasDaFila(filaNoDia),
      parametros_dias: { SH: 90, SB: 30, SP: 30, SS: 30 },
      horizonte_dias: 7,
    },
    sementes: {
      proximas,
      estoque: {
        proxima_por_tipo: sementesEst.proximas.map((p) => ({
          tipo_cogumelo: p.tipo_cogumelo, validade: p.validade, cepas: [p.cepa],
        })),
      },
    },
    posicao_blocos,
    divergencias,
    conta_nao_fecha,
    contaminacao,
    colheita,
    insumos,
    materia_prima,
    alertas,
    cabecalho: {
      blocos_em_processo: fila.resumo.cobertura.blocos_somados,
      lotes_em_maturacao: posicao_blocos.em_maturacao_lotes,
      aberturas_urgentes: alertas.filter((a) => a.tipo === 'ABERTURA_VENCIDA').length + venceHoje,
      aberturas_vencidas: alertas.filter((a) => a.tipo === 'ABERTURA_VENCIDA').length,
      aberturas_vencem_hoje: venceHoje,
      kg_colhidos: colheita.kg_hoje,
      contaminacao_pct: contaminacao.geral,
      contaminacao_semaforo: geralContaminacao == null ? null
        : (semaforoContaminacaoDemo(geralContaminacao) as 'VERDE' | 'AMARELO' | 'VERMELHO'),
      alertas_criticos: alertas.filter((a) => a.severidade === 'VERMELHO').length + venceHoje,
      dado_ate: colheita.dado_ate,
    },
    sem_dado,
    capacidade: capacidadeDemo(),
    pendencias: pendenciasDemo(hoje),
    colheita_embalagem,
  };

  return { ...resposta, painel_de_comando: painelDeComando(resposta) as PainelDeComando };
}
