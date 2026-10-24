import type { ReactNode } from 'react';
import { brlK, num, pct } from '../../api/client';
import { DEFINICOES } from '../../api/definicoes';
import type { AlavancasResposta, ExecutivoResposta } from '../../api/gerencial';
import { fraseDoQuadroAfetado } from '../AvisoDaFolha';
import { pctDaMeta } from '../budgetNaTela';
import { ComoECalculado } from '../ComoECalculado';
import { Panel } from '../ui';
import { distanciaEmReais } from './ResumoDaMeta';

export const LIMITE_DA_REDUCAO = 100;

function reducao(nome: 'custos' | 'despesas', c: AlavancasResposta['custos']): string | null {
  const titulo = nome === 'custos' ? 'Custos' : 'Despesas';
  if (!c || c.pct == null) return `${titulo}: sem ${nome} a reduzir no período, a redução não se calcula.`;
  if (Math.round(Math.abs(c.pct) * 10) / 10 >= LIMITE_DA_REDUCAO) return `Redução de ${nome} isoladamente não é suficiente para atingir a meta.`;
  return `${titulo}: reduzir ${pct(Math.abs(c.pct))} (${brlK(Math.abs(c.reais))} no período).`;
}

export function linhasDosCenarios(a: AlavancasResposta): string[] {
  if (a.gap == null || a.ja_atingido) return [];
  const c = a.contaminacao;
  return [
    a.preco && `Preço: aumentar ${pct(a.preco.pct)} (${brlK(a.preco.reais)} a mais de receita no período).`,
    reducao('custos', a.custos),
    reducao('despesas', a.despesas),
    c && c.blocos_recuperaveis > 0 && `Contaminação: voltar de ${pct(c.taxa_pct)} para a meta de ${pct(c.meta_pct)} recupera ${brlK(c.impacto_reais)} (${num(c.blocos_recuperaveis)} blocos)${c.cobre_gap ? ' e sozinha fecha a distância' : ', mas sozinha não fecha a distância'}.`,
  ].filter((l): l is string => !!l);
}

export function CenariosDaMeta({ ex, simulacoes }: {
  ex: Pick<ExecutivoResposta, 'alavancas' | 'etiqueta' | 'aconteceu' | 'folha_pendente'>;
  simulacoes?: ReactNode;
}) {
  const a = ex.alavancas.META;
  const semReceita = (ex.aconteceu.receita_liquida ?? 0) <= 0;
  const aberta = a != null && !semReceita && a.gap != null && !a.ja_atingido;
  return (
    <Panel title="Cenários para atingir a meta" tag={ex.etiqueta} id="gestao-cenarios"
      sub={aberta ? `Distância de ${distanciaEmReais(a.gap ?? 0)} até a meta de ${pctDaMeta(a.objetivo_pct)}: o quanto cada alavanca, sozinha, teria de mudar para fechá-la.` : undefined}>
      {!a ? <p className="obs-tela">Cenários indisponíveis no período.</p>
        : semReceita || a.gap == null ? <p className="obs-tela">Sem receita positiva no período: os cenários não se calculam.</p>
          : a.ja_atingido ? <p className="obs-tela">Meta atingida no período: nenhum cenário é necessário.</p>
            : <ul className="cenarios">{linhasDosCenarios(a).map((l) => <li key={l}>{l}</li>)}</ul>}
      {(ex.folha_pendente?.length ?? 0) > 0 && <p className="obs-tela">{`⚠ ${fraseDoQuadroAfetado('A distância e os cenários')}`}</p>}
      <p className="obs-tela">{`${DEFINICOES.cenarios.nota} Cada linha é uma alavanca sozinha, com as quantidades constantes; as linhas não se somam.`}</p>
      {simulacoes != null && (
        <details className="cenarios-simulacoes">
          <summary>Ver simulações</summary>
          {simulacoes}
        </details>
      )}
      <ComoECalculado chave="cenarios" />
    </Panel>
  );
}
