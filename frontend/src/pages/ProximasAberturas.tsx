import { Fragment, useEffect, useState, type ReactNode } from 'react';
import {
  dataBr, fmPctFrac, getPrevisaoAbertura, getRegrasMaturacao, num, ordenarGalpoes, rotuloDoGalpao,
  type EstanteConcluidaComSobra, type PrevisaoAberturaLinha, type PrevisaoAberturaResposta, type RegraMaturacao,
} from '../api/client';
import { BotaoExportar } from '../components/BotaoExportar';
import { rotuloDaOrigemDoPrazo } from '../components/BlocosOperacionais';
import { Kpi, Panel, Pill, useToast } from '../components/ui';
import {
  linhasPorLote, proximosAAbrir, proximosAVencer, situacaoDoGrupo,
  textoDasEstantes, textoDosBlocos, vencidos, type LinhaPorLote,
} from './filaPorLote';
import { copiarTexto, negritoDoWhatsApp, OLA_PESSOAL } from './Sementes';
import { fraseDaFila } from './PainelOperacional';
import { filtrarPorHorizonte } from '../../../src/services/horizonteDaFila.js';

const HORIZONTES: Array<[string, string]> = [
  ['7', 'Vencidos + 7 dias'], ['15', 'Vencidos + 15 dias'], ['30', 'Vencidos + 30 dias'],
];
export const TIPOS = [
  { v: '', rotulo: 'Todos' }, { v: 'SH', rotulo: 'Shiitake' },
  { v: 'SB', rotulo: 'Shimeji Branco' }, { v: 'SP', rotulo: 'Shimeji Preto' },
  { v: 'SS', rotulo: 'Shimeji Salmão' },
];
export const ROTULO_TIPO: Record<string, string> = {
  SH: 'Shiitake', SB: 'Shimeji Branco', SP: 'Shimeji Preto', SS: 'Shimeji Salmão',
};

export const plural = (n: number, um: string, varios: string) => `${num(n)} ${n === 1 ? um : varios}`;

export const MOTIVO_FORA: Record<NonNullable<PrevisaoAberturaLinha['motivo_fora']>, string> = {
  ZERADO: 'o que entrou já foi aberto, contaminado ou baixado como perda',
  SALDO_NEGATIVO: 'a conta não fecha: conferir o lançamento',
  ENCERRADO_SEM_CONTAGEM: 'lote encerrado, e a contagem era por lote (registro até abril)',
};

function resumoDoForaDaFila(linhas: PrevisaoAberturaLinha[]) {
  const conta = (m: PrevisaoAberturaLinha['motivo_fora']) => linhas.filter((l) => l.motivo_fora === m).length;
  const negativos = conta('SALDO_NEGATIVO');
  const encerrados = conta('ENCERRADO_SEM_CONTAGEM');
  const zerados = linhas.length - negativos - encerrados;
  const partes = [
    negativos > 0 && `${plural(negativos, 'endereço', 'endereços')} com a conta que não fecha: pede conferência`,
    zerados > 0 && `${num(zerados)} sem saldo (já abriu, contaminou ou foi baixado como perda)`,
    encerrados > 0 && `${num(encerrados)} de lote já encerrado`,
  ].filter(Boolean);
  return `${plural(linhas.length, 'endereço saiu', 'endereços saíram')} da fila: ${partes.join(' · ')}.`;
}

export function unirGalpoes(conhecidos: string[], linhas: Array<{ galpao: string | null }>): string[] {
  const todos = new Set(conhecidos);
  for (const l of linhas) if (l.galpao) todos.add(l.galpao);
  return [...todos].sort();
}

export function agruparFila(
  linhas: PrevisaoAberturaLinha[],
): Array<{ chave: string; linhas: PrevisaoAberturaLinha[] }> {
  const grupos: Array<{ chave: string; linhas: PrevisaoAberturaLinha[] }> = [];
  for (const l of linhas) {
    const chave = `${l.lote_chave}|${l.data_prevista ?? ''}`;
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.chave === chave) ultimo.linhas.push(l);
    else grupos.push({ chave, linhas: [l] });
  }
  return grupos;
}

export function alternarTipo(atual: string, v: string): string {
  if (!v) return '';
  const marcados = new Set(atual ? atual.split(',') : []);
  if (marcados.has(v)) marcados.delete(v); else marcados.add(v);
  return TIPOS.map((t) => t.v).filter((t) => t && marcados.has(t)).join(',');
}

export function partesDoCabecalho(linhas: PrevisaoAberturaLinha[]): Array<{ texto: string; forte?: boolean }> {
  const p = linhas[0];
  const d = p.dias_restantes;
  const partes: Array<{ texto: string; forte?: boolean }> = [
    { texto: dataBr(p.data_lote) },
    { texto: ROTULO_TIPO[p.tipo ?? ''] ?? p.tipo ?? '—' },
    { texto: plural(linhas.length, 'estante', 'estantes') },
  ];
  if (p.data_prevista) partes.push({ texto: `previsto para ${dataBr(p.data_prevista)}` });
  if (d != null && d < 0) partes.push({ texto: `${plural(-d, 'dia', 'dias')} de atraso`, forte: true });
  if (d === 0) partes.push({ texto: 'vence hoje', forte: true });
  if (d != null && d > 0) partes.push({ texto: `em ${plural(d, 'dia', 'dias')}` });
  if (p.situacao === 'DATA_INCONSISTENTE') partes.push({ texto: 'data do lote no futuro: verificar dia/mês', forte: true });
  if (p.lote_parcialmente_aberto) partes.push({ texto: 'parte do lote já foi aberta' });
  return partes;
}

const guardadosDaLinha = (l: PrevisaoAberturaLinha) => (l.origem_quantidade === 'ESTANTE' ? num(l.blocos_guardados)
  : l.origem_quantidade === 'LOTE' ? `${num(l.blocos_guardados_lote)} no lote` : 'não informado');

export function linhaDaEstanteParaOGrupo(l: PrevisaoAberturaLinha, regras: Parameters<typeof rotuloDoGalpao>[1]): string {
  const partes = [
    `Galpão ${l.galpao != null ? rotuloDoGalpao(l.galpao, regras) : '—'}`,
    `Estante ${l.estante ?? '—'}`,
    `Guardados ${guardadosDaLinha(l)}`,
    `Contaminados ${num(l.blocos_contaminados)}`,
  ];
  if ((l.blocos_perdidos ?? 0) > 0) partes.push(`Perdas ${num(l.blocos_perdidos ?? 0)}`);
  partes.push(`Disponíveis para abrir ${l.blocos_disponiveis == null ? '—' : num(l.blocos_disponiveis)}${l.saldo_negativo ? ' ⚠' : ''}`);
  if (l.estante_parcialmente_aberta) partes.push(`já abriu ${num(l.blocos_abertos ?? 0)}, abertura não concluída`);
  return partes.join(' · ');
}

export function textoDaFilaParaOGrupo(
  grupos: Array<{ linhas: PrevisaoAberturaLinha[] }>,
  regras: Parameters<typeof rotuloDoGalpao>[1],
  { orientacao }: { orientacao: string },
): string {
  const lotes = grupos.map(({ linhas }) => [
    negritoDoWhatsApp(partesDoCabecalho(linhas).map((p) => p.texto).join(' · ')),
    ...linhas.map((l) => linhaDaEstanteParaOGrupo(l, regras)),
  ].join('\n'));
  const fim = negritoDoWhatsApp(orientacao).trim();
  return [
    `${OLA_PESSOAL}\nSegue a lista dos próximos lotes a abrir.`,
    ...lotes, ...(fim ? [fim] : []),
  ].join('\n\n');
}

function CopiarParaOGrupo({ grupos, regras, carregando }: {
  grupos: Array<{ linhas: PrevisaoAberturaLinha[] }>; regras: Parameters<typeof rotuloDoGalpao>[1]; carregando: boolean;
}) {
  const toast = useToast();
  const [orientacao, setOrientacao] = useState('');
  const montar = () => textoDaFilaParaOGrupo(grupos, regras, { orientacao });
  const falhou = 'Não deu para copiar; abra "Ver o texto" e selecione.';
  const copiar = () => {
    try {
      copiarTexto(montar(), navigator.clipboard).then((ok) => toast(ok ? 'Copiado.' : falhou, !ok));
    } catch {
      toast(falhou, true);
    }
  };
  return (
    <div className="no-print" style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div className="fg" style={{ flex: '1 1 320px' }}>
          <label htmlFor="pa-orientacao">Orientação do dia (vai no fim da mensagem, em negrito)</label>
          <textarea id="pa-orientacao" rows={2} value={orientacao} onChange={(e) => setOrientacao(e.target.value)}
            placeholder="Ex.: seguir a orientação da direção antes de abrir; enviar o caderno de abertura no fim do dia." />
        </div>
        <button type="button" className="btn" disabled={grupos.length === 0 || carregando} onClick={copiar}>
          {carregando ? 'Atualizando a fila…' : 'Copiar para o grupo'}
        </button>
      </div>
      {grupos.length > 0 && !carregando && (
        <details style={{ marginTop: 6 }}>
          <summary>Ver o texto</summary>
          <pre className="obs-tela" style={{ whiteSpace: 'pre-wrap' }}>{montar()}</pre>
        </details>
      )}
    </div>
  );
}

const irPara = (id: string) => () => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

const HORIZONTE_PADRAO = '7';
const horizonteEfetivo = (h: string) => (HORIZONTES.some(([v]) => v === h) ? h : HORIZONTE_PADRAO);

function LinhaDeLote({ l, i, modo, regras }: {
  l: LinhaPorLote; i: number; modo: 'abrir' | 'vencer' | 'vencidos'; regras: Parameters<typeof rotuloDoGalpao>[1];
}) {
  const origemPrazo = rotuloDaOrigemDoPrazo(l.parametro_origem);
  return (
    <tr>
      <td className="num">{i + 1}</td>
      <td className="rotulo">{dataBr(l.data_lote)}</td>
      <td className="rotulo">{ROTULO_TIPO[l.tipo ?? ''] ?? l.tipo ?? '—'}</td>
      {modo === 'vencer' && <td className="rotulo">{l.data_prevista ? dataBr(l.data_prevista) : '—'}</td>}
      <td className="rotulo">
        {modo === 'vencidos' ? num(-(l.dias_restantes ?? 0)) : situacaoDoGrupo(l.dias_restantes)}
        {origemPrazo !== null && <> <Pill tone="neutral">{origemPrazo}</Pill></>}
      </td>
      <td className="rotulo">{l.galpoes.length ? l.galpoes.map((g) => rotuloDoGalpao(g, regras)).join(', ') : '—'}</td>
      <td className="rotulo">{textoDasEstantes(l, regras)}</td>
      <td className="num">{textoDosBlocos(l)}</td>
    </tr>
  );
}

function TabelaDeLotes({ lotes, modo, vazio, regras }: {
  lotes: LinhaPorLote[]; modo: 'abrir' | 'vencer' | 'vencidos'; vazio: string; regras: Parameters<typeof rotuloDoGalpao>[1];
}) {
  if (lotes.length === 0) return <div className="empty">{vazio}</div>;
  return (
    <div className="plan-wrap">
      <table className="plan">
        <thead>
          <tr>
            <th className="num">{modo === 'vencer' ? 'Ordem' : 'Prioridade'}</th>
            <th className="rotulo">Lote / data de produção</th>
            <th className="rotulo">Tipo</th>
            {modo === 'vencer' && <th className="rotulo">Data prevista</th>}
            <th className="rotulo">{modo === 'vencer' ? 'Faltam' : modo === 'vencidos' ? 'Dias de atraso' : 'Situação do prazo'}</th>
            <th className="rotulo">Galpão</th>
            <th className="rotulo">Estante(s)</th>
            <th className="num">{modo === 'vencidos' ? 'Disponíveis para abrir' : 'Blocos disponíveis'}</th>
          </tr>
        </thead>
        <tbody>{lotes.map((l, i) => <LinhaDeLote key={l.chave} l={l} i={i} modo={modo} regras={regras} />)}</tbody>
      </table>
    </div>
  );
}

function Esqueleto({ children }: { children: ReactNode }) {
  return <div id="pa-resumo">{children}</div>;
}

function FilaDeAbertura() {
  const [dados, setDados] = useState<PrevisaoAberturaResposta | null>(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [tipo, setTipo] = useState('');
  const [galpao, setGalpao] = useState('');
  const [horizonte, setHorizonte] = useState(HORIZONTE_PADRAO);
  const [abrirFora, setAbrirFora] = useState(false);
  const [galpoes, setGalpoes] = useState<string[]>([]);
  const [regras, setRegras] = useState<RegraMaturacao[]>([]);
  useEffect(() => {
    getRegrasMaturacao().then(setRegras).catch(() => setRegras([]));
  }, []);
  const [todosVencidos, setTodosVencidos] = useState(false);

  useEffect(() => {
    let vivo = true;
    setErro('');
    setCarregando(true);
    getPrevisaoAbertura({
      tipo: tipo || undefined,
      galpao: galpao || undefined,
      horizonte: horizonte === 'tudo' || horizonte === 'vencidos' ? undefined : horizonte,
    })
      .then((r) => {
        if (!vivo) return;
        setDados(r); setCarregando(false);
        setGalpoes((prev) => unirGalpoes(prev, [...r.linhas, ...r.fora_da_fila]));
      })
      .catch((e) => { if (vivo) { setErro(e?.response?.data?.erro ?? e.message); setCarregando(false); } });
    return () => { vivo = false; };
  }, [tipo, galpao, horizonte]);

  if (erro) return <Esqueleto><div className="empty">Erro: {erro}</div></Esqueleto>;
  if (!dados) return <Esqueleto><div className="loading">Montando a fila de abertura…</div></Esqueleto>;

  return (
    <SecoesDaFila
      dados={dados}
      filtros={{ tipo, galpao, horizonte, galpoes, regras }}
      setTipo={setTipo}
      setGalpao={setGalpao}
      setHorizonte={setHorizonte}
      abrirFora={abrirFora}
      setAbrirFora={() => setAbrirFora((v) => !v)}
      todosVencidos={todosVencidos}
      setTodosVencidos={() => setTodosVencidos((v) => !v)}
      carregando={carregando}
    />
  );
}

type SecoesDaFilaProps = {
  dados: PrevisaoAberturaResposta;
  filtros: {
    tipo: string; galpao: string; horizonte: string; galpoes: string[];
    regras?: Array<{ galpao_codigo: string; observacao?: string | null }>;
  };
  setTipo: (v: string) => void;
  setGalpao: (v: string) => void;
  setHorizonte: (v: string) => void;
  abrirFora: boolean;
  setAbrirFora: () => void;
  todosVencidos: boolean;
  setTodosVencidos: () => void;
  carregando?: boolean;
};

export function SecoesDaFila({
  dados, filtros, setTipo, setGalpao, setHorizonte,
  abrirFora, setAbrirFora, todosVencidos, setTodosVencidos, carregando = false,
}: SecoesDaFilaProps) {
  const { tipo, galpao, horizonte, galpoes, regras = [] } = filtros;
  const { resumo } = dados;
  const visiveis = filtrarPorHorizonte(dados.linhas, horizonte);
  const { cobertura } = resumo;

  const grupos = agruparFila(visiveis);
  const temPerda = (ls: PrevisaoAberturaLinha[]) => ls.some((l) => (l.blocos_perdidos ?? 0) > 0);
  const filaComPerdas = temPerda(visiveis);
  const foraComPerdas = temPerda(dados.fora_da_fila);
  const lotes = linhasPorLote(agruparFila(dados.linhas));
  const aAbrir = proximosAAbrir(lotes);
  const aVencer = proximosAVencer(lotes);
  const todosOsVencidos = vencidos(lotes);
  const vencidosVisiveis = todosVencidos ? todosOsVencidos : todosOsVencidos.slice(0, 5);
  const horizonteDias = horizonteEfetivo(horizonte);

  return (
    <>
      <Panel id="pa-resumo" title="Próximas Aberturas"
        sub={fraseDaFila(dados.hoje, dados.ultimos_lancamentos, tipo)}>
        <div className="kpi-grid k4">
          <Kpi label="Passaram do prazo" onClick={irPara('pa-vencidos')}
            value={plural(todosOsVencidos.length, 'lote', 'lotes')}
            delta={`${num(resumo.por_situacao.VENCIDO.blocos)} blocos · ${plural(resumo.por_situacao.VENCIDO.enderecos, 'endereço', 'endereços')}`}
            tone={resumo.por_situacao.VENCIDO.enderecos > 0 ? 'alert' : undefined} />
          <Kpi label="Próximos a abrir" onClick={irPara('pa-a-abrir')}
            value={plural(aAbrir.length, 'lote', 'lotes')}
            delta="prioridade: produção mais antiga" />
          <Kpi label="Chegando ao prazo" onClick={irPara('pa-a-vencer')}
            value={plural(lotes.filter((l) => l.situacao === 'PROXIMO').length, 'lote', 'lotes')}
            delta={`em até ${horizonteDias} dias · ${num(resumo.por_situacao.PROXIMO.blocos)} blocos · ${plural(resumo.por_situacao.PROXIMO.enderecos, 'endereço', 'endereços')}`} />
          <Kpi label="Disponíveis na fila" onClick={irPara('pa-fila')}
            value={num(resumo.cobertura.blocos_somados)}
            delta={`em ${num(resumo.cobertura.com_quantidade)} de ${plural(resumo.cobertura.enderecos, 'endereço', 'endereços')} · saldo negativo conta 0`} />
        </div>
      </Panel>

      <Panel id="pa-prazos" title="Indicadores de prazo"
        sub="Dias entre inocular e abrir, por espécie, contra o parâmetro que a gestão declarou. A mediana é o que a operação vem praticando, medida nos lotes que já abriram; a fila usa o prazo da espécie do lote, cadastrado em Prazo por Espécie, e cada linha diz qual prazo usou.">
        <div className="plan-wrap">
          <table className="plan">
            <thead>
              <tr>
                <th className="rotulo">Tipo</th>
                <th className="num">Parâmetro</th><th className="num">Mediana</th>
                <th className="num">Diferença</th><th className="num">Mín.</th>
                <th className="num">Máx.</th><th className="num">Acima do prazo</th>
                <th className="num">Lotes medidos</th><th className="num">Datas invertidas</th>
              </tr>
            </thead>
            <tbody>
              {dados.prazos.map((p) => (
                <tr key={p.tipo}>
                  <td className="rotulo">{ROTULO_TIPO[p.tipo] ?? p.tipo}</td>
                  <td className="num">{p.parametro_dias == null ? '—' : `${num(p.parametro_dias)} dias`}</td>
                  <td className="num">{p.mediana_dias == null ? '—' : `${num(p.mediana_dias)} dias`}</td>
                  <td className="num">
                    {p.desvio_mediana == null ? '—'
                      : <b style={{ color: p.desvio_mediana > 0 ? 'var(--red, #B5502F)' : 'inherit' }}>
                        {p.desvio_mediana > 0 ? '+' : ''}{num(p.desvio_mediana)}
                      </b>}
                  </td>
                  <td className="num">{p.minimo_dias == null ? '—' : num(p.minimo_dias)}</td>
                  <td className="num">{p.maximo_dias == null ? '—' : num(p.maximo_dias)}</td>
                  <td className="num">
                    {p.acima_do_parametro == null ? '—'
                      : `${num(p.acima_do_parametro)}${p.pct_acima == null ? '' : ` (${fmPctFrac(p.pct_acima)})`}`}
                  </td>
                  <td className="num">{num(p.lotes)}</td>
                  <td className="num">{p.datas_invertidas > 0 ? <b>⚠ {num(p.datas_invertidas)}</b> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="nota">
          <strong>Não marcamos lote a lote de vermelho, de propósito.</strong> Com os parâmetros declarados quase
          todo lote fica acima; o que informa é a coluna <strong>Diferença</strong>: quanto a operação abre depois
          do que o parâmetro espera, na mediana.
        </p>
        {dados.prazos.some((p) => p.datas_invertidas > 0) && (
          <p className="nota">
            ⚠ <strong>Datas invertidas</strong> são lotes com abertura registrada antes da inoculação. Ficam fora da
            mediana; é correção na planilha.
          </p>
        )}
      </Panel>

      <Panel id="pa-a-abrir" title="Próximos 5 lotes a abrir, na ordem recomendada"
        sub="Recomendação, não trava: a ordem segue a data de produção, o lote mais antigo vem primeiro. Os vencidos entram na frente; sobrando vaga, quem vence antes. A decisão de qual lote abrir continua sendo de vocês; a fila completa está abaixo.">
        <TabelaDeLotes lotes={aAbrir} modo="abrir" vazio="Nenhum lote com prazo na fila." regras={regras} />
      </Panel>

      <Panel id="pa-a-vencer" title="Próximos 5 lotes a vencer" sub="Antecipação da próxima fila: quem ainda está no prazo, de quem vence antes para quem vence depois.">
        <TabelaDeLotes lotes={aVencer} modo="vencer" vazio="Nenhum lote com prazo na fila." regras={regras} />
      </Panel>

      <Panel id="pa-vencidos" title="Passaram do prazo"
        sub={todosOsVencidos.length === 0 ? undefined
          : `${plural(todosOsVencidos.length, 'lote', 'lotes')} com o prazo vencido, do mais antigo para o mais novo${todosOsVencidos.length > 5 && !todosVencidos ? ' (os 5 primeiros)' : ''}`}>
        <TabelaDeLotes lotes={vencidosVisiveis} modo="vencidos" vazio="Nenhum lote passou do prazo." regras={regras} />
        {todosOsVencidos.length > 5 && (
          <div className="form-acao no-print">
            <button className="btn ghost" onClick={() => setTodosVencidos()}>
              {todosVencidos ? 'Ver só os 5 primeiros' : `Ver todos os ${num(todosOsVencidos.length)}`}
            </button>
          </div>
        )}
      </Panel>

      <Panel title="A fila" id="pa-fila"
        sub={`${plural(visiveis.length, 'endereço', 'endereços')} em ${plural(grupos.length, 'lote', 'lotes')}, do mais atrasado para o mais recente`}>
        <div className="filtros no-print">
          <div className="fg">
            <label id="pa-tipo">Tipo de cogumelo</label>
            <div role="group" aria-labelledby="pa-tipo" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', minHeight: 32 }}>
              {TIPOS.map((t) => (
                <label key={t.v} style={{ display: 'inline-flex', gap: 4, alignItems: 'center', fontSize: 13, fontWeight: 400, color: 'var(--ink)' }}>
                  <input type="checkbox" checked={t.v ? tipo.split(',').includes(t.v) : !tipo}
                    onChange={() => setTipo(alternarTipo(tipo, t.v))} />
                  {t.rotulo}
                </label>
              ))}
            </div>
          </div>
          <div className="fg">
            <label>Galpão</label>
            <select value={galpao} onChange={(e) => setGalpao(e.target.value)}>
              <option value="">Todos</option>
              {ordenarGalpoes(galpoes, regras).map((g) => <option key={g} value={g}>{rotuloDoGalpao(g, regras)}</option>)}
            </select>
          </div>
          <div className="fg">
            <label>Mostrar</label>
            <select value={horizonte} onChange={(e) => setHorizonte(e.target.value)}>
              <option value="vencidos">Só os vencidos</option>
              {HORIZONTES.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
              <option value="tudo">A fila inteira</option>
            </select>
          </div>
        </div>
        <div className="form-acao no-print">
          <BotaoExportar rotulo="Exportar Excel" />
          <button className="btn ghost" onClick={() => window.print()}>Imprimir a lista</button>
        </div>
        <CopiarParaOGrupo grupos={grupos} regras={regras} carregando={carregando} />
        {grupos.length === 0 && <div className="empty">Nenhum endereço nesta faixa.</div>}
        {grupos.map(({ chave, linhas }) => {
          return (
            <div key={chave} className="plan-wrap">
              <h4 className="rotulo">
                {partesDoCabecalho(linhas).map((parte, i) => (
                  <Fragment key={i}>{i > 0 && ' · '}{parte.forte ? <strong>{parte.texto}</strong> : parte.texto}</Fragment>
                ))}
              </h4>
              <table className="plan">
                <thead>
                  <tr>
                    <th className="rotulo">Galpão</th><th className="rotulo">Estante</th>
                    <th className="num">Guardados</th><th className="num">Contaminados</th>
                    {filaComPerdas && <th className="num">Perdas</th>}
                    <th className="num">Disponíveis para abrir</th>
                    <th className="rotulo">Maturação</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((l) => {
                    const origemPrazo = rotuloDaOrigemDoPrazo(l.parametro_origem);
                    return (
                    <tr key={l.estante_id}>
                      <td className="rotulo">{l.galpao != null ? rotuloDoGalpao(l.galpao, regras) : '—'}</td>
                      <td className="rotulo">{l.estante ?? '—'}</td>
                      <td className="num">{guardadosDaLinha(l)}</td>
                      <td className="num">{num(l.blocos_contaminados)}</td>
                      {filaComPerdas && <td className="num">{num(l.blocos_perdidos ?? 0)}</td>}
                      <td className="num">
                        {l.blocos_disponiveis == null ? '—' : num(l.blocos_disponiveis)}
                        {l.saldo_negativo && ' ⚠'}
                        {l.estante_parcialmente_aberta && (
                          <div className="fixvar-none">
                            já abriu {num(l.blocos_abertos ?? 0)}: abertura não concluída
                          </div>
                        )}
                      </td>
                      <td className="rotulo">
                        {l.parametro_dias == null ? '—'
                          : `dia ${num(l.dias_decorridos)} de ${num(l.parametro_dias)}`}
                        {origemPrazo !== null && <> <Pill tone="neutral">{origemPrazo}</Pill></>}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })}

        <p className="nota">
          <strong>De onde vem a quantidade.</strong> {num(cobertura.com_quantidade)} endereços
          têm a contagem na própria estante. Em <strong>{num(cobertura.quantidade_no_lote)}</strong> a
          contagem está no lote e não na estante: é o registro de até abril, quando a planilha
          trazia um número por lote; o bloco está contado, só não por endereço. E em{' '}
          <strong>{num(cobertura.sem_quantidade)}</strong> não há contagem em lugar nenhum: esse
          sim é dado faltando. A soma de blocos disponíveis usa só os{' '}
          {num(cobertura.com_quantidade)} primeiros.
        </p>
        <p className="nota">
          <strong>⚠ = saldo negativo:</strong> a planilha registra mais blocos contaminados do
          que produzidos naquele endereço. O número sai marcado, não corrigido: é o que
          permite achar a linha.
        </p>
      </Panel>

      <ConcluidasComSobra linhas={dados.concluidas_com_sobra ?? []} regras={regras} />

      {dados.fora_da_fila.length > 0 && (
        <Panel title="Fora da fila: não há o que buscar nestes endereços"
          sub={resumoDoForaDaFila(dados.fora_da_fila)}>
          <div className="form-acao no-print">
            <button className="btn ghost" onClick={() => setAbrirFora()}>
              {abrirFora ? 'Ocultar' : 'Ver'} os endereços
            </button>
          </div>
          <div className={abrirFora ? 'plan-wrap' : 'plan-wrap somente-impressao'}>
            <table className="plan">
              <thead>
                <tr>
                  <th className="rotulo">Data do Lote</th><th className="rotulo">Tipo</th>
                  <th className="rotulo">Galpão</th><th className="rotulo">Estante</th>
                  <th className="num">Guardados</th><th className="num">Contaminados</th>
                  {foraComPerdas && <th className="num">Perdas</th>}
                  <th className="num">Já abertos</th><th className="num">Disponíveis</th>
                  <th className="rotulo">Por quê</th>
                </tr>
              </thead>
              <tbody>
                {dados.fora_da_fila.map((l) => (
                  <tr key={l.estante_id}>
                    <td className="rotulo">{dataBr(l.data_lote)}</td>
                    <td className="rotulo">{ROTULO_TIPO[l.tipo ?? ''] ?? l.tipo ?? '—'}</td>
                    <td className="rotulo">{l.galpao != null ? rotuloDoGalpao(l.galpao, regras) : '—'}</td>
                    <td className="rotulo">{l.estante ?? '—'}</td>
                    <td className="num">{num(l.blocos_guardados)}</td>
                    <td className="num">{num(l.blocos_contaminados)}</td>
                    {foraComPerdas && <td className="num">{num(l.blocos_perdidos ?? 0)}</td>}
                    <td className="num">{l.blocos_abertos == null ? '—' : num(l.blocos_abertos)}</td>
                    <td className="num">{num(l.blocos_disponiveis)}{l.saldo_negativo && ' ⚠'}</td>
                    <td className="rotulo">{MOTIVO_FORA[l.motivo_fora ?? 'ZERADO']}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </>
  );
}

export function ConcluidasComSobra({ linhas, regras, abertoInicial = false }: {
  linhas: EstanteConcluidaComSobra[];
  regras: Array<{ galpao_codigo: string; observacao?: string | null }>;
  abertoInicial?: boolean;
}) {
  const [aberto, setAberto] = useState(abertoInicial);
  if (linhas.length === 0) return null;
  const total = linhas.reduce((s, l) => s + l.blocos_na_conta, 0);
  const comPerdas = linhas.some((l) => l.blocos_perdidos > 0);
  return (
    <Panel id="pa-concluidas" title="Marcadas como concluídas, com bloco na conta"
      sub={`${plural(linhas.length, 'estante marcada', 'estantes marcadas')} "Abertura concluída: Sim", com a primeira abertura nos últimos 30 dias, em que a conta ainda mostra ${plural(total, 'bloco', 'blocos')}. Vale voltar na estante e conferir se acabou mesmo.`}>
      <div className="form-acao no-print">
        <button className="btn ghost" onClick={() => setAberto((v) => !v)}>
          {aberto ? 'Ocultar' : 'Ver'} as estantes
        </button>
      </div>
      <div className={aberto ? 'plan-wrap' : 'plan-wrap somente-impressao'}>
        <table className="plan">
          <thead>
            <tr>
              <th className="rotulo">Abertura</th><th className="rotulo">Data do Lote</th>
              <th className="rotulo">Tipo</th><th className="rotulo">Galpão</th><th className="rotulo">Estante</th>
              <th className="num">Guardados</th><th className="num">Contaminados</th>
              {comPerdas && <th className="num">Perdas</th>}
              <th className="num">Abertos</th><th className="num">Na conta</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.estante_id}>
                <td className="rotulo">{dataBr(l.data_abertura)}</td>
                <td className="rotulo">{dataBr(l.data_lote)}</td>
                <td className="rotulo">{ROTULO_TIPO[l.tipo ?? ''] ?? l.tipo ?? '—'}</td>
                <td className="rotulo">{l.galpao != null ? rotuloDoGalpao(l.galpao, regras) : '—'}</td>
                <td className="rotulo">{l.estante ?? '—'}</td>
                <td className="num">{num(l.blocos_guardados)}</td>
                <td className="num">{num(l.blocos_contaminados)}</td>
                {comPerdas && <td className="num">{num(l.blocos_perdidos)}</td>}
                <td className="num">{num(l.blocos_abertos)}</td>
                <td className="num">{num(l.blocos_na_conta)}</td>
              </tr>
            ))}
            <tr>
              <td className="rotulo" colSpan={comPerdas ? 9 : 8}><strong>TOTAL</strong></td>
              <td className="num"><strong>{num(total)}</strong></td>
            </tr>
          </tbody>
        </table>
        <p className="nota">
          Na conta = Guardados − Contaminados{comPerdas ? ' − Perdas' : ''} − Abertos. Se a estante estiver vazia, a
          diferença é de registro: um bloco contaminado ou uma abertura que não foi lançada.
        </p>
      </div>
    </Panel>
  );
}

export function ProximasAberturas() {
  return <FilaDeAbertura />;
}
