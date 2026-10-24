import { useCallback, useEffect, useState } from 'react';
import { num } from '../api/client';
import { dataBr } from '../api/constantes';
import {
  criarMaterial, criarVersaoDoPreco, getCadastroDeCustos, type CadastroDeCustos as Cadastro, type GrupoDoMaterial, type MaterialDoCadastro,
  type PrecoNovo, type VersaoDoPreco,
} from '../api/cadastroDeCustos';
import { CampoData } from '../components/CampoData';
import { Panel, useConfirmar, useToast } from '../components/ui';

export const ROTULO_DO_GRUPO: Record<GrupoDoMaterial, string> = { FABRICACAO: 'Fabricação', EMBALAGEM: 'Embalagem' };

export const AVISO_DO_CADASTRO = 'Cada compra ou reajuste é um preço novo, a partir da data em que passa a valer: os preços anteriores não mudam, '
  + 'e os custos de antes dessa data continuam com o preço deles. O preço por unidade é calculado: o valor pago mais o frete de aquisição, '
  + 'dividido pela quantidade comprada (as apresentações vezes o conteúdo de cada uma). Antes do primeiro preço o material fica sem preço, nunca com zero. '
  + 'Pela tela, o preço vale de uma data deste mês ou do próximo; a correção de um mês anterior é feita à parte, com a sua aprovação.';

export const AVISO_FORA_DO_ATIVO = 'Materiais que saíram do cadastro ativo: não recebem preço novo nem entram nos custos, e o histórico dos preços fica guardado.';

export const AVISO_DO_USO = 'Por enquanto nenhum custo do sistema lê este cadastro: o custo de materiais do lote passa a usá-lo na próxima etapa, ao lado do custo pela DRE.';

export const precoBr = (x: number) => x.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 6 });

export function textoDaCompra(v: Pick<VersaoDoPreco, 'quantidade_apresentacoes' | 'apresentacao' | 'conteudo_por_apresentacao' | 'unidade_base'>): string {
  if (v.apresentacao === v.unidade_base && v.conteudo_por_apresentacao === 1) return `${num(v.quantidade_apresentacoes, 4)} ${v.unidade_base}`;
  return `${num(v.quantidade_apresentacoes, 4)} ${v.apresentacao} de ${num(v.conteudo_por_apresentacao, 4)} ${v.unidade_base}`;
}

export type ModoDoValor = 'TOTAL' | 'APRESENTACAO';
export type FormPreco = {
  desde: string; fornecedor: string; apresentacao: string; quantidade: string; conteudo: string; unidade_base: string;
  modo: ModoDoValor; valor: string; frete: string; documento: string; observacao: string;
};
export type FormMaterial = FormPreco & { nome: string; grupo: GrupoDoMaterial; aplicacao: string };

export function formularioDoPreco(m: MaterialDoCadastro | null): FormPreco {
  const u = m?.versoes[m.versoes.length - 1] ?? null;
  return {
    desde: '', fornecedor: u?.fornecedor ?? '', apresentacao: u?.apresentacao ?? '', quantidade: '', conteudo: u ? String(u.conteudo_por_apresentacao) : '',
    unidade_base: u?.unidade_base ?? '', modo: 'TOTAL', valor: '', frete: '', documento: '', observacao: '',
  };
}
export const formularioDoMaterial = (): FormMaterial => ({ ...formularioDoPreco(null), nome: '', grupo: 'FABRICACAO', aplicacao: '' });

function numero(s: string, casas: number): number | null {
  const t = s.trim();
  if (!new RegExp(`^\\d+(\\.\\d{1,${casas}})?$`).test(t)) return null;
  return Number(t);
}

export function previaDoPreco(f: FormPreco): { total: number; unitario: number } | null {
  const q = numero(f.quantidade, 4);
  const c = numero(f.conteudo, 4);
  const valor = numero(f.valor, 6);
  const frete = f.frete.trim() === '' ? 0 : numero(f.frete, 2);
  if (!q || !c || !valor || frete == null) return null;
  const total = f.modo === 'TOTAL' ? valor : Math.round(valor * q * 1e6) / 1e6;
  return { total, unitario: Math.round(((total + frete) / (q * c)) * 1e8) / 1e8 };
}

export function corpoDoPreco(f: FormPreco): { corpo: PrecoNovo } | { falta: string } {
  if (!f.desde) return { falta: 'Escolha a data em que o preço passa a valer.' };
  if (!f.fornecedor.trim()) return { falta: 'Escreva o fornecedor.' };
  if (!f.apresentacao.trim()) return { falta: 'Escreva a apresentação (saco, caixa, fardo, m³...).' };
  const q = numero(f.quantidade, 4);
  if (!q) return { falta: 'A quantidade de apresentações é um número maior que zero, com até 4 casas.' };
  const c = numero(f.conteudo, 4);
  if (!c) return { falta: 'O conteúdo de cada apresentação é um número maior que zero, com até 4 casas.' };
  if (!f.unidade_base.trim()) return { falta: 'Escreva a unidade base (kg, un, m³...).' };
  const valor = numero(f.valor, 6);
  if (!valor) return { falta: f.modo === 'TOTAL' ? 'Informe o valor total da compra.' : 'Informe o valor de uma apresentação.' };
  const frete = f.frete.trim() === '' ? 0 : numero(f.frete, 2);
  if (frete == null) return { falta: 'O frete é um valor em reais, com até 2 casas.' };
  if (f.observacao.trim().length < 3) return { falta: 'Escreva a observação (a origem do preço ou o motivo da mudança).' };
  return {
    corpo: {
      desde: f.desde, fornecedor: f.fornecedor.trim(), apresentacao: f.apresentacao.trim(), quantidade_apresentacoes: q, conteudo_por_apresentacao: c,
      unidade_base: f.unidade_base.trim(), ...(f.modo === 'TOTAL' ? { valor_total: valor } : { valor_por_apresentacao: valor }), frete,
      documento: f.documento.trim() || null, observacao: f.observacao.trim(),
    },
  };
}

export function corpoDoMaterial(f: FormMaterial) {
  if (!f.nome.trim()) return { falta: 'Escreva o nome do material.' };
  const r = corpoDoPreco(f);
  if ('falta' in r) return r;
  return { corpo: { ...r.corpo, nome: f.nome.trim(), grupo: f.grupo, aplicacao: f.aplicacao.trim() || null } };
}

export function textoDaConfirmacao(nome: string, f: FormPreco): string {
  const extenso = new Date(`${f.desde}T12:00:00Z`).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  const p = previaDoPreco(f);
  const preco = p ? `: R$ ${precoBr(p.unitario)} por ${f.unidade_base.trim()}, com o frete` : '';
  return `${nome}: o preço novo vale a partir de ${extenso}${preco}. Depois de cadastrado ele não se altera nem se apaga, e o próximo só pode valer depois dessa data. Os custos de antes dessa data não mudam. Cadastrar?`;
}

function CamposDoPreco({ f, salvando, onMudar }: { f: FormPreco; salvando: boolean; onMudar: (f: FormPreco) => void }) {
  const p = previaDoPreco(f);
  return (
    <>
      <div className="form-grid c4">
        <div className="fg"><label>Vale desde <span className="req">*</span></label>
          <CampoData value={f.desde} disabled={salvando} onChange={(iso) => onMudar({ ...f, desde: iso })} /></div>
        <div className="fg"><label>Fornecedor <span className="req">*</span></label>
          <input value={f.fornecedor} maxLength={120} disabled={salvando} onChange={(e) => onMudar({ ...f, fornecedor: e.target.value })} /></div>
        <div className="fg"><label>Apresentação <span className="req">*</span></label>
          <input value={f.apresentacao} maxLength={40} placeholder="saco, caixa, fardo" disabled={salvando} onChange={(e) => onMudar({ ...f, apresentacao: e.target.value })} /></div>
        <div className="fg"><label>Quantas apresentações <span className="req">*</span></label>
          <input type="number" min={0} step="any" value={f.quantidade} disabled={salvando} onChange={(e) => onMudar({ ...f, quantidade: e.target.value })} /></div>
        <div className="fg"><label>Conteúdo de cada uma <span className="req">*</span></label>
          <input type="number" min={0} step="any" value={f.conteudo} disabled={salvando} onChange={(e) => onMudar({ ...f, conteudo: e.target.value })} /></div>
        <div className="fg"><label>Unidade base <span className="req">*</span></label>
          <input value={f.unidade_base} maxLength={20} placeholder="kg, un, m³" disabled={salvando} onChange={(e) => onMudar({ ...f, unidade_base: e.target.value })} /></div>
        <div className="fg"><label>Informar <span className="req">*</span></label>
          <select value={f.modo} disabled={salvando} onChange={(e) => onMudar({ ...f, modo: e.target.value as ModoDoValor })}>
            <option value="TOTAL">o valor total da compra</option>
            <option value="APRESENTACAO">o valor de uma apresentação</option>
          </select></div>
        <div className="fg"><label>{f.modo === 'TOTAL' ? 'Valor total (R$)' : 'Valor de uma apresentação (R$)'} <span className="req">*</span></label>
          <input type="number" min={0} step="any" value={f.valor} disabled={salvando} onChange={(e) => onMudar({ ...f, valor: e.target.value })} /></div>
        <div className="fg"><label>Frete de aquisição (R$)</label>
          <input type="number" min={0} step="0.01" value={f.frete} disabled={salvando} onChange={(e) => onMudar({ ...f, frete: e.target.value })} /></div>
        <div className="fg"><label>Documento (nota ou lançamento)</label>
          <input value={f.documento} maxLength={120} disabled={salvando} onChange={(e) => onMudar({ ...f, documento: e.target.value })} /></div>
        <div className="fg"><label>Observação <span className="req">*</span></label>
          <input value={f.observacao} maxLength={500} disabled={salvando} onChange={(e) => onMudar({ ...f, observacao: e.target.value })} /></div>
      </div>
      {p && (
        <div className="obs-tela">
          {`Total da compra: R$ ${precoBr(p.total)}. Preço por ${f.unidade_base.trim() || 'unidade'} com o frete: R$ ${precoBr(p.unitario)}.`}
        </div>
      )}
    </>
  );
}

function Botoes({ falta, salvando, rotulo, onGravar, onCancelar }: {
  falta: string | null; salvando: boolean; rotulo: string; onGravar: () => void | Promise<void>; onCancelar: () => void;
}) {
  return (
    <>
      <div className="form-grid c4">
        <div className="fg"><button className="btn" disabled={falta != null || salvando} onClick={onGravar}>{salvando ? 'Salvando…' : rotulo}</button></div>
        <div className="fg"><button className="btn ghost" disabled={salvando} onClick={onCancelar}>Cancelar</button></div>
      </div>
      {falta && <div className="obs-tela">{falta}</div>}
    </>
  );
}

export function TabelaDosPrecos({ materiais, onNovoPreco }: { materiais: MaterialDoCadastro[]; onNovoPreco?: (m: MaterialDoCadastro) => void }) {
  return (
    <div className="tbl-scroll">
      <table className="tbl">
        <thead>
          <tr>
            <th>Material</th><th>Grupo</th><th>Aplicação</th><th>Fornecedor</th><th>Compra</th><th className="num">Valor pago (R$)</th>
            <th className="num">Frete (R$)</th><th className="num">Preço por unidade (R$)</th><th>Documento</th><th>Vale desde</th><th>Versão</th><th />
          </tr>
        </thead>
        <tbody>
          {materiais.map((m) => {
            const v = m.vigente;
            const primeira = m.versoes[0];
            return (
              <tr key={m.id}>
                <td>{m.nome}</td><td>{ROTULO_DO_GRUPO[m.grupo]}</td><td>{m.aplicacao ?? '—'}</td>
                {v ? (
                  <>
                    <td>{v.fornecedor}</td><td>{textoDaCompra(v)}</td>
                    <td className="num">{precoBr(v.valor_total)}</td><td className="num">{precoBr(v.frete)}</td>
                    <td className="num">{`${precoBr(v.preco_unitario)} por ${v.unidade_base}`}</td>
                    <td>{v.documento ?? 'sem documento'}</td><td>{dataBr(v.desde)}</td><td>{v.versao}</td>
                  </>
                ) : (
                  <td colSpan={8}>{primeira ? `Sem preço hoje: o primeiro vale a partir de ${dataBr(primeira.desde)}.` : 'Sem preço cadastrado.'}</td>
                )}
                <td>{onNovoPreco && <button type="button" className="gr-toggle" onClick={() => onNovoPreco(m)}>Novo preço</button>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function TabelaForaDoAtivo({ materiais }: { materiais: MaterialDoCadastro[] }) {
  return (
    <div className="tbl-scroll">
      <table className="tbl">
        <thead><tr><th>Material</th><th>Grupo</th><th>Aplicação</th><th>Fora do ativo desde</th><th>Motivo</th></tr></thead>
        <tbody>
          {materiais.map((m) => (
            <tr key={m.id}>
              <td>{m.nome}</td><td>{ROTULO_DO_GRUPO[m.grupo]}</td><td>{m.aplicacao ?? '—'}</td>
              <td>{m.fora_do_ativo_desde ? dataBr(m.fora_do_ativo_desde) : '—'}</td><td>{m.motivo_fora_do_ativo ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function HistoricoDosPrecos({ materiais }: { materiais: MaterialDoCadastro[] }) {
  const linhas = materiais.flatMap((m) => [...m.versoes].reverse().map((v) => ({ m, v })));
  return (
    <div className="tbl-scroll">
      <table className="tbl">
        <thead>
          <tr>
            <th>Material</th><th>Versão</th><th>Vale desde</th><th>Fornecedor</th><th>Compra</th><th className="num">Valor pago (R$)</th><th className="num">Frete (R$)</th>
            <th className="num">Preço por unidade (R$)</th><th>Documento</th><th>Observação</th><th>Cadastrada em</th><th>Por</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map(({ m, v }) => (
            <tr key={`${m.id}|${v.versao}`}>
              <td>{m.fora_do_ativo_desde ? `${m.nome} (fora do cadastro ativo)` : m.nome}</td><td>{v.versao}</td><td>{dataBr(v.desde)}</td><td>{v.fornecedor}</td><td>{textoDaCompra(v)}</td>
              <td className="num">{precoBr(v.valor_total)}</td><td className="num">{precoBr(v.frete)}</td><td className="num">{`${precoBr(v.preco_unitario)} por ${v.unidade_base}`}</td>
              <td>{v.documento ?? 'sem documento'}</td><td>{v.observacao}</td>
              <td>{new Date(v.criado_em).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</td><td>{v.criado_por_nome}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CadastroDeCustos() {
  const toast = useToast();
  const confirmar = useConfirmar();
  const [cadastro, setCadastro] = useState<Cadastro | null>(null);
  const [erro, setErro] = useState('');
  const [aberto, setAberto] = useState<MaterialDoCadastro | null>(null);
  const [fp, setFp] = useState<FormPreco | null>(null);
  const [fm, setFm] = useState<FormMaterial | null>(null);
  const [salvando, setSalvando] = useState(false);

  const recarregar = useCallback(() => {
    setErro('');
    getCadastroDeCustos().then(setCadastro).catch((e) => setErro(e?.response?.data?.erro ?? e.message));
  }, []);
  useEffect(recarregar, [recarregar]);

  if (erro) return <div className="empty">Erro: {erro}</div>;
  if (!cadastro) return <div className="loading">Carregando o Cadastro Mestre de Custos…</div>;

  const janela = `de ${dataBr(cadastro.janela.de)} a ${dataBr(cadastro.janela.ate)}`;
  const fechar = () => { setAberto(null); setFp(null); setFm(null); };
  const enviar = (p: Promise<{ versao: number; desde: string }>, nome: string) => {
    setSalvando(true);
    p.then((x) => { toast(`${nome}: preço ${x.versao} cadastrado, vale desde ${dataBr(x.desde)}.`); fechar(); recarregar(); })
      .catch((e) => toast(e?.response?.data?.erro ?? e.message, true))
      .finally(() => setSalvando(false));
  };
  const gravarPreco = async () => {
    if (!aberto || !fp) return;
    const r = corpoDoPreco(fp);
    if ('falta' in r) return;
    if (!(await confirmar(textoDaConfirmacao(aberto.nome, fp)))) return;
    enviar(criarVersaoDoPreco({ ...r.corpo, material_id: aberto.id }), aberto.nome);
  };
  const gravarMaterial = async () => {
    if (!fm) return;
    const r = corpoDoMaterial(fm);
    if ('falta' in r) return;
    if (!(await confirmar(textoDaConfirmacao(r.corpo.nome, fm)))) return;
    enviar(criarMaterial(r.corpo), r.corpo.nome);
  };
  const ativos = cadastro.materiais.filter((m) => !m.fora_do_ativo_desde);
  const fora = cadastro.materiais.filter((m) => m.fora_do_ativo_desde);
  const ultima = aberto?.versoes[aberto.versoes.length - 1];
  const rp = fp && corpoDoPreco(fp);
  const rm = fm && corpoDoMaterial(fm);

  return (
    <>
      {aberto && fp && rp && (
        <Panel title={`Novo preço: ${aberto.nome}`}
          sub={`${ultima ? `O último vale desde ${dataBr(ultima.desde)}: o novo vale depois dele, ` : 'O preço vale '}a partir de uma data ${janela}.`}>
          <CamposDoPreco f={fp} salvando={salvando} onMudar={setFp} />
          <Botoes falta={'falta' in rp ? rp.falta : null} salvando={salvando} rotulo="Cadastrar preço" onGravar={gravarPreco} onCancelar={fechar} />
        </Panel>
      )}
      {fm && rm && (
        <Panel title="Novo material" sub={`O material entra com o primeiro preço, que vale a partir de uma data ${janela}. O nome não se repete.`}>
          <div className="form-grid c4">
            <div className="fg"><label>Material <span className="req">*</span></label>
              <input value={fm.nome} maxLength={120} disabled={salvando} onChange={(e) => setFm({ ...fm, nome: e.target.value })} /></div>
            <div className="fg"><label>Grupo <span className="req">*</span></label>
              <select value={fm.grupo} disabled={salvando} onChange={(e) => setFm({ ...fm, grupo: e.target.value as GrupoDoMaterial })}>
                {(Object.keys(ROTULO_DO_GRUPO) as GrupoDoMaterial[]).map((g) => <option key={g} value={g}>{ROTULO_DO_GRUPO[g]}</option>)}
              </select></div>
            <div className="fg"><label>Aplicação</label>
              <input value={fm.aplicacao} maxLength={200} placeholder="Shiitake, receita do substrato" disabled={salvando} onChange={(e) => setFm({ ...fm, aplicacao: e.target.value })} /></div>
          </div>
          <CamposDoPreco f={fm} salvando={salvando} onMudar={(f) => setFm({ ...fm, ...f })} />
          <Botoes falta={'falta' in rm ? rm.falta : null} salvando={salvando} rotulo="Cadastrar material" onGravar={gravarMaterial} onCancelar={fechar} />
        </Panel>
      )}
      <Panel title="Preços que valem hoje" sub={AVISO_DO_CADASTRO} tag={`${ativos.length} materiais`}>
        <div className="form-grid c4">
          <div className="fg"><button type="button" className="btn ghost" disabled={salvando} onClick={() => { fechar(); setFm(formularioDoMaterial()); }}>Novo material</button></div>
        </div>
        <TabelaDosPrecos materiais={ativos} onNovoPreco={(m) => { fechar(); setAberto(m); setFp(formularioDoPreco(m)); }} />
        <div className="obs-tela">{AVISO_DO_USO}</div>
      </Panel>
      {fora.length > 0 && (
        <Panel title="Fora do cadastro ativo" sub={AVISO_FORA_DO_ATIVO} tag={`${fora.length} ${fora.length === 1 ? 'material' : 'materiais'}`}>
          <TabelaForaDoAtivo materiais={fora} />
        </Panel>
      )}
      <Panel title="Histórico dos preços" tag={`${cadastro.materiais.reduce((t, m) => t + m.versoes.length, 0)} versões`}>
        <HistoricoDosPrecos materiais={cadastro.materiais} />
      </Panel>
    </>
  );
}
