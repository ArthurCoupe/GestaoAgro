import { useState } from 'react';
import type { Pessoa } from '../api/client';

const OUTRA = '__outra__';

export function SelectPessoa({ id, valor, onChange, pessoas, rotulo, onCriar }: {
  id: string;
  valor: string;
  onChange: (nome: string) => void;
  pessoas: Pessoa[];
  rotulo: string;
  onCriar: (nome: string) => Promise<unknown>;
}) {
  const ativas = pessoas.filter((p) => p.ativa);
  const [outra, setOutra] = useState(false);
  const [texto, setTexto] = useState('');
  const mostraInput = outra || (valor !== '' && !ativas.some((p) => p.nome === valor));

  async function confirmar(nome: string) {
    const limpo = nome.trim();
    if (!limpo) return;
    await onCriar(limpo);
    onChange(limpo);
    setOutra(false);
  }

  return (
    <div className="fg">
      <label htmlFor={id}>{rotulo}</label>
      {mostraInput ? (
        <input
          id={id}
          placeholder="nome"
          value={texto || valor}
          onChange={(e) => setTexto(e.target.value)}
          onBlur={(e) => confirmar(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            confirmar((e.target as HTMLInputElement).value);
          }}
        />
      ) : (
        <select
          id={id}
          value={valor}
          onChange={(e) => (e.target.value === OUTRA ? setOutra(true) : onChange(e.target.value))}
        >
          <option value="">—</option>
          {ativas.map((p) => <option key={p.id} value={p.nome}>{p.nome}</option>)}
          <option value={OUTRA}>Outra pessoa…</option>
        </select>
      )}
    </div>
  );
}

const SEPARADOR = ', ';

export const separarNomes = (texto: string): string[] =>
  texto.split(',').map((n) => n.trim()).filter((n) => n !== '');

export const juntarNomes = (nomes: string[]): string =>
  nomes.map((n) => n.trim()).filter((n) => n !== '').join(SEPARADOR);

export function SelectPessoas({ id, valor, onChange, pessoas, rotulo, onCriar }: {
  id: string;
  valor: string;
  onChange: (nomes: string) => void;
  pessoas: Pessoa[];
  rotulo: string;
  onCriar: (nome: string) => Promise<unknown>;
}) {
  const nomes = separarNomes(valor);
  const [extra, setExtra] = useState(0);
  const linhas = [...(nomes.length === 0 ? [''] : nomes), ...Array<string>(extra).fill('')];
  const publicar = (novas: string[]) => {
    const cheias = novas.filter((n) => n.trim() !== '');
    const brancas = novas.length - cheias.length;
    setExtra(Math.max(0, cheias.length === 0 ? brancas - 1 : brancas));
    onChange(juntarNomes(cheias));
  };
  const trocar = (i: number, nome: string) => publicar(linhas.map((n, j) => (j === i ? nome : n)));
  const tirar = (i: number) => publicar(linhas.filter((_, j) => j !== i));
  return (
    <div className="fg">
      {linhas.map((nome, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
          <div style={{ flex: 1 }}>
            <SelectPessoa id={i === 0 ? id : `${id}-${i + 1}`} valor={nome} pessoas={pessoas}
              rotulo={i === 0 ? rotulo : `${rotulo} (${i + 1}ª)`} onCriar={onCriar}
              onChange={(n) => trocar(i, n)} />
          </div>
          {linhas.length > 1 && (
            <button type="button" className="btn ghost" aria-label={`Tirar ${nome || 'pessoa'}`}
              onClick={() => tirar(i)}>×</button>
          )}
        </div>
      ))}
      <button type="button" className="btn ghost" onClick={() => setExtra(extra + 1)}>
        + mais uma pessoa
      </button>
    </div>
  );
}
