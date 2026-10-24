export const ehDataISO = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

export const dataISO = (v, campo, { obrigatoria = true } = {}) => {
  if (v == null || v === '') {
    if (obrigatoria) throw new Error(`${campo} é obrigatória (YYYY-MM-DD).`);
    return null;
  }
  if (!ehDataISO(v)) throw new Error(`${campo} inválida: use YYYY-MM-DD.`);
  const t = Date.parse(`${v}T00:00:00Z`);
  if (!Number.isFinite(t) || new Date(t).toISOString().slice(0, 10) !== v) {
    throw new Error(`${campo} inválida: use YYYY-MM-DD.`);
  }
  return v;
};

export const inteiro = (v, campo, { min = 0, obrigatorio = true } = {}) => {
  const bruto = typeof v === 'string' ? v.trim() : v;
  if (bruto == null || bruto === '') {
    if (obrigatorio) throw new Error(`${campo} é obrigatório.`);
    return null;
  }
  const invalido = () => new Error(`${campo} inválido: informe um inteiro ${min > 0 ? `≥ ${min}` : '≥ 0'}.`);
  if (typeof bruto !== 'number' && typeof bruto !== 'string') throw invalido();
  const n = Number(bruto);
  if (!Number.isSafeInteger(n) || n < min) throw invalido();
  return n;
};

export const numeroPos = (v, campo) => {
  const bruto = typeof v === 'string' ? v.trim() : v;
  if (bruto == null || bruto === '') return null;
  if (typeof bruto !== 'number' && typeof bruto !== 'string') throw new Error(`${campo} inválido: informe um número ≥ 0.`);
  const n = Number(bruto);
  if (!Number.isFinite(n) || n < 0) throw new Error(`${campo} inválido: informe um número ≥ 0.`);
  return n;
};

export const numeroMaiorQueZero = (v, campo) => {
  const n = numeroPos(v, campo);
  if (n != null && n <= 0) throw new Error(`${campo} inválido: informe um número maior que zero.`);
  return n;
};

export const texto = (v) => (v == null ? null : String(v).replace(/\s+/g, ' ').trim() || null);

export const RESPONSAVEL_MAX = 100;
export function textoResponsavel(bruto, campo) {
  if (bruto != null && typeof bruto !== 'string') throw erroDeValidacao(`${campo} precisa ser texto.`);
  const valor = texto(bruto);
  if (valor != null && valor.length > RESPONSAVEL_MAX) {
    throw erroDeValidacao(`${campo} passa de ${RESPONSAVEL_MAX} caracteres.`);
  }
  if (valor != null && /[\u0000-\u001f\u007f]/.test(valor)) {
    throw erroDeValidacao(`${campo} tem caractere de controle.`);
  }
  return valor;
}

export const arredondarKg = (x) => Math.round(Number(x) * 1000) / 1000;

const dataBr = (iso) => (typeof iso === 'string' && /^\d{4}-\d{2}-\d{2}/.test(iso)
  ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
  : null);

export function filtrarLinhasJornada(linhas, { inicio, fim, tipo, galpao } = {}) {
  return linhas.filter((l) => (!inicio || (l.data_lote ?? '') >= inicio)
    && (!fim || (l.data_lote ?? '') <= fim)
    && (!tipo || l.tipo === tipo)
    && (!galpao || (l.galpao ?? '') === galpao));
}

export const triEstadoBooleano = (v) => (v == null || v === ''
  ? null
  : Boolean(v === true || v === 'SIM' || v === 'true' || v === 1));

/**
 * @param {object} payload
 * @param {string} [statusGravado]
 * @param {string|null} [estanteGravada]
 */
export function camposDoLote(payload = {}, statusGravado = undefined, estanteGravada = undefined) {
  for (const filha of ['sementes', 'estantes']) {
    if (filha in payload) {
      throw erroDeValidacao(
        `${filha} não se edita por aqui: este caminho grava só os campos do próprio lote. `
        + 'Para corrigir, exclua o lote e relance pela Jornada do Cogumelo.',
      );
    }
  }
  const campos = {};
  if ('nf_semente' in payload) campos.nf_semente = texto(payload.nf_semente);
  if ('receita' in payload) campos.receita_texto = texto(payload.receita);
  if ('blocos_produzidos' in payload) campos.qtd_blocos = inteiro(payload.blocos_produzidos, 'blocos_produzidos', { min: 0, obrigatorio: false }) ?? 0;
  if ('blocos_guardados' in payload) campos.blocos_guardados = inteiro(payload.blocos_guardados, 'blocos_guardados', { min: 0, obrigatorio: false });
  if ('misturas' in payload) campos.misturas = inteiro(payload.misturas, 'misturas', { min: 1, obrigatorio: false });
  if ('blocos_semeados' in payload) campos.blocos_semeados = inteiro(payload.blocos_semeados, 'blocos_semeados', { min: 0, obrigatorio: false });
  if ('responsavel_semeacao' in payload) campos.responsavel_semeacao = textoResponsavel(payload.responsavel_semeacao, 'responsavel_semeacao');
  if ('responsavel_conferencia' in payload) campos.responsavel_conferencia = textoResponsavel(payload.responsavel_conferencia, 'responsavel_conferencia');
  if ('responsavel_pesagem' in payload) campos.responsavel_pesagem = textoResponsavel(payload.responsavel_pesagem, 'responsavel_pesagem');
  if ('responsavel_selagem' in payload) campos.responsavel_selagem = textoResponsavel(payload.responsavel_selagem, 'responsavel_selagem');
  if ('galpao' in payload) campos.galpao = texto(payload.galpao);
  if ('estante_maturacao' in payload) {
    campos.estante_maturacao = texto(payload.estante_maturacao);
    if (campos.estante_maturacao?.includes(',') && campos.estante_maturacao !== texto(estanteGravada)) {
      throw erroDeValidacao(ERRO_ESTANTE_DO_LOTE);
    }
  }
  if ('data_abertura' in payload) campos.data_abertura = dataISO(payload.data_abertura, 'data_abertura', { obrigatoria: false });
  if ('blocos_abertos' in payload) campos.blocos_abertos = inteiro(payload.blocos_abertos, 'blocos_abertos', { obrigatorio: false });
  if ('estante_abertura' in payload) campos.estante_abertura = texto(payload.estante_abertura);
  if ('zerou_estante' in payload) {
    campos.zerou_estante = triEstadoBooleano(payload.zerou_estante);
  }
  if ('lote_pesquisa' in payload) {
    campos.lote_pesquisa = triEstadoBooleano(payload.lote_pesquisa);
  }
  if ('estante_frutificacao' in payload) campos.estante_frutificacao = texto(payload.estante_frutificacao);
  if ('capela_ligada' in payload) {
    campos.capela_ligada = triEstadoBooleano(payload.capela_ligada);
  }
  if (!Object.keys(campos).length && payload.receitaId == null) throw new Error('Nenhuma alteração informada.');
  const podePromover = statusGravado === undefined || statusGravado === 'INCUBACAO';
  if (podePromover && campos.data_abertura && (campos.blocos_abertos ?? 0) > 0) campos.status = 'FRUTIFICACAO';
  return campos;
}

/** @param {{dataLote:string, tipo:string, galpao?:string|null, estante?:string|null}} p */
export function baseDoCodigoDoLote({ dataLote, tipo, galpao, estante }) {
  return `${dataLote}-${tipo}-${(galpao ?? 'X')}${(estante ?? '0')}`.replace(/\s+/g, '');
}

/**
 * @param {string} base
 * @param {Array<{id?:number, codigo:string}|string>} existentes
 * @param {boolean|string} permitirDuplicata
 */
export function decidirCodigoDoLote(base, existentes = [], permitirDuplicata = false) {
  const linhas = (existentes ?? []).map((l) => (typeof l === 'string' ? { id: null, codigo: l } : l))
    .filter((l) => l && typeof l.codigo === 'string');
  const usados = new Set(linhas.map((l) => l.codigo));
  if (!usados.has(base)) return base;

  const autorizada = permitirDuplicata === true || permitirDuplicata === 'true';
  if (!autorizada) {
    const existente = linhas.find((l) => l.codigo === base);
    const e = new Error(
      `Já existe um lote neste mesmo endereço: ${base} (lote #${existente?.id ?? '?'}). `
      + 'Se você está corrigindo um lançamento, edite ou exclua esse lote em vez de criar outro: '
      + 'criar de novo duplica os blocos nos indicadores. '
      + 'Se for mesmo uma SEGUNDA estante com o mesmo endereço, reenvie com permitir_duplicata.',
    );
    e.status = 409;
    e.codigo_erro = 'LOTE_DUPLICADO';
    e.lote_existente = existente?.id ?? null;
    throw e;
  }
  let codigo = base;
  for (let i = 2; usados.has(codigo); i += 1) codigo = `${base}-${i}`;
  return codigo;
}

export function erroDaCorridaDoCodigoDoLote(error, { edicao = false } = {}) {
  if (error?.code !== '23505' || !String(error.message ?? '').includes('lotes_producao_codigo_key')) return null;
  const codigo = /\(codigo\)=\(([^)]*)\)/.exec(String(error.details ?? ''))?.[1];
  const e = new Error(edicao
    ? `Outro lançamento acabou de gravar um lote no endereço escolhido${codigo ? ` (${codigo})` : ''}, e esta alteração não foi gravada. `
      + 'Atualize a tela e confira antes de salvar de novo.'
    : `Outro lançamento acabou de gravar um lote neste mesmo endereço${codigo ? ` (${codigo})` : ''}, e este não foi gravado. `
      + 'Atualize a tela e confira antes de lançar de novo: criar de novo duplica os blocos nos indicadores.');
  e.status = 409;
  e.codigo_erro = 'LOTE_GRAVADO_AO_MESMO_TEMPO';
  return e;
}

/**
 * @param {{ linhas: Array<{id:number, galpao?:string|null, estante_maturacao?:string|null}>, dataLote: string, tipo: string, externos?: Array<{id?:number, codigo:string}>, permitirDuplicata?: boolean|string }} p
 * @returns {Array<{id:number, codigo:string}>}
 */
export function codigosDaNovaIdentidade({ linhas = [], dataLote, tipo, externos = [], permitirDuplicata = false }) {
  const atribuidos = [];
  for (const l of [...linhas].sort((a, b) => a.id - b.id)) {
    const base = baseDoCodigoDoLote({ dataLote, tipo, galpao: l.galpao, estante: l.estante_maturacao });
    const colideFora = (externos ?? []).some((e) => e?.codigo === base);
    const codigo = decidirCodigoDoLote(base, [...(externos ?? []), ...atribuidos], colideFora ? permitirDuplicata : true);
    atribuidos.push({ id: l.id, codigo });
  }
  return atribuidos;
}

/**
 * @param {boolean|null|undefined} zerouEstante
 * @param {{data_abertura?: *}} payload
 * @param {boolean|string} permitirReabertura
 */
export function recusarReaberturaSeConcluida(zerouEstante, payload = {}, permitirReabertura = false) {
  if (zerouEstante !== true) return;
  if (!('data_abertura' in (payload ?? {}))) return;
  if (permitirReabertura === true || permitirReabertura === 'true') return;

  const e = new Error(
    'Esta estante já está com a abertura concluída (Abertura concluída = SIM) e não pode ser '
    + 'lançada de novo: isso evitaria duplicidade nos indicadores. '
    + 'Se você está corrigindo a data de abertura, use "Editar lote" em vez de relançar a abertura. '
    + 'Se for mesmo uma reabertura, reenvie com permitir_reabertura.',
  );
  e.status = 409;
  e.codigo_erro = 'ESTANTE_JA_CONCLUIDA';
  throw e;
}

export const JANELA_DUPLICATA_MIN = 10;

/**
 * @param {object[]} recentes
 * @param {string} rotulo
 * @param {*} permitir
 */
export function exigirConfirmacaoDeDuplicata(recentes, rotulo, permitir = false) {
  const linhas = Array.isArray(recentes) ? recentes.filter(Boolean) : [];
  if (!linhas.length) return;
  if (permitir === true || permitir === 'true') return;

  const e = new Error(
    `Já existe uma ${rotulo} idêntica lançada nos últimos ${JANELA_DUPLICATA_MIN} minutos `
    + `(nº ${linhas[0].id ?? '?'}). Se você lançou e a tela deu erro, o lançamento FOI gravado: `
    + 'lançar de novo dobra o número nos indicadores. '
    + `Se for mesmo uma SEGUNDA ${rotulo}, confirme para gravar as duas.`,
  );
  e.status = 409;
  e.codigo_erro = 'LANCAMENTO_DUPLICADO';
  e.existente = linhas[0].id ?? null;
  throw e;
}

/**
 * @param {{status?:string, data_encerramento?:string|null}} lote
 * @param {boolean|string} permitir
 */
export function exigirConfirmacaoDeLoteEncerrado(lote, permitir = false) {
  if (lote?.status !== 'ENCERRADO') return;
  if (permitir === true || permitir === 'true') return;
  const quando = dataBr(lote.data_encerramento);
  const e = new Error(
    `Este lote está encerrado ${quando ? `desde ${quando}` : '(sem data de encerramento registrada)'}. `
    + 'Confirme para lançar mesmo assim, ou reabra o lote em "Editar lote" (botão "Reabrir lote").',
  );
  e.status = 409;
  e.codigo_erro = 'LOTE_ENCERRADO';
  throw e;
}

/**
 * @param {string} dia
 * @param {boolean} marcado
 * @param {boolean|string} permitir
 */
export function exigirConfirmacaoDeDiaSemColheita(dia, marcado, permitir = false) {
  if (!marcado) return;
  if (permitir === true || permitir === 'true') return;
  const diaMes = typeof dia === 'string' ? `${dia.slice(8, 10)}/${dia.slice(5, 7)}` : '?';
  const e = new Error(`O dia ${diaMes} está marcado como "Não houve colheita". Confirma a data da colheita?`);
  e.status = 409;
  e.codigo_erro = 'DIA_SEM_COLHEITA';
  throw e;
}

export const CORRIJA_A_CONTAGEM = 'Se a estante tinha mais blocos do que isso, corrija o "Nº de blocos Produzidos" '
  + 'em "Editar lote" para o total que entrou nela e lance de novo.';

/**
 * @param {number|null} qtdBlocos
 * @param {number} retirados
 * @param {number} quantidade
 */
export function exigirSaldoParaRetirada(qtdBlocos, retirados, quantidade, abertos = 0) {
  const produzidos = Number(qtdBlocos);
  if (!(produzidos > 0)) return;
  const jaRetirados = Number(retirados) || 0;
  const jaAbertos = Number(abertos) || 0;
  if (jaRetirados + jaAbertos + Number(quantidade) <= produzidos) return;
  const e = erroDeValidacao(
    `A retirada de ${quantidade} bloco(s) excede o saldo do lote: `
    + `${produzidos} produzidos, ${jaRetirados} já retirados`
    + (jaAbertos > 0 ? `, ${jaAbertos} já abertos` : '') + '. '
    + CORRIJA_A_CONTAGEM,
  );
  e.codigo_erro = 'SALDO_EXCEDIDO';
  e.detalhe = {
    produzidos, retirados: jaRetirados, abertos: jaAbertos,
    informado: Number(quantidade), sobra: produzidos - jaRetirados - jaAbertos,
  };
  throw e;
}

export function quantidadeDoSaldoTotal(qtdBlocos, retirados, abertos = 0) {
  const produzidos = Number(qtdBlocos);
  if (!(produzidos > 0)) {
    throw erroDeValidacao(
      'Este lote não tem o Nº de blocos Produzidos preenchido, então não dá para calcular o saldo. '
      + 'Informe a quantidade de blocos ou corrija o Nº de blocos Produzidos do lote.',
    );
  }
  const saldo = produzidos - (Number(retirados) || 0) - (Number(abertos) || 0);
  if (saldo <= 0) {
    throw erroDeValidacao(
      `Este lote não tem saldo para dar baixa: ${produzidos} produzidos, `
      + `${Number(retirados) || 0} já retirados e ${Number(abertos) || 0} já abertos.`
      + (saldo < 0 ? ' ' + CORRIJA_A_CONTAGEM : ''),
    );
  }
  return saldo;
}

export const MOTIVO_MAX = 200;
export function motivoDaPerda(bruto, tipoEvento) {
  if (bruto != null && typeof bruto !== 'string') throw erroDeValidacao('O motivo precisa ser texto.');
  const motivo = String(bruto ?? '').trim();
  if (!motivo) return null;
  if (tipoEvento !== 'PERDA') throw erroDeValidacao('O motivo só vale para perda ou descarte.');
  if (motivo.length > MOTIVO_MAX) throw erroDeValidacao(`O motivo passa de ${MOTIVO_MAX} caracteres.`);
  return motivo;
}

/**
 * @param {number|null} qtdBlocos
 * @param {number} retirados
 * @param {number|null} abertos
 * @param {number} [jaAbertos]
 */
export function exigirSaldoParaAbertura(qtdBlocos, retirados, abertos, jaAbertos = 0) {
  const produzidos = Number(qtdBlocos);
  if (!(produzidos > 0)) return;
  if (abertos == null) return;
  const jaRetirados = Number(retirados) || 0;
  const anteriores = Number(jaAbertos) || 0;
  const sobra = produzidos - jaRetirados - anteriores;
  if (Number(abertos) <= sobra) return;
  const e = erroDeValidacao(
    `A abertura de ${abertos} bloco(s) excede o saldo da estante de maturação: `
    + `${produzidos} produzidos, ${jaRetirados} já retirados, `
    + `${anteriores > 0 ? `${anteriores} já abertos, ` : ''}sobram ${sobra}. `
    + (anteriores > 0 ? 'Se é uma correção das aberturas já gravadas, marque "Substituir as aberturas gravadas" e lance a lista inteira. ' : '')
    + CORRIJA_A_CONTAGEM,
  );
  e.codigo_erro = 'SALDO_EXCEDIDO';
  e.detalhe = {
    produzidos, retirados: jaRetirados, abertos: anteriores, informado: Number(abertos), sobra,
  };
  throw e;
}

/**
 * @param {Array<{sala_destino?:string|null, estante_destino:string, quantidade:number|null}>} gravadas
 * @param {Array<{sala?:string|null, estante:string, quantidade?:number|null}>} destinos
 */
export function aberturasIguais(gravadas = [], destinos = []) {
  const chave = (sala, estante, quantidade) => `${String(sala ?? '').trim().toUpperCase()}|${String(estante ?? '').trim()}|${quantidade ?? ''}`;
  const doEnvio = new Set(destinos.map((d) => chave(d.sala, d.estante, d.quantidade)));
  return (gravadas ?? []).filter((g) => g && doEnvio.has(chave(g.sala_destino, g.estante_destino, g.quantidade)));
}

const horaDeBrasilia = (iso) => {
  const t = Date.parse(iso ?? '');
  if (!Number.isFinite(t)) return '';
  return new Date(t).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
};

export function exigirConfirmacaoDeAberturaIgual(gravadas, destinos, permitir = false) {
  const iguais = aberturasIguais(gravadas, destinos);
  if (!iguais.length) return;
  if (permitir === true || permitir === 'true') return;
  const g = iguais[0];
  const [ano, mes, dia] = String(g.data ?? '').slice(0, 10).split('-');
  const destino = g.sala_destino ? `${g.sala_destino}/${g.estante_destino}` : g.estante_destino;
  const quando = horaDeBrasilia(g.created_at);
  const quantas = iguais.length > 1 ? `${iguais.length} aberturas iguais` : 'uma abertura igual';
  const e = new Error(
    `Esta estante já tem ${quantas}${dia ? ` em ${dia}/${mes}/${ano}` : ''}: `
    + `${g.quantidade == null ? 'sem a quantidade de blocos' : `${g.quantidade} bloco(s)`} na ${destino}`
    + `${quando ? `, ${iguais.length > 1 ? 'a primeira ' : ''}registrada em ${quando}` : ''}${g.registrado_por ? ` por ${g.registrado_por}` : ''}. `
    + 'Se a primeira vez pareceu não gravar, ela gravou: registrar de novo soma os blocos outra vez.',
  );
  e.status = 409;
  e.codigo_erro = 'ABERTURA_DUPLICADA';
  e.existente = g.id ?? null;
  throw e;
}

export function inicioDaJanela(agora) {
  const t = agora instanceof Date ? agora.getTime() : new Date(agora).getTime();
  return new Date(t - JANELA_DUPLICATA_MIN * 60_000).toISOString();
}

export function contarEventosDoLote(eventos = []) {
  let contaminacao = 0;
  let outros = 0;
  for (const e of eventos ?? []) {
    if (e?.tipo === 'CONTAMINACAO') contaminacao += 1;
    else outros += 1;
  }
  return { contaminacao, outros };
}

export function resumoDaExclusao(lote = {}, {
  colheitas, eventos, outros, alocacoes, sementes, estantes, transferencias, autoclaves, atipicos, divergencias, verificacoes,
} = {}) {
  return {
    id: lote?.id ?? null,
    codigo: lote?.codigo ?? null,
    colheitas_apagadas: colheitas ?? 0,
    eventos_apagados: eventos ?? 0,
    outros_eventos_apagados: outros ?? 0,
    alocacoes_apagadas: alocacoes ?? 0,
    sementes_apagadas: sementes ?? 0,
    estantes_apagadas: estantes ?? 0,
    transferencias_apagadas: transferencias ?? 0,
    autoclaves_apagadas: autoclaves ?? 0,
    ocorrencias_atipicas_apagadas: atipicos ?? 0,
    divergencias_apagadas: divergencias ?? 0,
    verificacoes_apagadas: verificacoes ?? 0,
  };
}

const FAIXAS = ['kg_pp', 'kg_p', 'kg_m', 'kg_g', 'kg_gg'];

/**
 * @param {{kg_p?:number|null, kg_m?:number|null, kg_g?:number|null, kg_gg?:number|null, peso_kg?:number|null}} atual
 * @param {{data?:string, data_colheita?:string, kg_p?:*, kg_m?:*, kg_g?:*, kg_gg?:*}} payload
 * @returns {{data_colheita?:string, kg_p?:number|null, kg_m?:number|null, kg_g?:number|null, kg_gg?:number|null, peso_kg?:number}}
 */
export function camposDaColheita(atual = {}, payload = {}) {
  const campos = {};
  if ('data' in payload || 'data_colheita' in payload) {
    campos.data_colheita = dataISO(payload.data ?? payload.data_colheita, 'data');
  }
  for (const campo of FAIXAS) {
    if (campo in payload) campos[campo] = numeroPos(payload[campo], campo);
  }
  if ('estante' in payload) {
    const estante = texto(payload.estante);
    if (estante && estante.includes(',')) throw erroDeValidacao(ERRO_ESTANTE_DA_COLHEITA);
    campos.estante = estante;
  }
  if (!Object.keys(campos).length) throw new Error('Nenhuma alteração informada.');

  if (!FAIXAS.some((campo) => campo in payload)) return campos;

  const valores = FAIXAS.map((campo) => (campo in campos ? campos[campo] : (atual?.[campo] ?? null)));
  const tinhaFaixa = FAIXAS.some((campo) => atual?.[campo] != null);
  const pesoGravado = Number(atual?.peso_kg);
  if (valores.every((v) => v == null) && !tinhaFaixa && Number.isFinite(pesoGravado) && pesoGravado > 0) {
    return campos;
  }
  campos.peso_kg = arredondarKg(valores.reduce((soma, v) => soma + (v == null ? 0 : Number(v)), 0));
  return campos;
}

export const CORES_DE_CONTAMINADO = ['VERDE', 'LARANJA', 'PRETA'];

export const ERRO_COR_DE_CONTAMINADO = `tipo_contaminado inválido: use ${
  CORES_DE_CONTAMINADO.slice(0, -1).join(', ')} ou ${CORES_DE_CONTAMINADO.at(-1)}.`;

export const LOCAIS_NO_BLOCO = ['TOPO', 'LATERAL', 'FUNDO', 'TODO'];

export const ERRO_LOCAL_NO_BLOCO = `local_no_bloco inválido: use ${
  LOCAIS_NO_BLOCO.slice(0, -1).join(', ')} ou ${LOCAIS_NO_BLOCO.at(-1)}.`;

export const ERRO_ESTANTE_DA_RETIRADA = 'A retirada é de UMA estante só. '
  + 'Se a contaminação saiu de mais de uma, lance uma retirada para cada: '
  + 'é assim que a plaquinha do galpão registra.';

export const ERRO_ESTANTE_DA_ABERTURA = 'A abertura é registrada por estante de frutificação. '
  + 'Use "Registrar abertura" com uma linha por estante.';

/**
 * @param {number} linhasDeAbertura
 * @param {number|null} novo
 * @param {number|null} gravado
 */
export function recusarTotalDigitadoComAberturas(linhasDeAbertura, novo, gravado) {
  if (!(Number(linhasDeAbertura) > 0)) return;
  if ((novo ?? null) === (gravado ?? null)) return;
  throw erroDeValidacao(
    'Este lote tem aberturas registradas por estante, e o total de blocos abertos é a soma delas. '
    + 'Para corrigir, use "Registrar abertura" com "Substituir as aberturas gravadas" e lance a lista inteira.',
  );
}

export const ERRO_ESTANTE_DA_COLHEITA = 'A colheita é de UMA estante só. '
  + 'Se colheu de mais de uma, lance uma colheita para cada, com o kg de cada uma.';

export const ERRO_ESTANTE_DO_LOTE = 'A estante de maturação é UMA por lote. '
  + 'Se o lote ocupa mais de uma, lance um lote por estante.';

export function erroDeValidacao(mensagem) {
  const e = new Error(mensagem);
  e.status = 400;
  return e;
}

export function campoLocalNoBloco(localNoBloco) {
  return localNoBloco == null ? {} : { local_no_bloco: localNoBloco };
}

export function campoEstanteDoEvento(estante) {
  return estante == null ? {} : { estante };
}

/**
 * @param {string} dataRetirada
 * @param {string|null|undefined} dataLote
 * @param {string} hoje
 */
export function exigirDataDaRetirada(dataRetirada, dataLote, hoje) {
  if (!hoje) throw new Error('exigirDataDaRetirada: chamada sem a data de hoje.');
  if (dataRetirada > hoje) {
    throw erroDeValidacao(`A data da retirada (${dataBr(dataRetirada)}) está no futuro. `
      + `Use a data em que o bloco saiu da estante, até hoje (${dataBr(hoje)}).`);
  }
  if (dataLote && dataRetirada < dataLote) {
    throw erroDeValidacao(`A data da retirada (${dataBr(dataRetirada)}) é anterior à data do lote (${dataBr(dataLote)}). `
      + 'Confira o dia e o ano: a retirada fica entre a data do lote e hoje.');
  }
}

export function exigirDataDoLoteAteARetirada(dataLote, primeiraRetirada) {
  if (primeiraRetirada && dataLote > primeiraRetirada) {
    throw erroDeValidacao(`A data do lote (${dataBr(dataLote)}) é posterior à primeira retirada lançada nele `
      + `(${dataBr(primeiraRetirada)}). Confira o dia e o ano: o lote começa antes da primeira retirada.`);
  }
}

export const ERRO_ESTANTE_OBRIGATORIA = 'Informe a estante da retirada. '
  + 'A contaminação só é registrada com a estante de onde o bloco saiu.';

/**
 * @param {string} tipoEvento
 * @param {string|null} estanteDigitada
 * @param {{galpao?: string|null, tipo_cogumelo?: string|null}|null} lote
 */
export function estanteDaContaminacao(tipoEvento, estanteDigitada, lote) {
  if (tipoEvento !== 'CONTAMINACAO') return estanteDigitada ?? null;
  const faltam = [];
  if (!String(lote?.galpao ?? '').trim()) faltam.push('a maturação (galpão)');
  if (!String(lote?.tipo_cogumelo ?? '').trim()) faltam.push('o tipo (espécie)');
  if (faltam.length) {
    throw erroDeValidacao(`O lote está sem ${faltam.join(' e ')} no cadastro. `
      + 'Corrija em Jornada do Cogumelo, Editar lote, e lance a contaminação de novo.');
  }
  if (!estanteDigitada) throw erroDeValidacao(ERRO_ESTANTE_OBRIGATORIA);
  return estanteDigitada;
}

/**
 * @param {Record<string, unknown>} [payload]
 * @param {string|null} [tipoEvento]
 */
export function camposDaContaminacao(payload = {}, tipoEvento = null) {
  const campos = {};
  if ('data_retirada' in payload) campos.data_evento = dataISO(payload.data_retirada, 'data_retirada');
  if ('tipo_contaminado' in payload) {
    const tipoContaminado = String(payload.tipo_contaminado ?? '').trim().toUpperCase();
    if (!CORES_DE_CONTAMINADO.includes(tipoContaminado)) throw new Error(ERRO_COR_DE_CONTAMINADO);
    campos.tipo_contaminado = tipoContaminado;
  }
  if ('quantidade' in payload) campos.qtd_blocos = inteiro(payload.quantidade, 'quantidade', { min: 1 });
  if ('local_no_bloco' in payload) {
    const localNoBloco = String(payload.local_no_bloco ?? '').trim().toUpperCase();
    if (localNoBloco === '') {
      campos.local_no_bloco = null;
    } else if (!LOCAIS_NO_BLOCO.includes(localNoBloco)) {
      throw new Error(ERRO_LOCAL_NO_BLOCO);
    } else {
      campos.local_no_bloco = localNoBloco;
    }
  }
  if ('estante' in payload) {
    const estante = String(payload.estante ?? '').trim();
    if (estante === '' && tipoEvento === 'CONTAMINACAO') {
      throw erroDeValidacao(ERRO_ESTANTE_OBRIGATORIA);
    } else if (estante === '') {
      campos.estante = null;
    } else if (estante.includes(',')) {
      throw erroDeValidacao(ERRO_ESTANTE_DA_RETIRADA);
    } else {
      campos.estante = estante;
    }
  }
  if (!Object.keys(campos).length) throw new Error('Nenhuma alteração informada.');
  return campos;
}

export function filtroDaContaminacao(eventoId, tipoEvento = 'CONTAMINACAO') {
  return { id: inteiro(eventoId, 'eventoId', { min: 1 }), tipo: tipoEvento };
}

export function etiquetasDoEndereco(endereco) {
  return String(endereco ?? '').split(',').map((e) => e.trim()).filter(Boolean);
}

export function enderecoTemEtiqueta(endereco, etiqueta) {
  const alvo = typeof etiqueta === 'string' ? etiqueta.trim() : etiqueta;
  if (alvo == null || alvo === '') return false;
  return etiquetasDoEndereco(endereco).includes(String(alvo));
}

const PRAZO_PADRAO_DA_SEMENTE_EM_DIAS = 30;

const dataDoCalendario = (v, campo) => {
  if (v == null || v === '') return null;
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    throw new Error(`${campo} inválida: use AAAA-MM-DD.`);
  }
  const dt = new Date(`${v}T00:00:00Z`);
  if (Number.isNaN(dt.getTime()) || dt.toISOString().slice(0, 10) !== v) {
    throw new Error(`A data ${v} não existe no calendário.`);
  }
  return v;
};

export function validadeDoMovimento({ validade, dataProducao } = {}) {
  const informada = dataDoCalendario(validade, 'validade');
  if (informada) return informada;
  const producao = dataDoCalendario(dataProducao, 'data_producao');
  if (!producao) return null;
  const d = new Date(`${producao}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + PRAZO_PADRAO_DA_SEMENTE_EM_DIAS);
  return d.toISOString().slice(0, 10);
}

export function camposDoMovimentoSemente(atual = {}, payload = {}) {
  const campos = {};
  if ('data' in payload) campos.data = dataISO(payload.data, 'data');
  if ('tipo' in payload) {
    const tipo = String(payload.tipo ?? '').trim().toUpperCase().replace('SAÍDA', 'SAIDA');
    if (!['ENTRADA', 'SAIDA'].includes(tipo)) throw new Error('tipo inválido: use ENTRADA ou SAIDA.');
    campos.tipo = tipo;
  }
  if ('quantidade' in payload) campos.quantidade = inteiro(payload.quantidade, 'quantidade', { min: 1 });
  if ('nf' in payload) campos.nf = texto(payload.nf);
  if ('observacao' in payload) campos.observacao = texto(payload.observacao);
  if ('cepa_id' in payload) campos.cepa_id = inteiro(payload.cepa_id, 'cepa_id', { min: 1 });
  if ('data_producao' in payload) campos.data_producao = dataISO(payload.data_producao, 'data_producao');

  if ('ajuste' in payload || 'data_nf' in payload) {
    const marcouAjuste = String(payload.data_nf ?? '').trim().toUpperCase() === 'AJUSTE';
    const ajuste = 'ajuste' in payload ? payload.ajuste === true || marcouAjuste : marcouAjuste;
    campos.ajuste = ajuste;
    campos.data_nf = ajuste ? null
      : dataISO('data_nf' in payload ? payload.data_nf : atual?.data_nf, 'data_nf', { obrigatoria: false });
  }

  if ('validade' in payload || 'data_producao' in payload) {
    campos.validade = validadeDoMovimento({
      validade: payload.validade,
      dataProducao: 'data_producao' in payload ? payload.data_producao : atual?.data_producao,
    });
  }

  if (!Object.keys(campos).length) throw new Error('Nenhuma alteração informada.');
  return campos;
}

export const CHAVES_ACEITAS_LOTE = [
  'data_lote', 'tipo', 'nf_semente', 'receita', 'receitaId',
  'blocos_produzidos', 'misturas', 'blocos_guardados', 'blocos_semeados',
  'lote_pesquisa', 'capela_ligada', 'sementes', 'estantes', 'autoclave',
  'galpao', 'estante_maturacao', 'estante_abertura', 'estante_frutificacao',
  'data_abertura', 'blocos_abertos', 'zerou_estante',
  'responsavel_semeacao', 'responsavel_conferencia', 'responsavel_pesagem', 'responsavel_selagem',
  'permitir_duplicata', 'permitir_reabertura', 'permitir_encerrado', 'reabrir',
];

export const CHAVES_ACEITAS_COLHEITA = [
  'data', 'data_colheita', 'kg_pp', 'kg_p', 'kg_m', 'kg_g', 'kg_gg', 'estante',
  'permitir_encerrado', 'permitir_duplicata', 'permitir_dia_sem_colheita',
];

export const CHAVES_ACEITAS_CONTAMINACAO = [
  'lote_id', 'data_lote', 'tipo', 'estante', 'data_retirada', 'tipo_evento',
  'tipo_contaminado', 'quantidade', 'local_no_bloco',
  'permitir_encerrado', 'permitir_duplicata',
  'motivo', 'saldo_total',
];

export const CHAVES_ACEITAS_CONTAMINACAO_PATCH = CHAVES_ACEITAS_CONTAMINACAO
  .filter((chave) => chave !== 'motivo' && chave !== 'saldo_total');

export const CHAVES_ACEITAS_SEMENTE_MOVIMENTO = [
  'data', 'data_nf', 'ajuste', 'tipo', 'cepa_id', 'cepa', 'nf',
  'data_producao', 'validade', 'quantidade', 'observacao',
];

export const CHAVES_ACEITAS_ESTANTES = ['estantes', 'permitir_duplicata'];
