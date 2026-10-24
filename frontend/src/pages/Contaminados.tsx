import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  atualizarContaminacaoJornada, CORES_CONTAMINACAO, dataBr, excluirContaminacaoJornada,
  getContaminados, getRegrasMaturacao, LOCAIS_NO_BLOCO, num, ordenarGalpoes, registrarContaminado, rotuloDoGalpao,
  type ContaminadoLinha, type LocalNoBloco, type RegraMaturacao, type TipoContaminado,
} from '../api/client';
import { criarGuardaDeCorrida, useRecarregarAtual } from '../components/BlocosOperacionais';
import { CampoData } from '../components/CampoData';
import { Panel, Pill, useConfirmar, useToast } from '../components/ui';
import {
  coresParaEnvio, LANCAMENTO_CANCELADO, memoriaDoLoteEncerrado, relatoContaminacaoMultipla, tentarComConfirmacao,
  tentarTodasEmSequencia,
} from './JornadaCogumelo';
import {
  TIPOS_DE_COGUMELO as TIPOS, descartarRecadoDeContaminados, filtrosIniciaisDoRecado, lerRecadoDeContaminados,
} from './recadoDeContaminados';

export function SelectCorContaminacao({ value, onChange, className, style }: {
  value: TipoContaminado; onChange: (v: TipoContaminado) => void;
  className?: string; style?: CSSProperties;
}) {
  return (
    <select className={className} style={style} value={value}
      onChange={(e) => onChange(e.target.value as TipoContaminado)}>
      {CORES_CONTAMINACAO.map((c) => <option key={c} value={c}>{c}</option>)}
    </select>
  );
}

export function SelectLocalNoBloco({ value, onChange, className, style }: {
  value: LocalNoBloco | ''; onChange: (v: LocalNoBloco | '') => void;
  className?: string; style?: CSSProperties;
}) {
  return (
    <select className={className} style={style} value={value}
      onChange={(e) => onChange(e.target.value as LocalNoBloco | '')}>
      <option value="">Não anotado</option>
      {LOCAIS_NO_BLOCO.map((l) => <option key={l} value={l}>{l}</option>)}
    </select>
  );
}

export { abrirContaminadosEm, lerRecadoDeContaminados, descartarRecadoDeContaminados, filtrosIniciaisDoRecado, type RecadoContaminados } from './recadoDeContaminados';

export interface EdicaoRetirada {
  data_retirada: string;
  tipo_contaminado: TipoContaminado | null;
  quantidade: string;
  local_no_bloco: LocalNoBloco | '';
  estante: string;
}

export const edicaoRetiradaOk = (
  ed: EdicaoRetirada, l?: { tipo_evento?: string; estante_registrada?: boolean; importado?: boolean },
) => (
  ed.data_retirada.trim() !== '' && Number(ed.quantidade) > 0
  && !(l && semEstanteDaTela(l) && ed.estante.trim() === '')
);

export const semEstanteDaTela = (l: { tipo_evento?: string; estante_registrada?: boolean; importado?: boolean }) => (
  l.tipo_evento === 'CONTAMINACAO' && l.estante_registrada === false && l.importado === false
);

export const novaRetiradaOk = (
  v: { data_lote: string; estante: string; data_retirada: string }, qtdItens: number,
) => Boolean(v.data_lote) && v.estante.trim() !== '' && Boolean(v.data_retirada) && qtdItens > 0;

export const mudancasDaRetirada = (ed: EdicaoRetirada, l: ContaminadoLinha) => {
  const data = ed.data_retirada.trim();
  const qtd = ed.quantidade.trim() === '' ? null : Number(ed.quantidade);
  return {
    ...(data !== '' && data !== (l.data_retirada ?? '') ? { data_retirada: data } : {}),
    ...(ed.tipo_contaminado !== l.tipo_contaminado ? { tipo_contaminado: ed.tipo_contaminado } : {}),
    ...(qtd != null && Number.isFinite(qtd) && qtd !== l.quantidade ? { quantidade: qtd } : {}),
    ...(ed.local_no_bloco !== (l.local_no_bloco ?? '') ? { local_no_bloco: ed.local_no_bloco } : {}),
    ...(ed.estante.trim() !== (l.estante_retirada ?? '') ? { estante: ed.estante.trim() } : {}),
  };
};

export const totaisDaRazao = (linhas: ContaminadoLinha[]) => {
  const daContaminacao = linhas.filter((l) => l.tipo_evento !== 'PERDA');
  const daPerda = linhas.filter((l) => l.tipo_evento === 'PERDA');
  return {
    contaminacao: daContaminacao.reduce((s, l) => s + l.quantidade, 0),
    perda: daPerda.reduce((s, l) => s + l.quantidade, 0),
    retiradasContaminacao: daContaminacao.length,
    retiradasPerda: daPerda.length,
  };
};

export const enderecoConfirmado = (l: { estante_retirada?: string | null }): string | null => (
  l.estante_retirada?.trim() || null
);

export const etiquetasDaLista = (bruta?: string | null): string[] => (
  String(bruta ?? '').split(',').map((s) => s.trim()).filter((s) => s !== '')
);

export function avisoHerancaDoLote<T extends { estante?: string | null; estante_retirada?: string | null }>(
  visiveis: T[],
  filtroEstante?: string,
): string | null {
  if ((filtroEstante?.trim() ?? '') === '') return null;
  const herdadas = visiveis.filter((l) => enderecoConfirmado(l) === null
    && etiquetasDaLista(l.estante).length > 1).length;
  if (herdadas === 0) return null;
  return `${herdadas} de ${visiveis.length} retiradas casaram pelo endereço do LOTE: `
    + 'a retirada não tem estante anotada, e a estante pode ser outra.';
}

export function rotuloDosFiltrosDaTela(f: {
  fGalpao: string; fEstante: string; fSoSemEstante: boolean; fLoteId: number | null;
}): string | null {
  const endereco = Boolean(f.fGalpao.trim() || f.fEstante.trim());
  const partes = [endereco && 'por endereço', f.fSoSemEstante && 'só sem estante da retirada', f.fLoteId != null && 'num lote só']
    .filter((p): p is string => Boolean(p));
  if (!partes.length) return null;
  const lista = partes.length === 1 ? partes[0] : `${partes.slice(0, -1).join(', ')} e ${partes[partes.length - 1]}`;
  return `filtrado ${lista}; sem ${partes.length === 1 ? 'esse filtro' : 'esses filtros'}: `;
}

export function avisoSoSemEstante(mostradas: number, naLista: number, ligado: boolean): string | null {
  if (!ligado) return null;
  return `Só as retiradas de contaminação lançadas pela tela com a estante da retirada não anotada: ${mostradas} de ${naLista} na lista. `
    + 'Confira na plaquinha do galpão e corrija em Editar; a retirada sai desta lista quando a estante é gravada.';
}

export function filtrarRazao<T extends {
  galpao: string | null; estante: string | null; estante_retirada?: string | null;
  tipo_evento?: string; estante_registrada?: boolean; importado?: boolean; lote_id?: number | null;
}>(
  linhas: T[],
  { galpao, estante, soSemEstante, loteId }: {
    galpao?: string; estante?: string; soSemEstante?: boolean; loteId?: number | null;
  },
): T[] {
  const galpaoAlvo = galpao?.trim().toLowerCase() || '';
  const estanteTexto = estante?.trim() ?? '';
  const estanteNum = estanteTexto === '' ? null : Number(estanteTexto);
  const casaPorNumero = estanteNum !== null && Number.isFinite(estanteNum);
  const estanteAlvoTexto = estanteTexto.toLowerCase();
  return linhas.filter((l) => {
    if (soSemEstante && !semEstanteDaTela(l)) return false;
    if (loteId != null && l.lote_id !== loteId) return false;
    if (galpaoAlvo && (l.galpao ?? '').trim().toLowerCase() !== galpaoAlvo) return false;
    if (estanteTexto !== '') {
      const alvoDaLinha = enderecoConfirmado(l) ?? l.estante ?? '';
      const itens = etiquetasDaLista(alvoDaLinha);
      if (casaPorNumero) {
        if (!itens.some((i) => Number(i) === estanteNum)) return false;
      } else if (!itens.some((i) => i.toLowerCase() === estanteAlvoTexto)) return false;
    }
    return true;
  });
}

export function estanteExibida(
  linha: { estante: string | null; estante_retirada?: string | null },
  filtroEstante?: string,
): string {
  const bruta = (linha.estante ?? '').trim();
  const alvo = filtroEstante?.trim() ?? '';
  if (bruta === '' || alvo === '' || enderecoConfirmado(linha) === null) return bruta;
  const alvoNum = Number(alvo);
  const porNumero = Number.isFinite(alvoNum);
  const casam = etiquetasDaLista(bruta)
    .filter((e) => (porNumero ? Number(e) === alvoNum : e.toLowerCase() === alvo.toLowerCase()));
  return casam.length === 0 ? bruta : casam.join(', ');
}

export function galpoesDaRazao(
  linhas: Array<{ galpao: string | null }>,
  selecionado = '',
): string[] {
  const vistos = new Set<string>();
  for (const l of linhas) {
    const g = (l.galpao ?? '').trim();
    if (g) vistos.add(g);
  }
  const escolhido = selecionado.trim();
  if (escolhido) vistos.add(escolhido);
  return [...vistos].sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }));
}

const quantidadesVazias = (): Record<TipoContaminado, string> => (
  Object.fromEntries(CORES_CONTAMINACAO.map((c) => [c, ''])) as Record<TipoContaminado, string>
);

const locaisVazios = (): Record<TipoContaminado, LocalNoBloco | ''> => (
  Object.fromEntries(CORES_CONTAMINACAO.map((c) => [c, '']))
) as Record<TipoContaminado, LocalNoBloco | ''>;

export function itensContaminacaoParaEnvio(v: {
  data_lote: string; tipo: string; estante: string; data_retirada: string;
  quantidades: Record<TipoContaminado, string>;
  locais: Record<TipoContaminado, LocalNoBloco | ''>;
}): Array<{ cor: TipoContaminado; corpo: Parameters<typeof registrarContaminado>[0] }> {
  return coresParaEnvio(v.quantidades).map((c) => ({
    cor: c.tipo_contaminado,
    corpo: {
      data_lote: v.data_lote, tipo: v.tipo, estante: v.estante || undefined,
      data_retirada: v.data_retirada, tipo_contaminado: c.tipo_contaminado,
      quantidade: c.quantidade,
      local_no_bloco: v.locais[c.tipo_contaminado] || undefined,
    },
  }));
}

export function PillPerda({ motivo }: { motivo?: string | null }) {
  return (
    <>
      <Pill tone="warn">PERDA</Pill>
      {motivo ? <span className="fixvar-none"> {motivo}</span> : null}
    </>
  );
}

export function Contaminados() {
  const toast = useToast();
  const confirmar = useConfirmar();
  const [linhas, setLinhas] = useState<ContaminadoLinha[] | null>(null);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [v, setV] = useState({
    data_lote: '', tipo: 'SH', estante: '', data_retirada: '',
    quantidades: quantidadesVazias(),
    locais: locaisVazios(),
  });
  const [editando, setEditando] = useState<number | null>(null);
  const [confirmando, setConfirmando] = useState<number | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [ed, setEd] = useState<EdicaoRetirada>({
    data_retirada: '', tipo_contaminado: 'VERDE', quantidade: '', local_no_bloco: '', estante: '',
  });

  const [inicial] = useState(() => filtrosIniciaisDoRecado(lerRecadoDeContaminados()));
  useEffect(() => { descartarRecadoDeContaminados(); }, []);
  const [fInicio, setFInicio] = useState(inicial.fInicio);
  const [fFim, setFFim] = useState(inicial.fFim);
  const [fTipo, setFTipo] = useState(inicial.fTipo);
  const [fGalpao, setFGalpao] = useState(inicial.fGalpao);
  const [fEstante, setFEstante] = useState('');
  const [fSoSemEstante, setFSoSemEstante] = useState(inicial.fSoSemEstante);
  const [fLoteId, setFLoteId] = useState<number | null>(inicial.fLoteId);
  const [recentesPrimeiro, setRecentesPrimeiro] = useState(true);
  const [destaque, setDestaque] = useState<number | null>(null);
  const refDestaque = useRef<HTMLTableRowElement | null>(null);

  const guarda = useRef(criarGuardaDeCorrida());
  const recarregarDoFiltro = useCallback(() => {
    const id = guarda.current.iniciar();
    setErro('');
    getContaminados({
      inicio: fInicio || undefined, fim: fFim || undefined, tipo: fTipo || undefined,
    })
      .then((ls) => { if (guarda.current.vale(id)) setLinhas(ls); })
      .catch((e) => { if (guarda.current.vale(id)) setErro(e?.response?.data?.erro ?? e.message); });
  }, [fInicio, fFim, fTipo]);
  useEffect(recarregarDoFiltro, [recarregarDoFiltro]);
  const recarregar = useRecarregarAtual(recarregarDoFiltro);

  const [regras, setRegras] = useState<RegraMaturacao[]>([]);
  useEffect(() => { getRegrasMaturacao().then(setRegras).catch(() => setRegras([])); }, []);

  useEffect(() => {
    if (destaque == null) return;
    refDestaque.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [destaque, linhas]);

  const visiveis = useMemo(() => {
    const ls = filtrarRazao(linhas ?? [], {
      galpao: fGalpao || undefined, estante: fEstante || undefined, soSemEstante: fSoSemEstante, loteId: fLoteId,
    });
    if (!recentesPrimeiro) return ls;
    return ls.sort((a, b) => (b.data_retirada ?? '').localeCompare(a.data_retirada ?? '')
      || (b.data_lote ?? '').localeCompare(a.data_lote ?? '')
      || b.id - a.id);
  }, [linhas, recentesPrimeiro, fGalpao, fEstante, fSoSemEstante, fLoteId]);

  const galpoes = useMemo(() => galpoesDaRazao(linhas ?? [], fGalpao), [linhas, fGalpao]);

  if (erro) return <div className="empty">Erro: {erro}</div>;
  if (!linhas) return <div className="loading">Carregando contaminados…</div>;

  const itens = itensContaminacaoParaEnvio(v);
  const ok = novaRetiradaOk(v, itens.length);
  const salvar = () => {
    setSalvando(true);
    let ultimoId: number | null = null;
    const memoria = memoriaDoLoteEncerrado(confirmar);
    tentarTodasEmSequencia(
      itens,
      (item) => (memoria.recusou()
        ? Promise.resolve({ ok: false as const, erro: LANCAMENTO_CANCELADO })
        : tentarComConfirmacao((extra) => registrarContaminado({ ...item.corpo, ...extra })
          .then((r) => { ultimoId = r?.id ?? null; return r; }), `contaminação (${item.cor})`, memoria.confirmar)),
    )
      .then((resultados) => {
        const todasOk = resultados.every((r) => r.ok);
        toast(relatoContaminacaoMultipla(resultados), !todasOk);
        if (resultados.some((r) => r.ok)) {
          setDestaque(ultimoId);
          recarregar();
        }
        if (todasOk) setV({ ...v, estante: '', quantidades: quantidadesVazias(), locais: locaisVazios() });
      })
      .finally(() => setSalvando(false));
  };

  const abrirEdicao = (l: ContaminadoLinha) => {
    setConfirmando(null);
    setEditando(l.id);
    setEd({
      data_retirada: l.data_retirada ?? '',
      tipo_contaminado: l.tipo_contaminado,
      quantidade: String(l.quantidade),
      local_no_bloco: l.local_no_bloco ?? '',
      estante: l.estante_retirada ?? '',
    });
  };

  const salvarEdicao = (l: ContaminadoLinha) => {
    const mudou = mudancasDaRetirada(ed, l);
    if (Object.keys(mudou).length === 0) {
      setEditando(null);
      toast('Nada mudou nesta retirada.');
      return;
    }
    setOcupado(true);
    atualizarContaminacaoJornada(l.id, mudou)
      .then(() => {
        toast('Retirada corrigida.');
        setEditando(null);
        recarregar();
      })
      .catch((e) => toast(e?.response?.data?.erro ?? e.message, true))
      .finally(() => setOcupado(false));
  };

  const apagar = (l: ContaminadoLinha) => {
    setOcupado(true);
    excluirContaminacaoJornada(l.id)
      .then(() => {
        toast(`Retirada de ${num(l.quantidade)} blocos apagada.`);
        setConfirmando(null);
        if (editando === l.id) setEditando(null);
        recarregar();
      })
      .catch((e) => toast(e?.response?.data?.erro ?? e.message, true))
      .finally(() => setOcupado(false));
  };

  const {
    contaminacao: totalContaminacao, perda: totalPerda,
    retiradasContaminacao, retiradasPerda,
  } = totaisDaRazao(visiveis);
  const rotuloFiltros = rotuloDosFiltrosDaTela({ fGalpao, fEstante, fSoSemEstante, fLoteId });
  const filtroDaTelaAtivo = rotuloFiltros != null;
  const totaisGerais = filtroDaTelaAtivo ? totaisDaRazao(linhas) : null;
  const avisoHeranca = avisoHerancaDoLote(visiveis, fEstante);
  const avisoSemEstante = avisoSoSemEstante(visiveis.length, linhas.length, fSoSemEstante);

  return (
    <>
      <Panel title="Registrar retirada" sub="Blocos retirados por contaminação: vinculados ao lote por data + tipo + estante">
        <div className="form-grid c4">
          <div className="fg"><label>Data do LOTE <span className="req">*</span></label>
            <CampoData value={v.data_lote} onChange={(iso) => setV({ ...v, data_lote: iso })} /></div>
          <div className="fg"><label>Tipo (SP/SH/SB/SS) <span className="req">*</span></label>
            <select value={v.tipo} onChange={(e) => setV({ ...v, tipo: e.target.value })}>
              {TIPOS.map((t) => <option key={t}>{t}</option>)}
            </select></div>
          <div className="fg"><label title="De qual estante o bloco saiu (a da plaquinha). Junto com a data e o tipo, ela acha o lote, e fica gravada como a estante da retirada, igual à Jornada.">
            Estante da Retirada <span className="req">*</span></label>
            <input value={v.estante} onChange={(e) => setV({ ...v, estante: e.target.value })} /></div>
          <div className="fg"><label>Data da Retirada <span className="req">*</span></label>
            <CampoData value={v.data_retirada} onChange={(iso) => setV({ ...v, data_retirada: iso })} /></div>
          {CORES_CONTAMINACAO.map((cor) => (
            <div className="fg" key={cor}>
              <label htmlFor={`ctm-qtd-${cor}`}>
                Quantidade {cor} <span className="fixvar-none">(vazio = não houve)</span>
              </label>
              <input id={`ctm-qtd-${cor}`} type="number" min={1} placeholder="vazio = não houve"
                value={v.quantidades[cor]}
                onChange={(e) => setV({ ...v, quantidades: { ...v.quantidades, [cor]: e.target.value } })} />
            </div>
          ))}
          {CORES_CONTAMINACAO.map((cor) => (
            <div className="fg" key={`local-${cor}`}>
              <label>Local no bloco {cor}</label>
              <SelectLocalNoBloco value={v.locais[cor]}
                onChange={(local) => setV({ ...v, locais: { ...v.locais, [cor]: local } })} />
            </div>
          ))}
          <div className="fg"><label>&nbsp;</label>
            <button className="btn" disabled={!ok || salvando} onClick={salvar}>
              {salvando ? 'Salvando…' : 'Registrar'}</button></div>
        </div>
      </Panel>

      <Panel id="contaminados-resumo" title="Contaminados"
        tag={`${num(retiradasContaminacao)} retiradas de contaminação (${num(totalContaminacao)} blocos) · `
          + `${num(retiradasPerda)} de perda (${num(totalPerda)} blocos)`
          + (totaisGerais
            ? ` · ${rotuloFiltros}${num(totaisGerais.retiradasContaminacao)} retiradas de `
              + `contaminação (${num(totaisGerais.contaminacao)} blocos) · ${num(totaisGerais.retiradasPerda)} `
              + `de perda (${num(totaisGerais.perda)} blocos)`
            : '')}
        sub="Razão de contaminação e perdas: o export continua só com contaminação, como a aba Contaminados da planilha">
        {avisoHeranca && <div className="aviso-pendente" role="status">{avisoHeranca}</div>}
        {avisoSemEstante && <div className="aviso-pendente" role="status">{avisoSemEstante}</div>}
        {fLoteId != null && (
          <div className="aviso-pendente" role="status">
            Só as retiradas do lote da pendência.{' '}
            <button className="btn ghost split-btn" onClick={() => setFLoteId(null)}>Ver todos os lotes</button>
          </div>
        )}
        <div className="filtros">
          <div className="fg">
            <label>Tipo</label>
            <select value={fTipo} onChange={(e) => setFTipo(e.target.value)}>
              <option value="">Todos</option>
              {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="fg">
            <label>Lote a partir de</label>
            <CampoData value={fInicio} onChange={setFInicio} />
          </div>
          <div className="fg">
            <label>Lote até</label>
            <CampoData value={fFim} onChange={setFFim} />
          </div>
          <div className="fg">
            <label>Galpão</label>
            <select value={fGalpao} onChange={(e) => setFGalpao(e.target.value)}>
              <option value="">Todos</option>
              {ordenarGalpoes(galpoes, regras).map((g) => <option key={g} value={g}>{rotuloDoGalpao(g, regras)}</option>)}
            </select>
          </div>
          <div className="fg">
            <label>Estante</label>
            <input value={fEstante} onChange={(e) => setFEstante(e.target.value)} />
          </div>
          <div className="fg">
            <label>&nbsp;</label>
            <label style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
              <input type="checkbox" checked={fSoSemEstante}
                onChange={(e) => setFSoSemEstante(e.target.checked)} />{' '}
              Só sem estante da retirada (lançadas pela tela)
            </label>
          </div>
          <div className="fg">
            <label>Ordem</label>
            <select value={recentesPrimeiro ? 'recentes' : 'planilha'}
              onChange={(e) => setRecentesPrimeiro(e.target.value === 'recentes')}>
              <option value="recentes">Retirada mais recente primeiro</option>
              <option value="planilha">Como na planilha (lote mais antigo primeiro)</option>
            </select>
          </div>
        </div>
        <div className="tbl-scroll" style={{ maxHeight: 520 }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Data do LOTE</th><th>Tipo (SP/SH/SB/SS)</th><th>Galpão</th>
                <th>Estante do lote</th><th>Estante da retirada</th>
                <th>Data da Retirada</th><th>Tipo Contaminado (Verde/Laranja/Preta) / Perda</th>
                <th>Local no bloco</th>
                <th className="num">Quantidade</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {visiveis.length === 0 && (
                <tr><td colSpan={10}><div className="empty">Nenhuma retirada para o filtro.</div></td></tr>
              )}
              {visiveis.map((l) => {
                const emEdicao = editando === l.id;
                const emConfirmacao = confirmando === l.id;
                const emDestaque = destaque === l.id;
                return (
                  <tr key={l.id} ref={emDestaque ? refDestaque : undefined}
                    className={emConfirmacao ? 'alert-row' : (emDestaque ? 'ln-grupo' : '')}>
                    <td>{dataBr(l.data_lote)}</td>
                    <td>{l.tipo ?? ''}</td>
                    <td>{l.galpao != null ? rotuloDoGalpao(l.galpao, regras) : ''}</td>
                    <td>{estanteExibida(l, fEstante)}</td>
                    <td>{emEdicao ? (
                      <input className="cell-input" style={{ width: 90, textAlign: 'left' }}
                        value={ed.estante} placeholder="ex.: 7"
                        onChange={(e) => setEd({ ...ed, estante: e.target.value })} />
                    ) : (enderecoConfirmado(l) ?? 'não anotada')}
                    </td>
                    <td>
                      {emEdicao ? (
                        <CampoData className="cell-input" style={{ width: 138, textAlign: 'left' }}
                          value={ed.data_retirada}
                          onChange={(iso) => setEd({ ...ed, data_retirada: iso })} />
                      ) : dataBr(l.data_retirada)}
                    </td>
                    <td>
                      {l.tipo_evento === 'PERDA' ? (
                        <PillPerda motivo={l.motivo} />
                      ) : emEdicao ? (
                        <SelectCorContaminacao className="cell-input" style={{ width: 104, textAlign: 'left' }}
                          value={ed.tipo_contaminado ?? 'VERDE'}
                          onChange={(tipo_contaminado) => setEd({ ...ed, tipo_contaminado })} />
                      ) : (
                        <Pill tone={l.tipo_contaminado === 'VERDE' ? 'ok' : l.tipo_contaminado === 'PRETA' ? 'bad' : 'warn'}>
                          {l.tipo_contaminado}
                        </Pill>
                      )}
                    </td>
                    <td>
                      {emEdicao ? (
                        <SelectLocalNoBloco className="cell-input" style={{ width: 120, textAlign: 'left' }}
                          value={ed.local_no_bloco}
                          onChange={(local_no_bloco) => setEd({ ...ed, local_no_bloco })} />
                      ) : (l.local_no_bloco ?? '')}
                    </td>
                    <td className="num">
                      {emEdicao ? (
                        <input className="cell-input" type="number" min={1}
                          value={ed.quantidade}
                          onChange={(e) => setEd({ ...ed, quantidade: e.target.value })} />
                      ) : num(l.quantidade)}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                        {emEdicao && (
                          <>
                            {semEstanteDaTela(l) && ed.estante.trim() === '' && (
                              <span style={{ fontSize: 11.5, color: 'var(--ink-soft)' }}>Falta a estante</span>
                            )}
                            <button className="btn split-btn" disabled={!edicaoRetiradaOk(ed, l) || ocupado}
                              onClick={() => salvarEdicao(l)}>Salvar</button>
                            <button className="btn ghost split-btn" disabled={ocupado}
                              onClick={() => setEditando(null)}>Cancelar</button>
                          </>
                        )}
                        {!emEdicao && emConfirmacao && (
                          <>
                            <span style={{ fontSize: 11.5, color: 'var(--ink-soft)' }}>
                              Apagar {num(l.quantidade)} blocos?
                            </span>
                            <button className="btn split-btn" disabled={ocupado}
                              onClick={() => apagar(l)}>Apagar</button>
                            <button className="btn ghost split-btn" disabled={ocupado}
                              onClick={() => setConfirmando(null)}>Cancelar</button>
                          </>
                        )}
                        {!emEdicao && !emConfirmacao && (
                          <>
                            <button className="btn ghost split-btn" disabled={ocupado}
                              onClick={() => abrirEdicao(l)}>Editar</button>
                            <button className="btn ghost split-btn" disabled={ocupado}
                              onClick={() => { setEditando(null); setConfirmando(l.id); }}>Excluir</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="obs-tela">
          Datas de retirada ilegíveis da planilha ("7/3", "7//3") entram no sistema como
          datas normais: a heurística dd/mm com o ano do lote é aplicada só na importação.
          <br />
          Duas linhas podem ser iguais em lote, estante e data e ainda assim serem retiradas
          diferentes: o que as distingue é a quantidade. Por isso "Excluir" pergunta pela
          quantidade antes de apagar, e a linha em questão fica destacada.
          <br />
          Os filtros de data do lote e tipo são do <strong>lote</strong>, como na Jornada. Galpão e
          estante filtram no navegador, sobre o que já foi carregado: nenhum vai ao servidor de
          novo. A retirada recém-registrada aparece destacada e a tela rola até ela.
        </div>
      </Panel>
    </>
  );
}
