import { useEffect, useMemo, useState } from 'react';
import {
  anoMesHoje, fmMoeda, fmPctFrac as fmPct, getDreGerencial, getDreSplit, putDreSplit,
  type DreGerencialBloco, type DreGerencialLinha, type DreGerencialResposta,
  type DreGerencialVisao, type DreSplitMes,
} from '../api/client';
import { MESES_ANO } from '../api/constantes';
import { useAuth } from '../auth';
import { BotaoExportar } from '../components/BotaoExportar';
import { Panel, Pill, useToast } from '../components/ui';

const ABAS: Array<{ v: DreGerencialVisao; rotulo: string }> = [
  { v: 'consolidado', rotulo: 'Consolidado' },
  { v: 'producao', rotulo: 'Produção' },
  { v: 'revenda', rotulo: 'Revenda' },
];

function abasDoRole(role: string | null): DreGerencialVisao[] {
  if (role?.startsWith('PRODUCAO')) return ['producao'];
  if (role === 'REVENDA') return ['revenda'];
  return ['consolidado', 'producao', 'revenda'];
}

const celula = (l: DreGerencialLinha, v: number | null | undefined) =>
  v == null ? '' : l.tipo === 'pct' ? fmPct(v) : fmMoeda(v);

function BadgeFixoVar({ l }: { l: DreGerencialLinha }) {
  const comp = l.comportamento ?? l.comportamento_resumo ?? null;
  if (comp === 'FIXO') return <Pill tone="neutral">FIXO</Pill>;
  if (comp === 'VARIAVEL') return <Pill tone="warn">VARIÁVEL</Pill>;
  if (comp === 'MISTO') return <Pill tone="info">MISTO</Pill>;
  return <span className="fixvar-none">—</span>;
}

function linhasVisiveis(bloco: DreGerencialBloco, recolhidos: Set<string>): DreGerencialLinha[] {
  const out: DreGerencialLinha[] = [];
  let nivelOculto: number | null = null;
  for (const l of bloco.linhas) {
    if (nivelOculto != null) {
      if (l.nivel > nivelOculto) continue;
      nivelOculto = null;
    }
    out.push(l);
    if (l.grupo && recolhidos.has(l.id)) nivelOculto = l.nivel;
  }
  return out;
}

function TabelaBloco({ bloco, meses, mesesAtivos, recolhidos, onToggle, mostrarComportamento }: {
  bloco: DreGerencialBloco;
  meses: string[];
  mesesAtivos: Set<string>;
  recolhidos: Set<string>;
  onToggle: (id: string) => void;
  mostrarComportamento?: boolean;
}) {
  const linhas = linhasVisiveis(bloco, recolhidos);
  return (
    <div className="plan-wrap">
      <table className="plan">
        <thead>
          <tr>
            <th className="rotulo">{bloco.titulo ?? ''}</th>
            {meses.map((m) => (
              <th key={m} className={`num ${mesesAtivos.has(m) ? '' : 'dim'}`}>{m}</th>
            ))}
            <th className="num total">TOTAL</th>
            {mostrarComportamento && <th className="fixvar" title="Classificação gerencial Fixo/Variável">Fixo/Var</th>}
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => {
            const cls = [
              l.grupo ? 'ln-grupo' : '',
              l.destaque ? 'ln-destaque' : '',
              l.tipo === 'pct' ? 'ln-pct' : '',
            ].filter(Boolean).join(' ');
            return (
              <tr key={l.id} className={cls}>
                <td className="rotulo" style={{ paddingLeft: 10 + l.nivel * 16 }}>
                  {l.grupo ? (
                    <button className="gr-toggle" onClick={() => onToggle(l.id)}
                      title={recolhidos.has(l.id) ? 'Expandir' : 'Recolher'}>
                      <span className="gr-caret">{recolhidos.has(l.id) ? '▸' : '▾'}</span>{l.label}
                    </button>
                  ) : l.label}
                </td>
                {meses.map((m) => {
                  const v = l.valores[m];
                  const neg = v != null && v < 0 ? 'neg' : '';
                  return (
                    <td key={m} className={`num ${mesesAtivos.has(m) ? '' : 'dim'} ${neg}`}>
                      {celula(l, v)}
                    </td>
                  );
                })}
                <td className={`num total ${l.total != null && l.total < 0 ? 'neg' : ''}`}>
                  {celula(l, l.total)}
                </td>
                {mostrarComportamento && (
                  <td className="fixvar">{l.tipo === 'pct' ? '' : <BadgeFixoVar l={l} />}</td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      {mostrarComportamento && (
        <div className="fixvar-legenda">
          <Pill tone="warn">VARIÁVEL</Pill> varia com o volume (matéria-prima, embalagens, fretes, impostos s/ venda) ·{' '}
          <Pill tone="neutral">FIXO</Pill> independe do volume (pessoal, estrutura, financeira) ·{' '}
          <Pill tone="info">MISTO</Pill> grupo com contas dos dois tipos ·{' '}
          <span className="fixvar-none">—</span> não entra no resultado Fixo/Variável (receita, patrimônio, retiradas, aporte).
        </div>
      )}
    </div>
  );
}

function EditorSplit({ ano, aoSalvar }: { ano: number; aoSalvar: () => void }) {
  const toast = useToast();
  type Valores = { cogumelo: string; pimentao: string; revenda: string };
  const [itens, setItens] = useState<Record<number, Valores> | null>(null);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState<number | null>(null);

  useEffect(() => {
    getDreSplit(ano)
      .then((rows: DreSplitMes[]) => {
        const mapa: Record<number, Valores> = {};
        for (const r of rows) {
          mapa[r.mes] = { cogumelo: String(r.cogumelo), pimentao: String(r.pimentao), revenda: String(r.revenda) };
        }
        setErro('');
        setItens(mapa);
      })
      .catch((e) => setErro(e?.response?.data?.erro ?? e.message ?? 'Falha ao ler a divisão.'));
  }, [ano]);

  if (erro) {
    return (
      <div className="empty">
        Não consegui ler a divisão da receita: {erro}
        <br />Recarregue a página. Não edite agora, para não gravar por cima do que já existe.
      </div>
    );
  }
  if (!itens) return <div className="loading">Carregando divisão…</div>;

  const editar = (mes: number, campo: keyof Valores, valor: string) =>
    setItens((prev) => ({
      ...prev,
      [mes]: { cogumelo: '', pimentao: '', revenda: '', ...prev?.[mes], [campo]: valor },
    }));

  const numeroDe = (s: string | undefined) => {
    const t = String(s ?? '').trim();
    if (t === '') return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  };
  const completo = (mes: number) => {
    const v = itens[mes];
    return numeroDe(v?.cogumelo) !== null && numeroDe(v?.pimentao) !== null && numeroDe(v?.revenda) !== null;
  };

  const salvar = (mes: number) => {
    const v = itens[mes];
    const cogumelo = numeroDe(v?.cogumelo);
    const pimentao = numeroDe(v?.pimentao);
    const revenda = numeroDe(v?.revenda);
    if (cogumelo === null || pimentao === null || revenda === null) {
      toast('Preencha os três: cogumelo, pimentão e revenda. '
        + 'Campo em branco não vale zero: se um deles não teve receita no mês, digite 0.', true);
      return;
    }
    setSalvando(mes);
    putDreSplit({ ano, mes, cogumelo, pimentao, revenda })
      .then(() => { toast(`Divisão de ${MESES_ANO[mes - 1]} salva.`); aoSalvar(); })
      .catch((e) => toast(e?.response?.data?.erro ?? e.message, true))
      .finally(() => setSalvando(null));
  };

  return (
    <div className="tbl-scroll" style={{ maxHeight: 320 }}>
      <table className="tbl">
        <thead>
          <tr>
            <th>Mês</th><th className="num">Cogumelo</th><th className="num">Pimentão</th>
            <th className="num">Revenda</th><th />
          </tr>
        </thead>
        <tbody>
          {MESES_ANO.map((rotulo, i) => {
            const mes = i + 1;
            const v = itens[mes];
            return (
              <tr key={mes}>
                <td><b>{rotulo}</b></td>
                {(['cogumelo', 'pimentao', 'revenda'] as const).map((campo) => (
                  <td key={campo} className="num">
                    <input className="split-input" type="number" step="0.01" placeholder="—"
                      value={v?.[campo] ?? ''}
                      onChange={(e) => editar(mes, campo, e.target.value)} />
                  </td>
                ))}
                <td className="num">
                  <button className="btn ghost split-btn"
                    disabled={salvando === mes || v == null || !completo(mes)}
                    title={completo(mes) ? '' : 'Preencha cogumelo, pimentão e revenda. Em branco não vale zero.'}
                    onClick={() => salvar(mes)}>
                    {salvando === mes ? '…' : 'Salvar'}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function DreGerencial() {
  const { usuario } = useAuth();
  const role = usuario?.role ?? null;
  const abas = useMemo(() => abasDoRole(role), [role]);
  const gestor = role == null || role === 'GESTAO_GERAL';

  const [ano, setAno] = useState(anoMesHoje().ano);
  const [visao, setVisao] = useState<DreGerencialVisao>(abas[0]);
  const [dados, setDados] = useState<DreGerencialResposta | null>(null);
  const [erro, setErro] = useState('');
  const [recolhidos, setRecolhidos] = useState<Set<string>>(new Set());
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    if (!abas.includes(visao)) setVisao(abas[0]);
  }, [abas, visao]);

  useEffect(() => {
    let vivo = true;
    setErro(''); setDados(null);
    getDreGerencial(ano, visao)
      .then((d) => {
        if (!vivo) return;
        setDados(d);
        const iniciais = new Set<string>();
        for (const b of d.blocos) {
          for (const l of b.linhas) {
            if (l.grupo && l.nivel >= 2) iniciais.add(l.id);
          }
        }
        setRecolhidos(iniciais);
      })
      .catch((e) => { if (vivo) setErro(e?.response?.data?.erro ?? e.message); });
    return () => { vivo = false; };
  }, [ano, visao, versao]);

  const alternar = (id: string) =>
    setRecolhidos((prev) => {
      const prox = new Set(prev);
      if (prox.has(id)) prox.delete(id);
      else prox.add(id);
      return prox;
    });

  const mesesAtivos = useMemo(() => new Set(dados?.mesesComDados ?? []), [dados]);

  return (
    <>
      <div className="tabs">
        {ABAS.filter((a) => abas.includes(a.v)).map((a) => (
          <button key={a.v} className={`tab ${visao === a.v ? 'active' : ''}`}
            onClick={() => setVisao(a.v)}>{a.rotulo}</button>
        ))}
        <span className="tabs-acao">
          <button className="chip" title="Ano anterior" onClick={() => setAno((a) => a - 1)}>‹</button>
          <span className="chip">{ano}</span>
          <button className="chip" title="Próximo ano" onClick={() => setAno((a) => a + 1)}>›</button>
          {gestor && (
            <BotaoExportar
              rotulo="Exportar as 3 visões" />
          )}
          <BotaoExportar />
        </span>
      </div>

      {erro && <div className="empty">Erro: {erro}</div>}
      {!erro && !dados && <div className="loading">Calculando DRE Gerencial…</div>}

      {dados && (
        <div className="plan-stack">
          {dados.blocos.map((b) => (
            <Panel key={b.id} title={b.titulo ?? 'Divisão da Receita'} tag={String(dados.ano)}>
              <TabelaBloco bloco={b} meses={dados.meses} mesesAtivos={mesesAtivos}
                recolhidos={recolhidos} onToggle={alternar}
                mostrarComportamento={b.id === 'demonstrativo'} />
            </Panel>
          ))}

          {dados.observacoes.length > 0 && (
            <Panel title="Observações" sub="Regras e avisos do cálculo (transparência da planilha)">
              <ul style={{ fontSize: 12, color: 'var(--ink-soft)', paddingLeft: 18 }}>
                {dados.observacoes.map((o, i) => <li key={i}>{o}</li>)}
              </ul>
            </Panel>
          )}

          {gestor && (
            <Panel title="Divisão da Receita por Mês (split)"
              sub="Valores de Cogumelo, Pimentão e Revenda usados nos rateios, preencha os meses pendentes (ex.: JUN)">
              <EditorSplit key={`${ano}-${versao}`} ano={ano} aoSalvar={() => setVersao((v) => v + 1)} />
            </Panel>
          )}
        </div>
      )}
    </>
  );
}
