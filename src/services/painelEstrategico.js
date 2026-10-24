const num = (v) => (v == null || Number.isNaN(Number(v)) ? null : Number(v));
const ptBr = (v, casas = 0) =>
  v == null ? '—' : Number(v).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });

const semDado = (chave, titulo, motivo) => ({
  chave, titulo,
  situacao: motivo,
  decisao: 'SEM_DADO',
  sugestao: null,
  severidade: 'SEM_DADO',
  referencia: 'sem base de calculo',
  detalhes: null,
});

const EVENTOS_QUE_LIBERAM_ESTANTE = new Set(['CONTAMINACAO', 'PERDA']);

export const GALPAO_NAO_INFORMADO = 'sem galpão informado';

const codigoDeGalpao = (v) => String(v ?? '').trim();

function retiradoPorLote(eventos = []) {
  const m = new Map();
  for (const e of eventos) {
    if (!EVENTOS_QUE_LIBERAM_ESTANTE.has(e.tipo)) continue;
    m.set(e.lote_id, (m.get(e.lote_id) ?? 0) + (num(e.quantidade) ?? 0));
  }
  return m;
}

const saiuDaMaturacao = (l) => l.status === 'ENCERRADO' || l.zerou_estante === true;

function liquidoDoLote(l, retirado) {
  const liquido = (num(l.blocos_produzidos) ?? 0) - (num(l.blocos_abertos) ?? 0) - (retirado.get(l.id) ?? 0);
  return Math.max(liquido, 0);
}

export const ESTANTE_NAO_INFORMADA = 'ESTANTE_NAO_INFORMADA';

export function ocupacaoDeMaturacaoPorEstante({ lotes = [], eventos = [] } = {}) {
  const retirado = retiradoPorLote(eventos);
  const saida = {};
  for (const l of lotes) {
    if (saiuDaMaturacao(l)) continue;
    const galpao = codigoDeGalpao(l.galpao) || GALPAO_NAO_INFORMADO;
    const etiqueta = l.estante_maturacao == null || String(l.estante_maturacao).trim() === ''
      ? ESTANTE_NAO_INFORMADA : String(l.estante_maturacao).trim();
    const blocos = liquidoDoLote(l, retirado);
    saida[galpao] ??= {};
    saida[galpao][etiqueta] ??= { blocos: 0, lotes: [] };
    saida[galpao][etiqueta].blocos += blocos;
    saida[galpao][etiqueta].lotes.push({ id: l.id, codigo: l.codigo ?? null, blocos });
  }
  return saida;
}

/**
 * @param {{lotes: Array, eventos: Array}} p
 * @returns {Record<string, number>}
 */
export function ocupacaoDeMaturacaoPorGalpao({ lotes = [], eventos = [] } = {}) {
  const retirado = retiradoPorLote(eventos);

  const porGalpao = {};
  for (const l of lotes) {
    if (saiuDaMaturacao(l)) continue;
    const galpao = codigoDeGalpao(l.galpao) || GALPAO_NAO_INFORMADO;
    const liquido = liquidoDoLote(l, retirado);
    porGalpao[galpao] = (porGalpao[galpao] ?? 0) + liquido;
  }
  return porGalpao;
}

const TITULO_CAPACIDADE = 'Capacidade de maturação';

export function cartaoCapacidade({
  salas = [], ocupacaoPorGalpao = {}, regrasMaturacao = [], metas = {},
} = {}) {
  const comCapacidade = salas.filter((s) => num(s.capacidade_blocos) > 0);
  if (!comCapacidade.length) {
    return semDado('CAPACIDADE', TITULO_CAPACIDADE,
      'Nenhuma sala com capacidade cadastrada.');
  }

  const codigosMaturacao = new Set(
    regrasMaturacao.map((r) => codigoDeGalpao(r.galpao_codigo)).filter((c) => c !== ''),
  );
  if (!codigosMaturacao.size) {
    return semDado('CAPACIDADE', TITULO_CAPACIDADE,
      'Nenhuma regra de maturação cadastrada: não é possível saber quais salas são de '
      + 'maturação, e contar as de frutificação junto subestimaria a ocupação.');
  }

  const deMaturacao = comCapacidade.filter((s) => codigosMaturacao.has(codigoDeGalpao(s.galpao_codigo)));
  if (!deMaturacao.length) {
    return semDado('CAPACIDADE', TITULO_CAPACIDADE,
      'Nenhuma sala cadastrada tem código de galpão de maturação ('
      + [...codigosMaturacao].join(', ')
      + '): não é possível ligar a ocupação da maturação às salas.');
  }

  const chavesComOcupacao = Object.entries(ocupacaoPorGalpao)
    .filter(([, v]) => num(v) > 0)
    .map(([chave]) => chave);
  const algumaSalaCasou = deMaturacao.some((s) => chavesComOcupacao.includes(codigoDeGalpao(s.galpao_codigo)));
  if (chavesComOcupacao.length && !algumaSalaCasou) {
    return semDado('CAPACIDADE', TITULO_CAPACIDADE,
      'Há blocos ocupados registrados, mas nenhuma sala de maturação cadastrada tem o código '
      + 'de galpão correspondente: não é possível ligar a ocupação às salas.');
  }

  const limite = num(metas.ocupacao_alerta_pct?.valor);
  const total = deMaturacao.reduce((s, x) => s + num(x.capacidade_blocos), 0);

  const codigoContagem = new Map();
  for (const s of deMaturacao) {
    const codigo = codigoDeGalpao(s.galpao_codigo);
    if (codigo === '') continue;
    codigoContagem.set(codigo, (codigoContagem.get(codigo) ?? 0) + 1);
  }
  const galpoesAmbiguos = [...codigoContagem.entries()]
    .filter(([, n]) => n > 1)
    .map(([codigo]) => codigo);
  const galpoesAmbiguosSet = new Set(galpoesAmbiguos);

  const ocupado = [...codigoContagem.keys()]
    .reduce((s, codigo) => s + (num(ocupacaoPorGalpao[codigo]) ?? 0), 0);
  const livre = total - ocupado;
  const pct = total ? (ocupado * 100) / total : null;

  const galpoesSemSala = chavesComOcupacao.filter((codigo) => !codigoContagem.has(codigo));
  const ocupadoSemSala = galpoesSemSala
    .reduce((s, codigo) => s + (num(ocupacaoPorGalpao[codigo]) ?? 0), 0);
  const semDono = ocupadoSemSala > 0;

  const porSala = deMaturacao.map((s) => {
    const cap = num(s.capacidade_blocos);
    const codigo = codigoDeGalpao(s.galpao_codigo);
    const ambiguo = codigo !== '' && galpoesAmbiguosSet.has(codigo);
    const oc = ambiguo ? null : (num(ocupacaoPorGalpao[codigo]) ?? 0);
    return { nome: s.nome, galpao: codigo, cap, ocupado: oc, pct: (cap && oc != null) ? (oc * 100) / cap : null };
  }).sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1)
    || (String(a.nome ?? '') < String(b.nome ?? '') ? -1
      : String(a.nome ?? '') > String(b.nome ?? '') ? 1 : 0));
  const aperta = porSala.find((s) => s.pct != null) ?? null;

  const salaApertada = limite != null && aperta != null && aperta.pct >= limite;
  const acima = (limite != null && pct != null && pct >= limite) || salaApertada;

  const estouraCapacidade = livre < 0;
  const exigeAtencao = acima || semDono || estouraCapacidade;

  const avisoSemDono = semDono
    ? ` Fora desta conta: ${ptBr(ocupadoSemSala)} blocos ocupados sem sala de maturação com capacidade cadastrada (${galpoesSemSala.join(', ')})`
      + ': como a capacidade desses galpões é desconhecida, o percentual acima ignora tanto os blocos quanto o espaço deles, e a ocupação real pode ser maior ou menor.'
    : '';

  const codigosComSalaCadastrada = new Set(
    salas.map((s) => codigoDeGalpao(s?.galpao_codigo)).filter((c) => c !== ''),
  );
  const semCapacidade = galpoesSemSala
    .filter((c) => codigosMaturacao.has(c) && codigosComSalaCadastrada.has(c));
  const semSalaNenhuma = galpoesSemSala
    .filter((c) => codigosMaturacao.has(c) && !codigosComSalaCadastrada.has(c));
  const foraDaMaturacao = galpoesSemSala.filter(
    (c) => !codigosMaturacao.has(c) && c !== GALPAO_NAO_INFORMADO,
  );
  const pedidoDeCorrecao = [
    semCapacidade.length
      ? `Cadastre a capacidade da sala do galpão ${semCapacidade.join(', ')}.`
      : '',
    semSalaNenhuma.length
      ? `Nenhuma sala cadastrada tem o código de galpão ${semSalaNenhuma.join(', ')}:`
        + ' esse vínculo precisa ser criado no cadastro de salas: a tela de estrutura ainda não grava esse campo.'
      : '',
    foraDaMaturacao.length
      ? `Confira o galpão dos lotes lançados em ${foraDaMaturacao.join(', ')}: não é galpão de maturação.`
      : '',
    galpoesSemSala.includes(GALPAO_NAO_INFORMADO)
      ? 'Informe o galpão dos lotes que estão em maturação sem ele.'
      : '',
  ].filter(Boolean).join(' ');

  const fraseDoLivre = !estouraCapacidade
    ? `Livre: ${ptBr(livre)} blocos.`
    : `Sem espaço livre: ${ptBr(-livre)} blocos além da capacidade cadastrada.`;
  const fraseDoCabe = !estouraCapacidade
    ? `Ainda cabem ${ptBr(livre)} blocos na maturação com a estrutura atual.`
    : `Não cabe aumento: a maturação já está ${ptBr(-livre)} blocos além da capacidade cadastrada.`;
  const sobraDaSala = aperta ? aperta.cap - aperta.ocupado : null;
  const fraseDaSala = !aperta ? ''
    : sobraDaSala >= 0
      ? `Aumento de produção limitado pela ${aperta.nome}: cabem mais ${ptBr(sobraDaSala)} blocos nela.`
      : `Aumento de produção bloqueado pela ${aperta.nome}: ela já está ${ptBr(-sobraDaSala)} blocos além da capacidade cadastrada (${ptBr(aperta.cap)} blocos).`;
  return {
    chave: 'CAPACIDADE',
    titulo: TITULO_CAPACIDADE,
    situacao: (salaApertada
      ? `Ocupação em ${ptBr(pct, 0)}% da capacidade de maturação. A ${aperta.nome} é a que aperta primeiro, com ${ptBr(aperta.pct, 0)}%.`
      : acima
        ? `Ocupação em ${ptBr(pct, 0)}% da capacidade de maturação. Não é possível dizer qual sala aperta primeiro: o código de galpão está duplicado entre salas (${galpoesAmbiguos.join(', ')}).`
        : semDono
          ? `Ocupação em ${ptBr(pct, 0)}% da capacidade de maturação.`
          : `Ocupação em ${ptBr(pct, 0)}% da capacidade de maturação. ${fraseDoLivre}`) + avisoSemDono,
    decisao: exigeAtencao ? 'ATENCAO' : 'MANTER',
    sugestao: [
      salaApertada
        ? fraseDaSala
        : acima
          ? 'Corrija o código de galpão duplicado entre salas para saber quanto ainda cabe em cada uma.'
          : semDono ? '' : fraseDoCabe,
      semDono
        ? `Há ${ptBr(ocupadoSemSala)} blocos ocupados sem sala cadastrada (${galpoesSemSala.join(', ')}).`
        : '',
      pedidoDeCorrecao,
    ].filter(Boolean).join(' '),
    severidade: exigeAtencao ? 'AMARELO' : 'VERDE',
    referencia: (limite != null
      ? `limite de atenção em ${ptBr(limite)}% (${metas.ocupacao_alerta_pct?.origem === 'BANCO' ? 'meta cadastrada' : 'padrão do sistema'})`
      : 'sem limite de atenção definido')
      + ` · só maturação (galpões ${[...codigosMaturacao].join(', ')}, de regras_maturacao_sala)`,
    detalhes: {
      total, ocupado, livre, pct, por_sala: porSala, galpoes_ambiguos: galpoesAmbiguos,
      codigos_maturacao: [...codigosMaturacao],
      ocupado_sem_sala: ocupadoSemSala, galpoes_sem_sala: galpoesSemSala,
    },
  };
}

export function cartaoProdutividade({ lotes = [], colheitasPorLote = {}, metas = {}, tipo = 'SH' } = {}) {
  const doTipo = lotes.filter((l) => l.tipo_cogumelo === tipo && num(l.blocos_abertos) > 0);
  const abertos = doTipo.reduce((s, l) => s + num(l.blocos_abertos), 0);
  const kg = doTipo.reduce((s, l) => s + (num(colheitasPorLote[l.id]) ?? 0), 0);

  if (!abertos || !kg) {
    return semDado('PRODUTIVIDADE', 'Produtividade',
      'Ainda não há colheita registrada nos blocos abertos deste tipo.');
  }

  const real = kg / abertos;
  const meta = num(metas.produtividade_kg_por_bloco?.valor);
  const abaixo = meta != null && real < meta;

  const blocosEquivalentes = abaixo ? Math.round(abertos * (meta / real) - abertos) : 0;

  return {
    chave: 'PRODUTIVIDADE',
    titulo: 'Produtividade',
    situacao: `${ptBr(real, 3)} kg por bloco aberto${meta != null ? `, contra meta de ${ptBr(meta, 3)}` : ''}.`,
    decisao: abaixo ? 'ATENCAO' : 'MANTER',
    sugestao: abaixo
      ? `Mantida a produtividade atual, seriam necessários cerca de ${ptBr(blocosEquivalentes)} blocos a mais para colher o mesmo que a meta entregaria.`
      : `Produtividade dentro da meta. Nenhum ajuste necessário.`,
    severidade: abaixo ? 'AMARELO' : 'VERDE',
    referencia: `${ptBr(abertos)} blocos abertos e ${ptBr(kg, 1)} kg colhidos, tipo ${tipo}` +
      (meta != null ? ` · meta ${metas.produtividade_kg_por_bloco?.origem === 'BANCO' ? 'cadastrada' : 'padrão do sistema'}` : ''),
    detalhes: { abertos, kg, kg_por_bloco: real, meta, blocos_equivalentes: blocosEquivalentes },
  };
}

const TIPO_COM_CLASSIFICACAO = 'SH';

export function cartaoQualidade({ colheitas = [], lotesPorId = {}, metas = {} } = {}) {
  const doTipo = colheitas.filter((c) => lotesPorId[c.lote_id]?.tipo_cogumelo === TIPO_COM_CLASSIFICACAO);
  const kgPP = doTipo.reduce((s, c) => s + (num(c.kg_pp) ?? 0), 0);
  const kgTotal = doTipo.reduce((s, c) => s + (num(c.peso_kg) ?? 0), 0) - kgPP;
  if (!doTipo.length || !kgTotal) {
    return semDado('QUALIDADE', 'Qualidade',
      'Ainda não há colheita de Shiitake classificada no período.');
  }

  const kgM = doTipo.reduce((s, c) => s + (num(c.kg_m) ?? 0), 0);
  const kgG = doTipo.reduce((s, c) => s + (num(c.kg_g) ?? 0), 0);
  const kgGG = doTipo.reduce((s, c) => s + (num(c.kg_gg) ?? 0), 0);
  const pctMG = ((kgM + kgG + kgGG) * 100) / kgTotal;
  const meta = num(metas.qualidade_mg_pct?.valor);
  const abaixo = meta != null && pctMG < meta;

  return {
    chave: 'QUALIDADE',
    titulo: 'Qualidade',
    situacao: `M, G e GG somam ${ptBr(pctMG, 1)}% do Shiitake colhido`
      + (kgPP > 0 ? ` sem o PP (${ptBr(kgPP, 1)} kg de PP fora da conta)` : '')
      + `${meta != null ? `, contra meta de ${ptBr(meta)}%` : ''}.`,
    decisao: abaixo ? 'ATENCAO' : 'MANTER',
    sugestao: abaixo
      ? 'M/G/GG abaixo da meta. Ver detalhes para comparar receita, semente e sala dos lotes com melhor resultado.'
      : 'Qualidade dentro da meta.',
    severidade: abaixo ? 'AMARELO' : 'VERDE',
    referencia: `${ptBr(kgTotal, 1)} kg de Shiitake classificados` +
      (meta != null ? ` · meta ${metas.qualidade_mg_pct?.origem === 'BANCO' ? 'cadastrada' : 'padrão do sistema'}` : ''),
    detalhes: { kg_total: kgTotal, kg_pp: kgPP, kg_m: kgM, kg_g: kgG, kg_gg: kgGG, pct_mg: pctMG, meta },
  };
}

export function cartaoPerdas({ semeados = 0, contaminados = 0, abertos = 0, metas = {} } = {}) {
  const sem = num(semeados) ?? 0;
  if (!sem) {
    return semDado('PERDAS', 'Perdas e contaminação',
      'Nenhum bloco semeado no período.');
  }
  const cont = num(contaminados) ?? 0;
  const pct = (cont * 100) / sem;
  const meta = num(metas.perda_aceitavel_pct?.valor);
  const acima = meta != null && pct > meta;

  const fator = pct >= 100 ? null : 100 / (100 - pct);
  const paraCem = fator == null ? null : Math.ceil(100 * fator);

  return {
    chave: 'PERDAS',
    titulo: 'Perdas e contaminação',
    situacao: `${ptBr(pct, 1)}% dos blocos semeados foram perdidos${meta != null ? `, contra limite de ${ptBr(meta, 1)}%` : ''}.`,
    decisao: acima ? 'ATENCAO' : 'MANTER',
    sugestao: paraCem == null
      ? null
      : `Com a perda atual, para ter 100 blocos prontos para abertura é preciso produzir ${ptBr(paraCem)}.`,
    severidade: acima ? 'AMARELO' : 'VERDE',
    referencia: `${ptBr(cont)} blocos perdidos de ${ptBr(sem)} semeados` +
      (meta != null ? ` · limite ${metas.perda_aceitavel_pct?.origem === 'BANCO' ? 'cadastrado' : 'padrão do sistema'}` : ''),
    detalhes: { semeados: sem, contaminados: cont, abertos: num(abertos) ?? 0, pct, meta, fator },
  };
}

export function atencoesEstrategicas(cartoes = []) {
  return cartoes
    .filter((c) => c.decisao && c.decisao !== 'MANTER' && c.decisao !== 'SEM_DADO')
    .map((c) => ({
      chave: c.chave,
      texto: `${c.titulo}: ${c.sugestao ?? c.situacao}`,
      severidade: c.severidade,
    }));
}

export function painelEstrategico(dados = {}, metas = {}) {
  const cartoes = [
    cartaoCapacidade({
      salas: dados.salas,
      ocupacaoPorGalpao: dados.ocupacaoPorGalpao,
      regrasMaturacao: dados.regrasMaturacao,
      metas,
    }),
    cartaoProdutividade({ lotes: dados.lotes, colheitasPorLote: dados.colheitasPorLote, metas }),
    cartaoQualidade({ colheitas: dados.colheitas, lotesPorId: dados.lotesPorId, metas }),
    cartaoPerdas({ semeados: dados.semeados, contaminados: dados.contaminados, abertos: dados.abertos, metas }),
  ];
  const resumo = { ok: 0, atencao: 0, sem_dado: 0 };
  for (const c of cartoes) {
    if (c.severidade === 'SEM_DADO') resumo.sem_dado++;
    else if (c.decisao === 'MANTER') resumo.ok++;
    else resumo.atencao++;
  }
  return { cartoes, atencoes: atencoesEstrategicas(cartoes), resumo };
}
