export const ROTULO_SUBTIPO = {
  ABERTURA_VENCIDA: 'vencidas',
  ABERTURA_PROXIMA: 'próximas',
  SEMENTE_VENCIDA: 'vencidas',
  SEMENTE_PROXIMA: 'próximas',
  INSUMO_BAIXO: 'compra urgente',
  INSUMO_ATENCAO: 'programar compra',
};

function fraseDeContagem(daArea) {
  const contagem = new Map();
  for (const a of daArea) contagem.set(a.tipo, (contagem.get(a.tipo) ?? 0) + 1);
  if (contagem.size < 2) return null;
  const partes = [];
  for (const [tipo, rotulo] of Object.entries(ROTULO_SUBTIPO)) {
    if (contagem.has(tipo)) partes.push(`${contagem.get(tipo)} ${rotulo}`);
  }
  if (partes.length !== contagem.size) return null;
  return partes.join(' · ');
}

const piorSeveridade = (lista) => {
  if (lista.some((a) => a.severidade === 'VERMELHO')) return 'VERMELHO';
  if (lista.some((a) => a.severidade === 'AMARELO')) return 'AMARELO';
  return 'VERDE';
};

const vazio = (v) => v == null
  || (Array.isArray(v) ? v.length === 0 : typeof v === 'object' && Object.keys(v).length === 0);

function areaDeAlertas({
  chave, titulo, destino, ancora = null, ancoraPor = null, unidade, prefixo, alertas, bloco,
}) {
  const daArea = alertas.filter((a) => a.tipo.startsWith(prefixo));
  const semDado = vazio(bloco);
  const severidade = semDado ? 'SEM_DADO' : piorSeveridade(daArea);
  return {
    chave,
    titulo,
    destino,
    ancora: ancoraPor ? ancoraPor(daArea) : ancora,
    severidade,
    numero: semDado ? null : daArea.length,
    unidade: semDado ? null : unidade,
    frase: semDado ? null : fraseDeContagem(daArea),
    alertas: daArea.length,
  };
}

function areaDeBloco({
  chave, titulo, destino, ancora = null, unidade, bloco, numeroDoBloco,
}) {
  const numero = vazio(bloco) ? null : numeroDoBloco(bloco);
  const semDado = numero == null;
  return {
    chave,
    titulo,
    destino,
    ancora,
    severidade: semDado ? 'SEM_DADO' : 'VERDE',
    numero,
    unidade: semDado ? null : unidade,
    frase: null,
    alertas: 0,
  };
}

const kg1 = (v) => Number(v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function areaDeConferencia({ chave, titulo, destino, ancora, bloco }) {
  const semDado = vazio(bloco) || !(bloco.colheitas > 0);
  const n = semDado ? null : bloco.divergentes;
  const tol = bloco?.parametros?.tolerancia_kg;
  const dentro = Number.isFinite(tol)
    ? `dentro de ${tol.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} kg`
    : 'dentro da tolerância';
  const frase = semDado ? null : [
    n > 0 ? `${kg1(bloco.kg_diferenca_absoluta)} kg nas que não fecharam, somados sem sinal` : null,
    `${bloco.fechadas} ${bloco.fechadas === 1 ? 'fechou' : 'fecharam'} ${dentro}`,
    `${bloco.em_aberto} ainda no prazo de embalar`,
  ].filter(Boolean).join(' · ');
  return {
    chave, titulo, destino, ancora,
    severidade: semDado ? 'SEM_DADO' : (n > 0 ? 'VERMELHO' : 'VERDE'),
    numero: n,
    unidade: semDado ? null : (n === 1 ? 'colheita não fechou' : 'colheitas não fecharam'),
    frase,
    alertas: n ?? 0,
  };
}

/** @param {object} payload */
export function painelDeComando({ alertas = [], ...painel } = {}) {
  const areas = [
    areaDeAlertas({
      chave: 'ABERTURAS', titulo: 'Aberturas', destino: 'proximas_aberturas',
      ancoraPor: (daArea) => (daArea.some((a) => a.tipo === 'ABERTURA_VENCIDA') ? 'pa-vencidos'
        : daArea.some((a) => a.tipo === 'ABERTURA_PROXIMA') ? 'pa-a-vencer' : 'pa-resumo'),
      unidade: 'pendências', prefixo: 'ABERTURA_', alertas, bloco: painel.proximas_aberturas,
    }),
    areaDeBloco({
      chave: 'MATURACAO', titulo: 'Maturação', destino: 'jornada',
      ancora: 'jornada-tabela',
      unidade: 'lotes em maturação', bloco: painel.posicao_blocos,
      numeroDoBloco: (b) => b.em_maturacao_lotes ?? null,
    }),
    areaDeAlertas({
      chave: 'CONTAGEM', titulo: 'Contagem / Estoques', destino: 'qualidade_dados',
      ancora: 'qualidade-topo',
      unidade: 'divergências', prefixo: 'DIVERGENCIA_CONTAGEM', alertas, bloco: painel.divergencias,
    }),
    areaDeAlertas({
      chave: 'CONTAMINACAO', titulo: 'Contaminação', destino: 'painel_contaminados',
      ancora: 'contaminados-resumo',
      unidade: 'lotes críticos', prefixo: 'CONTAMINACAO_CRITICA', alertas, bloco: painel.contaminacao,
    }),
    areaDeAlertas({
      chave: 'SEMENTES', titulo: 'Sementes', destino: 'sementes',
      ancora: 'sementes-topo',
      unidade: 'pendências', prefixo: 'SEMENTE_', alertas, bloco: painel.sementes,
    }),
    areaDeAlertas({
      chave: 'MATERIA_PRIMA', titulo: 'Matéria-prima', destino: 'compras_mp',
      ancora: 'compras-mp-pedido',
      unidade: 'itens em compra urgente', prefixo: 'MATERIA_PRIMA_BAIXA', alertas,
      bloco: painel.materia_prima?.linhas,
    }),
    areaDeAlertas({
      chave: 'OUTROS_INSUMOS', titulo: 'Outros insumos', destino: 'compras_mensal',
      ancora: 'compras-mensal-insumos',
      unidade: 'pendências', prefixo: 'INSUMO_', alertas, bloco: painel.insumos?.linhas,
    }),
    areaDeBloco({
      chave: 'COLHEITA', titulo: 'Colheita / Produtividade', destino: 'embalagem',
      ancora: 'embalagem-dados',
      unidade: 'kg hoje', bloco: painel.colheita,
      numeroDoBloco: (b) => b.kg_hoje ?? null,
    }),
    areaDeBloco({
      chave: 'TOP_CONTAMINACAO', titulo: 'Top 10 Contaminação', destino: 'painel_contaminados',
      ancora: 'contaminados-top10',
      unidade: 'lotes no top', bloco: painel.contaminacao?.top,
      numeroDoBloco: (b) => b.length,
    }),
    areaDeBloco({
      chave: 'COBERTURA_MP', titulo: 'Cobertura de matéria-prima', destino: 'compras_mp',
      ancora: 'compras-mp-cobertura',
      unidade: 'com cobertura calculada', bloco: painel.materia_prima?.linhas,
      numeroDoBloco: (b) => b.length,
    }),
    areaDeBloco({
      chave: 'SEMENTES_A_SEPARAR', titulo: 'Sementes a Separar', destino: 'sementes',
      ancora: 'sementes-a-separar',
      unidade: 'tipos com semente a separar', bloco: painel.sementes?.estoque?.proxima_por_tipo,
      numeroDoBloco: (b) => b.length,
    }),
    areaDeConferencia({
      chave: 'COLHEITA_EMBALAGEM', titulo: 'Colheita × Embalagem', destino: 'embalagem',
      ancora: 'embalagem-divergencias', bloco: painel.colheita_embalagem,
    }),
  ];

  const resumo = {
    acoes: areas.filter((a) => a.severidade === 'VERMELHO').length,
    atencoes: areas.filter((a) => a.severidade === 'AMARELO').length,
    ok: areas.filter((a) => a.severidade === 'VERDE').length,
    sem_dado: areas.filter((a) => a.severidade === 'SEM_DADO').length,
  };

  return { resumo, areas };
}
