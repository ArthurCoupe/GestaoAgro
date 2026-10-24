import { ocupacaoDeMaturacaoPorEstante } from './painelEstrategico.js';
import { chaveDaEstante, quadroDaJornada } from './quadroDasEstantes.js';

const num = (v) => (v == null || v === '' || Number.isNaN(Number(v)) ? null : Number(v));
const etiq = (v) => (v == null ? '' : String(v).trim());
const ordemNumerica = (a, b) => (Number(a) - Number(b)) || a.localeCompare(b);
const somaOuNull = (xs) => (xs.some((x) => x == null) ? null : xs.reduce((s, x) => s + x, 0));

function ocupacaoDeFrutificacao(transferencias = [], liberacoes = []) {
  const ultima = new Map();
  for (const l of liberacoes) {
    const k = `${l.sala_codigo}|${etiq(l.estante)}`;
    if (!ultima.has(k) || l.data > ultima.get(k)) ultima.set(k, l.data);
  }
  const porEstante = new Map();
  const semSala = { aberturas: 0, blocos: 0, sem_quantidade: 0 };
  for (const t of transferencias) {
    if (t.tipo !== 'ABERTURA') continue;
    if (!t.sala_destino) {
      semSala.aberturas += 1;
      const q = num(t.quantidade);
      if (q == null) semSala.sem_quantidade += 1; else semSala.blocos += q;
      continue;
    }
    const k = `${t.sala_destino}|${etiq(t.estante_destino)}`;
    const lib = ultima.get(k);
    if (lib && t.data < lib) continue;
    const atual = porEstante.get(k) ?? { blocos: 0, sem_quantidade: 0, lotes: [] };
    const q = num(t.quantidade);
    if (q == null) atual.sem_quantidade += 1; else atual.blocos += q;
    atual.lotes.push({ id: t.lote_id, codigo: null, blocos: q });
    porEstante.set(k, atual);
  }
  return { porEstante, semSala };
}

export function capacidadeLivre({ salas = [], estantes = [], lotes = [], eventos = [], transferencias = [], liberacoes = [], quadro } = {}) {
  if (!quadro) {
    throw new Error(
      'capacidadeLivre: `quadro` e obrigatorio. As estantes ocupadas e vazias da maturacao saem dele '
      + '(quadroDasEstantes), e um default vazio daria todas vazias sem aviso.',
    );
  }
  const quadroPorSala = new Map((quadro.galpoes ?? []).map((g) => [String(g.sala_id), g]));
  const salasOrdenadas = [...salas].sort((a, b) => (Number(a.ordem ?? 0) - Number(b.ordem ?? 0)) || (Number(a.id) - Number(b.id)));
  const codigoPorSalaId = new Map(salasOrdenadas.map((s) => [String(s.id), s.galpao_codigo]));
  const liberacoesComCodigo = liberacoes.map((l) => ({ ...l, sala_codigo: l.sala_codigo ?? codigoPorSalaId.get(String(l.sala_id)) ?? null }));

  const maturacao = {};
  for (const [galpao, porEtiqueta] of Object.entries(ocupacaoDeMaturacaoPorEstante({ lotes, eventos }))) {
    maturacao[galpao] = {};
    for (const [etiqueta, m] of Object.entries(porEtiqueta)) {
      const atual = maturacao[galpao][chaveDaEstante(etiqueta)] ??= { blocos: 0, lotes: [], etiqueta };
      atual.blocos += m.blocos;
      atual.lotes.push(...m.lotes);
    }
  }
  const { porEstante: frut, semSala } = ocupacaoDeFrutificacao(transferencias, liberacoesComCodigo);

  const usadas = new Set();
  const linhas = salasOrdenadas.map((s) => {
    const daSala = estantes.filter((e) => String(e.sala_id) === String(s.id)).sort((a, b) => ordemNumerica(etiq(a.etiqueta), etiq(b.etiqueta)));
    const ativa = s.ativa !== false;
    const recebe = new Map();
    for (const e of daSala) {
      const c = chaveDaEstante(etiq(e.etiqueta));
      const atual = recebe.get(c);
      if (!atual || ((atual.status ?? 'ATIVA') !== 'ATIVA' && (e.status ?? 'ATIVA') === 'ATIVA')) recebe.set(c, e);
    }
    const rows = daSala.map((e) => {
      const etiqueta = etiq(e.etiqueta);
      let ocupados = 0; let lotesDaEstante = []; let semQuantidade = 0;
      if (s.etapa === 'FRUTIFICACAO') {
        const f = frut.get(`${s.galpao_codigo}|${etiqueta}`);
        if (f) { ocupados = f.sem_quantidade ? null : f.blocos; lotesDaEstante = f.lotes; semQuantidade = f.sem_quantidade; usadas.add(`${s.galpao_codigo}|${etiqueta}`); }
      } else {
        const m = recebe.get(chaveDaEstante(etiqueta)) === e ? maturacao[s.galpao_codigo]?.[chaveDaEstante(etiqueta)] : undefined;
        if (m) { ocupados = m.blocos; lotesDaEstante = m.lotes; usadas.add(`${s.galpao_codigo}|${chaveDaEstante(etiqueta)}`); }
      }
      const repetida = s.etapa === 'MATURACAO' && recebe.get(chaveDaEstante(etiqueta)) !== e;
      const contaNaCapacidade = ativa && e.status === 'ATIVA' && !repetida;
      const capacidade = contaNaCapacidade ? (num(e.capacidade_blocos) ?? 0) : 0;
      const livres = !contaNaCapacidade ? 0 : (ocupados == null ? null : Math.max(capacidade - ocupados, 0));
      return { etiqueta, status: e.status ?? 'ATIVA', capacidade, ocupados, livres, sem_quantidade: semQuantidade, lotes: lotesDaEstante, conta: contaNaCapacidade };
    });
    const contam = rows.filter((r) => r.conta);
    const fora = rows.filter((r) => !r.conta && (r.ocupados == null || r.ocupados > 0)).map((r) => ({ etiqueta: r.etiqueta, status: r.status, ocupados: r.ocupados }));
    const capacidade = contam.reduce((sum, r) => sum + r.capacidade, 0);
    const ocupados = somaOuNull(contam.map((r) => r.ocupados));
    const livres = ocupados == null ? null : contam.reduce((sum, r) => sum + r.livres, 0);
    const acima = ocupados == null ? null : contam.reduce((sum, r) => sum + Math.max(r.ocupados - r.capacidade, 0), 0);
    const doQuadro = s.etapa === 'MATURACAO' && ativa ? quadroPorSala.get(String(s.id)) : null;
    if (doQuadro === undefined) {
      throw new Error(`capacidadeLivre: o quadro nao tem a sala de maturacao ativa ${s.id} (${s.galpao_codigo}); monte-o com quadroDasEstantes sobre as mesmas salas.`);
    }
    const ocupadas = contam.filter((r) => r.ocupados == null || r.ocupados > 0);
    const livresLista = doQuadro ? doQuadro.etiquetas_vazias
      : contam.filter((r) => r.ocupados === 0).map((r) => r.etiqueta);
    return {
      sala_id: s.id, nome: s.nome, galpao_codigo: s.galpao_codigo, etapa: s.etapa, ativa,
      capacidade, ocupados, livres, acima_da_capacidade: acima,
      pct_ocupacao: ocupados == null || capacidade === 0 ? null : Math.round((ocupados / capacidade) * 1000) / 10,
      estantes_total: doQuadro ? doQuadro.estantes : contam.length,
      estantes_ocupadas: doQuadro ? doQuadro.ocupadas : ocupadas.length,
      estantes_livres: livresLista.length,
      etiquetas_livres: livresLista,
      sem_quantidade: rows.reduce((sum, r) => sum + r.sem_quantidade, 0),
      fora_da_capacidade: fora,
      estantes: rows.map(({ conta, ...r }) => r),
    };
  });

  const desconhecidas = [];
  for (const [galpao, porEtiqueta] of Object.entries(maturacao)) {
    for (const [chave, m] of Object.entries(porEtiqueta)) {
      if (!usadas.has(`${galpao}|${chave}`)) desconhecidas.push({ galpao, etiqueta: m.etiqueta, blocos: m.blocos });
    }
  }
  for (const [k, f] of frut) {
    if (usadas.has(k)) continue;
    const [galpao, etiqueta] = k.split('|');
    desconhecidas.push({ galpao, etiqueta, blocos: f.sem_quantidade ? null : f.blocos });
  }
  const totalDe = (etapa) => {
    const ativas = linhas.filter((l) => l.etapa === etapa && l.ativa);
    const cego = etapa === 'FRUTIFICACAO' && semSala.aberturas > 0;
    return {
      capacidade: ativas.reduce((s, l) => s + l.capacidade, 0),
      ocupados: cego ? null : somaOuNull(ativas.map((l) => l.ocupados)),
      livres: cego ? null : somaOuNull(ativas.map((l) => l.livres)),
      acima_da_capacidade: cego ? null : somaOuNull(ativas.map((l) => l.acima_da_capacidade)),
    };
  };
  const sem_dado = salasOrdenadas.length ? [] : [{ bloco: 'CAPACIDADE', motivo: 'Nenhuma sala cadastrada com etapa e código de galpão.' }];
  return {
    salas: linhas,
    totais: { maturacao: totalDe('MATURACAO'), frutificacao: totalDe('FRUTIFICACAO') },
    estantes_desconhecidas: desconhecidas,
    sem_sala: semSala,
    sem_dado,
  };
}

/**
 * @param {{salas?:Array, estantes?:Array, transferencias?:Array, liberacoes?:Array}} cadastro
 * @param {object} dados
 * @param {{hoje:string, regrasPorEspecie?:object}} opcoes
 */
export function capacidadeDaJornada(cadastro, dados, { hoje, regrasPorEspecie } = {}) {
  return capacidadeLivre({
    ...cadastro, lotes: dados.lotes, eventos: dados.eventos,
    quadro: quadroDaJornada(cadastro, dados, { hoje, regrasPorEspecie }),
  });
}
