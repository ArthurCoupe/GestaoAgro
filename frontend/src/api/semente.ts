export function gerador(semente: number) {
  let s = semente >>> 0;
  const proximo = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const entre = (min: number, max: number) => min + (max - min) * proximo();
  return {
    proximo,
    entre,
    inteiro: (min: number, max: number) => Math.floor(entre(min, max + 1)),
    escolher: <T>(lista: readonly T[]): T => lista[Math.floor(proximo() * lista.length)],
  };
}

export const r2 = (v: number) => Math.round(v * 100) / 100;
export const r4 = (v: number) => Math.round(v * 10000) / 10000;
