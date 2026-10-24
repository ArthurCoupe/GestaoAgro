import { galpaoDoCaderno } from './galpaoDoCaderno.js';

const CORTE_DATA = '2026-09-17';

const diaMes = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ''));
  return m ? `${m[3]}/${m[2]}` : String(iso ?? '');
};

const vazio = (v) => v == null || String(v).trim() === '';

const blocos = (n) => `${n} bloco${n === 1 ? '' : 's'}`;

function localDoItem(it, salas) {
  const galpao = vazio(it.galpao) ? null
    : galpaoDoCaderno(it.galpao, salas.find((s) => s.galpao_codigo === it.galpao)?.nome);
  const estante = vazio(it.estante) ? null : `estante ${String(it.estante).trim()}`;
  return [galpao, estante].filter(Boolean).join(', ') || null;
}

const VERBO_DA_DIVERGENCIA = { ABERTURA: 'abertos', RETIRADA: 'retirados', GUARDA: 'guardados' };

const CAMPOS_AUTOCLAVE = [
  ['entrada', 'entrada'], ['atingiu_121', '121 °C'], ['fim_2h', 'fim'], ['pressao_na_faixa', 'pressão'],
];

function agruparBateladas(lotes) {
  const porChave = new Map();
  for (const l of lotes) {
    const chave = `${l.data_lote}|${l.tipo}`;
    if (!porChave.has(chave)) porChave.set(chave, []);
    porChave.get(chave).push(l);
  }
  return [...porChave.values()].map((linhas) => {
    const ordenadas = [...linhas].sort((a, b) => a.id - b.id);
    return { primeira: ordenadas[0], linhas: ordenadas };
  });
}

const somaDias = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

export const JANELA_MAXIMA_DIAS = 60;
export const ultimoDiaFechado = (hoje, diasParaFechar) => somaDias(hoje, -Math.ceil(diasParaFechar));
function diasSemEmbalagem({ registros = [], inicio, diasParaFechar }, hoje) {
  if (!inicio || !hoje) throw new Error('pendenciasDeLancamento: embalagem exige inicio e hoje.');
  if (!Number.isFinite(diasParaFechar) || diasParaFechar < 0) throw new Error('pendenciasDeLancamento: diasParaFechar precisa ser numero >= 0.');
  const lancados = new Set(registros.filter((r) => Number(r.quantidade ?? 0) > 0).map((r) => String(r.data).slice(0, 10)));
  const ultimo = ultimoDiaFechado(hoje, diasParaFechar);
  const piso = somaDias(ultimo, -(JANELA_MAXIMA_DIAS - 1));
  const dias = [];
  for (let d = inicio > piso ? inicio : piso; d <= ultimo; d = somaDias(d, 1)) if (!lancados.has(d)) dias.push(d);
  return dias;
}

const MAX_DATAS_NA_FRASE = 8;
function contaminadosSemEstante(eventos, lotesPorId) {
  const porLote = new Map();
  for (const e of eventos) {
    if (e.tipo !== 'CONTAMINACAO' || e.estante_registrada !== false || e.importado !== false) continue;
    if (!porLote.has(e.lote_id)) porLote.set(e.lote_id, []);
    porLote.get(e.lote_id).push(e);
  }
  const itens = [];
  for (const [loteId, retiradas] of porLote) {
    const lote = lotesPorId.get(loteId);
    if (!lote) continue;
    const datas = retiradas.map((r) => r.data_evento).filter((d) => !vazio(d)).map((d) => String(d).slice(0, 10)).sort();
    const n = retiradas.length;
    const resto = datas.length > MAX_DATAS_NA_FRASE ? ` e mais ${datas.length - MAX_DATAS_NA_FRASE}` : '';
    const quando = datas.length ? ` (${datas.slice(0, MAX_DATAS_NA_FRASE).map(diaMes).join(', ')}${resto})` : '';
    const ondeEsta = vazio(lote.estante_maturacao) ? '' : `, estante ${String(lote.estante_maturacao).trim()}`;
    const retiradasTxt = `${n} retirada${n === 1 ? '' : 's'}`;
    const detalhe = `${retiradasTxt} de contaminação com a estante da retirada não anotada${quando}.`;
    itens.push({
      tipo: 'CONTAMINADO_SEM_ESTANTE', lote_id: lote.id, codigo: lote.codigo ?? null, data_lote: lote.data_lote,
      galpao: lote.galpao ?? null, estante: lote.estante_maturacao ?? null, desde: datas[0] ?? lote.data_lote,
      especie: lote.tipo ?? null, detalhe, quantidade: retiradasTxt,
      frase: `Lote de ${diaMes(lote.data_lote)} (${lote.tipo})${ondeEsta}: ${detalhe} Confira na plaquinha e corrija em Contaminados, no Editar.`,
    });
  }
  return itens;
}

const pctBr = (f) => `${(Math.round(f * 1000) / 10).toLocaleString('pt-BR')}%`;
function retiradasAcimaDoLimite({ alertas = [], verificados = null, inicio }, lotesPorId, salas) {
  if (!inicio) throw new Error('pendenciasDeLancamento: retiradas exige inicio.');
  const itens = [];
  for (const a of alertas) {
    const data = String(a.data_ronda ?? '').slice(0, 10);
    if (!data || data < inicio) continue;
    if ((verificados?.get(`${a.lote_id}|${data}`)?.blocos ?? -1) >= Number(a.blocos_na_ronda ?? 0)) continue;
    const lote = lotesPorId.get(a.lote_id);
    if (!lote) continue;
    const onde = vazio(a.estante) ? `Lote #${a.lote_id}` : `Estante ${String(a.estante).trim()}`;
    const galpao = vazio(a.galpao) ? ''
      : ` (galpão ${galpaoDoCaderno(a.galpao, salas.find((s) => s.galpao_codigo === a.galpao)?.nome)})`;
    const detalhe = `a retirada de ${diaMes(data)} levou ${pctBr(a.pct_da_ronda)} do que a estante produziu, `
      + `acima do limite de ${pctBr(a.limite)}.`;
    const naRetirada = Number(a.blocos_na_ronda);
    itens.push({
      tipo: 'RETIRADA_ACIMA_DO_LIMITE', lote_id: a.lote_id, codigo: lote.codigo ?? null, data_lote: lote.data_lote,
      galpao: a.galpao ?? null, estante: a.estante ?? null, desde: data, data_retirada: data,
      especie: lote.tipo ?? null, pct_da_ronda: a.pct_da_ronda, limite: a.limite,
      detalhe, quantidade: a.blocos_na_ronda != null && Number.isFinite(naRetirada) ? blocos(naRetirada) : null,
      frase: `${onde}${galpao}, lote de ${diaMes(lote.data_lote)} (${lote.tipo}): ${detalhe}`,
    });
  }
  return itens;
}

export function pendenciasDeLancamento(
  { lotes = [], autoclaves = [], transferencias = [], divergencias = [], embalagem = null, eventos = [], retiradas = null, salas = [] } = {},
  { hoje } = {},
) {
  const lotesPorId = new Map(lotes.map((l) => [l.id, l]));
  const itens = [];

  for (const { primeira, linhas } of agruparBateladas(lotes)) {
    const prefixo = `Lote de ${diaMes(primeira.data_lote)} (${primeira.tipo})`;
    const base = {
      lote_id: primeira.id, codigo: primeira.codigo ?? null, data_lote: primeira.data_lote,
      galpao: primeira.galpao ?? null, estante: primeira.estante_maturacao ?? null, desde: primeira.data_lote,
      especie: primeira.tipo ?? null,
    };
    const doLote = (tipo, detalhe, quantidade = null) => ({
      ...base, tipo, detalhe, quantidade, local: localDoItem({ galpao: base.galpao }, salas), frase: `${prefixo}: ${detalhe}`,
    });

    if (primeira.data_lote >= CORTE_DATA) {
      const batidas = autoclaves.filter((a) => a.lote_id === primeira.id);
      if (!batidas.length) {
        itens.push(doLote('AUTOCLAVE_SEM_DADOS', 'faltam os dados da autoclave.'));
      } else {
        for (const b of batidas) {
          const faltam = CAMPOS_AUTOCLAVE.filter(([campo]) => vazio(b[campo])).map(([, rotulo]) => rotulo);
          if (!faltam.length) continue;
          itens.push(doLote('AUTOCLAVE_SEM_DADOS', `batida ${b.ordem} sem ${faltam.join('/')}.`));
        }
      }

      if (primeira.capela_ligada == null) {
        itens.push(doLote('CAPELA_NAO_INFORMADA', 'informe se a capela estava ligada.'));
      }

      if (vazio(primeira.responsavel_semeacao)) {
        itens.push(doLote('SEM_RESPONSAVEL', 'informe quem semeou.'));
      }
    }

    if (primeira.blocos_semeados != null) {
      const guardados = linhas.reduce((soma, l) => soma + (l.blocos_guardados ?? 0), 0);
      const faltam = primeira.blocos_semeados - guardados;
      if (faltam > 0) {
        const plural = faltam === 1 ? '' : 's';
        itens.push(doLote('GUARDA_INCOMPLETA', `${faltam} bloco${plural} semeado${plural} ainda sem estante.`, blocos(faltam)));
      }
    }
  }

  for (const t of transferencias) {
    if (t.sala_destino != null) continue;
    const lote = lotesPorId.get(t.lote_id);
    if (!lote) continue;
    const detalhe = `falta a sala (aberto em ${diaMes(t.data ?? lote.data_lote)}).`;
    const abertos = Number(t.quantidade);
    itens.push({
      tipo: 'ABERTURA_SEM_SALA', lote_id: lote.id, codigo: lote.codigo ?? null, data_lote: lote.data_lote,
      galpao: lote.galpao ?? null, estante: t.estante_destino ?? null, desde: t.data ?? lote.data_lote,
      transferencia_id: t.id ?? null, estante_origem: t.estante_origem ?? null, data_abertura: t.data ?? null,
      especie: lote.tipo ?? null, detalhe,
      quantidade: t.quantidade != null && Number.isFinite(abertos) ? blocos(abertos) : null,
      local: vazio(t.estante_destino) ? null : `estante ${String(t.estante_destino).trim()} de frutificação`,
      frase: `Lote de ${diaMes(lote.data_lote)} (${lote.tipo}), aberto em ${diaMes(t.data ?? lote.data_lote)} `
        + `na estante ${t.estante_destino} de frutificação: falta a sala.`,
    });
  }

  if (embalagem) {
    const comColheita = Array.isArray(embalagem.diasComColheita)
      ? new Set(embalagem.diasComColheita.map((d) => String(d).slice(0, 10)))
      : null;
    const dispensados = new Set((embalagem.dispensados ?? []).map((d) => String(d).slice(0, 10)));
    for (const dia of diasSemEmbalagem(embalagem, hoje)) {
      const colheitaNoDia = comColheita == null ? null : comColheita.has(dia);
      const semColheita = colheitaNoDia === false;
      if (semColheita && dispensados.has(dia)) continue;
      const marcado = dispensados.has(dia);
      const voltouPorColheita = colheitaNoDia === true && marcado;
      itens.push({
        tipo: 'EMBALAGEM_NAO_LANCADA', lote_id: null, codigo: null, data_lote: dia,
        galpao: null, estante: null, desde: dia, pode_dispensar: semColheita, colheita_no_dia: colheitaNoDia,
        marcado_sem_colheita: marcado,
        especie: null,
        detalhe: voltouPorColheita ? 'marcado como sem colheita, mas há colheita lançada com essa data.' : 'nenhuma embalagem lançada.',
        quantidade: null,
        frase: voltouPorColheita
          ? `Dados Embalagem: o dia ${diaMes(dia)} foi marcado como sem colheita, mas há colheita lançada com essa data.`
          : `Dados Embalagem: nenhuma embalagem lançada para o dia ${diaMes(dia)}.`,
      });
    }
  }

  for (const d of divergencias) {
    const lote = lotesPorId.get(d.lote_id);
    if (!lote) continue;
    const verbo = VERBO_DA_DIVERGENCIA[d.tipo] ?? 'contados';
    const detalhe = `contagem divergente em ${diaMes(d.data)} (${d.informado} ${verbo}, ${d.esperado ?? '—'} na estante), `
      + `quem contou: ${d.responsavel ?? 'não informado'}.`;
    const diferenca = Math.abs(Number(d.informado) - Number(d.esperado));
    itens.push({
      tipo: 'DIVERGENCIA', lote_id: lote.id, codigo: lote.codigo ?? null, data_lote: lote.data_lote,
      galpao: lote.galpao ?? null, estante: lote.estante_maturacao ?? null, desde: d.data,
      especie: lote.tipo ?? null, detalhe,
      quantidade: d.informado != null && d.esperado != null && Number.isFinite(diferenca) ? `${blocos(diferenca)} de diferença` : null,
      frase: `Lote de ${diaMes(lote.data_lote)} (${lote.tipo}): ${detalhe}`,
    });
  }

  itens.push(...contaminadosSemEstante(eventos, lotesPorId));
  if (retiradas) itens.push(...retiradasAcimaDoLimite(retiradas, lotesPorId, salas));
  for (const it of itens) if (!('local' in it)) it.local = localDoItem(it, salas);

  itens.sort((a, b) => (a.data_lote < b.data_lote ? 1 : a.data_lote > b.data_lote ? -1 : 0));

  const por_tipo = {};
  for (const it of itens) por_tipo[it.tipo] = (por_tipo[it.tipo] ?? 0) + 1;

  return { total: itens.length, itens, por_tipo };
}
