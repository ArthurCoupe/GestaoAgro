import assert from 'node:assert/strict';
import {
  investigarContaminacao, decimosDaTaxa, BASE_MINIMA, SEM_REGISTRO, MAIS_DE_UMA_SEMENTE, SEM_LOCAL, separarNomes, CHAVES_DE_FILTRO, CORES,
} from '../investigadorContaminacao.js';
import {
  cruzarLotes, sinaisDaBatida, EVENTOS_ATIPICOS, SINAIS_DA_AUTOCLAVE, FORMATO_DA_CHAVE_DO_LOTE, MAX_LOTES_NO_CRUZAMENTO,
} from '../cruzamentoDeLotes.js';
import { PARAMETROS } from '../parametrosDoPainel.js';
import { eventoAtipicoDaLinha, CODIGOS_DE_EVENTO_ATIPICO } from '../eventosAtipicos.js';
import { caso } from './caso.mjs';

const HOJE = '2026-09-28';
const P = { inicio: '2026-07-01', fim: '2026-09-28', hoje: HOJE, parametros: PARAMETROS };
let proximoId = 1;
const linha = (over = {}) => ({
  id: proximoId++, data_lote: '2026-08-01', tipo: 'SH', galpao: 'M3', estante_maturacao: '4', blocos_produzidos: 100,
  blocos_abertos: 0, data_abertura: null, zerou_estante: null, status: 'ATIVO', data_encerramento: null,
  lote_pesquisa: null, nf_semente: 'NF1', responsavel_pesagem: null, responsavel_semeacao: 'Ana',
  responsavel_conferencia: null, ...over,
});
const cont = (lote_id, quantidade, tipo_contaminado = 'VERDE', data_evento = '2026-08-20') => ({
  lote_id, tipo: 'CONTAMINACAO', quantidade, data_evento, tipo_contaminado, local_no_bloco: null,
});
const rodar = (lotes, eventos = [], extra = {}) => investigarContaminacao(
  { lotes, eventos, colheitas: [], autoclaves: extra.autoclaves ?? [] },
  { ...P, filtros: {}, ...extra },
);
const fator = (r, chave) => r.fatores.find((f) => f.chave === chave);
const linhaDe = (r, chave, valor) => fator(r, chave).linhas.find((l) => l.valor === valor);
const lotesEmSerie = (n, { dia0 = 1, mes = '08', produzidos = 100, contaminados = 0, ...over } = {}) => {
  const lotes = [];
  const eventos = [];
  for (let i = 0; i < n; i += 1) {
    const l = linha({ data_lote: `2026-${mes}-${String(dia0 + i).padStart(2, '0')}`, blocos_produzidos: produzidos, ...over });
    lotes.push(l);
    if (contaminados) eventos.push(cont(l.id, contaminados));
  }
  return { lotes, eventos };
};

caso('corte de maturidade padrao e 20 dias, base minima 10, filtros na ordem da spec', () => {
  assert.equal(PARAMETROS.contaminacaoDiasComparavel, 20);
  assert.equal(BASE_MINIMA, 10);
  assert.equal(SEM_REGISTRO, 'Sem registro');
  assert.equal(MAIS_DE_UMA_SEMENTE, 'Mais de uma semente');
  assert.deepEqual(CHAVES_DE_FILTRO, ['galpao', 'estante', 'especie', 'pesagem', 'semeacao', 'conferencia', 'autoclave', 'semente', 'cor', 'lote']);
  assert.deepEqual(CORES, ['VERDE', 'LARANJA', 'PRETA', 'SEM_COR']);
  assert.equal(PARAMETROS.contaminacaoVermelho, 0.2);
});
caso('separarNomes: a mesma regra do SelectPessoa (virgula, espaco, vazio)', () => {
  assert.deepEqual(separarNomes(' Ana ,, Bia '), ['Ana', 'Bia']);
  assert.deepEqual(separarNomes(null), []);
});

caso('lote em maturacao fica fora da taxa e e contado a parte', () => {
  const maduro = linha({ data_lote: '2026-08-01' });
  const novo = linha({ data_lote: '2026-09-20' });
  const r = rodar([maduro, novo], [cont(maduro.id, 10), cont(novo.id, 50)]);
  assert.equal(r.recorte.lotes, 1);
  assert.equal(r.recorte.taxa, 0.1);
  assert.equal(r.recorte.em_maturacao, 1);
  assert.equal(r.lotes.length, 2, 'nenhum lote some da lista');
  assert.deepEqual(r.lotes.map((l) => l.categoria).sort(), ['EM_MATURACAO', 'MADURO']);
});
caso('lote sem numero de blocos vai para "sem numero", nunca taxa zero', () => {
  const semNumero = linha({ blocos_produzidos: 0 });
  const comNumero = linha({ data_lote: '2026-08-02' });
  const r = rodar([semNumero, comNumero], [cont(semNumero.id, 5), cont(comNumero.id, 20)]);
  assert.equal(r.recorte.sem_numero, 1);
  assert.equal(r.recorte.lotes, 1);
  assert.equal(r.recorte.taxa, 0.2);
  assert.equal(r.lotes.find((l) => l.categoria === 'SEM_NUMERO').taxa, null);
});
caso('lote fora do periodo nao entra no recorte nem na referencia', () => {
  const dentro = linha({ data_lote: '2026-08-01' });
  const fora = linha({ data_lote: '2026-06-01' });
  const r = rodar([dentro, fora], [cont(dentro.id, 10), cont(fora.id, 90)]);
  assert.equal(r.recorte.lotes, 1);
  assert.equal(r.referencia.lotes, 1);
  assert.equal(r.referencia.taxa, 0.1);
});
caso('lote de pesquisa fica fora do recorte, da referencia e da lista', () => {
  const normal = linha();
  const pesquisa = linha({ data_lote: '2026-08-02', lote_pesquisa: true });
  const r = rodar([normal, pesquisa], [cont(normal.id, 10), cont(pesquisa.id, 90)]);
  assert.equal(r.recorte.lotes, 1);
  assert.equal(r.referencia.taxa, 0.1);
  assert.equal(r.lotes.length, 1);
  assert.equal(r.onde.pesquisa.contaminados, 90, 'o local conta a pesquisa a parte, como o painel');
});

caso('linha com menos de 10 lotes maduros e base pequena e vai para o fim, mesmo com a maior diferenca', () => {
  const a = lotesEmSerie(10, { dia0: 1, contaminados: 5, responsavel_semeacao: 'Ana' });
  const b = lotesEmSerie(3, { dia0: 11, contaminados: 50, responsavel_semeacao: 'Bia' });
  const r = rodar([...a.lotes, ...b.lotes], [...a.eventos, ...b.eventos]);
  const linhas = fator(r, 'semeacao').linhas;
  assert.deepEqual(linhas.map((l) => [l.valor, l.base_pequena]), [['Ana', false], ['Bia', true]]);
  assert.ok(linhaDe(r, 'semeacao', 'Bia').diferenca_pp > 0, 'Bia tem a maior diferenca e mesmo assim vem por ultimo');
});
caso('10 lotes exatos nao e base pequena (a borda)', () => {
  const a = lotesEmSerie(10, { contaminados: 5 });
  const r = rodar(a.lotes, a.eventos);
  assert.equal(linhaDe(r, 'semeacao', 'Ana').base_pequena, false);
  assert.equal(linhaDe(r, 'semeacao', 'Ana').lotes, 10);
});
caso('"Sem registro" e uma linha como as outras, e a cobertura conta quem tem registro', () => {
  const com = linha({ responsavel_semeacao: 'Ana' });
  const sem = linha({ data_lote: '2026-08-02', responsavel_semeacao: null });
  const r = rodar([com, sem]);
  assert.equal(linhaDe(r, 'semeacao', SEM_REGISTRO).lotes, 1);
  assert.deepEqual(fator(r, 'semeacao').cobertura, { registrados: 1, total: 2 });
  assert.deepEqual(fator(r, 'pesagem').cobertura, { registrados: 0, total: 2 });
});
caso('lote com duas pessoas conta nas duas linhas; a soma e das participacoes (virgula e linhas diferentes)', () => {
  const virgula = linha({ responsavel_semeacao: 'Ana, Bia' });
  const l1 = linha({ data_lote: '2026-08-02', estante_maturacao: '5', responsavel_semeacao: 'Ana' });
  const l2 = linha({ data_lote: '2026-08-02', estante_maturacao: '6', responsavel_semeacao: 'Caio' });
  const so = linha({ data_lote: '2026-08-03', responsavel_semeacao: 'Ana' });
  const r = rodar([virgula, l1, l2, so]);
  assert.equal(r.recorte.lotes, 3);
  assert.equal(linhaDe(r, 'semeacao', 'Ana').lotes, 3);
  assert.equal(linhaDe(r, 'semeacao', 'Bia').lotes, 1);
  assert.equal(linhaDe(r, 'semeacao', 'Caio').lotes, 1);
  const f = fator(r, 'semeacao');
  assert.equal(f.soma_lotes, 5, 'participacoes: 2 + 2 + 1');
  assert.notEqual(f.soma_lotes, r.recorte.lotes, 'controle: o caso tem o lote que faz divergir');
  assert.equal(f.lotes_com_mais_de_um, 2);
  assert.equal(f.um_por_lote, false);
});
caso('especie e semente: um valor por lote, a soma da coluna Lotes e igual ao recorte (com lote imaturo presente)', () => {
  const sh = linha({ tipo: 'SH' });
  const sb = linha({ data_lote: '2026-08-02', tipo: 'SB' });
  const imaturo = linha({ data_lote: '2026-09-25', tipo: 'SB' });
  const r = rodar([sh, sb, imaturo]);
  assert.equal(r.recorte.lotes, 2);
  assert.equal(fator(r, 'especie').soma_lotes, 2, 'se o imaturo contasse, daria 3');
  assert.equal(fator(r, 'semente').soma_lotes, 2);
  assert.equal(fator(r, 'especie').um_por_lote, true);
});
caso('"Mais de uma semente" quando as linhas do lote discordam, sem dividir o lote', () => {
  const l1 = linha({ nf_semente: 'NF1' });
  const l2 = linha({ estante_maturacao: '5', nf_semente: ' NF2 ' });
  const r = rodar([l1, l2]);
  assert.equal(r.recorte.lotes, 1);
  assert.deepEqual(fator(r, 'semente').linhas.map((l) => [l.valor, l.lotes]), [[MAIS_DE_UMA_SEMENTE, 1]]);
});
caso('a diferenca e em p.p. contra a taxa do recorte', () => {
  const a = lotesEmSerie(10, { dia0: 1, contaminados: 10, responsavel_semeacao: 'Ana' });
  const b = lotesEmSerie(10, { dia0: 11, contaminados: 30, responsavel_semeacao: 'Bia' });
  const r = rodar([...a.lotes, ...b.lotes], [...a.eventos, ...b.eventos]);
  assert.equal(r.recorte.taxa, 0.2);
  assert.ok(Math.abs(linhaDe(r, 'semeacao', 'Bia').diferenca_pp - 10) < 1e-9);
  assert.ok(Math.abs(linhaDe(r, 'semeacao', 'Ana').diferenca_pp + 10) < 1e-9);
  assert.equal(fator(r, 'semeacao').linhas[0].valor, 'Bia', 'maior diferenca primeiro');
});

caso('filtro de local escolhe o lote e mantem a taxa do lote inteiro', () => {
  const m3 = linha({ galpao: 'M3', estante_maturacao: '4' });
  const m1 = linha({ galpao: 'M1', estante_maturacao: '9' });
  const outro = linha({ data_lote: '2026-08-02', galpao: 'M2' });
  const r = rodar([m3, m1, outro], [cont(m3.id, 30), cont(outro.id, 50)], { filtros: { galpao: 'M1' } });
  assert.equal(r.recorte.lotes, 1);
  assert.equal(r.recorte.taxa, 0.15, 'taxa do lote inteiro: 30 / 200, e nao 0 (so a linha do M1)');
  assert.equal(r.referencia.lotes, 2, 'a referencia ignora o filtro');
});
caso('filtro de estante casa galpao e estante na MESMA linha', () => {
  const a = linha({ galpao: 'M3', estante_maturacao: '4' });
  const b = linha({ data_lote: '2026-08-02', galpao: 'M1', estante_maturacao: '4' });
  const r = rodar([a, b], [], { filtros: { galpao: 'M3', estante: '4' } });
  assert.deepEqual(r.lotes.map((l) => l.chave), ['2026-08-01|SH']);
});
caso('filtro por "Sem registro", por "Mais de uma semente" e por galpao "—" acham a mesma linha que a tabela mostrou', () => {
  const sem = linha({ responsavel_semeacao: null });
  const mista1 = linha({ data_lote: '2026-08-02', nf_semente: 'NF1' });
  const mista2 = linha({ data_lote: '2026-08-02', estante_maturacao: '5', nf_semente: 'NF 2, cepa X' });
  const semGalpao = linha({ data_lote: '2026-08-03', galpao: null });
  const todos = [sem, mista1, mista2, semGalpao];
  assert.equal(rodar(todos, [], { filtros: { semeacao: SEM_REGISTRO } }).recorte.lotes, 1);
  assert.equal(rodar(todos, [], { filtros: { semente: MAIS_DE_UMA_SEMENTE } }).recorte.lotes, 1);
  assert.equal(rodar(todos, [], { filtros: { galpao: SEM_LOCAL } }).recorte.lotes, 1);
});
caso('filtro de pessoa, especie e lote combinam (E)', () => {
  const a = linha({ tipo: 'SH', responsavel_pesagem: 'Caio' });
  const b = linha({ data_lote: '2026-08-02', tipo: 'SB', responsavel_pesagem: 'Caio' });
  const r = rodar([a, b], [], { filtros: { pesagem: 'Caio', especie: 'SB' } });
  assert.deepEqual(r.lotes.map((l) => l.chave), ['2026-08-02|SB']);
  assert.equal(rodar([a, b], [], { filtros: { lote: '2026-08-01|SH' } }).recorte.lotes, 1);
});
caso('autoclave por pessoa: batidas das linhas do lote, sem repetir; sem batida e "Sem registro"; o filtro acha so os lotes da pessoa', () => {
  const a1 = linha({ data_lote: '2026-08-01' });
  const a2 = linha({ data_lote: '2026-08-01', estante_maturacao: '5' });
  const b = linha({ data_lote: '2026-08-02' });
  const c = linha({ data_lote: '2026-08-03' });
  const d = linha({ data_lote: '2026-08-04' });
  const lotes = [a1, a2, b, c, d];
  const autoclaves = [
    { lote_id: a1.id, ordem: 1, responsavel: 'Fred' },
    { lote_id: a2.id, ordem: 2, responsavel: 'Fred, Gil' },
    { lote_id: b.id, ordem: 1, responsavel: 'Gil' },
    { lote_id: d.id, ordem: 1, responsavel: null },
  ];
  const r = rodar(lotes, [], { autoclaves });
  const f = fator(r, 'autoclave');
  assert.equal(f.titulo, 'Autoclave');
  assert.equal(f.um_por_lote, false);
  assert.deepEqual(f.linhas.map((l) => [l.valor, l.lotes]).sort(), [['Fred', 1], ['Gil', 2], [SEM_REGISTRO, 2]].sort(),
    'Fred em duas linhas do mesmo lote conta 1');
  assert.deepEqual(f.cobertura, { registrados: 2, total: 4 });
  assert.equal(f.lotes_com_mais_de_um, 1);
  const chaves = (filtros) => rodar(lotes, [], { autoclaves, filtros }).lotes.map((l) => l.chave).sort();
  assert.deepEqual(chaves({}), ['2026-08-01|SH', '2026-08-02|SH', '2026-08-03|SH', '2026-08-04|SH'], 'controle: sem filtro, os quatro');
  assert.deepEqual(chaves({ autoclave: 'Fred' }), ['2026-08-01|SH']);
  assert.deepEqual(chaves({ autoclave: 'Gil' }), ['2026-08-01|SH', '2026-08-02|SH']);
  assert.deepEqual(chaves({ autoclave: SEM_REGISTRO }), ['2026-08-03|SH', '2026-08-04|SH']);
  const ev = [cont(a1.id, 10), cont(b.id, 20)];
  assert.equal(rodar(lotes, ev, { autoclaves }).onde.total.contaminados, 30);
  assert.equal(rodar(lotes, ev, { autoclaves, filtros: { autoclave: 'Fred' } }).onde.total.contaminados, 10, 'Onde obedece ao filtro');
});
caso('recorte vazio: zeros, taxa null, tabelas sem linha, nada de NaN', () => {
  const r = rodar([linha()], [], { filtros: { semeacao: 'Ninguem' } });
  assert.deepEqual(r.recorte, {
    lotes: 0, blocos_produzidos: 0, blocos_contaminados: 0, taxa: null, em_maturacao: 0, sem_numero: 0, criticos: 0, contagem_a_conferir: 0, corte_critico: 0.2,
  });
  assert.deepEqual(r.semanas, []);
  assert.deepEqual(r.tempo.total, { retiradas: 0, blocos: 0 });
  assert.ok(r.tempo.faixas.every((f) => f.pct_blocos === null), 'sem retirada nao ha percentual');
  assert.ok(r.fatores.every((f) => f.linhas.length === 0 && f.soma_lotes === 0));
  assert.ok(r.cor.linhas.every((c) => c.blocos === 0 && c.fracao === null));
  assert.equal(JSON.stringify(r).includes('NaN'), false);
});

caso('cor em fracao dos contaminados do recorte; a soma das cores e igual aos contaminados', () => {
  const maduro = linha();
  const imaturo = linha({ data_lote: '2026-09-25' });
  const r = rodar([maduro, imaturo], [cont(maduro.id, 30, 'VERDE'), cont(maduro.id, 10, 'LARANJA'), cont(imaturo.id, 50, 'PRETA')]);
  const por = Object.fromEntries(r.cor.linhas.map((c) => [c.cor, c]));
  assert.equal(r.cor.total, 40);
  assert.equal(por.VERDE.fracao, 0.75);
  assert.equal(por.LARANJA.fracao, 0.25);
  assert.equal(por.PRETA.blocos, 0, 'a PRETA e do lote imaturo, fora do recorte');
  assert.equal(r.cor.linhas.reduce((s, c) => s + c.blocos, 0), r.recorte.blocos_contaminados);
});
caso('onde sem filtro e a mesma conta do painel; com filtro de pessoa, a retirada de outro lote sai', () => {
  const a = linha({ responsavel_semeacao: 'Ana' });
  const b = linha({ data_lote: '2026-08-02', estante_maturacao: '5', responsavel_semeacao: 'Bia' });
  const ev = [cont(a.id, 10), cont(b.id, 20)];
  assert.equal(rodar([a, b], ev).onde.total.contaminados, 30);
  assert.equal(rodar([a, b], ev, { filtros: { semeacao: 'Ana' } }).onde.total.contaminados, 10);
});
caso('ficha: so com filtro de lote; etapas na ordem dela, sem data calculada; retiradas e autoclave do lote', () => {
  const l1 = linha({ responsavel_pesagem: 'Caio', responsavel_semeacao: 'Ana, Bia', responsavel_conferencia: 'Dani' });
  const l2 = linha({ estante_maturacao: '5' });
  const outro = linha({ data_lote: '2026-08-02' });
  const ev = [cont(l1.id, 3, 'VERDE', '2026-08-10'), cont(l2.id, 2, 'LARANJA', '2026-08-05'), cont(outro.id, 9)];
  const autoclaves = [{ lote_id: l1.id, ordem: 1, responsavel: 'Eva', entrada: '07:00', atingiu_121: '08:00', fim_2h: '10:00', houve_queda_121: false, pressao_na_faixa: true }];
  assert.equal(rodar([l1, l2, outro], ev).ficha, null);
  const r = rodar([l1, l2, outro], ev, { filtros: { lote: '2026-08-01|SH' }, autoclaves });
  assert.deepEqual(r.ficha.etapas.map((e) => e.etapa), ['Pesagem', 'Produção', 'Semeação', 'Conferência']);
  assert.deepEqual(r.ficha.etapas.map((e) => e.quando), ['dia anterior à produção', '2026-08-01', 'dia seguinte à produção', null]);
  assert.deepEqual(r.ficha.etapas[0].pessoas, ['Caio']);
  assert.deepEqual(r.ficha.etapas[2].pessoas, ['Ana', 'Bia']);
  assert.deepEqual(r.ficha.retiradas.map((x) => [x.data_evento, x.estante, x.blocos, x.cor]), [['2026-08-05', '5', 2, 'LARANJA'], ['2026-08-10', '4', 3, 'VERDE']]);
  assert.equal(r.ficha.linhas.length, 2);
  assert.equal(r.ficha.autoclave.length, 1);
  assert.equal(r.ficha.autoclave[0].responsavel, 'Eva');
});

caso('o ajuste historico viaja na resposta e nao entra no recorte', () => {
  const r = rodar([], []);
  assert.deepEqual({ ...r.ajuste_historico }, { registros: 164, blocos: 1980, corte: '2026-08-21' });
  assert.equal(r.recorte.blocos_contaminados, 0);
});

const casoDosCards = () => {
  const a = linha({ data_lote: '2026-08-01', blocos_produzidos: 100 });
  const b = linha({ data_lote: '2026-08-02', blocos_produzidos: 200 });
  const imaturo = linha({ data_lote: '2026-09-20', blocos_produzidos: 100 });
  const semNumero = linha({ data_lote: '2026-08-03', blocos_produzidos: 0 });
  return rodar([a, b, imaturo, semNumero], [cont(a.id, 10), cont(b.id, 50), cont(imaturo.id, 40), cont(semNumero.id, 7)]);
};
caso('cards: produzidos, contaminados e taxa so dos maduros; imaturo e sem numero contados a parte', () => {
  const r = casoDosCards();
  assert.equal(r.recorte.lotes, 2);
  assert.equal(r.recorte.blocos_produzidos, 300);
  assert.equal(r.recorte.blocos_contaminados, 60);
  assert.equal(r.recorte.taxa, 0.2);
  assert.equal(r.recorte.em_maturacao, 1);
  assert.equal(r.recorte.sem_numero, 1);
  assert.equal(r.maturidade_dias, 20, 'a tela diz "completou 20 dias" com este numero');
});
caso('a soma dos maduros da tabela de lotes refaz os cards, e o caso tem quem faria divergir', () => {
  const r = casoDosCards();
  const maduros = r.lotes.filter((l) => l.categoria === 'MADURO');
  assert.equal(maduros.reduce((s, l) => s + l.blocos_produzidos, 0), r.recorte.blocos_produzidos);
  assert.equal(maduros.reduce((s, l) => s + l.blocos_contaminados, 0), r.recorte.blocos_contaminados);
  const comNumero = r.lotes.filter((l) => l.blocos_produzidos != null);
  assert.equal(comNumero.reduce((s, l) => s + l.blocos_produzidos, 0), 400, 'controle: com o imaturo a soma seria 400');
  assert.equal(r.lotes.reduce((s, l) => s + l.blocos_contaminados, 0), 107, 'controle: com imaturo e sem numero seriam 107');
  const imaturo = r.lotes.find((l) => l.categoria === 'EM_MATURACAO');
  assert.equal(imaturo.dias, 8);
  assert.equal(imaturo.blocos_contaminados, 40, 'o contaminado ate agora continua na lista');
});
caso('lotes criticos: maduros com taxa a partir do limite vermelho (20%, a borda inclusa); imaturo nunca e critico', () => {
  const noLimite = linha({ data_lote: '2026-08-01', blocos_produzidos: 100 });
  const abaixo = linha({ data_lote: '2026-08-02', blocos_produzidos: 100 });
  const imaturo = linha({ data_lote: '2026-09-20', blocos_produzidos: 100 });
  const r = rodar([noLimite, abaixo, imaturo], [cont(noLimite.id, 20), cont(abaixo.id, 19), cont(imaturo.id, 90)]);
  assert.equal(r.recorte.criticos, 1);
  assert.equal(r.recorte.lotes, 2, 'x de y maduros: 1 de 2');
  const rMetas = rodar([noLimite, abaixo, imaturo], [cont(noLimite.id, 20), cont(abaixo.id, 19), cont(imaturo.id, 90)],
    { parametros: { ...PARAMETROS, contaminacaoVermelho: 0.19 } });
  assert.equal(rMetas.recorte.criticos, 2, 'o limite vem das metas (parametros), nao de uma constante da tela');
  assert.equal(rMetas.recorte.corte_critico, 0.19);
});

caso('lote critico pela taxa que a tela mostra: 399 de 2.000 aparece como 20% e conta; 398 de 2.000 aparece como 19,9% e nao conta', () => {
  const borda = linha({ data_lote: '2026-08-01', blocos_produzidos: 2000 });
  const abaixo = linha({ data_lote: '2026-08-02', blocos_produzidos: 2000 });
  const r = rodar([borda, abaixo], [cont(borda.id, 399), cont(abaixo.id, 398)]);
  assert.equal(r.recorte.criticos, 1, 'so o de 399 (19,95% arredonda para 20%)');
  assert.equal(decimosDaTaxa(2000, 399), 200);
  assert.equal(decimosDaTaxa(2000, 398), 199);
  assert.equal(decimosDaTaxa(0, 5), null);
  assert.ok(399 / 2000 < 0.2);
});
caso('taxa acima de 100% e contagem a conferir: fora dos criticos, contada a parte, e a conta dos cards nao muda', () => {
  const inconsistente = linha({ data_lote: '2026-08-01', blocos_produzidos: 100 });
  const critico = linha({ data_lote: '2026-08-02', blocos_produzidos: 100 });
  const normal = linha({ data_lote: '2026-08-03', blocos_produzidos: 100 });
  const r = rodar([inconsistente, critico, normal], [cont(inconsistente.id, 150), cont(critico.id, 30), cont(normal.id, 5)]);
  assert.equal(r.recorte.contagem_a_conferir, 1);
  assert.equal(r.recorte.criticos, 1, 'o de 150% nao e "critico": e contagem que nao fecha (o controle: o de 30% conta)');
  assert.equal(r.recorte.blocos_contaminados, 185, 'a conta literal nao muda, como no painel');
  assert.equal(r.recorte.taxa, 185 / 300);
  assert.equal(rodar([critico, normal], [cont(critico.id, 30), cont(normal.id, 5)]).recorte.contagem_a_conferir, 0);
});

caso('semanas: ordem decrescente, taxa so dos maduros, semana com lote em maturacao marcada, e a soma refaz os cards', () => {
  const s32 = linha({ data_lote: '2026-08-03', blocos_produzidos: 100 });
  const s33a = linha({ data_lote: '2026-08-10', blocos_produzidos: 100 });
  const s33b = linha({ data_lote: '2026-08-16', blocos_produzidos: 300 });
  const s34 = linha({ data_lote: '2026-08-17', blocos_produzidos: 100 });
  const s38 = linha({ data_lote: '2026-09-20', blocos_produzidos: 100 });
  const s39 = linha({ data_lote: '2026-09-21', blocos_produzidos: 0 });
  const r = rodar([s32, s33a, s33b, s34, s38, s39], [cont(s32.id, 10), cont(s33a.id, 20), cont(s33b.id, 20), cont(s34.id, 30), cont(s38.id, 99)]);
  assert.deepEqual(r.semanas.map((s) => s.semana), ['2026-W39', '2026-W38', '2026-W34', '2026-W33', '2026-W32']);
  const por = Object.fromEntries(r.semanas.map((s) => [s.semana, s]));
  assert.equal(por['2026-W33'].lotes, 2);
  assert.equal(por['2026-W33'].blocos_produzidos, 400);
  assert.equal(por['2026-W33'].blocos_contaminados, 40);
  assert.equal(por['2026-W33'].taxa, 0.1);
  assert.equal(por['2026-W33'].rotulo, '10/08 a 16/08');
  assert.equal(por['2026-W38'].em_maturacao, 1, 'a semana que ainda tem lote em maturacao');
  assert.equal(por['2026-W38'].taxa, null, 'sem maduro na semana: nao ha taxa, e o 99 do imaturo nao entra');
  assert.equal(por['2026-W38'].blocos_contaminados, 0);
  assert.equal(por['2026-W39'].sem_numero, 1);
  assert.equal(por['2026-W32'].em_maturacao, 0);
  assert.equal(r.semanas.reduce((s, x) => s + x.maduros, 0), r.recorte.lotes);
  assert.equal(r.semanas.reduce((s, x) => s + x.blocos_produzidos, 0), r.recorte.blocos_produzidos);
  assert.equal(r.semanas.reduce((s, x) => s + x.blocos_contaminados, 0), r.recorte.blocos_contaminados);
  assert.equal(r.recorte.blocos_contaminados, 80, 'controle: 80 dos maduros; com o imaturo somariam 179');
  assert.equal(r.semanas.reduce((s, x) => s + x.lotes, 0), 6, 'todos os lotes do recorte aparecem em alguma semana');
});
caso('semana parcial: as das pontas que o periodo corta no meio, e so elas; periodo de semanas inteiras nao tem nenhuma', () => {
  const a = linha({ data_lote: '2026-07-02' });
  const b = linha({ data_lote: '2026-08-10' });
  const c = linha({ data_lote: '2026-09-28' });
  const r = rodar([a, b, c]);
  const parcial = Object.fromEntries(r.semanas.map((s) => [s.semana, s.parcial]));
  assert.deepEqual(parcial, { '2026-W40': true, '2026-W33': false, '2026-W27': true });
  const inteiro = rodar([a, b, c], [], { inicio: '2026-06-29', fim: '2026-10-04' });
  assert.deepEqual(inteiro.semanas.map((s) => s.parcial), [false, false, false], 'controle: com o periodo de segunda a domingo nenhuma e parcial');
});
caso('semanas obedecem ao periodo e aos filtros', () => {
  const dentro = linha({ data_lote: '2026-08-03' });
  const fora = linha({ data_lote: '2026-06-01' });
  const outroGalpao = linha({ data_lote: '2026-08-10', galpao: 'M1' });
  assert.deepEqual(rodar([dentro, fora, outroGalpao]).semanas.map((s) => s.semana), ['2026-W33', '2026-W32']);
  assert.deepEqual(rodar([dentro, fora, outroGalpao], [], { filtros: { galpao: 'M1' } }).semanas.map((s) => s.semana), ['2026-W33']);
});

const casoDoTempo = () => {
  const lote = linha({ data_lote: '2026-07-01', blocos_produzidos: 1000 });
  const ev = (q, data) => cont(lote.id, q, 'VERDE', data);
  const eventos = [
    ev(1, '2026-07-01'), ev(2, '2026-07-11'),
    ev(4, '2026-07-12'), ev(8, '2026-07-21'),
    ev(16, '2026-07-22'), ev(32, '2026-07-31'),
    ev(64, '2026-08-01'),
    ev(128, '2026-06-30'),
    ev(256, null),
  ];
  return { lote, eventos };
};
caso('tempo: as bordas 10/11, 20/21 e 30/31 caem na faixa certa, e faixas + sem data valida == total', () => {
  const { lote, eventos } = casoDoTempo();
  const t = rodar([lote], eventos).tempo;
  assert.deepEqual(t.faixas.map((f) => f.rotulo), ['0 a 10 dias', '11 a 15 dias', '16 a 20 dias', '21 a 30 dias', 'acima de 30 dias']);
  assert.deepEqual(t.faixas.map((f) => f.blocos), [3, 4, 8, 48, 64]);
  assert.deepEqual(t.faixas.map((f) => f.retiradas), [2, 1, 1, 2, 1]);
  assert.deepEqual(t.sem_data_valida, { retiradas: 2, blocos: 384, pct_blocos: 384 / 511 });
  assert.deepEqual(t.total, { retiradas: 9, blocos: 511 });
  assert.equal(t.faixas.reduce((s, f) => s + f.blocos, 0) + t.sem_data_valida.blocos, t.total.blocos);
  assert.equal(t.faixas.reduce((s, f) => s + f.retiradas, 0) + t.sem_data_valida.retiradas, t.total.retiradas);
  assert.equal(t.faixas[0].pct_blocos, 3 / 511);
  assert.equal(t.faixas[4].pct_blocos, 64 / 511);
  assert.equal(t.eixo, 'dias entre a data do lote e a data da retirada');
});
caso('tempo: a borda 15/16 (11 a 15 separado de 16 a 20)', () => {
  const lote = linha({ data_lote: '2026-07-01', blocos_produzidos: 1000 });
  const t = rodar([lote], [cont(lote.id, 1, 'VERDE', '2026-07-16'), cont(lote.id, 2, 'VERDE', '2026-07-17')]).tempo;
  assert.deepEqual(t.faixas.map((f) => `${f.rotulo}:${f.blocos}`),
    ['0 a 10 dias:0', '11 a 15 dias:1', '16 a 20 dias:2', '21 a 30 dias:0', 'acima de 30 dias:0']);
});
caso('tempo: o universo e o denominador (lotes e blocos produzidos do recorte, todas as categorias)', () => {
  const { lote, eventos } = casoDoTempo();
  const imaturo = linha({ data_lote: '2026-09-20', blocos_produzidos: 100 });
  const semNumero = linha({ data_lote: '2026-08-03', blocos_produzidos: 0 });
  const r = rodar([lote, imaturo, semNumero], [...eventos, cont(imaturo.id, 5, 'VERDE', '2026-09-23'), cont(semNumero.id, 7, 'VERDE', '2026-08-05')]);
  assert.deepEqual(r.tempo.universo, {
    lotes: 3, blocos_produzidos: 1100, contaminados_maduros: 511, contaminados_fora_da_taxa: 12, em_maturacao: 1, sem_numero: 1,
  });
  assert.equal(r.tempo.total.blocos, 511 + 5 + 7, 'as retiradas do imaturo e do sem numero entram no tempo, ao contrario dos cards');
  assert.equal(r.tempo.universo.contaminados_maduros, r.recorte.blocos_contaminados);
  assert.equal(r.tempo.universo.contaminados_maduros + r.tempo.universo.contaminados_fora_da_taxa, r.tempo.total.blocos);
  assert.notEqual(r.tempo.universo.contaminados_fora_da_taxa, 0, 'controle: o caso tem lote fora da taxa, que e o que faria a soma divergir');
  assert.equal(r.tempo.faixas[0].blocos, 3 + 5 + 7);
  assert.equal(r.recorte.blocos_contaminados, 511, 'controle: os cards continuam so com o maduro');
});
caso('tempo: PERDA, lote fora do periodo e lote fora do filtro ficam de fora (o positivo ao lado)', () => {
  const { lote, eventos } = casoDoTempo();
  const fora = linha({ data_lote: '2026-06-01', blocos_produzidos: 100 });
  const outroGalpao = linha({ data_lote: '2026-07-02', galpao: 'M1', blocos_produzidos: 100 });
  const perda = { lote_id: lote.id, tipo: 'PERDA', quantidade: 1000, data_evento: '2026-07-05', tipo_contaminado: null, local_no_bloco: null };
  const todos = [lote, fora, outroGalpao];
  const ev = [...eventos, perda, cont(fora.id, 500, 'VERDE', '2026-06-05'), cont(outroGalpao.id, 600, 'VERDE', '2026-07-05')];
  assert.equal(rodar(todos, ev).tempo.total.blocos, 511 + 600, 'so a PERDA e o lote de junho ficam fora');
  assert.equal(rodar(todos, ev, { filtros: { galpao: 'M3' } }).tempo.total.blocos, 511, 'o filtro de galpao tira o lote do M1');
});
caso('tempo: as faixas seguem os parametros (cortes das metas), nao 10/15/20/30 fixos', () => {
  const { lote, eventos } = casoDoTempo();
  const t = rodar([lote], eventos, { parametros: { ...PARAMETROS, contaminacaoFaixa1: 5, contaminacaoFaixa2: 12, contaminacaoFaixa3: 25, contaminacaoFaixa4: 30 } }).tempo;
  assert.deepEqual(t.faixas.map((f) => f.rotulo), ['0 a 5 dias', '6 a 12 dias', '13 a 25 dias', '26 a 30 dias', 'acima de 30 dias']);
  assert.deepEqual(t.faixas.map((f) => f.blocos), [1, 2 + 4, 8 + 16, 32, 64]);
});

caso('cor: o lote que teve bloco daquela cor passa, com a taxa do lote inteiro; as outras cores e as sem cor tambem', () => {
  const a = linha({ data_lote: '2026-08-01', blocos_produzidos: 100 });
  const b = linha({ data_lote: '2026-08-02', blocos_produzidos: 100 });
  const c = linha({ data_lote: '2026-08-03', blocos_produzidos: 100 });
  const d = linha({ data_lote: '2026-08-04', blocos_produzidos: 100 });
  const ev = [cont(a.id, 10, 'VERDE'), cont(a.id, 5, 'LARANJA'), cont(b.id, 20, 'LARANJA'), cont(d.id, 3, null)];
  const chaves = (filtros) => rodar([a, b, c, d], ev, { filtros }).lotes.map((l) => l.chave).sort();
  assert.deepEqual(chaves({ cor: 'VERDE' }), ['2026-08-01|SH']);
  assert.deepEqual(chaves({ cor: 'LARANJA' }), ['2026-08-01|SH', '2026-08-02|SH']);
  assert.deepEqual(chaves({ cor: 'SEM_COR' }), ['2026-08-04|SH']);
  assert.deepEqual(chaves({ cor: 'PRETA' }), [], 'negativo: nenhum lote teve preta');
  assert.deepEqual(chaves({ cor: 'AZUL' }), [], 'cor fora do dominio nao casa lote (a rota devolve 400 antes)');
  assert.equal(rodar([a, b, c, d], ev, { filtros: { cor: 'VERDE' } }).recorte.taxa, 0.15, 'taxa do lote inteiro: 15/100, e nao 10/100');
  assert.equal(rodar([a, b, c, d], ev, { filtros: { cor: 'VERDE' } }).semanas.length, 1);
});
caso('cor combina com os outros filtros (E) e o onde acompanha o recorte', () => {
  const a = linha({ data_lote: '2026-08-01', galpao: 'M3' });
  const b = linha({ data_lote: '2026-08-02', galpao: 'M1' });
  const ev = [cont(a.id, 10, 'VERDE'), cont(b.id, 20, 'VERDE')];
  const r = rodar([a, b], ev, { filtros: { cor: 'VERDE', galpao: 'M1' } });
  assert.deepEqual(r.lotes.map((l) => l.chave), ['2026-08-02|SH']);
  assert.equal(r.onde.total.contaminados, 20);
});

caso('constantes literais: formato da chave, teto de 300, eventos atipicos e sinais da autoclave', () => {
  assert.equal(MAX_LOTES_NO_CRUZAMENTO, 300);
  for (const boa of ['2026-08-01|SH', '2026-08-01|null', '2026-12-31|SP']) assert.ok(FORMATO_DA_CHAVE_DO_LOTE.test(boa), boa);
  for (const ruim of ['2026-08-01', '2026-8-1|SH', '2026-08-01|', '2026-08-01|SH|x', ' 2026-08-01|SH', 'x2026-08-01|SH', 'abc', '', '2026-08-01|S H', '2026-08-01|SHSHSHSHSHS']) {
    assert.ok(!FORMATO_DA_CHAVE_DO_LOTE.test(ruim), `deveria recusar "${ruim}"`);
  }
  assert.deepEqual({ ...EVENTOS_ATIPICOS }, {
    COMPOSTO_MUITO_SECO: 'Composto muito seco',
    COMPOSTO_MUITO_MOLHADO: 'Composto muito molhado',
    FALTA_DE_ENERGIA: 'Falta de energia',
    OCORRENCIA_NA_CAPELA: 'Ocorrência na capela',
    OCORRENCIA_NA_SELADORA: 'Ocorrência na seladora',
    OCORRENCIA_NA_AUTOCLAVE: 'Ocorrência na autoclave',
    TEMPERATURA_FORA_DO_PADRAO: 'Temperatura fora do padrão',
    EQUIPAMENTO_ESTRAGADO: 'Equipamento estragado',
    CARACTERISTICA_DA_SEMENTE: 'Característica/observação da semente',
    OUTROS: 'Outros',
  });
  assert.deepEqual({ ...SINAIS_DA_AUTOCLAVE }, {
    QUEDA_DE_121: 'Houve queda abaixo de 121 °C',
    PRESSAO_FORA_DA_FAIXA: 'Pressão fora de 1,1 a 1,3 bar',
    MENOS_DE_2H_A_121: 'Menos de 2 h a 121 °C',
  });
});
caso('a chave que o cruzamento aceita e a que o Investigador entrega (data|tipo, tipo ausente vira "null")', () => {
  const comTipo = linha({ data_lote: '2026-08-01', tipo: 'SB' });
  const semTipo = linha({ data_lote: '2026-08-02', tipo: null });
  const r = rodar([comTipo, semTipo]);
  assert.deepEqual(r.lotes.map((l) => l.chave).sort(), ['2026-08-01|SB', '2026-08-02|null']);
  for (const l of r.lotes) assert.ok(FORMATO_DA_CHAVE_DO_LOTE.test(l.chave), l.chave);
});

const cruzar = (lotes, chaves, { eventos = [], autoclaves = [], eventos_atipicos, ...opcoes } = {}) => cruzarLotes(
  { lotes, eventos, colheitas: [], autoclaves, eventos_atipicos },
  { ...P, chaves, ...opcoes },
);
const dimDe = (r, chave) => r.dimensoes.find((d) => d.chave === chave);
const valorDe = (r, chave, valor) => dimDe(r, chave).valores.find((v) => v.valor === valor);
const coincDe = (r, dimensao, valor) => r.coincidencias.find((c) => c.dimensao === dimensao && c.valor === valor);
const par = (p) => ({ k: p.k, n: p.n });
const perto = (a, b) => Math.abs(a - b) < 1e-9;
const chavesDoDia = (mes, de, ate) => Array.from({ length: ate - de + 1 }, (_, i) => `2026-${mes}-${String(de + i).padStart(2, '0')}|SH`);

const casoCP050 = () => {
  const lotes = [];
  for (let i = 0; i < 20; i += 1) {
    const data = `2026-07-${String(i + 1).padStart(2, '0')}`;
    const nf = i === 4 || i === 19 ? 'OUTRA' : 'CP050';
    lotes.push(linha({ data_lote: data, nf_semente: nf }));
    if (i < 3) lotes.push(linha({ data_lote: data, nf_semente: 'RARA' }));
  }
  return { lotes, chaves: chavesDoDia('07', 1, 5) };
};
caso('CP050: coincidencia alta com base alta (-10 p.p.) e a rara (+45 p.p.), k e n em lotes, base.k >= selecionados.k', () => {
  const { lotes, chaves } = casoCP050();
  const r = cruzar(lotes, chaves);
  assert.equal(r.base_n, 20);
  assert.equal(r.selecionados, 5);
  assert.deepEqual(r.nao_encontrados, []);
  const ff = valorDe(r, 'semente', 'CP050');
  assert.deepEqual([par(ff.selecionados), par(ff.base)], [{ k: 4, n: 5 }, { k: 18, n: 20 }]);
  assert.ok(perto(ff.diferenca_pp, -10), `CP050 diferenca ${ff.diferenca_pp}`);
  const rara = valorDe(r, 'semente', 'RARA');
  assert.deepEqual([par(rara.selecionados), par(rara.base)], [{ k: 3, n: 5 }, { k: 3, n: 20 }]);
  assert.ok(perto(rara.diferenca_pp, 45), `RARA diferenca ${rara.diferenca_pp}`);
  const outra = valorDe(r, 'semente', 'OUTRA');
  assert.deepEqual([par(outra.selecionados), par(outra.base)], [{ k: 1, n: 5 }, { k: 2, n: 20 }]);
  assert.deepEqual(dimDe(r, 'semente').valores.map((v) => v.valor), ['CP050', 'RARA', 'OUTRA'], 'ordem: k decrescente');
  assert.equal(ff.base_pequena, false, 'CP050 esta em 18 lotes do periodo: nao e pequena');
  assert.equal(rara.base_pequena, true, 'a RARA esta em 3 lotes do periodo: base pequena POR VALOR, mesmo com a base inteira de 20');
  assert.equal(outra.base_pequena, true);
  for (const d of r.dimensoes) for (const v of d.valores) assert.ok(v.base.k >= v.selecionados.k, `${d.chave}/${v.valor}: a base contem os selecionados`);
});
caso('CP050: so entra em "coincidencias" valor com 2 ou mais lotes, ordenado por k; a OUTRA (1 lote) fica de fora', () => {
  const { lotes, chaves } = casoCP050();
  const r = cruzar(lotes, chaves);
  const ff = coincDe(r, 'semente', 'CP050');
  const rara = coincDe(r, 'semente', 'RARA');
  assert.ok(ff && rara, 'as duas coincidencias aparecem');
  assert.equal(ff.titulo, 'Semente');
  assert.deepEqual(par(ff.selecionados), { k: 4, n: 5 });
  assert.equal(coincDe(r, 'semente', 'OUTRA'), undefined, 'k = 1 nao e coincidencia');
  assert.ok(r.coincidencias.indexOf(ff) < r.coincidencias.indexOf(rara), 'k 4 antes de k 3');
  for (let i = 1; i < r.coincidencias.length; i += 1) {
    assert.ok(r.coincidencias[i - 1].selecionados.k >= r.coincidencias[i].selecionados.k, 'k nunca cresce ao descer');
  }
  assert.ok(r.coincidencias.every((c) => c.selecionados.k >= 2));
  assert.deepEqual(par(coincDe(r, 'especie', 'SH').selecionados), { k: 5, n: 5 });
  assert.equal(coincDe(r, 'galpao', 'M3').diferenca_pp, 0);
});
caso('desempate: com o mesmo k, a maior diferenca contra a base vem primeiro (nao a ordem alfabetica)', () => {
  const sel = [1, 2].map((d) => linha({ data_lote: `2026-08-0${d}`, responsavel_semeacao: 'Ana, Bia' }));
  const resto = Array.from({ length: 8 }, (_, i) => linha({ data_lote: `2026-08-${String(10 + i).padStart(2, '0')}`, responsavel_semeacao: i < 6 ? 'Ana' : 'Cris' }));
  const r = cruzar([...sel, ...resto], ['2026-08-01|SH', '2026-08-02|SH']);
  assert.deepEqual(dimDe(r, 'pessoa_semeacao').valores.map((v) => v.valor), ['Bia', 'Ana']);
  assert.deepEqual(r.coincidencias.filter((c) => c.dimensao === 'pessoa_semeacao').map((c) => c.valor), ['Bia', 'Ana']);
  assert.ok(perto(valorDe(r, 'pessoa_semeacao', 'Bia').diferenca_pp, 80));
  assert.ok(perto(valorDe(r, 'pessoa_semeacao', 'Ana').diferenca_pp, 20));
});
caso('um lote so: nao ha coincidencia (nao ha "em comum"), mas as dimensoes vem; zero lotes: tudo vazio e sem NaN', () => {
  const { lotes } = casoCP050();
  const um = cruzar(lotes, ['2026-07-01|SH']);
  assert.deepEqual(um.coincidencias, []);
  assert.deepEqual(par(valorDe(um, 'semente', 'CP050').selecionados), { k: 1, n: 1 });
  const zero = cruzar(lotes, []);
  assert.equal(zero.selecionados, 0);
  assert.equal(zero.base_n, 20);
  assert.deepEqual(zero.coincidencias, []);
  assert.deepEqual(zero.lotes, []);
  assert.equal(dimDe(zero, 'semente').valores.length, 0);
  assert.deepEqual(par(dimDe(zero, 'semente').sem_registro), { k: 0, n: 0 });
  assert.doesNotMatch(JSON.stringify(zero), /NaN|Infinity/);
});
caso('base pequena: base de 9 lotes marca "base_pequena", de 10 nao (a borda), e a base_minima viaja', () => {
  const nove = Array.from({ length: 9 }, (_, i) => linha({ data_lote: `2026-08-0${i + 1}` }));
  const dez = [...nove, linha({ data_lote: '2026-08-10' })];
  const a = cruzar(nove, ['2026-08-01|SH', '2026-08-02|SH']);
  const b = cruzar(dez, ['2026-08-01|SH', '2026-08-02|SH']);
  assert.equal(a.base_n, 9);
  assert.equal(valorDe(a, 'semente', 'NF1').base_pequena, true);
  assert.equal(b.base_n, 10);
  assert.equal(valorDe(b, 'semente', 'NF1').base_pequena, false);
  assert.equal(a.base_minima, 10);
});
caso('base pequena POR VALOR: o valor em 9 lotes do periodo marca, em 10 nao (a borda), com a base inteira grande', () => {
  const montar = (comPouca) => {
    const lotes = [];
    for (let i = 0; i < 12; i += 1) {
      const data = `2026-08-${String(i + 1).padStart(2, '0')}`;
      lotes.push(linha({ data_lote: data, nf_semente: 'COMUM' }));
      if (i < comPouca) lotes.push(linha({ data_lote: data, nf_semente: 'POUCA' }));
    }
    return lotes;
  };
  const chaves = chavesDoDia('08', 1, 2);
  const nove = cruzar(montar(9), chaves);
  const dez = cruzar(montar(10), chaves);
  assert.equal(nove.base_n, 12, 'a base inteira passa de 10: o que marca e o valor, nao a base');
  assert.deepEqual(par(valorDe(nove, 'semente', 'POUCA').base), { k: 9, n: 12 });
  assert.equal(valorDe(nove, 'semente', 'POUCA').base_pequena, true);
  assert.deepEqual(par(valorDe(dez, 'semente', 'POUCA').base), { k: 10, n: 12 });
  assert.equal(valorDe(dez, 'semente', 'POUCA').base_pequena, false, 'a borda: 10 lotes nao e pequena');
  assert.equal(valorDe(nove, 'semente', 'COMUM').base_pequena, false, 'controle: o valor que esta nos 12 lotes nao marca');
  assert.equal(coincDe(nove, 'semente', 'POUCA').base_pequena, true, 'a coincidencia leva o mesmo marcador');
  assert.equal(coincDe(dez, 'semente', 'POUCA').base_pequena, false);
});
caso('o resultado nunca afirma causa: nem nas chaves, nem nos rotulos, nem nos titulos', () => {
  const { lotes, chaves } = casoCP050();
  assert.doesNotMatch(JSON.stringify(cruzar(lotes, chaves)), /causa|culpa/i);
});

caso('chave de outro periodo, de pesquisa e inexistente vao para nao_encontrados; repetida conta uma vez', () => {
  const dentro = linha({ data_lote: '2026-08-01' });
  const dentro2 = linha({ data_lote: '2026-08-02' });
  const fora = linha({ data_lote: '2026-06-01' });
  const pesquisa = linha({ data_lote: '2026-08-03', lote_pesquisa: true });
  const r = cruzar([dentro, dentro2, fora, pesquisa],
    ['2026-08-01|SH', '2026-08-01|SH', '2026-06-01|SH', '2026-08-03|SH', '2099-01-01|SH', '2026-08-02|SH']);
  assert.equal(r.selecionados, 2, 'a repetida conta uma vez');
  assert.deepEqual(r.lotes.map((l) => l.chave), ['2026-08-01|SH', '2026-08-02|SH'], 'na ordem em que foram pedidas');
  assert.deepEqual(r.nao_encontrados, ['2026-06-01|SH', '2026-08-03|SH', '2099-01-01|SH']);
  assert.equal(r.base_n, 2, 'a pesquisa e o lote de junho ficam fora da base');
});
caso('a base e todo lote logico do periodo, de qualquer categoria, sem os filtros da tela', () => {
  const maduro = linha({ data_lote: '2026-08-01' });
  const imaturo = linha({ data_lote: '2026-09-20' });
  const semNumero = linha({ data_lote: '2026-08-03', blocos_produzidos: 0 });
  const outroGalpao = linha({ data_lote: '2026-08-04', galpao: 'M1' });
  const duasLinhas = [linha({ data_lote: '2026-08-05' }), linha({ data_lote: '2026-08-05', estante_maturacao: '9' })];
  const r = cruzar([maduro, imaturo, semNumero, outroGalpao, ...duasLinhas], ['2026-08-01|SH', '2026-09-20|SH', '2026-08-03|SH']);
  assert.equal(r.base_n, 5, 'lote de duas linhas e um lote so');
  assert.equal(r.selecionados, 3);
  assert.deepEqual(r.lotes.map((l) => l.categoria), ['MADURO', 'EM_MATURACAO', 'SEM_NUMERO']);
  assert.deepEqual(par(valorDe(r, 'galpao', 'M3').base), { k: 4, n: 5 }, 'o filtro de galpao da tela nao encolhe a base');
});
caso('lote sem tipo tem a chave "data|null" e e encontrado por ela', () => {
  const semTipo = linha({ data_lote: '2026-08-01', tipo: null });
  const r = cruzar([semTipo, linha({ data_lote: '2026-08-02' })], ['2026-08-01|null']);
  assert.equal(r.selecionados, 1);
  assert.deepEqual(r.nao_encontrados, []);
  assert.deepEqual(dimDe(r, 'especie').valores, []);
  assert.deepEqual(par(dimDe(r, 'especie').sem_registro), { k: 1, n: 1 });
});

caso('"sem registro" fica a parte (nunca vira valor) e o n e o de lotes, nao o de quem tem registro', () => {
  const a = linha({ data_lote: '2026-08-01', nf_semente: 'S1' });
  const b = linha({ data_lote: '2026-08-02', nf_semente: 'S1' });
  const c = linha({ data_lote: '2026-08-03', nf_semente: null });
  const d = linha({ data_lote: '2026-08-04', nf_semente: null });
  const r = cruzar([a, b, c, d], ['2026-08-01|SH', '2026-08-02|SH', '2026-08-03|SH']);
  const dim = dimDe(r, 'semente');
  assert.deepEqual(dim.valores.map((v) => v.valor), ['S1']);
  assert.deepEqual([par(dim.valores[0].selecionados), par(dim.valores[0].base)], [{ k: 2, n: 3 }, { k: 2, n: 4 }]);
  assert.deepEqual({ ...dim.sem_registro, base: par(dim.sem_registro.base) }, { k: 1, n: 3, base: { k: 2, n: 4 }, rotulo: 'Sem registro' });
  assert.ok(!r.coincidencias.some((x) => x.dimensao === 'semente' && x.valor === 'Sem registro'));
});
caso('pessoas por etapa: virgula separa, lote conta uma vez por pessoa, cada etapa e a sua, autoclave pelas batidas', () => {
  const p1 = linha({ data_lote: '2026-08-01', responsavel_semeacao: 'Ana, Bia', responsavel_pesagem: null, responsavel_selagem: 'Cris' });
  const p2 = linha({ data_lote: '2026-08-02', responsavel_semeacao: 'Bia', responsavel_pesagem: null, responsavel_selagem: null });
  const r = cruzar([p1, p2], ['2026-08-01|SH', '2026-08-02|SH'], { autoclaves: [{ lote_id: p1.id, ordem: 1, responsavel: 'Dani' }] });
  assert.deepEqual(dimDe(r, 'pessoa_semeacao').valores.map((v) => [v.valor, v.selecionados.k]), [['Bia', 2], ['Ana', 1]]);
  assert.ok(coincDe(r, 'pessoa_semeacao', 'Bia') && !coincDe(r, 'pessoa_semeacao', 'Ana'));
  assert.deepEqual(dimDe(r, 'pessoa_pesagem').valores, []);
  assert.deepEqual(par(dimDe(r, 'pessoa_pesagem').sem_registro), { k: 2, n: 2 });
  assert.deepEqual(dimDe(r, 'pessoa_selagem').valores.map((v) => [v.valor, v.selecionados.k]), [['Cris', 1]]);
  assert.deepEqual(par(dimDe(r, 'pessoa_selagem').sem_registro), { k: 1, n: 2 });
  assert.deepEqual(dimDe(r, 'pessoa_autoclave').valores.map((v) => [v.valor, v.selecionados.k]), [['Dani', 1]]);
  assert.deepEqual(par(dimDe(r, 'pessoa_autoclave').sem_registro), { k: 1, n: 2 });
  assert.deepEqual(r.lotes[0].pessoas, { pesagem: [], semeacao: ['Ana', 'Bia'], conferencia: [], selagem: ['Cris'], autoclave: ['Dani'] });
});
caso('galpao e estante: o lote com duas linhas conta nos dois galpoes; estante e o par galpao e estante; sem estante vai a parte', () => {
  const g1 = linha({ data_lote: '2026-08-01', galpao: 'M3', estante_maturacao: '4' });
  const g2 = linha({ data_lote: '2026-08-01', galpao: 'M1', estante_maturacao: '2' });
  const g3 = linha({ data_lote: '2026-08-02', galpao: 'M3', estante_maturacao: '4' });
  const g4 = linha({ data_lote: '2026-08-03', galpao: 'M3', estante_maturacao: null });
  const r = cruzar([g1, g2, g3, g4], ['2026-08-01|SH', '2026-08-02|SH', '2026-08-03|SH']);
  assert.deepEqual(dimDe(r, 'galpao').valores.map((v) => [v.valor, v.selecionados.k]), [['M3', 3], ['M1', 1]]);
  assert.deepEqual(dimDe(r, 'estante').valores.map((v) => [v.valor, v.selecionados.k]), [['M3 · 4', 2], ['M1 · 2', 1]]);
  assert.deepEqual(par(dimDe(r, 'estante').sem_registro), { k: 1, n: 3 });
  assert.deepEqual(r.lotes[0].estantes.map((e) => [e.galpao, e.estante]), [['M3', '4'], ['M1', '2']]);
});
caso('estante fisica: vem do mapa que a rota passa, por linha, e e null quando o mapa nao tem', () => {
  const a = linha({ data_lote: '2026-08-01' });
  const b = linha({ data_lote: '2026-08-01', estante_maturacao: '9' });
  const r = cruzar([a, b], ['2026-08-01|SH'], { fisicaPorLote: new Map([[a.id, 'E-12']]) });
  assert.deepEqual(r.lotes[0].estantes.map((e) => e.estante_fisica), ['E-12', null]);
  assert.deepEqual(cruzar([a, b], ['2026-08-01|SH']).lotes[0].estantes.map((e) => e.estante_fisica), [null, null]);
});
caso('cor: os lotes que tiveram bloco daquela cor; quem nao teve contaminacao fica em "sem blocos contaminados"', () => {
  const a = linha({ data_lote: '2026-08-01' });
  const b = linha({ data_lote: '2026-08-02' });
  const c = linha({ data_lote: '2026-08-03' });
  const ev = [cont(a.id, 5, 'VERDE'), cont(a.id, 3, 'LARANJA'), cont(b.id, 2, 'VERDE'), cont(b.id, 1, null)];
  const r = cruzar([a, b, c], ['2026-08-01|SH', '2026-08-02|SH', '2026-08-03|SH'], { eventos: ev });
  const dim = dimDe(r, 'cor');
  assert.deepEqual(dim.valores.map((v) => [v.valor, v.rotulo, v.selecionados.k]), [['VERDE', 'Verde', 2], ['LARANJA', 'Laranja', 1], ['SEM_COR', 'Sem cor', 1]]);
  assert.deepEqual({ k: dim.sem_registro.k, n: dim.sem_registro.n, rotulo: dim.sem_registro.rotulo }, { k: 1, n: 3, rotulo: 'Sem blocos contaminados' });
  assert.deepEqual(r.lotes.map((l) => l.cores.VERDE), [5, 2, 0]);
});

caso('capela: vale a 1a linha do lote (menor id), mesmo com o array fora de ordem; nula na 1a e "sem registro"', () => {
  const a1 = linha({ data_lote: '2026-08-01', capela_ligada: true });
  const a2 = linha({ data_lote: '2026-08-01', capela_ligada: false });
  const b1 = linha({ data_lote: '2026-08-02', capela_ligada: null });
  const b2 = linha({ data_lote: '2026-08-02', capela_ligada: true });
  const c1 = linha({ data_lote: '2026-08-03', capela_ligada: false });
  const r = cruzar([a2, b2, a1, b1, c1], ['2026-08-01|SH', '2026-08-02|SH', '2026-08-03|SH']);
  assert.deepEqual(dimDe(r, 'capela').valores.map((v) => [v.valor, v.selecionados.k]), [['Não', 1], ['Sim', 1]]);
  assert.deepEqual(par(dimDe(r, 'capela').sem_registro), { k: 1, n: 3 });
  assert.deepEqual(r.lotes.map((l) => l.capela_ligada), [true, null, false]);
});
caso('sinais da autoclave: as bordas de 119, 120 e 121 minutos, e cada resposta ruim so quando e ruim', () => {
  const t0 = '2026-08-02T10:00:00Z';
  const mais = (min) => new Date(Date.parse(t0) + min * 60000).toISOString();
  assert.deepEqual(sinaisDaBatida({ atingiu_121: t0, fim_2h: mais(119) }), ['Menos de 2 h a 121 °C']);
  assert.deepEqual(sinaisDaBatida({ atingiu_121: t0, fim_2h: mais(120) }), []);
  assert.deepEqual(sinaisDaBatida({ atingiu_121: t0, fim_2h: mais(121) }), []);
  assert.deepEqual(sinaisDaBatida({ atingiu_121: t0, fim_2h: mais(-5) }), [], 'fim antes do inicio e erro de digitacao, nao sinal');
  assert.deepEqual(sinaisDaBatida({ atingiu_121: 'lixo', fim_2h: mais(10) }), [], 'data que nao le nao gera sinal');
  assert.deepEqual(sinaisDaBatida({ atingiu_121: t0, fim_2h: null }), []);
  assert.deepEqual(sinaisDaBatida({ houve_queda_121: true }), ['Houve queda abaixo de 121 °C']);
  for (const nao of [false, null, undefined]) assert.deepEqual(sinaisDaBatida({ houve_queda_121: nao }), [], `queda ${nao}`);
  assert.deepEqual(sinaisDaBatida({ pressao_na_faixa: false }), ['Pressão fora de 1,1 a 1,3 bar']);
  for (const nao of [true, null, undefined]) assert.deepEqual(sinaisDaBatida({ pressao_na_faixa: nao }), [], `pressao ${nao}`);
  assert.deepEqual(
    sinaisDaBatida({ atingiu_121: t0, fim_2h: mais(60), pressao_na_faixa: false, houve_queda_121: true }),
    ['Houve queda abaixo de 121 °C', 'Pressão fora de 1,1 a 1,3 bar', 'Menos de 2 h a 121 °C'], 'ordem fixa',
  );
});
caso('autoclave no cruzamento: batida limpa tem registro e nenhum sinal; so quem nao tem batida e "sem batida registrada"', () => {
  const a = linha({ data_lote: '2026-08-01' });
  const b = linha({ data_lote: '2026-08-02' });
  const c = linha({ data_lote: '2026-08-03' });
  const autoclaves = [
    { lote_id: a.id, ordem: 1, houve_queda_121: true, pressao_na_faixa: true },
    { lote_id: a.id, ordem: 2, houve_queda_121: true },
    { lote_id: b.id, ordem: 1, houve_queda_121: false, pressao_na_faixa: true },
  ];
  const r = cruzar([a, b, c], ['2026-08-01|SH', '2026-08-02|SH', '2026-08-03|SH'], { autoclaves });
  const dim = dimDe(r, 'autoclave');
  assert.deepEqual(dim.valores.map((v) => [v.valor, v.selecionados.k]), [['Houve queda abaixo de 121 °C', 1]]);
  assert.deepEqual({ k: dim.sem_registro.k, n: dim.sem_registro.n, rotulo: dim.sem_registro.rotulo }, { k: 1, n: 3, rotulo: 'Sem batida registrada' });
  assert.equal(r.lotes[0].autoclave.length, 2);
  assert.deepEqual(r.lotes[0].autoclave[0].sinais, ['Houve queda abaixo de 121 °C']);
  assert.deepEqual(r.lotes[1].autoclave[0].sinais, [], 'a batida limpa aparece, sem sinais');
  assert.deepEqual(r.lotes[2].autoclave, []);
});

caso('eventos atipicos: null ou ausente = indisponivel (nunca "sem evento"); [] = disponivel e todo lote sem evento', () => {
  const lotes = [linha({ data_lote: '2026-08-01' }), linha({ data_lote: '2026-08-02' })];
  const chaves = ['2026-08-01|SH', '2026-08-02|SH'];
  for (const indisponivel of [undefined, null]) {
    const d = dimDe(cruzar(lotes, chaves, { eventos_atipicos: indisponivel }), 'eventos_atipicos');
    assert.deepEqual({ ...d }, { chave: 'eventos_atipicos', titulo: 'Eventos e condições atípicas', grupo: 'Processo', disponivel: false, valores: [], sem_registro: null });
  }
  const vazio = dimDe(cruzar(lotes, chaves, { eventos_atipicos: [] }), 'eventos_atipicos');
  assert.equal(vazio.disponivel, true);
  assert.deepEqual(vazio.valores, []);
  assert.deepEqual({ k: vazio.sem_registro.k, n: vazio.sem_registro.n, base: par(vazio.sem_registro.base), rotulo: vazio.sem_registro.rotulo },
    { k: 2, n: 2, base: { k: 2, n: 2 }, rotulo: 'Sem evento registrado' });
});
caso('eventos atipicos: conta lotes (nao eventos), acha o evento da 2a linha do lote, rotulo do cadastro e codigo novo vira o proprio codigo', () => {
  const l1a = linha({ data_lote: '2026-08-01' });
  const l1b = linha({ data_lote: '2026-08-01', estante_maturacao: '5' });
  const l2 = linha({ data_lote: '2026-08-02' });
  const l3 = linha({ data_lote: '2026-08-03' });
  const ev = (lote_id, tipo) => ({ id: proximoId++, lote_id, tipo, descricao: null, observacao: null, hora_inicio: null, hora_retorno: null, created_at: null });
  const eventos_atipicos = [
    ev(l1b.id, 'FALTA_DE_ENERGIA'), ev(l1b.id, 'FALTA_DE_ENERGIA'),
    ev(l1a.id, 'OUTROS'), ev(l2.id, 'FALTA_DE_ENERGIA'), ev(l3.id, 'CODIGO_NOVO'),
  ];
  const r = cruzar([l1a, l1b, l2, l3], ['2026-08-01|SH', '2026-08-02|SH', '2026-08-03|SH'], { eventos_atipicos });
  const dim = dimDe(r, 'eventos_atipicos');
  assert.equal(dim.disponivel, true);
  assert.deepEqual(dim.valores.map((v) => [v.valor, v.rotulo, v.selecionados.k]), [
    ['FALTA_DE_ENERGIA', 'Falta de energia', 2], ['CODIGO_NOVO', 'CODIGO_NOVO', 1], ['OUTROS', 'Outros', 1],
  ]);
  assert.deepEqual(par(dim.sem_registro), { k: 0, n: 3 });
  assert.ok(coincDe(r, 'eventos_atipicos', 'FALTA_DE_ENERGIA'), 'dois lotes com o mesmo evento: e coincidencia');
  assert.equal(r.lotes[0].eventos_atipicos.length, 3, 'a ficha do lote lista os 3 registros, com o rotulo');
  assert.deepEqual(r.lotes[0].eventos_atipicos.map((e) => e.rotulo), ['Outros', 'Falta de energia', 'Falta de energia']);
  const so1 = cruzar([l1a, l1b, l2, l3], ['2026-08-01|SH'], { eventos_atipicos });
  assert.deepEqual([par(valorDe(so1, 'eventos_atipicos', 'FALTA_DE_ENERGIA').selecionados), par(valorDe(so1, 'eventos_atipicos', 'FALTA_DE_ENERGIA').base)],
    [{ k: 1, n: 1 }, { k: 2, n: 3 }]);
});

caso('cruzamento: o evento chega na forma que carregarJornada entrega (eventoAtipicoDaLinha sobre a linha do banco)', () => {
  const l1 = linha({ data_lote: '2026-08-01' });
  const l2 = linha({ data_lote: '2026-08-02' });
  const doBanco = { id: 901, lote_id: l1.id, tipo: 'FALTA_DE_ENERGIA', descricao: null, observacao: 'caiu a luz',
    hora_inicio: '08:30:00', hora_retorno: null, created_at: '2026-10-02T18:30:00+00:00' };
  const r = cruzar([l1, l2], ['2026-08-01|SH', '2026-08-02|SH'], { eventos_atipicos: [eventoAtipicoDaLinha(doBanco)] });
  assert.deepEqual(valorDe(r, 'eventos_atipicos', 'FALTA_DE_ENERGIA').selecionados.k, 1);
  assert.deepEqual(r.lotes[0].eventos_atipicos, [{ id: 901, tipo: 'FALTA_DE_ENERGIA', rotulo: 'Falta de energia',
    descricao: null, observacao: 'caiu a luz', hora_inicio: '08:30', hora_retorno: null }]);
  assert.deepEqual(r.lotes[1].eventos_atipicos, []);
  for (const c of CODIGOS_DE_EVENTO_ATIPICO) assert.notEqual(EVENTOS_ATIPICOS[c], undefined, c);
});

const casoDoCruzamentoNoTempo = () => {
  const l1a = linha({ data_lote: '2026-08-01' });
  const l1b = linha({ data_lote: '2026-08-01', estante_maturacao: '5' });
  const l2 = linha({ data_lote: '2026-08-02' });
  const l3 = linha({ data_lote: '2026-08-03' });
  const l4 = linha({ data_lote: '2026-08-04' });
  const l5 = linha({ data_lote: '2026-08-05' });
  const eventos = [
    cont(l1a.id, 30, 'VERDE', '2026-08-13'), cont(l1b.id, 10, 'VERDE', '2026-08-06'), cont(l1b.id, 25, 'VERDE', '2026-08-15'),
    cont(l2.id, 40, 'VERDE', '2026-08-05'), cont(l2.id, 5, 'VERDE', '2026-08-20'),
    cont(l3.id, 20, 'VERDE', '2026-08-15'), cont(l3.id, 20, 'VERDE', '2026-08-28'),
    cont(l5.id, 50, 'VERDE', '2026-09-14'), cont(l5.id, 7, 'VERDE', '2026-07-30'),
    { lote_id: l5.id, tipo: 'PERDA', quantidade: 100, data_evento: '2026-08-07', tipo_contaminado: null, local_no_bloco: null },
  ];
  return { lotes: [l1a, l1b, l2, l3, l4, l5], eventos };
};
const faixaDe = (r, valor) => r.tempo.faixas.find((f) => f.valor === valor);
caso('tempo: predominante por BLOCOS (o L2 seria empate por retiradas), empate e sem retirada a parte, base do periodo', () => {
  const { lotes, eventos } = casoDoCruzamentoNoTempo();
  const r = cruzar(lotes, ['2026-08-01|SH', '2026-08-02|SH', '2026-08-03|SH', '2026-08-04|SH'], { eventos });
  assert.deepEqual(r.tempo.faixas.map((f) => f.valor), ['0-10', '11-15', '16-20', '21-30', '+30']);
  assert.deepEqual(r.lotes.map((l) => l.faixa_predominante), [
    { valor: '11-15', rotulo: '11 a 15 dias' },
    { valor: '0-10', rotulo: '0 a 10 dias' },
    { valor: 'EMPATE', rotulo: 'empate: 11 a 15 dias e 21 a 30 dias' },
    { valor: 'SEM_RETIRADA', rotulo: 'Sem bloco contaminado nas faixas' },
  ]);
  assert.deepEqual(r.tempo.faixas.map((f) => [f.valor, par(f.predominante), par(f.base)]), [
    ['0-10', { k: 1, n: 3 }, { k: 1, n: 4 }], ['11-15', { k: 1, n: 3 }, { k: 1, n: 4 }], ['16-20', { k: 0, n: 3 }, { k: 0, n: 4 }],
    ['21-30', { k: 0, n: 3 }, { k: 0, n: 4 }], ['+30', { k: 0, n: 3 }, { k: 1, n: 4 }],
  ]);
  assert.deepEqual([par(r.tempo.empate.predominante), par(r.tempo.empate.base)], [{ k: 1, n: 3 }, { k: 1, n: 4 }]);
  assert.deepEqual({ k: r.tempo.sem_retirada.k, n: r.tempo.sem_retirada.n, base: par(r.tempo.sem_retirada.base) }, { k: 1, n: 4, base: { k: 1, n: 5 } });
  assert.equal(r.tempo.faixas.reduce((s, f) => s + f.predominante.k, 0) + r.tempo.empate.predominante.k, 3);
  assert.deepEqual(r.tempo.faixas.map((f) => f.blocos), [50, 75, 5, 20, 0]);
  assert.equal(r.tempo.total_blocos, 150);
  assert.ok(perto(faixaDe(r, '11-15').pct_blocos, 0.5));
  assert.equal(faixaDe(r, '0-10').base_pequena, true, '1 lote do periodo: base pequena por valor');
});
caso('tempo: PERDA fica fora e a retirada anterior ao lote vai para sem data valida, somando no total (o positivo ao lado)', () => {
  const { lotes, eventos } = casoDoCruzamentoNoTempo();
  const r = cruzar(lotes, ['2026-08-05|SH'], { eventos });
  assert.deepEqual(r.lotes[0].faixa_predominante, { valor: '+30', rotulo: 'acima de 30 dias' });
  assert.deepEqual(r.tempo.faixas.map((f) => f.blocos), [0, 0, 0, 0, 50], 'a PERDA de 100 nao entra em faixa');
  assert.deepEqual({ ...r.tempo.sem_data_valida, pct_blocos: Math.round(r.tempo.sem_data_valida.pct_blocos * 1000) }, { blocos: 7, pct_blocos: 123 });
  assert.equal(r.tempo.total_blocos, 57);
});
caso('tempo: lote so com retirada anterior ao lote fica fora do n, e os blocos dele vao para sem data valida e o total', () => {
  const so = linha({ data_lote: '2026-08-10' });
  const outro = linha({ data_lote: '2026-08-11' });
  const eventos = [cont(so.id, 7, 'VERDE', '2026-08-01'), cont(outro.id, 4, 'VERDE', '2026-08-13')];
  const r = cruzar([so, outro], ['2026-08-10|SH', '2026-08-11|SH'], { eventos });
  assert.deepEqual(r.lotes[0].faixa_predominante, { valor: 'SEM_RETIRADA', rotulo: 'Sem bloco contaminado nas faixas' });
  assert.deepEqual({ k: r.tempo.sem_retirada.k, n: r.tempo.sem_retirada.n }, { k: 1, n: 2 });
  assert.deepEqual(par(faixaDe(r, '0-10').predominante), { k: 1, n: 1 }, 'o n e so de quem tem bloco nas faixas');
  assert.deepEqual([r.tempo.sem_data_valida.blocos, r.tempo.total_blocos], [7, 11]);
});
caso('tempo: empate de tres faixas sai como lista ("A, B e C") e conta so na linha de empate', () => {
  const l = linha({ data_lote: '2026-08-01' });
  const eventos = [cont(l.id, 5, 'VERDE', '2026-08-03'), cont(l.id, 5, 'VERDE', '2026-08-13'), cont(l.id, 5, 'VERDE', '2026-08-19')];
  const r = cruzar([l], ['2026-08-01|SH'], { eventos });
  assert.deepEqual(r.lotes[0].faixa_predominante, { valor: 'EMPATE', rotulo: 'empate: 0 a 10 dias, 11 a 15 dias e 16 a 20 dias' });
  assert.deepEqual(par(r.tempo.empate.predominante), { k: 1, n: 1 });
  assert.ok(r.tempo.faixas.every((f) => f.predominante.k === 0));
});
caso('tempo: base pequena POR FAIXA com 9 lotes predominantes no periodo, e nao com 10 (a borda)', () => {
  for (const [n, pequena] of [[9, true], [10, false]]) {
    const lotes = [];
    const eventos = [];
    for (let i = 0; i < n; i += 1) {
      const l = linha({ data_lote: `2026-08-${String(i + 1).padStart(2, '0')}` });
      lotes.push(l);
      eventos.push(cont(l.id, 5, 'VERDE', `2026-08-${String(i + 3).padStart(2, '0')}`));
    }
    const r = cruzar(lotes, ['2026-08-01|SH', '2026-08-02|SH'], { eventos });
    assert.deepEqual(par(faixaDe(r, '0-10').base), { k: n, n }, `${n} lotes`);
    assert.equal(faixaDe(r, '0-10').base_pequena, pequena, `${n} lotes`);
  }
});
caso('tempo: as faixas e a predominante seguem os cortes de Metas (parametros), nao 10/15/20/30 fixos', () => {
  const { lotes, eventos } = casoDoCruzamentoNoTempo();
  const parametros = { ...PARAMETROS, contaminacaoFaixa2: 13, contaminacaoFaixa3: 20 };
  const r = cruzar(lotes, ['2026-08-01|SH'], { eventos, parametros });
  assert.deepEqual(r.tempo.faixas.map((f) => f.valor), ['0-10', '11-13', '14-20', '21-30', '+30']);
  assert.deepEqual(r.lotes[0].faixa_predominante, { valor: '11-13', rotulo: '11 a 13 dias' });
  assert.deepEqual(par(faixaDe(r, '11-13').predominante), { k: 1, n: 1 }, 'o molde e os lotes usam os mesmos cortes');
});
caso('tempo: sem lote selecionado e sem evento, zeros e null, nada de NaN', () => {
  const { lotes } = casoDoCruzamentoNoTempo();
  for (const chaves of [[], ['2026-08-04|SH']]) {
    const r = cruzar(lotes, chaves);
    assert.equal(r.tempo.total_blocos, 0);
    assert.ok(r.tempo.faixas.every((f) => f.pct_blocos === null && f.predominante.k === 0 && f.predominante.n === 0));
    assert.ok(!JSON.stringify(r.tempo).includes('NaN') && r.tempo.faixas.every((f) => !Number.isNaN(f.diferenca_pp)));
  }
});
