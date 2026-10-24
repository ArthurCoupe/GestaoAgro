export const MESES_ANO = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

export const FUSO_EMPRESA = 'America/Sao_Paulo';

export const hojeISO = (agora: Date = new Date()) => new Intl.DateTimeFormat('en-CA', {
  timeZone: FUSO_EMPRESA, year: 'numeric', month: '2-digit', day: '2-digit',
}).format(agora);

export function ultimoMesComDado(xs: Array<number | null> | undefined | null): number | null {
  if (!xs) return null;
  for (let i = xs.length - 1; i >= 0; i -= 1) {
    if (xs[i] != null) return i + 1;
  }
  return null;
}

export const dataBr = (iso: string | null | undefined) =>
  iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('pt-BR') : '';
