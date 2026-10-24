import { useState } from 'react';
import { brl } from '../../api/client';
import { Calculadora, CampoNum } from './CalcBase';

export function CustoBandeja() {
  const [custosDiretos, setCustosDiretos] = useState(50000);
  const [despesasRateadas, setDespesasRateadas] = useState(30000);
  const [bandejas, setBandejas] = useState(10000);

  const custo = bandejas > 0 ? (custosDiretos + despesasRateadas) / bandejas : null;

  return (
    <Calculadora
      titulo="Custo por Bandeja"
      sub="(Custos diretos + despesas rateadas) ÷ bandejas produzidas"
      campos={<>
        <CampoNum label="Custos diretos (R$)" value={custosDiretos} onChange={setCustosDiretos} />
        <CampoNum label="Despesas rateadas (R$)" value={despesasRateadas} onChange={setDespesasRateadas} />
        <CampoNum label="Bandejas produzidas" value={bandejas} onChange={setBandejas} />
      </>}
      resultado={
        <div className="rline"><span>Custo unitário</span><b className="big">{brl(custo)}</b></div>
      }
    />
  );
}
