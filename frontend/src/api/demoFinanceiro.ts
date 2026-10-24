import type { CadastroDeCustos, MaterialDoCadastro, VersaoDoPreco } from './cadastroDeCustos';
import type { AtividadeDoCadastro, CadastroMestre, VersaoDaAtividade } from './cadastroMestre';
import type {
  AberturaDoQuadro, AtividadeComCalendario, CardContraReferencia, ChaveDoIndicador, DiaSemOperacao, EspecieDoTermometro,
  LinhaDoTermometro, MesDoQuadro, OrigemDaMeta, PlanejamentoDeMaturacao, SituacaoDoIndicador, TermometroDoMes,
} from './objetivos';
import type {
  AlavancasResposta, AtividadeChave, CaixaResposta, ChaveDaEscadaPorAtividade, ChaveDaVariedade, ChaveDoGrupo, ComponenteDoCusto,
  CustosDaProducaoResposta, CustosDoMes, EconomiaDoRecorte, Escada, EscadaPorAtividade, ExecutivoLinhaFolha, ExecutivoResposta,
  IndicadoresDaProducaoResposta, IndicadoresDoMes, LancamentoDaLinha, LancamentosDaLinhaResposta, LancamentosDoGrupoResposta,
  LinhaComposicao, LoteAbertoComCusto, LoteDaAbertura, LoteDeOrigem, LoteFabricadoComCusto, MesDeFabricacao, MesProvisorio, OrigemDoMes,
  PendenciasDeClassificacaoResposta, PonteExemplo, PonteResposta, Regime, Variedade, VendaPorEspecie, VendasPorProdutoResposta, VolumesDoMes,
} from './gerencial';
import type { DreNovaColunas, DreNovaCompetenciasResposta, DreNovaLinha, DreNovaResposta, VisaoNova } from './dreNova';
import { gerador } from './semente';

type Empresa = 'AR' | 'EXEMPLO';
type Negocio = 'PRODUCAO' | 'REVENDA' | 'CORPORATIVO' | 'NAO_RATEADO';
type Produto = 'COGUMELO' | 'PIMENTAO' | null;
type Especie = 'SH' | 'SP' | 'SB';
type Comportamento = 'FIXO' | 'VARIAVEL' | null;

interface Conta { id: number; codigo: string; rotulo: string; grupo: number; comportamento: Comportamento; erp: string }
interface Destino { negocio: Negocio; produto: Produto; especie: Especie | null }
interface Fatia extends Destino { lan: Lancamento; cent: number }
interface Lancamento {
  id: string; empresa: Empresa; conta: Conta; documento: string; historico: string; soCaixa: boolean;
  data_competencia: string; data_liquidacao: string | null; cent: number; fatias: Fatia[];
  venda?: { produto: string; quantidade: number };
}
interface Fato { f: Fatia; mes: string }

const agora = new Date();
const dois = (n: number) => String(n).padStart(2, '0');
const IDX_HOJE = agora.getFullYear() * 12 + agora.getMonth();
const HOJE = `${agora.getFullYear()}-${dois(agora.getMonth() + 1)}-${dois(agora.getDate())}`;
const MESES_VISIVEIS = 24;
const IDX_INICIO = IDX_HOJE - MESES_VISIVEIS + 1;
const IDX_BASE = 2025 * 12;

const mesDe = (idx: number) => `${Math.floor(idx / 12)}-${dois((idx % 12) + 1)}`;
const idxDe = (mes: string) => Number(mes.slice(0, 4)) * 12 + Number(mes.slice(5, 7)) - 1;
const diasNoMes = (idx: number) => new Date(Date.UTC(Math.floor(idx / 12), (idx % 12) + 1, 0)).getUTCDate();
const dataDe = (idx: number, dia: number) => `${mesDe(idx)}-${dois(Math.min(dia, diasNoMes(idx)))}`;
const somarDias = (data: string, n: number) => {
  const d = new Date(Date.UTC(Number(data.slice(0, 4)), Number(data.slice(5, 7)) - 1, Number(data.slice(8, 10)) + n));
  return `${d.getUTCFullYear()}-${dois(d.getUTCMonth() + 1)}-${dois(d.getUTCDate())}`;
};
const ultimoDia = (idx: number) => dataDe(idx, 31);

export function mesesDoIntervalo(inicio: string, fim: string): string[] {
  const saida: string[] = [];
  for (let i = idxDe(inicio); i <= idxDe(fim); i += 1) saida.push(mesDe(i));
  return saida;
}

const reais = (cent: number) => cent / 100;
const cents = (v: number) => Math.round(v * 100);
const pct = (num: number, den: number): number | null => (den === 0 ? null : Math.round((num / den) * 10000) / 100);
const formatarReais = (cent: number) =>
  `${cent < 0 ? '-' : ''}R$ ${String(Math.floor(Math.abs(cent) / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${dois(Math.abs(cent) % 100)}`;

function repartir<T>(total: number, partes: Array<[T, number]>): Array<[T, number]> {
  const soma = partes.reduce((s, [, p]) => s + p, 0);
  const saida = partes.map(([k, p]): [T, number] => [k, Math.trunc((total * p) / soma)]);
  const resto = total - saida.reduce((s, [, v]) => s + v, 0);
  let maior = 0;
  partes.forEach(([, p], i) => { if (p > partes[maior][1]) maior = i; });
  saida[maior][1] += resto;
  return saida.filter(([, v]) => v !== 0);
}

const GRUPOS: Array<{ n: number; codigo: string; oficial: string; rotulo: string }> = [
  { n: 1, codigo: '1-receita-bruta', oficial: 'L001', rotulo: 'Receita bruta' },
  { n: 2, codigo: '2-deducoes', oficial: 'L010', rotulo: 'Deduções e impostos sobre a receita' },
  { n: 3, codigo: '3-custos-diretos', oficial: 'L020', rotulo: 'Custos diretos' },
  { n: 4, codigo: '4-despesas-diretas', oficial: 'L040', rotulo: 'Despesas diretas' },
  { n: 5, codigo: '5-despesas-compartilhadas', oficial: 'L060', rotulo: 'Despesas compartilhadas' },
  { n: 6, codigo: '6-impostos-sobre-o-resultado', oficial: 'L080', rotulo: 'Impostos sobre o resultado' },
  { n: 7, codigo: '7-resultado-financeiro', oficial: 'L090', rotulo: 'Resultado financeiro' },
  { n: 8, codigo: '8-ajustes-financeiros', oficial: 'L100', rotulo: 'Ajustes financeiros' },
  { n: 9, codigo: '9-capex', oficial: 'L110', rotulo: 'CAPEX' },
  { n: 10, codigo: '10-movimentacao-dos-socios', oficial: 'L120', rotulo: 'Movimentação de sócios' },
];
const TOTAIS = [
  { id: 901, codigo: 'T01', rotulo: 'Receita líquida', depoisDoGrupo: 2, grupos: [1, 2] },
  { id: 902, codigo: 'T02', rotulo: 'Resultado bruto', depoisDoGrupo: 3, grupos: [1, 2, 3] },
  { id: 903, codigo: 'T03', rotulo: 'Resultado operacional', depoisDoGrupo: 5, grupos: [1, 2, 3, 4, 5] },
  { id: 906, codigo: 'T06', rotulo: 'Resultado por competência', depoisDoGrupo: 7, grupos: [1, 2, 3, 4, 5, 6, 7] },
];

const conta = (codigo: string, rotulo: string, grupo: number, comportamento: Comportamento, erp: string): Conta =>
  ({ id: Number(codigo.slice(1)), codigo, rotulo, grupo, comportamento, erp });
const C = {
  cogumelos: conta('L002', 'Venda de cogumelos', 1, null, '1.01.001'),
  pimentao: conta('L003', 'Venda de pimentão', 1, null, '1.01.002'),
  revenda: conta('L004', 'Revenda de mercadorias', 1, null, '1.01.010'),
  impostosVenda: conta('L011', 'Impostos sobre vendas', 2, null, '2.01.001'),
  devolucoes: conta('L012', 'Devoluções e descontos', 2, null, '2.01.005'),
  substrato: conta('L015', 'Matéria-prima do substrato', 3, 'VARIAVEL', '3.01.001'),
  sementes: conta('L022', 'Sementes (spawn)', 3, 'VARIAVEL', '3.01.002'),
  embalagens: conta('L023', 'Embalagens', 3, 'VARIAVEL', '3.01.004'),
  energia: conta('L024', 'Energia elétrica da produção', 3, 'FIXO', '3.02.001'),
  maoDeObra: conta('L025', 'Mão de obra da produção', 3, 'FIXO', '3.03.001'),
  mercadorias: conta('L026', 'Mercadorias para revenda', 3, 'VARIAVEL', '3.05.001'),
  insumosPimentao: conta('L027', 'Insumos do pimentão', 3, 'VARIAVEL', '3.01.008'),
  fretes: conta('L041', 'Fretes de entrega', 4, 'VARIAVEL', '4.01.001'),
  combustivel: conta('L042', 'Combustível e veículos', 4, 'VARIAVEL', '4.01.003'),
  manutencao: conta('L043', 'Manutenção de equipamentos', 4, 'FIXO', '4.02.001'),
  comissoes: conta('L044', 'Comissões de venda', 4, 'VARIAVEL', '4.03.001'),
  salariosAdm: conta('L061', 'Salários administrativos', 5, 'FIXO', '5.01.001'),
  aluguel: conta('L062', 'Aluguel e condomínio', 5, 'FIXO', '5.02.001'),
  contabilidade: conta('L063', 'Contabilidade', 5, 'FIXO', '5.03.001'),
  sistemas: conta('L064', 'Sistemas e internet', 5, 'FIXO', '5.03.004'),
  seguros: conta('L065', 'Seguros', 5, 'FIXO', '5.03.007'),
  irpj: conta('L081', 'IRPJ e CSLL', 6, null, '6.01.001'),
  rendimentos: conta('L091', 'Rendimentos de aplicações', 7, null, '7.01.001'),
  juros: conta('L092', 'Juros e tarifas bancárias', 7, null, '7.02.001'),
  emprestimo: conta('L101', 'Empréstimos recebidos', 8, null, '8.01.001'),
  amortizacao: conta('L102', 'Amortização de empréstimos', 8, null, '8.01.002'),
  maquinas: conta('L111', 'Máquinas e equipamentos', 9, null, '9.01.001'),
  obras: conta('L112', 'Obras e instalações', 9, null, '9.01.002'),
  lucros: conta('L121', 'Distribuição de lucros', 10, null, '10.01.001'),
  aporte: conta('L122', 'Aporte dos sócios', 10, null, '10.01.002'),
};
const CONTAS: Conta[] = Object.values(C);
const CONTA_POR_ID = new Map(CONTAS.map((c) => [c.id, c]));
const entra = (c: Conta) => c.grupo <= 7;
const blocoDe = (c: Conta): 'receita' | 'custos' | 'despesas' | null =>
  (c.grupo <= 2 ? 'receita' : c.grupo === 3 ? 'custos' : c.grupo <= 5 ? 'despesas' : null);

const ESPECIES: Especie[] = ['SH', 'SP', 'SB'];
const VENDA_DA_ESPECIE: Record<Especie, { bandejas: number; preco: number; blocos: number; nome: string }> = {
  SH: { bandejas: 2600, preco: 12.9, blocos: 5200, nome: 'Shiitake' },
  SP: { bandejas: 1450, preco: 10.4, blocos: 2100, nome: 'Shimeji Preto' },
  SB: { bandejas: 1250, preco: 9.6, blocos: 1900, nome: 'Shimeji Branco' },
};
const PRODUTOS_DA_REVENDA: Array<{ codigo: string; descricao: string; especie: Especie | 'OUTROS'; quantidade: number; preco: number; custo: number; sazonal: number }> = [
  { codigo: '200101', descricao: 'COGUMELO PARIS FATIADO 200 GRAMAS', especie: 'OUTROS', quantidade: 2000, preco: 8.9, custo: 5.1, sazonal: 0 },
  { codigo: '200102', descricao: 'COGUMELO PARIS INTEIRO 250 GRAMAS', especie: 'OUTROS', quantidade: 1550, preco: 9.8, custo: 5.7, sazonal: 0 },
  { codigo: '200105', descricao: 'PORTOBELLO 200 GRAMAS', especie: 'OUTROS', quantidade: 550, preco: 13.9, custo: 8.2, sazonal: 0 },
  { codigo: '200110', descricao: 'SHIMEJI BRANCO 200 GRAMAS', especie: 'SB', quantidade: 1050, preco: 9.4, custo: 5.5, sazonal: 0 },
  { codigo: '200111', descricao: 'SHIMEJI PRETO 200 GRAMAS', especie: 'SP', quantidade: 900, preco: 9.9, custo: 5.9, sazonal: 0 },
  { codigo: '200120', descricao: 'SHIITAKE 200 GRAMAS', especie: 'SH', quantidade: 1250, preco: 12.4, custo: 7.2, sazonal: 0.1 },
  { codigo: '200130', descricao: 'COGUMELO ERYNGII 200 GRAMAS', especie: 'OUTROS', quantidade: 400, preco: 15.9, custo: 9.3, sazonal: 0 },
  { codigo: '200140', descricao: 'MIX DE COGUMELOS 300 GRAMAS', especie: 'OUTROS', quantidade: 500, preco: 16.5, custo: 9.4, sazonal: 0.15 },
];
const RATEIO_COMPARTILHADO: Array<[Negocio | 'COGUMELO' | 'PIMENTAO', number]> = [['COGUMELO', 34], ['PIMENTAO', 8], ['REVENDA', 38], ['CORPORATIVO', 20]];

const sazonal = (idx: number, pico: number, amplitude: number) => 1 + amplitude * Math.cos((2 * Math.PI * ((idx % 12) + 1 - pico)) / 12);
const tendencia = (idx: number, porMes: number) => 1 + porMes * (idx - IDX_BASE);

function volumesDoMes(idx: number) {
  const g = gerador(7000 + idx);
  const fator = sazonal(idx, 7, 0.1) * tendencia(idx, 0.005);
  const especie = Object.fromEntries(ESPECIES.map((e) => {
    const v = VENDA_DA_ESPECIE[e];
    const bandejas = Math.round(v.bandejas * fator * g.entre(0.94, 1.06));
    const blocos = Math.round((v.blocos * g.entre(0.92, 1.08)) / 10) * 10;
    const contaminados = Math.round(blocos * g.entre(0.04, 0.11));
    return [e, { bandejas, preco: Math.round(v.preco * tendencia(idx, 0.004) * 100) / 100, blocos, contaminados }];
  })) as Record<Especie, { bandejas: number; preco: number; blocos: number; contaminados: number }>;
  const kgPimentao = Math.round(1800 * sazonal(idx, 1, 0.25) * g.entre(0.9, 1.1));
  const precoPimentao = Math.round(6.2 * tendencia(idx, 0.004) * 100) / 100;
  const revenda = PRODUTOS_DA_REVENDA.map((p) => ({
    ...p,
    qtd: Math.round(p.quantidade * sazonal(idx, 12, p.sazonal) * tendencia(idx, 0.006) * g.entre(0.9, 1.1)),
    precoMes: Math.round(p.preco * tendencia(idx, 0.004) * 100) / 100,
    custoMes: Math.round(p.custo * tendencia(idx, 0.004) * 100) / 100,
  }));
  return { especie, kgPimentao, precoPimentao, revenda };
}

const destino = (negocio: Negocio, produto: Produto = null, especie: Especie | null = null): Destino => ({ negocio, produto, especie });
const COGUMELO = (e: Especie) => destino('PRODUCAO', 'COGUMELO', e);
const PIMENTAO = destino('PRODUCAO', 'PIMENTAO');
const SEM_QUEBRA = destino('PRODUCAO');
const REVENDA = destino('REVENDA');
const CORPORATIVO = destino('CORPORATIVO');
const NAO_RATEADO = destino('NAO_RATEADO');

function gerarRazao(): Lancamento[] {
  const razao: Lancamento[] = [];
  for (let idx = IDX_INICIO - 1; idx <= IDX_HOJE; idx += 1) {
    const vol = volumesDoMes(idx);
    const doMes: Lancamento[] = [];
    let seq = 0;
    const lancar = (c: Conta, empresa: Empresa, dia: number, valor: number, partes: Array<[Destino, number]>, p: {
      documento: string; historico: string; prazo?: number | null; soCaixa?: boolean; venda?: Lancamento['venda'];
    }) => {
      const competencia = dataDe(idx, dia);
      const cent = cents(valor);
      if (competencia > HOJE || cent === 0) return null;
      const pago = p.prazo == null ? competencia : somarDias(competencia, p.prazo);
      seq += 1;
      const lan: Lancamento = {
        id: `L${mesDe(idx).replace('-', '')}-${dois(seq)}`, empresa, conta: c, documento: p.documento, historico: p.historico,
        soCaixa: Boolean(p.soCaixa), data_competencia: competencia, data_liquidacao: pago > HOJE ? null : pago, cent, fatias: [], venda: p.venda,
      };
      lan.fatias = repartir(cent, partes).map(([d, v]) => ({ ...d, lan, cent: v }));
      doMes.push(lan);
      return lan;
    };
    const g = (c: Conta) => gerador(idx * 1000 + c.id);
    const nf = (c: Conta) => `NF ${30000 + ((idx * 97 + c.id * 13 + seq * 7) % 9000)}`;
    const titulo = (c: Conta) => `${c.erp.replace(/\./g, '')}${dois(seq % 100)}/1`;
    const competenciaMes = `${dois((idx % 12) + 1)}/${Math.floor(idx / 12)}`;

    for (const e of ESPECIES) {
      const v = vol.especie[e];
      const gv = gerador(idx * 1000 + 200 + ESPECIES.indexOf(e));
      for (const [i, dia] of [7, 14, 21, 28].entries()) {
        const bandejas = i < 3 ? Math.round(v.bandejas / 4) : v.bandejas - 3 * Math.round(v.bandejas / 4);
        lancar(C.cogumelos, 'AR', dia, bandejas * v.preco, [[COGUMELO(e), 1]], {
          documento: nf(C.cogumelos), historico: i === 2 ? `Vendas da semana à rede de supermercados: ${VENDA_DA_ESPECIE[e].nome}` : `Vendas da semana a varejistas: ${VENDA_DA_ESPECIE[e].nome}`,
          prazo: i === 2 ? gv.inteiro(45, 60) : gv.inteiro(14, 40), venda: { produto: e, quantidade: bandejas },
        });
      }
    }
    for (const [i, dia] of [12, 26].entries()) {
      const kg = i === 0 ? Math.round(vol.kgPimentao / 2) : vol.kgPimentao - Math.round(vol.kgPimentao / 2);
      lancar(C.pimentao, 'AR', dia, kg * vol.precoPimentao, [[PIMENTAO, 1]], {
        documento: nf(C.pimentao), historico: 'Venda de pimentão a atacadista', prazo: g(C.pimentao).inteiro(10, 30), venda: { produto: 'PIMENTAO', quantidade: kg },
      });
    }
    for (const p of vol.revenda) {
      const gp = gerador(idx * 1000 + 300 + Number(p.codigo.slice(-3)));
      for (const [i, dia] of [10, 25].entries()) {
        const qtd = i === 0 ? Math.round(p.qtd / 2) : p.qtd - Math.round(p.qtd / 2);
        lancar(C.revenda, 'EXEMPLO', dia, qtd * p.precoMes, [[REVENDA, 1]], {
          documento: nf(C.revenda), historico: `Venda a supermercados: ${p.descricao.toLowerCase()}`, prazo: gp.inteiro(7, 30),
          venda: { produto: p.codigo, quantidade: qtd },
        });
      }
    }

    const receitaPor = (empresa: Empresa) => {
      const m = new Map<string, [Destino, number]>();
      for (const l of doMes) {
        if (l.conta.grupo !== 1 || l.empresa !== empresa) continue;
        for (const f of l.fatias) {
          const k = `${f.negocio}|${f.produto}|${f.especie}`;
          m.set(k, [f, (m.get(k)?.[1] ?? 0) + f.cent]);
        }
      }
      return [...m.values()].map(([f, v]): [Destino, number] => [destino(f.negocio, f.produto, f.especie), v]);
    };
    const soma = (partes: Array<[Destino, number]>) => partes.reduce((s, [, v]) => s + v, 0) / 100;
    const vendasAR = receitaPor('AR');
    const vendasRev = receitaPor('EXEMPLO');
    const pesoDaEspecie = (e: Especie) => vol.especie[e].bandejas * vol.especie[e].preco;
    const cogumeloPorVenda = ESPECIES.map((e): [Destino, number] => [COGUMELO(e), pesoDaEspecie(e)]);
    const cogumeloPorBloco = ESPECIES.map((e): [Destino, number] => [COGUMELO(e), vol.especie[e].blocos]);
    const blocos = ESPECIES.reduce((s, e) => s + vol.especie[e].blocos, 0);
    const bandejasCog = ESPECIES.reduce((s, e) => s + vol.especie[e].bandejas, 0);

    const fim = diasNoMes(idx);
    lancar(C.impostosVenda, 'AR', fim, -0.04 * soma(vendasAR), vendasAR, { documento: `Guia ${competenciaMes}`, historico: 'Impostos sobre o faturamento do mês', prazo: 20 });
    lancar(C.impostosVenda, 'EXEMPLO', fim, -0.0925 * soma(vendasRev), vendasRev, { documento: `Guia ${competenciaMes}`, historico: 'Impostos sobre o faturamento do mês', prazo: 20 });
    lancar(C.devolucoes, 'EXEMPLO', fim, -0.012 * soma(vendasRev), [[REVENDA, 1]], { documento: `Abatimentos ${competenciaMes}`, historico: 'Devoluções e bonificações a clientes', prazo: 0 });

    for (const dia of [3, 17]) {
      lancar(C.substrato, 'AR', dia, -(1.55 * blocos * g(C.substrato).entre(0.95, 1.05)) / 2, cogumeloPorBloco,
        { documento: nf(C.substrato), historico: 'Compra de serragem, farelo e calcário', prazo: dia === 3 ? g(C.substrato).inteiro(28, 45) : g(C.substrato).inteiro(60, 75) });
    }
    lancar(C.sementes, 'AR', 9, -0.45 * blocos * g(C.sementes).entre(0.95, 1.05), cogumeloPorBloco,
      { documento: nf(C.sementes), historico: 'Compra de spawn de laboratório', prazo: 35 });
    lancar(C.embalagens, 'AR', 11, -(0.42 * bandejasCog + 0.3 * vol.kgPimentao),
      [...ESPECIES.map((e): [Destino, number] => [COGUMELO(e), 0.42 * vol.especie[e].bandejas]), [PIMENTAO, 0.3 * vol.kgPimentao]],
      { documento: nf(C.embalagens), historico: 'Bandejas, filme e etiquetas', prazo: 28 });
    lancar(C.energia, 'AR', 15, -6800 * g(C.energia).entre(0.92, 1.08) * sazonal(idx, 1, 0.08),
      [...cogumeloPorBloco.map(([d, b]): [Destino, number] => [d, b * 0.9]), [PIMENTAO, blocos * 0.1]],
      { documento: titulo(C.energia), historico: 'Conta de energia da produção', prazo: 10 });
    lancar(C.maoDeObra, 'AR', fim, -16000 * (1 + 0.05 * Math.floor((idx - IDX_BASE) / 12)) * g(C.maoDeObra).entre(0.99, 1.02),
      [...cogumeloPorBloco.map(([d, b]): [Destino, number] => [d, b * 0.82]), [PIMENTAO, blocos * 0.18]],
      { documento: `Folha ${competenciaMes}`, historico: 'Folha e encargos da equipe de produção', prazo: 5 });
    const compras = vol.revenda.reduce((s, p) => s + p.qtd * p.custoMes, 0);
    for (const dia of [2, 12, 22]) {
      lancar(C.mercadorias, 'EXEMPLO', dia, -(compras / 3) * g(C.mercadorias).entre(0.95, 1.05), [[REVENDA, 1]],
        { documento: nf(C.mercadorias), historico: 'Compra de mercadorias de fornecedores', prazo: 30 });
    }
    lancar(C.insumosPimentao, 'AR', 6, -0.18 * vol.kgPimentao * vol.precoPimentao, [[PIMENTAO, 1]],
      { documento: nf(C.insumosPimentao), historico: 'Adubos, mudas e defensivos', prazo: 30 });

    lancar(C.fretes, 'AR', 25, -0.03 * soma(vendasAR), vendasAR, { documento: titulo(C.fretes), historico: 'Fretes de entrega a clientes', prazo: 15 });
    lancar(C.fretes, 'EXEMPLO', 25, -0.026 * soma(vendasRev), vendasRev, { documento: titulo(C.fretes), historico: 'Fretes de entrega a clientes', prazo: 15 });
    lancar(C.combustivel, 'AR', 18, -3900 * g(C.combustivel).entre(0.9, 1.1), [[SEM_QUEBRA, 55], [REVENDA, 45]],
      { documento: titulo(C.combustivel), historico: 'Combustível e manutenção da frota', prazo: 12 });
    const gm = g(C.manutencao);
    lancar(C.manutencao, 'AR', 22, -gm.entre(1300, 3600) * (gm.proximo() < 0.15 ? 2.5 : 1), [[SEM_QUEBRA, 1]],
      { documento: titulo(C.manutencao), historico: 'Manutenção de autoclave, câmaras e climatização', prazo: 10 });
    lancar(C.comissoes, 'EXEMPLO', fim, -0.025 * soma(vendasRev), [[REVENDA, 1]],
      { documento: `Comissões ${competenciaMes}`, historico: 'Comissões dos representantes', prazo: 10 });

    const rateio = RATEIO_COMPARTILHADO.flatMap(([n, p]): Array<[Destino, number]> =>
      (n === 'COGUMELO' ? cogumeloPorVenda.map(([d, w]): [Destino, number] => [d, (p * w) / ESPECIES.reduce((s, e) => s + pesoDaEspecie(e), 0)])
        : n === 'PIMENTAO' ? [[PIMENTAO, p]] : [[destino(n), p]]));
    const anos = Math.floor((idx - IDX_BASE) / 12);
    lancar(C.salariosAdm, 'AR', fim, -12000 * (1 + 0.05 * anos), rateio, { documento: `Folha ${competenciaMes}`, historico: 'Folha e encargos da administração', prazo: 5 });
    lancar(C.aluguel, 'EXEMPLO', 5, -5200 * (1 + 0.045 * Math.floor((idx - IDX_BASE + 6) / 12)), rateio, { documento: titulo(C.aluguel), historico: 'Aluguel do galpão e do escritório', prazo: 0 });
    lancar(C.contabilidade, 'AR', 10, -2200, rateio, { documento: titulo(C.contabilidade), historico: 'Honorários contábeis', prazo: 0 });
    lancar(C.sistemas, 'EXEMPLO', 8, -1100 * g(C.sistemas).entre(0.97, 1.03), rateio, { documento: titulo(C.sistemas), historico: 'Sistemas, internet e telefonia', prazo: 2 });
    lancar(C.seguros, 'AR', 15, -700, rateio, { documento: titulo(C.seguros), historico: 'Seguro patrimonial e de veículos', prazo: 0 });

    lancar(C.irpj, 'EXEMPLO', fim, -0.011 * (soma(vendasAR) + soma(vendasRev)), [[CORPORATIVO, 1]], { documento: `Guia ${competenciaMes}`, historico: 'IRPJ e CSLL do mês', prazo: 20 });
    lancar(C.rendimentos, 'EXEMPLO', 28, g(C.rendimentos).entre(380, 620), [[CORPORATIVO, 1]], { documento: 'Extrato', historico: 'Rendimento da aplicação automática', prazo: 0 });
    lancar(C.juros, 'AR', 10, -g(C.juros).entre(520, 900), [[CORPORATIVO, 1]], { documento: 'Extrato', historico: 'Juros do capital de giro', prazo: 0 });
    lancar(C.juros, 'AR', 3, -g(C.juros).entre(35, 95), [[CORPORATIVO, 1]], { documento: 'Extrato', historico: 'Tarifa de manutenção de conta', prazo: 0, soCaixa: true });

    if (idx % 24 === 3) lancar(C.emprestimo, 'AR', 10, 60000, [[NAO_RATEADO, 1]], { documento: 'Contrato 0412', historico: 'Capital de giro liberado pelo banco' });
    lancar(C.amortizacao, 'AR', 10, -2750, [[NAO_RATEADO, 1]], { documento: 'Contrato 0412', historico: 'Parcela do capital de giro' });
    if (idx % 7 === 2) lancar(C.maquinas, 'AR', 16, -g(C.maquinas).entre(18000, 32000), [[SEM_QUEBRA, 1]], { documento: nf(C.maquinas), historico: 'Compra de equipamento da produção' });
    if (idx % 5 === 1) lancar(C.obras, 'AR', 20, -g(C.obras).entre(5000, 14000), [[SEM_QUEBRA, 1]], { documento: nf(C.obras), historico: 'Reforma e ampliação das salas' });
    if (idx % 3 === 0) lancar(C.lucros, 'EXEMPLO', 15, -12000, [[NAO_RATEADO, 1]], { documento: 'Ata dos sócios', historico: 'Distribuição de lucros do trimestre' });
    if (idx % 12 === 9) lancar(C.aporte, 'AR', 15, 15000, [[NAO_RATEADO, 1]], { documento: 'Ata dos sócios', historico: 'Aporte para capital de giro' });

    razao.push(...doMes);
  }
  return razao;
}

let razaoEmCache: Lancamento[] | null = null;
const razao = () => (razaoEmCache ??= gerarRazao());

const fatoEmCache = new Map<Regime, Fato[]>();
function fato(regime: Regime): Fato[] {
  const pronto = fatoEmCache.get(regime);
  if (pronto) return pronto;
  const saida: Fato[] = [];
  for (const l of razao()) {
    if (regime === 'COMPETENCIA' ? l.soCaixa : l.data_liquidacao == null) continue;
    const mes = (regime === 'COMPETENCIA' ? l.data_competencia : l.data_liquidacao!).slice(0, 7);
    for (const f of l.fatias) saida.push({ f, mes });
  }
  fatoEmCache.set(regime, saida);
  return saida;
}

const GRAMAS_POR_BANDEJA = 200;
const DIAS_DE_COLHEITA = 30;
const DIAS_DE_INOCULACAO = [7, 14, 21, 28];
const MATURACAO: Record<Especie, number> = { SH: 75, SP: 35, SB: 35 };
const KG_POR_BLOCO: Record<Especie, number> = { SH: 0.12, SP: 0.165, SB: 0.155 };

interface Colheita { data: string; mes: string; gramas: number; faixas: [number, number, number, number] }
interface LoteDaDemo {
  chave: string; data_lote: string; mes: string; tipo: Especie;
  produzidos: number; contaminados: number; perdidos: number;
  abertura: string; aberto: boolean; abertos: number; colhendo: boolean; colheitas: Colheita[];
}

function gerarLotes(): LoteDaDemo[] {
  const lotes: LoteDaDemo[] = [];
  for (let idx = IDX_INICIO - 4; idx <= IDX_HOJE; idx += 1) {
    const v = volumesDoMes(idx).especie;
    for (const e of ESPECIES) {
      const g = gerador(9000 + idx * 10 + ESPECIES.indexOf(e));
      const faixas = [g.entre(0.14, 0.22), g.entre(0.4, 0.48), g.entre(0.24, 0.3)];
      for (const [i, dia] of DIAS_DE_INOCULACAO.entries()) {
        const data_lote = dataDe(idx, dia);
        if (data_lote > HOJE) continue;
        const quarto = (n: number) => (i < 3 ? Math.floor(n / 4) : n - 3 * Math.floor(n / 4));
        const produzidos = quarto(v[e].blocos);
        const contaminados = quarto(v[e].contaminados);
        const perdidos = Math.round(produzidos * g.entre(0.005, 0.015));
        const abertura = somarDias(data_lote, MATURACAO[e] + g.inteiro(-4, 4));
        const aberto = abertura <= HOJE;
        const abertos = aberto ? produzidos - contaminados - perdidos : 0;
        const gramas = Math.round(abertos * KG_POR_BLOCO[e] * sazonal(idxDe(abertura), 7, 0.1) * g.entre(0.9, 1.1) * 1000);
        const partes = [Math.round(gramas * 0.4), Math.round(gramas * 0.35)];
        const colheitas = ([[10, partes[0]], [18, partes[1]], [27, gramas - partes[0] - partes[1]]] as const).map(([d, gr]): Colheita => {
          const data = somarDias(abertura, d);
          const p = e === 'SH' ? faixas.map((f) => Math.round(gr * f)) : [0, 0, 0];
          return { data, mes: data.slice(0, 7), gramas: gr, faixas: e === 'SH' ? [p[0], p[1], p[2], gr - p[0] - p[1] - p[2]] : [0, 0, 0, 0] };
        }).filter((c) => c.data <= HOJE && c.gramas > 0);
        lotes.push({
          chave: `${data_lote}|${e}`, data_lote, mes: data_lote.slice(0, 7), tipo: e, produzidos, contaminados, perdidos,
          abertura, aberto, abertos, colhendo: aberto && somarDias(abertura, DIAS_DE_COLHEITA) > HOJE, colheitas,
        });
      }
    }
  }
  return lotes;
}
let lotesEmCache: LoteDaDemo[] | null = null;
const lotesDaDemo = () => (lotesEmCache ??= gerarLotes());

const somaDe = <T,>(xs: T[], fn: (x: T) => number) => xs.reduce((s, x) => s + fn(x), 0);
const gramasDo = (l: LoteDaDemo) => somaDe(l.colheitas, (c) => c.gramas);
const bandejasDa = (c: Colheita) => Math.round(c.gramas / GRAMAS_POR_BANDEJA);
const aproveitadosDo = (l: LoteDaDemo) => l.produzidos - l.contaminados - l.perdidos;

function vendasDoMes(mes: string) {
  const producao = new Map<Especie, { bandejas: number; cent: number }>(ESPECIES.map((e) => [e, { bandejas: 0, cent: 0 }]));
  const revenda = new Map<string, { bandejas: number; cent: number }>();
  for (const l of razao()) {
    if (!l.venda || l.data_competencia.slice(0, 7) !== mes) continue;
    const a = l.conta === C.cogumelos ? producao.get(l.venda.produto as Especie)
      : l.conta === C.revenda ? (revenda.get(l.venda.produto) ?? revenda.set(l.venda.produto, { bandejas: 0, cent: 0 }).get(l.venda.produto)) : undefined;
    if (!a) continue;
    a.bandejas += l.venda.quantidade;
    a.cent += l.cent;
  }
  return { producao, revenda };
}

const ATIVIDADES: Array<{ chave: AtividadeChave; rotulo: string }> = [
  { chave: 'PRODUCAO_COGUMELO', rotulo: 'Produção · Cogumelo' },
  { chave: 'PIMENTAO', rotulo: 'Produção · Pimentão' },
  { chave: 'PRODUCAO_SEM_QUEBRA', rotulo: 'Produção · sem divisão por produto' },
  { chave: 'REVENDA', rotulo: 'Revenda' },
  { chave: 'CORPORATIVO', rotulo: 'Estrutura não rateada (corporativo)' },
  { chave: 'NAO_RATEADO', rotulo: 'Ainda sem divisão por negócio' },
];
const DE_PRODUCAO: AtividadeChave[] = ['PRODUCAO_COGUMELO', 'PIMENTAO', 'PRODUCAO_SEM_QUEBRA'];
const VARIEDADES: ChaveDaVariedade[] = ['SH', 'SP', 'SB', 'SS', 'SEM_ESPECIE'];

function chaveDe(f: Destino): AtividadeChave {
  if (f.negocio === 'PRODUCAO') return f.produto === 'COGUMELO' ? 'PRODUCAO_COGUMELO' : f.produto === 'PIMENTAO' ? 'PIMENTAO' : 'PRODUCAO_SEM_QUEBRA';
  return f.negocio;
}
const variedadeDe = (f: Destino): ChaveDaVariedade => f.especie ?? 'SEM_ESPECIE';
const naVisao = (visao: VisaoNova) => (f: Destino) =>
  visao === 'consolidado' || f.negocio === (visao === 'producao' ? 'PRODUCAO' : 'REVENDA');

interface Recorte { inicio: string; fim: string; visao: VisaoNova; regime: Regime; atividade?: AtividadeChave | null; empresa?: Empresa | null }
function fatiasDo(r: Recorte): Fato[] {
  const meses = new Set(mesesDoIntervalo(r.inicio, r.fim));
  const visao = naVisao(r.visao);
  return fato(r.regime).filter((x) => meses.has(x.mes) && visao(x.f)
    && (!r.atividade || chaveDe(x.f) === r.atividade) && (!r.empresa || x.f.lan.empresa === r.empresa));
}
const mesesSemFato = (meses: string[], regime: Regime) => {
  const com = new Set(fato(regime).map((x) => x.mes));
  return meses.filter((m) => !com.has(m));
};
function mesesProvisorios(meses: string[], regime: Regime): MesProvisorio[] {
  const abertos = new Set([mesDe(IDX_HOJE - 1), mesDe(IDX_HOJE)]);
  const semFato = new Set(mesesSemFato(meses, regime));
  const ultimo = ultimoLancamento();
  return meses.filter((m) => abertos.has(m) && !semFato.has(m)).map((mes) => ({
    mes,
    motivos: ['A gestão ainda não fechou o mês: os números podem mudar.', `Último movimento carregado: ${ultimo.slice(8, 10)}/${ultimo.slice(5, 7)}/${ultimo.slice(0, 4)}.`],
  }));
}
const ultimoLancamento = () => razao().reduce((m, l) => (l.data_competencia > m ? l.data_competencia : m), '');

const CAMPO_DO_GRUPO: Record<number, keyof Escada> = {
  1: 'receita_bruta', 2: 'deducoes', 3: 'custos_diretos', 4: 'despesas_diretas', 5: 'despesas_compartilhadas',
  6: 'impostos', 7: 'financeiro', 8: 'ajustes_financeiros', 9: 'capex', 10: 'socios',
};
type Somas = Record<number, number>;
const somasZeradas = (): Somas => Object.fromEntries(GRUPOS.map((g) => [g.n, 0]));
const totaisDe = (s: Somas) => {
  const rl = s[1] + s[2];
  const ro = rl + s[3] + s[4] + s[5];
  return { rl, ro, rc: ro + s[6] + s[7] };
};
function fecharEscada(s: Somas, comMargem = true): Escada {
  const { rl, ro, rc } = totaisDe(s);
  const margem = comMargem && rl > 0;
  const e = Object.fromEntries(GRUPOS.map((g) => [CAMPO_DO_GRUPO[g.n], reais(s[g.n])])) as unknown as Escada;
  return {
    receita_bruta: e.receita_bruta, deducoes: e.deducoes, receita_liquida: reais(rl),
    custos_diretos: e.custos_diretos, despesas_diretas: e.despesas_diretas, despesas_compartilhadas: e.despesas_compartilhadas,
    resultado_operacional: reais(ro), margem_operacional_pct: margem ? pct(ro, rl) : null,
    impostos: e.impostos, financeiro: e.financeiro, resultado_competencia: reais(rc), margem_pct: margem ? pct(rc, rl) : null,
    ajustes_financeiros: e.ajustes_financeiros, capex: e.capex, socios: e.socios,
    resultado_caixa: reais(rc + s[8] + s[9] + s[10]),
  };
}
function escadaDe(fatias: Fato[]): EscadaPorAtividade {
  const total = somasZeradas();
  const porAtividade = new Map(ATIVIDADES.map((a) => [a.chave, somasZeradas()]));
  const porVariedade = new Map(VARIEDADES.map((v) => [v, somasZeradas()]));
  for (const { f } of fatias) {
    const g = f.lan.conta.grupo;
    total[g] += f.cent;
    porAtividade.get(chaveDe(f))![g] += f.cent;
    if (chaveDe(f) === 'PRODUCAO_COGUMELO') porVariedade.get(variedadeDe(f))![g] += f.cent;
  }
  const producao = somasZeradas();
  for (const k of DE_PRODUCAO) for (const g of GRUPOS) producao[g.n] += porAtividade.get(k)![g.n];
  return {
    total: fecharEscada(total),
    por_atividade: {
      ...Object.fromEntries([...porAtividade].map(([k, s]) => [k, fecharEscada(s, k !== 'CORPORATIVO')])),
      PRODUCAO: fecharEscada(producao),
    } as Record<ChaveDaEscadaPorAtividade, Escada>,
    por_variedade: Object.fromEntries([...porVariedade].map(([k, s]) => [k, fecharEscada(s)])) as Record<ChaveDaVariedade, Escada>,
  };
}

function porComportamento(fatias: Fato[]) {
  let fixo = 0;
  let variavel = 0;
  for (const { f } of fatias) {
    if (f.lan.conta.comportamento === 'FIXO') fixo += f.cent;
    else if (f.lan.conta.comportamento === 'VARIAVEL') variavel += f.cent;
  }
  return { fixo, variavel };
}
function economiaDe(fatias: Fato[]) {
  const rl = fatias.reduce((s, { f }) => s + (blocoDe(f.lan.conta) === 'receita' ? f.cent : 0), 0);
  const { fixo, variavel } = porComportamento(fatias);
  const fixos = Math.abs(fixo);
  const mc = rl + variavel;
  const pe = rl > 0 && mc > 0 && fixos !== 0 ? Math.round(fixos / (mc / rl)) : null;
  return { rl, fixos, variaveis: Math.abs(variavel), mc, pe };
}
function recorteDaEconomia(fatias: Fato[]): EconomiaDoRecorte {
  const { rl, fixos, variaveis, mc, pe } = economiaDe(fatias);
  const situacao = !(rl > 0) ? 'SEM_RECEITA' : mc <= 0 ? 'ECONOMIA_RUIM' : fixos === 0 ? 'SEM_CUSTO_FIXO'
    : rl < (pe ?? 0) ? 'ABAIXO_DA_ESCALA' : 'ACIMA_DO_EQUILIBRIO';
  return {
    receita: reais(rl), variaveis: reais(variaveis), fixos: reais(fixos),
    margem_contribuicao: rl > 0 ? reais(mc) : null, margem_contribuicao_pct: rl > 0 ? pct(mc, rl) : null,
    ponto_equilibrio: pe == null ? null : reais(pe),
    falta_para_equilibrio: situacao === 'ABAIXO_DA_ESCALA' && pe != null ? reais(pe - rl) : null,
    situacao, linhas_pendentes: 0,
  };
}

const PREMISSAS_DAS_ALAVANCAS = [
  'Quantidades constantes: nenhuma alavanca considera mudança no volume vendido ou produzido no período.',
  'Custos e despesas variam proporcionalmente ao gap a fechar, sem degraus nem custo marginal.',
  'Preço: o aumento percentual é aplicado sobre a receita atual, mantendo a composição das vendas.',
  'Contaminação: impacto = blocos recuperáveis × custo médio do bloco; blocos recuperáveis = (taxa − meta) / 100 × blocos produzidos, arredondado.',
  'Combinação: a contaminação é aplicada primeiro; o restante do gap é repartido pelas alavancas de preço, custos e despesas, cada uma isolada das demais.',
];
const r3 = (v: number) => Math.round((v + Number.EPSILON) * 1000) / 1000;
const pctSobre = (num: number, den: number, sinal: number) => (den ? r3(sinal * (num / den) * 100) : null);
function alavancas(p: { receita: number; variaveis: number; fixos: number; custos: number; despesas: number; resultado: number; objetivo: number;
  contaminacao: { taxa_pct: number | null; meta_pct: number; blocos: number; custoBloco: number | null } }): AlavancasResposta {
  const nada = { preco: null, custos: null, despesas: null, contaminacao: null, combinacao: null };
  if (!p.receita) return { objetivo_pct: p.objetivo, resultado_alvo: null, gap: null, ja_atingido: false, ...nada, premissas: [...PREMISSAS_DAS_ALAVANCAS] };
  const alvo = Math.round((p.objetivo / 100) * p.receita);
  const gap = alvo - p.resultado;
  if (gap <= 0) return { objetivo_pct: p.objetivo, resultado_alvo: reais(alvo), gap: reais(gap), ja_atingido: true, ...nada, premissas: [...PREMISSAS_DAS_ALAVANCAS, 'meta já atingida no período: nenhuma alavanca adicional é necessária.'] };
  const necessaria = Math.round((p.variaveis + p.fixos) / (1 - p.objetivo / 100));
  const { taxa_pct: taxa, meta_pct: meta, blocos, custoBloco } = p.contaminacao;
  const aplica = taxa != null && custoBloco != null && taxa > meta;
  const recuperaveis = aplica ? Math.round(((taxa! - meta) / 100) * blocos) : 0;
  const impacto = recuperaveis * (custoBloco ?? 0);
  const restante = Math.max(gap - (aplica ? impacto : 0), 0);
  return {
    objetivo_pct: p.objetivo, resultado_alvo: reais(alvo), gap: reais(gap), ja_atingido: false,
    preco: { pct: r3((necessaria / p.receita - 1) * 100), reais: reais(necessaria - p.receita), receita_necessaria: reais(necessaria) },
    custos: p.custos ? { reais: reais(-gap), pct: pctSobre(gap, p.custos, -1) } : null,
    despesas: p.despesas ? { reais: reais(-gap), pct: pctSobre(gap, p.despesas, -1) } : null,
    contaminacao: taxa != null && custoBloco != null
      ? { taxa_pct: taxa, meta_pct: meta, blocos_recuperaveis: recuperaveis, impacto_reais: reais(impacto), cobre_gap: impacto >= gap } : null,
    combinacao: {
      aplicada: aplica ? 'CONTAMINACAO' : null, recupera: reais(aplica ? impacto : 0), restante: reais(restante),
      complementos: { custos_pct: pctSobre(restante, p.custos, -1), despesas_pct: pctSobre(restante, p.despesas, -1), preco_pct: pctSobre(restante, p.receita, 1) },
    },
    premissas: [...PREMISSAS_DAS_ALAVANCAS],
  };
}

let margemDesejada = 20;
const MARGEM_MINIMA = 15;
const META_CONTAMINACAO = 5;
export const getMargemDesejada = async () => ({ margem_desejada: margemDesejada });
export const putMargemDesejada = async (valor: number) => { margemDesejada = valor; return { margem_desejada: margemDesejada }; };

const LIMIARES_ALERTA = { atencao_pct: 15, critico_pct: 30, piso_reais: 500, minimo_meses: 3 };

function composicaoDe(fatias: Fato[]) {
  type Balde = Map<number, { cent: number; lans: Set<string> }>;
  const baldes = () => ({ receita: new Map(), custos: new Map(), despesas: new Map() } as Record<'receita' | 'custos' | 'despesas', Balde>);
  const total = baldes();
  const porAtividade = new Map(ATIVIDADES.map((a) => [a.chave, baldes()]));
  for (const { f } of fatias) {
    const bloco = blocoDe(f.lan.conta);
    if (!bloco) continue;
    for (const b of [total[bloco], porAtividade.get(chaveDe(f))![bloco]]) {
      const a = b.get(f.lan.conta.id) ?? { cent: 0, lans: new Set<string>() };
      a.cent += f.cent;
      a.lans.add(f.lan.id);
      b.set(f.lan.conta.id, a);
    }
  }
  const publicar = (b: Balde): LinhaComposicao[] => {
    const vivas = [...b].filter(([, a]) => a.cent !== 0);
    const soma = vivas.reduce((s, [, a]) => s + a.cent, 0);
    return vivas.map(([id, a]) => {
      const c = CONTA_POR_ID.get(id)!;
      return { linha_id: String(id), codigo_oficial: c.codigo, rotulo: c.rotulo, valor: reais(a.cent), participacao_pct: soma !== 0 ? pct(a.cent, soma) : null, quantidade_lancamentos: a.lans.size };
    }).sort((x, y) => Math.abs(y.valor) - Math.abs(x.valor));
  };
  const tres = (b: ReturnType<typeof baldes>) => ({ receita: publicar(b.receita), custos: publicar(b.custos), despesas: publicar(b.despesas) });
  return { ...tres(total), por_atividade: Object.fromEntries([...porAtividade].map(([k, b]) => [k, tres(b)])) as ExecutivoResposta['composicao']['por_atividade'] };
}

function folhasDe(fatias: Fato[]): ExecutivoLinhaFolha[] {
  const m = new Map<number, number>();
  for (const { f } of fatias) m.set(f.lan.conta.id, (m.get(f.lan.conta.id) ?? 0) + f.cent);
  return CONTAS.filter((c) => (m.get(c.id) ?? 0) !== 0)
    .map((c) => ({ linha_id: String(c.id), codigo_oficial: c.codigo, rotulo: c.rotulo, grupo: c.grupo, valor: reais(m.get(c.id)!) }));
}

function producaoDosMeses(meses: string[]) {
  const doPeriodo = lotesDaDemo().filter((l) => meses.includes(l.mes) && idxDe(l.mes) >= IDX_INICIO);
  const blocos = somaDe(doPeriodo, (l) => l.produzidos);
  const contaminados = somaDe(doPeriodo, (l) => l.contaminados);
  let bandejas = 0;
  for (const { f } of fato('COMPETENCIA')) {
    if (f.lan.venda && f.lan.conta === C.cogumelos && meses.includes(f.lan.data_competencia.slice(0, 7))) bandejas += f.lan.venda.quantidade;
  }
  return { blocos, contaminados, bandejas };
}

export async function getExecutivo(inicio: string, fim: string, visao: VisaoNova, regime: Regime = 'COMPETENCIA',
  atividade?: 'PRODUCAO_COGUMELO' | 'PIMENTAO'): Promise<ExecutivoResposta> {
  const meses = mesesDoIntervalo(inicio, fim);
  const doPeriodo = fatiasDo({ inicio, fim, visao, regime, atividade });
  const semFato = mesesSemFato(meses, regime);
  const meta = margemDesejada;
  const somas = somasZeradas();
  for (const { f } of doPeriodo) somas[f.lan.conta.grupo] += f.cent;
  const { rl, ro, rc } = totaisDe(somas);
  const custos = 0 - somas[3];
  const despesas = 0 - (somas[4] + somas[5]);
  const eco = economiaDe(doPeriodo);
  const margemOp = pct(ro, rl);

  let faturamentoParaMeta: number | null = null;
  const faltas: string[] = [];
  if (rl > 0) {
    const mcFrac = eco.mc / rl;
    if (mcFrac > meta / 100) faturamentoParaMeta = reais(Math.round(eco.fixos / (mcFrac - meta / 100)));
    else faltas.push(`a margem de contribuição (${pct(eco.mc, rl)}%) não supera a meta (${meta}%), então nenhum faturamento alcança a meta com esta estrutura de custos`);
  }

  const acc = new Map(ATIVIDADES.map((a) => [a.chave, { receita: 0, custos: 0, despesas: 0, resultado: 0, mc: 0 }]));
  const accMes = new Map<string, Map<AtividadeChave, { receita: number; custos: number; despesas: number; resultado: number }>>();
  for (const { f, mes } of doPeriodo) {
    const bloco = blocoDe(f.lan.conta);
    if (!bloco) continue;
    const k = chaveDe(f);
    const a = acc.get(k)!;
    a[bloco] += f.cent;
    a.resultado += f.cent;
    a.mc += bloco === 'receita' || f.lan.conta.comportamento === 'VARIAVEL' ? f.cent : 0;
    if (!accMes.has(mes)) accMes.set(mes, new Map());
    const am = accMes.get(mes)!;
    if (!am.has(k)) am.set(k, { receita: 0, custos: 0, despesas: 0, resultado: 0 });
    const x = am.get(k)!;
    x[bloco] += f.cent;
    x.resultado += f.cent;
  }
  const atividades = ATIVIDADES.map(({ chave, rotulo }) => {
    const a = acc.get(chave)!;
    return {
      chave, rotulo, receita: reais(a.receita), custos: reais(0 - a.custos), despesas: reais(0 - a.despesas), resultado: reais(a.resultado),
      margem_pct: chave !== 'CORPORATIVO' && a.receita > 0 ? pct(a.resultado, a.receita) : null,
      serie_mensal: meses.map((mes) => {
        if (semFato.includes(mes)) return { mes, receita: null, custos: null, despesas: null, resultado: null };
        const x = accMes.get(mes)?.get(chave) ?? { receita: 0, custos: 0, despesas: 0, resultado: 0 };
        return { mes, receita: reais(x.receita), custos: reais(0 - x.custos), despesas: reais(0 - x.despesas), resultado: reais(x.resultado) };
      }),
    };
  });
  const receitaTotal = [...acc.values()].reduce((s, a) => s + a.receita, 0);
  const mcTotal = [...acc.values()].reduce((s, a) => s + a.mc, 0);
  const mix = {
    receita: Object.fromEntries(ATIVIDADES.map(({ chave }) => [chave, receitaTotal !== 0 ? pct(acc.get(chave)!.receita, receitaTotal) : null])) as Record<AtividadeChave, number | null>,
    contribuicao: Object.fromEntries(ATIVIDADES.map(({ chave }) => [chave, mcTotal >= 100 ? pct(acc.get(chave)!.mc, mcTotal) : null])) as Record<AtividadeChave, number | null>,
    aviso: receitaTotal === 0 ? 'receita consolidada zero: a participação dos negócios na receita não é calculável.'
      : mcTotal < 100 ? 'margem de contribuição consolidada zero ou negativa: a participação de cada atividade não é calculável.' : null,
  };

  const cog = doPeriodo.filter(({ f }) => chaveDe(f) === 'PRODUCAO_COGUMELO');
  const economia = {
    por_negocio: Object.fromEntries(ATIVIDADES.map(({ chave }) => [chave, recorteDaEconomia(doPeriodo.filter(({ f }) => chaveDe(f) === chave))])),
    por_especie: Object.fromEntries(VARIEDADES.map((v) => [v, recorteDaEconomia(cog.filter(({ f }) => variedadeDe(f) === v))])) as Record<ChaveDaVariedade, EconomiaDoRecorte>,
  };

  const prod = producaoDosMeses(meses);
  const custosCogumelo = 0 - acc.get('PRODUCAO_COGUMELO')!.custos;
  const custoBloco = prod.blocos > 0 && custosCogumelo > 0 ? Math.round(custosCogumelo / prod.blocos) : null;
  const taxa = prod.blocos > 0 ? pct(prod.contaminados, prod.blocos) : null;
  const alavanca = (objetivo: number) => alavancas({
    receita: rl, variaveis: eco.variaveis, fixos: eco.fixos, custos: Math.max(custos, 0), despesas: Math.max(despesas, 0), resultado: ro, objetivo,
    contaminacao: { taxa_pct: taxa, meta_pct: META_CONTAMINACAO, blocos: prod.blocos, custoBloco },
  });
  const META = alavanca(meta);

  const ordem = atividades.filter((a) => a.margem_pct != null).sort((a, b) => b.margem_pct! - a.margem_pct!)
    .map((a) => ({ chave: a.chave, rotulo: a.rotulo, margem_pct: a.margem_pct!, acao: (a.margem_pct! < 0 ? 'REVISAR' : a.margem_pct! >= meta ? 'PRIORIZAR' : 'MANTER') as 'PRIORIZAR' | 'MANTER' | 'REVISAR' }));
  const foraDaOrdem = atividades.filter((a) => a.margem_pct == null && (a.custos !== 0 || a.despesas !== 0));

  const fatiasPorMes = new Map<string, Fato[]>();
  for (const x of doPeriodo) fatiasPorMes.set(x.mes, [...(fatiasPorMes.get(x.mes) ?? []), x]);
  const serie_mensal = meses.map((mes) => {
    const fs = fatiasPorMes.get(mes) ?? [];
    const apurado = !semFato.includes(mes);
    const s = somasZeradas();
    for (const { f } of fs) s[f.lan.conta.grupo] += f.cent;
    const t = totaisDe(s);
    const e = economiaDe(fs);
    const porChave = new Map<string, Fato[]>();
    for (const x of fs) {
      const k = chaveDe(x.f);
      const chaves = [k, ...(DE_PRODUCAO.includes(k) ? ['PRODUCAO'] : []), ...(k === 'PRODUCAO_COGUMELO' ? [variedadeDe(x.f)] : [])];
      for (const c of chaves) porChave.set(c, [...(porChave.get(c) ?? []), x]);
    }
    return {
      mes,
      receita_liquida: apurado ? reais(t.rl) : null,
      custos: apurado ? reais(0 - s[3]) : null,
      despesas: apurado ? reais(0 - (s[4] + s[5])) : null,
      resultado_operacional: apurado ? reais(t.ro) : null,
      margem_pct: apurado ? pct(t.ro, t.rl) : null,
      ponto_equilibrio: apurado && e.pe != null ? reais(e.pe) : null,
      margem_seguranca_reais: apurado && e.pe != null ? reais(t.rl - e.pe) : null,
      margem_seguranca_pct: apurado && e.pe != null && t.rl ? pct(t.rl - e.pe, t.rl) : null,
      escada: apurado ? escadaDe(fs) : null,
      linhas: apurado ? folhasDe(fs) : [],
      linhas_por_chave: apurado ? Object.fromEntries([...porChave].map(([k, v]) => [k, folhasDe(v)])) : {},
    };
  });

  const grupo3 = CONTAS.filter((c) => c.grupo === 3);
  const valorDa = (c: Conta) => doPeriodo.reduce((s, { f }) => s + (f.lan.conta === c ? f.cent : 0), 0);
  const filhos = grupo3.map((c) => [c, valorDa(c)] as const).filter(([, v]) => v !== 0);
  const somaFilhos = filhos.reduce((s, [, v]) => s + v, 0);
  const composicao_custos = filhos.map(([c, v]) => ({ linha_id: String(c.id), rotulo: c.rotulo, valor: reais(v), participacao_pct: pct(v, somaFilhos) }))
    .sort((a, b) => Math.abs(b.valor) - Math.abs(a.valor));

  const pe = eco.pe;
  return {
    periodo: { inicio, fim, meses },
    visao, regime, etiqueta: regime === 'CAIXA' ? '[CAIXA]' : '[COMPETÊNCIA]',
    meses_sem_fato: semFato,
    cadeia_aplicada: true,
    aconteceu: {
      receita_liquida: reais(rl), custos: reais(custos), despesas: reais(despesas), resultado_operacional: reais(ro), resultado_liquido: reais(rc),
      financeiro_e_ajustes: reais(rc - ro), custos_pct: pct(custos, rl), despesas_pct: pct(despesas, rl), margem_liquida_pct: margemOp,
      meta_pct: meta, meta_origem: 'MARGEM_DESEJADA', margem_minima_pct: MARGEM_MINIMA, margem_desejada_configurada_pct: meta,
      atinge_meta: margemOp == null ? null : margemOp >= meta,
      composicao: { custos_codigos: ['L020'], despesas_codigos: ['L040', 'L060'] },
    },
    objetivos: {
      ponto_equilibrio: pe == null ? null : reais(pe), margem_seguranca_pct: pe != null ? pct(rl - pe, rl) : null,
      margem_seguranca_reais: pe != null ? reais(rl - pe) : null, margem_desejada_pct: meta, faturamento_para_meta: faturamentoParaMeta,
      disponivel: faltas.length === 0, faltas, fixos: reais(eco.fixos), variaveis: reais(eco.variaveis),
      margem_contribuicao: reais(eco.mc), margem_contribuicao_pct: pct(eco.mc, rl),
    },
    atividades, mix, economia,
    caminhos: {
      mantendo_mix: {
        faturamento_para_meta: faturamentoParaMeta,
        premissas: [
          'Participação dos negócios na receita e estrutura de custos (fixos e variáveis) constantes: só a receita cresce.',
          'Faturamento para a meta = custos fixos ÷ (margem de contribuição % − meta %).',
        ],
      },
      melhorando_eficiencia: {
        recuperar_reais: META.gap != null ? Math.max(META.gap, 0) : null,
        perdas_recuperaveis: META.contaminacao?.impacto_reais ?? null,
        custos_e_despesas: reais(Math.max(custos, 0) + Math.max(despesas, 0)),
        premissas: [
          'Recuperar = resultado-alvo (meta × receita líquida) − resultado operacional, com a receita atual.',
          'Perdas recuperáveis = blocos acima da meta de contaminação × custo médio do bloco.',
          'Custos e despesas = a base atual sobre a qual o corte incide (cadeia de T01 a T03). Crédito (custo ou despesa negativo) não entra: não há o que cortar nele.',
        ],
      },
      otimizando_mix: {
        ordem,
        premissas: [
          'capacidade e demanda não medidas: a ordem diz qual atividade rende mais por real de receita, não quanto cada uma pode crescer.',
          ...foraDaOrdem.map((a) => `${a.rotulo}: não tem receita própria, então fica fora da ordem acima, mas o valor dela está no resultado.`),
        ],
      },
    },
    alavancas: { EQUILIBRIO: alavanca(0), META },
    composicao_custos,
    composicao: composicaoDe(doPeriodo),
    escada: escadaDe(doPeriodo),
    serie_mensal,
    limiares_alerta: LIMIARES_ALERTA,
    contaminacao: {
      taxa_pct: taxa, meta_pct: META_CONTAMINACAO, blocos_produzidos: prod.blocos, blocos_contaminados: prod.contaminados,
      custo_medio_bloco: custoBloco == null ? null : reais(custoBloco),
      premissa: 'Taxa = blocos contaminados ÷ blocos produzidos dos lotes INOCULADOS no período (lote recente ainda não mostrou toda a contaminação). '
        + 'Custo médio do bloco = custos diretos da atividade PRODUCAO_COGUMELO no período ÷ blocos produzidos: média do período, não o custo de um lote.',
    },
    volume: {
      kg: prod.bandejas ? Math.round(prod.bandejas * 0.2) : null, bandejas: prod.bandejas || null,
      mc_por_kg: prod.bandejas ? reais(Math.round(eco.mc / (prod.bandejas * 0.2))) : null,
      mc_por_bandeja: prod.bandejas ? reais(Math.round(eco.mc / prod.bandejas)) : null,
    },
    avisos: [],
    atividade: atividade ?? null,
    ultimo_lancamento: ultimoLancamento(),
    logistica: null,
    direcionador_especie: null,
    folha_pendente: [],
    meses_provisorios: mesesProvisorios(meses, regime),
    linhas_da_folha: [C.maoDeObra, C.salariosAdm].map((c) => ({ linha_id: String(c.id), codigo_oficial: c.codigo, rotulo: c.rotulo })),
  };
}

export async function getCaixa(inicio: string, fim: string, visao: VisaoNova, empresa?: Empresa): Promise<CaixaResposta> {
  const meses = mesesDoIntervalo(inicio, fim);
  const porMes = new Map(meses.map((m) => [m, { e: 0, s: 0 }]));
  const porAtividade = new Map(ATIVIDADES.map((a) => [a.chave, { e: 0, s: 0 }]));
  let entradas = 0;
  let saidas = 0;
  for (const { f, mes } of fatiasDo({ inicio, fim, visao, regime: 'CAIXA', empresa })) {
    const m = porMes.get(mes)!;
    const a = porAtividade.get(chaveDe(f))!;
    if (f.cent > 0) { entradas += f.cent; m.e += f.cent; a.e += f.cent; } else { saidas += f.cent; m.s += f.cent; a.s += f.cent; }
  }
  const emAberto = razao().filter((l) => l.data_liquidacao == null && !l.soCaixa && (!empresa || l.empresa === empresa));
  const receber = emAberto.filter((l) => l.cent > 0);
  const porMesEmissao = new Map<string, number>();
  for (const l of receber) porMesEmissao.set(l.data_competencia.slice(0, 7), (porMesEmissao.get(l.data_competencia.slice(0, 7)) ?? 0) + l.cent);
  const semFato = mesesSemFato(meses, 'CAIXA');
  return {
    periodo: { inicio, fim, meses }, visao, empresa: empresa ?? null, regime: 'CAIXA', etiqueta: '[CAIXA]',
    entradas: reais(entradas), saidas: reais(0 - saidas), resultado_caixa: reais(entradas + saidas),
    serie_mensal: [...porMes].map(([mes, m]) => ({ mes, entradas: reais(m.e), saidas: reais(0 - m.s), resultado: reais(m.e + m.s) })),
    atividades: ATIVIDADES.map(({ chave, rotulo }) => {
      const a = porAtividade.get(chave)!;
      return { chave, rotulo: chave === 'NAO_RATEADO' ? 'Sem negócio (sócios, adiantamentos, ajustes ou sem rateio)' : rotulo, entradas: reais(a.e), saidas: reais(0 - a.s), resultado: reais(a.e + a.s) };
    }),
    contas_a_receber: {
      total_em_aberto: reais(receber.reduce((s, l) => s + l.cent, 0)),
      por_empresa: {
        AR: reais(receber.filter((l) => l.empresa === 'AR').reduce((s, l) => s + l.cent, 0)),
        EXEMPLO: reais(receber.filter((l) => l.empresa === 'EXEMPLO').reduce((s, l) => s + l.cent, 0)),
      },
      por_mes_emissao: [...porMesEmissao].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([mes, c]) => ({ mes, valor: reais(c) })),
      data_do_export: ultimoLancamento(), vencido: null, a_vencer: null, faixas: null,
      pendente: 'exportação do Contas a Receber com Dt. Vencimento',
    },
    contas_a_pagar_em_aberto: { total: reais(Math.abs(emAberto.filter((l) => l.cent < 0).reduce((s, l) => s + l.cent, 0))) },
    aviso_fixo: 'Não representa "quanto posso gastar": compromissos futuros não registrados não estão considerados.',
    meses_sem_fato: semFato,
    avisos: semFato.length > 0 ? [`Sem fato de caixa em ${semFato.join(', ')}: o período soma só os meses apurados, não é caixa zero.`] : [],
    meses_provisorios: mesesProvisorios(meses, 'CAIXA'),
  };
}

type Baldes = { A: { a_receber: number; a_pagar: number }; B: { liquidado_fora_do_periodo: number; competencia_fora_do_periodo: number }; C: { so_caixa: number; fora_do_resultado: number } };

function montarPonte(inicio: string, fim: string, empresa: Empresa | null) {
  const dentro = (d: string | null) => d != null && d >= inicio && d <= fim;
  const lans = razao().filter((l) => (!empresa || l.empresa === empresa) && (dentro(l.data_competencia) || dentro(l.data_liquidacao)));
  let rc = 0;
  let rx = 0;
  const t: Baldes = { A: { a_receber: 0, a_pagar: 0 }, B: { liquidado_fora_do_periodo: 0, competencia_fora_do_periodo: 0 }, C: { so_caixa: 0, fora_do_resultado: 0 } };
  const exemplos: Record<'A' | 'B' | 'C', PonteExemplo[]> = { A: [], B: [], C: [] };
  for (const l of lans) {
    const comp = dentro(l.data_competencia);
    const liq = dentro(l.data_liquidacao);
    const r = entra(l.conta);
    if (!l.soCaixa && r && comp) rc += l.cent;
    if (liq) rx += l.cent;
    let balde: 'A' | 'B' | 'C' | null = null;
    if (l.soCaixa) { if (liq) { balde = 'C'; t.C.so_caixa -= l.cent; } }
    else if (comp && liq && r) balde = null;
    else if (comp && l.data_liquidacao == null && r) { balde = 'A'; t.A[l.cent > 0 ? 'a_receber' : 'a_pagar'] += l.cent; }
    else if (comp && !liq && r) { balde = 'B'; t.B.liquidado_fora_do_periodo += l.cent; }
    else if (!comp && liq && r) { balde = 'B'; t.B.competencia_fora_do_periodo -= l.cent; }
    else if (liq && !r) { balde = 'C'; t.C.fora_do_resultado -= l.cent; }
    if (balde) exemplos[balde].push({ documento: l.documento, codigo_conta: l.conta.erp, empresa: l.empresa, data_competencia: l.data_competencia, data_liquidacao: l.data_liquidacao, valor: reais(l.cent) });
  }
  const totalA = t.A.a_receber + t.A.a_pagar;
  const totalB = t.B.liquidado_fora_do_periodo + t.B.competencia_fora_do_periodo;
  const totalC = t.C.so_caixa + t.C.fora_do_resultado;
  const d = rc - rx;
  const top5 = (xs: PonteExemplo[]) => [...xs].sort((x, y) => Math.abs(y.valor) - Math.abs(x.valor)).slice(0, 5);
  return {
    periodo: { inicio, fim }, empresa, etiquetas: { competencia: '[COMPETÊNCIA]', caixa: '[CAIXA]' } as const,
    resultado_competencia: reais(rc), resultado_caixa: reais(rx), diferenca: reais(d),
    baldes: {
      a: { a_receber: reais(t.A.a_receber), a_pagar: reais(t.A.a_pagar), total: reais(totalA) },
      b: { liquidado_fora_do_periodo: reais(t.B.liquidado_fora_do_periodo), competencia_fora_do_periodo: reais(t.B.competencia_fora_do_periodo), total: reais(totalB) },
      c: { so_caixa: reais(t.C.so_caixa), fora_do_resultado: reais(t.C.fora_do_resultado), total: reais(totalC) },
    },
    conciliada: totalA + totalB + totalC === d,
    nao_conciliada: totalA + totalB + totalC === d ? 0 : reais(Math.abs(totalA + totalB + totalC - d)),
    fora_da_ponte: { sem_depara: { n: 0, valor: 0 }, sem_posicao: { n: 0, valor: 0 }, sem_peso_de_vendas: { n: 0, valor: 0, meses: [] } },
    exemplos: { a: top5(exemplos.A), b: top5(exemplos.B), c: top5(exemplos.C) },
    avisos: [],
    lancamentos_considerados: lans.length,
  };
}

function naturezaDaDiferenca(serie: Array<{ diferenca: number; lancamentos_considerados: number }>) {
  const apurados = serie.filter((m) => m.lancamentos_considerados > 0);
  const atual = serie[serie.length - 1];
  if (!atual || atual.lancamentos_considerados === 0) return { tipo: 'sem_base' as const, meses_apurados: apurados.length, frase: 'O mês analisado não tem lançamento (competência nem liquidação): sem base para dizer se a diferença é pontual ou recorrente.' };
  if (apurados.length < 3) return { tipo: 'sem_base' as const, meses_apurados: apurados.length, frase: `Só ${apurados.length} mês(es) com lançamento na janela: não dá para dizer se a diferença é pontual ou recorrente (precisa de 3).` };
  const anteriores = apurados.slice(0, -1);
  const sinal = (v: number) => (v > 0 ? 1 : v < 0 ? -1 : 0);
  const s = sinal(cents(atual.diferenca));
  const mesmos = anteriores.filter((m) => sinal(cents(m.diferenca)) === s);
  const mediana = (ms: typeof anteriores) => {
    const abs = ms.map((m) => Math.abs(cents(m.diferenca))).sort((a, b) => a - b);
    return abs.length % 2 ? abs[(abs.length - 1) / 2] : Math.round((abs[abs.length / 2 - 1] + abs[abs.length / 2]) / 2);
  };
  const n = apurados.length;
  if (s === 0) return { tipo: 'pontual' as const, meses_apurados: n, frase: `Este mês não teve diferença entre competência e caixa; nos ${anteriores.length} meses anteriores a mediana da diferença foi ${formatarReais(mediana(anteriores))}.` };
  const lado = s > 0 ? 'competência acima do caixa' : 'caixa acima da competência';
  if (mesmos.length * 3 >= anteriores.length * 2) return { tipo: 'recorrente' as const, meses_apurados: n, frase: `Recorrente: ${lado} em ${mesmos.length} dos ${anteriores.length} meses anteriores (mediana da diferença nesses meses ${formatarReais(mediana(mesmos))}).` };
  return { tipo: 'pontual' as const, meses_apurados: n, frase: `Pontual: ${lado} neste mês; nos ${anteriores.length} meses anteriores a diferença teve o mesmo sinal em ${mesmos.length} (mediana ${formatarReais(mediana(anteriores))}).` };
}

export async function getPonte(inicio: string, fim: string, empresa?: Empresa, serie?: number): Promise<PonteResposta> {
  const p: PonteResposta = montarPonte(inicio, fim, empresa ?? null);
  const meses = mesesDoIntervalo(inicio, fim);
  if (serie && serie > 0) {
    const ultimo = idxDe(fim);
    p.serie_mensal = Array.from({ length: serie }, (_, i) => ultimo - serie + 1 + i).map((idx) => {
      const m = montarPonte(`${mesDe(idx)}-01`, ultimoDia(idx), empresa ?? null);
      return { mes: mesDe(idx), resultado_competencia: m.resultado_competencia, resultado_caixa: m.resultado_caixa, diferenca: m.diferenca, lancamentos_considerados: m.lancamentos_considerados };
    });
    p.natureza = naturezaDaDiferenca(p.serie_mensal);
  }
  const provisorios = new Map<string, MesProvisorio>();
  for (const m of [...mesesProvisorios(meses, 'COMPETENCIA'), ...mesesProvisorios(p.serie_mensal?.map((s) => s.mes) ?? [], 'COMPETENCIA')]) provisorios.set(m.mes, m);
  p.meses_provisorios = [...provisorios.values()].sort((a, b) => (a.mes < b.mes ? -1 : 1));
  return p;
}

const FRENTE: Record<Negocio, 'PRODUCAO' | 'REVENDA' | 'CORPORATIVO' | 'NAO_RATEADO'> = { PRODUCAO: 'PRODUCAO', REVENDA: 'REVENDA', CORPORATIVO: 'CORPORATIVO', NAO_RATEADO: 'NAO_RATEADO' };
const ROTULO_DO_NEGOCIO: Record<string, string> = { PRODUCAO: 'Produção', REVENDA: 'Revenda', CORPORATIVO: 'Corporativo', NAO_RATEADO: 'Sem negócio', COGUMELO: 'Cogumelo', PIMENTAO: 'Pimentão', SH: 'Shiitake', SP: 'Shimeji Preto', SB: 'Shimeji Branco' };

function regraDe(l: Lancamento) {
  const total = l.fatias.reduce((s, f) => s + Math.abs(f.cent), 0) || 1;
  const parte = (chave: (f: Fatia) => string | null) => {
    const m = new Map<string, number>();
    for (const f of l.fatias) { const k = chave(f); if (k) m.set(k, (m.get(k) ?? 0) + Math.abs(f.cent)); }
    return [...m].map(([k, v]) => `${ROTULO_DO_NEGOCIO[k] ?? k} ${Math.round((v / total) * 100)}%`).join(', ');
  };
  const etapas = [`Negócio: ${l.fatias.length > 1 && new Set(l.fatias.map((f) => f.negocio)).size > 1 ? 'Rateio' : 'Direto'} (${parte((f) => f.negocio)})`];
  if (l.fatias.some((f) => f.produto)) etapas.push(`Produto: ${parte((f) => f.produto)}`);
  if (l.fatias.some((f) => f.especie)) etapas.push(`Espécie: ${parte((f) => f.especie)}`);
  return { etapas, confere: true };
}

const camposDoLancamento = (l: Lancamento) => ({
  lancamento_id: l.id, data_competencia: l.data_competencia, data_liquidacao: l.data_liquidacao, empresa: l.empresa,
  codigo_conta: l.conta.erp, documento: l.documento, historico: l.historico, origem: l.soCaixa ? 'SO_CAIXA' : 'CONSULTA',
  valor_lancamento: reais(l.cent),
});

function porLancamento(fatias: Fato[]) {
  const m = new Map<string, { l: Lancamento; cent: number; fatias: Fatia[] }>();
  for (const { f } of fatias) {
    const a = m.get(f.lan.id) ?? { l: f.lan, cent: 0, fatias: [] };
    a.cent += f.cent;
    a.fatias.push(f);
    m.set(f.lan.id, a);
  }
  return [...m.values()];
}

export async function getLancamentosDaLinha(p: { inicio: string; fim: string; visao: VisaoNova; linha_id: string; atividade?: AtividadeChave; regime?: Regime }): Promise<LancamentosDaLinhaResposta> {
  const regime = p.regime ?? 'COMPETENCIA';
  const c = CONTA_POR_ID.get(Number(p.linha_id));
  const lista = porLancamento(fatiasDo({ ...p, regime }).filter(({ f }) => f.lan.conta === c))
    .sort((a, b) => (a.l.data_competencia < b.l.data_competencia ? -1 : a.l.data_competencia > b.l.data_competencia ? 1 : 0));
  const lancamentos: LancamentoDaLinha[] = lista.map(({ l, cent, fatias }) => ({
    ...camposDoLancamento(l), valor_no_periodo: reais(cent),
    fatias: fatias.map((f) => ({ frente: FRENTE[f.negocio], produto: f.produto, especie: f.especie, valor: reais(f.cent) })).sort((a, b) => Math.abs(b.valor) - Math.abs(a.valor)),
    regra: regraDe(l),
  }));
  return {
    etiqueta: regime === 'CAIXA' ? '[CAIXA]' : '[COMPETÊNCIA]', regime, periodo: { inicio: p.inicio, fim: p.fim, meses: mesesDoIntervalo(p.inicio, p.fim) },
    visao: p.visao, atividade: p.atividade ?? null,
    linha: { linha_id: p.linha_id, codigo_oficial: c?.codigo ?? null, rotulo: c?.rotulo ?? null },
    quantidade: lancamentos.length, total: reais(lista.reduce((s, x) => s + x.cent, 0)), limite: 500, truncado: false, valor_cheio_so_gestao: false,
    lancamentos,
  };
}

const NUMERO_DO_GRUPO: Record<ChaveDoGrupo, number> = {
  receita_bruta: 1, deducoes: 2, custos_diretos: 3, despesas_diretas: 4, despesas_compartilhadas: 5,
  impostos: 6, financeiro: 7, ajustes_financeiros: 8, capex: 9, socios: 10,
};
export async function getLancamentosDoGrupo(p: { inicio: string; fim: string; visao: VisaoNova; grupo: ChaveDoGrupo; atividade?: AtividadeChave; regime?: Regime; limite?: number }): Promise<LancamentosDoGrupoResposta> {
  const regime = p.regime ?? 'COMPETENCIA';
  const numero = NUMERO_DO_GRUPO[p.grupo];
  const limite = p.limite ?? 200;
  const lista = porLancamento(fatiasDo({ ...p, regime }).filter(({ f }) => f.lan.conta.grupo === numero))
    .sort((a, b) => Math.abs(b.cent) - Math.abs(a.cent));
  return {
    etiqueta: regime === 'CAIXA' ? '[CAIXA]' : '[COMPETÊNCIA]', regime, periodo: { inicio: p.inicio, fim: p.fim, meses: mesesDoIntervalo(p.inicio, p.fim) },
    visao: p.visao, atividade: p.atividade ?? null, grupo: { chave: p.grupo, numero },
    total_lancamentos: lista.length, soma: reais(lista.reduce((s, x) => s + x.cent, 0)), limite, mostrando: Math.min(limite, lista.length),
    valor_cheio_so_gestao: false,
    lancamentos: lista.slice(0, limite).map(({ l, cent }) => ({
      ...camposDoLancamento(l), valor_no_periodo: reais(cent),
      linhas: [{ linha_id: String(l.conta.id), codigo_oficial: l.conta.codigo, rotulo: l.conta.rotulo }],
    })),
  };
}

export async function getPendenciasDeClassificacao(inicio: string, fim: string, regime?: Regime): Promise<PendenciasDeClassificacaoResposta> {
  return { regime: regime ?? 'COMPETENCIA', periodo: { inicio, fim }, quantidade: 0, total: 0, por_conta: [], lancamentos: [] };
}

const VISAO_NO_BANCO: Record<VisaoNova, string> = { consolidado: 'CONSOLIDADO', producao: 'PRODUCAO', revenda: 'REVENDA' };

export async function getDreNova(competencia: string, visao: VisaoNova, desde?: string): Promise<DreNovaResposta> {
  const inicio = (desde ?? competencia).slice(0, 7);
  const fim = competencia.slice(0, 7);
  const meses = mesesDoIntervalo(inicio, fim);
  const fatias = fatiasDo({ inicio, fim, visao, regime: 'COMPETENCIA' });
  const comColunas = visao === 'producao';
  const porConta = new Map<number, { cent: number; n: number; cog: number; pim: number; sem: number }>();
  for (const { f } of fatias) {
    const a = porConta.get(f.lan.conta.id) ?? { cent: 0, n: 0, cog: 0, pim: 0, sem: 0 };
    a.cent += f.cent;
    a.n += 1;
    if (f.produto === 'COGUMELO') a.cog += f.cent; else if (f.produto === 'PIMENTAO') a.pim += f.cent; else a.sem += f.cent;
    porConta.set(f.lan.conta.id, a);
  }
  const colunas = (cog: number, pim: number, sem: number): DreNovaColunas => ({ cogumelo: reais(cog), pimentao: reais(pim), sem_divisao: reais(sem), total: reais(cog + pim + sem) });
  const somaDosGrupos = (gs: number[]) => {
    const s = { cent: 0, cog: 0, pim: 0, sem: 0, n: 0 };
    for (const c of CONTAS) {
      if (!gs.includes(c.grupo)) continue;
      const a = porConta.get(c.id);
      if (a) { s.cent += a.cent; s.cog += a.cog; s.pim += a.pim; s.sem += a.sem; s.n += a.n; }
    }
    return s;
  };
  const base = { rotulo_catalogo: null, observacao: null, celula_origem: null, valor_atribuido: true } as const;
  const linhas: DreNovaLinha[] = [];
  let ordem = 0;
  for (const g of GRUPOS) {
    const s = somaDosGrupos([g.n]);
    ordem += 1;
    linhas.push({
      ...base, linha_id: Number(g.oficial.slice(1)), codigo_oficial: g.oficial, codigo: g.codigo, rotulo: g.rotulo, rotulo_catalogo: g.rotulo, tipo: 'GRUPO',
      numeracao: String(g.n), sinal: g.n === 1 ? 'SOMA' : 'SUBTRAI', entra_resultado: g.n <= 7, nivel: 1, ordem, profundidade: 1, linha_pai_id: null,
      valor: 0, valor_acumulado: reais(s.cent), cadeia_resolvida: null, quantidade_fatias: 0, tem_fato: false,
      colunas: comColunas ? colunas(0, 0, 0) : null, colunas_acumuladas: comColunas ? colunas(s.cog, s.pim, s.sem) : null,
    });
    CONTAS.filter((c) => c.grupo === g.n).forEach((c, i) => {
      const a = porConta.get(c.id) ?? { cent: 0, n: 0, cog: 0, pim: 0, sem: 0 };
      ordem += 1;
      linhas.push({
        ...base, linha_id: c.id, codigo_oficial: c.codigo, codigo: c.codigo.toLowerCase(), rotulo: c.rotulo, rotulo_catalogo: c.rotulo, tipo: 'CONTA',
        numeracao: `${g.n}.${i + 1}`, sinal: c.grupo === 1 ? 'SOMA' : 'SUBTRAI', entra_resultado: entra(c), nivel: 2, ordem, profundidade: 2, linha_pai_id: Number(g.oficial.slice(1)),
        valor: reais(a.cent), valor_acumulado: reais(a.cent), cadeia_resolvida: null, quantidade_fatias: a.n, tem_fato: a.n > 0,
        colunas: comColunas ? colunas(a.cog, a.pim, a.sem) : null, colunas_acumuladas: comColunas ? colunas(a.cog, a.pim, a.sem) : null,
      });
    });
    for (const t of TOTAIS.filter((x) => x.depoisDoGrupo === g.n)) {
      const s2 = somaDosGrupos(t.grupos);
      ordem += 1;
      linhas.push({
        ...base, linha_id: t.id, codigo_oficial: t.codigo, codigo: `total-${t.codigo.toLowerCase()}`, rotulo: t.rotulo, rotulo_catalogo: t.rotulo, tipo: 'TOTAL',
        numeracao: null, sinal: 'NAO_SE_APLICA', entra_resultado: true, nivel: 1, ordem, profundidade: 1, linha_pai_id: null,
        valor: 0, valor_acumulado: reais(s2.cent), cadeia_resolvida: true, quantidade_fatias: 0, tem_fato: false,
        colunas: comColunas ? colunas(0, 0, 0) : null, colunas_acumuladas: comColunas ? colunas(s2.cog, s2.pim, s2.sem) : null,
      });
    }
  }
  const totalCent = fatias.reduce((s, { f }) => s + f.cent, 0);
  const somas = somasZeradas();
  for (const { f } of fatias) somas[f.lan.conta.grupo] += f.cent;
  const { rl, ro } = totaisDe(somas);
  const eco = economiaDe(fatias);
  return {
    competencia,
    ...(desde ? { periodo: { inicio: `${inicio}-01`, fim: ultimoDia(idxDe(fim)), meses } } : {}),
    meses_sem_fato: mesesSemFato(meses, 'COMPETENCIA'),
    visao, visao_no_banco: VISAO_NO_BANCO[visao],
    fonte: { estrutura: 'plano de contas da demonstração', valor: 'razão inventado da demonstração', catalogo: 'plano de contas da demonstração' },
    quantidade_linhas: linhas.length, quantidade_linhas_com_fato: linhas.filter((l) => l.tem_fato).length, linhas,
    reconciliacao: {
      regra: 'Toda fatia da visão aparece numa linha: a soma das linhas é o total das fatias.', competencia, visao,
      total_fatias_da_visao: reais(totalCent), quantidade_fatias_da_visao: fatias.length, soma_linhas_exibidas: reais(totalCent),
      quantidade_fatias_exibidas: fatias.length, total_fora: 0, quantidade_fatias_fora: 0, fora: [], diferenca: 0, tolerancia: 0.005, confere: true,
      leitura_completa: { fatias_na_tabela: fatias.length, fatias_carregadas: fatias.length, confere: true, por_que: 'A contagem das fatias bate com a leitura.' },
      escopo: { criterio: `as fatias da visão ${visao}` },
    },
    cadeia_de_totais: {
      aplicada: true, disponivel_no_banco: true, componentes_cadastrados_nesta_visao: 17, componentes_cadastrados_no_total: 51,
      linhas_de_tipo_total_nesta_visao: TOTAIS.length, motivo: 'Cadeia de totais aplicada.', consequencia: 'Os totais saem da cadeia cadastrada.',
    },
    indicadores: {
      disponivel: rl > 0, motivo: rl > 0 ? null : 'Nao calculado por completo: sem receita líquida no período.',
      pre_requisitos: { cadeia_de_totais: true, comportamento: true }, linhas_sem_classificacao: 0, linhas_mistas: 0,
      margem_operacional_pct: pct(ro, rl), margem_contribuicao: rl > 0 ? eco.mc : null, margem_contribuicao_pct: rl > 0 ? pct(eco.mc, rl) : null,
      ponto_equilibrio: eco.pe, diferenca_para_o_ponto_de_equilibrio: eco.pe == null ? null : rl - eco.pe, custos_e_despesas_fixos: eco.pe == null ? null : eco.fixos,
    },
    avisos: [], defeitos: [], defeito: false, regime_apuracao: 'COMPETENCIA',
    meses_provisorios: mesesProvisorios(meses, 'COMPETENCIA'),
  };
}

export async function getDreNovaCompetencias(): Promise<DreNovaCompetenciasResposta> {
  const porMes = new Map<string, { n: number; cent: number }>();
  for (const { f, mes } of fato('COMPETENCIA')) {
    if (idxDe(mes) < IDX_INICIO) continue;
    const a = porMes.get(mes) ?? { n: 0, cent: 0 };
    a.n += 1;
    a.cent += f.cent;
    porMes.set(mes, a);
  }
  const competencias = [...porMes].sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([mes, a]) => ({ competencia: `${mes}-01`, rotulo: mes, quantidade_fatias: a.n, total: reais(a.cent) }));
  return {
    fonte: 'razão inventado da demonstração', regime_apuracao: 'COMPETENCIA',
    escopo: { visoes_permitidas: ['consolidado', 'producao', 'revenda'], criterio: 'gestão geral' },
    quantidade: competencias.length, mais_recente: competencias[0]?.competencia ?? null, competencias,
    aviso: '', visoes: ['consolidado', 'producao', 'revenda'],
  };
}

export async function getVendasPorProduto(inicio: string, fim: string): Promise<VendasPorProdutoResposta> {
  const meses = mesesDoIntervalo(inicio, fim);
  const doMes = new Map(meses.map((m) => [m, new Map<string, { q: number; cent: number }>()]));
  for (const l of razao()) {
    if (l.conta !== C.revenda || !l.venda) continue;
    const m = doMes.get(l.data_competencia.slice(0, 7));
    if (!m) continue;
    const a = m.get(l.venda.produto) ?? { q: 0, cent: 0 };
    a.q += l.venda.quantidade;
    a.cent += l.cent;
    m.set(l.venda.produto, a);
  }
  const comRelatorio = meses.filter((m) => idxDe(m) >= IDX_INICIO && idxDe(m) <= IDX_HOJE);
  const produtos = PRODUTOS_DA_REVENDA.map((p) => {
    const serie = meses.map((mes) => {
      const a = doMes.get(mes)!.get(p.codigo);
      return comRelatorio.includes(mes) ? { mes, quantidade: a?.q ?? 0, receita: reais(a?.cent ?? 0) } : { mes, quantidade: null, receita: null };
    });
    const quantidade = serie.reduce((s, x) => s + (x.quantidade ?? 0), 0);
    const receitaCent = serie.reduce((s, x) => s + cents(x.receita ?? 0), 0);
    const compraCent = comRelatorio.reduce((s, mes) => s + cents((doMes.get(mes)!.get(p.codigo)?.q ?? 0) * volumesDoMes(idxDe(mes)).revenda.find((r) => r.codigo === p.codigo)!.custoMes), 0);
    const mesesInteiros = serie.filter((x) => x.quantidade != null && x.mes !== mesDe(IDX_HOJE));
    const precoMedio = quantidade ? Math.round(receitaCent / quantidade) / 100 : null;
    const precoCompra = quantidade ? Math.round(compraCent / quantidade) / 100 : null;
    return {
      empresa: 'EXEMPLO' as const, codigo_produto: p.codigo, descricao: p.descricao, unidade: 'UN', quantidade, receita: reais(receitaCent),
      preco_medio: precoMedio,
      volume_medio_mensal: mesesInteiros.length ? Math.round(mesesInteiros.reduce((s, x) => s + x.quantidade!, 0) / mesesInteiros.length) : null,
      meses_com_venda: serie.filter((x) => (x.quantidade ?? 0) > 0).length, serie_mensal: serie,
      quantidade_comprada: quantidade, preco_medio_compra: precoCompra,
      margem_unitaria: precoMedio != null && precoCompra != null ? Math.round((precoMedio - precoCompra) * 100) / 100 : null,
      margem_pct: precoMedio && precoCompra != null ? pct(cents(precoMedio - precoCompra), cents(precoMedio)) : null,
    };
  }).sort((a, b) => b.receita - a.receita);
  return {
    periodo: { inicio, fim, meses },
    meses_sem_relatorio: meses.filter((m) => !comRelatorio.includes(m)).map((mes) => ({ empresa: 'EXEMPLO' as const, mes })),
    meses_parciais: comRelatorio.includes(mesDe(IDX_HOJE)) ? [{ empresa: 'EXEMPLO', mes: mesDe(IDX_HOJE), ate: HOJE }] : [],
    produtos, receita_total: reais(produtos.reduce((s, p) => s + cents(p.receita), 0)), ex_vendido_pela_exemplo: 0,
    compras: { empresas: ['EXEMPLO'] },
    aviso_compras: 'Compra pelo preço médio das notas de entrada do mês.',
  };
}

const VARIEDADES_DO_CARD: Variedade[] = ['SH', 'SP', 'SB', 'SS'];
const porVariedade = <T,>(fn: (e: Variedade) => T) => Object.fromEntries(VARIEDADES_DO_CARD.map((e) => [e, fn(e)])) as Record<Variedade, T>;
const kg = (gramas: number) => gramas / 1000;
const mesesComRazao = (inicio: string, fim: string) => mesesDoIntervalo(inicio, fim).filter((m) => idxDe(m) >= IDX_INICIO && idxDe(m) <= IDX_HOJE);
const abertosEm = (mes: string) => lotesDaDemo().filter((l) => l.aberto && l.abertura.slice(0, 7) === mes);
const ultimaDaProducao = () => lotesDaDemo()
  .flatMap((l) => [l.data_lote, ...(l.aberto ? [l.abertura] : []), ...l.colheitas.map((c) => c.data)]).reduce((m, d) => (d > m ? d : m), '');
const atualizacaoDaProducao = () => ({ producao: ultimaDaProducao(), embalagem: ultimaDaProducao(), vendas: ultimoLancamento() });

function volumesDe(lotes: LoteDaDemo[], mes: string, vendidas: number): VolumesDoMes {
  const inoculados = lotes.filter((l) => l.mes === mes);
  const abertos = lotes.filter((l) => l.aberto && l.abertura.slice(0, 7) === mes);
  const colheitas = lotes.flatMap((l) => l.colheitas.filter((c) => c.mes === mes));
  const produzidos = somaDe(inoculados, (l) => l.produzidos);
  const contaminados = somaDe(inoculados, (l) => l.contaminados);
  const parte = (ls: LoteDaDemo[]) => ({
    lotes: ls.length, blocos_abertos: somaDe(ls, (l) => l.abertos), kg_colhidos: kg(somaDe(ls, gramasDo)), bandejas: somaDe(ls, (l) => somaDe(l.colheitas, bandejasDa)),
  });
  return {
    blocos_produzidos: produzidos, blocos_abertos: somaDe(abertos, (l) => l.abertos), kg_colhidos: kg(somaDe(colheitas, (c) => c.gramas)),
    blocos_contaminados: contaminados, contaminacao_pct: pct(contaminados, produzidos),
    bandejas_produzidas: somaDe(colheitas, bandejasDa), bandejas_vendidas: vendidas,
    rendimento: { ...parte(abertos), encerradas: parte(abertos.filter((l) => !l.colhendo)), em_colheita: parte(abertos.filter((l) => l.colhendo)) },
  };
}

function origemDe(lotes: LoteDaDemo[]): OrigemDoMes {
  const concluidos = lotes.filter((l) => l.aberto);
  return {
    lotes: lotes.length, lotes_em_maturacao: lotes.length - concluidos.length, lotes_abertura_concluida: concluidos.length,
    lotes_sem_dado_da_abertura: 0, lotes_sem_abertura: 0, lotes_colhendo: concluidos.filter((l) => l.colhendo).length,
    blocos_produzidos: somaDe(lotes, (l) => l.produzidos), blocos_contaminados: somaDe(lotes, (l) => l.contaminados), blocos_perdidos: somaDe(lotes, (l) => l.perdidos),
    blocos_abertos: somaDe(lotes, (l) => l.abertos), blocos_em_maturacao: somaDe(lotes, (l) => (l.aberto ? 0 : aproveitadosDo(l))), blocos_sem_destino: 0,
    concluidos: { blocos_produzidos: somaDe(concluidos, (l) => l.produzidos), blocos_abertos: somaDe(concluidos, (l) => l.abertos), kg_colhidos: kg(somaDe(concluidos, gramasDo)) },
  };
}

const faixasDe = (cs: Colheita[]) => {
  const faixa = (i: number) => kg(somaDe(cs, (c) => c.faixas[i]));
  return { kg_p: faixa(0), kg_m: faixa(1), kg_g: faixa(2), kg_gg: faixa(3) };
};

export async function getIndicadoresDaProducao(inicio: string, fim: string): Promise<IndicadoresDaProducaoResposta> {
  const todos = lotesDaDemo();
  const daVariedade = (e: Variedade) => todos.filter((l) => l.tipo === e);
  const meses = mesesComRazao(inicio, fim).map((mes): IndicadoresDoMes => {
    const vendas = vendasDoMes(mes);
    const vendidas = (e: Variedade) => (e === 'SS' ? 0 : vendas.producao.get(e)!.bandejas);
    const inoculados = todos.filter((l) => l.mes === mes);
    const abertos = abertosEm(mes);
    const revenda = (['SH', 'SP', 'SB', 'OUTROS'] as const).map((especie): VendaPorEspecie => {
      const ps = PRODUTOS_DA_REVENDA.filter((p) => p.especie === especie).map((p) => vendas.revenda.get(p.codigo) ?? { bandejas: 0, cent: 0 });
      return { especie, bandejas: somaDe(ps, (x) => x.bandejas), receita: reais(somaDe(ps, (x) => x.cent)) };
    }).filter((x) => x.bandejas > 0);
    return {
      mes,
      rendimento_pela_abertura: {
        lotes: abertos.map((l): LoteDaAbertura => {
          const porMes = new Map<string, number>();
          for (const c of l.colheitas) porMes.set(c.mes, (porMes.get(c.mes) ?? 0) + c.gramas);
          return {
            chave: l.chave, data_lote: l.data_lote, tipo: l.tipo, primeira_abertura: l.abertura, ultima_abertura: l.abertura, colhendo: l.colhendo,
            blocos_abertos: l.abertos, kg_colhidos: kg(gramasDo(l)), bandejas: somaDe(l.colheitas, bandejasDa), kg_por_mes: [...porMes].map(([m, g]) => ({ mes: m, kg: kg(g) })),
          };
        }),
        fora_da_conta: { abertura_sem_quantidade: 0, abertura_com_zero_blocos: 0, abertos_sem_colheita: 0 },
      },
      producao: {
        total: volumesDe(todos, mes, somaDe(ESPECIES, vendidas)),
        por_especie: porVariedade((e) => volumesDe(daVariedade(e), mes, vendidas(e))),
        vendas_por_especie: ESPECIES.map((e) => ({ especie: e, bandejas: vendidas(e), receita: reais(vendas.producao.get(e)!.cent) })).filter((x) => x.bandejas > 0),
        shiitake_colhido: faixasDe(daVariedade('SH').flatMap((l) => l.colheitas.filter((c) => c.mes === mes))),
      },
      revenda: { bandejas_vendidas: somaDe(revenda, (x) => x.bandejas), por_especie: revenda },
      sem_vendas: null,
      parcial: {
        mes_em_andamento: idxDe(mes) === IDX_HOJE,
        abertura_colhendo: { total: abertos.some((l) => l.colhendo), por_especie: porVariedade((e) => abertos.some((l) => l.tipo === e && l.colhendo)) },
      },
      lotes_de_origem: {
        total: origemDe(inoculados), por_especie: porVariedade((e) => origemDe(inoculados.filter((l) => l.tipo === e))),
        lotes: inoculados.map((l): LoteDeOrigem => ({
          chave: l.chave, data_lote: l.data_lote, tipo: l.tipo, situacao: l.aberto ? 'ABERTURA_CONCLUIDA' : 'EM_MATURACAO',
          blocos_produzidos: l.produzidos, blocos_contaminados: l.contaminados, blocos_perdidos: l.perdidos, blocos_abertos: l.abertos,
          blocos_em_maturacao: l.aberto ? 0 : aproveitadosDo(l), blocos_sem_destino: 0,
          kg_colhidos: l.aberto ? kg(gramasDo(l)) : null, ...faixasDe(l.colheitas), colhendo: l.colhendo,
        })),
      },
    };
  });
  return { periodo: { inicio, fim }, gramas_por_bandeja: GRAMAS_POR_BANDEJA, meses, atualizacao: atualizacaoDaProducao() };
}

let cogumeloEmCache: Map<string, Map<Conta, number>> | null = null;
function custosDoCogumelo(mes: string): Map<Conta, number> {
  if (!cogumeloEmCache) {
    cogumeloEmCache = new Map();
    for (const { f, mes: m } of fato('COMPETENCIA')) {
      if (chaveDe(f) !== 'PRODUCAO_COGUMELO' || blocoDe(f.lan.conta) === 'receita' || blocoDe(f.lan.conta) == null) continue;
      const doMes = cogumeloEmCache.get(m) ?? cogumeloEmCache.set(m, new Map()).get(m)!;
      doMes.set(f.lan.conta, (doMes.get(f.lan.conta) ?? 0) - f.cent);
    }
  }
  return cogumeloEmCache.get(mes) ?? new Map();
}

const COMPONENTE_DA_CONTA = new Map<Conta, ComponenteDoCusto>([
  [C.substrato, 'MATERIA_PRIMA'], [C.sementes, 'MATERIA_PRIMA'], [C.embalagens, 'EMBALAGENS'], [C.energia, 'ENERGIA'], [C.maoDeObra, 'MAO_DE_OBRA'], [C.fretes, 'LOGISTICA'],
]);
const COMPONENTES: CustosDaProducaoResposta['componentes'] = [
  { id: 'MATERIA_PRIMA', rotulo: 'Matéria-prima e insumos', entra: true, base: 'blocos produzidos', criterio: 'Substrato e sementes do mês da fabricação, pelo custo por bloco do lote de origem.' },
  { id: 'MAO_DE_OBRA', rotulo: 'Mão de obra', entra: false, base: null, criterio: 'Pelas horas de cada atividade no Cadastro Mestre, que ainda não tem os tempos nesta demonstração.' },
  { id: 'INDIRETOS', rotulo: 'Custos indiretos', entra: true, base: 'blocos produzidos', criterio: 'Manutenção e reformas do mês da fabricação, quando lançadas no Cogumelo.' },
  { id: 'ENERGIA', rotulo: 'Energia', entra: false, base: null, criterio: 'Fica fora até o percentual entre a fabricação dos blocos e a bandeja.' },
  { id: 'EMBALAGENS', rotulo: 'Embalagens', entra: true, base: 'bandejas produzidas', criterio: 'O material de embalagem do mês sobre as bandejas produzidas no mês.' },
  { id: 'LOGISTICA', rotulo: 'Expedição e logística', entra: true, base: 'bandejas vendidas', criterio: 'Os fretes de entrega do Cogumelo no mês sobre as bandejas vendidas.' },
  { id: 'FORA', rotulo: 'Fora do custo industrial', entra: false, base: null, criterio: 'Despesas compartilhadas, que não são custo da bandeja.' },
];
const emReais = (cent: number | null) => (cent == null ? null : cent / 100);
const porUnidade = (cent: number | null, n: number) => (cent == null || n === 0 ? null : Math.round(cent / n) / 100);
const somaEmReais = (a: number | null, b: number | null) => (a == null || b == null ? null : Math.round((a + b) * 100) / 100);

function fabricacaoDe(mes: string) {
  const lotes = lotesDaDemo().filter((l) => l.mes === mes);
  const contas = custosDoCogumelo(mes);
  const mp = idxDe(mes) >= IDX_INICIO - 1 ? (contas.get(C.substrato) ?? 0) + (contas.get(C.sementes) ?? 0) : null;
  const produzidos = somaDe(lotes, (l) => l.produzidos);
  return { lotes, mp, produzidos, cpb: mp != null && mp > 0 && produzidos > 0 ? Math.round(mp / produzidos) : null, emAndamento: idxDe(mes) === IDX_HOJE };
}
const cpbaDo = (l: LoteDaDemo, cpb: number | null) => (cpb == null ? null : Math.round((l.produzidos * cpb) / aproveitadosDo(l)));

export async function getCustosDaProducao(inicio: string, fim: string): Promise<CustosDaProducaoResposta> {
  const meses = mesesComRazao(inicio, fim).map((mes): CustosDoMes => {
    const emAndamento = idxDe(mes) === IDX_HOJE;
    const fab = fabricacaoDe(mes);
    const cpb = fab.cpb;
    const aproveitados = somaDe(fab.lotes, aproveitadosDo);
    const contaminadosCent = cpb == null ? null : somaDe(fab.lotes, (l) => l.contaminados * cpb);
    const perdasCent = cpb == null ? null : somaDe(fab.lotes, (l) => l.perdidos * cpb);
    const totalDasPerdas = contaminadosCent == null || perdasCent == null ? null : contaminadosCent + perdasCent;
    const lotesFabricados = fab.lotes.map((l): LoteFabricadoComCusto => ({
      chave: l.chave, data_lote: l.data_lote, tipo: l.tipo, situacao: l.aberto ? 'ABERTURA_CONCLUIDA' : 'EM_MATURACAO', colhendo: l.colhendo,
      blocos_produzidos: l.produzidos, blocos_contaminados: l.contaminados, blocos_perdidos: l.perdidos,
      custo_dos_contaminados: emReais(cpb == null ? null : l.contaminados * cpb), custo_das_outras_perdas: emReais(cpb == null ? null : l.perdidos * cpb),
      blocos_aproveitados: aproveitadosDo(l), perdas_depois_da_abertura: 0, custo_por_bloco_aproveitado: emReais(cpbaDo(l, cpb)),
    }));
    const abertos = abertosEm(mes).map((l) => {
      const f = fabricacaoDe(l.mes);
      const cpba = cpbaDo(l, f.cpb);
      return { l, f, cpba, custo: cpba == null ? null : l.abertos * cpba, bandejas: somaDe(l.colheitas, bandejasDa) };
    });
    const comCusto = abertos.filter((a) => a.custo != null);
    const parte = (xs: typeof abertos) => {
      const custo = somaDe(xs, (a) => a.custo ?? 0);
      const bandejas = somaDe(xs, (a) => a.bandejas);
      return { lotes: xs.length, blocos_abertos: somaDe(xs, (a) => a.l.abertos), bandejas, custo_dos_blocos: xs.length ? custo / 100 : null, custo_dos_blocos_por_bandeja: porUnidade(xs.length ? custo : null, bandejas) };
    };
    const todos = parte(comCusto);
    const contas = custosDoCogumelo(mes);
    const embalagens = contas.get(C.embalagens) ?? 0;
    const logistica = contas.get(C.fretes) ?? 0;
    const bandejasProduzidas = somaDe(lotesDaDemo().flatMap((l) => l.colheitas.filter((c) => c.mes === mes)), bandejasDa);
    const vendas = vendasDoMes(mes);
    const vendidas = somaDe(ESPECIES, (e) => vendas.producao.get(e)!.bandejas);
    const porBandejaProduzida = somaEmReais(todos.custo_dos_blocos_por_bandeja, porUnidade(embalagens, bandejasProduzidas));
    const porBandejaEntregue = somaEmReais(porBandejaProduzida, porUnidade(logistica, vendidas));
    const semCusto = abertos.length - comCusto.length;
    const mesesDaFabricacao = [...new Set(abertos.map((a) => a.l.mes))].sort().map((m): MesDeFabricacao => {
      const f = fabricacaoDe(m);
      return { mes: m, materia_prima: emReais(f.mp), frete_de_insumos: null, custos_indiretos: null, custo_de_fabricacao: emReais(f.mp), blocos_produzidos: f.produzidos, custo_por_bloco_produzido: emReais(f.cpb), parcial: f.emAndamento };
    });
    const composicao = [...contas].filter(([, v]) => v !== 0).sort((a, b) => b[1] - a[1]);
    const totalCog = somaDe(composicao, ([, v]) => v);
    return {
      mes, apurado: true,
      parcial: {
        mes_em_andamento: emAndamento, fabricacao: emAndamento || fab.lotes.some((l) => !l.aberto || l.colhendo),
        bandeja: emAndamento || abertos.some((a) => a.l.colhendo || a.f.emAndamento),
      },
      indicadores: {
        custo_por_bloco_produzido: emReais(cpb), custo_por_bloco_aproveitado: porUnidade(fab.mp, aproveitados),
        custo_por_bandeja_produzida: porBandejaProduzida, custo_por_bandeja_entregue: porBandejaEntregue, contaminacao_em_reais: emReais(contaminadosCent),
        produtividade_da_equipe: null, estoque_de_bandejas_prontas: null,
      },
      sem_dado: {
        produtividade_da_equipe: 'entra num segundo momento: depende das horas realizadas por atividade.',
        estoque_de_bandejas_prontas: 'entra num segundo momento: depende do saldo de bandejas prontas.',
      },
      fabricacao: {
        materia_prima: emReais(fab.mp), custos_indiretos: null, custo_de_fabricacao: emReais(fab.mp),
        blocos_produzidos: fab.produzidos, blocos_contaminados: somaDe(fab.lotes, (l) => l.contaminados), blocos_perdidos: somaDe(fab.lotes, (l) => l.perdidos),
        blocos_aproveitados: aproveitados, perdas_depois_da_abertura: 0, lotes_sem_contagem: 0,
        custo_dos_contaminados: emReais(contaminadosCent), custo_das_outras_perdas: emReais(perdasCent), custo_total_das_perdas: emReais(totalDasPerdas),
        impacto_por_bloco_aproveitado: porUnidade(totalDasPerdas, aproveitados), custo_sem_perdas: emReais(cpb), lotes: lotesFabricados,
      },
      bandeja: {
        lotes: abertos.map(({ l, f, cpba, custo, bandejas }): LoteAbertoComCusto => ({
          chave: l.chave, data_lote: l.data_lote, tipo: l.tipo, colhendo: l.colhendo, blocos_abertos: l.abertos, bandejas,
          mes_da_fabricacao: l.mes, fabricacao_parcial: f.emAndamento, custo_por_bloco_aproveitado: emReais(cpba), custo_dos_blocos: emReais(custo),
          sem_custo: custo == null ? 'fora_da_janela' : null,
          blocos_produzidos: l.produzidos, blocos_aproveitados: aproveitadosDo(l), blocos_perdidos_no_lote: l.contaminados + l.perdidos, blocos_perdidos_depois_da_abertura: 0,
          custo_por_bloco_produzido_na_origem: emReais(f.cpb), bandejas_por_bloco_aberto: l.abertos ? Math.round((bandejas / l.abertos) * 100) / 100 : null,
          custo_dos_blocos_por_bandeja: porUnidade(custo, bandejas),
        })),
        lotes_sem_custo: semCusto, blocos_abertos_sem_custo: somaDe(abertos.filter((a) => a.custo == null), (a) => a.l.abertos), lotes_abertos_sem_colheita: 0,
        sem_custo_por: { sem_data: 0, fora_da_janela: semCusto, sem_materia_prima: 0, sem_custo_de_fabricacao: 0, sem_contagem: 0 }, lotes_abertos_sem_quantidade: 0,
        abertos_sem_colheita: [], encerrados: parte(comCusto.filter((a) => !a.l.colhendo)), em_colheita: parte(comCusto.filter((a) => a.l.colhendo)), meses_de_fabricacao: mesesDaFabricacao,
        custo_dos_blocos_abertos: todos.custo_dos_blocos, bandejas_dos_lotes: todos.bandejas, custo_dos_blocos_por_bandeja: todos.custo_dos_blocos_por_bandeja,
        embalagens: emReais(embalagens), bandejas_produzidas: bandejasProduzidas, embalagens_por_bandeja: porUnidade(embalagens, bandejasProduzidas),
        logistica: emReais(logistica), bandejas_vendidas: vendidas, logistica_por_bandeja: porUnidade(logistica, vendidas),
      },
      producao_vendida: {
        bandejas_vendidas: vendidas, custo_da_producao_vendida: porBandejaProduzida == null ? null : Math.round(vendidas * porBandejaProduzida * 100) / 100,
        lancado_no_mes: null, diferenca: null,
      },
      composicao: composicao.map(([c, v]) => ({ codigo_oficial: c.codigo, rotulo: c.rotulo, componente: COMPONENTE_DA_CONTA.get(c) ?? 'FORA', valor: v / 100, participacao_pct: pct(v, totalCog) })),
      total_da_composicao: totalCog / 100,
      total_na_dre: totalCog / 100,
      mao_de_obra: { motivo: 'SEM_ENCARGOS', salas_de_frutificacao: 4, atividades: [] },
    };
  });
  return {
    periodo: { inicio, fim }, fabricacao_lida_desde: `${mesDe(IDX_INICIO - 1)}-01`, componentes: COMPONENTES,
    falta: ['Mão de obra por atividade: a folha da demonstração não traz o FGTS e o INSS à parte.', 'Energia: o percentual entre a fabricação dos blocos e a bandeja.'],
    atualizacao: atualizacaoDaProducao(), ultimo_lancamento: ultimoLancamento(), meses,
    salas_de_frutificacao: { quantidade: 4, nomes: ['Sala 1', 'Sala 2', 'Sala 3', 'Sala 4'] },
  };
}

const METAS_DA_ESPECIE: Record<Especie, { abertos: number; bandejasPorBloco: number; kgPorBloco: number; vendidas: number; preco: number; porDia: number }> = {
  SH: { abertos: 4600, bandejasPorBloco: 0.6, kgPorBloco: 0.12, vendidas: 2900, preco: 14, porDia: 300 },
  SP: { abertos: 1900, bandejasPorBloco: 0.8, kgPorBloco: 0.16, vendidas: 1600, preco: 11, porDia: 120 },
  SB: { abertos: 1750, bandejasPorBloco: 0.75, kgPorBloco: 0.15, vendidas: 1400, preco: 10.5, porDia: 110 },
};
const ABERTURA = { salas: 4, ciclo: 30, porSala: 1150 };
const LIMITE_CONTAMINACAO = 9;
const MARGEM_DA_FABRICACAO = 8;
const APROVEITAMENTO_NA_EMBALAGEM = 0.96;
const FIM_DO_PLANEJAMENTO = ultimoDia(IDX_HOJE + 14);
const DIAS_DA_SEMANA: Record<AtividadeComCalendario, number[]> = { FABRICACAO: [1, 2, 3, 4], COLHEITA: [0, 1, 2, 3, 4, 5, 6], VENDAS: [1, 2, 3, 4, 5, 6] };
const FORA_DA_DEMO = 'mês fora do período da demonstração';

const r2 = (v: number | null) => (v == null ? null : Math.round(v * 100) / 100);
const kg3 = (v: number) => Math.round(v * 1000) / 1000;
const diaDaSemana = (iso: string) => new Date(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)))).getUTCDay();
const diasDo = (de: string, ate: string) => { const xs: string[] = []; for (let d = de; d <= ate; d = somarDias(d, 1)) xs.push(d); return xs; };
const corteNoMes = (data: string, mes: string) => {
  const de = `${mes}-01`; const ate = ultimoDia(idxDe(mes));
  return data > ate ? ate : data < de ? somarDias(de, -1) : data;
};

const diasSemOperacao: DiaSemOperacao[] = ['01-01', '04-21', '05-01', '09-07', '10-12', '11-02', '11-15', '11-20', '12-25']
  .map((md) => `${HOJE.slice(0, 4)}-${md}`).filter((d) => d.slice(0, 7) === HOJE.slice(0, 7))
  .flatMap((data) => (['FABRICACAO', 'VENDAS'] as const).map((atividade) => ({ data, atividade, motivo: 'Feriado nacional' })))
  .map((d, i) => ({ id: i + 1, ...d }));
let proximoDiaSemOperacao = diasSemOperacao.length + 1;

function calendarioDaAtividade(a: AtividadeComCalendario, mes: string) {
  const fora = new Set(diasSemOperacao.filter((d) => d.atividade === a).map((d) => d.data));
  return diasDo(`${mes}-01`, ultimoDia(idxDe(mes))).filter((d) => DIAS_DA_SEMANA[a].includes(diaDaSemana(d)) && !fora.has(d));
}

export async function criarDiaSemOperacao(corpo: Omit<DiaSemOperacao, 'id'>): Promise<DiaSemOperacao> {
  if (diasSemOperacao.some((d) => d.data === corpo.data && d.atividade === corpo.atividade)) throw new Error('Esse dia já está registrado para a atividade.');
  const dia = { id: proximoDiaSemOperacao++, ...corpo };
  diasSemOperacao.push(dia);
  return dia;
}
export async function apagarDiaSemOperacao(id: number): Promise<{ id: number }> {
  const i = diasSemOperacao.findIndex((d) => d.id === id);
  if (i < 0) throw new Error('Dia sem operação não encontrado.');
  diasSemOperacao.splice(i, 1);
  return { id };
}

function metasDaDemo(tipos: Especie[]): TermometroDoMes['metas'] {
  const soma = (f: (m: (typeof METAS_DA_ESPECIE)[Especie]) => number) => (tipos.length ? somaDe(tipos, (e) => f(METAS_DA_ESPECIE[e])) : null);
  const abertos = soma((m) => m.abertos);
  const bandejas = soma((m) => Math.round(m.abertos * m.bandejasPorBloco));
  const vendidas = soma((m) => m.vendidas);
  const kgDoMes = soma((m) => m.abertos * m.kgPorBloco);
  const receita = soma((m) => m.vendidas * m.preco);
  const v = (valor: number | null, unidade: string) => ({
    valor, unidade, origem: (valor == null ? 'PADRAO' : 'BANCO') as OrigemDaMeta, vigente_desde: valor == null ? null : `${mesDe(IDX_INICIO)}-01`,
  });
  return {
    meta_mes_blocos_abertos: v(abertos, 'blocos'),
    meta_mes_bandejas_produzidas: v(bandejas, 'bandejas'),
    meta_mes_bandejas_vendidas: v(vendidas, 'bandejas'),
    ref_preco_medio_bandeja: v(receita == null || !vendidas ? null : r2(receita / vendidas), 'R$'),
    ref_bandejas_por_bloco: v(bandejas == null || !abertos ? null : r2(bandejas / abertos), 'bandejas/bloco'),
    ref_kg_por_bloco: v(kgDoMes == null || !abertos ? null : kg3(kgDoMes / abertos), 'kg/bloco'),
    limite_contaminacao_abertos_pct: v(LIMITE_CONTAMINACAO, '%'),
    abertura_blocos_por_sala: v(ABERTURA.porSala, 'blocos'),
    abertura_ciclo_dias: v(ABERTURA.ciclo, 'dias'),
    abertura_salas: v(ABERTURA.salas, 'salas'),
    fabricacao_blocos_por_dia: v(soma((m) => m.porDia), 'blocos'),
    fabricacao_margem_contaminacao_pct: v(MARGEM_DA_FABRICACAO, '%'),
  };
}

function linhaDoTermometro(p: {
  chave: ChaveDoIndicador; meta: number | null; metaOrigem: OrigemDaMeta | null; dias: string[]; corte: string; mes: string;
  diario: (d: string) => number; arredondar?: (v: number) => number;
}): LinhaDoTermometro {
  const arredondar = p.arredondar ?? ((v: number) => v);
  const de = `${p.mes}-01`;
  const serie: LinhaDoTermometro['serie'] = [];
  let acumulado = 0;
  for (let d = de; d <= p.corte; d = somarDias(d, 1)) {
    acumulado += p.diario(d);
    serie.push({ data: d, acumulado: arredondar(acumulado) });
  }
  const realizado = arredondar(acumulado);
  const decorridos = p.dias.filter((d) => d <= p.corte).length;
  const restantes = p.dias.length - decorridos;
  const media = decorridos > 0 ? realizado / decorridos : null;
  const projecao = restantes === 0 ? realizado : media == null ? null : realizado + media * restantes;
  const meta = p.meta != null && p.meta > 0 ? p.meta : null;
  const emPct = (v: number | null) => (meta != null && v != null ? r2((v / meta) * 100) : null);
  const r6 = (v: number) => Math.round(v * 1e6) / 1e6;
  const situacao: SituacaoDoIndicador = meta == null ? 'SEM_META' : projecao == null ? 'SEM_PROJECAO'
    : r6(projecao) >= meta ? 'NO_RITMO' : r6(projecao * 100) >= r6(meta * 95) ? 'ATENCAO' : 'ABAIXO';
  return {
    chave: p.chave, meta: p.meta, meta_origem: p.metaOrigem, realizado, dados_ate: p.corte >= de ? p.corte : null,
    dias: { decorridos, restantes, total: p.dias.length }, media_por_dia: r2(media), projecao: r2(projecao),
    pct_realizado: emPct(realizado), pct_projecao: emPct(projecao),
    diferenca: meta != null && projecao != null ? r2(projecao - meta) : null,
    ritmo_necessario: meta != null && restantes > 0 ? r2(Math.max(0, meta - realizado) / restantes) : null,
    situacao, serie, sem_dados: null,
  };
}
const semDados = (l: LinhaDoTermometro, motivo: string): LinhaDoTermometro => ({
  ...l, realizado: null, dados_ate: null, media_por_dia: null, projecao: null, pct_realizado: null, pct_projecao: null,
  diferenca: null, ritmo_necessario: null, situacao: 'SEM_DADOS', serie: [], sem_dados: motivo,
});

function contraReferencia(valor: number | null, referencia: number | null, maiorMelhor: boolean, casas = 2) {
  if (valor == null || referencia == null) return { diferenca: null, diferenca_pct: null, situacao: 'SEM_REFERENCIA' as const };
  const arred = (v: number) => Number(v.toLocaleString('en-US', { maximumFractionDigits: casas, useGrouping: false }));
  const ref = arred(referencia);
  const diferenca = arred(arred(valor) - ref);
  return {
    diferenca, diferenca_pct: ref !== 0 ? r2((diferenca / ref) * 100) : null,
    situacao: ((maiorMelhor ? diferenca >= 0 : diferenca <= 0) ? 'FAVORAVEL' : 'DESFAVORAVEL') as CardContraReferencia['situacao'],
  };
}
const razaoDe = (a: number | null, b: number | null, casas = 2) => (a == null || b == null || !(b > 0) ? null : Math.round((a / b) * 10 ** casas) / 10 ** casas);

const salaDo = (l: LoteDaDemo) => DIAS_DE_INOCULACAO.indexOf(Number(l.data_lote.slice(8, 10)));
function aberturasProgramadas(de: string, ate: string) {
  const saida: Array<{ data: string; sala: string; blocos: number }> = [];
  for (let k = 0; k < ABERTURA.salas; k += 1) {
    const datas = lotesDaDemo().filter((l) => l.tipo === 'SH' && salaDo(l) === k).map((l) => l.abertura).sort();
    for (let d = somarDias(datas[datas.length - 1], ABERTURA.ciclo); d <= ate; d = somarDias(d, ABERTURA.ciclo)) datas.push(d);
    for (const d of datas) if (d >= de && d <= ate) saida.push({ data: d, sala: `Sala ${k + 1}`, blocos: ABERTURA.porSala });
  }
  return saida.sort((a, b) => a.data.localeCompare(b.data) || a.sala.localeCompare(b.sala));
}
function ancorasDasSalas(D: string) {
  const ultima = new Map<string, string>();
  for (const l of lotesDaDemo()) {
    if (l.tipo !== 'SH' || !l.aberto || l.abertura > D) continue;
    const sala = `Sala ${salaDo(l) + 1}`;
    if ((ultima.get(sala) ?? '') < l.abertura) ultima.set(sala, l.abertura);
  }
  return [...ultima].map(([sala, data]) => ({ sala, data })).sort((a, b) => b.data.localeCompare(a.data) || a.sala.localeCompare(b.sala));
}
const diasDeFabricacao = (de: string, ate: string) => {
  let n = 0;
  for (let idx = idxDe(de.slice(0, 7)); idx <= idxDe(ate.slice(0, 7)); idx += 1) n += calendarioDaAtividade('FABRICACAO', mesDe(idx)).filter((d) => d >= de && d <= ate).length;
  return n;
};

function planejamentoDaDemo(D: string): PlanejamentoDeMaturacao {
  const sh = lotesDaDemo().filter((l) => l.tipo === 'SH');
  const naFila = sh.filter((l) => !l.aberto);
  const maturaEm = (l: LoteDaDemo) => { const m = somarDias(l.data_lote, MATURACAO.SH); return l.abertura < m ? l.abertura : m; };
  const maturados = somaDe(naFila.filter((l) => maturaEm(l) <= D), aproveitadosDo);
  const maturando = somaDe(naFila.filter((l) => maturaEm(l) > D), aproveitadosDo);
  const chegam = new Map<string, number>();
  for (const l of naFila) if (maturaEm(l) > D) chegam.set(maturaEm(l), (chegam.get(maturaEm(l)) ?? 0) + aproveitadosDo(l));
  const porData = new Map<string, { salas: number; blocos: number }>();
  for (const a of aberturasProgramadas(somarDias(D, 1), FIM_DO_PLANEJAMENTO)) {
    const x = porData.get(a.data) ?? { salas: 0, blocos: 0 };
    porData.set(a.data, { salas: x.salas + 1, blocos: x.blocos + a.blocos });
  }
  let pool = maturados;
  const meses: MesDoQuadro[] = [];
  const aberturas: AberturaDoQuadro[] = [];
  for (let idx = idxDe(D.slice(0, 7)); idx <= idxDe(FIM_DO_PLANEJAMENTO.slice(0, 7)); idx += 1) {
    const mes = mesDe(idx); const ate = ultimoDia(idx);
    const primeiro = meses.length === 0;
    const saldo_inicial = pool;
    const semanas = [[1, 7], [8, 14], [15, 21], [22, 28], [29, 31]].filter(([a]) => a <= diasNoMes(idx)).map(([a, b], i) => {
      const de = dataDe(idx, a); const fim = dataDe(idx, b);
      if (fim <= D) return { semana: i + 1, de, ate: fim, blocos: null, desde: null };
      const desde = de <= D ? somarDias(D, 1) : null;
      return { semana: i + 1, de, ate: fim, blocos: somaDe(diasDo(desde ?? de, fim), (d) => chegam.get(d) ?? 0), desde };
    });
    let programadas = 0; let viaveisDoMes = 0; let deficit = 0; let primeiraFalta: string | null = null;
    for (const d of diasDo(primeiro ? somarDias(D, 1) : `${mes}-01`, ate)) {
      pool += chegam.get(d) ?? 0;
      const p = porData.get(d);
      if (!p) continue;
      const disponivel = pool;
      const viaveis = Math.min(p.blocos, pool);
      const falta = p.blocos - viaveis;
      pool -= viaveis;
      const dataLimite = somarDias(d, -MATURACAO.SH);
      aberturas.push({
        data: d, salas: p.salas, necessarios: p.blocos, disponivel, viaveis, falta,
        a_fabricar: falta > 0 ? Math.ceil(falta / (1 - MARGEM_DA_FABRICACAO / 100)) : 0, margem_pct: MARGEM_DA_FABRICACAO,
        data_limite: dataLimite, situacao: falta === 0 ? 'COBERTA' : dataLimite < HOJE ? 'PRAZO_VENCIDO' : 'FABRICAR',
      });
      programadas += p.blocos; viaveisDoMes += viaveis; deficit += falta;
      if (falta > 0 && primeiraFalta == null) primeiraFalta = d;
    }
    const totalMaturado = somaDe(semanas, (s) => s.blocos ?? 0);
    meses.push({
      mes, saldo_inicial, saldo_inicial_em: primeiro ? D : null, semanas, total_maturado: totalMaturado,
      disponiveis_no_mes: saldo_inicial + totalMaturado, aberturas_programadas: programadas, aberturas_viaveis: viaveisDoMes,
      deficit, saldo_disponivel: pool, primeira_falta: primeiraFalta,
    });
  }
  const aFabricar = aberturas.filter((a) => a.situacao === 'FABRICAR');
  const fabricacao_por_mes = [...new Set(aFabricar.map((a) => a.data_limite!.slice(0, 7)))].sort().map((mes) => {
    const doMes = aFabricar.filter((a) => a.data_limite!.slice(0, 7) === mes);
    const porDia = Math.max(...doMes.map((a) => Math.ceil(somaDe(aFabricar.filter((x) => x.data_limite! <= a.data_limite!), (x) => x.a_fabricar)
      / Math.max(1, diasDeFabricacao(HOJE, a.data_limite!)))));
    return {
      mes, blocos: somaDe(doMes, (a) => a.a_fabricar), dias_de_fabricacao: diasDeFabricacao(HOJE > `${mes}-01` ? HOJE : `${mes}-01`, ultimoDia(idxDe(mes))),
      por_dia: porDia, por_semana: porDia * DIAS_DA_SEMANA.FABRICACAO.length,
    };
  });
  const vencidas = aberturas.filter((a) => a.situacao === 'PRAZO_VENCIDO');
  const ultimaDe = (ds: string[]) => ds.filter((d) => d <= D).reduce<string | null>((m, d) => (m == null || d > m ? d : m), null);
  return {
    especie: 'SH', data_dos_dados: D,
    lancamentos: { producao: ultimaDe(sh.map((l) => l.data_lote)), abertura: ultimaDe(sh.filter((l) => l.aberto).map((l) => l.abertura)), retirada: ultimaDe(sh.flatMap((l) => l.colheitas.map((c) => c.data))) },
    prazo_dias: MATURACAO.SH, margem_pct: MARGEM_DA_FABRICACAO, fim: FIM_DO_PLANEJAMENTO, maduro_na_data: maturados,
    em_maturacao: { data: D, total: maturados + maturando, maturados, maturando },
    fora_da_conta: { estantes_sem_contagem: 0, estantes_conta_negativa: 0, estantes_sem_data: 0, blocos_sem_data: 0, salas_sem_ancora: 0 },
    primeira_falta: aberturas.find((a) => a.falta > 0)?.data ?? null,
    meses, aberturas, fabricacao_por_mes,
    prazo_vencido: { aberturas: vencidas.length, blocos: somaDe(vencidas, (a) => a.a_fabricar) },
  };
}

export async function getTermometro(p: { mes: string; especie: EspecieDoTermometro | 'TODAS' }): Promise<TermometroDoMes> {
  const { mes } = p;
  const especie = p.especie === 'TODAS' ? null : p.especie;
  const tipos: Especie[] = especie == null ? ESPECIES : especie === 'SS' ? [] : [especie];
  const lotes = lotesDaDemo().filter((l) => tipos.includes(l.tipo));
  const de = `${mes}-01`; const ate = ultimoDia(idxDe(mes));
  const D = ultimaDaProducao();
  const ultimaVenda = ultimoLancamento();
  const metas = metasDaDemo(tipos);
  const fora = idxDe(mes) < IDX_INICIO;

  const doDia = () => new Map<string, number>();
  const somar = (m: Map<string, number>, d: string, v: number) => m.set(d, (m.get(d) ?? 0) + v);
  const fabricados = doDia(); const abertos = doDia(); const gramas = doDia(); const bandejas = doDia(); const aproveitadas = doDia();
  const vendidas = doDia(); const receita = doDia();
  for (const l of lotes) {
    somar(fabricados, l.data_lote, l.produzidos);
    if (l.aberto) somar(abertos, l.abertura, l.abertos);
    for (const c of l.colheitas) {
      somar(gramas, c.data, c.gramas); somar(bandejas, c.data, bandejasDa(c));
      somar(aproveitadas, c.data, Math.round((c.gramas * APROVEITAMENTO_NA_EMBALAGEM) / GRAMAS_POR_BANDEJA));
    }
  }
  for (const l of razao()) {
    if (l.conta !== C.cogumelos || !l.venda || !tipos.includes(l.venda.produto as Especie)) continue;
    somar(vendidas, l.data_competencia, l.venda.quantidade); somar(receita, l.data_competencia, l.cent / 100);
  }
  const doMes = (m: Map<string, number>, mesDoRecorte: string, corte: string) => somaDe(diasDo(`${mesDoRecorte}-01`, corte), (d) => m.get(d) ?? 0);
  const vendasDe = (m: string) => {
    if (idxDe(m) < IDX_INICIO) return { bandejas: null, receita: null, ate: null, motivo: FORA_DA_DEMO };
    if (`${m}-01` > ultimaVenda) return { bandejas: null, receita: null, ate: null, motivo: 'nenhuma venda carregada no mês' };
    const corte = corteNoMes(ultimaVenda, m);
    return { bandejas: doMes(vendidas, m, corte), receita: r2(doMes(receita, m, corte)), ate: corte, motivo: null };
  };

  const corte = corteNoMes(D, mes);
  const vendasDoMes = vendasDe(mes);
  const corteVendas = vendasDoMes.ate ?? somarDias(de, -1);
  const dias = { FABRICACAO: calendarioDaAtividade('FABRICACAO', mes), COLHEITA: calendarioDaAtividade('COLHEITA', mes), VENDAS: calendarioDaAtividade('VENDAS', mes) };
  const programadasDoMes = aberturasProgramadas(de, ate);
  const diasDeAbertura = [...new Set([
    ...(tipos.includes('SH') ? programadasDoMes.map((a) => a.data) : []),
    ...lotes.filter((l) => l.tipo !== 'SH' && l.abertura >= de && l.abertura <= ate).map((l) => l.abertura),
  ])].sort();
  const planejamento = planejamentoDaDemo(D);
  const m = (c: keyof TermometroDoMes['metas']) => metas[c];
  const metaKg = m('meta_mes_blocos_abertos').valor != null && m('ref_kg_por_bloco').valor != null
    ? kg3(m('meta_mes_blocos_abertos').valor! * m('ref_kg_por_bloco').valor!) : null;
  const porDia = m('fabricacao_blocos_por_dia').valor;
  const linha = (chave: ChaveDoIndicador, meta: number | null, origem: OrigemDaMeta | null, diasDaLinha: string[], c: string, mapa: Map<string, number>, arredondar?: (v: number) => number) =>
    linhaDoTermometro({ chave, meta, metaOrigem: meta == null ? null : origem, dias: diasDaLinha, corte: c, mes, diario: (d) => mapa.get(d) ?? 0, arredondar });
  const indicadores = [
    linha('BLOCOS_FABRICADOS', porDia == null ? null : porDia * dias.FABRICACAO.length, m('fabricacao_blocos_por_dia').origem, dias.FABRICACAO, corte, fabricados),
    linha('BLOCOS_ABERTOS', m('meta_mes_blocos_abertos').valor, m('meta_mes_blocos_abertos').origem, diasDeAbertura, corte, abertos),
    linha('BANDEJAS_COLHIDAS', m('meta_mes_bandejas_produzidas').valor, m('meta_mes_bandejas_produzidas').origem, dias.COLHEITA, corte, bandejas),
    linha('BANDEJAS_APROVEITADAS', m('meta_mes_bandejas_produzidas').valor, m('meta_mes_bandejas_produzidas').origem, dias.COLHEITA, corte, aproveitadas),
    linha('KG_COLHIDOS', metaKg, m('meta_mes_blocos_abertos').origem, dias.COLHEITA, corte, new Map([...gramas].map(([d, g]) => [d, g / 1000])), kg3),
    linha('BANDEJAS_VENDIDAS', m('meta_mes_bandejas_vendidas').valor, m('meta_mes_bandejas_vendidas').origem, dias.VENDAS, corteVendas, vendidas),
    linha('FATURAMENTO', null, null, dias.VENDAS, corteVendas, receita, (v) => Math.round(v * 100) / 100),
  ].map((l) => {
    const motivo = fora ? FORA_DA_DEMO : l.chave === 'BANDEJAS_VENDIDAS' || l.chave === 'FATURAMENTO' ? vendasDoMes.motivo : null;
    if (motivo) return semDados(l, motivo);
    if (l.chave !== 'BLOCOS_ABERTOS') return l;
    const q = especie === 'SH' ? planejamento.meses.find((x) => x.mes === mes) : undefined;
    if (!q) return { ...l, abertura_viavel: null };
    const viavel = (l.realizado ?? 0) + q.aberturas_viaveis;
    const meta = l.meta != null && l.meta > 0 ? l.meta : null;
    return {
      ...l,
      abertura_viavel: {
        viavel, pct_da_meta: meta == null ? null : r2((viavel / meta) * 100), deficit: meta == null ? null : Math.max(0, meta - viavel),
        programado: q.aberturas_programadas, falta_de_blocos: q.deficit, primeira_falta: q.primeira_falta, desde: planejamento.data_dos_dados,
        situacao: meta == null ? 'SEM_META' as const : viavel >= meta ? 'NO_RITMO' as const : viavel * 100 >= meta * 95 ? 'ATENCAO' as const : 'ABAIXO' as const,
      },
    };
  });

  const producaoDe = (mm: string) => {
    const c = corteNoMes(D, mm);
    const abertosNoMes = lotes.filter((l) => l.aberto && l.abertura.slice(0, 7) === mm);
    const contaminados = somaDe(abertosNoMes, (l) => l.contaminados); const base = somaDe(abertosNoMes, (l) => l.produzidos);
    return {
      abertos: doMes(abertos, mm, c), kg: kg3(doMes(gramas, mm, c) / 1000), bandejas: doMes(bandejas, mm, c),
      contaminacao: { contaminados, base, pct: base > 0 ? r2((contaminados / base) * 100) : null },
    };
  };
  const anterior = mesDe(idxDe(mes) - 1);
  const prod = producaoDe(mes); const prodAnt = producaoDe(anterior);
  const vendasAnt = vendasDe(anterior);
  const card = (valor: number | null, valorAnterior: number | null, ref: { valor: number | null; origem: OrigemDaMeta }, maiorMelhor: boolean, casas = 2) => ({
    valor, anterior: valorAnterior, referencia: ref.valor, referencia_origem: ref.valor == null ? null : ref.origem, ...contraReferencia(valor, ref.valor, maiorMelhor, casas),
  });
  const variacao = vendasDoMes.bandejas != null && vendasAnt.bandejas != null ? vendasDoMes.bandejas - vendasAnt.bandejas : null;
  const metaVendidas = m('meta_mes_bandejas_vendidas').valor;
  const ultimaColheita = lotes.flatMap((l) => l.colheitas.map((c) => c.data)).reduce<string | null>((x, d) => (x == null || d > x ? d : x), null);
  return {
    mes, especie, hoje: HOJE, gramas_por_bandeja: GRAMAS_POR_BANDEJA,
    atualizacao: { producao: D, embalagem: ultimaColheita, vendas: vendasDoMes.ate, vendas_parcial: vendasDoMes.ate != null && vendasDoMes.ate < ate },
    indicadores,
    cards: {
      bandejas_por_bloco: card(fora ? null : razaoDe(prod.bandejas, prod.abertos), razaoDe(prodAnt.bandejas, prodAnt.abertos), m('ref_bandejas_por_bloco'), true),
      kg_por_bloco: card(fora ? null : razaoDe(prod.kg, prod.abertos, 3), razaoDe(prodAnt.kg, prodAnt.abertos, 3), m('ref_kg_por_bloco'), true, 3),
      contaminacao: {
        ...card(fora ? null : prod.contaminacao.pct, prodAnt.contaminacao.pct, m('limite_contaminacao_abertos_pct'), false),
        contaminados: prod.contaminacao.contaminados, base: prod.contaminacao.base,
        anterior_contaminados: prodAnt.contaminacao.contaminados, anterior_base: prodAnt.contaminacao.base,
      },
      preco_medio: {
        ...card(razaoDe(vendasDoMes.receita, vendasDoMes.bandejas), razaoDe(vendasAnt.receita, vendasAnt.bandejas), m('ref_preco_medio_bandeja'), true),
        dados_ate: vendasDoMes.ate, sem_dados: vendasDoMes.motivo, anterior_ate: vendasAnt.ate, anterior_sem_dados: vendasAnt.motivo, ultimo_apurado: null,
      },
      bandejas_vendidas: {
        valor: vendasDoMes.bandejas, anterior: vendasAnt.bandejas, variacao,
        variacao_pct: variacao != null && vendasAnt.bandejas ? r2((variacao / vendasAnt.bandejas) * 100) : null,
        meta: metaVendidas, meta_origem: m('meta_mes_bandejas_vendidas').origem,
        falta: metaVendidas != null && vendasDoMes.bandejas != null ? Math.max(0, metaVendidas - vendasDoMes.bandejas) : null,
        dados_ate: vendasDoMes.ate, sem_dados: vendasDoMes.motivo, anterior_ate: vendasAnt.ate, anterior_sem_dados: vendasAnt.motivo, ultimo_apurado: null,
      },
    },
    planejamento,
    calendario: {
      dias: { FABRICACAO: dias.FABRICACAO.length, COLHEITA: dias.COLHEITA.length, VENDAS: dias.VENDAS.length, ABERTURA: new Set(programadasDoMes.map((a) => a.data)).size },
      aberturas_programadas: programadasDoMes,
      ancoras: ancorasDasSalas(D), salas_sem_ancora: 0,
      dias_sem_operacao: diasSemOperacao.filter((d) => d.data.slice(0, 7) === mes),
    },
    metas,
  };
}

const INICIO_DA_DEMO = `${mesDe(IDX_INICIO)}-01`;
const criadoEm = (desde: string) => `${somarDias(desde, -3)}T12:00:00Z`;

const ATIVIDADES_DO_CADASTRO: Array<[string, AtividadeDoCadastro['etapa'], string, AtividadeDoCadastro['classificacao'], Array<Pick<VersaoDaAtividade,
  'equipe' | 'minutos_por_pessoa' | 'frequencia_tipo' | 'frequencia_n' | 'por_sala' | 'status' | 'motivo'> & { meses_atras: number | null }>]> = [
  ['AT-01', 'BLOCO', 'Preparo e umidificação do substrato', 'CUSTO_DO_BLOCO', [{ equipe: 3, minutos_por_pessoa: 240, frequencia_tipo: 'POR_SEMANA', frequencia_n: 4, por_sala: false, status: 'CONFIRMADO', motivo: 'Tempo medido na implantação', meses_atras: null }]],
  ['AT-02', 'BLOCO', 'Ensacamento e pesagem dos blocos', 'CUSTO_DO_BLOCO', [
    { equipe: 4, minutos_por_pessoa: 300, frequencia_tipo: 'POR_SEMANA', frequencia_n: 4, por_sala: false, status: 'CONFIRMADO', motivo: 'Tempo medido na implantação', meses_atras: null },
    { equipe: 3, minutos_por_pessoa: 330, frequencia_tipo: 'POR_SEMANA', frequencia_n: 4, por_sala: false, status: 'CONFIRMADO', motivo: 'Ensacadeira nova: uma pessoa a menos na linha', meses_atras: 5 },
  ]],
  ['AT-03', 'BLOCO', 'Esterilização na autoclave', 'CUSTO_DO_BLOCO', [{ equipe: 1, minutos_por_pessoa: 480, frequencia_tipo: 'POR_SEMANA', frequencia_n: 4, por_sala: false, status: 'CONFIRMADO', motivo: 'Tempo medido na implantação', meses_atras: null }]],
  ['AT-04', 'BLOCO', 'Inoculação em câmara limpa', 'CUSTO_DO_BLOCO', [{ equipe: 3, minutos_por_pessoa: 210, frequencia_tipo: 'POR_SEMANA', frequencia_n: 4, por_sala: false, status: 'CONFIRMADO', motivo: 'Tempo medido na implantação', meses_atras: null }]],
  ['AT-05', 'BLOCO', 'Vistoria das estantes de maturação', 'CUSTO_DO_BLOCO', [{ equipe: 1, minutos_por_pessoa: 90, frequencia_tipo: 'POR_SEMANA', frequencia_n: 3, por_sala: false, status: 'CONFIRMADO', motivo: 'Tempo medido na implantação', meses_atras: null }]],
  ['AT-06', 'CONTAMINACAO', 'Retirada e descarte de blocos contaminados', 'PREJUIZO_POR_CONTAMINACAO', [{ equipe: 2, minutos_por_pessoa: 60, frequencia_tipo: 'POR_SEMANA', frequencia_n: 2, por_sala: false, status: 'CONFIRMADO', motivo: 'Tempo medido na implantação', meses_atras: null }]],
  ['AT-07', 'BANDEJA', 'Abertura dos blocos na sala', 'CUSTO_DA_BANDEJA', [{ equipe: 3, minutos_por_pessoa: 180, frequencia_tipo: 'A_CADA_DIAS', frequencia_n: 30, por_sala: true, status: 'CONFIRMADO', motivo: 'Tempo medido na implantação', meses_atras: null }]],
  ['AT-08', 'BANDEJA', 'Rega e controle de umidade das salas', 'CUSTO_DA_BANDEJA', [{ equipe: 1, minutos_por_pessoa: 40, frequencia_tipo: 'POR_SEMANA', frequencia_n: 7, por_sala: true, status: 'CONFIRMADO', motivo: 'Tempo medido na implantação', meses_atras: null }]],
  ['AT-09', 'BANDEJA', 'Colheita', 'CUSTO_DA_BANDEJA', [{ equipe: 3, minutos_por_pessoa: 150, frequencia_tipo: 'POR_SEMANA', frequencia_n: 6, por_sala: false, status: 'CONFIRMADO', motivo: 'Tempo medido na implantação', meses_atras: null }]],
  ['AT-10', 'BANDEJA', 'Seleção, embalagem e etiquetagem', 'CUSTO_DA_BANDEJA', [
    { equipe: 3, minutos_por_pessoa: 180, frequencia_tipo: 'POR_SEMANA', frequencia_n: 6, por_sala: false, status: 'CONFIRMADO', motivo: 'Tempo medido na implantação', meses_atras: null },
    { equipe: 4, minutos_por_pessoa: 180, frequencia_tipo: 'POR_SEMANA', frequencia_n: 6, por_sala: false, status: 'CONFIRMADO', motivo: 'Mais uma pessoa com a entrada da quarta sala', meses_atras: 8 },
  ]],
  ['AT-11', 'ENTREGA', 'Separação dos pedidos e carregamento', 'CUSTO_DA_BANDEJA_ENTREGUE', [{ equipe: 2, minutos_por_pessoa: 90, frequencia_tipo: 'POR_SEMANA', frequencia_n: 4, por_sala: false, status: 'CONFIRMADO', motivo: 'Tempo medido na implantação', meses_atras: null }]],
  ['AT-12', 'GERAL', 'Limpeza geral e manutenção leve', 'DESPESA_GERAL', [{ equipe: 2, minutos_por_pessoa: 120, frequencia_tipo: 'POR_SEMANA', frequencia_n: 1, por_sala: false, status: 'CONFIRMADO', motivo: 'Tempo medido na implantação', meses_atras: null }]],
  ['AT-13', 'COMPARTILHADO', 'Reserva para imprevistos da operação', 'DESPESA_COMPARTILHADA', [{ equipe: 1, minutos_por_pessoa: 120, frequencia_tipo: 'POR_MES', frequencia_n: 4, por_sala: false, status: 'REFERENCIA', motivo: 'Reserva listada para não somar duas vezes', meses_atras: null }]],
];

const textoDaFrequencia = (v: Pick<VersaoDaAtividade, 'frequencia_tipo' | 'frequencia_n' | 'por_sala'>) =>
  (v.frequencia_tipo === 'POR_SEMANA' ? (v.frequencia_n === 1 ? '1 vez por semana' : `${v.frequencia_n} vezes por semana`)
    : v.frequencia_tipo === 'POR_MES' ? (v.frequencia_n === 1 ? '1 vez por mês' : `${v.frequencia_n} vezes por mês`)
      : `A cada ${v.frequencia_n} dias${v.por_sala ? ' por sala' : ''}`);
const horasHomem = (v: VersaoDaAtividade, salas: number) => {
  const execucoes = v.frequencia_tipo === 'POR_SEMANA' ? v.frequencia_n / 7 : v.frequencia_tipo === 'POR_MES' ? v.frequencia_n / 30 : 1 / v.frequencia_n;
  const porDia = execucoes * ((v.equipe * v.minutos_por_pessoa) / 60) * (v.por_sala ? salas : 1);
  return { por_semana: porDia * 7, por_30_dias: porDia * 30 };
};

export async function getCadastroMestre(): Promise<CadastroMestre> {
  const quarta = somarDias(INICIO_DA_DEMO, 30 * (MESES_VISIVEIS - 8));
  const reforma = { entrada: somarDias(INICIO_DA_DEMO, 30 * 6), saida: somarDias(INICIO_DA_DEMO, 30 * (MESES_VISIVEIS - 3)) };
  const sala = (id: number, nome: string, vigencias: Array<{ entrada: string; saida: string | null; motivo_entrada: string; motivo_saida: string | null }>) => ({
    id, nome, em_uso_hoje: vigencias.some((v) => v.entrada <= HOJE && (v.saida == null || HOJE < v.saida)),
    vigencias: vigencias.map((v, i) => ({ id: id * 10 + i, sala_id: id, ...v, entrada_por_nome: 'Gestão', saida_por_nome: v.saida ? 'Gestão' : null })),
  });
  const salas = [
    ...[1, 2, 3].map((n) => sala(n, `Sala ${n}`, [{ entrada: INICIO_DA_DEMO, saida: null, motivo_entrada: 'Sala em uso desde o início do sistema', motivo_saida: null }])),
    sala(4, 'Sala 4', [{ entrada: quarta, saida: null, motivo_entrada: 'Quarta sala de frutificação pronta', motivo_saida: null }]),
    sala(5, 'Sala de apoio', [{ entrada: reforma.entrada, saida: reforma.saida, motivo_entrada: 'Uso provisório durante a reforma da Sala 2', motivo_saida: 'Reforma concluída' }]),
  ];
  const emUso = salas.filter((s) => s.em_uso_hoje);
  let idVersao = 100;
  const atividades = ATIVIDADES_DO_CADASTRO.map(([codigo, etapa, nome, classificacao, vs], i): AtividadeDoCadastro => {
    const versoes = vs.map(({ meses_atras, ...v }, n): VersaoDaAtividade => {
      const desde = meses_atras == null ? INICIO_DA_DEMO : `${mesDe(IDX_HOJE - meses_atras)}-01`;
      idVersao += 1;
      return { id: idVersao, versao: n + 1, desde, ...v, criado_em: criadoEm(desde), criado_por_nome: 'Gestão', frequencia: textoDaFrequencia(v) };
    });
    const vigente = versoes.filter((v) => v.desde <= HOJE).pop() ?? null;
    return { id: i + 1, codigo, ordem: i + 1, etapa, nome, classificacao, vigente: vigente && { ...vigente, horas_homem: horasHomem(vigente, emUso.length) }, versoes };
  });
  return { hoje: HOJE, salas_de_frutificacao: { quantidade: emUso.length, nomes: emUso.map((s) => s.nome), salas }, atividades };
}

const MATERIAIS_DO_CADASTRO: Array<{ nome: string; grupo: MaterialDoCadastro['grupo']; aplicacao: string; fora?: { meses_atras: number; motivo: string };
  compras: Array<Pick<VersaoDoPreco, 'fornecedor' | 'apresentacao' | 'quantidade_apresentacoes' | 'conteudo_por_apresentacao' | 'unidade_base' | 'valor_total' | 'frete' | 'observacao'> & { meses_atras: number | null }> }> = [
  { nome: 'Serragem de eucalipto', grupo: 'FABRICACAO', aplicacao: 'Substrato de todos os blocos', compras: [
    { fornecedor: 'Serraria Vale Verde', apresentacao: 'Carga a granel', quantidade_apresentacoes: 1, conteudo_por_apresentacao: 12000, unidade_base: 'kg', valor_total: 3360, frete: 450, observacao: 'Preço da compra de referência', meses_atras: null },
    { fornecedor: 'Serraria Vale Verde', apresentacao: 'Carga a granel', quantidade_apresentacoes: 1, conteudo_por_apresentacao: 12000, unidade_base: 'kg', valor_total: 3600, frete: 450, observacao: 'Reajuste anual do fornecedor', meses_atras: 4 },
  ] },
  { nome: 'Farelo de trigo', grupo: 'FABRICACAO', aplicacao: 'Substrato de todos os blocos', compras: [
    { fornecedor: 'Moinho Boa Safra', apresentacao: 'Saco', quantidade_apresentacoes: 60, conteudo_por_apresentacao: 40, unidade_base: 'kg', valor_total: 4320, frete: 180, observacao: 'Preço da compra de referência', meses_atras: null },
    { fornecedor: 'Moinho Boa Safra', apresentacao: 'Saco', quantidade_apresentacoes: 60, conteudo_por_apresentacao: 40, unidade_base: 'kg', valor_total: 4080, frete: 180, observacao: 'Safra nova com preço menor', meses_atras: 2 },
  ] },
  { nome: 'Calcário calcítico', grupo: 'FABRICACAO', aplicacao: 'Correção do pH do substrato', compras: [
    { fornecedor: 'Mineração Pedra Clara', apresentacao: 'Saco', quantidade_apresentacoes: 40, conteudo_por_apresentacao: 25, unidade_base: 'kg', valor_total: 520, frete: 60, observacao: 'Preço da compra de referência', meses_atras: null },
  ] },
  { nome: 'Saco de cultivo com filtro', grupo: 'FABRICACAO', aplicacao: 'Um por bloco', compras: [
    { fornecedor: 'Plásticos Horizonte', apresentacao: 'Caixa', quantidade_apresentacoes: 20, conteudo_por_apresentacao: 500, unidade_base: 'un', valor_total: 6900, frete: 120, observacao: 'Preço da compra de referência', meses_atras: null },
  ] },
  { nome: 'Spawn de Shiitake', grupo: 'FABRICACAO', aplicacao: 'Inoculação do Shiitake', compras: [
    { fornecedor: 'Laboratório Micélio Vivo', apresentacao: 'Pacote', quantidade_apresentacoes: 150, conteudo_por_apresentacao: 2, unidade_base: 'kg', valor_total: 5250, frete: 0, observacao: 'Preço da compra de referência', meses_atras: null },
  ] },
  { nome: 'Spawn de Shimeji', grupo: 'FABRICACAO', aplicacao: 'Inoculação do Shimeji Preto e do Branco', compras: [
    { fornecedor: 'Laboratório Micélio Vivo', apresentacao: 'Pacote', quantidade_apresentacoes: 80, conteudo_por_apresentacao: 2, unidade_base: 'kg', valor_total: 2560, frete: 0, observacao: 'Preço da compra de referência', meses_atras: null },
  ] },
  { nome: 'Gás GLP da autoclave', grupo: 'FABRICACAO', aplicacao: 'Esterilização dos blocos', compras: [
    { fornecedor: 'Distribuidora Chama Azul', apresentacao: 'Botijão', quantidade_apresentacoes: 8, conteudo_por_apresentacao: 45, unidade_base: 'kg', valor_total: 3040, frete: 0, observacao: 'Preço da compra de referência', meses_atras: null },
  ] },
  { nome: 'Bandeja de isopor para 200 g', grupo: 'EMBALAGEM', aplicacao: 'Uma por bandeja', compras: [
    { fornecedor: 'Embalagens Sul', apresentacao: 'Fardo', quantidade_apresentacoes: 30, conteudo_por_apresentacao: 400, unidade_base: 'un', valor_total: 1980, frete: 90, observacao: 'Preço da compra de referência', meses_atras: null },
  ] },
  { nome: 'Filme de PVC de 38 cm', grupo: 'EMBALAGEM', aplicacao: 'Cerca de 0,6 m por bandeja', compras: [
    { fornecedor: 'Embalagens Sul', apresentacao: 'Rolo', quantidade_apresentacoes: 12, conteudo_por_apresentacao: 1000, unidade_base: 'm', valor_total: 1140, frete: 0, observacao: 'Preço da compra de referência', meses_atras: null },
  ] },
  { nome: 'Etiqueta com código de barras', grupo: 'EMBALAGEM', aplicacao: 'Uma por bandeja', compras: [
    { fornecedor: 'Gráfica Ponto Certo', apresentacao: 'Rolo', quantidade_apresentacoes: 10, conteudo_por_apresentacao: 2000, unidade_base: 'un', valor_total: 640, frete: 0, observacao: 'Preço da compra de referência', meses_atras: null },
  ] },
  { nome: 'Caixa de papelão para 10 bandejas', grupo: 'EMBALAGEM', aplicacao: 'Expedição', compras: [
    { fornecedor: 'Papelão Forte', apresentacao: 'Fardo', quantidade_apresentacoes: 40, conteudo_por_apresentacao: 50, unidade_base: 'un', valor_total: 2700, frete: 80, observacao: 'Preço da compra de referência', meses_atras: null },
  ] },
  { nome: 'Bandeja plástica para 250 g', grupo: 'EMBALAGEM', aplicacao: 'Uma por bandeja', fora: { meses_atras: 6, motivo: 'Trocada pela bandeja de isopor para 200 g' }, compras: [
    { fornecedor: 'Plásticos Horizonte', apresentacao: 'Caixa', quantidade_apresentacoes: 20, conteudo_por_apresentacao: 300, unidade_base: 'un', valor_total: 1560, frete: 60, observacao: 'Preço da compra de referência', meses_atras: null },
  ] },
];

export async function getCadastroDeCustos(): Promise<CadastroDeCustos> {
  let idVersao = 500;
  const materiais = MATERIAIS_DO_CADASTRO.map((m, i): MaterialDoCadastro => {
    const versoes = m.compras.map(({ meses_atras, ...c }, n): VersaoDoPreco => {
      const desde = meses_atras == null ? INICIO_DA_DEMO : `${mesDe(IDX_HOJE - meses_atras)}-01`;
      idVersao += 1;
      return {
        id: idVersao, versao: n + 1, desde, ...c,
        preco_unitario: Math.round(((c.valor_total + c.frete) / (c.quantidade_apresentacoes * c.conteudo_por_apresentacao)) * 10000) / 10000,
        documento: `NF ${41200 + idVersao * 7}`, criado_em: criadoEm(desde), criado_por_nome: 'Gestão',
      };
    });
    return {
      id: i + 1, nome: m.nome, grupo: m.grupo, aplicacao: m.aplicacao, criado_em: criadoEm(INICIO_DA_DEMO), criado_por_nome: 'Gestão',
      fora_do_ativo_desde: m.fora ? `${mesDe(IDX_HOJE - m.fora.meses_atras)}-01` : null, motivo_fora_do_ativo: m.fora?.motivo ?? null,
      vigente: versoes.filter((v) => v.desde <= HOJE).pop() ?? null, versoes,
    };
  });
  return { hoje: HOJE, janela: { de: `${HOJE.slice(0, 7)}-01`, ate: ultimoDia(IDX_HOJE + 1) }, materiais };
}

export const razaoDaDemo = () => razao();
export const lotesDaDemoParaTeste = () => lotesDaDemo();
