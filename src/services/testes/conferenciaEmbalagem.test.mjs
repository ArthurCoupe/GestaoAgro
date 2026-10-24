import assert from 'node:assert/strict';
import {
  apresentacaoDoProduto, blocoColheitaEmbalagem, camposDoDesprezo, comparacaoComAnterior, conferenciaDoPeriodo, ultimoDiaDeEmbalagem,
  conferenciaColheitaEmbalagem, periodoAnterior, resumoDaEmbalagem, totaisDaEmbalagem, variacaoPct,
  TOLERANCIA_PADRAO_KG, DIAS_PARA_FECHAR_PADRAO,
} from '../conferenciaEmbalagem.js';
import { caso } from './caso.mjs';

const produtos = [
  { id: 1, nome: 'Shiitake Bdj (200gr)', peso_gramas: 200 },
  { id: 2, nome: 'Shiitake Fat (200gr)', peso_gramas: 200 },
  { id: 3, nome: 'Shimeji Preto (200g)', peso_gramas: 200 },
  { id: 4, nome: 'Shimeji Preto (1kg)', peso_gramas: 1000 },
  { id: 5, nome: 'Shimeji Branco (200g)', peso_gramas: 200 },
  { id: 6, nome: 'Shimeji Branco (1kg)', peso_gramas: 1000 },
  { id: 7, nome: 'Shiitake Baby (1kg)', peso_gramas: 1000 },
  { id: 8, nome: 'Pimentão Amarelo (CXS)', peso_gramas: null },
  { id: 9, nome: 'Pimentão Vermelho (CXS)', peso_gramas: null },
  { id: 10, nome: 'Pimentão Verde (CXS)', peso_gramas: null },
];
const lotes = [
  { id: 100, tipo: 'SH', data_lote: '2026-06-01' },
  { id: 200, tipo: 'SB', data_lote: '2026-07-10' },
  { id: 300, tipo: 'SS', data_lote: '2026-07-20' },
];
const colheitas = [
  { id: 1, lote_id: 100, data_colheita: '2026-09-08', total_kg: 84 },
  { id: 2, lote_id: 200, data_colheita: '2026-09-07', total_kg: 64 },
  { id: 3, lote_id: 100, data_colheita: '2026-09-05', total_kg: 52 },
  { id: 4, lote_id: 100, data_colheita: '2026-09-09', total_kg: 36 },
  { id: 5, lote_id: 300, data_colheita: '2026-09-10', total_kg: 4 },
  { id: 6, lote_id: 100, data_colheita: '2026-08-20', total_kg: 45 },
];
const registros = [
  { data: '2026-09-08', embalagem_produto_id: 1, quantidade: 400 },
  { data: '2026-09-07', embalagem_produto_id: 5, quantidade: 300 },
  { data: '2026-09-05', embalagem_produto_id: 1, quantidade: 50 },
  { data: '2026-09-05', embalagem_produto_id: 7, quantidade: 38 },
  { data: '2026-09-09', embalagem_produto_id: 2, quantidade: 180 },
  { data: '2026-09-09', embalagem_produto_id: 9, quantidade: 15 },
  { data: '2026-08-20', embalagem_produto_id: 1, quantidade: 220 },
];
const desprezos = [
  { id: 1, data_lancamento: '2026-09-09', data_colheita: '2026-09-08', tipo_cogumelo: 'SH', kg: 1.5, lote_id: 100 },
  { id: 2, data_lancamento: '2026-09-08', data_colheita: '2026-09-07', tipo_cogumelo: 'SB', kg: 0.8, lote_id: null },
  { id: 3, data_lancamento: '2026-09-06', data_colheita: '2026-09-05', tipo_cogumelo: 'SH', kg: 1.0, lote_id: null },
];
const dados = { produtos, registros, desprezos, colheitas, lotes };
const set = { inicio: '2026-09-01', fim: '2026-09-30' };

caso('apresentacao: 200 g e bandeja, 1000 g e embalagem de 1 kg, pimentao sem peso e caixa, resto e null', () => {
  assert.equal(apresentacaoDoProduto(produtos[0]), 'BANDEJA_200G');
  assert.equal(apresentacaoDoProduto(produtos[6]), 'EMBALAGEM_1KG');
  assert.equal(apresentacaoDoProduto(produtos[9]), 'CAIXA_PIMENTAO');
  assert.equal(apresentacaoDoProduto({ nome: 'Shiitake Novo (500g)', peso_gramas: 500 }), null);
  assert.equal(apresentacaoDoProduto({ nome: 'Coisa (CXS)', peso_gramas: null }), null);
});

caso('totais do periodo: unidades separadas, kg pelo peso cadastrado, desprezo pela data da colheita', () => {
  const t = totaisDaEmbalagem(dados, set);
  assert.equal(t.total.bandejas_200g, 400 + 300 + 50 + 180);
  assert.equal(t.total.embalagens_1kg, 38);
  assert.equal(t.total.caixas_pimentao, 15);
  assert.equal(t.total.kg_embalados, 80 + 60 + 10 + 38 + 36);
  assert.equal(t.total.kg_desprezados, 3.3);
  assert.equal(t.total.kg_colhidos, 84 + 64 + 52 + 36 + 4);
  const sh = t.por_tipo.find((x) => x.tipo === 'SH');
  assert.deepEqual([sh.bandejas_200g, sh.embalagens_1kg, sh.kg_embalados, sh.kg_desprezados, sh.kg_colhidos], [630, 38, 164, 2.5, 172]);
  const ss = t.por_tipo.find((x) => x.tipo === 'SS');
  assert.deepEqual([ss.bandejas_200g, ss.kg_embalados, ss.kg_colhidos], [0, 0, 4]);
  const apres = Object.fromEntries(t.por_apresentacao.map((a) => [a.chave, a]));
  assert.deepEqual([apres.BANDEJA_200G.unidades, apres.BANDEJA_200G.kg], [930, 186]);
  assert.deepEqual([apres.EMBALAGEM_1KG.unidades, apres.EMBALAGEM_1KG.kg], [38, 38]);
  assert.deepEqual([apres.CAIXA_PIMENTAO.unidades, apres.CAIXA_PIMENTAO.kg], [15, null]);
});

caso('periodo anterior tem o MESMO numero de dias e termina na vespera', () => {
  assert.deepEqual(periodoAnterior({ inicio: '2026-09-01', fim: '2026-09-30' }), { inicio: '2026-08-02', fim: '2026-08-31' });
  assert.deepEqual(periodoAnterior({ inicio: '2026-09-08', fim: '2026-09-14' }), { inicio: '2026-09-01', fim: '2026-09-07' });
  assert.equal(periodoAnterior({ inicio: '', fim: '2026-09-30' }), null);
});

caso('variacao: sobre o anterior, 1 casa, e null quando o anterior e zero (nunca Infinity)', () => {
  assert.equal(variacaoPct(110, 100), 10);
  assert.equal(variacaoPct(97, 100), -3);
  assert.equal(variacaoPct(1, 3), -66.7);
  assert.equal(variacaoPct(5, 0), null);
});

caso('comparacao com o periodo anterior le os dois recortes', () => {
  const c = comparacaoComAnterior(dados, set);
  assert.deepEqual(c.periodo_anterior, { inicio: '2026-08-02', fim: '2026-08-31' });
  assert.equal(c.anterior.bandejas_200g, 220);
  assert.equal(c.bandejas_200g_pct, 322.7);
  assert.equal(c.kg_embalados_pct, 409.1);
  assert.equal(c.embalagens_1kg_pct, null);
  assert.equal(c.kg_desprezados_pct, null);
  assert.equal(comparacaoComAnterior(dados, { inicio: '', fim: '' }), null);
});

caso('conferencia: diferenca por data da colheita e tipo, com o sinal, ordem da mais recente', () => {
  const c = conferenciaColheitaEmbalagem(dados, { ...set, hoje: '2026-09-21' });
  assert.deepEqual(c.parametros, { tolerancia_kg: TOLERANCIA_PADRAO_KG, dias_para_fechar: DIAS_PARA_FECHAR_PADRAO });
  assert.deepEqual(c.linhas.map((l) => [l.data_colheita, l.tipo, l.kg_colhidos, l.kg_embalados, l.kg_desprezados, l.diferenca, l.situacao]), [
    ['2026-09-09', 'SH', 36, 36, 0, 0, 'FECHADA'],
    ['2026-09-08', 'SH', 84, 80, 1.5, 2.5, 'DIVERGENTE'],
    ['2026-09-07', 'SB', 64, 60, 0.8, 3.2, 'DIVERGENTE'],
    ['2026-09-05', 'SH', 52, 48, 1, 3, 'DIVERGENTE'],
  ]);
  assert.deepEqual(c.linhas[1].lotes, ['2026-06-01']);
  assert.equal(c.linhas[1].nome_tipo, 'Shiitake');
  assert.equal(c.colheitas, 4);
  assert.equal(c.fechadas, 1);
  assert.equal(c.divergentes, 3);
  assert.equal(c.em_aberto, 0);
  assert.equal(c.kg_diferenca_absoluta, 8.7);
});

caso('conferencia: registro de quantidade 0 sem colheita nao cria linha fantasma', () => {
  const dZero = { produtos, lotes: [], colheitas: [], registros: [{ data: '2026-09-09', embalagem_produto_id: 1, quantidade: 0 }], desprezos: [] };
  const c = conferenciaColheitaEmbalagem(dZero, { ...set, hoje: '2026-09-21' });
  assert.deepEqual(c.linhas, []);
  assert.equal(c.colheitas, 0);
});

caso('conferencia: colheita SS sem produto SS fica fora: sem coluna, sem caminho de fechar', () => {
  const dSS = { produtos, lotes: [{ id: 300, tipo: 'SS', data_lote: '2026-07-20' }], colheitas: [{ id: 5, lote_id: 300, data_colheita: '2026-09-10', total_kg: 4 }], registros: [], desprezos: [] };
  const c = conferenciaColheitaEmbalagem(dSS, { ...set, hoje: '2026-09-21' });
  assert.deepEqual(c.linhas, []);
  assert.equal(c.divergentes, 0);
  assert.equal(c.colheitas, 0);
});

caso('colheita mais nova que o prazo de embalar fica EM ABERTO, nao divergente', () => {
  const dRecente = {
    produtos, lotes,
    colheitas: [{ id: 90, lote_id: 100, data_colheita: '2026-09-20', total_kg: 10 }],
    registros: [], desprezos: [],
  };
  const c = conferenciaColheitaEmbalagem(dRecente, { ...set, hoje: '2026-09-21' });
  assert.equal(c.linhas.length, 1);
  assert.equal(c.linhas[0].situacao, 'EM_ABERTO');
  assert.equal(c.em_aberto, 1);
  assert.equal(c.divergentes, 0);
  assert.equal(c.kg_diferenca_absoluta, 0);
});

caso('tolerancia: diferenca dentro dela fecha; embalar mais do que colheu da diferenca negativa', () => {
  const d2 = { ...dados, colheitas: [{ id: 9, lote_id: 100, data_colheita: '2026-09-15', total_kg: 20.3 }],
    registros: [{ data: '2026-09-15', embalagem_produto_id: 1, quantidade: 100 }], desprezos: [] };
  const c = conferenciaColheitaEmbalagem(d2, { inicio: '2026-09-15', fim: '2026-09-15', hoje: '2026-09-21' });
  assert.deepEqual([c.linhas[0].diferenca, c.linhas[0].situacao], [0.3, 'FECHADA']);
  const c2 = conferenciaColheitaEmbalagem(d2, { inicio: '2026-09-15', fim: '2026-09-15', hoje: '2026-09-21', toleranciaKg: 0.1 });
  assert.equal(c2.linhas[0].situacao, 'DIVERGENTE');
  const d3 = { ...d2, colheitas: [] };
  const c3 = conferenciaColheitaEmbalagem(d3, { inicio: '2026-09-15', fim: '2026-09-15', hoje: '2026-09-21' });
  assert.deepEqual([c3.linhas[0].kg_colhidos, c3.linhas[0].diferenca, c3.linhas[0].situacao], [0, -20, 'DIVERGENTE']);
});

caso('bloco do Comando: janela do corte ate hoje, conta divergentes e soma modulos', () => {
  const b = blocoColheitaEmbalagem(dados, { corte: '2026-09-01', hoje: '2026-09-21' });
  assert.deepEqual(b.janela, { inicio: '2026-09-01', fim: '2026-09-21' });
  assert.deepEqual([b.kg_colhidos, b.kg_embalados, b.kg_desprezados, b.diferenca], [236, 224, 3.3, 8.7]);
  assert.deepEqual([b.colheitas, b.fechadas, b.em_aberto, b.divergentes, b.kg_diferenca_absoluta], [4, 1, 0, 3, 8.7]);
  assert.equal(b.dado_ate, '2026-09-10');
  assert.deepEqual([b.bandejas_200g, b.embalagens_1kg], [930, 38]);
  const vazio = blocoColheitaEmbalagem({ produtos, registros: [], desprezos: [], colheitas: [], lotes: [] }, { corte: '2026-09-01', hoje: '2026-09-21' });
  assert.deepEqual([vazio.colheitas, vazio.divergentes, vazio.dado_ate], [0, 0, null]);
  assert.deepEqual([vazio.bandejas_200g, vazio.embalagens_1kg], [null, null]);
});

caso('bloco: os tres kg sao a soma das LINHAS (inclusive EM_ABERTO); kg_diferenca_absoluta so as DIVERGENTES', () => {
  const dMix = {
    produtos, lotes,
    colheitas: [
      { id: 60, lote_id: 100, data_colheita: '2026-09-20', total_kg: 10 },
      { id: 61, lote_id: 100, data_colheita: '2026-09-01', total_kg: 5 },
    ],
    registros: [{ data: '2026-09-01', embalagem_produto_id: 1, quantidade: 45 }],
    desprezos: [],
  };
  const b = blocoColheitaEmbalagem(dMix, { corte: '2026-09-01', hoje: '2026-09-21' });
  assert.deepEqual([b.kg_colhidos, b.kg_embalados, b.kg_desprezados, b.diferenca], [15, 9, 0, 6]);
  assert.equal(b.kg_colhidos - b.kg_embalados - b.kg_desprezados, b.diferenca);
  assert.equal(b.em_aberto, 1);
  assert.equal(b.divergentes, 1);
  assert.equal(b.kg_diferenca_absoluta, 4);
});

caso('bloco no periodo: a janela pedida dentro do corte e de hoje; antes do corte, o corte', () => {
  const opc = { corte: '2026-09-01', hoje: '2026-09-21' };
  const semana = blocoColheitaEmbalagem(dados, { ...opc, inicio: '2026-09-07', fim: '2026-09-08' });
  assert.deepEqual(semana.janela, { inicio: '2026-09-07', fim: '2026-09-08' });
  assert.deepEqual([semana.kg_colhidos, semana.kg_embalados, semana.kg_desprezados, semana.colheitas], [148, 140, 2.3, 2]);
  assert.deepEqual([semana.bandejas_200g, semana.embalagens_1kg], [700, 0]);
  assert.equal(semana.dado_ate, '2026-09-08');
  const ano = blocoColheitaEmbalagem(dados, { ...opc, inicio: '2026-01-01', fim: '2026-12-31' });
  assert.deepEqual(ano.janela, { inicio: '2026-09-01', fim: '2026-09-21' });
  assert.equal(ano.kg_colhidos, 236);
  assert.equal(blocoColheitaEmbalagem(dados, { corte: '2026-08-01', hoje: '2026-09-21', inicio: '2026-01-01' }).kg_colhidos, 281);
  const antes = blocoColheitaEmbalagem(dados, { ...opc, inicio: '2026-08-01', fim: '2026-08-31' });
  assert.deepEqual(antes.janela, { inicio: '2026-09-01', fim: '2026-08-31' });
  assert.deepEqual([antes.colheitas, antes.kg_colhidos, antes.bandejas_200g, antes.dado_ate], [0, 0, null, null]);
});

caso('bloco no tipo: colheita pelo tipo do lote, embalagem pela especie, desprezo pelo tipo; os tipos somam o todo', () => {
  const opc = { corte: '2026-09-01', hoje: '2026-09-21' };
  const todos = blocoColheitaEmbalagem(dados, opc);
  const sh = blocoColheitaEmbalagem(dados, { ...opc, tipo: 'SH' });
  assert.equal(sh.tipo, 'SH');
  assert.deepEqual([sh.kg_colhidos, sh.kg_embalados, sh.kg_desprezados, sh.colheitas], [172, 164, 2.5, 3]);
  assert.deepEqual([sh.bandejas_200g, sh.embalagens_1kg], [630, 38]);
  const sb = blocoColheitaEmbalagem(dados, { ...opc, tipo: 'SB' });
  assert.deepEqual([sb.kg_colhidos, sb.kg_embalados, sb.kg_desprezados, sb.colheitas, sb.bandejas_200g], [64, 60, 0.8, 1, 300]);
  const resto = ['SP', 'SS'].map((t) => blocoColheitaEmbalagem(dados, { ...opc, tipo: t }));
  const soma = (f) => [sh, sb, ...resto].reduce((s, b) => s + b[f], 0);
  assert.deepEqual([soma('kg_colhidos'), soma('kg_embalados'), soma('colheitas'), soma('divergentes')],
    [todos.kg_colhidos, todos.kg_embalados, todos.colheitas, todos.divergentes]);
  assert.ok(sh.colheitas > 0 && sb.colheitas > 0);
  assert.equal(todos.tipo, null);
  assert.equal(todos.corte, '2026-09-01');
});

caso('conferenciaDoPeriodo: o periodo e o tipo dos cards; no modo Lote, do corte ate hoje no tipo do lote', () => {
  const opc = { corte: '2026-09-01', hoje: '2026-09-21' };
  const mes = conferenciaDoPeriodo(dados, { modo: 'mes', inicio: '2026-09-07', fim: '2026-09-08' }, { ...opc, tipo: 'SH' });
  assert.deepEqual([mes.modo, mes.tipo, mes.janela.inicio, mes.janela.fim, mes.kg_colhidos], ['periodo', 'SH', '2026-09-07', '2026-09-08', 84]);
  const lote = conferenciaDoPeriodo(dados, { modo: 'lote', lote: '2026-07-10|SB', data_lote: '2026-07-10', tipo: 'SB' }, { ...opc, tipo: 'SH' });
  assert.deepEqual([lote.modo, lote.tipo, lote.janela.inicio, lote.janela.fim, lote.kg_colhidos], ['lote', 'SB', '2026-09-01', '2026-09-21', 64]);
  assert.equal(conferenciaDoPeriodo(dados, { modo: 'ytd', inicio: '2026-01-01', fim: '2026-09-21' }, { ...opc, tipo: 'SH' }).kg_colhidos, 172);
  const { modo: _m, ...semModo } = mes;
  assert.deepEqual(semModo, blocoColheitaEmbalagem(dados, { ...opc, tipo: 'SH', inicio: '2026-09-07', fim: '2026-09-08' }));
});

caso('ultimoDiaDeEmbalagem: so bandeja de 200 g e embalagem de 1 kg com quantidade, ate hoje; caixa de pimentao fora', () => {
  assert.equal(ultimoDiaDeEmbalagem(dados, '2026-09-21'), '2026-09-09');
  const comPimentao = { produtos, registros: [...registros, { data: '2026-09-15', embalagem_produto_id: 9, quantidade: 30 }, { data: '2026-09-16', embalagem_produto_id: 1, quantidade: 0 }] };
  assert.equal(ultimoDiaDeEmbalagem(comPimentao, '2026-09-21'), '2026-09-09');
  assert.equal(ultimoDiaDeEmbalagem({ produtos, registros: [...registros, { data: '2026-09-15', embalagem_produto_id: 7, quantidade: 2 }] }, '2026-09-21'), '2026-09-15');
  assert.equal(ultimoDiaDeEmbalagem({ produtos, registros: [...registros, { data: '2026-09-25', embalagem_produto_id: 1, quantidade: 5 }] }, '2026-09-21'), '2026-09-09');
  assert.equal(ultimoDiaDeEmbalagem({ produtos, registros: [] }, '2026-09-21'), null);
});

caso('resumo: um payload so, com periodo, totais, comparacao, conferencia e parametros', () => {
  const r = resumoDaEmbalagem(dados, { ...set, hoje: '2026-09-21', origens: { tolerancia_kg: 'PADRAO', dias_para_fechar: 'BANCO' } });
  assert.deepEqual(r.periodo, set);
  assert.equal(r.totais.kg_embalados, 224);
  assert.equal(r.por_tipo.length, 4);
  assert.equal(r.por_apresentacao.length, 3);
  assert.equal(r.comparacao.bandejas_200g_pct, 322.7);
  assert.equal(r.conferencia.divergentes, 3);
  assert.deepEqual(r.parametros, { tolerancia_kg: 0.5, dias_para_fechar: 2, origens: { tolerancia_kg: 'PADRAO', dias_para_fechar: 'BANCO' } });
  const semPeriodo = resumoDaEmbalagem(dados, { hoje: '2026-09-21' });
  assert.equal(semPeriodo.comparacao, null);
});

caso('desprezo: valida as quatro obrigatorias, kg > 0, dia >= colheita, tipo do dominio; lote e opcional', () => {
  const ok = camposDoDesprezo({ data_lancamento: '2026-09-09', data_colheita: '2026-09-08', tipo_cogumelo: 'sh', kg: '1,5', lote_id: '100', observacao: '  baldes  molhados ' }, { hoje: '2026-09-21' });
  assert.deepEqual(ok, { data_lancamento: '2026-09-09', data_colheita: '2026-09-08', tipo_cogumelo: 'SH', kg: 1.5, lote_id: 100, observacao: 'baldes molhados' });
  const semDia = camposDoDesprezo({ data_colheita: '2026-09-08', tipo_cogumelo: 'SH', kg: 1 }, { hoje: '2026-09-21' });
  assert.equal(semDia.data_lancamento, '2026-09-21');
  assert.equal(semDia.lote_id, null);
  assert.throws(() => camposDoDesprezo({ data_lancamento: '2026-09-07', data_colheita: '2026-09-08', tipo_cogumelo: 'SH', kg: 1 }), /antes da data da colheita/);
  assert.throws(() => camposDoDesprezo({ data_colheita: '2026-09-08', tipo_cogumelo: 'SH', kg: 0 }), /maior que zero/);
  assert.throws(() => camposDoDesprezo({ data_colheita: '2026-09-08', tipo_cogumelo: 'XX', kg: 1 }), /SH, SP, SB ou SS/);
  assert.throws(() => camposDoDesprezo({ data_colheita: '', tipo_cogumelo: 'SH', kg: 1 }), /data_colheita/);
  const e = (() => { try { camposDoDesprezo({ data_colheita: '2026-09-08', tipo_cogumelo: 'SH', kg: -1 }); } catch (x) { return x; } })();
  assert.equal(e.status, 400);
  const eCal = (() => { try { camposDoDesprezo({ data_colheita: '2026-02-30', tipo_cogumelo: 'SH', kg: 1 }, { hoje: '2026-09-21' }); } catch (x) { return x; } })();
  assert.equal(eCal.status, 400);
  assert.match(eCal.message, /inválida/);
  for (const gigante of [1e21, 2 ** 53, '99999999999999999999']) {
    const eG = (() => { try { camposDoDesprezo({ data_colheita: '2026-09-08', tipo_cogumelo: 'SH', kg: 1, lote_id: gigante }, { hoje: '2026-09-21' }); } catch (x) { return x; } })();
    assert.deepEqual([eG?.status, eG?.message], [400, 'lote_id inválido.'], `lote_id ${gigante}`);
  }
  assert.equal(camposDoDesprezo({ data_colheita: '2026-09-08', tipo_cogumelo: 'SH', kg: 1, lote_id: 2 ** 53 - 1 }, { hoje: '2026-09-21' }).lote_id, 2 ** 53 - 1);
});

caso('o total do tipo diz de que colunas sai, e as partes somam o total', () => {
  const produtos = [
    { id: 1, nome: 'Shiitake Bdj (200gr)', ordem: 1, peso_gramas: 200 },
    { id: 2, nome: 'Shiitake Fat (200gr)', ordem: 2, peso_gramas: 200 },
    { id: 3, nome: 'Shiitake Baby (1kg)', ordem: 3, peso_gramas: 1000 },
  ];
  const registros = [
    { data: '2026-09-01', embalagem_produto_id: 1, quantidade: 2500 },
    { data: '2026-09-10', embalagem_produto_id: 1, quantidade: 640 },
    { data: '2026-09-10', embalagem_produto_id: 2, quantidade: 210 },
    { data: '2026-09-30', embalagem_produto_id: 2, quantidade: 888 },
  ];
  const t = totaisDaEmbalagem({ produtos, registros }, { inicio: '2026-09-01', fim: '2026-09-24' });
  const sh = t.por_tipo.find((x) => x.tipo === 'SH');
  assert.equal(sh.bandejas_200g, 3350);
  assert.deepEqual(sh.colunas, [
    { produto: 'Shiitake Bdj (200gr)', apresentacao: 'BANDEJA_200G', unidades: 3140 },
    { produto: 'Shiitake Fat (200gr)', apresentacao: 'BANDEJA_200G', unidades: 210 },
  ]);
  assert.equal(sh.colunas.reduce((a, c) => a + c.unidades, 0), sh.bandejas_200g);
});
