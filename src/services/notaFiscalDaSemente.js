const semPontoDeMilhar = (texto) => String(texto ?? '').replace(/(\d)\.(\d)/g, '$1$2');

export function notasDaNf(texto) {
  const achadas = semPontoDeMilhar(texto).match(/(?<!\d)\d{4,5}(?!\d)/g) ?? [];
  return [...new Set(achadas)].sort((a, b) => Number(a) - Number(b));
}

export function chaveDeNf(texto) {
  const notas = notasDaNf(texto);
  return notas.length ? notas.join('+') : null;
}
