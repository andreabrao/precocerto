"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { apiUrl } from "@/lib/client-config";
import {
  clearSession,
  fetchPlatformAccount,
  hasSeenLanding,
  isAuthConfigured,
  loadSupabaseConfiguration,
  loadSession,
  PlatformClientRequestError,
  rememberLandingSeen,
  refreshPlatformSession,
  signInWithPassword,
  signUpWithPassword,
  type PlatformAccount,
} from "@/lib/platform-client-auth";

type PortalView = "landing" | "access" | "account";
type Plan = { id: string; name: string; description: string; priceCents: number; monthlyFlyerLimit: number; monthlyAiExtractionLimit: number; storeLimit: number; analyticsLevel: string };
type Store = { id: string; name: string; city: string; neighborhood: string };
type FlyerJob = { id: string; storeId: string; storeName: string; status: string; originalFilename: string; extractedCount: number; createdAt: string; errorMessage?: string | null };
type AdminPayload = { overview: { activeUsers: number; retailers: number; stores: number; openFlyerJobs: number; offersAwaitingReview: number }; plans: Plan[]; stores: Store[]; jobs: FlyerJob[] };
type RetailerPayload = { storeId: string; storeName: string; flyersThisMonth: number; aiReadsThisMonth: number; remainingFlyers: number; remainingAiReads: number; subscription: { planName: string; status: string; monthlyFlyerLimit: number; monthlyAiExtractionLimit: number; analyticsLevel: string } | null; offers: { productName: string; priceCents: number; measure: string }[] };

const formatCurrency = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

async function authenticatedJson<T>(path: string, token: string, init: RequestInit = {}) {
  const response = await fetch(apiUrl(path), { ...init, headers: { authorization: `Bearer ${token}`, ...(init.headers ?? {}) } });
  const payload = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? "Não foi possível concluir a ação.");
  return payload;
}

function AdminMemberPanel({ token, stores }: { token: string; stores: Store[] }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"customer" | "retailer" | "admin">("retailer");
  const [storeId, setStoreId] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (role === "retailer" && !storeId) { setMessage("Escolha a loja do varejista."); return; }
    setBusy(true); setMessage("");
    try {
      await authenticatedJson("/api/platform/admin/users", token, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, role, retailerStoreId: role === "retailer" ? storeId : null }),
      });
      setEmail(""); setMessage("Acesso atualizado. A pessoa verá o painel ao entrar novamente.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível atualizar o acesso.");
    } finally { setBusy(false); }
  };

  return <section className="platform-dashboard admin-member-dashboard">
    <div className="portal-body"><form className="store-form" onSubmit={submit}>
      <h3>Acessos e perfis</h3>
      <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="E-mail de quem já criou a conta" required />
      <select value={role} onChange={(event) => setRole(event.target.value as "customer" | "retailer" | "admin")}>
        <option value="customer">Cliente</option><option value="retailer">Varejista</option><option value="admin">Administrador</option>
      </select>
      {role === "retailer" && <select value={storeId} onChange={(event) => setStoreId(event.target.value)} required><option value="">Escolha a loja</option>{stores.map((store) => <option key={store.id} value={store.id}>{store.name} · {store.city}</option>)}</select>}
      <button disabled={busy}>{busy ? "Salvando…" : "Atualizar acesso"}</button>
      <small>Por segurança, a pessoa precisa criar a conta antes de receber um perfil.</small>
      {message && <p className="access-message" role="status">{message}</p>}
    </form></div>
  </section>;
}

export function PlatformPortal({ onOpenShopping, onClose }: { onOpenShopping: () => void; onClose: () => void }) {
  const [view, setView] = useState<PortalView>(() => hasSeenLanding() ? "access" : "landing");
  const [account, setAccount] = useState<PlatformAccount>();
  const [token, setToken] = useState<string | undefined>(() => loadSession()?.access_token);
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [adminData, setAdminData] = useState<AdminPayload>();
  const [retailerData, setRetailerData] = useState<RetailerPayload>();
  const [flyerFile, setFlyerFile] = useState<File>();
  const [selectedStoreId, setSelectedStoreId] = useState("");
  const [newStore, setNewStore] = useState({ name: "", city: "Itaperuçu", neighborhood: "" });

  const currentRole = account?.role;
  const planCards = useMemo(() => plans.length ? plans : adminData?.plans ?? [], [plans, adminData]);

  useEffect(() => {
    void fetch(apiUrl("/api/platform/plans")).then(async (response) => response.ok ? response.json() as Promise<{ plans?: Plan[] }> : { plans: [] }).then((payload) => setPlans(payload.plans ?? [])).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const restoreAccount = async () => {
      try {
        const profile = await fetchPlatformAccount(token);
        if (!cancelled) { setAccount(profile); setView("account"); }
      } catch (error) {
        const savedSession = loadSession();
        if (error instanceof PlatformClientRequestError && error.status === 401 && savedSession?.access_token === token && savedSession.refresh_token) {
          try {
            const refreshed = await refreshPlatformSession(savedSession.refresh_token);
            if (!cancelled) setToken(refreshed.access_token);
            return;
          } catch {
            // A sessão será limpa abaixo quando o refresh token também não for válido.
          }
        }
        if (!cancelled && error instanceof PlatformClientRequestError && error.status === 401) {
          clearSession();
          setToken(undefined);
          setAccount(undefined);
          setView("access");
          setMessage("Sua sessão expirou. Entre novamente para continuar.");
        } else if (!cancelled) {
          setView("access");
          setMessage("Não foi possível validar sua conta agora. Verifique a conexão e tente novamente.");
        }
      }
    };
    void restoreAccount();
    return () => { cancelled = true; };
  }, [token]);

  useEffect(() => {
    if (!token || !account) return;
    if (account.role === "admin") {
      void authenticatedJson<AdminPayload>("/api/platform/admin/overview", token).then((data) => { setAdminData(data); setSelectedStoreId((current) => current || data.stores[0]?.id || ""); }).catch((error: Error) => setMessage(error.message));
    }
    if (account.role === "retailer") void authenticatedJson<RetailerPayload>("/api/platform/retailer/dashboard", token).then(setRetailerData).catch((error: Error) => setMessage(error.message));
  }, [account, token]);

  const authenticate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true); setMessage("");
    try {
      if (!isAuthConfigured() && !await loadSupabaseConfiguration()) throw new Error("Os logins ainda estão sendo configurados. Tente novamente em alguns minutos.");
      const session = isRegistering ? await signUpWithPassword(email, password, displayName) : await signInWithPassword(email, password);
      if (!session) {
        setIsRegistering(false);
        setMessage("Conta criada. Confirme o e-mail enviado pelo Supabase e depois entre com sua senha.");
        return;
      }
      const profile = await fetchPlatformAccount(session.access_token);
      rememberLandingSeen();
      setToken(session.access_token); setAccount(profile); setView("account");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível entrar."); } finally { setBusy(false); }
  };

  const refreshAdmin = async () => { if (token) setAdminData(await authenticatedJson<AdminPayload>("/api/platform/admin/overview", token)); };
  const refreshRetailer = async () => { if (token) setRetailerData(await authenticatedJson<RetailerPayload>("/api/platform/retailer/dashboard", token)); };

  const submitFlyer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token || !flyerFile) { setMessage("Selecione o folheto da oferta."); return; }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(flyerFile.type) || flyerFile.size > 8 * 1024 * 1024) { setMessage("Envie uma imagem JPG, PNG ou WebP de até 8 MB."); return; }
    setBusy(true); setMessage("");
    try {
      const form = new FormData(); form.append("flyer", flyerFile); if (account?.role === "admin") form.append("storeId", selectedStoreId);
      await authenticatedJson("/api/platform/flyers", token, { method: "POST", body: form });
      setFlyerFile(undefined); setMessage("Folheto recebido. A IA poderá extrair as ofertas para revisão.");
      if (account?.role === "admin") await refreshAdmin(); else await refreshRetailer();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível enviar o folheto."); } finally { setBusy(false); }
  };

  const analyzeFlyer = async (jobId: string) => {
    if (!token) return; setBusy(true); setMessage("");
    try { await authenticatedJson(`/api/platform/flyers/${jobId}/analyze`, token, { method: "POST" }); setMessage("Leitura concluída. Revise as ofertas antes de publicar."); await refreshAdmin(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível analisar o folheto."); } finally { setBusy(false); }
  };

  const publishFlyer = async (jobId: string) => {
    if (!token) return; setBusy(true); setMessage("");
    try { const result = await authenticatedJson<{ publishedOffers: number }>(`/api/platform/flyers/${jobId}/publish`, token, { method: "POST" }); setMessage(`${result.publishedOffers} ofertas foram publicadas.`); await refreshAdmin(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível publicar as ofertas."); } finally { setBusy(false); }
  };

  const createStore = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!token) return; setBusy(true); setMessage("");
    try { await authenticatedJson("/api/platform/admin/stores", token, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(newStore) }); setNewStore({ name: "", city: "Itaperuçu", neighborhood: "" }); setMessage("Loja cadastrada."); await refreshAdmin(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível cadastrar a loja."); } finally { setBusy(false); }
  };

  const startCheckout = async (planId: string) => {
    if (!token) return; setBusy(true); setMessage("");
    try { const result = await authenticatedJson<{ checkoutUrl: string }>("/api/platform/billing/checkout", token, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ planId }) }); window.location.assign(result.checkoutUrl); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível abrir o checkout."); } finally { setBusy(false); }
  };

  const logout = () => { clearSession(); setToken(undefined); setAccount(undefined); setRetailerData(undefined); setAdminData(undefined); setView("access"); setMessage("Você saiu da plataforma."); };

  if (view === "landing") return <section className="platform-landing" aria-label="Apresentação do PreçoCerto">
    <button className="portal-close" onClick={onClose} aria-label="Fechar apresentação">×</button>
    <div className="landing-brand"><span>p</span> preçocerto <small>beta local</small></div>
    <div className="landing-content"><div className="landing-kicker"><p className="eyebrow">INTELIGÊNCIA LOCAL DE PREÇOS</p><span>Curitiba + Itaperuçu</span></div><h1>Economia local,<br /><em>do seu jeito.</em></h1><p>Uma só plataforma para comparar sua compra, publicar ofertas e transformar os preços da região em decisões melhores.</p><div className="landing-proof"><span className="proof-orbs" aria-hidden="true"><i>🍎</i><i>🥬</i><i>🧺</i></span><span><b>Preços que fazem sentido perto de você</b><small>Dados organizados por mercado, produto e localidade.</small></span></div><div className="landing-actions"><button onClick={() => setView("access")}>Começar agora <span>→</span></button><button className="landing-secondary" onClick={onOpenShopping}>Ver comparador</button></div></div>
    <aside className="landing-side" aria-label="Exemplo de comparação de ofertas">
      <div className="landing-showcase"><div className="showcase-head"><span>EXEMPLO DE CESTA</span><b><i aria-hidden="true" /> Atualizado localmente</b></div><div className="showcase-body"><div className="showcase-basket" aria-hidden="true">🧺<span>🍊</span><span>🥬</span></div><div><small>Melhor combinação perto de você</small><strong>R$ 48,67</strong><p>3 itens comparados entre mercados próximos.</p></div></div><div className="showcase-stores"><span><i className="store-dot lime" />Mercado mais vantajoso</span><strong>− 16% na cesta</strong></div></div>
      <div className="landing-columns"><article><i aria-hidden="true">⌖</i><b>Para quem compra</b><span>Compare a cesta e economize sem adivinhação.</span></article><article><i aria-hidden="true">▣</i><b>Para mercados</b><span>Publique folhetos e destaque suas melhores ofertas.</span></article><article><i aria-hidden="true">✦</i><b>Para gestão</b><span>Valide informações e acompanhe os movimentos locais.</span></article></div>
    </aside>
  </section>;

  if (view === "access") return <section className="platform-access" aria-label="Acesso à plataforma">
    <button className="portal-close" onClick={onClose} aria-label="Fechar acesso">×</button>
    <div className="access-intro"><a className="brand" href="#inicio" onClick={(event) => { event.preventDefault(); setView("landing"); }}><span className="brand-mark">p</span><span>preçocerto</span></a><p className="eyebrow">ACESSO À PLATAFORMA</p><h2>Entre na sua conta.</h2><p>Cliente, varejista e administrador usam o mesmo acesso. O painel é liberado pelo papel definido pela administração.</p></div>
    <form className="access-form" onSubmit={authenticate}><label>{isRegistering ? "Seu nome" : "E-mail"}<input type={isRegistering ? "text" : "email"} value={isRegistering ? displayName : email} onChange={(event) => isRegistering ? setDisplayName(event.target.value) : setEmail(event.target.value)} required /></label>{isRegistering && <label>E-mail<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>}<label>Senha<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required /></label><button disabled={busy}>{busy ? "Aguarde…" : isRegistering ? "Criar conta" : "Entrar"}</button><button type="button" className="link-button" onClick={() => setIsRegistering((value) => !value)}>{isRegistering ? "Já tenho uma conta" : "Criar uma conta"}</button>{message && <p className="access-message" role="status">{message}</p>}<small>O primeiro administrador é definido por configuração segura do sistema. Contas de varejistas são liberadas pelo administrador.</small></form>
  </section>;

  return <>
    <section className="platform-dashboard" aria-label="Painel da plataforma">
    <header className="portal-header"><div><a className="brand" href="#inicio" onClick={(event) => { event.preventDefault(); onOpenShopping(); }}><span className="brand-mark">p</span><span>preçocerto</span></a><small>{currentRole === "admin" ? "Administração" : currentRole === "retailer" ? "Painel do varejista" : "Área do cliente"}</small></div><div><span>{account?.email}</span><button onClick={logout}>Sair</button></div></header>
    {currentRole === "customer" && <div className="portal-body customer-dashboard"><p className="eyebrow">ÁREA DO CLIENTE</p><h2>Olá, {account?.displayName ?? account?.email.split("@")[0]}.</h2><p>Compare sua cesta, participe da comunidade e acompanhe os preços perto de você.</p><div className="customer-cards"><article><span>⌖</span><b>Ofertas próximas</b><small>Use sua localização aproximada para comparar mercados.</small><button onClick={onOpenShopping}>Abrir comparador</button></article><article><span>✦</span><b>Pontos e alertas</b><small>Envie etiquetas e receba avisos quando o preço ideal aparecer.</small><button onClick={onOpenShopping}>Ver comunidade</button></article></div></div>}
    {currentRole === "retailer" && <div className="portal-body"><p className="eyebrow">PAINEL DO VAREJISTA</p><h2>{retailerData?.storeName ?? "Sua loja"}</h2><p>Envie folhetos, acompanhe a publicação e contrate o plano adequado para a sua operação.</p><div className="retailer-metrics"><article><small>Plano atual</small><b>{retailerData?.subscription?.planName ?? "Sem plano ativo"}</b><span>{retailerData?.subscription?.status ?? "Escolha um plano"}</span></article><article><small>Folhetos no mês</small><b>{retailerData?.flyersThisMonth ?? 0}</b><span>limite: {retailerData?.subscription?.monthlyFlyerLimit ?? "—"}</span></article><article><small>Ofertas ativas</small><b>{retailerData?.offers.length ?? 0}</b><span>na sua unidade</span></article></div><form className="flyer-form" onSubmit={submitFlyer}><label>Enviar folheto para análise por IA<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setFlyerFile(event.target.files?.[0])} required /></label><button disabled={busy}>Enviar para revisão</button></form><h3>Planos para varejistas</h3><div className="plan-grid">{planCards.map((plan) => <article key={plan.id}><span>{plan.analyticsLevel}</span><b>{plan.name}</b><strong>{plan.priceCents ? `${formatCurrency(plan.priceCents)}/mês` : "Sob consulta"}</strong><small>{plan.monthlyFlyerLimit === 9999 ? "Folhetos ilimitados" : `${plan.monthlyFlyerLimit} folhetos por mês`} · {plan.monthlyAiExtractionLimit === 9999 ? "IA ilimitada" : `${plan.monthlyAiExtractionLimit} leituras por IA`}</small><button disabled={busy || plan.priceCents === 0} onClick={() => void startCheckout(plan.id)}>{plan.priceCents ? "Assinar plano" : "Falar com a equipe"}</button></article>)}</div>{message && <p className="access-message" role="status">{message}</p>}</div>}
    {currentRole === "admin" && <div className="portal-body"><p className="eyebrow">ADMINISTRAÇÃO</p><h2>Operação e inteligência de preços.</h2><p>Cadastre lojas, configure planos e aprove ou publique ofertas extraídas por IA.</p><div className="admin-metrics"><article><small>Contas ativas</small><b>{adminData?.overview.activeUsers ?? 0}</b></article><article><small>Varejistas</small><b>{adminData?.overview.retailers ?? 0}</b></article><article><small>Lojas</small><b>{adminData?.overview.stores ?? 0}</b></article><article><small>Ofertas para revisar</small><b>{adminData?.overview.offersAwaitingReview ?? 0}</b></article></div><div className="admin-workspace"><form className="store-form" onSubmit={createStore}><h3>Nova loja e localidade</h3><input value={newStore.name} onChange={(event) => setNewStore({ ...newStore, name: event.target.value })} placeholder="Nome do mercado" required /><input value={newStore.city} onChange={(event) => setNewStore({ ...newStore, city: event.target.value })} placeholder="Cidade" required /><input value={newStore.neighborhood} onChange={(event) => setNewStore({ ...newStore, neighborhood: event.target.value })} placeholder="Bairro" required /><button disabled={busy}>Cadastrar loja</button></form><form className="flyer-form admin-flyer-form" onSubmit={submitFlyer}><h3>Folheto + IA</h3><select value={selectedStoreId} onChange={(event) => setSelectedStoreId(event.target.value)} required><option value="">Escolha a loja</option>{adminData?.stores.map((store) => <option key={store.id} value={store.id}>{store.name} · {store.city}</option>)}</select><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setFlyerFile(event.target.files?.[0])} required /><button disabled={busy}>Enviar folheto</button><small>A IA extrai produtos, preços e validade; a publicação permanece sob revisão humana.</small></form></div><div className="job-list"><h3>Fila de folhetos</h3>{adminData?.jobs.length ? adminData.jobs.map((job) => <article key={job.id}><div><b>{job.storeName}</b><span>{job.originalFilename} · {job.status} · {job.extractedCount} itens</span>{job.errorMessage && <small>{job.errorMessage}</small>}</div><div>{job.status === "queued" || job.status === "failed" ? <button disabled={busy} onClick={() => void analyzeFlyer(job.id)}>Analisar com IA</button> : null}{job.status === "pending_review" ? <button disabled={busy} onClick={() => void publishFlyer(job.id)}>Publicar após revisão</button> : null}</div></article>) : <p>Nenhum folheto na fila.</p>}</div><h3>Planos configurados</h3><div className="plan-grid admin-plans">{planCards.map((plan) => <article key={plan.id}><b>{plan.name}</b><strong>{plan.priceCents ? formatCurrency(plan.priceCents) : "Sob consulta"}</strong><small>{plan.description}</small><span>{plan.storeLimit === 9999 ? "Rede ilimitada" : `${plan.storeLimit} loja(s)`} · nível {plan.analyticsLevel}</span></article>)}</div>{message && <p className="access-message" role="status">{message}</p>}</div>}
    </section>
    {currentRole === "admin" && token ? <AdminMemberPanel token={token} stores={adminData?.stores ?? []} /> : null}
  </>;
}
