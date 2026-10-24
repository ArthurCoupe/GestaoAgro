import { dataBr, num } from '../api/client';
import type { ConferenciaColheitaEmbalagem, ConferenciaLinha } from '../api/client';
import { Kpi, Panel, Pill } from '../components/ui';
import { rotuloDoPeriodo } from './EmbalagemResumo';

const kg3 = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const n1 = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const comSinal = (v: number) => (v > 0 ? `+${kg3(v)}` : v < 0 ? `−${kg3(Math.abs(v))}` : kg3(0));
const SITUACAO: Record<ConferenciaLinha['situacao'], { tone: 'ok' | 'warn' | 'bad'; texto: string }> = {
  FECHADA: { tone: 'ok', texto: 'fechou dentro de' },
  EM_ABERTO: { tone: 'warn', texto: 'ainda embalando' },
  DIVERGENTE: { tone: 'bad', texto: 'não fechou' },
};

export function linhasParaMostrar(c: ConferenciaColheitaEmbalagem, mostrarTodas: boolean, limite = 5): ConferenciaLinha[] {
  const divergentes = c.linhas
    .filter((l) => l.situacao === 'DIVERGENTE')
    .sort((a, b) => b.data_colheita.localeCompare(a.data_colheita) || a.tipo.localeCompare(b.tipo));
  return mostrarTodas ? divergentes : divergentes.slice(0, limite);
}

function Tabela({ linhas, tolerancia }: { linhas: ConferenciaLinha[]; tolerancia: string }) {
  return (
    <div className="tbl-scroll">
      <table className="tbl">
        <thead>
          <tr>
            <th>Data da colheita</th><th>Lote</th><th>Tipo</th>
            <th className="num">Kg colhidos</th><th className="num">Kg embalados</th><th className="num">Kg desprezados</th>
            <th className="num">Diferença</th><th>Situação</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={`${l.data_colheita}-${l.tipo}`} className={l.situacao === 'DIVERGENTE' ? 'alert-row' : ''}>
              <td><b>{dataBr(l.data_colheita)}</b></td>
              <td>{l.lotes.length ? l.lotes.map((d) => `lote de ${dataBr(d)}`).join(', ') : '—'}</td>
              <td>{l.nome_tipo} <small style={{ color: 'var(--ink-soft)' }}>{l.tipo}</small></td>
              <td className="num">{kg3(l.kg_colhidos)}</td>
              <td className="num">{kg3(l.kg_embalados)}</td>
              <td className="num">{kg3(l.kg_desprezados)}</td>
              <td className={`num ${l.diferenca !== 0 ? 'neg' : ''}`}><b>{comSinal(l.diferenca)}</b></td>
              <td><Pill tone={SITUACAO[l.situacao].tone}>{l.situacao === 'FECHADA' ? `${SITUACAO.FECHADA.texto} ${tolerancia} kg` : SITUACAO[l.situacao].texto}</Pill></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function EmbalagemDivergencias({ conferencia, mostrarTodas, onMostrarTodas, limite = 5, periodo, corte, onVerDesdeOCorte }: {
  conferencia: ConferenciaColheitaEmbalagem; mostrarTodas: boolean; onMostrarTodas: () => void; limite?: number;
  periodo: { inicio: string | null; fim: string | null }; corte: string; onVerDesdeOCorte: () => void;
}) {
  const c = conferencia;
  const visiveis = linhasParaMostrar(c, mostrarTodas, limite);
  const restantes = c.linhas.filter((l) => l.situacao !== 'DIVERGENTE');
  const plural = (n: number, um: string, varios: string) => `${num(n)} ${n === 1 ? um : varios}`;
  const tol = num(c.parametros.tolerancia_kg, 3);
  return (
    <Panel id="embalagem-divergencias" title="Divergências colheita × embalagem"
      tag={`${plural(c.divergentes, 'divergência', 'divergências')} · ${rotuloDoPeriodo(periodo)}`}
      sub={`Kg colhidos − kg embalados − kg desprezados, por data da colheita e tipo. O esperado é zero; até ${tol} kg de diferença conta como fechada. Colheita com menos de ${num(c.parametros.dias_para_fechar)} dias ainda está sendo embalada e aparece como em aberto, não como divergência. O card do Painel de Comando conta desde o corte da produção; esta lista segue o período escolhido em De e Até.`}>
      <div className="kpi-grid k3">
        <Kpi label="Colheitas com divergência" value={num(c.divergentes)} tone={c.divergentes > 0 ? 'alert' : 'good'}
          delta={`de ${plural(c.colheitas, 'colheita', 'colheitas')} no período`} />
        <Kpi label="Kg de diferença das divergências" value={`${n1(c.kg_diferenca_absoluta)} kg`} tone={c.divergentes > 0 ? 'alert' : 'good'}
          delta={`soma da coluna Diferença das ${plural(c.divergentes, 'divergência', 'divergências')}, sem o sinal`} />
        <Kpi label={`Fecharam dentro de ${tol} kg`} value={num(c.fechadas)} tone="good"
          delta={`${num(c.em_aberto)} ainda no prazo de embalar (${num(c.parametros.dias_para_fechar)} dias)`} />
      </div>
      {periodo.inicio !== corte && (
        <div className="form-acao">
          <button type="button" className="btn ghost" onClick={onVerDesdeOCorte}>Ver desde o corte da produção ({dataBr(corte)})</button>
        </div>
      )}
      {c.divergentes === 0 ? (
        <div className="empty">
          {c.colheitas === 0
            ? 'Nenhuma colheita no período.'
            : c.em_aberto > 0
              ? `Nenhuma divergência fechada no período: ${c.em_aberto} ${c.em_aberto === 1 ? 'colheita ainda está no prazo de embalar' : 'colheitas ainda estão no prazo de embalar'}.`
              : 'Nenhuma divergência no período: tudo que foi colhido foi embalado ou desprezado.'}
        </div>
      ) : (
        <>
          <Tabela linhas={visiveis} tolerancia={tol} />
          {!mostrarTodas && c.divergentes > limite && (
            <div className="form-acao">
              <button type="button" className="btn ghost" onClick={onMostrarTodas}>Ver todas as divergências ({num(c.divergentes)})</button>
            </div>
          )}
        </>
      )}
      {restantes.length > 0 && (
        <details style={{ marginTop: 10 }}>
          <summary>{`${num(c.fechadas)} ${c.fechadas === 1 ? 'fechou' : 'fecharam'} dentro de ${tol} kg · ${num(c.em_aberto)} ainda no prazo de embalar (${num(c.parametros.dias_para_fechar)} dias)`}</summary>
          <Tabela linhas={restantes} tolerancia={tol} />
        </details>
      )}
      <p className="obs-tela">
        Para corrigir: o kg colhido é na Jornada do Cogumelo (Editar colheita); as bandejas são na grade abaixo; o kg desprezado é em Registrar desprezo.
      </p>
    </Panel>
  );
}
