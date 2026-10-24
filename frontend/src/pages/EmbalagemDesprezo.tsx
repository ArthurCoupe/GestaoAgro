import { useEffect, useState } from 'react';
import { dataBr, num } from '../api/client';
import type { ColheitaDoDia, DesprezoBody, EmbalagemDesprezo, TipoCogumeloEmbalagem } from '../api/client';
import { CampoData } from '../components/CampoData';
import { Panel } from '../components/ui';
import { somaDePesagens } from './JornadaCogumelo';

export const TIPOS_DESPREZO: Array<{ v: TipoCogumeloEmbalagem; rotulo: string }> = [
  { v: 'SH', rotulo: 'Shiitake' }, { v: 'SP', rotulo: 'Shimeji Preto' }, { v: 'SB', rotulo: 'Shimeji Branco' }, { v: 'SS', rotulo: 'Shimeji Salmão' },
];
export const NOME_DO_TIPO_DESPREZO: Record<string, string> = Object.fromEntries(TIPOS_DESPREZO.map((t) => [t.v, t.rotulo]));

export interface ValoresDesprezo { data_lancamento: string; data_colheita: string; tipo: TipoCogumeloEmbalagem; kg: string; lote_id: string; observacao: string }

export function corpoDoDesprezo(v: ValoresDesprezo): { ok: true; body: DesprezoBody } | { ok: false; erro: string } {
  if (!v.data_colheita) return { ok: false, erro: 'Informe a data da colheita.' };
  if (!v.kg.trim()) return { ok: false, erro: 'Informe os kg desprezados.' };
  const soma = somaDePesagens(v.kg);
  if (soma.erro || soma.total == null) return { ok: false, erro: soma.erro ?? 'Informe os kg desprezados.' };
  if (soma.total <= 0) return { ok: false, erro: 'Os kg desprezados têm de ser maior que zero.' };
  if (v.data_lancamento && v.data_lancamento < v.data_colheita) return { ok: false, erro: 'A data do dia não pode ser antes da data da colheita.' };
  return {
    ok: true,
    body: {
      data_lancamento: v.data_lancamento || null, data_colheita: v.data_colheita, tipo_cogumelo: v.tipo,
      kg: Math.round(soma.total * 1000) / 1000, lote_id: v.lote_id ? Number(v.lote_id) : null,
      observacao: v.observacao.trim() || null,
    },
  };
}

const vazio = (hoje: string): ValoresDesprezo => ({ data_lancamento: hoje, data_colheita: '', tipo: 'SH', kg: '', lote_id: '', observacao: '' });
const deInicial = (d: EmbalagemDesprezo): ValoresDesprezo => ({
  data_lancamento: d.data_lancamento, data_colheita: d.data_colheita, tipo: d.tipo_cogumelo, kg: String(d.kg).replace('.', ','),
  lote_id: d.lote_id == null ? '' : String(d.lote_id), observacao: d.observacao ?? '',
});

export function FormDesprezo({ inicial, salvando, onSubmit, onCancelar, buscarColheitas, hoje }: {
  inicial?: EmbalagemDesprezo; salvando: boolean;
  onSubmit: (body: DesprezoBody) => Promise<void>; onCancelar: () => void;
  buscarColheitas: (data: string, tipo: string) => Promise<ColheitaDoDia[]>; hoje: string;
}) {
  const [v, setV] = useState<ValoresDesprezo>(inicial ? deInicial(inicial) : vazio(hoje));
  const [colheitas, setColheitas] = useState<ColheitaDoDia[]>([]);
  const [erro, setErro] = useState('');
  const soma = somaDePesagens(v.kg);
  useEffect(() => {
    if (!v.data_colheita) { setColheitas([]); return undefined; }
    let vivo = true;
    buscarColheitas(v.data_colheita, v.tipo).then((c) => { if (vivo) setColheitas(c); }).catch(() => { if (vivo) setColheitas([]); });
    return () => { vivo = false; };
  }, [v.data_colheita, v.tipo, buscarColheitas]);
  const enviar = () => {
    const r = corpoDoDesprezo(v);
    if (!r.ok) { setErro(r.erro); return; }
    setErro('');
    onSubmit(r.body).then(() => { if (!inicial) setV(vazio(hoje)); }).catch(() => {});
  };
  return (
    <div className="form-grid c4">
      <div className="fg"><label>Data do dia <span className="fixvar-none">(quando foi jogado fora)</span></label>
        <CampoData value={v.data_lancamento} onChange={(iso) => setV({ ...v, data_lancamento: iso })} /></div>
      <div className="fg"><label>Data da colheita <span className="req">*</span></label>
        <CampoData value={v.data_colheita} onChange={(iso) => setV({ ...v, data_colheita: iso, lote_id: '' })} /></div>
      <div className="fg"><label>Tipo de cogumelo <span className="req">*</span></label>
        <select value={v.tipo} onChange={(e) => setV({ ...v, tipo: e.target.value as TipoCogumeloEmbalagem, lote_id: '' })}>
          {TIPOS_DESPREZO.map((t) => <option key={t.v} value={t.v}>{t.rotulo}</option>)}
        </select></div>
      <div className="fg"><label htmlFor="desprezo-kg">Kg desprezados <span className="req">*</span> <span className="fixvar-none">(pode somar: 1,2 + 0,8)</span></label>
        <input id="desprezo-kg" type="text" inputMode="decimal" value={v.kg} onChange={(e) => setV({ ...v, kg: e.target.value })} />
        {soma.erro && <span className="fixvar-none" role="status">{soma.erro}</span>}
        {!soma.erro && soma.parcelas.length > 1 && <span className="fixvar-none">= {num(soma.total ?? 0, 3)} kg</span>}
      </div>
      <div className="fg span2"><label>Lote (opcional) <span className="fixvar-none">(as colheitas desse dia e tipo)</span></label>
        <select value={v.lote_id} onChange={(e) => setV({ ...v, lote_id: e.target.value })}>
          <option value="">{v.data_colheita ? (colheitas.length ? '(sem vínculo)' : '(nenhuma colheita nesse dia e tipo)') : '(escolha a data da colheita)'}</option>
          {colheitas.map((c) => (
            <option key={c.colheita_id} value={String(c.lote_id)}>
              lote de {dataBr(c.data_lote)}{c.estante ? ` · estante ${c.estante}` : ''}{c.kg != null ? ` · ${num(c.kg, 1)} kg` : ''}
            </option>
          ))}
        </select></div>
      <div className="fg span2"><label htmlFor="desprezo-observacao">Observação</label>
        <input id="desprezo-observacao" value={v.observacao} onChange={(e) => setV({ ...v, observacao: e.target.value })} /></div>
      {erro && <div className="fg" style={{ gridColumn: '1 / -1' }}><div className="obs-tela" role="alert">{erro}</div></div>}
      <div className="fg"><label>&nbsp;</label>
        <div className="form-acao">
          <button type="button" className="btn" disabled={salvando} onClick={enviar}>
            {salvando ? 'Salvando…' : (inicial ? 'Salvar correção' : 'Registrar desprezo')}
          </button>
          <button type="button" className="btn ghost" onClick={onCancelar}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

export function ListaDesprezos({ desprezos, onEditar, onExcluir }: {
  desprezos: EmbalagemDesprezo[]; onEditar: (d: EmbalagemDesprezo) => void; onExcluir: (d: EmbalagemDesprezo) => void;
}) {
  return (
    <Panel id="embalagem-desprezos" title="Kg desprezados registrados" tag={`${num(desprezos.length)} ${desprezos.length === 1 ? 'lançamento' : 'lançamentos'}`}
      sub="Cada linha entra no total de kg desprezados do período, no total do tipo e na conferência da colheita.">
      {desprezos.length === 0 ? (
        <div className="empty">Nenhum kg desprezado registrado no período.</div>
      ) : (
        <div className="tbl-scroll">
          <table className="tbl">
            <thead>
              <tr><th>Data do dia</th><th>Data da colheita</th><th>Tipo</th><th className="num">Kg</th><th>Lote</th><th>Observação</th><th>Ações</th></tr>
            </thead>
            <tbody>
              {desprezos.map((d) => (
                <tr key={d.id}>
                  <td>{dataBr(d.data_lancamento)}</td>
                  <td><b>{dataBr(d.data_colheita)}</b></td>
                  <td>{NOME_DO_TIPO_DESPREZO[d.tipo_cogumelo] ?? d.tipo_cogumelo}</td>
                  <td className="num">{d.kg.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</td>
                  <td>{d.lote_id == null ? '—' : `lote nº ${d.lote_id}`}</td>
                  <td>{d.observacao ?? ''}</td>
                  <td>
                    <button type="button" className="btn ghost split-btn" onClick={() => onEditar(d)}>Editar</button>{' '}
                    <button type="button" className="btn ghost split-btn" onClick={() => onExcluir(d)}>Excluir</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
