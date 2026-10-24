export const numeroDaMaturacao = (nome) => /^matura[cçCÇ][aãAÃ]o\s*(\d+)$/i.exec(nome ?? '')?.[1];

export const galpaoDoCaderno = (codigo, nome) => {
  const n = numeroDaMaturacao(nome?.trim());
  return n ? `M${n}` : codigo;
};

export const tradutorDeGalpao = (regras = []) => (texto) => (texto == null ? texto
  : String(texto).split(', ')
    .map((c) => galpaoDoCaderno(c, regras.find((r) => r.galpao_codigo === c)?.observacao)).join(', '));
