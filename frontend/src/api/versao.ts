export function precisaAtualizar(versaoDoBundle: string | null | undefined, versaoDoServidor: string | null | undefined): boolean {
  return Boolean(versaoDoBundle && versaoDoServidor && versaoDoBundle !== versaoDoServidor);
}
