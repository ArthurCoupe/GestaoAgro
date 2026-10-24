import { useCallback, useEffect, useState } from 'react';
import { getMetasOperacionais, putMetaOperacional, type MetaOperacional } from '../api/client';
import { useAuth } from '../auth';
import { Panel, useToast } from '../components/ui';

export const rotuloDaOrigem = (o: string) =>
  (o === 'BANCO' ? 'definido pela gestão' : 'padrão do sistema');

export const ROTULOS: Record<string, string> = {
  contaminacao_meta_pct: 'Meta de contaminação',
  contaminacao_atencao_pct: 'Limiar Amarelo (Atenção)',
  contaminacao_critico_pct: 'Limiar Vermelho (Crítico)',
  contaminacao_dias_comparavel: 'Dias mínimos para a semana entrar em comparação',
  contaminacao_dias_estavel: 'Dias até a contaminação estabilizar',
  contaminacao_semanas_comparacao: 'Semanas maduras comparadas na tendência',
  contaminacao_ronda_pct: 'Alerta de Retirada Acima do Limite: retirada de uma estante numa única data a partir deste percentual',
  contaminacao_faixa1_dias: 'Faixa de tempo 1: até este dia desde a inoculação',
  contaminacao_faixa2_dias: 'Faixa de tempo 2: até este dia',
  contaminacao_faixa3_dias: 'Faixa de tempo 3: até este dia',
  contaminacao_faixa4_dias: 'Faixa de tempo 4: até este dia (acima é a quinta faixa)',
  produtividade_kg_por_bloco: 'Produtividade (kg por bloco)',
  aproveitamento_pct: 'Aproveitamento',
  perda_aceitavel_pct: 'Perda aceitável',
  qualidade_mg_pct: 'Qualidade M+G+GG',
  ocupacao_alerta_pct: 'Ocupação: alerta a partir daqui',
  embalagem_tolerancia_kg: 'Embalagem: diferença tolerada entre colhido e embalado (kg)',
  embalagem_dias_para_fechar: 'Embalagem: dias para embalar uma colheita antes de contar divergência',
  margem_operacional_minima_pct: 'Margem operacional mínima (abaixo dela, vermelho)',
  previsao_horizonte_semanas: 'Horizonte da previsão de produção (semanas)',
  semeacao_pacotes_shiitake: 'Próxima semeação: pacotes de Shiitake a separar',
  semeacao_pacotes_shimeji: 'Próxima semeação: pacotes de Shimeji (Branco e Preto) a separar',
  gramas_por_bandeja: 'Taxa de conversão: gramas por bandeja (kg colhido ÷ este peso = bandejas)',
  meta_mes_blocos_abertos: 'Meta do mês: blocos abertos',
  meta_mes_bandejas_produzidas: 'Meta do mês: bandejas produzidas (colhidas e aproveitadas)',
  meta_mes_bandejas_vendidas: 'Meta do mês: bandejas vendidas',
  ref_preco_medio_bandeja: 'Referência de preço médio da bandeja',
  ref_bandejas_por_bloco: 'Meta de bandejas por bloco aberto',
  ref_kg_por_bloco: 'Referência de kg por bloco aberto (a meta de kg do mês é a de blocos abertos vezes este valor)',
  limite_contaminacao_abertos_pct: 'Limite de contaminação dos lotes abertos no mês',
  fabricacao_blocos_por_dia: 'Fabricação: blocos por dia de fabricação',
  fabricacao_margem_contaminacao_pct: 'Fabricação necessária: contaminação prevista dos blocos novos',
  abertura_blocos_por_sala: 'Abertura: blocos por sala',
  abertura_ciclo_dias: 'Abertura: dias entre duas aberturas da mesma sala',
  abertura_salas: 'Abertura: salas em funcionamento',
};
const rotuloDaChave = (chave: string) => ROTULOS[chave] ?? chave.replaceAll('_', ' ');

export const CHAVES_COM_TELA = [
  'contaminacao_meta_pct', 'contaminacao_atencao_pct', 'contaminacao_critico_pct',
  'contaminacao_dias_comparavel', 'contaminacao_dias_estavel', 'contaminacao_semanas_comparacao',
  'contaminacao_ronda_pct',
  'contaminacao_faixa1_dias', 'contaminacao_faixa2_dias', 'contaminacao_faixa3_dias', 'contaminacao_faixa4_dias',
  'embalagem_tolerancia_kg', 'embalagem_dias_para_fechar',
  'semeacao_pacotes_shiitake', 'semeacao_pacotes_shimeji',
  'gramas_por_bandeja',
];

const NOTA_META_NAO_E_CORTE = 'A meta é a LINHA DE REFERÊNCIA da operação: não é o corte que pinta a '
  + 'cor do lote. Quem pinta são os limiares Amarelo e Vermelho, listados junto: uma meta mais exigente '
  + 'não significa que ela vá virar o corte de cor sozinha.';

export function MetasOperacionais() {
  const { usuario } = useAuth();
  const gestor = usuario?.role == null || usuario.role === 'GESTAO_GERAL';
  const toast = useToast();

  const [metas, setMetas] = useState<Record<string, MetaOperacional> | null>(null);
  const [erro, setErro] = useState('');
  const [edicao, setEdicao] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState<string | null>(null);

  const recarregar = useCallback(() => {
    setErro('');
    getMetasOperacionais()
      .then((r) => setMetas(r.metas))
      .catch((e) => setErro(e?.response?.data?.erro ?? e.message));
  }, []);
  useEffect(recarregar, [recarregar]);

  if (erro) return <div className="empty">Erro: {erro}</div>;
  if (!metas) return <div className="loading">Carregando metas e limiares…</div>;

  const chaves = Object.keys(metas)
    .filter((c) => CHAVES_COM_TELA.includes(c))
    .sort((a, b) => rotuloDaChave(a).localeCompare(rotuloDaChave(b), 'pt-BR'));

  const salvar = (chave: string) => {
    const texto = (edicao[chave] ?? '').trim();
    const valor = Number(texto);
    if (texto === '' || !Number.isFinite(valor)) return;
    setSalvando(chave);
    putMetaOperacional({ chave, valor })
      .then((r) => {
        toast(`${rotuloDaChave(chave)} atualizado para ${r.valor}${r.unidade === '%' ? '%' : ` ${r.unidade}`}, a partir de ${r.vigente_desde}.`);
        setEdicao((prev) => { const p = { ...prev }; delete p[chave]; return p; });
        recarregar();
      })
      .catch((e) => toast(e?.response?.data?.erro ?? e.message, true))
      .finally(() => setSalvando(null));
  };

  return (
    <>
      {chaves.length === 0 ? (
        <Panel title="Metas e Limiares"><div className="empty">Nenhuma meta cadastrada.</div></Panel>
      ) : (
        <Panel title="Metas e Limiares" tag={`${chaves.length} parâmetro${chaves.length === 1 ? '' : 's'}`}
          sub={NOTA_META_NAO_E_CORTE}>
          <div className="plan-wrap">
            <table className="plan">
              <thead>
                <tr>
                  <th className="rotulo">Parâmetro</th>
                  <th className="num">Valor</th>
                  <th className="rotulo">Unidade</th>
                  <th className="rotulo">Vigente desde</th>
                  <th className="rotulo">Origem</th>
                  {gestor && <th className="rotulo">Novo valor</th>}
                </tr>
              </thead>
              <tbody>
                {chaves.map((chave) => {
                  const m = metas[chave];
                  return (
                    <tr key={chave}>
                      <td className="rotulo">
                        {rotuloDaChave(chave)}
                        <div className="nota">{m.nota}</div>
                      </td>
                      <td className="num">{m.valor}</td>
                      <td className="rotulo">{m.unidade}</td>
                      <td className="rotulo">{m.vigente_desde ?? '—'}</td>
                      <td className="rotulo">{rotuloDaOrigem(m.origem)}</td>
                      {gestor && (
                        <td className="rotulo">
                          <div className="form-grid c2">
                            <input
                              type="number" step="any"
                              value={edicao[chave] ?? ''}
                              disabled={salvando === chave}
                              onChange={(e) => setEdicao({ ...edicao, [chave]: e.target.value })}
                              placeholder={String(m.valor)}
                              aria-label={`Novo valor de ${rotuloDaChave(chave)}`}
                            />
                            <button
                              className="btn"
                              disabled={salvando === chave || (edicao[chave] ?? '').trim() === ''}
                              onClick={() => salvar(chave)}
                            >
                              {salvando === chave ? 'Salvando…' : 'Salvar'}
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="nota">Cinco parâmetros ficam ocultos até existir tela que os leia. A margem operacional mínima passou a ser definida pela gestão geral em Meta da empresa, na tela Budget.</p>
        </Panel>
      )}
    </>
  );
}
