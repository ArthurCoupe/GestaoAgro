import { filaDeAbertura } from './previsaoDeAbertura.js';

const somaDias = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const dia = (d) => (d ? String(d).slice(0, 10) : null);

export const DIAS_DE_COLHEITA_DA_ESTANTE = 30;
export const aindaColhe = (d, hoje) => d != null && d > somaDias(hoje, -DIAS_DE_COLHEITA_DA_ESTANTE);

export function blocosNaFila(jornada, hoje) {
  const naFila = new Map();
  for (const l of filaDeAbertura(jornada, { hoje }).linhas) {
    naFila.set(l.lote_chave, (naFila.get(l.lote_chave) ?? 0) + Math.max(0, l.blocos_disponiveis ?? 0));
  }
  return naFila;
}

export function ultimasAberturas(jornada) {
  const ultima = new Map();
  for (const e of jornada.lotes ?? []) {
    const d = dia(e.data_abertura);
    const k = `${e.data_lote}|${e.tipo}`;
    if (d && !(ultima.get(k) >= d)) ultima.set(k, d);
  }
  return ultima;
}

export function etapaDoLote(jornada, hoje) {
  const naFila = blocosNaFila(jornada, hoje);
  const ultima = ultimasAberturas(jornada);
  return (chave) => {
    if (naFila.has(chave)) return 'EM_MATURACAO';
    return aindaColhe(ultima.get(chave) ?? null, hoje) ? 'COLHENDO' : null;
  };
}
