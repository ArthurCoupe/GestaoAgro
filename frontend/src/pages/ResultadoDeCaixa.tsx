import { useEffect, useState } from 'react';
import { Chart } from 'react-chartjs-2';
import { brl, brlK, dataBr } from '../api/client';
import { getCaixa, type CaixaAtividade, type CaixaResposta } from '../api/gerencial';
import { AMBER, baseOpts, GOLD, OLIVEDK } from '../charts/setup';
import { AvisoDaFolha } from '../components/AvisoDaFolha';
import { extremosDaSerie, rotuloDoMesCurto } from '../components/EvolucaoMensal';
import { Kpi, Panel, usePeriodo } from '../components/ui';
import { ESCOPOS, intervaloDoEscopo, ROTULO_BOTAO_ESCOPO, rotuloDoEscopo, type Escopo } from './Dashboard';

type Empresa = 'AR' | 'EXEMPLO' | undefined;

export const EMPRESAS: Array<{ v: Empresa; rotulo: string }> = [
  { v: undefined, rotulo: 'Consolidado' },
  { v: 'AR', rotulo: 'Aurora Rural (AR)' },
  { v: 'EXEMPLO', rotulo: 'Exemplo Alimentos' },
];

export function leituraExecutiva({ resultado_caixa, vencido, pendente }: {
  resultado_caixa: number; vencido: number | null; pendente: string;
}): string {
  const sinal = resultado_caixa < 0 ? 'negativo' : 'positivo';
  const vencidoTxt = vencido == null ? `pendente (${pendente})` : brl(vencido);
  return `Resultado de Caixa ${sinal} no período. Vencido: ${vencidoTxt}.`;
}

function PainelContasAReceber({ caixa }: { caixa: CaixaResposta }) {
  const ar = caixa.contas_a_receber;
  return (
    <Panel title="Contas a receber" tag={caixa.etiqueta}>
      <div className="kpi-grid k6">
        <Kpi label="Total em aberto" value={brlK(ar.total_em_aberto)} delta="100%" />
        <Kpi label="Vencido" value={brl(ar.vencido)} delta={`pendente: ${ar.pendente}`} tone="info" />
        <Kpi label="A vencer" value={brl(ar.a_vencer)} tone="info" />
        <Kpi label="7 dias" value="—" tone="info" />
        <Kpi label="15 dias" value="—" tone="info" />
        <Kpi label="30 dias" value="—" tone="info" />
      </div>

      <h4>Por mês de emissão</h4>
      {ar.por_mes_emissao.length === 0 ? (
        <div className="empty">Sem contas a receber em aberto no período.</div>
      ) : (
        <div className="tbl-scroll">
          <table className="tbl">
            <thead><tr><th>Mês</th><th className="num">Valor</th></tr></thead>
            <tbody>
              {ar.por_mes_emissao.map((l) => (
                <tr key={l.mes}><td>{l.mes}</td><td className="num">{brl(l.valor)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h4>Por empresa</h4>
      <div className="tbl-scroll">
        <table className="tbl">
          <thead><tr><th>Empresa</th><th className="num">Valor</th></tr></thead>
          <tbody>
            <tr><td>AR</td><td className="num">{brl(ar.por_empresa.AR)}</td></tr>
            <tr><td>EXEMPLO</td><td className="num">{brl(ar.por_empresa.EXEMPLO)}</td></tr>
          </tbody>
        </table>
      </div>

      <Kpi label="A pagar em aberto" value={brlK(caixa.contas_a_pagar_em_aberto.total)} />
    </Panel>
  );
}

export function temMovimentoDeCaixa(a: CaixaAtividade): boolean { return a.entradas !== 0 || a.saidas !== 0; }

function SecaoAtividadesDeCaixa({ caixa }: { caixa: CaixaResposta }) {
  const cards = caixa.atividades.filter(temMovimentoDeCaixa);
  return (
    <Panel title="Quem forma o caixa" tag={caixa.etiqueta}
      sub="Entradas menos saídas de cada negócio no período; a estrutura não rateada e o dinheiro sem negócio (sócios, adiantamentos, ajustes) aparecem à parte">
      {cards.length === 0 ? (
        <div className="empty">Nenhuma atividade com movimento de caixa no período.</div>
      ) : (
        <div className="kpi-grid k3">
          {cards.map((a) => (
            <Kpi key={a.chave} label={a.rotulo} value={brlK(a.resultado)}
              delta={`entradas ${brlK(a.entradas)} · saídas ${brlK(a.saidas)}`}
              tone={a.resultado < 0 ? 'alert' : 'good'} />
          ))}
        </div>
      )}
    </Panel>
  );
}

export function serieSemFalsoZero(
  caixa: Pick<CaixaResposta, 'serie_mensal' | 'meses_sem_fato'>,
  valor: (m: CaixaResposta['serie_mensal'][number]) => number,
): (number | null)[] {
  const semFato = new Set(caixa.meses_sem_fato);
  return caixa.serie_mensal.map((m) => (semFato.has(m.mes) ? null : valor(m) / 1000));
}

export function SecoesDeCaixa({ caixa, rotuloEscopo }: {
  caixa: CaixaResposta; rotuloEscopo?: string;
}) {
  const semFato = caixa.meses_sem_fato.length > 0
    && caixa.meses_sem_fato.length === caixa.serie_mensal.length;
  if (semFato) {
    const exportou = caixa.contas_a_receber.data_do_export;
    return (
      <>
        <div className="empty">
          Sem apuração de caixa no período, nenhum mês dele tem fato gravado (mês até o último movimento carregado:
          o motor recusou o mês, falta o peso de vendas; mês depois dele: sem dado). Último movimento carregado:{' '}
          {exportou ? dataBr(exportou) : '—'}
        </div>
        {caixa.avisos.map((a, i) => <p key={i} className="obs-tela">{a}</p>)}
      </>
    );
  }

  const ar = caixa.contas_a_receber;
  return (
    <>
      <AvisoDaFolha provisorios={caixa.meses_provisorios} />
      <div className="kpi-grid k4">
        <Kpi label="Entradas" value={brlK(caixa.entradas)} delta="Recebimentos realizados" tone="good" />
        <Kpi label="Saídas" value={brlK(caixa.saidas)} delta="Pagamentos realizados" tone="alert" />
        <Kpi label="Resultado de Caixa" value={brlK(caixa.resultado_caixa)}
          tone={caixa.resultado_caixa < 0 ? 'alert' : 'good'} />
        <Kpi label="Contas a Receber" value={brlK(ar.total_em_aberto)}
          delta={ar.data_do_export ? `até ${dataBr(ar.data_do_export)}` : undefined} />
      </div>

      <SecaoAtividadesDeCaixa caixa={caixa} />

      <PainelContasAReceber caixa={caixa} />

      <Panel title="Evolução mensal" tag={caixa.etiqueta}
        sub={`Entradas, saídas e resultado de caixa mês a mês${rotuloEscopo ? `: ${rotuloEscopo}` : ''}`}>
        {caixa.serie_mensal.length === 0 ? (
          <div className="empty">Sem série mensal de caixa no período.</div>
        ) : (
          <div className="chart-box" style={{ height: 300 }}>
            <Chart
              type="bar"
              data={{
                labels: caixa.serie_mensal.map((m) => m.mes),
                datasets: [
                  {
                    type: 'bar' as const, label: 'Entradas',
                    data: serieSemFalsoZero(caixa, (m) => m.entradas), backgroundColor: GOLD, borderRadius: 5,
                  },
                  {
                    type: 'bar' as const, label: 'Saídas',
                    data: serieSemFalsoZero(caixa, (m) => m.saidas), backgroundColor: OLIVEDK, borderRadius: 5,
                  },
                  {
                    type: 'line' as const, label: 'Resultado',
                    data: serieSemFalsoZero(caixa, (m) => m.resultado), borderColor: AMBER,
                    backgroundColor: AMBER, tension: 0.35, spanGaps: false,
                  },
                ],
              }}
              options={{ ...baseOpts, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } } } }}
            />
          </div>
        )}
        {(() => {
          const semFatoSet = new Set(caixa.meses_sem_fato);
          const ex = extremosDaSerie(
            caixa.serie_mensal.filter((m) => !semFatoSet.has(m.mes)).map((m) => ({ rotulo: rotuloDoMesCurto(m.mes), valor: m.resultado })),
          );
          return ex.melhor && ex.pior ? (
            <p className="obs-tela">
              Melhor mês de caixa: {ex.melhor.rotulo} ({brlK(ex.melhor.valor)}) · Pior mês de caixa: {ex.pior.rotulo} ({brlK(ex.pior.valor)})
            </p>
          ) : null;
        })()}
      </Panel>

      <Panel title="Leitura executiva" tag={caixa.etiqueta}>
        <p>{leituraExecutiva({ resultado_caixa: caixa.resultado_caixa, vencido: ar.vencido, pendente: ar.pendente })}</p>
        <p className="obs-tela">{caixa.aviso_fixo}</p>
        {caixa.avisos.map((a, i) => <p key={i} className="obs-tela">{a}</p>)}
      </Panel>
    </>
  );
}

export function ResultadoDeCaixa() {
  const { periodo } = usePeriodo();
  const [escopo, setEscopo] = useState<Escopo>('MES');
  const [empresa, setEmpresa] = useState<Empresa>(undefined);
  const intervalo = intervaloDoEscopo(escopo, periodo);
  const rotuloEscopo = rotuloDoEscopo(escopo, periodo);
  const [caixa, setCaixa] = useState<CaixaResposta | null>(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    let vivo = true;
    setErro(''); setCaixa(null);
    getCaixa(intervalo.inicio, intervalo.fim, 'consolidado', empresa)
      .then((c) => { if (vivo) setCaixa(c); })
      .catch((e) => { if (vivo) setErro(e?.response?.data?.erro ?? e.message); });
    return () => { vivo = false; };
  }, [intervalo.inicio, intervalo.fim, empresa]);

  return (
    <>
      <div className="tabs">
        {EMPRESAS.map((e) => (
          <button key={e.rotulo} className={`tab ${empresa === e.v ? 'active' : ''}`}
            onClick={() => setEmpresa(e.v)}>{e.rotulo}</button>
        ))}
      </div>
      <div className="tabs">
        {ESCOPOS.map((op) => (
          <button key={op} className={`tab ${escopo === op ? 'active' : ''}`}
            onClick={() => setEscopo(op)}>{ROTULO_BOTAO_ESCOPO[op]}</button>
        ))}
      </div>
      {erro ? (
        <div className="empty">Erro ao carregar: {erro}</div>
      ) : !caixa ? (
        <div className="loading">Carregando Resultado de Caixa…</div>
      ) : (
        <SecoesDeCaixa caixa={caixa} rotuloEscopo={rotuloEscopo} />
      )}
    </>
  );
}
