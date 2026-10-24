import { useState } from 'react';
import { dataBr, verificarAlertaDeRetirada, type Pendencia } from '../api/client';

export const podeVerificarRetirada = (role: string | null | undefined) =>
  role === 'GESTAO_GERAL' || role === 'ADMINISTRATIVO';

export async function verificarEAvisar(
  item: Pendencia,
  toast: (texto: string, erro?: boolean) => void,
  recarregar: () => unknown,
  verificar = verificarAlertaDeRetirada,
) {
  let marca;
  try {
    marca = await verificar(item.lote_id!, item.data_retirada!);
  } catch (e) {
    const err = e as { response?: { status?: number; data?: { erro?: string } }; message: string };
    toast(err.response?.data?.erro ?? err.message, true);
    if (err.response?.status === 409 || err.response?.status === 404) await recarregar();
    return;
  }
  toast(marca.ja_verificado
    ? `Já estava verificado por ${marca.verificado_por_nome}.`
    : `Verificado: retirada de ${dataBr(item.data_retirada!)}.`);
  await recarregar();
}

export function AcaoVerificarRetirada({ item, onVerificar }: {
  item: Pendencia;
  onVerificar: (item: Pendencia) => Promise<void>;
}) {
  const [confirmando, setConfirmando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [voltou, setVoltou] = useState(false);
  if (item.tipo !== 'RETIRADA_ACIMA_DO_LIMITE' || item.lote_id == null || !item.data_retirada) return null;
  const dia = `${item.data_retirada.slice(8, 10)}/${item.data_retirada.slice(5, 7)}`;
  const onde = item.estante ? `estante ${item.estante}` : `lote ${item.codigo ?? item.lote_id}`;
  if (!confirmando) {
    return (
      <button type="button" className="btn ghost" autoFocus={voltou} aria-label={`Verificado: ${onde}, retirada de ${dia}`}
        onClick={() => setConfirmando(true)}>Verificado</button>
    );
  }
  async function confirmar() {
    setSalvando(true);
    try { await onVerificar(item); } finally { setSalvando(false); setConfirmando(false); setVoltou(true); }
  }
  return (
    <span role="group" aria-label={`Confirmar que a retirada de ${dia}, ${onde}, foi verificada`}
      style={{ display: 'inline-flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      <span>Marcar a retirada de {dia} como verificada?</span>
      <button type="button" className="btn" disabled={salvando} onClick={confirmar}>{salvando ? 'Salvando…' : 'Confirmar'}</button>
      <button type="button" className="btn ghost" autoFocus disabled={salvando} onClick={() => { setConfirmando(false); setVoltou(true); }}>Cancelar</button>
    </span>
  );
}
