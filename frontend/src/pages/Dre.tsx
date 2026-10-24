import { useEffect, useMemo, useState } from 'react';
import { Doughnut } from 'react-chartjs-2';
import { brl, getDre, pct, type DreColuna, type DreResposta } from '../api/client';
import { escopoDreDoPerfil, useAuth } from '../auth';
import { GraficoColunasDre } from '../charts/GraficoColunasDre';
import { CINZA, PALETTE } from '../charts/setup';
import { BotaoExportar } from '../components/BotaoExportar';
import { Panel, usePeriodo } from '../components/ui';

const VISOES = [
  { v: 'consolidado', rotulo: 'Exemplo Alimentos Consolidada', soGestor: true },
  { v: 'operacao', rotulo: 'Produção / Revenda', soGestor: false },
  { v: 'segmento', rotulo: 'Segmentos', soGestor: false },
  { v: 'produto', rotulo: 'Por Produto', soGestor: false },
];

function ColunaDre({ col }: { col: DreColuna }) {
  const d = col.dre;
  const linha = (rotulo: string, valor: number, opts?: { pctv?: number | null; forte?: boolean; neg?: boolean }) => (
    <div className="rline">
      <span>{rotulo}</span>
      <b style={{
        color: opts?.neg ? 'var(--red-alert)' : opts?.forte ? 'var(--green-ok)' : undefined,
        fontSize: opts?.forte ? 16 : undefined,
      }}>
        {brl(valor)}{opts?.pctv != null ? `  (${pct(opts.pctv)})` : ''}
      </b>
    </div>
  );

  return (
    <Panel title={col.nome} tag={col.tipo}>
      <div className="calc-box">
        {linha('(+) Receita bruta', d.receita_bruta)}
        {linha('(−) Deduções (glosa/PIS/COFINS)', -d.deducoes.total)}
        {linha('(=) Receita líquida', d.receita_liquida, { forte: true })}
        {d.custos_variaveis.linhas.map((l) => (
          <div className="rline" key={l.categoria_codigo}>
            <span style={{ paddingLeft: 12 }}>· {l.categoria} <small>({l.rateio.metodo})</small></span>
            <b>{brl(-l.valor)}</b>
          </div>
        ))}
        {linha('(=) Margem de contribuição', d.margem_contribuicao,
          { pctv: d.margem_contribuicao_pct, forte: d.margem_contribuicao >= 0, neg: d.margem_contribuicao < 0 })}
        {(d.custos_fixos?.linhas ?? []).map((l) => (
          <div className="rline" key={l.categoria_codigo}>
            <span style={{ paddingLeft: 12 }}>· {l.categoria} <small>({l.rateio.metodo})</small></span>
            <b>{brl(-l.valor)}</b>
          </div>
        ))}
        {d.despesas_operacionais.linhas.map((l) => (
          <div className="rline" key={l.categoria_codigo}>
            <span style={{ paddingLeft: 12 }}>· {l.categoria} <small>({l.rateio.metodo})</small></span>
            <b>{brl(-l.valor)}</b>
          </div>
        ))}
        {(d.outros?.linhas ?? []).map((l) => (
          <div className="rline" key={l.categoria_codigo}>
            <span style={{ paddingLeft: 12 }}>· {l.categoria}</span>
            <b>{brl(-l.valor)}</b>
          </div>
        ))}
        {linha('(=) Resultado gerencial', d.resultado_gerencial,
          { pctv: d.resultado_gerencial_pct, forte: d.resultado_gerencial >= 0, neg: d.resultado_gerencial < 0 })}
      </div>
    </Panel>
  );
}

export function Dre() {
  const { periodo } = usePeriodo();
  const { usuario } = useAuth();
  const escopo = useMemo(() => escopoDreDoPerfil(usuario?.role ?? null), [usuario]);
  const ehGestor = escopo.operacao == null;
  const visoes = useMemo(() => VISOES.filter((t) => ehGestor || !t.soGestor), [ehGestor]);

  const [visao, setVisao] = useState(visoes[0].v);
  const [dre, setDre] = useState<DreResposta | null>(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (!visoes.some((t) => t.v === visao)) setVisao(visoes[0].v);
  }, [visoes, visao]);

  useEffect(() => {
    let vivo = true;
    setErro(''); setDre(null);
    getDre({ inicio: periodo.inicio, fim: periodo.fim, visao, operacao: escopo.operacao })
      .then((d) => { if (vivo) setDre(d); })
      .catch((e) => { if (vivo) setErro(e?.response?.data?.erro ?? e.message); });
    return () => { vivo = false; };
  }, [periodo, visao, escopo]);

  const colunas = dre?.colunas ?? [];

  return (
    <>
      <div className="tabs">
        {visoes.map((t) => (
          <button key={t.v} className={`tab ${visao === t.v ? 'active' : ''}`}
            onClick={() => setVisao(t.v)}>{t.rotulo}</button>
        ))}
        <span className="tabs-acao">
          <BotaoExportar />
        </span>
      </div>

      {erro && <div className="empty">Erro: {erro}</div>}
      {!erro && !dre && <div className="loading">Calculando DRE…</div>}

      {dre && (
        <>
          {colunas.length > 1 && (() => {
            const comReceita = colunas.filter((c) => (c.dre.receita_liquida ?? 0) > 0);
            return (
              <Panel title="Receita × Gastos por Coluna" tag={periodo.rotulo}
                sub="O que entrou sobe, o que saiu desce: receita, gasto e resultado de cada coluna">
                <GraficoColunasDre colunas={colunas} />
                {comReceita.length > 1 && (
                  <div className="chart-box sm">
                    <Doughnut
                      data={{
                        labels: comReceita.map((c) => c.nome),
                        datasets: [{
                          data: comReceita.map((c) => c.dre.receita_liquida),
                          backgroundColor: comReceita.map((c, i) => (c.tipo === 'bucket' ? CINZA : PALETTE[i % PALETTE.length])),
                          borderWidth: 2, borderColor: '#fff',
                        }],
                      }}
                      options={{
                        responsive: true, maintainAspectRatio: false, cutout: '58%',
                        plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } } },
                      }}
                    />
                  </div>
                )}
              </Panel>
            );
          })()}
          <div className="row" style={{ gridTemplateColumns: `repeat(${Math.min(colunas.length, 3)}, 1fr)` }}>
            {colunas.map((c) => <ColunaDre key={c.chave} col={c} />)}
          </div>
          <Panel title="Observações do motor" sub="Transparência do cálculo">
            <ul style={{ fontSize: 12, color: 'var(--ink-soft)', paddingLeft: 18 }}>
              {dre.observacoes.map((o, i) => <li key={i}>{o}</li>)}
            </ul>
          </Panel>
        </>
      )}
    </>
  );
}
