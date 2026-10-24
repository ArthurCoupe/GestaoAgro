import { Chart } from 'react-chartjs-2';
import { brlK, pct, variacaoEmMilhares, variacaoEmPontos } from '../api/client';
import { DEFINICOES } from '../api/definicoes';
import type { ExecutivoResposta, ExecutivoSerieMensal, FolhaPendente } from '../api/gerencial';
import { AMBER, baseOpts, GOLD, OLIVEDK, CINZA } from '../charts/setup';
import { serieSemMesesPendentes } from './AvisoDaFolha';
import { ComoECalculado } from './ComoECalculado';
import { Panel, periodoDoMes } from './ui';

export interface LinhaEvolucao {
  mes: string;
  rotulo: string;
  semFato: boolean;
  folhaPendente: boolean;
  receita: number | null;
  custos: number | null;
  despesas: number | null;
  resultado: number | null;
  margem_pct: number | null;
  ponto_equilibrio: number | null;
  margem_seguranca_pct: number | null;
  delta_resultado: number | null;
  delta_margem_pp: number | null;
}

export function rotuloDoMesCurto(mes: string): string {
  const [ano, m] = mes.split('-').map(Number);
  return periodoDoMes(ano, m - 1).rotulo;
}

export function linhasDaEvolucao(serie: ExecutivoSerieMensal[], mesesSemFato: string[], folhaPendente: FolhaPendente[] = []): LinhaEvolucao[] {
  const semFato = new Set(mesesSemFato);
  const dosAlertas = serieSemMesesPendentes(serie, folhaPendente);
  const pendente = (i: number) => dosAlertas[i] !== serie[i];
  let ant: ExecutivoSerieMensal | null = null;
  return serie.map((s, i) => {
    const vazio = semFato.has(s.mes);
    const pend = pendente(i);
    const antVazio = ant == null || semFato.has(ant.mes);
    const delta = (atual: number | null, anterior: number | null | undefined, menos: (a: number, b: number) => number) =>
      (vazio || pend || antVazio || atual == null || anterior == null ? null : menos(atual, anterior));
    const linha = {
      mes: s.mes,
      rotulo: rotuloDoMesCurto(s.mes),
      semFato: vazio,
      folhaPendente: pend,
      receita: vazio ? null : s.receita_liquida,
      custos: vazio ? null : s.custos,
      despesas: vazio ? null : s.despesas,
      resultado: vazio ? null : s.resultado_operacional,
      margem_pct: vazio ? null : s.margem_pct,
      ponto_equilibrio: vazio ? null : s.ponto_equilibrio,
      margem_seguranca_pct: vazio ? null : s.margem_seguranca_pct,
      delta_resultado: delta(s.resultado_operacional, ant?.resultado_operacional, variacaoEmMilhares),
      delta_margem_pp: delta(s.margem_pct, ant?.margem_pct, variacaoEmPontos),
    };
    if (!pend) ant = s;
    return linha;
  });
}

export function fmtDeltaReais(v: number | null): string {
  if (v == null) return '—';
  const texto = brlK(v);
  return v > 0 ? `+${texto}` : texto;
}

export function fmtDeltaPp(v: number | null): string {
  if (v == null) return '—';
  const texto = `${Math.abs(v).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} p.p.`;
  return v > 0 ? `+${texto}` : v < 0 ? `-${texto}` : texto;
}

const brlOuTraco = (v: number | null) => (v == null ? '—' : brlK(v));
const pctOuTraco = (v: number | null) => (v == null ? '—' : pct(v));

export type SinalDoMes = 'MELHORA' | 'PIORA' | 'IGUAL';

export function sinalContraOAnterior(atual: number | null, anterior: number | null, tipo: 'reais' | 'pct', sobeEMelhor: boolean): SinalDoMes | null {
  if (atual == null || anterior == null) return null;
  const d = tipo === 'pct' ? variacaoEmPontos(atual, anterior) : variacaoEmMilhares(atual, anterior);
  if (d === 0) return 'IGUAL';
  return (d > 0) === sobeEMelhor ? 'MELHORA' : 'PIORA';
}

const INDICADORES: Array<{ chave: 'receita' | 'custos' | 'despesas' | 'resultado' | 'margem_pct' | 'ponto_equilibrio' | 'margem_seguranca_pct'; rotulo: string; tipo: 'reais' | 'pct'; sobeEMelhor: boolean; folha: boolean }> = [
  { chave: 'receita', rotulo: 'Receita', tipo: 'reais', sobeEMelhor: true, folha: false },
  { chave: 'custos', rotulo: 'Custos', tipo: 'reais', sobeEMelhor: false, folha: true },
  { chave: 'despesas', rotulo: 'Despesas', tipo: 'reais', sobeEMelhor: false, folha: true },
  { chave: 'resultado', rotulo: 'Resultado', tipo: 'reais', sobeEMelhor: true, folha: true },
  { chave: 'margem_pct', rotulo: DEFINICOES.margem_operacional.nome, tipo: 'pct', sobeEMelhor: true, folha: true },
  { chave: 'ponto_equilibrio', rotulo: DEFINICOES.ponto_equilibrio_mes.nome, tipo: 'reais', sobeEMelhor: false, folha: true },
  { chave: 'margem_seguranca_pct', rotulo: 'Margem de segurança', tipo: 'pct', sobeEMelhor: true, folha: true },
];

const mesSeguinte = (mes: string) => {
  const [a, m] = mes.split('-').map(Number);
  return m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, '0')}`;
};

export function sinaisDaEvolucao(linhas: LinhaEvolucao[]): Array<Record<(typeof INDICADORES)[number]['chave'], SinalDoMes | null>> {
  return linhas.map((l, i) => {
    const ant = i > 0 && mesSeguinte(linhas[i - 1].mes) === l.mes ? linhas[i - 1] : null;
    const sinais = {} as Record<(typeof INDICADORES)[number]['chave'], SinalDoMes | null>;
    for (const ind of INDICADORES) {
      const semBase = !ant || l.semFato || ant.semFato || (ind.folha && (l.folhaPendente || ant.folhaPendente));
      sinais[ind.chave] = semBase ? null : sinalContraOAnterior(l[ind.chave], ant[ind.chave], ind.tipo, ind.sobeEMelhor);
    }
    return sinais;
  });
}

const ROTULO_DO_SINAL: Record<SinalDoMes, string> = { MELHORA: 'Melhora', PIORA: 'Piora', IGUAL: 'Sem alteração' };

function Bolinha({ sinal, contra }: { sinal: SinalDoMes; contra?: string }) {
  const texto = contra ? `${ROTULO_DO_SINAL[sinal]} contra ${contra}` : undefined;
  return <span className={`sinal-mes sinal-${sinal.toLowerCase()}`} role={texto ? 'img' : undefined} aria-label={texto} title={texto} aria-hidden={texto ? undefined : true} />;
}

export function extremosDaSerie(itens: Array<{ rotulo: string; valor: number | null; margem_pct?: number | null }>): {
  melhor: { rotulo: string; valor: number } | null;
  pior: { rotulo: string; valor: number } | null;
  melhorMargem: { rotulo: string; margem_pct: number } | null;
} {
  const comValor = itens.filter((i): i is { rotulo: string; valor: number; margem_pct?: number | null } => i.valor != null);
  if (comValor.length < 2) return { melhor: null, pior: null, melhorMargem: null };
  let melhor = comValor[0]; let pior = comValor[0];
  for (const i of comValor) { if (i.valor > melhor.valor) melhor = i; if (i.valor < pior.valor) pior = i; }
  const comMargem = itens.filter((i): i is { rotulo: string; valor: number | null; margem_pct: number } => i.margem_pct != null);
  let melhorMargem: { rotulo: string; margem_pct: number } | null = null;
  for (const i of comMargem) if (!melhorMargem || i.margem_pct > melhorMargem.margem_pct) melhorMargem = { rotulo: i.rotulo, margem_pct: i.margem_pct };
  return { melhor: { rotulo: melhor.rotulo, valor: melhor.valor }, pior: { rotulo: pior.rotulo, valor: pior.valor }, melhorMargem };
}

export type MesAntesDaJanela = Pick<ExecutivoResposta, 'serie_mensal' | 'meses_sem_fato' | 'folha_pendente'>;

export function mesAntesDe(mes: string): string {
  const [a, m] = mes.split('-').map(Number);
  return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, '0')}`;
}

export function EvolucaoMensal({ serie, mesesSemFato, etiqueta, titulo, sub, id, pergunta, soTabela = false, folhaPendente, antes, antesFalhou = false }: {
  serie: ExecutivoSerieMensal[]; mesesSemFato: string[]; etiqueta: string; titulo: string; sub: string; id?: string;
  folhaPendente?: FolhaPendente[];
  pergunta?: string;
  soTabela?: boolean;
  antes?: MesAntesDaJanela | null;
  antesFalhou?: boolean;
}) {
  const serieAntes = antes?.serie_mensal.filter((s) => serie.length > 0 && mesSeguinte(s.mes) === serie[0].mes) ?? [];
  const todas = linhasDaEvolucao([...serieAntes, ...serie], [...(antes?.meses_sem_fato ?? []), ...mesesSemFato], [...(antes?.folha_pendente ?? []), ...(folhaPendente ?? [])]);
  const sinais = sinaisDaEvolucao(todas).slice(serieAntes.length);
  const linhas = todas.slice(serieAntes.length);
  const valor = (f: (l: LinhaEvolucao) => number | null) => linhas.map((l) => (l.semFato ? null : (f(l) ?? null)));
  const emMil = (v: number | null) => (v == null ? null : v / 1000);
  return (
    <Panel title={titulo} tag={etiqueta} sub={sub} id={id} pergunta={pergunta}>
      {linhas.length === 0 ? (
        <div className="empty">Sem série mensal no período.</div>
      ) : (
        <>
          {!soTabela && <div className="chart-box" style={{ height: 300 }}>
            <Chart
              type="bar"
              data={{
                labels: linhas.map((l) => l.rotulo),
                datasets: [
                  { type: 'bar' as const, label: 'Receita', data: valor((l) => l.receita).map(emMil), backgroundColor: GOLD, borderRadius: 5 },
                  { type: 'bar' as const, label: 'Custos', data: valor((l) => l.custos).map(emMil), backgroundColor: OLIVEDK, borderRadius: 5 },
                  { type: 'bar' as const, label: 'Despesas', data: valor((l) => l.despesas).map(emMil), backgroundColor: CINZA, borderRadius: 5 },
                  { type: 'line' as const, label: 'Resultado operacional', data: valor((l) => l.resultado).map(emMil), borderColor: AMBER, backgroundColor: AMBER, tension: 0.35 },
                ],
              }}
              options={{ ...baseOpts, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } } } }}
            />
          </div>}
          <div className="tbl-scroll">
            <table className="tbl evolucao-transposta">
              <thead>
                <tr>
                  <th>Indicador</th>
                  {linhas.map((l) => <th key={l.mes} className="num">{l.rotulo}{l.semFato && <> <span className="neg">sem apuração</span></>}</th>)}
                </tr>
              </thead>
              <tbody>
                {INDICADORES.map((ind) => (
                  <tr key={ind.chave}>
                    <td><b>{ind.rotulo}</b></td>
                    {linhas.map((l, i) => {
                      const v = l[ind.chave];
                      const s = sinais[i][ind.chave];
                      return (
                        <td key={l.mes} className={`num${v != null && v < 0 ? ' neg' : ''}`}>
                          {s && <Bolinha sinal={s} contra={rotuloDoMesCurto(mesAntesDe(l.mes))} />}{ind.tipo === 'reais' ? brlOuTraco(v) : pctOuTraco(v)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                <tr>
                  <td><b>Δ resultado</b></td>
                  {linhas.map((l) => <td key={l.mes} className="num">{fmtDeltaReais(l.delta_resultado)}</td>)}
                </tr>
                <tr>
                  <td><b>Δ margem</b></td>
                  {linhas.map((l) => <td key={l.mes} className="num">{fmtDeltaPp(l.delta_margem_pp)}</td>)}
                </tr>
              </tbody>
            </table>
          </div>
          <p className="obs-tela legenda-sinais">
            <Bolinha sinal="MELHORA" /> Melhora <Bolinha sinal="PIORA" /> Piora <Bolinha sinal="IGUAL" /> Sem alteração. Cada bolinha compara
            com o mês imediatamente anterior, também na virada do ano. Sem o mês anterior na base, fica em branco.
            {linhas.some((l) => l.folhaPendente) && ' No mês com a folha ainda não apropriada, e no seguinte, só a receita tem bolinha.'}
            {antesFalhou && serie.length > 0 && ` Não foi possível ler ${rotuloDoMesCurto(mesAntesDe(serie[0].mes))}: a primeira coluna fica sem bolinha.`}
          </p>
          <ComoECalculado chave="ponto_equilibrio_mes" />
          {(() => {
            const ex = extremosDaSerie(linhas.map((l) => (l.folhaPendente
              ? { rotulo: l.rotulo, valor: null, margem_pct: null }
              : { rotulo: l.rotulo, valor: l.resultado, margem_pct: l.margem_pct })));
            return ex.melhor && ex.pior ? (
              <p className="obs-tela">
                Melhor mês (resultado operacional): {ex.melhor.rotulo} ({brlK(ex.melhor.valor)}) · Pior mês (resultado operacional): {ex.pior.rotulo} ({brlK(ex.pior.valor)})
                {ex.melhorMargem ? <> · Melhor margem: {ex.melhorMargem.rotulo} ({pct(ex.melhorMargem.margem_pct)})</> : null}
              </p>
            ) : null;
          })()}
        </>
      )}
    </Panel>
  );
}
