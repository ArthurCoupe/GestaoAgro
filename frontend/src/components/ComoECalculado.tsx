import { Fragment, type ReactNode } from 'react';
import { DEFINICOES, type ChaveDaDefinicao } from '../api/definicoes';

export function ComoECalculado({ chave, extra }: { chave: ChaveDaDefinicao | ChaveDaDefinicao[]; extra?: ReactNode }) {
  const chaves = Array.isArray(chave) ? chave : [chave];
  return (
    <details className="como-e-calculado">
      <summary>Como é calculado</summary>
      {chaves.map((c) => {
        const d = DEFINICOES[c];
        return (
          <Fragment key={c}>
            <p className="obs-tela"><b>{d.nome}</b> = {d.formula}</p>
            {d.nota && <p className="obs-tela">{d.nota}</p>}
          </Fragment>
        );
      })}
      {extra != null && <p className="obs-tela">{extra}</p>}
    </details>
  );
}
