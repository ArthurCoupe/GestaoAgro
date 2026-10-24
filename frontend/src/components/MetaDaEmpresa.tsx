import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { getMetasOperacionais, pct, putMetaOperacional } from '../api/client';
import { getMargemDesejada, putMargemDesejada } from '../api/gerencial';
import { ComoECalculado } from './ComoECalculado';
import { Kpi, Panel, useToast } from './ui';

export const ONDE_SE_EDITA_A_META = 'definida em Meta da empresa, na tela Budget';
export const CHAVE_DA_MINIMA = 'margem_operacional_minima_pct';

export function textoDaMetaEmUso(aprovados: number[] | null): string | null {
  if (aprovados == null) return null;
  if (aprovados.length === 0) return 'Sem Budget aprovado: a meta usada em todas as telas é a margem desejada.';
  return `Budget aprovado de ${[...aprovados].sort((a, b) => a - b).join(', ')}: no Consolidado, em período todo coberto por ele, `
    + 'a meta usada nas telas é a margem operacional do Budget aprovado. Nas frentes, nos meses sem Budget aprovado e na '
    + 'referência "Desejável" do quadro contra o Budget, vale a margem desejada.';
}

export function percentualDigitado(texto: string): number | null {
  if (texto.trim() === '') return null;
  const v = Number(texto.replace(',', '.'));
  return Number.isFinite(v) && v >= 0 && v <= 100 ? v : null;
}

function CampoDaMeta({ rotulo, valor, onSalvar }: { rotulo: string; valor: number | null; onSalvar?: (v: number) => Promise<void> }) {
  const [texto, setTexto] = useState(valor == null ? '' : String(valor));
  const [salvando, setSalvando] = useState(false);
  const toast = useToast();
  const enviar = (e: FormEvent) => {
    e.preventDefault();
    if (!onSalvar) return;
    const v = percentualDigitado(texto);
    if (v == null) { toast('Informe um percentual de 0 a 100.', true); return; }
    setSalvando(true);
    onSalvar(v).catch(() => {}).finally(() => setSalvando(false));
  };
  return (
    <Kpi label={rotulo} value={valor == null ? '—' : pct(valor)} tone="info"
      delta={onSalvar ? (
        <form onSubmit={enviar} style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          <input className="cell-input" type="number" min={0} max={100} step="any" value={texto}
            aria-label={`${rotulo} (%)`} onChange={(e) => setTexto(e.target.value)} />
          <span>%</span>
          <button className="btn ghost split-btn" type="submit" disabled={salvando}>Salvar</button>
        </form>
      ) : undefined} />
  );
}

export function QuadroDaMeta({ desejada, minima, aprovados, podeEditar, onSalvar }: {
  desejada: number | null; minima: number | null; aprovados: number[] | null; podeEditar: boolean;
  onSalvar?: (qual: 'desejada' | 'minima', valor: number) => Promise<void>;
}) {
  const origem = textoDaMetaEmUso(aprovados);
  const salvar = (qual: 'desejada' | 'minima') => (podeEditar && onSalvar ? (v: number) => onSalvar(qual, v) : undefined);
  return (
    <Panel title="Meta da empresa" sub="O único lugar onde se definem a margem mínima e a margem desejada. As outras telas só leem.">
      <div className="kpi-grid k2">
        <CampoDaMeta rotulo="Margem desejada" valor={desejada} onSalvar={salvar('desejada')} />
        <CampoDaMeta rotulo="Margem operacional mínima" valor={minima} onSalvar={salvar('minima')} />
      </div>
      {origem && <p className="obs-tela">{origem}</p>}
      {!podeEditar && <p className="obs-tela">Só a gestão geral altera a meta da empresa.</p>}
      <ComoECalculado chave="meta" />
    </Panel>
  );
}

export function MetaDaEmpresa({ aprovados, podeEditar }: { aprovados: number[] | null; podeEditar: boolean }) {
  const toast = useToast();
  const [valores, setValores] = useState<{ desejada: number; minima: number | null } | null>(null);
  const [erro, setErro] = useState('');
  const carregar = useCallback(() => {
    setErro('');
    Promise.all([getMargemDesejada(), getMetasOperacionais()])
      .then(([d, m]) => setValores({ desejada: d.margem_desejada, minima: m.metas[CHAVE_DA_MINIMA]?.valor ?? null }))
      .catch((e) => setErro(e?.response?.data?.erro ?? e.message));
  }, []);
  useEffect(carregar, [carregar]);
  const salvar = (qual: 'desejada' | 'minima', valor: number) =>
    (qual === 'desejada'
      ? putMargemDesejada(valor).then(() => `Margem desejada salva: ${pct(valor)}.`)
      : putMetaOperacional({ chave: CHAVE_DA_MINIMA, valor }).then((r) => `Margem operacional mínima salva: ${pct(valor)}, a partir de ${r.vigente_desde}.`))
      .then((frase) => {
        toast(`${frase} As telas usam o valor novo na próxima vez que apurarem.`);
        carregar();
      })
      .catch((e) => toast(e?.response?.data?.erro ?? e.message, true));
  if (erro) return <Panel title="Meta da empresa"><div className="empty">Meta da empresa indisponível ({erro}).</div></Panel>;
  if (!valores) return <Panel title="Meta da empresa"><div className="loading">Lendo a meta da empresa…</div></Panel>;
  return <QuadroDaMeta {...valores} aprovados={aprovados} podeEditar={podeEditar} onSalvar={salvar} />;
}
