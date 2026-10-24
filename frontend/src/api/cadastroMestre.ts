export type EtapaDaAtividade = 'BLOCO' | 'BANDEJA' | 'CONTAMINACAO' | 'ENTREGA' | 'GERAL' | 'COMPARTILHADO';
export type ClassificacaoDaAtividade = 'CUSTO_DO_BLOCO' | 'CUSTO_DA_BANDEJA' | 'PREJUIZO_POR_CONTAMINACAO' | 'CUSTO_DA_BANDEJA_ENTREGUE'
  | 'DESPESA_GERAL' | 'DESPESA_COMPARTILHADA' | 'CUSTO_INDIRETO_DE_PRODUCAO';
export type TipoDaFrequencia = 'POR_SEMANA' | 'POR_MES' | 'A_CADA_DIAS';
export type StatusDaVersao = 'CONFIRMADO' | 'REFERENCIA';

export interface VersaoDaAtividade {
  id: number; versao: number; desde: string; equipe: number; minutos_por_pessoa: number;
  frequencia_tipo: TipoDaFrequencia; frequencia_n: number; por_sala: boolean; status: StatusDaVersao;
  motivo: string | null; criado_em: string; criado_por_nome: string; frequencia: string;
}
export interface AtividadeDoCadastro {
  id: number; codigo: string; ordem: number; etapa: EtapaDaAtividade; nome: string; classificacao: ClassificacaoDaAtividade;
  vigente: (VersaoDaAtividade & { horas_homem: { por_semana: number; por_30_dias: number } }) | null;
  versoes: VersaoDaAtividade[];
}
export interface VigenciaDaSala {
  id: number; sala_id: number; entrada: string; saida: string | null;
  motivo_entrada: string; entrada_por_nome: string; motivo_saida: string | null; saida_por_nome: string | null;
}
export interface SalaDeFrutificacao { id: number; nome: string; em_uso_hoje: boolean; vigencias: VigenciaDaSala[] }
export interface CadastroMestre {
  hoje: string;
  salas_de_frutificacao: { quantidade: number; nomes: string[]; salas: SalaDeFrutificacao[] };
  atividades: AtividadeDoCadastro[];
}
export const ENTRADA_DA_CARGA = '2020-01-01';
export type MudancaDaSala = 'entrada' | 'saida';
export interface NovaVersao {
  codigo: string; desde: string; equipe: number; minutos_por_pessoa: number; frequencia_tipo: TipoDaFrequencia;
  frequencia_n: number; por_sala: boolean; status: StatusDaVersao; motivo: string;
}

const fin = await import('./demoFinanceiro');
const semFixture = () => Promise.reject(new Error('Na demonstração o cadastro não grava alterações.'));

export const getCadastroMestre = (): Promise<CadastroMestre> =>
  fin!.getCadastroMestre();

export const criarVersaoDoCadastro = (_corpo: NovaVersao): Promise<Omit<VersaoDaAtividade, 'frequencia'>> =>
  semFixture();

export const registrarMudancaDaSala = (_salaId: number, _mudanca: MudancaDaSala, _corpo: { data: string; motivo: string }): Promise<VigenciaDaSala> =>
  semFixture();
