import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import {
  dataBr, getMetasOperacionais, getNecessidadeDeSementes, getSementesCepas, getSementesEstoque,
  getSementesMovimentos, hojeISO, num,
  registrarSementeMovimento, atualizarSementeMovimento, excluirSementeMovimento,
  type MetaOperacional, type NecessidadeDeSementesResposta, type SementeCepa, type SementeMovimento,
  type SementesEstoqueResposta,
} from '../api/client';
import { TopoOperacional } from '../components/BlocosOperacionais';
import { CampoData } from '../components/CampoData';
import { Panel, Pill, useConfirmar, useToast } from '../components/ui';

const TIPOS_COGUMELO = ['Shiitake', 'Shimeji Branco', 'Shimeji Preto'];

export function tiposDeCogumeloSemente(cepas: SementeCepa[]): string[] {
  const doBanco = cepas
    .filter((c) => c.ativo && c.tipo_cogumelo && !TIPOS_COGUMELO.includes(c.tipo_cogumelo))
    .map((c) => c.tipo_cogumelo);
  return [...TIPOS_COGUMELO, ...new Set(doBanco)];
}

export function cepasDoTipoSemente(cepas: SementeCepa[], tipo: string): SementeCepa[] {
  return cepas.filter((c) => c.ativo && c.tipo_cogumelo === tipo);
}

const somaDias = (iso: string, dias: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
};

const diasEntre = (de: string, ate: string) =>
  Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86_400_000);

const DIAS_DE_ATENCAO = 7;

interface ProximaSementeRemessa {
  cepa: string;
  nf: string;
  validade: string;
  quantidade: number;
  dias_para_vencer: number;
  vencida: boolean;
}
type MotivoSemConta = 'gramas_por_bloco' | 'gramas_por_saco' | 'previsao' | 'estoque' | 'rota';
interface ProximasSementesTipo {
  tipo_cogumelo: string;
  saldo_total: number;
  risco: 'INSUFICIENTE' | 'SUFICIENTE' | 'SEM_CONTA';
  motivo_sem_conta: MotivoSemConta | null;
  usar_primeiro: ProximaSementeRemessa | null;
  usar_depois: ProximaSementeRemessa | null;
  atencao: ProximaSementeRemessa[];
}

export function proximasSementesPorTipo(
  estoque: SementesEstoqueResposta,
  hoje: string,
  necessidade: NecessidadeDeSementesResposta | null = null,
): ProximasSementesTipo[] {
  const tipos: string[] = [];
  for (const c of estoque.cepas) if (!tipos.includes(c.tipo_cogumelo)) tipos.push(c.tipo_cogumelo);
  for (const t of necessidade?.por_tipo ?? []) if (!tipos.includes(t.tipo_cogumelo)) tipos.push(t.tipo_cogumelo);

  return tipos.map((tipo) => {
    const cepasDoTipo = estoque.cepas.filter((c) => c.tipo_cogumelo === tipo);
    const saldo_total = cepasDoTipo.reduce((soma, c) => soma + c.total, 0);
    const conta = necessidade?.por_tipo.find((t) => t.tipo_cogumelo === tipo) ?? null;
    const comprar = conta?.comprar_agora_sacos ?? null;
    let risco: ProximasSementesTipo['risco'] = 'SEM_CONTA';
    let motivo_sem_conta: MotivoSemConta | null = null;
    if (comprar != null) risco = comprar > 0 ? 'INSUFICIENTE' : 'SUFICIENTE';
    else motivo_sem_conta = (conta?.sem_dado[0] as MotivoSemConta | undefined) ?? 'rota';

    const remessas: Array<{ cepa: string; nf: string; validade: string; quantidade: number }> = [];
    for (const c of cepasDoTipo) {
      for (const nf of c.nfs) {
        for (const [validade, quantidade] of Object.entries(nf.valores)) {
          if (quantidade != null && quantidade > 0) remessas.push({ cepa: c.cepa, nf: nf.nf, validade, quantidade });
        }
      }
    }
    remessas.sort((a, b) => a.validade.localeCompare(b.validade) || a.cepa.localeCompare(b.cepa));

    const comPrazo: ProximaSementeRemessa[] = remessas.map((r) => {
      const dias_para_vencer = diasEntre(hoje, r.validade);
      return { ...r, dias_para_vencer, vencida: dias_para_vencer < 0 };
    });
    const emDia = comPrazo.filter((r) => !r.vencida);

    return {
      tipo_cogumelo: tipo, saldo_total, risco, motivo_sem_conta,
      usar_primeiro: emDia[0] ?? null,
      usar_depois: emDia[1] ?? null,
      atencao: comPrazo.filter((r) => r.dias_para_vencer <= DIAS_DE_ATENCAO),
    };
  });
}

export function rotuloDoAlerta(l: Pick<ProximasSementesTipo, 'tipo_cogumelo' | 'risco' | 'motivo_sem_conta'>): string {
  if (l.risco === 'INSUFICIENTE') return `Estoque de semente de ${l.tipo_cogumelo} insuficiente para a produção prevista`;
  if (l.risco === 'SUFICIENTE') return 'Estoque suficiente para a produção prevista';
  switch (l.motivo_sem_conta) {
    case 'previsao': return 'Sem previsão de produção completa: preencha em Compras de Matéria-Prima';
    case 'gramas_por_saco': return 'Falta o peso do saco em Compras de Matéria-Prima';
    case 'gramas_por_bloco': return `Falta a semente na receita de ${l.tipo_cogumelo}`;
    default: return 'Sem a conta de Compras de Matéria-Prima';
  }
}

export function Sementes() {
  const [versao, setVersao] = useState(0);
  const recarregarTudo = useCallback(() => setVersao((v) => v + 1), []);

  const [estoque, setEstoque] = useState<SementesEstoqueResposta | null>(null);
  const [erroEstoque, setErroEstoque] = useState('');
  useEffect(() => {
    setErroEstoque('');
    getSementesEstoque().then(setEstoque)
      .catch((e) => setErroEstoque(e?.response?.data?.erro ?? e.message));
  }, [versao]);

  const [necessidade, setNecessidade] = useState<NecessidadeDeSementesResposta | null>(null);
  const [erroNecessidade, setErroNecessidade] = useState('');
  useEffect(() => {
    setErroNecessidade('');
    getNecessidadeDeSementes().then(setNecessidade)
      .catch((e) => setErroNecessidade(e?.response?.data?.erro ?? e.message));
  }, [versao]);

  const [metas, setMetas] = useState<Record<string, MetaOperacional> | null>(null);
  const [erroMetas, setErroMetas] = useState('');
  useEffect(() => {
    getMetasOperacionais().then((r) => setMetas(r.metas))
      .catch((e) => setErroMetas(e?.response?.data?.erro ?? e.message));
  }, []);

  return (
    <>
      <SecaoProximaSemeacao estoque={estoque} erro={erroEstoque} metas={metas} erroMetas={erroMetas} />
      <SecaoEstoquePorVencimento estoque={estoque} erro={erroEstoque} />
      <TopoOperacional key={versao} dominio="SEMENTES" id="sementes-topo" titulo="Ações do dia: Sementes" />
      <SecaoProximas estoque={estoque} erroEstoque={erroEstoque}
        necessidade={necessidade} erroNecessidade={erroNecessidade} />
      <SecaoEstoque dados={estoque} erro={erroEstoque} />
      <SecaoAtividade versao={versao} aoSalvar={recarregarTudo} />
    </>
  );
}

type LinhaASeparar = SementesEstoqueResposta['a_separar'][number];

const pacotes = (n: number) => `${num(n)} ${n === 1 ? 'pacote' : 'pacotes'}`;

export function sementesDoTipo(linhas: SementesEstoqueResposta['a_separar'], tipo: string): SementesEstoqueResposta['a_separar'] {
  return tipo ? linhas.filter((l) => l.tipo_cogumelo === tipo) : linhas;
}

export function separarParaSemeacao(linhas: LinhaASeparar[], quantidade: number, dataSemeacao: string)
  : { linhas: Array<LinhaASeparar & { separar: number }>; faltam: number } {
  let resta = quantidade;
  const usadas: Array<LinhaASeparar & { separar: number }> = [];
  for (const l of linhas) {
    if (resta <= 0) break;
    if (l.validade < dataSemeacao) continue;
    const separar = Math.min(l.saldo, resta);
    usadas.push({ ...l, separar });
    resta -= separar;
  }
  return { linhas: usadas, faltam: resta };
}

export const CHAVE_DA_SEMEACAO: Record<string, string> = {
  Shiitake: 'semeacao_pacotes_shiitake',
  'Shimeji Branco': 'semeacao_pacotes_shimeji',
  'Shimeji Preto': 'semeacao_pacotes_shimeji',
};

export interface SemeacaoDoTipo {
  tipo: string;
  pacotes: number | null;
  linhas: Array<LinhaASeparar & { separar: number }>;
  faltam: number;
}

export function planoDaSemeacao(
  aSeparar: SementesEstoqueResposta['a_separar'], tipos: string[], dataSemeacao: string,
  metas: Record<string, Pick<MetaOperacional, 'valor'>>,
): SemeacaoDoTipo[] {
  return tipos.map((tipo) => {
    const pacotes = metas[CHAVE_DA_SEMEACAO[tipo]]?.valor ?? null;
    if (pacotes == null) return { tipo, pacotes, linhas: [], faltam: 0 };
    return { tipo, pacotes, ...separarParaSemeacao(sementesDoTipo(aSeparar, tipo), pacotes, dataSemeacao) };
  });
}

export const OLA_PESSOAL = 'Olá, pessoal!\nTudo bem?';

export const negritoDoWhatsApp = (texto: string) =>
  texto.split('\n').map((l) => l.replace(/\*/g, '').trim()).map((l) => (l ? `*${l}*` : '')).join('\n');

export function textoDaSemeacaoParaOGrupo(plano: SemeacaoDoTipo[], dataSemeacao: string): string {
  const dia = dataBr(dataSemeacao).slice(0, 5);
  const blocos = plano.map((t) => {
    const tipo = t.tipo.toUpperCase();
    if (t.pacotes == null) return `Atenção: falta em Metas e Limiares a quantidade de pacotes de ${tipo}.`;
    const total = t.linhas.reduce((s, l) => s + l.separar, 0);
    return [
      negritoDoWhatsApp(`Semeação: ${dia} / Tipo: ${tipo} / Total: ${pacotes(total)}`),
      ...t.linhas.map((l) => `Tipo: ${tipo} / Semente: ${l.cepa} / NF: ${l.nf} / `
        + `Validade: ${dataBr(l.validade).slice(0, 5)} / Quantidade: ${pacotes(l.separar)}`),
      ...(t.faltam > 0 ? [`Atenção: faltam ${pacotes(t.faltam)} de ${tipo} para completar os ${pacotes(t.pacotes)}.`] : []),
    ].join('\n');
  });
  return [`${OLA_PESSOAL}\nSegue a lista dos próximos lotes de SEMENTES para abrir:`, ...blocos].join('\n\n');
}

export function fraseDoVencimento(dias: number): string {
  if (dias === 0) return 'vence hoje';
  const n = Math.abs(dias);
  const plural = n === 1 ? '' : 's';
  return dias < 0 ? `vencida há ${n} dia${plural}` : `vence em ${n} dia${plural}`;
}

export async function copiarTexto(
  texto: string,
  clipboard: Pick<Clipboard, 'writeText'> | undefined,
): Promise<boolean> {
  if (!clipboard) return false;
  try {
    await clipboard.writeText(texto);
    return true;
  } catch {
    return false;
  }
}

export function SecaoProximaSemeacao({ estoque, erro, metas, erroMetas, tiposIniciais = [], dataInicial }: {
  estoque: SementesEstoqueResposta | null;
  erro: string;
  metas: Record<string, MetaOperacional> | null;
  erroMetas: string;
  tiposIniciais?: string[];
  dataInicial?: string;
}) {
  const toast = useToast();
  const [tipos, setTipos] = useState<string[]>(tiposIniciais);
  const [dataSemeacao, setDataSemeacao] = useState(() => dataInicial ?? somaDias(hojeISO(), 1));
  if (erro || erroMetas) return <div className="empty">Erro: {erro || erroMetas}</div>;
  if (!estoque || !metas) return <div className="loading">Carregando a próxima semeação…</div>;

  const marcados = TIPOS_COGUMELO.filter((t) => tipos.includes(t));
  const plano = dataSemeacao ? planoDaSemeacao(estoque.a_separar, marcados, dataSemeacao, metas) : [];
  const montar = () => textoDaSemeacaoParaOGrupo(plano, dataSemeacao);
  const rotina = (tipo: string) => metas[CHAVE_DA_SEMEACAO[tipo]]?.valor ?? '—';
  const alternar = (t: string) => setTipos((atual) => (atual.includes(t) ? atual.filter((x) => x !== t) : [...atual, t]));

  const imprimir = () => {
    document.body.classList.add('imprimir-so-separar');
    window.addEventListener('afterprint', () => document.body.classList.remove('imprimir-so-separar'), { once: true });
    window.print();
  };
  const copiar = () => {
    try {
      copiarTexto(montar(), navigator.clipboard)
        .then((ok) => toast(ok ? 'Copiado.' : 'Não deu para copiar; selecione o texto.', !ok));
    } catch {
      toast('Não deu para copiar; selecione o texto.', true);
    }
  };

  return (
    <Panel id="sementes-a-separar"
      title={`Semente para próxima semeação${dataSemeacao ? `: ${dataBr(dataSemeacao).slice(0, 5)}` : ''}`}
      sub={`Marque o tipo que vai semear. A quantidade é a da rotina, em Metas e Limiares (Shiitake ${rotina('Shiitake')}, `
        + `Shimeji ${rotina('Shimeji Branco')} pacotes), e sai da remessa que vence primeiro, completando com a próxima só se faltar. `
        + 'A tela, o Imprimir e o Copiar para o grupo saem desta mesma conta.'}>
      <div className="no-print" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
        <label htmlFor="semeacao-data">Semeação</label>
        <div style={{ width: 140 }}><CampoData id="semeacao-data" value={dataSemeacao} onChange={setDataSemeacao} /></div>
        <span id="semeacao-tipo">Tipo de cogumelo</span>
        <div role="group" aria-labelledby="semeacao-tipo" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {TIPOS_COGUMELO.map((t) => (
            <label key={t} style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
              <input type="checkbox" checked={tipos.includes(t)} onChange={() => alternar(t)} />
              {t}
            </label>
          ))}
        </div>
      </div>
      {!dataSemeacao ? <div className="empty">Informe a data da semeação.</div>
        : marcados.length === 0 ? <div className="empty">Marque o tipo de cogumelo que vai semear.</div>
          : (
            <>
              {plano.filter((t) => t.pacotes == null || t.faltam > 0).map((t) => (
                <div key={t.tipo} style={{ marginBottom: 10 }}>
                  <Pill tone="warn">
                    {t.pacotes == null
                      ? `Falta em Metas e Limiares a quantidade de pacotes de ${t.tipo}`
                      : `Faltam ${pacotes(t.faltam)} para os ${pacotes(t.pacotes)} de ${t.tipo}: não há mais semente dentro da validade em ${dataBr(dataSemeacao)}`}
                  </Pill>
                </div>
              ))}
              {plano.some((t) => t.linhas.length > 0) && (
                <div className="tbl-scroll">
                  <table className="tbl">
                    <thead>
                      <tr><th>Tipo</th><th>Semente</th><th>NF</th><th>Validade</th><th className="num">Separar (pacotes)</th></tr>
                    </thead>
                    <tbody>
                      {plano.filter((t) => t.linhas.length > 0).map((t) => (
                        <Fragment key={t.tipo}>
                          {t.linhas.map((l) => (
                            <tr key={`${l.cepa}-${l.nf}-${l.validade}`}>
                              <td>{t.tipo}</td><td>{l.cepa}</td><td>{l.nf}</td><td>{dataBr(l.validade)}</td>
                              <td className="num">{num(l.separar)}</td>
                            </tr>
                          ))}
                          <tr className="ln-destaque">
                            <td colSpan={4}>{`Total ${t.tipo}`}</td>
                            <td className="num">{num(t.linhas.reduce((s, l) => s + l.separar, 0))}</td>
                          </tr>
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="no-print" style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                {plano.some((t) => t.linhas.length > 0) && (
                  <button type="button" className="btn ghost" onClick={imprimir}>Imprimir</button>
                )}
                <button type="button" className="btn ghost" onClick={copiar}>Copiar para o grupo</button>
              </div>
              <pre className="obs-tela no-print" style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>{montar()}</pre>
            </>
          )}
    </Panel>
  );
}

export function SecaoEstoquePorVencimento({ estoque, erro, tipoInicial = '' }: {
  estoque: SementesEstoqueResposta | null;
  erro: string;
  tipoInicial?: string;
}) {
  const [tipo, setTipo] = useState(tipoInicial);
  if (erro) return <div className="empty">Erro: {erro}</div>;
  if (!estoque) return <div className="loading">Carregando o estoque por vencimento…</div>;

  const tipos = [...new Set(estoque.a_separar.map((l) => l.tipo_cogumelo).filter((t): t is string => !!t))].sort();
  const linhas = sementesDoTipo(estoque.a_separar, tipo);

  return (
    <Panel id="sementes-estoque-vencimento" title="Sementes em estoque (por vencimento)"
      sub="Todas as remessas com saldo, da que vence primeiro para a última, uma linha por remessa">
      <div className="no-print" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
        <label htmlFor="estoque-tipo">Tipo de cogumelo</label>
        <select id="estoque-tipo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
          <option value="">Todos os tipos</option>
          {tipos.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      {linhas.length === 0 ? (
        <div className="empty">{tipo ? `Nenhuma semente de ${tipo} em estoque.` : 'Nenhuma semente em estoque.'}</div>
      ) : (
        <div className="tbl-scroll">
          <table className="tbl">
            <thead>
              <tr><th>Tipo</th><th>Semente</th><th>NF</th><th>Validade</th><th className="num">Quantidade (pacotes)</th><th>Vencimento</th></tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={`${l.cepa}-${l.nf}-${l.validade}`}>
                  <td>{l.tipo_cogumelo ?? '—'}</td><td>{l.cepa}</td><td>{l.nf}</td><td>{dataBr(l.validade)}</td>
                  <td className="num">{num(l.saldo)}</td><td>{fraseDoVencimento(l.dias_para_vencer)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

const TOM_RISCO: Record<ProximasSementesTipo['risco'], 'bad' | 'ok' | 'neutral'> = {
  INSUFICIENTE: 'bad', SUFICIENTE: 'ok', SEM_CONTA: 'neutral',
};

function CartaoDeUso({ rotulo, tom, remessa, vazio }: {
  rotulo: string; tom: 'good' | 'info'; remessa: ProximaSementeRemessa | null; vazio: string;
}) {
  return (
    <div className={`kpi ${tom}`}>
      <div className="lab">{rotulo}</div>
      {remessa ? (
        <>
          <div className="val" style={{ fontSize: 18 }}>{remessa.cepa}</div>
          <div className="delta">Saldo: {num(remessa.quantidade)} un</div>
          <div className="delta">Validade: {dataBr(remessa.validade)}</div>
          <div className="delta">NF {remessa.nf}</div>
        </>
      ) : <div className="delta">{vazio}</div>}
    </div>
  );
}

export function planilhaProximasSementes(linhas: ProximasSementesTipo[]): string {
  const celula = (v: string | number) => {
    const s = typeof v === 'string' && /^[=+\-@\t\r]/.test(v) ? `'${v}` : String(v);
    return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const tabela: Array<Array<string | number>> = [
    ['Tipo', 'Alerta de estoque', 'Orientação', 'Cepa', 'NF', 'Saldo (un)', 'Validade', 'Vencimento'],
  ];
  for (const l of linhas) {
    const inicio = [l.tipo_cogumelo, rotuloDoAlerta(l)];
    const cartoes: Array<[string, ProximaSementeRemessa | null]> = [
      ['Usar primeiro', l.usar_primeiro], ['Usar depois', l.usar_depois],
      ...l.atencao.map((a): [string, ProximaSementeRemessa] => ['Atenção', a]),
    ];
    const remessas = cartoes.filter((c): c is [string, ProximaSementeRemessa] => c[1] != null);
    if (remessas.length === 0) tabela.push([...inicio, 'Sem semente em estoque', '', '', '', '', '']);
    for (const [orientacao, r] of remessas) {
      tabela.push([...inicio, orientacao, r.cepa, r.nf, r.quantidade, dataBr(r.validade), fraseDoVencimento(r.dias_para_vencer)]);
    }
  }
  return String.fromCharCode(0xfeff) + tabela.map((t) => t.map(celula).join(';')).join('\r\n') + '\r\n';
}

function baixarPlanilha(conteudo: string, nome: string) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}

export function SecaoProximas({ estoque, erroEstoque, necessidade, erroNecessidade }: {
  estoque: SementesEstoqueResposta | null;
  erroEstoque: string;
  necessidade: NecessidadeDeSementesResposta | null;
  erroNecessidade: string;
}) {
  if (erroEstoque) return <div className="empty">Erro: {erroEstoque}</div>;
  if (!estoque || (!necessidade && !erroNecessidade)) {
    return <div className="loading">Carregando próximas sementes…</div>;
  }

  const hoje = hojeISO();
  const linhas = proximasSementesPorTipo(estoque, hoje, necessidade);

  return (
    <Panel id="proximas-sementes" title="Próximas Sementes a Utilizar"
      sub={`Por tipo: qual semente usar primeiro e qual depois, pela validade, e quais pedem atenção (vencidas ou vencendo em até ${DIAS_DE_ATENCAO} dias). `
        + 'O alerta de estoque segue a conta de Compras de Matéria-Prima para a produção prevista.'}>
      {linhas.length === 0 && <div className="empty">Nenhum tipo de semente cadastrado.</div>}
      {linhas.length > 0 && (
        <div className="no-print" style={{ marginBottom: 10 }}>
          <button type="button" className="btn ghost"
            onClick={() => baixarPlanilha(planilhaProximasSementes(linhas), `proximas-sementes-${hoje}.csv`)}>⬇ Exportar planilha</button>
        </div>
      )}
      {linhas.map((l) => (
        <div key={l.tipo_cogumelo} style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <strong>{l.tipo_cogumelo}</strong>
            <Pill tone={TOM_RISCO[l.risco]}>{rotuloDoAlerta(l)}</Pill>
          </div>
          {!l.usar_primeiro && l.atencao.length === 0 ? (
            <div className="obs-tela">Sem semente em estoque para este tipo</div>
          ) : (
            <div className="kpi-grid k3">
              <CartaoDeUso rotulo="🥇 USAR PRIMEIRO" tom="good" remessa={l.usar_primeiro}
                vazio="Nenhuma semente dentro da validade" />
              <CartaoDeUso rotulo="🥈 USAR DEPOIS" tom="info" remessa={l.usar_depois}
                vazio="Nenhuma outra remessa dentro da validade" />
              <div className={`kpi ${l.atencao.some((a) => a.vencida) ? 'alert' : l.atencao.length ? 'warn' : 'neutral'}`}>
                <div className="lab">🟡 ATENÇÃO</div>
                {l.atencao.length === 0
                  ? <div className="delta">Nenhuma semente vencida ou vencendo em até {DIAS_DE_ATENCAO} dias</div>
                  : l.atencao.map((a) => (
                    <div key={`${a.cepa}-${a.nf}-${a.validade}`} className="delta">
                      <Pill tone={a.vencida ? 'bad' : 'warn'}>
                        {a.cepa} · NF {a.nf} · {num(a.quantidade)} un · {fraseDoVencimento(a.dias_para_vencer)}
                      </Pill>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </Panel>
  );
}

function SecaoEstoque({ dados, erro }: { dados: SementesEstoqueResposta | null; erro: string }) {
  const [recolhidas, setRecolhidas] = useState<Set<string>>(new Set());

  if (erro) return <div className="empty">Erro: {erro}</div>;
  if (!dados) return <div className="loading">Carregando estoque de sementes…</div>;

  const alternar = (cepa: string) =>
    setRecolhidas((prev) => {
      const prox = new Set(prev);
      if (prox.has(cepa)) prox.delete(cepa);
      else prox.add(cepa);
      return prox;
    });

  const celula = (v: number | null | undefined) => (v == null ? '' : num(v));

  return (
    <Panel id="sementes-estoque" title="Sementes em Estoque"
      sub="Soma de Quantidade por cepa → NF, com colunas por data de VALIDADE (produção + 30 dias)">
      {dados.proximas.length > 0 && (
        <div className="legend" style={{ marginBottom: 10 }}>
          {dados.proximas.map((p) => (
            <Pill key={p.tipo_cogumelo} tone="info">
              Próxima a usar · {p.tipo_cogumelo}: {p.cepa} (vence {dataBr(p.validade)})
            </Pill>
          ))}
        </div>
      )}
      <div className="plan-wrap">
        <table className="plan cp">
          <thead>
            <tr>
              <th className="rotulo">Rótulos de Linha</th>
              {dados.validades.map((v) => <th key={v} className="num">{dataBr(v)}</th>)}
              <th className="num total">Total Geral</th>
            </tr>
          </thead>
          <tbody>
            {dados.cepas.map((c) => (
              <CepaLinhas key={c.cepa} cepa={c} validades={dados.validades}
                recolhida={recolhidas.has(c.cepa)} onToggle={() => alternar(c.cepa)}
                celula={celula} />
            ))}
            <tr className="ln-destaque">
              <td className="rotulo">Total Geral</td>
              {dados.validades.map((v) => (
                <td key={v} className="num">{celula(dados.total_geral.valores[v])}</td>
              ))}
              <td className="num total">{num(dados.total_geral.total)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="obs-tela">
        Próxima semente a usar por tipo = validade mais antiga com saldo (regra da planilha).
      </div>
    </Panel>
  );
}

function CepaLinhas({ cepa, validades, recolhida, onToggle, celula }: {
  cepa: SementesEstoqueResposta['cepas'][number];
  validades: string[];
  recolhida: boolean;
  onToggle: () => void;
  celula: (v: number | null | undefined) => string;
}) {
  return (
    <>
      <tr className="ln-grupo">
        <td className="rotulo">
          <button className="gr-toggle" onClick={onToggle}
            title={recolhida ? 'Expandir' : 'Recolher'}>
            <span className="gr-caret">{recolhida ? '▸' : '▾'}</span>{cepa.cepa}
          </button>
        </td>
        {validades.map((v) => <td key={v} className="num">{celula(cepa.valores[v])}</td>)}
        <td className="num total">{num(cepa.total)}</td>
      </tr>
      {!recolhida && cepa.nfs.map((nf) => (
        <tr key={nf.nf}>
          <td className="rotulo sub-rot">{nf.nf}</td>
          {validades.map((v) => <td key={v} className="num">{celula(nf.valores[v])}</td>)}
          <td className="num total">{num(nf.total)}</td>
        </tr>
      ))}
    </>
  );
}

const FORM_VAZIO = {
  data: '', tipo: 'ENTRADA' as 'ENTRADA' | 'SAIDA', ajuste: false, data_nf: '',
  tipo_cogumelo: 'Shiitake', cepa_id: '', nf: '', data_producao: '', quantidade: '',
};

export function movimentoParaFormulario(m: SementeMovimento): typeof FORM_VAZIO {
  return {
    data: m.data ?? '',
    tipo: m.tipo,
    ajuste: m.ajuste ?? false,
    data_nf: m.ajuste ? '' : (m.data_nf ?? ''),
    tipo_cogumelo: m.tipo_cogumelo ?? 'Shiitake',
    cepa_id: m.cepa_id != null ? String(m.cepa_id) : '',
    nf: m.nf ?? '',
    data_producao: m.data_producao ?? '',
    quantidade: m.quantidade != null ? String(m.quantidade) : '',
  };
}

function SecaoAtividade({ versao, aoSalvar }: { versao: number; aoSalvar: () => void }) {
  const toast = useToast();
  const confirmar = useConfirmar();
  const [movs, setMovs] = useState<SementeMovimento[] | null>(null);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [editando, setEditando] = useState<number | null>(null);
  const [v, setV] = useState(FORM_VAZIO);

  useEffect(() => {
    setErro('');
    getSementesMovimentos()
      .then(setMovs)
      .catch((e) => setErro(e?.response?.data?.erro ?? e.message));
  }, [versao]);

  const [cepas, setCepas] = useState<SementeCepa[] | null>(null);
  const [erroCepas, setErroCepas] = useState(false);
  useEffect(() => {
    getSementesCepas()
      .then((lista) => { setCepas(lista); setErroCepas(false); })
      .catch(() => { setCepas([]); setErroCepas(true); });
  }, [versao]);

  const cepasDoTipo = useMemo(
    () => cepasDoTipoSemente(cepas ?? [], v.tipo_cogumelo),
    [cepas, v.tipo_cogumelo],
  );
  const tiposOferecidos = useMemo(() => tiposDeCogumeloSemente(cepas ?? []), [cepas]);
  useEffect(() => {
    if (editando == null && !v.cepa_id && cepasDoTipo.length) {
      setV((atual) => ({ ...atual, cepa_id: String(cepasDoTipo[0].id) }));
    }
  }, [cepasDoTipo, v.cepa_id, editando]);
  const validade = v.data_producao ? somaDias(v.data_producao, 30) : '';

  if (erro) return <div className="empty">Erro: {erro}</div>;
  if (!movs) return <div className="loading">Carregando atividade de sementes…</div>;

  const ok = v.data && v.cepa_id && v.data_producao && Number(v.quantidade) > 0;
  const salvar = () => {
    setSalvando(true);
    const acao = editando != null
      ? atualizarSementeMovimento(editando, {
        data: v.data, data_nf: v.ajuste ? null : (v.data_nf || null),
        ajuste: v.ajuste, tipo: v.tipo, cepa_id: Number(v.cepa_id), nf: v.nf || null,
        data_producao: v.data_producao, quantidade: Number(v.quantidade),
      })
      : registrarSementeMovimento({
        data: v.data, data_nf: v.ajuste ? undefined : (v.data_nf || undefined),
        ajuste: v.ajuste, tipo: v.tipo, cepa_id: Number(v.cepa_id), nf: v.nf || undefined,
        data_producao: v.data_producao, quantidade: Number(v.quantidade),
      });
    acao
      .then(() => {
        toast(editando != null ? 'Movimento corrigido.' : 'Movimento de semente registrado.');
        if (editando != null) { setEditando(null); setV(FORM_VAZIO); } else setV({ ...v, quantidade: '' });
        aoSalvar();
      })
      .catch((e) => toast(e?.response?.data?.erro ?? e.message, true))
      .finally(() => setSalvando(false));
  };

  const abrirEdicao = (m: SementeMovimento) => {
    setEditando(m.id);
    setV(movimentoParaFormulario(m));
  };

  const pedirExclusao = async (m: SementeMovimento) => {
    const confirmado = await confirmar(
      `Excluir o movimento de ${dataBr(m.data)}: ${m.tipo === 'SAIDA' ? 'SAÍDA' : 'ENTRADA'} `
      + `de ${num(m.quantidade)} de ${m.cepa}?\n\n`
      + 'Ele sai da razão E do saldo de sementes. Não dá para desfazer.',
    );
    if (!confirmado) return;
    setSalvando(true);
    excluirSementeMovimento(m.id)
      .then(() => {
        toast('Movimento excluído.');
        if (editando === m.id) { setEditando(null); setV(FORM_VAZIO); }
        aoSalvar();
      })
      .catch((e) => toast(e?.response?.data?.erro ?? e.message, true))
      .finally(() => setSalvando(false));
  };

  const ordenados = [...movs].sort((a, b) => b.data.localeCompare(a.data) || b.id - a.id);

  return (
    <Panel title="Atividade - Sementes" tag={`${movs.length} movimentos`}
      sub="Razão de entradas e saídas: saída aparece com quantidade negativa, como na planilha">
      <div className="form-grid c4" style={{ marginBottom: 16 }}>
        <div className="fg"><label>Data do Recebimento/Utilização <span className="req">*</span></label>
          <CampoData value={v.data} onChange={(iso) => setV({ ...v, data: iso })} /></div>
        <div className="fg"><label>ENTRADA/SAÍDA <span className="req">*</span></label>
          <select value={v.tipo} onChange={(e) => setV({ ...v, tipo: e.target.value as 'ENTRADA' | 'SAIDA' })}>
            <option value="ENTRADA">ENTRADA</option><option value="SAIDA">SAÍDA</option>
          </select></div>
        <div className="fg"><label>DATA NF {v.ajuste && '(AJUSTE)'}</label>
          <CampoData value={v.ajuste ? '' : v.data_nf} disabled={v.ajuste}
            onChange={(iso) => setV({ ...v, data_nf: iso })} /></div>
        <div className="fg"><label>Lançamento de AJUSTE?</label>
          <select value={v.ajuste ? 'SIM' : 'NAO'} onChange={(e) => setV({ ...v, ajuste: e.target.value === 'SIM' })}>
            <option value="NAO">Não</option><option value="SIM">SIM (DATA NF = AJUSTE)</option>
          </select></div>
        <div className="fg"><label>Tipo Cogumelo <span className="req">*</span></label>
          <select value={v.tipo_cogumelo} onChange={(e) => {
            const tipo = e.target.value;
            const primeira = cepasDoTipoSemente(cepas ?? [], tipo)[0];
            setV({ ...v, tipo_cogumelo: tipo, cepa_id: primeira ? String(primeira.id) : '' });
          }}>
            {tiposOferecidos.map((t) => <option key={t}>{t}</option>)}
          </select></div>
        <div className="fg"><label>Cod Semente <span className="req">*</span></label>
          <select value={v.cepa_id} onChange={(e) => setV({ ...v, cepa_id: e.target.value })}
            disabled={!cepas || !cepasDoTipo.length}>
            {cepasDoTipo.map((c) => <option key={c.id} value={String(c.id)}>{c.codigo}</option>)}
          </select>
          {erroCepas && <div className="nota">Não deu para carregar as cepas. Recarregue a página.</div>}
          {cepas && !erroCepas && !cepasDoTipo.length
            && <div className="nota">Nenhuma cepa cadastrada para {v.tipo_cogumelo}.</div>}
        </div>
        <div className="fg"><label>NF</label>
          <input value={v.nf} onChange={(e) => setV({ ...v, nf: e.target.value })} placeholder="ex.: 20155" /></div>
        <div className="fg"><label>Data da produção da semente <span className="req">*</span></label>
          <CampoData value={v.data_producao} onChange={(iso) => setV({ ...v, data_producao: iso })} /></div>
        <div className="fg"><label>VALIDADE (produção + 30 dias)</label>
          <input readOnly value={validade ? dataBr(validade) : ''} placeholder="—" /></div>
        <div className="fg"><label>Quantidade <span className="req">*</span></label>
          <input type="number" min={1} value={v.quantidade} onChange={(e) => setV({ ...v, quantidade: e.target.value })} /></div>
        <div className="fg"><label>&nbsp;</label>
          <button className="btn" disabled={!ok || salvando} onClick={salvar}>
            {salvando ? 'Salvando…' : (editando != null ? 'Salvar correção' : 'Registrar movimento')}</button>
          {editando != null && (
            <>
              {' '}
              <button className="btn ghost" disabled={salvando}
                onClick={() => { setEditando(null); setV(FORM_VAZIO); }}>Cancelar</button>
            </>
          )}</div>
      </div>
      {editando != null && (
        <div className="fixvar-none" style={{ marginBottom: 12 }}>
          Corrigindo o movimento nº {editando}. Mudar a data de produção recalcula
          a validade sozinha. Para lançar um movimento novo, use “Cancelar”.
        </div>
      )}

      <div className="tbl-scroll" style={{ maxHeight: 420 }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>Data do Recebimento/Utilização</th><th>DATA NF</th><th>ENTRADA/SAÍDA</th>
              <th>Tipo Cogumelo</th><th>Cod Semente</th><th>NF</th>
              <th>Data da produção da semente</th><th>VALIDADE</th>
              <th className="num">Quantidade</th>
              <th className="num">Ações</th>
            </tr>
          </thead>
          <tbody>
            {ordenados.map((m) => (
              <tr key={m.id}>
                <td>{dataBr(m.data)}</td>
                <td>{m.ajuste ? 'AJUSTE' : dataBr(m.data_nf)}</td>
                <td><Pill tone={m.tipo === 'ENTRADA' ? 'ok' : 'warn'}>{m.tipo === 'SAIDA' ? 'SAÍDA' : 'ENTRADA'}</Pill></td>
                <td>{m.tipo_cogumelo}</td>
                <td>{m.cepa}</td>
                <td>{m.nf ?? ''}</td>
                <td>{dataBr(m.data_producao)}</td>
                <td>{dataBr(m.validade)}</td>
                <td className={`num ${m.tipo === 'SAIDA' ? 'neg' : ''}`}>
                  {m.tipo === 'SAIDA' ? `-${num(m.quantidade)}` : num(m.quantidade)}
                </td>
                <td className="num">
                  <button className="btn ghost split-btn" disabled={salvando}
                    title="Corrigir este movimento no formulário acima. O saldo é recalculado."
                    onClick={() => abrirEdicao(m)}>Editar</button>
                  {' '}
                  <button className="btn ghost split-btn" disabled={salvando}
                    title="Apagar este movimento. Ele sai da razão e do saldo de sementes."
                    onClick={() => pedirExclusao(m)}>Excluir</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

