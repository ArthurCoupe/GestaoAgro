import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import {
  dataBr, fmPctFrac, getIndicadoresCiclo, getPainelCiclo, getRegrasMaturacao, num, rotuloDoGalpao,
  type RegraMaturacao,
  type IndicadoresCicloMetricas, type IndicadoresCicloResposta, type PainelCicloMetricas,
  anoMesHoje, type PainelCicloEixo, type PainelCicloEstantesColhidas,
  type PainelCicloLote, type PainelCicloResposta,
  type ConversaoSoma, type PainelCicloConversao,
} from '../api/client';
import { baseOpts, PALETTE } from '../charts/setup';
import { CampoData } from '../components/CampoData';
import { Kpi, Panel } from '../components/ui';

const COLUNAS = [
  'Taxa de Contaminação (Cont./Prod.)',
  'Taxa de Aproveitamento (Abertos/Prod.)',
  'Kg por bloco aberto',
  'Eficiência Total (Kg colhidos/Bl Prod.)',
  'Perda Total de Blocos (Prod. - Cont. - Abertos)',
  'Total de Kg Colhidos',
  '%P de SH', '%M de SH', '%G de SH', '%GG de SH',
];

const CHAVE_RECADO = 'exemplo:ciclo:abrir-em';
type ArmCiclo = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | undefined;
const armPadrao = (): ArmCiclo => (typeof sessionStorage !== 'undefined' ? sessionStorage : undefined);
const DATA = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
export function abrirIndicadoresEm(periodo: { inicio: string; fim: string }, armazenamento: ArmCiclo = armPadrao()): void {
  try { armazenamento?.setItem(CHAVE_RECADO, JSON.stringify({ inicio: periodo.inicio, fim: periodo.fim })); } catch { }
}
export function lerRecadoDoCiclo(armazenamento: ArmCiclo = armPadrao()): { inicio: string; fim: string } | null {
  try {
    const bruto = JSON.parse(armazenamento?.getItem(CHAVE_RECADO) ?? 'null') as { inicio?: unknown; fim?: unknown } | null;
    if (!bruto || typeof bruto.inicio !== 'string' || typeof bruto.fim !== 'string') return null;
    if (!DATA.test(bruto.inicio) || !DATA.test(bruto.fim) || bruto.inicio > bruto.fim) return null;
    return { inicio: bruto.inicio, fim: bruto.fim };
  } catch { return null; }
}
export function descartarRecadoDoCiclo(armazenamento: ArmCiclo = armPadrao()): void {
  try { armazenamento?.removeItem(CHAVE_RECADO); } catch { }
}

const TIPOS = [
  { v: '', rotulo: 'Todos' }, { v: 'SH', rotulo: 'Shiitake' },
  { v: 'SB', rotulo: 'Shimeji Branco' }, { v: 'SP', rotulo: 'Shimeji Preto' },
  { v: 'SS', rotulo: 'Shimeji Salmão' },
];

const SERIES = [
  { chave: 'blocos_produzidos', rotulo: 'Blocos produzidos', eixoKg: false },
  { chave: 'blocos_contaminados', rotulo: 'Blocos contaminados', eixoKg: false },
  { chave: 'blocos_abertos', rotulo: 'Blocos abertos', eixoKg: false },
  { chave: 'kg_colhidos', rotulo: 'Kg colhidos', eixoKg: true },
] as const;

const PRESETS = [
  ['mes', 'Mês'], ['trimestre', 'Trimestre'], ['semestre', 'Semestre'],
  ['ano', 'Ano'], ['tudo', 'Tudo'], ['custom', 'Personalizado'],
] as const;

function preset(chave: string, hoje: Date): { inicio: string; fim: string } | null {
  const { ano, mes } = anoMesHoje(hoje);
  const primeiro = (a: number, m: number) => `${a}-${String(m).padStart(2, '0')}-01`;
  const ultimo = (a: number, m: number) => new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
  if (chave === 'mes') return { inicio: primeiro(ano, mes), fim: ultimo(ano, mes) };
  if (chave === 'trimestre') {
    const ini = Math.floor((mes - 1) / 3) * 3 + 1;
    return { inicio: primeiro(ano, ini), fim: ultimo(ano, ini + 2) };
  }
  if (chave === 'semestre') {
    const ini = mes <= 6 ? 1 : 7;
    return { inicio: primeiro(ano, ini), fim: ultimo(ano, ini + 5) };
  }
  if (chave === 'ano') return { inicio: `${ano}-01-01`, fim: `${ano}-12-31` };
  return null;
}

const RANKINGS = [
  {
    chave: 'menor_contaminacao', rotulo: 'Menor taxa de contaminação', coluna: 'Contaminação',
    fmt: (l: PainelCicloLote) => (l.taxa_contaminacao == null ? '—' : fmPctFrac(l.taxa_contaminacao)),
  },
  {
    chave: 'maior_kg_por_bloco_aberto', rotulo: 'Maior kg por bloco aberto', coluna: 'Kg/bloco',
    fmt: (l: PainelCicloLote) => (l.kg_por_bloco_aberto == null ? '—' : num(l.kg_por_bloco_aberto, 3)),
  },
  {
    chave: 'maior_eficiencia', rotulo: 'Maior eficiência total', coluna: 'Eficiência',
    fmt: (l: PainelCicloLote) => (l.eficiencia_total == null ? '—' : num(l.eficiencia_total, 4)),
  },
  {
    chave: 'maior_kg', rotulo: 'Maior volume colhido', coluna: 'Kg',
    fmt: (l: PainelCicloLote) => (l.kg_colhidos == null ? '—' : num(l.kg_colhidos, 1)),
  },
] as const;

const pct = (v: number | null) => (v == null ? '—' : fmPctFrac(v));
const n3 = (v: number | null) => (v == null ? '—' : num(v, 3));

const fmPct = (v: number | null) =>
  v == null ? '—' : `${(v * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
const fmNum = (v: number | null, casas = 3) =>
  v == null ? '—' : v.toLocaleString('pt-BR', { maximumFractionDigits: casas });

export function toneDeContagem(valor: number | null): 'alert' | 'good' | undefined {
  if (valor == null) return undefined;
  return valor ? 'alert' : 'good';
}

export function avisoDoEixo(eixo: PainelCicloEixo | undefined): string | null {
  const partes: string[] = [];
  if (eixo?.ignoradas) {
    const uma = eixo.ignoradas === 1;
    partes.push(
      `${num(eixo.ignoradas)} ${uma ? 'data anterior' : 'datas anteriores'} a 2000 `
      + `${uma ? 'ficou' : 'ficaram'} de fora do eixo (erro de digitação no registro). `
      + 'Os blocos dessas linhas continuam contados nos KPIs de Totais acima, '
      + 'então o gráfico pode somar menos que eles.',
    );
  }
  if (eixo?.truncado) {
    partes.push(
      'O eixo bateu no limite de 600 meses e foi cortado: os meses seguintes '
      + 'não aparecem no gráfico, mesmo tendo fato registrado.',
    );
  }
  return partes.join(' ') || null;
}

export function avisoDoEixoDeFiltro(eixo: string): string | null {
  if (eixo !== 'ABERTURA') return null;
  return 'Filtro por data de abertura: só entram no recorte as estantes que já '
    + 'foram abertas no período. Taxa de Aproveitamento, Kg por Bloco Aberto e '
    + 'Perda Total de Blocos se referem só a esse subconjunto.';
}

export function lotesEmMaturacaoAgora(
  doPeriodo: PainelCicloResposta, semPeriodo: PainelCicloResposta | null,
): number {
  return (semPeriodo ?? doPeriodo).eficiencia.total.lotes_em_maturacao;
}

export const SUB_TOTAIS_DO_PERIODO = 'Cada fato no mês em que aconteceu: blocos pela data do lote, '
  + 'abertos pela data da abertura, kg pela data da colheita, contaminados pela data da retirada. '
  + 'A estante com blocos abertos e sem data de abertura fica fora dos abertos.';

export function inconsistentesNasListas(r: PainelCicloResposta['rankings']): number {
  const chaves = new Set<string>();
  for (const l of [...r.menor_contaminacao, ...r.maior_kg_por_bloco_aberto, ...r.maior_eficiencia, ...r.maior_kg]) {
    if (l.inconsistente) chaves.add(l.chave);
  }
  return chaves.size;
}

export function textoDasMarcas(n: number, k: number, limite: number): string {
  if (k === 0) return `As listas mostram os ${num(limite)} primeiros de cada ranking, e nenhum desses ${num(n)} está nelas.`;
  return `As listas mostram os ${num(limite)} primeiros de cada ranking; ${num(k)} desses ${num(n)} `
    + `${k === 1 ? 'aparece nelas, marcado' : 'aparecem nelas, marcados'} com ⚠.`;
}

export function NotaEmMaturacaoAgora({ n }: { n: number }) {
  return (
    <p className="nota">
      {num(n)} lotes estão em maturação agora, contados pelo estado do lote: nenhuma estante
      dele tem data de abertura. A tela <strong>Próximas Aberturas</strong> mostra quais já
      passaram do prazo, com o endereço de onde os blocos devem ser retirados, e usa outro
      critério: conta por endereço, tira a estante zerada e a que não tem o que buscar, e
      alcança também as estantes que ficaram para trás em lotes já parcialmente abertos. Por
      isso o número de lotes dela pode ser outro.
    </p>
  );
}

export function ObsContaFurada({ n, rankings }: { n: number; rankings: PainelCicloResposta['rankings'] }) {
  if (n <= 0) return null;
  return (
    <div className="obs-tela">
      <b>{n} lotes têm a conta de blocos furada</b>: abrem mais
      do que produziram, ou abertos + contaminados passa dos produzidos. Enquanto
      isso não for corrigido na planilha, a <b>Perda Total</b> não é perda: é a conta
      não fechando. {textoDasMarcas(n, inconsistentesNasListas(rankings), rankings.limite)}
    </div>
  );
}

export function ObsNaoMensuraveis({ ef }: { ef: PainelCicloMetricas }) {
  if (ef.lotes_mensuraveis >= ef.lotes) return null;
  const nm = ef.nao_mensuraveis ?? {
    em_maturacao: ef.lotes_em_maturacao, dado_faltante: ef.lotes_com_dado_faltante, sem_contagem_de_produzidos: 0,
  };
  return (
    <div className="obs-tela">
      Taxa de Aproveitamento, Kg por Bloco Aberto e a Perda Total saem
      <b> somente dos {ef.lotes_mensuraveis} lotes mensuráveis</b>. Os outros
      {' '}{ef.lotes - ef.lotes_mensuraveis} ficam de fora por <b>motivos
      diferentes</b>:
      <ul style={{ margin: '4px 0 0 18px' }}>
        <li>
          <b>{nm.em_maturacao} ainda não abriram</b>: estão dentro do ciclo.
          Não é dado faltando; é o tempo passando.
        </li>
        <li>
          <b>{nm.dado_faltante} abriram e não anotaram</b> a quantidade de
          blocos ({ef.lotes_abertura_sem_quantidade} em nenhuma estante,
          {' '}{ef.lotes_com_abertura_parcial} em parte delas: {ef.estantes_sem_quantidade}
          {' '}estantes ao todo). <b>São preenchimento pendente.</b>
        </li>
        {nm.sem_contagem_de_produzidos > 0 && (
          <li>
            <b>{nm.sem_contagem_de_produzidos} abriram sem a contagem de produzidos</b>: nenhuma
            estante do lote tem o número de blocos produzidos. <b>Também é preenchimento pendente.</b>
          </li>
        )}
      </ul>
    </div>
  );
}

export function ObsForaDosRankings({ rankings }: { rankings: PainelCicloResposta['rankings'] }) {
  const n = rankings.excluidos.inconsistentes;
  return (
    <div className="obs-tela">
      Lote sem o dado que o ranking ordena fica <b>de fora</b> dele, e não com zero: um lote aberto há uma semana, ainda sem colheita, apareceria como o pior do
      período quando a verdade é que o ciclo dele não fechou. Os três números da
      etiqueta não somam: um lote pode estar em mais de um deles (o lote em maturação
      quase sempre também está sem colheita).
      {n > 0 && (
        <> O <b>⚠</b> marca os {n} lotes cuja
        conta de blocos não fecha. Eles <b>aparecem</b>, e não são escondidos: o número
        deles é real, o que está errado é o dado de origem.
        {' '}{textoDasMarcas(n, inconsistentesNasListas(rankings), rankings.limite)}</>
      )}
    </div>
  );
}

export function NotaDoDetalhamento({ lotesMensuraveis }: { lotesMensuraveis: number }) {
  return (
    <div className="obs-tela">
      <b>Por que a Taxa de Aproveitamento, a Perda e o kg daqui diferem dos de cima.</b> Esta
      tabela reproduz a aba Indicadores da planilha, onde lote sem abertura registrada
      entra como zero e cada estante é uma linha: então o aproveitamento sai menor e a
      perda, maior. O bloco Indicadores de Eficiência agrupa as estantes em lote e
      calcula sobre os {lotesMensuraveis} lotes mensuráveis. As duas leituras estão
      certas, e são de perguntas diferentes: esta é "o que a planilha diz", a de cima é
      "qual foi o aproveitamento". O Total de Kg Colhidos daqui soma as colheitas dos
      lotes do período pela data do lote, e o card Kg colhidos, pela data da colheita.
    </div>
  );
}

export type AgrupamentoConversao = 'LOTE' | 'MES' | 'NF' | 'ESPECIE';
export const AGRUPAMENTOS_CONVERSAO: Array<[AgrupamentoConversao, string]> = [
  ['LOTE', 'Lote'], ['MES', 'Mês'], ['NF', 'NF da semente'], ['ESPECIE', 'Espécie'],
];
const NOME_DA_ESPECIE: Record<string, string> = {
  SH: 'Shiitake', SB: 'Shimeji Branco', SP: 'Shimeji Preto', SS: 'Shimeji Salmão',
};
const especie = (t: string | null) => (t ? NOME_DA_ESPECIE[t] ?? t : 'Sem espécie');
const fmTaxa = (v: number | null) => (v == null ? '—'
  : v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const fmKg3 = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const fmMes = (m: string) => (/^\d{4}-\d{2}$/.test(m) ? `${m.slice(5, 7)}/${m.slice(0, 4)}` : m);

export function tabelaDaConversao(c: PainelCicloConversao, ag: AgrupamentoConversao): {
  cabecalho: string[]; numericas: number; total: string[];
  linhas: Array<{ chave: string; celulas: string[]; titulos?: Array<string | null> }>;
} {
  const medidas = ['Blocos abertos', 'Kg colhidos', 'Bandejas', 'Taxa'];
  const valores = (s: ConversaoSoma) => [num(s.blocos_abertos), fmKg3(s.kg_colhidos), num(s.bandejas), fmTaxa(s.taxa)];
  const t = c.total;
  if (ag === 'LOTE') {
    return {
      cabecalho: ['Lote', 'Espécie', 'NF da semente', 'Última colheita', ...medidas],
      numericas: medidas.length,
      linhas: c.lotes.map((l) => ({
        chave: l.chave,
        celulas: [dataBr(l.data_lote), especie(l.tipo), l.nf.rotulo,
          l.ultima_colheita ? dataBr(l.ultima_colheita) : '—', ...valores({ ...l, lotes: 1 })],
        titulos: [null, null, l.nf_semente, null],
      })),
      total: ['Total', '', '', '', ...valores(t)],
    };
  }
  if (ag === 'ESPECIE') {
    return {
      cabecalho: ['Espécie', 'Lotes', ...medidas],
      numericas: medidas.length + 1,
      linhas: c.por_tipo.map((g) => ({ chave: String(g.tipo), celulas: [especie(g.tipo), num(g.lotes), ...valores(g)] })),
      total: ['Total', num(t.lotes), ...valores(t)],
    };
  }
  const grupos = ag === 'MES' ? c.por_mes : c.por_nf;
  const rotuloDoGrupo = ag === 'MES' ? (c.eixo === 'ABERTURA' ? 'Mês da primeira abertura' : 'Mês do lote')
    : 'NF da semente';
  return {
    cabecalho: [rotuloDoGrupo, 'Espécie', 'Lotes', ...medidas],
    numericas: medidas.length + 1,
    linhas: grupos.map((g) => ({
      chave: `${g.tipo}|${g.chave}`,
      celulas: [ag === 'MES' ? fmMes(g.rotulo) : g.rotulo, especie(g.tipo), num(g.lotes), ...valores(g)],
    })),
    total: ['Total', '', num(t.lotes), ...valores(t)],
  };
}

export function textoForaDaConta(c: PainelCicloConversao): string | null {
  const f = c.fora_da_conta;
  if (!f.total) return null;
  const partes = [
    [f.em_maturacao, 'ainda na maturação'],
    [f.abertos_sem_colheita, 'abertos e ainda sem kg colhido'],
    [f.abertura_sem_quantidade, 'com a quantidade de blocos abertos faltando'],
    [f.abertura_com_zero_blocos, 'com abertura de zero blocos'],
  ].filter(([n]) => (n as number) > 0).map(([n, txt]) => `${num(n as number)} ${txt}`);
  return `${num(f.total)} dos ${num(c.lotes_do_periodo)} lotes do período ficam fora da conta: ${partes.join(', ')}.`;
}

export function PainelConversao({ c, agrupamento, onAgrupamento }: {
  c: PainelCicloConversao; agrupamento: AgrupamentoConversao; onAgrupamento: (a: AgrupamentoConversao) => void;
}) {
  const tab = tabelaDaConversao(c, agrupamento);
  const fora = textoForaDaConta(c);
  const inicioNum = tab.cabecalho.length - tab.numericas;
  const g = num(c.gramas_por_bandeja);
  return (
    <Panel title="Taxa de Conversão de Blocos"
      tag={`${num(c.total.lotes)} de ${num(c.lotes_do_periodo)} lotes na conta`}
      sub={`Bandejas por bloco aberto. Bandejas = kg colhido ÷ ${g} g, por lote. Mesmo período e tipo escolhidos acima`}>
      <div className="kpi-grid k4">
        <Kpi label="Taxa de conversão do período" value={fmTaxa(c.total.taxa)} />
        <Kpi label={`Bandejas (kg ÷ ${g} g)`} value={num(c.total.bandejas)} />
        <Kpi label="Blocos abertos" value={num(c.total.blocos_abertos)} />
        <Kpi label="Kg colhidos" value={fmKg3(c.total.kg_colhidos)} />
      </div>
      <div className="form-acao" style={{ marginTop: 12 }}>
        <span style={{ alignSelf: 'center' }}>Ver por:</span>
        {AGRUPAMENTOS_CONVERSAO.map(([v, r]) => (
          <button key={v} className={agrupamento === v ? 'btn' : 'btn ghost'} onClick={() => onAgrupamento(v)}>{r}</button>
        ))}
      </div>
      <div className="plan-wrap cp">
        <table className="plan cp">
          <thead>
            <tr>
              {tab.cabecalho.map((h, i) => <th key={h} className={i >= inicioNum ? 'num' : 'rotulo'}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {tab.linhas.map((l) => (
              <tr key={l.chave}>
                {l.celulas.map((v, i) => (
                  <td key={i} className={i >= inicioNum ? 'num' : 'rotulo'} title={l.titulos?.[i] ?? undefined}>{v}</td>
                ))}
              </tr>
            ))}
            <tr className="ln-destaque">
              {tab.total.map((v, i) => <td key={i} className={i >= inicioNum ? 'num' : 'rotulo'}>{v}</td>)}
            </tr>
          </tbody>
        </table>
      </div>
      {tab.linhas.length === 0 && <p className="nota">Nenhum lote do período tem blocos abertos e colheita registrada.</p>}
      <div className="obs-tela">
        Em cada lote, bandejas = kg colhido ÷ {g} g, arredondado para a bandeja inteira, e a taxa =
        bandejas ÷ blocos abertos. Os grupos somam os lotes, então o Total é a soma das linhas. O peso
        de {g} g é o {c.gramas_origem === 'BANCO' ? 'definido pela gestão' : 'padrão do sistema'} e
        muda em Metas e Limiares; mudar o peso refaz a conta de todos os lotes. Com o tipo Todos, o
        total mistura as espécies: para comparar, veja por Espécie ou escolha o tipo acima.
      </div>
      {fora && <div className="obs-tela">{fora}</div>}
      <div className="obs-tela">
        A taxa de um lote cresce a cada colheita. Lote que ainda está colhendo aparece com a conta
        parcial; a coluna Última colheita, na visão por Lote, mostra até quando o kg foi somado.
      </div>
      {(agrupamento === 'LOTE' || agrupamento === 'NF') && (
        <div className="obs-tela">
          Mais de uma NF: o lote usou sementes de notas diferentes, e não há como separar os blocos de
          cada nota. A mesma NF em duas espécies aparece em duas linhas.
        </div>
      )}
    </Panel>
  );
}

export function IndicadoresCiclo() {
  const [painel, setPainel] = useState<PainelCicloResposta | null>(null);
  const [semPeriodo, setSemPeriodo] = useState<PainelCicloResposta | null>(null);
  const [pivot, setPivot] = useState<IndicadoresCicloResposta | null>(null);
  const [erro, setErro] = useState('');
  const [recado] = useState(() => lerRecadoDoCiclo());
  useEffect(() => { descartarRecadoDoCiclo(); }, []);
  const [chave, setChave] = useState(recado ? 'custom' : 'tudo');
  const [fInicio, setFInicio] = useState(recado?.inicio ?? '');
  const [fFim, setFFim] = useState(recado?.fim ?? '');
  const [tipo, setTipo] = useState('');
  const [eixo, setEixo] = useState<'LOTE' | 'ABERTURA'>('LOTE');
  const [series, setSeries] = useState<string[]>(['blocos_produzidos', 'blocos_contaminados']);
  const [abrirComposicao, setAbrirComposicao] = useState(false);
  const [loteAberto, setLoteAberto] = useState<string | null>(null);
  const [agrupamento, setAgrupamento] = useState<AgrupamentoConversao>('LOTE');
  const [recolhidos, setRecolhidos] = useState<Set<string>>(new Set());

  const faixa = useMemo(
    () => preset(chave, new Date()) ?? { inicio: chave === 'custom' ? fInicio : '', fim: chave === 'custom' ? fFim : '' },
    [chave, fInicio, fFim],
  );

  const recarregar = useCallback(() => {
    let vivo = true;
    setErro(''); setPainel(null); setPivot(null); setSemPeriodo(null);
    const params = {
      inicio: faixa.inicio || undefined,
      fim: faixa.fim || undefined,
      tipo: tipo || undefined,
    };
    const temPeriodo = Boolean(params.inicio || params.fim);
    Promise.all([
      getPainelCiclo({ ...params, eixo }), getIndicadoresCiclo(params),
      temPeriodo ? getPainelCiclo({ tipo: params.tipo }) : Promise.resolve(null),
    ])
      .then(([p, i, s]) => { if (vivo) { setPainel(p); setPivot(i); setSemPeriodo(s); } })
      .catch((e) => { if (vivo) setErro(e?.response?.data?.erro ?? e.message); });
    return () => { vivo = false; };
  }, [faixa.inicio, faixa.fim, tipo, eixo]);
  useEffect(recarregar, [recarregar]);

  const [regras, setRegras] = useState<RegraMaturacao[]>([]);
  useEffect(() => { getRegrasMaturacao().then(setRegras).catch(() => setRegras([])); }, []);

  const alternar = (t: string) =>
    setRecolhidos((prev) => {
      const prox = new Set(prev);
      if (prox.has(t)) prox.delete(t);
      else prox.add(t);
      return prox;
    });

  if (erro) return <div className="empty">Erro: {erro}</div>;
  if (!painel || !pivot) return <div className="loading">Calculando o ciclo produtivo…</div>;

  const { totais } = painel;
  const ef = painel.eficiencia.total;
  const emMaturacaoAgora = lotesEmMaturacaoAgora(painel, semPeriodo);
  const usaEixoKg = SERIES.some((s) => s.eixoKg && series.includes(s.chave));
  const avisoEixo = avisoDoEixo(painel.eixo);
  const avisoEixoFiltro = avisoDoEixoDeFiltro(eixo);

  return (
    <>
      <Panel title="Período" sub="Vale para a tela inteira">
        <div className="form-acao">
          {PRESETS.map(([v, r]) => (
            <button key={v} className={chave === v ? 'btn' : 'btn ghost'}
              onClick={() => setChave(v)}>{r}</button>
          ))}
        </div>
        <div className="filtros">
          {chave === 'custom' && (
            <>
              <div className="fg">
                <label>De</label>
                <CampoData value={fInicio} onChange={setFInicio} />
              </div>
              <div className="fg">
                <label>Até</label>
                <CampoData value={fFim} onChange={setFFim} />
              </div>
            </>
          )}
          <div className="fg">
            <label>Filtrar por</label>
            <select value={eixo} onChange={(e) => setEixo(e.target.value as 'LOTE' | 'ABERTURA')}>
              <option value="LOTE">Data do lote</option>
              <option value="ABERTURA">Data da abertura</option>
            </select>
          </div>
          <div className="fg">
            <label>Tipo de cogumelo</label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
              {TIPOS.map((t) => <option key={t.v} value={t.v}>{t.rotulo}</option>)}
            </select>
          </div>
        </div>
      </Panel>

      <Panel title="Totais do Período" sub={SUB_TOTAIS_DO_PERIODO}>
        <div className="kpi-grid k4">
          <Kpi label="Blocos produzidos" value={num(totais.blocos_produzidos)} />
          <Kpi label="Blocos contaminados" value={num(totais.blocos_contaminados)}
            tone={totais.blocos_contaminados > 0 ? 'alert' : undefined} />
          <Kpi label="Blocos abertos" value={num(totais.blocos_abertos)} />
          <Kpi label="Kg colhidos" value={num(totais.kg_colhidos, 1)} />
        </div>

        <div className="form-acao">
          <button className="btn ghost" onClick={() => setAbrirComposicao((v) => !v)}>
            {abrirComposicao ? 'Ocultar' : 'Ver'} composição mês a mês
          </button>
        </div>
        {abrirComposicao && (
          <div className="plan-wrap">
            <table className="plan">
              <thead>
                <tr>
                  <th className="rotulo">Mês</th>
                  <th className="num">Produzidos</th><th className="num">Contaminados</th>
                  <th className="num">Abertos</th><th className="num">Kg</th>
                </tr>
              </thead>
              <tbody>
                {painel.serie_mensal.map((m) => (
                  <tr key={m.mes}>
                    <td className="rotulo">{m.mes}</td>
                    <td className="num">{num(m.blocos_produzidos)}</td>
                    <td className="num">{num(m.blocos_contaminados)}</td>
                    <td className="num">{num(m.blocos_abertos)}</td>
                    <td className="num">{num(m.kg_colhidos, 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totais.por_tipo.length > 1 && (
          <div className="plan-wrap">
            <table className="plan">
              <thead>
                <tr>
                  <th className="rotulo">Tipo</th>
                  <th className="num">Produzidos</th><th className="num">Contaminados</th>
                  <th className="num">Abertos</th><th className="num">Kg</th>
                </tr>
              </thead>
              <tbody>
                {totais.por_tipo.map((t) => (
                  <tr key={t.tipo}>
                    <td className="rotulo">{t.tipo}</td>
                    <td className="num">{num(t.blocos_produzidos)}</td>
                    <td className="num">{num(t.blocos_contaminados)}</td>
                    <td className="num">{num(t.blocos_abertos)}</td>
                    <td className="num">{num(t.kg_colhidos, 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Próximas Aberturas"
        sub="A fila do que ainda não saiu da maturação: por galpão e estante">
        <NotaEmMaturacaoAgora n={emMaturacaoAgora} />
      </Panel>

      <Panel title="Evolução" tag={`${painel.serie_mensal.length} meses`}
        sub="Mesmo eixo dos totais. Kg usa a escala da direita: não se compara direto com quantidade de blocos">
        {avisoEixo && <p className="nota">{avisoEixo}</p>}
        <div className="form-acao">
          {SERIES.map((s) => (
            <button key={s.chave}
              className={series.includes(s.chave) ? 'btn' : 'btn ghost'}
              onClick={() => setSeries((atual) => (atual.includes(s.chave)
                ? atual.filter((c) => c !== s.chave) : [...atual, s.chave]))}>
              {s.rotulo}
            </button>
          ))}
        </div>
        {series.length === 0 ? (
          <div className="empty">Escolha ao menos um indicador acima.</div>
        ) : (
          <div className="chart-box">
            <Bar
              data={{
                labels: painel.serie_mensal.map((m) => m.mes),
                datasets: SERIES.filter((s) => series.includes(s.chave)).map((s, i) => ({
                  label: s.rotulo,
                  data: painel.serie_mensal.map((m) => m[s.chave]),
                  backgroundColor: PALETTE[i % PALETTE.length],
                  borderRadius: 6,
                  yAxisID: s.eixoKg ? 'y2' : 'y',
                })),
              }}
              options={{
                ...baseOpts,
                plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } } },
                scales: {
                  x: { grid: { display: false } },
                  y: { position: 'left', title: { display: true, text: 'blocos' } },
                  y2: {
                    position: 'right',
                    title: { display: true, text: 'kg' },
                    grid: { drawOnChartArea: false },
                    display: usaEixoKg,
                  },
                },
              }}
            />
          </div>
        )}
      </Panel>

      <Panel title="Indicadores de Eficiência"
        tag={`${ef.lotes_com_abertura} de ${ef.lotes} lotes com abertura registrada`}
        sub="Por COORTE do LOTE: as estantes de um mesmo dia e tipo somam num lote só, senão os blocos abertos ficam sem o denominador">
        {avisoEixoFiltro && <p className="nota">{avisoEixoFiltro}</p>}
        <div className="kpi-grid k4">
          <Kpi label="Taxa de Contaminação" value={pct(ef.taxa_contaminacao)} />
          <Kpi label="Taxa de Aproveitamento" value={pct(ef.taxa_aproveitamento)} />
          <Kpi label="Kg por Bloco Aberto" value={n3(ef.kg_por_bloco_aberto)} />
          <Kpi label="Eficiência Total" value={n3(ef.eficiencia_total)} />
          <Kpi label="Perda Total de Blocos"
            value={ef.perda_total_blocos == null ? '—'
              : `${num(ef.perda_total_blocos)}  (${pct(ef.perda_total_pct)})`}
            tone={toneDeContagem(ef.perda_total_blocos)} />
          <Kpi label="Dias até Abertura (mediana)"
            value={ef.dias_ate_abertura_mediana == null ? '—' : num(ef.dias_ate_abertura_mediana)} />
        </div>
        <div className="obs-tela">
          <b>{ef.lotes} lotes, {ef.estantes} estantes.</b> Uma linha da Jornada é uma
          estante; o lote é o conjunto das estantes do mesmo dia e tipo. Os blocos ficam
          registrados na primeira estante e os abertos, em cada uma: por isso as duas
          coisas só fazem razão depois de somadas.
        </div>
        <div className="obs-tela">
          <b>A Perda Total de Blocos deveria dar zero.</b> Todo bloco que entrou na
          maturação tem que sair explicado: ou contaminado, ou aberto para a frutificação.
          O que sobra é diferença de contagem ou registro que faltou, não é perda de
          produção. Ela pode aparecer <b>negativa</b>, quando o lote abre mais blocos do
          que registrou ter produzido.{' '}
          A tolerância é de <b>±10 blocos por lote</b>, absoluta: dentro disso a diferença
          conta como precisão de contagem; fora, o lote é marcado <b>divergente</b>.
        </div>
        <ObsContaFurada n={ef.lotes_inconsistentes} rankings={painel.rankings} />
        <ObsNaoMensuraveis ef={ef} />
        {ef.lotes_com_colheita < ef.lotes && (
          <div className="obs-tela">
            {ef.lotes_com_colheita} de {ef.lotes} lotes já colheram. Os demais podem estar
            com o ciclo em andamento: entre inocular e colher são cerca de 105 dias.
          </div>
        )}
      </Panel>

      <PainelConversao c={painel.conversao} agrupamento={agrupamento} onAgrupamento={setAgrupamento} />

      <Panel title="Análise de Melhor Performance"
        sub="Por coorte. Qual mês combinou melhor produtividade, qualidade da colheita e perdas">
        <div className="plan-wrap">
          <table className="plan">
            <thead>
              <tr>
                <th className="rotulo">Mês</th>
                <th className="num">Blocos</th><th className="num">Kg</th>
                <th className="num">%P</th><th className="num">%M</th><th className="num">%G</th>
                <th className="num">%GG</th>
                <th className="num">Kg/bloco aberto</th><th className="num">Eficiência</th>
                <th className="num">Contaminação</th><th className="num">Lotes c/ abertura</th>
              </tr>
            </thead>
            <tbody>
              {painel.melhor_performance.map((p) => (
                <tr key={p.mes}>
                  <td className="rotulo">{p.mes}</td>
                  <td className="num">{num(p.blocos_produzidos)}</td>
                  <td className="num">{num(p.kg_colhidos, 1)}</td>
                  <td className="num">{pct(p.pct_p)}</td>
                  <td className="num">{pct(p.pct_m)}</td>
                  <td className="num">{pct(p.pct_g)}</td>
                  <td className="num">{pct(p.pct_gg)}</td>
                  <td className="num">{n3(p.kg_por_bloco_aberto)}</td>
                  <td className="num">{n3(p.eficiencia_total)}</td>
                  <td className="num">{pct(p.taxa_contaminacao)}</td>
                  <td className="num">{p.lotes_com_abertura} / {p.lotes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="obs-tela">
          A última coluna é quantos lotes do mês têm abertura registrada: quanto menor,
          menos as três colunas do meio dizem sobre o mês. O <b>Custo por Kg</b> ainda não
          entra: depende da classificação fixo/variável, que ainda está em aberto.
        </div>
      </Panel>

      <Panel title="Melhor Lote e Investigação"
        tag={`${painel.rankings.excluidos.em_maturacao} em maturação · ${painel.rankings.excluidos.dado_faltante} sem o dado · ${painel.rankings.excluidos.sem_colheita} sem colheita`}
        sub="Sem “melhor lote” por pontuação: a ideia é entender por que um lote foi bem ou mal. Clique num lote para ver a ficha">
        <div className="row r-1-1">
          {RANKINGS.map((r) => (
            <div key={r.chave}>
              <div className="fsec">{r.rotulo}</div>
              <table className="plan">
                <thead>
                  <tr>
                    <th className="rotulo">Lote</th><th>Tipo</th>
                    <th className="num">{r.coluna}</th>
                  </tr>
                </thead>
                <tbody>
                  {painel.rankings[r.chave].map((l) => (
                    <tr key={l.chave}
                      className={loteAberto === l.chave ? 'ln-destaque' : ''}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setLoteAberto(loteAberto === l.chave ? null : l.chave)}>
                      <td className="rotulo">
                        {dataBr(l.data_lote)}
                        {l.inconsistente && (
                          <span title="A conta de blocos deste lote não fecha"> ⚠</span>
                        )}
                        {l.divergente && l.perda_total_blocos != null && (
                          <span className="dim"
                            title={`Diferença de ${l.perda_total_blocos} blocos, fora da tolerância de ±${l.tolerancia_blocos}`}>
                            {' '}({l.perda_total_blocos > 0 ? '+' : ''}{num(l.perda_total_blocos)})
                          </span>
                        )}
                      </td>
                      <td>{l.tipo}</td>
                      <td className="num">{r.fmt(l)}</td>
                    </tr>
                  ))}
                  {painel.rankings[r.chave].length === 0 && (
                    <tr>
                      <td colSpan={3} className="empty">
                        Nenhum lote do período tem esse dado registrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ))}
        </div>
        {loteAberto != null && <FichaDoLote painel={painel} chave={loteAberto} regras={regras} />}
        <ObsForaDosRankings rankings={painel.rankings} />
      </Panel>

      <Panel title="Detalhamento por Lote"
        sub="A visão técnica linha a linha, por tipo → data do lote. Conteúdo idêntico ao da aba Indicadores da planilha">
        <div className="plan-wrap">
          <table className="plan cp">
            <thead>
              <tr>
                <th className="rotulo">Rótulos de Linha</th>
                {COLUNAS.map((c) => <th key={c} className="num">{c}</th>)}
              </tr>
            </thead>
            <tbody>
              {pivot.grupos.map((g) => (
                <GrupoTipo key={g.tipo} tipo={g.tipo} total={g.total} linhas={g.linhas}
                  recolhido={recolhidos.has(g.tipo)} onToggle={() => alternar(g.tipo)} />
              ))}
              <tr className="ln-destaque">
                <td className="rotulo">Total Geral</td>
                <Celulas m={pivot.total_geral} />
              </tr>
            </tbody>
          </table>
        </div>
        <div className="obs-tela">
          "—" indica divisão por zero (na planilha, #DIV/0!). %P/%M/%G só fazem sentido
          para SH: ficam em branco para SP/SB.
        </div>
        <NotaDoDetalhamento lotesMensuraveis={ef.lotes_mensuraveis} />
      </Panel>
    </>
  );
}

export function textoDasEstantesColhidas(e: PainelCicloEstantesColhidas): string {
  if (e.total > 0) {
    const plural = e.total === 1 ? 'estante' : 'estantes';
    const comEstante = `${e.total} ${plural} (${e.estantes.join(', ')})`;
    return e.colheitas_sem_estante > 0
      ? `${comEstante}: ${num(e.kg_sem_estante, 1)} kg sem estante confirmada`
      : comEstante;
  }
  if (e.colheitas_sem_estante > 0) {
    return `Estante ainda não informada (${num(e.kg_sem_estante, 1)} kg sem estante)`;
  }
  return '—';
}

export function FichaDoLote({ painel, chave, regras }: { painel: PainelCicloResposta; chave: string; regras: RegraMaturacao[] }) {
  const l = [
    ...painel.rankings.menor_contaminacao, ...painel.rankings.maior_kg,
    ...painel.rankings.maior_eficiencia, ...painel.rankings.maior_kg_por_bloco_aberto,
  ].find((x) => x.chave === chave);
  if (!l) return null;

  const campo = (rotulo: string, valor: string | number | null) => (
    <div className="fg" key={rotulo}>
      <label>{rotulo}</label>
      <b>{valor == null || valor === '' ? '—' : valor}</b>
    </div>
  );
  return (
    <>
      <div className="filtros" style={{ flexWrap: 'wrap' }}>
        {campo('Data do lote', dataBr(l.data_lote))}
        {campo('Tipo', l.tipo)}
        {campo('Semente (NF)', l.nf_semente)}
        {campo('Estantes', `${l.estantes} (${l.estantes_maturacao.join(', ')})`)}
        {campo('Galpão', l.galpoes.map((g) => rotuloDoGalpao(g, regras)).join(', '))}
        {campo('Blocos produzidos', num(l.blocos_produzidos))}
        {campo('Contaminados', num(l.blocos_contaminados))}
        {campo(l.contaminacao_sem_cor > 0 ? 'Verde / Laranja / Preta / Sem cor' : 'Verde / Laranja / Preta',
          `${num(l.contaminacao_verde)} / ${num(l.contaminacao_laranja)} / ${num(l.contaminacao_preta)}`
          + (l.contaminacao_sem_cor > 0 ? ` / ${num(l.contaminacao_sem_cor)}` : ''))}
        {campo('Blocos abertos', l.blocos_abertos == null ? null : num(l.blocos_abertos))}
        {campo('Abertura', dataBr(l.data_abertura))}
        {campo('Dias até abertura', l.dias_ate_abertura == null ? null : num(l.dias_ate_abertura))}
        {campo('Kg colhidos', l.kg_colhidos == null ? null : num(l.kg_colhidos, 1))}
        {campo('Estantes colhidas', textoDasEstantesColhidas(l.estantes_colhidas))}
      </div>
      {l.inconsistente && (
        <div className="obs-tela">
          ⚠ <b>A conta de blocos deste lote não fecha.</b> Ele produziu
          {' '}{num(l.blocos_produzidos)}, abriu {num(l.blocos_abertos ?? 0)} e contaminou
          {' '}{num(l.blocos_contaminados)}: a soma dos dois últimos passa do primeiro. É
          correção na planilha, não no sistema.
        </div>
      )}
    </>
  );
}

function Celulas({ m }: { m: IndicadoresCicloMetricas }) {
  return (
    <>
      <td className="num">{fmPct(m.taxa_contaminacao)}</td>
      <td className="num">{fmPct(m.taxa_aproveitamento)}</td>
      <td className="num">{fmNum(m.kg_por_bloco_aberto)}</td>
      <td className="num">{fmNum(m.eficiencia_total, 4)}</td>
      <td className="num">{fmNum(m.perda_invisivel, 0)}</td>
      <td className="num">{fmNum(m.total_kg_colhidos, 2)}</td>
      <td className="num">{fmPct(m.pct_p)}</td>
      <td className="num">{fmPct(m.pct_m)}</td>
      <td className="num">{fmPct(m.pct_g)}</td>
      <td className="num">{fmPct(m.pct_gg)}</td>
    </>
  );
}

function GrupoTipo({ tipo, total, linhas, recolhido, onToggle }: {
  tipo: string;
  total: IndicadoresCicloMetricas;
  linhas: IndicadoresCicloResposta['grupos'][number]['linhas'];
  recolhido: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr className="ln-grupo">
        <td className="rotulo">
          <button className="gr-toggle" onClick={onToggle}
            title={recolhido ? 'Expandir' : 'Recolher'}>
            <span className="gr-caret">{recolhido ? '▸' : '▾'}</span>{tipo}
          </button>
        </td>
        <Celulas m={total} />
      </tr>
      {!recolhido && linhas.map((l) => (
        <tr key={l.rotulo}>
          <td className="rotulo sub-rot">{dataBr(l.rotulo) || l.rotulo}</td>
          <Celulas m={l} />
        </tr>
      ))}
    </>
  );
}
