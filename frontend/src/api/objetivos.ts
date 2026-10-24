export type EspecieDoTermometro = 'SH' | 'SP' | 'SB' | 'SS';
export type AtividadeComCalendario = 'FABRICACAO' | 'COLHEITA' | 'VENDAS';
export type ChaveDoIndicador = 'BLOCOS_FABRICADOS' | 'BLOCOS_ABERTOS' | 'BANDEJAS_COLHIDAS' | 'BANDEJAS_APROVEITADAS' | 'KG_COLHIDOS'
  | 'BANDEJAS_VENDIDAS' | 'FATURAMENTO';
export type SituacaoDoIndicador = 'NO_RITMO' | 'ATENCAO' | 'ABAIXO' | 'SEM_META' | 'SEM_PROJECAO' | 'SEM_DADOS';
export type OrigemDaMeta = 'PADRAO' | 'BANCO';

export interface LinhaDoTermometro {
  chave: ChaveDoIndicador;
  meta: number | null;
  meta_origem: OrigemDaMeta | null;
  realizado: number | null;
  dados_ate: string | null;
  dias: { decorridos: number; restantes: number; total: number };
  media_por_dia: number | null;
  projecao: number | null;
  pct_realizado: number | null;
  pct_projecao: number | null;
  diferenca: number | null;
  ritmo_necessario: number | null;
  situacao: SituacaoDoIndicador;
  serie: Array<{ data: string; acumulado: number }>;
  sem_dados: string | null;
  abertura_viavel?: AberturaViavel | null;
}

export interface AberturaViavel {
  viavel: number;
  pct_da_meta: number | null;
  deficit: number | null;
  programado: number;
  falta_de_blocos: number;
  primeira_falta: string | null;
  desde: string;
  situacao: 'NO_RITMO' | 'ATENCAO' | 'ABAIXO' | 'SEM_META';
}

export interface SemanaDoQuadro { semana: number; de: string; ate: string; blocos: number | null; desde: string | null }
export interface MesDoQuadro {
  mes: string;
  saldo_inicial: number;
  saldo_inicial_em: string | null;
  semanas: SemanaDoQuadro[];
  total_maturado: number;
  disponiveis_no_mes: number;
  aberturas_programadas: number;
  aberturas_viaveis: number;
  deficit: number;
  saldo_disponivel: number;
  primeira_falta: string | null;
}
export type SituacaoDaAbertura = 'COBERTA' | 'FABRICAR' | 'PRAZO_VENCIDO';
export interface AberturaDoQuadro {
  data: string; salas: number; necessarios: number; disponivel: number; viaveis: number; falta: number;
  a_fabricar: number; margem_pct: number; data_limite: string | null; situacao: SituacaoDaAbertura;
}
export interface PlanejamentoDeMaturacao {
  especie: 'SH';
  data_dos_dados: string;
  lancamentos: { producao: string | null; abertura: string | null; retirada: string | null };
  prazo_dias: number | null;
  margem_pct: number;
  fim: string;
  maduro_na_data: number;
  em_maturacao: { data: string; total: number; maturados: number; maturando: number };
  fora_da_conta: { estantes_sem_contagem: number; estantes_conta_negativa: number; estantes_sem_data: number; blocos_sem_data: number; salas_sem_ancora: number };
  primeira_falta: string | null;
  meses: MesDoQuadro[];
  aberturas: AberturaDoQuadro[];
  fabricacao_por_mes: Array<{ mes: string; blocos: number; dias_de_fabricacao: number; por_dia: number | null; por_semana: number | null }>;
  prazo_vencido: { aberturas: number; blocos: number };
}

export interface UltimoMesApurado { mes: string; bandejas: number; receita: number; preco_medio: number | null; ate: string }
export interface CardContraReferencia {
  valor: number | null;
  anterior: number | null;
  referencia: number | null;
  referencia_origem: OrigemDaMeta | null;
  diferenca: number | null;
  diferenca_pct: number | null;
  situacao: 'FAVORAVEL' | 'DESFAVORAVEL' | 'SEM_REFERENCIA';
}
export interface CardsDoTermometro {
  bandejas_por_bloco: CardContraReferencia;
  kg_por_bloco: CardContraReferencia;
  contaminacao: CardContraReferencia & { contaminados: number; base: number; anterior_contaminados: number; anterior_base: number };
  preco_medio: CardContraReferencia & {
    dados_ate: string | null; sem_dados: string | null; anterior_ate: string | null; anterior_sem_dados: string | null;
    ultimo_apurado: UltimoMesApurado | null;
  };
  bandejas_vendidas: {
    valor: number | null; anterior: number | null; variacao: number | null; variacao_pct: number | null;
    meta: number | null; meta_origem: OrigemDaMeta; falta: number | null;
    dados_ate: string | null; sem_dados: string | null; anterior_ate: string | null; anterior_sem_dados: string | null;
    ultimo_apurado: UltimoMesApurado | null;
  };
}

export interface DiaSemOperacao { id: number; data: string; atividade: AtividadeComCalendario; motivo: string }

export type ChaveDaMetaDoTermometro = 'meta_mes_blocos_abertos' | 'meta_mes_bandejas_produzidas' | 'meta_mes_bandejas_vendidas'
  | 'ref_preco_medio_bandeja' | 'ref_bandejas_por_bloco' | 'ref_kg_por_bloco' | 'limite_contaminacao_abertos_pct'
  | 'abertura_blocos_por_sala' | 'abertura_ciclo_dias' | 'abertura_salas' | 'fabricacao_blocos_por_dia' | 'fabricacao_margem_contaminacao_pct';

export interface TermometroDoMes {
  mes: string;
  especie: EspecieDoTermometro | null;
  hoje: string;
  gramas_por_bandeja: number;
  atualizacao: { producao: string | null; embalagem: string | null; vendas: string | null; vendas_parcial: boolean };
  indicadores: LinhaDoTermometro[];
  cards: CardsDoTermometro;
  planejamento: PlanejamentoDeMaturacao;
  calendario: {
    dias: Record<AtividadeComCalendario | 'ABERTURA', number>;
    aberturas_programadas: Array<{ data: string; sala: string; blocos: number }>;
    ancoras: Array<{ sala: string; data: string }>;
    salas_sem_ancora: number;
    dias_sem_operacao: DiaSemOperacao[];
  };
  metas: Record<ChaveDaMetaDoTermometro, { valor: number | null; unidade: string; origem: OrigemDaMeta; vigente_desde: string | null }>;
}

const fin = await import('./demoFinanceiro');

export const getTermometro = (p: { mes: string; especie: EspecieDoTermometro | 'TODAS' }): Promise<TermometroDoMes> =>
  fin!.getTermometro(p);

export const criarDiaSemOperacao = (corpo: Omit<DiaSemOperacao, 'id'>): Promise<DiaSemOperacao> =>
  fin!.criarDiaSemOperacao(corpo);

export const apagarDiaSemOperacao = (id: number): Promise<{ id: number }> =>
  fin!.apagarDiaSemOperacao(id);
