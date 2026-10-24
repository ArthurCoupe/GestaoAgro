import type { ReactElement, ReactNode } from 'react';
import { brl, num, pct } from '../api/client';
import type { BlocoComposicao, ExecutivoContaminacao, ExecutivoResposta, LinhaComposicao } from '../api/gerencial';
import { nomeDaMeta, notaDoBudget, ressalvasDoBudget } from '../components/budgetNaTela';
import { Panel, periodoDoMes, Pill } from '../components/ui';
import { semLancamentos } from './Dashboard';
import type { EscopoDaTela } from '../components/FiltroDoPeriodo';

const cent = (v: number) => Math.round(v * 100);
const reais = (c: number) => c / 100 + 0;
const margem = (v: number) => `${v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;

export interface LinhaContraAMeta { rotulo: string; receita: number; resultado: number; meta: number; diferenca: number }
export interface ContraAMeta { meta_pct: number; linhas: LinhaContraAMeta[]; total: LinhaContraAMeta }

export function contraAMeta(ex: Pick<ExecutivoResposta, 'aconteceu' | 'atividades'>): ContraAMeta | null {
  const { receita_liquida: receita, resultado_operacional: resultado, meta_pct: m } = ex.aconteceu;
  if (receita == null || resultado == null || receita === 0) return null;
  const partes = ex.atividades
    .filter((a) => a.receita !== 0 || a.resultado !== 0)
    .map((a) => ({ rotulo: a.rotulo, receita: cent(a.receita), resultado: cent(a.resultado) }));
  const sobra = { rotulo: 'Fora dos negócios', receita: cent(receita), resultado: cent(resultado) };
  for (const p of partes) { sobra.receita -= p.receita; sobra.resultado -= p.resultado; }
  if (sobra.receita !== 0 || sobra.resultado !== 0) partes.push(sobra);
  const alvo = Math.round((m / 100) * cent(receita));
  const exatas = partes.map((p) => (m * p.receita) / 100);
  const metas = exatas.map(Math.floor);
  const falta = alvo - metas.reduce((s, x) => s + x, 0);
  exatas.map((e, i) => ({ i, fracao: e - metas[i] }))
    .sort((a, b) => b.fracao - a.fracao)
    .slice(0, falta)
    .forEach(({ i }) => { metas[i] += 1; });
  const linhas = partes
    .map((p, i) => ({ rotulo: p.rotulo, receita: reais(p.receita), resultado: reais(p.resultado), meta: reais(metas[i]), diferenca: reais(p.resultado - metas[i]) }))
    .sort((a, b) => Math.abs(b.diferenca) - Math.abs(a.diferenca));
  return {
    meta_pct: m,
    linhas,
    total: { rotulo: 'TOTAL', receita, resultado, meta: reais(alvo), diferenca: reais(cent(resultado) - alvo) },
  };
}

const NOME_DO_BLOCO = { receita: 'receita', custos: 'custo', despesas: 'despesa' } as const;
function linhasDoPeriodo(ex: Pick<ExecutivoResposta, 'composicao'>) {
  const m = new Map<string, { rotulo: string; bloco: BlocoComposicao; valor: number }>();
  for (const bloco of Object.keys(NOME_DO_BLOCO) as BlocoComposicao[]) {
    for (const l of (ex.composicao?.[bloco] ?? []) as LinhaComposicao[]) {
      const atual = m.get(l.linha_id);
      m.set(l.linha_id, { rotulo: l.rotulo ?? l.codigo_oficial ?? l.linha_id, bloco, valor: (atual?.valor ?? 0) + cent(l.valor) });
    }
  }
  return m;
}

function variacoesPorLinha(ex: Pick<ExecutivoResposta, 'composicao'>, ant: Pick<ExecutivoResposta, 'composicao'>) {
  const atual = linhasDoPeriodo(ex);
  const anterior = linhasDoPeriodo(ant);
  return [...new Set([...atual.keys(), ...anterior.keys()])]
    .map((id) => {
      const a = atual.get(id);
      const b = anterior.get(id);
      return {
        rotulo: a?.rotulo ?? b?.rotulo ?? id, bloco: (a?.bloco ?? b?.bloco) as BlocoComposicao,
        anterior: b?.valor ?? 0, atual: a?.valor ?? 0, efeito: (a?.valor ?? 0) - (b?.valor ?? 0),
      };
    })
    .filter((v) => v.efeito !== 0);
}

const variacaoPct = (variacao: number, anterior: number) => (anterior === 0 ? null : (variacao / Math.abs(anterior)) * 100);

export const DEMAIS = 'Demais linhas da DRE (líquido)';

export type EfeitoDoQuadro = 'AJUDOU' | 'PRESSIONOU' | 'MELHOROU' | 'PIOROU' | 'IGUAL';
export interface LinhaDoQuadro { rotulo: 'Receita' | 'Custos' | 'Despesas' | 'Resultado'; anterior: number; atual: number; variacao: number; variacao_pct: number | null; efeito: EfeitoDoQuadro }

const QUADRO = [
  ['Receita', 'receita_liquida', 'AJUDOU', 'PRESSIONOU'],
  ['Custos', 'custos', 'PRESSIONOU', 'AJUDOU'],
  ['Despesas', 'despesas', 'PRESSIONOU', 'AJUDOU'],
  ['Resultado', 'resultado_operacional', 'MELHOROU', 'PIOROU'],
] as const;

export function quadroDaVariacao(
  ex: Pick<ExecutivoResposta, 'aconteceu'>,
  ant: Pick<ExecutivoResposta, 'aconteceu'>,
): LinhaDoQuadro[] | null {
  const linhas: LinhaDoQuadro[] = [];
  for (const [rotulo, campo, sobe, cai] of QUADRO) {
    const atual = ex.aconteceu[campo];
    const anterior = ant.aconteceu[campo];
    if (atual == null || anterior == null) return null;
    const v = cent(atual) - cent(anterior);
    linhas.push({ rotulo, anterior, atual, variacao: reais(v), variacao_pct: variacaoPct(v, cent(anterior)), efeito: v === 0 ? 'IGUAL' : v > 0 ? sobe : cai });
  }
  return linhas;
}

export type Alavanca = 'Preço' | 'Custos' | 'Despesas';
export interface LinhaDePrioridade { prioridade: number; rotulo: string; bloco: BlocoComposicao; anterior: number; atual: number; variacao: number; variacao_pct: number | null; efeito: number; alavanca: Alavanca }
const ALAVANCA: Record<BlocoComposicao, Alavanca> = { receita: 'Preço', custos: 'Custos', despesas: 'Despesas' };

export function prioridadesDaVariacao(
  ex: Pick<ExecutivoResposta, 'aconteceu' | 'composicao'>,
  ant: Pick<ExecutivoResposta, 'aconteceu' | 'composicao'>,
  maximo = 4,
): { linhas: LinhaDePrioridade[]; demais: number; total: number } | null {
  const r = ex.aconteceu.resultado_operacional;
  const ra = ant.aconteceu.resultado_operacional;
  if (r == null || ra == null) return null;
  const escolhidas = variacoesPorLinha(ex, ant)
    .sort((x, y) => Math.abs(y.efeito) - Math.abs(x.efeito))
    .slice(0, maximo);
  const negativas = escolhidas.filter((v) => v.efeito < 0).sort((x, y) => x.efeito - y.efeito);
  const positivas = escolhidas.filter((v) => v.efeito > 0).sort((x, y) => y.efeito - x.efeito);
  const total = cent(r) - cent(ra);
  return {
    linhas: [...negativas, ...positivas].map((v, i) => {
      const lado = v.bloco === 'receita' ? 1 : -1;
      const [anterior, atual] = [lado * v.anterior, lado * v.atual];
      return {
        prioridade: i + 1, rotulo: v.rotulo, bloco: v.bloco, anterior: reais(anterior), atual: reais(atual),
        variacao: reais(atual - anterior), variacao_pct: variacaoPct(atual - anterior, anterior), efeito: reais(v.efeito), alavanca: ALAVANCA[v.bloco],
      };
    }),
    demais: reais(total - escolhidas.reduce((s, v) => s + v.efeito, 0)),
    total: reais(total),
  };
}

export function fraseDaVariacao(
  ex: Pick<ExecutivoResposta, 'aconteceu' | 'composicao'>,
  ant: Pick<ExecutivoResposta, 'aconteceu' | 'composicao'>,
): string | null {
  const p = prioridadesDaVariacao(ex, ant, Infinity);
  if (!p) return null;
  const melhora = p.linhas.find((l) => l.efeito > 0);
  const pressao = p.linhas.find((l) => l.efeito < 0);
  return [
    p.total === 0 ? 'O resultado ficou igual.' : `O resultado ${p.total > 0 ? 'melhorou' : 'piorou'} ${brl(Math.abs(p.total))}.`,
    melhora ? `O principal fator de melhora foi ${melhora.rotulo}.` : 'Nenhuma linha da DRE ajudou.',
    pressao ? `A principal pressão foi ${pressao.rotulo}.` : 'Nenhuma linha da DRE pressionou.',
  ].join(' ');
}

export interface LinhaContraOBudget { rotulo: string; budget: number; realizado: number; efeito: number }

export function contraOBudget(ex: Pick<ExecutivoResposta, 'aconteceu' | 'budget' | 'contra_o_budget'>, maximo = 4):
  { linhas: LinhaContraOBudget[]; total: LinhaContraOBudget } | null {
  const r = ex.aconteceu.resultado_operacional;
  const b = ex.budget?.estado === 'COMPARADO' ? ex.budget.por_card?.resultado_operacional?.budget_cent ?? null : null;
  if (r == null || b == null || !ex.contra_o_budget) return null;
  const linhas = ex.contra_o_budget
    .map((l) => ({
      rotulo: `${l.rotulo ?? l.codigo_oficial ?? l.linha_id} (${NOME_DO_BLOCO[l.bloco]})`,
      budget: cent(l.budget), realizado: cent(l.realizado), efeito: cent(l.realizado) - cent(l.budget),
    }))
    .filter((l) => l.efeito !== 0)
    .sort((x, y) => Math.abs(y.efeito) - Math.abs(x.efeito))
    .slice(0, maximo);
  const demais = {
    rotulo: DEMAIS,
    budget: b - linhas.reduce((s, l) => s + l.budget, 0),
    realizado: cent(r) - linhas.reduce((s, l) => s + l.realizado, 0),
    efeito: 0,
  };
  demais.efeito = demais.realizado - demais.budget;
  const emReais = (l: LinhaContraOBudget) => ({ rotulo: l.rotulo, budget: reais(l.budget), realizado: reais(l.realizado), efeito: reais(l.efeito) });
  return {
    linhas: [...linhas, ...(demais.budget || demais.realizado ? [demais] : [])].map(emReais),
    total: { rotulo: 'TOTAL', budget: reais(b), realizado: r, efeito: reais(cent(r) - b) },
  };
}

export function periodoAnterior(escopo: EscopoDaTela, intervalo: { inicio: string; fim: string }) {
  const passo = escopo === 'MES' ? 1 : 12;
  const idx = (iso: string) => Number(iso.slice(0, 4)) * 12 + Number(iso.slice(5, 7)) - 1 - passo;
  const [i, f] = [idx(intervalo.inicio), idx(intervalo.fim)];
  const pi = periodoDoMes(Math.floor(i / 12), i % 12);
  const pf = periodoDoMes(Math.floor(f / 12), f % 12);
  return { inicio: pi.inicio, fim: pf.fim, rotulo: i === f ? pf.rotulo : `${pi.rotulo} a ${pf.rotulo}` };
}

export function perdasAcimaDaMeta(c: ExecutivoContaminacao | null | undefined) {
  if (!c || c.taxa_pct == null || c.meta_pct == null || c.custo_medio_bloco == null || c.taxa_pct <= c.meta_pct) return null;
  const blocos = Math.round(((c.taxa_pct - c.meta_pct) / 100) * c.blocos_produzidos);
  return blocos > 0 ? { taxa: c.taxa_pct, meta: c.meta_pct, blocos, reais: reais(blocos * cent(c.custo_medio_bloco)) } : null;
}

export interface Comparacao { atual: string; anterior: string; ex: ExecutivoResposta | { erro: string } | null; escopo?: EscopoDaTela }

const valor = (v: number) => <td className={`num${v < 0 ? ' neg' : ''}`}>{brl(v)}</td>;
const variacaoEmReais = (v: number) => <td className={`num${v < 0 ? ' neg' : ''}`}>{`${v > 0 ? '+' : ''}${brl(v)}`}</td>;
const variacaoEmPct = (p: number | null) => {
  if (p == null) return <td className="num">—</td>;
  const t = Math.abs(p).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return <td className="num">{t === '0,0' ? '0,0%' : `${p > 0 ? '+' : '-'}${t}%`}</td>;
};
const TOM_DO_EFEITO: Record<EfeitoDoQuadro, 'ok' | 'bad' | 'neutral'> = { AJUDOU: 'ok', MELHOROU: 'ok', PRESSIONOU: 'bad', PIOROU: 'bad', IGUAL: 'neutral' };
const efeito = (e: EfeitoDoQuadro) => <td><Pill tone={TOM_DO_EFEITO[e]}>{e}</Pill></td>;

function baseDaComparacao(ex: ExecutivoResposta, c: Comparacao): { ant: ExecutivoResposta } | { aviso: ReactElement } {
  const ant = c.ex;
  if (!ant) return { aviso: <div className="loading">{`Apurando ${c.anterior}…`}</div> };
  if ('erro' in ant) return { aviso: <div className="empty">{`Comparação indisponível (${ant.erro}).`}</div> };
  if (semLancamentos(ant) || ant.meses_sem_fato.length > 0) {
    const frase = c.escopo === 'YTD' || c.escopo === '12M' || c.escopo === 'PERSONALIZADO'
      ? `Sem o mesmo período do ano anterior na base (${c.anterior}): por enquanto a leitura é a do próprio período. A comparação entre anos aparece quando houver histórico comparável.`
      : semLancamentos(ant) ? `Sem base de comparação: ${c.anterior} não tem lançamentos apurados no sistema.`
        : `Sem base de comparação: ${c.anterior} tem mês sem nenhum lançamento apurado no sistema.`;
    return { aviso: <p className="obs-tela">{frase}</p> };
  }
  if (ex.aconteceu.resultado_operacional == null || ant.aconteceu.resultado_operacional == null) {
    const qual = ex.aconteceu.resultado_operacional == null ? c.atual : c.anterior;
    return { aviso: <p className="obs-tela">{`Resultado operacional indisponível em ${qual}: a comparação não tem base.`}</p> };
  }
  return { ant };
}

export function anteriorComparavel(ex: ExecutivoResposta, c?: Comparacao): ExecutivoResposta | null {
  if (!c) return null;
  const base = baseDaComparacao(ex, c);
  return 'ant' in base ? base.ant : null;
}

export function SecaoPorQueMudou({ ex, comparacao: c }: { ex: ExecutivoResposta; comparacao: Comparacao }) {
  const painel = (conteudo: ReactNode) => <Panel title="Por que o resultado mudou?" sub={`${c.atual} contra ${c.anterior}`}>{conteudo}</Panel>;
  const base = baseDaComparacao(ex, c);
  if ('aviso' in base) return painel(base.aviso);
  const frase = <p>{fraseDaVariacao(ex, base.ant)}</p>;
  const q = quadroDaVariacao(ex, base.ant);
  if (!q) {
    const a = ex.aconteceu;
    const qual = a.receita_liquida == null || a.custos == null || a.despesas == null ? c.atual : c.anterior;
    return painel(<>{frase}<p className="obs-tela">{`Receita, custos ou despesas indisponíveis em ${qual}: o quadro não tem base.`}</p></>);
  }
  const maior = Math.max(...q.flatMap((l) => [Math.abs(l.anterior), Math.abs(l.atual)]));
  const barra = (v: number, qual: 'anterior' | 'atual') => (
    <span className={`b-${qual}${v < 0 ? ' neg' : ''}`} style={{ width: `${maior ? Math.round((Math.abs(v) / maior) * 1000) / 10 : 0}%` }} />
  );
  return painel(
    <>
      {frase}
      <div className="tbl-scroll">
        <table className="tbl">
          <thead><tr><th>Linha</th><th>Comparação</th><th className="num">{c.anterior}</th><th className="num">{c.atual}</th><th className="num">Variação (R$)</th><th className="num">Variação (%)</th><th>Efeito</th></tr></thead>
          <tbody>
            {q.map((l) => (
              <tr key={l.rotulo}>
                <td>{l.rotulo}</td>
                <td><div className="barras-par" aria-hidden="true">{barra(l.anterior, 'anterior')}{barra(l.atual, 'atual')}</div></td>
                {valor(l.anterior)}{valor(l.atual)}{variacaoEmReais(l.variacao)}{variacaoEmPct(l.variacao_pct)}{efeito(l.efeito)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="obs-tela">Custos e despesas positivos pesam no resultado: subir pressiona. Negativo é crédito (estorno maior que o lançamento). Receita − Custos − Despesas = Resultado operacional, em cada período.</p>
    </>,
  );
}

export function SecaoOndeAgir({ ex, comparacao: c }: { ex: ExecutivoResposta; comparacao: Comparacao }) {
  const painel = (conteudo: ReactNode) => (
    <Panel title="Variação por linha da DRE" sub={`As linhas da DRE que mais mexeram no resultado contra ${c.anterior}: primeiro a maior pressão, por último o que ajudou`}>
      {conteudo}
    </Panel>
  );
  const base = baseDaComparacao(ex, c);
  if ('aviso' in base) return painel(base.aviso);
  const p = prioridadesDaVariacao(ex, base.ant)!;
  if (p.linhas.length === 0 && p.total === 0) return painel(<p className="obs-tela">{`Nenhuma linha da DRE mudou contra ${c.anterior}.`}</p>);
  const vazias = (n: number) => Array.from({ length: n }, (_, i) => <td key={i} />);
  return painel(
    <>
      <div className="tbl-scroll">
        <table className="tbl">
          <thead>
            <tr>
              <th>Prioridade</th><th>Item</th><th className="num">{c.anterior}</th><th className="num">{c.atual}</th><th className="num">Variação (R$)</th>
              <th className="num">Variação (%)</th><th>Efeito no resultado</th><th className="num">Efeito em R$</th><th>Alavanca</th>
            </tr>
          </thead>
          <tbody>
            {p.linhas.map((l) => (
              <tr key={l.prioridade}>
                <td>{l.prioridade}</td><td>{l.rotulo}</td>{valor(l.anterior)}{valor(l.atual)}{variacaoEmReais(l.variacao)}{variacaoEmPct(l.variacao_pct)}
                {efeito(l.efeito < 0 ? 'PRESSIONOU' : 'AJUDOU')}{variacaoEmReais(l.efeito)}
                <td>{l.alavanca}</td>
              </tr>
            ))}
            {p.demais !== 0 && <tr><td /><td>Demais linhas da DRE</td>{vazias(5)}{variacaoEmReais(p.demais)}<td /></tr>}
            <tr className="ln-total"><td /><td>TOTAL</td>{vazias(4)}{efeito(p.total === 0 ? 'IGUAL' : p.total > 0 ? 'MELHOROU' : 'PIOROU')}{variacaoEmReais(p.total)}<td /></tr>
          </tbody>
        </table>
      </div>
      <p className="obs-tela">Custo e despesa em valor positivo: subir pressiona o resultado. A coluna Efeito em R$ soma a variação do resultado, com as demais linhas da DRE.</p>
    </>,
  );
}

function ContraOBudget({ ex, comMeta }: { ex: ExecutivoResposta; comMeta: boolean }) {
  if (!ex.budget) return null;
  const titulo = <h4>Contra o Budget do período: onde o resultado saiu do previsto</h4>;
  const v = contraOBudget(ex);
  const ressalvas = ressalvasDoBudget(ex.budget);
  if (!v) {
    const nota = ex.budget.estado !== 'COMPARADO' ? notaDoBudget(ex.budget)
      : ex.aconteceu.resultado_operacional == null || ex.budget.por_card?.resultado_operacional == null
        ? 'Sem o resultado operacional do período ou do Budget: a comparação linha a linha não tem base.'
        : ['O Budget por linha não pôde ser montado: a comparação linha a linha não aparece. Avise a equipe técnica.', ressalvas].filter(Boolean).join(' ');
    return <>{titulo}<p className="obs-tela">{nota}</p></>;
  }
  const t = v.total;
  return (
    <>
      {titulo}
      <p className="obs-tela">
        Resultado operacional de {brl(t.realizado)} contra {brl(t.budget)} do Budget:{' '}
        {t.efeito === 0 ? 'igual ao previsto' : `${brl(Math.abs(t.efeito))} ${t.efeito > 0 ? 'melhor' : 'pior'} que o previsto`}.
        {comMeta && ex.aconteceu.meta_origem === 'BUDGET' && ' A meta acima aplica a margem do Budget, arredondada a duas casas, à receita realizada; aqui o resultado é comparado com o resultado previsto em valor. As duas diferenças se afastam quando a receita sai diferente da prevista.'}
        {' '}Abaixo, as linhas da DRE que mais afastaram o resultado do Budget; custo e despesa entram com sinal negativo, como
        na DRE, e efeito positivo é favorável. Conta prevista e sem lançamento entra com realizado zero; conta lançada e sem
        Budget entra com Budget zero. A linha {DEMAIS} traz o valor somado de todas as outras linhas.{ressalvas ? ` ${ressalvas}` : ''}
      </p>
      <div className="tbl-scroll">
        <table className="tbl">
          <thead><tr><th>Linha da DRE</th><th className="num">Budget</th><th className="num">Realizado</th><th className="num">Efeito no resultado</th></tr></thead>
          <tbody>
            {[...v.linhas, t].map((l, i) => (
              <tr key={i} className={l === t ? 'ln-total' : undefined}>
                <td>{l.rotulo}</td>{valor(l.budget)}{valor(l.realizado)}{valor(l.efeito)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function SecaoPorQueEstamosAqui({ ex, onAbrirDre }: { ex: ExecutivoResposta; onAbrirDre?: () => void }) {
  const meta = contraAMeta(ex);
  const perdas = perdasAcimaDaMeta(ex.contaminacao);
  const d = meta?.total.diferenca ?? 0;
  return (
    <Panel title="Por negócio, contra a meta" tag={ex.etiqueta} sub="Os principais fatores que explicam a diferença para a meta, em R$">
      {!meta ? (
        <p className="obs-tela">
          {ex.aconteceu.resultado_operacional == null ? 'Resultado operacional indisponível no período' : 'Sem receita apurada no período'}: a
          diferença para a meta não tem base.
        </p>
      ) : (
        <>
          <p>
            <b>Resultado operacional {d === 0 ? 'exatamente na meta' : `${brl(Math.abs(d))} ${d < 0 ? 'abaixo' : 'acima'} da meta`}</b>
            {' '}({nomeDaMeta(ex.aconteceu.meta_origem)} de {margem(meta.meta_pct)} sobre a receita líquida: {brl(meta.total.meta)}).
          </p>
          <div className="tbl-scroll">
            <table className="tbl">
              <thead><tr><th>Negócio</th><th className="num">Receita líquida</th><th className="num">Resultado</th><th className="num">Meta ({margem(meta.meta_pct)} da receita)</th><th className="num">Diferença para a meta</th></tr></thead>
              <tbody>
                {[...meta.linhas, meta.total].map((l) => (
                  <tr key={l.rotulo} className={l === meta.total ? 'ln-total' : undefined}>
                    <td>{l.rotulo}</td>{valor(l.receita)}{valor(l.resultado)}{valor(l.meta)}{valor(l.diferenca)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="obs-tela">
            Cada negócio tem a mesma meta de margem sobre a própria receita. Linha sem receita tem meta zero, e a diferença
            dela é o próprio resultado; linha com receita negativa (estorno ou ajuste) tem meta negativa, na mesma margem.
            Diferença negativa puxa o resultado para baixo da meta.
          </p>
        </>
      )}
      {perdas && (
        <p className="obs-tela">
          Perdas: a contaminação do período ficou em {pct(perdas.taxa)}, contra a meta de {pct(perdas.meta)}. Os {num(perdas.blocos)} blocos
          acima da meta custaram {brl(perdas.reais)}, valor que já está dentro dos custos do período e não se soma de novo.
        </p>
      )}
      <ContraOBudget ex={ex} comMeta={meta != null} />
      {onAbrirDre && <p className="obs-tela"><button type="button" className="gr-toggle" onClick={onAbrirDre}>Ver todas as linhas na DRE Gerencial</button></p>}
    </Panel>
  );
}
