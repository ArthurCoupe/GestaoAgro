import assert from 'node:assert/strict';
import { unidadesVendidasPorMes, pesosDoNegocioPorMes, semMesesParciais } from '../unidadesVendidas.js';
import { caso } from './caso.mjs';

const V = (empresa, competencia, marca, especie, unidade, quantidade, codigo_produto = 'p') => ({ empresa, competencia, marca, especie, unidade, quantidade, codigo_produto });
const JAN = [
  V('AR', '2026-01-01', '2 - EXEMPLO', 'SH', 'UND', 200, '10'),
  V('AR', '2026-01-01', '2 - EXEMPLO', 'SP', 'PACOTE', '50.000', '11'),
  V('AR', '2026-01-01', '2 - EXEMPLO', null, 'CX', 30, '12'),
  V('AR', '2026-01-01', '3 - REVENDA', 'SP', 'UND', 600, '20'),
  V('EXEMPLO', '2026-01-01', '3 - REVENDA', null, 'UN', 100, '30'),
  V('EXEMPLO', '2026-01-01', '2 - EXEMPLO', 'SH', 'UNID', 50, '31'),
];
const FEV = [V('AR', '2026-02-01', '2 - EXEMPLO', 'SH', 'UND', '12.500', '10')];
const U = unidadesVendidasPorMes([...JAN, ...FEV]);

caso('janeiro: 300 da Producao (SH 200 + SP 50 pacote + SH 50 EX da Exemplo Alimentos), 700 da Revenda (600 + 100), pimentao fora', () => {
  assert.deepEqual(U.get('2026-01-01'), { producao: 300, revenda: 700, especieDaProducao: { SH: 250, SP: 50, SB: 0, SS: 0 }, empresas: ['AR', 'EXEMPLO'], faltaRelatorio: [], problemas: [] });
});
caso('fevereiro: quantidade em texto com 3 casas; falta a Exemplo Alimentos', () => {
  assert.deepEqual(U.get('2026-02-01'), { producao: 12.5, revenda: 0, especieDaProducao: { SH: 12.5, SP: 0, SB: 0, SS: 0 }, empresas: ['AR'], faltaRelatorio: ['EXEMPLO'], problemas: [] });
});
caso('pesosDoNegocioPorMes: so janeiro vira peso; fevereiro diz o motivo', () => {
  const p = pesosDoNegocioPorMes(U);
  assert.deepEqual([...p.pesos], [['2026-01-01', { UNIDADES_COGUMELO_VENDIDAS: { PRODUCAO: 300, REVENDA: 700 } }]]);
  assert.deepEqual([...p.semPeso], [['2026-02-01', 'falta o relatório de vendas por produto da Exemplo Alimentos']]);
});
caso('unidade fora do vocabulario numa linha que conta: o mes fica sem peso, com o produto nomeado', () => {
  const u = unidadesVendidasPorMes([...JAN, V('AR', '2026-01-01', '3 - REVENDA', null, 'KG', 7, '40')]);
  assert.deepEqual(u.get('2026-01-01').problemas, ['unidade "KG" no produto 40 da Aurora (marca 3 - REVENDA)']);
  assert.equal(pesosDoNegocioPorMes(u).pesos.has('2026-01-01'), false);
});
caso('unidade fora do vocabulario no pimentao (nao conta) nao e problema', () => {
  assert.deepEqual(unidadesVendidasPorMes([...JAN, V('AR', '2026-01-01', '2 - EXEMPLO', null, 'KG', 5, '13')]).get('2026-01-01').problemas, []);
});
caso('marca 2 da Aurora sem especie em UND: problema nomeado, o mes fica sem peso (nao some calado)', () => {
  const u = unidadesVendidasPorMes([...JAN, V('AR', '2026-01-01', '2 - EXEMPLO', null, 'UND', 900, '14')]);
  assert.deepEqual(u.get('2026-01-01').problemas, ['produto 14 da Aurora na marca 2 - EXEMPLO sem espécie, vendido em UND']);
  const p = pesosDoNegocioPorMes(u);
  assert.equal(p.pesos.has('2026-01-01'), false);
  assert.equal(p.semPeso.get('2026-01-01'), 'produto 14 da Aurora na marca 2 - EXEMPLO sem espécie, vendido em UND');
});
caso('marca 2 da Exemplo Alimentos sem especie em UND: problema nomeado, o mes fica sem peso (nao vira Revenda 0 calada)', () => {
  const u = unidadesVendidasPorMes([...JAN, V('EXEMPLO', '2026-01-01', '2 - EXEMPLO', null, 'UND', 500, '32')]);
  assert.deepEqual(u.get('2026-01-01').problemas, ['produto 32 da Exemplo Alimentos na marca 2 - EXEMPLO sem espécie, vendido em UND']);
  const p = pesosDoNegocioPorMes(u);
  assert.equal(p.pesos.has('2026-01-01'), false);
  assert.equal(p.semPeso.get('2026-01-01'), 'produto 32 da Exemplo Alimentos na marca 2 - EXEMPLO sem espécie, vendido em UND');
});
caso('marca sem operacao: problema nomeado', () => {
  assert.deepEqual(unidadesVendidasPorMes([...JAN, V('EXEMPLO', '2026-01-01', '1 - OUTRA', 'SH', 'UND', 1, '50')]).get('2026-01-01').problemas,
    ['marca "1 - OUTRA" sem operação no produto 50 da Exemplo Alimentos']);
});
caso('soma em milesimos inteiros: 0,1 + 0,2 = 0,3 exatos', () => {
  assert.equal(unidadesVendidasPorMes([V('AR', '2026-07-01', '2 - EXEMPLO', 'SH', 'UND', '0.1'), V('AR', '2026-07-01', '2 - EXEMPLO', 'SH', 'UND', '0.2')]).get('2026-07-01').producao, 0.3);
});
caso('as duas empresas carregadas e nenhuma unidade de cogumelo: sem peso, com o motivo', () => {
  const u = unidadesVendidasPorMes([V('AR', '2026-05-01', '2 - EXEMPLO', null, 'CX', 10), V('EXEMPLO', '2026-05-01', '2 - EXEMPLO', null, 'CX', 3)]);
  assert.deepEqual([...pesosDoNegocioPorMes(u).semPeso], [['2026-05-01', 'nenhuma unidade de cogumelo vendida no mês']]);
});
caso('quantidade negativa no total do mes: sem peso', () => {
  const u = unidadesVendidasPorMes([V('AR', '2026-06-01', '2 - EXEMPLO', 'SH', 'UND', -5), V('EXEMPLO', '2026-06-01', '3 - REVENDA', 'SP', 'UND', 10)]);
  assert.deepEqual(u.get('2026-06-01').problemas, ['quantidade negativa no mês (Produção -5, Revenda 10)']);
});
caso('caixa e espaco da unidade nao importam: " und " conta', () => {
  assert.equal(unidadesVendidasPorMes([V('AR', '2026-08-01', '2 - EXEMPLO', 'SB', ' und ', 3)]).get('2026-08-01').producao, 3);
});

caso('semMesesParciais: o mes de carga parcial sai das vendas, com quem e ate quando; o mes inteiro fica', () => {
  const cob = [
    { empresa: 'EXEMPLO', competencia: '2026-01-01', extraido_ate: '2026-01-23' },
    { empresa: 'AR', competencia: '2026-01-01', extraido_ate: '2026-01-22' },
    { empresa: 'AR', competencia: '2026-02-01', extraido_ate: '2026-02-28' },
  ];
  const r = semMesesParciais([...JAN, ...FEV], cob);
  assert.deepEqual([...r.parciais], [['2026-01-01', 'mês carregado só em parte (Aurora até 22/01, Exemplo Alimentos até 23/01)']]);
  assert.deepEqual(r.vendas, FEV);
  assert.equal(semMesesParciais([...JAN, ...FEV], []).vendas.length, JAN.length + FEV.length, 'controle: sem cobertura, nada sai');
  assert.equal(semMesesParciais(JAN, [{ empresa: 'AR', competencia: '2026-01-01', extraido_ate: '2026-01-31' }]).vendas.length, JAN.length, 'controle: ate o ultimo dia e mes inteiro');
});
