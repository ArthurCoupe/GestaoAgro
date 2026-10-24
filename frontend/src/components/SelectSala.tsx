import type { SalaComEtapa } from '../api/client';

export type SalaOpcao = Pick<SalaComEtapa, 'galpao_codigo' | 'nome' | 'etapa' | 'ativa'>;
export const salasDeFrutificacao = (salas: SalaOpcao[]): Array<{ galpao_codigo: string; nome: string }> =>
  salas.flatMap((s) => (s.etapa === 'FRUTIFICACAO' && s.ativa && s.galpao_codigo
    ? [{ galpao_codigo: s.galpao_codigo, nome: s.nome }] : []));

export function SelectSala({ id, ariaLabel, salas, valor, onChange }: {
  id: string; ariaLabel: string; salas: SalaOpcao[]; valor: string; onChange: (sala: string) => void;
}) {
  return (
    <select id={id} aria-label={ariaLabel} value={valor} onChange={(e) => onChange(e.target.value)}>
      <option value="">sala…</option>
      {salasDeFrutificacao(salas).map((s) => (
        <option key={s.galpao_codigo} value={s.galpao_codigo}>{s.galpao_codigo} · {s.nome}</option>
      ))}
    </select>
  );
}
