import { useState } from 'react';
import { dataBr, num, rotuloDoGalpao } from '../api/client';
import type { PainelCicloRegra, PainelOperacionalDivergencias } from '../api/client';
import type { ViewId } from '../auth';
import { usePainelOperacional } from '../components/BlocosOperacionais';
import { Kpi, Panel, Pill, esperarElemento, useNav } from '../components/ui';
import { abrirJornadaEm } from './JornadaCogumelo';
import { TabelaDivergencias, nomesDasSalas, type NomesDosGalpoes } from './PainelOperacional';

export const SUBDIVISOES = [
  { titulo: 'Divergências de Quantidade', regras: ['QUANTIDADE_INCOMPATIVEL'] },
  { titulo: 'Pendências de Preenchimento', regras: ['ABERTURA_SEM_QUANTIDADE'] },
  { titulo: 'Inconsistências de Datas', regras: [
    'ABERTURA_ANTES_DO_LOTE', 'COLHEITA_ANTES_DA_ABERTURA', 'CONTAMINACAO_ANTES_DO_LOTE',
    'DATA_FUTURA', 'DATA_POSSIVELMENTE_INVERTIDA'] },
] as const satisfies ReadonlyArray<{ titulo: string; regras: readonly string[] }>;

export function subdivisaoDaRegra(id: string): string {
  return SUBDIVISOES.find((s) => (s.regras as readonly string[]).includes(id))?.titulo ?? 'Outras';
}

export const abrirRegra = (abertas: string[], id: string) => (abertas.includes(id) ? abertas : [...abertas, id]);
export const alternarRegra = (abertas: string[], id: string) =>
  (abertas.includes(id) ? abertas.filter((x) => x !== id) : [...abertas, id]);

export function irParaJornada(
  dataLote: string, navegar: (destino: ViewId) => void, armazenamento?: Pick<Storage, 'setItem'>,
): void {
  abrirJornadaEm(dataLote, armazenamento);
  navegar('jornada');
}

const galpoes = (g: string | null, nomes: NomesDosGalpoes) =>
  (g != null ? g.split(', ').map((c) => rotuloDoGalpao(c, nomes)).join(', ') : '—');

function BotaoAbrir({ dataLote, onAbrir }: { dataLote: string; onAbrir: (d: string) => void }) {
  return <button type="button" className="btn ghost" onClick={() => onAbrir(dataLote)}>Abrir na Jornada</button>;
}

function ListaDaRegra({ regra, nomes, onAbrir }: { regra: PainelCicloRegra; nomes: NomesDosGalpoes; onAbrir: (d: string) => void }) {
  if (regra.id === 'QUANTIDADE_INCOMPATIVEL') {
    return (
      <div className="plan-wrap">
        <table className="plan">
          <thead>
            <tr>
              <th className="rotulo">Lote</th><th>Tipo</th><th>Galpão</th><th className="num">Estantes</th>
              <th className="num">Produzidos</th><th className="num">Contaminados</th>
              <th className="num">Abertos</th><th className="num">Sobra</th><th></th>
            </tr>
          </thead>
          <tbody>
            {regra.ocorrencias.map((o, i) => (
              <tr key={`${o.chave ?? o.data_lote}-${i}`}>
                <td className="rotulo">{dataBr(o.data_lote)}</td><td>{o.tipo ?? '—'}</td>
                <td>{galpoes(o.galpao, nomes)}</td><td className="num">{num(o.estantes)}</td>
                <td className="num">{num(o.blocos_produzidos)}</td><td className="num">{num(o.blocos_contaminados)}</td>
                <td className="num">{num(o.blocos_abertos)}</td><td className="num">{num(o.sobra)}</td>
                <td><BotaoAbrir dataLote={o.data_lote} onAbrir={onAbrir} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  return (
    <div className="plan-wrap">
      <table className="plan">
        <thead>
          <tr>
            <th className="rotulo">Lote</th><th>Tipo</th><th>Galpão</th>
            <th>Estante</th><th>Campo</th><th>Valor</th><th>Deveria</th><th></th>
          </tr>
        </thead>
        <tbody>
          {regra.ocorrencias.map((o, i) => (
            <tr key={`${o.chave ?? o.data_lote}-${i}`}>
              <td className="rotulo">{dataBr(o.data_lote)}</td><td>{o.tipo ?? '—'}</td>
              <td>{galpoes(o.galpao, nomes)}</td>
              <td>{o.estante ?? (o.estantes ? `${o.estantes} estantes` : '—')}</td>
              <td>{o.campo ?? '—'}</td>
              <td>{o.valor == null ? 'em branco' : dataBr(o.valor)}</td>
              <td>
                {o.valor_invertido ? <b>{dataBr(o.valor_invertido)}</b>
                  : regra.id === 'ABERTURA_SEM_QUANTIDADE' ? 'nº de blocos abertos'
                    : !o.referencia ? '—'
                      : regra.id === 'DATA_FUTURA' ? `≤ ${dataBr(o.referencia)}` : `≥ ${dataBr(o.referencia)}`}
              </td>
              <td><BotaoAbrir dataLote={o.data_lote} onAbrir={onAbrir} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BlocoDaRegra({ regra, aberta, nomes, onAlternar, onAbrir }: {
  regra: PainelCicloRegra; aberta: boolean; nomes: NomesDosGalpoes;
  onAlternar: (id: string) => void; onAbrir: (d: string) => void;
}) {
  const tem = regra.total > 0 && regra.ocorrencias.length > 0;
  return (
    <div id={`regra-${regra.id}`} className="regra-qualidade">
      <p>
        <b>{regra.titulo}</b>{' '}
        <Pill tone={regra.total === 0 ? 'ok' : regra.nivel === 'BLOQUEIO' ? 'bad' : 'warn'}>
          {regra.nivel === 'BLOQUEIO' ? 'bloqueio' : 'alerta'}
        </Pill>{' '}
        {regra.total > 0 ? `${num(regra.total)} ${regra.unidade}${regra.total === 1 ? '' : 's'} ` : 'Nenhuma ocorrência'}
        {tem && (
          <button type="button" className="btn ghost" onClick={() => onAlternar(regra.id)}>
            {aberta ? 'Ocultar' : 'Mostrar a lista'}
          </button>
        )}
      </p>
      {tem && aberta && <ListaDaRegra regra={regra} nomes={nomes} onAbrir={onAbrir} />}
    </div>
  );
}

export function ConteudoQualidade({ divergencias, erro, nomes, abertas, onAlternar, onVerOnde, onAbrir }: {
  divergencias: PainelOperacionalDivergencias | null; erro: string; nomes: NomesDosGalpoes;
  abertas: string[]; onAlternar: (id: string) => void; onVerOnde: (id: string) => void;
  onAbrir: (dataLote: string) => void;
}) {
  if (erro) return <div className="empty">Erro: {erro}</div>;
  if (!divergencias) return <div className="loading">Carregando…</div>;

  const lotes = divergencias.lotes ?? [];
  const regras = divergencias.regras ?? [];
  const soma = (nivel: 'BLOQUEIO' | 'ALERTA') =>
    regras.filter((r) => r.nivel === nivel).reduce((s, r) => s + r.total, 0);
  const bloqueios = soma('BLOQUEIO');
  const alertas = soma('ALERTA');
  const grupos = [...SUBDIVISOES.map((s) => s.titulo), 'Outras']
    .map((titulo) => ({ titulo, regras: regras.filter((r) => subdivisaoDaRegra(r.id) === titulo) }))
    .filter((g) => g.regras.length > 0);

  return (
    <>
      <Panel id="qualidade-topo" title="Resumo"
        sub={`Retrato de ${dataBr(divergencias.hoje)}. Lotes ainda não encerrados cuja conta de blocos passa de ±${divergencias.tolerancia}.`}>
        <div className="kpi-grid k3">
          <Kpi label="Lotes fora de ±10 blocos" value={num(lotes.length)} tone={lotes.length > 0 ? 'warn' : 'good'} />
          <Kpi label="Bloqueios" value={num(bloqueios)} tone={bloqueios > 0 ? 'alert' : 'good'} />
          <Kpi label="Alertas" value={num(alertas)} tone={alertas > 0 ? 'warn' : 'good'} />
        </div>

        {lotes.length === 0
          ? <div className="obs-tela">Nenhum lote fora de ±10 blocos.</div>
          : <TabelaDivergencias lotes={lotes} nomes={nomes} onAbrir={onAbrir} />}

        <h4>Ocorrências por regra</h4>
        <div className="plan-wrap">
          <table className="plan">
            <thead>
              <tr><th className="rotulo">Subdivisão</th><th className="rotulo">Regra</th><th>Nível</th><th className="num">Ocorrências</th><th></th></tr>
            </thead>
            <tbody>
              {regras.map((r) => (
                <tr key={r.id}>
                  <td className="rotulo">{subdivisaoDaRegra(r.id)}</td>
                  <td className="rotulo">{r.titulo}</td>
                  <td>{r.nivel === 'BLOQUEIO' ? 'bloqueio' : 'alerta'}</td>
                  <td className="num">{num(r.total)}</td>
                  <td>
                    {r.total > 0 && r.ocorrencias.length > 0 && (
                      <button type="button" className="btn ghost" onClick={() => onVerOnde(r.id)}>Ver onde</button>
                    )}
                  </td>
                </tr>
              ))}
              <tr className="ln-destaque"><td className="rotulo" colSpan={2}>Total de bloqueios</td><td></td><td className="num">{num(bloqueios)}</td><td></td></tr>
              <tr className="ln-destaque"><td className="rotulo" colSpan={2}>Total de alertas</td><td></td><td className="num">{num(alertas)}</td><td></td></tr>
            </tbody>
          </table>
        </div>
        <div className="obs-tela">
          <b>Bloqueio</b> é o que não deveria conseguir entrar no sistema; <b>alerta</b> pede
          conferência. As regras de <b>data</b> valem por estante, que é onde a célula está;
          a de <b>quantidade</b> vale por lote: por linha ela acusaria casos a mais, porque
          a planilha registra os blocos na primeira estante e os abertos em cada uma.
        </div>
        {(regras.find((r) => r.id === 'DATA_POSSIVELMENTE_INVERTIDA')?.total ?? 0) > 0 && (
          <div className="obs-tela">
            A possível inversão de dia e mês reexamina as datas das outras regras de data: o mesmo
            registro pode aparecer nas duas e entrar duas vezes na soma. A coluna "Deveria" dessa
            regra mostra a data com dia e mês trocados.
          </div>
        )}
      </Panel>

      {grupos.map((g) => (
        <Panel key={g.titulo} title={g.titulo}>
          {g.regras.map((r) => (
            <BlocoDaRegra key={r.id} regra={r} aberta={abertas.includes(r.id)} nomes={nomes}
              onAlternar={onAlternar} onAbrir={onAbrir} />
          ))}
        </Panel>
      ))}
    </>
  );
}

function rolarAteElemento(id: string) {
  esperarElemento(() => {
    const alvo = document.getElementById(id);
    if (!alvo) return false;
    alvo.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return true;
  });
}

export function acoesDaPagina({ navegar, setAbertas, rolarPara, armazenamento }: {
  navegar: (destino: ViewId) => void;
  setAbertas: (f: (abertas: string[]) => string[]) => void;
  rolarPara: (id: string) => void;
  armazenamento?: Pick<Storage, 'setItem'>;
}) {
  return {
    onAlternar: (id: string) => setAbertas((a) => alternarRegra(a, id)),
    onVerOnde: (id: string) => { setAbertas((a) => abrirRegra(a, id)); rolarPara(`regra-${id}`); },
    onAbrir: (dataLote: string) => irParaJornada(dataLote, navegar, armazenamento),
  };
}

export function QualidadeDosDados() {
  const { dados, erro } = usePainelOperacional();
  const navegar = useNav();
  const [abertas, setAbertas] = useState<string[]>([]);
  return (
    <ConteudoQualidade
      divergencias={dados?.divergencias ?? null} erro={erro}
      nomes={nomesDasSalas(dados?.capacidade?.salas ?? [])}
      abertas={abertas}
      {...acoesDaPagina({ navegar, setAbertas, rolarPara: rolarAteElemento })}
    />
  );
}
