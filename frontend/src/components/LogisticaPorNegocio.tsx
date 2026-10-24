import { brl, num } from '../api/client';
import type { LogisticaDoNegocio, LogisticaDoPeriodo } from '../api/gerencial';
import { PERGUNTAS } from '../api/perguntasGerenciais';
import { rotuloDoPeriodo } from './EscadaDoAno';
import { Panel } from './ui';

const NOME_DA_EMPRESA = { AR: 'Aurora', EXEMPLO: 'Exemplo Alimentos' } as const;
const rotuloDoMes = (mes: string) => rotuloDoPeriodo({ inicio: `${mes}-01`, fim: `${mes}-01` });

function CelulasDoNegocio({ n }: { n: LogisticaDoNegocio }) {
  return <><td className="num">{brl(n.custo)}</td><td className="num">{num(n.unidades, 3)}</td><td className="num">{brl(n.custo_por_unidade)}</td></>;
}

export function LogisticaPorNegocio({ l, periodo, etiqueta }: { l: LogisticaDoPeriodo; periodo: { inicio: string; fim: string }; etiqueta: string }) {
  return (
    <Panel title={`Logística: Produção × Revenda, ${rotuloDoPeriodo(periodo)}`} tag={etiqueta} pergunta={PERGUNTAS.abertura}
      sub={'Combustível e Despesas com Veículos, divididos entre Produção e Revenda, e quanto custam por unidade de cogumelo vendida. Unidades: bandejas e pacotes vendidos no mês pelas duas empresas; o pacote de 1 kg conta como uma unidade. Produção: a marca EXEMPLO, vendida pela Aurora ou pela Exemplo Alimentos. Revenda: a marca REVENDA das duas empresas. Pela divisão por volume, a unidade custa o mesmo na Produção e na Revenda em cada mês.'}>
      <div className="tbl-scroll">
        <table className="tbl">
          <thead>
            <tr><th>Mês</th><th className="num">Logística da Produção</th><th className="num">Unidades da Produção</th><th className="num">Custo por unidade da Produção</th><th className="num">Logística da Revenda</th><th className="num">Unidades da Revenda</th><th className="num">Custo por unidade da Revenda</th><th className="num">Total</th></tr>
          </thead>
          <tbody>
            {l.meses.map((m) => (
              <tr key={m.mes}>
                <td>{rotuloDoMes(m.mes)}</td><CelulasDoNegocio n={m.producao} /><CelulasDoNegocio n={m.revenda} /><td className="num">{brl(m.total)}</td>
              </tr>
            ))}
            <tr className="ln-total">
              <td>Acumulado</td><CelulasDoNegocio n={l.acumulado.producao} /><CelulasDoNegocio n={l.acumulado.revenda} /><td className="num">{brl(l.acumulado.total)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      {l.meses_sem_relatorio.length > 0 && (
        <p className="obs-tela">Sem relatório de vendas carregado: {l.meses_sem_relatorio.map((m) => `${NOME_DA_EMPRESA[m.empresa]} ${rotuloDoMes(m.mes)}`).join(', ')}. Nesses meses as unidades e o custo por unidade aparecem com traço.</p>
      )}
      {l.problemas.map((p, i) => <p key={i} className="obs-tela">⚠ {p}</p>)}
      {l.fora_de_producao_e_revenda !== 0 && (
        <p className="obs-tela">{brl(l.fora_de_producao_e_revenda)} da logística ficou fora de Produção e Revenda no período (Corporativo ou ainda sem divisão por negócio).</p>
      )}
    </Panel>
  );
}
