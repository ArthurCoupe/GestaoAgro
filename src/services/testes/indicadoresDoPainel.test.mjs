import assert from 'node:assert/strict';
import { indicadoresDoPainel, intervalosDoGrafico, janelaDoPeriodo, janelasAnteriores } from '../indicadoresDoPainel.js';
import { caso } from './caso.mjs';


caso('mes corrente: do dia 1 ate hoje; os tres anteriores com os MESMOS dias (1 a 16)', () => {
  const j = janelaDoPeriodo({ periodo: 'mes', hoje: '2026-10-16' });
  assert.deepEqual(j, { modo: 'mes', inicio: '2026-10-01', fim: '2026-10-16' });
  assert.deepEqual(janelasAnteriores(j), [
    { inicio: '2026-09-01', fim: '2026-09-16' }, { inicio: '2026-08-01', fim: '2026-08-16' }, { inicio: '2026-07-01', fim: '2026-07-16' },
  ]);
});
caso('mes fechado: o mes inteiro, e os anteriores inteiros (30 contra 31 dias)', () => {
  const j = janelaDoPeriodo({ periodo: 'mes', mes: '2026-09', hoje: '2026-10-16' });
  assert.deepEqual(j, { modo: 'mes', inicio: '2026-09-01', fim: '2026-09-30' });
  assert.deepEqual(janelasAnteriores(j)[0], { inicio: '2026-08-01', fim: '2026-08-31' });
  assert.deepEqual(janelasAnteriores(j)[2], { inicio: '2026-06-01', fim: '2026-06-30' });
});
caso('dia 31 em andamento: o mes anterior de 30 dias para no dia 30', () => {
  const j = janelaDoPeriodo({ periodo: 'mes', hoje: '2026-10-31' });
  assert.deepEqual(janelasAnteriores(j)[0], { inicio: '2026-09-01', fim: '2026-09-30' });
  const marco = janelaDoPeriodo({ periodo: 'mes', hoje: '2026-03-30' });
  assert.deepEqual(janelasAnteriores(marco)[0], { inicio: '2026-02-01', fim: '2026-02-28' });
});
caso('janelas moveis: hoje, 7 e 30 dias comparam com a janela do mesmo tamanho logo antes', () => {
  assert.deepEqual(janelaDoPeriodo({ periodo: '7', hoje: '2026-10-16' }), { modo: '7', inicio: '2026-10-10', fim: '2026-10-16' });
  assert.deepEqual(janelasAnteriores(janelaDoPeriodo({ periodo: '7', hoje: '2026-10-16' }))[0], { inicio: '2026-10-03', fim: '2026-10-09' });
  assert.deepEqual(janelasAnteriores(janelaDoPeriodo({ periodo: 'hoje', hoje: '2026-10-16' }))[2], { inicio: '2026-10-13', fim: '2026-10-13' });
  assert.deepEqual(janelaDoPeriodo({ periodo: '30', hoje: '2026-10-16' }), { modo: '30', inicio: '2026-09-17', fim: '2026-10-16' });
});
caso('acumulado do ano e ano: o mesmo intervalo nos anos anteriores; ano passado inteiro', () => {
  const ytd = janelaDoPeriodo({ periodo: 'ytd', hoje: '2026-10-16' });
  assert.deepEqual(ytd, { modo: 'ytd', inicio: '2026-01-01', fim: '2026-10-16' });
  assert.deepEqual(janelasAnteriores(ytd)[0], { inicio: '2025-01-01', fim: '2025-10-16' });
  assert.deepEqual(janelaDoPeriodo({ periodo: 'ano', ano: '2025', hoje: '2026-10-16' }), { modo: 'ano', inicio: '2025-01-01', fim: '2025-12-31' });
  assert.deepEqual(janelaDoPeriodo({ periodo: 'ano', hoje: '2026-10-16' }), { modo: 'ano', inicio: '2026-01-01', fim: '2026-10-16' });
});
caso('entrada invalida vira erro, nunca janela inventada', () => {
  for (const q of [{ periodo: 'semana' }, { periodo: 'mes', mes: '2026-13' }, { periodo: 'mes', mes: '2026-11' },
    { periodo: 'ano', ano: '2027' }, { periodo: 'ano', ano: '20x6' }, { periodo: 'lote', lote: '2026-06-24' },
    { periodo: 'lote', lote: '2026-02-30|SH' }, { periodo: 'mes', mes: ['2026-09', '2026-08'] },
    { periodo: 'lote', lote: '2026-13-01|SH' }, { periodo: 'lote', lote: '2026-00-10|SH' }, { periodo: 'lote', lote: '2026-01-32|SH' }]) {
    assert.ok(janelaDoPeriodo({ ...q, hoje: '2026-10-16' }).erro, JSON.stringify(q));
  }
  assert.equal(janelaDoPeriodo({ periodo: 'lote', lote: '2026-01-31|SS', hoje: '2026-10-16' }).lote, '2026-01-31|SS', 'CONTROLE: dia 31 e o Shimeji Salmao passam');
  assert.deepEqual(janelaDoPeriodo({ hoje: '2026-10-16' }), { modo: 'hoje', inicio: '2026-10-16', fim: '2026-10-16' });
});

const lotes = [
  { id: 1, data_lote: '2026-10-02', tipo: 'SH', blocos_produzidos: 100 },
  { id: 2, data_lote: '2026-10-02', tipo: 'SH', blocos_produzidos: 50 },
  { id: 3, data_lote: '2026-10-09', tipo: 'SH', blocos_produzidos: 200 },
  { id: 4, data_lote: '2026-10-09', tipo: 'SB', blocos_produzidos: 80 },
  { id: 5, data_lote: '2026-09-05', tipo: 'SH', blocos_produzidos: 120 },
  { id: 6, data_lote: '2026-09-20', tipo: 'SH', blocos_produzidos: 999 },
  { id: 7, data_lote: '2026-08-10', tipo: 'SH', blocos_produzidos: 90 },
  { id: 8, data_lote: '2026-07-03', tipo: 'SH', blocos_produzidos: 60 },
  { id: 9, data_lote: '2026-06-06', tipo: 'SH', blocos_produzidos: 10 },
];
const colheitas = [
  { lote_id: 8, data_colheita: '2026-10-05', total_kg: 30 },
  { lote_id: 7, data_colheita: '2026-10-12', total_kg: 12.5 },
  { lote_id: 7, data_colheita: '2026-10-13', total_kg: 7.5 },
  { lote_id: 9, data_colheita: '2026-09-10', total_kg: 40 },
  { lote_id: 9, data_colheita: '2026-06-20', total_kg: 5 },
];
const eventos = [
  { lote_id: 7, tipo: 'CONTAMINACAO', quantidade: 9, data_evento: '2026-10-03' },
  { lote_id: 8, tipo: 'CONTAMINACAO', quantidade: 6, data_evento: '2026-10-04' },
  { lote_id: 8, tipo: 'PERDA', quantidade: 50, data_evento: '2026-10-04' },
  { lote_id: 9, tipo: 'CONTAMINACAO', quantidade: 12, data_evento: '2026-09-08' },
  { lote_id: 9, tipo: 'CONTAMINACAO', quantidade: 1, data_evento: '2026-06-25' },
  { lote_id: 3, tipo: 'CONTAMINACAO', quantidade: 20, data_evento: '2026-10-14' },
  { lote_id: 5, tipo: 'CONTAMINACAO', quantidade: 10, data_evento: '2026-09-25' },
];
const embalagem = {
  produtos: [
    { id: 1, nome: 'Shiitake Bdj (200gr)', peso_gramas: 200 },
    { id: 2, nome: 'Shiitake 1kg', peso_gramas: 1000 },
    { id: 3, nome: 'Shimeji Branco Bdj (200gr)', peso_gramas: 200 },
    { id: 4, nome: 'Pimentão Vermelho', peso_gramas: null },
  ],
  registros: [
    { data: '2026-10-05', embalagem_produto_id: 1, quantidade: 120 },
    { data: '2026-10-12', embalagem_produto_id: 2, quantidade: 4 },
    { data: '2026-10-13', embalagem_produto_id: 3, quantidade: 10 },
    { data: '2026-10-13', embalagem_produto_id: 4, quantidade: 7 },
    { data: '2026-09-10', embalagem_produto_id: 1, quantidade: 180 },
    { data: '2026-06-20', embalagem_produto_id: 1, quantidade: 5 },
  ],
};
const dados = { lotes, colheitas, eventos };
const out = indicadoresDoPainel(dados, embalagem, { periodo: 'mes', hoje: '2026-10-16' });
const m = out.metricas;

caso('a resposta diz o periodo e os tres anteriores', () => {
  assert.deepEqual(out.periodo, { modo: 'mes', inicio: '2026-10-01', fim: '2026-10-16' });
  assert.equal(out.anteriores.length, 3);
});
caso('producao: blocos, lotes (data + tipo), dias produzidos e as duas medias', () => {
  assert.equal(m.blocos_produzidos.atual, 430);
  assert.equal(m.lotes_produzidos.atual, 3, '02/10 SH, 09/10 SH e 09/10 SB: duas linhas do mesmo dia e tipo sao um lote');
  assert.equal(m.dias_produzidos.atual, 2);
  assert.equal(m.blocos_por_lote.atual, 430 / 3);
  assert.equal(m.blocos_por_dia.atual, 215);
});
caso('o anterior equivalente e o mesmo intervalo de setembro: o lote do dia 20 fica fora', () => {
  assert.equal(m.blocos_produzidos.anterior, 120);
  assert.equal(m.blocos_produzidos.media3, (120 + 90 + 60) / 3);
  assert.equal(m.blocos_produzidos.var_anterior, Math.round(((430 - 120) / 120) * 1000) / 10);
});
caso('media de razao e a razao das somas dos tres periodos, nao a media das razoes', () => {
  assert.equal(m.blocos_por_lote.media3, 270 / 3);
  assert.equal(m.kg_por_lote.anterior, 40);
});
caso('colheita: kg pela data da colheita, lotes colhidos pelo lote de cada colheita', () => {
  assert.equal(m.kg_colhidos.atual, 50);
  assert.equal(m.lotes_colhidos.atual, 2);
  assert.equal(m.kg_por_lote.atual, 25);
});
caso('bandejas: as da embalagem no periodo (200 g mais 1 kg, como a tela Embalagem); pimentao fora', () => {
  assert.equal(m.bandejas.atual, 134);
  assert.equal(m.bandejas_por_lote.atual, 67);
  assert.equal(m.bandejas.anterior, 180);
});
caso('contaminacao retirada no periodo: blocos pela data da retirada (perda fora) e lotes afetados', () => {
  assert.equal(m.blocos_contaminados.atual, 35, '9 + 6 + 20, de tres lotes; a perda de 50 fica fora');
  assert.equal(m.lotes_afetados.atual, 3);
  assert.equal(m.blocos_contaminados.anterior, 12, 'a retirada de 25/09 fica fora de 1 a 16 de setembro');
  assert.equal(m.blocos_contaminados.media3, 4, 'setembro 12, agosto 0, julho 0: com historico, a janela sem retirada conta 0');
});
caso('taxa: a coorte, como a Visao Executiva (contaminados dos lotes produzidos no periodo, ate hoje, sobre os produzidos deles)', () => {
  assert.equal(m.contaminados_da_coorte.atual, 20, 'so o lote de 09/10 contaminou; as retiradas de 03 e 04/10 sao de lotes de agosto e julho');
  assert.equal(m.taxa_contaminacao.atual, 20 / 430);
  assert.equal(m.contaminados_da_coorte.anterior, 10, 'o lote de 05/09 com a retirada de 25/09, fora da janela');
  assert.equal(m.taxa_contaminacao.anterior, 10 / 120);
  assert.equal(m.taxa_contaminacao.media3, (10 + 9 + 6) / (120 + 90 + 60), 'razao das somas');
  assert.notEqual(m.blocos_contaminados.atual, m.contaminados_da_coorte.atual);
});
caso('a natureza de cada indicador: mais producao e colheita e melhor, mais contaminacao e pior', () => {
  assert.equal(m.blocos_produzidos.melhor, 'MAIOR');
  assert.equal(m.kg_por_lote.melhor, 'MAIOR');
  assert.equal(m.taxa_contaminacao.melhor, 'MENOR');
  assert.equal(m.blocos_contaminados.melhor, 'MENOR');
  assert.equal(m.lotes_produzidos.melhor, null);
});
caso('o filtro de tipo vale para todos os numeros, inclusive as bandejas', () => {
  const sb = indicadoresDoPainel(dados, embalagem, { periodo: 'mes', hoje: '2026-10-16', tipo: 'SB' }).metricas;
  assert.equal(sb.blocos_produzidos.atual, 80);
  assert.equal(sb.bandejas.atual, 10);
  assert.equal(sb.kg_colhidos.atual, 0);
  assert.equal(sb.lotes_colhidos.atual, 0);
  assert.equal(sb.kg_por_lote.atual, null, 'sem lote colhido nao ha media: travessao, nunca 0');
});
caso('a janela que comeca antes do primeiro lancamento daquele dado nao tem comparacao', () => {
  const semJunho = { ...dados, colheitas: colheitas.filter((c) => c.data_colheita !== '2026-06-20') };
  const r = indicadoresDoPainel(semJunho, embalagem, { periodo: 'mes', hoje: '2026-10-16' }).metricas;
  assert.equal(r.kg_colhidos.anterior, null);
  assert.equal(m.kg_colhidos.anterior, 40, 'CONTROLE: com junho, setembro compara');
  assert.equal(r.blocos_produzidos.anterior, 120, 'a producao tem o proprio comeco, e nao perde a comparacao');
});
caso('janela antes do comeco do historico nao vira zero: anterior e media sao null', () => {
  const r = indicadoresDoPainel(dados, embalagem, { periodo: 'ytd', hoje: '2026-10-16' }).metricas;
  assert.equal(r.blocos_produzidos.anterior, null, 'o historico comeca em 06/06/2026; 2025 nao existe');
  assert.equal(r.blocos_produzidos.media3, null);
  assert.equal(r.blocos_produzidos.var_anterior, null);
});
caso('cada fonte tem o proprio comeco: a janela que contem o primeiro lancamento e comeca antes dele nao compara', () => {
  const r = indicadoresDoPainel(dados, embalagem, { periodo: 'mes', mes: '2026-07', hoje: '2026-10-16' }).metricas;
  assert.equal(r.kg_colhidos.anterior, null);
  assert.equal(r.blocos_contaminados.anterior, null);
  assert.equal(r.lotes_afetados.anterior, null);
  assert.equal(r.bandejas.anterior, null);
  assert.equal(r.blocos_produzidos.anterior, null, 'a producao comeca em 06/06: junho tambem comeca antes');
  assert.equal(r.blocos_produzidos.atual, 60);
  assert.equal(r.kg_colhidos.atual, 0);
});
caso('o periodo pedido que termina antes do primeiro lancamento nao tem numero (ano de 2025, janeiro de 2026)', () => {
  for (const pedido of [{ periodo: 'ano', ano: '2025' }, { periodo: 'mes', mes: '2026-01' }]) {
    const r = indicadoresDoPainel(dados, embalagem, { ...pedido, hoje: '2026-10-16' }).metricas;
    for (const k of ['blocos_produzidos', 'kg_colhidos', 'blocos_contaminados', 'bandejas', 'taxa_contaminacao']) {
      assert.equal(r[k].atual, null, `${JSON.stringify(pedido)} ${k}`);
    }
  }
  const out = indicadoresDoPainel(dados, embalagem, { periodo: 'mes', mes: '2026-06', hoje: '2026-10-16' }).metricas;
  assert.equal(out.kg_colhidos.atual, 5, 'CONTROLE: junho termina depois do primeiro lancamento e mostra o que existe');
  assert.equal(out.blocos_produzidos.atual, 10);
});
caso('o periodo atual que comeca antes do primeiro lancamento mostra o que existe (o acumulado do ano sem colheita)', () => {
  const r = indicadoresDoPainel(dados, embalagem, { periodo: 'ytd', hoje: '2026-10-16' });
  assert.equal(r.metricas.kg_colhidos.atual, 95, '30 + 12,5 + 7,5 + 40 + 5, todas de 2026');
  assert.equal(r.metricas.bandejas.atual, 134 + 180 + 5);
  assert.equal(r.metricas.blocos_contaminados.atual, 9 + 6 + 12 + 1 + 20 + 10);
  assert.equal(r.historico_desde.colheita, '2026-06-20');
  assert.equal(r.metricas.kg_colhidos.anterior, null, 'a comparacao continua sem numero');
});
caso('sem embalagem lancada no periodo, bandejas e null (nunca 0)', () => {
  const r = indicadoresDoPainel(dados, { produtos: embalagem.produtos, registros: [] }, { periodo: 'mes', hoje: '2026-10-16' }).metricas;
  assert.equal(r.bandejas.atual, null);
  assert.equal(r.bandejas_por_lote.atual, null);
  const semCarga = indicadoresDoPainel(dados, null, { periodo: 'mes', hoje: '2026-10-16' }).metricas;
  assert.equal(semCarga.bandejas.atual, null);
  const sp = indicadoresDoPainel(dados, embalagem, { periodo: 'mes', hoje: '2026-10-16', tipo: 'SP' }).metricas;
  assert.equal(sp.bandejas.atual, null);
  assert.equal(m.bandejas.atual, 134, 'CONTROLE: o mesmo periodo sem filtro tem bandeja');
});
caso('lote especifico: os numeros do lote, e o anterior e a media sao os lotes anteriores do mesmo tipo', () => {
  const r = indicadoresDoPainel(dados, embalagem, { periodo: 'lote', lote: '2026-08-10|SH', hoje: '2026-10-16' });
  assert.deepEqual(r.periodo, { modo: 'lote', lote: '2026-08-10|SH', data_lote: '2026-08-10', tipo: 'SH' });
  assert.equal(r.metricas.blocos_produzidos.atual, 90);
  assert.equal(r.metricas.kg_colhidos.atual, 20);
  assert.equal(r.metricas.blocos_contaminados.atual, 9);
  assert.equal(r.metricas.taxa_contaminacao.atual, 9 / 90);
  assert.equal(r.metricas.blocos_produzidos.anterior, 60, 'o lote SH anterior e o de 03/07');
  assert.equal(r.metricas.blocos_produzidos.media3, null, 'so ha dois lotes SH antes: sem os tres, sem media');
  assert.equal(r.metricas.bandejas.atual, null, 'a embalagem nao se liga ao lote');
  assert.deepEqual(r.anteriores.map((a) => a.lote), ['2026-07-03|SH', '2026-06-06|SH']);
});
caso('lote que nao existe e erro, nao zero', () => {
  assert.ok(indicadoresDoPainel(dados, embalagem, { periodo: 'lote', lote: '2026-01-01|SH', hoje: '2026-10-16' }).erro);
});
caso('lote sem colheita lancada nao colheu 0 kg; a media dos tres lotes com um sem colheita nao existe', () => {
  const r = indicadoresDoPainel(dados, embalagem, { periodo: 'lote', lote: '2026-10-09|SH', hoje: '2026-10-16' }).metricas;
  assert.equal(r.kg_colhidos.atual, null);
  assert.equal(r.kg_colhidos.anterior, null);
  assert.equal(r.kg_colhidos.media3, null);
  assert.equal(r.blocos_contaminados.atual, 20, 'CONTROLE: a retirada do mesmo lote existe');
  assert.equal(r.blocos_contaminados.anterior, 0, 'lote produzido com historico de retirada e sem retirada: 0, como a janela');
  assert.equal(r.taxa_contaminacao.atual, 20 / 200);
});
caso('lote aberto antes da primeira colheita lancada, ou produzido antes da primeira retirada, pode ter lancamento fora do sistema: null', () => {
  const abertoAntes = { ...dados, lotes: lotes.map((l) => (l.id === 9 ? { ...l, data_abertura: '2026-06-01' } : l)) };
  const r = indicadoresDoPainel(abertoAntes, embalagem, { periodo: 'lote', lote: '2026-06-06|SH', hoje: '2026-10-16' }).metricas;
  assert.equal(r.kg_colhidos.atual, null);
  assert.equal(r.blocos_contaminados.atual, null);
  assert.equal(r.taxa_contaminacao.atual, null);
  const semAbertura = indicadoresDoPainel(dados, embalagem, { periodo: 'lote', lote: '2026-06-06|SH', hoje: '2026-10-16' }).metricas;
  assert.equal(semAbertura.kg_colhidos.atual, 45, 'CONTROLE: o mesmo lote sem abertura antes da primeira colheita mostra os 40 + 5 kg');
});

const lotesR = [
  { id: 101, data_lote: '2026-06-01', tipo: 'SH', blocos_produzidos: 300, data_abertura: '2026-09-05', blocos_abertos: 200 },
  { id: 102, data_lote: '2026-06-01', tipo: 'SH', blocos_produzidos: 100, data_abertura: '2026-09-06', blocos_abertos: 100 },
  { id: 103, data_lote: '2026-06-10', tipo: 'SH', blocos_produzidos: 200, data_abertura: '2026-09-10', blocos_abertos: 150 },
  { id: 104, data_lote: '2026-07-01', tipo: 'SB', blocos_produzidos: 200, data_abertura: '2026-09-12', blocos_abertos: 180 },
  { id: 105, data_lote: '2026-06-20', tipo: 'SH', blocos_produzidos: 200, data_abertura: '2026-08-20', blocos_abertos: 200 },
  { id: 106, data_lote: '2026-06-25', tipo: 'SH', blocos_produzidos: 100, data_abertura: '2026-09-15', blocos_abertos: null },
  { id: 107, data_lote: '2026-06-28', tipo: 'SH', blocos_produzidos: 100, data_abertura: '2026-09-20', blocos_abertos: 90 },
];
const colheitasR = [
  { lote_id: 101, data_colheita: '2026-09-15', total_kg: 30, kg_p: 6, kg_m: 12, kg_g: 9, kg_gg: 3, estante: 'F1/3' },
  { lote_id: 102, data_colheita: '2026-10-02', total_kg: 15, kg_p: 5, kg_m: 5, kg_g: 5, kg_gg: 0, estante: 'F2/1' },
  { lote_id: 103, data_colheita: '2026-09-20', total_kg: 30, kg_p: 15, kg_m: 9, kg_g: 6, kg_gg: 0, estante: 'F1/7' },
  { lote_id: 104, data_colheita: '2026-09-25', total_kg: 27, kg_p: 27, kg_m: null, kg_g: null, kg_gg: null, estante: 'F3/2' },
  { lote_id: 105, data_colheita: '2026-09-02', total_kg: 40, kg_p: 10, kg_m: 20, kg_g: 10, kg_gg: 0, estante: null },
];
const dadosR = { lotes: lotesR, colheitas: colheitasR, eventos: [] };
const rk = indicadoresDoPainel(dadosR, null, { periodo: 'mes', mes: '2026-09', hoje: '2026-10-16' }).rankings;

caso('produtividade: lotes com estante aberta no periodo, kg ate hoje sobre os blocos abertos, do maior para o menor', () => {
  assert.deepEqual(rk.produtividade.map((l) => [l.chave, l.blocos_abertos, l.kg_colhidos, l.kg_por_bloco_aberto]), [
    ['2026-06-10|SH', 150, 30, 0.2],
    ['2026-06-01|SH', 300, 45, 0.15],
    ['2026-07-01|SB', 180, 27, 0.15],
  ]);
  assert.ok(!rk.produtividade.some((l) => l.chave === '2026-06-20|SH'));
});
caso('produtividade: quem fica fora e contado, nunca vira zero', () => {
  assert.deepEqual(rk.fora, { sem_colheita: 1, dado_faltante: 1, sem_abertos: 0, sem_tamanho: 0 });
});
caso('lote colhido com 0 blocos abertos e Shiitake colhido sem tamanho saem contados; ranking e fora somam os lotes abertos', () => {
  const mais = {
    lotes: [...lotesR,
      { id: 108, data_lote: '2026-06-29', tipo: 'SH', blocos_produzidos: 50, data_abertura: '2026-09-21', blocos_abertos: 0 },
      { id: 109, data_lote: '2026-06-30', tipo: 'SH', blocos_produzidos: 50, data_abertura: '2026-09-22', blocos_abertos: 50 }],
    colheitas: [...colheitasR,
      { lote_id: 108, data_colheita: '2026-09-25', total_kg: 10, kg_p: 10, kg_m: 0, kg_g: 0, kg_gg: 0, estante: 'F13' },
      { lote_id: 109, data_colheita: '2026-09-26', total_kg: 20, kg_p: null, kg_m: null, kg_g: null, kg_gg: null, estante: 'F5/1' }],
    eventos: [],
  };
  const r = indicadoresDoPainel(mais, null, { periodo: 'mes', mes: '2026-09', hoje: '2026-10-16' }).rankings;
  assert.deepEqual(r.fora, { sem_colheita: 1, dado_faltante: 1, sem_abertos: 1, sem_tamanho: 1 });
  assert.ok(r.produtividade.some((l) => l.chave === '2026-06-30|SH'), 'CONTROLE: o lote sem tamanho tem kg por bloco');
  assert.ok(r.qualidade.some((l) => l.chave === '2026-06-29|SH'), 'CONTROLE: o lote com 0 abertos tem tamanho');
  const abertos = new Set(mais.lotes.filter((l) => l.data_abertura >= '2026-09-01' && l.data_abertura <= '2026-09-30').map((l) => `${l.data_lote}|${l.tipo}`));
  assert.equal(r.produtividade.length + r.fora.sem_colheita + r.fora.dado_faltante + r.fora.sem_abertos, abertos.size);
  assert.deepEqual(r.por_sala.map((s) => s.sala), ['F1', 'F3', 'F5']);
  assert.equal(r.sem_sala.kg_colhidos, 40 + 10);
});
caso('qualidade: so o Shiitake, com P, M, G e GG em % do kg classificado, ordenado pelo % de M, G e GG', () => {
  assert.deepEqual(rk.qualidade.map((l) => [l.chave, l.kg_classificado, l.kg_p, l.kg_m, l.kg_g, l.kg_gg]), [
    ['2026-06-01|SH', 45, 11, 17, 14, 3],
    ['2026-06-10|SH', 30, 15, 9, 6, 0],
  ]);
  assert.equal(rk.qualidade[0].pct_m_ou_maior, 34 / 45);
  assert.equal(rk.qualidade[1].pct_p, 0.5);
});
caso('qualidade por sala: colheitas do periodo pela sala da colheita; sem sala fica a parte, com o kg', () => {
  assert.deepEqual(rk.por_sala.map((s) => [s.sala, s.kg_colhidos, s.colheitas, s.kg_classificado]), [
    ['F1', 60, 2, 60],
    ['F3', 27, 1, 0],
  ]);
  assert.equal(rk.por_sala[0].pct_m_ou_maior, 39 / 60);
  assert.equal(rk.por_sala[1].pct_m_ou_maior, null, 'Shimeji nao se classifica por tamanho: sem %');
  assert.deepEqual([rk.sem_sala.sala, rk.sem_sala.kg_colhidos, rk.sem_sala.colheitas, rk.sem_sala.kg_classificado, rk.sem_sala.pct_m_ou_maior], [null, 40, 1, 40, 0.75]);
  const kgDoCard = indicadoresDoPainel(dadosR, null, { periodo: 'mes', mes: '2026-09', hoje: '2026-10-16' }).metricas.kg_colhidos.atual;
  assert.equal(rk.por_sala.reduce((t, s) => t + s.kg_colhidos, rk.sem_sala.kg_colhidos), kgDoCard);
  assert.equal(kgDoCard, 127);
});
caso('o tipo filtra os rankings; o lote especifico nao tem ranking', () => {
  const sb = indicadoresDoPainel(dadosR, null, { periodo: 'mes', mes: '2026-09', hoje: '2026-10-16', tipo: 'SB' }).rankings;
  assert.deepEqual(sb.produtividade.map((l) => l.chave), ['2026-07-01|SB']);
  assert.deepEqual(sb.qualidade, []);
  assert.deepEqual(sb.por_sala.map((s) => s.sala), ['F3']);
  assert.equal(indicadoresDoPainel(dadosR, null, { periodo: 'lote', lote: '2026-06-01|SH', hoje: '2026-10-16' }).rankings, null);
});

const aberturasR = [
  { lote_id: 101, sala_destino: 'F1', estante_destino: '3', data: '2026-09-05', quantidade: 200 },
  { lote_id: 102, sala_destino: 'F2', estante_destino: '1', data: '2026-09-06', quantidade: 100 },
  { lote_id: 103, sala_destino: 'F1', estante_destino: '7', data: '2026-09-10', quantidade: 150 },
  { lote_id: 104, sala_destino: 'F5', estante_destino: '2', data: '2026-09-12', quantidade: 180 },
];
const rendimento = (aberturas, colheitas = colheitasR) => indicadoresDoPainel({ ...dadosR, colheitas, aberturasPorLote: aberturas }, null, { periodo: 'mes', mes: '2026-09', hoje: '2026-10-16' }).rankings.rendimento_por_sala;

caso('rendimento por sala: blocos pela sala da abertura, kg pela sala da colheita, por sala e tipo, do maior para o menor', () => {
  const r = rendimento(aberturasR);
  assert.deepEqual(r.linhas.map((s) => [s.sala, s.tipo, s.lotes, s.blocos_abertos, s.kg_colhidos, s.kg_por_bloco_aberto]), [
    ['F1', 'SH', 2, 350, 60, 60 / 350],
    ['F2', 'SH', 1, 100, 15, 0.15],
  ]);
  assert.deepEqual(r.fora, { sem_sala_na_abertura: 0, soma_diferente: 0, colheita_sem_sala_da_abertura: 1 });
  const noF5 = rendimento(aberturasR, colheitasR.map((c) => (c.lote_id === 104 ? { ...c, estante: 'F5/2' } : c)));
  assert.deepEqual(noF5.linhas.map((s) => [s.sala, s.tipo, s.kg_por_bloco_aberto]), [['F1', 'SH', 60 / 350], ['F2', 'SH', 0.15], ['F5', 'SB', 27 / 180]]);
  assert.equal(Object.values(noF5.fora).reduce((t, q) => t + q, 0), 0);
  const noF1 = rendimento(aberturasR.map((a) => (a.lote_id === 104 ? { ...a, sala_destino: 'F1' } : a)), colheitasR.map((c) => (c.lote_id === 104 ? { ...c, estante: 'F1/2' } : c)));
  assert.deepEqual(noF1.linhas.map((s) => [s.sala, s.tipo, s.blocos_abertos, s.kg_colhidos]), [['F1', 'SH', 350, 60], ['F2', 'SH', 100, 15], ['F1', 'SB', 180, 27]]);
});
caso('rendimento por sala: o lote parcial conta nos parciais de cada sala em que abriu', () => {
  const em = (hoje) => indicadoresDoPainel({ ...dadosR, aberturasPorLote: aberturasR }, null, { periodo: 'mes', mes: '2026-09', hoje }).rankings.rendimento_por_sala;
  assert.deepEqual(em('2026-10-08').linhas.map((s) => [s.sala, s.lotes, s.parciais]), [['F1', 2, 1], ['F2', 1, 0]]);
  assert.deepEqual(em('2026-09-20').linhas.map((s) => [s.sala, s.lotes, s.parciais]), [['F1', 2, 2], ['F2', 1, 1]]);
  assert.deepEqual(em('2026-10-16').linhas.map((s) => [s.sala, s.parciais]), [['F1', 0], ['F2', 0]]);
});
caso('rendimento por sala: o lote marcado no ranking (abriu mais do que produziu) leva a marca para a sala em que entra', () => {
  assert.deepEqual(rendimento(aberturasR).linhas.map((s) => [s.sala, s.inconsistentes]), [['F1', 0], ['F2', 0]]);
  const dados = { ...dadosR, lotes: lotesR.map((l) => (l.id === 103 ? { ...l, blocos_produzidos: 100 } : l)), aberturasPorLote: aberturasR };
  const rkm = indicadoresDoPainel(dados, null, { periodo: 'mes', mes: '2026-09', hoje: '2026-10-16' }).rankings;
  assert.deepEqual(rkm.produtividade.filter((l) => l.inconsistente).map((l) => l.chave), ['2026-06-10|SH']);
  assert.deepEqual(rkm.rendimento_por_sala.linhas.map((s) => [s.sala, s.lotes, s.inconsistentes]), [['F1', 2, 1], ['F2', 1, 0]]);
  const duas = { ...dadosR, lotes: lotesR.map((l) => (l.id === 101 ? { ...l, blocos_produzidos: 150 } : l)), aberturasPorLote: aberturasR };
  const rkd = indicadoresDoPainel(duas, null, { periodo: 'mes', mes: '2026-09', hoje: '2026-10-16' }).rankings;
  assert.deepEqual(rkd.produtividade.filter((l) => l.inconsistente).map((l) => l.chave), ['2026-06-01|SH']);
  assert.deepEqual(rkd.rendimento_por_sala.linhas.map((s) => [s.sala, s.inconsistentes]), [['F1', 1], ['F2', 1]]);
  const mista = { ...dadosR, lotes: lotesR.map((l) => (l.id === 103 ? { ...l, blocos_produzidos: 100 } : l)),
    colheitas: colheitasR.map((c) => (c.lote_id === 104 ? { ...c, estante: 'F1/2' } : c)),
    aberturasPorLote: aberturasR.map((a) => (a.lote_id === 104 ? { ...a, sala_destino: 'F1' } : a)) };
  const rkx = indicadoresDoPainel(mista, null, { periodo: 'mes', mes: '2026-09', hoje: '2026-10-16' }).rankings;
  assert.deepEqual(rkx.rendimento_por_sala.linhas.map((s) => [s.sala, s.tipo, s.inconsistentes]), [['F1', 'SH', 1], ['F2', 'SH', 0], ['F1', 'SB', 0]]);
});
caso('rendimento por sala: quem nao fecha sai contado, e cada motivo tem o caso que entra ao lado', () => {
  const lotesDoRanking = rk.produtividade.length;
  const semSala = rendimento(aberturasR.map((a) => (a.lote_id === 103 ? { ...a, sala_destino: null } : a)));
  assert.equal(semSala.fora.sem_sala_na_abertura, 1);
  assert.equal(rendimento(aberturasR.filter((a) => a.lote_id !== 103)).fora.sem_sala_na_abertura, 1);
  const soma140 = rendimento(aberturasR.map((a) => (a.lote_id === 103 ? { ...a, quantidade: 140 } : a)));
  assert.equal(soma140.fora.soma_diferente, 1);
  assert.deepEqual(soma140.linhas.map((s) => [s.sala, s.blocos_abertos, s.kg_colhidos]), [['F1', 200, 30], ['F2', 100, 15]], 'o lote de 10/06 saiu da conta, nao entrou com 140 blocos');
  const semNumero = rendimento(aberturasR.map((a) => (a.lote_id === 101 ? { ...a, quantidade: 300 } : a.lote_id === 102 ? { ...a, quantidade: null } : a)));
  assert.equal(semNumero.fora.soma_diferente, 1);
  assert.ok(!semNumero.linhas.some((s) => s.sala === 'F2'));
  const comoTexto = rendimento(aberturasR.map((a) => ({ ...a, lote_id: String(a.lote_id) })));
  assert.deepEqual(comoTexto, rendimento(aberturasR));
  assert.equal(comoTexto.linhas.length, 2, 'CONTROLE: o caso tem linhas');
  const umaSala = rendimento(aberturasR, colheitasR.map((c) => (c.lote_id === 103 ? { ...c, estante: null } : c)));
  assert.equal(umaSala.fora.colheita_sem_sala_da_abertura, 1, 'so o Shimeji, como no caso base');
  assert.equal(umaSala.linhas.find((s) => s.sala === 'F1').kg_colhidos, 60);
  const duasSalas = rendimento(aberturasR, colheitasR.map((c) => (c.lote_id === 102 ? { ...c, estante: null } : c)));
  assert.equal(duasSalas.fora.colheita_sem_sala_da_abertura, 2);
  assert.deepEqual(duasSalas.linhas.map((s) => [s.sala, s.lotes, s.blocos_abertos]), [['F1', 1, 150]]);
  assert.equal(lotesDoRanking, 3);
  assert.equal(lotesDoRanking - Object.values(duasSalas.fora).reduce((t, q) => t + q, 0), 1, '2026-06-10|SH, o unico que entra');
});
caso('rendimento por sala: o tipo filtra; servidor sem aberturas (carga velha) da todos sem sala, nunca zero', () => {
  const sb = indicadoresDoPainel({ ...dadosR, aberturasPorLote: aberturasR }, null, { periodo: 'mes', mes: '2026-09', hoje: '2026-10-16', tipo: 'SH' }).rankings.rendimento_por_sala;
  assert.deepEqual(sb.linhas.map((s) => s.tipo), ['SH', 'SH']);
  assert.equal(sb.fora.colheita_sem_sala_da_abertura, 0, 'o Shimeji saiu pelo filtro, nao pela sala');
  const semCarga = indicadoresDoPainel(dadosR, null, { periodo: 'mes', mes: '2026-09', hoje: '2026-10-16' }).rankings.rendimento_por_sala;
  assert.deepEqual(semCarga, { linhas: [], fora: { sem_sala_na_abertura: 3, soma_diferente: 0, colheita_sem_sala_da_abertura: 0 } });
});

caso('qualidade do Shiitake: M, G e GG sobre o kg classificado do periodo; o Shimeji (todo no kg_p) fica fora', () => {
  const r = indicadoresDoPainel(dadosR, null, { periodo: 'mes', mes: '2026-09', hoje: '2026-10-16' }).metricas;
  assert.equal(r.kg_classificado.atual, 100);
  assert.equal(r.kg_m_ou_maior.atual, 69);
  assert.equal(r.pct_m_ou_maior.atual, 0.69);
  assert.equal(r.pct_m_ou_maior.melhor, 'MAIOR');
  assert.equal(r.pct_m_ou_maior.anterior, null, 'agosto comeca antes da primeira colheita (02/09): sem comparacao');
  assert.equal(r.kg_classificado.anterior, null, 'antes da primeira colheita o kg classificado nao existe, nao e 0');
  const sb = indicadoresDoPainel(dadosR, null, { periodo: 'mes', mes: '2026-09', hoje: '2026-10-16', tipo: 'SB' }).metricas;
  assert.equal(sb.pct_m_ou_maior.atual, null, 'o Shimeji nao se classifica: travessao, nunca 0');
  assert.equal(sb.kg_classificado.atual, null);
  assert.equal(sb.kg_colhidos.atual, 27, 'CONTROLE: o Shimeji colheu no periodo');
});
caso('KG PP: entra no kg colhido; o kg classificado, os kg de cada faixa e os % nao mudam', () => {
  const comPP = { ...dadosR, colheitas: colheitasR.map((c) => (c.lote_id === 101 ? { ...c, total_kg: c.total_kg + 4, kg_pp: 4 } : c)) };
  const opcoes = { periodo: 'mes', mes: '2026-09', hoje: '2026-10-16' };
  const [sem, com] = [dadosR, comPP].map((d) => indicadoresDoPainel(d, null, opcoes));
  const QUALIDADE = ['kg_classificado', 'kg_m_ou_maior', 'kg_p', 'kg_m', 'kg_g', 'kg_gg', 'pct_p', 'pct_m', 'pct_g', 'pct_gg', 'pct_m_ou_maior'];
  const daQualidade = (x) => Object.fromEntries(QUALIDADE.map((k) => [k, x?.[k]]));
  assert.deepEqual(daQualidade(com.metricas), daQualidade(sem.metricas));
  assert.deepEqual(com.rankings.qualidade.map(daQualidade), sem.rankings.qualidade.map(daQualidade));
  assert.deepEqual(com.rankings.por_sala.map((s) => s.kg_classificado), sem.rankings.por_sala.map((s) => s.kg_classificado));
  assert.equal(com.metricas.kg_colhidos.atual, sem.metricas.kg_colhidos.atual + 4);
  assert.equal(com.rankings.produtividade.find((l) => l.chave === '2026-06-01|SH').kg_colhidos, 49);
});
caso('qualidade do Shiitake: compara com o anterior equivalente; periodo sem Shiitake classificado nao tem %', () => {
  const comAgosto = { ...dadosR, colheitas: [...colheitasR, { lote_id: 105, data_colheita: '2026-08-01', total_kg: 20, kg_p: 15, kg_m: 5, kg_g: 0, kg_gg: 0, estante: null }] };
  const r = indicadoresDoPainel(comAgosto, null, { periodo: 'mes', mes: '2026-09', hoje: '2026-10-16' }).metricas;
  assert.equal(r.pct_m_ou_maior.anterior, 0.25);
  assert.equal(r.kg_classificado.anterior, 20, 'CONTROLE: com colheita em agosto o anterior existe');
  assert.equal(r.pct_m_ou_maior.atual, 0.69);
  assert.equal(r.pct_m_ou_maior.media3, null);
  const soShimeji = { ...dadosR, colheitas: [...colheitasR.filter((c) => c.data_colheita < '2026-10-01'), { lote_id: 104, data_colheita: '2026-10-05', total_kg: 9, kg_p: 9, kg_m: null, kg_g: null, kg_gg: null, estante: 'F3/2' }] };
  const out = indicadoresDoPainel(soShimeji, null, { periodo: 'mes', mes: '2026-10', hoje: '2026-10-16' }).metricas;
  assert.equal(out.kg_classificado.atual, 0);
  assert.equal(out.pct_m_ou_maior.atual, null);
  assert.equal(out.kg_colhidos.atual, 9, 'CONTROLE: houve colheita');
});
caso('qualidade do Shiitake no lote especifico: a de toda a colheita do lote; outro tipo nao tem', () => {
  const r = indicadoresDoPainel(dadosR, null, { periodo: 'lote', lote: '2026-06-01|SH', hoje: '2026-10-16' }).metricas;
  assert.equal(r.kg_classificado.atual, 45);
  assert.equal(r.pct_m_ou_maior.atual, 34 / 45);
  assert.equal(r.pct_m_ou_maior.anterior, null, 'nenhum lote SH antes de 01/06');
  const prox = indicadoresDoPainel(dadosR, null, { periodo: 'lote', lote: '2026-06-10|SH', hoje: '2026-10-16' }).metricas;
  assert.equal(prox.pct_m_ou_maior.anterior, 34 / 45, 'o lote anterior do mesmo tipo');
  const sb = indicadoresDoPainel(dadosR, null, { periodo: 'lote', lote: '2026-07-01|SB', hoje: '2026-10-16' }).metricas;
  assert.equal(sb.pct_m_ou_maior.atual, null);
  assert.equal(sb.kg_colhidos.atual, 27, 'CONTROLE: o lote de Shimeji colheu');
});

const setembro = (dados, hoje = '2026-10-16') => indicadoresDoPainel(dados, null, { periodo: 'mes', mes: '2026-09', hoje }).rankings;

caso('parcial: o lote que ainda colhe ou ainda tem estante na fila de abertura, com o encerrado ao lado', () => {
  const r = setembro(dadosR, '2026-10-08');
  assert.deepEqual(Object.fromEntries(r.produtividade.map((l) => [l.chave, l.parcial])), { '2026-06-10|SH': 'COLHENDO', '2026-06-01|SH': null, '2026-07-01|SB': 'COLHENDO' });
  assert.deepEqual(Object.fromEntries(r.qualidade.map((l) => [l.chave, l.parcial])), { '2026-06-01|SH': null, '2026-06-10|SH': 'COLHENDO' });
  assert.ok(rk.produtividade.every((l) => l.parcial === null));
  const naFila = setembro({ ...dadosR, lotes: [...lotesR, { id: 110, data_lote: '2026-06-01', tipo: 'SH', blocos_produzidos: 80, data_abertura: null, blocos_abertos: null }] });
  assert.equal(naFila.produtividade.find((l) => l.chave === '2026-06-01|SH').parcial, 'EM_MATURACAO');
  assert.equal(naFila.qualidade.find((l) => l.chave === '2026-06-01|SH').parcial, 'EM_MATURACAO');
  assert.equal(naFila.produtividade.find((l) => l.chave === '2026-06-10|SH').parcial, null, 'CONTROLE: o outro lote nao muda');
});
caso('sementes: as das estantes do lote, sem repetir cepa e lote da semente; sem semente e [], carga que falhou e null', () => {
  const cepas = [{ id: 1, codigo: 'SH-A' }, { id: 2, codigo: 'SH-B' }];
  const sementesDosLotes = [
    { id: 1, lote_id: 101, cepa_id: 1, nf: '10', lote_semente: 'L7', vencimento: '2026-12-01' },
    { id: 2, lote_id: 102, cepa_id: 1, nf: '10', lote_semente: 'L7', vencimento: '2026-12-01' },
    { id: 3, lote_id: 103, cepa_id: 1, nf: '11', lote_semente: null, vencimento: null },
    { id: 4, lote_id: 103, cepa_id: 2, nf: '12', lote_semente: 'B2', vencimento: null },
    { id: 5, lote_id: 105, cepa_id: 2, nf: '13', lote_semente: 'B9', vencimento: null },
  ];
  const r = setembro({ ...dadosR, sementesDosLotes, cepas });
  assert.deepEqual(Object.fromEntries(r.produtividade.map((l) => [l.chave, l.sementes])), {
    '2026-06-10|SH': [{ cepa: 'SH-A', lote_semente: null }, { cepa: 'SH-B', lote_semente: 'B2' }],
    '2026-06-01|SH': [{ cepa: 'SH-A', lote_semente: 'L7' }],
    '2026-07-01|SB': [],
  });
  assert.deepEqual(r.qualidade.find((l) => l.chave === '2026-06-01|SH').sementes, [{ cepa: 'SH-A', lote_semente: 'L7' }]);
  assert.ok(rk.produtividade.every((l) => l.sementes === null));
  assert.ok(setembro({ ...dadosR, sementesDosLotes: null, cepas }).produtividade.every((l) => l.sementes === null));
});
caso('sementes: a mesma cepa com dois lotes da semente no mesmo lote de producao sai duas vezes, uma por lote da semente', () => {
  const cepas = [{ id: 1, codigo: 'SH-A' }];
  const sementesDosLotes = [
    { id: 1, lote_id: 101, cepa_id: 1, nf: '10', lote_semente: 'L7', vencimento: null },
    { id: 2, lote_id: 102, cepa_id: 1, nf: '10', lote_semente: 'L8', vencimento: null },
  ];
  const l = setembro({ ...dadosR, sementesDosLotes, cepas }).produtividade.find((x) => x.chave === '2026-06-01|SH');
  assert.deepEqual(l.sementes, [{ cepa: 'SH-A', lote_semente: 'L7' }, { cepa: 'SH-A', lote_semente: 'L8' }]);
});
caso('sementes: a mesma cepa e NF sem lote numa estante e com o lote noutra e uma semente so, a anotada', () => {
  const cepas = [{ id: 1, codigo: 'SH-A' }];
  const so = (sementesDosLotes) => setembro({ ...dadosR, sementesDosLotes, cepas }).produtividade.find((x) => x.chave === '2026-06-01|SH').sementes;
  assert.deepEqual(so([
    { id: 1, lote_id: 101, cepa_id: 1, nf: '10', lote_semente: 'L7', vencimento: null },
    { id: 2, lote_id: 102, cepa_id: 1, nf: '10', lote_semente: null, vencimento: null },
  ]), [{ cepa: 'SH-A', lote_semente: 'L7' }]);
  assert.deepEqual(so([
    { id: 1, lote_id: 101, cepa_id: 1, nf: '10', lote_semente: 'L7', vencimento: null },
    { id: 2, lote_id: 102, cepa_id: 1, nf: '10', lote_semente: 'L8', vencimento: null },
  ]), [{ cepa: 'SH-A', lote_semente: 'L7' }, { cepa: 'SH-A', lote_semente: 'L8' }]);
  assert.deepEqual(so([
    { id: 1, lote_id: 101, cepa_id: 1, nf: '10', lote_semente: 'L7', vencimento: null },
    { id: 2, lote_id: 102, cepa_id: 1, nf: '11', lote_semente: null, vencimento: null },
  ]), [{ cepa: 'SH-A', lote_semente: null }, { cepa: 'SH-A', lote_semente: 'L7' }]);
});
caso('sementes: a semente gravada na estante do lote que abriu noutro mes entra no lote do ranking', () => {
  const cepas = [{ id: 1, codigo: 'SH-A' }];
  const lotes = [...lotesR, { id: 108, data_lote: '2026-06-01', tipo: 'SH', blocos_produzidos: 50, data_abertura: '2026-08-28', blocos_abertos: 50 }];
  const sementesDosLotes = [{ id: 1, lote_id: 108, cepa_id: 1, nf: '10', lote_semente: 'L9', vencimento: null }];
  const r = setembro({ ...dadosR, lotes, sementesDosLotes, cepas });
  const l = r.produtividade.find((x) => x.chave === '2026-06-01|SH');
  assert.deepEqual(l.sementes, [{ cepa: 'SH-A', lote_semente: 'L9' }]);
  assert.deepEqual([l.blocos_abertos, l.kg_colhidos], [300, 45], 'CONTROLE: o kg e os blocos seguem so os do recorte');
  assert.deepEqual(r.produtividade.find((x) => x.chave === '2026-06-10|SH').sementes, [], 'CONTROLE: o outro lote nao herda');
});
caso('salas: cada linha leva as salas da abertura com blocos, kg e tamanhos, que somam o lote, ou o motivo de ficar fora', () => {
  const r = setembro({ ...dadosR, aberturasPorLote: aberturasR });
  const l = r.produtividade.find((x) => x.chave === '2026-06-01|SH');
  assert.deepEqual([l.kg_p, l.kg_m, l.kg_g, l.kg_gg], [11, 17, 14, 3]);
  assert.deepEqual(l.salas, [
    { sala: 'F1', blocos_abertos: 200, kg_colhidos: 30, kg_p: 6, kg_m: 12, kg_g: 9, kg_gg: 3 },
    { sala: 'F2', blocos_abertos: 100, kg_colhidos: 15, kg_p: 5, kg_m: 5, kg_g: 5, kg_gg: 0 },
  ]);
  assert.equal(l.sala_fora, null);
  assert.equal(l.salas.reduce((t, s) => t + s.blocos_abertos, 0), l.blocos_abertos);
  assert.equal(l.salas.reduce((t, s) => t + s.kg_colhidos, 0), l.kg_colhidos);
  const sb = r.produtividade.find((x) => x.chave === '2026-07-01|SB');
  assert.deepEqual([sb.salas, sb.sala_fora], [null, 'colheita_sem_sala_da_abertura']);
  assert.deepEqual(r.qualidade.find((x) => x.chave === '2026-06-10|SH').salas, [{ sala: 'F1', blocos_abertos: 150, kg_colhidos: 30, kg_p: 15, kg_m: 9, kg_g: 6, kg_gg: 0 }]);
  assert.ok(rk.produtividade.every((x) => x.salas === null && x.sala_fora === 'sem_sala_na_abertura'));
});

const movimentosR = [
  { data: '2026-06-02', tipo: 'SAIDA', ajuste: false, tipo_cogumelo: 'Shiitake', quantidade: 8 },
  { data: '2026-06-02', tipo: 'SAIDA', ajuste: false, tipo_cogumelo: 'Shiitake', quantidade: 4 },
  { data: '2026-06-02', tipo: 'SAIDA', ajuste: true, tipo_cogumelo: 'Shiitake', quantidade: 50 },
  { data: '2026-06-02', tipo: 'ENTRADA', ajuste: false, tipo_cogumelo: 'Shiitake', quantidade: 30 },
  { data: '2026-06-02', tipo: 'SAIDA', ajuste: false, tipo_cogumelo: 'Shimeji Branco', quantidade: 6 },
  { data: '2026-06-10', tipo: 'SAIDA', ajuste: false, tipo_cogumelo: 'Shiitake', quantidade: 5 },
  { data: '2026-07-02', tipo: 'SAIDA', ajuste: false, tipo_cogumelo: 'Shimeji Branco', quantidade: 9 },
];
const sementeDe = (r, chave) => { const l = r.produtividade.find((x) => x.chave === chave); return [l.semente_pacotes, l.semente_fora]; };
const lotesSemeacao = [
  { id: 301, data_lote: '2026-09-30', tipo: 'SH', blocos_produzidos: 720, data_abertura: '2026-12-01', blocos_abertos: 720 },
  { id: 302, data_lote: '2026-10-05', tipo: 'SH', blocos_produzidos: 240, data_abertura: '2026-12-05', blocos_abertos: 240 },
  { id: 303, data_lote: '2026-10-06', tipo: 'SH', blocos_produzidos: 690, data_abertura: '2026-12-06', blocos_abertos: 690 },
];
const saidasDaVirada = [
  { data: '2026-09-30', tipo: 'SAIDA', ajuste: false, tipo_cogumelo: 'Shiitake', quantidade: 18 },
  { data: '2026-10-01', tipo: 'SAIDA', ajuste: false, tipo_cogumelo: 'Shiitake', quantidade: 17 },
  { data: '2026-10-05', tipo: 'SAIDA', ajuste: false, tipo_cogumelo: 'Shiitake', quantidade: 16 },
  { data: '2026-10-06', tipo: 'SAIDA', ajuste: false, tipo_cogumelo: 'Shiitake', quantidade: 5 },
  { data: '2026-10-06', tipo: 'ENTRADA', ajuste: false, tipo_cogumelo: 'Shiitake', quantidade: 48 },
  { data: '2026-10-06', tipo: 'ENTRADA', ajuste: false, tipo_cogumelo: 'Shiitake', quantidade: 30 },
  { data: '2026-10-07', tipo: 'SAIDA', ajuste: false, tipo_cogumelo: 'Shiitake', quantidade: 11 },
  { data: '2026-10-07', tipo: 'SAIDA', ajuste: false, tipo_cogumelo: 'Shiitake', quantidade: 4 },
];
caso('semente usada: a saida do dia da semeacao, um dia depois do lote, inclusive na virada do mes', () => {
  const dados = {
    lotes: lotesSemeacao, eventos: [], sementesMovimentos: saidasDaVirada,
    colheitas: lotesSemeacao.map((l) => ({ lote_id: l.id, data_colheita: '2026-12-10', total_kg: 100, kg_p: null, kg_m: null, kg_g: null, kg_gg: null, estante: null })),
  };
  const r = indicadoresDoPainel(dados, null, { periodo: 'mes', mes: '2026-12', hoje: '2027-01-10' }).rankings;
  assert.deepEqual(sementeDe(r, '2026-09-30|SH'), [17, null], 'a saida de 01/10, nao a de 30/09, que e do lote de 29/09');
  assert.deepEqual(sementeDe(r, '2026-10-05|SH'), [5, null], 'a saida de 06/10, nao os 16 de 05/10, que sao do lote de 04/10');
  assert.deepEqual(sementeDe(r, '2026-10-06|SH'), [15, null], 'as duas saidas de 07/10, e nao os 5 de 06/10');
});
caso('semente usada: as saidas do dia da semeacao, do mesmo tipo, sem ajuste nem entrada; lote sem saida no dia sai contado', () => {
  const r = setembro({ ...dadosR, sementesMovimentos: movimentosR });
  assert.deepEqual(sementeDe(r, '2026-06-01|SH'), [12, null]);
  assert.deepEqual(sementeDe(r, '2026-07-01|SB'), [9, null], 'CONTROLE: o Shimeji de 02/06 fica fora do Shiitake, e o do dia dele entra');
  assert.deepEqual(sementeDe(r, '2026-06-10|SH'), [null, 'sem_saida_no_dia'], 'a saida do proprio dia do lote e da semeacao do lote da vespera');
  const zero = setembro({ ...dadosR, sementesMovimentos: [...movimentosR, { data: '2026-06-11', tipo: 'SAIDA', ajuste: false, tipo_cogumelo: 'Shiitake', quantidade: 0 }] });
  assert.deepEqual(sementeDe(zero, '2026-06-10|SH'), [null, 'sem_saida_no_dia']);
  const torta = setembro({ ...dadosR, sementesMovimentos: [...movimentosR, { data: null, tipo: 'SAIDA', ajuste: false, tipo_cogumelo: 'Shiitake', quantidade: 3 }, { data: '2026-13-01', tipo: 'SAIDA', ajuste: false, tipo_cogumelo: 'Shiitake', quantidade: 3 }] });
  assert.deepEqual(sementeDe(torta, '2026-06-01|SH'), [12, null]);
});
caso('semente usada: so com todas as estantes do lote no recorte; carga que falhou sai com o motivo, nunca zero', () => {
  const lotes = [...lotesR, { id: 108, data_lote: '2026-06-01', tipo: 'SH', blocos_produzidos: 50, data_abertura: '2026-08-28', blocos_abertos: 50 }];
  assert.deepEqual(sementeDe(setembro({ ...dadosR, lotes, sementesMovimentos: movimentosR }), '2026-06-01|SH'), [null, 'lote_fora_do_recorte']);
  const noAno = indicadoresDoPainel({ ...dadosR, lotes, sementesMovimentos: movimentosR }, null, { periodo: 'ano', hoje: '2026-10-16' }).rankings;
  assert.deepEqual(sementeDe(noAno, '2026-06-01|SH'), [12, null], 'CONTROLE: no ano as tres estantes estao no recorte');
  const naMaturacao = [...lotesR, { id: 109, data_lote: '2026-06-01', tipo: 'SH', blocos_produzidos: 50, data_abertura: null, blocos_abertos: null }];
  assert.deepEqual(sementeDe(setembro({ ...dadosR, lotes: naMaturacao, sementesMovimentos: movimentosR }), '2026-06-01|SH'), [null, 'lote_fora_do_recorte'], 'estante ainda na maturacao');
  assert.ok(setembro({ ...dadosR, sementesMovimentos: null }).produtividade.every((x) => x.semente_pacotes === null && x.semente_fora === 'nao_carregou'));
  assert.ok(rk.produtividade.every((x) => x.semente_pacotes === null && x.semente_fora === 'nao_carregou'), 'sem o campo, o mesmo');
});
caso('semente usada: saida de cepa que o cadastro do lote nao tem deixa o lote sem numero; lote sem cadastro nao se confere', () => {
  const cepas = [{ id: 1, codigo: 'SH-A' }, { id: 2, codigo: 'SH-B' }];
  const cadastro = [{ id: 1, lote_id: 102, cepa_id: 1, nf: '10', lote_semente: 'L7', vencimento: null }];
  const daCepa1 = movimentosR.map((m) => (m.tipo_cogumelo === 'Shiitake' ? { ...m, cepa_id: 1 } : m));
  const outra = { data: '2026-06-02', tipo: 'SAIDA', ajuste: false, cepa_id: 2, tipo_cogumelo: 'Shiitake', quantidade: 8 };
  const de = (sementesDosLotes, movs) => sementeDe(setembro({ ...dadosR, sementesDosLotes, cepas, sementesMovimentos: movs }), '2026-06-01|SH');
  assert.deepEqual(de(cadastro, daCepa1), [12, null], 'CONTROLE: a cepa da saida e a do cadastro (lancado so na segunda estante)');
  assert.deepEqual(de([{ ...cadastro[0], cepa_id: '1' }], daCepa1), [12, null], 'cepa do cadastro em texto');
  assert.deepEqual(de(cadastro, [...daCepa1, outra]), [null, 'cepa_diferente']);
  assert.deepEqual(de(cadastro, [...daCepa1, { ...outra, ajuste: true }]), [12, null], 'o ajuste de outra cepa nao e uso');
  assert.deepEqual(de([], [...daCepa1, outra]), [20, null], 'lote sem semente cadastrada');
  assert.deepEqual(de(null, [...daCepa1, outra]), [20, null], 'carga do cadastro que falhou: o filtro por semente ja avisa');
  const do103 = [{ id: 2, lote_id: 103, cepa_id: 1, nf: '11', lote_semente: 'L8', vencimento: null }];
  const movs103 = [
    { data: '2026-06-10', tipo: 'SAIDA', ajuste: false, cepa_id: 2, tipo_cogumelo: 'Shiitake', quantidade: 9 },
    { data: '2026-06-11', tipo: 'SAIDA', ajuste: false, cepa_id: 1, tipo_cogumelo: 'Shiitake', quantidade: 7 },
  ];
  assert.deepEqual(sementeDe(setembro({ ...dadosR, sementesDosLotes: do103, cepas, sementesMovimentos: movs103 }), '2026-06-10|SH'), [7, null]);
  assert.deepEqual(sementeDe(setembro({ ...dadosR, sementesDosLotes: do103, cepas, sementesMovimentos: [...movs103, { ...movs103[0], data: '2026-06-11' }] }), '2026-06-10|SH'), [null, 'cepa_diferente'], 'CONTROLE: a mesma saida no dia da semeacao marca');
});

const lotesQ = [
  { id: 201, data_lote: '2026-07-01', tipo: 'SH', blocos_produzidos: 100, data_abertura: '2026-09-01', blocos_abertos: 100, receita: 'R1' },
  { id: 202, data_lote: '2026-07-01', tipo: 'SH', blocos_produzidos: 100, data_abertura: '2026-09-11', blocos_abertos: 50, receita: ' R1 ' },
  { id: 203, data_lote: '2026-07-15', tipo: 'SH', blocos_produzidos: 100, data_abertura: '2026-09-20', blocos_abertos: 100, receita: 'R2' },
  { id: 204, data_lote: '2026-08-01', tipo: 'SB', blocos_produzidos: 100, data_abertura: '2026-09-25', blocos_abertos: 100, receita: null },
];
const colheitasQ = [
  { lote_id: 201, data_colheita: '2026-09-02', total_kg: 2, kg_p: 1, kg_m: 1, kg_g: 0, kg_gg: 0, estante: 'F1/1' },
  { lote_id: 201, data_colheita: '2026-10-01', total_kg: 10, kg_p: 2, kg_m: 4, kg_g: 3, kg_gg: 1, estante: 'F1/1' },
  { lote_id: 203, data_colheita: '2026-10-02', total_kg: 10, kg_p: 5, kg_m: 3, kg_g: 2, kg_gg: 0, estante: 'F2/4' },
  { lote_id: 201, data_colheita: '2026-10-08', total_kg: 4, kg_p: 1, kg_m: 2, kg_g: 1, kg_gg: 0, estante: 'F1/1' },
  { lote_id: 202, data_colheita: '2026-10-09', total_kg: 2, kg_p: 1, kg_m: 1, kg_g: 0, kg_gg: 0, estante: 'F1/2' },
  { lote_id: 203, data_colheita: '2026-10-10', total_kg: 10, kg_p: 6, kg_m: 3, kg_g: 1, kg_gg: 0, estante: 'F2/4' },
  { lote_id: 204, data_colheita: '2026-10-11', total_kg: 9, kg_p: 9, kg_m: null, kg_g: null, kg_gg: null, estante: 'F3/1' },
];
const aberturasQ = [
  { lote_id: 201, sala_destino: 'F1', estante_destino: '1', data: '2026-09-01', quantidade: 100 },
  { lote_id: 202, sala_destino: 'F1', estante_destino: '2', data: '2026-09-11', quantidade: 50 },
  { lote_id: 203, sala_destino: 'F2', estante_destino: '4', data: '2026-09-20', quantidade: 100 },
];
const dadosQ = { lotes: lotesQ, colheitas: colheitasQ, eventos: [], aberturasPorLote: aberturasQ };
const dezDias = (dados = dadosQ, extra = {}) => indicadoresDoPainel(dados, null, { periodo: '10', hoje: '2026-10-16', ...extra });
const quase = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-12, `${msg ?? ''} ${a} contra ${b}`);
const CLASSES = ['kg_p', 'kg_m', 'kg_g', 'kg_gg', 'kg_classificado'];

caso('10 dias: 07 a 16/10 contra 27/09 a 06/10, com cada classe em % do kg classificado e o M, G e GG consolidado', () => {
  const r = dezDias();
  assert.deepEqual(r.periodo, { modo: '10', inicio: '2026-10-07', fim: '2026-10-16' });
  assert.deepEqual(r.anteriores[0], { inicio: '2026-09-27', fim: '2026-10-06' });
  const m = r.metricas;
  assert.deepEqual(CLASSES.map((k) => m[k].atual), [8, 6, 2, 0, 16]);
  assert.deepEqual(CLASSES.map((k) => m[k].anterior), [7, 7, 5, 1, 20]);
  assert.deepEqual(['pct_p', 'pct_m', 'pct_g', 'pct_gg'].map((k) => m[k].atual), [0.5, 0.375, 0.125, 0]);
  assert.deepEqual([m.pct_m_ou_maior.atual, m.pct_m_ou_maior.anterior], [0.5, 0.65]);
  assert.equal(m.pct_p.atual + m.pct_m.atual + m.pct_g.atual + m.pct_gg.atual, 1);
  assert.equal(m.pct_m.atual + m.pct_g.atual + m.pct_gg.atual, m.pct_m_ou_maior.atual);
  assert.deepEqual(['pct_p', 'pct_m', 'pct_g', 'pct_gg'].map((k) => m[k].melhor), ['MENOR', null, 'MAIOR', 'MAIOR']);
  assert.equal(m.kg_colhidos.atual, 25, 'CONTROLE: o Shimeji colheu na janela e nao entra no classificado');
  assert.ok(CLASSES.every((k) => dezDias(dadosQ, { tipo: 'SB' }).metricas[k].atual === null));
});
caso('queda dos 10 dias: os lotes que contribuiram, do que mais puxou para baixo; somados, os efeitos dao a variacao do card', () => {
  const r = dezDias();
  const v = r.rankings.variacao_da_qualidade;
  assert.equal(v.atual, r.metricas.pct_m_ou_maior.atual);
  assert.equal(v.base, r.metricas.pct_m_ou_maior.anterior);
  assert.deepEqual([v.kg_classificado, v.kg_classificado_anterior], [16, 20]);
  assert.deepEqual(v.lotes.map((l) => l.chave), ['2026-07-15|SH', '2026-07-01|SH']);
  const [pior, outro] = v.lotes;
  quase(pior.efeito, (4 - 0.65 * 10) / 16, 'efeito do 15/07');
  quase(outro.efeito, (4 - 0.65 * 6) / 16, 'efeito do 01/07');
  assert.ok(pior.efeito < 0 && outro.efeito > 0);
  quase(v.lotes.reduce((t, l) => t + l.efeito, 0), v.atual - v.base, 'soma dos efeitos');
  assert.deepEqual(CLASSES.map((k) => outro[k]), [2, 3, 1, 0, 6]);
  assert.equal(outro.pct_m_ou_maior, 4 / 6);
  assert.ok(!v.lotes.some((l) => l.tipo === 'SB'), 'CONTROLE: o Shimeji colheu na janela e nao entra');
});
caso('queda dos 10 dias sem base: anterior antes do primeiro lancamento ou sem Shiitake classificado; lotes listados sem efeito', () => {
  const semHistorico = dezDias({ ...dadosQ, colheitas: colheitasQ.filter((c) => c.data_colheita !== '2026-09-02') });
  const v = semHistorico.rankings.variacao_da_qualidade;
  assert.deepEqual([v.base, v.kg_classificado_anterior, v.atual], [null, null, 0.5]);
  assert.equal(semHistorico.metricas.pct_m_ou_maior.anterior, null, 'CONTROLE: o card tambem nao compara');
  assert.deepEqual(v.lotes.map((l) => [l.chave, l.efeito]), [['2026-07-01|SH', null], ['2026-07-15|SH', null]]);
  const vazio = dezDias({ ...dadosQ, colheitas: colheitasQ.filter((c) => c.data_colheita < '2026-09-27' || c.data_colheita > '2026-10-06') });
  const w = vazio.rankings.variacao_da_qualidade;
  assert.deepEqual([w.base, w.kg_classificado_anterior], [null, 0]);
  assert.ok(w.lotes.length === 2 && w.lotes.every((l) => l.efeito === null));
  assert.equal(vazio.metricas.pct_m_ou_maior.anterior, null);
});
caso('queda dos 10 dias: so o Shiitake; o lote sem data de inoculacao entra na conta, como no card, e nao se compara', () => {
  assert.equal(dezDias(dadosQ, { tipo: 'SB' }).rankings.variacao_da_qualidade, null);
  assert.deepEqual(dezDias(dadosQ, { tipo: 'SH' }).rankings.variacao_da_qualidade, dezDias().rankings.variacao_da_qualidade, 'CONTROLE: com o Shiitake escolhido, a mesma');
  const semData = {
    ...dadosQ,
    lotes: [...lotesQ, { id: 205, data_lote: null, tipo: 'SH', blocos_produzidos: 50, data_abertura: '2026-09-30', blocos_abertos: 50 }],
    colheitas: [...colheitasQ, { lote_id: 205, data_colheita: '2026-10-12', total_kg: 4, kg_p: 0, kg_m: 4, kg_g: 0, kg_gg: 0, estante: 'F4/1' }],
  };
  const r = dezDias(semData);
  const v = r.rankings.variacao_da_qualidade;
  assert.equal(v.atual, 12 / 20);
  assert.equal(v.atual, r.metricas.pct_m_ou_maior.atual, 'o card conta essa colheita');
  quase(v.lotes.reduce((t, l) => t + l.efeito, 0), v.atual - v.base, 'soma dos efeitos');
  assert.ok(v.lotes.some((l) => l.data_lote === null));
  assert.ok(r.rankings.comparaveis.every((l) => l.data_lote), 'sem data nao se compara');
});
caso('queda dos 10 dias: o Shiitake que colheu sem tamanho anotado nao entra na lista (nada para comparar), e o card nao muda', () => {
  const semTamanho = {
    ...dadosQ,
    lotes: [...lotesQ, { id: 206, data_lote: '2026-07-20', tipo: 'SH', blocos_produzidos: 50, data_abertura: '2026-09-28', blocos_abertos: 50 }],
    colheitas: [...colheitasQ, { lote_id: 206, data_colheita: '2026-10-12', total_kg: 5, kg_p: null, kg_m: null, kg_g: null, kg_gg: null, estante: 'F4/2' }],
  };
  const r = dezDias(semTamanho);
  const v = r.rankings.variacao_da_qualidade;
  assert.deepEqual(v.lotes.map((l) => l.chave), ['2026-07-15|SH', '2026-07-01|SH']);
  assert.equal(v.atual, dezDias().rankings.variacao_da_qualidade.atual, 'o M, G e GG e o mesmo sem ele');
  assert.equal(r.metricas.kg_colhidos.atual, 30, 'CONTROLE: os 5 kg dele entram no colhido');
});
caso('comparaveis: o lote inteiro (todas as estantes e toda a colheita), com sementes, receita, salas e maturacao', () => {
  const cepas = [{ id: 1, codigo: 'SH-A' }];
  const sementesDosLotes = [{ id: 1, lote_id: 201, cepa_id: 1, nf: '10', lote_semente: 'L7', vencimento: null }];
  const r = dezDias({ ...dadosQ, cepas, sementesDosLotes }).rankings;
  assert.deepEqual([r.produtividade.length, r.qualidade.length], [0, 0]);
  assert.deepEqual(r.comparaveis.map((l) => l.chave).sort(), ['2026-07-01|SH', '2026-07-15|SH']);
  const a = r.comparaveis.find((l) => l.chave === '2026-07-01|SH');
  assert.deepEqual([a.blocos_abertos, a.kg_colhidos, a.kg_classificado, a.kg_por_bloco_aberto], [150, 18, 18, 0.12]);
  assert.equal(a.pct_m_ou_maior, 13 / 18);
  assert.deepEqual(a.receitas, ['R1'], 'a mesma receita nas duas estantes, com espaco, sai uma vez');
  assert.deepEqual([a.salas, a.sala_fora], [['F1'], null]);
  assert.deepEqual(a.sementes, [{ cepa: 'SH-A', lote_semente: 'L7' }]);
  assert.deepEqual([a.maturacao.primeira, a.maturacao.ultima], [62, 72]);
  quase(a.maturacao.media, (62 * 100 + 72 * 50) / 150, 'maturacao media pelos blocos');
  const b = r.comparaveis.find((l) => l.chave === '2026-07-15|SH');
  assert.deepEqual([b.receitas, b.salas, b.sementes, b.maturacao.primeira], [['R2'], ['F2'], [], 67]);
  const semSala = dezDias({ ...dadosQ, aberturasPorLote: [] }).rankings.comparaveis.find((l) => l.chave === '2026-07-01|SH');
  assert.deepEqual([semSala.salas, semSala.sala_fora], [null, 'sem_sala_na_abertura']);
  assert.deepEqual([semSala.maturacao.primeira, semSala.maturacao.ultima], [62, 72]);
});
caso('comparaveis: a estante que abriu em dois dias conta cada abertura na data e na quantidade dela', () => {
  const emDuas = [{ ...aberturasQ[0], quantidade: 60 }, { ...aberturasQ[0], data: '2026-09-15', quantidade: 40 }, ...aberturasQ.slice(1)];
  const a = dezDias({ ...dadosQ, aberturasPorLote: emDuas }).rankings.comparaveis.find((l) => l.chave === '2026-07-01|SH');
  assert.deepEqual([a.maturacao.primeira, a.maturacao.ultima], [62, 76]);
  quase(a.maturacao.media, (62 * 60 + 76 * 40 + 72 * 50) / 150, 'media por abertura');
  assert.deepEqual([a.salas, a.sala_fora], [['F1'], null], 'CONTROLE: as aberturas somam os 150 blocos');
  const semQtd = [{ ...emDuas[0] }, { ...emDuas[1], quantidade: null }, ...aberturasQ.slice(1)];
  const b = dezDias({ ...dadosQ, aberturasPorLote: semQtd }).rankings.comparaveis.find((l) => l.chave === '2026-07-01|SH');
  assert.deepEqual([b.maturacao.primeira, b.maturacao.ultima], [62, 72]);
  quase(b.maturacao.media, (62 * 100 + 72 * 50) / 150, 'media com a estante inteira');
  const lotesSemQtd = lotesQ.map((e) => (e.id === 202 ? { ...e, data_abertura: '2026-10-01', blocos_abertos: null } : e));
  const c = dezDias({ ...dadosQ, lotes: lotesSemQtd, aberturasPorLote: [] }).rankings.comparaveis.find((l) => l.chave === '2026-07-01|SH');
  assert.deepEqual([c.maturacao.primeira, c.maturacao.ultima, c.maturacao.media], [62, 62, 62]);
  const sozinha = lotesQ.filter((e) => e.id !== 201).map((e) => (e.id === 202 ? { ...e, blocos_abertos: null } : e));
  const d = dezDias({ ...dadosQ, lotes: sozinha, aberturasPorLote: [] }).rankings.comparaveis.find((l) => l.chave === '2026-07-01|SH');
  assert.ok(d, 'o lote só com a estante sem quantidade segue nos comparáveis');
  assert.deepEqual(d.maturacao, { primeira: 72, ultima: 72, media: 72 });
});
caso('comparaveis no mes: os lotes dos rankings e os da queda, um por chave; o Shimeji compara pelo kg por bloco, sem %', () => {
  assert.deepEqual(rk.comparaveis.map((l) => l.chave).sort(), ['2026-06-01|SH', '2026-06-10|SH', '2026-06-20|SH', '2026-07-01|SB']);
  const sb = rk.comparaveis.find((l) => l.chave === '2026-07-01|SB');
  assert.deepEqual([sb.kg_classificado, sb.pct_m_ou_maior, sb.kg_por_bloco_aberto, sb.receitas], [null, null, 0.15, []]);
  for (const l of rk.produtividade) {
    assert.equal(rk.comparaveis.find((c) => c.chave === l.chave).kg_por_bloco_aberto, l.kg_por_bloco_aberto, `${l.chave}: o mesmo do ranking`);
  }
});

caso('classe que nenhuma colheita anotou e null (o GG antes de existir o campo), a que anotou 0 e 0; o classificado soma as classes', () => {
  const semGG = colheitasQ.map((c) => (c.data_colheita >= '2026-10-07' ? { ...c, kg_gg: null } : c));
  const m = dezDias({ ...dadosQ, colheitas: semGG }).metricas;
  assert.deepEqual(CLASSES.map((k) => m[k].atual), [8, 6, 2, null, 16]);
  assert.equal(m.pct_gg.atual, null);
  assert.equal(m.pct_m_ou_maior.atual, 0.5, 'o M, G e GG nao muda');
  assert.equal(dezDias().metricas.kg_gg.atual, 0);
  const umGG = semGG.map((c) => (c.data_colheita === '2026-10-09' ? { ...c, kg_gg: 0.5 } : c));
  assert.equal(dezDias({ ...dadosQ, colheitas: umGG }).metricas.kg_gg.atual, 0.5);
  const dec = [{ lote_id: 201, data_colheita: '2026-10-08', total_kg: 0.6, kg_p: 0.1, kg_m: 0.2, kg_g: 0.1, kg_gg: 0.2 },
    { lote_id: 201, data_colheita: '2026-09-02', total_kg: 1, kg_p: 1, kg_m: 0, kg_g: 0, kg_gg: 0 }];
  const d = dezDias({ ...dadosQ, colheitas: dec }).metricas;
  assert.equal(0.1 + 0.2, 0.30000000000000004, 'CONTROLE: a soma crua nao fecha');
  assert.equal(d.kg_classificado.atual, 0.6);
  assert.equal(Math.round((d.kg_p.atual + d.kg_m.atual + d.kg_g.atual + d.kg_gg.atual) * 1000) / 1000, d.kg_classificado.atual);
});
caso('intervalos do grafico: ate 12 dias um por dia, ate 31 blocos de 10 (sobra de 1 ou 2 dias no anterior), acima um por mes', () => {
  assert.equal(intervalosDoGrafico({ inicio: '2026-10-07', fim: '2026-10-16' }).length, 10);
  assert.deepEqual(intervalosDoGrafico({ inicio: '2026-10-16', fim: '2026-10-16' }), [{ inicio: '2026-10-16', fim: '2026-10-16' }]);
  assert.deepEqual(intervalosDoGrafico({ inicio: '2026-09-17', fim: '2026-10-16' }),
    [{ inicio: '2026-09-17', fim: '2026-09-26' }, { inicio: '2026-09-27', fim: '2026-10-06' }, { inicio: '2026-10-07', fim: '2026-10-16' }]);
  assert.equal(intervalosDoGrafico({ inicio: '2026-10-01', fim: '2026-10-12' }).length, 12);
  assert.deepEqual(intervalosDoGrafico({ inicio: '2026-10-01', fim: '2026-10-13' }).map((w) => w.fim), ['2026-10-10', '2026-10-13']);
  assert.deepEqual(intervalosDoGrafico({ inicio: '2026-10-01', fim: '2026-10-22' }).map((w) => w.fim), ['2026-10-10', '2026-10-22']);
  assert.deepEqual(intervalosDoGrafico({ inicio: '2026-08-01', fim: '2026-08-31' }).at(-1), { inicio: '2026-08-21', fim: '2026-08-31' });
  assert.deepEqual(intervalosDoGrafico({ inicio: '2026-02-01', fim: '2026-02-28' }).at(-1), { inicio: '2026-02-21', fim: '2026-02-28' });
  assert.deepEqual(intervalosDoGrafico({ inicio: '2026-01-01', fim: '2026-03-05' }),
    [{ inicio: '2026-01-01', fim: '2026-01-31' }, { inicio: '2026-02-01', fim: '2026-02-28' }, { inicio: '2026-03-01', fim: '2026-03-05' }]);
});
caso('serie dos 10 dias: um ponto por dia, so o Shiitake; somados, os dias dao o kg e as classes do card', () => {
  const r = dezDias();
  const s = r.rankings.serie_da_qualidade;
  assert.equal(s.length, 10);
  const soma = (k) => Math.round(s.reduce((t, x) => t + x[k], 0) * 1000) / 1000;
  assert.deepEqual(CLASSES.map(soma), CLASSES.map((k) => r.metricas[k].atual));
  assert.equal(soma('kg_colhidos'), 16, 'os 25 kg do card menos os 9 do Shimeji');
  const dia10 = s.find((x) => x.inicio === '2026-10-10');
  assert.deepEqual([dia10.kg_colhidos, dia10.kg_p, dia10.kg_m, dia10.kg_g, dia10.kg_gg, dia10.pct_p], [10, 6, 3, 1, 0, 0.6]);
  const dia7 = s.find((x) => x.inicio === '2026-10-07');
  assert.deepEqual([dia7.kg_colhidos, dia7.kg_classificado, dia7.pct_p, dia7.pct_m_ou_maior], [0, 0, null, null]);
  assert.ok(s.every((x) => x.lotes_abertos === 0 && x.kg_por_bloco_aberto === null));
  assert.equal(dezDias(dadosQ, { tipo: 'SB' }).rankings.serie_da_qualidade, null);
  assert.deepEqual(dezDias(dadosQ, { tipo: 'SH' }).rankings.serie_da_qualidade, s);
});
caso('serie de setembro: blocos de 10 dias; o kg por bloco aberto e o das estantes abertas no bloco, com a colheita ate hoje', () => {
  const s = setembro(dadosQ).serie_da_qualidade;
  assert.deepEqual(s.map((x) => [x.inicio, x.fim]), [['2026-09-01', '2026-09-10'], ['2026-09-11', '2026-09-20'], ['2026-09-21', '2026-09-30']]);
  assert.deepEqual([s[0].lotes_abertos, s[0].blocos_abertos, s[0].kg_dos_abertos, s[0].kg_por_bloco_aberto, s[0].parciais], [1, 100, 16, 0.16, 0]);
  assert.deepEqual([s[1].lotes_abertos, s[1].blocos_abertos, s[1].kg_dos_abertos, s[1].parciais], [2, 150, 22, 1]);
  quase(s[1].kg_por_bloco_aberto, 22 / 150);
  assert.deepEqual([s[2].lotes_abertos, s[2].kg_por_bloco_aberto, s[0].kg_colhidos, s[1].kg_colhidos], [0, null, 2, 0]);
});
caso('serie do acumulado do ano: um ponto por mes; o mes que termina antes da primeira colheita lancada fica sem numero', () => {
  const s = dezDias(dadosQ, { periodo: 'ytd' }).rankings.serie_da_qualidade;
  assert.equal(s.length, 10);
  assert.deepEqual(s.at(-1), { ...s.at(-1), inicio: '2026-10-01', fim: '2026-10-16' });
  assert.ok(s.slice(0, 8).every((x) => x.kg_colhidos === null && x.kg_classificado === null && x.kg_por_bloco_aberto === null && x.lotes_abertos === null));
  assert.deepEqual([s[8].inicio, s[8].kg_colhidos, s[8].kg_classificado], ['2026-09-01', 2, 2]);
  assert.equal(dezDias(dadosQ, { periodo: 'lote', lote: '2026-07-01|SH' }).rankings, null, 'o lote especifico nao tem serie');
});

