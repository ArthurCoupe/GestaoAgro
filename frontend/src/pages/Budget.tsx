import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fmMoeda, getBudgetGrade, getBudgetVersoes, mudarStatusBudget,
  type AcaoBudget, type BudgetGrade, type BudgetMargem, type BudgetVersao, type StatusBudget,
} from '../api/client';
import { FUSO_EMPRESA } from '../api/constantes';
import { useAuth } from '../auth';
import { MetaDaEmpresa } from '../components/MetaDaEmpresa';
import { Panel, useConfirmar, useToast } from '../components/ui';

export const ROTULO_STATUS: Record<StatusBudget, string> = {
  RASCUNHO: 'Rascunho', EM_ANALISE: 'Em análise', APROVADO: 'Aprovado', SUBSTITUIDO: 'Substituído',
};
export const ROTULO_CENARIO: Record<BudgetVersao['cenario'], string> = { BASE: 'Base', META: 'Meta', DESEJAVEL: 'Desejável' };
const ROTULO_ACAO: Record<AcaoBudget, string> = { ENVIAR: 'Enviar para análise', APROVAR: 'Aprovar', VOLTAR: 'Voltar para rascunho' };
const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const ROTULO_ORIGEM: Record<string, string> = { RECONSTRUIDO: 'Reconstruídos', PLANEJADO: 'Planejados', MISTA: 'Com origem mista' };

const AVISO_VAZIO = 'Nenhuma versão de Budget importada ainda. A importação é feita pela equipe técnica a partir da aba '
  + 'BUDGET IDEAL x REAL da Planilha Mestre e entra como Rascunho.';
const NOTA_DA_GRADE = 'Budget por linha da DRE Gerencial, no Consolidado. Os totais saem da mesma regra da DRE Gerencial. '
  + 'Cada conta foi arredondada ao centavo na importação, por isso o Resultado Líquido pode ficar alguns centavos '
  + 'distante da linha 8 da aba. Não há edição nesta tela: um ajuste vira uma nova importação, como nova versão. '
  + 'Rascunho e Em análise não aparecem em nenhuma outra tela.';
const NOTA_DA_ORIGEM = 'Reconstruído é o mês que já tinha passado quando o Budget foi montado; planejado é o mês orçado antes de acontecer.';
const AVISO_DEFEITO = 'A grade desta versão não fecha com a estrutura atual da DRE Gerencial e não pode ser aprovada. '
  + 'Avise a equipe técnica.';

export const rotuloDoMes = (iso: string) => `${MESES[Number(iso.slice(5, 7)) - 1]}/${iso.slice(2, 4)}`;

export const rotuloDaSoma = (meses: string[]) =>
  (meses.length === 12 ? 'Ano' : `Soma de ${meses.length} ${meses.length === 1 ? 'mês' : 'meses'}`);

export const podeAprovar = (grade: BudgetGrade | null, versaoId: number) =>
  grade !== null && grade.versao.id === versaoId && grade.meses.length > 0 && grade.defeitos.length === 0;

export const acoesDoStatus = (s: StatusBudget): AcaoBudget[] =>
  s === 'RASCUNHO' ? ['ENVIAR'] : s === 'EM_ANALISE' ? ['APROVAR', 'VOLTAR'] : [];

function faixas(mesesDoAno: number[], exercicio: number) {
  const iso = (m: number) => `${exercicio}-${String(m).padStart(2, '0')}-01`;
  const saida: string[] = [];
  for (let i = 0; i < mesesDoAno.length; i += 1) {
    let j = i;
    while (j + 1 < mesesDoAno.length && mesesDoAno[j + 1] === mesesDoAno[j] + 1) j += 1;
    saida.push(i === j ? rotuloDoMes(iso(mesesDoAno[i])) : `${rotuloDoMes(iso(mesesDoAno[i]))} a ${rotuloDoMes(iso(mesesDoAno[j]))}`);
    i = j;
  }
  return saida.join(', ');
}

export function resumoDosMeses(g: Pick<BudgetGrade, 'meses' | 'origem_por_mes'>, exercicio: number): string {
  const doAno = g.meses.filter((m) => Number(m.slice(0, 4)) === exercicio);
  const frases = ['RECONSTRUIDO', 'PLANEJADO', 'MISTA'].flatMap((o) => {
    const ms = doAno.filter((m) => g.origem_por_mes[m] === o).map((m) => Number(m.slice(5, 7))).sort((a, b) => a - b);
    return ms.length ? [`${ROTULO_ORIGEM[o]}: ${faixas(ms, exercicio)}.`] : [];
  });
  const presentes = new Set(doAno.map((m) => Number(m.slice(5, 7))));
  const faltam = Array.from({ length: 12 }, (_, i) => i + 1).filter((m) => !presentes.has(m));
  if (faltam.length) frases.push(`Sem Budget nesta versão: ${faixas(faltam, exercicio)}.`);
  return frases.join(' ');
}

const centavos = (c: number | null) => (c === null ? '—' : fmMoeda(c / 100));
const neg = (c: number | null) => (c !== null && c < 0 ? 'neg' : '');
const pct = (v: number | null) => (v === null ? '—' : `${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`);
const quando = (ts: string | null) => (ts ? new Date(ts).toLocaleDateString('pt-BR', { timeZone: FUSO_EMPRESA }) : '—');

export function TabelaDoBudget({ grade }: { grade: BudgetGrade }) {
  return (
    <div className="plan-wrap">
      <table className="plan">
        <thead>
          <tr><th className="rotulo">Linha</th>{grade.meses.map((m) => <th key={m} className="num">{rotuloDoMes(m)}</th>)}<th className="num total">{rotuloDaSoma(grade.meses)}</th></tr>
        </thead>
        <tbody>
          {grade.linhas.map((l) => {
            const grupo = l.tipo === 'GRUPO' || l.tipo === 'SUBGRUPO';
            return (
              <tr key={l.linha_id} className={grupo ? 'ln-grupo' : ''} id={l.tipo === 'TOTAL' && l.total ? `dre-linha-${l.total}` : undefined}>
                <td className="rotulo" style={{ paddingLeft: 10 + (l.profundidade - 1) * 16 }}>{l.rotulo}</td>
                {grade.meses.map((m) => {
                  const c = l.por_mes[m] ?? null;
                  return <td key={m} className={`num ${neg(c)}`}>{centavos(c)}</td>;
                })}
                <td className={`num total ${neg(l.ano)}`}>{centavos(l.ano)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function TabelaDeMargens({ grade }: { grade: BudgetGrade }) {
  const linhas: Array<[string, BudgetMargem]> = [
    ['Margem operacional (Resultado Operacional ÷ Receita Líquida)', grade.margens.operacional],
    ['Margem como na aba (Resultado Líquido ÷ Receita Bruta)', grade.margens.da_aba],
  ];
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="tbl">
        <thead>
          <tr><th>Margem</th>{grade.meses.map((m) => <th key={m} className="num">{rotuloDoMes(m)}</th>)}<th className="num">{rotuloDaSoma(grade.meses)}</th></tr>
        </thead>
        <tbody>
          {linhas.map(([rotulo, mg]) => (
            <tr key={rotulo}>
              <td>{rotulo}</td>
              {grade.meses.map((m) => <td key={m} className="num">{pct(mg.por_mes[m] ?? null)}</td>)}
              <td className="num total">{pct(mg.ano)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const erroDaApi = (e: unknown) => {
  const x = e as { response?: { data?: { erro?: string } }; message?: string };
  return x?.response?.data?.erro ?? x?.message ?? 'Erro ao falar com o servidor.';
};

export function Budget() {
  const { usuario } = useAuth();
  const gestor = usuario?.role === 'GESTAO_GERAL';
  const toast = useToast();
  const confirmar = useConfirmar();
  const [versoes, setVersoes] = useState<BudgetVersao[] | null>(null);
  const [erro, setErro] = useState('');
  const [aberta, setAberta] = useState<number | null>(null);
  const [grade, setGrade] = useState<BudgetGrade | null>(null);
  const [erroGrade, setErroGrade] = useState('');
  const [salvando, setSalvando] = useState(false);
  const pedida = useRef<number | null>(null);

  const recarregar = useCallback(() => {
    setErro('');
    getBudgetVersoes()
      .then((vs) => {
        setVersoes(vs);
        setAberta((atual) => (atual != null && vs.some((v) => v.id === atual) ? atual : vs[0]?.id ?? null));
      })
      .catch((e) => setErro(erroDaApi(e)));
  }, []);

  const carregarGrade = useCallback((id: number) => {
    pedida.current = id;
    setErroGrade('');
    setGrade(null);
    getBudgetGrade(id)
      .then((g) => { if (pedida.current === id) setGrade(g); })
      .catch((e) => { if (pedida.current === id) setErroGrade(erroDaApi(e)); });
  }, []);

  useEffect(recarregar, [recarregar]);
  useEffect(() => { if (aberta != null) carregarGrade(aberta); }, [aberta, carregarGrade]);

  const meta = (
    <MetaDaEmpresa podeEditar={gestor}
      aprovados={versoes ? [...new Set(versoes.filter((v) => v.status === 'APROVADO').map((v) => v.exercicio))] : null} />
  );
  if (erro) return <>{meta}<div className="empty">Erro: {erro}</div></>;
  if (!versoes) return <>{meta}<div className="loading">Carregando o Budget…</div></>;
  if (versoes.length === 0) return <>{meta}<Panel title="Budget"><div className="empty">{AVISO_VAZIO}</div></Panel></>;

  const versao = versoes.find((v) => v.id === aberta) ?? null;

  const agir = async (v: BudgetVersao, acao: AcaoBudget) => {
    if (acao === 'APROVAR' && !(await confirmar(`Aprovar "${v.nome}"? Ela passa a ser a versão oficial do Budget de ${v.exercicio}. `
      + 'A versão aprovada antes, se houver, fica como Substituída.'))) return;
    setSalvando(true);
    try {
      const nova = await mudarStatusBudget(v.id, acao);
      toast(`"${nova.nome}" agora está ${ROTULO_STATUS[nova.status].toLowerCase()}.`);
    } catch (e) {
      toast(erroDaApi(e), true);
    } finally {
      setSalvando(false);
      recarregar();
    }
  };
  const aprovavel = versao ? podeAprovar(grade, versao.id) : false;

  return (
    <>
      {meta}
      <Panel title="Versões" tag={`${versoes.length} ${versoes.length === 1 ? 'versão' : 'versões'}`}>
        <table className="tbl">
          <thead>
            <tr><th>Exercício</th><th>Nome</th><th>Cenário</th><th>Status</th><th>Importada em</th><th>Arquivo</th><th>Aprovada por</th><th /></tr>
          </thead>
          <tbody>
            {versoes.map((v) => (
              <tr key={v.id}>
                <td>{v.exercicio}</td>
                <td>{v.nome}</td>
                <td>{ROTULO_CENARIO[v.cenario] ?? v.cenario}</td>
                <td>{ROTULO_STATUS[v.status] ?? v.status}</td>
                <td>{quando(v.criado_em)}</td>
                <td>{v.arquivo_nome}</td>
                <td>{v.aprovado_por_nome ? `${v.aprovado_por_nome} em ${quando(v.aprovado_em)}` : '—'}</td>
                <td>
                  {v.id === aberta ? 'Aberta abaixo' : <button type="button" className="btn ghost" onClick={() => setAberta(v.id)}>Abrir</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      {versao && (
        <Panel title={`${versao.nome} (${versao.exercicio})`} tag={ROTULO_STATUS[versao.status]} sub={NOTA_DA_GRADE}>
          {acoesDoStatus(versao.status).length > 0 && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
              {acoesDoStatus(versao.status).map((a) => (
                <button key={a} type="button" className={a === 'APROVAR' ? 'btn' : 'btn ghost'}
                  disabled={salvando || (a === 'APROVAR' && !aprovavel)}
                  onClick={() => { void agir(versao, a); }}>
                  {ROTULO_ACAO[a]}
                </button>
              ))}
              {versao.status === 'EM_ANALISE' && !aprovavel && !erroGrade && (!grade || grade.meses.length === 0) && (
                <span className="obs-tela">
                  {grade ? 'Esta versão não tem valores e não pode ser aprovada.' : 'Aprovar fica disponível depois que a grade abaixo carregar.'}
                </span>
              )}
            </div>
          )}
          {erroGrade && <div className="empty">Erro: {erroGrade}</div>}
          {!erroGrade && !grade && <div className="loading">Carregando a grade…</div>}
          {grade && grade.versao.id === versao.id && (
            <>
              <p className="obs-tela">{resumoDosMeses(grade, versao.exercicio)}</p>
              {grade.meses.some((m) => grade.origem_por_mes[m] !== 'PLANEJADO') && <p className="obs-tela">{NOTA_DA_ORIGEM}</p>}
              {grade.defeitos.length > 0 && <div className="alert-banner"><b>⚠ {AVISO_DEFEITO}</b></div>}
              <TabelaDoBudget grade={grade} />
              <h4 style={{ marginTop: 16 }}>Margens</h4>
              <TabelaDeMargens grade={grade} />
            </>
          )}
        </Panel>
      )}
    </>
  );
}
