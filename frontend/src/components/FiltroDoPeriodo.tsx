import { useState } from 'react';
import { ESCOPOS, intervaloDoEscopo, ROTULO_BOTAO_ESCOPO, rotuloDoEscopo, type Escopo } from '../pages/Dashboard';
import { idxDoMes, periodoDoMes, usePeriodo } from './ui';

export type EscopoDaTela = Escopo | 'PERSONALIZADO';

const MAXIMO_DE_MESES = 24;

export function periodoPersonalizado(de: string, ate: string): { inicio: string; fim: string; rotulo: string } | { erro: string } {
  const mes = /^20\d\d-(0[1-9]|1[0-2])$/;
  if (!de || !ate) return { erro: 'Escolha o mês inicial antes do mês final.' };
  if (!mes.test(de) || !mes.test(ate)) return { erro: 'Escolha um mês válido.' };
  const [i, f] = [idxDoMes(de), idxDoMes(ate)];
  if (f < i) return { erro: 'Escolha o mês inicial antes do mês final.' };
  if (f - i + 1 > MAXIMO_DE_MESES) return { erro: `Escolha no máximo ${MAXIMO_DE_MESES} meses.` };
  const pi = periodoDoMes(Math.floor(i / 12), i % 12);
  const pf = periodoDoMes(Math.floor(f / 12), f % 12);
  return { inicio: pi.inicio, fim: pf.fim, rotulo: i === f ? pf.rotulo : `${pi.rotulo} a ${pf.rotulo}` };
}

export function periodoDaTela(escopo: EscopoDaTela, periodo: { inicio: string; fim: string; rotulo: string }, de: string, ate: string) {
  if (escopo === 'PERSONALIZADO') return periodoPersonalizado(de, ate);
  return { ...intervaloDoEscopo(escopo, periodo), rotulo: rotuloDoEscopo(escopo, periodo) };
}

export function FiltroDoPeriodo({ escopo, onEscopo, de, ate, onDe, onAte, min }: {
  escopo: EscopoDaTela; onEscopo: (e: EscopoDaTela) => void;
  de: string; ate: string; onDe: (v: string) => void; onAte: (v: string) => void; min?: string;
}) {
  const aba = (op: EscopoDaTela, rotulo: string) => (
    <button key={op} type="button" className={`tab ${escopo === op ? 'active' : ''}`} aria-pressed={escopo === op} onClick={() => onEscopo(op)}>{rotulo}</button>
  );
  return (
    <>
      <div className="tabs" role="group" aria-label="Período">
        {ESCOPOS.map((op) => aba(op, ROTULO_BOTAO_ESCOPO[op]))}
        {aba('PERSONALIZADO', 'Período')}
      </div>
      {escopo === 'PERSONALIZADO' && (
        <div className="periodo-meses">
          <input type="month" className="cls-select" aria-label="Do mês" value={de} min={min} onChange={(e) => onDe(e.target.value)} />
          <input type="month" className="cls-select" aria-label="Até o mês" value={ate} min={min} onChange={(e) => onAte(e.target.value)} />
        </div>
      )}
    </>
  );
}

export function usePeriodoDaTela(inicial?: { escopo: EscopoDaTela; de?: string; ate?: string } | null) {
  const { periodo, mesesDisponiveis } = usePeriodo();
  const [escopo, setEscopo] = useState<EscopoDaTela>(inicial?.escopo ?? 'YTD');
  const [de, setDe] = useState(inicial?.de ?? `${periodo.fim.slice(0, 4)}-01`);
  const [ate, setAte] = useState(inicial?.ate ?? periodo.fim.slice(0, 7));
  const daTela = periodoDaTela(escopo, periodo, de, ate);
  const recusa = 'erro' in daTela ? daTela.erro : '';
  const intervalo = 'erro' in daTela ? { inicio: periodo.inicio, fim: periodo.fim } : { inicio: daTela.inicio, fim: daTela.fim };
  const rotulo = 'erro' in daTela ? '' : daTela.rotulo;
  const filtro = <FiltroDoPeriodo escopo={escopo} onEscopo={setEscopo} de={de} ate={ate} onDe={setDe} onAte={setAte} min={mesesDisponiveis[0]} />;
  return { escopo, recusa, intervalo, rotulo, filtro };
}
