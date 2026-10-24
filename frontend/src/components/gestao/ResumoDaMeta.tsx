import { brl, brlK, comUmaCasa, pct } from '../../api/client';
import { tomDaMargem, type ExecutivoAconteceu, type ExecutivoResposta } from '../../api/gerencial';
import { fraseDoQuadroAfetado } from '../AvisoDaFolha';
import { budgetNoCard, notaDaMetaSemBudget, pctDaMeta, ressalvasDoBudget, StatusDoBudget } from '../budgetNaTela';
import { ComoECalculado } from '../ComoECalculado';
import { ONDE_SE_EDITA_A_META } from '../MetaDaEmpresa';
import { pontoDeEquilibrioDoPeriodo } from '../PontoDeEquilibrioDaFrente';
import { Kpi, Panel } from '../ui';

export type DistanciaParaAMeta = { estado: 'SEM_RECEITA' } | { estado: 'ABAIXO' | 'ATINGIDA'; reais: number; pontos: number };

export function distanciaParaAMeta(a: Pick<ExecutivoAconteceu, 'receita_liquida' | 'resultado_operacional' | 'margem_liquida_pct' | 'meta_pct'>,
  casasDaMargem: 1 | 2 = 2): DistanciaParaAMeta {
  const { receita_liquida: receita, resultado_operacional: resultado, margem_liquida_pct: margem, meta_pct: meta } = a;
  if (receita == null || receita <= 0 || resultado == null || margem == null) return { estado: 'SEM_RECEITA' };
  const alvo = Math.round((meta / 100) * Math.round(receita * 100));
  const falta = alvo - Math.round(resultado * 100);
  const escrito = (v: number, casas: number) => Math.round(Number(v.toLocaleString('en-US', { maximumFractionDigits: casas, useGrouping: false })) * 100);
  const pontos = (escrito(meta, 2) - escrito(margem, casasDaMargem)) / 100;
  return falta > 0 ? { estado: 'ABAIXO', reais: falta / 100, pontos: Math.max(pontos, 0) + 0 }
    : { estado: 'ATINGIDA', reais: -falta / 100 + 0, pontos: Math.max(-pontos, 0) + 0 };
}

export const distanciaEmReais = (v: number) => (Math.abs(v) < 1000 ? brl(v) : brlK(v));

export const pontosPercentuais = (v: number) => `${(comUmaCasa(v) + 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} p.p.`;
const pontosDaDistancia = (pontos: number, reais: number) =>
  (reais === 0 ? '0 p.p.' : comUmaCasa(pontos) === 0 ? 'menos de 0,1 p.p.' : pontosPercentuais(pontos));

export function ResumoDaMeta({ ex }: { ex: Pick<ExecutivoResposta, 'aconteceu' | 'objetivos' | 'budget' | 'periodo' | 'etiqueta' | 'folha_pendente'> }) {
  const a = ex.aconteceu;
  const o = ex.objetivos;
  const doBudget = a.meta_origem === 'BUDGET';
  const pctDoCard = doBudget ? pctDaMeta : pct;
  const minima = a.margem_minima_pct ?? null;
  const temReceita = a.receita_liquida != null && a.receita_liquida > 0;
  const margem = temReceita ? a.margem_liquida_pct : null;
  const tom = tomDaMargem(margem, a.meta_pct, minima);
  const d = distanciaParaAMeta(a, doBudget ? 2 : 1);
  const pc = ex.budget?.estado === 'COMPARADO' ? ex.budget.por_card ?? {} : null;
  const b = pc?.resultado_operacional;
  const { chave: chaveDoPe, nome: nomeDoPe } = pontoDeEquilibrioDoPeriodo(ex.periodo);
  const seguranca = !temReceita || o.margem_seguranca_pct == null ? ''
    : ` · margem de segurança ${pct(o.margem_seguranca_pct)}${o.margem_seguranca_reais != null ? ` (${brlK(o.margem_seguranca_reais)})` : ''}`
      + (o.margem_seguranca_pct < 0 ? ', receita abaixo do ponto de equilíbrio' : '');
  const faltas = o.faltas.join('; ');
  const linhaDoPe = o.ponto_equilibrio != null
    ? `${nomeDoPe}: ${brlK(o.ponto_equilibrio)}${seguranca}${!o.disponivel && faltas ? ` · ${faltas}` : ''}`
    : `${nomeDoPe}: não calculado${faltas ? ` (${faltas})` : ''}.`;
  return (
    <Panel title="Como estamos?" tag={ex.etiqueta} id="gestao-como-estamos" sub="O resultado do período contra a meta da empresa.">
      <div className={`kpi-grid ${b ? 'k5' : 'k4'}`}>
        <Kpi label="Resultado operacional" value={brlK(a.resultado_operacional)}
          tone={a.resultado_operacional == null ? 'info' : a.resultado_operacional < 0 ? 'alert' : 'good'} />
        <Kpi label="Margem operacional" value={pctDoCard(margem)} tone={tom} />
        <Kpi label="Meta" value={pctDaMeta(a.meta_pct)} tone="info"
          delta={`${doBudget ? 'margem operacional do Budget aprovado no período' : `margem desejada, ${ONDE_SE_EDITA_A_META}`}${minima != null ? ` · mínima ${pctDaMeta(minima)}` : ''}`} />
        {d.estado === 'SEM_RECEITA' && <Kpi label="Distância para a meta" value="—" tone="info"
          delta={temReceita ? 'Resultado indisponível no período: a distância não se calcula.' : 'Sem receita no período: a distância não se calcula.'} />}
        {d.estado === 'ABAIXO' && <Kpi label="Distância para a meta" value={distanciaEmReais(d.reais)} tone={tom} delta={`${pontosDaDistancia(d.pontos, d.reais)} abaixo da meta`} />}
        {d.estado === 'ATINGIDA' && <Kpi label="Distância para a meta" value="Meta atingida" tone="good" delta={`${distanciaEmReais(d.reais)} e ${pontosDaDistancia(d.pontos, d.reais)} acima da meta`} />}
        {b && <Kpi label="Realizado x Budget" value={<StatusDoBudget b={b} />} delta={budgetNoCard(b)} />}
      </div>
      <ComoECalculado chave={['resultado_operacional', 'margem_operacional', 'distancia_meta']} />
      <p className="obs-tela linha-do-equilibrio">{linhaDoPe}</p>
      <ComoECalculado chave={chaveDoPe} />
      {ex.folha_pendente && ex.folha_pendente.length > 0 && <p className="obs-tela">⚠ {fraseDoQuadroAfetado('Resultado, margem, distância e ponto de equilíbrio')}</p>}
      {ex.budget && !doBudget && <p className="obs-tela">{notaDaMetaSemBudget(ex.budget)}</p>}
      {ex.budget && doBudget && ressalvasDoBudget(ex.budget) && <p className="obs-tela">{ressalvasDoBudget(ex.budget)}</p>}
    </Panel>
  );
}
