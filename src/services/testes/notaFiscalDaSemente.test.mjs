import assert from 'node:assert/strict';
import { notasDaNf, chaveDeNf } from '../notaFiscalDaSemente.js';
import { caso } from './caso.mjs';

caso('o caso simples', () => {
  assert.deepEqual(notasDaNf('CP10 - 20190'), ['20190']);
});

caso('o ponto de milhar nao esconde a nota', () => {
  assert.deepEqual(notasDaNf('20.120'), ['20120']);
  assert.deepEqual(notasDaNf('CP10/ 20.140'), ['20140']);
});

caso('duas notas no mesmo campo viram duas', () => {
  assert.deepEqual(notasDaNf('CP120 SP/JP – 20155 CP120 SP/JP - 20190'), ['20155', '20190']);
});

caso('grafia sem numero nenhum devolve lista vazia, e nao inventa nota', () => {
  assert.deepEqual(notasDaNf('FRA - LOTE 318'), []);
  assert.deepEqual(notasDaNf('FRA'), []);
  assert.deepEqual(notasDaNf('FR'), []);
});

caso('nulo, vazio e so-espaco devolvem lista vazia', () => {
  assert.deepEqual(notasDaNf(null), []);
  assert.deepEqual(notasDaNf(undefined), []);
  assert.deepEqual(notasDaNf(''), []);
  assert.deepEqual(notasDaNf('   '), []);
});

caso('codigo de cepa com 2 ou 3 digitos NAO vira nota', () => {
  assert.deepEqual(notasDaNf('CP10'), []);
  assert.deepEqual(notasDaNf('CP 140 FR'), []);
  assert.deepEqual(notasDaNf('CP 050 FRA'), []);
});

caso('a mesma nota escrita duas vezes vira uma', () => {
  assert.deepEqual(notasDaNf('CP10-20170 FRA-20170'), ['20170']);
});

caso('a ordem e a mesma independente de como foi digitado', () => {
  assert.deepEqual(notasDaNf('FR - 20190 FR - 20155'), ['20155', '20190']);
  assert.deepEqual(notasDaNf('FR - 20155 FR - 20190'), ['20155', '20190']);
});

caso('sequencia de 6 digitos e RECUSADA inteira, nao truncada', () => {
  assert.deepEqual(notasDaNf('NF 123456'), []);
  assert.deepEqual(notasDaNf('lote 202608'), []);
});

caso('CONTROLE: nota de 5 digitos isolada continua virando nota', () => {
  assert.deepEqual(notasDaNf('NF 20233'), ['20233']);
});

caso('LIMITE CONHECIDO: o ano depois da barra tambem vira nota, de proposito', () => {
  assert.deepEqual(notasDaNf('CP10 - 20233/2026'), ['2026', '20233']);
});

caso('tamanhos mistos ordenam por VALOR, nao por string', () => {
  assert.deepEqual(notasDaNf('20155 e 9999'), ['9999', '20155']);
});

caso('a chave junta as notas com +', () => {
  assert.equal(chaveDeNf('CP120 SP/JP – 20155 CP120 SP/JP - 20190'), '20155+20190');
});

caso('duas grafias da mesma nota dao a MESMA chave', () => {
  assert.equal(chaveDeNf('CP10 - 20190'), chaveDeNf('SH - FRA - 20190'));
  assert.equal(chaveDeNf('CP10 - 20190'), '20190');
});

caso('CONTROLE: notas diferentes dao chaves diferentes', () => {
  assert.notEqual(chaveDeNf('CP10 - 20190'), chaveDeNf('CP10 - 20155'));
});

caso('sem nota, a chave e null e nunca string vazia', () => {
  assert.equal(chaveDeNf('FRA'), null);
  assert.equal(chaveDeNf(null), null);
});

caso('a nota de 4 digitos atravessa como esta, sem conserto por palpite', () => {
  assert.deepEqual(notasDaNf('20.14'), ['2014']);
});
