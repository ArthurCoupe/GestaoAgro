import { ORDEM_VARIEDADE } from './rateioGerencialService.js';
import { operacaoDaMarca } from './operacaoDaMarca.js';
import { unidadesVendidasPorMes } from './unidadesVendidas.js';

export const ESPECIE_DA_EMBALAGEM = [
  [/^Shiitake/i, 'SH'],
  [/^Shimeji Preto/i, 'SP'],
  [/^Shimeji Branco/i, 'SB'],
  [/Salm/i, 'SS'],
];

export function especieDaEmbalagem(nome) {
  for (const [re, sigla] of ESPECIE_DA_EMBALAGEM) if (re.test(String(nome ?? ''))) return sigla;
  return null;
}

export function nomesSemEspecie(embalagem = []) {
  const nomes = new Set();
  for (const e of embalagem) {
    const nome = e.embalagem_produtos?.nome;
    if (!nome || especieDaEmbalagem(nome) || nome.startsWith('Pimentão')) continue;
    nomes.add(nome);
  }
  return [...nomes].sort();
}

const zero = () => Object.fromEntries(ORDEM_VARIEDADE.map((v) => [v, 0]));
const mesDe = (data) => `${String(data).slice(0, 7)}-01`;

export function pesosPorMes({ embalagem = [], lotes = [], colheitas = [], vendas = [] } = {}) {
  const meses = new Map();
  const balde = (data) => {
    const k = mesDe(data);
    if (!meses.has(k)) meses.set(k, { BANDEJAS_PRODUZIDAS: zero(), BLOCOS_PRODUZIDOS: zero(), KG_PRODUZIDOS: zero(), RECEITA_DA_ESPECIE: zero(), BANDEJAS_VENDIDAS: zero() });
    return meses.get(k);
  };
  for (const e of embalagem) {
    const especie = especieDaEmbalagem(e.embalagem_produtos?.nome);
    if (!especie) continue;
    balde(e.data).BANDEJAS_PRODUZIDAS[especie] += Number(e.quantidade ?? 0);
  }
  for (const l of lotes) {
    if (!ORDEM_VARIEDADE.includes(l.tipo_cogumelo)) continue;
    balde(l.data_inoculacao).BLOCOS_PRODUZIDOS[l.tipo_cogumelo] += Number(l.qtd_blocos ?? 0);
  }
  for (const c of colheitas) {
    const especie = c.lotes_producao?.tipo_cogumelo;
    if (!ORDEM_VARIEDADE.includes(especie)) continue;
    balde(c.data_colheita).KG_PRODUZIDOS[especie] += Number(c.peso_kg ?? 0);
  }
  const unidades = unidadesVendidasPorMes(vendas);
  const mesIncompleto = (competencia) => (unidades.get(mesDe(competencia))?.faltaRelatorio.length ?? 0) > 0;
  for (const v of vendas) {
    if (operacaoDaMarca(v.marca) !== 'PRODUCAO' || !ORDEM_VARIEDADE.includes(v.especie)) continue;
    const b = balde(v.competencia);
    if (mesIncompleto(v.competencia)) continue;
    b.RECEITA_DA_ESPECIE[v.especie] += Math.round(Number(v.valor ?? 0) * 100);
  }
  for (const [mes, u] of unidades) {
    if (u.faltaRelatorio.length > 0 || u.problemas.length > 0) continue;
    if (Object.values(u.especieDaProducao).every((q) => q === 0)) continue;
    balde(mes).BANDEJAS_VENDIDAS = { ...u.especieDaProducao };
  }
  for (const m of meses.values()) for (const v of ORDEM_VARIEDADE) m.KG_PRODUZIDOS[v] = Math.round(m.KG_PRODUZIDOS[v] * 1000) / 1000;
  return meses;
}

export const FONTES_DO_MES_DA_VENDA = Object.freeze(['BANDEJAS_VENDIDAS', 'RECEITA_DA_ESPECIE']);

export function pesosDoMesDoLancamento(porMes, mesDoRegime, mesDaCompetencia) {
  const doRegime = porMes.get(mesDoRegime) ?? {};
  if (mesDaCompetencia === mesDoRegime) return doRegime;
  const daCompetencia = porMes.get(mesDaCompetencia) ?? {};
  const saida = { ...doRegime };
  for (const f of FONTES_DO_MES_DA_VENDA) {
    if (daCompetencia[f]) saida[f] = daCompetencia[f];
    else delete saida[f];
  }
  return saida;
}
