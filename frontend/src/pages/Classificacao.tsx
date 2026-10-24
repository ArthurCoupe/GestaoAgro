import { useEffect, useState } from 'react';
import {
  anoMesHoje, atualizarCategoriaGerencial, getCategoriasGerenciais, getDreContas, putDreConta,
  type CategoriaGerencial, type CategoriaGerencialPatch, type Comportamento, type DreConta,
  type DreContasResposta,
} from '../api/client';
import { useAuth } from '../auth';
import { Panel, Pill, useToast } from '../components/ui';

export const GRUPOS_DRE = ['CUSTO_VARIAVEL', 'CUSTO_FIXO', 'DESPESA_OPERACIONAL', 'OUTROS'] as const;

export const aplicarCategoriaSalva = (lista: CategoriaGerencial[], salva: CategoriaGerencial) =>
  lista.map((c) => (c.id === salva.id ? salva : c));

export const categoriasVisiveis = (lista: CategoriaGerencial[]) => lista.filter((c) => c.ativo !== false);

type ContaPatch = {
  comportamento?: Comportamento | null;
  categoria1?: string; categoria2?: string; categoria3?: string;
};

function SelectGrupo({ valor, opcoes, disabled, onChange }: {
  valor: string | null; opcoes: string[]; disabled?: boolean; onChange: (v: string) => void;
}) {
  const lista = valor && !opcoes.includes(valor) ? [valor, ...opcoes] : opcoes;
  return (
    <select className="cls-select" value={valor ?? ''} disabled={disabled}
      onChange={(e) => onChange(e.target.value)}>
      {(valor == null || valor === '') && <option value="">—</option>}
      {lista.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

export function Classificacao() {
  const { usuario } = useAuth();
  const role = usuario?.role ?? null;
  const gestor = role == null || role === 'GESTAO_GERAL';

  const toast = useToast();
  const [ano, setAno] = useState(anoMesHoje().ano);
  const [dados, setDados] = useState<DreContasResposta | null>(null);
  const [erro, setErro] = useState('');
  const [salvandoId, setSalvandoId] = useState<number | null>(null);
  const [categorias, setCategorias] = useState<CategoriaGerencial[] | null>(null);
  const [erroCategorias, setErroCategorias] = useState('');
  const [salvandoCategoriaId, setSalvandoCategoriaId] = useState<number | null>(null);

  useEffect(() => {
    if (!gestor) return;
    setErro(''); setDados(null);
    getDreContas(ano)
      .then(setDados)
      .catch((e) => setErro(e?.response?.data?.erro ?? e.message));
  }, [gestor, ano]);

  useEffect(() => {
    if (!gestor) return;
    setErroCategorias('');
    getCategoriasGerenciais()
      .then(setCategorias)
      .catch((e) => setErroCategorias(e?.response?.data?.erro ?? e.message));
  }, [gestor]);

  const salvar = (id: number, patch: ContaPatch) => {
    setSalvandoId(id);
    putDreConta(id, patch)
      .then((conta) => {
        setDados((prev) => prev && {
          ...prev,
          contas: prev.contas.map((c) => (c.id === id ? { ...c, ...conta } : c)),
        });
        toast('Conta salva: a tela DRE Gerencial (planilha) recalcula com a nova regra.');
      })
      .catch((e) => toast(e?.response?.data?.erro ?? e.message, true))
      .finally(() => setSalvandoId(null));
  };

  const salvarCategoria = (id: number, patch: CategoriaGerencialPatch) => {
    setSalvandoCategoriaId(id);
    atualizarCategoriaGerencial(id, patch)
      .then((salva) => {
        setCategorias((prev) => prev && aplicarCategoriaSalva(prev, salva));
        toast('Categoria salva: Painel da Revenda, DRE & Resultado, Histórico Mensal e Ponto de Equilíbrio recalculam. Os cards da Visão Executiva (Competência) não mudam: a classificação deles é o De-Para do Gerencial novo.');
      })
      .catch((e) => toast(e?.response?.data?.erro ?? e.message, true))
      .finally(() => setSalvandoCategoriaId(null));
  };

  if (!gestor) return <div className="empty">Acesso exclusivo da Gestão Geral.</div>;

  const badge = (c: DreConta) => {
    if (c.comportamento === 'FIXO') return <Pill tone="neutral">FIXO</Pill>;
    if (c.comportamento === 'VARIAVEL') return <Pill tone="warn">VARIÁVEL</Pill>;
    return <span className="fixvar-none">—</span>;
  };

  const painelCategorias = (
    <Panel title="Categorias gerenciais" tag="Painel da Revenda, DRE & Resultado, Histórico Mensal e Ponto de Equilíbrio"
      sub="Grupo na DRE, Fixo/Variável e se a categoria é operacional (a que não é fica fora das contas da tela Ponto de Equilíbrio). Cada alteração é salva na hora">
      {erroCategorias && <div className="empty">Não foi possível carregar as categorias ({erroCategorias}).</div>}
      {!erroCategorias && !categorias && <div className="loading">Carregando categorias…</div>}
      {categorias && (
        <div className="cls-tbl-wrap">
          <table className="tbl cls-tbl">
            <thead>
              <tr>
                <th>Categoria</th>
                <th>Grupo na DRE</th>
                <th>Fixo/Variável</th>
                <th>Operacional</th>
              </tr>
            </thead>
            <tbody>
              {categoriasVisiveis(categorias).map((c) => {
                const salvando = salvandoCategoriaId === c.id;
                return (
                  <tr key={c.id}>
                    <td>
                      <div className="cls-desc">{c.nome}</div>
                      <div className="cls-cod">{c.codigo}</div>
                    </td>
                    <td><SelectGrupo valor={c.grupo_dre} opcoes={[...GRUPOS_DRE]} disabled={salvando}
                      onChange={(v) => salvarCategoria(c.id, { grupo_dre: v })} /></td>
                    <td>
                      <select className="cls-select" value={c.comportamento} disabled={salvando}
                        onChange={(e) => salvarCategoria(c.id, { comportamento: e.target.value as Comportamento })}>
                        <option value="FIXO">FIXO</option>
                        <option value="VARIAVEL">VARIÁVEL</option>
                      </select>
                    </td>
                    <td>
                      <label style={{ fontSize: 12 }}>
                        <input type="checkbox" checked={c.eh_operacional} disabled={salvando}
                          onChange={(e) => salvarCategoria(c.id, { eh_operacional: e.target.checked })} />{' '}
                        {c.eh_operacional ? 'entra no Ponto de Equilíbrio' : 'fora (financeira/CAPEX/retirada)'}
                      </label>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );

  const explicacao = (
    <Panel title="Como funciona" sub="Duas tabelas, dois motores: cada uma alimenta telas diferentes">
      <p style={{ fontSize: 12.5, color: 'var(--ink-soft)', lineHeight: 1.6 }}>
        A primeira tabela (<b>Contas da planilha</b>) define o grupo (categorias 1/2/3) e o
        comportamento <Pill tone="neutral">FIXO</Pill> / <Pill tone="warn">VARIÁVEL</Pill> de cada conta
        importada, e alimenta só a tela <b>DRE Gerencial (planilha)</b>. As edições são preservadas
        nas próximas importações.
        {' '}A segunda (<b>Categorias gerenciais</b>) define o grupo na DRE, o Fixo/Variável e se a categoria
        é operacional (a que não é fica fora das contas da tela Ponto de Equilíbrio), e
        alimenta o <b>Painel da Revenda</b>, a <b>DRE & Resultado</b>, o{' '}
        <b>Histórico Mensal</b> e o <b>Ponto de Equilíbrio</b>. Para mudar Custos, Despesas, Margem de
        Contribuição e Ponto de Equilíbrio desses painéis, edite a segunda tabela.
        {' '}Os cards da <b>Visão Executiva (Competência)</b> não recalculam: a classificação deles é
        o De-Para do Gerencial novo (a mesma da <b>DRE Gerencial</b>). Só os alertas no topo
        dela leem a segunda tabela.
      </p>
    </Panel>
  );

  if (erro) {
    return (
      <div className="plan-stack">
        {explicacao}
        <Panel title="Contas da planilha" sub="Recurso em preparação">
          <div className="empty">
            Não foi possível carregar as contas ({erro}).
          </div>
        </Panel>
        {painelCategorias}
      </div>
    );
  }
  if (!dados) return <div className="loading">Carregando contas…</div>;

  const { contas, opcoes } = dados;
  const fixos = contas.filter((c) => c.comportamento === 'FIXO').length;
  const variaveis = contas.filter((c) => c.comportamento === 'VARIAVEL').length;
  const editadas = contas.filter((c) => c.comportamento_manual || c.grupo_manual).length;

  return (
    <div className="plan-stack">
      {explicacao}

      <div className="kpi-grid k3">
        <div className="kpi"><div className="lab">Contas</div><div className="val">{contas.length}</div></div>
        <div className="kpi good"><div className="lab">Variáveis / Fixas</div>
          <div className="val">{variaveis}<small> var</small> · {fixos}<small> fix</small></div></div>
        <div className="kpi info"><div className="lab">Ajustadas manualmente</div><div className="val">{editadas}</div></div>
      </div>

      <Panel title="Contas da planilha" tag="só a tela DRE Gerencial (planilha)"
        sub="Edite o grupo e o Fixo/Variável de cada conta importada. Cada alteração é salva na hora">
        <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
          <button className="btn ghost" style={{ padding: '2px 8px' }} onClick={() => setAno(ano - 1)} aria-label="Ano anterior">‹</button>
          <b>{ano}</b>
          <button className="btn ghost" style={{ padding: '2px 8px' }} onClick={() => setAno(ano + 1)} aria-label="Próximo ano">›</button>
        </div>
        <div className="cls-tbl-wrap">
          <table className="tbl cls-tbl">
            <thead>
              <tr>
                <th>Conta</th>
                <th>Grupo (1)</th>
                <th>Subgrupo (2)</th>
                <th>Detalhe (3)</th>
                <th>Fixo/Variável</th>
                <th>Atual</th>
              </tr>
            </thead>
            <tbody>
              {contas.map((c) => {
                const salvando = salvandoId === c.id;
                const editada = c.comportamento_manual || c.grupo_manual;
                return (
                  <tr key={c.id} className={editada ? 'warn-row' : ''}>
                    <td>
                      <div className="cls-desc">{c.descricao}</div>
                      <div className="cls-cod">{c.conta}</div>
                    </td>
                    <td><SelectGrupo valor={c.categoria1} opcoes={opcoes.categoria1} disabled={salvando}
                      onChange={(v) => salvar(c.id, { categoria1: v })} /></td>
                    <td><SelectGrupo valor={c.categoria2} opcoes={opcoes.categoria2} disabled={salvando}
                      onChange={(v) => salvar(c.id, { categoria2: v })} /></td>
                    <td><SelectGrupo valor={c.categoria3} opcoes={opcoes.categoria3} disabled={salvando}
                      onChange={(v) => salvar(c.id, { categoria3: v })} /></td>
                    <td>
                      <select className="cls-select" value={c.comportamento ?? ''} disabled={salvando}
                        onChange={(e) => salvar(c.id, { comportamento: e.target.value === '' ? null : e.target.value as Comportamento })}>
                        <option value="">—</option>
                        <option value="FIXO">FIXO</option>
                        <option value="VARIAVEL">VARIÁVEL</option>
                      </select>
                    </td>
                    <td>{salvando ? <span className="fixvar-none">…</span> : badge(c)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      {painelCategorias}
    </div>
  );
}
