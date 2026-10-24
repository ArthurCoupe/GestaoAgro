import assert from 'node:assert/strict';
import { JANELA_MAXIMA_DIAS, pendenciasDeLancamento } from '../pendenciasDeLancamento.js';
import { conferenciaColheitaEmbalagem } from '../conferenciaEmbalagem.js';
import { caso } from './caso.mjs';

const LOTE_BASE = {
  id: 1, codigo: 'L-1', data_lote: '2026-09-17', tipo: 'SH', galpao: 'A', estante_maturacao: '12',
  blocos_semeados: null, blocos_guardados: null, capela_ligada: true, responsavel_semeacao: 'Operadora',
};


caso('vazio: sem lote nenhum devolve total 0, itens [] e por_tipo {}', () => {
  assert.deepEqual(pendenciasDeLancamento({ lotes: [] }, { hoje: '2026-09-17' }),
    { total: 0, itens: [], por_tipo: {} });
});

caso('AUTOCLAVE_SEM_DADOS: lote na corte sem NENHUMA batida', () => {
  const r = pendenciasDeLancamento({ lotes: [LOTE_BASE] }, { hoje: '2026-09-17' });
  assert.equal(r.total, 1);
  assert.equal(r.itens[0].tipo, 'AUTOCLAVE_SEM_DADOS');
  assert.equal(r.itens[0].frase, 'Lote de 17/09 (SH): faltam os dados da autoclave.');
  assert.equal(r.por_tipo.AUTOCLAVE_SEM_DADOS, 1);
});

caso('AUTOCLAVE_SEM_DADOS: batida com os quatro campos em branco lista os quatro, na ordem certa', () => {
  const r = pendenciasDeLancamento({
    lotes: [LOTE_BASE],
    autoclaves: [{ lote_id: 1, ordem: 1, responsavel: 'Ana', entrada: null, atingiu_121: null, fim_2h: null, pressao_na_faixa: null }],
  }, { hoje: '2026-09-17' });
  assert.equal(r.total, 1);
  assert.equal(r.itens[0].frase, 'Lote de 17/09 (SH): batida 1 sem entrada/121 °C/fim/pressão.');
});

caso('AUTOCLAVE_SEM_DADOS: batida SO com entrada em branco lista SO entrada -- nao inventa as outras', () => {
  const r = pendenciasDeLancamento({
    lotes: [LOTE_BASE],
    autoclaves: [{ lote_id: 1, ordem: 2, responsavel: 'Ana', entrada: null, atingiu_121: '121', fim_2h: '13:00', pressao_na_faixa: true }],
  }, { hoje: '2026-09-17' });
  assert.equal(r.total, 1);
  assert.equal(r.itens[0].frase, 'Lote de 17/09 (SH): batida 2 sem entrada.');
});

caso('AUTOCLAVE: batida completa NAO gera pendencia', () => {
  const r = pendenciasDeLancamento({
    lotes: [LOTE_BASE],
    autoclaves: [{ lote_id: 1, ordem: 1, responsavel: 'Ana', entrada: '08:00', atingiu_121: '08:30', fim_2h: '10:30', pressao_na_faixa: true }],
  }, { hoje: '2026-09-17' });
  assert.equal(r.itens.filter((i) => i.tipo === 'AUTOCLAVE_SEM_DADOS').length, 0);
});

caso('CAPELA_NAO_INFORMADA: capela_ligada nulo na corte', () => {
  const r = pendenciasDeLancamento({
    lotes: [{ ...LOTE_BASE, capela_ligada: null }],
  }, { hoje: '2026-09-17' });
  const item = r.itens.find((i) => i.tipo === 'CAPELA_NAO_INFORMADA');
  assert.ok(item, 'nao gerou CAPELA_NAO_INFORMADA');
  assert.equal(item.frase, 'Lote de 17/09 (SH): informe se a capela estava ligada.');
});

caso('SEM_RESPONSAVEL: responsavel_semeacao vazio na corte', () => {
  const r = pendenciasDeLancamento({
    lotes: [{ ...LOTE_BASE, responsavel_semeacao: '' }],
  }, { hoje: '2026-09-17' });
  const item = r.itens.find((i) => i.tipo === 'SEM_RESPONSAVEL');
  assert.ok(item, 'nao gerou SEM_RESPONSAVEL');
  assert.equal(item.frase, 'Lote de 17/09 (SH): informe quem semeou.');
});

caso('GUARDA_INCOMPLETA: blocos_semeados > soma de blocos_guardados', () => {
  const r = pendenciasDeLancamento({
    lotes: [{ ...LOTE_BASE, blocos_semeados: 216, blocos_guardados: 108, capela_ligada: true, responsavel_semeacao: 'Operadora' }],
  }, { hoje: '2026-09-17' });
  const item = r.itens.find((i) => i.tipo === 'GUARDA_INCOMPLETA');
  assert.ok(item, 'nao gerou GUARDA_INCOMPLETA');
  assert.equal(item.frase, 'Lote de 17/09 (SH): 108 blocos semeados ainda sem estante.');
});

caso('GUARDA_INCOMPLETA: soma de blocos_guardados >= blocos_semeados NAO gera pendencia', () => {
  const r = pendenciasDeLancamento({
    lotes: [{ ...LOTE_BASE, blocos_semeados: 216, blocos_guardados: 216 }],
  }, { hoje: '2026-09-17' });
  assert.equal(r.itens.filter((i) => i.tipo === 'GUARDA_INCOMPLETA').length, 0);
});

caso('GUARDA_INCOMPLETA: 1 bloco fica no singular ("1 bloco semeado ainda sem estante")', () => {
  const r = pendenciasDeLancamento({
    lotes: [{ ...LOTE_BASE, blocos_semeados: 217, blocos_guardados: 216, capela_ligada: true, responsavel_semeacao: 'Operadora' }],
  }, { hoje: '2026-09-17' });
  const item = r.itens.find((i) => i.tipo === 'GUARDA_INCOMPLETA');
  assert.ok(item, 'nao gerou GUARDA_INCOMPLETA');
  assert.equal(item.frase, 'Lote de 17/09 (SH): 1 bloco semeado ainda sem estante.');
});

caso('a BATELADA com DUAS linhas conta a GUARDA_INCOMPLETA uma vez so, somando guardados das duas', () => {
  const r = pendenciasDeLancamento({
    lotes: [
      { ...LOTE_BASE, id: 5, blocos_semeados: 300, blocos_guardados: 100, capela_ligada: true, responsavel_semeacao: 'Operadora' },
      { ...LOTE_BASE, id: 6, blocos_semeados: null, blocos_guardados: 150, capela_ligada: true, responsavel_semeacao: 'Operadora' },
    ],
  }, { hoje: '2026-09-17' });
  const guardaItens = r.itens.filter((i) => i.tipo === 'GUARDA_INCOMPLETA');
  assert.equal(guardaItens.length, 1, `esperava 1 item de GUARDA_INCOMPLETA (batelada unica), achei ${guardaItens.length}`);
  assert.equal(guardaItens[0].frase, 'Lote de 17/09 (SH): 50 blocos semeados ainda sem estante.');
});

caso('a BATELADA com DUAS linhas conta CAPELA_NAO_INFORMADA/SEM_RESPONSAVEL UMA vez so (le so a 1a linha, id menor)', () => {
  const r = pendenciasDeLancamento({
    lotes: [
      { ...LOTE_BASE, id: 9, capela_ligada: null, responsavel_semeacao: '' },
      { ...LOTE_BASE, id: 10, capela_ligada: true, responsavel_semeacao: 'Operadora' },
    ],
  }, { hoje: '2026-09-17' });
  assert.equal(r.itens.filter((i) => i.tipo === 'CAPELA_NAO_INFORMADA').length, 1);
  assert.equal(r.itens.filter((i) => i.tipo === 'SEM_RESPONSAVEL').length, 1);
});

caso('ABERTURA_SEM_SALA: transferencia ABERTURA sem sala_destino (frase separa estante de sala; carrega o id)', () => {
  const r = pendenciasDeLancamento({
    lotes: [LOTE_BASE],
    transferencias: [{ id: 77, lote_id: 1, data: '2026-09-10', sala_destino: null, estante_origem: '41', estante_destino: '7', quantidade: 40 }],
  }, { hoje: '2026-09-17' });
  const item = r.itens.find((i) => i.tipo === 'ABERTURA_SEM_SALA');
  assert.ok(item, 'nao gerou ABERTURA_SEM_SALA');
  assert.equal(item.frase, 'Lote de 17/09 (SH), aberto em 10/09 na estante 7 de frutificação: falta a sala.');
  assert.equal(item.desde, '2026-09-10');
  assert.equal(item.transferencia_id, 77);
  assert.equal(item.estante_origem, '41');
  assert.equal(item.data_abertura, '2026-09-10');
});

caso('ABERTURA_SEM_SALA: com sala_destino preenchida NAO gera pendencia', () => {
  const r = pendenciasDeLancamento({
    lotes: [LOTE_BASE],
    transferencias: [{ lote_id: 1, data: '2026-09-10', sala_destino: 'F1', estante_destino: '7', quantidade: 40 }],
  }, { hoje: '2026-09-17' });
  assert.equal(r.itens.filter((i) => i.tipo === 'ABERTURA_SEM_SALA').length, 0);
});

caso('DIVERGENCIA: divergencia aberta monta a frase com abertos/na estante/quem contou', () => {
  const r = pendenciasDeLancamento({
    lotes: [LOTE_BASE],
    divergencias: [{ id: 1, lote_id: 1, codigo: 'L-1', tipo: 'ABERTURA', data: '2026-09-12', esperado: 77, informado: 118, responsavel: 'Bruna' }],
  }, { hoje: '2026-09-17' });
  const item = r.itens.find((i) => i.tipo === 'DIVERGENCIA');
  assert.ok(item, 'nao gerou DIVERGENCIA');
  assert.equal(item.frase, 'Lote de 17/09 (SH): contagem divergente em 12/09 (118 abertos, 77 na estante), quem contou: Bruna.');
  assert.equal(item.desde, '2026-09-12');
});

caso('DIVERGENCIA: tipo RETIRADA usa o verbo "retirados" (nao "abertos" hardcoded)', () => {
  const r = pendenciasDeLancamento({
    lotes: [LOTE_BASE],
    divergencias: [{ id: 2, lote_id: 1, codigo: 'L-1', tipo: 'RETIRADA', data: '2026-09-12', esperado: 77, informado: 118, responsavel: 'Bruna' }],
  }, { hoje: '2026-09-17' });
  const item = r.itens.find((i) => i.tipo === 'DIVERGENCIA');
  assert.ok(item, 'nao gerou DIVERGENCIA');
  assert.equal(item.frase, 'Lote de 17/09 (SH): contagem divergente em 12/09 (118 retirados, 77 na estante), quem contou: Bruna.');
});

caso('DIVERGENCIA: esperado e responsavel nulos viram "—" e "não informado", nunca a palavra "null"', () => {
  const r = pendenciasDeLancamento({
    lotes: [LOTE_BASE],
    divergencias: [{ id: 3, lote_id: 1, codigo: 'L-1', tipo: 'GUARDA', data: '2026-09-12', esperado: null, informado: 118, responsavel: null }],
  }, { hoje: '2026-09-17' });
  const item = r.itens.find((i) => i.tipo === 'DIVERGENCIA');
  assert.ok(item, 'nao gerou DIVERGENCIA');
  assert.equal(item.frase, 'Lote de 17/09 (SH): contagem divergente em 12/09 (118 guardados, — na estante), quem contou: não informado.');
});


caso('lote ANTES do corte nao acusa AUTOCLAVE/CAPELA/SEM_RESPONSAVEL, mesmo sem nenhum dos tres', () => {
  const r = pendenciasDeLancamento({
    lotes: [{ ...LOTE_BASE, id: 2, data_lote: '2026-09-16', capela_ligada: null, responsavel_semeacao: '' }],
  }, { hoje: '2026-09-17' });
  assert.equal(r.itens.filter((i) => ['AUTOCLAVE_SEM_DADOS', 'CAPELA_NAO_INFORMADA', 'SEM_RESPONSAVEL'].includes(i.tipo)).length, 0,
    `lote antes do corte nao pode acusar as tres primeiras: ${JSON.stringify(r.itens)}`);
});

caso('lote ANTES do corte AINDA acusa GUARDA_INCOMPLETA -- esse tipo nao tem corte', () => {
  const r = pendenciasDeLancamento({
    lotes: [{ ...LOTE_BASE, id: 2, data_lote: '2026-09-16', blocos_semeados: 100, blocos_guardados: 0 }],
  }, { hoje: '2026-09-17' });
  assert.equal(r.itens.filter((i) => i.tipo === 'GUARDA_INCOMPLETA').length, 1);
});

caso('lote EXATAMENTE no corte (>=) acusa normalmente', () => {
  const r = pendenciasDeLancamento({
    lotes: [{ ...LOTE_BASE, id: 3, data_lote: '2026-09-17', capela_ligada: null }],
  }, { hoje: '2026-09-17' });
  assert.equal(r.itens.filter((i) => i.tipo === 'CAPELA_NAO_INFORMADA').length, 1);
});


caso('itens saem ordenados por data_lote DESC', () => {
  const r = pendenciasDeLancamento({
    lotes: [
      { ...LOTE_BASE, id: 20, data_lote: '2026-09-17', capela_ligada: null },
      { ...LOTE_BASE, id: 21, data_lote: '2026-09-20', capela_ligada: null },
      { ...LOTE_BASE, id: 22, data_lote: '2026-09-18', capela_ligada: null },
    ],
  }, { hoje: '2026-09-20' });
  const datas = r.itens.filter((i) => i.tipo === 'CAPELA_NAO_INFORMADA').map((i) => i.data_lote);
  assert.deepEqual(datas, ['2026-09-20', '2026-09-18', '2026-09-17']);
});


const reg = (data, quantidade = 3) => ({ id: data, data, data_lancamento: null, embalagem_produto_id: 1, quantidade });
const diasDe = (inicio, fim, fora = []) => {
  const out = [];
  for (let d = inicio; d <= fim; d = new Date(Date.parse(`${d}T00:00:00Z`) + 86400000).toISOString().slice(0, 10)) {
    if (!fora.includes(d)) out.push(reg(d));
  }
  return out;
};
const soEmbalagem = (r) => r.itens.filter((i) => i.tipo === 'EMBALAGEM_NAO_LANCADA').map((i) => i.data_lote);

caso('dois dias sem embalagem no meio do mes (15/09 e 22/09); 28 e 29 ainda estao sendo embalados', () => {
  const r = pendenciasDeLancamento({
    lotes: [],
    embalagem: { registros: diasDe('2026-09-01', '2026-09-27', ['2026-09-15', '2026-09-22']), inicio: '2026-09-01', diasParaFechar: 2 },
  }, { hoje: '2026-09-29' });
  assert.deepEqual(soEmbalagem(r), ['2026-09-22', '2026-09-15']);
  assert.equal(r.total, 2);
  assert.deepEqual(r.por_tipo, { EMBALAGEM_NAO_LANCADA: 2 });
  assert.deepEqual(r.itens[1], {
    tipo: 'EMBALAGEM_NAO_LANCADA', lote_id: null, codigo: null, data_lote: '2026-09-15',
    galpao: null, estante: null, desde: '2026-09-15', pode_dispensar: false, colheita_no_dia: null, marcado_sem_colheita: false,
    especie: null, detalhe: 'nenhuma embalagem lançada.', quantidade: null, local: null,
    frase: 'Dados Embalagem: nenhuma embalagem lançada para o dia 15/09.',
  });
});

const embalagemDeSetembro = (extra = {}) => ({
  registros: diasDe('2026-09-01', '2026-09-27', ['2026-09-15', '2026-09-22']), inicio: '2026-09-01', diasParaFechar: 2, ...extra,
});
const dispensaveis = (r) => r.itens.filter((i) => i.tipo === 'EMBALAGEM_NAO_LANCADA').map((i) => `${i.data_lote}:${i.pode_dispensar}`);

caso('nao houve colheita: sem colheita nos dois dias, os dois oferecem o botao', () => {
  const r = pendenciasDeLancamento({ embalagem: embalagemDeSetembro({ diasComColheita: ['2026-09-16'] }) }, { hoje: '2026-09-29' });
  assert.deepEqual(dispensaveis(r), ['2026-09-22:true', '2026-09-15:true']);
});

caso('nao houve colheita: dia com colheita lancada nao oferece o botao (falta embalagem de verdade)', () => {
  const r = pendenciasDeLancamento({ embalagem: embalagemDeSetembro({ diasComColheita: ['2026-09-15'] }) }, { hoje: '2026-09-29' });
  assert.deepEqual(dispensaveis(r), ['2026-09-22:true', '2026-09-15:false']);
});

caso('nao houve colheita: o dia marcado sai, o outro fica (controle: sem a marca, os dois)', () => {
  const marcado = pendenciasDeLancamento({ embalagem: embalagemDeSetembro({ diasComColheita: [], dispensados: ['2026-09-15'] }) }, { hoje: '2026-09-29' });
  assert.deepEqual(dispensaveis(marcado), ['2026-09-22:true']);
  assert.deepEqual(marcado.por_tipo, { EMBALAGEM_NAO_LANCADA: 1 });
  const semMarca = pendenciasDeLancamento({ embalagem: embalagemDeSetembro({ diasComColheita: [] }) }, { hoje: '2026-09-29' });
  assert.deepEqual(dispensaveis(semMarca), ['2026-09-22:true', '2026-09-15:true']);
});

caso('nao houve colheita: colheita lancada depois da marca traz a pendencia de volta, sem o botao', () => {
  const r = pendenciasDeLancamento({
    embalagem: embalagemDeSetembro({ diasComColheita: ['2026-09-15'], dispensados: ['2026-09-15'] }),
  }, { hoje: '2026-09-29' });
  assert.deepEqual(dispensaveis(r), ['2026-09-22:true', '2026-09-15:false']);
});

caso('nao houve colheita: sem saber a colheita (sem diasComColheita), a marca nao tira nada e o botao nao aparece', () => {
  const r = pendenciasDeLancamento({ embalagem: embalagemDeSetembro({ dispensados: ['2026-09-15', '2026-09-22'] }) }, { hoje: '2026-09-29' });
  assert.deepEqual(dispensaveis(r), ['2026-09-22:false', '2026-09-15:false']);
});

const doDia = (r, dia) => r.itens.find((i) => i.tipo === 'EMBALAGEM_NAO_LANCADA' && i.data_lote === dia);

caso('colheita_no_dia: true no dia com colheita, false no dia sem, null quando a rota nao sabe', () => {
  const sabe = pendenciasDeLancamento({ embalagem: embalagemDeSetembro({ diasComColheita: ['2026-09-15'] }) }, { hoje: '2026-09-29' });
  assert.equal(doDia(sabe, '2026-09-15').colheita_no_dia, true);
  assert.equal(doDia(sabe, '2026-09-22').colheita_no_dia, false);
  const naoSabe = pendenciasDeLancamento({ embalagem: embalagemDeSetembro() }, { hoje: '2026-09-29' });
  assert.equal(doDia(naoSabe, '2026-09-15').colheita_no_dia, null);
  assert.equal(doDia(naoSabe, '2026-09-22').colheita_no_dia, null);
});

caso('dia marcado sem colheita e com colheita lancada depois diz isso no detalhe e na frase', () => {
  const r = pendenciasDeLancamento({
    embalagem: embalagemDeSetembro({ diasComColheita: ['2026-09-15'], dispensados: ['2026-09-15'] }),
  }, { hoje: '2026-09-29' });
  const it = doDia(r, '2026-09-15');
  assert.equal(it.detalhe, 'marcado como sem colheita, mas há colheita lançada com essa data.');
  assert.equal(it.frase, 'Dados Embalagem: o dia 15/09 foi marcado como sem colheita, mas há colheita lançada com essa data.');
  assert.equal(it.colheita_no_dia, true);
  assert.equal(it.marcado_sem_colheita, true);
  assert.equal(it.pode_dispensar, false);
  assert.equal(doDia(r, '2026-09-22').marcado_sem_colheita, false);
});

caso('controles do detalhe: com colheita e sem marca, ou com marca sem saber a colheita, fica o de sempre', () => {
  const semMarca = pendenciasDeLancamento({ embalagem: embalagemDeSetembro({ diasComColheita: ['2026-09-15'] }) }, { hoje: '2026-09-29' });
  assert.equal(doDia(semMarca, '2026-09-15').detalhe, 'nenhuma embalagem lançada.');
  assert.equal(doDia(semMarca, '2026-09-15').frase, 'Dados Embalagem: nenhuma embalagem lançada para o dia 15/09.');
  assert.equal(doDia(semMarca, '2026-09-15').marcado_sem_colheita, false);
  const naoSabe = pendenciasDeLancamento({ embalagem: embalagemDeSetembro({ dispensados: ['2026-09-15'] }) }, { hoje: '2026-09-29' });
  assert.equal(doDia(naoSabe, '2026-09-15').detalhe, 'nenhuma embalagem lançada.');
  assert.equal(doDia(naoSabe, '2026-09-15').colheita_no_dia, null);
  assert.equal(doDia(naoSabe, '2026-09-15').marcado_sem_colheita, true);
  const marcado = pendenciasDeLancamento({
    embalagem: embalagemDeSetembro({ diasComColheita: ['2026-09-15'], dispensados: ['2026-09-15'] }),
  }, { hoje: '2026-09-29' });
  assert.equal(doDia(marcado, '2026-09-22').detalhe, 'nenhuma embalagem lançada.');
});

caso('controle: com todos os dias lancados, nenhum item de embalagem', () => {
  const r = pendenciasDeLancamento({
    embalagem: { registros: diasDe('2026-09-01', '2026-09-27'), inicio: '2026-09-01', diasParaFechar: 2 },
  }, { hoje: '2026-09-29' });
  assert.deepEqual(soEmbalagem(r), []);
});

caso('quantidade 0 nao e lancamento; quantidade em texto ("3") e', () => {
  const registros = diasDe('2026-09-01', '2026-09-27', ['2026-09-10', '2026-09-11']);
  registros.push(reg('2026-09-10', 0), reg('2026-09-11', '3'));
  const r = pendenciasDeLancamento({ embalagem: { registros, inicio: '2026-09-01', diasParaFechar: 2 } }, { hoje: '2026-09-29' });
  assert.deepEqual(soEmbalagem(r), ['2026-09-10']);
});

caso('fronteira do diasParaFechar: com 2, o dia 27 acusa e o 28 nao; com 0, o proprio hoje acusa', () => {
  const embalagem = { registros: diasDe('2026-09-01', '2026-09-26'), inicio: '2026-09-01' };
  assert.deepEqual(soEmbalagem(pendenciasDeLancamento({ embalagem: { ...embalagem, diasParaFechar: 2 } }, { hoje: '2026-09-29' })),
    ['2026-09-27']);
  assert.deepEqual(soEmbalagem(pendenciasDeLancamento({ embalagem: { ...embalagem, diasParaFechar: 0 } }, { hoje: '2026-09-29' })),
    ['2026-09-29', '2026-09-28', '2026-09-27']);
  assert.deepEqual(soEmbalagem(pendenciasDeLancamento({ embalagem: { ...embalagem, diasParaFechar: 1.5 } }, { hoje: '2026-09-29' })),
    ['2026-09-27']);
});

caso('o dia antes de `inicio` (o corte) nunca acusa', () => {
  const r = pendenciasDeLancamento({
    embalagem: { registros: diasDe('2026-09-02', '2026-09-27'), inicio: '2026-09-02', diasParaFechar: 2 },
  }, { hoje: '2026-09-29' });
  assert.deepEqual(soEmbalagem(r), []);
  const antes = pendenciasDeLancamento({
    embalagem: { registros: diasDe('2026-09-02', '2026-09-27'), inicio: '2026-09-01', diasParaFechar: 2 },
  }, { hoje: '2026-09-29' });
  assert.deepEqual(soEmbalagem(antes), ['2026-09-01']);
});

caso('embalagem null (carga falhou) nao acusa nada; os itens de lote continuam', () => {
  const r = pendenciasDeLancamento({ lotes: [{ ...LOTE_BASE, capela_ligada: null }], autoclaves: [{ lote_id: 1, ordem: 1, entrada: 'x', atingiu_121: true, fim_2h: 'x', pressao_na_faixa: true }], embalagem: null }, { hoje: '2026-09-29' });
  assert.deepEqual(r.itens.map((i) => i.tipo), ['CAPELA_NAO_INFORMADA']);
});

caso('embalagem entra ordenada por data com os itens de lote', () => {
  const r = pendenciasDeLancamento({
    lotes: [{ ...LOTE_BASE, id: 30, data_lote: '2026-09-18', capela_ligada: null }],
    autoclaves: [{ lote_id: 30, ordem: 1, entrada: 'x', atingiu_121: true, fim_2h: 'x', pressao_na_faixa: true }],
    embalagem: { registros: diasDe('2026-09-01', '2026-09-27', ['2026-09-15', '2026-09-22']), inicio: '2026-09-01', diasParaFechar: 2 },
  }, { hoje: '2026-09-29' });
  assert.deepEqual(r.itens.map((i) => `${i.tipo}@${i.data_lote}`),
    ['EMBALAGEM_NAO_LANCADA@2026-09-22', 'CAPELA_NAO_INFORMADA@2026-09-18', 'EMBALAGEM_NAO_LANCADA@2026-09-15']);
});

caso('parametro invalido lanca, nunca vira janela vazia calada', () => {
  const registros = diasDe('2026-09-01', '2026-09-27');
  assert.throws(() => pendenciasDeLancamento({ embalagem: { registros, inicio: '2026-09-01', diasParaFechar: undefined } }, { hoje: '2026-09-29' }), /diasParaFechar/);
  assert.throws(() => pendenciasDeLancamento({ embalagem: { registros, inicio: '2026-09-01', diasParaFechar: -1 } }, { hoje: '2026-09-29' }), /diasParaFechar/);
  assert.throws(() => pendenciasDeLancamento({ embalagem: { registros, inicio: null, diasParaFechar: 2 } }, { hoje: '2026-09-29' }), /inicio e hoje/);
  assert.throws(() => pendenciasDeLancamento({ embalagem: { registros, inicio: '2026-09-01', diasParaFechar: 2 } }, {}), /inicio e hoje/);
});

caso('teto: `hoje` em 9999-12-31 devolve no maximo JANELA_MAXIMA_DIAS (60) itens, e os mais recentes', () => {
  const r = pendenciasDeLancamento({ embalagem: { registros: [], inicio: '2026-09-01', diasParaFechar: 2 } }, { hoje: '9999-12-31' });
  assert.equal(JANELA_MAXIMA_DIAS, 60);
  assert.equal(r.total, 60);
  assert.equal(r.itens[0].data_lote, '9999-12-29');
  assert.equal(r.itens.at(-1).data_lote, '9999-10-31');
});

caso('teto: janela menor que 60 dias fica inteira (o corte manda); maior corta no 60o dia', () => {
  const curta = pendenciasDeLancamento({ embalagem: { registros: [], inicio: '2026-09-01', diasParaFechar: 2 } }, { hoje: '2026-09-29' });
  assert.equal(curta.total, 27);
  const longa = pendenciasDeLancamento({ embalagem: { registros: [], inicio: '2026-01-01', diasParaFechar: 2 } }, { hoje: '2026-09-29' });
  assert.equal(longa.total, 60);
  assert.equal(longa.itens.at(-1).data_lote, '2026-07-30');
});

caso('fronteira igual a da conferencia colheita x embalagem, para 0, 0,5, 1, 1,5, 2 e 3 dias', () => {
  const hoje = '2026-09-29';
  const dias = diasDe('2026-09-20', hoje).map((r) => r.data);
  const dados = {
    produtos: [{ id: 1, nome: 'Shiitake Bdj (200gr)', peso_gramas: 200 }],
    lotes: [{ id: 1, tipo: 'SH', data_lote: '2026-06-01' }],
    colheitas: dias.map((d, i) => ({ id: i + 1, lote_id: 1, data_colheita: d, total_kg: 5 })),
    registros: [], desprezos: [],
  };
  for (const dpf of [0, 0.5, 1, 1.5, 2, 3]) {
    const conf = conferenciaColheitaEmbalagem(dados, { inicio: '2026-09-20', fim: hoje, hoje, diasParaFechar: dpf });
    const maisNovaFechada = conf.linhas.filter((l) => l.situacao === 'DIVERGENTE').map((l) => l.data_colheita).sort().at(-1);
    const pend = pendenciasDeLancamento({ embalagem: { registros: [], inicio: '2026-09-20', diasParaFechar: dpf } }, { hoje });
    assert.ok(conf.linhas.some((l) => l.situacao === 'EM_ABERTO') || dpf === 0, `controle: dpf ${dpf} precisa ter dia em aberto`);
    assert.equal(pend.itens[0].data_lote, maisNovaFechada, `dpf ${dpf}`);
  }
});


const LOTE_CONT = { ...LOTE_BASE, id: 40, codigo: 'L-40', data_lote: '2026-08-06', tipo: 'SH', galpao: 'A', estante_maturacao: '12' };
const evento = (extra = {}) => ({
  lote_id: 40, tipo: 'CONTAMINACAO', quantidade: 5, data_evento: '2026-08-13', tipo_contaminado: 'VERDE',
  local_no_bloco: null, estante_registrada: false, importado: false, ...extra,
});
const soContaminado = (r) => r.itens.filter((i) => i.tipo === 'CONTAMINADO_SEM_ESTANTE');
const pendenciasDeEventos = (eventos, lotes = [LOTE_CONT]) => pendenciasDeLancamento({ lotes, eventos }, { hoje: '2026-10-02' });
const pendenciasLimpas = (dados) => pendenciasDeLancamento(dados, { hoje: '2026-10-02' });

caso('o positivo: tres retiradas do mesmo lote viram UMA pendencia, com as tres datas, a frase literal e os campos do lote', () => {
  const r = pendenciasDeEventos([
    evento({ data_evento: '2026-08-22' }), evento({ data_evento: '2026-08-13' }), evento({ data_evento: '2026-08-22' }),
  ]);
  assert.equal(r.total, 1);
  assert.deepEqual(r.por_tipo, { CONTAMINADO_SEM_ESTANTE: 1 });
  assert.deepEqual(r.itens[0], {
    tipo: 'CONTAMINADO_SEM_ESTANTE', lote_id: 40, codigo: 'L-40', data_lote: '2026-08-06',
    galpao: 'A', estante: '12', desde: '2026-08-13', especie: 'SH',
    detalhe: '3 retiradas de contaminação com a estante da retirada não anotada (13/08, 22/08, 22/08).',
    quantidade: '3 retiradas', local: 'A, estante 12',
    frase: 'Lote de 06/08 (SH), estante 12: 3 retiradas de contaminação com a estante da retirada não anotada (13/08, 22/08, 22/08). '
      + 'Confira na plaquinha e corrija em Contaminados, no Editar.',
  });
});

caso('uma retirada so fica no singular', () => {
  const r = pendenciasDeEventos([evento()]);
  assert.equal(soContaminado(r)[0].frase,
    'Lote de 06/08 (SH), estante 12: 1 retirada de contaminação com a estante da retirada não anotada (13/08). Confira na plaquinha e corrija em Contaminados, no Editar.');
});

caso('lote sem estante de maturacao (nulo ou so espacos): a frase nao inventa "estante"', () => {
  for (const estante_maturacao of [null, '  ']) {
    const r = pendenciasDeEventos([evento()], [{ ...LOTE_CONT, estante_maturacao }]);
    assert.equal(soContaminado(r)[0].frase,
      'Lote de 06/08 (SH): 1 retirada de contaminação com a estante da retirada não anotada (13/08). Confira na plaquinha e corrija em Contaminados, no Editar.');
  }
  const r = pendenciasDeEventos([evento()], [{ ...LOTE_CONT, estante_maturacao: ' 12 ' }]);
  assert.match(soContaminado(r)[0].frase, /^Lote de 06\/08 \(SH\), estante 12: /);
});

caso('os negativos, cada um sozinho: importado, com estante, PERDA, e as chaves ausentes ou indefinidas NAO viram pendencia', () => {
  assert.equal(soContaminado(pendenciasDeEventos([evento()])).length, 1);
  assert.equal(soContaminado(pendenciasDeEventos([evento({ importado: true })])).length, 0, 'importado sem estante');
  assert.equal(soContaminado(pendenciasDeEventos([evento({ estante_registrada: true })])).length, 0, 'com estante');
  assert.equal(soContaminado(pendenciasDeEventos([evento({ tipo: 'PERDA' })])).length, 0, 'PERDA sem estante');
  const { estante_registrada: _a, ...semEstanteRegistrada } = evento();
  const { importado: _b, ...semImportado } = evento();
  assert.equal(soContaminado(pendenciasDeEventos([semEstanteRegistrada])).length, 0, 'chave estante_registrada ausente');
  assert.equal(soContaminado(pendenciasDeEventos([semImportado])).length, 0, 'chave importado ausente');
  assert.equal(soContaminado(pendenciasDeEventos([evento({ estante_registrada: undefined })])).length, 0, 'estante_registrada undefined');
  assert.equal(soContaminado(pendenciasDeEventos([evento({ importado: undefined })])).length, 0, 'importado undefined');
});

caso('misturados no mesmo lote: so a retirada sem estante, lancada pela tela e CONTAMINACAO conta (1 de 5)', () => {
  const r = pendenciasDeEventos([
    evento({ data_evento: '2026-08-13' }),
    evento({ importado: true, data_evento: '2026-08-14' }),
    evento({ estante_registrada: true, data_evento: '2026-08-15' }),
    evento({ tipo: 'PERDA', data_evento: '2026-08-16' }),
    evento({ importado: null, data_evento: '2026-08-17' }),
  ]);
  assert.equal(soContaminado(r).length, 1);
  assert.match(soContaminado(r)[0].frase, /: 1 retirada de contaminação com a estante da retirada não anotada \(13\/08\)\./);
});

caso('lotes diferentes viram pendencias diferentes; evento de lote que nao esta em `lotes` e ignorado', () => {
  const outro = { ...LOTE_CONT, id: 41, codigo: 'L-41', data_lote: '2026-07-01', tipo: 'SB', galpao: 'B', estante_maturacao: '7' };
  const r = pendenciasDeEventos([
    evento({ lote_id: 40 }), evento({ lote_id: 41, data_evento: '2026-07-20' }), evento({ lote_id: 999 }),
  ], [LOTE_CONT, outro]);
  assert.deepEqual(soContaminado(r).map((i) => `${i.lote_id}|${i.especie}|${i.desde}`), ['40|SH|2026-08-13', '41|SB|2026-07-20']);
  assert.equal(r.por_tipo.CONTAMINADO_SEM_ESTANTE, 2);
});

caso('sem o corte de data: o lote antigo acusa, e o recente tambem (o pedido e exatamente o passado)', () => {
  const recente = { ...LOTE_CONT, id: 42, data_lote: '2026-09-25' };
  const r = pendenciasDeEventos([evento({ lote_id: 40 }), evento({ lote_id: 42 })], [LOTE_CONT, recente]);
  assert.deepEqual(soContaminado(r).map((i) => i.data_lote), ['2026-09-25', '2026-08-06']);
});

caso('acima do teto, a frase lista as oito primeiras datas e diz "e mais N"; a contagem e a de todas', () => {
  const dez = Array.from({ length: 10 }, (_, i) => evento({ data_evento: `2026-08-${String(10 + i).padStart(2, '0')}` }));
  const frase = soContaminado(pendenciasDeEventos(dez))[0].frase;
  assert.equal(frase, 'Lote de 06/08 (SH), estante 12: 10 retiradas de contaminação com a estante da retirada não anotada '
    + '(10/08, 11/08, 12/08, 13/08, 14/08, 15/08, 16/08, 17/08 e mais 2). Confira na plaquinha e corrija em Contaminados, no Editar.');
  assert.doesNotMatch(soContaminado(pendenciasDeEventos(dez.slice(0, 8)))[0].frase, /e mais/);
});

caso('retirada sem data conta na quantidade, nao entra na lista de datas, e `desde` cai na data do lote', () => {
  const r = pendenciasDeEventos([evento({ data_evento: null })]);
  assert.equal(soContaminado(r)[0].frase,
    'Lote de 06/08 (SH), estante 12: 1 retirada de contaminação com a estante da retirada não anotada. Confira na plaquinha e corrija em Contaminados, no Editar.');
  assert.equal(soContaminado(r)[0].desde, '2026-08-06');
});

caso('sem `eventos` na chamada (a rota antiga, ou o demo): nenhuma pendencia de contaminado, e o resto continua', () => {
  const r = pendenciasDeLancamento({ lotes: [{ ...LOTE_BASE, capela_ligada: null }], autoclaves: [{ lote_id: 1, ordem: 1, entrada: 'x', atingiu_121: true, fim_2h: 'x', pressao_na_faixa: true }] }, { hoje: '2026-10-02' });
  assert.deepEqual(r.itens.map((i) => i.tipo), ['CAPELA_NAO_INFORMADA']);
});

caso('entra ordenada por data_lote com os outros tipos (desc), e o por_tipo conta cada um', () => {
  const r = pendenciasLimpas({
    lotes: [LOTE_CONT, { ...LOTE_BASE, id: 50, data_lote: '2026-09-18', capela_ligada: null }],
    autoclaves: [{ lote_id: 50, ordem: 1, entrada: 'x', atingiu_121: true, fim_2h: 'x', pressao_na_faixa: true }],
    eventos: [evento()],
  });
  assert.deepEqual(r.itens.map((i) => `${i.tipo}@${i.data_lote}`), ['CAPELA_NAO_INFORMADA@2026-09-18', 'CONTAMINADO_SEM_ESTANTE@2026-08-06']);
  assert.deepEqual(r.por_tipo, { CAPELA_NAO_INFORMADA: 1, CONTAMINADO_SEM_ESTANTE: 1 });
});


const SALAS_M1 = [{ galpao_codigo: 'A', nome: 'Maturação 1' }];
const todosOsTipos = (extra = {}) => pendenciasDeLancamento({
  lotes: [{ ...LOTE_BASE, capela_ligada: null, responsavel_semeacao: '', blocos_semeados: 640, blocos_guardados: 637 }],
  transferencias: [{ id: 77, lote_id: 1, data: '2026-09-18', sala_destino: null, estante_origem: '12', estante_destino: '7', quantidade: 40 }],
  divergencias: [{ id: 1, lote_id: 1, codigo: 'L-1', tipo: 'ABERTURA', data: '2026-09-18', esperado: 77, informado: 118, responsavel: 'Bruna' }],
  embalagem: { registros: [], inicio: '2026-09-15', diasParaFechar: 2 },
  eventos: [{ lote_id: 1, tipo: 'CONTAMINACAO', data_evento: '2026-09-18', estante_registrada: false, importado: false }],
  retiradas: {
    alertas: [{ lote_id: 1, galpao: 'A', estante: '10', data_ronda: '2026-09-17', blocos_na_ronda: 60, pct_da_ronda: 0.3, limite: 0.25 }],
    verificados: new Map(), inicio: '2026-09-01',
  },
  salas: SALAS_M1,
  ...extra,
}, { hoje: '2026-09-17' });
const porTipo = (r) => Object.fromEntries(r.itens.map((i) => [i.tipo, i]));

caso('os nove tipos levam especie, detalhe, quantidade e local; a frase de sempre nao muda', () => {
  const r = todosOsTipos();
  const it = porTipo(r);
  assert.deepEqual(Object.keys(it).sort(), [
    'ABERTURA_SEM_SALA', 'AUTOCLAVE_SEM_DADOS', 'CAPELA_NAO_INFORMADA', 'CONTAMINADO_SEM_ESTANTE', 'DIVERGENCIA',
    'EMBALAGEM_NAO_LANCADA', 'GUARDA_INCOMPLETA', 'RETIRADA_ACIMA_DO_LIMITE', 'SEM_RESPONSAVEL',
  ]);
  for (const i of r.itens) assert.equal(i.especie, i.tipo === 'EMBALAGEM_NAO_LANCADA' ? null : 'SH', `${i.tipo}: especie`);
  assert.deepEqual(Object.fromEntries(r.itens.map((i) => [i.tipo, i.detalhe])), {
    AUTOCLAVE_SEM_DADOS: 'faltam os dados da autoclave.', CAPELA_NAO_INFORMADA: 'informe se a capela estava ligada.',
    SEM_RESPONSAVEL: 'informe quem semeou.', GUARDA_INCOMPLETA: '3 blocos semeados ainda sem estante.',
    ABERTURA_SEM_SALA: 'falta a sala (aberto em 18/09).',
    DIVERGENCIA: 'contagem divergente em 18/09 (118 abertos, 77 na estante), quem contou: Bruna.',
    EMBALAGEM_NAO_LANCADA: 'nenhuma embalagem lançada.',
    CONTAMINADO_SEM_ESTANTE: '1 retirada de contaminação com a estante da retirada não anotada (18/09).',
    RETIRADA_ACIMA_DO_LIMITE: 'a retirada de 17/09 levou 30% do que a estante produziu, acima do limite de 25%.',
  });
  assert.equal(it.ABERTURA_SEM_SALA.frase, 'Lote de 17/09 (SH), aberto em 18/09 na estante 7 de frutificação: falta a sala.');
  assert.equal(it.EMBALAGEM_NAO_LANCADA.frase, 'Dados Embalagem: nenhuma embalagem lançada para o dia 15/09.');
  assert.equal(it.RETIRADA_ACIMA_DO_LIMITE.frase,
    'Estante 10 (galpão M1), lote de 17/09 (SH): a retirada de 17/09 levou 30% do que a estante produziu, acima do limite de 25%.');
  assert.deepEqual(Object.fromEntries(r.itens.map((i) => [i.tipo, i.quantidade])), {
    AUTOCLAVE_SEM_DADOS: null, CAPELA_NAO_INFORMADA: null, SEM_RESPONSAVEL: null, GUARDA_INCOMPLETA: '3 blocos',
    ABERTURA_SEM_SALA: '40 blocos', DIVERGENCIA: '41 blocos de diferença', EMBALAGEM_NAO_LANCADA: null,
    CONTAMINADO_SEM_ESTANTE: '1 retirada', RETIRADA_ACIMA_DO_LIMITE: '60 blocos',
  });
  assert.deepEqual(Object.fromEntries(r.itens.map((i) => [i.tipo, i.local])), {
    AUTOCLAVE_SEM_DADOS: 'M1', CAPELA_NAO_INFORMADA: 'M1', SEM_RESPONSAVEL: 'M1',
    GUARDA_INCOMPLETA: 'M1', ABERTURA_SEM_SALA: 'estante 7 de frutificação', DIVERGENCIA: 'M1, estante 12',
    EMBALAGEM_NAO_LANCADA: null, CONTAMINADO_SEM_ESTANTE: 'M1, estante 12', RETIRADA_ACIMA_DO_LIMITE: 'M1, estante 10',
  });
});

caso('sem `salas` o local fica no codigo do galpao; lote sem galpao nem estante fica sem local', () => {
  assert.equal(porTipo(todosOsTipos({ salas: undefined })).GUARDA_INCOMPLETA.local, 'A');
  assert.equal(porTipo(todosOsTipos({ salas: undefined })).DIVERGENCIA.local, 'A, estante 12');
  const semLugar = pendenciasDeLancamento({
    lotes: [{ ...LOTE_BASE, galpao: null, estante_maturacao: '  ', capela_ligada: null }],
  }, { hoje: '2026-09-17' });
  assert.equal(porTipo(semLugar).CAPELA_NAO_INFORMADA.local, null);
});

caso('quantidade sem numero na origem fica null, nunca "NaN" nem "0 blocos"', () => {
  const r = porTipo(todosOsTipos({
    transferencias: [{ id: 78, lote_id: 1, data: '2026-09-18', sala_destino: null, estante_destino: '7', quantidade: null }],
    divergencias: [{ id: 2, lote_id: 1, tipo: 'GUARDA', data: '2026-09-18', esperado: null, informado: 118, responsavel: null }],
    retiradas: {
      alertas: [{ lote_id: 1, galpao: 'A', estante: '10', data_ronda: '2026-09-17', blocos_na_ronda: null, pct_da_ronda: 0.3, limite: 0.25 }],
      verificados: new Map(), inicio: '2026-09-01',
    },
  }));
  assert.equal(r.ABERTURA_SEM_SALA.quantidade, null);
  assert.equal(r.DIVERGENCIA.quantidade, null);
  assert.equal(r.RETIRADA_ACIMA_DO_LIMITE.quantidade, null);
  const menos = porTipo(todosOsTipos({ divergencias: [{ id: 3, lote_id: 1, tipo: 'ABERTURA', data: '2026-09-18', esperado: 77, informado: 70 }] }));
  assert.equal(menos.DIVERGENCIA.quantidade, '7 blocos de diferença');
});
