import { dataBr, num } from '../api/client';
import type { EmbalagemComparacao, EmbalagemPorTipo, EmbalagemResumo as Resumo } from '../api/client';
import { Kpi, Panel } from '../components/ui';

const n1 = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const kg1 = (v: number) => `${n1(v)} kg`;
const sinal = (p: number | null) => (p == null ? '—' : `${p > 0 ? '+' : p < 0 ? '−' : ''}${n1(Math.abs(p))}%`);

export function rotuloDoPeriodo(p: { inicio: string | null; fim: string | null }): string {
  if (p.inicio && p.fim) return `${dataBr(p.inicio)} a ${dataBr(p.fim)}`;
  if (p.inicio) return `de ${dataBr(p.inicio)} em diante`;
  if (p.fim) return `até ${dataBr(p.fim)}`;
  return 'todo o histórico';
}

export function comparacaoTexto(c: EmbalagemComparacao | null): string {
  if (!c) return 'Escolha um período (De e Até) para comparar com o anterior.';
  const a = c.anterior;
  return `Comparação com o período anterior (${dataBr(c.periodo_anterior.inicio)} a ${dataBr(c.periodo_anterior.fim)}): `
    + `bandejas ${sinal(c.bandejas_200g_pct)} (antes ${num(a.bandejas_200g)}) · `
    + `embalagens de 1 kg ${sinal(c.embalagens_1kg_pct)} (antes ${num(a.embalagens_1kg)}) · `
    + `kg embalados ${sinal(c.kg_embalados_pct)} (antes ${kg1(a.kg_embalados)}) · `
    + `kg desprezados ${sinal(c.kg_desprezados_pct)} (antes ${kg1(a.kg_desprezados)})`;
}

export function tiposVisiveis(porTipo: EmbalagemPorTipo[]): EmbalagemPorTipo[] {
  return porTipo.filter((t) => t.tipo !== 'SS'
    || t.bandejas_200g > 0 || t.embalagens_1kg > 0 || t.kg_embalados > 0 || t.kg_desprezados > 0 || t.kg_colhidos > 0);
}

export function composicaoDosTotais(porTipo: EmbalagemPorTipo[]): string[] {
  const linhas: string[] = [];
  for (const t of porTipo) {
    for (const [apres, rotulo, total] of [
      ['BANDEJA_200G', 'bandejas de 200 g', t.bandejas_200g],
      ['EMBALAGEM_1KG', 'embalagens de 1 kg', t.embalagens_1kg],
    ] as const) {
      const cols = t.colunas.filter((c) => c.apresentacao === apres && c.unidades > 0);
      if (cols.length === 0) continue;
      linhas.push(`${t.nome}, ${rotulo}: ${cols.map((c) => `${c.produto} ${num(c.unidades)}`).join(' + ')} = ${num(total)}`);
    }
  }
  return linhas;
}

export function EmbalagemResumo({ resumo }: { resumo: Resumo }) {
  const t = resumo.totais;
  const composicao = composicaoDosTotais(tiposVisiveis(resumo.por_tipo));
  return (
    <Panel id="embalagem-resumo" title="Resumo do período" tag={rotuloDoPeriodo(resumo.periodo)}
      sub="Tudo por data da colheita, no período escolhido em De e Até. As unidades ficam separadas: bandeja de 200 g, embalagem de 1 kg e caixa de pimentão não se somam.">
      <div className="kpi-grid k4">
        <Kpi label="Bandejas de 200 g" value={num(t.bandejas_200g)} delta="no período selecionado" />
        <Kpi label="Embalagens de 1 kg" value={num(t.embalagens_1kg)} delta="no período selecionado" />
        <Kpi label="Kg embalados" value={kg1(t.kg_embalados)} delta="pelo peso cadastrado de cada apresentação" />
        <Kpi label="Kg desprezados" value={kg1(t.kg_desprezados)} delta="lançados em Registrar desprezo" />
      </div>
      <p className="obs-tela">{comparacaoTexto(resumo.comparacao)}</p>

      <h4>Totais por tipo de cogumelo</h4>
      <div className="tbl-scroll">
        <table className="tbl">
          <thead>
            <tr>
              <th>Tipo</th><th className="num">Bandejas 200 g</th><th className="num">Emb. 1 kg</th>
              <th className="num">Kg embalados</th><th className="num">Kg desprezados</th>
            </tr>
          </thead>
          <tbody>
            {tiposVisiveis(resumo.por_tipo).map((l) => (
              <tr key={l.tipo}>
                <td><b>{l.nome}</b> <small style={{ color: 'var(--ink-soft)' }}>{l.tipo}</small></td>
                <td className="num">{num(l.bandejas_200g)}</td>
                <td className="num">{num(l.embalagens_1kg)}</td>
                <td className="num">{n1(l.kg_embalados)}</td>
                <td className="num">{n1(l.kg_desprezados)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {composicao.length > 0 && (
        <div className="obs-tela">
          De que colunas da grade sai cada total:
          <ul>{composicao.map((l) => <li key={l}>{l}</li>)}</ul>
        </div>
      )}

      <h4>Totais por apresentação</h4>
      <div className="tbl-scroll">
        <table className="tbl">
          <thead><tr><th>Apresentação</th><th className="num">Unidades</th><th className="num">Kg</th></tr></thead>
          <tbody>
            {resumo.por_apresentacao.map((a) => (
              <tr key={a.chave}>
                <td>{a.rotulo}</td>
                <td className="num">{num(a.unidades)}</td>
                <td className="num">{a.kg == null ? <span title="peso não cadastrado">— <small>(peso não cadastrado)</small></span> : n1(a.kg)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="obs-tela">
        Bandejas de 200 g mais embalagens de 1 kg é a mesma contagem que o quadro Margem de contribuição por kg e por bandeja do Painel da Produção (aba Cogumelo) usa em bandejas embaladas (cogumelos, sem o pimentão): uma fonte só, a grade desta tela.
      </p>
    </Panel>
  );
}
