import type { DreColuna } from '../api/client';

export const serieZerada = (dados: Array<number | null | undefined>) =>
  !dados.some((v) => v != null && v !== 0);

export function seriesInvisiveis(
  datasets: Array<{ label?: string; data: Array<number | null | undefined> }>,
): string[] {
  return datasets
    .filter((d) => serieZerada(d.data))
    .map((d) => d.label ?? '(sem rótulo)');
}

export const gastosTotais = (c: DreColuna) =>
  c.dre.custos_variaveis.total
  + (c.dre.custos_fixos?.total ?? 0)
  + c.dre.despesas_operacionais.total
  + (c.dre.outros?.total ?? 0);

export function componentesDeCusto(colunas: DreColuna[]) {
  const somas = new Map<string, number>();
  for (const c of colunas) {
    const d = c.dre;
    const linhas = [
      ...d.custos_variaveis.linhas,
      ...(d.custos_fixos?.linhas ?? []),
      ...d.despesas_operacionais.linhas,
      ...(d.outros?.linhas ?? []),
    ];
    for (const l of linhas) somas.set(l.categoria, (somas.get(l.categoria) ?? 0) + l.valor);
  }
  const itens = [...somas.entries()]
    .filter(([, valor]) => valor !== 0)
    .map(([nome, valor]) => ({ nome, valor }))
    .sort((a, b) => b.valor - a.valor);
  const total = itens.reduce((s, i) => s + i.valor, 0);
  return {
    itens: itens.map((i) => ({ ...i, participacao: total > 0 ? (i.valor / total) * 100 : null })),
    total,
  };
}
