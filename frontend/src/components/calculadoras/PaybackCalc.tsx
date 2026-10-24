import { useState } from 'react';
import { num } from '../../api/client';
import { Calculadora, CampoNum } from './CalcBase';

export function PaybackCalc() {
  const [investimento, setInvestimento] = useState(30000);
  const [ganhoMensal, setGanhoMensal] = useState(5000);

  const meses = ganhoMensal > 0 ? investimento / ganhoMensal : null;

  return (
    <Calculadora
      titulo="Payback"
      sub="Tempo para recuperar o investimento"
      campos={<>
        <CampoNum label="Investimento (R$)" value={investimento} onChange={setInvestimento} />
        <CampoNum label="Ganho mensal (R$)" value={ganhoMensal} onChange={setGanhoMensal} />
      </>}
      resultado={
        <div className="rline">
          <span>Payback</span>
          <b className="big">{meses != null ? `${num(meses, 1)} meses` : '—'}</b>
        </div>
      }
    />
  );
}
