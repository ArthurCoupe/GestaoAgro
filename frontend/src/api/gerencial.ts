import { type BudgetDaLinha, type DreNovaBudget, type VisaoNova } from './dreNova';
import { DEFINICOES } from './definicoes';
import { PERGUNTAS } from './perguntasGerenciais';

const fin = await import('./demoFinanceiro');

export type AtividadeChave =
  | 'PRODUCAO_COGUMELO'
  | 'PIMENTAO'
  | 'PRODUCAO_SEM_QUEBRA'
  | 'REVENDA'
  | 'CORPORATIVO'
  | 'NAO_RATEADO';

export type Regime = 'COMPETENCIA' | 'CAIXA';
export type Etiqueta = '[COMPETÊNCIA]' | '[CAIXA]';

export interface Escada {
  receita_bruta: number;
  deducoes: number;
  receita_liquida: number;
  custos_diretos: number;
  despesas_diretas: number;
  despesas_compartilhadas: number;
  resultado_operacional: number;
  margem_operacional_pct: number | null;
  impostos: number;
  financeiro: number;
  resultado_competencia: number;
  margem_pct: number | null;
  ajustes_financeiros: number;
  capex: number;
  socios: number;
  resultado_caixa: number;
}

export type ChaveDaEscadaPorAtividade = AtividadeChave | 'PRODUCAO';

export type Variedade = 'SH' | 'SP' | 'SB' | 'SS';
export type ChaveDaVariedade = Variedade | 'SEM_ESPECIE';
export const ORDEM_DA_VARIEDADE: ChaveDaVariedade[] = ['SH', 'SP', 'SB', 'SS', 'SEM_ESPECIE'];
export const ROTULO_DA_VARIEDADE: Record<ChaveDaVariedade, string> = { SH: 'Shiitake', SP: 'Shimeji Preto', SB: 'Shimeji Branco', SS: 'Salmão', SEM_ESPECIE: 'sem espécie' };
export const ehVariedade = (chave: string): chave is ChaveDaVariedade => (ORDEM_DA_VARIEDADE as string[]).includes(chave);

export interface EscadaPorAtividade {
  total: Escada;
  por_atividade: Record<ChaveDaEscadaPorAtividade, Escada>;
  por_variedade?: Record<ChaveDaVariedade, Escada>;
}

export interface ExecutivoLinhaFolha {
  linha_id: string;
  codigo_oficial: string | null;
  rotulo: string;
  grupo: number;
  valor: number;
}

export interface LimiaresAlerta {
  atencao_pct: number;
  critico_pct: number;
  piso_reais: number;
  minimo_meses: number;
}

export const CAMPOS_DA_ESCADA: Array<{ campo: keyof Escada; rotulo: string; tipo: 'valor' | 'total' | 'pct'; grupo?: number; separado?: boolean; soRegime?: Regime; dependeDeReceita?: boolean }> = [
  { campo: 'receita_bruta', rotulo: 'Receita bruta', tipo: 'valor', grupo: 1, dependeDeReceita: true },
  { campo: 'deducoes', rotulo: 'Deduções e impostos sobre a receita', tipo: 'valor', grupo: 2, dependeDeReceita: true },
  { campo: 'receita_liquida', rotulo: 'Receita líquida', tipo: 'total', dependeDeReceita: true },
  { campo: 'custos_diretos', rotulo: 'Custos diretos', tipo: 'valor', grupo: 3 },
  { campo: 'despesas_diretas', rotulo: 'Despesas diretas', tipo: 'valor', grupo: 4 },
  { campo: 'despesas_compartilhadas', rotulo: 'Despesas compartilhadas', tipo: 'valor', grupo: 5 },
  { campo: 'resultado_operacional', rotulo: 'Resultado operacional', tipo: 'total', dependeDeReceita: true },
  { campo: 'margem_operacional_pct', rotulo: 'Margem operacional', tipo: 'pct', dependeDeReceita: true },
  { campo: 'financeiro', rotulo: 'Resultado financeiro', tipo: 'valor', grupo: 7, dependeDeReceita: true },
  { campo: 'impostos', rotulo: 'Impostos sobre o resultado', tipo: 'valor', grupo: 6, dependeDeReceita: true },
  { campo: 'resultado_competencia', rotulo: 'Resultado por competência', tipo: 'total', dependeDeReceita: true },
  { campo: 'margem_pct', rotulo: 'Margem por competência', tipo: 'pct', dependeDeReceita: true },
  { campo: 'ajustes_financeiros', rotulo: 'Ajustes financeiros', tipo: 'valor', grupo: 8, separado: true },
  { campo: 'capex', rotulo: 'CAPEX', tipo: 'valor', grupo: 9, separado: true },
  { campo: 'socios', rotulo: 'Movimentação de sócios', tipo: 'valor', grupo: 10, separado: true },
  { campo: 'resultado_caixa', rotulo: 'Resultado de Caixa', tipo: 'total', separado: true, soRegime: 'CAIXA' },
];

export function rotulosDaEscada(regime: Regime): Record<keyof Escada, string> {
  const r = Object.fromEntries(CAMPOS_DA_ESCADA.map((c) => [c.campo, c.rotulo])) as Record<keyof Escada, string>;
  if (regime === 'CAIXA') {
    r.resultado_competencia = 'Resultado após financeiro e impostos';
    r.margem_pct = 'Margem após financeiro e impostos';
  }
  return r;
}

const PERGUNTA_RO = 'A operação da empresa está sendo rentável? Quanto a atividade gera com aquilo que é próprio da operação?';
const perguntaRC = (regime: Regime) =>
  `Depois de considerar tudo o que ${regime === 'CAIXA' ? 'foi efetivamente recebido e pago neste período' : 'pertence economicamente a este período'} e afeta o resultado, quanto a empresa efetivamente gerou de resultado e qual foi sua margem?`;

export function infoDaEscada(campo: keyof Escada, regime: Regime): { pergunta: string; formula: string } | null {
  const c = CAMPOS_DA_ESCADA.find((x) => x.campo === campo);
  if (c?.soRegime && c.soRegime !== regime) return null;
  const rc = rotulosDaEscada(regime).resultado_competencia;
  switch (campo) {
    case 'receita_liquida': return { pergunta: regime === 'CAIXA' ? 'Quanto sobrou da receita depois das deduções e dos impostos sobre a receita?' : PERGUNTAS.receita_liquida, formula: 'Receita bruta − deduções' };
    case 'resultado_operacional': return { pergunta: regime === 'CAIXA' ? PERGUNTA_RO : PERGUNTAS.resultado_operacional, formula: DEFINICOES.resultado_operacional.formula };
    case 'margem_operacional_pct': return { pergunta: regime === 'CAIXA' ? PERGUNTA_RO : PERGUNTAS.margem_operacional, formula: DEFINICOES.margem_operacional.formula };
    case 'resultado_competencia': return { pergunta: regime === 'CAIXA' ? perguntaRC(regime) : PERGUNTAS.resultado_competencia, formula: DEFINICOES.resultado_competencia.formula };
    case 'margem_pct': return { pergunta: perguntaRC(regime), formula: `${rc} ÷ receita líquida` };
    case 'resultado_caixa': return { pergunta: 'Considerando o que efetivamente entrou e saiu de dinheiro neste período, qual foi o Resultado de Caixa da empresa?', formula: `${rc} + ajustes + CAPEX + sócios` };
    default: return null;
  }
}

export const PERGUNTAS_DAS_TELAS = {
  competencia: 'Qual foi o desempenho econômico da empresa no período?',
  caixa: 'O que efetivamente aconteceu com o dinheiro da empresa no período?',
  ponte: 'Por que o Resultado por Competência e o Resultado de Caixa são diferentes, e o que explica a diferença?',
} as const;

export const ROTULOS_DOS_BALDES = {
  a: 'Pertence ao período, ainda não recebido ou pago',
  b: 'Entrou ou saiu neste período, mas pertence a outro',
  c: 'Só caixa: CAPEX, sócios e patrimonial',
} as const;

export interface AlavancaPreco {
  pct: number;
  reais: number;
  receita_necessaria: number;
}

export interface AlavancaCorte {
  reais: number;
  pct: number | null;
}

export interface AlavancaContaminacao {
  taxa_pct: number;
  meta_pct: number;
  blocos_recuperaveis: number;
  impacto_reais: number;
  cobre_gap: boolean;
}

export interface AlavancaCombinacao {
  aplicada: 'CONTAMINACAO' | null;
  recupera: number;
  restante: number;
  complementos: {
    custos_pct: number | null;
    despesas_pct: number | null;
    preco_pct: number | null;
  };
}

export interface AlavancasResposta {
  objetivo_pct: number;
  resultado_alvo: number | null;
  gap: number | null;
  ja_atingido: boolean;
  preco: AlavancaPreco | null;
  custos: AlavancaCorte | null;
  despesas: AlavancaCorte | null;
  contaminacao: AlavancaContaminacao | null;
  combinacao: AlavancaCombinacao | null;
  premissas: string[];
}

export interface PeriodoApurado {
  inicio: string;
  fim: string;
  meses: string[];
}

export interface ExecutivoAconteceu {
  receita_liquida: number | null;
  custos: number | null;
  despesas: number | null;
  resultado_operacional: number | null;
  resultado_liquido: number | null;
  financeiro_e_ajustes: number | null;
  custos_pct: number | null;
  despesas_pct: number | null;
  margem_liquida_pct: number | null;
  meta_pct: number;
  meta_origem?: 'BUDGET' | 'MARGEM_DESEJADA';
  margem_minima_pct?: number | null;
  margem_desejada_configurada_pct?: number | null;
  atinge_meta: boolean | null;
  composicao: { custos_codigos: (string | null)[]; despesas_codigos: (string | null)[] };
}

export interface ExecutivoObjetivos {
  ponto_equilibrio: number | null;
  margem_seguranca_pct: number | null;
  margem_seguranca_reais: number | null;
  margem_desejada_pct: number;
  faturamento_para_meta: number | null;
  disponivel: boolean;
  faltas: string[];
  fixos: number | null;
  variaveis: number | null;
  margem_contribuicao: number | null;
  margem_contribuicao_pct: number | null;
}

export interface AtividadeSerieMensal {
  mes: string;
  receita: number | null;
  custos: number | null;
  despesas: number | null;
  resultado: number | null;
}

export interface ExecutivoAtividade {
  chave: AtividadeChave;
  rotulo: string;
  receita: number;
  custos: number;
  despesas: number;
  resultado: number;
  margem_pct: number | null;
  serie_mensal?: AtividadeSerieMensal[];
}

export interface ExecutivoMix {
  receita: Record<AtividadeChave, number | null>;
  contribuicao: Record<AtividadeChave, number | null>;
  aviso: string | null;
}

export interface ExecutivoCaminhoOrdemItem {
  chave: AtividadeChave;
  rotulo: string;
  margem_pct: number;
  acao: 'PRIORIZAR' | 'MANTER' | 'REVISAR';
}

export interface ExecutivoCaminhos {
  mantendo_mix: { faturamento_para_meta: number | null; premissas: string[] };
  melhorando_eficiencia: {
    recuperar_reais: number | null;
    perdas_recuperaveis: number | null;
    custos_e_despesas: number | null;
    premissas: string[];
  };
  otimizando_mix: { ordem: ExecutivoCaminhoOrdemItem[]; premissas: string[] };
}

export interface ExecutivoComposicaoCusto {
  linha_id: string;
  rotulo: string | null;
  valor: number;
  participacao_pct: number | null;
}

export interface ExecutivoSerieMensal {
  mes: string;
  receita_liquida: number | null;
  custos: number | null;
  despesas: number | null;
  resultado_operacional: number | null;
  margem_pct: number | null;
  ponto_equilibrio: number | null;
  margem_seguranca_reais: number | null;
  margem_seguranca_pct: number | null;
  escada: EscadaPorAtividade | null;
  linhas: ExecutivoLinhaFolha[];
  linhas_por_chave?: Partial<Record<ChaveDaEscadaPorAtividade | ChaveDaVariedade, ExecutivoLinhaFolha[]>>;
}

export type BlocoComposicao = 'receita' | 'custos' | 'despesas';

export interface LinhaComposicao {
  linha_id: string;
  codigo_oficial: string | null;
  rotulo: string | null;
  valor: number;
  participacao_pct: number | null;
  quantidade_lancamentos: number;
}

export interface ExecutivoComposicao {
  receita: LinhaComposicao[];
  custos: LinhaComposicao[];
  despesas: LinhaComposicao[];
  por_atividade: Record<AtividadeChave, { receita: LinhaComposicao[]; custos: LinhaComposicao[]; despesas: LinhaComposicao[] }>;
}

export interface LancamentoDaLinha {
  lancamento_id: string;
  data_competencia: string | null;
  data_liquidacao: string | null;
  empresa: 'AR' | 'EXEMPLO' | null;
  codigo_conta: string | null;
  codigo_conta_erp?: string | null;
  documento: string | null;
  historico: string | null;
  origem: string | null;
  valor_no_periodo: number;
  valor_lancamento: number | null;
  fatias?: FatiaDoLancamento[];
  regra?: RegraDoLancamento | null;
}

export interface RegraDoLancamento {
  etapas: string[];
  confere: boolean | null;
}

export interface FatiaDoLancamento {
  frente: 'PRODUCAO' | 'REVENDA' | 'CORPORATIVO' | 'NAO_RATEADO';
  produto: 'COGUMELO' | 'PIMENTAO' | null;
  especie: string | null;
  valor: number;
}

export interface LancamentosDaLinhaResposta {
  etiqueta: Etiqueta;
  regime: Regime;
  periodo: PeriodoApurado;
  visao: VisaoNova;
  atividade: AtividadeChave | null;
  linha: { linha_id: string; codigo_oficial: string | null; rotulo: string | null };
  quantidade: number;
  total: number;
  limite: number;
  truncado: boolean;
  valor_cheio_so_gestao?: boolean;
  lancamentos: LancamentoDaLinha[];
}

export const CHAVES_DOS_GRUPOS = [
  'receita_bruta', 'deducoes', 'custos_diretos', 'despesas_diretas', 'despesas_compartilhadas',
  'impostos', 'financeiro', 'ajustes_financeiros', 'capex', 'socios',
] as const;
export type ChaveDoGrupo = typeof CHAVES_DOS_GRUPOS[number];
export const ehChaveDoGrupo = (campo: string): campo is ChaveDoGrupo => (CHAVES_DOS_GRUPOS as readonly string[]).includes(campo);

export interface LancamentoDoGrupo {
  lancamento_id: string;
  data_competencia: string | null;
  data_liquidacao: string | null;
  empresa: 'AR' | 'EXEMPLO' | null;
  codigo_conta: string | null;
  codigo_conta_erp?: string | null;
  documento: string | null;
  historico: string | null;
  origem: string | null;
  linhas: Array<{ linha_id: string; codigo_oficial: string | null; rotulo: string | null }>;
  valor_lancamento: number | null;
  valor_no_periodo: number;
}

export interface LancamentosDoGrupoResposta {
  etiqueta: Etiqueta;
  regime: Regime;
  periodo: PeriodoApurado;
  visao: VisaoNova;
  atividade: AtividadeChave | null;
  grupo: { chave: ChaveDoGrupo; numero: number };
  total_lancamentos: number;
  soma: number;
  limite: number;
  mostrando: number;
  valor_cheio_so_gestao?: boolean;
  lancamentos: LancamentoDoGrupo[];
}

export interface ExecutivoContaminacao {
  taxa_pct: number | null;
  meta_pct: number | null;
  blocos_produzidos: number;
  blocos_contaminados: number;
  custo_medio_bloco: number | null;
  premissa: string;
}

export interface ExecutivoVolume {
  kg: number | null;
  bandejas: number | null;
  mc_por_kg: number | null;
  mc_por_bandeja: number | null;
}

export interface LogisticaDoNegocio { custo: number | null; unidades: number | null; custo_por_unidade: number | null }
export interface LogisticaDoMes { mes: string; producao: LogisticaDoNegocio; revenda: LogisticaDoNegocio; total: number | null }
export interface LogisticaDoPeriodo {
  linhas: Array<{ codigo_oficial: string; rotulo: string }>;
  meses: LogisticaDoMes[];
  acumulado: { producao: LogisticaDoNegocio; revenda: LogisticaDoNegocio; total: number | null };
  fora_de_producao_e_revenda: number;
  meses_sem_relatorio: Array<{ empresa: 'AR' | 'EXEMPLO'; mes: string }>;
  problemas: string[];
}

export interface ExecutivoResposta {
  periodo: PeriodoApurado;
  visao: VisaoNova;
  regime: Regime;
  etiqueta: Etiqueta;
  meses_sem_fato: string[];
  cadeia_aplicada: boolean;
  aconteceu: ExecutivoAconteceu;
  objetivos: ExecutivoObjetivos;
  atividades: ExecutivoAtividade[];
  mix: ExecutivoMix;
  caminhos: ExecutivoCaminhos;
  alavancas: { EQUILIBRIO: AlavancasResposta | null; META: AlavancasResposta | null };
  composicao_custos: ExecutivoComposicaoCusto[];
  composicao: ExecutivoComposicao;
  escada: EscadaPorAtividade;
  serie_mensal: ExecutivoSerieMensal[];
  limiares_alerta: LimiaresAlerta;
  contaminacao: ExecutivoContaminacao;
  volume: ExecutivoVolume;
  avisos: string[];
  atividade?: 'PRODUCAO_COGUMELO' | 'PIMENTAO' | null;
  ultimo_lancamento: string | null;
  logistica?: LogisticaDoPeriodo | null;
  direcionador_especie?: PeriodoDoDirecionador[] | null;
  budget?: ExecutivoBudget;
  contra_o_budget?: ExecutivoLinhaContraOBudget[];
  folha_pendente?: FolhaPendente[];
  meses_provisorios?: MesProvisorio[];
  linhas_da_folha?: Array<{ linha_id: string; codigo_oficial: string | null; rotulo: string }>;
  economia?: { por_negocio: Record<string, EconomiaDoRecorte>; por_especie: Record<ChaveDaVariedade, EconomiaDoRecorte> };
}

export interface ExecutivoLinhaContraOBudget {
  linha_id: string; codigo_oficial: string | null; rotulo: string | null;
  bloco: 'receita' | 'custos' | 'despesas'; budget: number; realizado: number;
}

export interface FolhaPendente {
  mes: string; empresa: 'AR' | 'EXEMPLO'; ultimo_recorte: string | null;
  linhas: Array<{ linha_id: string; codigo_oficial: string | null; rotulo: string }>;
}

export interface MesProvisorio { mes: string; motivos: string[] }

export type SituacaoDaEconomia = 'SEM_RECEITA' | 'CLASSIFICACAO_INCOMPLETA' | 'ECONOMIA_RUIM' | 'SEM_CUSTO_FIXO' | 'ABAIXO_DA_ESCALA' | 'ACIMA_DO_EQUILIBRIO';
export interface EconomiaDoRecorte {
  receita: number; variaveis: number | null; fixos: number | null;
  margem_contribuicao: number | null; margem_contribuicao_pct: number | null;
  ponto_equilibrio: number | null; falta_para_equilibrio: number | null;
  situacao: SituacaoDaEconomia; linhas_pendentes: number;
}

export type CardDoBudget = 'receita_liquida' | 'custos' | 'despesas' | 'resultado_operacional' | 'resultado_liquido';
export type ExecutivoBudget = Omit<DreNovaBudget, 'por_linha'> & { por_card?: Partial<Record<CardDoBudget, BudgetDaLinha>> };

export interface PeriodoDoDirecionador {
  de: string;
  ate: string;
  grupos: { driver: string; contas: { codigo: string; rotulo: string }[] }[];
}

export interface CaixaSerieMensal {
  mes: string;
  entradas: number;
  saidas: number;
  resultado: number;
}

export interface CaixaAtividade {
  chave: AtividadeChave;
  rotulo: string;
  entradas: number;
  saidas: number;
  resultado: number;
}

export interface CaixaContasAReceber {
  total_em_aberto: number;
  por_empresa: Record<'AR' | 'EXEMPLO', number>;
  por_mes_emissao: Array<{ mes: string; valor: number }>;
  data_do_export: string | null;
  vencido: null;
  a_vencer: null;
  faixas: null;
  pendente: string;
}

export interface CaixaResposta {
  periodo: PeriodoApurado;
  visao: VisaoNova;
  empresa: 'AR' | 'EXEMPLO' | null;
  regime: 'CAIXA';
  etiqueta: '[CAIXA]';
  entradas: number;
  saidas: number;
  resultado_caixa: number;
  serie_mensal: CaixaSerieMensal[];
  atividades: CaixaAtividade[];
  contas_a_receber: CaixaContasAReceber;
  contas_a_pagar_em_aberto: { total: number };
  aviso_fixo: string;
  meses_sem_fato: string[];
  avisos: string[];
  meses_provisorios?: MesProvisorio[];
}

export interface PonteExemplo {
  documento: string | null;
  codigo_conta: string | null;
  empresa: 'AR' | 'EXEMPLO' | null;
  data_competencia: string;
  data_liquidacao: string | null;
  valor: number;
}

export interface PonteSerieMensal {
  mes: string;
  resultado_competencia: number;
  resultado_caixa: number;
  diferenca: number;
  lancamentos_considerados: number;
}

export interface PonteNatureza {
  tipo: 'recorrente' | 'pontual' | 'sem_base';
  frase: string;
  meses_apurados: number;
}

export interface PonteResposta {
  periodo: { inicio: string; fim: string };
  empresa: 'AR' | 'EXEMPLO' | null;
  etiquetas: { competencia: '[COMPETÊNCIA]'; caixa: '[CAIXA]' };
  resultado_competencia: number;
  resultado_caixa: number;
  diferenca: number;
  baldes: {
    a: { a_receber: number; a_pagar: number; total: number };
    b: { liquidado_fora_do_periodo: number; competencia_fora_do_periodo: number; total: number };
    c: { so_caixa: number; fora_do_resultado: number; total: number };
  };
  conciliada: boolean;
  nao_conciliada: number;
  fora_da_ponte: {
    sem_depara: { n: number; valor: number };
    sem_posicao: { n: number; valor: number };
    sem_peso_de_vendas: { n: number; valor: number; meses: string[] };
  };
  exemplos: { a: PonteExemplo[]; b: PonteExemplo[]; c: PonteExemplo[] };
  avisos: string[];
  lancamentos_considerados: number;
  serie_mensal?: PonteSerieMensal[];
  natureza?: PonteNatureza | null;
  meses_provisorios?: MesProvisorio[];
}

export const getExecutivo = (inicio: string, fim: string, visao: VisaoNova, regime?: Regime, atividade?: 'PRODUCAO_COGUMELO' | 'PIMENTAO', _comBudget?: boolean): Promise<ExecutivoResposta> =>
  fin!.getExecutivo(inicio, fim, visao, regime, atividade);

export const getCaixa = (inicio: string, fim: string, visao: VisaoNova, empresa?: 'AR' | 'EXEMPLO'): Promise<CaixaResposta> =>
  fin!.getCaixa(inicio, fim, visao, empresa);

export const getPonte = (inicio: string, fim: string, empresa?: 'AR' | 'EXEMPLO', serie?: number): Promise<PonteResposta> =>
  fin!.getPonte(inicio, fim, empresa, serie);

export const getLancamentosDaLinha = (p: {
  inicio: string; fim: string; visao: VisaoNova; linha_id: string; atividade?: AtividadeChave; regime?: Regime;
  fora?: 1;
}): Promise<LancamentosDaLinhaResposta> =>
  fin!.getLancamentosDaLinha(p);

export const getLancamentosDoGrupo = (p: {
  inicio: string; fim: string; visao: VisaoNova; grupo: ChaveDoGrupo; atividade?: AtividadeChave; regime?: Regime; limite?: number;
}): Promise<LancamentosDoGrupoResposta> =>
  fin!.getLancamentosDoGrupo(p);

export type MotivoDaPendencia = 'SEM_CORRESPONDENCIA' | 'SEM_PESO_DE_VENDAS' | 'PESO_ZERO_DE_VENDAS' | 'LINHA_SEM_LUGAR';
export interface LinhaDaPendencia { linha_id: string; codigo_oficial?: string | null; rotulo?: string | null }
export interface PendenciaDeClassificacao {
  lancamento_id: string; empresa: string; codigo_conta: string; documento: string | null; historico: string | null;
  data_competencia: string; data_liquidacao: string | null; valor: number; motivo: MotivoDaPendencia; linha: LinhaDaPendencia | null;
}
export interface PendenciasDeClassificacaoResposta {
  regime: Regime | 'AMBOS'; periodo: { inicio: string; fim: string }; quantidade: number; total: number;
  por_conta: Array<{ empresa: string; codigo_conta: string; motivo: MotivoDaPendencia; linha: LinhaDaPendencia | null; quantidade: number; valor: number }>;
  lancamentos: PendenciaDeClassificacao[];
}
export const getPendenciasDeClassificacao = (inicio: string, fim: string, regime?: Regime): Promise<PendenciasDeClassificacaoResposta> =>
  fin!.getPendenciasDeClassificacao(inicio, fim, regime);

export const getMargemDesejada = (): Promise<{ margem_desejada: number }> =>
  fin!.getMargemDesejada();

export const putMargemDesejada = (valor: number): Promise<{ margem_desejada: number }> =>
  fin!.putMargemDesejada(valor);

export interface VendaDeProduto {
  empresa: 'AR' | 'EXEMPLO';
  codigo_produto: string;
  descricao: string;
  unidade: string;
  quantidade: number;
  receita: number;
  preco_medio: number | null;
  volume_medio_mensal: number | null;
  meses_com_venda: number;
  serie_mensal?: Array<{ mes: string; quantidade: number | null; receita: number | null }>;
  quantidade_comprada?: number | null;
  preco_medio_compra?: number | null;
  margem_unitaria?: number | null;
  margem_pct?: number | null;
}
export interface VendasPorProdutoResposta {
  periodo: { inicio: string; fim: string; meses: string[] };
  meses_sem_relatorio: Array<{ empresa: 'AR' | 'EXEMPLO'; mes: string }>;
  meses_parciais?: Array<{ empresa: 'AR' | 'EXEMPLO'; mes: string; ate: string }>;
  produtos: VendaDeProduto[];
  receita_total: number;
  ex_vendido_pela_exemplo: number;
  compras: null | { empresas: Array<'AR' | 'EXEMPLO'> };
  aviso_compras: string;
}
export const getVendasPorProduto = (inicio: string, fim: string): Promise<VendasPorProdutoResposta> =>
  fin!.getVendasPorProduto(inicio, fim);

export interface VolumesDoMes {
  blocos_produzidos: number; blocos_abertos: number; kg_colhidos: number;
  blocos_contaminados: number; contaminacao_pct: number | null;
  bandejas_produzidas: number | null; bandejas_vendidas: number | null;
  rendimento: {
    lotes: number; blocos_abertos: number; kg_colhidos: number; bandejas: number;
    encerradas?: ParteDoRendimento; em_colheita?: ParteDoRendimento;
  };
}
export interface ParteDoRendimento { lotes: number; blocos_abertos: number; kg_colhidos: number; bandejas: number }
export interface VendaPorEspecie { especie: Variedade | 'OUTROS'; bandejas: number; receita: number }
export type SituacaoDoLoteDeOrigem = 'EM_MATURACAO' | 'ABERTURA_CONCLUIDA' | 'SEM_DADO_DA_ABERTURA' | 'SEM_ABERTURA';
interface DestinoDosBlocos {
  blocos_produzidos: number; blocos_contaminados: number; blocos_perdidos: number; blocos_abertos: number;
  blocos_em_maturacao: number; blocos_sem_destino: number;
}
export interface OrigemDoMes extends DestinoDosBlocos {
  lotes: number; lotes_em_maturacao: number; lotes_abertura_concluida: number; lotes_sem_dado_da_abertura: number; lotes_sem_abertura: number;
  lotes_colhendo?: number;
  concluidos: { blocos_produzidos: number; blocos_abertos: number; kg_colhidos: number };
}
export interface FaixasDoShiitake { kg_p: number; kg_m: number; kg_g: number; kg_gg: number }
export interface LoteDeOrigem extends DestinoDosBlocos {
  chave: string; data_lote: string; tipo: Variedade | null; situacao: SituacaoDoLoteDeOrigem;
  kg_colhidos: number | null; kg_p: number; kg_m: number; kg_g: number; kg_gg: number;
  colhendo?: boolean;
}
export interface LoteDaAbertura {
  chave: string; data_lote: string; tipo: Variedade; primeira_abertura: string | null; ultima_abertura: string | null;
  colhendo: boolean; blocos_abertos: number; kg_colhidos: number; bandejas: number; kg_por_mes: Array<{ mes: string; kg: number }>;
}
export interface ForaDoRendimento { abertura_sem_quantidade: number; abertura_com_zero_blocos: number; abertos_sem_colheita: number }
export interface IndicadoresDoMes {
  mes: string;
  rendimento_pela_abertura?: { lotes: LoteDaAbertura[]; fora_da_conta: ForaDoRendimento };
  producao: {
    total: VolumesDoMes; por_especie: Record<Variedade, VolumesDoMes>; vendas_por_especie: VendaPorEspecie[];
    shiitake_colhido: FaixasDoShiitake;
  };
  revenda: { bandejas_vendidas: number | null; por_especie: VendaPorEspecie[] };
  sem_vendas: string | null;
  parcial?: { mes_em_andamento: boolean; abertura_colhendo: { total: boolean; por_especie: Record<Variedade, boolean> } };
  lotes_de_origem: { total: OrigemDoMes; por_especie: Record<Variedade, OrigemDoMes>; lotes: LoteDeOrigem[] };
}
export interface AtualizacaoDosIndicadores { producao: string | null; embalagem: string | null; vendas: string | null }
export interface IndicadoresDaProducaoResposta {
  periodo: { inicio: string; fim: string }; gramas_por_bandeja: number; meses: IndicadoresDoMes[];
  atualizacao?: AtualizacaoDosIndicadores;
}

export const getIndicadoresDaProducao = (inicio: string, fim: string): Promise<IndicadoresDaProducaoResposta> =>
  fin!.getIndicadoresDaProducao(inicio, fim);

export type ComponenteDoCusto = 'MATERIA_PRIMA' | 'MAO_DE_OBRA' | 'INDIRETOS' | 'ENERGIA' | 'EMBALAGENS' | 'LOGISTICA' | 'FORA';
export interface LoteFabricadoComCusto {
  chave: string; data_lote: string | null; tipo: Variedade; situacao: SituacaoDoLoteDeOrigem; colhendo: boolean;
  blocos_produzidos: number; blocos_contaminados: number; blocos_perdidos: number; custo_dos_contaminados: number | null; custo_das_outras_perdas: number | null;
  custo_por_bloco_aproveitado_com_mao_de_obra?: number | null; custo_dos_contaminados_com_mao_de_obra?: number | null;
  custo_das_outras_perdas_com_mao_de_obra?: number | null; custo_da_retirada_e_descarte?: number | null; custo_total_das_perdas_com_mao_de_obra?: number | null;
  blocos_aproveitados: number; acima_dos_produzidos?: boolean;
  perdas_depois_da_abertura: number; custo_por_bloco_aproveitado: number | null;
}
export type MotivoSemCusto = 'sem_data' | 'fora_da_janela' | 'sem_materia_prima' | 'sem_custo_de_fabricacao' | 'sem_contagem';
export interface LoteAbertoComCusto {
  chave: string; data_lote: string | null; tipo: Variedade; colhendo: boolean; blocos_abertos: number; bandejas: number;
  mes_da_fabricacao: string | null; fabricacao_parcial: boolean; custo_por_bloco_aproveitado: number | null; custo_dos_blocos: number | null;
  sem_custo?: MotivoSemCusto | null;
  custo_por_bloco_aproveitado_com_mao_de_obra?: number | null; custo_dos_blocos_com_mao_de_obra?: number | null;
  blocos_produzidos?: number | null; blocos_aproveitados?: number | null; blocos_perdidos_no_lote?: number | null;
  blocos_perdidos_depois_da_abertura?: number | null;
  custo_por_bloco_produzido_na_origem?: number | null; bandejas_por_bloco_aberto?: number | null; custo_dos_blocos_por_bandeja?: number | null;
}
export interface ParteDaBandeja {
  lotes: number; blocos_abertos: number; bandejas: number; custo_dos_blocos: number | null; custo_dos_blocos_por_bandeja: number | null;
}
export interface MesDeFabricacao {
  mes: string; materia_prima: number | null; frete_de_insumos: number | null; custos_indiretos: number | null;
  custo_de_fabricacao: number | null; blocos_produzidos: number; custo_por_bloco_produzido: number | null; parcial: boolean;
}
export interface AbertoSemColheita {
  chave: string; data_lote: string | null; tipo: Variedade; ultima_abertura: string | null; blocos_abertos: number;
  mes_da_fabricacao: string | null; custo_por_bloco_aproveitado: number | null; custo_dos_blocos: number | null;
  blocos_baixados_depois_da_abertura: number | null;
}
export interface FichaDoLote {
  chave: string; data_lote: string | null; tipo: Variedade; situacao: SituacaoDoLoteDeOrigem;
  parcial: boolean;
  conta_de_blocos_incompleta: boolean;
  blocos_produzidos: number; blocos_contaminados: number; blocos_perdidos: number; blocos_abertos: number; blocos_em_maturacao: number;
  blocos_abertos_fora_da_conta: number;
  blocos_sem_destino: number;
  conta_fora_da_tolerancia: boolean;
  meses_da_abertura: string[];
  parcelas_por_mes: { mes: string; bandejas: number; embalagens_por_bandeja: number | null; mao_de_obra_por_bandeja: number | null }[];
  kg_colhidos: number; bandejas: number; bandejas_por_bloco_aberto: number | null;
  custo_por_bloco_produzido: number | null; custo_de_fabricacao: number | null; custo_das_perdas: number | null;
  embalagens: number | null; meses_sem_embalagens: string[];
  custo_total: number | null; custo_por_bandeja: number | null; perdas_por_bandeja: number | null;
  custo_por_bloco_produzido_com_mao_de_obra: number | null; custo_de_fabricacao_com_mao_de_obra: number | null; mao_de_obra_da_bandeja: number | null; custo_da_retirada_e_descarte: number | null;
  custo_total_com_mao_de_obra: number | null; custo_por_bandeja_com_mao_de_obra: number | null;
}
export type MotivoSemMaoDeObra = 'SEM_APURACAO' | 'SEM_CADASTRO' | 'FOLHA_PENDENTE' | 'SEM_FOLHA' | 'SALDO_NEGATIVO' | 'SEM_ENCARGOS' | 'ENCARGOS_PENDENTES' | 'SEM_SALAS';
export type AreaDaFolha = 'PRODUCAO' | 'PIMENTAO' | 'ADMINISTRATIVO' | 'VENDAS';
export type EtapaDoCusto = 'BLOCO' | 'BANDEJA' | 'ENTREGA' | 'CONTAMINACAO';
export interface AtividadeNaMaoDeObra {
  codigo: string; etapa: EtapaDoCusto | 'GERAL' | 'COMPARTILHADO'; nome: string; classificacao: string;
  versoes: number[]; horas: number | null; horas_na_conta: number | null; custo: number | null;
}
export type MaoDeObraDoMes =
  | { motivo: MotivoSemMaoDeObra; salas_de_frutificacao: number | null; atividades: [] }
  | {
    motivo: null; salas_de_frutificacao: number;
    salarios: number;
    encargos: { no_cogumelo: number; da_producao: number; proporcao_pct: number; salarios_por_area: Record<AreaDaFolha, number> };
    beneficios?: { no_cogumelo: number; da_producao: number };
    folha: number; horas_do_cadastro: number; custo_hora: number;
    folha_por_conta?: { codigo_oficial: string | null; rotulo: string; valor: number; evento_extraordinario: boolean }[];
    rescisao?: number; custo_hora_sem_rescisao?: number | null;
    participacao_por_etapa_pct?: Record<EtapaDoCusto | 'FORA', number>;
    atividades: AtividadeNaMaoDeObra[]; total: number; por_etapa: Record<EtapaDoCusto, number>; fora_do_custo_industrial: number;
    contaminacao: { custo: number; blocos_retirados_no_mes: number | null; por_bloco: number | null };
  };
export interface CustosDoMes {
  mes: string; apurado: boolean;
  parcial: { mes_em_andamento: boolean; fabricacao: boolean; bandeja: boolean };
  indicadores: {
    custo_por_bloco_produzido: number | null; custo_por_bloco_aproveitado: number | null; custo_por_bandeja_produzida: number | null;
    custo_por_bandeja_entregue: number | null; contaminacao_em_reais: number | null;
    produtividade_da_equipe: number | null; estoque_de_bandejas_prontas: number | null;
    custo_por_bloco_produzido_com_mao_de_obra?: number | null; custo_por_bloco_aproveitado_com_mao_de_obra?: number | null;
    custo_por_bandeja_produzida_com_mao_de_obra?: number | null; custo_por_bandeja_entregue_com_mao_de_obra?: number | null;
    contaminacao_em_reais_com_mao_de_obra?: number | null;
    mao_de_obra_por_bloco_produzido?: number | null; horas_homem_por_mil_blocos?: number | null;
    mao_de_obra_por_bandeja_produzida?: number | null; horas_homem_por_mil_bandejas?: number | null; mao_de_obra_da_contaminacao?: number | null;
  };
  sem_dado: { produtividade_da_equipe: string; estoque_de_bandejas_prontas: string };
  fabricacao: {
    materia_prima: number | null; custos_indiretos: number | null; custo_de_fabricacao: number | null;
    blocos_produzidos: number; blocos_contaminados: number; blocos_perdidos: number; blocos_aproveitados: number;
    perdas_depois_da_abertura: number; lotes_sem_contagem: number;
    custo_dos_contaminados: number | null; custo_das_outras_perdas: number | null; custo_total_das_perdas: number | null;
    impacto_por_bloco_aproveitado: number | null; custo_sem_perdas: number | null; lotes: LoteFabricadoComCusto[];
    mao_de_obra_do_bloco?: number | null; custo_dos_contaminados_com_mao_de_obra?: number | null; custo_das_outras_perdas_com_mao_de_obra?: number | null;
    custo_da_retirada_e_descarte?: number | null; lotes_sem_custo_da_retirada?: number; custo_total_das_perdas_com_mao_de_obra?: number | null;
  };
  bandeja: {
    lotes: LoteAbertoComCusto[]; lotes_sem_custo: number; blocos_abertos_sem_custo: number; lotes_abertos_sem_colheita: number;
    sem_custo_por?: Record<MotivoSemCusto, number>; lotes_abertos_sem_quantidade?: number;
    abertos_sem_colheita?: AbertoSemColheita[]; encerrados?: ParteDaBandeja; em_colheita?: ParteDaBandeja; meses_de_fabricacao?: MesDeFabricacao[];
    custo_dos_blocos_abertos: number | null; bandejas_dos_lotes: number;
    custo_dos_blocos_por_bandeja: number | null; embalagens: number | null; bandejas_produzidas: number | null; embalagens_por_bandeja: number | null;
    logistica: number | null; bandejas_vendidas: number | null; logistica_por_bandeja: number | null;
    lotes_sem_mao_de_obra?: number; custo_dos_blocos_abertos_com_mao_de_obra?: number | null; custo_dos_blocos_por_bandeja_com_mao_de_obra?: number | null;
    mao_de_obra_da_bandeja?: number | null; mao_de_obra_por_bandeja_produzida?: number | null;
    mao_de_obra_da_entrega?: number | null; mao_de_obra_por_bandeja_entregue?: number | null;
  };
  producao_vendida: { bandejas_vendidas: number | null; custo_da_producao_vendida: number | null; lancado_no_mes: number | null; diferenca: number | null };
  ficha_dos_lotes?: FichaDoLote[];
  composicao: Array<{ codigo_oficial: string | null; rotulo: string; componente: ComponenteDoCusto; valor: number; participacao_pct: number | null }> | null;
  total_da_composicao: number | null;
  total_na_dre: number | null;
  mao_de_obra?: MaoDeObraDoMes;
}
export interface ComponenteDoCustoNaResposta { id: ComponenteDoCusto; rotulo: string; contas?: string[]; entra: boolean; base: string | null; criterio: string }
export interface CustosDaProducaoResposta {
  periodo: { inicio: string; fim: string }; fabricacao_lida_desde: string; componentes: ComponenteDoCustoNaResposta[]; falta: string[];
  atualizacao?: AtualizacaoDosIndicadores; ultimo_lancamento?: string | null; meses: CustosDoMes[];
  salas_de_frutificacao?: { quantidade: number; nomes: string[] };
}

export const getCustosDaProducao = (inicio: string, fim: string): Promise<CustosDaProducaoResposta> =>
  fin!.getCustosDaProducao(inicio, fim);

export function etiquetaDoRegime(r: 'COMPETENCIA' | 'CAIXA'): '[COMPETÊNCIA]' | '[CAIXA]' {
  return r === 'COMPETENCIA' ? '[COMPETÊNCIA]' : '[CAIXA]';
}

export function fmtPp(n: number | null): string {
  return n == null ? '—' : `${n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} p.p.`;
}

export function avisoParaTela(a: string): string {
  return a.replace(/(^|\s)Rode:[\s\S]*$/, '').trim();
}

export function tomDaMargem(pct: number | null, meta: number, minimo: number | null = null): 'good' | 'warn' | 'alert' | 'info' {
  if (pct == null) return 'info';
  if (pct < 0 || (minimo != null && pct < minimo)) return 'alert';
  return pct < meta ? 'warn' : 'good';
}
