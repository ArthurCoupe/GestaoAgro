export type ChaveDaDefinicao =
  | 'resultado_operacional' | 'margem_operacional' | 'resultado_competencia'
  | 'margem_contribuicao' | 'margem_contribuicao_pct'
  | 'ponto_equilibrio_mes' | 'ponto_equilibrio_ytd' | 'ponto_equilibrio_periodo' | 'ponto_equilibrio_fisico'
  | 'meta' | 'distancia_meta'
  | 'margem_comercial' | 'contribuicao_comercial'
  | 'resultado_produto' | 'situacao_equilibrio'
  | 'participacao_receita' | 'participacao_contribuicao' | 'participacao_produto' | 'mix_produtos'
  | 'mantendo_composicao' | 'desempenho_negocio' | 'resultado_zero' | 'cenarios'
  | 'onde_agir' | 'principais_pressoes';

export interface Definicao { nome: string; formula: string; nota?: string }

export const DEFINICOES: Record<ChaveDaDefinicao, Definicao> = {
  resultado_operacional: { nome: 'Resultado operacional', formula: 'Receita líquida − custos − despesas', nota: 'Antes do financeiro e dos impostos sobre o resultado.' },
  margem_operacional: { nome: 'Margem operacional', formula: 'Resultado operacional ÷ receita líquida' },
  resultado_competencia: { nome: 'Resultado por competência', formula: 'Resultado operacional + financeiro − impostos sobre o resultado', nota: 'Pela regra de competência do sistema.' },
  margem_contribuicao: { nome: 'Margem de contribuição', formula: 'Receita líquida − custos e despesas variáveis do recorte.', nota: 'Não é a margem operacional: os custos e despesas fixos não entram.' },
  margem_contribuicao_pct: { nome: 'Margem de contribuição %', formula: 'Margem de contribuição ÷ receita líquida' },
  ponto_equilibrio_mes: { nome: 'Ponto de equilíbrio do mês', formula: '(Custos fixos + despesas fixas do mês) ÷ margem de contribuição % do mês' },
  ponto_equilibrio_ytd: { nome: 'Ponto de equilíbrio YTD', formula: '(Custos fixos + despesas fixas de janeiro ao mês) ÷ margem de contribuição % de janeiro ao mês', nota: 'É a conta sobre a soma de janeiro ao mês, não a soma dos pontos de equilíbrio de cada mês: os dois podem diferir sem contradição.' },
  ponto_equilibrio_periodo: { nome: 'Ponto de equilíbrio do período', formula: '(Custos fixos + despesas fixas do período) ÷ margem de contribuição % do período', nota: 'É a conta sobre a soma do período, não a soma dos pontos de equilíbrio de cada mês: os dois podem diferir sem contradição.' },
  ponto_equilibrio_fisico: { nome: 'Ponto de equilíbrio em kg e bandejas', formula: 'Ponto de equilíbrio em R$ ÷ receita por kg (ou por bandeja) do mesmo recorte e período' },
  meta: { nome: 'Meta', formula: 'No Consolidado, por competência, em período todo coberto pelo Budget aprovado e com todo mês apurado: a margem operacional do Budget. Fora disso (nas frentes, no Caixa, sem Budget aprovado, com mês sem Budget ou sem apuração): a margem desejada da Meta da empresa (tela Budget)' },
  distancia_meta: { nome: 'Distância para a meta', formula: 'Meta % × receita líquida − resultado operacional, em R$; em pontos, meta % − margem operacional' },
  margem_comercial: { nome: 'Margem comercial', formula: 'Preço médio de venda − preço médio de compra, por unidade, pelos valores do ERP', nota: 'Não desconta frete, perdas, impostos nem crédito de ICMS: não é a margem operacional nem o lucro do produto.' },
  contribuicao_comercial: { nome: 'Contribuição comercial', formula: 'Margem comercial por unidade × quantidade vendida no período' },
  resultado_produto: { nome: 'Resultado por produto/espécie', formula: 'Receita do produto − custos e despesas direcionados a ele ou rateados pela metodologia do fato (por negócio e por espécie)' },
  situacao_equilibrio: { nome: 'Situação contra o ponto de equilíbrio', formula: 'Margem de contribuição ≤ 0: economia unitária ruim. Margem de contribuição > 0 e receita abaixo do ponto de equilíbrio: abaixo da escala (falta = ponto de equilíbrio − receita). Receita no ponto de equilíbrio ou acima: acima do ponto de equilíbrio', nota: 'Sem receita própria no período ou com conta sem fixo ou variável definido, a situação não se calcula; sem custo fixo próprio, não há ponto de equilíbrio a calcular; sem receita dividida por espécie, a situação de cada espécie não aparece. A tela diz qual dos casos.' },
  participacao_receita: { nome: 'Participação dos negócios na receita', formula: 'Receita líquida do negócio ÷ receita líquida total' },
  participacao_contribuicao: { nome: 'Participação dos negócios na margem de contribuição', formula: 'Margem de contribuição do negócio ÷ margem de contribuição total' },
  participacao_produto: { nome: 'Participação na receita', formula: 'Receita do produto ÷ receita de todos os produtos de revenda do relatório de vendas do ERP, no período', nota: 'O total é o do relatório de vendas por produto (Aurora e Exemplo Alimentos), com todos os produtos de revenda do período; não é a receita líquida da DRE.' },
  mix_produtos: { nome: 'Mix de produtos', formula: 'Receita de cada produto ÷ receita da Revenda no mês' },
  mantendo_composicao: { nome: 'Mantendo a composição atual', formula: 'Faturamento para a meta = custos fixos ÷ (margem de contribuição % − meta %)' },
  desempenho_negocio: { nome: 'Desempenho por negócio', formula: 'Negócios em ordem de margem operacional, cada um com priorizar, manter ou revisar contra a meta' },
  resultado_zero: { nome: 'Resultado zero', formula: 'Quanto cada alavanca, sozinha, teria de mover para o resultado operacional chegar a zero, com as quantidades constantes', nota: 'Não é o ponto de equilíbrio, que muda o volume vendido.' },
  cenarios: { nome: 'Cenários para atingir a meta', formula: 'Quanto preço, custos, despesas ou contaminação teriam de mudar, cada um sozinho, para fechar a distância para a meta, com as quantidades constantes', nota: 'Cenários matemáticos, não recomendações.' },
  onde_agir: { nome: 'Onde agir primeiro', formula: 'Um item por tipo, ordenados por impacto em R$: negócio e produto pelo prejuízo (só os de resultado negativo); custo e despesa pelo valor da linha no período (a compra de cogumelos para revenda fica fora do custo: é o custo do que a Revenda vende); contaminação pelas perdas acima da meta (blocos acima da meta × custo médio do bloco)' },
  principais_pressoes: { nome: 'Principais pressões sobre o resultado', formula: 'Até três linhas de custo (ou de despesa) que mais mudaram o resultado em R$, subindo ou caindo: contra o período anterior, quando existe; sem ele, o último mês completo contra o mês completo anterior; sem nenhum dos dois, as maiores linhas do período, sem variação. As linhas da folha ainda não apropriada ficam fora.' },
};
