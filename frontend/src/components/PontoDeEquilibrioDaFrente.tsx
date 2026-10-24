import { brl, num } from '../api/client';
import { DEFINICOES, type ChaveDaDefinicao } from '../api/definicoes';
import type { ExecutivoResposta } from '../api/gerencial';
import { periodoNaDre } from './abrirNaDre';
import { fraseDoQuadroAfetado, linhasPendentesPorMes } from './AvisoDaFolha';
import { ComoECalculado } from './ComoECalculado';
import { rotuloDoPeriodo } from './EscadaDoAno';

type Dados = Pick<ExecutivoResposta, 'objetivos' | 'aconteceu' | 'volume' | 'periodo' | 'serie_mensal' | 'meses_sem_fato' | 'folha_pendente'>;

const periodoSoComFato = (ex: Dados) => (ex.meses_sem_fato?.length ?? 0) === 0;

export function pontoDeEquilibrioFisico(ex: Dados): { kg: number | null; bandejas: number | null } {
  const pe = ex.objetivos.ponto_equilibrio;
  const rl = ex.aconteceu.receita_liquida;
  const em = (q: number | null | undefined) => (periodoSoComFato(ex) && pe != null && rl != null && rl > 0 && q != null && q > 0 ? Math.round((pe * q) / rl) : null);
  return { kg: em(ex.volume?.kg), bandejas: em(ex.volume?.bandejas) };
}

export function pontoDeEquilibrioDoPeriodo(periodo: { inicio: string; fim: string }): { chave: ChaveDaDefinicao; nome: string } {
  const escopo = periodoNaDre(periodo)?.escopo;
  if (escopo === 'MES') return { chave: 'ponto_equilibrio_mes', nome: DEFINICOES.ponto_equilibrio_mes.nome };
  if (escopo === 'YTD') return { chave: 'ponto_equilibrio_ytd', nome: DEFINICOES.ponto_equilibrio_ytd.nome };
  return { chave: 'ponto_equilibrio_periodo', nome: DEFINICOES.ponto_equilibrio_periodo.nome };
}

export function pontoDeEquilibrioDoUltimoMes(ex: Dados): { mes: string; valor: number } | null {
  const pendentes = linhasPendentesPorMes(ex.folha_pendente);
  const semFato = new Set(ex.meses_sem_fato);
  const m = [...ex.serie_mensal].reverse().find((s) => !semFato.has(s.mes) && !pendentes.has(s.mes) && s.ponto_equilibrio != null);
  return m ? { mes: m.mes, valor: m.ponto_equilibrio as number } : null;
}

export function PontoDeEquilibrioDaFrente({ ex, comFisico = false, recorte, erro }: { ex: Dados | null; comFisico?: boolean; recorte: 'da Produção' | 'do Cogumelo'; erro?: string }) {
  if (!ex) {
    if (erro === undefined) return null;
    return <p className="obs-tela">{`Ponto de equilíbrio ${recorte} no período: ${erro ? `indisponível (${erro})` : 'calculando…'}`}</p>;
  }
  const pe = ex.objetivos.ponto_equilibrio;
  const f = comFisico ? pontoDeEquilibrioFisico(ex) : { kg: null, bandejas: null };
  const fisico = [f.kg != null ? `${num(f.kg)} kg` : null, f.bandejas != null ? `${num(f.bandejas)} bandejas` : null].filter(Boolean).join(' ou ');
  const semFisicoPorMes = comFisico && !periodoSoComFato(ex);
  const faltas = ex.objetivos.faltas.length > 0 ? ` (${ex.objetivos.faltas.join('; ')})` : '';
  const valor = pe != null
    ? `${brl(pe)}${fisico ? `, o mesmo que ${fisico}` : ''}${semFisicoPorMes ? ' (sem kg e bandejas: o período tem mês ainda sem dado carregado)' : ''}`
    : `não calculado${faltas}`;
  const { chave, nome } = pontoDeEquilibrioDoPeriodo(ex.periodo);
  const mes = pontoDeEquilibrioDoUltimoMes(ex);
  const repetido = mes != null && chave === 'ponto_equilibrio_mes' && ex.periodo.inicio.slice(0, 7) === mes.mes;
  const doMes = mes && !repetido ? `; ${DEFINICOES.ponto_equilibrio_mes.nome.toLowerCase()} (${rotuloDoPeriodo({ inicio: `${mes.mes}-01`, fim: `${mes.mes}-01` })}): ${brl(mes.valor)}` : '';
  const extra = [
    doMes ? `${DEFINICOES.ponto_equilibrio_mes.nome} = ${DEFINICOES.ponto_equilibrio_mes.formula}.` : null,
    doMes ? 'O do mês é o do mês mais recente com dado carregado, sem folha pendente e com ponto de equilíbrio calculável.' : null,
    comFisico ? `${DEFINICOES.ponto_equilibrio_fisico.nome} = ${DEFINICOES.ponto_equilibrio_fisico.formula}, com os kg colhidos e as bandejas embaladas do período.` : null,
  ].filter(Boolean).join(' ');
  return (
    <div className="pe-da-frente">
      <p className="obs-tela">{`${nome} ${recorte} (${rotuloDoPeriodo(ex.periodo)}): ${valor}${doMes}.`}</p>
      {(ex.folha_pendente?.length ?? 0) > 0 && <p className="obs-tela">{`⚠ ${fraseDoQuadroAfetado(`As contas do ${nome.replace(/^Ponto/, 'ponto')}`)}`}</p>}
      <ComoECalculado chave={chave} extra={extra || undefined} />
    </div>
  );
}
