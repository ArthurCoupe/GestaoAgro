import { Fragment, useState, type ReactNode } from 'react';
import type { Usuario } from '../api/client';
import type { ViewId } from '../auth';
import logoExemplo from '../assets/logo.svg';

interface Grupo { label: string; secao: string; ico: ReactNode; itens: Array<{ id: ViewId; rotulo: string; ico: string; divisor?: true }> }

// Desenhos de ICONE: Lucide, licença ISC (texto completo em https://lucide.dev/license).
// Copyright (c) 2026 Lucide Icons and Contributors
// Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee
// is hereby granted, provided that the above copyright notice and this permission notice appear in all copies.
const ICONE = {
  competencia: <><path d="M3 3v16a2 2 0 0 0 2 2h16" /><path d="M18 17V9" /><path d="M13 17V5" /><path d="M8 17v-3" /></>,
  objetivos: <><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></>,
  caixa: <><path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" /><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" /></>,
  frentes: <><path d="M10 12h4" /><path d="M10 8h4" /><path d="M14 21v-3a2 2 0 0 0-4 0v3" /><path d="M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2" /><path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16" /></>,
  ciclo: <><path d="M14 9.536V7a4 4 0 0 1 4-4h1.5a.5.5 0 0 1 .5.5V5a4 4 0 0 1-4 4 4 4 0 0 0-4 4c0 2 1 3 1 5a5 5 0 0 1-1 3" /><path d="M4 9a5 5 0 0 1 8 4 5 5 0 0 1-8-4" /><path d="M5 21h14" /></>,
  contaminacao: <><path d="M6 18h8" /><path d="M3 22h18" /><path d="M14 22a7 7 0 1 0 0-14h-1" /><path d="M9 14h2" /><path d="M9 12a2 2 0 0 1-2-2V6h6v4a2 2 0 0 1-2 2Z" /><path d="M12 6V3a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v3" /></>,
  cadastros: <><rect width="8" height="4" x="8" y="2" rx="1" ry="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><path d="M12 11h4" /><path d="M12 16h4" /><path d="M8 11h.01" /><path d="M8 16h.01" /></>,
  compras: <><path d="m2.05 2.05 1.099-.028a1 1 0 0 1 1.008.815l2.69 14.347A1 1 0 0 0 7.83 18H18" /><path d="M4.563 5h16.435a1 1 0 0 1 .981 1.204l-1.026 6.226A2 2 0 0 1 18.962 14H6.25" /><circle cx="18" cy="20" r="2" /><circle cx="8" cy="20" r="2" /></>,
  indicadores: <><rect width="16" height="20" x="4" y="2" rx="2" /><line x1="8" x2="16" y1="6" y2="6" /><line x1="16" x2="16" y1="14" y2="18" /><path d="M16 10h.01" /><path d="M12 10h.01" /><path d="M8 10h.01" /><path d="M12 14h.01" /><path d="M8 14h.01" /><path d="M12 18h.01" /><path d="M8 18h.01" /></>,
  conta: <><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /><path d="m9 12 2 2 4-4" /></>,
};

export const GRUPOS: Grupo[] = [
  {
    label: 'Competência',
    secao: 'Gerencial',
    ico: ICONE.competencia,
    itens: [
      { id: 'overview', rotulo: 'Visão Executiva', ico: '◉' },
      { id: 'historico', rotulo: 'Análise Mensal do Resultado', ico: '▤' },
      { id: 'gestao_resultado', rotulo: 'Gestão do Resultado', ico: '◎' },
      { id: 'dre_nova', rotulo: 'DRE Gerencial', ico: '◫' },
    ],
  },
  {
    label: 'Objetivos e Projeções',
    secao: 'Gerencial',
    ico: ICONE.objetivos,
    itens: [
      { id: 'budget_projecoes', rotulo: 'Budget / Projeções', ico: '◎' },
      { id: 'budget', rotulo: 'Budget', ico: '◇' },
    ],
  },
  {
    label: 'Caixa',
    secao: 'Gerencial',
    ico: ICONE.caixa,
    itens: [
      { id: 'caixa_executivo', rotulo: 'Visão Executiva', ico: '◉' },
      { id: 'caixa', rotulo: 'Resultado de Caixa', ico: '$' },
      { id: 'ponte', rotulo: 'Ponte Competência × Caixa', ico: '⇄' },
    ],
  },
  {
    label: 'Frentes',
    secao: 'Gerencial',
    ico: ICONE.frentes,
    itens: [
      { id: 'producao', rotulo: 'Painel da Produção', ico: '❋' },
      { id: 'revenda', rotulo: 'Painel da Revenda', ico: '⬡' },
    ],
  },
  {
    label: 'Ciclo Produtivo',
    secao: 'Produção',
    ico: ICONE.ciclo,
    itens: [
      { id: 'painel_de_comando', rotulo: 'Painel de Comando', ico: '⌘' },
      { id: 'painel_operacional', rotulo: 'Painel Operacional', ico: '◈' },
      { id: 'jornada', rotulo: 'Jornada do Cogumelo', ico: '❋' },
      { id: 'proximas_aberturas', rotulo: 'Próximas Aberturas', ico: '⏱' },
      { id: 'mapa_estantes', rotulo: 'Mapa das Estantes', ico: '⊞' },
      { id: 'embalagem', rotulo: 'Dados Embalagem', ico: '▦' },
    ],
  },
  {
    label: 'Contaminação e Indicadores',
    secao: 'Produção',
    ico: ICONE.contaminacao,
    itens: [
      { id: 'painel_contaminados', rotulo: 'Painel de Contaminados', ico: '☣' },
      { id: 'contaminados', rotulo: 'Contaminados', ico: '✕' },
      { id: 'indicadores_ciclo', rotulo: 'Indicadores do Ciclo', ico: '▤', divisor: true },
      { id: 'estruturais', rotulo: 'Capacidade Produtiva', ico: '▥' },
      { id: 'pimentao', rotulo: 'Indicadores Pimentão', ico: '◉' },
      { id: 'qualidade_dados', rotulo: 'Qualidade dos Dados', ico: '⚑' },
    ],
  },
  {
    label: 'Cadastros',
    secao: 'Apoio',
    ico: ICONE.cadastros,
    itens: [
      { id: 'metas_operacionais', rotulo: 'Metas e Limiares', ico: '⚖' },
      { id: 'sementes', rotulo: 'Sementes', ico: '⁘', divisor: true },
      { id: 'receitas_substrato', rotulo: 'Cadastro de Receitas', ico: '⚗' },
      { id: 'prazo_por_especie', rotulo: 'Prazo por Espécie', ico: '⏳' },
      { id: 'cadastro_mestre', rotulo: 'Cadastro Mestre de Atividades', ico: '⧖' },
      { id: 'cadastro_custos', rotulo: 'Cadastro Mestre de Custos', ico: '¤' },
    ],
  },
  {
    label: 'Compras',
    secao: 'Apoio',
    ico: ICONE.compras,
    itens: [
      { id: 'compras_mensal', rotulo: 'Pedido de Compras', ico: '▣' },
      { id: 'compras_mp', rotulo: 'Compras de Matéria-Prima', ico: '⧉' },
    ],
  },
  {
    label: 'Indicadores',
    secao: 'Apoio',
    ico: ICONE.indicadores,
    itens: [
      { id: 'indicadores', rotulo: 'Calculadoras', ico: '𝑓' },
    ],
  },
  {
    label: 'Conta',
    secao: 'Apoio',
    ico: ICONE.conta,
    itens: [
      { id: 'seguranca', rotulo: 'Segurança da conta', ico: '⚿' },
    ],
  },
];

function gruposVisiveis(itensVisiveis: ViewId[]): Grupo[] {
  const permitido = new Set(itensVisiveis);
  return GRUPOS
    .map((g) => ({ ...g, itens: g.itens.filter((i) => permitido.has(i.id)) }))
    .filter((g) => g.itens.length);
}

function secoesDe(grupos: Grupo[]): Array<{ nome: string; grupos: Grupo[] }> {
  const secoes: Array<{ nome: string; grupos: Grupo[] }> = [];
  for (const g of grupos) {
    const ultima = secoes[secoes.length - 1];
    if (ultima?.nome === g.secao) ultima.grupos.push(g);
    else secoes.push({ nome: g.secao, grupos: [g] });
  }
  return secoes;
}

export function AbasDoGrupo({ view, onNavigate, itensVisiveis }: {
  view: ViewId;
  onNavigate: (v: ViewId) => void;
  itensVisiveis: ViewId[];
}) {
  const g = gruposVisiveis(itensVisiveis).find((x) => x.itens.some((i) => i.id === view));
  if (!g || g.itens.length < 2) return null;
  return (
    <div className="abas-grupo" role="tablist" aria-label={g.label}>
      {g.itens.map((item, idx) => (
        <Fragment key={item.id}>
          {item.divisor && idx > 0 && <span className="abas-divisor" aria-hidden="true" />}
          <button
            type="button"
            role="tab"
            aria-selected={item.id === view}
            className={`aba${item.id === view ? ' ativa' : ''}`}
            onClick={() => onNavigate(item.id)}
          >
            {item.rotulo}
          </button>
        </Fragment>
      ))}
    </div>
  );
}

export function Sidebar({ view, onNavigate, itensVisiveis, usuario, onLogout, modoAbas = false }: {
  view: ViewId;
  onNavigate: (v: ViewId) => void;
  itensVisiveis: ViewId[];
  usuario: Usuario | null;
  onLogout: () => void;
  modoAbas?: boolean;
}) {
  const grupos = gruposVisiveis(itensVisiveis);

  const inicial = (usuario?.nome ?? '?').trim().charAt(0).toUpperCase();

  const [aberta, setAberta] = useState(false);
  const navegar = (id: ViewId) => { setAberta(false); onNavigate(id); };

  return (
    <aside className={`sidebar${aberta ? ' aberta' : ''}`}>
      <div className="side-brand">
        <img className="logo-ring" src={logoExemplo} alt="Exemplo Alimentos" />
        <div>
          <b>EXEMPLO</b>
          <small>Gestão Integrada</small>
        </div>
        <button className="side-toggle" aria-expanded={aberta} onClick={() => setAberta((a) => !a)}>
          ☰ Menu
        </button>
      </div>
      <nav>
        {modoAbas ? secoesDe(grupos).map((s) => (
          <div className="nav-group" key={s.nome}>
            <div className="nav-label">{s.nome}</div>
            {s.grupos.map((g) => (
              <button
                key={g.label}
                className={`nav-item ${g.itens.some((i) => i.id === view) ? 'active' : ''}`}
                onClick={() => navegar(g.itens[0].id)}
              >
                <span className="ico ico-linha">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{g.ico}</svg>
                </span>
                {g.label}
              </button>
            ))}
          </div>
        )) : grupos.map((g) => (
          <div className="nav-group" key={g.label}>
            <div className="nav-label">{g.label}</div>
            {g.itens.map((item) => (
              <button
                key={item.id}
                className={`nav-item ${view === item.id ? 'active' : ''}`}
                onClick={() => navegar(item.id)}
              >
                <span className="ico">{item.ico}</span>
                {item.rotulo}
              </button>
            ))}
          </div>
        ))}
      </nav>

      {usuario && (
        <div className="side-user">
          <div className="avatar">{inicial}</div>
          <div>
            <div className="u-nome">{usuario.nome}</div>
            <div className="u-role">{usuario.role_nome ?? usuario.role}</div>
          </div>
          <button className="u-logout" onClick={onLogout} title="Sair">Sair</button>
        </div>
      )}
    </aside>
  );
}
