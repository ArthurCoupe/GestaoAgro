/**
 * @template T
 * @param {T[]} linhas
 * @param {string} mostrar
 * @returns {T[]}
 */
export function filtrarPorHorizonte(linhas, mostrar) {
  if (mostrar === 'tudo') return linhas;
  if (mostrar === 'vencidos') return linhas.filter((l) => l.situacao === 'VENCIDO');
  const dias = Number(mostrar);
  return linhas.filter((l) => l.situacao === 'VENCIDO'
    || (l.dias_restantes != null && l.dias_restantes >= 0 && l.dias_restantes <= dias));
}
