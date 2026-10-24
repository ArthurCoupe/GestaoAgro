import assert from 'node:assert/strict';
import { capacidadeLivre, capacidadeDaJornada } from '../capacidadeLivre.js';
import { quadroDasEstantes } from '../quadroDasEstantes.js';
import { caso } from './caso.mjs';

const SALAS = [
  { id: 11, nome: 'Maturação 1', ordem: 1, galpao_codigo: 'A', etapa: 'MATURACAO', ativa: true },
  { id: 12, nome: 'Maturação 2', ordem: 2, galpao_codigo: 'B', etapa: 'MATURACAO', ativa: true },
  { id: 13, nome: 'Frutificação 1', ordem: 5, galpao_codigo: 'F1', etapa: 'FRUTIFICACAO', ativa: true },
  { id: 14, nome: 'Frutificação 4', ordem: 8, galpao_codigo: 'F4', etapa: 'FRUTIFICACAO', ativa: false },
];
const ESTANTES = [
  { sala_id: 11, etiqueta: '12', capacidade_blocos: 200, status: 'ATIVA' },
  { sala_id: 11, etiqueta: '31', capacidade_blocos: 100, status: 'ATIVA' },
  { sala_id: 12, etiqueta: '1', capacidade_blocos: 240, status: 'ATIVA' },
  { sala_id: 12, etiqueta: '19', capacidade_blocos: 240, status: 'EM_DESATIVACAO' },
  { sala_id: 13, etiqueta: '1', capacidade_blocos: 150, status: 'ATIVA' },
  { sala_id: 13, etiqueta: '4', capacidade_blocos: 170, status: 'ATIVA' },
  { sala_id: 14, etiqueta: '1', capacidade_blocos: 150, status: 'INATIVA' },
];
const LOTES = [
  { id: 1, data_lote: '2026-08-14', tipo: 'SH', codigo: '2026-08-14-SH-A12', galpao: 'A', estante_maturacao: '12', blocos_produzidos: 200, blocos_abertos: null, status: 'INCUBACAO' },
  { id: 2, data_lote: '2026-08-21', tipo: 'SH', codigo: '2026-08-21-SH-A12', galpao: 'A', estante_maturacao: '12', blocos_produzidos: 100, blocos_abertos: null, status: 'INCUBACAO' },
  { id: 3, data_lote: '2026-06-09', tipo: 'SP', codigo: '2026-06-09-SP-B19', galpao: 'B', estante_maturacao: '19', blocos_produzidos: 250, blocos_abertos: null, status: 'INCUBACAO' },
  { id: 4, data_lote: '2026-07-03', tipo: 'SH', codigo: '2026-07-03-SH-A99', galpao: 'A', estante_maturacao: '99', blocos_produzidos: 5, blocos_abertos: null, status: 'INCUBACAO' },
];
const EVENTOS = [{ lote_id: 1, tipo: 'CONTAMINACAO', quantidade: 120 }];
const ABERTURAS = [
  { lote_id: 50, tipo: 'ABERTURA', data: '2026-09-07', estante_destino: '1', sala_destino: 'F1', quantidade: 90 },
  { lote_id: 51, tipo: 'ABERTURA', data: '2026-09-08', estante_destino: '1', sala_destino: 'F1', quantidade: 35 },
  { lote_id: 52, tipo: 'ABERTURA', data: '2026-09-01', estante_destino: '4', sala_destino: 'F1', quantidade: 170 },
  { lote_id: 53, tipo: 'ABERTURA', data: '2026-09-07', estante_destino: '5', sala_destino: null, quantidade: 120 },
  { lote_id: 54, tipo: 'REMANEJAMENTO', data: '2026-09-07', estante_destino: '7', sala_destino: null, quantidade: 8 },
];
const LIBERACOES = [{ sala_id: 13, estante: '4', data: '2026-09-10' }];

const cap = ({ lotes, eventos, ...cadastro }) => capacidadeDaJornada(cadastro, { lotes, eventos }, { hoje: '2026-10-18' });

caso('sem o quadro, ou com um quadro sem a sala de maturacao ativa, recusa em vez de cair calada nos blocos; com o quadro das mesmas salas, responde', () => {
  assert.throws(
    () => capacidadeLivre({ salas: SALAS, estantes: ESTANTES, lotes: LOTES, eventos: EVENTOS }),
    /capacidadeLivre: `quadro` e obrigatorio/,
  );
  assert.throws(
    () => capacidadeLivre({ salas: SALAS, estantes: ESTANTES, lotes: LOTES, eventos: EVENTOS, quadro: { galpoes: [] } }),
    /o quadro nao tem a sala de maturacao ativa 11 \(A\)/,
  );
  const quadro = quadroDasEstantes({ salas: SALAS, estantes: ESTANTES }, []);
  const r = capacidadeLivre({ salas: SALAS, estantes: ESTANTES, lotes: LOTES, eventos: EVENTOS, quadro });
  assert.equal(r.salas.length, 4, 'controle: com o quadro das mesmas salas a funcao responde');
});

caso('maturacao: capacidade das ATIVA, ocupados pelo saldo vivo, livres por estante com piso 0', () => {
  const r = cap({ salas: SALAS, estantes: ESTANTES, lotes: LOTES, eventos: EVENTOS, transferencias: ABERTURAS, liberacoes: LIBERACOES });
  const m1 = r.salas.find((s) => s.galpao_codigo === 'A');
  assert.equal(m1.capacidade, 300);
  assert.equal(m1.ocupados, 180, '80 + 100 na A12');
  assert.equal(m1.livres, 120, '20 na A12 + 100 na A31');
  assert.deepEqual([m1.estantes_total, m1.estantes_ocupadas, m1.estantes_livres, m1.etiquetas_livres], [2, 1, 1, ['31']]);
  assert.deepEqual(m1.estantes.find((e) => e.etiqueta === '12').lotes.map((l) => [l.id, l.blocos]), [[1, 80], [2, 100]]);
});

caso('EM_DESATIVACAO fica fora da capacidade e dos totais, mas aparece com o que ocupa', () => {
  const r = cap({ salas: SALAS, estantes: ESTANTES, lotes: LOTES, eventos: EVENTOS, transferencias: [], liberacoes: [] });
  const m2 = r.salas.find((s) => s.galpao_codigo === 'B');
  assert.equal(m2.capacidade, 240, 'so a B1');
  assert.equal(m2.ocupados, 0);
  assert.deepEqual(m2.fora_da_capacidade, [{ etiqueta: '19', status: 'EM_DESATIVACAO', ocupados: 250 }]);
});

caso('ocupacao numa etiqueta que o cadastro nao tem e LISTADA, nunca descartada', () => {
  const r = cap({ salas: SALAS, estantes: ESTANTES, lotes: LOTES, eventos: EVENTOS, transferencias: [], liberacoes: [] });
  assert.deepEqual(r.estantes_desconhecidas, [{ galpao: 'A', etiqueta: '99', blocos: 5 }]);
});

caso('frutificacao: aberturas somam por (sala, estante); liberacao posterior devolve a estante; sem sala vai para sem_sala', () => {
  const r = cap({ salas: SALAS, estantes: ESTANTES, lotes: [], eventos: [], transferencias: ABERTURAS, liberacoes: LIBERACOES });
  const f1 = r.salas.find((s) => s.galpao_codigo === 'F1');
  assert.equal(f1.capacidade, 320);
  assert.equal(f1.ocupados, 125, 'F1/1 = 90 + 35; a F1/4 foi liberada em 10/09 (abertura de 01/09)');
  assert.equal(f1.livres, 195);
  assert.deepEqual([f1.estantes_ocupadas, f1.estantes_livres, f1.etiquetas_livres], [1, 1, ['4']]);
  assert.deepEqual(r.sem_sala, { aberturas: 1, blocos: 120, sem_quantidade: 0 }, 'REMANEJAMENTO nao conta; ABERTURA sem sala conta aqui');
});

caso('frutificacao: etiqueta sem prateleira no cadastro tambem e LISTADA, nunca descartada', () => {
  const r1 = cap({ salas: SALAS, estantes: ESTANTES, lotes: [], eventos: [], transferencias: [
    { lote_id: 70, tipo: 'ABERTURA', data: '2026-09-07', estante_destino: '9', sala_destino: 'F1', quantidade: 30 },
  ], liberacoes: [] });
  assert.deepEqual(r1.estantes_desconhecidas, [{ galpao: 'F1', etiqueta: '9', blocos: 30 }]);
  const f1r1 = r1.salas.find((s) => s.galpao_codigo === 'F1');
  assert.deepEqual([f1r1.capacidade, f1r1.ocupados, f1r1.livres], [320, 0, 320], 'a etiqueta 9 nao existe no cadastro da F1; os totais so contam as estantes registradas');

  const r2 = cap({ salas: SALAS, estantes: ESTANTES, lotes: [], eventos: [], transferencias: [
    { lote_id: 70, tipo: 'ABERTURA', data: '2026-09-07', estante_destino: '9', sala_destino: 'F1', quantidade: 30 },
    { lote_id: 71, tipo: 'ABERTURA', data: '2026-09-08', estante_destino: '9', sala_destino: 'F1', quantidade: null },
  ], liberacoes: [] });
  assert.deepEqual(r2.estantes_desconhecidas, [{ galpao: 'F1', etiqueta: '9', blocos: null }], 'uma abertura sem quantidade na mesma etiqueta desconhecida apaga o total, nao vira zero');
});

caso('abertura SEM quantidade: a estante fica ocupada, os blocos da sala viram null com o contador', () => {
  const r = cap({ salas: SALAS, estantes: ESTANTES, lotes: [], eventos: [], transferencias: [
    { lote_id: 60, tipo: 'ABERTURA', data: '2026-09-12', estante_destino: '1', sala_destino: 'F1', quantidade: null },
  ], liberacoes: [] });
  const f1 = r.salas.find((s) => s.galpao_codigo === 'F1');
  assert.deepEqual([f1.ocupados, f1.livres, f1.pct_ocupacao, f1.sem_quantidade, f1.estantes_ocupadas], [null, null, null, 1, 1]);
  assert.equal(f1.estantes.find((e) => e.etiqueta === '1').ocupados, null);
});

caso('liberacao no MESMO dia da abertura NAO a apaga: so as aberturas anteriores ao dia saem', () => {
  const r = cap({ salas: SALAS, estantes: ESTANTES, lotes: [], eventos: [], transferencias: [
    { lote_id: 61, tipo: 'ABERTURA', data: '2026-09-10', estante_destino: '4', sala_destino: 'F1', quantidade: 30 },
    { lote_id: 62, tipo: 'ABERTURA', data: '2026-09-11', estante_destino: '4', sala_destino: 'F1', quantidade: 20 },
  ], liberacoes: LIBERACOES });
  const e4 = r.salas.find((s) => s.galpao_codigo === 'F1').estantes.find((e) => e.etiqueta === '4');
  assert.equal(e4.ocupados, 50, 'liberacao de 10/09: a abertura de 10/09 (30) e a de 11/09 (20) ficam');
  const r2 = cap({ salas: SALAS, estantes: ESTANTES, lotes: [], eventos: [], transferencias: [
    { lote_id: 63, tipo: 'ABERTURA', data: '2026-09-09', estante_destino: '4', sala_destino: 'F1', quantidade: 30 },
  ], liberacoes: LIBERACOES });
  const e4r2 = r2.salas.find((s) => s.galpao_codigo === 'F1').estantes.find((e) => e.etiqueta === '4');
  assert.deepEqual([e4r2.ocupados, e4r2.lotes], [0, []], 'abertura de 09/09 + liberacao de 10/09: a estante esta livre');
});

caso('sala inativa: capacidade 0, nada ocupado, ativa=false viaja', () => {
  const r = cap({ salas: SALAS, estantes: ESTANTES, lotes: [], eventos: [], transferencias: [], liberacoes: [] });
  const f4 = r.salas.find((s) => s.galpao_codigo === 'F4');
  assert.deepEqual([f4.ativa, f4.capacidade, f4.ocupados, f4.livres], [false, 0, 0, 0]);
});

const ABERTURAS_COM_SALA = ABERTURAS.filter((t) => t.sala_destino);

caso('totais por etapa somam so as salas ativas; ausencia contamina o total com null', () => {
  const r = cap({ salas: SALAS, estantes: ESTANTES, lotes: LOTES, eventos: EVENTOS, transferencias: ABERTURAS_COM_SALA, liberacoes: LIBERACOES });
  assert.deepEqual(r.sem_sala.aberturas, 0, 'controle: esta fixture nao tem abertura sem sala');
  assert.deepEqual(r.totais.maturacao, { capacidade: 540, ocupados: 180, livres: 360, acima_da_capacidade: 0 });
  assert.deepEqual(r.totais.frutificacao, { capacidade: 320, ocupados: 125, livres: 195, acima_da_capacidade: 0 });
  const comNull = cap({ salas: SALAS, estantes: ESTANTES, lotes: [], eventos: [], transferencias: [
    { lote_id: 60, tipo: 'ABERTURA', data: '2026-09-12', estante_destino: '1', sala_destino: 'F1', quantidade: null },
  ], liberacoes: [] });
  assert.deepEqual(comNull.totais.frutificacao, { capacidade: 320, ocupados: null, livres: null, acima_da_capacidade: null });
});

caso('abertura SEM sala: o total de frutificacao nao afirma ocupados/livres (null, capacidade fica); as salas seguem com a sua conta', () => {
  const r = cap({ salas: SALAS, estantes: ESTANTES, lotes: LOTES, eventos: EVENTOS, transferencias: ABERTURAS, liberacoes: LIBERACOES });
  assert.equal(r.sem_sala.aberturas, 1, 'controle: a fixture tem a abertura sem sala (lote 53)');
  assert.deepEqual(r.totais.frutificacao, { capacidade: 320, ocupados: null, livres: null, acima_da_capacidade: null });
  const f1 = r.salas.find((s) => s.galpao_codigo === 'F1');
  assert.deepEqual([f1.ocupados, f1.livres], [125, 195], 'a linha da F1 nao muda: o cego e so o total');
  assert.deepEqual(r.totais.maturacao, { capacidade: 540, ocupados: 180, livres: 360, acima_da_capacidade: 0 }, 'a maturacao nao tem sala ausente: total inteiro');
});

caso('estante acima da capacidade: Livres = Capacidade - Ocupados + Acima, por sala e no Total, e o Total soma as salas', () => {
  const lotes = [
    { id: 90, galpao: 'A', estante_maturacao: '12', blocos_produzidos: 250, blocos_abertos: null, status: 'INCUBACAO' },
    { id: 91, galpao: 'A', estante_maturacao: '31', blocos_produzidos: 30, blocos_abertos: null, status: 'INCUBACAO' },
    { id: 92, galpao: 'A', estante_maturacao: '31', blocos_produzidos: 10, blocos_abertos: 30, status: 'INCUBACAO' },
    { id: 93, galpao: 'B', estante_maturacao: '1', blocos_produzidos: 100, blocos_abertos: null, status: 'INCUBACAO' },
  ];
  const transferencias = [{ lote_id: 94, tipo: 'ABERTURA', data: '2026-09-07', estante_destino: '1', sala_destino: 'F1', quantidade: 200 }];
  const r = cap({ salas: SALAS, estantes: ESTANTES, lotes, eventos: [], transferencias, liberacoes: [] });
  const acimaDe = (s) => s.estantes.filter((e) => e.ocupados > e.capacidade && e.capacidade > 0).map((e) => e.etiqueta);
  assert.deepEqual(acimaDe(r.salas.find((s) => s.galpao_codigo === 'A')), ['12'], 'A12: 250 numa estante de 200');
  assert.deepEqual(acimaDe(r.salas.find((s) => s.galpao_codigo === 'F1')), ['1'], 'F1/1: 200 numa estante de 150');
  const m1 = r.salas.find((s) => s.galpao_codigo === 'A');
  assert.deepEqual([m1.capacidade, m1.ocupados, m1.livres, m1.acima_da_capacidade], [300, 280, 70, 50]);
  const f1 = r.salas.find((s) => s.galpao_codigo === 'F1');
  assert.deepEqual([f1.capacidade, f1.ocupados, f1.livres, f1.acima_da_capacidade], [320, 200, 170, 50]);
  for (const s of r.salas) {
    assert.equal(s.livres, s.capacidade - s.ocupados + s.acima_da_capacidade, `sala ${s.galpao_codigo}`);
  }
  assert.deepEqual(r.totais.maturacao, { capacidade: 540, ocupados: 380, livres: 210, acima_da_capacidade: 50 });
  for (const [chave, etapa] of [['maturacao', 'MATURACAO'], ['frutificacao', 'FRUTIFICACAO']]) {
    const t = r.totais[chave];
    assert.equal(t.livres, t.capacidade - t.ocupados + t.acima_da_capacidade, `total ${chave}`);
    const daEtapa = r.salas.filter((s) => s.etapa === etapa);
    for (const campo of ['capacidade', 'ocupados', 'livres', 'acima_da_capacidade']) {
      assert.equal(t[campo], daEtapa.reduce((sum, s) => sum + s[campo], 0), `total ${chave}.${campo} soma as salas`);
    }
  }
});

caso('sem sala cadastrada: sem_dado declarado, salas vazias, nada inventado', () => {
  const r = cap({ salas: [], estantes: [], lotes: LOTES, eventos: EVENTOS, transferencias: ABERTURAS, liberacoes: [] });
  assert.deepEqual(r.salas, []);
  assert.equal(r.sem_dado.length, 1);
  assert.match(r.sem_dado[0].motivo, /Nenhuma sala/);
  assert.deepEqual(r.estantes_desconhecidas, [
    { galpao: 'A', etiqueta: '12', blocos: 180 },
    { galpao: 'A', etiqueta: '99', blocos: 5 },
    { galpao: 'B', etiqueta: '19', blocos: 250 },
    { galpao: 'F1', etiqueta: '1', blocos: 125 },
    { galpao: 'F1', etiqueta: '4', blocos: 170 },
  ], 'toda ocupacao (maturacao e frutificacao) vira desconhecida quando nao ha sala cadastrada');
});

caso('estante marcada Zerou = Sim conta 0 (saiu da maturacao, como na fila); Zerou = Nao deixa o resto', () => {
  const lotes = [
    { id: 1, data_lote: '2026-08-20', tipo: 'SH', codigo: 'x', galpao: 'A', estante_maturacao: '12', blocos_produzidos: 200, blocos_abertos: 160, data_abertura: '2026-10-01', zerou_estante: true, status: 'FRUTIFICACAO' },
    { id: 2, data_lote: '2026-08-20', tipo: 'SH', codigo: 'y', galpao: 'A', estante_maturacao: '31', blocos_produzidos: 100, blocos_abertos: 40, data_abertura: '2026-10-01', zerou_estante: false, status: 'FRUTIFICACAO' },
  ];
  const r = cap({ salas: SALAS, estantes: ESTANTES, lotes, eventos: [], transferencias: [], liberacoes: [] });
  const m1 = r.salas.find((s) => s.galpao_codigo === 'A');
  assert.equal(m1.ocupados, 60, 'so os 100 - 40 da estante 31; a 12 marcada zerada nao ocupa (era 40 + 60 = 100)');
  assert.deepEqual(m1.etiquetas_livres, ['12'], 'a estante zerada volta para a lista de livres');
});

caso('as salas saem na ordem do cadastro (ordem, id)', () => {
  const r = cap({ salas: [...SALAS].reverse(), estantes: ESTANTES, lotes: [], eventos: [], transferencias: [], liberacoes: [] });
  assert.deepEqual(r.salas.map((s) => s.galpao_codigo), ['A', 'B', 'F1', 'F4']);
});
