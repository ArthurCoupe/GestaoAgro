import type {
  CompraMensalItem, CompraMpEmbalagem, PimentaoConsolidadoLinha,
  PimentaoFinanceiroMes, PimentaoPlantioLinha, PimentaoRegistro, ReceitaStatus,
} from './client';
import { gerador, r2, r4 } from './semente';

type LinhaCompra = [categoria: string, subcategoria: string, descricao: string, especificacao: string,
  unidade: string, consumo: number, tipo: 'CONTINUO' | 'SOB_DEMANDA', estoque: number | null, obs?: string];
const COMPRAS: LinhaCompra[] = [
  ['Copa e Cozinha', 'Alimentos', 'Café em Pó', 'Pacote 500 g', 'PCT', 6, 'CONTINUO', 4],
  ['Copa e Cozinha', 'Alimentos', 'Açúcar Refinado', 'Pacote 1 kg', 'PCT', 4, 'CONTINUO', 1],
  ['Copa e Cozinha', 'Descartáveis', 'Copo Descartável 180 ml', 'Caixa c/ 2000', 'CX', 1, 'CONTINUO', 0],
  ['Defensivos Agrícolas', 'Inseticidas', 'Armadilha Adesiva Amarela', 'Pacote c/ 10', 'PCT', 2, 'CONTINUO', 3],
  ['Defensivos Agrícolas', 'Inseticidas', 'Isca Granulada', 'Pacote 500 g', 'PCT', 0, 'SOB_DEMANDA', null, 'Conferir no galpão'],
  ['EPI', 'Vestimenta', 'Jaleco Descartável', 'Pacote c/ 10', 'PCT', 3, 'CONTINUO', 2],
  ['EPI', 'Luvas', 'Luva Nitrílica', 'Tamanho M', 'CX', 4, 'CONTINUO', 5],
  ['EPI', 'Luvas', 'Luva Nitrílica', 'Tamanho G', 'CX', 4, 'CONTINUO', 5],
  ['EPI', 'Luvas', 'Luva de Raspa', 'Par', 'PAR', 0, 'SOB_DEMANDA', 6],
  ['EPI', 'Proteção Respiratória', 'Máscara PFF2', 'Caixa c/ 20', 'CX', 2, 'CONTINUO', 2],
  ['EPI', 'Proteção Capilar', 'Touca Sanfonada', 'Pacote c/ 100', 'PCT', 2, 'CONTINUO', 0],
  ['Higiene', 'Papel', 'Papel Higiênico', 'Fardo 16 rolos', 'FD', 3, 'CONTINUO', 2],
  ['Higiene', 'Papel', 'Papel Toalha', 'Fardo 1000 folhas', 'FD', 4, 'CONTINUO', 6],
  ['Higiene', 'Sabonete', 'Sabonete Líquido', 'Galão 5 litros', 'GL', 1, 'CONTINUO', 1],
  ['Limpeza', 'Desinfecção', 'Álcool 70%', 'Galão 5 litros', 'GL', 5, 'CONTINUO', 3],
  ['Limpeza', 'Desinfecção', 'Hipoclorito de Sódio', 'Galão 5 litros', 'GL', 4, 'CONTINUO', 4],
  ['Limpeza', 'Desinfecção', 'Quaternário de Amônio', 'Galão 5 litros', 'GL', 2, 'CONTINUO', null],
  ['Limpeza', 'Limpeza Geral', 'Detergente Neutro', 'Frasco 500 ml', 'UN', 8, 'CONTINUO', 12],
  ['Limpeza', 'Limpeza Geral', 'Pano Multiuso', 'Rolo 300 m', 'Rolo', 1, 'CONTINUO', 0],
  ['Limpeza', 'Resíduos', 'Saco para Lixo', '100 litros c/ 100', 'PCT', 2, 'CONTINUO', 1],
  ['Materiais de Consumo', 'Fitas', 'Fita Crepe', 'Rolo 48 mm', 'Rolo', 0, 'SOB_DEMANDA', 4],
  ['Materiais de Consumo', 'Fitas', 'Fita para Reparo de Estufa', 'Rolo 10 m', 'Rolo', 0, 'SOB_DEMANDA', 1],
  ['Materiais de Consumo', 'Etiquetas', 'Etiqueta Térmica', 'Rolo c/ 1000', 'Rolo', 3, 'CONTINUO', 2],
  ['Materiais de Consumo', 'Selantes', 'Silicone Neutro', 'Tubo 280 g', 'Tubo', 0, 'SOB_DEMANDA', null],
];
export const FX_COMPRAS_MENSAL: Array<Omit<CompraMensalItem, 'comprar' | 'inventariado_em'>> =
  COMPRAS.map(([categoria, subcategoria, descricao, especificacao, unidade, consumo, tipo, estoque, obs], i) => ({
    id: i + 1, categoria, subcategoria, descricao, especificacao, unidade,
    consumo_medio_mensal: consumo, tipo_consumo: tipo, estoque_atual: estoque, observacoes: obs ?? null,
  }));

export interface FxMpIngrediente {
  materia_prima_id: number; materia_prima: string; ncm: string | null;
  embalagem: string | null; apresentacao_kg: number | null;
  custo_apresentacao: number | null; kg_por_receita: number | null;
}
export interface FxMpReceita {
  id: number; nome: string; blocos_por_receita: number;
  status: ReceitaStatus | null;
  ingredientes: FxMpIngrediente[];
}

const MP: Record<number, [string, string, number, number]> = {
  1: ['Serragem', 'saco', 30, 0],
  2: ['Farelo de Trigo', 'saco', 25, 49.9],
  3: ['Germen de Milho', 'saco', 30, 63.5],
  4: ['Painço', 'saco', 20, 88],
  5: ['Calcário', 'saco', 20, 17.4],
  6: ['Gesso', 'saco', 30, 21.8],
  7: ['Semente', 'saco', 1, 14.5],
  8: ['Saquinho', 'cx', 500, 520],
};
const receita = (id: number, nome: string, blocos: number, status: ReceitaStatus | null,
  kgs: Array<[number, number]>, semPreco: number[] = []): FxMpReceita => ({
  id, nome, blocos_por_receita: blocos, status,
  ingredientes: kgs.map(([mp, kg]) => {
    const [nomeMp, embalagem, apresentacao, custo] = MP[mp];
    return {
      materia_prima_id: mp, materia_prima: nomeMp, ncm: null, embalagem,
      apresentacao_kg: apresentacao, custo_apresentacao: semPreco.includes(mp) ? null : custo,
      kg_por_receita: kg,
    };
  }),
});
export const FX_MP_RECEITAS: FxMpReceita[] = [
  receita(1, 'Receita Shiitake', 120, 'PADRAO', [[1, 98], [2, 22], [3, 5], [4, 6], [5, 2], [6, 1.5], [7, 3], [8, 120]]),
  receita(2, 'Receita Shimeji Preto bloco de 1kg', 240, 'PADRAO', [[1, 98], [2, 16], [3, 4], [5, 1.5], [6, 2.5], [7, 4.5], [8, 240]]),
  receita(3, 'Receita Shimeji Preto bloco de 2kg', 120, 'PADRAO', [[1, 98], [2, 16], [3, 4], [5, 1.5], [6, 2.5], [7, 4], [8, 120]]),
  receita(4, 'Receita Shimeji Branco', 120, 'PADRAO', [[1, 98], [2, 17], [3, 3], [5, 1.2], [6, 2.2], [7, 4], [8, 120]], [1]),
  receita(5, 'Shiitake - Receita Antiga', 120, 'TESTE', [[1, 98], [2, 26], [3, 6], [4, 6], [5, 1.5], [6, 2.5], [7, 3], [8, 120]]),
];

export const FX_MP_ESTOQUE: Record<number, number> = { 1: 120, 2: 9, 3: 4, 4: 2, 5: 6, 6: 3, 7: 40, 8: 1 };

export const FX_MP_EMBALAGENS: Array<Omit<CompraMpEmbalagem, 'comprar'>> = [
  { id: 1, nome: 'Bobina de papel kraft', unidade: 'rolos', estoque_disponivel: 8, estoque_minimo: 4 },
  { id: 2, nome: 'Filme stretch', unidade: 'rolos', estoque_disponivel: 2, estoque_minimo: 2 },
  { id: 3, nome: 'Bandeja de polpa', unidade: 'pcte 250', estoque_disponivel: 0, estoque_minimo: 1 },
  { id: 4, nome: 'Caixa de papelão 10 kg', unidade: 'fardo 25', estoque_disponivel: 2, estoque_minimo: 5 },
];

const g = gerador(20261024);
const KG_POR_CAIXA = 8;
type Comprador = 'ATACADO' | 'CEASA';
type Cor = 'Amarelo' | 'Vermelho' | 'Verde';

const iso = (d: Date) => d.toISOString().slice(0, 10);
const mesK = (k: number) => new Date(Date.UTC(2024, k, 1));
const hoje = new Date();
const ULTIMO = (hoje.getFullYear() - 2024) * 12 + hoje.getMonth() - 1;

const PLANTIOS: Array<[estufa: number, ordem: string, cor: Cor, mudas: number, inicio: number, fim: number | null]> = [
  [1, '1º', 'Amarelo', 3000, 0, 14], [1, '2º', 'Amarelo', 3100, 15, null],
  [2, '1º', 'Vermelho', 2800, 1, 15], [2, '2º', 'Vermelho', 2900, 16, null],
  [3, '1º', 'Vermelho', 3200, 2, 17], [3, '2º', 'Verde', 3000, 18, null],
  [4, '1º', 'Amarelo', 2700, 5, 19], [4, '2º', 'Vermelho', 2700, 20, null],
  [5, '1º', 'Amarelo', 2400, 8, null],
  [6, '1º', 'Verde', 2200, 21, null],
];
const PRECO_KG: Record<Cor, number> = { Amarelo: 11.2, Vermelho: 10.4, Verde: 7.6 };

interface Producao { plantioId: number; estufa: number; cor: Cor; ano: number; mes: number; comprador: Comprador; kg: number; fat: number; perdasKg: number }
const producao: Producao[] = [];
PLANTIOS.forEach(([estufa, , cor, mudas, inicio, fim], i) => {
  const g = gerador(20261024 + i);
  for (let k = inicio + 3; k <= Math.min(fim ?? ULTIMO, ULTIMO); k += 1) {
    const d = mesK(k);
    const kgMes = mudas * g.entre(0.38, 0.62);
    const kgAtacado = Math.round((kgMes * g.entre(0.72, 0.9)) / KG_POR_CAIXA) * KG_POR_CAIXA;
    const kgCeasa = Math.round((kgMes - kgAtacado) / KG_POR_CAIXA) * KG_POR_CAIXA;
    for (const [comprador, kg] of [['ATACADO', kgAtacado], ['CEASA', kgCeasa]] as const) {
      const preco = PRECO_KG[cor] * (comprador === 'ATACADO' ? 1 : 1.12) * g.entre(0.88, 1.14);
      producao.push({ plantioId: i + 1, estufa, cor, ano: d.getUTCFullYear(), mes: d.getUTCMonth() + 1, comprador, kg, fat: Math.round(kg * preco), perdasKg: r2(kg * g.entre(0.03, 0.08)) });
    }
  }
});
const soma = (linhas: Producao[], campo: 'kg' | 'fat' | 'perdasKg') => linhas.reduce((t, l) => t + l[campo], 0);
const precoMedio = (fat: number, kg: number) => (kg ? r4(fat / kg) : null);

export const FX_PIMENTAO_REGISTROS: PimentaoRegistro[] = (() => {
  const d = mesK(ULTIMO);
  const doMes = producao.filter((p) => p.ano === d.getUTCFullYear() && p.mes === d.getUTCMonth() + 1);
  const linhas: PimentaoRegistro[] = [];
  for (let i = 0; i < 30; i += 1) {
    const p = doMes[i % doMes.length];
    const dia = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 3 + Math.floor(i / 3) * 2));
    const caixas = g.inteiro(4, 22);
    const precoCaixa = Math.round((p.fat / p.kg) * KG_POR_CAIXA);
    linhas.push({
      id: i + 1, data: iso(dia), estufa: p.estufa, plantio: PLANTIOS[p.plantioId - 1][1], tipo: p.cor,
      cliente: p.comprador, caixas, kg: caixas * KG_POR_CAIXA, desp_kg: g.inteiro(0, 12),
      preco_caixa: precoCaixa, faturamento: caixas * precoCaixa, origem: 'IMPORTACAO',
    });
  }
  return linhas;
})();

const doPlantio = (id: number) => producao.filter((p) => p.plantioId === id);
const inicioDe = (k: number) => iso(new Date(mesK(k).getTime() + 14 * 86400000));
const fimDe = (k: number | null) => (k == null ? null : iso(new Date(mesK(k + 1).getTime() - 86400000)));

export const FX_PIMENTAO_CONSOLIDADO: PimentaoConsolidadoLinha[] = PLANTIOS.map(([estufa, ordem, cor, mudas, inicio, fim], i) => {
  const linhas = doPlantio(i + 1);
  const de = (c: Comprador) => linhas.filter((l) => l.comprador === c);
  const kgAtacado = soma(de('ATACADO'), 'kg');
  const kgCeasa = soma(de('CEASA'), 'kg');
  const totalKg = kgAtacado + kgCeasa;
  const perdas = r2(soma(linhas, 'perdasKg'));
  return {
    id: i + 1, estufa, plantio: ordem, inicio: inicioDe(inicio), fim: fimDe(fim), cor, total_plantado: mudas,
    cx_atacado: kgAtacado / KG_POR_CAIXA, kg_atacado: kgAtacado, cx_ceasa: kgCeasa / KG_POR_CAIXA, kg_ceasa: kgCeasa,
    total_caixas: totalKg / KG_POR_CAIXA, total_kg: totalKg, perdas_kg: perdas,
    pct_perdas: totalKg ? r4(perdas / totalKg) : null, media_frutos_muda: r4(totalKg / mudas),
  };
});

export const FX_PIMENTAO_FINANCEIRO: PimentaoFinanceiroMes[] = Array.from({ length: ULTIMO + 1 }, (_, k) => {
  const d = mesK(k);
  const ano = d.getUTCFullYear();
  const mes = d.getUTCMonth() + 1;
  const doMes = producao.filter((p) => p.ano === ano && p.mes === mes);
  const parte = (c: Comprador, cor?: Cor) => {
    const l = doMes.filter((p) => p.comprador === c && (!cor || p.cor === cor));
    return l.length ? [soma(l, 'fat'), soma(l, 'kg')] : [null, null];
  };
  const [fatS, kgS] = parte('ATACADO');
  const [fatC, kgC] = parte('CEASA');
  const fat = (fatS ?? 0) + (fatC ?? 0);
  const kg = (kgS ?? 0) + (kgC ?? 0);
  const gastosMp = -r2(fat * g.entre(0.32, 0.4) + 2600);
  const demais = -r2(fat * g.entre(0.18, 0.24) + 1900);
  const custos = r2(gastosMp + demais);
  const [fatAS, kgAS] = parte('ATACADO', 'Amarelo'); const [fatVS, kgVS] = parte('ATACADO', 'Vermelho'); const [fatGS, kgGS] = parte('ATACADO', 'Verde');
  const [fatAC, kgAC] = parte('CEASA', 'Amarelo'); const [fatVC, kgVC] = parte('CEASA', 'Vermelho'); const [fatGC, kgGC] = parte('CEASA', 'Verde');
  return {
    ano, mes,
    fat_atacado: fatS, kg_atacado: kgS, fat_amarelo_atacado: fatAS, kg_amarelo_atacado: kgAS,
    fat_vermelho_atacado: fatVS, kg_vermelho_atacado: kgVS, fat_verde_atacado: fatGS, kg_verde_atacado: kgGS,
    fat_ceasa: fatC, kg_ceasa: kgC, fat_amarelo_ceasa: fatAC, kg_amarelo_ceasa: kgAC,
    fat_vermelho_ceasa: fatVC, kg_vermelho_ceasa: kgVC, fat_verde_ceasa: fatGC, kg_verde_ceasa: kgGC,
    total_kg: kg || null, preco_medio_kg: precoMedio(fat, kg), faturamento_total: fat || null,
    gastos_mp: gastosMp, demais_custos: demais, custos_totais: custos,
    margem_bruta: r2(fat + custos), margem_pct: fat ? r4((fat + custos) / fat) : null,
  };
});

const resumo = (linhas: Producao[]) => {
  const faturamento = soma(linhas, 'fat');
  const kg = soma(linhas, 'kg');
  return { faturamento, kg, preco_medio: precoMedio(faturamento, kg) };
};
const ESTUFAS = [...new Set(PLANTIOS.map(([e]) => e))];

export const FX_PIMENTAO_ESTUFAS = ESTUFAS.map((estufa) => ({ estufa, ...resumo(producao.filter((p) => p.estufa === estufa)) }));
export const FX_PIMENTAO_TOTAL_GERAL = resumo(producao);

export const FX_PIMENTAO_PLANTIOS: Array<{ estufa: number; faturamento: number; kg: number; preco_medio: number | null; plantios: PimentaoPlantioLinha[] }> =
  FX_PIMENTAO_ESTUFAS.map((e) => ({
    ...e,
    plantios: FX_PIMENTAO_CONSOLIDADO.filter((c) => c.estufa === e.estufa).map((c) => {
      const linhas = doPlantio(c.id);
      const meses = new Set(linhas.map((l) => `${l.ano}-${l.mes}`)).size;
      const { faturamento, kg, preco_medio } = resumo(linhas);
      return {
        id: c.id, plantio: c.plantio, cor: c.cor, inicio: c.inicio, fim: c.fim, faturamento, kg, preco_medio,
        meses, media_kg_mes: meses ? r2(kg / meses) : null, total_plantado: c.total_plantado,
        media_frutos_muda: c.media_frutos_muda,
      };
    }),
  }));
export const FX_PIMENTAO_PLANTIOS_TOTAL = FX_PIMENTAO_TOTAL_GERAL;
