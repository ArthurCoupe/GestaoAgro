import { useEffect, useRef, useState } from 'react';
import {
  brl, corrigirLancamento, dataBr, getApoio, getLancamentosManuais,
  type Apoio, type Transacao,
} from '../api/client';
import { criarGuardaDeCorrida, useRecarregarAtual } from '../components/BlocosOperacionais';
import { Panel, Pill, usePeriodo, useToast } from '../components/ui';

export const podeCorrigirCentro = (t: Pick<Transacao, 'inserido_manualmente'>) => t.inserido_manualmente;

export const mensagemListaVazia = (soSemCategoria: boolean) => (soSemCategoria
  ? 'Nenhum lançamento sem categoria gerencial no período.'
  : 'Nenhum lançamento manual no período.');

export const cabecalhoDaAuditoria = (soSemCategoria: boolean) => (soSemCategoria
  ? {
    title: 'Lançamentos sem categoria',
    sub: 'Manuais e importados sem categoria gerencial: corrija a categoria com trilha de auditoria',
  }
  : {
    title: 'Lançamentos Manuais',
    sub: 'Transações digitadas manualmente: corrija classificações erradas com trilha de auditoria',
  });

export function Auditoria() {
  const toast = useToast();
  const { periodo } = usePeriodo();
  const [apoio, setApoio] = useState<Apoio | null>(null);
  const [dados, setDados] = useState<{ total: number; lancamentos: Transacao[] } | null>(null);
  const [soSemCategoria, setSoSemCategoria] = useState(false);
  const [editando, setEditando] = useState<Transacao | null>(null);
  const [novaCategoria, setNovaCategoria] = useState<number | ''>('');
  const [novoCentro, setNovoCentro] = useState<number | ''>('');
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState('');

  const guarda = useRef(criarGuardaDeCorrida());
  const recarregarDoFiltro = () => {
    const id = guarda.current.iniciar();
    setErro('');
    getLancamentosManuais({
      inicio: periodo.inicio, fim: periodo.fim,
      ...(soSemCategoria ? { semCategoria: 'true' } : {}),
    })
      .then((d) => { if (guarda.current.vale(id)) setDados(d); })
      .catch((e) => { if (guarda.current.vale(id)) setErro(e?.response?.data?.erro ?? e.message); });
  };
  useEffect(() => { getApoio().then(setApoio).catch(() => {}); }, []);
  useEffect(recarregarDoFiltro, [periodo, soSemCategoria]);
  const recarregar = useRecarregarAtual(recarregarDoFiltro);

  async function salvarCorrecao() {
    if (!editando) return;
    try {
      await corrigirLancamento(editando.id, {
        ...(novaCategoria !== '' ? { categoriaGerencialId: novaCategoria } : {}),
        ...(novoCentro !== '' ? { centroCustoId: novoCentro } : {}),
        motivo: motivo || undefined,
      });
      toast(`Lançamento #${editando.id} corrigido (trilha registrada).`);
      setEditando(null); setNovaCategoria(''); setNovoCentro(''); setMotivo('');
      recarregar();
    } catch (e) {
      const err = e as { response?: { data?: { erro?: string } }; message: string };
      toast(err.response?.data?.erro ?? err.message, true);
    }
  }

  if (erro) return <div className="empty">Erro (esta tela exige perfil GESTAO_GERAL): {erro}</div>;

  const cabecalho = cabecalhoDaAuditoria(soSemCategoria);

  return (
    <>
      <Panel title={cabecalho.title} tag={`${dados?.total ?? 0} registros`}
        sub={cabecalho.sub}>
        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
            <input type="checkbox" checked={soSemCategoria}
              onChange={(e) => setSoSemCategoria(e.target.checked)} />{' '}
            Mostrar apenas sem categoria gerencial (inclui lançamentos importados)
          </label>
        </div>
        <div className="tbl-scroll">
          <table className="tbl">
            <thead>
              <tr><th>#</th><th>Data</th><th>Descrição</th><th>Origem</th><th>Natureza</th><th>Categoria</th><th>Centro</th><th className="num">Valor</th><th></th></tr>
            </thead>
            <tbody>
              {(dados?.lancamentos ?? []).length === 0 && (
                <tr><td colSpan={9}><div className="empty">{mensagemListaVazia(soSemCategoria)}</div></td></tr>
              )}
              {(dados?.lancamentos ?? []).map((t) => (
                <tr key={t.id} className={!t.categorias_gerenciais ? 'warn-row' : ''}>
                  <td>{t.id}</td>
                  <td>{dataBr(t.data_competencia)}</td>
                  <td><Pill tone={t.inserido_manualmente ? 'neutral' : 'info'}>{t.inserido_manualmente ? 'manual' : 'importado'}</Pill></td>
                  <td>{t.descricao ?? '—'}</td>
                  <td><Pill tone={t.natureza === 'RECEITA' ? 'ok' : 'bad'}>{t.natureza}</Pill></td>
                  <td>{t.categorias_gerenciais?.nome ?? <Pill tone="warn">sem categoria</Pill>}</td>
                  <td>{t.centros_custo?.nome ?? '—'}</td>
                  <td className="num">{brl(Number(t.receita_liquida))}</td>
                  <td>
                    <button className="btn ghost" style={{ padding: '4px 10px' }}
                      onClick={() => { setEditando(t); setNovaCategoria(''); setNovoCentro(''); }}>
                      Corrigir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {editando && (
        <Panel title={`Corrigir lançamento #${editando.id}`} tag="auditoria"
          sub={`${editando.descricao ?? 'sem descrição'}: toda mudança fica registrada (quem/quando/de-para)`}>
          {!podeCorrigirCentro(editando) && (
            <p className="obs-tela">
              Lançamento importado da planilha: só a categoria gerencial pode ser corrigida aqui.
            </p>
          )}
          <div className="form-grid">
            <div className="fg">
              <label>Nova categoria gerencial</label>
              <select value={novaCategoria}
                onChange={(e) => setNovaCategoria(Number(e.target.value) || '')}>
                <option value="">manter atual</option>
                {apoio?.categorias_gerenciais.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </div>
            {podeCorrigirCentro(editando) && (
              <div className="fg">
                <label>Novo centro de custo</label>
                <select value={novoCentro}
                  onChange={(e) => setNovoCentro(Number(e.target.value) || '')}>
                  <option value="">manter atual</option>
                  {apoio?.centros_custo.map((c) => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="fg">
              <label>Motivo da correção</label>
              <input value={motivo} onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ex.: classificado na categoria errada" />
            </div>
          </div>
          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
            <button className="btn" onClick={salvarCorrecao}>Salvar correção</button>
            <button className="btn ghost" onClick={() => setEditando(null)}>Cancelar</button>
          </div>
        </Panel>
      )}
    </>
  );
}
