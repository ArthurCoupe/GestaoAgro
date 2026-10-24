import type { ReactNode } from 'react';
import { dataBr } from '../api/client';
import { ROTULO_TIPO } from '../components/BlocosOperacionais';
import { Dica } from '../components/Dica';
import { Pill } from '../components/ui';
import { pctOuTraco } from './PainelContaminados';

export const pct = pctOuTraco;

export const MAX_LOTES_NO_CRUZAMENTO = 300;

export const ROTULO_DA_COR: Record<string, string> = { VERDE: 'Verde', LARANJA: 'Laranja', PRETA: 'Preta', SEM_COR: 'Sem cor' };

export const rotuloDoLote = (l: { data_lote: string | null; tipo: string | null }) =>
  `${dataBr(l.data_lote)} · ${ROTULO_TIPO[l.tipo ?? ''] ?? l.tipo}`;
export const rotuloDaChaveDoLote = (chave: string) => {
  const [data, tipo] = chave.split('|');
  return rotuloDoLote({ data_lote: data ?? null, tipo: tipo ?? null });
};

export const textoDaDiferenca = (pp: number | null) => {
  if (pp == null) return '—';
  const arredondado = Math.round(Math.abs(pp) * 10) / 10;
  if (arredondado === 0) return '0 p.p.';
  return `${pp > 0 ? '+' : '-'}${arredondado.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} p.p.`;
};

export function Diferenca({ pp, basePequena, mostrarValor = false }: { pp: number | null; basePequena: boolean; mostrarValor?: boolean }) {
  if (basePequena) {
    return mostrarValor && pp != null
      ? <>{textoDaDiferenca(pp)} <Pill tone="neutral">base pequena</Pill></>
      : <Pill tone="neutral">base pequena</Pill>;
  }
  if (pp == null || textoDaDiferenca(pp) === '0 p.p.') return <>{textoDaDiferenca(pp)}</>;
  return <Pill tone={pp > 0 ? 'warn' : 'ok'}>{textoDaDiferenca(pp)}</Pill>;
}

export const decimosDaTaxa = (produzidos: number | null | undefined, contaminados: number): number | null =>
  (produzidos != null && produzidos > 0 ? Math.round((contaminados * 1000) / produzidos) : null);
const textoDosDecimos = (d: number) => `${(d / 10).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
export const pctDoLote = (l: { blocos_produzidos: number | null; blocos_contaminados: number }) => {
  const d = decimosDaTaxa(l.blocos_produzidos, l.blocos_contaminados);
  return d == null ? '—' : textoDosDecimos(d);
};

export const decimosDaFracao = (k: number, n: number): number | null => (n > 0 ? Math.round((k * 1000) / n) : null);
export const pctDecimal = (k: number, n: number) => {
  const d = decimosDaFracao(k, n);
  return d == null ? '—' : textoDosDecimos(d);
};
export function diferencaDosMostrados(sel: { k: number; n: number }, base: { k: number; n: number }): number | null {
  const a = decimosDaFracao(sel.k, sel.n);
  const b = decimosDaFracao(base.k, base.n);
  return a == null || b == null ? null : (a - b) / 10;
}

export function Quadro({ titulo, dica, children, extra }: {
  titulo: string; dica?: ReactNode; children: ReactNode; extra?: ReactNode;
}) {
  return (
    <div className="panel">
      <div className="inv-cabecalho">
        <h3>{titulo}</h3>
        {dica != null && <Dica rotulo={`Sobre ${titulo}`}>{dica}</Dica>}
        {extra}
      </div>
      {children}
    </div>
  );
}
