import assert from 'node:assert/strict';
import { contaminacaoDoLocal } from '../contaminacaoDoLocal.js';
import { caso } from './caso.mjs';

const linha = (over) => ({
  id: 1, data_lote: '2026-09-01', tipo: 'SH', galpao: 'M3', estante_maturacao: '4', blocos_produzidos: 100,
  blocos_abertos: 0, data_abertura: null, zerou_estante: null, status: 'ATIVO', data_encerramento: null,
  lote_pesquisa: null, ...over,
});
const cont = (lote_id, quantidade, data_evento) => ({ lote_id, tipo: 'CONTAMINACAO', quantidade, data_evento });
const P = { inicio: '2026-09-11', fim: '2026-09-20' };

caso('o exemplo da regra: 50 em 500 contra 50 em 2.000 nao sao equivalentes', () => {
  const r = contaminacaoDoLocal({
    lotes: [linha({ id: 1, estante_maturacao: '1', blocos_produzidos: 550 }), linha({ id: 2, estante_maturacao: '2', blocos_produzidos: 2050 })],
    eventos: [cont(1, 50, '2026-09-10'), cont(2, 50, '2026-09-10')],
  }, P);
  const e1 = r.galpoes[0].estantes.find((e) => e.estante === '1');
  assert.equal(e1.ocupacao_media, 500);
  const r2 = contaminacaoDoLocal({
    lotes: [linha({ id: 1, estante_maturacao: '1', blocos_produzidos: 500 }), linha({ id: 2, estante_maturacao: '2', blocos_produzidos: 2000 })],
    eventos: [cont(1, 50, '2026-09-20'), cont(2, 50, '2026-09-20')],
  }, P);
  const [a, b] = r2.galpoes[0].estantes;
  assert.equal(a.estante, '1');
  assert.equal(a.contaminados, 50);
  assert.equal(b.contaminados, 50);
  assert.ok(a.taxa > b.taxa * 3.5, `taxas ${a.taxa} e ${b.taxa}`);
});

caso('o numero exato: 20 contaminados sobre 100 blocos parados 10 dias = 20%', () => {
  const r = contaminacaoDoLocal({ lotes: [linha()], eventos: [cont(1, 20, '2026-09-20')] }, P);
  const e = r.galpoes[0].estantes[0];
  assert.equal(e.bloco_dias, 980);
  assert.equal(e.contaminados, 20);
  assert.equal(e.ocupacao_media, (900 + 80) / 10);
  assert.equal(e.taxa, 20 / 98);
});

caso('TODO TOTAL SE REFAZ: estantes somam o galpao, galpoes somam o TOTAL', () => {
  const r = contaminacaoDoLocal({
    lotes: [linha({ id: 1 }), linha({ id: 2, estante_maturacao: '5' }), linha({ id: 3, galpao: 'A', estante_maturacao: '9' })],
    eventos: [cont(1, 7, '2026-09-12'), cont(2, 3, '2026-09-13'), cont(3, 11, '2026-09-14')],
  }, P);
  for (const g of r.galpoes) {
    assert.equal(g.contaminados, g.estantes.reduce((s, e) => s + e.contaminados, 0));
    assert.equal(g.bloco_dias, g.estantes.reduce((s, e) => s + e.bloco_dias, 0));
  }
  assert.equal(r.total.contaminados, 21);
  assert.equal(r.total.contaminados, r.galpoes.reduce((s, g) => s + g.contaminados, 0));
  assert.equal(r.total.bloco_dias, r.galpoes.reduce((s, g) => s + g.bloco_dias, 0));
});

caso('so CONTAMINACAO dentro do periodo conta; PERDA desconta ocupacao mas nao e contaminado', () => {
  const r = contaminacaoDoLocal({
    lotes: [linha()],
    eventos: [cont(1, 5, '2026-09-10'), cont(1, 4, '2026-09-21'), { lote_id: 1, tipo: 'PERDA', quantidade: 30, data_evento: '2026-09-15' }, cont(1, 2, '2026-09-11')],
  }, P);
  assert.equal(r.total.contaminados, 2);
});

caso('estante sem ocupacao no periodo com contaminado lancado: taxa null e vai para o fim', () => {
  const r = contaminacaoDoLocal({
    lotes: [linha({ id: 1, status: 'ENCERRADO', data_encerramento: '2026-09-05' }), linha({ id: 2, estante_maturacao: '5' })],
    eventos: [cont(1, 8, '2026-09-12'), cont(2, 1, '2026-09-12')],
  }, P);
  const est = r.galpoes[0].estantes;
  assert.equal(est[est.length - 1].estante, '4');
  assert.equal(est[est.length - 1].taxa, null);
  assert.equal(r.galpoes[0].contaminados, 9);
});

caso('divergencia marca a estante e o galpao; CONTROLE: sem a marca, false', () => {
  const dados = { lotes: [linha({ id: 1 }), linha({ id: 2, estante_maturacao: '5' })], eventos: [] };
  const r = contaminacaoDoLocal(dados, { ...P, comDivergencia: new Set([2]) });
  assert.equal(r.galpoes[0].estantes.find((e) => e.estante === '5').divergencia, true);
  assert.equal(r.galpoes[0].estantes.find((e) => e.estante === '4').divergencia, false);
  assert.equal(r.galpoes[0].divergencia, true);
});

caso('saldo negativo da reconstrucao tambem marca divergencia', () => {
  const r = contaminacaoDoLocal({ lotes: [linha()], eventos: [cont(1, 130, '2026-09-12')] }, P);
  assert.equal(r.galpoes[0].estantes[0].divergencia, true);
});

caso('linha com ocupacao incompleta tambem marca divergencia', () => {
  const r = contaminacaoDoLocal({
    lotes: [linha({ id: 1, zerou_estante: true }), linha({ id: 2, estante_maturacao: '5' })],
    eventos: [],
  }, P);
  const incompleta = r.galpoes[0].estantes.find((e) => e.estante === '4');
  const normal = r.galpoes[0].estantes.find((e) => e.estante === '5');
  assert.ok(incompleta.bloco_dias > 0, `bloco_dias ${incompleta.bloco_dias}`);
  assert.equal(incompleta.contaminados, 0);
  assert.equal(incompleta.divergencia, true);
  assert.equal(normal.divergencia, false);
});

caso('filtro por especie: idsNoEscopo recorta ocupacao e contaminados', () => {
  const r = contaminacaoDoLocal({
    lotes: [linha({ id: 1 }), linha({ id: 2, tipo: 'SP', estante_maturacao: '5' })],
    eventos: [cont(1, 3, '2026-09-12'), cont(2, 9, '2026-09-12')],
  }, { ...P, idsNoEscopo: new Set([1]) });
  assert.equal(r.total.contaminados, 3);
  assert.equal(r.galpoes[0].estantes.length, 1);
});

caso('lista de estantes na linha e UMA estante na chave, e a estante fisica viaja', () => {
  const r = contaminacaoDoLocal({ lotes: [linha({ estante_maturacao: '7,8,9' })], eventos: [cont(1, 3, '2026-09-12')] },
    { ...P, fisicaPorLote: new Map([[1, 'B-07']]) });
  assert.equal(r.galpoes[0].estantes.length, 1);
  assert.equal(r.galpoes[0].estantes[0].estante, '7,8,9');
  assert.equal(r.galpoes[0].estantes[0].estante_fisica, 'B-07');
});

caso('lotes do periodo: maior quantidade primeiro, com a taxa do lote ao lado, e so os que contaminaram', () => {
  const r = contaminacaoDoLocal({
    lotes: [linha({ id: 1 }), linha({ id: 2, data_lote: '2026-09-02', estante_maturacao: '5' }), linha({ id: 3, data_lote: '2026-09-03', estante_maturacao: '6' })],
    eventos: [cont(1, 3, '2026-09-12'), cont(2, 9, '2026-09-12')],
  }, { ...P, taxaDoLotePorChave: new Map([['2026-09-01|SH', 0.12], ['2026-09-02|SH', 0.3]]) });
  assert.deepEqual(r.lotes.map((l) => [l.chave, l.contaminados, l.taxa_do_lote]),
    [['2026-09-02|SH', 9, 0.3], ['2026-09-01|SH', 3, 0.12]]);
});

caso('lote de pesquisa nao entra nem nos contaminados', () => {
  const r = contaminacaoDoLocal({ lotes: [linha({ lote_pesquisa: true })], eventos: [cont(1, 5, '2026-09-12')] }, P);
  assert.equal(r.total.contaminados, 0);
  assert.equal(r.pesquisa.contaminados, 5);
  assert.equal(r.pesquisa.eventos, 1);
});

caso('pesquisa soma CONTAMINACAO no periodo de todas as linhas de pesquisa, fora do total', () => {
  const r = contaminacaoDoLocal({
    lotes: [
      linha({ id: 1, lote_pesquisa: true }),
      linha({ id: 2, estante_maturacao: '5', lote_pesquisa: true }),
      linha({ id: 3, estante_maturacao: '6' }),
    ],
    eventos: [cont(1, 5, '2026-09-12'), cont(2, 8, '2026-09-15'), cont(3, 3, '2026-09-13')],
  }, P);
  assert.equal(r.pesquisa.contaminados, 13);
  assert.equal(r.pesquisa.eventos, 2);
  assert.equal(r.total.contaminados, 3);
  assert.equal(r.sem_lote.contaminados, 0);
  assert.equal(r.sem_lote.eventos, 0);
});

caso('ultimo_lancamento e a ultima retirada por contaminacao dentro do periodo', () => {
  const r = contaminacaoDoLocal({ lotes: [linha()], eventos: [cont(1, 1, '2026-09-12'), cont(1, 1, '2026-09-18')] }, P);
  assert.equal(r.ultimo_lancamento, '2026-09-18');
});

caso('sem_lote: lote_id null e lote_id 999 desconhecido entram em sem_lote, fora do total', () => {
  const r = contaminacaoDoLocal({
    lotes: [linha({ id: 1 })],
    eventos: [cont(null, 4, '2026-09-12'), cont(999, 6, '2026-09-13'), cont(1, 2, '2026-09-14')],
  }, P);
  assert.equal(r.sem_lote.contaminados, 10);
  assert.equal(r.sem_lote.eventos, 2);
  assert.equal(r.total.contaminados, 2);
});

caso('CONTROLE sem_lote: evento fora do periodo nao conta', () => {
  const r = contaminacaoDoLocal({ lotes: [], eventos: [cont(null, 5, '2026-09-05')] }, P);
  assert.equal(r.sem_lote.contaminados, 0);
  assert.equal(r.sem_lote.eventos, 0);
});

caso('evento de lote_pesquisa nao e sem_lote (lote conhecido, so fora do total)', () => {
  const r = contaminacaoDoLocal({ lotes: [linha({ id: 1, lote_pesquisa: true })], eventos: [cont(1, 5, '2026-09-12')] }, P);
  assert.equal(r.sem_lote.contaminados, 0);
  assert.equal(r.sem_lote.eventos, 0);
  assert.equal(r.total.contaminados, 0);
  assert.equal(r.pesquisa.contaminados, 5);
});

caso('sem_lote nao respeita idsNoEscopo: nao tem especie', () => {
  const r = contaminacaoDoLocal({
    lotes: [linha({ id: 1 })],
    eventos: [cont(null, 7, '2026-09-12'), cont(1, 3, '2026-09-12')],
  }, { ...P, idsNoEscopo: new Set([999]) });
  assert.equal(r.total.contaminados, 0);
  assert.equal(r.sem_lote.contaminados, 7);
});

caso('lote sem ocupacao no periodo (data_lote depois do fim) mas com contaminado: soma no galpao, taxa null', () => {
  const r = contaminacaoDoLocal({
    lotes: [linha({ id: 1, data_lote: '2026-09-25' })],
    eventos: [cont(1, 4, '2026-09-12')],
  }, P);
  const e = r.galpoes[0].estantes[0];
  assert.equal(e.contaminados, 4);
  assert.equal(e.bloco_dias, 0);
  assert.equal(e.taxa, null);
  assert.equal(r.galpoes[0].contaminados, 4);
});
