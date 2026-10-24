import { useCallback, useEffect, useRef, useState } from 'react';
import {
  brl, criarPimentaoRegistro, dataBr, excluirPimentaoRegistro,
  getPimentaoConsolidado, getPimentaoFinanceiro, getPimentaoPlantios,
  getPimentaoRegistros, num, putPimentaoFinanceiro, putPimentaoPlantio,
  type PimentaoConsolidadoLinha, type PimentaoFinanceiroResposta,
  type PimentaoPlantiosResposta, type PimentaoRegistro,
} from '../api/client';
import { useAuth } from '../auth';
import { criarGuardaDeCorrida, useRecarregarAtual } from '../components/BlocosOperacionais';
import { BotaoExportar } from '../components/BotaoExportar';
import { CampoData } from '../components/CampoData';
import { Panel, useConfirmar, useToast } from '../components/ui';

const ABAS = [
  ['registro', 'Registro diário'],
  ['consolidado', 'Consolidado'],
  ['financeiro', 'FINANCEIRO'],
  ['plantio', 'Faturamento por plantio'],
] as const;
type AbaId = typeof ABAS[number][0];

const ESTUFAS = [1, 2, 3, 4, 5, 6];
const PLANTIOS = ['1º', '2º'];
const TIPOS = ['Verde', 'Vermelho', 'Amarelo'];
const CLIENTES = ['ATACADO', 'CEASA'];

const fmPct = (v: number | null | undefined) =>
  v == null ? '' : `${(v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
const fm2 = (v: number | null | undefined) =>
  v == null ? '' : v.toLocaleString('pt-BR', { maximumFractionDigits: 2 });

export function Pimentao() {
  const { usuario } = useAuth();
  const gestor = usuario?.role == null || usuario.role === 'GESTAO_GERAL';
  const [aba, setAba] = useState<AbaId>('registro');
  const [ano, setAno] = useState(2025);

  return (
    <div className="plan-stack">
      <div className="alert-banner media">
        <span>
          <b>Histórico da planilha importado</b>: o registro diário continua a partir de agora aqui pelo sistema.
        </span>
      </div>

      <div className="tabs">
        {ABAS.map(([id, rotulo]) => (
          <button key={id} className={`tab ${aba === id ? 'active' : ''}`}
            onClick={() => setAba(id)}>{rotulo}</button>
        ))}
        <div className="tabs-acao">
          <BotaoExportar rotulo="Exportar Excel" />
        </div>
      </div>

      {aba === 'registro' && <AbaRegistro gestor={gestor} />}
      {aba === 'consolidado' && <AbaConsolidado gestor={gestor} />}
      {aba === 'financeiro' && <AbaFinanceiro ano={ano} setAno={setAno} />}
      {aba === 'plantio' && <AbaPlantios gestor={gestor} />}
    </div>
  );
}

function AbaRegistro({ gestor }: { gestor: boolean }) {
  const toast = useToast();
  const confirmar = useConfirmar();
  const [registros, setRegistros] = useState<PimentaoRegistro[] | null>(null);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [fInicio, setFInicio] = useState('');
  const [fFim, setFFim] = useState('');
  const [v, setV] = useState({
    data: '', estufa: '1', plantio: '1º', tipo: 'Verde', cliente: 'ATACADO',
    caixas: '', desp_kg: '', preco_caixa: '',
  });

  const guarda = useRef(criarGuardaDeCorrida());
  const recarregarDoFiltro = useCallback(() => {
    const id = guarda.current.iniciar();
    setErro('');
    getPimentaoRegistros({ inicio: fInicio || undefined, fim: fFim || undefined })
      .then((r) => { if (guarda.current.vale(id)) setRegistros(r); })
      .catch((e) => { if (guarda.current.vale(id)) setErro(e?.response?.data?.erro ?? e.message); });
  }, [fInicio, fFim]);
  useEffect(recarregarDoFiltro, [recarregarDoFiltro]);
  const recarregar = useRecarregarAtual(recarregarDoFiltro);

  if (erro) return <div className="empty">Erro: {erro}</div>;
  if (!registros) return <div className="loading">Carregando o registro diário…</div>;

  const ok = v.data !== '' && Number(v.caixas) > 0;
  const lancar = () => {
    setSalvando(true);
    criarPimentaoRegistro({
      data: v.data, estufa: Number(v.estufa), plantio: v.plantio,
      tipo: v.tipo, cliente: v.cliente, caixas: Number(v.caixas),
      desp_kg: Number(v.desp_kg) || 0,
      preco_caixa: v.preco_caixa === '' ? undefined : Number(v.preco_caixa),
    })
      .then(() => {
        toast('Colheita registrada.');
        setV({ ...v, caixas: '', desp_kg: '', preco_caixa: '' });
        recarregar();
      })
      .catch((e) => toast(e?.response?.data?.erro ?? e.message, true))
      .finally(() => setSalvando(false));
  };

  const remover = async (r: PimentaoRegistro) => {
    const ok = await confirmar(
      `Excluir o lançamento de ${dataBr(r.data)}: estufa ${r.estufa}, ${r.tipo}, `
      + `${fm2(r.caixas)} caixa(s)?\n\nNão dá para desfazer.`,
    );
    if (!ok) return;
    setSalvando(true);
    excluirPimentaoRegistro(r.id)
      .then(() => { toast('Lançamento removido.'); recarregar(); })
      .catch((e) => toast(e?.response?.data?.erro ?? e.message, true))
      .finally(() => setSalvando(false));
  };

  const ordenados = [...registros].sort((a, b) => b.data.localeCompare(a.data) || b.id - a.id);

  return (
    <>
      <Panel title="Lançamento do dia"
        sub="Mesmos campos da planilha: Embaladas (Kg), Desprezadas (Cx) e FATURAMENTO são calculados pelo sistema">
        <div className="form-grid c4">
          <div className="fg"><label>Data <span className="req">*</span></label>
            <CampoData value={v.data} onChange={(iso) => setV({ ...v, data: iso })} /></div>
          <div className="fg"><label>Estufa <span className="req">*</span></label>
            <select value={v.estufa} onChange={(e) => setV({ ...v, estufa: e.target.value })}>
              {ESTUFAS.map((n) => <option key={n} value={n}>{n}</option>)}
            </select></div>
          <div className="fg"><label>Plantio <span className="req">*</span></label>
            <select value={v.plantio} onChange={(e) => setV({ ...v, plantio: e.target.value })}>
              {PLANTIOS.map((p) => <option key={p}>{p}</option>)}
            </select></div>
          <div className="fg"><label>Tipo <span className="req">*</span></label>
            <select value={v.tipo} onChange={(e) => setV({ ...v, tipo: e.target.value })}>
              {TIPOS.map((t) => <option key={t}>{t}</option>)}
            </select></div>
          <div className="fg"><label>CLIENTE <span className="req">*</span></label>
            <select value={v.cliente} onChange={(e) => setV({ ...v, cliente: e.target.value })}>
              {CLIENTES.map((c) => <option key={c}>{c}</option>)}
            </select></div>
          <div className="fg"><label>Embaladas (Cx) <span className="req">*</span></label>
            <input type="number" min={0} step="0.01" value={v.caixas}
              onChange={(e) => setV({ ...v, caixas: e.target.value })} /></div>
          <div className="fg"><label>Desp. (Kg)</label>
            <input type="number" min={0} step="0.1" value={v.desp_kg}
              onChange={(e) => setV({ ...v, desp_kg: e.target.value })} /></div>
          <div className="fg"><label>$ CAIXA</label>
            <input type="number" min={0} step="0.01" value={v.preco_caixa}
              onChange={(e) => setV({ ...v, preco_caixa: e.target.value })} /></div>
          <div className="fg"><label>&nbsp;</label>
            <button className="btn" disabled={!ok || salvando} onClick={lancar}>
              {salvando ? 'Salvando…' : 'Registrar'}</button></div>
        </div>
      </Panel>

      <Panel title="Registro diário" tag={`${registros.length} lançamentos`}
        sub="Colunas idênticas às da planilha (mais recentes primeiro)">
        <div className="filtros">
          <div className="fg"><label>De</label>
            <CampoData value={fInicio} onChange={setFInicio} /></div>
          <div className="fg"><label>Até</label>
            <CampoData value={fFim} onChange={setFFim} /></div>
        </div>
        <div className="plan-wrap cp" style={{ maxHeight: 480, overflowY: 'auto' }}>
          <table className="plan cp">
            <thead>
              <tr>
                <th className="rotulo">Data</th>
                <th className="num">Estufa</th>
                <th className="num">Plantio</th>
                <th className="num">Tipo</th>
                <th className="num">CLIENTE</th>
                <th className="num">Embaladas (Cx)</th>
                <th className="num">Embaladas (Kg)</th>
                <th className="num">Desprezadas (Cx)</th>
                <th className="num">Desp. (Kg)</th>
                <th className="num">$ CAIXA</th>
                <th className="num">FATURAMENTO</th>
                {gestor && <th className="num" />}
              </tr>
            </thead>
            <tbody>
              {ordenados.length === 0 && (
                <tr><td className="rotulo" /><td colSpan={10 + (gestor ? 1 : 0)}>
                  <div className="empty">Nenhum lançamento para o filtro.</div></td></tr>
              )}
              {ordenados.map((r) => (
                <tr key={r.id}>
                  <td className="rotulo">{dataBr(r.data)}</td>
                  <td className="num">{r.estufa}</td>
                  <td className="num">{r.plantio}</td>
                  <td className="num">{r.tipo}</td>
                  <td className="num">{r.cliente}</td>
                  <td className="num">{fm2(r.caixas)}</td>
                  <td className="num">{fm2(r.kg)}</td>
                  <td className="num">{r.desp_kg ? fm2(r.desp_kg / 10) : ''}</td>
                  <td className="num">{r.desp_kg ? fm2(r.desp_kg) : ''}</td>
                  <td className="num">{r.preco_caixa != null ? brl(r.preco_caixa) : ''}</td>
                  <td className="num total">{r.faturamento != null ? brl(r.faturamento) : ''}</td>
                  {gestor && (
                    <td className="num">
                      <button className="btn ghost split-btn" disabled={salvando}
                        title="Excluir lançamento (gestor)" onClick={() => remover(r)}>✕</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="obs-tela">
          Fórmulas da planilha aplicadas pelo sistema: Embaladas (Kg) = Cx × kg/caixa;
          Desprezadas (Cx) = Desp. (Kg) ÷ 10; FATURAMENTO = Cx × $ CAIXA.
        </div>
      </Panel>
    </>
  );
}

function AbaConsolidado({ gestor }: { gestor: boolean }) {
  const toast = useToast();
  const [linhas, setLinhas] = useState<PimentaoConsolidadoLinha[] | null>(null);
  const [erro, setErro] = useState('');
  const [editPlantado, setEditPlantado] = useState<Record<number, string>>({});
  const [salvando, setSalvando] = useState(false);

  const recarregar = useCallback(() => {
    setErro('');
    getPimentaoConsolidado()
      .then((d) => { setLinhas(d); setEditPlantado({}); })
      .catch((e) => setErro(e?.response?.data?.erro ?? e.message));
  }, []);
  useEffect(recarregar, [recarregar]);

  if (erro) return <div className="empty">Erro: {erro}</div>;
  if (!linhas) return <div className="loading">Carregando o consolidado…</div>;

  const salvarPlantado = (id: number) => {
    const valor = Number(editPlantado[id]);
    if (!(valor > 0)) return;
    setSalvando(true);
    putPimentaoPlantio(id, { total_plantado: valor })
      .then(() => { toast('Total plantado atualizado.'); recarregar(); })
      .catch((e) => toast(e?.response?.data?.erro ?? e.message, true))
      .finally(() => setSalvando(false));
  };

  return (
    <Panel title="Consolidado" tag={`${linhas.length} plantios`}
      sub="Agregações por estufa × plantio a partir do Registro diário: colunas idênticas às da planilha">
      <div className="plan-wrap cp">
        <table className="plan cp">
          <thead>
            <tr>
              <th className="rotulo">Estufa</th>
              <th className="num">Plantio</th>
              <th className="num">Início</th>
              <th className="num">Fim</th>
              <th className="num">Cor</th>
              <th className="num">Total Plantado</th>
              <th className="num">F. Embalados (Cx) - ATACADO</th>
              <th className="num">F. Embalados (Kg) - ATACADO</th>
              <th className="num">F. Embalados (Cx) - CEASA</th>
              <th className="num">F. Embalados (Kg) - CEASA</th>
              <th className="num">Total de Caixas Emb.</th>
              <th className="num">Total de KGs Emb.</th>
              <th className="num">Perdas Frutos (Kg)</th>
              <th className="num">% de Perdas</th>
              <th className="num">Média de frutos por muda (KG)</th>
              {gestor && <th className="num" />}
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.id}>
                <td className="rotulo">{l.estufa}</td>
                <td className="num">{l.plantio}</td>
                <td className="num">{dataBr(l.inicio)}</td>
                <td className="num">{l.fim ? dataBr(l.fim) : 'hoje'}</td>
                <td className="num">{l.cor ?? ''}</td>
                <td className="num">
                  {gestor ? (
                    <input className="cell-input" type="number" min={0}
                      value={editPlantado[l.id] ?? (l.total_plantado != null ? String(l.total_plantado) : '')}
                      onChange={(e) => setEditPlantado({ ...editPlantado, [l.id]: e.target.value })} />
                  ) : num(l.total_plantado)}
                </td>
                <td className="num">{num(l.cx_atacado)}</td>
                <td className="num">{num(l.kg_atacado)}</td>
                <td className="num">{num(l.cx_ceasa)}</td>
                <td className="num">{num(l.kg_ceasa)}</td>
                <td className="num">{num(l.total_caixas)}</td>
                <td className="num total">{num(l.total_kg)}</td>
                <td className="num">{fm2(l.perdas_kg)}</td>
                <td className="num">{fmPct(l.pct_perdas)}</td>
                <td className="num">{fm2(l.media_frutos_muda)}</td>
                {gestor && (
                  <td className="num">
                    <button className="btn ghost split-btn"
                      disabled={salvando || editPlantado[l.id] === undefined}
                      onClick={() => salvarPlantado(l.id)}>ok</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="obs-tela">
        Fórmulas da planilha: % de Perdas = Perdas Frutos (Kg) ÷ Total de KGs Emb.;
        Média de frutos por muda (KG) = Total de KGs Emb. ÷ Total Plantado. "Fim" em
        aberto aparece como "hoje" (a planilha usa a função HOJE()).
      </div>
    </Panel>
  );
}

export const COLS_FIN = [
  'Faturamento Atacado', 'Embalados Atacado (Kg)',
  'Fat. Amarelo Atacado', 'Embalados Amarelo Atacado (Kg)',
  'Fat. Vermelho Atacado', 'Embalados Vermelho Atacado (Kg)',
  'Fat. Verde Atacado', 'Embalados Verde Atacado (Kg)',
  'Faturamento Ceasa', 'Embalados Ceasa (Kg)',
  'Fat. Amarelo Ceasa', 'Embalados Amarelo Ceasa (Kg)',
  'Fat. Vermelho Ceasa', 'Embalados Vermelho Ceasa (Kg)',
  'Fat. Verde Ceasa', 'Embalados Verde Ceasa (Kg)',
  'Total de Kg Embalados', 'Preço Médio do Kg', 'Faturamento Total Mensal',
  'Gastos Matéria Prima', 'Demais Custos + Despesas', 'Custos + Despesas Totais',
  'Resultado (faturamento − custos e despesas)', 'Resultado sobre o faturamento (%)',
];

function AbaFinanceiro({ ano, setAno }: { ano: number; setAno: (a: number) => void }) {
  const toast = useToast();
  const anoAtual = new Date().getFullYear();
  const [dados, setDados] = useState<PimentaoFinanceiroResposta | null>(null);
  const [erro, setErro] = useState('');
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);

  const guarda = useRef(criarGuardaDeCorrida());
  const recarregarDoAno = useCallback(() => {
    const id = guarda.current.iniciar();
    setErro('');
    getPimentaoFinanceiro(ano)
      .then((d) => { if (guarda.current.vale(id)) { setDados(d); setEdits({}); } })
      .catch((e) => { if (guarda.current.vale(id)) setErro(e?.response?.data?.erro ?? e.message); });
  }, [ano]);
  useEffect(recarregarDoAno, [recarregarDoAno]);
  const recarregar = useRecarregarAtual(recarregarDoAno);

  if (erro) return <div className="empty">Erro: {erro}</div>;
  if (!dados) return <div className="loading">Carregando o financeiro…</div>;

  const salvarMes = (mes: number) => {
    const gastos = edits[`${mes}:gastos`];
    const demais = edits[`${mes}:demais`];
    setSalvando(true);
    const anoDasLinhas = dados.ano;
    const patch: Parameters<typeof putPimentaoFinanceiro>[0] = { ano: anoDasLinhas, mes };
    if (gastos !== undefined) patch.gastos_mp = gastos === '' ? null : Number(gastos);
    if (demais !== undefined) patch.demais_custos = demais === '' ? null : Number(demais);
    putPimentaoFinanceiro(patch)
      .then(() => { toast(`Custos de ${String(mes).padStart(2, '0')}/${anoDasLinhas} salvos.`); recarregar(); })
      .catch((e) => toast(e?.response?.data?.erro ?? e.message, true))
      .finally(() => setSalvando(false));
  };

  const inputCusto = (mes: number, campo: 'gastos' | 'demais', original: number | null) => (
    <input className="cell-input wide" type="number" step="0.01"
      value={edits[`${mes}:${campo}`] ?? (original != null ? String(original) : '')}
      onChange={(e) => setEdits({ ...edits, [`${mes}:${campo}`]: e.target.value })} />
  );

  return (
    <>
      <Panel title="FINANCEIRO" tag={String(ano)}
        sub="Réplica mensal da aba: Gastos Matéria Prima e Demais Custos + Despesas são os inputs manuais (negativos, como na planilha)">
        <div className="filtros">
          <div className="fg">
            <label>Ano</label>
            <select value={ano} onChange={(e) => setAno(Number(e.target.value))}>
              {Array.from({ length: anoAtual - 2022 }, (_, i) => 2023 + i).map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="plan-wrap">
          <table className="plan">
            <thead>
              <tr>
                <th className="rotulo">Mês</th>
                {COLS_FIN.map((c) => <th key={c} className="num">{c}</th>)}
                <th className="num" />
              </tr>
            </thead>
            <tbody>
              {dados.meses.length === 0 && (
                <tr><td className="rotulo" /><td colSpan={COLS_FIN.length + 1}>
                  <div className="empty">Sem meses com dados em {ano}.</div></td></tr>
              )}
              {dados.meses.map((m) => (
                <tr key={m.mes}>
                  <td className="rotulo">{String(m.mes).padStart(2, '0')}/{m.ano}</td>
                  <td className="num">{m.fat_atacado != null ? brl(m.fat_atacado) : ''}</td>
                  <td className="num">{fm2(m.kg_atacado)}</td>
                  <td className="num">{m.fat_amarelo_atacado != null ? brl(m.fat_amarelo_atacado) : ''}</td>
                  <td className="num">{fm2(m.kg_amarelo_atacado)}</td>
                  <td className="num">{m.fat_vermelho_atacado != null ? brl(m.fat_vermelho_atacado) : ''}</td>
                  <td className="num">{fm2(m.kg_vermelho_atacado)}</td>
                  <td className="num">{m.fat_verde_atacado != null ? brl(m.fat_verde_atacado) : ''}</td>
                  <td className="num">{fm2(m.kg_verde_atacado)}</td>
                  <td className="num">{m.fat_ceasa != null ? brl(m.fat_ceasa) : ''}</td>
                  <td className="num">{fm2(m.kg_ceasa)}</td>
                  <td className="num">{m.fat_amarelo_ceasa != null ? brl(m.fat_amarelo_ceasa) : ''}</td>
                  <td className="num">{fm2(m.kg_amarelo_ceasa)}</td>
                  <td className="num">{m.fat_vermelho_ceasa != null ? brl(m.fat_vermelho_ceasa) : ''}</td>
                  <td className="num">{fm2(m.kg_vermelho_ceasa)}</td>
                  <td className="num">{m.fat_verde_ceasa != null ? brl(m.fat_verde_ceasa) : ''}</td>
                  <td className="num">{fm2(m.kg_verde_ceasa)}</td>
                  <td className="num">{fm2(m.total_kg)}</td>
                  <td className="num">{m.preco_medio_kg != null ? brl(m.preco_medio_kg) : ''}</td>
                  <td className="num total">{m.faturamento_total != null ? brl(m.faturamento_total) : ''}</td>
                  <td className="num">{inputCusto(m.mes, 'gastos', m.gastos_mp)}</td>
                  <td className="num">{inputCusto(m.mes, 'demais', m.demais_custos)}</td>
                  <td className="num">{m.custos_totais != null ? brl(m.custos_totais) : ''}</td>
                  <td className={`num total ${(m.margem_bruta ?? 0) < 0 ? 'neg' : ''}`}>
                    {m.margem_bruta != null ? brl(m.margem_bruta) : ''}
                  </td>
                  <td className={`num ${(m.margem_pct ?? 0) < 0 ? 'neg' : ''}`}>{fmPct(m.margem_pct)}</td>
                  <td className="num">
                    <button className="btn ghost split-btn"
                      disabled={salvando
                        || (edits[`${m.mes}:gastos`] === undefined && edits[`${m.mes}:demais`] === undefined)}
                      onClick={() => salvarMes(m.mes)}>ok</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="obs-tela">
          Custos + Despesas Totais, Resultado e Resultado sobre o faturamento são recalculados pelo sistema a
          partir do faturamento agregado do Registro diário e dos dois inputs manuais.
        </div>
      </Panel>

      <ResumoPorEstufa dados={dados} ano={ano} />
    </>
  );
}

export function ResumoPorEstufa({ dados, ano }: { dados: PimentaoFinanceiroResposta; ano: number }) {
  return (
    <Panel title="Resumo por estufa (todo o histórico)"
      sub={`Bloco lateral da aba FINANCEIRO. Soma todo o Registro diário, não só ${ano}: Σ faturamento, Σ kg e preço médio`}>
      <div className="plan-wrap cp">
        <table className="plan cp">
          <thead>
            <tr>
              <th className="rotulo">Nº Estufa</th>
              <th className="num">∑ Faturamento</th>
              <th className="num">∑ Embaladas (Kg)</th>
              <th className="num">Σ Preço médio do KG</th>
            </tr>
          </thead>
          <tbody>
            {dados.estufas.map((e) => (
              <tr key={e.estufa}>
                <td className="rotulo">{e.estufa}</td>
                <td className="num">{e.faturamento != null ? brl(e.faturamento) : ''}</td>
                <td className="num">{fm2(e.kg)}</td>
                <td className="num">{e.preco_medio != null ? brl(e.preco_medio) : ''}</td>
              </tr>
            ))}
            {dados.total_geral && (
              <tr className="ln-destaque">
                <td className="rotulo">Total Geral</td>
                <td className="num">{brl(dados.total_geral.faturamento)}</td>
                <td className="num">{fm2(dados.total_geral.kg)}</td>
                <td className="num">{brl(dados.total_geral.preco_medio)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function AbaPlantios({ gestor }: { gestor: boolean }) {
  const toast = useToast();
  const [dados, setDados] = useState<PimentaoPlantiosResposta | null>(null);
  const [erro, setErro] = useState('');
  const [editPlantado, setEditPlantado] = useState<Record<number, string>>({});
  const [salvando, setSalvando] = useState(false);

  const recarregar = useCallback(() => {
    setErro('');
    getPimentaoPlantios()
      .then((d) => { setDados(d); setEditPlantado({}); })
      .catch((e) => setErro(e?.response?.data?.erro ?? e.message));
  }, []);
  useEffect(recarregar, [recarregar]);

  if (erro) return <div className="empty">Erro: {erro}</div>;
  if (!dados) return <div className="loading">Carregando faturamento por plantio…</div>;

  const salvarPlantado = (id: number) => {
    const valor = Number(editPlantado[id]);
    if (!(valor > 0)) return;
    setSalvando(true);
    putPimentaoPlantio(id, { total_plantado: valor })
      .then(() => { toast('Total plantado atualizado.'); recarregar(); })
      .catch((e) => toast(e?.response?.data?.erro ?? e.message, true))
      .finally(() => setSalvando(false));
  };

  return (
    <TabelaPlantios dados={dados} gestor={gestor} salvando={salvando} editPlantado={editPlantado}
      onEdit={(id, valor) => setEditPlantado({ ...editPlantado, [id]: valor })}
      onSalvar={salvarPlantado} />
  );
}

export function TabelaPlantios({ dados, gestor, salvando, editPlantado, onEdit, onSalvar }: {
  dados: PimentaoPlantiosResposta;
  gestor: boolean;
  salvando: boolean;
  editPlantado: Record<number, string>;
  onEdit: (id: number, valor: string) => void;
  onSalvar: (id: number) => void;
}) {
  return (
    <Panel title="Faturamento por plantio (só lançamentos dentro do plantio)"
      sub={'Linha-mãe por estufa e filhas por plantio (1º/2º). Soma só o lançamento do Registro diário '
        + 'com a mesma estufa e plantio, entre o Início e o Fim do Consolidado. Por isso o Total Geral '
        + 'pode ficar menor que o do Resumo por estufa, na aba FINANCEIRO, que soma todo o histórico.'}>
      <div className="plan-wrap cp">
        <table className="plan cp">
          <thead>
            <tr>
              <th className="rotulo">Estufa / Plantio</th>
              <th className="num">Σ FATURAMENTO</th>
              <th className="num">Σ Embaladas (Kg)</th>
              <th className="num">Σ Preço médio do KG</th>
              <th className="num">Meses (tempo entre a 1ª e última colheita)</th>
              <th className="num">Média por mês</th>
              <th className="num">Total plantado</th>
              <th className="num">Média frutos por muda</th>
              {gestor && <th className="num" />}
            </tr>
          </thead>
          <tbody>
            {dados.estufas.map((e) => (
              <LinhasEstufa key={e.estufa} estufa={e} gestor={gestor} salvando={salvando}
                editPlantado={editPlantado} onEdit={onEdit} onSalvar={onSalvar} />
            ))}
            {dados.total_geral && (
              <tr className="ln-destaque">
                <td className="rotulo">Total Geral</td>
                <td className="num">{brl(dados.total_geral.faturamento)}</td>
                <td className="num">{fm2(dados.total_geral.kg)}</td>
                <td className="num">{brl(dados.total_geral.preco_medio)}</td>
                <td className="num" /><td className="num" /><td className="num" /><td className="num" />
                {gestor && <td className="num" />}
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="obs-tela">
        Meses = tempo entre a 1ª e a última colheita do plantio; Média por mês =
        Σ kg ÷ meses; Média frutos por muda = Σ kg ÷ total plantado.
      </div>
    </Panel>
  );
}

function LinhasEstufa({ estufa, gestor, salvando, editPlantado, onEdit, onSalvar }: {
  estufa: PimentaoPlantiosResposta['estufas'][number];
  gestor: boolean;
  salvando: boolean;
  editPlantado: Record<number, string>;
  onEdit: (id: number, valor: string) => void;
  onSalvar: (id: number) => void;
}) {
  return (
    <>
      <tr className="ln-grupo">
        <td className="rotulo">{estufa.estufa}</td>
        <td className="num">{estufa.faturamento != null ? brl(estufa.faturamento) : ''}</td>
        <td className="num">{fm2(estufa.kg)}</td>
        <td className="num">{estufa.preco_medio != null ? brl(estufa.preco_medio) : ''}</td>
        <td className="num" /><td className="num" /><td className="num" /><td className="num" />
        {gestor && <td className="num" />}
      </tr>
      {estufa.plantios.map((p) => (
        <tr key={p.id}>
          <td className="rotulo sub-rot">{p.plantio}</td>
          <td className="num">{p.faturamento != null ? brl(p.faturamento) : ''}</td>
          <td className="num">{fm2(p.kg)}</td>
          <td className="num">{p.preco_medio != null ? brl(p.preco_medio) : ''}</td>
          <td className="num">{p.meses != null ? num(p.meses) : ''}</td>
          <td className="num">{fm2(p.media_kg_mes)}</td>
          <td className="num">
            {gestor ? (
              <input className="cell-input" type="number" min={0}
                value={editPlantado[p.id] ?? (p.total_plantado != null ? String(p.total_plantado) : '')}
                onChange={(e) => onEdit(p.id, e.target.value)} />
            ) : num(p.total_plantado)}
          </td>
          <td className="num">{fm2(p.media_frutos_muda)}</td>
          {gestor && (
            <td className="num">
              <button className="btn ghost split-btn"
                disabled={salvando || editPlantado[p.id] === undefined}
                onClick={() => onSalvar(p.id)}>ok</button>
            </td>
          )}
        </tr>
      ))}
    </>
  );
}
