import { useState } from 'react';
import { brl, pct } from '../../api/client';
import { Panel } from '../ui';

const LINHAS = [
  { k: 'SP', nome: 'Shimeji Preto (SP)', rec: 11000, cv: 9000 },
  { k: 'SB', nome: 'Shimeji Branco (SB)', rec: 8000, cv: 6200 },
  { k: 'SH', nome: 'Shiitake (SH)', rec: 40200, cv: 22100 },
];

export function MargemContribuicaoCalc() {
  const [valores, setValores] = useState(
    Object.fromEntries(LINHAS.map((l) => [l.k, { rec: l.rec, cv: l.cv }])),
  );

  const set = (k: string, campo: 'rec' | 'cv', v: number) =>
    setValores((s) => ({ ...s, [k]: { ...s[k], [campo]: v } }));

  const totRec = LINHAS.reduce((s, l) => s + valores[l.k].rec, 0);
  const totCv = LINHAS.reduce((s, l) => s + valores[l.k].cv, 0);
  const totMc = totRec - totCv;

  return (
    <Panel
      title="Margem de Contribuição por Linha"
      sub="MC = receita − custo variável, por espécie"
      tag="calculadora"
    >
      <div className="tbl-scroll">
        <table className="tbl">
          <thead>
            <tr><th>Linha</th><th>Receita (R$)</th><th>Custo variável (R$)</th><th>MC</th><th>MC%</th></tr>
          </thead>
          <tbody>
            {LINHAS.map((l) => {
              const { rec, cv } = valores[l.k];
              const mc = rec - cv;
              return (
                <tr key={l.k}>
                  <td><b>{l.nome}</b></td>
                  <td>
                    <input type="number" value={rec} style={{ width: 110, padding: 6 }}
                      onChange={(e) => set(l.k, 'rec', Number(e.target.value))} />
                  </td>
                  <td>
                    <input type="number" value={cv} style={{ width: 110, padding: 6 }}
                      onChange={(e) => set(l.k, 'cv', Number(e.target.value))} />
                  </td>
                  <td className="num"><b>{brl(mc)}</b></td>
                  <td className="num">{rec > 0 ? pct((mc / rec) * 100) : '—'}</td>
                </tr>
              );
            })}
            <tr style={{ fontWeight: 800 }}>
              <td>Total</td>
              <td className="num">{brl(totRec)}</td>
              <td className="num">{brl(totCv)}</td>
              <td className="num">{brl(totMc)}</td>
              <td className="num">{totRec > 0 ? pct((totMc / totRec) * 100) : '—'}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
