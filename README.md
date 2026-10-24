# ERP para agroindústria: demonstração

[English version](README.en.md)

> Todos os dados destas telas são fictícios. A empresa da demonstração tem dois negócios inventados: a Aurora Rural, que produz cogumelos e pimentão, e a Exemplo Alimentos, que revende alimentos. Nomes, números, fornecedores e lotes foram gerados para esta demonstração.

Sistema de gestão para produção rural e distribuição de alimentos sob um banco só: jornada do lote (do início da produção à colheita e às perdas), inventário com acerto, DRE gerencial com rateios entre frentes, regime de caixa e de competência, fechamento mensal e painéis executivos. Convive com o ERP legado por ETL.

**Stack do sistema:** React, Vite, TypeScript, Node.js, Express, Supabase (PostgreSQL com RLS) e Vercel.

Este repositório traz o frontend da demonstração e as funções de cálculo que ele usa. Roda só no navegador, com os dados fictícios gerados no próprio código: sem backend, sem banco e sem chamada de rede. O servidor, o banco e a integração com o ERP não estão aqui.

## Como rodar

Precisa do Node.js 20 ou mais novo.

```bash
cd frontend
npm install
npm run dev
```

Abra o endereço que o terminal mostrar (normalmente http://localhost:5173). Para ver o build de produção: `npm run build` e depois `npm run preview` (http://localhost:4173).

## Licença

Código publicado só para avaliação de portfólio. Todos os direitos reservados.

## Resultado por competência

### Visão executiva
Como está a empresa e onde prestar atenção: o acumulado do ano e o mês contra o anterior, por negócio.

![Visão executiva](prints/visao-executiva.png)

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
