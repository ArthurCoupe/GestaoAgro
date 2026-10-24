const MARCAS = [
  [/REVENDA/i, 'REVENDA'],
  [/EXEMPLO/i, 'PRODUCAO'],
];

export function operacaoDaMarca(marca) {
  const m = String(marca ?? '').trim();
  if (!m) return null;
  return MARCAS.find(([re]) => re.test(m))?.[1] ?? null;
}
