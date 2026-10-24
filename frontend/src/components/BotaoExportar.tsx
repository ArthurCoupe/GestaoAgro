export function BotaoExportar({ rotulo = 'Exportar Excel' }: { rotulo?: string }) {
  return (
      <button className="btn ghost exportar" disabled
        title="Exportação disponível no modo real: desabilitada na demonstração">
        ⬇ {rotulo}
      </button>
    );
}
