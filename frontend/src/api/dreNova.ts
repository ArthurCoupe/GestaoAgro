import { type RegimePeriodo, type RegimeVigencia } from './client';
import type { MesProvisorio } from './gerencial';

const fin = await import('./demoFinanceiro');

export type VisaoNova = 'consolidado' | 'producao' | 'revenda';

export type RegimeApuracao = 'COMPETENCIA' | 'CAIXA';

export interface DreNovaFatiaPosicionada {
  linha_id: string;
  lancamento_id: string;
  empresa: string;
  segmento_negocio: string;
  segmento_produto: string | null;
  valorCent: number;
  entra_resultado: boolean | null;
}

export type TipoLinha = 'GRUPO' | 'SUBGRUPO' | 'CONTA' | 'TOTAL';

export interface DreNovaColunas {
  cogumelo: number;
  pimentao: number;
  sem_divisao: number;
  total: number;
}

export interface DreNovaLinha {
  linha_id: number;
  codigo_oficial: string | null;
  codigo: string | null;
  rotulo: string | null;
  rotulo_catalogo: string | null;
  tipo: TipoLinha | null;
  numeracao: string | null;
  sinal: string | null;
  entra_resultado: boolean | null;
  nivel: number | null;
  observacao: string | null;
  ordem: number;
  profundidade: number | null;
  linha_pai_id: number | null;
  celula_origem: string | null;
  valor: number;
  valor_acumulado: number;
  cadeia_resolvida: boolean | null;
  quantidade_fatias: number;
  tem_fato: boolean;
  valor_atribuido: boolean;
  colunas: DreNovaColunas | null;
  colunas_acumuladas: DreNovaColunas | null;
}

export interface DreNovaForaLinha {
  linha_id: number;
  codigo_oficial: string | null;
  rotulo: string | null;
  tipo: string | null;
  quantidade_fatias: number;
  valor: number;
}

export interface DreNovaForaBalde {
  motivo: string;
  rotulo?: string;
  descricao: string;
  quantidade_fatias: number;
  valor: number;
  linhas: DreNovaForaLinha[];
}

export interface DreNovaReconciliacao {
  regra: string;
  competencia: string;
  visao: VisaoNova;
  total_fatias_da_visao: number;
  quantidade_fatias_da_visao: number;
  soma_linhas_exibidas: number;
  quantidade_fatias_exibidas: number;
  total_fora: number;
  quantidade_fatias_fora: number;
  fora: DreNovaForaBalde[];
  diferenca: number;
  tolerancia: number;
  confere: boolean;
  leitura_completa: {
    fatias_na_tabela: number | null;
    fatias_carregadas: number;
    confere: boolean | null;
    por_que: string;
  };
  escopo: { criterio: string } & Record<string, unknown>;
}

export interface DreNovaCadeia {
  aplicada: boolean;
  disponivel_no_banco: boolean;
  componentes_cadastrados_nesta_visao: number;
  componentes_cadastrados_no_total: number;
  linhas_de_tipo_total_nesta_visao: number;
  motivo: string;
  consequencia: string;
}

export interface DreNovaIndicadores {
  disponivel: boolean;
  motivo: string | null;
  pre_requisitos: { cadeia_de_totais: boolean; comportamento: boolean };
  linhas_sem_classificacao: number;
  linhas_mistas: number;
  margem_operacional_pct: number | null;
  margem_contribuicao: number | null;
  margem_contribuicao_pct: number | null;
  ponto_equilibrio: number | null;
  diferenca_para_o_ponto_de_equilibrio: number | null;
  custos_e_despesas_fixos?: number | null;
}

export interface BudgetDaLinha {
  budget_cent: number;
  desvio_cent: number | null;
  desvio_pct: number | null;
  cor: 'VERDE' | 'AMARELO' | 'VERMELHO' | null;
}
export interface DreNovaBudget {
  estado: 'COMPARADO' | 'SEM_APROVADO' | 'INCOMPLETO' | 'ERRO';
  exercicio?: number;
  versao?: { id: number; nome: string } | null;
  meses_do_periodo?: string[];
  meses_sem_budget?: string[];
  meses_sem_realizado?: string[];
  meses_reconstruidos?: string[];
  por_linha?: Record<string, BudgetDaLinha>;
  defeitos?: string[];
  mensagem?: string;
}

export interface DreNovaResposta {
  competencia: string;
  budget?: DreNovaBudget;
  periodo?: { inicio: string; fim: string; meses: string[] };
  meses_sem_fato?: string[];
  visao: VisaoNova;
  visao_no_banco: string;
  fonte: { estrutura: string; valor: string; catalogo: string };
  quantidade_linhas: number;
  quantidade_linhas_com_fato: number;
  linhas: DreNovaLinha[];
  reconciliacao: DreNovaReconciliacao;
  cadeia_de_totais: DreNovaCadeia;
  indicadores: DreNovaIndicadores;
  avisos: string[];
  defeitos: string[];
  defeito: boolean;
  regime?: RegimeVigencia | RegimePeriodo;
  regime_apuracao?: RegimeApuracao;
  fatias_posicionadas?: DreNovaFatiaPosicionada[];
  meses_provisorios?: MesProvisorio[];
}

export interface DreNovaCompetencia {
  competencia: string;
  rotulo: string;
  quantidade_fatias: number;
  total: number;
}

export interface DreNovaCompetenciasResposta {
  fonte: string;
  regime_apuracao?: RegimeApuracao;
  escopo: { visoes_permitidas: VisaoNova[]; criterio: string };
  quantidade: number;
  mais_recente: string | null;
  competencias: DreNovaCompetencia[];
  aviso: string;
  visoes: VisaoNova[];
}

export const ehRollUp = (l: Pick<DreNovaLinha, 'tipo'>): boolean => l.tipo !== 'CONTA';

export function valorExibido(
  l: Pick<DreNovaLinha, 'tipo' | 'valor' | 'valor_acumulado'>,
): number {
  return ehRollUp(l) ? l.valor_acumulado : l.valor;
}

export const semValorPublicavel = (
  l: Pick<DreNovaLinha, 'tipo' | 'cadeia_resolvida'>,
): boolean => l.tipo === 'TOTAL' && l.cadeia_resolvida === false;

export interface ItemDaFaixa {
  gravidade: 'defeito' | 'aviso';
  chave: string;
  texto: string;
  valor?: number;
  quantidade_fatias?: number;
  quantidade_linhas?: number;
  linhas?: string[];
}

export function faixaDeIncompletude(d: DreNovaResposta): ItemDaFaixa[] {
  const itens: ItemDaFaixa[] = [];

  for (const texto of d.defeitos) {
    itens.push({ gravidade: 'defeito', chave: 'DEFEITO', texto });
  }

  if (!d.cadeia_de_totais.aplicada) {
    itens.push({
      gravidade: 'aviso',
      chave: 'SEM_CADEIA',
      texto: 'Sem Resultado Líquido: a cadeia de totais ainda não foi cadastrada. '
        + 'Os subtotais que aparecem são de bloco, e nenhum total foi inventado.',
    });
  }

  for (const b of d.reconciliacao.fora) {
    itens.push({
      gravidade: 'aviso',
      chave: b.motivo,
      texto: b.descricao,
      valor: b.valor,
      quantidade_fatias: b.quantidade_fatias,
      quantidade_linhas: b.linhas.length,
      linhas: b.linhas.map(nomeDaLinhaFora),
    });
  }

  return itens;
}

export const nomeDaLinhaFora = (l: Pick<DreNovaForaLinha, 'linha_id' | 'codigo_oficial' | 'rotulo'>): string =>
  [l.codigo_oficial, l.rotulo].filter(Boolean).join(' ') || `linha ${l.linha_id}`;

const PROFUNDIDADE_MAXIMA = 50;

export function linhasComMovimento(linhas: DreNovaLinha[]): Set<number> {
  const paiDe = new Map<number, number | null>(linhas.map((l) => [l.linha_id, l.linha_pai_id]));
  const manter = new Set<number>();
  for (const l of linhas) {
    if (!l.tem_fato) continue;
    let id: number | null = l.linha_id;
    let passos = 0;
    while (id != null && !manter.has(id) && passos < PROFUNDIDADE_MAXIMA) {
      manter.add(id);
      id = paiDe.get(id) ?? null;
      passos += 1;
    }
  }
  return manter;
}

function comMovimentoEAncestrais(linhas: DreNovaLinha[], comBudget: ReadonlySet<string>): DreNovaLinha[] {
  const manter = linhasComMovimento(linhas);
  return linhas.filter((l) => manter.has(l.linha_id) || comBudget.has(String(l.linha_id)));
}

export function linhasVisiveis(
  linhas: DreNovaLinha[],
  recolhidos: ReadonlySet<number>,
  ocultarZeradas: boolean,
  comBudget: ReadonlySet<string> = new Set(),
): DreNovaLinha[] {
  const base = ocultarZeradas ? comMovimentoEAncestrais(linhas, comBudget) : linhas;
  const saida: DreNovaLinha[] = [];
  let profundidadeOculta: number | null = null;
  for (const l of base) {
    const prof = l.profundidade ?? 1;
    if (profundidadeOculta != null) {
      if (prof > profundidadeOculta) continue;
      profundidadeOculta = null;
    }
    saida.push(l);
    if (recolhidos.has(l.linha_id)) profundidadeOculta = prof;
  }
  return saida;
}

export function semBudgetSemVersaoAprovada<T extends { budget?: { estado: string } }>(r: T): T {
  if (r.budget?.estado !== 'SEM_APROVADO') return r;
  const { budget: _semAprovado, ...resto } = r;
  return resto as T;
}

export const getDreNova = (competencia: string, visao: VisaoNova, desde?: string): Promise<DreNovaResposta> =>
  fin!.getDreNova(competencia, visao, desde);

export const getDreNovaCompetencias = (): Promise<DreNovaCompetenciasResposta> =>
  fin!.getDreNovaCompetencias();
