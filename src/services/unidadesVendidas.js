import { operacaoDaMarca } from './operacaoDaMarca.js';

export const UNIDADES_DE_COGUMELO = Object.freeze(['UND', 'UN', 'UNID', 'PACOTE']);
export const EMPRESAS = Object.freeze(['AR', 'EXEMPLO']);
const NOME = { AR: 'Aurora', EXEMPLO: 'Exemplo Alimentos' };
const ESPECIES = ['SH', 'SP', 'SB', 'SS'];
const mesDe = (d) => `${String(d).slice(0, 7)}-01`;

export function unidadesVendidasPorMes(vendas = []) {
  const meses = new Map();
  for (const v of vendas) {
    const k = mesDe(v.competencia);
    if (!meses.has(k)) meses.set(k, { pMil: 0, rMil: 0, esp: { SH: 0, SP: 0, SB: 0, SS: 0 }, empresas: new Set(), problemas: [] });
    const b = meses.get(k);
    b.empresas.add(v.empresa);
    const op = operacaoDaMarca(v.marca);
    if (op === null) { b.problemas.push(`marca "${v.marca}" sem operação no produto ${v.codigo_produto} da ${NOME[v.empresa]}`); continue; }
    const unidade = String(v.unidade ?? '').trim();
    const deCogumelo = UNIDADES_DE_COGUMELO.includes(unidade.toUpperCase());
    const comEspecie = ESPECIES.includes(v.especie);
    const lado = op === 'REVENDA' ? 'r' : (comEspecie ? 'p' : null);
    if (!lado) {
      if (deCogumelo) b.problemas.push(`produto ${v.codigo_produto} da ${NOME[v.empresa]} na marca ${v.marca} sem espécie, vendido em ${unidade}`);
      continue;
    }
    if (!deCogumelo) {
      b.problemas.push(`unidade "${unidade}" no produto ${v.codigo_produto} da ${NOME[v.empresa]} (marca ${v.marca})`);
      continue;
    }
    const q = Math.round(Number(v.quantidade) * 1000);
    if (lado === 'p') { b.pMil += q; b.esp[v.especie] += q; } else b.rMil += q;
  }
  return new Map([...meses].sort(([a], [b]) => a.localeCompare(b)).map(([k, b]) => {
    const producao = b.pMil / 1000; const revenda = b.rMil / 1000;
    const problemas = [...b.problemas];
    if (b.pMil < 0 || b.rMil < 0) problemas.push(`quantidade negativa no mês (Produção ${producao}, Revenda ${revenda})`);
    return [k, {
      producao, revenda,
      especieDaProducao: Object.fromEntries(ESPECIES.map((e) => [e, b.esp[e] / 1000])),
      empresas: EMPRESAS.filter((e) => b.empresas.has(e)),
      faltaRelatorio: EMPRESAS.filter((e) => !b.empresas.has(e)),
      problemas,
    }];
  }));
}

export function semMesesParciais(vendas = [], cobertura = []) {
  const quem = new Map();
  for (const c of cobertura ?? []) {
    const mes = mesDe(c.competencia);
    const ultimo = new Date(Date.UTC(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0)).toISOString().slice(0, 10);
    const ate = String(c.extraido_ate).slice(0, 10);
    if (ate >= ultimo) continue;
    quem.set(mes, [...(quem.get(mes) ?? []), `${NOME[c.empresa] ?? c.empresa} até ${ate.slice(8, 10)}/${ate.slice(5, 7)}`]);
  }
  const parciais = new Map([...quem].sort(([a], [b]) => a.localeCompare(b)).map(([mes, q]) => [mes, `mês carregado só em parte (${q.sort().join(', ')})`]));
  return { vendas: vendas.filter((v) => !parciais.has(mesDe(v.competencia))), parciais };
}

export function pesosDoNegocioPorMes(unidades) {
  const pesos = new Map(); const semPeso = new Map();
  for (const [mes, u] of unidades) {
    const motivo = u.problemas.length > 0 ? u.problemas.join('; ')
      : u.faltaRelatorio.length > 0 ? `falta o relatório de vendas por produto da ${u.faltaRelatorio.map((e) => NOME[e]).join(' e da ')}`
        : u.producao + u.revenda <= 0 ? 'nenhuma unidade de cogumelo vendida no mês' : null;
    if (motivo) semPeso.set(mes, motivo);
    else pesos.set(mes, { UNIDADES_COGUMELO_VENDIDAS: { PRODUCAO: u.producao, REVENDA: u.revenda } });
  }
  return { pesos, semPeso };
}
