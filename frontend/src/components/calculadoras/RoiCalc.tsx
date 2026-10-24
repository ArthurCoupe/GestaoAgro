import { useState } from 'react';
import { pct } from '../../api/client';
import { Calculadora, CampoNum } from './CalcBase';

export function RoiCalc() {
  const [ganho, setGanho] = useState(7000);
  const [investimento, setInvestimento] = useState(30000);

  const roi = investimento > 0 ? (ganho / investimento) * 100 : null;

  return (
    <Calculadora
      titulo="ROI"
      sub="Retorno sobre o investimento = ganho ÷ investimento"
      campos={<>
        <CampoNum label="Ganho obtido (R$)" value={ganho} onChange={setGanho} />
        <CampoNum label="Investimento (R$)" value={investimento} onChange={setInvestimento} />
      </>}
      resultado={
        <div className="rline"><span>ROI</span><b className="big">{pct(roi)}</b></div>
      }
    />
  );
}
