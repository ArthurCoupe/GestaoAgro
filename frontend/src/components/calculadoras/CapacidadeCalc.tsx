import { useState } from 'react';
import { pct } from '../../api/client';
import { Calculadora, CampoNum } from './CalcBase';

export function CapacidadeCalc() {
  const [demanda, setDemanda] = useState(15000);
  const [capacidade, setCapacidade] = useState(10000);

  const uso = capacidade > 0 ? (demanda / capacidade) * 100 : null;
  const msg = uso == null ? '' :
    uso > 100 ? 'Demanda acima da capacidade: risco de não atender.' :
    uso > 85 ? 'Perto do limite: planeje expansão.' :
    'Há folga de capacidade.';
  const tone = uso != null && uso > 100 ? 'neg' : '';

  return (
    <Calculadora
      titulo="Capacidade & Gargalos"
      sub="Utilização = demanda prevista ÷ capacidade instalada"
      campos={<>
        <CampoNum label="Demanda prevista (bandejas)" value={demanda} onChange={setDemanda} />
        <CampoNum label="Capacidade instalada (bandejas)" value={capacidade} onChange={setCapacidade} />
      </>}
      resultado={<>
        <div className="rline"><span>Utilização</span><b className={`big ${tone}`}>{pct(uso)}</b></div>
        <div className="rline"><span>{msg}</span></div>
      </>}
    />
  );
}
