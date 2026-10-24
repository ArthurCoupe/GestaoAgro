import assert from 'node:assert/strict';
import { necessidadeDeSementes } from '../necessidadeDeSementes.js';
import { numeroMaiorQueZero } from '../camposDoCiclo.js';
import { caso } from './caso.mjs';

const PARAM_CHEIO = { tipo_cogumelo: 'Shiitake', gramas_por_bloco: 250, gramas_por_saco: 1000 };
const SEMANAS_4 = ['2026-09-21', '2026-09-28', '2026-10-05', '2026-10-12'];
const previsao = (totais, { horizonte = 4, semanas = SEMANAS_4, faltam = {} } = {}) => ({
  horizonte_semanas: horizonte, semanas,
  porTipo: new Map(Object.entries(totais).map(([nome, total]) => [nome, { total, semanas_sem_previsao: faltam[nome] ?? [] }])),
});
const P800 = previsao({ Shiitake: 800 });

caso('conta cheia: necessidade, dura e comprar agora batem o literal', () => {
  const r = necessidadeDeSementes(
    { parametros: [PARAM_CHEIO], estoque: [{ tipo_cogumelo: 'Shiitake', saldo: 120 }], compras_previstas: [], previsao: P800 },
  );
  assert.equal(r.por_tipo.length, 1);
  assert.equal(r.horizonte_semanas, 4);
  assert.deepEqual(r.semanas, SEMANAS_4);
  const t = r.por_tipo[0];
  assert.equal(t.blocos_previstos_horizonte, 800);
  assert.equal(t.necessidade_horizonte_sacos, 200);
  assert.equal(t.necessidade_semana_sacos, 50);
  assert.equal(t.saldo, 120);
  assert.equal(t.dura_semanas, 2.4);
  assert.equal(t.comprar_agora_sacos, 80);
  assert.deepEqual(t.sem_dado, []);
});

caso('sem gramas por bloco: números saem null (nunca 0), sem_dado nomeia o campo', () => {
  const r = necessidadeDeSementes({
    parametros: [{ tipo_cogumelo: 'Shiitake', gramas_por_bloco: null, gramas_por_saco: 1000 }],
    estoque: [{ tipo_cogumelo: 'Shiitake', saldo: 100 }],
    compras_previstas: [], previsao: P800,
  });
  const t = r.por_tipo[0];
  assert.equal(t.necessidade_semana_sacos, null);
  assert.equal(t.dura_semanas, null);
  assert.equal(t.comprar_agora_sacos, null);
  assert.deepEqual(t.sem_dado, ['gramas_por_bloco']);
});

caso('saldo cobre: comprar agora nao fica negativo, vira 0', () => {
  const r = necessidadeDeSementes({
    parametros: [PARAM_CHEIO],
    estoque: [{ tipo_cogumelo: 'Shiitake', saldo: 500 }],
    compras_previstas: [], previsao: P800,
  });
  const t = r.por_tipo[0];
  assert.equal(t.dura_semanas, 10);
  assert.equal(t.comprar_agora_sacos, 0);
});

caso('compras previstas descontam do comprar agora', () => {
  const semCompra = necessidadeDeSementes({
    parametros: [PARAM_CHEIO], estoque: [{ tipo_cogumelo: 'Shiitake', saldo: 50 }], compras_previstas: [], previsao: P800,
  }).por_tipo[0].comprar_agora_sacos;
  assert.equal(semCompra, 150);
  const r = necessidadeDeSementes({
    parametros: [PARAM_CHEIO],
    estoque: [{ tipo_cogumelo: 'Shiitake', saldo: 50 }],
    compras_previstas: [{ tipo_cogumelo: 'Shiitake', quantidade: 30 }], previsao: P800,
  });
  assert.equal(r.por_tipo[0].comprar_agora_sacos, 120);
});

caso('blocos previstos 0: necessidade 0 de verdade, dura vira null (nao #DIV/0!), comprar nao fica negativo', () => {
  const r = necessidadeDeSementes({
    parametros: [PARAM_CHEIO],
    estoque: [{ tipo_cogumelo: 'Shiitake', saldo: 100 }],
    compras_previstas: [], previsao: previsao({ Shiitake: 0 }),
  });
  const t = r.por_tipo[0];
  assert.equal(t.necessidade_semana_sacos, 0);
  assert.deepEqual(t.sem_dado, []);
  assert.equal(t.dura_semanas, null);
  assert.equal(t.comprar_agora_sacos, 0);
});

caso('tipo sem estoque: saldo null (nunca 0), sem_dado nomeia "estoque", necessidade continua saindo', () => {
  const r = necessidadeDeSementes({
    parametros: [PARAM_CHEIO], estoque: [], compras_previstas: [], previsao: P800,
  });
  const t = r.por_tipo[0];
  assert.equal(t.necessidade_semana_sacos, 50);
  assert.equal(t.saldo, null);
  assert.equal(t.dura_semanas, null);
  assert.equal(t.comprar_agora_sacos, null);
  assert.deepEqual(t.sem_dado, ['estoque']);
});

caso('gramas_por_saco = 0: nao e dado medido, e tratado como ausente (nunca Infinity/NaN)', () => {
  const r = necessidadeDeSementes({
    parametros: [{ tipo_cogumelo: 'Shiitake', gramas_por_bloco: 250, gramas_por_saco: 0 }],
    estoque: [{ tipo_cogumelo: 'Shiitake', saldo: 100 }],
    compras_previstas: [], previsao: P800,
  });
  const t = r.por_tipo[0];
  assert.equal(t.necessidade_semana_sacos, null);
  assert.equal(t.dura_semanas, null);
  assert.equal(t.comprar_agora_sacos, null);
  assert.deepEqual(t.sem_dado, ['gramas_por_saco']);
});

caso('validador de escrita recusa 0 nos dois campos de grama, com a frase em pt-BR', () => {
  assert.throws(
    () => numeroMaiorQueZero(0, 'gramas_por_saco'),
    { message: 'gramas_por_saco inválido: informe um número maior que zero.' },
  );
  assert.throws(
    () => numeroMaiorQueZero(0, 'gramas_por_bloco'),
    { message: 'gramas_por_bloco inválido: informe um número maior que zero.' },
  );
  assert.equal(numeroMaiorQueZero(250, 'gramas_por_bloco'), 250);
  assert.equal(numeroMaiorQueZero(null, 'gramas_por_bloco'), null);
  assert.throws(() => numeroMaiorQueZero(-1, 'gramas_por_bloco'));
});

caso('a resposta traz as parcelas do comprar agora, e a conta fecha com elas (negativo conta 0)', () => {
  const r = necessidadeDeSementes({
    parametros: [
      PARAM_CHEIO,
      { tipo_cogumelo: 'Shimeji Preto', gramas_por_bloco: 250, gramas_por_saco: 1000 },
    ],
    estoque: [{ tipo_cogumelo: 'Shiitake', saldo: 120 }, { tipo_cogumelo: 'Shimeji Preto', saldo: 12 }],
    compras_previstas: [
      { tipo_cogumelo: 'Shiitake', quantidade: 20 }, { tipo_cogumelo: 'Shiitake', quantidade: 10 },
      { tipo_cogumelo: 'Shimeji Preto', quantidade: 10 },
    ],
    previsao: previsao({ Shiitake: 800, 'Shimeji Preto': 80 }),
  });
  const [sh, sp] = r.por_tipo;
  assert.equal(sh.compras_previstas_sacos, 30);
  assert.equal(sp.compras_previstas_sacos, 10);
  const refaz = (t) => Math.max(0, Math.ceil(t.necessidade_horizonte_sacos - t.saldo - t.compras_previstas_sacos));
  assert.equal(sh.comprar_agora_sacos, refaz(sh));
  assert.equal(sh.comprar_agora_sacos, 50);
  assert.equal(sp.necessidade_horizonte_sacos - sp.saldo - sp.compras_previstas_sacos, -2);
  assert.equal(sp.comprar_agora_sacos, refaz(sp));
  assert.equal(sp.comprar_agora_sacos, 0);
  const semCompra = necessidadeDeSementes({
    parametros: [PARAM_CHEIO], estoque: [{ tipo_cogumelo: 'Shiitake', saldo: 120 }], compras_previstas: [], previsao: P800,
  }).por_tipo[0];
  assert.equal(semCompra.compras_previstas_sacos, 0);
  assert.deepEqual(semCompra.sem_dado, []);
});

caso('previsao incompleta: sem_dado nomeia "previsao", os numeros saem null e as semanas que faltam viajam', () => {
  const t = necessidadeDeSementes({
    parametros: [PARAM_CHEIO], estoque: [{ tipo_cogumelo: 'Shiitake', saldo: 100 }], compras_previstas: [],
    previsao: previsao({ Shiitake: null }, { faltam: { Shiitake: ['2026-10-12'] } }),
  }).por_tipo[0];
  assert.equal(t.blocos_previstos_horizonte, null);
  assert.deepEqual(t.semanas_sem_previsao, ['2026-10-12']);
  assert.equal(t.necessidade_horizonte_sacos, null);
  assert.equal(t.necessidade_semana_sacos, null);
  assert.equal(t.comprar_agora_sacos, null);
  assert.deepEqual(t.sem_dado, ['previsao']);
});

caso('tipo que a previsao nao conhece fica com TODAS as semanas faltando (nunca zero)', () => {
  const t = necessidadeDeSementes({
    parametros: [{ tipo_cogumelo: 'Shimeji Salmão', gramas_por_bloco: 250, gramas_por_saco: 1000 }],
    estoque: [], compras_previstas: [], previsao: P800,
  }).por_tipo[0];
  assert.equal(t.blocos_previstos_horizonte, null);
  assert.deepEqual(t.semanas_sem_previsao, SEMANAS_4);
  assert.deepEqual(t.sem_dado, ['previsao', 'estoque']);
});

caso('o horizonte manda: 6 semanas de 200 blocos = 300 sacos, e o comprar agora cresce junto', () => {
  const semanas6 = [...SEMANAS_4, '2026-10-19', '2026-10-26'];
  const r = necessidadeDeSementes({
    parametros: [PARAM_CHEIO], estoque: [{ tipo_cogumelo: 'Shiitake', saldo: 120 }], compras_previstas: [],
    previsao: previsao({ Shiitake: 1200 }, { horizonte: 6, semanas: semanas6 }),
  });
  assert.equal(r.horizonte_semanas, 6);
  const t = r.por_tipo[0];
  assert.equal(t.necessidade_horizonte_sacos, 300);
  assert.equal(t.necessidade_semana_sacos, 50);
  assert.equal(t.comprar_agora_sacos, 180);
});

caso('comprar agora e SACO INTEIRO, arredondado para cima (como o pedido de materia-prima)', () => {
  const t = necessidadeDeSementes({
    parametros: [PARAM_CHEIO], estoque: [{ tipo_cogumelo: 'Shiitake', saldo: 120 }], compras_previstas: [],
    previsao: previsao({ Shiitake: 810 }),
  }).por_tipo[0];
  assert.equal(t.necessidade_horizonte_sacos, 202.5);
  assert.equal(t.comprar_agora_sacos, 83);
});

caso('numeros em escala de producao: 18,6 g/bloco, saco de 1.000 g, 3.500 blocos/semana em 4 semanas', () => {
  const t = necessidadeDeSementes({
    parametros: [{ tipo_cogumelo: 'Shiitake', gramas_por_bloco: 18.6, gramas_por_saco: 1000 }],
    estoque: [{ tipo_cogumelo: 'Shiitake', saldo: 100 }], compras_previstas: [],
    previsao: previsao({ Shiitake: 14000 }),
  }).por_tipo[0];
  assert.equal(t.necessidade_horizonte_sacos, 260.4);
  assert.equal(t.necessidade_semana_sacos, 65.1);
  assert.equal(t.comprar_agora_sacos, 161);
});

caso('sem a previsao a conta RECUSA (nao projeta zero em silencio)', () => {
  assert.throws(
    () => necessidadeDeSementes({ parametros: [PARAM_CHEIO], estoque: [], compras_previstas: [] }),
    { message: 'necessidadeDeSementes: sem a previsao de producao (porTipo).' },
  );
});
