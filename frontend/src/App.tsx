import { useCallback, useEffect, useMemo, useState } from 'react';
import './charts/setup';
import { getPeriodoRecente, anoMesHoje, getHealth } from './api/client';
import { PERGUNTAS_DAS_TELAS } from './api/gerencial';
import { FUNCAO_DA_TELA } from './api/perguntasGerenciais';
import { precisaAtualizar } from './api/versao';
import { AuthProvider, useAuth, viewInicial, viewsDoPerfil, type ViewId } from './auth';
import { AbasDoGrupo, Sidebar } from './components/Sidebar';
import {
  ConfirmarProvider, esperarElemento, NavProvider, normalizarAncora, opcoesDeMes, PeriodoCtx, periodoDoMes, ToastProvider,
} from './components/ui';
import { Auditoria } from './pages/Auditoria';
import { Budget } from './pages/Budget';
import { BudgetProjecoes } from './pages/BudgetProjecoes';
import { CadastroReceitas } from './pages/CadastroReceitas';
import { CaixaExecutivo } from './pages/CaixaExecutivo';
import { Classificacao } from './pages/Classificacao';
import { ComprasMateriaPrima } from './pages/ComprasMateriaPrima';
import { ComprasMensal } from './pages/ComprasMensal';
import { Contaminados } from './pages/Contaminados';
import { Dashboard } from './pages/Dashboard';
import { Desempenho } from './pages/Desempenho';
import { Dre } from './pages/Dre';
import { DreGerencial } from './pages/DreGerencial';
import { DreNova } from './pages/DreNova';
import { Embalagem } from './pages/Embalagem';
import { Equilibrio } from './pages/Equilibrio';
import { GestaoDoResultado } from './pages/GestaoDoResultado';
import { Historico } from './pages/Historico';
import { Indicadores } from './pages/Indicadores';
import { IndicadoresCiclo } from './pages/IndicadoresCiclo';
import { QualidadeDosDados } from './pages/QualidadeDosDados';
import { IndicadoresEstruturais } from './pages/IndicadoresEstruturais';
import { InvestigadorContaminacao } from './pages/InvestigadorContaminacao';
import { JornadaCogumelo } from './pages/JornadaCogumelo';
import { Login } from './pages/Login';
import { MapaDasEstantes } from './pages/MapaDasEstantes';
import { MetasOperacionais } from './pages/MetasOperacionais';
import { PainelContaminados } from './pages/PainelContaminados';
import { PainelDeComando } from './pages/PainelDeComando';
import { PainelOperacional } from './pages/PainelOperacional';
import { PainelProducao } from './pages/PainelProducao';
import { PainelRevenda } from './pages/PainelRevenda';
import { Pimentao } from './pages/Pimentao';
import { Ponte } from './pages/Ponte';
import { PrazoPorEspecie } from './pages/PrazoPorEspecie';
import { CadastroMestre } from './pages/CadastroMestre';
import { CadastroDeCustos } from './pages/CadastroDeCustos';
import { ProximasAberturas } from './pages/ProximasAberturas';
import { ResultadoDeCaixa } from './pages/ResultadoDeCaixa';
import { Seguranca } from './pages/Seguranca';
import { Sementes } from './pages/Sementes';

const TITULOS: Record<ViewId, { titulo: string; sub: string }> = {
  overview: { titulo: 'Competência: Visão Executiva', sub: FUNCAO_DA_TELA.visao_executiva },
  caixa_executivo: { titulo: 'Caixa: Visão Executiva', sub: PERGUNTAS_DAS_TELAS.caixa },
  caixa: { titulo: 'Resultado de Caixa', sub: 'Quanto dinheiro efetivamente entrou, saiu e sobrou' },
  ponte: { titulo: 'Ponte: Competência × Caixa', sub: PERGUNTAS_DAS_TELAS.ponte },
  historico: { titulo: 'Análise Mensal do Resultado', sub: FUNCAO_DA_TELA.analise_mensal },
  gestao_resultado: { titulo: 'Gestão do Resultado', sub: FUNCAO_DA_TELA.gestao_do_resultado },
  budget: { titulo: 'Budget', sub: 'A versão do Budget por linha da DRE, mês a mês, e o status de aprovação' },
  budget_projecoes: { titulo: 'Budget / Projeções', sub: 'O termômetro do mês: realizado, projeção de fechamento e ritmo necessário contra as metas de produção e de vendas' },
  painel_de_comando: { titulo: 'Painel de Comando', sub: 'Visão geral do dia para decidir e agir' },
  painel_operacional: { titulo: 'Painel Operacional', sub: 'O cockpit diário: alertas críticos, aberturas, sementes, contaminação e colheita num só lugar' },
  jornada: { titulo: 'Jornada do Cogumelo', sub: 'Lotes, aberturas, colheitas e contaminações: como na planilha' },
  proximas_aberturas: { titulo: 'Próximas Aberturas', sub: 'O que precisa sair da maturação: por galpão e estante' },
  mapa_estantes: { titulo: 'Mapa das Estantes', sub: 'O que há em cada estante de maturação, por galpão: lote, guardados, retirados, abertos e disponíveis' },
  embalagem: { titulo: 'Dados Embalagem', sub: 'Embalagens por dia de colheita, kg desprezados e a conferência colheita × embalagem' },
  contaminados: { titulo: 'Contaminados', sub: 'Razão de contaminação e perdas: o export continua só com contaminação' },
  painel_contaminados: { titulo: 'Painel de Contaminados',
    sub: 'Termômetro da contaminação por semana de produção: quanto, se piorou, desde quando e onde' },
  investigador_contaminacao: { titulo: 'Investigador de Contaminação',
    sub: 'O que os casos têm em comum e onde procurar: local, espécie, pessoas e insumos, sempre com base e referência' },
  indicadores_ciclo: { titulo: 'Indicadores', sub: 'Indicadores do ciclo produtivo por tipo e data de lote' },
  qualidade_dados: { titulo: 'Qualidade dos Dados', sub: 'Divergências de contagem e validações do ciclo, com o registro de cada ocorrência' },
  sementes: { titulo: 'Sementes', sub: 'Estoque por validade, atividade e pedido de compras' },
  receitas_substrato: { titulo: 'Cadastro de Receitas', sub: 'Receitas de substrato: nome, espécie, status e data de início de utilização. Abaixo do cadastro, as receitas antigas da planilha, só para consulta' },
  prazo_por_especie: { titulo: 'Prazo por Espécie', sub: 'Dias de maturação até a abertura, pela espécie do lote, com vigência. Só lista e acrescenta' },
  cadastro_mestre: { titulo: 'Cadastro Mestre de Atividades', sub: 'Os tempos de cada atividade da operação, com vigência e o histórico das versões: a base das horas e da mão de obra no custo' },
  cadastro_custos: { titulo: 'Cadastro Mestre de Custos', sub: 'O preço de cada material pela compra: fornecedor, apresentação, valor pago e frete, com vigência, documento e o histórico das versões' },
  estruturais: { titulo: 'Capacidade Produtiva', sub: 'Capacidades biológica, física e de produção por sala' },
  metas_operacionais: { titulo: 'Metas e Limiares', sub: 'Os parâmetros que decidem cor e alerta da operação: a meta é linha de referência, não o corte que pinta' },
  compras_mensal: { titulo: 'Pedido de Compras', sub: 'Consumíveis: inventário mensal e quantidade a comprar' },
  compras_mp: { titulo: 'Compras de Matéria-Prima', sub: 'Previsão de produção por semana × estoque disponível' },
  pimentao: { titulo: 'Indicadores Pimentão', sub: 'Registro diário, consolidado, financeiro e faturamento por plantio' },
  revenda: { titulo: 'Painel da Revenda', sub: FUNCAO_DA_TELA.painel_revenda },
  producao: { titulo: 'Painel da Produção', sub: FUNCAO_DA_TELA.painel_producao },
  desempenho: { titulo: 'Desempenho por Produto', sub: 'Receita, quantidade, preço médio e participação: produto × mês' },
  dre: { titulo: 'DRE & Resultado', sub: 'Demonstrativo gerencial com rateios transparentes' },
  dre2026: { titulo: 'DRE Gerencial', sub: 'Planilha gerencial 2026: Consolidado, Produção e Revenda' },
  dre_nova: { titulo: 'DRE Gerencial', sub: FUNCAO_DA_TELA.dre_gerencial },
  classificacao: { titulo: 'Classificação de Contas', sub: 'Grupo e Fixo/Variável por conta: a DRE recalcula' },
  indicadores: { titulo: 'Calculadoras', sub: 'Simuladores de indicadores' },
  equilibrio: { titulo: 'Ponto de Equilíbrio', sub: 'Quanto vender para empatar' },
  auditoria: { titulo: 'Auditoria', sub: 'Lançamentos manuais e correções (gestor)' },
  seguranca: { titulo: 'Segurança da conta', sub: 'Autenticador de dois fatores: cadastro opcional, sem exigência' },
};

const VIEWS_COM_PERIODO: ViewId[] = [
  'overview', 'historico', 'gestao_resultado', 'producao', 'revenda', 'dre', 'equilibrio', 'auditoria', 'caixa', 'ponte', 'caixa_executivo',
];

const PAGINAS: Record<ViewId, () => JSX.Element> = {
  overview: Dashboard,
  historico: Historico,
  gestao_resultado: GestaoDoResultado,
  budget: Budget,
  budget_projecoes: BudgetProjecoes,
  painel_de_comando: PainelDeComando,
  painel_operacional: PainelOperacional,
  jornada: JornadaCogumelo,
  proximas_aberturas: ProximasAberturas,
  mapa_estantes: MapaDasEstantes,
  embalagem: Embalagem,
  contaminados: Contaminados,
  painel_contaminados: PainelContaminados,
  investigador_contaminacao: InvestigadorContaminacao,
  indicadores_ciclo: IndicadoresCiclo,
  qualidade_dados: QualidadeDosDados,
  sementes: Sementes,
  receitas_substrato: CadastroReceitas,
  prazo_por_especie: PrazoPorEspecie,
  cadastro_mestre: CadastroMestre,
  cadastro_custos: CadastroDeCustos,
  estruturais: IndicadoresEstruturais,
  metas_operacionais: MetasOperacionais,
  compras_mensal: ComprasMensal,
  compras_mp: ComprasMateriaPrima,
  pimentao: Pimentao,
  revenda: PainelRevenda,
  producao: PainelProducao,
  desempenho: Desempenho,
  dre: Dre,
  dre2026: DreGerencial,
  dre_nova: DreNova,
  classificacao: Classificacao,
  indicadores: Indicadores,
  equilibrio: Equilibrio,
  auditoria: Auditoria,
  caixa: ResultadoDeCaixa,
  ponte: Ponte,
  caixa_executivo: CaixaExecutivo,
  seguranca: Seguranca,
};

function AppInterno() {
  const { usuario, carregando, sair } = useAuth();
  const itensVisiveis = useMemo(() => viewsDoPerfil(usuario?.role ?? null), [usuario]);
  const [view, setView] = useState<ViewId>('overview');
  const [modoAbas, setModoAbas] = useState(true);
  const [ancora, setAncora] = useState<string | null>(null);
  const navegar = useCallback((destino: ViewId, anc?: string | null) => {
    setView(destino);
    setAncora(normalizarAncora(anc));
  }, []);

  const { ano: anoHoje, mes: mesHoje } = anoMesHoje();
  const [mesIdx, setMesIdx] = useState(anoHoje * 12 + (mesHoje - 1));
  const [prontoPeriodo, setProntoPeriodo] = useState(true);
  const [recente, setRecente] = useState<{ ano: number; mes: number } | null>(null);
  const [recenteErro, setRecenteErro] = useState<string | null>(null);
  const [mesesDisponiveis, setMesesDisponiveis] = useState<string[]>([]);

  useEffect(() => {
    if (!usuario) return;
    setView(viewInicial(usuario.role));
    setRecenteErro(null);
    getPeriodoRecente()
      .then((p) => {
        if (p.ano && p.mes) {
          setMesIdx(p.ano * 12 + (p.mes - 1));
          setRecente({ ano: p.ano, mes: p.mes });
        }
        setMesesDisponiveis(p.meses ?? []);
      })
      .catch((e) => setRecenteErro(e?.response?.data?.erro ?? e.message))
      .finally(() => setProntoPeriodo(true));
  }, [usuario]);

  useEffect(() => {
    if (!ancora) return undefined;
    return esperarElemento(() => {
      const alvo = document.getElementById(ancora);
      if (!alvo) return false;
      alvo.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return true;
    }, { limiteTentativas: 100 });
  }, [view, ancora]);

  const [versaoNova, setVersaoNova] = useState(false);
  useEffect(() => {
    let vivo = true;
    const conferir = () => getHealth()
      .then((h) => { if (vivo && precisaAtualizar(__VERSAO__, h.versao)) setVersaoNova(true); })
      .catch(() => { });
    conferir();
    const timer = setInterval(conferir, 5 * 60 * 1000);
    return () => { vivo = false; clearInterval(timer); };
  }, [view]);

  const periodo = useMemo(
    () => periodoDoMes(Math.floor(mesIdx / 12), mesIdx % 12),
    [mesIdx],
  );
  const ctx = useMemo(() => ({
    periodo,
    avancarMes: () => setMesIdx((m) => m + 1),
    recente,
    recenteErro,
    mesesDisponiveis,
  }), [periodo, recente, recenteErro, mesesDisponiveis]);

  if (carregando) return <div className="login-wrap"><div className="loading">Carregando…</div></div>;
  if (!usuario) return <Login />;

  const viewAtual: ViewId = itensVisiveis.includes(view) ? view : (itensVisiveis[0] ?? 'overview');
  const Pagina = PAGINAS[viewAtual];
  const t = TITULOS[viewAtual];

  return (
    <PeriodoCtx.Provider value={ctx}>
      <NavProvider value={navegar}>
        <div className="app">
          <Sidebar
            view={viewAtual}
            onNavigate={navegar}
            itensVisiveis={itensVisiveis}
            usuario={usuario}
            onLogout={sair}
            modoAbas={modoAbas}
          />
          <main className="main">
            {versaoNova && (
              <div className="aviso-versao" role="status">
                <span>Tem uma versão nova do sistema.</span>
                <button type="button" className="chip" onClick={() => window.location.reload()}>Clique aqui para atualizar</button>
              </div>
            )}
            {modoAbas && <AbasDoGrupo view={viewAtual} onNavigate={navegar} itensVisiveis={itensVisiveis} />}
            <div className="topbar">
              <div>
                <h1>{t.titulo}</h1>
                <div className="sub">{t.sub}</div>
              </div>
              {VIEWS_COM_PERIODO.includes(viewAtual) && (
                <>
                  <button className="chip" title="Mês anterior" onClick={() => setMesIdx((m) => m - 1)}>‹</button>
                  {mesesDisponiveis.length > 0 ? (
                    <select className="chip" aria-label="Mês" value={mesIdx}
                      onChange={(e) => setMesIdx(Number(e.target.value))}>
                      {opcoesDeMes(mesesDisponiveis, mesIdx).map((o) => (
                        <option key={o.idx} value={o.idx}>{o.rotulo}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="chip">{periodo.rotulo}</span>
                  )}
                  <button className="chip" title="Próximo mês" onClick={() => setMesIdx((m) => m + 1)}>›</button>
                </>
              )}
              {(
                <button type="button" className="chip" onClick={() => setModoAbas((m) => !m)}>
                  {modoAbas ? 'Ver menu antigo' : 'Ver menu com abas'}
                </button>
              )}
              <span className="badge-demo" title={'Números ilustrativos para avaliação da interface'}>
                {'Demonstração · dados de exemplo'}
              </span>
            </div>
            {prontoPeriodo ? <Pagina /> : <div className="loading">Carregando período…</div>}
          </main>
        </div>
      </NavProvider>
    </PeriodoCtx.Provider>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <ConfirmarProvider>
        <AuthProvider>
          <AppInterno />
        </AuthProvider>
      </ConfirmarProvider>
    </ToastProvider>
  );
}
