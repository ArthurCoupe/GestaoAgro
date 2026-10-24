import assert from 'node:assert/strict';
import {
  PARAMETROS, semaforoDeAbertura, semaforoDeCobertura, semaforoDeContaminacao,
} from '../parametrosDoPainel.js';
import { PARAMETRO_ABERTURA_DIAS, TOLERANCIA_BLOCOS } from '../painelDoCiclo.js';
import { caso } from './caso.mjs';

caso('os dias de abertura sao os do painelDoCiclo, nao uma copia', () => {
  assert.equal(PARAMETROS.aberturaDias, PARAMETRO_ABERTURA_DIAS);
});

caso('a tolerancia de contagem e a do painelDoCiclo, e vale 10', () => {
  assert.equal(PARAMETROS.toleranciaBlocos, TOLERANCIA_BLOCOS);
  assert.equal(PARAMETROS.toleranciaBlocos, 10);
});

caso('o horizonte de amarelo e 7 dias, como a fila ja usa', () => {
  assert.equal(PARAMETROS.horizonteDias, 7);
});

caso('vencido (dias negativos) e vermelho', () => {
  assert.equal(semaforoDeAbertura(-1, PARAMETROS), 'VERMELHO');
  assert.equal(semaforoDeAbertura(-45, PARAMETROS), 'VERMELHO');
});

caso('o dia do vencimento ainda e amarelo, como a fila classifica', () => {
  assert.equal(semaforoDeAbertura(0, PARAMETROS), 'AMARELO');
});

caso('dentro do horizonte e amarelo, fora e verde', () => {
  assert.equal(semaforoDeAbertura(7, PARAMETROS), 'AMARELO');
  assert.equal(semaforoDeAbertura(8, PARAMETROS), 'VERDE');
});

caso('sem dias restantes nao inventa cor', () => {
  assert.equal(semaforoDeAbertura(null, PARAMETROS), 'SEM_DADO');
});

caso('cobertura: 15 dias ou menos e vermelho, ate 30 amarelo', () => {
  assert.equal(semaforoDeCobertura(15, PARAMETROS), 'VERMELHO');
  assert.equal(semaforoDeCobertura(16, PARAMETROS), 'AMARELO');
  assert.equal(semaforoDeCobertura(31, PARAMETROS), 'VERDE');
  assert.equal(semaforoDeCobertura(null, PARAMETROS), 'SEM_DADO');
});

caso('contaminacao usa percentual, nao quantidade absoluta', () => {
  assert.equal(semaforoDeContaminacao(0.05, PARAMETROS), 'VERDE');
  assert.equal(semaforoDeContaminacao(0.12, PARAMETROS), 'AMARELO');
  assert.equal(semaforoDeContaminacao(0.25, PARAMETROS), 'VERMELHO');
  assert.equal(semaforoDeContaminacao(null, PARAMETROS), 'SEM_DADO');
});

caso('NaN e Infinity sao tratados como SEM_DADO, nao como VERDE', () => {
  assert.equal(semaforoDeAbertura(NaN, PARAMETROS), 'SEM_DADO');
  assert.equal(semaforoDeAbertura(Infinity, PARAMETROS), 'SEM_DADO');
  assert.equal(semaforoDeCobertura(NaN, PARAMETROS), 'SEM_DADO');
  assert.equal(semaforoDeCobertura(Infinity, PARAMETROS), 'SEM_DADO');
  assert.equal(semaforoDeContaminacao(NaN, PARAMETROS), 'SEM_DADO');
  assert.equal(semaforoDeContaminacao(Infinity, PARAMETROS), 'SEM_DADO');
});

caso('PARAMETROS esta congelado e nao pode ser mutado', () => {
  assert.throws(() => {
    PARAMETROS.horizonteDias = 99;
  }, TypeError);
});
