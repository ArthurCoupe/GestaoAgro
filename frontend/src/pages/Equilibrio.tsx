import { useEffect, useMemo, useState } from 'react';
import { Doughnut, Line } from 'react-chartjs-2';
import { avisoMesesSemDespesa, brl, brlK, getPainelKpis, num, pct, type PainelKpis } from '../api/client';
import { escopoDreDoPerfil, useAuth } from '../auth';
import { baseOpts, GOLD, OLIVE, OLIVEDK } from '../charts/setup';
import { Kpi, Panel, SeloRegime, usePeriodo } from '../components/ui';

export function CartoesEquilibrio({ kpis, rotuloEscopo }: { kpis: PainelKpis; rotuloEscopo: string }) {
  const mc = kpis.margem_contribuicao;
  const pe = kpis.ponto_equilibrio;
  const semDespesa = mc.sem_despesa_no_periodo === true;
  const avisoParcial = semDespesa ? undefined : avisoMesesSemDespesa(mc.meses_sem_despesa);
  const margemSeg = pe.margem_seguranca_pct ?? null;

  const peBaseDelta = pe.ponto_equilibrio_bandejas != null
    ? `${num(pe.ponto_equilibrio_bandejas)} bandejas · ${num(pe.ponto_equilibrio_kg, 1)} kg`
    : pe.observacao;
  const peDelta = pe.despesas_nao_classificadas
    ? `${peBaseDelta ? `${peBaseDelta} · ` : ''}${brlK(pe.despesas_nao_classificadas)} não classif.`
    : peBaseDelta;

  return (
    <div className="kpi-grid k4">
      <Kpi label="Ponto de Equilíbrio" value={brlK(pe.ponto_equilibrio_reais)}
        delta={semDespesa ? 'Sem despesa lançada no período' : [peDelta, avisoParcial].filter(Boolean).join(' · ') || undefined}
        tone="info" />
      <Kpi label={`Receita do Período · ${rotuloEscopo}`} value={brlK(mc.receita_liquida)} />
      <Kpi label="Margem de Segurança" value={pct(margemSeg)}
        delta={semDespesa ? 'Sem despesa lançada no período' : avisoParcial}
        tone={margemSeg == null || avisoParcial ? 'info' : (margemSeg < 0 ? 'alert' : 'good')} />
      <Kpi label="Custos Fixos" value={semDespesa ? '—' : brlK(pe.custos_despesas_fixas)}
        delta={semDespesa ? 'Sem despesa lançada no período' : avisoParcial}
        tone={semDespesa || avisoParcial ? 'info' : undefined} />
    </div>
  );
}

export function MiniCardsEquilibrio({ mc, cf }: { mc: PainelKpis['margem_contribuicao']; cf: number }) {
  const semDespesa = mc.sem_despesa_no_periodo === true;
  const receita = mc.receita_liquida;
  return (
    <div className="mini-cards">
      <div className="mini"><div className="lab">MC %</div><div className="val">{semDespesa ? '—' : pct(mc.margem_contribuicao_pct)}</div></div>
      {mc.margem_contribuicao_unitaria.por_bandeja != null ? (
        <div className="mini">
          <div className="lab">MC por bandeja</div>
          <div className="val">{semDespesa ? '—' : brl(mc.margem_contribuicao_unitaria.por_bandeja)}</div>
        </div>
      ) : (
        <div className="mini">
          <div className="lab">Custos fixos / receita</div>
          <div className="val">{!semDespesa && receita > 0 ? pct((cf / receita) * 100) : '—'}</div>
        </div>
      )}
    </div>
  );
}

export function Equilibrio() {
  const { periodo } = usePeriodo();
  const { usuario } = useAuth();
  const escopo = useMemo(() => escopoDreDoPerfil(usuario?.role ?? null), [usuario]);
  const [kpis, setKpis] = useState<PainelKpis | null>(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    let vivo = true;
    setErro(''); setKpis(null);
    getPainelKpis({
      inicio: periodo.inicio, fim: periodo.fim,
      visao: escopo.visao, operacao: escopo.operacao,
    })
      .then((k) => { if (vivo) setKpis(k); })
      .catch((e) => { if (vivo) setErro(e?.response?.data?.erro ?? e.message); });
    return () => { vivo = false; };
  }, [periodo, escopo]);

  if (erro) return <div className="empty">Erro: {erro}</div>;
  if (!kpis) return <div className="loading">Calculando ponto de equilíbrio…</div>;

  const mc = kpis.margem_contribuicao;
  const pe = kpis.ponto_equilibrio;
  const receita = mc.receita_liquida;
  const cf = pe.custos_despesas_fixas;
  const cv = mc.custos_despesas_variaveis;

  const fracoes = [0, 0.25, 0.5, 0.75, 1, 1.25];
  const labels = fracoes.map((f) => `${f * 100}%`);

  return (
    <>
      <SeloRegime regime={mc.regime} />
      <CartoesEquilibrio kpis={kpis} rotuloEscopo={escopo.rotulo} />

      <div className="row r-2-1">
        <Panel title="Curva do Ponto de Equilíbrio" tag={periodo.rotulo}
          sub="Receita × custo total ao longo do volume (0% a 125% do atual)">
          {mc.sem_despesa_no_periodo === true ? (
            <div className="empty">Sem despesa lançada no período: não há curva de ponto de equilíbrio a traçar.</div>
          ) : (
          <div className="chart-box" style={{ height: 300 }}>
            <Line
              data={{
                labels,
                datasets: [
                  { label: 'Receita', data: fracoes.map((f) => (receita * f) / 1000), borderColor: GOLD, backgroundColor: GOLD, borderWidth: 3, tension: 0.2 },
                  { label: 'Custo total', data: fracoes.map((f) => (cf + cv * f) / 1000), borderColor: OLIVEDK, backgroundColor: OLIVEDK, borderWidth: 3, tension: 0.2 },
                  { label: 'Custo fixo', data: fracoes.map(() => cf / 1000), borderColor: OLIVE, backgroundColor: OLIVE, borderDash: [6, 4], pointRadius: 0 },
                ],
              }}
              options={{
                ...baseOpts,
                plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } } },
                scales: {
                  x: { grid: { display: false }, title: { display: true, text: 'Volume (% do atual)' } },
                  y: { grid: { color: '#F2ECD8' }, title: { display: true, text: 'R$ mil' } },
                },
              }}
            />
          </div>
          )}
        </Panel>
        <Panel title="Estrutura de Custos" sub="Fixos × variáveis do período">
          {mc.sem_despesa_no_periodo === true ? (
            <div className="empty">Sem despesa lançada no período: não há estrutura de custos a mostrar.</div>
          ) : (
          <div className="chart-box sm">
            <Doughnut
              data={{
                labels: ['Custo fixo', 'Custo variável'],
                datasets: [{ data: [cf, cv], backgroundColor: [OLIVEDK, GOLD], borderWidth: 2, borderColor: '#fff' }],
              }}
              options={{
                responsive: true, maintainAspectRatio: false, cutout: '62%',
                plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } } },
              }}
            />
          </div>
          )}
          <MiniCardsEquilibrio mc={mc} cf={cf} />
        </Panel>
      </div>
    </>
  );
}
