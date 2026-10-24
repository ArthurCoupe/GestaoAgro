import { useCallback, useEffect, useState } from 'react';
import type { ChartData } from 'chart.js';
import { Chart } from 'react-chartjs-2';
import {
  anoMesHoje, brl, getPrevisaoAbertura, getRegrasMaturacao, num, pct, putMetaOperacional, type PrevisaoAberturaResposta,
  type RegraMaturacao, variacaoEmPontos,
} from '../api/client';
import { dataBr } from '../api/constantes';
import {
  apagarDiaSemOperacao, criarDiaSemOperacao, getTermometro, type AtividadeComCalendario, type CardContraReferencia, type ChaveDaMetaDoTermometro,
  type ChaveDoIndicador, type DiaSemOperacao, type EspecieDoTermometro, type LinhaDoTermometro, type MesDoQuadro,
  type PlanejamentoDeMaturacao, type SituacaoDaAbertura, type SituacaoDoIndicador, type TermometroDoMes,
} from '../api/objetivos';
import { CampoData } from '../components/CampoData';
import { Kpi, Panel, Pill, useConfirmar, useToast } from '../components/ui';
import { baseOpts, BLUE, CINZA, GOLD, legB, OLIVEDK, PALETTE } from '../charts/setup';
import { QuadroDoTopo } from './MapaDasEstantes';
import { ROTULOS } from './MetasOperacionais';

export const ROTULO_DO_INDICADOR: Record<ChaveDoIndicador, string> = {
  BLOCOS_FABRICADOS: 'Blocos fabricados',
  BLOCOS_ABERTOS: 'Blocos abertos',
  BANDEJAS_COLHIDAS: 'Bandejas colhidas',
  BANDEJAS_APROVEITADAS: 'Bandejas aproveitadas',
  KG_COLHIDOS: 'Kg colhidos',
  BANDEJAS_VENDIDAS: 'Bandejas vendidas',
  FATURAMENTO: 'Faturamento da produção própria',
};
export const INDICADORES_DO_GRAFICO: ChaveDoIndicador[] = ['BLOCOS_FABRICADOS', 'BLOCOS_ABERTOS', 'BANDEJAS_COLHIDAS', 'BANDEJAS_APROVEITADAS', 'KG_COLHIDOS'];

export const SITUACAO: Record<SituacaoDoIndicador, { rotulo: string; tom: 'ok' | 'warn' | 'bad' | 'neutral' }> = {
  NO_RITMO: { rotulo: 'No ritmo', tom: 'ok' },
  ATENCAO: { rotulo: 'Atenção', tom: 'warn' },
  ABAIXO: { rotulo: 'Abaixo', tom: 'bad' },
  SEM_META: { rotulo: 'Sem meta', tom: 'neutral' },
  SEM_PROJECAO: { rotulo: 'Sem projeção', tom: 'neutral' },
  SEM_DADOS: { rotulo: 'Sem dados', tom: 'neutral' },
};

export const ESPECIES_DO_SELETOR: Array<{ valor: EspecieDoTermometro | 'TODAS'; rotulo: string }> = [
  { valor: 'SH', rotulo: 'Shiitake' }, { valor: 'SP', rotulo: 'Shimeji Preto' }, { valor: 'SB', rotulo: 'Shimeji Branco' },
  { valor: 'SS', rotulo: 'Shimeji Salmão' }, { valor: 'TODAS', rotulo: 'Todos os tipos' },
];

export const ROTULO_DA_ATIVIDADE: Record<AtividadeComCalendario, string> = { FABRICACAO: 'Fabricação', COLHEITA: 'Colheita', VENDAS: 'Vendas' };
const ATIVIDADES: AtividadeComCalendario[] = ['FABRICACAO', 'COLHEITA', 'VENDAS'];

export const CHAVES_DO_EDITOR: ChaveDaMetaDoTermometro[] = [
  'meta_mes_blocos_abertos', 'meta_mes_bandejas_produzidas', 'meta_mes_bandejas_vendidas',
  'ref_preco_medio_bandeja', 'ref_bandejas_por_bloco', 'ref_kg_por_bloco', 'limite_contaminacao_abertos_pct',
  'fabricacao_blocos_por_dia', 'abertura_blocos_por_sala', 'abertura_ciclo_dias', 'abertura_salas',
  'fabricacao_margem_contaminacao_pct',
];

export function valorDoIndicador(chave: ChaveDoIndicador, v: number | null): string {
  if (chave === 'FATURAMENTO') return brl(v);
  if (chave === 'KG_COLHIDOS') return num(v, 1);
  return num(v, 0);
}
export const diaMes = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '—');

export function textoDaAtualizacao(a: TermometroDoMes['atualizacao']): string {
  const d = (x: string | null) => (x ? dataBr(x) : 'sem lançamento');
  return `Dados até: produção ${d(a.producao)}, embalagem ${d(a.embalagem)}, vendas ${d(a.vendas)}${a.vendas_parcial ? ' (o mês das vendas ainda está parcial)' : ''}.`;
}

export function dadosDasColunas(indicadores: LinhaDoTermometro[]) {
  const linhas = INDICADORES_DO_GRAFICO.map((c) => indicadores.find((l) => l.chave === c)).filter((l): l is LinhaDoTermometro => !!l);
  const viavel = linhas.map((l) => l.abertura_viavel?.pct_da_meta ?? null);
  return {
    labels: linhas.map((l) => ROTULO_DO_INDICADOR[l.chave]),
    datasets: [
      { label: 'Realizado (% da meta)', data: linhas.map((l) => l.pct_realizado), backgroundColor: OLIVEDK },
      { label: 'Projeção (% da meta)', data: linhas.map((l) => l.pct_projecao), backgroundColor: GOLD },
      ...(viavel.some((v) => v != null) ? [{ label: 'Abertura viável (% da meta)', data: viavel, backgroundColor: BLUE }] : []),
      { label: 'Meta (100%)', data: linhas.map((l) => (l.meta != null && l.meta > 0 ? 100 : null)), backgroundColor: CINZA },
    ].map((s) => ({ ...s, skipNull: true })),
  };
}

export function dadosDaEvolucao(t: Pick<TermometroDoMes, 'mes' | 'indicadores'>) {
  const [ano, mes] = t.mes.split('-').map(Number);
  const total = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const datas = Array.from({ length: total }, (_, i) => `${t.mes}-${String(i + 1).padStart(2, '0')}`);
  const linhas = INDICADORES_DO_GRAFICO.map((c) => t.indicadores.find((l) => l.chave === c))
    .filter((l): l is LinhaDoTermometro => !!l && l.meta != null && l.meta > 0);
  return {
    labels: datas.map(diaMes),
    datasets: linhas.map((l, i) => {
      const porDia = new Map(l.serie.map((s) => [s.data, s.acumulado]));
      const meta = l.meta ?? 0;
      return {
        label: ROTULO_DO_INDICADOR[l.chave], borderColor: PALETTE[i % PALETTE.length], backgroundColor: PALETTE[i % PALETTE.length],
        data: datas.map((d) => { const a = porDia.get(d); return a == null ? null : Math.round((a / meta) * 1000) / 10; }),
        spanGaps: false, pointRadius: 2,
      };
    }),
  };
}

export function textoDoAnterior(valor: string, ate: string | null, semDados: string | null): string {
  if (semDados) return `Mês anterior sem número: ${semDados}.`;
  if (!ate) return `Mês anterior ${valor}.`;
  const ultimo = new Date(Date.UTC(Number(ate.slice(0, 4)), Number(ate.slice(5, 7)), 0)).getUTCDate();
  return Number(ate.slice(8, 10)) < ultimo ? `Mês anterior, até ${diaMes(ate)}: ${valor}.` : `Mês anterior ${valor}.`;
}

type Tom = 'good' | 'alert' | undefined;
const tomDoCard = (s: 'FAVORAVEL' | 'DESFAVORAVEL' | 'SEM_REFERENCIA'): Tom => (s === 'FAVORAVEL' ? 'good' : s === 'DESFAVORAVEL' ? 'alert' : undefined);
const dec = (v: number | null, casas: number) => (v == null ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas }));
const referencia = (rotulo: string, texto: string | null) => (texto == null ? 'Sem referência cadastrada.' : `${rotulo} ${texto}.`);
const sinal = (v: number) => (v > 0 ? '+' : '');

function situacaoContra(alvo: 'meta' | 'referência', c: CardContraReferencia, escrever: (v: number) => string): string {
  if (c.situacao === 'SEM_REFERENCIA' || c.diferenca == null) return '';
  if (c.diferenca === 0) return ` Na ${alvo}.`;
  const emPct = c.diferenca_pct == null ? '' : ` (${sinal(c.diferenca_pct)}${pct(c.diferenca_pct)})`;
  return ` ${c.diferenca > 0 ? 'Acima' : 'Abaixo'} da ${alvo}: ${sinal(c.diferenca)}${escrever(c.diferenca)}${emPct}.`;
}
function situacaoNoLimite(c: CardContraReferencia): string {
  if (c.situacao === 'SEM_REFERENCIA' || c.valor == null || c.referencia == null) return '';
  const pontos = variacaoEmPontos(c.valor, c.referencia);
  const quanto = pontos === 0 ? '' : `: ${sinal(pontos)}${num(pontos, 1)} ${Math.abs(pontos) < 2 ? 'ponto percentual' : 'pontos percentuais'}`;
  return ` ${c.situacao === 'FAVORAVEL' ? 'Dentro' : 'Acima'} do limite${quanto}.`;
}

export function textosDosCards(c: TermometroDoMes['cards']): Array<{ label: string; value: string; delta: string; tone: Tom; info: string }> {
  const ultimo = c.preco_medio.ultimo_apurado;
  const ultimoTexto = ultimo ? ` Último mês apurado: ${ultimo.mes.slice(5, 7)}/${ultimo.mes.slice(0, 4)}, ${num(ultimo.bandejas, 0)} bandejas a ${brl(ultimo.preco_medio)}.` : '';
  const vend = c.bandejas_vendidas;
  const variacao = vend.variacao == null ? ''
    : `, variação de ${sinal(vend.variacao)}${num(vend.variacao, 0)}${vend.variacao_pct != null ? ` (${sinal(vend.variacao_pct)}${pct(vend.variacao_pct)})` : ''}`;
  return [
    { label: 'Bandejas por bloco', value: dec(c.bandejas_por_bloco.valor, 2), tone: tomDoCard(c.bandejas_por_bloco.situacao),
      delta: `${referencia('Meta', c.bandejas_por_bloco.referencia == null ? null : dec(c.bandejas_por_bloco.referencia, 2))} Mês anterior ${dec(c.bandejas_por_bloco.anterior, 2)}.`
        + situacaoContra('meta', c.bandejas_por_bloco, (v) => dec(v, 2)),
      info: 'Bandejas colhidas no mês dividido pelos blocos abertos no mês.' },
    { label: 'Kg por bloco', value: num(c.kg_por_bloco.valor, 3), tone: tomDoCard(c.kg_por_bloco.situacao),
      delta: `${referencia('Referência', c.kg_por_bloco.referencia == null ? null : num(c.kg_por_bloco.referencia, 3))} Mês anterior ${num(c.kg_por_bloco.anterior, 3)}.`
        + situacaoContra('referência', c.kg_por_bloco, (v) => num(v, 3)),
      info: 'Kg colhidos no mês dividido pelos blocos abertos no mês.' },
    { label: 'Contaminação dos abertos no mês', value: pct(c.contaminacao.valor), tone: tomDoCard(c.contaminacao.situacao),
      delta: `${num(c.contaminacao.contaminados, 0)} de ${num(c.contaminacao.base, 0)} blocos. ${referencia('Limite', c.contaminacao.referencia == null ? null : pct(c.contaminacao.referencia))} Mês anterior ${pct(c.contaminacao.anterior)}.`
        + situacaoNoLimite(c.contaminacao),
      info: 'Blocos contaminados dos lotes abertos no mês, sobre o total de blocos desses lotes.' },
    { label: 'Preço médio da bandeja', value: brl(c.preco_medio.valor), tone: tomDoCard(c.preco_medio.situacao),
      delta: c.preco_medio.sem_dados ? `${c.preco_medio.sem_dados}${ultimoTexto}`
        : `${referencia('Referência', c.preco_medio.referencia == null ? null : brl(c.preco_medio.referencia))} ${textoDoAnterior(brl(c.preco_medio.anterior), c.preco_medio.anterior_ate, c.preco_medio.anterior_sem_dados)}`
          + `${situacaoContra('referência', c.preco_medio, brl)} Vendas até ${diaMes(c.preco_medio.dados_ate)}.`,
      info: 'Faturamento da produção própria dividido pelas bandejas vendidas, pelo relatório de vendas do ERP.' },
    { label: 'Bandejas vendidas', value: num(vend.valor, 0), tone: vend.meta != null && vend.falta === 0 ? 'good' : undefined,
      delta: vend.sem_dados ? `${vend.sem_dados}${ultimoTexto}`
        : `${vend.meta != null ? `Meta ${num(vend.meta, 0)}, faltam ${num(vend.falta, 0)}. ` : 'Sem meta. '}${textoDoAnterior(`${num(vend.anterior, 0)}${variacao}`, vend.anterior_ate, vend.anterior_sem_dados)} Vendas até ${diaMes(vend.dados_ate)}.`,
      info: 'Bandejas de cogumelo de produção própria vendidas no mês, pelo relatório de vendas do ERP.' },
  ];
}

export function textoDaMeta(m: { valor: number | null; unidade: string }): string {
  if (m.valor == null) return 'sem meta';
  if (m.unidade === 'R$') return brl(m.valor);
  if (m.unidade === '%') return pct(m.valor);
  return `${num(m.valor, 3)} ${m.unidade}`;
}

export type FormDia = { data: string; atividade: AtividadeComCalendario; motivo: string };
export function corpoDoDia(f: FormDia): { corpo: FormDia } | { falta: string } {
  if (!f.data) return { falta: 'Escolha o dia.' };
  const motivo = f.motivo.trim();
  if (!motivo) return { falta: 'Escreva o motivo (feriado, manutenção...).' };
  return { corpo: { data: f.data, atividade: f.atividade, motivo: motivo.slice(0, 200) } };
}

export function textoDaConfirmacaoDaMeta(chave: string, valor: number, desde: string): string {
  return `${ROTULOS[chave] ?? chave}: ${num(valor, 3)} a partir de ${dataBr(desde)}, também nos meses seguintes até você cadastrar outro valor. `
    + 'Se já houver um valor gravado com essa mesma data, ele é trocado. Gravar?';
}

const mesDeHoje = () => { const { ano, mes } = anoMesHoje(); return `${ano}-${String(mes).padStart(2, '0')}`; };

export const mesAno = (mes: string) => `${mes.slice(5, 7)}/${mes.slice(0, 4)}`;
export const MESES_ABERTOS = 3;
export const mesesVisiveis = (meses: MesDoQuadro[], expandido: boolean) => (expandido ? meses : meses.slice(0, MESES_ABERTOS));

export function textoDaDataDosDados(p: PlanejamentoDeMaturacao): string {
  const d = (x: string | null) => (x ? dataBr(x) : 'sem lançamento');
  return `Lançamentos da maturação até ${dataBr(p.data_dos_dados)} (produção ${d(p.lancamentos.producao)}, abertura ${d(p.lancamentos.abertura)}, `
    + `retirada ${d(p.lancamentos.retirada)}); depois disso, tudo é projeção. Shiitake, maturação de ${p.prazo_dias == null ? 'prazo não cadastrado' : `${p.prazo_dias} dias`}.`;
}

export function textoForaDaConta(p: PlanejamentoDeMaturacao): string | null {
  const f = p.fora_da_conta;
  const partes = [
    f.estantes_sem_contagem > 0 ? `${f.estantes_sem_contagem} estante(s) sem contagem própria` : null,
    f.estantes_conta_negativa > 0 ? `${f.estantes_conta_negativa} estante(s) com a conta que não fecha (mais blocos baixados que guardados)` : null,
    f.estantes_sem_data > 0 ? `${f.estantes_sem_data} estante(s) com data de lote no futuro (${num(f.blocos_sem_data, 0)} blocos)` : null,
  ].filter(Boolean);
  const salas = f.salas_sem_ancora > 0
    ? `${f.salas_sem_ancora} sala(s) da meta de salas sem abertura lançada e sem data de início ficam fora dos quadros: cadastre o número de salas com a data em que a sala nova começa.`
    : null;
  const texto = [partes.length === 0 ? null : `Fora da conta: ${partes.join('; ')}. Acertando o lançamento, elas entram.`, salas].filter(Boolean).join(' ');
  return texto || null;
}

export function textoDoAlertaDeFalta(p: PlanejamentoDeMaturacao): string | null {
  const a = p.aberturas.find((x) => x.falta > 0);
  if (!a) return null;
  return `A abertura programada de ${dataBr(a.data)} tem ${num(a.necessarios, 0)} blocos e só ${num(a.viaveis, 0)} maturados: faltam ${num(a.falta, 0)}. `
    + 'A meta de abertura não muda; a fabricação necessária para cobrir as próximas está no Quadro 2.';
}

export function kpisDaMaturacao(p: PlanejamentoDeMaturacao, mes: string): Array<{ label: string; value: string; delta: string; info: string }> {
  const e = p.em_maturacao;
  const m = p.meses.find((x) => x.mes === mes);
  const fim = new Date(Date.UTC(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0)).toISOString().slice(0, 10);
  const diaSeguinte = (iso: string) => new Date(Date.parse(`${iso}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
  let partes: string;
  if (!m) partes = `A previsão vai de ${mesAno(p.meses[0]?.mes ?? p.data_dos_dados.slice(0, 7))} a ${mesAno(p.meses[p.meses.length - 1]?.mes ?? p.fim.slice(0, 7))}.`;
  else if (m.saldo_inicial_em === fim) partes = `${num(m.saldo_inicial, 0)} maturados até ${diaMes(fim)}, antes das aberturas do mês.`;
  else if (m.saldo_inicial_em) {
    partes = `${num(m.saldo_inicial, 0)} maturados até ${diaMes(m.saldo_inicial_em)} e ${num(m.total_maturado, 0)} que maturam de `
      + `${diaMes(diaSeguinte(m.saldo_inicial_em))} a ${diaMes(fim)}, antes das aberturas do mês.`;
  } else partes = `${num(m.saldo_inicial, 0)} já maturados no início do mês e ${num(m.total_maturado, 0)} que maturam no mês, antes das aberturas do mês.`;
  const f = p.fora_da_conta;
  const fora = f.estantes_sem_contagem + f.estantes_conta_negativa + f.estantes_sem_data > 0 ? ' Não contam as estantes do aviso abaixo do quadro.' : '';
  return [
    { label: `Blocos em maturação em ${diaMes(e.data)}`, value: num(e.total, 0),
      delta: `${num(e.maturados, 0)} já maturados, à espera de abertura, e ${num(e.maturando, 0)} ainda maturando.${fora}`,
      info: 'Shiitake: os blocos guardados nas estantes de maturação menos os contaminados, as perdas e os já abertos, na data dos lançamentos da maturação.' },
    { label: `Disponíveis para abertura em ${mesAno(mes)}`, value: m ? num(m.disponiveis_no_mes, 0) : '—', delta: m ? `${partes}${fora}` : partes,
      info: 'Os blocos maturados no início do mês mais os que completam a maturação dentro dele, antes de descontar as aberturas do mês.' },
  ];
}

export const SITUACAO_DA_ABERTURA: Record<SituacaoDaAbertura, { rotulo: string; tom: 'ok' | 'warn' | 'bad' }> = {
  COBERTA: { rotulo: 'Coberta', tom: 'ok' },
  FABRICAR: { rotulo: 'Fabricar', tom: 'warn' },
  PRAZO_VENCIDO: { rotulo: 'Prazo de fabricação passou', tom: 'bad' },
};
const ROTULO_DA_SEMANA = ['1 a 7', '8 a 14', '15 a 21', '22 a 28', '29 ao fim'];

export function QuadroDeMaturacao({ p, expandido }: { p: PlanejamentoDeMaturacao; expandido: boolean }) {
  return (
    <table className="tbl">
      <thead>
        <tr>
          <th>Mês</th><th className="num">Saldo<br />inicial</th>
          {ROTULO_DA_SEMANA.map((s, i) => <th key={s} className="num">Semana {i + 1}<br />({s})</th>)}
          <th className="num">Total<br />maturado</th><th className="num">Aberturas<br />programadas</th>
          <th className="num">Aberturas<br />viáveis</th><th className="num">Déficit</th><th className="num">Saldo<br />disponível</th>
        </tr>
      </thead>
      <tbody>
        {mesesVisiveis(p.meses, expandido).map((m) => (
          <tr key={m.mes}>
            <td>{mesAno(m.mes)}</td>
            <td className="num">{num(m.saldo_inicial, 0)}{m.saldo_inicial_em && <><br /><small>em {diaMes(m.saldo_inicial_em)}</small></>}</td>
            {ROTULO_DA_SEMANA.map((_, i) => {
              const s = m.semanas[i];
              if (!s) return <td key={i} className="num" />;
              return (
                <td key={i} className="num" title={`${dataBr(s.desde ?? s.de)} a ${dataBr(s.ate)}`}>
                  {s.blocos == null ? '—' : num(s.blocos, 0)}{s.desde && <><br /><small>desde {diaMes(s.desde)}</small></>}
                </td>
              );
            })}
            <td className="num">{num(m.total_maturado, 0)}</td>
            <td className="num">{num(m.aberturas_programadas, 0)}</td>
            <td className="num">{num(m.aberturas_viaveis, 0)}</td>
            <td className="num">{m.deficit > 0 ? <Pill tone="bad">{num(m.deficit, 0)}</Pill> : num(0, 0)}</td>
            <td className="num">{num(m.saldo_disponivel, 0)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function QuadroDeFabricacao({ p, expandido, metaPorDia }: { p: PlanejamentoDeMaturacao; expandido: boolean; metaPorDia: number | null }) {
  const meses = new Set(mesesVisiveis(p.meses, expandido).map((m) => m.mes));
  const aberturas = p.aberturas.filter((a) => meses.has(a.data.slice(0, 7)));
  return (
    <>
      {aberturas.length === 0 ? <div className="empty">Nenhuma abertura programada nos meses mostrados.</div> : (
        <table className="tbl">
          <thead>
            <tr>
              <th>Abertura</th><th className="num">Salas</th><th className="num">Blocos<br />necessários</th>
              <th className="num">Maturados<br />na data</th><th className="num">Abertura<br />viável</th><th className="num">Falta</th>
              <th className="num">Contaminação<br />prevista</th><th className="num">Blocos a<br />fabricar</th><th>Fabricar<br />até</th><th>Situação</th>
            </tr>
          </thead>
          <tbody>
            {aberturas.map((a) => (
              <tr key={a.data}>
                <td>{dataBr(a.data)}</td><td className="num">{a.salas}</td><td className="num">{num(a.necessarios, 0)}</td>
                <td className="num">{num(a.disponivel, 0)}</td><td className="num">{num(a.viaveis, 0)}</td><td className="num">{num(a.falta, 0)}</td>
                <td className="num">{a.falta > 0 ? pct(a.margem_pct) : '—'}</td>
                <td className="num">{a.a_fabricar > 0 ? num(a.a_fabricar, 0) : '—'}</td>
                <td>{a.falta > 0 && a.data_limite ? dataBr(a.data_limite) : '—'}</td>
                <td><Pill tone={SITUACAO_DA_ABERTURA[a.situacao].tom}>{SITUACAO_DA_ABERTURA[a.situacao].rotulo}</Pill></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <h4>Fabricação necessária por mês (pela data-limite)</h4>
      {p.fabricacao_por_mes.length === 0 ? <div className="empty">Nenhuma fabricação a mais: os blocos maturados e os que já estão na maturação cobrem as aberturas programadas com prazo.</div> : (
        <table className="tbl">
          <thead>
            <tr>
              <th>Mês</th><th className="num">Blocos a<br />fabricar</th><th className="num">Dias de fabricação<br />(de hoje em diante)</th>
              <th className="num">Por dia</th><th className="num">Por semana</th><th className="num">Meta de fabricação<br />por dia</th>
            </tr>
          </thead>
          <tbody>
            {p.fabricacao_por_mes.map((f) => (
              <tr key={f.mes}>
                <td>{mesAno(f.mes)}</td><td className="num">{num(f.blocos, 0)}</td><td className="num">{f.dias_de_fabricacao}</td>
                <td className="num">{f.por_dia == null ? '—' : num(f.por_dia, 0)}</td>
                <td className="num">{f.por_semana == null ? '—' : num(f.por_semana, 0)}</td>
                <td className="num">{metaPorDia == null ? '—' : num(metaPorDia, 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {p.prazo_vencido.aberturas > 0 && (
        <div className="obs-tela"><Pill tone="bad">Prazo passou</Pill> {`${p.prazo_vencido.aberturas} abertura(s) programada(s) com a data-limite de fabricação já passada (${num(p.prazo_vencido.blocos, 0)} blocos): ficam fora da fabricação por mês, porque o bloco fabricado hoje não matura a tempo.`}</div>
      )}
    </>
  );
}

export function OcupacaoDosGalpoes() {
  const [dados, setDados] = useState<PrevisaoAberturaResposta | null>(null);
  const [regras, setRegras] = useState<RegraMaturacao[]>([]);
  const [erro, setErro] = useState('');
  useEffect(() => {
    let vale = true;
    getPrevisaoAbertura({ quadro: '1' }).then((r) => { if (vale) setDados(r); }).catch((e) => { if (vale) setErro(e?.response?.data?.erro ?? e.message); });
    getRegrasMaturacao().then((r) => { if (vale) setRegras(r); }).catch(() => { if (vale) setRegras([]); });
    return () => { vale = false; };
  }, []);
  if (erro) return <div className="empty">Erro: {erro}</div>;
  if (!dados) return <div className="loading">Carregando a ocupação dos galpões…</div>;
  return <QuadroDoTopo quadro={dados.quadro} regras={regras} />;
}

export function TabelaDoTermometro({ indicadores }: { indicadores: LinhaDoTermometro[] }) {
  return (
    <table className="tbl">
      <thead>
        <tr>
          <th>Indicador</th><th className="num">Meta<br />do mês</th><th className="num">Realizado<br />até a data</th>
          <th className="num">Média por dia<br />operacional</th><th className="num">Projeção de<br />fechamento</th>
          <th className="num">%<br />projetado</th><th className="num">Diferença<br />para a meta</th>
          <th className="num">Ritmo necessário<br />por dia</th><th>Situação</th>
        </tr>
      </thead>
      <tbody>
        {indicadores.flatMap((l) => {
          const linha = (
            <tr key={l.chave}>
              <td>{ROTULO_DO_INDICADOR[l.chave]}{l.sem_dados && <><br /><small>{l.sem_dados}</small></>}</td>
              <td className="num">{l.meta == null ? 'sem meta' : valorDoIndicador(l.chave, l.meta)}</td>
              <td className="num">{valorDoIndicador(l.chave, l.realizado)}{l.dados_ate && <><br /><small>até {diaMes(l.dados_ate)}</small></>}</td>
              <td className="num">{l.chave === 'FATURAMENTO' ? brl(l.media_por_dia) : num(l.media_por_dia, 1)}</td>
              <td className="num">{valorDoIndicador(l.chave, l.projecao)}</td>
              <td className="num">{pct(l.pct_projecao)}</td>
              <td className="num">{valorDoIndicador(l.chave, l.diferenca)}</td>
              <td className="num">{l.chave === 'FATURAMENTO' ? brl(l.ritmo_necessario) : num(l.ritmo_necessario, 1)}</td>
              <td><Pill tone={SITUACAO[l.situacao].tom}>{SITUACAO[l.situacao].rotulo}</Pill></td>
            </tr>
          );
          const v = l.abertura_viavel;
          if (!v) return [linha];
          return [linha, (
            <tr key={`${l.chave}|viavel`}>
              <td>Abertura viável<br /><small>o lançado e as aberturas programadas desde {diaMes(v.desde)}, ainda não lançadas, que os blocos maturados cobrem</small></td>
              <td className="num">{l.meta == null ? 'sem meta' : num(l.meta, 0)}</td>
              <td className="num">{num(v.viavel, 0)}</td>
              <td className="num" /><td className="num" />
              <td className="num">{pct(v.pct_da_meta)}</td>
              <td className="num">{l.meta == null ? '—' : num(v.viavel - l.meta, 0)}</td>
              <td className="num">{v.primeira_falta ? <small>falta a partir de {diaMes(v.primeira_falta)}</small> : ''}</td>
              <td><Pill tone={SITUACAO[v.situacao].tom}>{SITUACAO[v.situacao].rotulo}</Pill></td>
            </tr>
          )];
        })}
      </tbody>
    </table>
  );
}

export function BudgetProjecoes() {
  const toast = useToast();
  const confirmar = useConfirmar();
  const [mes, setMes] = useState(mesDeHoje);
  const [especie, setEspecie] = useState<EspecieDoTermometro | 'TODAS'>('SH');
  const [dados, setDados] = useState<TermometroDoMes | null>(null);
  const [erro, setErro] = useState('');
  const [grafico, setGrafico] = useState<'COLUNAS' | 'LINHAS'>('COLUNAS');
  const [dia, setDia] = useState<FormDia>({ data: '', atividade: 'FABRICACAO', motivo: '' });
  const [edicao, setEdicao] = useState<Record<string, { valor: string; desde: string }>>({});
  const [salvando, setSalvando] = useState(false);
  const [expandido, setExpandido] = useState(false);

  const [pedido, setPedido] = useState(0);
  const recarregar = useCallback(() => setPedido((n) => n + 1), []);
  useEffect(() => {
    let vale = true;
    setErro('');
    getTermometro({ mes, especie })
      .then((d) => { if (vale) setDados(d); })
      .catch((e) => { if (vale) setErro(e?.response?.data?.erro ?? e.message); });
    return () => { vale = false; };
  }, [mes, especie, pedido]);

  const filtros = (
    <div className="filtros">
      <div className="fg"><label>Mês</label>
        <input type="month" value={mes} min="2020-01" max="2100-12" onChange={(e) => e.target.value && setMes(e.target.value)} /></div>
      <div className="fg"><label>Tipo de cogumelo (produção)</label>
        <select value={especie} onChange={(e) => setEspecie(ESPECIES_DO_SELETOR.find((o) => o.valor === e.target.value)?.valor ?? 'SH')}>
          {ESPECIES_DO_SELETOR.map((o) => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
        </select></div>
    </div>
  );
  if (erro) return <>{filtros}<div className="empty">Erro: {erro}</div></>;
  if (!dados || dados.mes !== mes || (dados.especie ?? 'TODAS') !== especie) return <>{filtros}<div className="loading">Carregando o Budget / Projeções…</div></>;

  const executar = (p: Promise<unknown>, ok: string) => {
    setSalvando(true);
    p.then(() => { toast(ok); recarregar(); })
      .catch((e) => toast(e?.response?.data?.erro ?? e.message, true))
      .finally(() => setSalvando(false));
  };
  const rd = corpoDoDia(dia);
  const registrarDia = () => {
    if (!('corpo' in rd)) return;
    executar(criarDiaSemOperacao(rd.corpo).then(() => setDia({ ...dia, data: '', motivo: '' })),
      `${ROTULO_DA_ATIVIDADE[rd.corpo.atividade]} sem operação em ${dataBr(rd.corpo.data)}: registrado.`);
  };
  const apagarDia = async (d: DiaSemOperacao) => {
    if (!(await confirmar(`Apagar o dia sem operação de ${ROTULO_DA_ATIVIDADE[d.atividade]} em ${dataBr(d.data)} (${d.motivo})? O dia volta a contar no calendário.`))) return;
    executar(apagarDiaSemOperacao(d.id), 'Dia sem operação apagado.');
  };
  const gravarMeta = async (chave: ChaveDaMetaDoTermometro) => {
    const e = edicao[chave];
    const valor = Number((e?.valor ?? '').trim().replace(',', '.'));
    const desde = e?.desde || `${mes}-01`;
    if (!e || e.valor.trim() === '' || !Number.isFinite(valor)) return;
    if (!(await confirmar(textoDaConfirmacaoDaMeta(chave, valor, desde)))) return;
    executar(putMetaOperacional({ chave, valor, vigenteDesde: desde }).then(() => setEdicao((prev) => { const p = { ...prev }; delete p[chave]; return p; })),
      `${ROTULOS[chave] ?? chave}: gravado, vale desde ${dataBr(desde)}.`);
  };
  const cal = dados.calendario;
  const plan = dados.planejamento;
  const alerta = textoDoAlertaDeFalta(plan);
  const fora = textoForaDaConta(plan);

  return (
    <>
      {filtros}
      <div className="obs-tela">{textoDaAtualizacao(dados.atualizacao)}</div>

      <div className="kpi-grid k5">
        {textosDosCards(dados.cards).map((k) => <Kpi key={k.label} label={k.label} value={k.value} delta={k.delta} tone={k.tone} info={k.info} />)}
      </div>
      {alerta && <div className="obs-tela"><Pill tone="bad">Faltam blocos maturados</Pill> {alerta}</div>}

      <Panel title="Cumprimento das metas do mês" pergunta="Se o mês continuar no ritmo de hoje, quanto de cada meta vai ser cumprido?">
        <div className="tabs">
          <button type="button" className={`tab ${grafico === 'COLUNAS' ? 'active' : ''}`} onClick={() => setGrafico('COLUNAS')}>Realizado, projeção e meta</button>
          <button type="button" className={`tab ${grafico === 'LINHAS' ? 'active' : ''}`} onClick={() => setGrafico('LINHAS')}>Evolução diária</button>
        </div>
        <div className="chart-box" style={{ height: 300 }}>
          {grafico === 'COLUNAS' ? (
            <Chart type="bar" data={dadosDasColunas(dados.indicadores) as unknown as ChartData<'bar'>}
              options={{ ...baseOpts, ...legB, scales: { ...baseOpts.scales, y: { ...baseOpts.scales.y, beginAtZero: true, ticks: { callback: (v) => `${v}%` } } } }} />
          ) : (
            <Chart type="line" data={dadosDaEvolucao(dados) as unknown as ChartData<'line'>}
              options={{ ...baseOpts, ...legB, scales: { ...baseOpts.scales, y: { ...baseOpts.scales.y, beginAtZero: true, ticks: { callback: (v) => `${v}%` } } } }} />
          )}
        </div>
      </Panel>

      <Panel title="Termômetro do mês" sub="Média por dia operacional: o realizado dividido pelos dias de operação já passados. Projeção: o realizado mais a média vezes os dias de operação que faltam. Situação: no ritmo com a projeção a partir de 100% da meta, atenção de 95% a 100%, abaixo de 95%.">
        <TabelaDoTermometro indicadores={dados.indicadores} />
      </Panel>

      <Panel title="Previsão de Maturação e Disponibilidade" sub={`Quadro 1. Por mês: o saldo de blocos maturados no início, os que maturam em cada semana (blocos guardados menos contaminados, perdas e já abertos, pela data prevista de abertura), as aberturas programadas, as viáveis com os blocos que há e o saldo no fim do mês. Recalculado pelos lançamentos sempre que a tela abre. ${textoDaDataDosDados(plan)}`}>
        <div className="kpi-grid k2">
          {kpisDaMaturacao(plan, mes).map((k) => <Kpi key={k.label} label={k.label} value={k.value} delta={k.delta} info={k.info} />)}
        </div>
        <QuadroDeMaturacao p={plan} expandido={expandido} />
        {plan.meses.length > MESES_ABERTOS && (
          <button type="button" className="gr-toggle" onClick={() => setExpandido(!expandido)}>
            {expandido ? 'Recolher meses' : `Expandir meses até ${mesAno(plan.fim.slice(0, 7))}`}
          </button>
        )}
        {fora && <div className="obs-tela">{fora}</div>}
      </Panel>

      <Panel title="Fabricação Necessária" sub={`Quadro 2. Para cada abertura programada: os blocos que faltam depois das aberturas anteriores (o mesmo bloco não serve duas aberturas), os blocos a fabricar com a contaminação prevista da linha (a vigente na data-limite, ou a de hoje quando ela já passou; hoje ${pct(plan.margem_pct)}: a falta dividida por ${pct(100 - plan.margem_pct)}, arredondando para cima) e a data-limite, a abertura menos ${plan.prazo_dias ?? '?'} dias de maturação. Aberturas programadas até ${dataBr(plan.fim)}. Por mês, o por dia é o maior ritmo das datas-limite do mês: para cada uma, todos os blocos que vencem até ela, divididos pelos dias de fabricação de hoje até ela. Por isso não é os blocos do mês divididos pelos dias do mês, e um mês pode pedir menos que o anterior; o maior da tabela, de hoje em diante, cumpre todas as datas-limite. A data-limite sem dia de fabricação antes dela conta um dia, com atraso.`}>
        <QuadroDeFabricacao p={plan} expandido={expandido} metaPorDia={dados.metas.fabricacao_blocos_por_dia.valor} />
      </Panel>

      <Panel title="Ocupação dos galpões" sub="O mesmo quadro do topo do Mapa das Estantes: por galpão, as estantes ocupadas e as vazias, com a data do último lançamento.">
        <OcupacaoDosGalpoes />
      </Panel>

      <Panel title="Calendário do mês" sub={`Dias de operação: fabricação ${cal.dias.FABRICACAO} (segunda a quinta), colheita ${cal.dias.COLHEITA} (todos os dias), vendas ${cal.dias.VENDAS} (segunda a sábado), menos os dias sem operação; abertura em ${cal.dias.ABERTURA} dias, pelas aberturas programadas.`}>
        {cal.salas_sem_ancora > 0 && (
          <div className="obs-tela"><Pill tone="warn">Atenção</Pill> {`${cal.salas_sem_ancora} sala(s) da meta de salas sem abertura lançada e sem data de início: a programação não as conta. Cadastre o número de salas com a data em que a sala nova começa.`}</div>
        )}
        <div className="obs-tela">{cal.ancoras.length === 0 ? 'Nenhuma abertura lançada com sala.' : `Última abertura lançada por sala: ${cal.ancoras.map((a) => `${a.sala} em ${dataBr(a.data)}`).join(', ')}.`}</div>
        {cal.aberturas_programadas.length === 0 ? <div className="empty">Nenhuma abertura programada no mês.</div> : (
          <table className="tbl">
            <thead><tr><th>Data</th><th>Sala</th><th className="num">Blocos</th></tr></thead>
            <tbody>
              {cal.aberturas_programadas.map((a) => (
                <tr key={`${a.data}|${a.sala}`}><td>{dataBr(a.data)}</td><td>{a.sala}</td><td className="num">{num(a.blocos, 0)}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      <Panel title="Dias sem operação" sub="Feriado ou parada: o dia sai do calendário da atividade, e a média e a projeção passam a contar sem ele.">
        {cal.dias_sem_operacao.length > 0 && (
          <table className="tbl">
            <thead><tr><th>Data</th><th>Atividade</th><th>Motivo</th><th /></tr></thead>
            <tbody>
              {cal.dias_sem_operacao.map((d) => (
                <tr key={d.id}><td>{dataBr(d.data)}</td><td>{ROTULO_DA_ATIVIDADE[d.atividade]}</td><td>{d.motivo}</td>
                  <td><button type="button" className="gr-toggle" disabled={salvando} onClick={() => apagarDia(d)}>Apagar</button></td></tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="form-grid c4">
          <div className="fg"><label>Dia</label><CampoData value={dia.data} disabled={salvando} onChange={(iso) => setDia({ ...dia, data: iso })} /></div>
          <div className="fg"><label>Atividade</label>
            <select value={dia.atividade} disabled={salvando} onChange={(e) => setDia({ ...dia, atividade: ATIVIDADES.find((a) => a === e.target.value) ?? 'FABRICACAO' })}>
              {ATIVIDADES.map((a) => <option key={a} value={a}>{ROTULO_DA_ATIVIDADE[a]}</option>)}
            </select></div>
          <div className="fg"><label>Motivo</label>
            <input value={dia.motivo} maxLength={200} disabled={salvando} onChange={(e) => setDia({ ...dia, motivo: e.target.value })} /></div>
          <div className="fg"><label>&nbsp;</label>
            <button type="button" className="btn" disabled={'falta' in rd || salvando} onClick={registrarDia}>Registrar</button></div>
        </div>
        {'falta' in rd && (dia.data || dia.motivo) && <div className="obs-tela">{rd.falta}</div>}
      </Panel>

      <Panel title="Metas e parâmetros" sub={`Os valores que valem em ${mes.slice(5, 7)}/${mes.slice(0, 4)}. Cada mudança vale a partir do dia escolhido (o primeiro dia do mês, por padrão) e nos meses seguintes, até outra mudança: os meses anteriores não mudam.`}>
        <table className="tbl">
          <thead><tr><th>Meta ou parâmetro</th><th className="num">Vale no mês</th><th>Origem</th><th>Novo valor</th><th>Vale desde</th><th /></tr></thead>
          <tbody>
            {CHAVES_DO_EDITOR.map((c) => {
              const m = dados.metas[c];
              const e = edicao[c] ?? { valor: '', desde: `${mes}-01` };
              const mudar = (x: Partial<typeof e>) => setEdicao({ ...edicao, [c]: { ...e, ...x } });
              return (
                <tr key={c}>
                  <td>{ROTULOS[c] ?? c}</td>
                  <td className="num">{textoDaMeta(m)}</td>
                  <td>{m.origem === 'BANCO' ? `definido pela gestão, desde ${dataBr(m.vigente_desde)}` : 'padrão do sistema'}</td>
                  <td><input type="number" min={0} step="any" value={e.valor} disabled={salvando} onChange={(ev) => mudar({ valor: ev.target.value })} /></td>
                  <td><CampoData value={e.desde} disabled={salvando} onChange={(iso) => mudar({ desde: iso })} /></td>
                  <td><button type="button" className="gr-toggle" disabled={salvando || e.valor.trim() === ''} onClick={() => gravarMeta(c)}>Gravar</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Panel>
    </>
  );
}
