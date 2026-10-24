# Gestão Agro

[English version](README.en.md)

> Todos os dados destas telas são fictícios. A empresa da demonstração tem dois negócios inventados: a Aurora Rural, que produz cogumelos e pimentão, e a Exemplo Alimentos, que revende alimentos. Nomes, números, fornecedores e lotes foram gerados para esta demonstração.

![Visão executiva: acumulado do ano e o mês contra o anterior, por negócio](prints/visao-executiva.png)

ERP de uma agroindústria, em produção e em uso diário pela gestão, que tirou os números das planilhas: produção rural e distribuição de alimentos sob um banco só, com a jornada do lote (do início da produção à colheita e às perdas), inventário com acerto, DRE gerencial com rateios entre frentes, regime de caixa e de competência, fechamento mensal e painéis executivos. Convive com o ERP legado por ETL.

**Stack do sistema:** React, Vite, TypeScript, Node.js, Express, Supabase (PostgreSQL com RLS) e Vercel.

## Quem fez

Arthur Coupê, engenheiro full stack e CTO da Next Business. Projetei e entreguei este ERP para uma cliente da Next e respondo pela operação dele em produção: arquitetura, banco, integração com o ERP legado, código e deploy. Desenvolvo com agentes de IA e revisão adversarial antes de cada merge.

[LinkedIn](https://www.linkedin.com/in/arthurcoupeg/) · [outros projetos](https://github.com/ArthurCoupe)

## Decisões de engenharia

- **Rateio em centavos que fecha a soma.** O custo é repartido entre as frentes em centavos inteiros, pelo método do maior resto: a soma das fatias é sempre igual ao total, sem centavo perdido nem sobrando. Veja `repartir` em [`src/services/rateioGerencialService.js`](src/services/rateioGerencialService.js#L133).
- **Custo sem regra não é rateado por palpite.** Lançamento sem regra de rateio válida (regra incompleta, soma diferente de 100%, vigência ambígua, direcionador sem dado no mês) vai inteiro para a linha de não rateado, com o motivo, em vez de ser distribuído por estimativa. Veja [os motivos](src/services/rateioGerencialService.js#L73).
- **Competência e caixa lado a lado, com a explicação da diferença.** A ponte mostra por que o resultado por competência e o de caixa não batem, separando a diferença por causa, com exemplos de cada uma. Veja [`frontend/src/pages/Ponte.tsx`](frontend/src/pages/Ponte.tsx).
- **Mês sem dado não vira número.** O ponto de equilíbrio só é calculado com o período completo: mês sem lançamento ou com folha pendente fica de fora e é avisado, e mês que a gestão não fechou aparece como provisório. Veja [`PontoDeEquilibrioDaFrente.tsx`](frontend/src/components/PontoDeEquilibrioDaFrente.tsx).
- **Contaminação comparada só entre lotes maduros.** A contaminação de um lote aparece ao longo do ciclo, então lote novo fica em observação e não entra na comparação com os que já completaram o prazo. Veja [`src/services/maturidadeDaCoorte.js`](src/services/maturidadeDaCoorte.js).
- **392 testes das regras de cálculo.** Conferência entre colheita e embalagem, ocupação das estantes, contaminação por local e por lote, maturação por espécie, indicadores do painel, necessidade de sementes, pendências de lançamento e o financeiro da demonstração (DRE, caixa e ponte) refeito a partir do razão. Veja [`src/services/testes`](src/services/testes) e [`demoFinanceiro.test.ts`](frontend/src/api/demoFinanceiro.test.ts).

## Sobre este repositório

É o retrato público de um sistema privado em produção. O histórico, com mais de 500 pull requests, fica no repositório privado, e por isso este tem um commit só. Aqui estão o frontend e as funções de cálculo que ele usa, com empresa, pessoas e números trocados por dados inventados. Roda só no navegador, com os dados gerados no próprio código: sem backend, sem banco e sem chamada de rede. O servidor, o banco e o ETL do ERP legado ficam no repositório privado. Não há versão hospedada.

## Resultado por competência

### Análise mensal do resultado
Receita, custos, despesas, resultado e ponto de equilíbrio mês a mês. Mês que a gestão ainda não fechou aparece como provisório.

![Análise mensal do resultado](prints/analise-mensal-do-resultado.png)

### Gestão do resultado
O resultado contra a meta de margem e o resultado de cada negócio, com a estrutura não rateada à parte.

![Gestão do resultado](prints/gestao-do-resultado.png)

### DRE gerencial
A DRE consolidada ou por negócio, por mês ou acumulada, com exportação para Excel.

![DRE gerencial](prints/dre-gerencial.png)

## Caixa

### Resultado de caixa
Quanto dinheiro entrou, saiu e sobrou, quem forma o caixa e o contas a receber.

![Resultado de caixa](prints/resultado-de-caixa.png)

### Ponte competência × caixa
Por que o resultado por competência e o de caixa são diferentes, e o que explica a diferença.

![Ponte competência × caixa](prints/ponte-competencia-caixa.png)

## Objetivos e frentes

### Budget e projeções
O termômetro do mês: realizado, projeção de fechamento e ritmo necessário contra as metas de produção e de vendas.

![Budget e projeções](prints/budget-projecoes.png)

### Painel da produção
O acumulado do ano da produção, com custos, despesas, margem e ponto de equilíbrio.

![Painel da produção](prints/painel-da-producao.png)

### Painel da revenda
O mesmo recorte para a revenda.

![Painel da revenda](prints/painel-da-revenda.png)

## Ciclo produtivo

### Painel de comando
O dia da operação em cards: o que exige ação hoje, o que está dentro do esperado e o que está sem dado.

![Painel de comando](prints/painel-de-comando.png)

### Painel operacional
Produção, colheita e contaminação do período, contra o período anterior e a média dos três anteriores.

![Painel operacional](prints/painel-operacional.png)

### Jornada do cogumelo
Os lançamentos do ciclo do lote (lote, abertura, colheita, contaminação, transferência) e as pendências de cada um.

![Jornada do cogumelo](prints/jornada-do-cogumelo.png)

### Próximas aberturas
A fila de lotes a abrir, pelo prazo de cada espécie, na ordem recomendada.

![Próximas aberturas](prints/proximas-aberturas.png)

### Mapa das estantes
O que há em cada estante de maturação, por galpão: lote, guardados, retirados e disponíveis.

![Mapa das estantes](prints/mapa-das-estantes.png)

## Contaminação e indicadores

### Painel de contaminados
O termômetro da contaminação por semana de produção: quanto, se piorou, desde quando e onde.

![Painel de contaminados](prints/painel-de-contaminados.png)

### Indicadores do ciclo
Blocos produzidos, contaminados e abertos e quilos colhidos, por tipo e por período.

![Indicadores do ciclo](prints/indicadores-do-ciclo.png)

## Cadastros e compras

### Cadastro mestre de custos
O preço de cada material pela compra, com fornecedor, frete, vigência, documento e histórico das versões.

![Cadastro mestre de custos](prints/cadastro-mestre-de-custos.png)

### Cadastro mestre de atividades
O tempo de cada atividade da operação, com vigência e versões: a base das horas e da mão de obra no custo.

![Cadastro mestre de atividades](prints/cadastro-mestre-de-atividades.png)

### Pedido de compras
Os insumos em falta e os que pedem compra programada, pelos dias de cobertura do estoque.

![Pedido de compras](prints/pedido-de-compras.png)

## Como rodar

Precisa do Node.js 20 ou mais novo.

```bash
cd frontend
npm install
npm run dev
```

Abra o endereço que o terminal mostrar (normalmente http://localhost:5173). Para ver o build de produção: `npm run build` e depois `npm run preview` (http://localhost:4173).

Para rodar os testes: `npm test`, também de dentro de `frontend/`.

## Licença

Código publicado só para avaliação de portfólio. Todos os direitos reservados.
