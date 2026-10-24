import { Fragment, useEffect, useMemo, useState } from 'react';
import { Bar, Line } from 'react-chartjs-2';
import {
  anoMesHoje, fmMoeda, fmPctFrac as fmPct, getDesempenho, num,
  type DesempenhoCelula, type DesempenhoOperacao, type DesempenhoResposta,
} from '../api/client';
import { catalogoDaOperacao } from '../api/catalogo';
import { useAuth } from '../auth';
import { baseOpts, legB, noLeg, PALETTE } from '../charts/setup';
import { BotaoExportar } from '../components/BotaoExportar';
import { Panel, Pill, SeloRegime } from '../components/ui';

const OPERACOES: Array<{ v: DesempenhoOperacao; rotulo: string }> = [
  { v: 'PRODUCAO', rotulo: 'Produção' },
  { v: 'REVENDA', rotulo: 'Revenda' },
];

function operacoesDoRole(role: string | null): DesempenhoOperacao[] {
  if (role?.startsWith('PRODUCAO')) return ['PRODUCAO'];
  if (role === 'REVENDA') return ['REVENDA'];
  return ['PRODUCAO', 'REVENDA'];
}

interface Metrica {
  chave: keyof DesempenhoCelula;
  rotulo: string;
  fmt: (v: number) => string;
  soProducao?: boolean;
}
const METRICAS: Metrica[] = [
  { chave: 'receita', rotulo: 'Receita líquida (R$)', fmt: fmMoeda },
  { chave: 'quantidade', rotulo: 'Quantidade', fmt: (v) => num(v) },
  { chave: 'preco_medio', rotulo: 'Preço médio (R$)', fmt: fmMoeda },
  { chave: 'participacao_pct', rotulo: 'Participação no mês', fmt: fmPct },
  { chave: 'kg', rotulo: 'Kg colhidos', fmt: (v) => num(v, 1), soProducao: true },
  { chave: 'rs_por_kg', rotulo: 'R$ por kg', fmt: fmMoeda, soProducao: true },
];

function TabelaDesempenho({ dados }: { dados: DesempenhoResposta }) {
  const mesesAtivos = new Set(dados.mesesComDados);
  const metricas = METRICAS.filter((mt) => dados.operacao === 'PRODUCAO' || !mt.soProducao);
  const celula = (mt: Metrica, v: number | null | undefined) => (v == null ? '—' : mt.fmt(v));
  return (
    <div className="plan-wrap">
      <table className="plan">
        <thead>
          <tr>
            <th className="rotulo">Produto / Métrica</th>
            {dados.meses.map((m) => (
              <th key={m} className={`num ${mesesAtivos.has(m) ? '' : 'dim'}`}>{m}</th>
            ))}
            <th className="num total">TOTAL</th>
          </tr>
        </thead>
        <tbody>
          {dados.produtos.map((p, pi) => {
            const visiveis = metricas.filter((mt) =>
              mt.chave === 'receita'
              || p.total[mt.chave] != null
              || dados.meses.some((m) => p.valores[m]?.[mt.chave] != null));
            return (
              <Fragment key={`${p.produto_id ?? 'x'}-${pi}`}>
                <tr className="ln-grupo">
                  <td className="rotulo">
                    {p.nome}
                    {p.especie && <small style={{ color: 'var(--ink-soft)' }}> · {p.especie}</small>}
                    {p.agregado && <small style={{ color: 'var(--ink-soft)' }}> · segmento</small>}
                  </td>
                  {dados.meses.map((m) => (
                    <td key={m} className={`num ${mesesAtivos.has(m) ? '' : 'dim'}`} />
                  ))}
                  <td className="num total" />
                </tr>
                {visiveis.map((mt) => (
                  <tr key={mt.chave} className={mt.chave === 'participacao_pct' ? 'ln-pct' : ''}>
                    <td className="rotulo" style={{ paddingLeft: 26 }}>{mt.rotulo}</td>
                    {dados.meses.map((m) => {
                      const v = p.valores[m]?.[mt.chave];
                      return (
                        <td key={m}
                          className={`num ${mesesAtivos.has(m) ? '' : 'dim'} ${v != null && v < 0 ? 'neg' : ''}`}>
                          {celula(mt, v)}
                        </td>
                      );
                    })}
                    <td className={`num total ${(p.total[mt.chave] ?? 0) < 0 ? 'neg' : ''}`}>
                      {celula(mt, p.total[mt.chave])}
                    </td>
                  </tr>
                ))}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CatalogoOperacao({ operacao, dados }: {
  operacao: DesempenhoOperacao; dados: DesempenhoResposta;
}) {
  const porNome = new Map(
    dados.produtos
      .filter((p) => !p.agregado)
      .map((p) => [p.nome.toLowerCase(), p.total]),
  );
  return (
    <div className="tbl-scroll" style={{ maxHeight: 300 }}>
      <table className="tbl">
        <thead>
          <tr><th>Produto</th><th>Embalagem</th><th className="num">Receita no ano</th></tr>
        </thead>
        <tbody>
          {catalogoDaOperacao(operacao).map((p) => {
            const t = porNome.get(p.nome.toLowerCase());
            return (
              <tr key={`${p.codigo}-${p.nome}`}>
                <td>
                  <b>{p.nome}</b>
                  <div>
                    <small style={{ color: 'var(--ink-soft)' }}>
                      {p.erp ? `ERP: ${p.erp}` : 'ERP: grafia ainda não vista em nenhum export'}
                    </small>
                  </div>
                </td>
                <td>{p.embalagem}</td>
                <td className="num">
                  {t?.receita != null
                    ? fmMoeda(t.receita)
                    : <Pill tone="neutral">aguardando import</Pill>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function Desempenho() {
  const { usuario } = useAuth();
  const role = usuario?.role ?? null;
  const operacoes = useMemo(() => operacoesDoRole(role), [role]);

  const [ano, setAno] = useState(anoMesHoje().ano);
  const [operacao, setOperacao] = useState<DesempenhoOperacao>(operacoes[0]);
  const [dados, setDados] = useState<DesempenhoResposta | null>(null);
  const [erro, setErro] = useState('');
  const [metricaLinha, setMetricaLinha] = useState<'receita' | 'kg'>('receita');

  useEffect(() => {
    if (!operacoes.includes(operacao)) setOperacao(operacoes[0]);
  }, [operacoes, operacao]);

  useEffect(() => {
    if (operacao === 'REVENDA') setMetricaLinha('receita');
  }, [operacao]);

  useEffect(() => {
    let vivo = true;
    setErro(''); setDados(null);
    getDesempenho(operacao, ano)
      .then((d) => { if (vivo) setDados(d); })
      .catch((e) => { if (vivo) setErro(e?.response?.data?.erro ?? e.message); });
    return () => { vivo = false; };
  }, [operacao, ano]);

  const partes = useMemo(() => {
    const comReceita = (dados?.produtos ?? []).filter((p) => (p.total.receita ?? 0) > 0);
    const soma = comReceita.reduce((s, p) => s + (p.total.receita ?? 0), 0);
    return comReceita.map((p, i) => ({
      nome: p.nome,
      pct: soma > 0 ? Math.round(((p.total.receita ?? 0) / soma) * 1000) / 10 : 0,
      cor: PALETTE[i % PALETTE.length],
    }));
  }, [dados]);

  const series = useMemo(() => {
    if (!dados) return { labels: [] as string[], datasets: [] };
    const produtos = dados.produtos.filter((p) =>
      dados.meses.some((m) => p.valores[m]?.[metricaLinha] != null));
    return {
      labels: dados.meses,
      datasets: produtos.map((p, i) => ({
        label: p.nome,
        data: dados.meses.map((m) => p.valores[m]?.[metricaLinha] ?? null),
        borderColor: PALETTE[i % PALETTE.length],
        backgroundColor: PALETTE[i % PALETTE.length],
        tension: 0.35,
        spanGaps: true,
      })),
    };
  }, [dados, metricaLinha]);

  const vazio = dados != null && dados.produtos.length === 0;
  const soAgregado = dados != null && dados.produtos.length > 0
    && dados.produtos.every((p) => p.agregado);

  const notaErp = 'O detalhe de receita POR PRODUTO da revenda depende do import mensal das vendas por produto do ERP: hoje a '
    + 'receita importada é por segmento (agregado).';

  return (
    <>
      <div className="tabs">
        {OPERACOES.filter((o) => operacoes.includes(o.v)).map((o) => (
          <button key={o.v} className={`tab ${operacao === o.v ? 'active' : ''}`}
            disabled={operacoes.length === 1}
            onClick={() => setOperacao(o.v)}>{o.rotulo}</button>
        ))}
        <span className="tabs-acao">
          <button className="chip" title="Ano anterior" onClick={() => setAno((a) => a - 1)}>‹</button>
          <span className="chip">{ano}</span>
          <button className="chip" title="Próximo ano" onClick={() => setAno((a) => a + 1)}>›</button>
          <BotaoExportar />
        </span>
      </div>

      {erro && <div className="empty">Erro: {erro}</div>}
      {!erro && !dados && <div className="loading">Consolidando desempenho por produto…</div>}

      {vazio && (
        <Panel title="Sem dados por produto" tag={String(ano)}>
          <div className="empty">
            {operacao === 'REVENDA'
              ? `Nenhuma receita da revenda encontrada em ${ano}. ${notaErp}`
              : `Nenhuma receita ou colheita da produção encontrada em ${ano}. Os kg `
                + 'por espécie vêm da Jornada do Cogumelo; a receita, das transações importadas.'}
          </div>
        </Panel>
      )}

      {dados && !vazio && (
        <div className="plan-stack">
          <Panel title="Produto × Mês" tag={String(dados.ano)}
            sub="Receita, quantidade, preço médio e participação por produto: meses sem dados aparecem esmaecidos">
            <SeloRegime regime={dados.regime} />
            <TabelaDesempenho dados={dados} />
            {soAgregado && <p className="obs-tela">{notaErp}</p>}
          </Panel>

          <div className="row" style={{ gridTemplateColumns: '1fr 1.4fr' }}>
            {partes.length > 1 ? (
              <Panel title="Participação na Receita" tag={String(dados.ano)}
                sub="Fatia de cada produto na receita acumulada do período">
                <div className="chart-box sm">
                  <Bar
                    data={{
                      labels: partes.map((p) => p.nome),
                      datasets: [{
                        label: 'Participação (%)',
                        data: partes.map((p) => p.pct),
                        backgroundColor: partes.map((p) => p.cor),
                        borderRadius: 6,
                      }],
                    }}
                    options={{ ...baseOpts, ...noLeg }}
                  />
                </div>
              </Panel>
            ) : (
              <Panel title="Produtos da Operação" tag={String(dados.ano)}
                sub={operacao === 'REVENDA'
                  ? 'Itens que a Exemplo Alimentos revende e o que já chegou do ERP'
                  : 'Itens produzidos pela Aurora Rural e o que já chegou do ERP'}>
                <CatalogoOperacao operacao={operacao} dados={dados} />
              </Panel>
            )}

            <Panel title="Evolução Mensal" tag={String(dados.ano)}
              sub={metricaLinha === 'kg' ? 'Kg colhidos por espécie, mês a mês' : 'Receita por produto, mês a mês'}>
              {dados.operacao === 'PRODUCAO' && (
                <div className="form-acao">
                  {([['receita', 'Receita (R$)'], ['kg', 'Kg colhidos']] as const).map(([v, r]) => (
                    <button key={v} className={metricaLinha === v ? 'btn' : 'btn ghost'}
                      onClick={() => setMetricaLinha(v)}>{r}</button>
                  ))}
                </div>
              )}
              {series.datasets.length === 0 ? (
                <div className="empty">
                  {metricaLinha === 'kg'
                    ? 'Sem colheitas registradas no ano: lance as colheitas na Jornada do Cogumelo.'
                    : 'Sem receita no ano para desenhar a evolução.'}
                </div>
              ) : (
                <div className="chart-box">
                  <Line data={series} options={{ ...baseOpts, ...legB }} />
                </div>
              )}
            </Panel>
          </div>

          {dados.observacoes.length > 0 && (
            <Panel title="Observações" sub="O que já está no sistema e o que depende de importação">
              <ul style={{ fontSize: 12, color: 'var(--ink-soft)', paddingLeft: 18 }}>
                {dados.observacoes.map((o, i) => <li key={i}>{o}</li>)}
              </ul>
            </Panel>
          )}
        </div>
      )}
    </>
  );
}
