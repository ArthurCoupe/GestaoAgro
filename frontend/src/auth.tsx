import { createContext, useContext, useState, type ReactNode } from 'react';
import {
  getMe, logout as apiLogout, mfaChallenge, type Usuario,
} from './api/client';

const NOME_DA_ROLE: Record<string, string> = {
  GESTAO_GERAL: 'Gestão Geral',
  REVENDA: 'Revenda',
  PRODUCAO_RURAL: 'Produção Rural',
  ADMINISTRATIVO: 'Administrativo e Controladoria',
};
const ROLE_DEMO = import.meta.env.VITE_DEMO_ROLE ?? 'GESTAO_GERAL';

const ROLE_DEMO_POR_EMAIL: Record<string, string> = {
  'gerencia@exemplo.example': 'GESTAO_GERAL',
  'producao@exemplo.example': 'PRODUCAO_RURAL',
  'revenda@exemplo.example': 'REVENDA',
};
export function usuarioDaDemo(email = ''): Usuario {
  const role = ROLE_DEMO_POR_EMAIL[email.trim().toLowerCase()] ?? ROLE_DEMO;
  return {
    id: null, email: email.trim() || 'demo@exemplo', nome: 'Demonstração',
    role, role_nome: NOME_DA_ROLE[role] ?? role, unidade: null,
  };
}
const USUARIO_DEMO = usuarioDaDemo();

export function salvarToken(token: string) {
  localStorage.setItem('ex_token', token);
}

export function apagaTokenAoFalhar(e: unknown): boolean {
  const status = (e as { response?: { status?: number } } | undefined)?.response?.status;
  return status === 401 || status === 403;
}

export type MotivoDaSaida = 'SESSAO_EXPIRADA' | 'SESSAO_NAO_VERIFICADA' | null;

export interface MfaStatus { fatores_verificados: number; aal: 'aal1' | 'aal2' }
export function precisaDoCodigoMfa(mfa: MfaStatus | null | undefined): boolean {
  return !!mfa && mfa.fatores_verificados > 0 && mfa.aal !== 'aal2';
}

export interface MfaPendente { factorId: string }

interface AuthContexto {
  usuario: Usuario | null;
  carregando: boolean;
  entrar: (email: string, senha: string) => Promise<void>;
  sair: () => void;
  motivoDaSaida: MotivoDaSaida;
  mfaPendente: MfaPendente | null;
  confirmarMfa: (codigo: string) => Promise<void>;
  cancelarMfa: () => void;
}

export const AuthCtx = createContext<AuthContexto>({
  usuario: null, carregando: true, entrar: async () => {}, sair: () => {}, motivoDaSaida: null,
  mfaPendente: null, confirmarMfa: async () => {}, cancelarMfa: () => {},
});
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(USUARIO_DEMO);
  const carregando = false;
  const [motivoDaSaida, setMotivoDaSaida] = useState<MotivoDaSaida>(null);
  const [mfaPendente, setMfaPendente] = useState<MfaPendente | null>(null);

  const entrar = async (email: string, _senha: string) => {
    setMotivoDaSaida(null); setUsuario(usuarioDaDemo(email)); return;
  };
  const confirmarMfa = async (codigo: string) => {
    if (!mfaPendente) return;
    const r = await mfaChallenge(mfaPendente.factorId, codigo);
    salvarToken(r.token);
    const me = await getMe();
    setMfaPendente(null);
    setUsuario(me);
  };
  const cancelarMfa = () => {
    localStorage.removeItem('ex_token');
    setMfaPendente(null);
  };
  const sair = () => {
    const token = localStorage.getItem('ex_token');
    localStorage.removeItem('ex_token');
    if (token) void apiLogout(token);
    setMotivoDaSaida(null);
    setMfaPendente(null);
    setUsuario(null);
  };

  return (
    <AuthCtx.Provider value={{ usuario, carregando, entrar, sair, motivoDaSaida, mfaPendente, confirmarMfa, cancelarMfa }}>
      {children}
    </AuthCtx.Provider>
  );
}

export type ViewId =
  | 'overview' | 'historico' | 'gestao_resultado' | 'budget' | 'budget_projecoes'
  | 'painel_de_comando' | 'painel_operacional'
  | 'jornada' | 'proximas_aberturas' | 'mapa_estantes' | 'embalagem' | 'contaminados' | 'painel_contaminados' | 'investigador_contaminacao' | 'indicadores_ciclo' | 'qualidade_dados'
  | 'sementes' | 'receitas_substrato' | 'prazo_por_especie' | 'cadastro_mestre' | 'cadastro_custos' | 'estruturais' | 'metas_operacionais' | 'desempenho'
  | 'compras_mensal' | 'compras_mp' | 'pimentao' | 'revenda' | 'producao'
  | 'dre' | 'dre2026' | 'dre_nova' | 'classificacao' | 'indicadores' | 'equilibrio' | 'auditoria'
  | 'caixa' | 'ponte' | 'caixa_executivo'
  | 'seguranca';

const VIEWS_PRODUCAO: ViewId[] = [
  'painel_de_comando', 'painel_operacional',
  'jornada', 'proximas_aberturas', 'mapa_estantes', 'embalagem', 'contaminados', 'painel_contaminados', 'indicadores_ciclo', 'qualidade_dados',
  'sementes', 'receitas_substrato', 'prazo_por_especie', 'estruturais', 'metas_operacionais',
  'compras_mensal', 'compras_mp', 'pimentao',
];

export const VIEWS_LEGADO_FORA_DO_MENU: ViewId[] = ['dre', 'dre2026', 'classificacao', 'equilibrio', 'auditoria', 'desempenho'];

export const VIEWS_SO_POR_BOTAO: ViewId[] = ['investigador_contaminacao'];

export function viewsDoPerfil(role: string | null): ViewId[] {
  switch (role) {
    case 'REVENDA':
      return ['revenda', 'historico', 'dre_nova', 'indicadores', 'seguranca'];
    case 'PRODUCAO_RURAL':
      return ['producao', ...VIEWS_PRODUCAO, 'dre_nova', 'seguranca'];
    case 'ADMINISTRATIVO':
      return [...VIEWS_PRODUCAO.filter((v) => v !== 'pimentao'), 'indicadores', 'seguranca'];
    case 'GESTAO_GERAL':
    default:
      return ['overview', 'caixa_executivo', 'caixa', 'ponte', 'historico', 'gestao_resultado', 'budget_projecoes', 'budget', ...VIEWS_PRODUCAO, 'cadastro_mestre', 'cadastro_custos', 'investigador_contaminacao', 'producao', 'revenda', 'dre_nova', 'indicadores', 'seguranca'];
  }
}

export function escopoDreDoPerfil(role: string | null): {
  visao: string; operacao?: string; rotulo: string;
} {
  if (role === 'REVENDA') return { visao: 'operacao', operacao: 'REVENDA', rotulo: 'Revenda' };
  if (role?.startsWith('PRODUCAO')) return { visao: 'operacao', operacao: 'PRODUCAO', rotulo: 'Produção' };
  return { visao: 'consolidado', rotulo: 'Exemplo Alimentos Consolidada' };
}

export function visaoNovaDoPerfil(role: string | null): 'consolidado' | 'producao' | 'revenda' {
  if (role === 'REVENDA') return 'revenda';
  if (role?.startsWith('PRODUCAO')) return 'producao';
  return 'consolidado';
}

export function viewInicial(role: string | null): ViewId {
  if (role && role.startsWith('PRODUCAO')) return 'producao';
  if (role === 'REVENDA') return 'revenda';
  if (role === 'ADMINISTRATIVO') return 'painel_de_comando';
  return 'overview';
}
