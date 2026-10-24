import assert from 'node:assert/strict';
import { diasDoPeriodo, ocupacaoNoPeriodo } from '../ocupacaoDasEstantes.js';
import { caso } from './caso.mjs';

const linha = (over) => ({
  id: 1, data_lote: '2026-09-01', blocos_produzidos: 100, blocos_abertos: 0, data_abertura: null,
  zerou_estante: null, status: 'ATIVO', data_encerramento: null, lote_pesquisa: null, ...over,
});
const oc = (dados, inicio, fim) => ocupacaoNoPeriodo(dados, { inicio, fim }).porLinha.get(1);

caso('diasDoPeriodo e inclusivo nas duas pontas', () => {
  assert.deepEqual(diasDoPeriodo('2026-09-01', '2026-09-03'), ['2026-09-01', '2026-09-02', '2026-09-03']);
  assert.deepEqual(diasDoPeriodo('2026-09-03', '2026-09-03'), ['2026-09-03']);
});

caso('estante cheia o periodo todo: 100 blocos x 10 dias = 1.000 blocos-dia', () => {
  const r = oc({ lotes: [linha()] }, '2026-09-11', '2026-09-20');
  assert.equal(r.bloco_dias, 1000);
  assert.equal(r.incompleto, false);
});

caso('1.000 blocos que entram em 26/09 contam so os 3 dias finais dos 30 (26, 27 e 28/09)', () => {
  const r = ocupacaoNoPeriodo({ lotes: [linha({ data_lote: '2026-09-26', blocos_produzidos: 1000 })] },
    { inicio: '2026-08-30', fim: '2026-09-28' });
  assert.equal(r.dias, 30);
  assert.equal(r.porLinha.get(1).bloco_dias, 3000);
});

caso('antes da producao a estante nao conta', () => {
  assert.equal(oc({ lotes: [linha({ data_lote: '2026-09-15' })] }, '2026-09-11', '2026-09-20').bloco_dias, 600);
});

caso('contaminacao e perda saem no dia do evento, e o evento anterior ao periodo ja saiu', () => {
  const dados = {
    lotes: [linha()],
    eventos: [
      { lote_id: 1, tipo: 'CONTAMINACAO', quantidade: 10, data_evento: '2026-09-05' },
      { lote_id: 1, tipo: 'PERDA', quantidade: 20, data_evento: '2026-09-16' },
    ],
  };
  assert.equal(oc(dados, '2026-09-11', '2026-09-20').bloco_dias, 800);
});

caso('abertura datada tira no dia dela; zerou_estante zera a partir da ultima abertura', () => {
  const dados = {
    lotes: [linha({ zerou_estante: true, blocos_abertos: 100 })],
    aberturasPorLote: [
      { lote_id: 1, data: '2026-09-13', quantidade: 40 },
      { lote_id: 1, data: '2026-09-16', quantidade: 60 },
    ],
  };
  assert.equal(oc(dados, '2026-09-11', '2026-09-20').bloco_dias, 200 + 180);
});

caso('sem abertura datada, blocos_abertos saem todos na data_abertura (a data unica da porta antiga)', () => {
  const dados = { lotes: [linha({ blocos_abertos: 30, data_abertura: '2026-09-16' })] };
  assert.equal(oc(dados, '2026-09-11', '2026-09-20').bloco_dias, 500 + 350);
});

caso('CONTROLE: com abertura datada, a data_abertura da linha NAO desconta de novo', () => {
  const dados = {
    lotes: [linha({ blocos_abertos: 30, data_abertura: '2026-09-12' })],
    aberturasPorLote: [{ lote_id: 1, data: '2026-09-16', quantidade: 30 }],
  };
  assert.equal(oc(dados, '2026-09-11', '2026-09-20').bloco_dias, 500 + 350);
});

caso('encerrado sai no dia do encerramento; encerrado sem data nao ocupa', () => {
  assert.equal(oc({ lotes: [linha({ status: 'ENCERRADO', data_encerramento: '2026-09-14' })] },
    '2026-09-11', '2026-09-20').bloco_dias, 300);
  assert.equal(oc({ lotes: [linha({ status: 'ENCERRADO' })] }, '2026-09-11', '2026-09-20').bloco_dias, 0);
});

caso('saldo negativo conta zero e marca a linha', () => {
  const dados = { lotes: [linha()], eventos: [{ lote_id: 1, tipo: 'CONTAMINACAO', quantidade: 130, data_evento: '2026-09-15' }] };
  const r = oc(dados, '2026-09-11', '2026-09-20');
  assert.equal(r.bloco_dias, 400);
  assert.equal(r.saldo_negativo, true);
  assert.equal(oc({ lotes: [linha()] }, '2026-09-11', '2026-09-20').saldo_negativo, false);
});

caso('lote de pesquisa, linha produzida depois do fim e linha fora do escopo nao entram', () => {
  const r = ocupacaoNoPeriodo({
    lotes: [linha({ lote_pesquisa: true }), linha({ id: 2, data_lote: '2026-09-25' }), linha({ id: 3 })],
  }, { inicio: '2026-09-11', fim: '2026-09-20', idsNoEscopo: new Set([1, 2]) });
  assert.equal(r.porLinha.has(1), false);
  assert.equal(r.porLinha.has(2), false);
  assert.equal(r.porLinha.has(3), false);
});

caso('DESCARTE e outros tipos nao descontam (so CONTAMINACAO e PERDA)', () => {
  const dados = { lotes: [linha()], eventos: [{ lote_id: 1, tipo: 'DESCARTE', quantidade: 50, data_evento: '2026-09-01' }] };
  assert.equal(oc(dados, '2026-09-11', '2026-09-20').bloco_dias, 1000);
});

caso('(a) zerou_estante sem NENHUMA abertura datada (nem aberturasPorLote, nem data_abertura/blocos_abertos): a flag nunca surte efeito -- incompleto', () => {
  const r = oc({ lotes: [linha({ zerou_estante: true, blocos_abertos: 0, data_abertura: null })] }, '2026-09-11', '2026-09-20');
  assert.equal(r.bloco_dias, 1000);
  assert.equal(r.incompleto, true);
});

caso('(b) abertura datada com quantidade ausente: a soma conta 0, o RESTO sai em data_abertura -- incompleto', () => {
  const dados = {
    lotes: [linha({ blocos_abertos: 30, data_abertura: '2026-09-12' })],
    aberturasPorLote: [{ lote_id: 1, data: '2026-09-13', quantidade: null }],
  };
  const r = oc(dados, '2026-09-11', '2026-09-20');
  assert.equal(r.bloco_dias, 100 + 9 * 70);
  assert.equal(r.incompleto, true);
});

caso('(c) blocos_abertos > 0 sem NENHUMA data (nem aberturasPorLote datada, nem data_abertura): os blocos nunca saem -- incompleto', () => {
  const r = oc({ lotes: [linha({ blocos_abertos: 40, data_abertura: null })] }, '2026-09-11', '2026-09-20');
  assert.equal(r.bloco_dias, 1000);
  assert.equal(r.incompleto, true);
});

caso('ENCERRADO com encerramento antes do periodo, zerou_estante sem abertura: bloco_dias 0 -- incompleto FALSE (linha nao ocupa)', () => {
  const r = oc({
    lotes: [linha({
      status: 'ENCERRADO', data_encerramento: '2026-09-05',
      zerou_estante: true, blocos_abertos: 0, data_abertura: null,
    })],
  }, '2026-09-11', '2026-09-20');
  assert.equal(r.bloco_dias, 0);
  assert.equal(r.incompleto, false);
});

caso('COM abertura antiga e nova: o RESTO sai na data_abertura, mas a data e palpite -- incompleto', () => {
  const dados = {
    lotes: [linha({ blocos_produzidos: 200, blocos_abertos: 150, data_abertura: '2026-09-05' })],
    aberturasPorLote: [{ lote_id: 1, data: '2026-09-16', quantidade: 50 }],
  };
  const r = oc(dados, '2026-09-11', '2026-09-20');
  assert.equal(r.bloco_dias, 750);
  assert.equal(r.incompleto, true);
});

caso('CONTROLE: soma das datadas igual a blocos_abertos nao muda nada (resto zero)', () => {
  const dados = {
    lotes: [linha({ blocos_produzidos: 200, blocos_abertos: 100, data_abertura: '2026-09-05' })],
    aberturasPorLote: [{ lote_id: 1, data: '2026-09-16', quantidade: 100 }],
  };
  const r = oc(dados, '2026-09-11', '2026-09-20');
  assert.equal(r.bloco_dias, 1000 + 500);
  assert.equal(r.incompleto, false);
});

caso('RESTO positivo sem data_abertura marca incompleto, e o resto nao desconta', () => {
  const dados = {
    lotes: [linha({ blocos_produzidos: 200, blocos_abertos: 150, data_abertura: null })],
    aberturasPorLote: [{ lote_id: 1, data: '2026-09-16', quantidade: 50 }],
  };
  const r = oc(dados, '2026-09-11', '2026-09-20');
  assert.equal(r.bloco_dias, 1000 + 750);
  assert.equal(r.incompleto, true);
});

caso('zerou_estante corta em ultimaAbertura = data do RESTO (16/09), nao na abertura datada (13/09)', () => {
  const dados = {
    lotes: [linha({
      blocos_produzidos: 200, blocos_abertos: 150, data_abertura: '2026-09-16', zerou_estante: true,
    })],
    aberturasPorLote: [{ lote_id: 1, data: '2026-09-13', quantidade: 50 }],
  };
  const r = oc(dados, '2026-09-11', '2026-09-20');
  assert.equal(r.bloco_dias, 850);
});

caso('CONTROLE: mesmo caso SEM zerou_estante -- nada corta, o resto so desconta a partir de 16/09', () => {
  const dados = {
    lotes: [linha({
      blocos_produzidos: 200, blocos_abertos: 150, data_abertura: '2026-09-16', zerou_estante: false,
    })],
    aberturasPorLote: [{ lote_id: 1, data: '2026-09-13', quantidade: 50 }],
  };
  const r = oc(dados, '2026-09-11', '2026-09-20');
  assert.equal(r.bloco_dias, 1100);
});

