import { PARAMETRO_ABERTURA_DIAS } from './painelDoCiclo.js';
import { resolverDiasDeMaturacao } from './maturacaoPorEspecie.js';
import { TIPOS_DE_COGUMELO } from './conferenciaEmbalagem.js';

const DIA = 86400000;

export function tiposDaQuery(v) {
  if (v == null || v === '') return undefined;
  const lista = String(v);
  return lista.split(',').every((t) => TIPOS_DE_COGUMELO.includes(t)) ? lista : null;
}

export const JANELA_CONCLUIDAS_DIAS = 30;

const somarDias = (iso, dias) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + dias * DIA).toISOString().slice(0, 10);

const diasEntre = (de, ate) => {
  if (!de || !ate) return null;
  return Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / DIA);
};

const dentro = (data, inicio, fim) =>
  Boolean(data) && (!inicio || data >= inicio) && (!fim || data <= fim);

export function filaDeAbertura({ lotes = [], eventos = [] } = {}, opcoes = {}) {
  const {
    hoje, parametros = PARAMETRO_ABERTURA_DIAS, filtro = {}, horizonte = 7,
    regrasPorEspecie = [],
  } = opcoes;
  if (!hoje) {
    throw new Error(
      'filaDeAbertura: `hoje` e obrigatorio. Toda a fila depende dele, e ler o relogio '
      + 'aqui faria o resultado mudar sozinho de um dia para o outro.',
    );
  }
  const { inicio, fim, tipo, galpao } = filtro;

  const contamPorEstante = new Map();
  const removidosPorEstante = new Map();
  const perdidosPorEstante = new Map();
  for (const e of eventos) {
    const q = Number(e.quantidade ?? 0);
    removidosPorEstante.set(e.lote_id, (removidosPorEstante.get(e.lote_id) ?? 0) + q);
    if (e.tipo === 'CONTAMINACAO') contamPorEstante.set(e.lote_id, (contamPorEstante.get(e.lote_id) ?? 0) + q);
    else perdidosPorEstante.set(e.lote_id, (perdidosPorEstante.get(e.lote_id) ?? 0) + q);
  }

  const loteAbriuAlgo = new Set(
    lotes.filter((l) => l.data_abertura).map((l) => `${l.data_lote}|${l.tipo}`),
  );

  const totalDoLote = new Map();
  for (const l of lotes) {
    const chave = `${l.data_lote}|${l.tipo}`;
    const q = Number(l.blocos_produzidos ?? 0);
    if (q > 0) totalDoLote.set(chave, (totalDoLote.get(chave) ?? 0) + q);
  }

  const linhas = [];
  const foraDaFila = [];
  const concluidasComSobra = [];
  let comQuantidade = 0;
  let quantidadeNoLote = 0;
  let semQuantidade = 0;
  let blocosSomados = 0;

  for (const l of lotes) {
    if (tipo && !String(tipo).split(',').includes(l.tipo)) continue;
    if (galpao && l.galpao !== galpao) continue;
    if (!dentro(l.data_lote, inicio, fim)) continue;
    if (l.zerou_estante === true) {
      const produzidos = Number(l.blocos_produzidos ?? 0);
      const sobra = produzidos - (removidosPorEstante.get(l.id) ?? 0) - Number(l.blocos_abertos ?? 0);
      const idade = diasEntre(l.data_abertura, hoje);
      if (produzidos > 0 && sobra > 0 && l.status !== 'ENCERRADO'
        && idade != null && idade >= 0 && idade <= JANELA_CONCLUIDAS_DIAS) {
        concluidasComSobra.push({
          estante_id: l.id,
          data_lote: l.data_lote,
          tipo: l.tipo ?? null,
          galpao: l.galpao ?? null,
          estante: l.estante_maturacao == null ? null : String(l.estante_maturacao),
          data_abertura: l.data_abertura,
          blocos_guardados: produzidos,
          blocos_contaminados: contamPorEstante.get(l.id) ?? 0,
          blocos_perdidos: perdidosPorEstante.get(l.id) ?? 0,
          blocos_abertos: Number(l.blocos_abertos ?? 0),
          blocos_na_conta: sobra,
        });
      }
      continue;
    }
    if (l.data_abertura && l.zerou_estante !== false) continue;

    const bruto = l.blocos_produzidos == null ? null : Number(l.blocos_produzidos);
    const guardados = bruto || null;
    const contaminados = contamPorEstante.get(l.id) ?? 0;
    const removidos = removidosPorEstante.get(l.id) ?? 0;
    const abertos = Number(l.blocos_abertos ?? 0);
    const parcialmenteAberta = Boolean(l.data_abertura) && l.zerou_estante === false;
    const disponiveis = guardados == null ? null : guardados - removidos - abertos;

    const chaveLote = `${l.data_lote}|${l.tipo}`;
    const totalLote = totalDoLote.get(chaveLote) ?? null;
    const origem = guardados != null ? 'ESTANTE' : totalLote != null ? 'LOTE' : 'AUSENTE';

    const semSaldo = disponiveis != null && disponiveis <= 0;

    const encerradoSemContagem = l.status === 'ENCERRADO' && origem !== 'ESTANTE';

    const pendenteDeclarada = parcialmenteAberta && semSaldo;
    const sai = (semSaldo && !pendenteDeclarada) || encerradoSemContagem;

    const motivoFora = !sai ? null
      : disponiveis != null && disponiveis < 0 ? 'SALDO_NEGATIVO'
        : semSaldo ? 'ZERADO'
          : 'ENCERRADO_SEM_CONTAGEM';

    if (!sai) {
      if (origem === 'ESTANTE') { comQuantidade += 1; blocosSomados += Math.max(0, disponiveis); }
      else if (origem === 'LOTE') quantidadeNoLote += 1;
      else semQuantidade += 1;
    }

    const prazo = resolverDiasDeMaturacao(
      { tipo: l.tipo, data_lote: l.data_lote },
      { regrasPorEspecie, parametrosPorTipo: parametros },
    );
    const parametro = prazo.dias;
    const dataFutura = l.data_lote > hoje;
    const prevista = (parametro == null || dataFutura) ? null : somarDias(l.data_lote, parametro);
    const restantes = prevista == null ? null : diasEntre(hoje, prevista);

    const situacao = dataFutura ? 'DATA_INCONSISTENTE'
      : parametro == null ? 'SEM_PARAMETRO'
        : restantes < 0 ? 'VENCIDO'
          : restantes <= horizonte ? 'PROXIMO'
            : 'EM_PRAZO';

    (sai ? foraDaFila : linhas).push({
      motivo_fora: motivoFora,
      estante_id: l.id,
      lote_chave: chaveLote,
      data_lote: l.data_lote,
      tipo: l.tipo ?? null,
      galpao: l.galpao ?? null,
      estante: l.estante_maturacao == null ? null : String(l.estante_maturacao),
      blocos_guardados: guardados,
      blocos_guardados_lote: totalLote,
      origem_quantidade: origem,
      blocos_contaminados: contaminados,
      blocos_perdidos: perdidosPorEstante.get(l.id) ?? 0,
      blocos_abertos: abertos || null,
      blocos_disponiveis: disponiveis,
      parametro_dias: parametro,
      parametro_origem: prazo.origem,
      regra_id: prazo.regra_id,
      data_prevista: prevista,
      dias_restantes: restantes,
      dias_decorridos: diasEntre(l.data_lote, hoje),
      situacao,
      sem_quantidade: origem === 'AUSENTE',
      saldo_negativo: disponiveis != null && disponiveis < 0,
      lote_parcialmente_aberto: loteAbriuAlgo.has(`${l.data_lote}|${l.tipo}`),
      estante_parcialmente_aberta: parcialmenteAberta,
    });
  }

  linhas.sort((a, b) => {
    if (a.data_prevista && b.data_prevista) {
      if (a.data_prevista !== b.data_prevista) return a.data_prevista < b.data_prevista ? -1 : 1;
    } else if (a.data_prevista !== b.data_prevista) {
      return a.data_prevista ? -1 : 1;
    }
    if (a.lote_chave !== b.lote_chave) return a.lote_chave < b.lote_chave ? -1 : 1;
    return (b.blocos_disponiveis ?? -1) - (a.blocos_disponiveis ?? -1);
  });

  return {
    linhas,
    fora_da_fila: [...foraDaFila].sort((a, b) => (a.data_lote ?? '').localeCompare(b.data_lote ?? '')
      || (a.lote_chave ?? '').localeCompare(b.lote_chave ?? '')
      || String(a.estante ?? '').localeCompare(String(b.estante ?? ''), 'pt', { numeric: true })),
    concluidas_com_sobra: concluidasComSobra.sort((a, b) => b.data_abertura.localeCompare(a.data_abertura)
      || a.data_lote.localeCompare(b.data_lote)
      || String(a.estante ?? '').localeCompare(String(b.estante ?? ''), 'pt', { numeric: true })),
    cobertura: {
      enderecos: linhas.length,
      com_quantidade: comQuantidade,
      quantidade_no_lote: quantidadeNoLote,
      sem_quantidade: semQuantidade,
      blocos_somados: blocosSomados,
      fora_por_saldo: foraDaFila.filter((l) => l.motivo_fora !== 'ENCERRADO_SEM_CONTAGEM').length,
      fora_negativos: foraDaFila.filter((l) => l.saldo_negativo).length,
      fora_encerrados: foraDaFila.filter((l) => l.motivo_fora === 'ENCERRADO_SEM_CONTAGEM').length,
    },
  };
}

const SITUACOES = ['VENCIDO', 'PROXIMO', 'EM_PRAZO', 'SEM_PARAMETRO', 'DATA_INCONSISTENTE'];

export function resumoDaFila(dados = {}, opcoes = {}) {
  const { linhas, cobertura } = filaDeAbertura(dados, opcoes);

  const vazio = () => ({ enderecos: 0, lotes: new Set(), blocos: 0 });
  const acumular = (alvo, l) => {
    alvo.enderecos += 1;
    alvo.lotes.add(l.lote_chave);
    if (l.blocos_disponiveis != null && l.blocos_disponiveis > 0) alvo.blocos += l.blocos_disponiveis;
  };
  const fechar = (a) => ({ enderecos: a.enderecos, lotes: a.lotes.size, blocos: a.blocos });

  const porSituacao = Object.fromEntries(SITUACOES.map((s) => [s, vazio()]));
  const porTipo = new Map();
  for (const l of linhas) {
    acumular(porSituacao[l.situacao], l);
    const t = l.tipo ?? '(sem tipo)';
    if (!porTipo.has(t)) porTipo.set(t, vazio());
    acumular(porTipo.get(t), l);
  }

  return {
    por_situacao: Object.fromEntries(SITUACOES.map((s) => [s, fechar(porSituacao[s])])),
    por_tipo: [...porTipo.entries()].sort(([a], [b]) => a.localeCompare(b))
      .map(([tipo, a]) => ({ tipo, ...fechar(a) })),
    cobertura,
  };
}
