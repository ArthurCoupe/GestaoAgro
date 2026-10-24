import { brl, num, pct } from '../api/client';
import { DEFINICOES } from '../api/definicoes';
import type { VendasPorProdutoResposta } from '../api/gerencial';
import { ComoECalculado } from './ComoECalculado';
import { rotuloDoPeriodo } from './EscadaDoAno';
import { contribuicaoDosProdutos, EXTRA_DA_CONTRIBUICAO, fraseSemContribuicao } from './gestao/ConclusaoDaRevenda';
import { NOME_DA_EMPRESA } from './RevendaPorProduto';
import { Panel } from './ui';

export function ProdutosQueFormamARevenda({ v }: { v: VendasPorProdutoResposta }) {
  if (v.compras == null || v.produtos.length === 0) return null;
  const c = contribuicaoDosProdutos(v);
  const algum = c.produtos.some((p) => p.contribuicao != null);
  return (
    <Panel title={`Quais produtos efetivamente formam o resultado da Revenda? (${rotuloDoPeriodo(v.periodo)})`} id="revenda-produtos-que-formam"
      sub="Por produto, na ordem da contribuição em R$: quanto da receita da Revenda ele traz, quanto vendeu, a que preço comprou e vendeu, e quanto sobra da venda sobre a compra.">
      <div className="tbl-scroll" style={{ maxHeight: 'none' }}>
        <table className="tbl">
          <thead>
            <tr><th>Produto</th><th>Empresa</th><th>Unidade</th><th className="num">{DEFINICOES.participacao_produto.nome}</th><th className="num">Qtd vendida</th><th className="num">Preço médio de venda</th><th className="num">Preço médio de compra</th><th className="num">Margem comercial por unidade</th><th className="num">Contribuição comercial (R$)</th></tr>
          </thead>
          <tbody>
            {c.produtos.map((p) => (
              <tr key={p.chave}>
                <td>{p.descricao}</td><td>{NOME_DA_EMPRESA[p.empresa]}</td><td>{p.unidade}</td>
                <td className="num">{pct(p.participacao_pct)}</td><td className="num">{num(p.quantidade)}</td>
                <td className="num">{brl(p.preco_venda)}</td><td className="num">{brl(p.preco_compra)}</td>
                <td className="num">{brl(p.margem_unitaria)}</td><td className="num">{brl(p.contribuicao)}</td>
              </tr>
            ))}
            <tr className="ln-total"><td colSpan={8}>TOTAL</td><td className="num">{algum ? brl(c.total) : '—'}</td></tr>
          </tbody>
        </table>
      </div>
      <p className="obs-tela"><b>Margem comercial.</b>{` ${DEFINICOES.margem_comercial.nota}`}</p>
      {c.sem_contribuicao > 0 && <p className="obs-tela">{fraseSemContribuicao(c.sem_contribuicao)}</p>}
      <ComoECalculado chave="contribuicao_comercial" extra={EXTRA_DA_CONTRIBUICAO} />
      <ComoECalculado chave="participacao_produto" />
    </Panel>
  );
}
