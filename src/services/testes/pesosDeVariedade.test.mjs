import { especieDaEmbalagem, nomesSemEspecie, pesosPorMes, pesosDoMesDoLancamento, FONTES_DO_MES_DA_VENDA } from '../pesosDeVariedade.js';
import { registrar } from './caso.mjs';

const eq = (n, obtido, esperado) => { const a = JSON.stringify(obtido), b = JSON.stringify(esperado); registrar(n, a === b, a === b ? '' : `obtido ${a}\n        esperado ${b}`); };

eq('os 10 nomes da aba Dados Embalagem', ['Shiitake Bdj (200gr)', 'Shiitake Fat (200gr)', 'Shiitake Baby (1kg)', 'Shimeji Preto (200g)', 'Shimeji Preto (1kg)', 'Shimeji Branco (200g)', 'Shimeji Branco (1kg)', 'Pimentão Amarelo (CXS)', 'Pimentão Vermelho (CXS)', 'Pimentão Verde (CXS)'].map(especieDaEmbalagem),
  ['SH', 'SH', 'SH', 'SP', 'SP', 'SB', 'SB', null, null, null]);
eq('Salmão, se um dia ganhar coluna', especieDaEmbalagem('Shimeji Salmão (200g)'), 'SS');

const m = pesosPorMes({
  embalagem: [
    { data: '2026-05-07', quantidade: 2150, embalagem_produtos: { nome: 'Shiitake Bdj (200gr)' } },
    { data: '2026-05-08', quantidade: 75, embalagem_produtos: { nome: 'Shiitake Fat (200gr)' } },
    { data: '2026-05-09', quantidade: 280, embalagem_produtos: { nome: 'Shimeji Branco (200g)' } },
    { data: '2026-05-09', quantidade: 64, embalagem_produtos: { nome: 'Shimeji Preto (200g)' } },
    { data: '2026-05-10', quantidade: 20, embalagem_produtos: { nome: 'Pimentão Amarelo (CXS)' } },
    { data: '2026-06-01', quantidade: 12, embalagem_produtos: { nome: 'Shiitake Bdj (200gr)' } },
  ],
  lotes: [
    { data_inoculacao: '2026-05-03', tipo_cogumelo: 'SH', qtd_blocos: 800 },
    { data_inoculacao: '2026-05-20', tipo_cogumelo: 'SB', qtd_blocos: 180 },
    { data_inoculacao: '2026-05-21', tipo_cogumelo: 'SS', qtd_blocos: 24 },
    { data_inoculacao: '2026-04-30', tipo_cogumelo: 'SH', qtd_blocos: 450 },
  ],
  colheitas: [
    { data_colheita: '2026-05-15', peso_kg: '612.4', lotes_producao: { tipo_cogumelo: 'SH' } },
    { data_colheita: '2026-05-16', peso_kg: '31.8', lotes_producao: { tipo_cogumelo: 'SB' } },
    { data_colheita: '2026-05-17', peso_kg: '2.6', lotes_producao: { tipo_cogumelo: 'SP' } },
  ],
});
eq('maio: bandejas por especie (Shiitake Bdj + Fat somam; pimentao fora)', m.get('2026-05-01').BANDEJAS_PRODUZIDAS, { SH: 2225, SP: 64, SB: 280, SS: 0 });
eq('maio: blocos por especie no mes da inoculacao (30/04 fica em abril)', m.get('2026-05-01').BLOCOS_PRODUZIDOS, { SH: 800, SP: 0, SB: 180, SS: 24 });
eq('maio: kg por especie (numeric vem como texto)', m.get('2026-05-01').KG_PRODUZIDOS, { SH: 612.4, SP: 2.6, SB: 31.8, SS: 0 });
eq('abril: so os blocos; bandejas e kg zerados (o mes existe porque tem lote)', m.get('2026-04-01'), { BANDEJAS_PRODUZIDAS: { SH: 0, SP: 0, SB: 0, SS: 0 }, BLOCOS_PRODUZIDOS: { SH: 450, SP: 0, SB: 0, SS: 0 }, KG_PRODUZIDOS: { SH: 0, SP: 0, SB: 0, SS: 0 }, RECEITA_DA_ESPECIE: { SH: 0, SP: 0, SB: 0, SS: 0 }, BANDEJAS_VENDIDAS: { SH: 0, SP: 0, SB: 0, SS: 0 } });
eq('junho: so a embalagem', m.get('2026-06-01').BANDEJAS_PRODUZIDAS, { SH: 12, SP: 0, SB: 0, SS: 0 });
eq('mes sem nada nao existe no mapa (o motor le como sem peso)', m.get('2026-03-01'), undefined);
eq('lote sem tipo ou sem blocos nao quebra', pesosPorMes({ lotes: [{ data_inoculacao: '2026-01-05', tipo_cogumelo: null, qtd_blocos: 10 }, { data_inoculacao: '2026-01-06', tipo_cogumelo: 'SH', qtd_blocos: null }] }).get('2026-01-01').BLOCOS_PRODUZIDOS, { SH: 0, SP: 0, SB: 0, SS: 0 });
eq('nomesSemEspecie: nome renomeado fora do mapa entra, Pimentao fica fora, nome mapeado fica fora', nomesSemEspecie([
  { embalagem_produtos: { nome: 'Shitake Baby (1kg)' } },
  { embalagem_produtos: { nome: 'Pimentão Verde (CXS)' } },
  { embalagem_produtos: { nome: 'Shiitake Bdj (200gr)' } },
]), ['Shitake Baby (1kg)']);

const v = pesosPorMes({ vendas: [
  { empresa: 'AR', competencia: '2026-05-01', marca: '2 - EXEMPLO', especie: 'SH', valor: '900.00' },
  { empresa: 'AR', competencia: '2026-05-01', marca: '2 - EXEMPLO', especie: 'SB', valor: 100 },
  { empresa: 'AR', competencia: '2026-05-01', marca: '3 - REVENDA', especie: 'SP', valor: 5000 },
  { empresa: 'EXEMPLO', competencia: '2026-05-01', marca: '2 - EXEMPLO', especie: 'SH', valor: 7000 },
  { empresa: 'AR', competencia: '2026-05-01', marca: '2 - EXEMPLO', especie: null, valor: 3000 },
] });
eq('receita da especie: marca 2 das duas empresas, em centavos (numeric vem como texto)', v.get('2026-05-01').RECEITA_DA_ESPECIE, { SH: 790000, SP: 0, SB: 10000, SS: 0 });
eq('o mes so de venda existe no mapa com as outras fontes zeradas', v.get('2026-05-01').BANDEJAS_PRODUZIDAS, { SH: 0, SP: 0, SB: 0, SS: 0 });
eq('receita da especie: mes so com o relatorio da Exemplo Alimentos fica zerado (falta a AR)',
  pesosPorMes({ vendas: [{ empresa: 'EXEMPLO', competencia: '2026-06-01', marca: '2 - EXEMPLO', especie: 'SB', valor: 500 }] }).get('2026-06-01')?.RECEITA_DA_ESPECIE,
  { SH: 0, SP: 0, SB: 0, SS: 0 });
eq('receita da especie: mes so com o relatorio da AR fica zerado (falta a Exemplo Alimentos)',
  pesosPorMes({ vendas: [{ empresa: 'AR', competencia: '2026-06-01', marca: '2 - EXEMPLO', especie: 'SH', valor: 900 }] }).get('2026-06-01')?.RECEITA_DA_ESPECIE,
  { SH: 0, SP: 0, SB: 0, SS: 0 });

eq('marca discorda por prefixo e por nome: segue o nome, fica fora (nenhum mes no mapa)',
  pesosPorMes({ vendas: [{ empresa: 'AR', competencia: '2026-05-01', marca: '2 - REVENDA X', especie: 'SP', valor: 999 }] }).get('2026-05-01'),
  undefined);

const tenta = (fn) => { try { return fn(); } catch (e) { return `ERRO ${e.message}`; } };
const vv = (empresa, marca, especie, unidade, quantidade, valor = 1, competencia = '2026-05-01') => ({ empresa, competencia, codigo_produto: 'x', marca, especie, unidade, quantidade, valor });
const MAIO = [vv('AR', '2 - EXEMPLO', 'SH', 'UND', 200, '900.00'), vv('AR', '2 - EXEMPLO', 'SP', 'PACOTE', 50, 100),
  vv('EXEMPLO', '2 - EXEMPLO', 'SH', 'UNID', 70), vv('AR', '3 - REVENDA', 'SP', 'UND', 600), vv('AR', '2 - EXEMPLO', null, 'CX', 30)];
eq('bandejas vendidas: marca 2 com especie das duas empresas, em unidades (pacote = 1); revenda e pimentao fora',
  pesosPorMes({ vendas: MAIO }).get('2026-05-01').BANDEJAS_VENDIDAS, { SH: 270, SP: 50, SB: 0, SS: 0 });
eq('mes com unidade fora do vocabulario numa linha contada: bandejas vendidas zeradas',
  pesosPorMes({ vendas: [...MAIO, vv('AR', '3 - REVENDA', 'PB', 'KG', 7)] }).get('2026-05-01').BANDEJAS_VENDIDAS, { SH: 0, SP: 0, SB: 0, SS: 0 });
eq('mes sem o relatorio da Exemplo Alimentos: bandejas vendidas zeradas (as duas empresas contam na especie; ao lado, maio com as duas conta)',
  pesosPorMes({ vendas: [vv('AR', '2 - EXEMPLO', 'SB', 'UND', 40, 1, '2026-06-01')] }).get('2026-06-01').BANDEJAS_VENDIDAS, { SH: 0, SP: 0, SB: 0, SS: 0 });
eq('CONTROLE de simetria: mes sem o relatorio da AR (so a Exemplo Alimentos), bandejas vendidas zeradas tambem',
  pesosPorMes({ vendas: [vv('EXEMPLO', '2 - EXEMPLO', 'SB', 'UND', 40, 1, '2026-06-01')] }).get('2026-06-01')?.BANDEJAS_VENDIDAS, { SH: 0, SP: 0, SB: 0, SS: 0 });
{
  const pm = pesosPorMes({ vendas: MAIO, embalagem: [{ data: '2026-06-02', quantidade: 9, embalagem_produtos: { nome: 'Shiitake Bdj (200gr)' } }] });
  eq('competencia = regime devolve o mes inteiro, o mesmo objeto', tenta(() => pesosDoMesDoLancamento(pm, '2026-05-01', '2026-05-01') === pm.get('2026-05-01')), true);
  const caixa = tenta(() => pesosDoMesDoLancamento(pm, '2026-06-01', '2026-05-01'));
  eq('caixa: bandejas vendidas do mes da competencia (maio), bandejas produzidas do mes do regime (junho)',
    [caixa.BANDEJAS_VENDIDAS, caixa.BANDEJAS_PRODUZIDAS], [{ SH: 270, SP: 50, SB: 0, SS: 0 }, { SH: 9, SP: 0, SB: 0, SS: 0 }]);
  eq('caixa: competencia sem venda carregada nao herda a venda do mes do regime',
    tenta(() => pesosDoMesDoLancamento(pm, '2026-05-01', '2026-04-01').BANDEJAS_VENDIDAS), undefined);
}
{
  const pm = pesosPorMes({
    vendas: [...MAIO, vv('AR', '2 - EXEMPLO', 'SB', 'UND', 10, '500.00', '2026-06-01')],
    embalagem: [{ data: '2026-06-02', quantidade: 9, embalagem_produtos: { nome: 'Shiitake Bdj (200gr)' } }],
  });
  const caixa = tenta(() => pesosDoMesDoLancamento(pm, '2026-06-01', '2026-05-01'));
  eq('caixa: receita da especie do mes da competencia (maio), bandejas produzidas do mes do regime (junho)',
    [caixa.RECEITA_DA_ESPECIE, caixa.BANDEJAS_PRODUZIDAS], [{ SH: 90100, SP: 10000, SB: 0, SS: 0 }, { SH: 9, SP: 0, SB: 0, SS: 0 }]);
  eq('caixa: competencia sem venda carregada nao herda a receita do mes do regime',
    tenta(() => pesosDoMesDoLancamento(pm, '2026-06-01', '2026-04-01').RECEITA_DA_ESPECIE), undefined);
  eq('FONTES_DO_MES_DA_VENDA: as duas fontes de venda, bandejas vendidas e receita da especie',
    [...FONTES_DO_MES_DA_VENDA].sort(), ['BANDEJAS_VENDIDAS', 'RECEITA_DA_ESPECIE']);
}
