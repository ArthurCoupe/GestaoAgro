import { useCallback, useEffect, useState } from 'react';
import {
  mfaEnroll, mfaFatores, mfaRemover, mfaVerify, type MfaEnrollResposta, type MfaFator,
} from '../api/client';
import { salvarToken } from '../auth';
import { Panel, useConfirmar, useToast } from '../components/ui';

const rotuloDoStatus = (s: MfaFator['status']) => (s === 'verified' ? 'Ativo' : 'Aguardando confirmação');

export function Seguranca() {
  const toast = useToast();
  const confirmar = useConfirmar();

  const [fatores, setFatores] = useState<MfaFator[] | null>(null);
  const [erro, setErro] = useState('');
  const [cadastro, setCadastro] = useState<MfaEnrollResposta | null>(null);
  const [codigo, setCodigo] = useState('');
  const [confirmando, setConfirmando] = useState(false);
  const [removendo, setRemovendo] = useState<string | null>(null);

  const recarregar = useCallback(() => {
    setErro('');
    mfaFatores()
      .then((r) => setFatores(r.fatores))
      .catch((e) => setErro(e?.response?.data?.erro ?? e.message));
  }, []);
  useEffect(recarregar, [recarregar]);

  const iniciarCadastro = () => {
    mfaEnroll()
      .then((r) => { setCadastro(r); setCodigo(''); })
      .catch((e) => toast(e?.response?.data?.erro ?? e.message, true));
  };

  const cancelarCadastro = () => { setCadastro(null); setCodigo(''); };

  const confirmarCadastro = () => {
    if (!cadastro || codigo.length !== 6) return;
    setConfirmando(true);
    mfaVerify(cadastro.id, codigo)
      .then((r) => {
        salvarToken(r.token);
        toast('Autenticador cadastrado.');
        cancelarCadastro();
        recarregar();
      })
      .catch((e) => toast(e?.response?.data?.erro ?? e.message, true))
      .finally(() => setConfirmando(false));
  };

  const remover = async (f: MfaFator) => {
    const ok = await confirmar('Remover este autenticador? No próximo login ele não vai mais ser pedido.');
    if (!ok) return;
    setRemovendo(f.id);
    mfaRemover(f.id)
      .then(() => { toast('Autenticador removido.'); recarregar(); })
      .catch((e) => toast(e?.response?.data?.erro ?? e.message, true))
      .finally(() => setRemovendo(null));
  };

  if (erro) return <div className="empty">Erro: {erro}</div>;
  if (!fatores) return <div className="loading">Carregando…</div>;

  return (
    <Panel title="Autenticadores" tag={`${fatores.length} cadastrado${fatores.length === 1 ? '' : 's'}`}
      sub="Um código extra, no aplicativo autenticador, além da senha. Cadastro opcional.">
      {fatores.length === 0 ? (
        <div className="empty">Nenhum autenticador cadastrado ainda.</div>
      ) : (
        <div className="plan-wrap">
          <table className="plan">
            <thead>
              <tr>
                <th className="rotulo">Situação</th>
                <th className="rotulo">Cadastrado em</th>
                <th className="rotulo" aria-label="Ações" />
              </tr>
            </thead>
            <tbody>
              {fatores.map((f) => (
                <tr key={f.id}>
                  <td className="rotulo">{rotuloDoStatus(f.status)}</td>
                  <td className="rotulo">{new Date(f.created_at).toLocaleDateString('pt-BR')}</td>
                  <td className="rotulo">
                    <button type="button" className="btn ghost" disabled={removendo === f.id}
                      onClick={() => remover(f)}>
                      {removendo === f.id ? 'Removendo…' : 'Remover'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {cadastro ? (
        <div className="form-grid c2">
          <div className="fg span2">
            <span id="mfa-qr-legenda">Escaneie o código no aplicativo autenticador</span>
            <img
              src={`data:image/svg+xml;utf8,${encodeURIComponent(cadastro.qr_svg)}`}
              alt="Código QR para cadastrar o autenticador"
              aria-describedby="mfa-qr-legenda"
              width={180} height={180}
            />
          </div>
          <div className="fg span2">
            <label htmlFor="mfa-secret">Ou digite manualmente</label>
            <input id="mfa-secret" type="text" value={cadastro.secret} readOnly
              onFocus={(e) => e.currentTarget.select()} />
          </div>
          <div className="fg">
            <label htmlFor="mfa-codigo">Código de 6 dígitos</label>
            <input id="mfa-codigo" type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6}
              value={codigo} autoComplete="one-time-code" autoFocus
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000" />
          </div>
          <div className="fg">
            <label htmlFor="mfa-confirmar">&nbsp;</label>
            <button id="mfa-confirmar" type="button" className="btn"
              disabled={confirmando || codigo.length !== 6} onClick={confirmarCadastro}>
              {confirmando ? 'Confirmando…' : 'Confirmar'}
            </button>
          </div>
          <div className="fg span2">
            <button type="button" className="btn ghost" onClick={cancelarCadastro}>Cancelar</button>
          </div>
        </div>
      ) : (
        <div className="form-acao">
          <button type="button" className="btn" onClick={iniciarCadastro}>Cadastrar autenticador</button>
        </div>
      )}
    </Panel>
  );
}
