# Gestão Agro

[Versão em português](README.md)

> All data in these screens is fictitious. The demo company has two made-up businesses: Aurora Rural, which grows mushrooms and bell peppers, and Exemplo Alimentos, which resells food. Names, numbers, suppliers and batches were generated for this demo. The interface is in Portuguese.

![Executive view: year to date and the month against the previous one, by business](prints/visao-executiva.png)

ERP for an agribusiness, in production and used daily by management, which took the numbers out of spreadsheets: farming and food distribution on a single database, with the batch lifecycle (from the start of production to harvest and losses), inventory with reconciliation, a management P&L with cost allocation across business units, cash and accrual views, a monthly close and executive dashboards. Runs alongside the legacy ERP through ETL.

**System stack:** React, Vite, TypeScript, Node.js, Express, Supabase (PostgreSQL with RLS) and Vercel.

## Who built it

Arthur Coupê, full stack engineer and CTO at Next Business. I designed and delivered this ERP for a Next client and I own its production operation: architecture, database, integration with the legacy ERP, code and deployment. I develop with AI agents and an adversarial review before every merge.

[LinkedIn](https://www.linkedin.com/in/arthurcoupeg/) · [other projects](https://github.com/ArthurCoupe)

## Engineering decisions

- **Cost allocation in cents that always adds up.** Costs are split across business units in whole cents using the largest remainder method: the slices always sum to the total, with no cent lost or left over. See `repartir` in [`src/services/rateioGerencialService.js`](src/services/rateioGerencialService.js#L133).
- **A cost without a rule is not allocated by guesswork.** An entry without a valid allocation rule (incomplete rule, shares that do not add up to 100%, ambiguous validity dates, a driver with no data for the month) goes entirely to the unallocated line, with its reason, instead of being spread by estimate. See [the reasons](src/services/rateioGerencialService.js#L73).
- **Accrual and cash side by side, with the difference explained.** The bridge shows why the accrual result and the cash result do not match, splitting the difference by cause, with examples of each. See [`frontend/src/pages/Ponte.tsx`](frontend/src/pages/Ponte.tsx).
- **A month without data does not become a number.** Break-even is only computed over a complete period: a month with no entries or with payroll still pending is left out and flagged, and a month management has not closed shows as provisional. See [`PontoDeEquilibrioDaFrente.tsx`](frontend/src/components/PontoDeEquilibrioDaFrente.tsx).
- **Contamination compared only across mature batches.** A batch's contamination shows up over its cycle, so a new batch stays under observation and is not compared with batches that have completed the period. See [`src/services/maturidadeDaCoorte.js`](src/services/maturidadeDaCoorte.js).
- **392 tests of the calculation rules.** Harvest against packaging reconciliation, shelf occupancy, contamination by location and by batch, maturation by species, dashboard indicators, spawn requirements, pending entries and the demo finance (P&L, cash and bridge) rebuilt from the ledger. See [`src/services/testes`](src/services/testes) and [`demoFinanceiro.test.ts`](frontend/src/api/demoFinanceiro.test.ts).

## About this repository

This is the public snapshot of a private system in production. The history, with 500+ pull requests, stays in the private repository, which is why this one has a single commit. Here are the frontend and the calculation functions it uses, with the company, people and numbers replaced by made-up data. It runs entirely in the browser, on data generated in the code itself: no backend, no database and no network calls. The server, the database and the legacy ERP ETL stay in the private repository. There is no hosted version.

## Accrual results

### Monthly results analysis
Revenue, costs, expenses, result and break-even month by month. A month management has not closed yet shows as provisional.

![Monthly results analysis](prints/analise-mensal-do-resultado.png)

### Results management
The result against the margin target and the result of each business, with the unallocated structure shown apart.

![Results management](prints/gestao-do-resultado.png)

### Management P&L
The P&L consolidated or by business, monthly or year to date, with export to Excel.

![Management P&L](prints/dre-gerencial.png)

## Cash

### Cash result
How much money came in, went out and was left, what makes up the cash and the receivables.

![Cash result](prints/resultado-de-caixa.png)

### Accrual × cash bridge
Why the accrual result and the cash result differ, and what explains the difference.

![Accrual × cash bridge](prints/ponte-competencia-caixa.png)

## Targets and business units

### Budget and projections
The month's thermometer: actuals, projected close and the pace needed against production and sales targets.

![Budget and projections](prints/budget-projecoes.png)

### Production dashboard
Production year to date, with costs, expenses, margin and break-even.

![Production dashboard](prints/painel-da-producao.png)

### Resale dashboard
The same view for the resale business.

![Resale dashboard](prints/painel-da-revenda.png)

## Production cycle

### Command dashboard
The day's operation in cards: what needs action today, what is within expectations and what has no data.

![Command dashboard](prints/painel-de-comando.png)

### Operations dashboard
Production, harvest and contamination for the period, against the previous period and the average of the three before it.

![Operations dashboard](prints/painel-operacional.png)

### Mushroom lifecycle
The entries of a batch's cycle (batch, opening, harvest, contamination, transfer) and what is pending for each.

![Mushroom lifecycle](prints/jornada-do-cogumelo.png)

### Upcoming openings
The queue of batches to open, by each species' timing, in the recommended order.

![Upcoming openings](prints/proximas-aberturas.png)

### Shelf map
What is on each maturation shelf, by shed: batch, stored, removed and available.

![Shelf map](prints/mapa-das-estantes.png)

## Contamination and indicators

### Contamination dashboard
The contamination thermometer by production week: how much, whether it got worse, since when and where.

![Contamination dashboard](prints/painel-de-contaminados.png)

### Cycle indicators
Blocks produced, contaminated and opened, and kilos harvested, by type and by period.

![Cycle indicators](prints/indicadores-do-ciclo.png)

## Master data and purchasing

### Cost master data
The price of each material per purchase, with supplier, freight, validity, document and version history.

![Cost master data](prints/cadastro-mestre-de-custos.png)

### Activity master data
The time each operational activity takes, with validity and versions: the basis for hours and labor in the cost.

![Activity master data](prints/cadastro-mestre-de-atividades.png)

### Purchase order
Supplies that are out and those that need a scheduled purchase, by days of stock coverage.

![Purchase order](prints/pedido-de-compras.png)

## How to run

Requires Node.js 20 or newer.

```bash
cd frontend
npm install
npm run dev
```

Open the address the terminal prints (usually http://localhost:5173). To see the production build: `npm run build`, then `npm run preview` (http://localhost:4173).

To run the tests: `npm test`, also from inside `frontend/`.

## License

Code published for portfolio review only. All rights reserved.
