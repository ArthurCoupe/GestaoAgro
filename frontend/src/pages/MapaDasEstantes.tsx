import { useCallback, useEffect, useRef, useState } from 'react';
import {
  dataBr, getPrevisaoAbertura, getRegrasMaturacao, num, ordenarGalpoes, rotuloDoGalpao,
  type PrevisaoAberturaLinha, type PrevisaoAberturaResposta, type QuadroDasEstantes as Quadro, type RegraMaturacao,
} from '../api/client';
import { criarGuardaDeCorrida } from '../components/BlocosOperacionais';
import { Panel, Pill } from '../components/ui';
import { chaveDaEstante } from '../../../src/services/quadroDasEstantes.js';
import { fraseDaFila } from './PainelOperacional';
import {
  MOTIVO_FORA, ROTULO_TIPO, TIPOS, plural, unirGalpoes,
} from './ProximasAberturas';

const ROTULO_SITUACAO: Record<string, string> = {
  VENCIDO: 'Passou do prazo', PROXIMO: 'Chegando ao prazo', EM_PRAZO: 'Em prazo',
  SEM_PARAMETRO: 'Sem parâmetro', DATA_INCONSISTENTE: 'Data inconsistente',
};

interface LinhaParaMapa {
  estante_id: number;
  galpao: string | null;
  estante: string | null;
  lote_chave: string;
  data_lote: string;
  tipo: string | null;
  blocos_guardados: number | null;
  blocos_guardados_lote: number | null;
  blocos_contaminados: number;
  disponiveis: number | null;
  origem_quantidade: string;
  situacao: string;
  motivo_fora: PrevisaoAberturaLinha['motivo_fora'];
  saldo_negativo: boolean;
  blocos_abertos: number | null;
  blocos_perdidos: number;
}

export const paraLinhaDoMapa = (l: PrevisaoAberturaLinha): LinhaParaMapa => ({
  estante_id: l.estante_id,
  galpao: l.galpao, estante: l.estante, lote_chave: l.lote_chave, data_lote: l.data_lote, tipo: l.tipo,
  blocos_guardados: l.blocos_guardados, blocos_guardados_lote: l.blocos_guardados_lote,
  blocos_contaminados: l.blocos_contaminados,
  disponiveis: l.blocos_disponiveis, origem_quantidade: l.origem_quantidade, situacao: l.situacao,
  motivo_fora: l.motivo_fora, saldo_negativo: l.saldo_negativo,
  blocos_abertos: l.blocos_abertos,
  blocos_perdidos: l.blocos_perdidos ?? 0,
});

function valorGuardado(l: Pick<LinhaParaMapa, 'origem_quantidade' | 'blocos_guardados'>): number | null {
  if (l.origem_quantidade === 'ESTANTE') return l.blocos_guardados;
  return null;
}

export interface LoteNaEstante {
  estante_id: number; lote_chave: string; data_lote: string; tipo: string | null;
  blocos_guardados: number | null; blocos_guardados_lote: number | null;
  guardados: number | null; retirados: number | null; perdidos: number; abertos: number | null; disponiveis: number | null;
  origem: string; situacao: string; fora_da_fila: boolean;
  motivo_fora: PrevisaoAberturaLinha['motivo_fora']; saldo_negativo: boolean;
}
export interface EstanteAgrupada {
  estante: string; lotes: LoteNaEstante[];
  guardados: number | null; retirados: number | null; perdidos: number; abertos: number | null; disponiveis: number | null;
}
export interface GalpaoAgrupado { galpao: string; estantes: EstanteAgrupada[] }

const somaOuNull = (vals: Array<number | null>): number | null =>
  vals.some((v) => v == null) ? null : (vals as number[]).reduce((s, v) => s + v, 0);

const somaDosAbertos = (vals: Array<number | null>): number | null =>
  vals.every((v) => v == null) ? null : vals.reduce<number>((s, v) => s + (v ?? 0), 0);

const itensDaEstante = (etiqueta: string): string[] =>
  etiqueta.split(',').map((s) => s.trim()).filter((s) => s !== '');

function ordemEtiqueta(a: string, b: string): number {
  const na = Number(a); const nb = Number(b);
  const aNum = a.trim() !== '' && !Number.isNaN(na);
  const bNum = b.trim() !== '' && !Number.isNaN(nb);
  if (aNum && bNum) return na - nb;
  if (aNum !== bNum) return aNum ? -1 : 1;
  return a.localeCompare(b);
}

export function agruparPorEstante(
  linhas: LinhaParaMapa[], foraDaFila: LinhaParaMapa[],
): GalpaoAgrupado[] {
  const porGalpao = new Map<string, Map<string, LoteNaEstante[]>>();

  const empilhar = (l: LinhaParaMapa, foraFila: boolean) => {
    const galpao = l.galpao ?? '—';
    const estante = l.estante ?? '—';
    if (!porGalpao.has(galpao)) porGalpao.set(galpao, new Map());
    const porEstante = porGalpao.get(galpao) as Map<string, LoteNaEstante[]>;
    if (!porEstante.has(estante)) porEstante.set(estante, []);
    (porEstante.get(estante) as LoteNaEstante[]).push({
      estante_id: l.estante_id, lote_chave: l.lote_chave, data_lote: l.data_lote, tipo: l.tipo,
      blocos_guardados: l.blocos_guardados, blocos_guardados_lote: l.blocos_guardados_lote,
      guardados: valorGuardado(l), retirados: l.blocos_contaminados, perdidos: l.blocos_perdidos,
      abertos: l.blocos_abertos,
      disponiveis: l.disponiveis,
      origem: l.origem_quantidade, situacao: l.situacao, fora_da_fila: foraFila,
      motivo_fora: l.motivo_fora, saldo_negativo: l.saldo_negativo,
    });
  };
  linhas.forEach((l) => empilhar(l, false));
  foraDaFila.forEach((l) => empilhar(l, true));

  return [...porGalpao.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([galpao, porEstante]) => ({
      galpao,
      estantes: [...porEstante.entries()]
        .sort(([a], [b]) => ordemEtiqueta(a, b))
        .map(([estante, lotes]) => {
          const ordenados = [...lotes].sort((x, y) => x.data_lote.localeCompare(y.data_lote));
          return {
            estante, lotes: ordenados,
            guardados: somaOuNull(ordenados.map((l) => l.guardados)),
            retirados: somaOuNull(ordenados.map((l) => l.retirados)),
            perdidos: ordenados.reduce((t, l) => t + l.perdidos, 0),
            abertos: somaDosAbertos(ordenados.map((l) => l.abertos)),
            disponiveis: somaOuNull(ordenados.map((l) => l.disponiveis)),
          };
        }),
    }));
}

export function MapaDasEstantes() {
  const [dados, setDados] = useState<PrevisaoAberturaResposta | null>(null);
  const [erro, setErro] = useState('');
  const [tipo, setTipo] = useState('');
  const [galpao, setGalpao] = useState('');
  const [galpoes, setGalpoes] = useState<string[]>([]);

  const guarda = useRef(criarGuardaDeCorrida());
  const recarregar = useCallback(() => {
    const id = guarda.current.iniciar();
    setErro('');
    getPrevisaoAbertura({ tipo: tipo || undefined, galpao: galpao || undefined, quadro: '1' })
      .then((r) => {
        if (!guarda.current.vale(id)) return;
        setDados(r); setGalpoes((prev) => unirGalpoes(prev, [...r.linhas, ...r.fora_da_fila]));
      })
      .catch((e) => { if (guarda.current.vale(id)) setErro(e?.response?.data?.erro ?? e.message); });
  }, [tipo, galpao]);
  useEffect(recarregar, [recarregar]);

  const [regras, setRegras] = useState<RegraMaturacao[]>([]);
  useEffect(() => { getRegrasMaturacao().then(setRegras).catch(() => setRegras([])); }, []);

  if (erro) return <div className="empty">Erro: {erro}</div>;
  if (!dados) return <div className="loading">Montando o mapa das estantes…</div>;

  const agrupado = agruparPorEstante(dados.linhas.map(paraLinhaDoMapa), dados.fora_da_fila.map(paraLinhaDoMapa));

  return (
    <>
      <Panel title="Mapa das Estantes" sub={fraseDaFila(dados.hoje, dados.ultimos_lancamentos, tipo)}>
        <QuadroDoTopo quadro={dados.quadro} regras={regras} />
        <div className="filtros no-print">
          <div className="fg">
            <label htmlFor="mapa-estantes-tipo">Tipo de cogumelo</label>
            <select id="mapa-estantes-tipo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
              {TIPOS.map((t) => <option key={t.v} value={t.v}>{t.rotulo}</option>)}
            </select>
          </div>
          <div className="fg">
            <label htmlFor="mapa-estantes-galpao">Galpão</label>
            <select id="mapa-estantes-galpao" value={galpao} onChange={(e) => setGalpao(e.target.value)}>
              <option value="">Todos</option>
              {ordenarGalpoes(galpoes, regras).map((g) => <option key={g} value={g}>{rotuloDoGalpao(g, regras)}</option>)}
            </select>
          </div>
        </div>
      </Panel>

      {agrupado.length === 0 && <div className="empty">Nenhum endereço encontrado.</div>}

      {[...agrupado].sort((a, b) => rotuloDoGalpao(a.galpao, regras).localeCompare(rotuloDoGalpao(b.galpao, regras), 'pt-BR', { numeric: true })).map((g) => (
        <PainelDoGalpao key={g.galpao} g={g} regras={regras} />
      ))}
    </>
  );
}

const ordemDosGalpoes = (regras: RegraMaturacao[]) => (a: string, b: string) =>
  rotuloDoGalpao(a, regras).localeCompare(rotuloDoGalpao(b, regras), 'pt-BR', { numeric: true });

export function emFaixas(etiquetas: string[]): string {
  const partes: string[] = [];
  let corrida: number[] = [];
  const fechar = () => {
    if (corrida.length >= 3) partes.push(`${corrida[0]} a ${corrida[corrida.length - 1]}`);
    else partes.push(...corrida.map(String));
    corrida = [];
  };
  for (const e of etiquetas) {
    const n = /^(0|[1-9]\d*)$/.test(e) ? Number(e) : null;
    if (n != null && corrida.length > 0 && n === corrida[corrida.length - 1] + 1) { corrida.push(n); continue; }
    fechar();
    if (n != null) corrida.push(n); else partes.push(e);
  }
  fechar();
  return partes.join(', ');
}

export function vaziasComCapacidade(itens: Array<{ etiqueta: string; capacidade_blocos: number | null }>): string {
  const grupos = new Map<number | null, string[]>();
  for (const i of itens) grupos.set(i.capacidade_blocos, [...(grupos.get(i.capacidade_blocos) ?? []), i.etiqueta]);
  return [...grupos].map(([cap, etiquetas]) => {
    const quanto = cap == null ? 'sem capacidade cadastrada' : `${num(cap)} ${cap === 1 ? 'bloco' : 'blocos'}${etiquetas.length > 1 ? ' cada' : ''}`;
    return `${emFaixas(etiquetas)} (${quanto})`;
  }).join('; ');
}

export function QuadroDoTopo({ quadro, regras }: { quadro: Quadro | null | undefined; regras: RegraMaturacao[] }) {
  if (quadro === undefined) return null;
  if (quadro === null) {
    return <div className="obs-tela">O cadastro das estantes não carregou, e o quadro por galpão ficou de fora. As tabelas abaixo continuam valendo.</div>;
  }
  const galpoes = [...quadro.galpoes].sort((a, b) => ordemDosGalpoes(regras)(a.galpao_codigo, b.galpao_codigo));
  const observacoes: string[] = [];
  if (quadro.fora_do_cadastro.length > 0) {
    observacoes.push(`Com lote para abrir e fora do cadastro de estantes ativas, fora do quadro: ${quadro.fora_do_cadastro
      .map((f) => `${rotuloDoGalpao(f.galpao, regras)}/${f.estante}`).join(', ')}.`);
  }
  if (quadro.lotes_sem_estante > 0) {
    observacoes.push(`${plural(quadro.lotes_sem_estante, 'lote para abrir está', 'lotes para abrir estão')} sem galpão ou sem estante, fora do quadro.`);
  }
  const comCapacidade = quadro.totais.capacidade_vazia !== undefined;
  if (comCapacidade && quadro.galpoes.some((g) => g.capacidade_vazia == null)) {
    observacoes.push('Estante vazia sem capacidade no cadastro: a soma do galpão e o Total da capacidade ficam sem número.');
  }
  return (
    <>
      <div className="plan-wrap cp">
        <table className="plan cp">
          <thead>
            <tr>
              <th className="rotulo">Galpão</th><th className="num">Estantes</th>
              <th className="num">Ocupadas</th><th className="num">Vazias</th>
              {comCapacidade && <th className="num">Capacidade das vazias (blocos)</th>}
              <th className="txt">Estantes vazias</th>
            </tr>
          </thead>
          <tbody>
            {galpoes.map((g) => (
              <tr key={g.galpao_codigo}>
                <td className="rotulo">Galpão {rotuloDoGalpao(g.galpao_codigo, regras)}</td>
                <td className="num">{num(g.estantes)}</td>
                <td className="num">{num(g.ocupadas)}</td>
                <td className="num">{num(g.vazias)}</td>
                {comCapacidade && <td className="num">{g.capacidade_vazia == null ? '—' : num(g.capacidade_vazia)}</td>}
                <td className="txt lista-vazias">{(g.capacidade_das_vazias ? vaziasComCapacidade(g.capacidade_das_vazias) : emFaixas(g.etiquetas_vazias))
                  || (g.estantes > 0 ? 'nenhuma' : '—')}</td>
              </tr>
            ))}
            <tr>
              <td className="rotulo"><b>Total</b></td>
              <td className="num"><b>{num(quadro.totais.estantes)}</b></td>
              <td className="num"><b>{num(quadro.totais.ocupadas)}</b></td>
              <td className="num"><b>{num(quadro.totais.vazias)}</b></td>
              {comCapacidade && <td className="num"><b>{quadro.totais.capacidade_vazia == null ? '—' : num(quadro.totais.capacidade_vazia)}</b></td>}
              <td className="txt"></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="obs-tela">
        Ocupada: estante ativa do cadastro com lote para abrir. Vazia: as outras, inclusive a que aparece
        abaixo só com aviso (sem bloco para abrir, conta que não fecha ou lote encerrado sem contagem); a da
        conta que não fecha pede conferência. O quadro soma todos os tipos e galpões, não muda com os filtros
        abaixo e segue as tabelas desta tela. As estantes ocupadas e vazias da maturação no Capacidade livre
        do Painel Operacional saem deste mesmo quadro.{comCapacidade && ' A capacidade de cada vazia é a do cadastro das estantes, em blocos.'}
        {observacoes.length > 0 && <ul>{observacoes.map((o) => <li key={o}>{o}</li>)}</ul>}
      </div>
    </>
  );
}

export function PainelDoGalpao({ g, regras }: { g: GalpaoAgrupado; regras: RegraMaturacao[] }) {
  const totalLotes = new Set(g.estantes.flatMap((e) => e.lotes.map((l) => l.lote_chave))).size;
  const etiquetas = (es: EstanteAgrupada[]) => new Set(es.flatMap((e) => itensDaEstante(e.estante)).filter((e) => e !== '—').map(chaveDaEstante));
  const comLote = etiquetas(g.estantes.filter((e) => e.lotes.some((l) => !l.fora_da_fila)));
  const semBloco = [...etiquetas(g.estantes.filter((e) => e.lotes.every((l) => l.fora_da_fila)))].filter((e) => !comLote.has(e));
  const soNoLote = new Map<string, { data_lote: string; tipo: string | null; total: number | null; estantes: string[] }>();
  g.estantes.forEach((e) => e.lotes.forEach((l) => {
    if (l.origem !== 'LOTE') return;
    const item = soNoLote.get(l.lote_chave)
      ?? { data_lote: l.data_lote, tipo: l.tipo, total: l.blocos_guardados_lote, estantes: [] };
    if (!item.estantes.includes(e.estante)) item.estantes.push(e.estante);
    soNoLote.set(l.lote_chave, item);
  }));
  const lotesSoNoLote = [...soNoLote.values()].sort((a, b) => a.data_lote.localeCompare(b.data_lote));
  const comPerdas = g.estantes.some((e) => e.lotes.some((l) => l.perdidos > 0));
  return (
    <Panel title={`Galpão ${rotuloDoGalpao(g.galpao, regras)}`}>
      <div className="plan-wrap cp">
        <table className="plan cp">
          <thead>
            <tr>
              <th className="rotulo">Estante</th><th className="rotulo">Lote</th>
              <th className="num">Guardados</th><th className="num">Retirados</th>
              {comPerdas && <th className="num">Perdas</th>}
              <th className="num">Abertos</th>
              <th className="num">Disponíveis</th><th className="rotulo">Situação</th>
            </tr>
          </thead>
          <tbody>
            {g.estantes.flatMap((e) => {
              const itens = itensDaEstante(e.estante);
              const linhasLote = e.lotes.map((l) => (
                <tr key={l.estante_id}>
                  <td className="rotulo">
                    {e.estante}
                    {itens.length > 1 && (
                      <>
                        {' '}
                        <Pill tone="neutral">lista: a contagem é das {itens.length} estantes juntas</Pill>
                      </>
                    )}
                  </td>
                  <td className="rotulo">
                    {dataBr(l.data_lote)} · {ROTULO_TIPO[l.tipo ?? ''] ?? l.tipo ?? '—'}
                    {l.fora_da_fila && (
                      <>
                        {' '}
                        <Pill tone={l.motivo_fora === 'SALDO_NEGATIVO' ? 'bad' : 'neutral'}>
                          {MOTIVO_FORA[l.motivo_fora ?? 'ZERADO']}
                        </Pill>
                      </>
                    )}
                  </td>
                  <td className="num">
                    {l.origem === 'ESTANTE' ? num(l.blocos_guardados)
                      : l.origem === 'LOTE' ? 'só no lote'
                        : 'não informado'}
                  </td>
                  <td className="num">{num(l.retirados)}</td>
                  {comPerdas && <td className="num">{num(l.perdidos)}</td>}
                  <td className="num">{num(l.abertos)}</td>
                  <td className="num">{num(l.disponiveis)}{l.saldo_negativo && ' ⚠'}</td>
                  <td className="rotulo">{ROTULO_SITUACAO[l.situacao] ?? l.situacao}</td>
                </tr>
              ));
              if (e.lotes.length <= 1) return linhasLote;
              return [
                ...linhasLote,
                <tr key={`${e.estante}|soma`} className="ln-grupo">
                  <td className="rotulo">{e.estante}</td>
                  <td className="rotulo">Soma · {plural(e.lotes.length, 'lote', 'lotes')}</td>
                  <td className="num">{num(e.guardados)}</td>
                  <td className="num">{num(e.retirados)}</td>
                  {comPerdas && <td className="num">{num(e.perdidos)}</td>}
                  <td className="num">{num(e.abertos)}</td>
                  <td className="num">{num(e.disponiveis)}</td>
                  <td className="rotulo">—</td>
                </tr>,
              ];
            })}
          </tbody>
        </table>
      </div>
      <p className="nota">
        {plural(comLote.size, 'estante com lote para abrir', 'estantes com lote para abrir')}
        {semBloco.length > 0 && `, ${plural(semBloco.length, 'sem bloco para abrir', 'sem bloco para abrir')}`}, {plural(totalLotes, 'lote', 'lotes')}.
      </p>
      {lotesSoNoLote.length > 0 && (
        <p className="nota">
          <strong>Só no lote</strong> (registro até abril, a contagem é do lote e não da
          estante), fora das somas:{' '}
          {lotesSoNoLote.map((x) => {
            const est = x.estantes.filter((e) => e !== '—');
            return `${dataBr(x.data_lote)} · ${ROTULO_TIPO[x.tipo ?? ''] ?? x.tipo ?? '—'}, `
              + `${num(x.total)} blocos no lote inteiro, `
              + (est.length ? `sem contagem ${est.length === 1 ? 'na estante' : 'nas estantes'} ${est.join(', ')}` : 'sem estante registrada');
          }).join('; ')}.
        </p>
      )}
    </Panel>
  );
}
