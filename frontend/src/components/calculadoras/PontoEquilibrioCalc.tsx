import { useState } from 'react';
import { num } from '../../api/client';
import { Calculadora, CampoNum } from './CalcBase';

export function PontoEquilibrioCalc() {
  const [custoFixo, setCustoFixo] = useState(10000);
  const [margemBandeja, setMargemBandeja] = useState(10);

  const bandejas = margemBandeja > 0 ? custoFixo / margemBandeja : null;

  return (
    <Calculadora
      titulo="Ponto de Equilíbrio (bandejas)"
      sub="Custo fixo ÷ margem de contribuição por bandeja"
      campos={<>
        <CampoNum label="Custos fixos do mês (R$)" value={custoFixo} onChange={setCustoFixo} />
        <CampoNum label="MC por bandeja (R$)" value={margemBandeja} onChange={setMargemBandeja} />
      </>}
      resultado={
        <div className="rline">
          <span>Bandejas para empatar</span>
          <b className="big">{bandejas != null ? `${num(Math.ceil(bandejas))} bdj` : '—'}</b>
        </div>
      }
    />
  );
}
