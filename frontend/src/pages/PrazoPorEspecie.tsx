import { useCallback, useEffect, useState } from 'react';
import {
  criarRegraMaturacaoEspecie, dataBr, getRegrasMaturacaoEspecie, type RegraMaturacaoEspecie,
} from '../api/client';
import { CampoData } from '../components/CampoData';
import { ORDEM_TIPO, ROTULO_TIPO } from '../components/BlocosOperacionais';
import { Panel, useToast } from '../components/ui';

const AVISO_APPEND_ONLY = 'O prazo de maturação segue a espécie do lote, em qualquer sala. Esta tela só '
  + 'lista e acrescenta regras, não existe editar nem apagar. Para mudar o prazo de uma espécie, cadastre '
  + 'uma regra nova a partir da data em que ela passa a valer: os lotes inoculados antes continuam com o '
  + 'prazo anterior. Errou uma regra recém-cadastrada? Avise a equipe técnica para corrigir no banco.';

export type FormRegra = { tipoCogumelo: string; dias: string; vigenteDesde: string; observacao: string };
export type CorpoRegra = { tipoCogumelo: string; dias: number; vigenteDesde: string; observacao?: string };

export function corpoDaRegra(v: FormRegra): CorpoRegra | null {
  const dias = Number(v.dias);
  if (!v.tipoCogumelo || v.dias.trim() === '' || !Number.isInteger(dias) || dias <= 0 || !v.vigenteDesde.trim()) {
    return null;
  }
  const observacao = v.observacao.trim();
  return { tipoCogumelo: v.tipoCogumelo, dias, vigenteDesde: v.vigenteDesde, ...(observacao ? { observacao } : {}) };
}

export function FormularioRegra({ v, salvando, onMudar, onCadastrar }: {
  v: FormRegra; salvando: boolean; onMudar: (v: FormRegra) => void; onCadastrar: () => void;
}) {
  const ok = corpoDaRegra(v) != null;
  return (
    <div className="form-grid c4">
      <div className="fg">
        <label>Espécie <span className="req">*</span></label>
        <select value={v.tipoCogumelo} disabled={salvando} onChange={(e) => onMudar({ ...v, tipoCogumelo: e.target.value })}>
          <option value="">Selecione…</option>
          {ORDEM_TIPO.map((t) => <option key={t} value={t}>{ROTULO_TIPO[t]}</option>)}
        </select>
      </div>
      <div className="fg">
        <label>Dias até a abertura <span className="req">*</span></label>
        <input type="number" min={1} step={1} value={v.dias} disabled={salvando}
          onChange={(e) => onMudar({ ...v, dias: e.target.value })} />
      </div>
      <div className="fg">
        <label>Vigente desde <span className="req">*</span></label>
        <CampoData value={v.vigenteDesde} disabled={salvando} onChange={(iso) => onMudar({ ...v, vigenteDesde: iso })} />
      </div>
      <div className="fg">
        <label>Observação</label>
        <input value={v.observacao} disabled={salvando} placeholder="opcional"
          onChange={(e) => onMudar({ ...v, observacao: e.target.value })} />
      </div>
      <div className="fg"><label>&nbsp;</label>
        <button className="btn" disabled={!ok || salvando} onClick={onCadastrar}>
          {salvando ? 'Salvando…' : 'Cadastrar regra'}
        </button>
      </div>
    </div>
  );
}

export function TabelaRegras({ itens }: { itens: RegraMaturacaoEspecie[] }) {
  if (itens.length === 0) return <div className="empty">Nenhuma regra cadastrada ainda.</div>;
  return (
    <table className="tbl">
      <thead>
        <tr><th>Espécie</th><th>Dias até a abertura</th><th>Vigente desde</th><th>Observação</th></tr>
      </thead>
      <tbody>
        {itens.map((r) => (
          <tr key={r.id}>
            <td>{ROTULO_TIPO[r.tipo_cogumelo] ?? r.tipo_cogumelo}</td>
            <td>{r.dias}</td>
            <td>{dataBr(r.vigente_desde)}</td>
            <td>{r.observacao ?? '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function PrazoPorEspecie() {
  const toast = useToast();
  const [itens, setItens] = useState<RegraMaturacaoEspecie[] | null>(null);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [v, setV] = useState<FormRegra>({ tipoCogumelo: '', dias: '', vigenteDesde: '', observacao: '' });

  const recarregar = useCallback(() => {
    setErro('');
    getRegrasMaturacaoEspecie()
      .then(setItens)
      .catch((e) => setErro(e?.response?.data?.erro ?? e.message));
  }, []);

  useEffect(recarregar, [recarregar]);

  if (erro) return <div className="empty">Erro: {erro}</div>;
  if (!itens) return <div className="loading">Carregando regras de maturação…</div>;

  const cadastrar = () => {
    const corpo = corpoDaRegra(v);
    if (!corpo) return;
    setSalvando(true);
    criarRegraMaturacaoEspecie(corpo)
      .then((r) => {
        toast(`Regra de ${ROTULO_TIPO[r.tipo_cogumelo] ?? r.tipo_cogumelo} cadastrada: ${r.dias} dias a partir de ${dataBr(r.vigente_desde)}.`);
        setV((estado) => ({ ...estado, tipoCogumelo: '', observacao: '' }));
        recarregar();
      })
      .catch((e) => toast(e?.response?.data?.erro ?? e.message, true))
      .finally(() => setSalvando(false));
  };

  return (
    <>
      <Panel title="Nova regra" sub={AVISO_APPEND_ONLY}>
        <FormularioRegra v={v} salvando={salvando} onMudar={setV} onCadastrar={cadastrar} />
      </Panel>
      <Panel title="Regras cadastradas" tag={`${itens.length} regra${itens.length === 1 ? '' : 's'}`}>
        <TabelaRegras itens={itens} />
      </Panel>
    </>
  );
}
