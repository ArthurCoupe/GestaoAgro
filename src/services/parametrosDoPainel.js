import { PARAMETRO_ABERTURA_DIAS, TOLERANCIA_BLOCOS } from './painelDoCiclo.js';

export const PARAMETROS = {
  aberturaDias: PARAMETRO_ABERTURA_DIAS,
  horizonteDias: 7,
  toleranciaBlocos: TOLERANCIA_BLOCOS,
  coberturaAmareloDias: 30,
  coberturaVermelhoDias: 15,
  materiaPrimaVermelhoDias: 2,
  contaminacaoAmarelo: 0.10,
  contaminacaoVermelho: 0.20,
  contaminacaoDiasComparavel: 20,
  contaminacaoDiasEstavel: 35,
  contaminacaoFaixa1: 10,
  contaminacaoFaixa2: 15,
  contaminacaoFaixa3: 20,
  contaminacaoFaixa4: 30,
  contaminacaoSemanasComparacao: 4,
  contaminacaoMeta: 0.05,
  contaminacaoRondaPct: 0.25,
  embalagemToleranciaKg: 0.5,
  embalagemDiasParaFechar: 2,
};

Object.freeze(PARAMETROS);

export function semaforoDeAbertura(diasRestantes, p = PARAMETROS) {
  if (!Number.isFinite(diasRestantes)) return 'SEM_DADO';
  if (diasRestantes < 0) return 'VERMELHO';
  return diasRestantes <= p.horizonteDias ? 'AMARELO' : 'VERDE';
}

export function semaforoDeCobertura(dias, p = PARAMETROS) {
  if (!Number.isFinite(dias)) return 'SEM_DADO';
  if (dias <= p.coberturaVermelhoDias) return 'VERMELHO';
  return dias <= p.coberturaAmareloDias ? 'AMARELO' : 'VERDE';
}

export function semaforoDeContaminacao(pct, p = PARAMETROS) {
  if (!Number.isFinite(pct)) return 'SEM_DADO';
  if (pct >= p.contaminacaoVermelho) return 'VERMELHO';
  return pct >= p.contaminacaoAmarelo ? 'AMARELO' : 'VERDE';
}

export function parametrosComMetas(metas = {}, base = PARAMETROS) {
  const MAPA = {
    contaminacaoAmarelo: ['contaminacao_atencao_pct', 100],
    contaminacaoVermelho: ['contaminacao_critico_pct', 100],
    contaminacaoMeta: ['contaminacao_meta_pct', 100],
    contaminacaoDiasComparavel: ['contaminacao_dias_comparavel', 1],
    contaminacaoDiasEstavel: ['contaminacao_dias_estavel', 1],
    contaminacaoSemanasComparacao: ['contaminacao_semanas_comparacao', 1],
    contaminacaoRondaPct: ['contaminacao_ronda_pct', 100],
    contaminacaoFaixa1: ['contaminacao_faixa1_dias', 1],
    contaminacaoFaixa2: ['contaminacao_faixa2_dias', 1],
    contaminacaoFaixa3: ['contaminacao_faixa3_dias', 1],
    contaminacaoFaixa4: ['contaminacao_faixa4_dias', 1],
    embalagemToleranciaKg: ['embalagem_tolerancia_kg', 1],
    embalagemDiasParaFechar: ['embalagem_dias_para_fechar', 1],
  };
  const saida = { ...base, origens: {} };
  for (const [alvo, [chave, divisor]] of Object.entries(MAPA)) {
    const m = metas[chave];
    if (m && Number.isFinite(Number(m.valor))) saida[alvo] = Number(m.valor) / divisor;
    saida.origens[alvo] = m?.origem ?? 'PADRAO';
  }
  return saida;
}
