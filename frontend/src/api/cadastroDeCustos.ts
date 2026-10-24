export type GrupoDoMaterial = 'FABRICACAO' | 'EMBALAGEM';

export interface VersaoDoPreco {
  id: number; versao: number; desde: string; fornecedor: string; apresentacao: string; quantidade_apresentacoes: number;
  conteudo_por_apresentacao: number; unidade_base: string; valor_total: number; frete: number;
  preco_unitario: number;
  documento: string | null; observacao: string; criado_em: string; criado_por_nome: string;
}
export interface MaterialDoCadastro {
  id: number; nome: string; grupo: GrupoDoMaterial; aplicacao: string | null; criado_em: string; criado_por_nome: string;
  fora_do_ativo_desde?: string | null; motivo_fora_do_ativo?: string | null;
  vigente: VersaoDoPreco | null;
  versoes: VersaoDoPreco[];
}
export interface CadastroDeCustos { hoje: string; janela: { de: string; ate: string }; materiais: MaterialDoCadastro[] }

export interface PrecoNovo {
  desde: string; fornecedor: string; apresentacao: string; quantidade_apresentacoes: number; conteudo_por_apresentacao: number;
  unidade_base: string; valor_total?: number; valor_por_apresentacao?: number; frete: number; documento: string | null; observacao: string;
}
export interface MaterialNovo extends PrecoNovo { nome: string; grupo: GrupoDoMaterial; aplicacao: string | null }
export interface VersaoNova extends PrecoNovo { material_id: number }

const fin = await import('./demoFinanceiro');
const semFixture = () => Promise.reject(new Error('Na demonstração o cadastro não grava alterações.'));

export const getCadastroDeCustos = (): Promise<CadastroDeCustos> =>
  fin!.getCadastroDeCustos();

export const criarMaterial = (_corpo: MaterialNovo): Promise<VersaoDoPreco & { material_id: number }> =>
  semFixture();

export const criarVersaoDoPreco = (_corpo: VersaoNova): Promise<VersaoDoPreco & { material_id: number }> =>
  semFixture();
