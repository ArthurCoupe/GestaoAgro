import { useState } from 'react';
import { dataBr, marcarDiaSemColheita, type Pendencia } from '../api/client';

export async function marcarEAvisar(
  item: Pendencia,
  toast: (texto: string, erro?: boolean) => void,
  recarregar: () => unknown,
  marcar = marcarDiaSemColheita,
) {
  let marca;
  try {
    marca = await marcar(item.data_lote);
  } catch (e) {
    const err = e as { response?: { status?: number; data?: { erro?: string } }; message: string };
    toast(err.response?.data?.erro ?? err.message, true);
    if (err.response?.status === 409) await recarregar();
    return;
  }
  toast(marca.ja_marcado ? `O dia ${dataBr(item.data_lote)} já estava marcado.` : `Registrado: não houve colheita em ${dataBr(item.data_lote)}.`);
  await recarregar();
}

export function AcaoNaoHouveColheita({ item, onMarcar }: {
  item: Pendencia;
  onMarcar: (item: Pendencia) => Promise<void>;
}) {
  const [confirmando, setConfirmando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  if (item.tipo !== 'EMBALAGEM_NAO_LANCADA') return null;
  const dia = `${item.data_lote.slice(8, 10)}/${item.data_lote.slice(5, 7)}`;
  if (item.pode_dispensar !== true) {
    if (item.colheita_no_dia !== true) return null;
    return (
      <span className="pendencia-motivo">
        {item.marcado_sem_colheita !== true && <>Há colheita lançada com a data {dia}, por isso não aparece o botão Não houve colheita.{' '}</>}
        Se a colheita de {dia} tem a data errada, corrija em Editar colheita, na Jornada do Cogumelo.
        {' '}Se a data está certa, lance a embalagem em Dados Embalagem.
      </span>
    );
  }
  if (!confirmando) {
    return <button type="button" className="btn ghost" onClick={() => setConfirmando(true)}>Não houve colheita</button>;
  }
  async function confirmar() {
    setSalvando(true);
    try { await onMarcar(item); } finally { setSalvando(false); setConfirmando(false); }
  }
  return (
    <span role="group" aria-label={`Confirmar que não houve colheita em ${dia}`}
      style={{ display: 'inline-flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      <span>Confirma que não houve colheita em {dia}?</span>
      <button type="button" className="btn" disabled={salvando} onClick={confirmar}>{salvando ? 'Salvando…' : 'Confirmar'}</button>
      <button type="button" className="btn ghost" disabled={salvando} onClick={() => setConfirmando(false)}>Cancelar</button>
    </span>
  );
}
