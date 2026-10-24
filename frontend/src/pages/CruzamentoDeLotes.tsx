import { useEffect, useState } from 'react';
import {
  dataBr, getCruzamentoDeLotes, num, rotuloDoGalpao,
  type CoincidenciaDoCruzamento, type CruzamentoDeLotesResposta, type DimensaoDoCruzamento, type RegraMaturacao,
  type TempoNoCruzamento, type ValorDoCruzamento,
} from '../api/client';
import { ROTULO_TIPO } from '../components/BlocosOperacionais';
import { Pill } from '../components/ui';
import { contagemInconsistente } from './PainelContaminados';
import {
  Diferenca, diferencaDosMostrados, pct, pctDecimal, pctDoLote, Quadro, ROTULO_DA_COR, rotuloDaChaveDoLote, rotuloDoLote,
} from './investigadorComum';

export const AVISO_DA_COINCIDENCIA = 'Coincidência não é causa: mostra onde vale investigar.';
export const ROTULO_DE_EVENTOS_INDISPONIVEIS = 'Eventos e condições atípicas ainda não estão disponíveis neste ambiente.';

export function fraseDaCoincidencia(c: Pick<ValorDoCruzamento, 'selecionados' | 'base'>): string {
  const { selecionados: s, base: b } = c;
  return `${num(s.k)} de ${num(s.n)} ${s.n === 1 ? 'lote selecionado' : 'lotes selecionados'} (${pctDecimal(s.k, s.n)})`
    + ` · no período: ${num(b.k)} de ${num(b.n)} ${b.n === 1 ? 'lote' : 'lotes'} (${pctDecimal(b.k, b.n)})`;
}

export function paramsDoCruzamento(periodo: { inicio: string; fim: string }, chaves: string[]): Record<string, string> {
  return { inicio: periodo.inicio, fim: periodo.fim, lotes: chaves.join(',') };
}

export const rotuloDoValor = (dimensao: string, v: Pick<ValorDoCruzamento, 'valor' | 'rotulo'>) =>
  (dimensao === 'especie' ? ROTULO_TIPO[v.valor] ?? v.rotulo : v.rotulo);

function Coincidencias({ lista }: { lista: CoincidenciaDoCruzamento[] }) {
  return (
    <ul className="inv-lista-coincidencias">
      {lista.map((c) => (
        <li key={`${c.dimensao}|${c.valor}`}>
          <strong>{c.titulo}: {rotuloDoValor(c.dimensao, c)}</strong>
          <span className="inv-quando">
            {fraseDaCoincidencia(c)} · <Diferenca pp={diferencaDosMostrados(c.selecionados, c.base)} basePequena={c.base_pequena} mostrarValor />
          </span>
        </li>
      ))}
    </ul>
  );
}

function LinhasDaDimensao({ dim }: { dim: DimensaoDoCruzamento }) {
  return (
    <>
      <tr className="ln-grupo"><td colSpan={4} className="rotulo">{dim.titulo} <small>({dim.grupo})</small></td></tr>
      {!dim.disponivel && <tr><td colSpan={4} className="rotulo">{ROTULO_DE_EVENTOS_INDISPONIVEIS}</td></tr>}
      {dim.disponivel && dim.valores.length === 0 && !dim.sem_registro?.k && (
        <tr><td colSpan={4} className="rotulo">Nenhum valor registrado nos lotes selecionados.</td></tr>
      )}
      {dim.valores.map((v) => (
        <tr key={v.valor}>
          <td className="rotulo">{rotuloDoValor(dim.chave, v)}</td>
          <td className="num">{num(v.selecionados.k)} de {num(v.selecionados.n)}</td>
          <td className="num">{num(v.base.k)} de {num(v.base.n)}</td>
          <td className="num"><Diferenca pp={v.diferenca_pp} basePequena={v.base_pequena} mostrarValor /></td>
        </tr>
      ))}
      {dim.sem_registro && (
        <tr>
          <td className="rotulo">{dim.sem_registro.rotulo}</td>
          <td className="num">{num(dim.sem_registro.k)} de {num(dim.sem_registro.n)}</td>
          <td className="num">{num(dim.sem_registro.base.k)} de {num(dim.sem_registro.base.n)}</td>
          <td className="num">—</td>
        </tr>
      )}
    </>
  );
}

function TabelaPorDimensao({ dimensoes }: { dimensoes: DimensaoDoCruzamento[] }) {
  return (
    <details className="inv-dobravel">
      <summary>Tabela completa por dimensão</summary>
      <div className="plan-wrap cp">
        <table className="plan cp">
          <thead>
            <tr><th className="rotulo">Valor</th><th className="num">Selecionados</th><th className="num">No período</th><th className="num">Diferença</th></tr>
          </thead>
          <tbody>{dimensoes.map((d) => <LinhasDaDimensao key={d.chave} dim={d} />)}</tbody>
        </table>
      </div>
      <p className="inv-aviso">Pessoa e semente: o lote com mais de uma conta em cada uma, e a soma passa do número de lotes. &quot;Sem registro&quot; fica à parte e conta em lotes dos dois lados.</p>
    </details>
  );
}

const lotesSelecionados = (k: number, n: number) => `${num(k)} de ${num(n)} ${n === 1 ? 'lote selecionado' : 'lotes selecionados'}`;
const comMaiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const emLista = (itens: string[]) => new Intl.ListFormat('pt-BR', { type: 'conjunction' }).format(itens);

export function fraseDoTempo(t: TempoNoCruzamento): string {
  const n = t.empate.predominante.n;
  const empates = t.empate.predominante.k;
  const empatados = empates > 0 ? ` ${empates === 1 ? 'Um lote empatou' : `${num(empates)} lotes empataram`} entre faixas.` : '';
  const fora = t.sem_retirada.k > 0
    ? ` ${t.sem_retirada.k === 1 ? 'Um lote selecionado fica' : `${num(t.sem_retirada.k)} lotes selecionados ficam`} de fora, sem bloco contaminado nas faixas.`
    : '';
  if (n === 0) return 'Os lotes selecionados não têm bloco contaminado com data válida.';
  const maior = Math.max(0, ...t.faixas.map((f) => f.predominante.k));
  if (maior === 0) return `Os ${num(n)} ${n === 1 ? 'lote selecionado' : 'lotes selecionados'} com bloco contaminado ficaram empatados entre faixas.${fora}`;
  const topo = t.faixas.filter((f) => f.predominante.k === maior);
  const nomes = comMaiuscula(emLista(topo.map((f) => f.rotulo)));
  return topo.length === 1
    ? `${nomes} foi a faixa predominante em ${lotesSelecionados(maior, n)}.${empatados}${fora}`
    : `${nomes} foram as faixas predominantes em ${lotesSelecionados(maior, n)} cada.${empatados}${fora}`;
}

function TempoDosSelecionados({ tempo }: { tempo: TempoNoCruzamento }) {
  const n = tempo.empate.predominante.n;
  const nBase = tempo.empate.base.n;
  return (
    <>
      <h4>Tempo até a retirada</h4>
      <p className="inv-aviso">
        Dias entre a data do lote e a retirada do bloco contaminado. A faixa predominante de um lote é a que tem mais blocos contaminados nele.
        Faixa com muitos blocos e predominante em poucos lotes indica acumulado puxado por poucos lotes; predominante em muitos lotes indica padrão que se repete.
        O período inclui os lotes ainda em observação, que só podem ter retirada nas primeiras faixas.
      </p>
      <p className="inv-aviso"><strong>{fraseDoTempo(tempo)}</strong></p>
      {tempo.total_blocos > 0 && (
        <div className="plan-wrap cp">
          <table className="plan cp">
            <thead>
              <tr>
                <th className="rotulo">Tempo</th><th className="num">Blocos</th><th className="num">% dos blocos</th>
                <th className="num">Predominante nos selecionados</th><th className="num">No período</th><th className="num">Diferença</th>
              </tr>
            </thead>
            <tbody>
              {tempo.faixas.map((f) => (
                <tr key={f.valor}>
                  <td className="rotulo">{f.rotulo}</td><td className="num">{num(f.blocos)}</td><td className="num">{pct(f.pct_blocos)}</td>
                  <td className="num">{num(f.predominante.k)} de {num(f.predominante.n)}</td>
                  <td className="num">{num(f.base.k)} de {num(f.base.n)}</td>
                  <td className="num"><Diferenca pp={diferencaDosMostrados(f.predominante, f.base)} basePequena={f.base_pequena} mostrarValor /></td>
                </tr>
              ))}
              <tr>
                <td className="rotulo">Empate entre faixas</td><td className="num">—</td><td className="num">—</td>
                <td className="num">{num(tempo.empate.predominante.k)} de {num(n)}</td>
                <td className="num">{num(tempo.empate.base.k)} de {num(nBase)}</td><td className="num">—</td>
              </tr>
              {tempo.sem_data_valida.blocos > 0 && (
                <tr>
                  <td className="rotulo">Sem data válida</td><td className="num">{num(tempo.sem_data_valida.blocos)}</td>
                  <td className="num">{pct(tempo.sem_data_valida.pct_blocos)}</td><td className="num">—</td><td className="num">—</td><td className="num">—</td>
                </tr>
              )}
              <tr className="ln-destaque">
                <td className="rotulo">Total</td><td className="num">{num(tempo.total_blocos)}</td><td className="num">{pct(1)}</td>
                <td className="num">{num(n)} {n === 1 ? 'lote' : 'lotes'}</td><td className="num">{num(nBase)} {nBase === 1 ? 'lote' : 'lotes'}</td><td className="num">—</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
      {tempo.sem_retirada.k + tempo.sem_retirada.base.k > 0 && (
        <p className="inv-aviso">
          Fora da predominância, {tempo.sem_retirada.rotulo.toLowerCase()}: {lotesSelecionados(tempo.sem_retirada.k, tempo.sem_retirada.n)};
          no período, {num(tempo.sem_retirada.base.k)} de {num(tempo.sem_retirada.base.n)} {tempo.sem_retirada.base.n === 1 ? 'lote' : 'lotes'}.
          Retirada sem data, ou com data anterior à do lote, não entra em faixa.
        </p>
      )}
    </>
  );
}

function LoteALote({ dados, regras }: { dados: CruzamentoDeLotesResposta; regras: RegraMaturacao[] }) {
  const eventosDisponiveis = dados.dimensoes.find((d) => d.chave === 'eventos_atipicos')?.disponivel ?? false;
  const lista = (v: string[]) => (v.length ? v.join(', ') : '—');
  return (
    <details className="inv-dobravel">
      <summary>Lote a lote ({num(dados.lotes.length)})</summary>
      <div className="plan-wrap">
        <table className="plan">
          <thead>
            <tr>
              <th className="rotulo">Lote</th><th className="num">Produzidos</th><th className="num">Contaminados</th><th className="num">Taxa</th>
              <th className="rotulo">Faixa predominante</th><th className="rotulo">Galpão · estante</th><th className="rotulo">Semente</th><th className="rotulo">Pesagem</th>
              <th className="rotulo">Semeação</th><th className="rotulo">Conferência</th><th className="rotulo">Selagem</th>
              <th className="rotulo">Autoclave</th><th className="rotulo">Capela</th><th className="rotulo">Sinais da autoclave</th>
              <th className="rotulo">Cores</th><th className="rotulo">Eventos atípicos</th>
            </tr>
          </thead>
          <tbody>
            {dados.lotes.map((l) => (
              <tr key={l.chave}>
                <td className="rotulo">{rotuloDoLote(l)}{l.categoria === 'EM_MATURACAO' ? ` · em observação, ${l.dias} dias` : l.categoria === 'SEM_NUMERO' ? ' · sem número' : ''}</td>
                <td className="num">{num(l.blocos_produzidos)}</td>
                <td className="num">{num(l.blocos_contaminados)}</td>
                <td className="num">{l.categoria === 'MADURO' ? pctDoLote(l) : '—'}{l.categoria === 'MADURO' && contagemInconsistente(l.taxa) ? ' · a conferir' : ''}</td>
                <td className="rotulo">{l.faixa_predominante?.rotulo ?? '—'}</td>
                <td className="rotulo">{l.estantes.map((e) => `${rotuloDoGalpao(e.galpao, regras)} · ${e.estante}${e.estante_fisica ? ` (${e.estante_fisica})` : ''}`).join('; ') || '—'}</td>
                <td className="rotulo">{lista(l.sementes)}</td>
                <td className="rotulo">{lista(l.pessoas.pesagem)}</td>
                <td className="rotulo">{lista(l.pessoas.semeacao)}</td>
                <td className="rotulo">{lista(l.pessoas.conferencia)}</td>
                <td className="rotulo">{lista(l.pessoas.selagem)}</td>
                <td className="rotulo">{lista(l.pessoas.autoclave)}</td>
                <td className="rotulo">{l.capela_ligada == null ? '—' : l.capela_ligada ? 'Ligada' : 'Desligada'}</td>
                <td className="rotulo">{lista([...new Set(l.autoclave.flatMap((a) => a.sinais))])}</td>
                <td className="rotulo">{lista(Object.entries(l.cores).filter(([, b]) => b > 0).map(([c, b]) => `${ROTULO_DA_COR[c] ?? c}: ${num(b)}`))}</td>
                <td className="rotulo">{!eventosDisponiveis ? '—' : l.eventos_atipicos.length === 0 ? 'Nenhum' : lista([...new Set(l.eventos_atipicos.map((e) => e.rotulo))])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

export function ConteudoDoCruzamento({ dados, regras, onVoltar }: {
  dados: CruzamentoDeLotesResposta; regras: RegraMaturacao[]; onVoltar: () => void;
}) {
  const basePequena = dados.base_n < dados.base_minima;
  return (
    <Quadro
      titulo={`Cruzamento de ${num(dados.selecionados)} ${dados.selecionados === 1 ? 'lote' : 'lotes'}`}
      dica={`A base é todo lote produzido de ${dataBr(dados.inicio)} a ${dataBr(dados.fim)}, com ou sem contaminação e sem os filtros da tela. `
        + 'Cada valor mostra quantos dos lotes selecionados o têm e quantos lotes do período inteiro o têm; a diferença em pontos percentuais é entre as duas frações. '
        + `Base pequena: o valor aparece em menos de ${num(dados.base_minima)} lotes do período, e a diferença fica sem cor.`}
      extra={<button type="button" className="btn ghost" style={{ marginLeft: 'auto' }} onClick={onVoltar}>Voltar aos lotes</button>}
    >
      <p className="inv-aviso">{AVISO_DA_COINCIDENCIA}</p>
      <div className="inv-linha-discreta">
        Base: {num(dados.base_n)} {dados.base_n === 1 ? 'lote produzido' : 'lotes produzidos'} no período.
        {basePequena && <Pill tone="neutral">base pequena</Pill>}
      </div>
      {dados.nao_encontrados.length > 0 && (
        <p className="inv-aviso">
          {dados.nao_encontrados.length === 1 ? 'Um lote não foi encontrado no período' : `${num(dados.nao_encontrados.length)} lotes não foram encontrados no período`}
          {`: ${dados.nao_encontrados.map(rotuloDaChaveDoLote).join(', ')}.`}
        </p>
      )}
      <h4>Coincidências encontradas</h4>
      {dados.selecionados < 2 ? (
        <div className="empty">Selecione dois ou mais lotes para ver o que eles têm em comum.</div>
      ) : dados.coincidencias.length === 0 ? (
        <div className="empty">Nenhum valor se repete em dois ou mais dos lotes selecionados.</div>
      ) : <Coincidencias lista={dados.coincidencias} />}
      {dados.tempo && dados.selecionados > 0 && <TempoDosSelecionados tempo={dados.tempo} />}
      <TabelaPorDimensao dimensoes={dados.dimensoes} />
      <LoteALote dados={dados} regras={regras} />
    </Quadro>
  );
}

type Estado = { chave: string; dados: CruzamentoDeLotesResposta | null; erro: string };

export function CruzamentoDeLotes({ inicio, fim, chaves, regras, onVoltar }: {
  inicio: string; fim: string; chaves: string[]; regras: RegraMaturacao[]; onVoltar: () => void;
}) {
  const consulta = JSON.stringify(paramsDoCruzamento({ inicio, fim }, chaves));
  const [estado, setEstado] = useState<Estado>({ chave: '', dados: null, erro: '' });
  useEffect(() => {
    let vivo = true;
    getCruzamentoDeLotes(JSON.parse(consulta) as Record<string, string>)
      .then((r) => { if (vivo) setEstado({ chave: consulta, dados: r, erro: '' }); })
      .catch((e) => { if (vivo) setEstado({ chave: consulta, dados: null, erro: e?.response?.data?.erro ?? e.message }); });
    return () => { vivo = false; };
  }, [consulta]);

  if (estado.chave !== consulta) return <div className="loading">Cruzando os lotes…</div>;
  if (estado.erro || !estado.dados) {
    return (
      <Quadro titulo="Cruzamento de lotes" extra={<button type="button" className="btn ghost" style={{ marginLeft: 'auto' }} onClick={onVoltar}>Voltar aos lotes</button>}>
        <div className="empty">Erro: {estado.erro || 'sem resposta'}</div>
      </Quadro>
    );
  }
  return <ConteudoDoCruzamento dados={estado.dados} regras={regras} onVoltar={onVoltar} />;
}
