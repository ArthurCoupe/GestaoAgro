import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import {
  atualizarDesprezo, dataBr, excluirDesprezo, getColheitasDoDia, getEmbalagem, getEmbalagemResumo, hojeISO, listarDesprezos, num,
  registrarDesprezo, salvarEmbalagemDia,
  type DesprezoBody, type EmbalagemDesprezo, type EmbalagemDia, type EmbalagemGrade, type EmbalagemProduto,
  type EmbalagemResumo as EmbalagemResumoTipo, type EmbalagemSalva,
} from '../api/client';
import { criarGuardaDeCorrida, useRecarregarAtual } from '../components/BlocosOperacionais';
import { CampoData } from '../components/CampoData';
import { Panel, useConfirmar, useToast } from '../components/ui';
import { FormDesprezo, ListaDesprezos, NOME_DO_TIPO_DESPREZO } from './EmbalagemDesprezo';
import { EmbalagemDivergencias } from './EmbalagemDivergencias';
import { EmbalagemResumo } from './EmbalagemResumo';
import { EmbalagemSaldo } from './EmbalagemSaldo';

export function resultadoAdicionarDia(
  novoDia: string, diasExistentes: string[],
): { ok: true } | { ok: false; aviso: string } {
  if (!novoDia) {
    return { ok: false, aviso: 'Escolha uma data em "Novo dia de colheita" antes de adicionar.' };
  }
  if (diasExistentes.includes(novoDia)) {
    return { ok: false, aviso: 'Este dia já está na grade: edite a linha existente.' };
  }
  return { ok: true };
}

export function resultadoSalvarDia(data: string, r: { gravados: number; removidos: number }): string {
  const dia = dataBr(data);
  if (r.gravados > 0 && r.removidos > 0) return `Embalagem de ${dia} salva: ${r.gravados} produto(s) gravado(s), ${r.removidos} zerado(s).`;
  if (r.gravados > 0) return `Embalagem de ${dia} salva: ${r.gravados} produto(s) gravado(s).`;
  if (r.removidos > 0) return `Nenhuma quantidade gravada para ${dia}: dia com tudo zero não fica registrado no banco.`;
  return `Nada para salvar em ${dia}.`;
}

export function valoresParaSalvar(
  produtos: EmbalagemProduto[], ler: (id: number) => number, nova: boolean,
): Record<number, number> {
  const valores: Record<number, number> = {};
  for (const p of produtos) {
    const v = ler(p.id);
    if (nova && !(v > 0)) continue;
    valores[p.id] = v;
  }
  return valores;
}

export function RotuloDiaEmbalagem({ data, naoSalva }: { data: string; naoSalva: boolean }) {
  return (
    <>
      <b>{dataBr(data)}</b>
      {naoSalva && <span className="neg" role="status"> · não salva</span>}
    </>
  );
}

export function periodoInicial(hoje: string): { inicio: string; fim: string } {
  return { inicio: `${hoje.slice(0, 7)}-01`, fim: hoje };
}

export function Embalagem() {
  const toast = useToast();
  const confirmar = useConfirmar();
  const hoje = hojeISO();
  const inicial = periodoInicial(hoje);
  const [grade, setGrade] = useState<EmbalagemGrade | null>(null);
  const [resumo, setResumo] = useState<EmbalagemResumoTipo | null>(null);
  const [desprezos, setDesprezos] = useState<EmbalagemDesprezo[]>([]);
  const [erro, setErro] = useState('');
  const [erroResumo, setErroResumo] = useState('');
  const [fInicio, setFInicio] = useState(inicial.inicio);
  const [fFim, setFFim] = useState(inicial.fim);
  const [edits, setEdits] = useState<Record<string, Record<number, string>>>({});
  const [editsDia, setEditsDia] = useState<Record<string, string>>({});
  const [editsF54, setEditsF54] = useState<Record<string, string>>({});
  const [novoDia, setNovoDia] = useState('');
  const [abrirNovoDia, setAbrirNovoDia] = useState(false);
  const [salvando, setSalvando] = useState<string | null>(null);
  const [novos, setNovos] = useState<Set<string>>(new Set());
  const [formDesprezo, setFormDesprezo] = useState<'fechado' | 'novo' | EmbalagemDesprezo>('fechado');
  const [salvandoDesprezo, setSalvandoDesprezo] = useState(false);
  const [mostrarTodas, setMostrarTodas] = useState(false);

  const guardaGrade = useRef(criarGuardaDeCorrida());
  const guardaResumo = useRef(criarGuardaDeCorrida());
  const recarregarGradeDoFiltro = useCallback(() => {
    const id = guardaGrade.current.iniciar();
    setErro('');
    getEmbalagem({ inicio: fInicio || undefined, fim: fFim || undefined })
      .then((g) => {
        if (!guardaGrade.current.vale(id)) return;
        setGrade(g); setEdits({}); setEditsDia({}); setEditsF54({}); setNovos(new Set());
      })
      .catch((e) => { if (guardaGrade.current.vale(id)) setErro(e?.response?.data?.erro ?? e.message); });
  }, [fInicio, fFim]);
  const recarregarResumoDoFiltro = useCallback(() => {
    const id = guardaResumo.current.iniciar();
    setErroResumo('');
    Promise.all([
      getEmbalagemResumo({ inicio: fInicio || undefined, fim: fFim || undefined }),
      listarDesprezos({ inicio: fInicio || undefined, fim: fFim || undefined }),
    ])
      .then(([r, d]) => { if (guardaResumo.current.vale(id)) { setResumo(r); setDesprezos(d); } })
      .catch((e) => { if (guardaResumo.current.vale(id)) setErroResumo(e?.response?.data?.erro ?? e.message); });
  }, [fInicio, fFim]);
  useEffect(recarregarGradeDoFiltro, [recarregarGradeDoFiltro]);
  useEffect(recarregarResumoDoFiltro, [recarregarResumoDoFiltro]);
  const recarregarGrade = useRecarregarAtual(recarregarGradeDoFiltro);
  const recarregarResumo = useRecarregarAtual(recarregarResumoDoFiltro);
  useEffect(() => { setMostrarTodas(false); }, [fInicio, fFim]);

  const buscarColheitas = useCallback((data: string, tipo: string) => getColheitasDoDia({ data, tipo }), []);

  if (erro) return <div className="empty">Erro: {erro}</div>;
  if (!grade) return <div className="loading">Carregando dados de embalagem…</div>;

  const editar = (data: string, produtoId: number, valor: string) =>
    setEdits((prev) => ({ ...prev, [data]: { ...prev[data], [produtoId]: valor } }));
  const valorCelula = (data: string, produtoId: number, original: number | undefined) =>
    edits[data]?.[produtoId] ?? String(original ?? 0);
  const dataDoDia = (d: EmbalagemDia) => editsDia[d.data] ?? d.data_lancamento ?? '';
  const idF54 = grade.produto_f54_id ?? null;
  const f54DoDia = (d: EmbalagemDia) => editsF54[d.data] ?? (d.f54 == null ? '' : String(d.f54));
  const hf70DoDia = (d: EmbalagemDia) => {
    if (idF54 == null || f54DoDia(d).trim() === '') return '—';
    const total = Number(valorCelula(d.data, idF54, d.valores[idF54])) || 0;
    const f = Number(f54DoDia(d));
    return Number.isInteger(f) && f >= 0 && f <= total ? String(total - f) : '—';
  };

  const salvarDia = (d: EmbalagemDia) => {
    const valores = valoresParaSalvar(grade.produtos, (id) => Math.max(Number(valorCelula(d.data, id, d.valores[id])) || 0, 0), novos.has(d.data));
    if (Object.keys(valores).length === 0) { toast(`Digite pelo menos uma quantidade antes de salvar o dia ${dataBr(d.data)}.`, true); return; }
    const f54 = f54DoDia(d).trim();
    setSalvando(d.data);
    salvarEmbalagemDia({ data: d.data, data_lancamento: dataDoDia(d) || null, valores, ...(idF54 != null && d.data in editsF54 ? { f54: f54 === '' ? null : Number(f54) } : {}) })
      .then((r: EmbalagemSalva) => {
        toast(resultadoSalvarDia(d.data, r));
        const foraDoPeriodo = (fInicio !== '' && d.data < fInicio) || (fFim !== '' && d.data > fFim);
        if (foraDoPeriodo) {
          if (fInicio !== '' && d.data < fInicio) setFInicio(d.data);
          if (fFim !== '' && d.data > fFim) setFFim(d.data);
        } else {
          recarregarGrade(); recarregarResumo();
        }
      })
      .catch((e) => toast(e?.response?.data?.erro ?? e.message, true))
      .finally(() => setSalvando(null));
  };

  const adicionarDia = () => {
    const r = resultadoAdicionarDia(novoDia, grade.dias.map((d) => d.data));
    if (!r.ok) { toast(r.aviso, true); return; }
    setGrade({ ...grade, dias: [{ data: novoDia, data_lancamento: null, valores: {} }, ...grade.dias] });
    setEditsDia((prev) => ({ ...prev, [novoDia]: hoje }));
    setNovos((prev) => new Set(prev).add(novoDia));
    setNovoDia('');
    setAbrirNovoDia(false);
  };

  const enviarDesprezo = async (body: DesprezoBody) => {
    setSalvandoDesprezo(true);
    try {
      if (formDesprezo === 'novo') {
        const d = await registrarDesprezo(body);
        toast(`Desprezo de ${num(d.kg, 3)} kg registrado para a colheita de ${dataBr(d.data_colheita)}.`);
      } else if (formDesprezo !== 'fechado') {
        const d = await atualizarDesprezo(formDesprezo.id, body);
        toast(`Desprezo corrigido: ${num(d.kg, 3)} kg na colheita de ${dataBr(d.data_colheita)}.`);
        setFormDesprezo('fechado');
      }
      recarregarResumo();
    } catch (e) {
      const err = e as { response?: { data?: { erro?: string } }; message: string };
      toast(err.response?.data?.erro ?? err.message, true);
      throw e;
    } finally { setSalvandoDesprezo(false); }
  };
  const excluir = async (d: EmbalagemDesprezo) => {
    const ok = await confirmar(`Excluir o desprezo de ${num(d.kg, 3)} kg da colheita de ${dataBr(d.data_colheita)} (${NOME_DO_TIPO_DESPREZO[d.tipo_cogumelo] ?? d.tipo_cogumelo})?`);
    if (!ok) return;
    excluirDesprezo(d.id).then(() => { toast('Desprezo excluído.'); recarregarResumo(); })
      .catch((e) => toast(e?.response?.data?.erro ?? e.message, true));
  };

  return (
    <>
      <div className="form-acao">
        <button type="button" className={abrirNovoDia ? 'btn' : 'btn ghost'} onClick={() => setAbrirNovoDia((a) => !a)}>+ Novo dia</button>
        <button type="button" className={formDesprezo === 'novo' ? 'btn' : 'btn ghost'}
          onClick={() => setFormDesprezo((f) => (f === 'novo' ? 'fechado' : 'novo'))}>+ Registrar desprezo</button>
      </div>
      <div className="filtros">
        <div className="fg"><label>De</label><CampoData value={fInicio} onChange={setFInicio} /></div>
        <div className="fg"><label>Até</label><CampoData value={fFim} onChange={setFFim} /></div>
        {abrirNovoDia && (
          <>
            <div className="fg"><label>Novo dia de colheita</label><CampoData value={novoDia} onChange={setNovoDia} /></div>
            <div className="fg"><label>&nbsp;</label>
              <button className="btn ghost" onClick={adicionarDia}>+ Adicionar dia</button></div>
          </>
        )}
        {novos.size > 0 && (
          <span className="aviso-pendente" role="status">
            Dia novo ainda não salvo nesta tela: clique em Salvar antes de trocar de filtro ou recarregar.
          </span>
        )}
      </div>

      {formDesprezo !== 'fechado' && (
        <Panel title={formDesprezo === 'novo' ? 'Registrar desprezo' : 'Corrigir desprezo'}
          sub="Kg jogados fora na embalagem, com a data do dia, a colheita a que pertencem e o tipo. Entra no resumo e na conferência da colheita.">
          <FormDesprezo key={formDesprezo === 'novo' ? 'novo' : `ed-${formDesprezo.id}`}
            inicial={formDesprezo === 'novo' ? undefined : formDesprezo} salvando={salvandoDesprezo}
            onSubmit={enviarDesprezo} onCancelar={() => setFormDesprezo('fechado')} buscarColheitas={buscarColheitas} hoje={hoje} />
        </Panel>
      )}

      {erroResumo ? (
        <div className="empty">Resumo indisponível ({erroResumo}). A grade abaixo continua.</div>
      ) : !resumo ? (
        <div className="loading">Somando o período…</div>
      ) : (
        <>
          <EmbalagemResumo resumo={resumo} />
          <EmbalagemDivergencias conferencia={resumo.conferencia} mostrarTodas={mostrarTodas} onMostrarTodas={() => setMostrarTodas(true)}
            periodo={resumo.periodo} corte={resumo.corte} onVerDesdeOCorte={() => { setFInicio(resumo.corte); setFFim(hoje); }} />
          <ListaDesprezos desprezos={desprezos} onEditar={(d) => setFormDesprezo(d)} onExcluir={excluir} />
        </>
      )}

      <Panel id="embalagem-dados" title="Dados Embalagem" tag={`${grade.dias.length} dias`}
        sub="Contagem de embalagens produzidas por dia de colheita, colunas idênticas às da planilha. Data do dia = quando foi embalado; Data da colheita = a colheita a que pertence.">
        <div className="plan-wrap">
          <table className="plan cp">
            <thead>
              <tr>
                <th className="rotulo">Data do dia</th>
                <th className="rotulo">Data da COLHEITA</th>
                {grade.produtos.map((p) => (
                  <Fragment key={p.id}>
                    <th className="num">{p.nome}</th>
                    {p.id === idF54 && <><th className="num">Bandejas F54</th><th className="num">Bandejas HF70 (por diferença)</th></>}
                  </Fragment>
                ))}
                <th className="num" />
              </tr>
            </thead>
            <tbody>
              {grade.dias.length === 0 && (
                <tr><td className="rotulo" /><td className="rotulo" /><td colSpan={grade.produtos.length + 1 + (idF54 != null ? 2 : 0)}>
                  <div className="empty">Nenhum dia no período: adicione um dia de colheita.</div></td></tr>
              )}
              {grade.dias.map((d) => (
                <tr key={d.data}>
                  <td className="rotulo">
                    <CampoData className="cell-input" value={dataDoDia(d)} onChange={(iso) => setEditsDia((prev) => ({ ...prev, [d.data]: iso }))} />
                  </td>
                  <td className="rotulo"><RotuloDiaEmbalagem data={d.data} naoSalva={novos.has(d.data)} /></td>
                  {grade.produtos.map((p) => (
                    <Fragment key={p.id}>
                      <td className="num">
                        <input className="cell-input" type="number" min={0}
                          value={valorCelula(d.data, p.id, d.valores[p.id])}
                          onChange={(e) => editar(d.data, p.id, e.target.value)} />
                      </td>
                      {p.id === idF54 && (
                        <>
                          <td className="num">
                            <input className="cell-input" type="number" min={0} aria-label={`Bandejas F54 de ${dataBr(d.data)}`}
                              value={f54DoDia(d)} onChange={(e) => setEditsF54((prev) => ({ ...prev, [d.data]: e.target.value }))} />
                          </td>
                          <td className="num">{hf70DoDia(d)}</td>
                        </>
                      )}
                    </Fragment>
                  ))}
                  <td className="num">
                    <button className="btn ghost split-btn" disabled={salvando === d.data} onClick={() => salvarDia(d)}>
                      {salvando === d.data ? '…' : 'Salvar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="obs-tela">
          Valores em unidades embaladas no dia (bandejas/caixas). Zeros não geram registro no banco. Data do dia em branco = não informada (os dias da planilha e os lançados antes desta versão ficam assim). Bandejas F54: quantas bandejas do Shiitake Bdj foram na F54; em branco = não informada (os dias antes do campo ficam assim). A HF70 é o Shiitake Bdj menos a F54, e a F54 não passa do total.
        </div>
      </Panel>

      <EmbalagemSaldo inicio={fInicio} fim={fFim} hoje={hoje} onAlargar={(data) => {
        if (fInicio !== '' && data < fInicio) setFInicio(data);
        if (fFim !== '' && data > fFim) setFFim(data);
      }} />
    </>
  );
}
