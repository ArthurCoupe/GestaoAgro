import { brlK } from '../api/client';
import type { ExecutivoAtividade } from '../api/gerencial';
import { rotuloDoMesCurto } from './EvolucaoMensal';
import { Panel } from './ui';

export interface LinhaPorMes {
  mes: string;
  rotulo: string;
  semFato: boolean;
  valores: (number | null)[];
  soma: number | null;
}

export function linhasPorMes(atividades: ExecutivoAtividade[], mesesSemFato: string[]): LinhaPorMes[] {
  const meses = atividades[0]?.serie_mensal?.map((m) => m.mes) ?? [];
  const semFato = new Set(mesesSemFato);
  return meses.map((mes) => {
    const valores = atividades.map((a) => a.serie_mensal?.find((m) => m.mes === mes)?.resultado ?? null);
    const apurado = !semFato.has(mes);
    return {
      mes,
      rotulo: rotuloDoMesCurto(mes),
      semFato: !apurado,
      valores,
      soma: apurado ? Math.round(valores.reduce<number>((s, v) => s + (v ?? 0), 0) * 100) / 100 : null,
    };
  });
}

export function EvolucaoPorAtividade({ atividades, mesesSemFato, etiqueta, titulo, id, pergunta, sub = 'Resultado operacional de cada negócio em cada mês; a última coluna soma os negócios mostrados' }: {
  atividades: ExecutivoAtividade[]; mesesSemFato: string[]; etiqueta: string; titulo: string; id?: string;
  pergunta?: string; sub?: string;
}) {
  const linhas = linhasPorMes(atividades, mesesSemFato);
  return (
    <Panel title={titulo} tag={etiqueta} id={id} pergunta={pergunta} sub={sub}>
      {linhas.length === 0 ? (
        <div className="empty">Nenhum negócio com movimento no período.</div>
      ) : (
        <div className="tbl-scroll">
          <table className="tbl">
            <thead>
              <tr>
                <th>Mês</th>
                {atividades.map((a) => <th key={a.chave} className="num">{a.rotulo}</th>)}
                <th className="num">Σ</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.mes} className={(l.soma ?? 0) < 0 ? 'alert-row' : ''}>
                  <td><b>{l.rotulo}</b>{l.semFato ? <> <span className="neg">sem apuração</span></> : null}</td>
                  {l.valores.map((v, i) => <td key={atividades[i].chave} className="num">{v == null ? '—' : brlK(v)}</td>)}
                  <td className="num"><b>{l.soma == null ? '—' : brlK(l.soma)}</b></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
