import { brlK, pct } from '../../api/client';
import { DEFINICOES } from '../../api/definicoes';
import type { ExecutivoResposta, VendaDeProduto, VendasPorProdutoResposta } from '../../api/gerencial';
import { fraseDoQuadroAfetado } from '../AvisoDaFolha';
import { ComoECalculado } from '../ComoECalculado';
import { rotuloDoPeriodo } from '../EscadaDoAno';
import { chaveDoProduto } from '../RevendaPorProduto';
import { Panel } from '../ui';

export interface ContribuicaoDoProduto {
  chave: string;
  descricao: string;
  empresa: VendaDeProduto['empresa'];
  unidade: string;
  receita: number;
  participacao_pct: number | null;
  quantidade: number;
  preco_venda: number | null;
  preco_compra: number | null;
  margem_unitaria: number | null;
  contribuicao: number | null;
}

const cent = (v: number) => Math.round(v * 100);

export function contribuicaoDosProdutos(v: VendasPorProdutoResposta): { produtos: ContribuicaoDoProduto[]; total: number; sem_contribuicao: number } {
  const produtos = v.produtos.map((p): ContribuicaoDoProduto => {
    const m = p.margem_unitaria ?? null;
    return {
      chave: chaveDoProduto(p), descricao: p.descricao, empresa: p.empresa, unidade: p.unidade, receita: p.receita,
      participacao_pct: v.receita_total > 0 ? (cent(p.receita) * 100) / cent(v.receita_total) : null,
      quantidade: p.quantidade, preco_venda: p.preco_medio, preco_compra: p.preco_medio_compra ?? null, margem_unitaria: m,
      contribuicao: v.compras != null && m != null && p.receita > 0 && p.quantidade > 0
        ? (Math.round((Math.round(m * 100) * Math.round(p.quantidade * 1000)) / 1000) || 0) / 100 : null,
    };
  });
  const com = produtos.filter((p) => p.contribuicao != null)
    .sort((a, b) => cent(b.contribuicao ?? 0) - cent(a.contribuicao ?? 0) || a.descricao.localeCompare(b.descricao));
  const sem = produtos.filter((p) => p.contribuicao == null).sort((a, b) => cent(b.receita) - cent(a.receita));
  return {
    produtos: [...com, ...sem],
    total: com.reduce((s, p) => s + cent(p.contribuicao ?? 0), 0) / 100,
    sem_contribuicao: sem.length,
  };
}

const lista = (ps: ContribuicaoDoProduto[]) => ps.map((p) => `${p.descricao} (${brlK(p.contribuicao ?? 0)})`).join(', ');

export const fraseSemContribuicao = (n: number) =>
  `${n} ${n === 1 ? 'produto fica' : 'produtos ficam'} sem contribuição: sem compra carregada ou sem venda líquida positiva no período.`;

export const EXTRA_DA_CONTRIBUICAO = `${DEFINICOES.margem_comercial.nome} = ${DEFINICOES.margem_comercial.formula}. ${DEFINICOES.margem_comercial.nota}`;

export function ConclusaoDaRevenda({ ex, vendas, onIr }: {
  ex: Pick<ExecutivoResposta, 'atividades' | 'etiqueta' | 'periodo' | 'folha_pendente'>;
  vendas: VendasPorProdutoResposta | { erro: string } | null;
  onIr?: (destino: 'revenda') => void;
}) {
  const r = ex.atividades.find((a) => a.chave === 'REVENDA');
  if (!r) return null;
  const corpo = () => {
    if (!vendas) return <div className="loading">Lendo as vendas por produto…</div>;
    if ('erro' in vendas) return <div className="empty">{`Produtos da Revenda indisponíveis (${vendas.erro}).`}</div>;
    if (vendas.compras == null) {
      return <p className="obs-tela">A margem comercial por produto entra quando a compra por produto, do Relatório de Compra do ERP, estiver extraída até o fim dos meses com venda.</p>;
    }
    const c = contribuicaoDosProdutos(vendas);
    const mais = c.produtos.filter((p) => cent(p.contribuicao ?? 0) > 0).slice(0, 3);
    const abaixo = c.produtos.filter((p) => p.contribuicao != null && cent(p.margem_unitaria ?? 0) < 0)
      .sort((a, b) => cent(a.contribuicao ?? 0) - cent(b.contribuicao ?? 0) || a.descricao.localeCompare(b.descricao));
    return (
      <>
        {mais.length > 0 && <p>{`Os produtos que mais contribuem em R$: ${lista(mais)}.`}</p>}
        {abaixo.length > 0 && <p>{`${abaixo.length === 1 ? 'Produto vendido' : 'Produtos vendidos'} abaixo do preço médio de compra: ${lista(abaixo)}.`}</p>}
        {c.sem_contribuicao > 0 && (
          <p className="obs-tela">{fraseSemContribuicao(c.sem_contribuicao)}</p>
        )}
        <ComoECalculado chave="contribuicao_comercial" extra={EXTRA_DA_CONTRIBUICAO} />
      </>
    );
  };
  return (
    <Panel title={`Conclusão da Revenda: ${rotuloDoPeriodo(ex.periodo)}`} tag={ex.etiqueta} id="gestao-conclusao-revenda"
      sub="O resultado da Revenda e os produtos que o formam; a tabela por produto fica no Painel da Revenda, que abre neste mesmo período.">
      <p><b>{`Resultado da Revenda: ${brlK(r.resultado)}, ${r.margem_pct == null ? 'sem margem' : `margem operacional ${pct(r.margem_pct)}`}.`}</b></p>
      {(ex.folha_pendente?.length ?? 0) > 0 && <p className="obs-tela">{`⚠ ${fraseDoQuadroAfetado('O resultado e a margem da Revenda')}`}</p>}
      {corpo()}
      {onIr && <p className="obs-tela"><button type="button" className="gr-toggle" onClick={() => onIr('revenda')}>Ver os produtos no Painel da Revenda</button></p>}
    </Panel>
  );
}
