import { useState, type ReactNode } from 'react';
import { brl, num, pct, variacaoEmPontos } from '../api/client';
import { rotuloDoMes } from '../api/alertas';
import { dataBr } from '../api/constantes';
import {
  ROTULO_DA_VARIEDADE, type AtualizacaoDosIndicadores, type ExecutivoResposta, type ExecutivoSerieMensal, type FaixasDoShiitake,
  type IndicadoresDaProducaoResposta, type IndicadoresDoMes, type LoteDaAbertura, type LoteDeOrigem, type OrigemDoMes, type ParteDoRendimento, type SituacaoDoLoteDeOrigem,
  type VendaPorEspecie, type Variedade, type VolumesDoMes,
} from '../api/gerencial';
import type { FrenteDaGestao } from '../pages/GestaoDoResultado';
import { divisaoDaReceitaPorEspecie } from './EscadaDoAno';
import { pontosPercentuais } from './gestao/ResumoDaMeta';
import { useNav } from './ui';
import { Atualizacao, mesAnterior, mesmosMeses, reais, textoDaAtualizacao, variacaoPct } from './ResultadoSemFolha';

export type Recorte = 'TOTAL' | Variedade;
type Formato = 'unitario' | 'reais' | 'num' | 'kg' | 'kg3' | 'pct';
export interface LinhaDoIndicador {
  rotulo: string; formato: Formato; sobeEMelhor: boolean | null; valores: Array<number | null>; soNaInvestigacao?: boolean;
  parciais?: boolean[]; secao?: SecaoDaEficiencia;
}
export type SecaoDaEficiencia = 'lote' | 'abertura' | 'mes' | 'custo';
export const SECOES_DA_EFICIENCIA: Record<SecaoDaEficiencia, { titulo: string; legenda: string }> = {
  lote: {
    titulo: 'Fechamento do lote, pelo mês da inoculação',
    legenda: '* Parcial até o lote encerrar: há lote inoculado no mês ainda na maturação ou com estante aberta há menos de 30 dias, ou o mês não terminou. A variação com um mês parcial sai sem cor.',
  },
  abertura: {
    titulo: 'Rendimento dos blocos abertos no mês, acompanhando a frutificação',
    legenda: '* Em colheita: estante aberta no mês há menos de 30 dias, ou o mês não terminou. O número sobe conforme as colheitas entram e não espera o lote encerrar. As aberturas encerradas (lote cuja última estante aberta no mês tem 30 dias ou mais) já têm o rendimento final, salvo colheita lançada depois; o das em colheita é o acumulado até agora. A variação com um mês em colheita sai sem cor.',
  },
  mes: {
    titulo: 'Qualidade e receita do mês',
    legenda: '* Parcial: o mês não terminou, e as colheitas e as vendas dele ainda entram. A variação com um mês parcial sai sem cor.',
  },
  custo: {
    titulo: 'Custo do mês',
    legenda: '* Parcial: o mês não terminou, e os lançamentos dele ainda entram. A variação com um mês parcial sai sem cor.',
  },
};
export const TITULO_DO_MES_SEM_QUALIDADE = 'Receita do mês';
export interface QuadroDoIndicador { meses: string[]; linhas: LinhaDoIndicador[]; notas: string[] }
export type GrupoDoCard = 'resultado' | 'eficiencia' | 'volumes' | 'revenda' | 'custos';

const ESPECIES: Variedade[] = ['SH', 'SP', 'SB', 'SS'];
const MATERIA_PRIMA = 'L015';
const cent = (v: number) => Math.round(v * 100);
const razao = (a: number | null | undefined, b: number | null | undefined) => (a == null || b == null || b === 0 ? null : a / b);
const emPontos = (a: number | null | undefined, b: number | null | undefined) => {
  const r = razao(a, b);
  return r == null ? null : Math.round(r * 10000) / 100;
};
export const notaDoRendimento = (gramas: number) => `Rendimento pela abertura: os blocos abertos no mês e tudo o que eles colheram até hoje, também nos meses seguintes (bandeja de ${num(gramas)} g). Só conta bloco já aberto e não espera o lote encerrar. Lote aberto que ainda não colheu entra com zero enquanto colhe; aberto há 30 dias ou mais sem colheita registrada fica fora, como a abertura sem a quantidade anotada.`;
const NOTA_DA_CONTAMINACAO = 'Contaminação: blocos contaminados dos lotes inoculados no mês, sobre os blocos produzidos deles. O mês mais recente ainda está na maturação, onde a contaminação aparece.';
const NOTA_DO_APROVEITAMENTO = 'Aproveitamento (blocos abertos sobre produzidos) e eficiência total (kg sobre blocos produzidos): só os lotes inoculados no mês com a abertura concluída (nenhuma estante na fila e a quantidade anotada em toda estante aberta), com a colheita até hoje, que continua entrando até o fim da frutificação.';
const NOTA_DA_CLASSIFICACAO = 'Classificação do Shiitake: kg de cada faixa sobre o kg classificado (P + M + G + GG), pela data da colheita, a mesma régua da qualidade do Painel Operacional. O GG é a faixa acima do G e entra com o M e o G.';

function materiaPrima(s: ExecutivoSerieMensal | undefined, recorte: Recorte): number | null {
  if (!s || s.receita_liquida == null) return null;
  const linhas = recorte === 'TOTAL' ? s.linhas : s.linhas_por_chave ? (s.linhas_por_chave[recorte] ?? []) : null;
  if (!linhas) return null;
  return linhas.filter((l) => l.codigo_oficial === MATERIA_PRIMA).reduce((t, l) => t - cent(l.valor), 0) / 100;
}

function receitaDoCogumelo(s: ExecutivoSerieMensal | undefined, recorte: Recorte): number | null {
  const e = s?.escada;
  if (!e) return null;
  if (recorte === 'TOTAL') return e.por_atividade.PRODUCAO_COGUMELO?.receita_liquida ?? null;
  return divisaoDaReceitaPorEspecie(e) === 'INTEIRA' ? e.por_variedade?.[recorte]?.receita_liquida ?? null : null;
}

const emAndamento = (m: IndicadoresDoMes | undefined) => m?.parcial?.mes_em_andamento ?? false;
const parcialDaOrigem = (m: IndicadoresDoMes | undefined, recorte: Recorte, comColheita = false) => {
  const x = origemDoMes(m, recorte);
  return emAndamento(m) || (x?.lotes_em_maturacao ?? 0) > 0 || (comColheita && (x?.lotes_colhendo ?? 0) > 0);
};
const parcialDaAbertura = (m: IndicadoresDoMes | undefined, recorte: Recorte) => {
  const a = m?.parcial?.abertura_colhendo;
  return emAndamento(m) || !!(a && (recorte === 'TOTAL' ? a.total : a.por_especie[recorte]));
};
const comParciais = (linhas: LinhaDoIndicador[], padrao: boolean[]) => linhas.map((l) => ({ ...l, parciais: l.parciais ?? padrao }));
const volumes = (m: IndicadoresDoMes | undefined, recorte: Recorte): VolumesDoMes | null =>
  (!m ? null : recorte === 'TOTAL' ? m.producao.total : m.producao.por_especie[recorte]);
const origemDoMes = (m: IndicadoresDoMes | undefined, recorte: Recorte): OrigemDoMes | null =>
  (!m?.lotes_de_origem ? null : recorte === 'TOTAL' ? m.lotes_de_origem.total : m.lotes_de_origem.por_especie[recorte]);
export const lotesDaAbertura = (m: IndicadoresDoMes | undefined, recorte: Recorte): LoteDaAbertura[] | null =>
  (!m?.rendimento_pela_abertura ? null : m.rendimento_pela_abertura.lotes.filter((l) => recorte === 'TOTAL' || l.tipo === recorte));
const faixasDoMes = (m: IndicadoresDoMes | undefined): FaixasDoShiitake | null => m?.producao.shiitake_colhido ?? null;
const classificado = (f: FaixasDoShiitake) => f.kg_p + f.kg_m + f.kg_g + f.kg_gg;

export function quadrosDosIndicadores(serie: ExecutivoSerieMensal[], indicadores: IndicadoresDoMes[], meses: string[], recorte: Recorte = 'TOTAL', gramasPorBandeja = 210):
  { eficiencia: QuadroDoIndicador; volumes: QuadroDoIndicador; revenda: QuadroDoIndicador; classificacao: QuadroDoIndicador | null } {
  const s = (m: string) => serie.find((x) => x.mes === m);
  const ind = (m: string) => indicadores.find((x) => x.mes === m);
  const v = (m: string) => volumes(ind(m), recorte);
  const o = (m: string) => origemDoMes(ind(m), recorte);
  const f = (m: string) => faixasDoMes(ind(m));
  const col = (fn: (m: string) => number | null | undefined) => meses.map((m) => fn(m) ?? null);
  const comShiitake = recorte === 'TOTAL' || recorte === 'SH';
  const semVendas = meses.filter((m) => ind(m)?.sem_vendas).map((m) => `${rotuloDoMes(m)}: bandejas vendidas sem número (${ind(m)!.sem_vendas}).`);
  const semEmbalagem = meses.filter((m) => ind(m) && v(m)?.bandejas_produzidas == null)
    .map((m) => `${rotuloDoMes(m)}: bandejas produzidas sem número, nenhum registro de embalagem de cogumelo no mês.`);
  const semDivisao = recorte !== 'TOTAL' && meses.some((m) => s(m)?.escada && receitaDoCogumelo(s(m), recorte) == null)
    ? ['Receita líquida e receita por bandeja da espécie: sem número no mês em que a receita do Cogumelo não está dividida inteira por espécie.'] : [];
  const naConta = meses.filter((m) => (v(m)?.rendimento?.blocos_abertos ?? 0) > 0).map((m) => {
    const r = v(m)!.rendimento;
    const parte = (p: ParteDoRendimento | undefined, qual: string) => (!p?.lotes ? null
      : `${num(p.lotes)} ${qual} (${num(p.blocos_abertos)} ${p.blocos_abertos === 1 ? 'bloco' : 'blocos'}, ${num(p.bandejas)} ${p.bandejas === 1 ? 'bandeja' : 'bandejas'})`);
    const ditas = [parte(r.encerradas, r.encerradas?.lotes === 1 ? 'encerrado' : 'encerrados'), parte(r.em_colheita, 'em colheita')].filter(Boolean);
    const colhendo = lotesDaAbertura(ind(m), recorte)?.filter((l) => l.colhendo).length ?? 0;
    const partes = r.encerradas ? (ditas.length ? `, sendo ${ditas.join(' e ')}` : '') : colhendo ? ` (${num(colhendo)} ainda colhendo)` : '';
    return `${rotuloDoMes(m)}, ${num(r.lotes)} ${r.lotes === 1 ? 'lote' : 'lotes'}, ${num(r.blocos_abertos)} blocos abertos, ${num(r.kg_colhidos, 3)} kg e ${num(r.bandejas)} bandejas${partes}`;
  });
  const temPartes = meses.some((m) => v(m)?.rendimento?.encerradas);
  const parteDoMes = (m: string, k: 'encerradas' | 'em_colheita') => { const p = v(m)?.rendimento?.[k]; return razao(p?.bandejas, p?.blocos_abertos); };
  const foraDoRendimento = meses.flatMap((m) => {
    const f = ind(m)?.rendimento_pela_abertura?.fora_da_conta;
    const lotes = (n: number) => `${num(n)} ${n === 1 ? 'lote' : 'lotes'}`;
    const partes = f ? [
      f.abertura_sem_quantidade ? `${lotes(f.abertura_sem_quantidade)} sem a quantidade aberta anotada` : null,
      f.abertura_com_zero_blocos ? `${lotes(f.abertura_com_zero_blocos)} com zero blocos abertos` : null,
      f.abertos_sem_colheita ? `${lotes(f.abertos_sem_colheita)} ${f.abertos_sem_colheita === 1 ? 'aberto' : 'abertos'} há 30 dias ou mais sem colheita registrada` : null,
    ].filter(Boolean) : [];
    return recorte === 'TOTAL' && partes.length ? [`${rotuloDoMes(m)}: ${partes.join('; ')}, fora do rendimento.`] : [];
  });
  const naContaminacao = meses.filter((m) => v(m)?.contaminacao_pct != null)
    .map((m) => `${rotuloDoMes(m)}, ${num(v(m)!.blocos_contaminados)} de ${num(v(m)!.blocos_produzidos)} blocos`);
  const noAproveitamento = meses.filter((m) => (o(m)?.lotes ?? 0) > 0).map((m) => {
    const x = o(m)!;
    return x.lotes_abertura_concluida
      ? `${rotuloDoMes(m)}, ${num(x.lotes_abertura_concluida)} de ${num(x.lotes)} ${x.lotes === 1 ? 'lote' : 'lotes'}, ${num(x.concluidos.blocos_produzidos)} produzidos, ${num(x.concluidos.blocos_abertos)} abertos e ${num(x.concluidos.kg_colhidos, 3)} kg`
      : `${rotuloDoMes(m)}, ${x.lotes === 1 ? '1 lote, ainda sem a abertura concluída' : `nenhum dos ${num(x.lotes)} lotes`}${x.lotes_em_maturacao ? ` (${num(x.lotes_em_maturacao)} com estante na maturação)` : ''}`;
  });
  const naClassificacao = meses.filter((m) => f(m) && classificado(f(m)!) > 0).map((m) => {
    const x = f(m)!;
    return `${rotuloDoMes(m)}, ${num(classificado(x), 3)} kg classificados, ${num(x.kg_m + x.kg_g + x.kg_gg, 3)} de M, G e GG`;
  });
  const faixa = (fn: (x: FaixasDoShiitake) => number) => col((m) => { const x = f(m); return x ? emPontos(fn(x), classificado(x)) : null; });
  const daOrigem = meses.map((m) => parcialDaOrigem(ind(m), recorte));
  const daOrigemColhendo = meses.map((m) => parcialDaOrigem(ind(m), recorte, true));
  const daAbertura = meses.map((m) => parcialDaAbertura(ind(m), recorte));
  const andamento = meses.map((m) => emAndamento(ind(m)));
  const eficiencia: QuadroDoIndicador = {
    meses,
    linhas: comParciais([
      { rotulo: 'Contaminação (%)', formato: 'pct', sobeEMelhor: false, secao: 'lote', parciais: daOrigemColhendo, valores: col((m) => v(m)?.contaminacao_pct) },
      { rotulo: 'Taxa de aproveitamento (%)', formato: 'pct', sobeEMelhor: true, secao: 'lote', parciais: daOrigem, valores: col((m) => { const x = o(m); return x ? emPontos(x.concluidos.blocos_abertos, x.concluidos.blocos_produzidos) : null; }) },
      { rotulo: 'Eficiência total (kg/bloco produzido)', formato: 'num', sobeEMelhor: true, secao: 'lote', parciais: daOrigemColhendo, valores: col((m) => { const x = o(m); return x ? razao(x.concluidos.kg_colhidos, x.concluidos.blocos_produzidos) : null; }) },
      { rotulo: 'Rendimento pela abertura (kg/bloco aberto)', formato: 'num', sobeEMelhor: true, secao: 'abertura', parciais: daAbertura, valores: col((m) => razao(v(m)?.rendimento?.kg_colhidos, v(m)?.rendimento?.blocos_abertos)) },
      { rotulo: 'Rendimento pela abertura (bandejas/bloco aberto)', formato: 'num', sobeEMelhor: true, secao: 'abertura', parciais: daAbertura, valores: col((m) => razao(v(m)?.rendimento?.bandejas, v(m)?.rendimento?.blocos_abertos)) },
      ...(temPartes ? [
        { rotulo: 'Aberturas encerradas, rendimento final (bandejas/bloco aberto)', formato: 'num' as const, sobeEMelhor: true, secao: 'abertura' as const, parciais: andamento, valores: col((m) => parteDoMes(m, 'encerradas')) },
        { rotulo: 'Aberturas em colheita, acumulado até agora (bandejas/bloco aberto)', formato: 'num' as const, sobeEMelhor: true, secao: 'abertura' as const,
          parciais: meses.map((m) => emAndamento(ind(m)) || (v(m)?.rendimento?.em_colheita?.lotes ?? 0) > 0), valores: col((m) => parteDoMes(m, 'em_colheita')) },
      ] : []),
      ...(comShiitake ? [{ rotulo: '% Shiitake M, G e GG', formato: 'pct' as const, sobeEMelhor: true, secao: 'mes' as const, valores: faixa((x) => x.kg_m + x.kg_g + x.kg_gg) }] : []),
      { rotulo: 'Receita líquida da produção', formato: 'reais', sobeEMelhor: true, secao: 'mes', valores: col((m) => receitaDoCogumelo(s(m), recorte)) },
      { rotulo: 'Receita/bandeja vendida da produção (R$)', formato: 'unitario', sobeEMelhor: true, secao: 'mes', valores: col((m) => razao(receitaDoCogumelo(s(m), recorte), v(m)?.bandejas_vendidas)) },
      { rotulo: 'MP por bloco produzido (R$)', formato: 'unitario', sobeEMelhor: false, secao: 'custo', soNaInvestigacao: true, valores: col((m) => razao(materiaPrima(s(m), recorte), v(m)?.blocos_produzidos)) },
    ], andamento),
    notas: [
      NOTA_DA_CONTAMINACAO,
      ...(naContaminacao.length ? [`Na conta da contaminação: ${naContaminacao.join('; ')}.`] : []),
      NOTA_DO_APROVEITAMENTO,
      ...(noAproveitamento.length ? [`Na conta do aproveitamento: ${noAproveitamento.join('; ')}.`] : []),
      notaDoRendimento(gramasPorBandeja),
      ...(naConta.length ? [`Na conta do rendimento: ${naConta.join('; ')}.`] : []),
      ...foraDoRendimento,
      ...(comShiitake ? [NOTA_DA_CLASSIFICACAO, ...(naClassificacao.length ? [`Na conta da classificação: ${naClassificacao.join('; ')}.`] : [])] : []),
      ...semDivisao, ...semVendas,
    ],
  };
  const vol: QuadroDoIndicador = {
    meses,
    linhas: comParciais([
      { rotulo: 'Blocos produzidos', formato: 'num', sobeEMelhor: true, valores: col((m) => v(m)?.blocos_produzidos) },
      { rotulo: 'Blocos abertos', formato: 'num', sobeEMelhor: true, valores: col((m) => v(m)?.blocos_abertos) },
      { rotulo: 'Quilos colhidos', formato: 'kg', sobeEMelhor: true, valores: col((m) => v(m)?.kg_colhidos) },
      { rotulo: 'Bandejas produzidas', formato: 'num', sobeEMelhor: true, valores: col((m) => v(m)?.bandejas_produzidas) },
      { rotulo: 'Bandejas vendidas da produção', formato: 'num', sobeEMelhor: true, valores: col((m) => v(m)?.bandejas_vendidas) },
    ], andamento),
    notas: [...semEmbalagem, ...semVendas],
  };
  const daEspecie = (m: string) => (recorte === 'TOTAL' ? null : ind(m)?.revenda.por_especie.find((e) => e.especie === recorte));
  const bandejasDaRevenda = (m: string) => {
    const i = ind(m);
    if (!i || i.revenda.bandejas_vendidas == null) return null;
    return recorte === 'TOTAL' ? i.revenda.bandejas_vendidas : daEspecie(m)?.bandejas ?? 0;
  };
  const receitaDaRevenda = (m: string) => (recorte === 'TOTAL'
    ? s(m)?.escada?.por_atividade.REVENDA?.receita_liquida
    : bandejasDaRevenda(m) == null ? null : daEspecie(m)?.receita ?? 0);
  const revenda: QuadroDoIndicador = {
    meses,
    linhas: comParciais(recorte === 'TOTAL'
      ? [
        { rotulo: 'Receita líquida da revenda', formato: 'reais', sobeEMelhor: true, valores: col(receitaDaRevenda) },
        { rotulo: 'Bandejas vendidas da revenda', formato: 'num', sobeEMelhor: true, valores: col(bandejasDaRevenda) },
        { rotulo: 'Receita por bandeja vendida da revenda', formato: 'unitario', sobeEMelhor: true, valores: col((m) => razao(receitaDaRevenda(m), bandejasDaRevenda(m))) },
      ]
      : [
        { rotulo: `Receita da revenda de ${ROTULO_DA_VARIEDADE[recorte]} no relatório de vendas`, formato: 'reais', sobeEMelhor: true, valores: col(receitaDaRevenda) },
        { rotulo: `Bandejas vendidas da revenda de ${ROTULO_DA_VARIEDADE[recorte]}`, formato: 'num', sobeEMelhor: true, valores: col(bandejasDaRevenda) },
        { rotulo: 'Receita por bandeja vendida (relatório de vendas)', formato: 'unitario', sobeEMelhor: true, valores: col((m) => razao(receitaDaRevenda(m), bandejasDaRevenda(m))) },
      ], andamento),
    notas: semVendas,
  };
  const classificacao: QuadroDoIndicador | null = !comShiitake ? null : {
    meses,
    linhas: comParciais([
      { rotulo: 'Kg classificados do Shiitake', formato: 'kg3', sobeEMelhor: null, valores: col((m) => { const x = f(m); return x ? classificado(x) : null; }) },
      { rotulo: '% Shiitake P', formato: 'pct', sobeEMelhor: false, valores: faixa((x) => x.kg_p) },
      { rotulo: '% Shiitake M', formato: 'pct', sobeEMelhor: null, valores: faixa((x) => x.kg_m) },
      { rotulo: '% Shiitake G', formato: 'pct', sobeEMelhor: true, valores: faixa((x) => x.kg_g) },
      { rotulo: '% Shiitake GG', formato: 'pct', sobeEMelhor: true, valores: faixa((x) => x.kg_gg) },
      { rotulo: '% Shiitake M, G e GG', formato: 'pct', sobeEMelhor: true, valores: faixa((x) => x.kg_m + x.kg_g + x.kg_gg) },
    ], andamento),
    notas: [NOTA_DA_CLASSIFICACAO],
  };
  return { eficiencia, volumes: vol, revenda, classificacao };
}

export const paraOCard = (q: QuadroDoIndicador): QuadroDoIndicador => ({ ...q, linhas: q.linhas.filter((l) => !l.soNaInvestigacao) });

export type Lado = 'producao' | 'revenda';
const NOME_DO_LADO: Record<Lado, string> = { producao: 'produção', revenda: 'revenda' };
const vendasDoLado = (m: IndicadoresDoMes, lado: Lado): { bandejas: number | null; especies: VendaPorEspecie[] } => (lado === 'producao'
  ? { bandejas: m.producao.total.bandejas_vendidas, especies: m.producao.vendas_por_especie }
  : { bandejas: m.revenda.bandejas_vendidas, especies: m.revenda.por_especie });

export function detalhePorCogumelo(m: IndicadoresDoMes | undefined, lado: Lado = 'revenda'): {
  linhas: Array<{ rotulo: string; bandejas: number; receita: number; porBandeja: number | null }>;
  total: { bandejas: number; receita: number; porBandeja: number | null };
} | null {
  if (!m) return null;
  const { bandejas, especies } = vendasDoLado(m, lado);
  if (bandejas == null || !especies) return null;
  const linhas = especies.map((e) => ({
    rotulo: e.especie === 'OUTROS' ? 'Outros cogumelos' : ROTULO_DA_VARIEDADE[e.especie], bandejas: e.bandejas, receita: e.receita, porBandeja: razao(e.receita, e.bandejas),
  }));
  const total = { bandejas: linhas.reduce((t, l) => t + Math.round(l.bandejas * 1000), 0) / 1000, receita: linhas.reduce((t, l) => t + cent(l.receita), 0) / 100 };
  return { linhas, total: { ...total, porBandeja: razao(total.receita, total.bandejas) } };
}

export const ROTULO_DA_SITUACAO: Record<SituacaoDoLoteDeOrigem, string> = {
  EM_MATURACAO: 'em maturação', ABERTURA_CONCLUIDA: 'abertura concluída', SEM_DADO_DA_ABERTURA: 'sem dado da abertura', SEM_ABERTURA: 'sem abertura',
};
export const NOTAS_DA_ORIGEM = [
  'Lote de origem: cada mês é o da inoculação, com tudo o que aconteceu com os lotes dele até hoje (abertura, contaminação e colheita). Os meses mais recentes ainda estão na maturação.',
  'Destino dos blocos: produzidos = contaminados + outras saídas + abertos + ainda em maturação + sem destino conciliado. Em maturação são os blocos ainda na fila das Próximas Aberturas; o sem destino é a diferença, contagem ou registro que faltou (negativo quando as saídas registradas passam dos produzidos). Estante na fila sem contagem própria (o número anotado só no lote) conta zero em maturação, e os blocos dela ficam no sem destino.',
  'Base do aproveitamento e da eficiência total do quadro de eficiência: só os lotes com a abertura concluída. A colheita deles continua entrando até o fim da frutificação.',
];

export function quadrosDosLotesDeOrigem(indicadores: IndicadoresDoMes[], meses: string[], recorte: Recorte = 'TOTAL'):
  { destino: QuadroDoIndicador; base: QuadroDoIndicador } {
  const ind = (m: string) => indicadores.find((x) => x.mes === m);
  const o = (m: string) => origemDoMes(ind(m), recorte);
  const col = (fn: (x: OrigemDoMes) => number | null) => meses.map((m) => { const x = o(m); return x ? fn(x) : null; });
  const daOrigem = meses.map((m) => parcialDaOrigem(ind(m), recorte));
  const daOrigemColhendo = meses.map((m) => parcialDaOrigem(ind(m), recorte, true));
  const andamento = meses.map((m) => emAndamento(ind(m)));
  const fora = meses.flatMap((m) => {
    const x = o(m);
    if (!x) return [];
    const partes = [
      x.lotes_sem_dado_da_abertura ? `${num(x.lotes_sem_dado_da_abertura)} ${x.lotes_sem_dado_da_abertura === 1 ? 'lote' : 'lotes'} sem dado da abertura (abriu sem a quantidade anotada, ou sem a contagem dos produzidos)` : null,
      x.lotes_sem_abertura ? `${num(x.lotes_sem_abertura)} ${x.lotes_sem_abertura === 1 ? 'lote' : 'lotes'} sem abertura e sem bloco na fila` : null,
    ].filter(Boolean);
    return partes.length ? [`${rotuloDoMes(m)}: ${partes.join('; ')}, fora do aproveitamento.`] : [];
  });
  const destino: QuadroDoIndicador = {
    meses,
    linhas: comParciais([
      { rotulo: 'Blocos produzidos', formato: 'num', sobeEMelhor: true, parciais: andamento, valores: col((x) => x.blocos_produzidos) },
      { rotulo: 'Blocos contaminados', formato: 'num', sobeEMelhor: null, parciais: daOrigemColhendo, valores: col((x) => x.blocos_contaminados) },
      { rotulo: 'Outras saídas registradas (perdas)', formato: 'num', sobeEMelhor: null, parciais: daOrigemColhendo, valores: col((x) => x.blocos_perdidos) },
      { rotulo: 'Blocos abertos para frutificação', formato: 'num', sobeEMelhor: null, valores: col((x) => x.blocos_abertos) },
      { rotulo: 'Blocos ainda em maturação', formato: 'num', sobeEMelhor: null, valores: col((x) => x.blocos_em_maturacao) },
      { rotulo: 'Blocos sem destino conciliado', formato: 'num', sobeEMelhor: null, parciais: daOrigemColhendo, valores: col((x) => x.blocos_sem_destino) },
    ], daOrigem),
    notas: [NOTAS_DA_ORIGEM[0], NOTAS_DA_ORIGEM[1]],
  };
  const base: QuadroDoIndicador = {
    meses,
    linhas: comParciais([
      { rotulo: 'Lotes inoculados', formato: 'num', sobeEMelhor: null, parciais: andamento, valores: col((x) => x.lotes) },
      { rotulo: 'Lotes com estante ainda em maturação', formato: 'num', sobeEMelhor: null, valores: col((x) => x.lotes_em_maturacao) },
      { rotulo: 'Lotes com a abertura concluída', formato: 'num', sobeEMelhor: null, valores: col((x) => x.lotes_abertura_concluida) },
      { rotulo: 'Blocos produzidos dos lotes concluídos', formato: 'num', sobeEMelhor: null, valores: col((x) => x.concluidos.blocos_produzidos) },
      { rotulo: 'Blocos abertos dos lotes concluídos', formato: 'num', sobeEMelhor: null, valores: col((x) => x.concluidos.blocos_abertos) },
      { rotulo: 'Kg colhidos dos lotes concluídos', formato: 'kg3', sobeEMelhor: null, parciais: daOrigemColhendo, valores: col((x) => x.concluidos.kg_colhidos) },
    ], daOrigem),
    notas: [NOTAS_DA_ORIGEM[2], ...fora],
  };
  return { destino, base };
}

export function lotesDoMesDeOrigem(m: IndicadoresDoMes | undefined, recorte: Recorte = 'TOTAL'): { lotes: LoteDeOrigem[]; total: Record<string, number> } | null {
  if (!m?.lotes_de_origem) return null;
  const lotes = m.lotes_de_origem.lotes.filter((l) => recorte === 'TOTAL' || l.tipo === recorte);
  const soma = (k: keyof LoteDeOrigem) => lotes.reduce((t, l) => t + Number(l[k] ?? 0), 0);
  const total = Object.fromEntries((['blocos_produzidos', 'blocos_contaminados', 'blocos_perdidos', 'blocos_abertos', 'blocos_em_maturacao', 'blocos_sem_destino'] as const).map((k) => [k, soma(k)]));
  return { lotes, total: { ...total, kg_colhidos: lotes.reduce((t, l) => t + Math.round((l.kg_colhidos ?? 0) * 1000), 0) / 1000 } };
}

const formatar = (v: number | null, f: Formato) => (v == null ? '—'
  : f === 'unitario' ? brl(v) : f === 'reais' ? reais(v) : f === 'kg' ? `${num(v, 1)} kg` : f === 'kg3' ? `${num(v, 3)} kg` : f === 'pct' ? pct(v) : num(v, 3));

export function variacaoDaLinha(l: LinhaDoIndicador): { texto: string; tom: '' | 'pos' | 'neg' } {
  const [ant, atual] = l.valores.slice(-2);
  if (l.valores.length < 2 || ant == null || atual == null) return { texto: '—', tom: '' };
  const d = l.formato === 'pct' ? variacaoEmPontos(atual, ant) : variacaoPct(atual, ant);
  if (d == null) return { texto: 'sem base', tom: '' };
  const parcial = !!l.parciais?.slice(-2).some(Boolean);
  const texto = `${d > 0 ? '+' : ''}${l.formato === 'pct' ? pontosPercentuais(d) : pct(d)}${parcial ? '*' : ''}`;
  return { texto, tom: d === 0 || l.sobeEMelhor == null || parcial ? '' : (d > 0) === l.sobeEMelhor ? 'pos' : 'neg' };
}

export const LEGENDA_DO_PARCIAL = '* Parcial: o mês não terminou, e o número ainda muda. A variação com um mês parcial sai sem cor.';
const TITULO_DO_PARCIAL = 'Parcial: o número ainda muda';
export const temParcial = (q: QuadroDoIndicador) => q.linhas.some((l) => l.valores.some((x, i) => x != null && l.parciais?.[i]));

export function secoesDoQuadro(q: QuadroDoIndicador): Array<{ secao: SecaoDaEficiencia; titulo: string; legenda: string; quadro: QuadroDoIndicador }> {
  const secoes: Array<{ secao: SecaoDaEficiencia; titulo: string; legenda: string; quadro: QuadroDoIndicador }> = [];
  for (const l of q.linhas) {
    const secao = l.secao ?? 'mes';
    const atual = secoes[secoes.length - 1];
    if (atual?.secao === secao) atual.quadro.linhas.push(l);
    else secoes.push({ secao, titulo: l.secao ? SECOES_DA_EFICIENCIA[secao].titulo : '', legenda: SECOES_DA_EFICIENCIA[secao].legenda, quadro: { meses: q.meses, linhas: [l], notas: [] } });
  }
  for (const s of secoes) if (s.secao === 'mes' && s.titulo && !s.quadro.linhas.some((l) => l.formato === 'pct')) s.titulo = TITULO_DO_MES_SEM_QUALIDADE;
  return secoes;
}

export function QuadroDaEficiencia({ quadro }: { quadro: QuadroDoIndicador }) {
  return (
    <>
      {secoesDoQuadro(quadro).map((s) => (
        <div key={s.secao} className={`secao-da-eficiencia secao-${s.secao}`}>
          {s.titulo && <h5>{s.titulo}</h5>}
          <TabelaDeIndicadores quadro={s.quadro} legenda={s.legenda} />
        </div>
      ))}
    </>
  );
}

export function TabelaDeIndicadores({ quadro, legenda = LEGENDA_DO_PARCIAL }: { quadro: QuadroDoIndicador; legenda?: string }) {
  const { meses } = quadro;
  return (
    <>
      <div className="tbl-scroll">
        <table className="tbl tabela-indicadores">
          <thead>
            <tr>
              <th>Indicador</th>
              {meses.map((m) => <th key={m} className="num">{rotuloDoMes(m)}</th>)}
              <th className="num" title={meses.length >= 2 ? `${rotuloDoMes(meses[meses.length - 1])} contra ${rotuloDoMes(meses[meses.length - 2])}` : undefined}>Variação</th>
            </tr>
          </thead>
          <tbody>
            {quadro.linhas.map((l) => {
              const v = variacaoDaLinha(l);
              return (
                <tr key={l.rotulo}>
                  <td>{l.rotulo}</td>
                  {l.valores.map((x, i) => (x != null && l.parciais?.[i]
                    ? <td key={meses[i]} className="num" title={TITULO_DO_PARCIAL}>{`${formatar(x, l.formato)}*`}</td>
                    : <td key={meses[i]} className="num">{formatar(x, l.formato)}</td>))}
                  <td className={v.tom ? `num ${v.tom}` : 'num'}>{v.texto}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {temParcial(quadro) && <p className="obs-tela legenda-parcial">{legenda}</p>}
    </>
  );
}

export const Notas = ({ notas }: { notas: string[] }) => (notas.length ? <ul className="notas-indicadores">{[...new Set(notas)].map((n) => <li key={n}>{n}</li>)}</ul> : null);

export const LEGENDA_DO_DETALHE_PARCIAL = '* Parcial: o mês não terminou, e as vendas dele ainda entram.';
export function DetalhePorCogumelo({ m, lado = 'revenda' }: { m: IndicadoresDoMes | undefined; lado?: Lado }) {
  const d = detalhePorCogumelo(m, lado);
  if (!m) return null;
  if (!d) return <p className="obs-tela">{`Detalhamento por cogumelo da ${NOME_DO_LADO[lado]} de ${rotuloDoMes(m.mes)}: sem o relatório de vendas (${m.sem_vendas ?? 'sem dado'}).`}</p>;
  const parcial = emAndamento(m);
  const celula = (texto: string) => (parcial && texto !== '—' ? <td className="num" title={TITULO_DO_PARCIAL}>{`${texto}*`}</td> : <td className="num">{texto}</td>);
  const linha = (rotulo: string, x: { bandejas: number; receita: number; porBandeja: number | null }, total = false) => (
    <tr key={rotulo} className={total ? 'ln-total' : undefined}><td>{rotulo}</td>{celula(num(x.bandejas, 3))}{celula(brl(x.receita))}{celula(brl(x.porBandeja))}</tr>
  );
  return (
    <>
      <h5>{`Detalhamento por cogumelo: ${rotuloDoMes(m.mes)}`}</h5>
      <div className="tbl-scroll">
        <table className="tbl">
          <thead><tr><th>Produto</th><th className="num">Bandejas</th><th className="num">Receita no relatório de vendas</th><th className="num">Receita por bandeja</th></tr></thead>
          <tbody>
            {d.linhas.map((l) => linha(l.rotulo, l))}
            {linha('TOTAL', d.total, true)}
          </tbody>
        </table>
      </div>
      {parcial && <p className="obs-tela legenda-parcial">{LEGENDA_DO_DETALHE_PARCIAL}</p>}
      <p className="obs-tela">{`A receita do detalhe é a do relatório de vendas por produto; a receita líquida da ${NOME_DO_LADO[lado]}, no quadro acima, é a da DRE.`}</p>
    </>
  );
}

const fmtTaxa = (v: number | null) => (v == null ? '—' : pct(v));
export const parcialDoLote = (l: LoteDeOrigem) => l.situacao === 'EM_MATURACAO' || !!l.colhendo;
const naMaturacao = (l: LoteDeOrigem) => l.situacao === 'EM_MATURACAO';
export const LEGENDA_DO_LOTE_PARCIAL = '* Parcial: o lote ainda tem estante na maturação ou aberta há menos de 30 dias, e a contaminação e a colheita dele ainda entram.';
const COLUNAS_DE_BLOCOS: Array<{ k: 'blocos_produzidos' | 'blocos_contaminados' | 'blocos_perdidos' | 'blocos_abertos' | 'blocos_em_maturacao' | 'blocos_sem_destino'; parcial: (l: LoteDeOrigem) => boolean }> = [
  { k: 'blocos_produzidos', parcial: () => false },
  { k: 'blocos_contaminados', parcial: parcialDoLote },
  { k: 'blocos_perdidos', parcial: parcialDoLote },
  { k: 'blocos_abertos', parcial: naMaturacao },
  { k: 'blocos_em_maturacao', parcial: naMaturacao },
  { k: 'blocos_sem_destino', parcial: parcialDoLote },
];
function LotesDeOrigem({ ind, meses, recorte }: { ind: IndicadoresDoMes[]; meses: string[]; recorte: Recorte }) {
  const [mes, setMes] = useState('');
  const d = mes ? lotesDoMesDeOrigem(ind.find((m) => m.mes === mes), recorte) : null;
  return (
    <>
      <label className="seletor-especie">
        {'Ver os lotes inoculados em: '}
        <select value={mes} onChange={(e) => setMes(e.target.value)}>
          <option value="">escolha o mês</option>
          {meses.map((m) => <option key={m} value={m}>{rotuloDoMes(m)}</option>)}
        </select>
      </label>
      {mes && (!d || d.lotes.length === 0) && <p className="obs-tela">{`Nenhum lote inoculado em ${rotuloDoMes(mes)}${recorte === 'TOTAL' ? '' : ` de ${ROTULO_DA_VARIEDADE[recorte]}`}.`}</p>}
      {d && d.lotes.length > 0 && (
        <div className="tbl-scroll">
          <table className="tbl tabela-indicadores">
            <thead>
              <tr>
                <th>Lote</th><th>Situação</th><th className="num">Produzidos</th><th className="num">Contaminados</th><th className="num">Outras saídas</th>
                <th className="num">Abertos</th><th className="num">Em maturação</th><th className="num">Sem destino</th><th className="num">Kg colhidos</th>
                <th className="num">Aproveitamento</th><th className="num">Kg/bloco aberto</th><th className="num">Eficiência total</th><th className="num">% M, G e GG</th>
              </tr>
            </thead>
            <tbody>
              {d.lotes.map((l) => {
                const concluido = l.situacao === 'ABERTURA_CONCLUIDA';
                const faixas = l.kg_p + l.kg_m + l.kg_g + l.kg_gg;
                const p = parcialDoLote(l) ? '*' : '';
                return (
                  <tr key={l.chave}>
                    <td>{`${dataBr(l.data_lote)} ${l.tipo ? ROTULO_DA_VARIEDADE[l.tipo] : ''}`.trim()}</td>
                    <td>{concluido && l.colhendo ? 'abertura concluída, ainda colhendo' : ROTULO_DA_SITUACAO[l.situacao]}</td>
                    {COLUNAS_DE_BLOCOS.map((c) => <td key={c.k} className="num">{`${num(l[c.k])}${c.parcial(l) ? '*' : ''}`}</td>)}
                    <td className="num">{l.kg_colhidos == null ? '—' : `${num(l.kg_colhidos, 3)} kg${p}`}</td>
                    <td className="num">{concluido ? fmtTaxa(emPontos(l.blocos_abertos, l.blocos_produzidos)) : '—'}</td>
                    <td className="num">{concluido && l.blocos_abertos ? `${num(razao(l.kg_colhidos ?? 0, l.blocos_abertos), 3)}${p}` : '—'}</td>
                    <td className="num">{concluido ? `${num(razao(l.kg_colhidos ?? 0, l.blocos_produzidos), 3)}${p}` : '—'}</td>
                    <td className="num">{l.tipo === 'SH' && faixas > 0 ? `${fmtTaxa(emPontos(l.kg_m + l.kg_g + l.kg_gg, faixas))}${p}` : '—'}</td>
                  </tr>
                );
              })}
              <tr className="ln-total">
                <td>TOTAL</td><td />
                {COLUNAS_DE_BLOCOS.map((c) => <td key={c.k} className="num">{`${num(d.total[c.k])}${d.lotes.some(c.parcial) ? '*' : ''}`}</td>)}
                <td className="num">{`${num(d.total.kg_colhidos, 3)} kg${d.lotes.some(parcialDoLote) ? '*' : ''}`}</td><td /><td /><td /><td />
              </tr>
            </tbody>
          </table>
        </div>
      )}
      {mes && d && d.lotes.length > 0 && <p className="obs-tela">Por lote, o kg por bloco aberto é o de toda a colheita do lote sobre os blocos abertos dele; o rendimento pela abertura do quadro de eficiência junta as estantes abertas no mês.</p>}
      {mes && d && d.lotes.some(parcialDoLote) && <p className="obs-tela legenda-parcial">{LEGENDA_DO_LOTE_PARCIAL}</p>}
    </>
  );
}

export function DestinoDosBlocos({ ind, meses, recorte = 'TOTAL' }: { ind: IndicadoresDoMes[]; meses: string[]; recorte?: Recorte }) {
  const q = quadrosDosLotesDeOrigem(ind, meses, recorte);
  return (
    <>
      <h5>Destino dos blocos dos lotes inoculados no mês</h5>
      <TabelaDeIndicadores quadro={q.destino} legenda={SECOES_DA_EFICIENCIA.lote.legenda} />
      <h5>Base do aproveitamento e da eficiência total</h5>
      <TabelaDeIndicadores quadro={q.base} legenda={SECOES_DA_EFICIENCIA.lote.legenda} />
      <Notas notas={[...q.destino.notas, ...q.base.notas]} />
      <LotesDeOrigem ind={ind} meses={meses} recorte={recorte} />
    </>
  );
}

type SomaDosLotes = { blocos_abertos: number; bandejas: number; kg_colhidos: number; kg_por_mes: Record<string, number> };

export function lotesDoMesDaAbertura(m: IndicadoresDoMes | undefined, recorte: Recorte = 'TOTAL'): {
  lotes: LoteDaAbertura[]; mesesDeColheita: string[]; total: SomaDosLotes; encerrados: SomaDosLotes; em_colheita: SomaDosLotes;
} | null {
  const lotes = lotesDaAbertura(m, recorte);
  if (!lotes) return null;
  const mesesDeColheita = [...new Set(lotes.flatMap((l) => l.kg_por_mes.map((x) => x.mes)))].sort();
  const g = (kg: number) => Math.round(kg * 1000);
  const somar = (ls: LoteDaAbertura[]): SomaDosLotes => ({
    blocos_abertos: ls.reduce((t, l) => t + l.blocos_abertos, 0),
    bandejas: ls.reduce((t, l) => t + l.bandejas, 0),
    kg_colhidos: ls.reduce((t, l) => t + g(l.kg_colhidos), 0) / 1000,
    kg_por_mes: Object.fromEntries(mesesDeColheita.map((mc) => [mc, ls.reduce((t, l) => t + g(l.kg_por_mes.find((x) => x.mes === mc)?.kg ?? 0), 0) / 1000])),
  });
  return {
    lotes, mesesDeColheita, total: somar(lotes),
    encerrados: somar(lotes.filter((l) => !l.colhendo)), em_colheita: somar(lotes.filter((l) => l.colhendo)),
  };
}

const rotuloDaColheita = (mc: string) => (mc === 'sem data' ? 'Colheita sem data' : `Colhido em ${rotuloDoMes(mc)}`);
const periodoDaAbertura = (l: LoteDaAbertura) => (!l.primeira_abertura ? '—'
  : l.primeira_abertura === l.ultima_abertura ? dataBr(l.primeira_abertura) : `${dataBr(l.primeira_abertura)} a ${dataBr(l.ultima_abertura)}`);
export const LEGENDA_DO_LOTE_EM_COLHEITA = '* Em colheita: o lote abriu estante no mês há menos de 30 dias, e o kg dele ainda sobe.';

export function RendimentoPelaAbertura({ ind, meses, recorte = 'TOTAL', gramasPorBandeja, mesInicial = '' }: {
  ind: IndicadoresDoMes[]; meses: string[]; recorte?: Recorte; gramasPorBandeja: number; mesInicial?: string;
}) {
  const [mes, setMes] = useState(mesInicial);
  const d = mes ? lotesDoMesDaAbertura(ind.find((m) => m.mes === mes), recorte) : null;
  const marca = (l: LoteDaAbertura) => (l.colhendo ? '*' : '');
  const algumColhendo = !!d?.lotes.some((l) => l.colhendo);
  return (
    <>
      <h5>Rendimento pela abertura: os lotes abertos no mês e as colheitas deles</h5>
      <label className="seletor-especie">
        {'Ver os lotes abertos em: '}
        <select value={mes} onChange={(e) => setMes(e.target.value)}>
          <option value="">escolha o mês</option>
          {meses.map((m) => <option key={m} value={m}>{rotuloDoMes(m)}</option>)}
        </select>
      </label>
      {mes && !d && <p className="obs-tela">{`Lotes abertos em ${rotuloDoMes(mes)}: a resposta do servidor ainda não traz a lista.`}</p>}
      {mes && d && d.lotes.length === 0 && <p className="obs-tela">{`Nenhum lote aberto em ${rotuloDoMes(mes)}${recorte === 'TOTAL' ? '' : ` de ${ROTULO_DA_VARIEDADE[recorte]}`} entra no rendimento.`}</p>}
      {d && d.lotes.length > 0 && (
        <div className="tbl-scroll">
          <table className="tbl tabela-indicadores">
            <thead>
              <tr>
                <th>Lote (inoculação)</th><th>Abertura no mês</th><th className="num">Blocos abertos</th>
                {d.mesesDeColheita.map((mc) => <th key={mc} className="num">{rotuloDaColheita(mc)}</th>)}
                <th className="num">Kg colhidos</th><th className="num">Bandejas</th><th className="num">Kg/bloco aberto</th><th className="num">Bandejas/bloco aberto</th>
              </tr>
            </thead>
            <tbody>
              {d.lotes.map((l) => (
                <tr key={l.chave}>
                  <td>{`${dataBr(l.data_lote)} ${ROTULO_DA_VARIEDADE[l.tipo] ?? ''}`.trim()}</td>
                  <td>{periodoDaAbertura(l)}</td>
                  <td className="num">{num(l.blocos_abertos)}</td>
                  {d.mesesDeColheita.map((mc) => { const x = l.kg_por_mes.find((k) => k.mes === mc); return <td key={mc} className="num">{x ? `${num(x.kg, 3)} kg` : '—'}</td>; })}
                  <td className="num">{`${num(l.kg_colhidos, 3)} kg${marca(l)}`}</td>
                  <td className="num">{`${num(l.bandejas)}${marca(l)}`}</td>
                  <td className="num">{`${num(razao(l.kg_colhidos, l.blocos_abertos), 3)}${marca(l)}`}</td>
                  <td className="num">{`${num(razao(l.bandejas, l.blocos_abertos), 3)}${marca(l)}`}</td>
                </tr>
              ))}
              {(algumColhendo ? [['Encerrados', d.encerrados, ''], ['Em colheita', d.em_colheita, '*'], ['TOTAL', d.total, '*']] as const
                : [['TOTAL', d.total, ''] as const]).map(([rotulo, t, m]) => (
                <tr key={rotulo} className="ln-total">
                  <td>{rotulo}</td><td />
                  <td className="num">{num(t.blocos_abertos)}</td>
                  {d.mesesDeColheita.map((mc) => <td key={mc} className="num">{`${num(t.kg_por_mes[mc], 3)} kg`}</td>)}
                  <td className="num">{`${num(t.kg_colhidos, 3)} kg${m}`}</td>
                  <td className="num">{`${num(t.bandejas)}${m}`}</td>
                  <td className="num">{`${num(razao(t.kg_colhidos, t.blocos_abertos), 3)}${m}`}</td>
                  <td className="num">{`${num(razao(t.bandejas, t.blocos_abertos), 3)}${m}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {d && d.lotes.length > 0 && <p className="obs-tela">{`Cada lote leva só as estantes abertas no mês, com toda a colheita delas até hoje, aberta pelo mês em que entrou; a bandeja é o kg do lote sobre ${num(gramasPorBandeja)} g. O TOTAL é o rendimento pela abertura do quadro de eficiência${algumColhendo ? '; Encerrados soma os lotes sem * e Em colheita os com *, as duas linhas das aberturas no quadro' : ''}.`}</p>}
      {algumColhendo && <p className="obs-tela legenda-parcial">{LEGENDA_DO_LOTE_EM_COLHEITA}</p>}
    </>
  );
}

type Lido<T> = T | { erro: string } | null;

export function CardsDosIndicadores({ ex, ind, mes, onInvestigar }: {
  ex: Lido<ExecutivoResposta>; ind: Lido<IndicadoresDaProducaoResposta>; mes: string; onInvestigar?: (frente: FrenteDaGestao) => void;
}) {
  const meses = [mesAnterior(mes), mes];
  const falha = (ex && 'erro' in ex ? ex.erro : null) ?? (ind && 'erro' in ind ? ind.erro : null);
  const q = ex && ind && !('erro' in ex) && !('erro' in ind) ? quadrosDosIndicadores(ex.serie_mensal, ind.meses, meses, 'TOTAL', ind.gramas_por_bandeja) : null;
  const doMes = ind && !('erro' in ind) ? ind.meses.find((m) => m.mes === mes) : undefined;
  const at: Partial<AtualizacaoDosIndicadores> = (ind && !('erro' in ind) && ind.atualizacao) || {};
  const erp = ex && !('erro' in ex) ? ex.ultimo_lancamento : undefined;
  const card = (titulo: string, link: string, frente: FrenteDaGestao, grupo: GrupoDoCard, conteudo: ReactNode, atualizacao: string | null) => (
    <div key={titulo} className={`sintese-card card-indicadores card-grupo-${grupo}`}>
      <h4>{titulo}</h4>
      {conteudo}
      {q && <Atualizacao texto={atualizacao} />}
      {onInvestigar && <button type="button" className="gr-toggle" onClick={() => onInvestigar(frente)}>{link}</button>}
    </div>
  );
  const doPar = (corpo: (quadro: NonNullable<typeof q>) => ReactNode) => (falha ? <div className="empty">{`Indicadores indisponíveis (${falha}).`}</div>
    : !q ? <div className="loading">{`Apurando ${rotuloDoMes(meses[1])} e ${rotuloDoMes(meses[0])}…`}</div>
      : corpo(q));
  return (
    <>
      {card('2. Produção de Cogumelos: Eficiência', 'Investigar eficiência', 'cogumelo', 'eficiencia', doPar((x) => (
        <>
          <QuadroDaEficiencia quadro={paraOCard(x.eficiencia)} />
          <details className="notas-do-card"><summary>Como ler estes números</summary><Notas notas={x.eficiencia.notas} /></details>
          <DetalhePorCogumelo m={doMes} lado="producao" />
        </>
      )), textoDaAtualizacao({ producao: at.producao, vendas: at.vendas, erp }))}
      {card('3. Produção de Cogumelos: Volumes', 'Investigar volumes', 'cogumelo', 'volumes', doPar((x) => <><TabelaDeIndicadores quadro={x.volumes} /><Notas notas={x.volumes.notas} /></>),
        textoDaAtualizacao({ producao: at.producao, embalagem: at.embalagem, vendas: at.vendas }))}
      {card('4. Revenda de Cogumelos', 'Investigar revenda por produto', 'revenda', 'revenda', doPar((x) => (
        <>
          <TabelaDeIndicadores quadro={x.revenda} />
          <Notas notas={x.revenda.notas} />
          <DetalhePorCogumelo m={doMes} />
        </>
      )), textoDaAtualizacao({ vendas: at.vendas, erp }))}
    </>
  );
}

const PRODUCAO_NA_GESTAO: FrenteDaGestao[] = ['consolidado', 'producao', 'cogumelo'];
const REVENDA_NA_GESTAO: FrenteDaGestao[] = ['consolidado', 'revenda'];
export const temIndicadoresNaGestao = (frente: FrenteDaGestao) => PRODUCAO_NA_GESTAO.includes(frente) || REVENDA_NA_GESTAO.includes(frente);

export function IndicadoresNaGestao({ ex, ind, frente }: { ex: ExecutivoResposta; ind: Lido<IndicadoresDaProducaoResposta>; frente: FrenteDaGestao }) {
  const [recorte, setRecorte] = useState<Recorte>('TOTAL');
  const navegar = useNav();
  if (!temIndicadoresNaGestao(frente)) return null;
  if (!ind || (!('erro' in ind) && !mesmosMeses(ind.periodo, ex.periodo))) return <div className="loading">Apurando os indicadores de produção e revenda…</div>;
  if ('erro' in ind) return <div className="empty">{`Indicadores de produção e revenda indisponíveis (${ind.erro}).`}</div>;
  const meses = ind.meses.map((m) => m.mes);
  const q = quadrosDosIndicadores(ex.serie_mensal, ind.meses, meses, recorte, ind.gramas_por_bandeja);
  const comProducao = PRODUCAO_NA_GESTAO.includes(frente);
  const comRevenda = REVENDA_NA_GESTAO.includes(frente);
  const at: Partial<AtualizacaoDosIndicadores> = ind.atualizacao ?? {};
  return (
    <section id="indicadores-da-producao" className="indicadores-da-gestao">
      <h3>Produção e revenda mês a mês</h3>
      <p className="obs-tela">Os indicadores que explicam o resultado: se a produção ou as vendas caíram, se a contaminação subiu, se o custo por bloco subiu ou se a receita por bandeja caiu. A variação é a do último mês contra o anterior.</p>
      <Atualizacao texto={textoDaAtualizacao(comProducao
        ? { producao: at.producao, embalagem: at.embalagem, vendas: at.vendas, erp: ex.ultimo_lancamento }
        : { vendas: at.vendas, erp: ex.ultimo_lancamento })} />
      <label className="seletor-especie">
        {'Abrir por cogumelo: '}
        <select value={recorte} onChange={(e) => setRecorte(e.target.value as Recorte)}>
          <option value="TOTAL">Todos</option>
          {ESPECIES.map((v) => <option key={v} value={v}>{ROTULO_DA_VARIEDADE[v]}</option>)}
        </select>
      </label>
      {comProducao && (
        <>
          <div className="grupo-da-investigacao card-grupo-eficiencia">
            <h4>Produção de Cogumelos: Eficiência</h4>
            <QuadroDaEficiencia quadro={q.eficiencia} />
            <Notas notas={q.eficiencia.notas} />
            <DetalhePorCogumelo m={ind.meses[ind.meses.length - 1]} lado="producao" />
            {q.classificacao && (
              <>
                <h5>Classificação do Shiitake colhido no mês</h5>
                <TabelaDeIndicadores quadro={q.classificacao} />
                <p className="obs-tela">
                  {'Os últimos 10 dias contra os 10 anteriores, os lotes que mexeram no M, G e GG e a comparação de lotes por semente, maturação, receita e sala: '}
                  <button type="button" className="gr-toggle" onClick={() => navegar('painel_operacional', 'produtividade-e-qualidade')}>Produtividade e Qualidade, no Painel Operacional</button>{' (lá, escolha 10 dias no período, no topo do painel).'}
                </p>
              </>
            )}
            <DestinoDosBlocos ind={ind.meses} meses={meses} recorte={recorte} />
            <RendimentoPelaAbertura ind={ind.meses} meses={meses} recorte={recorte} gramasPorBandeja={ind.gramas_por_bandeja} />
          </div>
          <div className="grupo-da-investigacao card-grupo-volumes">
            <h4>Produção de Cogumelos: Volumes</h4>
            <TabelaDeIndicadores quadro={q.volumes} />
            <Notas notas={q.volumes.notas} />
          </div>
        </>
      )}
      {comRevenda && (
        <div className="grupo-da-investigacao card-grupo-revenda">
          <h4>Revenda de Cogumelos</h4>
          <TabelaDeIndicadores quadro={q.revenda} />
          <Notas notas={q.revenda.notas} />
          <DetalhePorCogumelo m={ind.meses[ind.meses.length - 1]} />
        </div>
      )}
    </section>
  );
}
