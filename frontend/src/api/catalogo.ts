export interface ProdutoCatalogo {
  codigo: string;
  nome: string;
  embalagem: string;
  erp: string | null;
}

export const PRODUTOS_REVENDA: ProdutoCatalogo[] = [
  { codigo: 'SP', nome: 'Shimeji Preto', embalagem: '200 g', erp: 'SP 200 GRAMAS' },
  { codigo: 'SH', nome: 'Shiitake', embalagem: '200 g', erp: 'SH 200 GRAMAS' },
  { codigo: 'CH', nome: 'Champignon', embalagem: '250 g', erp: 'CHAMPIGNON PARIS 250 GRAMAS' },
  { codigo: 'PB', nome: 'Porto Belo', embalagem: '250 g', erp: 'PORTO BELO 250 GRAMAS' },
  { codigo: 'PL', nome: 'Paris Lavado', embalagem: '250 g', erp: 'PARIS LAVADO 250 GRAMAS' },
  { codigo: 'PF', nome: 'Paris Fatiado', embalagem: '200 g', erp: 'PARIS FATIADO 200 GRAMAS' },
];

export const PRODUTOS_PRODUCAO: ProdutoCatalogo[] = [
  { codigo: 'SH', nome: 'Shiitake', embalagem: 'bandeja 200 g', erp: 'SHIITAKE' },
  { codigo: 'SP', nome: 'Shimeji Preto', embalagem: 'bandeja 200 g / 1 kg', erp: 'SHIMEJI PRETO' },
  { codigo: 'SB', nome: 'Shimeji Branco', embalagem: 'bandeja 200 g / 1 kg', erp: 'SHIMEJI BRANCO' },
  { codigo: 'SS', nome: 'Shimeji Salmão', embalagem: '200 g', erp: 'SHIMEJI SALMÃO 200G EX' },
  { codigo: 'PV', nome: 'Pimentão Verde', embalagem: 'caixa', erp: 'PIMENTAO VERDE' },
  { codigo: 'PVM', nome: 'Pimentão Vermelho', embalagem: 'caixa', erp: 'PIMENTAO VERMELHO' },
  { codigo: 'PA', nome: 'Pimentão Amarelo', embalagem: 'caixa', erp: 'PIMENTAO AMARELO' },
];

export const catalogoDaOperacao = (operacao: 'PRODUCAO' | 'REVENDA'): ProdutoCatalogo[] =>
  (operacao === 'REVENDA' ? PRODUTOS_REVENDA : PRODUTOS_PRODUCAO);
