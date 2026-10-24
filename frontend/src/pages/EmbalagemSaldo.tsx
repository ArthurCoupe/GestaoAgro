import { useCallback, useEffect, useRef, useState } from 'react';
import {
  dataBr, getSaldoDeBandejas, salvarSaldoDeBandejas,
  type SaldoDeBandejasGrade, type SaldoDeBandejasSalvo,
} from '../api/client';
import { criarGuardaDeCorrida, useRecarregarAtual } from '../components/BlocosOperacionais';
import { CampoData } from '../components/CampoData';
import { Panel, useToast } from '../components/ui';

export function resultadoAdicionarDiaSaldo(
  novoDia: string, hoje: string, diasExistentes: string[],
): { ok: true } | { ok: false; aviso: string } {
  if (!novoDia) return { ok: false, aviso: 'Escolha a data do saldo antes de adicionar.' };
  if (novoDia > hoje) return { ok: false, aviso: `O dia ${novoDia.slice(8, 10)}/${novoDia.slice(5, 7)} ainda não chegou: o saldo é a contagem do fim do dia.` };
  if (diasExistentes.includes(novoDia)) return { ok: false, aviso: 'Este dia já está na grade: edite a linha existente.' };
  return { ok: true };
}

export function valoresDoSaldo(
  edicoes: Record<number, string> | undefined, nova: boolean,
): Record<number, string | null> {
  const valores: Record<number, string | null> = {};
  for (const [id, bruto] of Object.entries(edicoes ?? {})) {
    const texto = bruto.trim();
    if (texto === '') { if (!nova) valores[Number(id)] = null; continue; }
    valores[Number(id)] = texto;
  }
  return valores;
}

export function valorDaCelula(
  grade: SaldoDeBandejasGrade, edits: Record<string, Record<number, string>>, data: string, produtoId: number,
): string {
  const editado = edits[data]?.[produtoId];
  if (editado !== undefined) return editado;
  const original = grade.dias.find((d) => d.data === data)?.valores[produtoId];
  return original == null ? '' : String(original);
}

export function resultadoSalvarSaldo(data: string, r: Pick<SaldoDeBandejasSalvo, 'gravados' | 'apagados'>): string {
  const dia = dataBr(data);
  if (r.gravados > 0 && r.apagados > 0) return `Saldo de ${dia} salvo: ${r.gravados} produto(s) contado(s), ${r.apagados} apagado(s).`;
  if (r.gravados > 0) return `Saldo de ${dia} salvo: ${r.gravados} produto(s) contado(s).`;
  if (r.apagados > 0) return `Saldo de ${dia}: ${r.apagados} produto(s) apagado(s), voltam a não informado.`;
  return `Nada para salvar em ${dia}.`;
}

export function GradeDoSaldo({ grade, novos, valorCelula, onEditar, onSalvar, salvando }: {
  grade: SaldoDeBandejasGrade;
  novos: Set<string>;
  valorCelula: (data: string, produtoId: number) => string;
  onEditar: (data: string, produtoId: number, valor: string) => void;
  onSalvar: (data: string) => void;
  salvando: string | null;
}) {
  return (
    <div className="plan-wrap">
      <table className="plan cp">
        <thead>
          <tr>
            <th className="rotulo">Dia</th>
            {grade.produtos.map((p) => <th key={p.id} className="num">{p.nome}</th>)}
            <th className="num" />
          </tr>
        </thead>
        <tbody>
          {grade.dias.length === 0 && (
            <tr><td className="rotulo" /><td colSpan={grade.produtos.length + 1}>
              <div className="empty">Nenhum saldo no período: adicione o dia da contagem.</div></td></tr>
          )}
          {grade.dias.map((d) => (
            <tr key={d.data}>
              <td className="rotulo">
                <b>{dataBr(d.data)}</b>
                {novos.has(d.data) && <span className="neg" role="status"> · não salvo</span>}
              </td>
              {grade.produtos.map((p) => (
                <td key={p.id} className="num">
                  <input className="cell-input" type="number" min={0} step={1} inputMode="numeric"
                    aria-label={`${p.nome} em ${dataBr(d.data)}`}
                    value={valorCelula(d.data, p.id)}
                    onChange={(e) => onEditar(d.data, p.id, e.target.value)} />
                </td>
              ))}
              <td className="num">
                <button className="btn ghost split-btn" disabled={salvando === d.data} onClick={() => onSalvar(d.data)}>
                  {salvando === d.data ? '…' : 'Salvar'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function EmbalagemSaldo({ inicio, fim, hoje, onAlargar }: {
  inicio: string; fim: string; hoje: string;
  onAlargar: (data: string) => void;
}) {
  const toast = useToast();
  const [grade, setGrade] = useState<SaldoDeBandejasGrade | null>(null);
  const [erro, setErro] = useState('');
  const [edits, setEdits] = useState<Record<string, Record<number, string>>>({});
  const [novos, setNovos] = useState<Set<string>>(new Set());
  const [novoDia, setNovoDia] = useState('');
  const [salvando, setSalvando] = useState<string | null>(null);

  const guarda = useRef(criarGuardaDeCorrida());
  const recarregarDoFiltro = useCallback(() => {
    const id = guarda.current.iniciar();
    setErro('');
    getSaldoDeBandejas({ inicio: inicio || undefined, fim: fim || undefined })
      .then((g) => { if (guarda.current.vale(id)) { setGrade(g); setEdits({}); setNovos(new Set()); } })
      .catch((e) => { if (guarda.current.vale(id)) setErro(e?.response?.data?.erro ?? e.message); });
  }, [inicio, fim]);
  useEffect(recarregarDoFiltro, [recarregarDoFiltro]);
  const recarregar = useRecarregarAtual(recarregarDoFiltro);

  if (erro) return <div className="empty">Saldo de bandejas indisponível ({erro}).</div>;
  if (!grade) return <div className="loading">Carregando o saldo de bandejas…</div>;

  const valorCelula = (data: string, produtoId: number) => valorDaCelula(grade, edits, data, produtoId);
  const editar = (data: string, produtoId: number, valor: string) =>
    setEdits((prev) => ({ ...prev, [data]: { ...prev[data], [produtoId]: valor } }));

  const salvar = (data: string) => {
    const nova = novos.has(data);
    const valores = valoresDoSaldo(edits[data], nova);
    if (Object.keys(valores).length === 0) {
      toast(nova ? `Digite pelo menos um saldo antes de salvar o dia ${dataBr(data)}.` : `Nada mudou em ${dataBr(data)}.`, true);
      return;
    }
    setSalvando(data);
    salvarSaldoDeBandejas({ data, valores })
      .then((r) => {
        toast(resultadoSalvarSaldo(data, r));
        const foraDoPeriodo = (inicio !== '' && data < inicio) || (fim !== '' && data > fim);
        if (foraDoPeriodo) onAlargar(data); else recarregar();
      })
      .catch((e) => toast(e?.response?.data?.erro ?? e.message, true))
      .finally(() => setSalvando(null));
  };

  const adicionarDia = () => {
    const r = resultadoAdicionarDiaSaldo(novoDia, hoje, grade.dias.map((d) => d.data));
    if (!r.ok) { toast(r.aviso, true); return; }
    setGrade({ ...grade, dias: [{ data: novoDia, valores: {} }, ...grade.dias] });
    setNovos((prev) => new Set(prev).add(novoDia));
    setNovoDia('');
  };

  return (
    <Panel id="embalagem-saldo" title="Saldo de bandejas em estoque" tag={`${grade.dias.length} dias`}
      sub="Contagem das bandejas em estoque no fim de cada dia, por produto da produção própria. Segue o De/Até da página.">
      <div className="filtros">
        <div className="fg"><label>Dia da contagem</label><CampoData value={novoDia} onChange={setNovoDia} /></div>
        <div className="fg"><label>&nbsp;</label>
          <button type="button" className="btn ghost" onClick={adicionarDia}>+ Adicionar dia</button></div>
        {novos.size > 0 && (
          <span className="aviso-pendente" role="status">
            Dia novo ainda não salvo: clique em Salvar antes de trocar de filtro ou recarregar.
          </span>
        )}
      </div>
      <GradeDoSaldo grade={grade} novos={novos} valorCelula={valorCelula} onEditar={editar} onSalvar={salvar} salvando={salvando} />
      <div className="obs-tela">
        Em branco = não informado. 0 = contado, sem bandeja em estoque. Para apagar um saldo, esvazie a célula e salve.
      </div>
    </Panel>
  );
}
