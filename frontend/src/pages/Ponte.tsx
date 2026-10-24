import { useEffect, useState } from 'react';
import { brl, brlK, dataBr } from '../api/client';
import { getPonte, ROTULOS_DOS_BALDES, type PonteExemplo, type PonteResposta } from '../api/gerencial';
import { AvisoDaFolha } from '../components/AvisoDaFolha';
import { rotuloDoMesCurto } from '../components/EvolucaoMensal';
import { Kpi, Panel, Pill, usePeriodo } from '../components/ui';
import { ESCOPOS, intervaloDoEscopo, ROTULO_BOTAO_ESCOPO, rotuloDoEscopo, type Escopo } from './Dashboard';

type Balde = 'a' | 'b' | 'c';
type Empresa = 'AR' | 'EXEMPLO' | undefined;

const EMPRESAS: Array<{ v: Empresa; rotulo: string }> = [
  { v: undefined, rotulo: 'Consolidado' },
  { v: 'AR', rotulo: 'Aurora Rural (AR)' },
  { v: 'EXEMPLO', rotulo: 'Exemplo Alimentos' },
];

const ROTULO_BALDE: Record<Balde, string> = ROTULOS_DOS_BALDES;

export function principalExplicacao(baldes: {
  a: { total: number }; b: { total: number }; c: { total: number };
}): Balde | null {
  let maior: Balde | null = null;
  let maiorAbs = 0;
  for (const chave of ['a', 'b', 'c'] as const) {
    const abs = Math.abs(baldes[chave].total);
    if (abs > maiorAbs) { maiorAbs = abs; maior = chave; }
  }
  return maior;
}

function deltaExplicacao(texto: string, destacar: boolean) {
  return destacar ? <>{texto} <Pill tone="info">principal explicação</Pill></> : texto;
}

function BlocoExemplos({ balde, exemplos, aberto, onToggle }: {
  balde: Balde; exemplos: PonteExemplo[]; aberto: boolean; onToggle: () => void;
}) {
  return (
    <div className="ponte-exemplos">
      <button className="btn ghost" onClick={onToggle}>
        {aberto ? 'Ocultar lançamentos' : 'Ver lançamentos'} ({ROTULO_BALDE[balde]})
      </button>
      {aberto && (
        exemplos.length === 0 ? (
          <div className="empty">Nenhum lançamento neste balde no período.</div>
        ) : (
          <div className="tbl-scroll">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Documento</th><th>Conta</th><th>Empresa</th>
                  <th>Data competência</th><th>Data liquidação</th><th className="num">Valor</th>
                </tr>
              </thead>
              <tbody>
                {exemplos.map((e, i) => (
                  <tr key={i}>
                    <td>{e.documento ?? '—'}</td>
                    <td>{e.codigo_conta ?? '—'}</td>
                    <td>{e.empresa ?? '—'}</td>
                    <td>{dataBr(e.data_competencia)}</td>
                    <td>{e.data_liquidacao ? dataBr(e.data_liquidacao) : '—'}</td>
                    <td className={`num ${e.valor < 0 ? 'neg' : ''}`}>{brl(e.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
}

export function SecoesDaPonte({ ponte, rotuloEscopo }: { ponte: PonteResposta; rotuloEscopo?: string }) {
  const [abertos, setAbertos] = useState<Set<Balde>>(new Set());
  const alternar = (b: Balde) => setAbertos((s) => {
    const n = new Set(s);
    if (n.has(b)) n.delete(b); else n.add(b);
    return n;
  });
  const principal = principalExplicacao(ponte.baldes);
  const { a, b, c } = ponte.baldes;
  const { sem_depara, sem_posicao, sem_peso_de_vendas } = ponte.fora_da_ponte;
  const avisosSemDuplicata = ponte.avisos.filter((av) => !(
    (sem_depara.n > 0 && av.includes('sem De-Para'))
    || (sem_peso_de_vendas.n > 0 && av.includes('sem peso de vendas'))
  ));

  const ultimoMes = ponte.serie_mensal?.[ponte.serie_mensal.length - 1]?.mes;

  return (
    <>
      <AvisoDaFolha provisorios={ponte.meses_provisorios} />
      {ponte.lancamentos_considerados === 0 ? (
        <div className="empty">
          Nenhum lançamento com competência ou liquidação no período: nada a conciliar (o último movimento carregado do ERP pode não cobrir este mês).
        </div>
      ) : (<>
      <Panel title="Ponte: Competência × Caixa" tag={rotuloEscopo}>
        <div className="kpi-grid k3">
          <Kpi label="Resultado por Competência" value={brlK(ponte.resultado_competencia)}
            delta={`${ponte.etiquetas.competencia} · líquido, após impostos, financeiro e ajustes`} />
          <Kpi label="Resultado de Caixa" value={brlK(ponte.resultado_caixa)}
            delta={ponte.etiquetas.caixa} />
          <Kpi label="Diferença" value={brlK(ponte.diferenca)} tone="info" />
        </div>
      </Panel>

      <Panel title="O que explica a diferença">
        <div className="kpi-grid k3">
          <Kpi label={ROTULO_BALDE.a} value={brlK(a.total)}
            delta={deltaExplicacao(`a receber: ${brl(a.a_receber)} · a pagar: ${brl(a.a_pagar)}`, principal === 'a')} />
          <Kpi label={ROTULO_BALDE.b} value={brlK(b.total)}
            delta={deltaExplicacao(
              `liquidado fora do período: ${brl(b.liquidado_fora_do_periodo)} · competência fora do período: ${brl(b.competencia_fora_do_periodo)}`,
              principal === 'b',
            )} />
          <Kpi label={ROTULO_BALDE.c} value={brlK(c.total)}
            delta={deltaExplicacao(
              `emitido antes de 2026: ${brl(c.so_caixa)} · fora do resultado (CAPEX, sócios, ajustes financeiros): ${brl(c.fora_do_resultado)}`,
              principal === 'c',
            )} />
        </div>

        {ponte.conciliada === false && (
          <div className="alert-banner">Diferença não conciliada: {brl(ponte.nao_conciliada)}</div>
        )}
        {sem_depara.n > 0 && (
          <p className="obs-tela">
            {brl(sem_depara.valor)} em {sem_depara.n} lançamento(s) sem
            De-Para ficam fora dos dois lados
          </p>
        )}
        {sem_posicao.n > 0 && (
          <p className="obs-tela">
            {brl(sem_posicao.valor)} em {sem_posicao.n} lançamento(s) sem
            posição ficam fora dos dois lados
          </p>
        )}
        {sem_peso_de_vendas.n > 0 && (
          <p className="obs-tela">
            {brl(sem_peso_de_vendas.valor)} em {sem_peso_de_vendas.n} lançamento(s) de VENDAS sem peso de rateio
            em {sem_peso_de_vendas.meses.join(', ')} ficam fora dos dois lados: falta o
            &quot;Produtos/Serviços Vendidos&quot; desse(s) mês(es)
          </p>
        )}
        {avisosSemDuplicata.map((av, i) => <p key={i} className="obs-tela">{av}</p>)}

        <BlocoExemplos balde="a" exemplos={ponte.exemplos.a} aberto={abertos.has('a')} onToggle={() => alternar('a')} />
        <BlocoExemplos balde="b" exemplos={ponte.exemplos.b} aberto={abertos.has('b')} onToggle={() => alternar('b')} />
        <BlocoExemplos balde="c" exemplos={ponte.exemplos.c} aberto={abertos.has('c')} onToggle={() => alternar('c')} />
      </Panel>
      </>)}

      {ponte.serie_mensal && (
        <Panel title="Mês a mês: a diferença é pontual ou recorrente?"
          sub={`${ponte.etiquetas.competencia} menos ${ponte.etiquetas.caixa}, em cada um dos últimos ${ponte.serie_mensal.length} meses`}>
          <div className="tbl-scroll">
            <table className="tbl">
              <thead><tr><th>Mês</th><th className="num">Resultado por competência</th><th className="num">Resultado de caixa</th><th className="num">Diferença</th></tr></thead>
              <tbody>
                {ponte.serie_mensal.map((m) => (
                  <tr key={m.mes} className={m.diferenca < 0 ? 'alert-row' : ''}>
                    <td><b>{rotuloDoMesCurto(m.mes)}</b>{m.lancamentos_considerados === 0 && <> <span className="neg">sem lançamento</span></>}</td>
                    <td className="num">{m.lancamentos_considerados === 0 ? '—' : brlK(m.resultado_competencia)}</td>
                    <td className="num">{m.lancamentos_considerados === 0 ? '—' : brlK(m.resultado_caixa)}</td>
                    <td className="num">{m.lancamentos_considerados === 0 ? '—' : brlK(m.diferenca)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {ponte.natureza && (
            <p className="obs-tela">{ultimoMes && <><b>{rotuloDoMesCurto(ultimoMes)}:</b> </>}{ponte.natureza.frase}</p>
          )}
        </Panel>
      )}
    </>
  );
}

export function Ponte() {
  const { periodo } = usePeriodo();
  const [escopo, setEscopo] = useState<Escopo>('MES');
  const [empresa, setEmpresa] = useState<Empresa>(undefined);
  const intervalo = intervaloDoEscopo(escopo, periodo);
  const rotuloEscopo = rotuloDoEscopo(escopo, periodo);
  const [ponte, setPonte] = useState<PonteResposta | null>(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    let vivo = true;
    setErro(''); setPonte(null);
    getPonte(intervalo.inicio, intervalo.fim, empresa, 12)
      .then((p) => { if (vivo) setPonte(p); })
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
      ) : !ponte ? (
        <div className="loading">Calculando a ponte…</div>
      ) : (
        <SecoesDaPonte ponte={ponte} rotuloEscopo={rotuloEscopo} />
      )}
    </>
  );
}
