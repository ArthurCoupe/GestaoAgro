import { MESES_ANO, dataBr, hojeISO, ultimoMesComDado } from './constantes';
import { LOCAIS_NO_BLOCO } from '../../../src/services/camposDoCiclo.js';
import { galpaoDoCaderno, numeroDaMaturacao } from '../../../src/services/galpaoDoCaderno.js';

export { MESES_ANO, dataBr, hojeISO, ultimoMesComDado };

const demo = await import('./demo');

export const SESSAO_EXPIRADA = 'ex:sessao-expirada';

export const anoMesHoje = (agora: Date = new Date()) => {
  const [ano, mes] = hojeISO(agora).split('-').map(Number);
  return { ano, mes };
};

export interface Periodo { inicio: string; fim: string }

export type RegimeContabil = 'CAIXA_INTEGRAL' | 'COMPETENCIA_INTEGRAL' | 'AMBOS_POR_LANCAMENTO';

export interface RegimeVigencia {
  regime: RegimeContabil;
  vigente_desde: string | null;
  vigente_ate?: string | null;
  decidido_em: string | null;
  fonte: string;
}

export interface RegimePeriodo {
  regimes: RegimeVigencia[];
  misturado: boolean;
}

export interface DreLinha {
  categoria_codigo: string;
  categoria: string;
  valor: number;
  rateio: { criterio: string | null; metodo: string };
}
export interface DreColuna {
  chave: string;
  nome: string;
  tipo: string;
  dre: {
    receita_bruta: number;
    deducoes: { glosa: number; pis: number; cofins: number; outras: number; total: number };
    receita_liquida: number;
    custos_variaveis: { linhas: DreLinha[]; total: number };
    margem_contribuicao: number;
    margem_contribuicao_pct: number | null;
    custos_fixos?: { linhas: DreLinha[]; total: number };
    despesas_operacionais: { linhas: DreLinha[]; total: number };
    outros?: { linhas: DreLinha[]; total: number };
    resultado_gerencial: number;
    resultado_gerencial_pct: number | null;
  };
}
export interface DreResposta {
  periodo: Periodo;
  visao: string;
  colunas: DreColuna[];
  rateios_aplicados: unknown[];
  observacoes: string[];
}

export type DreGerencialVisao = 'consolidado' | 'producao' | 'revenda';
export type Comportamento = 'FIXO' | 'VARIAVEL';
export interface DreGerencialLinha {
  id: string;
  label: string;
  tipo: 'moeda' | 'pct';
  nivel: number;
  grupo?: boolean;
  destaque?: boolean;
  comportamento?: Comportamento | null;
  comportamento_resumo?: Comportamento | 'MISTO' | null;
  valores: Record<string, number | null>;
  total: number | null;
}
export interface DreGerencialBloco {
  id: string;
  titulo: string | null;
  linhas: DreGerencialLinha[];
}
export interface DreGerencialResposta {
  ano: number;
  visao: string;
  meses: string[];
  mesesComDados: string[];
  blocos: DreGerencialBloco[];
  observacoes: string[];
}

export interface DreSplitMes { mes: number; cogumelo: number; pimentao: number; revenda: number }

export interface DreConta {
  id: number;
  conta: string;
  descricao: string;
  categoria1: string | null;
  categoria2: string | null;
  categoria3: string | null;
  comportamento: Comportamento | null;
  comportamento_manual?: boolean;
  grupo_manual?: boolean;
  ordem?: number | null;
}
export interface DreContasOpcoes { categoria1: string[]; categoria2: string[]; categoria3: string[] }
export interface DreContasResposta { contas: DreConta[]; opcoes: DreContasOpcoes }

export interface CustosDespesas {
  custos: number;
  custos_pct: number | null;
  despesas: number;
  despesas_pct: number | null;
  outros?: number;
  reconcilia: boolean | null;
  diferenca_reais?: number;
}

export interface PainelKpis {
  periodo: Periodo;
  escopo: { visao: string; nome: string; chave: string };
  margem_contribuicao: {
    receita_liquida: number;
    custos_despesas_variaveis: number;
    custos_despesas_fixas: number;
    margem_contribuicao: number;
    margem_contribuicao_pct: number | null;
    volume: { kg: number; bandejas: number | null };
    margem_contribuicao_unitaria: { por_kg: number | null; por_bandeja: number | null };
    sem_despesa_no_periodo?: boolean;
    meses_sem_despesa?: string[];
    regime?: RegimePeriodo;
  };
  indicadores_prioritarios?: string[];
  margem_desejada?: number;
  custos_despesas?: CustosDespesas;
  ponto_equilibrio: {
    custos_despesas_fixas: number;
    despesas_nao_classificadas?: number;
    margem_contribuicao_pct: number | null;
    ponto_equilibrio_reais: number | null;
    ponto_equilibrio_kg: number | null;
    ponto_equilibrio_bandejas: number | null;
    margem_seguranca_pct?: number | null;
    margem_seguranca_reais?: number | null;
    sem_despesa_no_periodo?: boolean;
    receita_liquida?: number;
    observacao?: string;
    regime?: RegimePeriodo;
  };
  geracao_caixa: {
    recebimentos_operacionais: number;
    pagamentos_operacionais: number;
    geracao_caixa: number;
    resultado_operacional?: number;
    caixa_operacao?: number;
    variacao_liquida_caixa?: number;
    base?: string;
    liquidacao_e_copia_da_competencia?: boolean;
    regime?: RegimePeriodo;
  };
  preco_medio: { preco_medio: number | null; receita_bruta: number; quantidade: number } | { erro: string };
  preco_medio_por_produto?: {
    periodo: Periodo;
    linhas: Array<{
      produto_id: number | null;
      produto: string;
      origem: 'PRODUCAO' | 'REVENDA' | null;
      receita_bruta: number;
      quantidade: number;
      preco_medio: number | null;
      unidades: string[];
      margem_pct: number | null;
      resultado: number | null;
      custo_medio: number | null;
    }>;
  } | { erro: string };
  investimentos: Array<{
    investimento: { id: number; descricao?: string; valor_capex?: number };
    roi_pct?: number | null;
    payback_meses?: number | null;
    erro?: string;
  }>;
}

export interface Alerta {
  indicador: string;
  severidade: 'BAIXA' | 'MEDIA' | 'ALTA' | 'CRITICA';
  mensagem: string;
  valor_atual: number;
  valor_limite: number;
}

export interface Transacao {
  id: number;
  natureza: 'RECEITA' | 'DESPESA';
  descricao: string | null;
  data_competencia: string;
  receita_bruta: number;
  receita_liquida: number;
  total_deducoes: number;
  quantidade: number | null;
  inserido_manualmente: boolean;
  origem: string;
  produtos: { nome: string } | null;
  centros_custo: { codigo: string; nome: string } | null;
  categorias_gerenciais: { codigo: string; nome: string } | null;
}

export interface Apoio {
  unidades: Array<{ id: number; codigo: string; nome: string; tipo_atuacao: string }>;
  produtos: Array<{ id: number; nome: string; codigo: string | null; tipo_operacao: string; unidade_negocio_id: number }>;
  centros_custo: Array<{ id: number; codigo: string; nome: string; unidade_negocio_id: number | null }>;
  categorias_gerenciais: Array<{ id: number; codigo: string; nome: string; grupo_dre: string; comportamento: string }>;
}

export const getDre = (params: Record<string, string | number | undefined>) =>
  demo.dre(params);

export const getDreGerencial = (ano: number, visao: DreGerencialVisao) =>
  demo.dreGerencial(ano, visao);

export const getDreSplit = (ano: number) =>
  demo.dreGerencialSplit(ano);

export const putDreSplit = (body: { ano: number; mes: number; cogumelo: number; pimentao: number; revenda: number }) =>
  demo.dreGerencialPutSplit(body);

export const getDreContas = (ano = 2026): Promise<DreContasResposta> =>
  demo.dreContas(ano);

export const putDreConta = (id: number, body: {
  comportamento?: Comportamento | null;
  categoria1?: string; categoria2?: string; categoria3?: string;
}) =>
  demo.drePutConta(id, body);

export const getPainelKpis = (params: Record<string, string | number | undefined>) =>
  demo.painelKpis(params);

export const getAlertas = (inicio: string, fim: string) =>
  demo.alertas(inicio, fim);

export const getTransacoes = (_params: Record<string, string | number | undefined>) =>
  demo.transacoes();

export const criarTransacao = (body: object) =>
  demo.criarTransacao(body as Record<string, unknown>);

export const getApoio = () =>
  Promise.resolve(demo.apoioDemo);

export interface CategoriaGerencial {
  id: number;
  codigo: string;
  nome: string;
  grupo_dre: string;
  comportamento: Comportamento;
  eh_operacional: boolean;
  ativo?: boolean;
}
export type CategoriaGerencialPatch = Partial<Pick<CategoriaGerencial, 'comportamento' | 'grupo_dre' | 'eh_operacional'>>;

export const getCategoriasGerenciais = () =>
  demo.categoriasGerenciais();

export const atualizarCategoriaGerencial = (id: number, body: CategoriaGerencialPatch) =>
  demo.atualizarCategoriaGerencial(id, body);

export interface JornadaLinha {
  lote_id: number;
  colheita_id: number | null;
  data_lote: string;
  tipo: string;
  nf_semente: string | null;
  receita: string | null;
  receita_id: number | null;
  responsavel_semeacao: string | null;
  responsavel_conferencia: string | null;
  responsavel_pesagem: string | null;
  responsavel_selagem: string | null;
  blocos_produzidos: number | null;
  misturas: number | null;
  blocos_guardados: number | null;
  blocos_semeados: number | null;
  capela_ligada: boolean | null;
  galpao: string | null;
  estante_maturacao: string | null;
  estante_fisica: string | null;
  blocos_contaminados: number;
  dias_ate_abertura: number | null;
  data_abertura: string | null;
  blocos_abertos: number | null;
  estante_abertura: string | null;
  zerou_estante: boolean | null;
  lote_pesquisa: boolean | null;
  estante_frutificacao: string | null;
  abertura_por_estante: boolean;
  data_colheita: string | null;
  estante_colheita: string | null;
  kg_pp: number | null;
  kg_p: number | null;
  kg_m: number | null;
  kg_g: number | null;
  kg_gg: number | null;
  total_kg: number | null;
  status: 'INCUBACAO' | 'FRUTIFICACAO' | 'ENCERRADO' | string | null;
  data_encerramento: string | null;
}

export const CORES_CONTAMINACAO = ['VERDE', 'LARANJA', 'PRETA'] as const;
export type TipoContaminado = typeof CORES_CONTAMINACAO[number];

export { LOCAIS_NO_BLOCO };
export type LocalNoBloco = typeof LOCAIS_NO_BLOCO[number];

export interface ContaminadoLinha {
  id: number;
  lote_id: number | null;
  data_lote: string | null;
  estante: string | null;
  estante_retirada: string | null;
  tipo: string | null;
  galpao: string | null;
  data_retirada: string | null;
  tipo_contaminado: TipoContaminado | null;
  quantidade: number;
  tipo_evento: 'CONTAMINACAO' | 'PERDA';
  local_no_bloco: LocalNoBloco | null;
  motivo?: string | null;
  estante_registrada?: boolean;
  importado?: boolean;
}

export interface ExclusaoLoteJornada {
  id: number;
  codigo: string;
  colheitas_apagadas: number;
  eventos_apagados: number;
  outros_eventos_apagados?: number;
  alocacoes_apagadas?: number;
  sementes_apagadas: number;
  estantes_apagadas: number;
  transferencias_apagadas: number;
  autoclaves_apagadas: number;
  ocorrencias_atipicas_apagadas: number;
  divergencias_apagadas: number;
  verificacoes_apagadas: number;
}
export interface ExclusaoColheita { id: number; lote_id: number }
export interface ExclusaoContaminacao { id: number; lote_id: number | null }
export interface ColheitaSalva {
  id: number;
  lote_id: number;
  data_colheita: string;
  peso_kg: number;
  kg_pp?: number | null;
  kg_p?: number | null;
  kg_m?: number | null;
  kg_g?: number | null;
  kg_gg?: number | null;
}
export interface ContaminacaoSalva {
  id: number;
  lote_id: number | null;
  qtd_blocos: number;
  tipo_contaminado: TipoContaminado | null;
  data_evento: string;
}

export type EmbalagemApresentacao = 'BANDEJA_200G' | 'EMBALAGEM_1KG' | 'CAIXA_PIMENTAO';
export interface EmbalagemProduto { id: number; nome: string; ordem: number; peso_gramas: number | null; apresentacao: EmbalagemApresentacao | null }
export interface EmbalagemDia { data: string; data_lancamento: string | null; valores: Record<number, number>; f54?: number | null }
export interface EmbalagemGrade { produtos: EmbalagemProduto[]; dias: EmbalagemDia[]; produto_f54_id?: number | null }
export interface EmbalagemSalva { data: string; data_lancamento: string | null; gravados: number; removidos: number }

export type TipoCogumeloEmbalagem = 'SH' | 'SP' | 'SB' | 'SS';
export interface EmbalagemTotais { bandejas_200g: number; embalagens_1kg: number; caixas_pimentao: number; kg_embalados: number; kg_desprezados: number; kg_colhidos: number }
export interface EmbalagemPorTipo extends EmbalagemTotais {
  tipo: TipoCogumeloEmbalagem; nome: string;
  colunas: Array<{ produto: string; apresentacao: EmbalagemApresentacao; unidades: number }>;
}
export interface EmbalagemPorApresentacao { chave: EmbalagemApresentacao; rotulo: string; unidades: number; kg: number | null }
export interface EmbalagemComparacao { periodo_anterior: { inicio: string; fim: string }; anterior: EmbalagemTotais; bandejas_200g_pct: number | null; embalagens_1kg_pct: number | null; kg_embalados_pct: number | null; kg_desprezados_pct: number | null }
export type SituacaoDaConferencia = 'FECHADA' | 'EM_ABERTO' | 'DIVERGENTE';
export interface ConferenciaLinha { data_colheita: string; tipo: TipoCogumeloEmbalagem; nome_tipo: string; lotes: string[]; kg_colhidos: number; kg_embalados: number; kg_desprezados: number; diferenca: number; situacao: SituacaoDaConferencia }
export interface ConferenciaColheitaEmbalagem { parametros: { tolerancia_kg: number; dias_para_fechar: number }; colheitas: number; fechadas: number; em_aberto: number; divergentes: number; kg_diferenca: number; kg_diferenca_absoluta: number; linhas: ConferenciaLinha[] }
export interface EmbalagemResumo { periodo: { inicio: string | null; fim: string | null }; totais: EmbalagemTotais; por_tipo: EmbalagemPorTipo[]; por_apresentacao: EmbalagemPorApresentacao[]; comparacao: EmbalagemComparacao | null; conferencia: ConferenciaColheitaEmbalagem; parametros: { tolerancia_kg: number; dias_para_fechar: number; origens: { tolerancia_kg: 'PADRAO' | 'BANCO'; dias_para_fechar: 'PADRAO' | 'BANCO' } }; hoje: string; corte: string }
export interface EmbalagemDesprezo { id: number; data_lancamento: string; data_colheita: string; tipo_cogumelo: TipoCogumeloEmbalagem; kg: number; lote_id: number | null; observacao: string | null; origem: string; created_at: string }
export interface DesprezoBody { data_lancamento?: string | null; data_colheita: string; tipo_cogumelo: TipoCogumeloEmbalagem; kg: number | string; lote_id?: number | null; observacao?: string | null }
export interface ColheitaDoDia { colheita_id: number; lote_id: number; codigo: string | null; data_lote: string; estante: string | null; kg: number | null }
export interface ColheitaEmbalagemBloco { janela: { inicio: string; fim: string }; kg_colhidos: number; kg_embalados: number; kg_desprezados: number; diferenca: number; colheitas: number; fechadas: number; em_aberto: number; divergentes: number; kg_diferenca_absoluta: number; dado_ate: string | null; parametros: { tolerancia_kg: number; dias_para_fechar: number }; bandejas_200g?: number | null; embalagens_1kg?: number | null; corte?: string; tipo?: string | null; modo?: 'periodo' | 'lote' }

export interface IndicadoresCicloMetricas {
  taxa_contaminacao: number | null;
  taxa_aproveitamento: number | null;
  kg_por_bloco_aberto: number | null;
  eficiencia_total: number | null;
  perda_invisivel: number | null;
  total_kg_colhidos: number | null;
  pct_p: number | null;
  pct_m: number | null;
  pct_g: number | null;
  pct_gg: number | null;
}
export interface IndicadoresCicloLinha extends IndicadoresCicloMetricas { rotulo: string }
export interface IndicadoresCicloGrupo {
  tipo: string;
  total: IndicadoresCicloMetricas;
  linhas: IndicadoresCicloLinha[];
}
export interface IndicadoresCicloResposta {
  grupos: IndicadoresCicloGrupo[];
  total_geral: IndicadoresCicloMetricas;
}

export interface PainelCicloTotais {
  blocos_produzidos: number; blocos_contaminados: number; blocos_abertos: number;
  kg_colhidos: number;
  por_tipo: Array<{
    tipo: string; blocos_produzidos: number; blocos_contaminados: number;
    blocos_abertos: number; kg_colhidos: number;
  }>;
  cobertura: {
    estantes: number; estantes_com_abertura: number;
    estantes_com_data_abertura: number; estantes_sem_quantidade: number;
  };
}
export interface PainelCicloMes {
  mes: string; blocos_produzidos: number; blocos_contaminados: number;
  blocos_abertos: number; kg_colhidos: number;
}
export interface PainelCicloMetricas {
  blocos_produzidos: number; blocos_contaminados: number; blocos_abertos: number;
  kg_colhidos: number;
  lotes: number; estantes: number;
  lotes_com_abertura: number; lotes_com_colheita: number;
  lotes_mensuraveis: number; lotes_em_maturacao: number;
  lotes_abertura_sem_quantidade: number; lotes_com_abertura_parcial: number;
  lotes_com_dado_faltante: number; estantes_sem_quantidade: number;
  nao_mensuraveis?: { em_maturacao: number; dado_faltante: number; sem_contagem_de_produzidos: number };
  lotes_inconsistentes: number;
  lotes_divergentes: number;
  lotes_dentro_da_tolerancia: number;
  taxa_contaminacao: number | null; taxa_aproveitamento: number | null;
  kg_por_bloco_aberto: number | null; eficiencia_total: number | null;
  perda_total_blocos: number | null; perda_total_pct: number | null;
  dias_ate_abertura_mediana: number | null;
}
export interface PainelCicloPerformance {
  mes: string; blocos_produzidos: number; kg_colhidos: number;
  kg_p: number; kg_m: number; kg_g: number; kg_gg: number;
  pct_p: number | null; pct_m: number | null; pct_g: number | null; pct_gg: number | null;
  kg_por_bloco_aberto: number | null; eficiencia_total: number | null;
  taxa_contaminacao: number | null; perda_total_pct: number | null;
  lotes: number; lotes_com_abertura: number; lotes_mensuraveis: number;
  lotes_inconsistentes: number;
}
export interface PainelCicloEstantesColhidas {
  estantes: string[]; total: number;
  kg_por_estante: Array<{ estante: string; kg: number; colheitas: number }>;
  kg_sem_estante: number; colheitas_sem_estante: number;
}
export interface PainelCicloLote {
  chave: string; data_lote: string; tipo: string | null;
  estantes: number; estante_ids: number[];
  galpoes: string[]; estantes_maturacao: string[]; nf_semente: string | null;
  blocos_produzidos: number; blocos_contaminados: number;
  contaminacao_verde: number; contaminacao_laranja: number; contaminacao_preta: number;
  contaminacao_sem_cor: number;
  blocos_perdidos: number;
  blocos_abertos: number | null; data_abertura: string | null;
  dias_ate_abertura: number | null;
  kg_colhidos: number | null; kg_p: number; kg_m: number; kg_g: number; kg_gg: number;
  estantes_sem_quantidade: number; mensuravel: boolean;
  estado: 'EM_MATURACAO' | 'ABERTURA_SEM_QUANTIDADE' | 'ABERTURA_PARCIAL' | 'ABERTO';
  perda_total_blocos: number | null; perda_total_pct: number | null;
  inconsistente: boolean;
  divergente: boolean;
  tolerancia_blocos: number;
  taxa_contaminacao: number | null; taxa_aproveitamento: number | null;
  kg_por_bloco_aberto: number | null; eficiencia_total: number | null;
  estantes_colhidas: PainelCicloEstantesColhidas;
}
export interface PainelCicloPrazo {
  tipo: string; parametro_dias: number | null;
  lotes: number; lotes_sem_abertura: number; datas_invertidas: number;
  mediana_dias: number | null; minimo_dias: number | null; maximo_dias: number | null;
  acima_do_parametro: number | null; pct_acima: number | null;
  desvio_mediana: number | null;
}
export interface PainelCicloOcorrencia {
  chave?: string; data_lote: string; tipo: string | null;
  galpao: string | null; estante?: string | null;
  campo?: string; valor?: string | null; referencia?: string | null;
  valor_invertido?: string; regra_de_origem?: string;
  blocos_produzidos?: number; blocos_contaminados?: number;
  blocos_abertos?: number | null; sobra?: number; estantes?: number;
  quantidade?: number | null;
}
export interface PainelCicloRegra {
  id: string; titulo: string;
  nivel: 'BLOQUEIO' | 'ALERTA';
  unidade: 'estante' | 'colheita' | 'evento' | 'registro' | 'lote';
  total: number;
  ocorrencias: PainelCicloOcorrencia[];
}
export interface PainelCicloValidacoes {
  hoje: string;
  regras: PainelCicloRegra[];
  resumo: {
    total: number; bloqueios: number; alertas: number;
    regras_com_ocorrencia: number;
  };
}
export interface PainelCicloEixo { ignoradas: number; truncado: boolean; }

export interface ConversaoSoma {
  lotes: number; blocos_abertos: number; gramas_colhidas: number; kg_colhidos: number;
  bandejas: number; taxa: number | null;
}
export interface ConversaoGrupo extends ConversaoSoma { tipo: string; chave: string; rotulo: string; }
export interface ConversaoLote {
  chave: string; data_lote: string; tipo: string; data_abertura: string | null;
  ultima_colheita: string | null; nf_semente: string | null;
  nf: { chave: string; rotulo: string };
  blocos_abertos: number; gramas_colhidas: number; kg_colhidos: number; bandejas: number; taxa: number;
}
export interface PainelCicloConversao {
  gramas_por_bandeja: number;
  gramas_origem: 'PADRAO' | 'BANCO';
  eixo: 'LOTE' | 'ABERTURA';
  lotes: ConversaoLote[];
  por_tipo: ConversaoGrupo[]; por_mes: ConversaoGrupo[]; por_nf: ConversaoGrupo[];
  total: ConversaoSoma;
  fora_da_conta: {
    em_maturacao: number; abertura_sem_quantidade: number;
    abertos_sem_colheita: number; abertura_com_zero_blocos: number; total: number;
  };
  lotes_do_periodo: number;
}
export interface PainelCicloResposta {
  totais: PainelCicloTotais;
  serie_mensal: PainelCicloMes[];
  eixo: PainelCicloEixo;
  parametros: { contaminacao_dias_comparavel: number };
  conversao: PainelCicloConversao;
  prazos: PainelCicloPrazo[];
  eficiencia: {
    total: PainelCicloMetricas;
    por_mes: Array<{ mes: string } & PainelCicloMetricas>;
    por_tipo: Array<{ tipo: string } & PainelCicloMetricas>;
  };
  melhor_performance: PainelCicloPerformance[];
  rankings: {
    limite: number;
    menor_contaminacao: PainelCicloLote[]; maior_kg_por_bloco_aberto: PainelCicloLote[];
    maior_eficiencia: PainelCicloLote[]; maior_kg: PainelCicloLote[];
    excluidos: {
      em_maturacao: number; dado_faltante: number;
      sem_colheita: number; inconsistentes: number;
    };
  };
}

export interface PrevisaoAberturaLinha {
  estante_id: number; lote_chave: string; data_lote: string; tipo: string | null;
  galpao: string | null; estante: string | null;
  blocos_guardados: number | null;
  blocos_guardados_lote: number | null;
  origem_quantidade: 'ESTANTE' | 'LOTE' | 'AUSENTE';
  blocos_contaminados: number;
  blocos_perdidos?: number;
  blocos_abertos: number | null;
  blocos_disponiveis: number | null;
  parametro_dias: number | null; data_prevista: string | null;
  parametro_origem: 'ESPECIE' | 'TIPO' | null;
  regra_id: number | null;
  dias_restantes: number | null; dias_decorridos: number;
  situacao: 'VENCIDO' | 'PROXIMO' | 'EM_PRAZO' | 'SEM_PARAMETRO' | 'DATA_INCONSISTENTE';
  sem_quantidade: boolean;
  saldo_negativo: boolean;
  motivo_fora: 'ZERADO' | 'SALDO_NEGATIVO' | 'ENCERRADO_SEM_CONTAGEM' | null;
  lote_parcialmente_aberto: boolean;
  estante_parcialmente_aberta: boolean;
}
export interface PrevisaoAberturaItem { enderecos: number; lotes: number; blocos: number }
export interface EstanteConcluidaComSobra {
  estante_id: number; data_lote: string; tipo: string | null; galpao: string | null;
  estante: string | null; data_abertura: string;
  blocos_guardados: number; blocos_contaminados: number; blocos_perdidos: number;
  blocos_abertos: number; blocos_na_conta: number;
}
export interface PrevisaoAberturaResposta {
  linhas: PrevisaoAberturaLinha[];
  fora_da_fila: PrevisaoAberturaLinha[];
  concluidas_com_sobra: EstanteConcluidaComSobra[];
  resumo: {
    por_situacao: Record<PrevisaoAberturaLinha['situacao'], PrevisaoAberturaItem>;
    por_tipo: Array<{ tipo: string } & PrevisaoAberturaItem>;
    cobertura: {
      enderecos: number; com_quantidade: number;
      quantidade_no_lote: number; sem_quantidade: number;
      blocos_somados: number;
    };
  };
  prazos: PainelCicloPrazo[];
  dado_ate: string | null;
  ultimos_lancamentos?: UltimosLancamentosDaMaturacao;
  quadro?: QuadroDasEstantes | null;
  hoje: string;
}
export interface UltimosLancamentosDaMaturacao { producao: string | null; abertura: string | null; retirada: string | null }
export interface QuadroDasEstantes {
  galpoes: Array<{
    sala_id: number; galpao_codigo: string; nome: string | null; estantes: number; ocupadas: number; vazias: number; etiquetas_vazias: string[];
    capacidade_das_vazias?: Array<{ etiqueta: string; capacidade_blocos: number | null }>;
    capacidade_vazia?: number | null;
  }>;
  totais: { estantes: number; ocupadas: number; vazias: number; capacidade_vazia?: number | null };
  fora_do_cadastro: Array<{ galpao: string; estante: string }>;
  lotes_sem_estante: number;
}

export interface SemanaContaminacao {
  semana: string; rotulo: string; inicio: string; fim: string;
  lotes: number; lotes_com_contaminacao: number; pct_lotes_afetados: number | null;
  blocos_produzidos: number; blocos_contaminados: number;
  taxa: number | null;
  semaforo: 'VERDE' | 'AMARELO' | 'VERMELHO' | 'SEM_DADO' | null;
  maturidade: 'MADURO' | 'EM_OBSERVACAO' | 'SEM_DATA';
  dias_da_semana: number | null;
  fracao_esperada: number | null;
  lote_chaves: string[];
}
export interface JanelaDoPeriodo {
  inicio: string; fim: string; blocos: number; lancamentos: number; dias_com_retirada: number;
}
export interface RankingDoPeriodo<T> {
  itens: Array<T & { chave: string; atual: number; anterior: number }>;
  demais: { quantidade: number; atual: number; anterior: number } | null;
}
export interface ComparacaoPorPeriodo {
  dias: number;
  atual: JanelaDoPeriodo;
  anterior: JanelaDoPeriodo;
  diferenca: number;
  variacao: number | null;
  ultimo_lancamento: string | null;
  galpoes: RankingDoPeriodo<{ galpao: string }>;
  estantes: RankingDoPeriodo<{ galpao: string; estante: string; estante_fisica: string | null }>;
  lotes: RankingDoPeriodo<{ data_lote: string | null; tipo: string | null; galpoes: string[] }>;
}
export interface LinhaDoLocal {
  chave: string; contaminados: number; bloco_dias: number; ocupacao_media: number; taxa: number | null; divergencia: boolean;
  galpao?: string; estante?: string; estante_fisica?: string | null;
  data_lote?: string | null; tipo?: string | null; taxa_do_lote?: number | null;
}
export interface GalpaoDoLocal extends LinhaDoLocal { galpao: string; estantes: LinhaDoLocal[] }
export interface ContaminacaoDoLocal {
  inicio: string; fim: string; dias: number; ultimo_lancamento: string | null;
  total: LinhaDoLocal; galpoes: GalpaoDoLocal[]; lotes: LinhaDoLocal[];
  sem_lote: { contaminados: number; eventos: number };
  pesquisa: { contaminados: number; eventos: number };
}
export interface PainelContaminadosResposta {
  hoje: string;
  semanas: SemanaContaminacao[];
  periodos: ComparacaoPorPeriodo[];
  tendencia: { estado: string; desde: string | null; frase: string; semanas_comparadas: number };
  galpoes: Array<{ galpao: string; blocos_produzidos: number; blocos_contaminados: number;
    taxa: number | null; semaforo: string; lotes: number }>;
  por_tipo: Array<{ tipo: string; blocos_produzidos: number; blocos_contaminados: number;
    taxa: number | null; semaforo: string; lotes: number }>;
  top: Array<{ chave: string; rank: number; data_lote: string; tipo: string; galpoes: string[];
    blocos_produzidos: number | null; blocos_contaminados: number; taxa_contaminacao: number;
    nf_semente: string | null; semaforo: string;
    contagem_inconsistente: boolean }>;
  rondas: Array<{
    lote_id: number;
    galpao: string | null;
    estante: string | null;
    data_lote: string | null;
    tipo: string | null;
    data_ronda: string;
    blocos_na_ronda: number;
    blocos_produzidos: number | null;
    pct_da_ronda: number;
    pct_acumulado: number;
    dias_desde: number | null;
    frase: string;
    limite?: number;
    outras_estantes?: Array<{ lote_id: number; galpao: string | null; estante: string | null; pct_acumulado: number | null }>;
    verificacao?: { por: string; em: string; blocos: number } | null;
  }>;
  resumo: { lotes: number; lotes_com_contaminacao: number; pct_lotes_afetados: number | null;
    enderecos: number; enderecos_com_contaminacao: number; pct_enderecos_afetados: number | null;
    blocos_produzidos: number; blocos_contaminados: number; taxa: number | null;
    meta: number; meta_origem: string; corte_amarelo: number; corte_vermelho: number };
  rastreabilidade: {
    rastreaveis: number; ajuste_aplicado: boolean; ajuste_historico: number; ajuste_registros: number;
    corte: string; total: number; taxa_geral: number | null;
    composicao: {
      completos: number; sem_estante_importados: number; sem_estante_lancados: number;
      sem_cor: number; sem_dado_do_lote: number;
    } | null;
    cobertura: number | null;
  };
  faixas: {
    faixas: Array<{ chave: string; rotulo: string; lancamentos: number; blocos: number;
      pct_blocos: number | null }>;
    base: { lancamentos: number; blocos: number };
    anteriores: { lancamentos: number; blocos: number };
    sem_data_do_lote: number;
    sem_data_do_lote_blocos: number;
    eixo: string;
  };
  escopo: { cobre: string[]; fora: string[] };
  local: ContaminacaoDoLocal | null;
}

export type ChaveDoFiltro = 'galpao' | 'estante' | 'especie' | 'pesagem' | 'semeacao' | 'conferencia' | 'autoclave' | 'semente' | 'cor' | 'lote';
export type CorDoFiltro = 'VERDE' | 'LARANJA' | 'PRETA' | 'SEM_COR';
export type FiltrosDoInvestigador = Partial<Record<ChaveDoFiltro, string>>;
export interface SomaDoRecorte { lotes: number; blocos_produzidos: number; blocos_contaminados: number; taxa: number | null }
export interface SemanaDoInvestigador {
  semana: string; rotulo: string; inicio: string; fim: string;
  lotes: number; maduros: number; em_maturacao: number; sem_numero: number;
  blocos_produzidos: number; blocos_contaminados: number; taxa: number | null;
  parcial: boolean;
}
export interface FaixaDeTempo { chave: string; rotulo: string; retiradas: number; blocos: number; pct_blocos: number | null }
export interface TempoDoInvestigador {
  eixo: string;
  faixas: FaixaDeTempo[];
  sem_data_valida: { retiradas: number; blocos: number; pct_blocos: number | null };
  total: { retiradas: number; blocos: number };
  universo: {
    lotes: number; blocos_produzidos: number;
    contaminados_maduros: number; contaminados_fora_da_taxa: number;
    em_maturacao: number; sem_numero: number;
  };
}

export interface ParKN { k: number; n: number }
export interface ValorDoCruzamento {
  valor: string; rotulo: string; selecionados: ParKN; base: ParKN; base_pequena: boolean; diferenca_pp: number | null;
}
export interface DimensaoDoCruzamento {
  chave: string; titulo: string; grupo: string; disponivel: boolean; valores: ValorDoCruzamento[];
  sem_registro: { k: number; n: number; base: ParKN; rotulo: string } | null;
}
export interface CoincidenciaDoCruzamento extends ValorDoCruzamento { dimensao: string; titulo: string }
export interface LoteDoCruzamento {
  chave: string; data_lote: string | null; tipo: string | null; categoria: 'MADURO' | 'EM_MATURACAO' | 'SEM_NUMERO';
  dias: number | null; blocos_produzidos: number | null; blocos_contaminados: number; taxa: number | null; galpoes: string[];
  estantes: Array<{ galpao: string; estante: string; estante_fisica: string | null; blocos_produzidos: number | null }>;
  sementes: string[];
  pessoas: { pesagem: string[]; semeacao: string[]; conferencia: string[]; selagem: string[]; autoclave: string[] };
  capela_ligada: boolean | null;
  autoclave: Array<{
    ordem: number | null; responsavel: string | null; entrada: string | null; atingiu_121: string | null; fim_2h: string | null;
    houve_queda_121: boolean | null; pressao_na_faixa: boolean | null; sinais: string[];
  }>;
  cores: Record<string, number>;
  eventos_atipicos: Array<{
    id: number | null; tipo: string; rotulo: string; descricao: string | null; observacao: string | null;
    hora_inicio: string | null; hora_retorno: string | null;
  }>;
  faixa_predominante: { valor: string; rotulo: string };
}
export interface FaixaDoTempoNoCruzamento {
  valor: string; rotulo: string; blocos: number; pct_blocos: number | null;
  predominante: ParKN; base: ParKN; base_pequena: boolean; diferenca_pp: number | null;
}
export interface TempoNoCruzamento {
  eixo: string;
  faixas: FaixaDoTempoNoCruzamento[];
  empate: { predominante: ParKN; base: ParKN };
  sem_data_valida: { blocos: number; pct_blocos: number | null };
  total_blocos: number;
  sem_retirada: { k: number; n: number; base: ParKN; rotulo: string };
}
export interface CruzamentoDeLotesResposta {
  inicio: string; fim: string; hoje: string; base_minima: number;
  base_n: number;
  selecionados: number;
  nao_encontrados: string[];
  coincidencias: CoincidenciaDoCruzamento[];
  dimensoes: DimensaoDoCruzamento[];
  tempo: TempoNoCruzamento;
  lotes: LoteDoCruzamento[];
}
export interface LinhaDoFator {
  valor: string; lotes: number; blocos_produzidos: number; blocos_contaminados: number;
  taxa: number | null; diferenca_pp: number | null; base_pequena: boolean;
}
export interface FatorDoInvestigador {
  chave: 'especie' | 'pesagem' | 'semeacao' | 'conferencia' | 'autoclave' | 'semente'; titulo: string; um_por_lote: boolean;
  linhas: LinhaDoFator[]; soma_lotes: number; lotes_com_mais_de_um: number;
  cobertura: { registrados: number; total: number };
}
export interface LoteDoInvestigador {
  chave: string; data_lote: string | null; tipo: string | null; categoria: 'MADURO' | 'EM_MATURACAO' | 'SEM_NUMERO';
  dias: number | null; blocos_produzidos: number | null; blocos_contaminados: number; taxa: number | null;
  galpoes: string[]; pesagem: string[]; semeacao: string[]; conferencia: string[]; semente: string;
}
export interface FichaDoLoteInvestigador extends LoteDoInvestigador {
  etapas: Array<{ etapa: string; quando: string | null; pessoas: string[] }>;
  sementes: string[];
  linhas: Array<{ galpao: string; estante: string; estante_fisica: string | null; blocos_produzidos: number | null }>;
  retiradas: Array<{ data_evento: string | null; galpao: string; estante: string; tipo: string; blocos: number; cor: string | null }>;
  autoclave: Array<{
    ordem: number | null; responsavel: string | null; entrada: string | null; atingiu_121: string | null;
    fim_2h: string | null; houve_queda_121: boolean | null; pressao_na_faixa: boolean | null;
  }>;
}
export interface InvestigadorContaminacaoResposta {
  inicio: string; fim: string; hoje: string; filtros: FiltrosDoInvestigador; base_minima: number;
  recorte: SomaDoRecorte & {
    em_maturacao: number; sem_numero: number; criticos: number; corte_critico: number;
    contagem_a_conferir: number;
  };
  maturidade_dias: number;
  semanas: SemanaDoInvestigador[];
  tempo: TempoDoInvestigador;
  referencia: SomaDoRecorte;
  fatores: FatorDoInvestigador[];
  cor: { total: number; linhas: Array<{ cor: 'VERDE' | 'LARANJA' | 'PRETA' | 'SEM_COR'; blocos: number; fracao: number | null }> };
  onde: Pick<ContaminacaoDoLocal, 'dias' | 'total' | 'galpoes' | 'sem_lote' | 'pesquisa'>;
  lotes: LoteDoInvestigador[];
  ficha: FichaDoLoteInvestigador | null;
  ajuste_historico: { registros: number; blocos: number; corte: string };
}

export type PeriodoDoPainel = 'hoje' | '7' | '10' | '30' | 'mes' | 'ytd' | 'ano' | 'lote';
export type NomeDoIndicador =
  | 'blocos_produzidos' | 'lotes_produzidos' | 'dias_produzidos' | 'blocos_por_lote' | 'blocos_por_dia'
  | 'kg_colhidos' | 'lotes_colhidos' | 'kg_por_lote' | 'bandejas' | 'bandejas_por_lote'
  | 'kg_classificado' | 'kg_m_ou_maior' | 'pct_m_ou_maior'
  | 'kg_p' | 'kg_m' | 'kg_g' | 'kg_gg' | 'pct_p' | 'pct_m' | 'pct_g' | 'pct_gg'
  | 'blocos_contaminados' | 'lotes_afetados' | 'contaminados_da_coorte' | 'taxa_contaminacao';
export interface IndicadorDoPainel {
  atual: number | null; anterior: number | null; media3: number | null;
  var_anterior: number | null; var_media: number | null;
  melhor: 'MAIOR' | 'MENOR' | null;
}
export type JanelaDoPainel =
  | { modo: Exclude<PeriodoDoPainel, 'lote'>; inicio: string; fim: string }
  | { modo: 'lote'; lote: string; data_lote: string; tipo: string };
export type IndicadoresDoPainel =
  | { erro: string }
  | {
    erro?: undefined;
    periodo: JanelaDoPainel;
    anteriores: Array<{ inicio: string; fim: string } | { lote: string }>;
    historico_desde: { producao: string | null; colheita: string | null; retirada: string | null; embalagem: string | null };
    metricas: Record<NomeDoIndicador, IndicadorDoPainel>;
    rankings?: RankingsDoPainel | null;
  };
export interface QualidadeDoPainel {
  kg_classificado: number; kg_p: number; kg_m: number; kg_g: number; kg_gg: number;
  pct_p: number | null; pct_m: number | null; pct_g: number | null; pct_gg: number | null; pct_m_ou_maior: number | null;
}
export type EtapaDoLote = 'EM_MATURACAO' | 'COLHENDO' | null;
export interface SementeDoLote { cepa: string; lote_semente: string | null }
export interface LoteNaSala { sala: string; blocos_abertos: number; kg_colhidos: number; kg_p: number; kg_m: number; kg_g: number; kg_gg: number }
export interface LoteDoRanking {
  parcial?: EtapaDoLote;
  sementes?: SementeDoLote[] | null;
  salas?: LoteNaSala[] | null;
  sala_fora?: 'sem_sala_na_abertura' | 'soma_diferente' | 'colheita_sem_sala_da_abertura' | null;
}
export type SementeFora = 'nao_carregou' | 'sem_saida_no_dia' | 'lote_fora_do_recorte' | 'cepa_diferente' | 'sala';
export interface RankingsDoPainel {
  produtividade: Array<{
    chave: string; data_lote: string; tipo: string; blocos_abertos: number; kg_colhidos: number; kg_por_bloco_aberto: number; inconsistente: boolean;
    kg_p?: number; kg_m?: number; kg_g?: number; kg_gg?: number;
    semente_pacotes?: number | null; semente_fora?: SementeFora | null;
  } & LoteDoRanking>;
  qualidade: Array<{ chave: string; data_lote: string; tipo: string } & QualidadeDoPainel & LoteDoRanking>;
  fora: { sem_colheita: number; dado_faltante: number; sem_abertos?: number; sem_tamanho?: number };
  por_sala: Array<ColheitaDaSala & { sala: string }>;
  sem_sala: ColheitaDaSala & { sala: null };
  rendimento_por_sala?: {
    linhas: Array<{ sala: string; tipo: string; lotes: number; parciais?: number; inconsistentes?: number; blocos_abertos: number; kg_colhidos: number; kg_por_bloco_aberto: number | null }>;
    fora: { sem_sala_na_abertura: number; soma_diferente: number; colheita_sem_sala_da_abertura: number };
  };
  variacao_da_qualidade?: {
    atual: number | null; base: number | null; kg_classificado: number; kg_classificado_anterior: number | null;
    lotes: Array<{ chave: string; data_lote: string | null; tipo: string; parcial: EtapaDoLote; efeito: number | null } & QualidadeDoPainel>;
  } | null;
  comparaveis?: LoteComparavel[];
  serie_da_qualidade?: PontoDaQualidade[] | null;
}
export interface PontoDaQualidade {
  inicio: string; fim: string;
  kg_colhidos: number | null; kg_classificado: number | null; kg_m_ou_maior: number | null;
  kg_p: number | null; kg_m: number | null; kg_g: number | null; kg_gg: number | null;
  pct_p: number | null; pct_m: number | null; pct_g: number | null; pct_gg: number | null; pct_m_ou_maior: number | null;
  lotes_abertos: number | null; blocos_abertos: number | null; kg_dos_abertos: number | null; kg_por_bloco_aberto: number | null; parciais: number | null;
}
export interface LoteComparavel {
  chave: string; data_lote: string; tipo: string; parcial: EtapaDoLote; inconsistente: boolean;
  blocos_abertos: number | null; kg_colhidos: number | null; kg_por_bloco_aberto: number | null;
  kg_classificado: number | null; pct_p: number | null; pct_m: number | null; pct_g: number | null; pct_gg: number | null; pct_m_ou_maior: number | null;
  sementes: SementeDoLote[] | null; receitas: string[]; salas: string[] | null; sala_fora: LoteDoRanking['sala_fora'];
  maturacao: { primeira: number; ultima: number; media: number } | null;
}
export interface ColheitaDaSala extends QualidadeDoPainel {
  sala: string | null; kg_colhidos: number; colheitas: number;
}
export interface PainelOperacionalSementeProxima {
  cepa_id: number | null; codigo: string; tipo_cogumelo: string | null;
  saldo: number; validade: string | null; nf: string | null; vencida: boolean;
}
export interface PainelOperacionalAberturaLinha extends PrevisaoAberturaLinha {
  semaforo: 'VERDE' | 'AMARELO' | 'VERMELHO' | 'SEM_DADO';
}
export interface PainelOperacionalPosicaoBlocos extends PainelCicloTotais {
  enderecos: number; lotes: number;
  em_maturacao_enderecos: number; em_maturacao_lotes: number;
  vencidos: number; proximos: number;
}
export interface PainelOperacionalDivergenciaLote {
  lote_chave: string; data_lote: string; tipo: string | null;
  galpao: string | null; estantes: number;
  blocos_produzidos: number | null; blocos_contaminados: number;
  blocos_abertos: number | null; sobra: number | null;
  blocos_perdidos?: number;
  inconsistente: boolean;
}
export interface PainelOperacionalDivergencias extends PainelCicloValidacoes {
  tolerancia: number;
  lotes: PainelOperacionalDivergenciaLote[];
}
export interface PainelOperacionalEstanteEstourada {
  estante_id: number; lote_chave: string; data_lote: string; tipo: string | null;
  galpao: string | null; estante: string | null; status: string | null;
  produzidos: number; retirados: number; abertos: number;
  saldo: number;
  data_abertura: string | null;
  abertura_concluida: boolean;
  em_maturacao: boolean;
}
export interface PainelOperacionalContaNaoFecha {
  total: number;
  em_maturacao: PainelOperacionalEstanteEstourada[];
  ja_abertas: PainelOperacionalEstanteEstourada[];
}
export interface PainelOperacionalContaminacaoLinha {
  lote: string; tipo: string | null; estantes: string[];
  blocos_contaminados: number; total_blocos: number | null; pct: number;
  semaforo: 'VERDE' | 'AMARELO' | 'VERMELHO' | 'SEM_DADO';
  inconsistente: boolean;
}
export interface PainelOperacionalColheitaLinha {
  id: number; lote_id: number; data_colheita: string;
  kg_p: number | null; kg_m: number | null; kg_g: number | null; kg_gg: number | null;
  total_kg: number | null;
}
export interface PainelOperacionalInsumoLinha {
  id: number; categoria: string | null; descricao: string | null;
  especificacao: string | null; unidade: string | null;
  estoque_atual: number | null; consumo_medio_mensal: number | null;
  dias_de_cobertura: number; semaforo: 'VERDE' | 'AMARELO' | 'VERMELHO' | 'SEM_DADO';
}
export interface PainelOperacionalInsumoSemConsumo {
  id: number; categoria: string | null; descricao: string | null;
  especificacao: string | null; unidade: string | null;
  estoque_atual: number | null; consumo_medio_mensal: number | null; motivo: string;
}
export interface PainelOperacionalMateriaPrimaLinha {
  materia_prima_id: number | null; materia_prima: string; estoque_informado: number;
  unidade: 'apresentacao'; consumo_apresentacao_dia: number;
  dias_de_cobertura: number; semaforo: 'VERMELHO' | 'VERDE';
  semente_tipo?: string;
}
export type PainelOperacionalMateriaPrimaMotivo =
  | 'sem apresentacao cadastrada'
  | 'sem estoque informado'
  | 'estoque negativo'
  | 'nenhuma receita usa'
  | 'previsao incompleta'
  | 'sem consumo diario conhecido'
  | 'nao consumida hoje'
  | 'cobertura nao calculavel';
export interface PainelOperacionalMateriaPrimaSemCobertura {
  materia_prima_id: number | null; materia_prima: string;
  estoque_informado: number | null; motivo: PainelOperacionalMateriaPrimaMotivo;
  semente_tipo?: string;
  receitas_sem_ritmo?: string[];
}
export interface PainelOperacionalAlerta {
  tipo: string; severidade: 'VERMELHO' | 'AMARELO'; mensagem: string;
  detalhe: Record<string, unknown> | null;
}
export interface PainelOperacionalSemDado { bloco: string; titulo: string; motivo: string }

export interface CapacidadeEstante {
  etiqueta: string; status: string; capacidade: number; ocupados: number | null; livres: number | null;
  sem_quantidade: number; lotes: Array<{ id: number; codigo: string | null; blocos: number | null }>;
}
export interface CapacidadeSala {
  sala_id: number; nome: string; galpao_codigo: string; etapa: 'MATURACAO' | 'FRUTIFICACAO'; ativa: boolean;
  capacidade: number; ocupados: number | null; livres: number | null; pct_ocupacao: number | null;
  acima_da_capacidade: number | null;
  estantes_total: number; estantes_ocupadas: number; estantes_livres: number; etiquetas_livres: string[];
  sem_quantidade: number;
  fora_da_capacidade: Array<{ etiqueta: string; status: string; ocupados: number | null }>;
  estantes: CapacidadeEstante[];
}
export interface CapacidadeLivre {
  salas: CapacidadeSala[];
  totais: Record<'maturacao' | 'frutificacao', { capacidade: number; ocupados: number | null; livres: number | null; acima_da_capacidade: number | null }>;
  estantes_desconhecidas: Array<{ galpao: string; etiqueta: string; blocos: number | null }>;
  sem_sala: { aberturas: number; blocos: number; sem_quantidade: number };
  sem_dado: Array<{ bloco: string; motivo: string }>;
}

export type PendenciaTipo =
  | 'AUTOCLAVE_SEM_DADOS' | 'CAPELA_NAO_INFORMADA' | 'SEM_RESPONSAVEL'
  | 'GUARDA_INCOMPLETA' | 'ABERTURA_SEM_SALA' | 'DIVERGENCIA' | 'EMBALAGEM_NAO_LANCADA'
  | 'CONTAMINADO_SEM_ESTANTE' | 'RETIRADA_ACIMA_DO_LIMITE';
export interface Pendencia {
  tipo: PendenciaTipo; lote_id: number | null; codigo: string | null; data_lote: string;
  galpao: string | null; estante: string | null; frase: string; desde: string;
  transferencia_id?: number | null;
  estante_origem?: string | null;
  data_abertura?: string | null;
  especie?: string | null;
  detalhe?: string;
  quantidade?: string | null;
  local?: string | null;
  pode_dispensar?: boolean;
  colheita_no_dia?: boolean | null;
  marcado_sem_colheita?: boolean;
  data_retirada?: string;
  pct_da_ronda?: number;
  limite?: number;
}

export interface VerificacaoDeRetirada {
  lote_id: number; data_retirada: string; blocos_na_retirada: number;
  verificado_por_nome: string; verificado_em: string; ja_verificado: boolean;
}
export const verificarAlertaDeRetirada = (lote_id: number, data_retirada: string) =>
  demo.producaoVerificarAlertaDeRetirada(lote_id, data_retirada);

export interface DiaSemColheita { data: string; marcado_em: string; ja_marcado: boolean }

export const marcarDiaSemColheita = (data: string) =>
  demo.producaoMarcarDiaSemColheita(data);
export interface PendenciasDeLancamento {
  total: number; itens: Pendencia[]; por_tipo: Partial<Record<PendenciaTipo, number>>;
}

export type PainelDeComandoSeveridade = 'VERMELHO' | 'AMARELO' | 'VERDE' | 'SEM_DADO';
export interface PainelDeComandoArea {
  chave: string;
  titulo: string;
  severidade: PainelDeComandoSeveridade;
  numero: number | null;
  unidade: string | null;
  frase: string | null;
  destino: string;
  ancora: string | null;
  alertas: number;
}
export interface PainelDeComando {
  resumo: { acoes: number; atencoes: number; ok: number; sem_dado: number };
  areas: PainelDeComandoArea[];
}
export interface PainelOperacionalResposta {
  hoje: string;
  dado_ate: string | null;
  tipo_do_recorte?: string | null;
  ultimos_lancamentos?: { producao: string | null; abertura: string | null; retirada: string | null; colheita: string | null; embalagem?: string | null };
  colheita_embalagem_do_periodo?: ColheitaEmbalagemBloco | null;
  indicadores?: IndicadoresDoPainel;
  proximas_aberturas: {
    linhas: PainelOperacionalAberturaLinha[];
    resumo: PrevisaoAberturaResposta['resumo'];
    parametros_dias: Record<string, number>;
    horizonte_dias: number;
  };
  sementes: { proximas: PainelOperacionalSementeProxima[] };
  posicao_blocos: PainelOperacionalPosicaoBlocos;
  divergencias: PainelOperacionalDivergencias;
  conta_nao_fecha: PainelOperacionalContaNaoFecha;
  contaminacao: {
    top: PainelOperacionalContaminacaoLinha[];
    por_tipo: PainelCicloTotais['por_tipo'] | null;
    geral: number | null;
    por_tipo_taxa: Array<{ tipo: string; pct: number | null }>;
  };
  colheita: {
    dado_ate: string | null;
    kg_hoje: number | null; kg_7_dias: number | null;
    kg_hoje_por_faixa: { PP?: number; P: number; M: number; G: number; GG: number } | null;
    kg_hoje_por_tipo: { SH: number; SB: number; SP: number; SS: number } | null;
    ultimas: PainelOperacionalColheitaLinha[];
    melhores: PainelCicloLote[]; piores: PainelCicloLote[];
    excluidos: {
      em_maturacao: number; dado_faltante: number;
      sem_colheita: number; inconsistentes: number;
    } | null;
  };
  insumos: {
    linhas: PainelOperacionalInsumoLinha[];
    sem_consumo: PainelOperacionalInsumoSemConsumo[];
    resumo: { itens: number; calculados: number; sem_dado: number };
  };
  materia_prima: {
    linhas: PainelOperacionalMateriaPrimaLinha[];
    sem_cobertura: PainelOperacionalMateriaPrimaSemCobertura[];
    resumo: { itens: number; calculados: number; sem_cobertura: number };
  } | null;
  alertas: PainelOperacionalAlerta[];
  cabecalho: {
    blocos_em_processo: number | null; lotes_em_maturacao: number | null;
    aberturas_urgentes: number;
    aberturas_vencidas: number; aberturas_vencem_hoje: number;
    kg_colhidos: number | null; contaminacao_pct: number | null;
    contaminacao_semaforo: 'VERDE' | 'AMARELO' | 'VERMELHO' | null;
    alertas_criticos: number; dado_ate: string | null;
  };
  sem_dado: PainelOperacionalSemDado[];
  capacidade: CapacidadeLivre | null;
  pendencias: PendenciasDeLancamento | null;
  colheita_embalagem?: ColheitaEmbalagemBloco | null;
  painel_de_comando: PainelDeComando;
}

export interface SementesEstoqueNf {
  nf: string;
  valores: Record<string, number | null>;
  total: number;
}
export interface SementesEstoqueCepa {
  cepa: string;
  tipo_cogumelo: string;
  valores: Record<string, number | null>;
  total: number;
  nfs: SementesEstoqueNf[];
}
export interface SementesEstoqueResposta {
  validades: string[];
  cepas: SementesEstoqueCepa[];
  total_geral: { valores: Record<string, number | null>; total: number };
  proximas: Array<{ tipo_cogumelo: string; cepa: string; validade: string }>;
  a_separar: Array<{
    tipo_cogumelo: string | null; cepa: string; nf: string; validade: string;
    saldo: number; dias_para_vencer: number;
  }>;
}

export interface SementeMovimento {
  id: number;
  data: string;
  data_nf: string | null;
  ajuste: boolean;
  tipo: 'ENTRADA' | 'SAIDA';
  tipo_cogumelo: string;
  cepa: string;
  cepa_id: number;
  nf: string | null;
  data_producao: string | null;
  validade: string | null;
  quantidade: number;
}

export interface SementeCepa {
  id: number;
  codigo: string;
  tipo_cogumelo: string;
  ativo: boolean;
}

export interface NecessidadeDeSementesTipo {
  tipo_cogumelo: string;
  gramas_por_bloco: number | null;
  gramas_por_saco: number | null;
  blocos_previstos_horizonte: number | null;
  semanas_sem_previsao: string[];
  necessidade_horizonte_sacos: number | null;
  necessidade_semana_sacos: number | null;
  saldo: number | null;
  dura_semanas: number | null;
  compras_previstas_sacos: number | null;
  comprar_agora_sacos: number | null;
  sem_dado: string[];
}
export interface NecessidadeDeSementesResposta {
  horizonte_semanas: number;
  semanas: string[];
  por_tipo: NecessidadeDeSementesTipo[];
}
export interface CompraPrevista {
  cepa_id: number;
  cepa: string;
  tipo_cogumelo: string;
  quantidade: number;
  observacao?: string | null;
}

export interface ReceitaAntiga {
  ordem: number;
  nome: string;
  tipo: string;
  base: string | null;
  descricao: string | null;
  modelo: string | null;
  start_obs: string | null;
}
export interface LotePesquisa {
  id: number;
  lote_label: string;
  tipo: string | null;
  base: string | null;
}

export interface ReceitaSubstrato {
  id: number;
  nome: string;
  versao: number;
  produto_id: number;
  produto_nome: string | null;
  status: 'PADRAO' | 'TESTE' | 'INATIVA' | null;
  ativa: boolean;
  vigente_desde: string;
  motivo_ajuste: string | null;
  receita_base_id: number | null;
}

export const getReceitasSubstrato = () =>
  demo.receitasSubstrato();

export const atualizarReceitaSubstrato = (
  id: number,
  body: Partial<Pick<ReceitaSubstrato, 'nome' | 'status' | 'vigente_desde' | 'ativa'>>,
) => demo.receitasSubstratoAtualizar(id, body);

export interface CriarVersaoReceitaBody {
  produtoId: number;
  nome: string;
  motivoAjuste?: string | null;
  ingredientes: Array<{ materiaPrimaId: number; quantidadePorBloco: number; observacao?: string }>;
}
export interface VersaoReceitaCriada {
  id: number;
  nome: string;
  versao: number;
}

export const criarVersaoReceita = (body: CriarVersaoReceitaBody) =>
  demo.criarVersaoReceita(body);

export interface ReceitaVigenteIngrediente {
  quantidade_por_bloco: number;
  observacao: string | null;
  materias_primas: { id: number; codigo: string; nome: string; unidade_medida: string };
}
export interface ReceitaVigente {
  id: number;
  nome: string;
  versao: number;
  motivo_ajuste: string | null;
  vigente_desde: string;
  receita_base_id: number | null;
  receita_ingredientes: ReceitaVigenteIngrediente[];
}

export const getReceitaVigente = (produtoId: number): Promise<ReceitaVigente | null> =>
  demo.getReceitaVigente(produtoId);

export interface ComposicaoDeReceita {
  receita_id: number;
  blocos_por_receita: number | null;
  ingredientes: Array<{
    materia_prima_id: number | null;
    nome: string;
    unidade: string;
    quantidade_por_bloco: number;
    observacao: string | null;
  }>;
}

export const getComposicaoDasReceitas = () =>
  demo.composicaoDasReceitas();

export interface RegraMaturacao {
  id: number;
  galpao_codigo: string;
  dias: number;
  vigente_desde: string;
  observacao?: string | null;
}

export const getRegrasMaturacao = () =>
  demo.regrasMaturacao();

export const rotuloDoGalpao = (
  codigo: string,
  regras: Array<{ galpao_codigo: string; observacao?: string | null }>,
) => {
  const r = regras.find((x) => x.galpao_codigo === codigo);
  const nome = r?.observacao?.trim();
  if (!nome) return codigo;
  const n = numeroDaMaturacao(nome);
  return n ? `M${n}` : `${nome} (${codigo})`;
};

export const galpaoCurto = (
  codigo: string,
  regras: Array<{ galpao_codigo: string; observacao?: string | null }>,
) => {
  return galpaoDoCaderno(codigo, regras.find((x) => x.galpao_codigo === codigo)?.observacao);
};

export const ordenarGalpoes = (
  galpoes: string[],
  regras: Array<{ galpao_codigo: string; observacao?: string | null }>,
) => [...galpoes].sort((a, b) =>
  rotuloDoGalpao(a, regras).localeCompare(rotuloDoGalpao(b, regras), 'pt-BR', { numeric: true }));

export interface RegraMaturacaoEspecie {
  id: number;
  tipo_cogumelo: string;
  dias: number;
  vigente_desde: string;
  observacao?: string | null;
}

export const getRegrasMaturacaoEspecie = () =>
  demo.regrasMaturacaoEspecie();

export const criarRegraMaturacaoEspecie = (body: {
  tipoCogumelo: string; dias: number; vigenteDesde: string; observacao?: string;
}) => demo.regrasMaturacaoEspecieCriar(body);

export type StatusBudget = 'RASCUNHO' | 'EM_ANALISE' | 'APROVADO' | 'SUBSTITUIDO';
export type AcaoBudget = 'ENVIAR' | 'VOLTAR' | 'APROVAR';
export interface BudgetVersao {
  id: number; exercicio: number; nome: string; cenario: 'BASE' | 'META' | 'DESEJAVEL'; status: StatusBudget;
  revisa_versao_id: number | null; arquivo_nome: string; criado_em: string; criado_por_nome: string;
  status_alterado_em: string | null; status_alterado_por_nome: string | null;
  aprovado_em: string | null; aprovado_por_nome: string | null; observacao: string | null;
}
export interface BudgetLinha {
  linha_id: string; codigo_oficial: string | null; rotulo: string; tipo: 'GRUPO' | 'SUBGRUPO' | 'CONTA' | 'TOTAL';
  profundidade: number; linha_pai_id: string | null; total: string | null;
  por_mes: Record<string, number | null>; ano: number | null;
}
export interface BudgetMargem { por_mes: Record<string, number | null>; ano: number | null }
export interface BudgetGrade {
  versao: BudgetVersao; meses: string[]; origem_por_mes: Record<string, 'RECONSTRUIDO' | 'PLANEJADO' | 'MISTA'>;
  linhas: BudgetLinha[]; margens: { operacional: BudgetMargem; da_aba: BudgetMargem }; defeitos: string[];
}
export const getBudgetVersoes = () =>
  Promise.resolve([] as BudgetVersao[]);
export const getBudgetGrade = (_id: number) => Promise.reject<BudgetGrade>(new Error('Grade do Budget indisponível na demonstração.'));
export const mudarStatusBudget = (_id: number, _acao: AcaoBudget) =>
  Promise.reject<BudgetVersao>(new Error('Mudança de status do Budget indisponível na demonstração.'));

export interface SalaComEtapa extends Pick<SalaProducao, 'id' | 'nome' | 'galpao_codigo' | 'num_estantes' | 'capacidade_blocos'> {
  ordem: number; etapa: 'MATURACAO' | 'FRUTIFICACAO'; ativa: boolean;
}
export const getSalasProducao = () =>
  (demo.producaoSalas());

export interface Liberacao {
  id: number; sala: string | null; estante: string; data: string; observacao: string | null; created_at: string;
}
export const registrarLiberacao = (body: { sala: string; estante: string; data: string; observacao?: string }) =>
  (demo.producaoRegistrarLiberacao(body));
export const listarLiberacoes = (sala?: string) =>
  (demo.producaoListarLiberacoes(sala));

export interface Pessoa { id: number; nome: string; ativa: boolean }
export const listarPessoas = () =>
  (demo.producaoListarPessoas());
export const criarPessoa = (nome: string) =>
  (demo.producaoCriarPessoa(nome));

export interface Divergencia {
  id: number; lote_id: number; codigo: string | null; tipo: 'ABERTURA' | 'RETIRADA' | 'GUARDA';
  data: string; esperado: number | null; informado: number; responsavel: string | null;
  observacao: string | null; resolvida_em: string | null;
}
export const registrarDivergencia = (body: {
  lote_id: number; tipo: 'ABERTURA' | 'RETIRADA' | 'GUARDA'; data: string;
  esperado?: number; informado: number; responsavel?: string; observacao?: string;
}) => (demo.producaoRegistrarDivergencia(body));
export const listarDivergencias = (abertas?: boolean) =>
  (demo.producaoListarDivergencias(abertas));
export const resolverDivergencia = (id: number) =>
  (demo.producaoResolverDivergencia(id));

export interface MetaOperacional {
  valor: number | null;
  unidade: string;
  nota: string;
  origem: 'PADRAO' | 'BANCO';
  vigente_desde: string | null;
}
export interface MetasOperacionaisResposta { hoje: string; metas: Record<string, MetaOperacional> }

export const getMetasOperacionais = (_params: { hoje?: string } = {}) =>
  demo.metasOperacionais();

export interface MetaOperacionalSalva {
  chave: string; valor: number; unidade: string; vigente_desde: string; observacao: string | null;
}
export const putMetaOperacional = (body: { chave: string; valor: number; vigenteDesde?: string; observacao?: string }) =>
  demo.putMetaOperacional(body);

export interface SalaProducao {
  id: number;
  nome: string;
  num_estantes: number | null;
  capacidade_blocos: number | null;
  dias_medios: number | null;
  galpao_codigo: string | null;
  apelido: string | null;
}
export interface EstruturalBiologicaLinha {
  sala_id: number;
  nome: string;
  blocos_abertos: Array<number | null>;
  bandejas_produzidas: Array<number | null>;
  cb: Array<number | null>;
}
export interface EstruturalAberturaLinha {
  sala_id: number;
  nome: string;
  capac_blocos: number | null;
  dias_medios: number | null;
  capac_mensal: number | null;
}
export interface EstruturalBandejasLinha {
  sala_id: number;
  nome: string;
  cf_mensal: number | null;
  cb: number | null;
  cb_mes: number | null;
  cpb_mes: number | null;
}
export interface EstruturaisResposta {
  ano: number;
  biologica: EstruturalBiologicaLinha[];
  fisica: SalaProducao[];
  abertura: EstruturalAberturaLinha[];
  bandejas: EstruturalBandejasLinha[];
}

interface ApiMetricas {
  taxa_contaminacao: number | null; taxa_aproveitamento: number | null;
  kg_por_bloco_aberto: number | null; eficiencia_total: number | null;
  perda_invisivel: number | null; total_kg: number | null;
  pct_p: number | null; pct_m: number | null; pct_g: number | null; pct_gg: number | null;
}
export const adaptMetricas = (m: ApiMetricas | null | undefined): IndicadoresCicloMetricas => ({
  taxa_contaminacao: m?.taxa_contaminacao ?? null,
  taxa_aproveitamento: m?.taxa_aproveitamento ?? null,
  kg_por_bloco_aberto: m?.kg_por_bloco_aberto ?? null,
  eficiencia_total: m?.eficiencia_total ?? null,
  perda_invisivel: m?.perda_invisivel ?? null,
  total_kg_colhidos: m?.total_kg ?? null,
  pct_p: m?.pct_p ?? null,
  pct_m: m?.pct_m ?? null,
  pct_g: m?.pct_g ?? null,
  pct_gg: m?.pct_gg ?? null,
});

export const getProducaoJornada = (params: Record<string, string | undefined>) =>
  demo.producaoJornada(params);

export interface LoteCriado { id: number; codigo: string }

export interface BatidaDaAutoclave {
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
}
export const criarLoteJornada = (body: {
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
  autoclave?: BatidaDaAutoclave[];
}) => demo.producaoCriarLote(body);

export const atualizarLoteJornada = (loteId: number, body: {
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
  responsavel_semeacao?: string | null;
  responsavel_conferencia?: string | null;
  responsavel_pesagem?: string | null;
  responsavel_selagem?: string | null;
  permitir_reabertura?: boolean;
  permitir_duplicata?: boolean;
  permitir_encerrado?: boolean;
  lote_pesquisa?: boolean | null;
  capela_ligada?: boolean | null;
  reabrir?: boolean;
  data_lote?: string;
  tipo?: string;
  sementes?: Array<{ cepaId: number; nf: string; loteSemente?: string | null; vencimento?: string | null }>;
  autoclave?: BatidaDaAutoclave[];
}) => demo.producaoAtualizarLote(loteId, body);

export const acrescentarEstantesAoLote = (loteId: number, body: {
  estantes: Array<{ galpao?: string; estante: string; blocos: number }>;
  permitir_duplicata?: boolean;
  permitir_encerrado?: boolean;
}) => (demo.producaoAcrescentarEstantes(loteId, body));

export const registrarAberturaJornada = (loteId: number, body: {
  data_abertura: string; zerou_estante?: boolean;
  destinos: Array<{ sala: string; estante: string; quantidade?: number }>; permitir_reabertura?: boolean;
  permitir_encerrado?: boolean;
  registrado_por?: string | null;
  substituir?: boolean;
  permitir_duplicata?: boolean;
}) => (demo.producaoRegistrarAbertura(loteId, body));

export interface AberturaGravada {
  id: number; data: string; estante_origem: string | null; sala_destino: string | null;
  estante_destino: string; quantidade: number | null; registrado_por: string | null; created_at: string | null;
}

export const listarAberturasJornada = (loteId: number) =>
  demo.producaoListarAberturas(loteId);

export const registrarColheitaJornada = (loteId: number, body: {
  data: string; kg_p?: number | null; kg_m?: number | null; kg_g?: number | null;
  kg_gg?: number | null;
  kg_pp?: number | null;
  estante?: string | null;
  permitir_duplicata?: boolean;
  permitir_encerrado?: boolean;
  permitir_dia_sem_colheita?: boolean;
}) => demo.producaoRegistrarColheita(loteId, body);

export const excluirLoteJornada = (loteId: number) =>
  demo.producaoExcluirLote(loteId);

export const atualizarColheitaJornada = (colheitaId: number, body: {
  data?: string; kg_p?: number | null; kg_m?: number | null; kg_g?: number | null;
  kg_gg?: number | null;
  kg_pp?: number | null;
  estante?: string | null;
  permitir_dia_sem_colheita?: boolean;
}) => demo.producaoAtualizarColheita(colheitaId, body);

export const excluirColheitaJornada = (colheitaId: number) =>
  demo.producaoExcluirColheita(colheitaId);

export const definirSalaDaAbertura = (transferenciaId: number, sala_destino: string) =>
  demo.producaoDefinirSalaDaAbertura(transferenciaId, sala_destino);

export interface TransferenciaSalva {
  id: number; lote_id: number; data: string;
  estante_origem: string; estante_destino: string;
  quantidade: number | null; observacao: string | null; registrado_por: string | null;
}

export const registrarTransferenciasJornada = (loteId: number, transferencias: Array<{
  data: string; estante_origem: string; estante_destino: string;
  quantidade?: number | null; observacao?: string | null; registrado_por?: string | null;
}>) => demo.producaoRegistrarTransferencias(loteId, transferencias);

export interface DetalhesDoLoteJornada {
  lote_id: number;
  ancora_id: number;
  estantes_do_lote: number;
  autoclave: Array<{
    ordem: number; responsavel: string | null; entrada: string | null; atingiu_121: string | null;
    fim_2h: string | null; houve_queda_121: boolean | null; pressao_na_faixa: boolean | null;
    ocorrido: string | null; observacoes: string | null; conferido_por: string | null;
  }>;
  sementes: Array<{ cepa_id: number; nf: string; lote_semente?: string | null; vencimento?: string | null }>;
}
export const getDetalhesDoLoteJornada = (loteId: number) =>
  demo.producaoDetalhesDoLote(loteId);

export const listarTransferenciasJornada = (loteId: number) =>
  demo.producaoListarTransferencias(loteId);

export const getContaminados = (params: {
  inicio?: string; fim?: string; tipo?: string;
} = {}) =>
  demo.producaoContaminados(params);

export const registrarContaminado = (body: {
  lote_id?: number; data_lote?: string; tipo?: string; estante?: string;
  data_retirada: string;
  quantidade?: number; saldo_total?: true; motivo?: string;
  tipo_evento?: 'PERDA'; tipo_contaminado?: TipoContaminado;
  local_no_bloco?: LocalNoBloco;
  permitir_duplicata?: boolean;
  permitir_encerrado?: boolean;
}) => demo.producaoRegistrarContaminado(body);

export const atualizarContaminacaoJornada = (eventoId: number, body: {
  data_retirada?: string; tipo_contaminado?: TipoContaminado | null; quantidade?: number;
  local_no_bloco?: LocalNoBloco | '';
  estante?: string;
}) => demo.producaoAtualizarContaminado(eventoId, body);

export const excluirContaminacaoJornada = (eventoId: number) =>
  demo.producaoExcluirContaminado(eventoId);

export interface EventoAtipico {
  id: number; lote_id: number; tipo: string;
  descricao: string | null;
  observacao: string | null;
  hora_inicio: string | null; hora_retorno: string | null;
  created_at: string | null;
}
export interface CorpoDoEventoAtipico {
  tipo?: string; descricao?: string; observacao?: string | null;
  hora_inicio?: string | null; hora_retorno?: string | null;
}
export interface ExclusaoEventoAtipico { id: number; lote_id: number }

export const listarEventosAtipicosDoLote = (loteId: number) =>
  demo.producaoListarEventosAtipicos(loteId);

export const registrarEventoAtipicoJornada = (loteId: number, body: CorpoDoEventoAtipico & { tipo: string }) =>
  demo.producaoRegistrarEventoAtipico(loteId, body);

export const registrarEventoAtipicoNoLoteInteiroJornada = (loteId: number, body: CorpoDoEventoAtipico & { tipo: string }) =>
  demo.producaoRegistrarEventoAtipicoNoLoteInteiro(loteId, body);

export const atualizarEventoAtipicoJornada = (id: number, body: CorpoDoEventoAtipico) =>
  demo.producaoAtualizarEventoAtipico(id, body);

export const excluirEventoAtipicoJornada = (id: number) =>
  demo.producaoExcluirEventoAtipico(id);

export const getEmbalagem = (params: Record<string, string | undefined>) =>
  demo.producaoEmbalagem(params);

export const salvarEmbalagemDia = (body: { data: string; data_lancamento?: string | null; valores: Record<number, number>; f54?: number | null }) =>
  demo.producaoSalvarEmbalagem(body);

export interface SaldoDeBandejasDia { data: string; valores: Record<number, number | null> }
export interface SaldoDeBandejasGrade { produtos: Array<{ id: number; nome: string }>; dias: SaldoDeBandejasDia[] }
export interface SaldoDeBandejasSalvo { data: string; gravados: number; apagados: number }

export const getSaldoDeBandejas = (params: { inicio?: string; fim?: string }) =>
  demo.producaoSaldoDeBandejas(params);

export const salvarSaldoDeBandejas = (body: { data: string; valores: Record<number, string | null> }) =>
  demo.producaoSalvarSaldoDeBandejas(body);

export const getEmbalagemResumo = (params: Record<string, string | undefined>) =>
  demo.producaoEmbalagemResumo(params);

export const listarDesprezos = (params: Record<string, string | undefined>) =>
  demo.producaoDesprezos(params);

export const registrarDesprezo = (body: DesprezoBody) =>
  demo.producaoRegistrarDesprezo(body);

export const atualizarDesprezo = (id: number, body: DesprezoBody) =>
  demo.producaoAtualizarDesprezo(id, body);

export const excluirDesprezo = (id: number) =>
  demo.producaoExcluirDesprezo(id);

export const getColheitasDoDia = (params: { data: string; tipo: string }) =>
  demo.producaoColheitasDoDia(params);

export const getIndicadoresCiclo = (params: Record<string, string | undefined>) =>
  demo.producaoIndicadores(params);

export const getPainelCiclo = (params: Record<string, string | undefined>) =>
  demo.producaoPainelCiclo(params);

export const getPrevisaoAbertura = (params: Record<string, string | undefined>) =>
  demo.producaoPrevisaoAbertura(params);

export const getPainelContaminados = (params: { hoje?: string; tipo?: string; inicio?: string; fim?: string } = {}) =>
  demo.painelContaminados(params);

export const getInvestigadorContaminacao = (params: Record<string, string>) =>
  demo.investigadorContaminacao(params);

export const getCruzamentoDeLotes = (params: Record<string, string>) =>
  demo.cruzamentoDeLotes(params);

export const getPainelOperacional = (params: Record<string, string | undefined>) =>
  demo.painelOperacional(params);

export const getSementesEstoque = () =>
  demo.sementesEstoque();

export const getSementesMovimentos = () =>
  demo.sementesMovimentos();

export const getSementesCepas = () =>
  demo.sementesCepas();

export const registrarSementeMovimento = (body: {
  data: string; data_nf?: string; ajuste?: boolean; tipo: 'ENTRADA' | 'SAIDA';
  cepa_id?: number; cepa?: string;
  nf?: string; data_producao?: string; quantidade: number;
}) => demo.sementesRegistrarMovimento(body);

export const atualizarSementeMovimento = (id: number, body: {
  data?: string; data_nf?: string | null; ajuste?: boolean;
  tipo?: 'ENTRADA' | 'SAIDA'; cepa?: string; cepa_id?: number; nf?: string | null;
  data_producao?: string; quantidade?: number;
}) => demo.sementesAtualizarMovimento(id, body);

export const excluirSementeMovimento = (id: number) =>
  demo.sementesExcluirMovimento(id);

export const putSementesParametros = (body: {
  tipo_cogumelo: string; gramas_por_saco: number | null;
}) => demo.sementesPutParametros(body);

export const getNecessidadeDeSementes = () =>
  demo.sementesNecessidade();

export const getComprasPrevistas = () =>
  demo.sementesComprasPrevistas();

export const putComprasPrevistas = (itens: Array<{ cepa_id: number; quantidade: number; observacao?: string }>) =>
  demo.sementesPutComprasPrevistas(itens);

export const getReceitasAntigas = () =>
  demo.receitasAntigas();

export const getLotesPesquisa = () =>
  demo.lotesPesquisa();

export const criarLotePesquisa = (body: Omit<LotePesquisa, 'id'>) =>
  demo.lotesPesquisaCriar(body);

export const excluirLotePesquisa = (id: number) =>
  demo.lotesPesquisaExcluir(id);

export interface ApiEstruturais {
  ano: number;
  capacidade_biologica: Array<{
    sala_id: number; sala: string;
    blocos_abertos: Array<number | null>; bandejas_produzidas: Array<number | null>; cb: Array<number | null>;
  }>;
  capacidade_fisica: Array<{
    sala_id: number; sala: string; num_estantes: number | null; capacidade_blocos: number | null;
    galpao_codigo: string | null; apelido: string | null;
  }>;
  capacidade_mensal_abertura: Array<{
    sala_id: number; sala: string; capacidade_blocos: number | null;
    dias_medios: number | null; capacidade_mensal: number | null;
  }>;
  capacidade_producao_bandejas: Array<{ sala_id: number; sala: string; cf_mensal: number | null; cpb: Array<number | null> }>;
}

export function mapEstruturaisResposta(r: ApiEstruturais): EstruturaisResposta {
  const cbPorSala = new Map(r.capacidade_biologica.map((l) => {
    const mes = ultimoMesComDado(l.cb);
    return [l.sala_id, { mes, valor: mes != null ? l.cb[mes - 1] : null }];
  }));
  const aberturaPorSala = new Map(r.capacidade_mensal_abertura.map((l) => [l.sala_id, l]));
  return {
    ano: r.ano,
    biologica: r.capacidade_biologica.map((l) => ({
      sala_id: l.sala_id, nome: l.sala,
      blocos_abertos: l.blocos_abertos, bandejas_produzidas: l.bandejas_produzidas, cb: l.cb,
    })),
    fisica: r.capacidade_fisica.map((l) => ({
      id: l.sala_id, nome: l.sala, num_estantes: l.num_estantes,
      capacidade_blocos: l.capacidade_blocos,
      dias_medios: aberturaPorSala.get(l.sala_id)?.dias_medios ?? null,
      galpao_codigo: l.galpao_codigo ?? null, apelido: l.apelido ?? null,
    })),
    abertura: r.capacidade_mensal_abertura.map((l) => ({
      sala_id: l.sala_id, nome: l.sala, capac_blocos: l.capacidade_blocos,
      dias_medios: l.dias_medios, capac_mensal: l.capacidade_mensal,
    })),
    bandejas: r.capacidade_producao_bandejas.map((l) => {
      const cbInfo = cbPorSala.get(l.sala_id) ?? null;
      const mes = cbInfo?.mes ?? null;
      return {
        sala_id: l.sala_id, nome: l.sala, cf_mensal: l.cf_mensal,
        cb: cbInfo?.valor ?? null, cb_mes: mes,
        cpb_mes: mes != null ? (l.cpb?.[mes - 1] ?? null) : null,
      };
    }),
  };
}

export const getEstruturais = (ano: number) =>
  demo.estruturais(ano);

export const putEstruturaisSala = (body: {
  salaId: number; num_estantes?: number | null; capacidade_blocos?: number | null; dias_medios?: number | null;
  galpao_codigo?: string | null; apelido?: string | null;
}) => demo.estruturaisPutSala(body);

export const putEstruturaisMensal = (body: {
  salaId: number; ano: number; mes: number;
  blocos_abertos?: number | null; bandejas_produzidas?: number | null;
}) => demo.estruturaisPutMensal(body);

const round2 = (v: number) => Math.round(v * 100) / 100;

export interface CompraMensalItem {
  id: number;
  categoria: string;
  subcategoria: string | null;
  descricao: string;
  especificacao: string | null;
  unidade: string | null;
  consumo_medio_mensal: number;
  tipo_consumo: 'CONTINUO' | 'SOB_DEMANDA';
  estoque_atual: number | null;
  inventariado_em: string | null;
  observacoes: string | null;
  comprar: number | null;
}

export const calcularComprar = (estoque: number | null, consumo: number) =>
  estoque == null ? null : round2(estoque - consumo);

const adaptarComprasMensal = (
  data: Array<Partial<CompraMensalItem>> | { itens?: Array<Partial<CompraMensalItem>> },
): CompraMensalItem[] => {
  const itens = Array.isArray(data) ? data : (data?.itens ?? []);
  return itens.map((i, idx) => ({
    id: i.id ?? idx + 1,
    categoria: i.categoria ?? '',
    subcategoria: i.subcategoria ?? null,
    descricao: i.descricao ?? '',
    especificacao: i.especificacao ?? null,
    unidade: i.unidade ?? null,
    consumo_medio_mensal: i.consumo_medio_mensal ?? 0,
    tipo_consumo: i.tipo_consumo === 'SOB_DEMANDA' ? 'SOB_DEMANDA' : 'CONTINUO',
    estoque_atual: i.estoque_atual ?? null,
    inventariado_em: i.inventariado_em ?? null,
    observacoes: i.observacoes ?? null,
    comprar: i.comprar ?? calcularComprar(i.estoque_atual ?? null, i.consumo_medio_mensal ?? 0),
  }));
};

export const getComprasMensal = (): Promise<CompraMensalItem[]> =>
  (demo.comprasMensal()
  ).then(adaptarComprasMensal);

export interface CompraMensalEdicao {
  categoria?: string; subcategoria?: string | null; descricao?: string;
  especificacao?: string | null; unidade?: string | null;
  consumo_medio_mensal?: number; tipo_consumo?: 'CONTINUO' | 'SOB_DEMANDA';
  estoque_atual?: number | null; observacoes?: string | null;
}

export const putCompraMensalItem = (id: number, body: CompraMensalEdicao) =>
  demo.comprasMensalAtualizar(id, body);

export const criarCompraMensalItem = (body: CompraMensalEdicao & { categoria: string; descricao: string }) =>
  demo.comprasMensalCriar(body);

export const excluirCompraMensalItem = (id: number) =>
  demo.comprasMensalExcluir(id);

export interface CompraMpIngrediente {
  materia_prima_id: number;
  materia_prima: string;
  ncm: string | null;
  embalagem: string | null;
  apresentacao_kg: number | null;
  custo_apresentacao: number | null;
  custo_por_kg: number | null;
  custo_kg: number | null;
  custo_kg_base: 'INFORMADO' | 'DERIVADO' | 'DESCONHECIDO';
  kg_por_receita: number | null;
  valor_por_receita: number | null;
  kg_por_bloco: number | null;
  necessario_kg: number | null;
  necessario_apresentacao: number | null;
  estoque_disponivel: number | null;
  compra: number | null;
}
export type ReceitaStatus = 'PADRAO' | 'TESTE' | 'INATIVA';

export interface CompraMpReceita {
  id: number;
  nome: string;
  status: ReceitaStatus | null;
  blocos_por_receita: number | null;
  rendimento_observado: number | null;
  lotes_medidos: number;
  blocos_previstos: number | null;
  tipo_previsao: TipoPrevisao | null;
  blocos_por_dia: number | null;
  dias_por_semana: number | null;
  peso_bloco_kg: number | null;
  custo_por_bloco_kg: number | null;
  valor_por_receita: number | null;
  custo_por_bloco_reais: number | null;
  ingredientes_sem_preco: string[];
  ingredientes: CompraMpIngrediente[];
}
export interface CompraMpEmbalagem {
  id: number;
  nome: string;
  unidade: string | null;
  estoque_disponivel: number | null;
  estoque_minimo: number | null;
  comprar: number | null;
}
export interface PedidoConsolidadoItem {
  materia_prima_id?: number | null;
  materia_prima: string;
  semente_tipo?: string | null;
  preco_materia_prima_id?: number | null;
  kg_por_saco?: number | null;
  compra_total: number | null;
  em_transito?: number | null;
  estoque_disponivel?: number | null;
  necessario_total?: number | null;
  estoque_minimo?: number | null;
  comprar?: number | null;
}
export interface ComprasMpPrevisao {
  horizonte_semanas: number;
  semanas: string[];
  sem_previsao: Array<{ tipo_cogumelo: TipoPrevisao; semanas: string[] }>;
}
export interface ComprasMpResposta {
  receitas: CompraMpReceita[];
  pedido_consolidado: PedidoConsolidadoItem[];
  embalagens: CompraMpEmbalagem[];
  previsao: ComprasMpPrevisao | null;
  sementes: NecessidadeDeSementesResposta | null;
}

export interface ApiComprasMp {
  receitas?: Array<Partial<Omit<CompraMpReceita, 'ingredientes'>> & { ingredientes?: Array<Partial<CompraMpIngrediente>> }>;
  pedido_consolidado?: PedidoConsolidadoItem[];
  embalagens?: Array<Partial<CompraMpEmbalagem>>;
  previsao?: ComprasMpPrevisao | null;
  sementes?: NecessidadeDeSementesResposta | null;
}

export function custoPorKgVigente(
  { custo_por_kg, custo_apresentacao, apresentacao_kg }:
  { custo_por_kg: number | null; custo_apresentacao: number | null; apresentacao_kg: number | null },
): { valor: number | null; base: 'INFORMADO' | 'DERIVADO' | 'DESCONHECIDO' } {
  if (custo_por_kg != null && custo_por_kg > 0) {
    return { valor: Number(custo_por_kg), base: 'INFORMADO' };
  }
  const apres = apresentacao_kg != null ? Number(apresentacao_kg) : null;
  const custo = custo_apresentacao != null ? Number(custo_apresentacao) : null;
  if (custo == null || custo <= 0 || apres == null || apres <= 0) {
    return { valor: null, base: 'DESCONHECIDO' };
  }
  return { valor: custo / apres, base: 'DERIVADO' };
}

export const adaptarComprasMp = (data: ApiComprasMp): ComprasMpResposta => {
  const r4 = (v: number | null) => (v == null ? null : Math.round(v * 10000) / 10000);
  const receitas: CompraMpReceita[] = (data.receitas ?? []).map((rec, ri) => {
    const blocos = rec.blocos_por_receita ?? null;
    const blocosPrevistos = rec.blocos_previstos ?? null;
    const ingredientes: CompraMpIngrediente[] = (rec.ingredientes ?? []).map((i, ii) => {
      const apres = i.apresentacao_kg ?? null;
      const custoApres = i.custo_apresentacao ?? null;
      const custoPorKgInformado = i.custo_por_kg ?? null;
      const vigente = custoPorKgVigente({
        custo_por_kg: custoPorKgInformado, custo_apresentacao: custoApres, apresentacao_kg: apres,
      });
      const custoKg = i.custo_kg ?? vigente.valor;
      const custoKgBase = i.custo_kg_base ?? vigente.base;
      const kgReceita = i.kg_por_receita ?? null;
      const kgBloco = i.kg_por_bloco ?? (kgReceita != null && blocos ? kgReceita / blocos : null);
      const necKg = i.necessario_kg
        ?? (kgBloco != null && blocosPrevistos != null ? kgBloco * blocosPrevistos : null);
      const necApres = i.necessario_apresentacao ?? (necKg != null && apres ? necKg / apres : null);
      const estoque = i.estoque_disponivel ?? null;
      const compra = i.compra
        ?? (necApres != null && estoque != null ? estoque - necApres : null);
      return {
        materia_prima_id: i.materia_prima_id ?? ii + 1,
        materia_prima: i.materia_prima ?? '',
        ncm: i.ncm ?? null,
        embalagem: i.embalagem ?? null,
        apresentacao_kg: apres,
        custo_apresentacao: custoApres,
        custo_por_kg: custoPorKgInformado,
        custo_kg: r4(custoKg),
        custo_kg_base: custoKgBase,
        kg_por_receita: kgReceita,
        valor_por_receita: r4(i.valor_por_receita
          ?? (kgReceita != null && custoKg != null ? kgReceita * custoKg : null)),
        kg_por_bloco: r4(kgBloco),
        necessario_kg: r4(necKg),
        necessario_apresentacao: r4(necApres),
        estoque_disponivel: estoque,
        compra: r4(compra),
      };
    });
    const somaKgBloco = ingredientes.reduce((s, i) => s + (i.kg_por_bloco ?? 0), 0);
    return {
      id: rec.id ?? ri + 1,
      nome: rec.nome ?? `Receita ${ri + 1}`,
      status: rec.status ?? null,
      blocos_por_receita: blocos,
      rendimento_observado: rec.rendimento_observado ?? null,
      lotes_medidos: rec.lotes_medidos ?? 0,
      blocos_previstos: blocosPrevistos,
      tipo_previsao: rec.tipo_previsao ?? null,
      blocos_por_dia: rec.blocos_por_dia ?? null,
      dias_por_semana: rec.dias_por_semana ?? null,
      peso_bloco_kg: rec.peso_bloco_kg ?? null,
      custo_por_bloco_kg: rec.custo_por_bloco_kg ?? r4(somaKgBloco),
      valor_por_receita: rec.valor_por_receita ?? null,
      custo_por_bloco_reais: rec.custo_por_bloco_reais ?? null,
      ingredientes_sem_preco: rec.ingredientes_sem_preco ?? [],
      ingredientes,
    };
  });
  let pedido = data.pedido_consolidado ?? [];
  if (pedido.length === 0) {
    const porInsumo = new Map<string, number>();
    for (const rec of receitas) {
      for (const i of rec.ingredientes) {
        if (i.compra == null) continue;
        porInsumo.set(i.materia_prima, (porInsumo.get(i.materia_prima) ?? 0) + i.compra);
      }
    }
    pedido = [...porInsumo.entries()].map(([materia_prima, total]) => ({
      materia_prima, compra_total: r4(total) ?? 0,
    }));
  }
  const embalagens: CompraMpEmbalagem[] = (data.embalagens ?? []).map((e, i) => ({
    id: e.id ?? i + 1,
    nome: e.nome ?? '',
    unidade: e.unidade ?? null,
    estoque_disponivel: e.estoque_disponivel ?? null,
    estoque_minimo: e.estoque_minimo ?? null,
    comprar: e.comprar ?? (e.estoque_disponivel == null
      ? null : round2(e.estoque_disponivel - (e.estoque_minimo ?? 0))),
  }));
  return { receitas, pedido_consolidado: pedido, embalagens, previsao: data.previsao ?? null, sementes: data.sementes ?? null };
};

export const getComprasMp = (): Promise<ComprasMpResposta> =>
  (demo.comprasMp())
    .then(adaptarComprasMp);

export const salvarEstoqueMinimoMp = (body: { materiaPrimaId: number; estoqueMinimo: number | null }) =>
  demo.comprasMpPutEstoqueMinimo(body);

export type TipoPrevisao = 'SH' | 'SB' | 'SP';
export interface PrevisaoLinha { semana: string; tipo_cogumelo: TipoPrevisao; blocos: number }
export interface PrevisaoResposta {
  horizonte_semanas: number;
  horizonte_origem: 'PADRAO' | 'BANCO';
  semanas: string[];
  tipos: Array<{ tipo: TipoPrevisao; nome: string }>;
  linhas: PrevisaoLinha[];
  totais: Array<{ tipo_cogumelo: TipoPrevisao; total: number | null; semanas_sem_previsao: string[] }>;
}
export interface PrevisaoItem { semana: string; tipo_cogumelo: TipoPrevisao; blocos: number | null }

export const getPrevisao = (): Promise<PrevisaoResposta> =>
  demo.previsao();

export const salvarPrevisao = (itens: PrevisaoItem[]): Promise<PrevisaoResposta> =>
  demo.salvarPrevisao(itens);

export const CHAVE_HORIZONTE_PREVISAO = 'previsao_horizonte_semanas';

export const putComprasMpPesoBloco = (body: { receitaId: number; pesoBlocoKg: number | null }) =>
  demo.comprasMpPutPesoBloco(body);

export const putComprasMpEstoque = (body: { materiaPrimaId: number; estoque: number | null }) =>
  demo.comprasMpPutEstoque(body);

export const putComprasMpEmTransito = (body: { materiaPrimaId: number; qtde: number | null }) =>
  demo.comprasMpPutEmTransito(body);

export const putComprasMpEmbalagem = (
  id: number,
  body: { estoque_disponivel?: number | null; estoque_minimo?: number | null },
) =>
  demo.comprasMpPutEmbalagem(id, body);

export const putComprasMpIngrediente = (body: {
  receitaId: number; materiaPrimaId: number;
  custo_apresentacao?: number; kg_por_receita?: number;
}) =>
  demo.comprasMpPutIngrediente(body);

export const putComprasMpCustoPorKg = (body: { materiaPrimaId: number; custoPorKg: number | null }) =>
  demo.comprasMpPutCustoPorKg(body);

export interface PimentaoRegistro {
  id: number;
  data: string;
  estufa: number;
  plantio: string;
  tipo: string;
  cliente: string;
  caixas: number | null;
  kg: number | null;
  desp_kg: number | null;
  preco_caixa: number | null;
  faturamento: number | null;
  origem?: string;
}

export const getPimentaoRegistros = (params: { inicio?: string; fim?: string } = {}): Promise<PimentaoRegistro[]> =>
  demo.pimentaoRegistros(params);

export const criarPimentaoRegistro = (body: {
  data: string; estufa: number; plantio: string; tipo: string; cliente: string;
  caixas: number; desp_kg?: number; preco_caixa?: number;
}) =>
  demo.pimentaoCriarRegistro(body);

export const excluirPimentaoRegistro = (id: number) =>
  demo.pimentaoExcluirRegistro(id);

export interface PimentaoConsolidadoLinha {
  id: number;
  estufa: number;
  plantio: string;
  inicio: string | null;
  fim: string | null;
  cor: string | null;
  total_plantado: number | null;
  cx_atacado: number;
  kg_atacado: number;
  cx_ceasa: number;
  kg_ceasa: number;
  total_caixas: number;
  total_kg: number;
  perdas_kg: number;
  pct_perdas: number | null;
  media_frutos_muda: number | null;
}

export const getPimentaoConsolidado = (): Promise<PimentaoConsolidadoLinha[]> =>
  demo.pimentaoConsolidado();

export interface PimentaoFinanceiroMes {
  ano: number;
  mes: number;
  fat_atacado: number | null; kg_atacado: number | null;
  fat_amarelo_atacado: number | null; kg_amarelo_atacado: number | null;
  fat_vermelho_atacado: number | null; kg_vermelho_atacado: number | null;
  fat_verde_atacado: number | null; kg_verde_atacado: number | null;
  fat_ceasa: number | null; kg_ceasa: number | null;
  fat_amarelo_ceasa: number | null; kg_amarelo_ceasa: number | null;
  fat_vermelho_ceasa: number | null; kg_vermelho_ceasa: number | null;
  fat_verde_ceasa: number | null; kg_verde_ceasa: number | null;
  total_kg: number | null;
  preco_medio_kg: number | null;
  faturamento_total: number | null;
  gastos_mp: number | null;
  demais_custos: number | null;
  custos_totais: number | null;
  margem_bruta: number | null;
  margem_pct: number | null;
}
export interface PimentaoFinanceiroResposta {
  ano: number;
  meses: PimentaoFinanceiroMes[];
  estufas: Array<{ estufa: number; faturamento: number | null; kg: number | null; preco_medio: number | null }>;
  total_geral: { faturamento: number | null; kg: number | null; preco_medio: number | null } | null;
}

export const getPimentaoFinanceiro = (ano: number): Promise<PimentaoFinanceiroResposta> =>
  demo.pimentaoFinanceiro(ano);

export const putPimentaoFinanceiro = (body: { ano: number; mes: number; gastos_mp?: number | null; demais_custos?: number | null }) =>
  demo.pimentaoPutFinanceiro(body);

export interface PimentaoPlantioLinha {
  id: number;
  plantio: string;
  cor: string | null;
  inicio: string | null;
  fim: string | null;
  faturamento: number | null;
  kg: number | null;
  preco_medio: number | null;
  meses: number | null;
  media_kg_mes: number | null;
  total_plantado: number | null;
  media_frutos_muda: number | null;
}
export interface PimentaoPlantiosResposta {
  estufas: Array<{
    estufa: number;
    faturamento: number | null; kg: number | null; preco_medio: number | null;
    plantios: PimentaoPlantioLinha[];
  }>;
  total_geral: { faturamento: number | null; kg: number | null; preco_medio: number | null } | null;
}

export const getPimentaoPlantios = (): Promise<PimentaoPlantiosResposta> =>
  demo.pimentaoPlantios();

export const putPimentaoPlantio = (id: number, body: {
  total_plantado?: number; inicio?: string; fim?: string | null; cor?: string;
}) =>
  demo.pimentaoPutPlantio(id, body);

export type DesempenhoOperacao = 'PRODUCAO' | 'REVENDA';

export interface DesempenhoCelula {
  receita: number | null;
  quantidade: number | null;
  preco_medio: number | null;
  participacao_pct: number | null;
  kg: number | null;
  rs_por_kg: number | null;
}
export interface DesempenhoProduto {
  produto_id: number | null;
  nome: string;
  especie: string | null;
  agregado: boolean;
  valores: Record<string, DesempenhoCelula>;
  total: DesempenhoCelula;
}
export interface DesempenhoResposta {
  ano: number;
  operacao: DesempenhoOperacao;
  meses: string[];
  mesesComDados: string[];
  produtos: DesempenhoProduto[];
  observacoes: string[];
  regime?: RegimePeriodo;
}

export const getDesempenho = (operacao: DesempenhoOperacao, ano: number) =>
  demo.desempenho(operacao, ano);

export interface Usuario {
  id: string | null;
  email: string;
  nome: string;
  role: string | null;
  role_nome?: string | null;
  unidade: string | null;
  unidade_nome?: string | null;
  mfa?: { fatores_verificados: number; aal: 'aal1' | 'aal2' } | null;
}

export const login = (_email: string, _senha: string) =>
  Promise.reject<{ token: string; usuario: Usuario }>(new Error('Login indisponível na demonstração.'));

export const getMe = () =>
  Promise.reject<Usuario>(new Error('Sessão indisponível na demonstração.'));
export const logout = (_token: string) =>
  Promise.resolve();

export interface MfaFator { id: string; status: 'verified' | 'unverified'; created_at: string }
export interface MfaEnrollResposta { id: string; qr_svg: string; secret: string; uri: string }

export const mfaFatores = () =>
  Promise.resolve({ fatores: [] as MfaFator[] });

export const mfaEnroll = () =>
  Promise.reject<MfaEnrollResposta>(new Error('Cadastro de autenticador indisponível na demonstração.'));

export const mfaVerify = (_factorId: string, _code: string) =>
  Promise.reject<{ ok: true; token: string }>(new Error('Confirmação de autenticador indisponível na demonstração.'));

export const mfaRemover = (_factorId: string) =>
  Promise.reject<{ ok: true }>(new Error('Remoção de autenticador indisponível na demonstração.'));

export const mfaChallenge = (_factorId: string, _code: string) =>
  Promise.reject<{ ok: true; token: string }>(new Error('Código do autenticador indisponível na demonstração.'));

export interface PeriodoRecente { ano: number | null; mes: number | null; meses: string[] }
function periodoRecenteDaDemo(): PeriodoRecente {
  const hoje = new Date();
  const ultimo = hoje.getFullYear() * 12 + hoje.getMonth() - 1;
  const meses = Array.from({ length: 23 }, (_, i) => ultimo - 22 + i).map((i) => `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`);
  return { ano: Math.floor(ultimo / 12), mes: (ultimo % 12) + 1, meses };
}
export const getPeriodoRecente = (): Promise<PeriodoRecente> =>
  Promise.resolve(periodoRecenteDaDemo());

export const getHealth = (): Promise<{ ok: boolean; versao: string | null }> =>
  Promise.resolve({ ok: true, versao: null });

export const getLancamentosManuais = (params: Record<string, string | number | undefined>) =>
  demo.lancamentosManuais(params);

export const corrigirLancamento = (id: number, body: object) =>
  demo.corrigirLancamento(id, body as Record<string, unknown>);

export const brl = (v: number | null | undefined) =>
  v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const brlK = (v: number | null | undefined) =>
  v == null ? '—' : `R$ ${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }).replace(/^-0$/, '0')}k`;
export const pct = (v: number | null | undefined) =>
  v == null ? '—' : `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 }).replace(/^-0$/, '0')}%`;
export const comUmaCasa = (v: number) => Number(v.toLocaleString('en-US', { maximumFractionDigits: 1, useGrouping: false }));
export function variacaoEmPontos(atual: number, anterior: number): number {
  return Math.round((comUmaCasa(atual) - comUmaCasa(anterior)) * 10) / 10 + 0;
}
export function variacaoEmMilhares(atual: number, anterior: number): number {
  return Math.round((comUmaCasa(atual / 1000) - comUmaCasa(anterior / 1000)) * 10) * 100 + 0;
}
const MES_CURTO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export const avisoMesesSemDespesa = (meses: string[] | undefined) => {
  if (!meses?.length) return undefined;
  const nomes = meses.map((ym) => `${MES_CURTO[Number(ym.slice(5, 7)) - 1] ?? ym}/${ym.slice(0, 4)}`);
  return `Sem despesa lançada em: ${nomes.join(', ')}`;
};
export const num = (v: number | null | undefined, casas = 0) =>
  v == null ? '—' : v.toLocaleString('pt-BR', { maximumFractionDigits: casas });
export const fmMoeda = (v: number) =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const fmPctFrac = (v: number) =>
  `${(v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
