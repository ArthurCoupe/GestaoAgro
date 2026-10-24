# ERP for an agribusiness: demo

[Versão em português](README.md)

> All data in these screens is fictitious. The demo company has two made-up businesses: Aurora Rural, which grows mushrooms and bell peppers, and Exemplo Alimentos, which resells food. Names, numbers, suppliers and batches were generated for this demo. The interface is in Portuguese.

Management system for farming and food distribution on a single database: batch lifecycle (from the start of production to harvest and losses), inventory with reconciliation, management P&L with cost allocation across business units, cash and accrual views, monthly close and executive dashboards. Runs alongside the legacy ERP through ETL.

**System stack:** React, Vite, TypeScript, Node.js, Express, Supabase (PostgreSQL with RLS) and Vercel.

This repository holds the demo frontend and the calculation functions it uses. It runs entirely in the browser, on fictitious data generated in the code itself: no backend, no database and no network calls. The server, the database and the ERP integration are not here.

## How to run

Requires Node.js 20 or newer.

```bash
cd frontend
npm install
npm run dev
```

Open the address the terminal prints (usually http://localhost:5173). To see the production build: `npm run build`, then `npm run preview` (http://localhost:4173).

## License

Code published for portfolio review only. All rights reserved.

## Accrual results

### Executive view
How the company is doing and where to look: year to date and the month against the previous one, by business.

![Executive view](prints/visao-executiva.png)

### Monthly results analysis
Revenue, costs, expenses, result and break-even month by month. A month that management hasn't closed yet is flagged as provisional.

![Monthly results analysis](prints/analise-mensal-do-resultado.png)

### Results management
The result against the margin target and the result of each business, with unallocated overhead shown apart.

![Results management](prints/gestao-do-resultado.png)

### Management P&L
The P&L consolidated or by business, monthly or year to date, with Excel export.

![Management P&L](prints/dre-gerencial.png)

## Cash

### Cash result
How much money came in, went out and was left, who drives cash and accounts receivable.

![Cash result](prints/resultado-de-caixa.png)

### Accrual × cash bridge
Why the accrual result and the cash result differ, and what explains the difference.

![Accrual × cash bridge](prints/ponte-competencia-caixa.png)

## Goals and business units

### Budget and projections
The month's thermometer: actuals, projected close and the pace needed against production and sales targets.

![Budget and projections](prints/budget-projecoes.png)

### Production dashboard
Year to date for production, with costs, expenses, margin and break-even.

![Production dashboard](prints/painel-da-producao.png)

### Resale dashboard
The same view for the resale business.

![Resale dashboard](prints/painel-da-revenda.png)

## Production cycle

### Command center
The day's operation in cards: what needs action today, what is on track and what has no data.

![Command center](prints/painel-de-comando.png)

### Operations dashboard
Production, harvest and contamination for the period, against the previous period and the average of the three before it.

![Operations dashboard](prints/painel-operacional.png)

### Mushroom journey
Batch lifecycle entries (batch, opening, harvest, contamination, transfer) and what each one is still missing.

![Mushroom journey](prints/jornada-do-cogumelo.png)

### Upcoming openings
The queue of batches to open, by each species' lead time, in the recommended order.

![Upcoming openings](prints/proximas-aberturas.png)

### Shelf map
What sits on each maturation shelf, by shed: batch, stored, removed and available blocks.

![Shelf map](prints/mapa-das-estantes.png)

## Contamination and indicators

### Contamination dashboard
The contamination thermometer by production week: how much, whether it got worse, since when and where.

![Contamination dashboard](prints/painel-de-contaminados.png)

### Cycle indicators
Blocks produced, contaminated and opened and kilos harvested, by type and period.

![Cycle indicators](prints/indicadores-do-ciclo.png)

## Master data and purchasing

### Cost master data
The price of each material per purchase, with supplier, freight, effective date, invoice and version history.

![Cost master data](prints/cadastro-mestre-de-custos.png)

### Activity master data
The time of each operational activity, with effective dates and versions: the basis for hours and labor in product cost.

![Activity master data](prints/cadastro-mestre-de-atividades.png)

### Purchase orders
Supplies that ran out and those that need a scheduled purchase, by days of stock coverage.

![Purchase orders](prints/pedido-de-compras.png)
