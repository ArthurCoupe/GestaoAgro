import { erroDeValidacao } from './camposDoCiclo.js';

export const TIPOS_DE_EVENTO_ATIPICO = Object.freeze([
  { codigo: 'COMPOSTO_MUITO_SECO', rotulo: 'Composto muito seco' },
  { codigo: 'COMPOSTO_MUITO_MOLHADO', rotulo: 'Composto muito molhado' },
  { codigo: 'FALTA_DE_ENERGIA', rotulo: 'Falta de energia' },
  { codigo: 'OCORRENCIA_NA_CAPELA', rotulo: 'Ocorrência na capela' },
  { codigo: 'OCORRENCIA_NA_SELADORA', rotulo: 'Ocorrência na seladora' },
  { codigo: 'OCORRENCIA_NA_AUTOCLAVE', rotulo: 'Ocorrência na autoclave' },
  { codigo: 'TEMPERATURA_FORA_DO_PADRAO', rotulo: 'Temperatura fora do padrão' },
  { codigo: 'EQUIPAMENTO_ESTRAGADO', rotulo: 'Equipamento estragado' },
  { codigo: 'CARACTERISTICA_DA_SEMENTE', rotulo: 'Característica/observação da semente' },
  { codigo: 'OUTROS', rotulo: 'Outros' },
]);

export const CODIGOS_DE_EVENTO_ATIPICO = TIPOS_DE_EVENTO_ATIPICO.map((t) => t.codigo);
export const TIPO_FALTA_DE_ENERGIA = 'FALTA_DE_ENERGIA';
export const TIPO_OUTROS = 'OUTROS';

export const TEXTO_MAX_DO_EVENTO_ATIPICO = 500;

export const CHAVES_ACEITAS_EVENTO_ATIPICO = ['tipo', 'descricao', 'observacao', 'hora_inicio', 'hora_retorno'];

export const COLUNAS_DO_EVENTO_ATIPICO = 'id, lote_id, tipo, descricao, observacao, hora_inicio, hora_retorno, created_at';

export const ERRO_HORA_DO_EVENTO_ATIPICO = 'Hora inválida: use o formato HH:MM, de 00:00 a 23:59.';

export const horaValida = (v) => typeof v === 'string' && /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(v);

export const rotuloDoEventoAtipico = (codigo) => TIPOS_DE_EVENTO_ATIPICO.find((t) => t.codigo === codigo)?.rotulo ?? codigo;

const horaCurta = (h) => (typeof h === 'string' && h.length >= 5 ? h.slice(0, 5) : null);

export function eventoAtipicoDaLinha(l) {
  return {
    id: l.id,
    lote_id: l.lote_id,
    tipo: l.tipo,
    descricao: l.descricao ?? null,
    observacao: l.observacao ?? null,
    hora_inicio: horaCurta(l.hora_inicio),
    hora_retorno: horaCurta(l.hora_retorno),
    created_at: l.created_at ?? null,
  };
}

function textoLivre(bruto, nome) {
  if (bruto == null) return null;
  if (typeof bruto !== 'string') throw erroDeValidacao(`${nome} precisa ser texto.`);
  if (bruto.includes(String.fromCharCode(0))) throw erroDeValidacao(`${nome} tem um caractere inválido.`);
  const t = bruto.trim();
  return t === '' ? null : t;
}

function horaDoCorpo(bruto) {
  if (bruto == null) return null;
  if (typeof bruto !== 'string') throw erroDeValidacao(ERRO_HORA_DO_EVENTO_ATIPICO);
  const h = bruto.trim();
  if (h === '') return null;
  if (!horaValida(h)) throw erroDeValidacao(ERRO_HORA_DO_EVENTO_ATIPICO);
  return h;
}

/**
 * @param {*} payload
 * @param {*} [atual]
 */
export function camposDoEventoAtipico(payload, atual = null) {
  if (payload == null || typeof payload !== 'object' || Array.isArray(payload)) {
    throw erroDeValidacao('Informe os dados da ocorrência.');
  }
  const veio = (k) => Object.hasOwn(payload, k);
  if (atual && !CHAVES_ACEITAS_EVENTO_ATIPICO.some(veio)) {
    throw erroDeValidacao('Informe o que deseja corrigir na ocorrência.');
  }

  let tipo = atual?.tipo ?? null;
  if (veio('tipo')) {
    if (payload.tipo != null && typeof payload.tipo !== 'string') throw erroDeValidacao('Tipo de ocorrência inválido.');
    tipo = String(payload.tipo ?? '').trim().toUpperCase() || null;
  }
  if (!tipo) throw erroDeValidacao('Escolha o tipo da ocorrência.');
  if (!CODIGOS_DE_EVENTO_ATIPICO.includes(tipo)) {
    throw erroDeValidacao(`Tipo de ocorrência inválido. Use um destes: ${CODIGOS_DE_EVENTO_ATIPICO.join(', ')}.`);
  }
  const tipoMudou = atual != null && tipo !== atual.tipo;
  const valor = (k) => (veio(k) ? payload[k] : (tipoMudou && k !== 'observacao' ? null : atual?.[k] ?? null));

  const descricao = textoLivre(valor('descricao'), 'A descrição');
  const observacao = textoLivre(valor('observacao'), 'A observação');
  if (tipo === TIPO_OUTROS && descricao == null) {
    throw erroDeValidacao('Em Outros, descreva o que aconteceu.');
  }
  if (tipo !== TIPO_OUTROS && descricao != null) {
    throw erroDeValidacao('A descrição só vale para Outros. Nos demais tipos, use a observação.');
  }
  for (const [t, nome] of [[descricao, 'A descrição'], [observacao, 'A observação']]) {
    if (t != null && t.length > TEXTO_MAX_DO_EVENTO_ATIPICO) {
      throw erroDeValidacao(`${nome} passa de ${TEXTO_MAX_DO_EVENTO_ATIPICO} caracteres.`);
    }
  }

  const horaInicio = horaDoCorpo(valor('hora_inicio'));
  const horaRetorno = horaDoCorpo(valor('hora_retorno'));
  if (tipo !== TIPO_FALTA_DE_ENERGIA && (horaInicio != null || horaRetorno != null)) {
    throw erroDeValidacao('O horário só vale para Falta de energia.');
  }

  return { tipo, descricao, observacao, hora_inicio: horaInicio, hora_retorno: horaRetorno };
}
