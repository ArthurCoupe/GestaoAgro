import { brl, comUmaCasa, pct } from '../api/client';
import { rotuloDoMes } from '../api/alertas';
import { dataBr } from '../api/constantes';
import type { ExecutivoResposta, ExecutivoSerieMensal } from '../api/gerencial';
import { pctDaMeta } from './budgetNaTela';
import { pontosPercentuais } from './gestao/ResumoDaMeta';

const cent = (v: number) => Math.round(v * 100);
export const reais = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 });

export interface MesSemFolha {
  mes: string; receita: number; custos: number; despesas: number; resultado: number; margem_pct: number | null;
  folha: number;
}

export function semFolhaDoMes(s: ExecutivoSerieMensal, folha: ReadonlySet<string>): MesSemFolha | null {
  if (s.receita_liquida == null || s.custos == null || s.despesas == null || s.resultado_operacional == null) return null;
  let custo = 0;
  let despesa = 0;
  for (const l of s.linhas) {
    if (!folha.has(l.linha_id)) continue;
    if (l.grupo === 3) custo -= cent(l.valor);
    else if (l.grupo === 4 || l.grupo === 5) despesa -= cent(l.valor);
  }
  const receita = cent(s.receita_liquida);
  const resultado = cent(s.resultado_operacional) + custo + despesa;
  return {
    mes: s.mes, receita: receita / 100, custos: (cent(s.custos) - custo) / 100, despesas: (cent(s.despesas) - despesa) / 100,
    resultado: resultado / 100, margem_pct: receita > 0 ? Math.round((resultado / receita) * 10000) / 100 : null, folha: (custo + despesa) / 100,
  };
}

export function mesAnterior(mes: string): string {
  const [a, m] = mes.split('-').map(Number);
  return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, '0')}`;
}

export const intervaloDoPar = (fim: string) => ({ inicio: `${mesAnterior(fim.slice(0, 7))}-01`, fim });
export const mesmosMeses = (a: { inicio: string; fim: string }, b: { inicio: string; fim: string }) =>
  a.inicio.slice(0, 7) === b.inicio.slice(0, 7) && a.fim.slice(0, 7) === b.fim.slice(0, 7);

export function variacaoPct(atual: number, anterior: number): number | null {
  if (cent(anterior) === 0) return null;
  return Math.round(((atual - anterior) / Math.abs(anterior)) * 1000) / 10;
}

type ParDoCard = { atual: MesSemFolha | null; anterior: MesSemFolha | null };
const parTirando = (ex: Pick<ExecutivoResposta, 'serie_mensal'>, mes: string, folha: ReadonlySet<string>): ParDoCard => {
  const doMes = (m: string) => {
    const s = ex.serie_mensal.find((x) => x.mes === m);
    return s ? semFolhaDoMes(s, folha) : null;
  };
  return { atual: doMes(mes), anterior: doMes(mesAnterior(mes)) };
};

export function parSemFolha(ex: Pick<ExecutivoResposta, 'serie_mensal' | 'linhas_da_folha'>, mes: string): ParDoCard | null {
  if (!ex.linhas_da_folha?.length) return null;
  return parTirando(ex, mes, new Set(ex.linhas_da_folha.map((l) => l.linha_id)));
}
export const parComFolha = (ex: Pick<ExecutivoResposta, 'serie_mensal'>, mes: string): ParDoCard => parTirando(ex, mes, new Set());

export function folhaPendenteNoPar(ex: Pick<ExecutivoResposta, 'folha_pendente' | 'serie_mensal' | 'linhas_da_folha'>, mes: string): string[] {
  const par = [mesAnterior(mes), mes];
  const tirado = parSemFolha(ex, mes);
  const zerada = (m: string) => {
    const x = m === mes ? tirado?.atual : tirado?.anterior;
    return x != null && cent(x.folha) === 0;
  };
  return par.filter((m) => ex.folha_pendente?.some((p) => p.mes === m) || zerada(m));
}

export function textoDaAtualizacao(fontes: { producao?: string | null; embalagem?: string | null; vendas?: string | null; erp?: string | null }): string | null {
  const partes = ([
    ['producao', 'produção lançada até', 'produção sem lançamento'],
    ['embalagem', 'embalagem lançada até', 'embalagem sem lançamento no período'],
    ['vendas', 'relatório de vendas carregado em', 'relatório de vendas não carregado'],
    ['erp', 'financeiro com o último movimento carregado do ERP em', 'financeiro sem movimento carregado do ERP'],
  ] as const).filter(([k]) => fontes[k] !== undefined).map(([k, com, sem]) => (fontes[k] ? `${com} ${dataBr(fontes[k])}` : sem));
  return partes.length ? `Dados atualizados: ${partes.join('; ')}.` : null;
}
export const Atualizacao = ({ texto }: { texto: string | null }) => (texto ? <p className="obs-tela atualizacao-do-card">{texto}</p> : null);

const KPIS: Array<{ chave: 'receita' | 'custos' | 'despesas'; rotulo: string; sobeEMelhor: boolean }> = [
  { chave: 'receita', rotulo: 'Receita', sobeEMelhor: true },
  { chave: 'custos', rotulo: 'Custos', sobeEMelhor: false },
  { chave: 'despesas', rotulo: 'Despesas', sobeEMelhor: false },
];
const tom = (d: number, sobeEMelhor: boolean) => (d === 0 ? '' : (d > 0) === sobeEMelhor ? 'pos' : 'neg');

export function ResultadoSemFolha({ ex, mes, meta, onInvestigar }: {
  ex: ExecutivoResposta | { erro: string } | null; mes: string; meta: number | null; onInvestigar?: () => void;
}) {
  const anterior = mesAnterior(mes);
  const lido = ex && !('erro' in ex) ? ex : null;
  const pendentes = lido ? folhaPendenteNoPar(lido, mes) : null;
  const semFolha = !lido || pendentes!.length > 0 || !lido.linhas_da_folha?.length;
  const titulo = <h4>{semFolha ? 'Resultado operacional sem folha' : 'Resultado operacional'}</h4>;
  const corpo = (() => {
    if (!ex) return <div className="loading">Apurando {rotuloDoMes(mes)} e {rotuloDoMes(anterior)}…</div>;
    if ('erro' in ex) return <div className="empty">Resultado operacional indisponível ({ex.erro}).</div>;
    const par = semFolha ? parSemFolha(ex, mes) : parComFolha(ex, mes);
    if (!par) return <div className="empty">Não foi possível saber quais linhas são da folha neste período, e o card não mostra o resultado sem ela.</div>;
    const { atual, anterior: ant } = par;
    if (!atual) return <div className="empty">{`Sem apuração em ${rotuloDoMes(mes)}.`}</div>;
    const contra = ant ? ` contra ${rotuloDoMes(anterior)}` : '';
    const dResultado = ant ? cent(atual.resultado) - cent(ant.resultado) : null;
    const dMargem = ant && atual.margem_pct != null && ant.margem_pct != null
      ? comUmaCasa((Math.round(atual.margem_pct * 100) - Math.round(ant.margem_pct * 100)) / 100) + 0 : null;
    const tiradas = new Set(ex.serie_mensal.filter((s) => s.mes === mes || s.mes === anterior)
      .flatMap((s) => s.linhas.filter((l) => l.grupo >= 3 && l.grupo <= 5).map((l) => l.linha_id)));
    const codigos = (ex.linhas_da_folha ?? []).filter((l) => tiradas.has(l.linha_id)).map((l) => l.codigo_oficial ?? l.rotulo);
    return (
      <>
        {semFolha
          ? <p className="obs-tela">{`Sem a folha de pagamento nos dois meses${codigos.length ? `: ${codigos.join(', ')} (salários)` : ''}, porque a folha de ${pendentes!.map(rotuloDoMes).join(' e de ')} ainda não entrou. Em ${rotuloDoMes(mes)} a folha tirada é ${brl(atual.folha)}${ant ? `; em ${rotuloDoMes(anterior)}, ${brl(ant.folha)}` : ''}.`}</p>
          : <p className="obs-tela">{ant
            ? 'Os números da DRE, com a folha de pagamento: a folha dos dois meses já entrou. Enquanto a de um deles não entra, o card mostra os dois sem ela.'
            : `Os números da DRE, com a folha de pagamento: a folha de ${rotuloDoMes(mes)} já entrou.`}</p>}
        {!ant && <p className="obs-tela">{`${rotuloDoMes(anterior)} não tem apuração: o card mostra o mês sem comparação.`}</p>}
        <div className="sf-grade">
          {KPIS.map((k) => {
            const v = variacaoPct(atual[k.chave], ant?.[k.chave] ?? 0);
            return (
              <div key={k.chave}>
                <div className="lab">{k.rotulo}</div>
                <div className="val">{brl(atual[k.chave])}</div>
                {ant && <div className={`delta ${v == null ? '' : tom(v, k.sobeEMelhor)}`}>{v == null ? `sem base${contra}` : `${v > 0 ? '+' : ''}${pct(v)}${contra}`}</div>}
              </div>
            );
          })}
          <div>
            <div className="lab">Resultado</div>
            <div className={`val${cent(atual.resultado) < 0 ? ' neg' : ''}`}>{brl(atual.resultado)}</div>
            {dResultado != null && (
              <div className={`delta ${tom(dResultado, true)}`}>
                {dResultado === 0 ? `Igual${contra}` : `${dResultado > 0 ? 'Melhorou' : 'Piorou'} ${brl(Math.abs(dResultado) / 100)}${contra}`}
              </div>
            )}
          </div>
        </div>
        <div className="sf-margem">
          <div>
            <div className="lab">Margem operacional</div>
            <div className={`val${atual.margem_pct != null && atual.margem_pct < 0 ? ' neg' : ''}`}>{atual.margem_pct == null ? 'sem margem' : pct(atual.margem_pct)}</div>
            {dMargem != null && <div className={`delta ${tom(dMargem, true)}`}>{`${dMargem > 0 ? '+' : ''}${pontosPercentuais(dMargem)}${contra}`}</div>}
          </div>
          <div className="sf-meta">
            <div className="lab">Meta</div>
            <div className="val">{pctDaMeta(meta)}</div>
          </div>
        </div>
        {atual.margem_pct != null && <p className="obs-tela">{`Margem calculada a partir dos totais${semFolha ? ' sem a folha' : ''}: ${brl(atual.resultado)} / ${brl(atual.receita)}.`}</p>}
        <Atualizacao texto={textoDaAtualizacao({ erp: ex.ultimo_lancamento })} />
      </>
    );
  })();
  return (
    <div className="sintese-card card-sem-folha card-grupo-resultado">
      <div className="sf-topo">{titulo}<span className="sf-meses">{`${rotuloDoMes(mes)} x ${rotuloDoMes(anterior)}`}</span></div>
      {corpo}
      {onInvestigar && <button type="button" className="gr-toggle" onClick={onInvestigar}>Investigar na Gestão do Resultado</button>}
    </div>
  );
}
