const DIA = 86400000;
const ms = (iso) => Date.parse(`${iso}T00:00:00Z`);

export function diasDoPeriodo(inicio, fim) {
  const dias = [];
  for (let t = ms(inicio); t <= ms(fim); t += DIA) dias.push(new Date(t).toISOString().slice(0, 10));
  return dias;
}

/**
 * @param {{lotes?: Array, eventos?: Array, aberturasPorLote?: Array}} dados
 * @param {{inicio: string, fim: string, idsNoEscopo?: Set<number>|null}} opcoes
 * @returns {{dias: number, porLinha: Map<number, {bloco_dias: number, saldo_negativo: boolean, incompleto: boolean}>}}
 */
export function ocupacaoNoPeriodo(dados = {}, { inicio, fim, idsNoEscopo = null } = {}) {
  const dias = diasDoPeriodo(inicio, fim);
  const saidas = new Map();
  const incompletos = new Set();
  const quantidadeInvalida = (q) => q == null || !Number.isFinite(Number(q));
  const somarSaida = (id, d, q, abertura) => {
    if (!d) return;
    if (!saidas.has(id)) saidas.set(id, []);
    saidas.get(id).push({ d, q: Number(q) || 0, abertura });
  };
  for (const e of dados.eventos ?? []) {
    if (e.tipo === 'CONTAMINACAO' || e.tipo === 'PERDA') {
      if (quantidadeInvalida(e.quantidade)) incompletos.add(e.lote_id);
      somarSaida(e.lote_id, e.data_evento, e.quantidade, false);
    }
  }
  const comAberturaDatada = new Set();
  const somaAberturaDatadaPorLote = new Map();
  for (const a of dados.aberturasPorLote ?? []) {
    if (!a.data) continue;
    comAberturaDatada.add(a.lote_id);
    if (quantidadeInvalida(a.quantidade)) incompletos.add(a.lote_id);
    somarSaida(a.lote_id, a.data, a.quantidade, true);
    const q = Number(a.quantidade) || 0;
    somaAberturaDatadaPorLote.set(a.lote_id, (somaAberturaDatadaPorLote.get(a.lote_id) ?? 0) + q);
  }

  const porLinha = new Map();
  for (const l of dados.lotes ?? []) {
    if (l.lote_pesquisa === true) continue;
    if (idsNoEscopo && !idsNoEscopo.has(l.id)) continue;
    if (!l.data_lote || l.data_lote > fim) continue;
    const lista = [...(saidas.get(l.id) ?? [])];
    const abertos = Number(l.blocos_abertos) || 0;
    if (comAberturaDatada.has(l.id)) {
      const resto = abertos - (somaAberturaDatadaPorLote.get(l.id) ?? 0);
      if (resto > 0 && l.data_abertura) {
        lista.push({ d: l.data_abertura, q: resto, abertura: true });
        incompletos.add(l.id);
      } else if (resto > 0) {
        incompletos.add(l.id);
      }
    } else if (abertos > 0 && l.data_abertura) {
      lista.push({ d: l.data_abertura, q: abertos, abertura: true });
    } else if (abertos > 0 && !l.data_abertura) {
      incompletos.add(l.id);
    }
    lista.sort((a, b) => a.d.localeCompare(b.d));
    const ultimaAbertura = lista.filter((s) => s.abertura).reduce((m, s) => (m == null || s.d > m ? s.d : m), null);
    const produzidos = Number(l.blocos_produzidos) || 0;
    const encerramento = l.status === 'ENCERRADO' ? (l.data_encerramento ?? '1900-01-01') : null;
    const zerou = l.zerou_estante === true;
    if (zerou && ultimaAbertura == null) incompletos.add(l.id);

    let blocoDias = 0;
    let saldoNegativo = false;
    let saiu = 0;
    let i = 0;
    for (const d of dias) {
      while (i < lista.length && lista[i].d <= d) { saiu += lista[i].q; i += 1; }
      if (d < l.data_lote) continue;
      if (encerramento && d >= encerramento) continue;
      if (zerou && ultimaAbertura && d >= ultimaAbertura) continue;
      const saldo = produzidos - saiu;
      if (saldo < 0) saldoNegativo = true;
      blocoDias += Math.max(saldo, 0);
    }
    porLinha.set(l.id, { bloco_dias: blocoDias, saldo_negativo: saldoNegativo, incompleto: incompletos.has(l.id) && blocoDias > 0 });
  }
  return { dias: dias.length, porLinha };
}
