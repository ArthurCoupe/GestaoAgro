import { useState } from 'react';
import {
  CapacidadeCalc, CustoBandeja, MargemContribuicaoCalc, PaybackCalc,
  PontoEquilibrioCalc, Precificacao, RoiCalc,
} from '../components/calculadoras';

const TABS = [
  { id: 'custos', rotulo: 'Custos & Preço' },
  { id: 'margem', rotulo: 'Margem de Contribuição' },
  { id: 'equilibrio', rotulo: 'Equilíbrio & Capacidade' },
  { id: 'investimento', rotulo: 'Investimento' },
];

export function Indicadores() {
  const [tab, setTab] = useState('custos');

  return (
    <>
      <div className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={`tab ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}>{t.rotulo}</button>
        ))}
      </div>

      {tab === 'custos' && (
        <div className="row r-1-1">
          <CustoBandeja />
          <Precificacao />
        </div>
      )}
      {tab === 'margem' && <MargemContribuicaoCalc />}
      {tab === 'equilibrio' && (
        <div className="row r-1-1">
          <PontoEquilibrioCalc />
          <CapacidadeCalc />
        </div>
      )}
      {tab === 'investimento' && (
        <div className="row r-1-1">
          <RoiCalc />
          <PaybackCalc />
        </div>
      )}
    </>
  );
}
