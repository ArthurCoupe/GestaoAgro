import assert from 'node:assert/strict';
import { it } from 'vitest';

export function caso(nome, fn) {
  let resultado;
  try { resultado = Promise.resolve(fn()); } catch (e) { resultado = Promise.reject(e); }
  resultado.catch(() => {});
  it(nome, () => resultado);
}

export function registrar(nome, passou, detalhe) {
  caso(nome, () => assert.ok(passou, detalhe || nome));
}
