import { brl, dataBr, num } from '../api/client';
import type { VisaoNova } from '../api/dreNova';
import {
  ehVariedade, getLancamentosDoGrupo,
  type AtividadeChave, type ChaveDoGrupo, type LancamentoDoGrupo, type LancamentosDoGrupoResposta, type Regime,
} from '../api/gerencial';
import { periodoDoMes } from './ui';
import { NOTA_DO_VALOR_CHEIO } from './valorCheio';

export interface AlvoDaCelula {
  grupo: ChaveDoGrupo;
  rotuloLinha: string;
  coluna: string;
  rotuloPeriodo: string;
  inicio: string;
  fim: string;
  valorCelula: number;
}

export type EstadoDosLancamentos = LancamentosDoGrupoResposta | { erro: string } | 'carregando';

export interface AberturaDaCelula {
  chave: string;
  geracao: number;
  alvo: AlvoDaCelula;
  estado: EstadoDosLancamentos;
}

export const ATIVIDADES_DA_ROTA: readonly AtividadeChave[] = ['PRODUCAO_COGUMELO', 'PIMENTAO', 'PRODUCAO_SEM_QUEBRA', 'REVENDA', 'CORPORATIVO', 'NAO_RATEADO'];

export const FRASE_ESPECIE = 'Para abrir os lançamentos, escolha Cogumelo · todas as espécies.';

export function recorteDaChave(chave: string): { atividade: AtividadeChave | null } | 'especie' | null {
  if (chave === 'TOTAL') return { atividade: null };
  if (ehVariedade(chave)) return 'especie';
  const atividade = ATIVIDADES_DA_ROTA.find((a) => a === chave);
  return atividade ? { atividade } : null;
}

const doMes = (ym: string) => periodoDoMes(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1);

export function periodoDaColuna(mes: string): { inicio: string; fim: string } {
  const { inicio, fim } = doMes(mes);
  return { inicio, fim };
}

export function rotuloDoIntervalo(inicio: string, fim: string): string {
  const [de, ate] = [doMes(inicio.slice(0, 7)).rotulo, doMes(fim.slice(0, 7)).rotulo];
  return de === ate ? `em ${ate}` : `no acumulado de ${de} a ${ate}`;
}

export function pedidoDaCelula(alvo: AlvoDaCelula, { visao, atividade, regime }: { visao: VisaoNova; atividade: AtividadeChave | null; regime: Regime }): Parameters<typeof getLancamentosDoGrupo>[0] {
  return { inicio: alvo.inicio, fim: alvo.fim, visao, grupo: alvo.grupo, ...(atividade ? { atividade } : {}), regime };
}

export function mesmaCelula(a: AlvoDaCelula, b: AlvoDaCelula): boolean {
  return a.grupo === b.grupo && a.coluna === b.coluna;
}

export function aplicarLancamentos(atual: AberturaDaCelula | null, geracao: number, estado: LancamentosDoGrupoResposta | { erro: string }): AberturaDaCelula | null {
  if (atual == null || atual.geracao !== geracao || atual.estado !== 'carregando') return atual;
  return { ...atual, estado };
}

const centavos = (reais: number) => Math.round(reais * 100);
const dinheiro = (v: number | null) => (v == null ? '—' : brl(v));
const classeNum = (v: number | null) => `num${v != null && v < 0 ? ' neg' : ''}`;

function conta(l: LancamentoDoGrupo): string {
  const rotulo = l.linhas[0]?.rotulo;
  return rotulo ? `${l.codigo_conta ?? '—'} · ${rotulo}` : (l.codigo_conta ?? '—');
}

function TabelaDoGrupo({ r }: { r: LancamentosDoGrupoResposta }) {
  const caixa = r.regime === 'CAIXA';
  const data = (l: LancamentoDoGrupo) => dataBr(caixa ? l.data_liquidacao : l.data_competencia) || '—';
  const doisValores = r.lancamentos.some((l) => l.valor_lancamento != null && centavos(l.valor_lancamento) !== centavos(l.valor_no_periodo));
  return (
    <div className="tbl-scroll">
      <table className="tbl">
        <thead>
          <tr>
            <th>{caixa ? 'Pago/recebido em' : 'Data'}</th><th>Empresa</th><th>Conta</th><th>Documento</th><th>Histórico</th>
            {doisValores ? <><th className="num">Valor no lançamento</th><th className="num">Valor nesta visão</th></> : <th className="num">Valor</th>}
          </tr>
        </thead>
        <tbody>
          {r.lancamentos.map((l) => (
            <tr key={l.lancamento_id}>
              <td>{data(l)}</td>
              <td>{l.empresa ?? '—'}</td>
              <td title={l.codigo_conta_erp ? `No ERP: ${l.codigo_conta_erp}` : undefined}>{conta(l)}</td>
              <td>{l.documento ?? '—'}</td>
              <td>{l.historico ?? '—'}</td>
              {doisValores && <td className={classeNum(l.valor_lancamento)}>{dinheiro(l.valor_lancamento)}</td>}
              <td className={classeNum(l.valor_no_periodo)}>{dinheiro(l.valor_no_periodo)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function LancamentosDaCelula({ alvo, estado, onFechar }: { alvo: AlvoDaCelula; estado: EstadoDosLancamentos; onFechar?: () => void }) {
  const cabeca = `Lançamentos de ${alvo.rotuloLinha} ${alvo.rotuloPeriodo}`;
  const titulo = (texto: string) => (
    <p className="obs-tela lanc-titulo">
      <b>{texto}</b>{' '}<button type="button" className="btn ghost split-btn" onClick={onFechar}>Fechar</button>
    </p>
  );
  if (estado === 'carregando') return <div className="lanc-celula">{titulo(cabeca)}<div className="loading">Buscando os lançamentos…</div></div>;
  if ('erro' in estado) return <div className="lanc-celula">{titulo(cabeca)}<div className="empty">Lançamentos indisponíveis ({estado.erro}).</div></div>;
  const r = estado;
  const n = r.total_lancamentos;
  const quantos = n === 0 ? 'nenhum lançamento.' : `${num(n)} ${n === 1 ? 'lançamento' : 'lançamentos'}, soma ${brl(r.soma)}.`;
  const diferenca = centavos(r.soma) - centavos(alvo.valorCelula);
  return (
    <div className="lanc-celula">
      {titulo(`${cabeca}: ${quantos}`)}
      {diferenca !== 0 && (
        <p className="obs-tela">A soma não bate com o valor da tabela ({brl(alvo.valorCelula)}): diferença de {brl(diferenca / 100)}.</p>
      )}
      {r.lancamentos.length > 0 && <TabelaDoGrupo r={r} />}
      {n > r.mostrando && <p className="obs-tela">Mostrando os {num(r.mostrando)} maiores de {num(n)}; a soma é de todos.</p>}
      {r.valor_cheio_so_gestao && r.lancamentos.length > 0 && <p className="obs-tela">{NOTA_DO_VALOR_CHEIO}</p>}
    </div>
  );
}
