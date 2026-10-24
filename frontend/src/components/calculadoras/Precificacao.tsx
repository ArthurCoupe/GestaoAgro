import { useState } from 'react';
import { brl, pct } from '../../api/client';
import { Calculadora, CampoNum } from './CalcBase';

export function Precificacao() {
  const [custo, setCusto] = useState(8);
  const [margem, setMargem] = useState(25);
  const [impostos, setImpostos] = useState(0);
  const [comissoes, setComissoes] = useState(0);
  const [outros, setOutros] = useState(0);

  const somaPct = margem + impostos + comissoes + outros;
  const preco = somaPct < 100 ? custo / (1 - somaPct / 100) : null;
  const lucro = preco != null ? preco * (margem / 100) : null;

  return (
    <Calculadora
      titulo="Precificação"
      sub="Preço = custo ÷ [1 − (margem + impostos + comissões + outros %)]"
      campos={<>
        <CampoNum label="Custo unitário (R$)" value={custo} onChange={setCusto} />
        <CampoNum label="Margem sobre o preço (%)" value={margem} onChange={setMargem} />
        <CampoNum label="Impostos sobre venda (%)" value={impostos} onChange={setImpostos} />
        <CampoNum label="Comissões (%)" value={comissoes} onChange={setComissoes} />
        <CampoNum label="Frete/outros (%)" value={outros} onChange={setOutros} />
      </>}
      resultado={<>
        <div className="rline"><span>Percentuais no divisor</span><b>{pct(somaPct)}</b></div>
        <div className="rline"><span>Preço sugerido</span><b className="big">{brl(preco)}</b></div>
        <div className="rline"><span>Margem em R$ (por unidade)</span><b>{brl(lucro)}</b></div>
        {somaPct >= 100 && (
          <div className="rline"><span style={{ color: 'var(--red-alert)' }}>
            Os percentuais somam ≥ 100%: não existe preço que cubra margem e encargos.
          </span></div>
        )}
      </>}
    />
  );
}
