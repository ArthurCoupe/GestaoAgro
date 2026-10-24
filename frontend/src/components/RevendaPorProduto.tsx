import { brl, num, pct } from '../api/client';
import { dataBr } from '../api/constantes';
import type { VendaDeProduto, VendasPorProdutoResposta } from '../api/gerencial';
import { PERGUNTAS } from '../api/perguntasGerenciais';
import { rotuloDoPeriodo } from './EscadaDoAno';
import { Panel } from './ui';

export const NOME_DA_EMPRESA = { AR: 'Aurora', EXEMPLO: 'Exemplo Alimentos' } as const;
export const rotuloDoMes = (mes: string) => rotuloDoPeriodo({ inicio: `${mes}-01`, fim: `${mes}-01` });

export const chaveDoProduto = (p: Pick<VendaDeProduto, 'empresa' | 'codigo_produto' | 'unidade'>) => `${p.empresa}|${p.codigo_produto}|${p.unidade}`;

export const FRASE_DO_PRODUTO_DA_REVENDA = ' Clique num produto para ver a linha dele na tabela Revenda por produto, em Ver detalhamento.';

export function RevendaPorProduto({ v, destaque }: { v: VendasPorProdutoResposta; destaque?: string[] }) {
  return (
    <Panel title={`Revenda por produto: ${rotuloDoPeriodo(v.periodo)}`} pergunta={PERGUNTAS.abertura} id="revenda-por-produto"
      sub={'Do relatório Produtos/Serviços Vendidos do ERP: os produtos de marca "3 - REVENDA" das duas empresas. A margem comercial é a de compra e venda, por unidade; o rateio de custos não entra nela.'}>
      {v.produtos.length === 0 ? (
        <div className="empty">Nenhuma venda de revenda carregada no período.</div>
      ) : (
        <div className="tbl-scroll">
          <table className="tbl">
            <thead>
              <tr><th>Produto</th><th>Empresa</th><th>Unidade</th><th className="num">Qtd vendida</th><th className="num">Média por mês</th><th className="num">Receita</th><th className="num">Preço médio de venda</th><th className="num">Qtd comprada</th><th className="num">Preço médio de compra</th><th className="num">Margem comercial por unidade</th><th className="num">Margem comercial %</th></tr>
            </thead>
            <tbody>
              {v.produtos.map((p) => (
                <tr key={chaveDoProduto(p)} className={destaque?.includes(chaveDoProduto(p)) ? 'ln-destaque' : undefined}>
                  <td>{p.descricao}</td><td>{NOME_DA_EMPRESA[p.empresa]}</td><td>{p.unidade}</td>
                  <td className="num">{num(p.quantidade)}</td><td className="num">{num(p.volume_medio_mensal, 1)}</td>
                  <td className="num">{brl(p.receita)}</td><td className="num">{brl(p.preco_medio)}</td>
                  <td className="num">{num(p.quantidade_comprada)}</td><td className="num">{brl(p.preco_medio_compra)}</td>
                  <td className="num">{brl(p.margem_unitaria)}</td><td className="num">{pct(p.margem_pct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="obs-tela">{v.aviso_compras}</p>
      {v.meses_sem_relatorio.length > 0 && (
        <p className="obs-tela">Sem relatório de vendas carregado: {v.meses_sem_relatorio.map((m) => `${NOME_DA_EMPRESA[m.empresa]} ${rotuloDoMes(m.mes)}`).join(', ')}.</p>
      )}
      {(v.meses_parciais?.length ?? 0) > 0 && (
        <p className="obs-tela">Mês carregado só em parte, fora da média por mês até a carga do mês inteiro: {v.meses_parciais?.map((m) => `${NOME_DA_EMPRESA[m.empresa]} ${rotuloDoMes(m.mes)} (até ${dataBr(m.ate)})`).join(', ')}.</p>
      )}
      {v.ex_vendido_pela_exemplo > 0 && (
        <p className="obs-tela">A Exemplo Alimentos também vendeu produto próprio (EX) no período: {brl(v.ex_vendido_pela_exemplo)}. Ele não entra nesta lista: é receita da Produção, pela origem do produto.</p>
      )}
    </Panel>
  );
}
