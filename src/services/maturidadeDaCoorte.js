import { PARAMETROS } from './parametrosDoPainel.js';

const DIA = 86400000;

const CURVA = [[10, 0.235], [15, 0.345], [20, 0.570], [30, 0.799], [35, 0.908], [45, 0.887]];

export const MATURIDADE = Object.freeze({ MADURO: 'MADURO', EM_OBSERVACAO: 'EM_OBSERVACAO', SEM_DATA: 'SEM_DATA' });

export const diasEntre = (de, ate) => {
  const a = Date.parse(`${de}T00:00:00Z`);
  const b = Date.parse(`${ate}T00:00:00Z`);
  return (Number.isFinite(a) && Number.isFinite(b)) ? Math.round((b - a) / DIA) : null;
};

export function fracaoEsperada(dias) {
  if (dias == null || dias < 0) return null;
  let f = 0;
  for (const [d, valor] of CURVA) if (dias >= d) f = valor;
  return dias >= 35 ? 0.908 : (f || null);
}

export function maturidadeDoLote(dataLote, hoje, p = PARAMETROS) {
  if (!dataLote || !hoje) return { dias: null, estado: MATURIDADE.SEM_DATA, fracao_esperada: null };
  const dias = diasEntre(dataLote, hoje);
  if (dias == null) return { dias: null, estado: MATURIDADE.SEM_DATA, fracao_esperada: null };
  return {
    dias,
    estado: dias >= p.contaminacaoDiasComparavel ? MATURIDADE.MADURO : MATURIDADE.EM_OBSERVACAO,
    fracao_esperada: fracaoEsperada(dias),
  };
}
