import { useState } from 'react';
import type { Pendencia } from '../api/client';
import { SelectSala, type SalaOpcao } from './SelectSala';

export function AcaoSalaDaAbertura({ item, salas, onGravar }: {
  item: Pendencia;
  salas: SalaOpcao[];
  onGravar: (item: Pendencia, sala: string) => Promise<void>;
}) {
  const [sala, setSala] = useState('');
  const [salvando, setSalvando] = useState(false);
  if (item.tipo !== 'ABERTURA_SEM_SALA' || item.transferencia_id == null) return null;
  async function gravar() {
    if (!sala) return;
    setSalvando(true);
    try { await onGravar(item, sala); } finally { setSalvando(false); }
  }
  return (
    <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
      <SelectSala id={`sala-abertura-${item.transferencia_id}`}
        ariaLabel={`Sala de frutificação do lote ${item.codigo ?? item.lote_id}, estante ${item.estante ?? ''}`}
        salas={salas} valor={sala} onChange={setSala} />
      <button type="button" className="btn ghost" disabled={!sala || salvando} onClick={gravar}>
        {salvando ? 'Salvando…' : 'Gravar sala'}
      </button>
    </span>
  );
}
