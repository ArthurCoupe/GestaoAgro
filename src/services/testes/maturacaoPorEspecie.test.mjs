import { prazosVigentesPorTipo, resolverDiasDeMaturacao } from '../maturacaoPorEspecie.js';
import { PARAMETRO_ABERTURA_DIAS } from '../painelDoCiclo.js';
import { registrar } from './caso.mjs';

const eq = (nome, obtido, esperado) => registrar(
  nome,
  obtido != null
    && Object.keys(obtido).length === Object.keys(esperado).length
    && Object.keys(esperado).every((k) => Object.is(obtido[k], esperado[k])),
  `esperado ${JSON.stringify(esperado)}\n        obtido   ${JSON.stringify(obtido)} (dias tipo ${typeof obtido?.dias})`,
);
const AUSENCIA = { dias: null, origem: null, regra_id: null };

const REGRAS = [
  { id: 1, tipo_cogumelo: 'SH', dias: 90, vigente_desde: '2025-11-03' },
  { id: 2, tipo_cogumelo: 'SB', dias: 30, vigente_desde: '2025-11-03' },
  { id: 3, tipo_cogumelo: 'SP', dias: 30, vigente_desde: '2025-11-03' },
  { id: 9, tipo_cogumelo: 'SH', dias: 100, vigente_desde: '2026-10-01' },
];
const OPC = { regrasPorEspecie: REGRAS, parametrosPorTipo: PARAMETRO_ABERTURA_DIAS };

eq('SH na Maturacao 2 (B, era 30 pela sala) tem 90',
  resolverDiasDeMaturacao({ galpao: 'B', tipo: 'SH', data_lote: '2026-09-23' }, OPC),
  { dias: 90, origem: 'ESPECIE', regra_id: 1 });
eq('SB na Maturacao 1 (A, era 90 pela sala) tem 30',
  resolverDiasDeMaturacao({ galpao: 'A', tipo: 'SB', data_lote: '2026-07-16' }, OPC),
  { dias: 30, origem: 'ESPECIE', regra_id: 2 });
eq('mesmo lote sem galpao da o mesmo prazo',
  resolverDiasDeMaturacao({ galpao: null, tipo: 'SB', data_lote: '2026-07-16' }, OPC),
  { dias: 30, origem: 'ESPECIE', regra_id: 2 });
eq('regra de sala passada junto nao entra',
  resolverDiasDeMaturacao({ galpao: 'A', tipo: 'SB', data_lote: '2026-07-16' },
    { ...OPC, regras: [{ id: 7, galpao_codigo: 'A', dias: 5, vigente_desde: '2025-01-01' }] }),
  { dias: 30, origem: 'ESPECIE', regra_id: 2 });

eq('vespera da regra nova: fica a antiga',
  resolverDiasDeMaturacao({ tipo: 'SH', data_lote: '2026-09-30' }, OPC),
  { dias: 90, origem: 'ESPECIE', regra_id: 1 });
eq('dia da regra nova: ja vale a nova (>=)',
  resolverDiasDeMaturacao({ tipo: 'SH', data_lote: '2026-10-01' }, OPC),
  { dias: 100, origem: 'ESPECIE', regra_id: 9 });
eq('regras fora de ordem: vale a mais recente que nao passa da data',
  resolverDiasDeMaturacao({ tipo: 'SH', data_lote: '2026-11-01' }, { ...OPC, regrasPorEspecie: [...REGRAS].reverse() }),
  { dias: 100, origem: 'ESPECIE', regra_id: 9 });
eq('lote anterior a toda regra: degrau TIPO',
  resolverDiasDeMaturacao({ tipo: 'SB', data_lote: '2025-11-02' }, OPC),
  { dias: 30, origem: 'TIPO', regra_id: null });

eq('sem data do lote: degrau TIPO, nunca zero',
  resolverDiasDeMaturacao({ tipo: 'SH', data_lote: null }, OPC),
  { dias: 90, origem: 'TIPO', regra_id: null });
eq('SS sem regra cadastrada: degrau TIPO (30)',
  resolverDiasDeMaturacao({ tipo: 'SS', data_lote: '2026-09-01' }, OPC),
  { dias: 30, origem: 'TIPO', regra_id: null });
eq('tipo desconhecido: ausencia declarada',
  resolverDiasDeMaturacao({ tipo: 'XX', data_lote: '2026-09-01' }, OPC), AUSENCIA);
eq('tipo nulo: ausencia declarada',
  resolverDiasDeMaturacao({ tipo: null, data_lote: '2026-09-01' }, OPC), AUSENCIA);
eq('regra de OUTRA especie nunca serve',
  resolverDiasDeMaturacao({ tipo: 'SP', data_lote: '2026-09-01' }, { regrasPorEspecie: [REGRAS[0]], parametrosPorTipo: {} }),
  AUSENCIA);
eq('sem opcoes: ausencia declarada',
  resolverDiasDeMaturacao({ tipo: 'SH', data_lote: '2026-09-01' }), AUSENCIA);

const eqv = (nome, obtido, esperado) => registrar(nome, Object.is(obtido, esperado), `esperado ${JSON.stringify(esperado)}, obtido ${JSON.stringify(obtido)}`);
{
  const regras = [
    { id: 1, tipo_cogumelo: 'SH', dias: 90, vigente_desde: '2025-11-03' },
    { id: 2, tipo_cogumelo: 'SH', dias: 100, vigente_desde: '2026-10-01' },
    { id: 3, tipo_cogumelo: 'SB', dias: 45, vigente_desde: '2025-11-03' },
  ];
  const base = { SH: 90, SB: 30, SP: 30, SS: 30 };
  const antes = prazosVigentesPorTipo(regras, '2026-09-30', base);
  eqv('SB com regra de 45: vale 45, nao a constante 30', antes.SB, 45);
  eqv('SH na vespera da regra nova: 90', antes.SH, 90);
  eqv('SP sem regra: cai na constante', antes.SP, 30);
  eqv('e so os tipos da base (nada inventado)', Object.keys(antes).sort().join(','), 'SB,SH,SP,SS');
  eqv('SH no dia da regra nova: 100', prazosVigentesPorTipo(regras, '2026-10-01', base).SH, 100);
}
