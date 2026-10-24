import { useState, type FormEvent } from 'react';
import { useAuth, type MotivoDaSaida } from '../auth';
import logoExemplo from '../assets/logo.svg';

const FRENTES = [
  { email: 'gerencia@exemplo.example', rotulo: 'Gerencial', desc: 'controle geral' },
  { email: 'producao@exemplo.example', rotulo: 'Produção Rural', desc: 'Aurora Rural' },
  { email: 'revenda@exemplo.example', rotulo: 'Revenda', desc: 'Exemplo Alimentos' },
];

const AVISO_DO_MOTIVO: Record<Exclude<MotivoDaSaida, null>, string> = {
  SESSAO_EXPIRADA: 'Sua sessão venceu. Entre de novo: o que estava digitando não foi salvo.',
  SESSAO_NAO_VERIFICADA: 'Não foi possível verificar a sessão. Recarregue a página ou entre de novo.',
};

export function mensagemDeErroDoLogin(ex: { response?: { status?: number; data?: { erro?: string } | string } }): string {
  if (!ex.response) return 'Sem conexão com o servidor. Verifique a internet e tente de novo.';
  const dados = ex.response.data;
  const erro = dados && typeof dados === 'object' ? dados.erro : undefined;
  if (erro) return erro;
  if ((ex.response.status ?? 0) >= 500) return 'O servidor falhou ao responder. Tente de novo em instantes.';
  return 'Não foi possível entrar. Verifique email e senha.';
}

export function Login() {
  const { entrar, motivoDaSaida, mfaPendente, confirmarMfa, cancelarMfa } = useAuth();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  const [codigo, setCodigo] = useState('');
  const [erroMfa, setErroMfa] = useState('');
  const [confirmando, setConfirmando] = useState(false);

  async function entrarCom(emailDigitado: string, senhaDigitada: string) {
    setErro(''); setEnviando(true);
    try {
      await entrar(emailDigitado.trim(), senhaDigitada);
    } catch (err) {
      const ex = err as { response?: { status?: number; data?: { erro?: string } | string } };
      setErro(mensagemDeErroDoLogin(ex));
    } finally {
      setEnviando(false);
    }
  }
  function submeter(e: FormEvent) {
    e.preventDefault();
    void entrarCom(email, senha);
  }
  async function entrarPeloAtalho(email: string) {
    setEmail(email);
    await entrar(email, '');
  }

  async function submeterCodigo(e: FormEvent) {
    e.preventDefault();
    setErroMfa(''); setConfirmando(true);
    try {
      await confirmarMfa(codigo);
    } catch (err) {
      const ex = err as { response?: { status?: number; data?: { erro?: string } | string } };
      setErroMfa(mensagemDeErroDoLogin(ex));
    } finally {
      setConfirmando(false);
    }
  }

  if (mfaPendente) {
    return (
      <div className="login-wrap">
        <form className="login-card" onSubmit={submeterCodigo}>
          <div className="login-brand">
            <img className="logo-ring lg" src={logoExemplo} alt="Exemplo Alimentos" />
            <div>
              <b>EXEMPLO</b>
              <small>Gestão Integrada</small>
            </div>
          </div>
          <h2>Código do autenticador</h2>
          <p className="login-sub">Abra o aplicativo autenticador e digite o código de 6 dígitos.</p>

          {erroMfa && <div className="login-erro">{erroMfa}</div>}

          <div className="fg">
            <label htmlFor="login-mfa-codigo">Código</label>
            <input id="login-mfa-codigo" type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6}
              value={codigo} autoComplete="one-time-code" autoFocus
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000" required />
          </div>
          <button className="btn btn-lg login-btn" type="submit" disabled={confirmando || codigo.length !== 6}>
            {confirmando ? 'Confirmando…' : 'Confirmar'}
          </button>
          <button type="button" className="btn ghost" onClick={cancelarMfa}>Cancelar e entrar com outra conta</button>
        </form>
      </div>
    );
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submeter}>
        <div className="login-brand">
          <img className="logo-ring lg" src={logoExemplo} alt="Exemplo Alimentos" />
          <div>
            <b>EXEMPLO</b>
            <small>Gestão Integrada</small>
          </div>
        </div>
        <h2>Entrar</h2>
        <p className="login-sub">{'Selecione sua frente e acesse com email e senha.'}</p>

        {motivoDaSaida && <div className="login-erro">{AVISO_DO_MOTIVO[motivoDaSaida]}</div>}
        {erro && <div className="login-erro">{erro}</div>}

        <div className="fg">
          <label>Email</label>
          <input type="email" value={email} autoComplete="username"
            onChange={(e) => setEmail(e.target.value)} placeholder="voce@exemplo.example" required />
        </div>
        <div className="fg">
          <label>Senha</label>
          <input type="password" value={senha} autoComplete="current-password"
            onChange={(e) => setSenha(e.target.value)} placeholder="••••••••" required />
        </div>
        <button className="btn btn-lg login-btn" type="submit" disabled={enviando}>
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>

        {(
          <div className="login-frentes">
            <div className="login-frentes-tit">Acessos de demonstração</div>
            {FRENTES.map((f) => (
              <button type="button" key={f.email} className="login-frente"
                onClick={() => entrarPeloAtalho(f.email)}>
                <b>{f.rotulo}</b> <span>· {f.desc}</span>
                <small>{f.email}</small>
              </button>
            ))}
          </div>
        )}
      </form>
    </div>
  );
}
