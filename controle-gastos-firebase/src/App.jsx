import { useState, useMemo, useEffect, useCallback } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from "firebase/auth";
import {
  doc, onSnapshot, setDoc, getDoc,
} from "firebase/firestore";
import { auth, db } from "./firebase";

// ─── Constants ────────────────────────────────────────────────────────────────
const CATEGORIES = [
  { id: "fixo",        label: "Gasto Fixo",    color: "#3B6FE8", bg: "#EEF3FD", icon: "🏠" },
  { id: "variavel",    label: "Gasto Variável", color: "#E85D3B", bg: "#FDF0EE", icon: "🛒" },
  { id: "pessoal",     label: "Gasto Pessoal",  color: "#9B51E0", bg: "#F5EEFB", icon: "👤" },
  { id: "lazer",       label: "Lazer",          color: "#E8A43B", bg: "#FDF6EE", icon: "🎉" },
  { id: "saude",       label: "Saúde",          color: "#27AE60", bg: "#EEF8F2", icon: "💊" },
  { id: "educacao",    label: "Educação",       color: "#2BBCB2", bg: "#EEF9F8", icon: "📚" },
  { id: "viagem",      label: "Viagem",         color: "#E84393", bg: "#FDEEF6", icon: "✈️" },
  { id: "emergencial", label: "Emergencial",    color: "#DC2626", bg: "#FEF2F2", icon: "🚨" },
  { id: "investimento",label: "Investimento",   color: "#0D9488", bg: "#F0FDFA", icon: "📈" },
  { id: "pet",         label: "Pet",            color: "#F59E0B", bg: "#FFFBEB", icon: "🐾" },
];

const TRAVEL_CATS = [
  { id: "passagem",    label: "Passagem",    icon: "✈️" },
  { id: "hospedagem",  label: "Hospedagem",  icon: "🏨" },
  { id: "alimentacao", label: "Alimentação", icon: "🍽️" },
  { id: "transporte",  label: "Transporte",  icon: "🚗" },
  { id: "passeio",     label: "Passeio",     icon: "🗺️" },
  { id: "compras",     label: "Compras",     icon: "🛍️" },
  { id: "outro",       label: "Outro",       icon: "📌" },
];

const MONTHS = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

function fmt(val) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val || 0);
}
function getCat(id)       { return CATEGORIES.find(c => c.id === id)   || CATEGORIES[0]; }
function getTravelCat(id) { return TRAVEL_CATS.find(c => c.id === id)  || TRAVEL_CATS[6]; }
function today()          { return new Date().toISOString().slice(0, 10); }
function avatar(name)     { return name ? name.trim()[0].toUpperCase() : "?"; }

function makeDefault() {
  return { income: 0, expenses: [], trips: [], lists: [{ id: 1, name: "Mercado", items: [] }], investments: [] };
}

// ─── Shared styles ────────────────────────────────────────────────────────────
const S = {
  inp:  { width: "100%", padding: "12px 14px", borderRadius: 10, border: "1.5px solid #E8E9F0", fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "inherit", background: "#fff", color: "#1A1D2E", transition: "border-color 0.2s" },
  lbl:  { fontSize: 11, fontWeight: 700, color: "#8B8FA8", display: "block", marginBottom: 6, letterSpacing: 0.8, textTransform: "uppercase" },
  card: { background: "#fff", borderRadius: 14, padding: "13px 15px", boxShadow: "0 1px 4px rgba(0,0,0,0.07)", display: "flex", alignItems: "center", gap: 12 },
  btn:  (bg, color = "#fff") => ({ background: bg, color, border: "none", borderRadius: 12, padding: "13px 0", fontSize: 14, fontWeight: 700, cursor: "pointer", width: "100%", transition: "opacity 0.15s" }),
  ghost:{ background: "none", border: "1.5px solid #E8E9F0", borderRadius: 12, padding: "12px 0", fontSize: 14, fontWeight: 600, cursor: "pointer", width: "100%", color: "#555" },
  pill: (active, ac) => ({ padding: "5px 13px", borderRadius: 20, border: "none", background: active ? ac : "#fff", color: active ? "#fff" : "#555", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", boxShadow: "0 1px 3px rgba(0,0,0,0.09)", transition: "all 0.15s" }),
  iconBox: (bg) => ({ width: 38, height: 38, borderRadius: 11, background: bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }),
};

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ msg, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 2200); return () => clearTimeout(t); }, []);
  return (
    <div style={{ position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)", background: "#1A1D2E", color: "#fff", borderRadius: 12, padding: "11px 20px", fontSize: 13, fontWeight: 600, zIndex: 500, boxShadow: "0 4px 20px rgba(0,0,0,0.25)", whiteSpace: "nowrap" }}>
      {msg}
    </div>
  );
}

// ─── Confirm Modal ─────────────────────────────────────────────────────────────
function Confirm({ emoji, title, sub, confirmLabel, confirmColor, onConfirm, onCancel }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 24 }}>
      <div style={{ background: "#fff", borderRadius: 20, padding: 28, maxWidth: 300, width: "100%", textAlign: "center" }}>
        <div style={{ fontSize: 36, marginBottom: 10 }}>{emoji}</div>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>{title}</div>
        {sub && <div style={{ color: "#8B8FA8", fontSize: 13, marginBottom: 20 }}>{sub}</div>}
        <div style={{ display: "flex", gap: 8, marginTop: sub ? 0 : 20 }}>
          <button onClick={onCancel} style={S.ghost}>Cancelar</button>
          <button onClick={onConfirm} style={S.btn(confirmColor || "#E85D3B")}>{confirmLabel || "Confirmar"}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Splash ───────────────────────────────────────────────────────────────────
function Splash() {
  return (
    <div style={{ position: "fixed", inset: 0, background: "linear-gradient(160deg,#1A1D2E 0%,#232740 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 9999, fontFamily: "'Inter',system-ui,sans-serif" }}>
      <div style={{ fontSize: 64, marginBottom: 16 }}>💰</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: "#fff" }}>Controle Financeiro</div>
      <div style={{ marginTop: 8, fontSize: 13, color: "#6B7280" }}>Carregando...</div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ marginTop: 28, width: 28, height: 28, border: "3px solid #2A2E40", borderTopColor: "#3B6FE8", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
    </div>
  );
}

// ─── Login ────────────────────────────────────────────────────────────────────
function Login({ onLogin }) {
  const [mode, setMode]   = useState("login");
  const [name, setName]   = useState("");
  const [email, setEmail] = useState("");
  const [pwd,   setPwd]   = useState("");
  const [conf,  setConf]  = useState("");
  const [err,   setErr]   = useState("");
  const [busy,  setBusy]  = useState(false);
  const [show,  setShow]  = useState(false);

  async function go() {
    setErr(""); setBusy(true);
    try {
      if (mode === "login") {
        if (!email || !pwd) { setErr("Preencha e-mail e senha."); setBusy(false); return; }
        await signInWithEmailAndPassword(auth, email, pwd);
      } else {
        if (!name || !email || !pwd || !conf) { setErr("Preencha todos os campos."); setBusy(false); return; }
        if (pwd !== conf) { setErr("As senhas não coincidem."); setBusy(false); return; }
        if (pwd.length < 6) { setErr("Senha mínima: 6 caracteres."); setBusy(false); return; }
        const cred = await createUserWithEmailAndPassword(auth, email, pwd);
        await updateProfile(cred.user, { displayName: name.trim() });
        // Create Firestore doc for this user
        await setDoc(doc(db, "users", cred.user.uid), makeDefault());
      }
    } catch (e) {
      const msgs = {
        "auth/user-not-found": "Usuário não encontrado.",
        "auth/wrong-password": "Senha incorreta.",
        "auth/email-already-in-use": "E-mail já cadastrado.",
        "auth/invalid-email": "E-mail inválido.",
        "auth/invalid-credential": "E-mail ou senha incorretos.",
      };
      setErr(msgs[e.code] || "Erro: " + e.message);
    }
    setBusy(false);
  }

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(160deg,#1A1D2E 0%,#232740 60%,#1e2a3a 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'Inter',system-ui,sans-serif" }}>
      <style>{`input:focus{border-color:#3B6FE8!important;box-shadow:0 0 0 3px rgba(59,111,232,0.12);}`}</style>
      <div style={{ marginBottom: 28, textAlign: "center" }}>
        <div style={{ fontSize: 56, marginBottom: 10 }}>💰</div>
        <div style={{ fontSize: 24, fontWeight: 800, color: "#fff" }}>Controle Financeiro</div>
        <div style={{ fontSize: 13, color: "#8B8FA8", marginTop: 4 }}>Organize sua vida financeira em família</div>
      </div>

      <div style={{ background: "#fff", borderRadius: 22, padding: 26, width: "100%", maxWidth: 380, boxShadow: "0 24px 64px rgba(0,0,0,0.35)" }}>
        <div style={{ display: "flex", background: "#F7F8FC", borderRadius: 12, padding: 4, marginBottom: 22 }}>
          {[["login","Entrar"],["register","Criar conta"]].map(([m, l]) => (
            <button key={m} onClick={() => { setMode(m); setErr(""); }}
              style={{ flex: 1, padding: "9px 0", borderRadius: 9, border: "none", background: mode === m ? "#fff" : "none", color: mode === m ? "#1A1D2E" : "#8B8FA8", fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: mode === m ? "0 1px 4px rgba(0,0,0,0.1)" : "none", transition: "all 0.2s" }}>
              {l}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {mode === "register" && (
            <div><label style={S.lbl}>Seu nome</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: João Silva" style={S.inp} /></div>
          )}
          <div><label style={S.lbl}>E-mail</label>
            <input value={email} onChange={e => setEmail(e.target.value)} placeholder="seuemail@email.com" type="email" style={S.inp}
              onKeyDown={e => e.key === "Enter" && go()} /></div>
          <div>
            <label style={S.lbl}>Senha</label>
            <div style={{ position: "relative" }}>
              <input value={pwd} onChange={e => setPwd(e.target.value)} type={show ? "text" : "password"} placeholder="••••••••" style={{ ...S.inp, paddingRight: 44 }}
                onKeyDown={e => e.key === "Enter" && go()} />
              <button onClick={() => setShow(v => !v)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#8B8FA8" }}>{show ? "🙈" : "👁️"}</button>
            </div>
          </div>
          {mode === "register" && (
            <div><label style={S.lbl}>Confirmar senha</label>
              <input value={conf} onChange={e => setConf(e.target.value)} type={show ? "text" : "password"} placeholder="••••••••" style={S.inp} /></div>
          )}

          {err && (
            <div style={{ background: "#FDF0EE", border: "1px solid #FBBDB0", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#E85D3B", fontWeight: 500 }}>
              ⚠️ {err}
            </div>
          )}

          <button onClick={go} disabled={busy} style={{ ...S.btn(busy ? "#8B8FA8" : "#1A1D2E"), marginTop: 4 }}>
            {busy ? "Aguarde..." : mode === "login" ? "Entrar →" : "Criar minha conta →"}
          </button>
        </div>
      </div>
      <div style={{ marginTop: 18, fontSize: 12, color: "#555e7a", textAlign: "center" }}>
        🔒 Autenticação segura via Firebase · Dados na nuvem
      </div>
    </div>
  );
}

// ─── APP ROOT ─────────────────────────────────────────────────────────────────
export default function App() {
  const [user,    setUser]    = useState(undefined); // undefined = loading
  const [data,    setData]    = useState(null);
  const [syncing, setSyncing] = useState(false);

  // Listen to Firebase Auth state
  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u || null);
      if (!u) { setData(null); return; }
      // Subscribe to Firestore real-time updates
      const ref = doc(db, "users", u.uid);
      const snap = await getDoc(ref);
      if (!snap.exists()) await setDoc(ref, makeDefault());
    });
  }, []);

  // Real-time Firestore listener
  useEffect(() => {
    if (!user) return;
    const ref = doc(db, "users", user.uid);
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) setData(snap.data());
    });
    return unsub;
  }, [user]);

  async function persist(newData) {
    if (!user) return;
    setSyncing(true);
    try {
      await setDoc(doc(db, "users", user.uid), newData);
    } catch(e) { console.error(e); }
    setSyncing(false);
  }

  async function handleLogout() {
    await signOut(auth);
  }

  if (user === undefined || (user && !data)) return <Splash />;
  if (!user) return <Login />;
  return <Dashboard user={user} data={data} persist={persist} syncing={syncing} onLogout={handleLogout} />;
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function Dashboard({ user, data, persist, syncing, onLogout }) {
  const now  = new Date();
  const name = user.displayName || user.email;

  const [tab,      setTab]      = useState("dashboard");
  const [expenses, setExpenses] = useState(data.expenses    || []);
  const [income,   setIncome]   = useState(data.income      || 0);
  const [trips,    setTrips]    = useState(data.trips       || []);
  const [lists,    setLists]    = useState(data.lists       || [{ id: 1, name: "Mercado", items: [] }]);
  const [investments, setInvestments] = useState(data.investments || []);

  const [form,       setForm]       = useState({ desc: "", value: "", cat: "fixo", date: today() });
  const [editIncome, setEditIncome] = useState(false);
  const [incomeIn,   setIncomeIn]   = useState(income);
  const [filterCat,  setFilterCat]  = useState("all");

  const [activeTrip,   setActiveTrip]   = useState(data.trips?.[0]?.id || null);
  const [tripForm,     setTripForm]     = useState({ desc: "", value: "", cat: "passagem", date: today() });
  const [showTripForm, setShowTripForm] = useState(false);
  const [newTrip,      setNewTrip]      = useState({ show: false, name: "", budget: "" });

  const [activeList,   setActiveList]   = useState(data.lists?.[0]?.id || 1);
  const [shopForm,     setShopForm]     = useState({ name: "", qty: "1", unit: "un", price: "" });
  const [showShopForm, setShowShopForm] = useState(false);
  const [showNewList,  setShowNewList]  = useState(false);
  const [newListName,  setNewListName]  = useState("");

  const [invForm,     setInvForm]     = useState({ desc: "", value: "", tipo: "renda-fixa", date: today(), meta: "" });
  const [showInvForm, setShowInvForm] = useState(false);
  const [filterInv,   setFilterInv]   = useState("all");

  const [confirm,   setConfirm]   = useState(null);
  const [toast,     setToast]     = useState("");
  const [logoutDlg, setLogoutDlg] = useState(false);

  const showToast = useCallback((msg) => setToast(msg), []);

  // Sync from Firestore into local state when data changes externally
  useEffect(() => {
    setExpenses(data.expenses    || []);
    setIncome(data.income        || 0);
    setTrips(data.trips          || []);
    setLists(data.lists          || [{ id: 1, name: "Mercado", items: [] }]);
    setInvestments(data.investments || []);
  }, [data]);

  // Debounced persist — wait 600ms after last change before writing
  useEffect(() => {
    const t = setTimeout(() => {
      persist({ income, expenses, trips, lists, investments });
    }, 600);
    return () => clearTimeout(t);
  }, [income, expenses, trips, lists, investments]);

  // ── Computed ──────────────────────────────────────────────────────────────
  const total    = useMemo(() => expenses.reduce((s, e) => s + e.value, 0), [expenses]);
  const balance  = income - total;
  const pct      = income > 0 ? Math.min((total / income) * 100, 100) : 0;
  const barColor = pct > 85 ? "#E85D3B" : pct > 60 ? "#E8A43B" : "#27AE60";

  const byCategory = useMemo(() => CATEGORIES.map(cat => ({
    ...cat,
    total: expenses.filter(e => e.cat === cat.id).reduce((s, e) => s + e.value, 0),
    count: expenses.filter(e => e.cat === cat.id).length,
  })), [expenses]);

  const filtered  = filterCat === "all" ? expenses : expenses.filter(e => e.cat === filterCat);
  const sortedExp = [...filtered].sort((a, b) => new Date(b.date) - new Date(a.date));

  const currentTrip = trips.find(t => t.id === activeTrip);
  const tripTotal   = currentTrip?.items.reduce((s, i) => s + i.value, 0) || 0;
  const tripBal     = (currentTrip?.budget || 0) - tripTotal;

  const currentList  = lists.find(l => l.id === activeList);
  const shopTotal    = currentList?.items.reduce((s, i) => s + i.price * i.qty, 0) || 0;
  const shopChecked  = currentList?.items.filter(i => i.checked).reduce((s, i) => s + i.price * i.qty, 0) || 0;
  const checkedCount = currentList?.items.filter(i => i.checked).length || 0;

  const totalInvested = useMemo(() => investments.reduce((s, i) => s + i.value, 0), [investments]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  function addExpense() {
    if (!form.desc.trim() || !form.value || isNaN(+form.value) || +form.value <= 0) return;
    setExpenses(p => [{ id: Date.now(), desc: form.desc.trim(), value: +form.value, cat: form.cat, date: form.date, by: name }, ...p]);
    setForm({ desc: "", value: "", cat: form.cat, date: today() });
    showToast("✅ Gasto adicionado!"); setTab("list");
  }

  function addTripItem() {
    if (!tripForm.desc.trim() || !tripForm.value || isNaN(+tripForm.value) || +tripForm.value <= 0) return;
    setTrips(p => p.map(t => t.id === activeTrip
      ? { ...t, items: [{ id: Date.now(), desc: tripForm.desc.trim(), value: +tripForm.value, cat: tripForm.cat, date: tripForm.date, by: name }, ...t.items] } : t));
    setTripForm({ desc: "", value: "", cat: tripForm.cat, date: today() });
    setShowTripForm(false); showToast("✅ Gasto de viagem adicionado!");
  }

  function createTrip() {
    if (!newTrip.name.trim()) return;
    const id = Date.now();
    setTrips(p => [...p, { id, name: newTrip.name.trim(), budget: +newTrip.budget || 0, items: [] }]);
    setActiveTrip(id); setNewTrip({ show: false, name: "", budget: "" }); showToast("✈️ Viagem criada!");
  }

  function addShopItem() {
    if (!shopForm.name.trim() || !shopForm.price || isNaN(+shopForm.price) || +shopForm.price <= 0) return;
    setLists(p => p.map(l => l.id === activeList
      ? { ...l, items: [...l.items, { id: Date.now(), name: shopForm.name.trim(), qty: +shopForm.qty || 1, unit: shopForm.unit, price: +shopForm.price, checked: false }] } : l));
    setShopForm({ name: "", qty: "1", unit: "un", price: "" });
    setShowShopForm(false); showToast("🛒 Item adicionado!");
  }

  function toggleItem(id) {
    setLists(p => p.map(l => l.id === activeList
      ? { ...l, items: l.items.map(i => i.id === id ? { ...i, checked: !i.checked } : i) } : l));
  }

  function removeShopItem(id) {
    setLists(p => p.map(l => l.id === activeList ? { ...l, items: l.items.filter(i => i.id !== id) } : l));
    showToast("🗑️ Item removido.");
  }

  function clearChecked() {
    setLists(p => p.map(l => l.id === activeList ? { ...l, items: l.items.filter(i => !i.checked) } : l));
    setConfirm(null); showToast("✅ Marcados removidos!");
  }

  function createList() {
    if (!newListName.trim()) return;
    const id = Date.now();
    setLists(p => [...p, { id, name: newListName.trim(), items: [] }]);
    setActiveList(id); setNewListName(""); setShowNewList(false); showToast("🛒 Lista criada!");
  }

  function addInvestment() {
    if (!invForm.desc.trim() || !invForm.value || isNaN(+invForm.value) || +invForm.value <= 0) return;
    setInvestments(p => [{ id: Date.now(), desc: invForm.desc.trim(), value: +invForm.value, tipo: invForm.tipo, date: invForm.date, meta: +invForm.meta || 0, by: name }, ...p]);
    setInvForm({ desc: "", value: "", tipo: invForm.tipo, date: today(), meta: "" });
    setShowInvForm(false); showToast("📈 Investimento registrado!");
  }

  const NAV = [
    { id: "dashboard", emoji: "📊", label: "Resumo"  },
    { id: "list",      emoji: "📋", label: "Gastos"  },
    { id: "add",       emoji: "➕", label: "Lançar"  },
    { id: "travel",    emoji: "✈️", label: "Viagem"  },
    { id: "shop",      emoji: "🛒", label: "Compras" },
    { id: "invest",    emoji: "📈", label: "Investir"},
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#F2F4F8", fontFamily: "'Inter',system-ui,sans-serif", color: "#1A1D2E" }}>
      <style>{`
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes popIn{from{opacity:0;transform:scale(0.93)}to{opacity:1;transform:scale(1)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        input:focus,select:focus{border-color:#3B6FE8!important;box-shadow:0 0 0 3px rgba(59,111,232,0.12);}
        *{box-sizing:border-box;}
      `}</style>

      {/* ── HEADER ── */}
      <div style={{ background: "#1A1D2E", padding: "16px 18px 0", position: "sticky", top: 0, zIndex: 100, boxShadow: "0 2px 16px rgba(0,0,0,0.25)" }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "#4E5370", marginBottom: 3 }}>CONTROLE FINANCEIRO</div>
              <div style={{ fontSize: 19, fontWeight: 800, color: "#fff" }}>Meus Gastos 💰</div>
              <div style={{ fontSize: 11, color: "#6B7280", marginTop: 2 }}>{MONTHS[now.getMonth()]} de {now.getFullYear()}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <button onClick={() => setLogoutDlg(true)}
                style={{ display: "flex", alignItems: "center", gap: 8, background: "#232740", border: "none", borderRadius: 20, padding: "5px 11px 5px 6px", cursor: "pointer", marginBottom: 8 }}>
                <div style={{ width: 26, height: 26, borderRadius: "50%", background: "linear-gradient(135deg,#3B6FE8,#9B51E0)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: "#fff" }}>
                  {avatar(name)}
                </div>
                <span style={{ color: "#C9CEDA", fontSize: 12, fontWeight: 600 }}>{name.split(" ")[0]}</span>
                {syncing && <div style={{ width: 10, height: 10, border: "2px solid #444", borderTopColor: "#3B6FE8", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />}
              </button>
              {editIncome ? (
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input type="number" value={incomeIn} onChange={e => setIncomeIn(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && (setIncome(+incomeIn || 0), setEditIncome(false), showToast("💾 Renda atualizada!"))}
                    style={{ width: 100, borderRadius: 8, border: "1.5px solid #3B6FE8", background: "#2A2E40", color: "#fff", padding: "5px 8px", fontSize: 13 }} autoFocus />
                  <button onClick={() => { setIncome(+incomeIn || 0); setEditIncome(false); showToast("💾 Renda atualizada!"); }}
                    style={{ background: "#3B6FE8", border: "none", borderRadius: 7, color: "#fff", padding: "5px 11px", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>✓</button>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
                  <span style={{ fontSize: 15, fontWeight: 800, color: income > 0 ? "#A5F3B4" : "#6B7280" }}>{income > 0 ? fmt(income) : "— Definir renda"}</span>
                  <button onClick={() => { setIncomeIn(income); setEditIncome(true); }}
                    style={{ background: "none", border: "1px solid #2A2E40", borderRadius: 5, color: "#6B7280", padding: "2px 6px", cursor: "pointer", fontSize: 10 }}>✏️</button>
                </div>
              )}
              <div style={{ fontSize: 10, color: "#4E5370" }}>renda mensal</div>
            </div>
          </div>

          {/* Summary bar */}
          <div style={{ background: "#232740", borderRadius: "14px 14px 0 0", padding: "13px 16px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <div><div style={{ fontSize: 10, color: "#6B7280" }}>Total gasto</div><div style={{ fontSize: 20, fontWeight: 800, color: "#fff" }}>{fmt(total)}</div></div>
              <div style={{ textAlign: "right" }}><div style={{ fontSize: 10, color: "#6B7280" }}>Saldo disponível</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: income === 0 ? "#6B7280" : balance >= 0 ? "#A5F3B4" : "#F87171" }}>
                  {income > 0 ? fmt(balance) : "—"}
                </div>
              </div>
            </div>
            {income > 0 && (
              <>
                <div style={{ background: "#1A1D2E", borderRadius: 8, height: 7, overflow: "hidden" }}>
                  <div style={{ width: `${pct}%`, height: "100%", background: barColor, borderRadius: 8, transition: "width 0.6s" }} />
                </div>
                <div style={{ fontSize: 10, color: pct > 85 ? "#F87171" : pct > 60 ? "#FCD34D" : "#6EE7A0", marginTop: 5, fontWeight: 600 }}>
                  {pct.toFixed(0)}% da renda comprometida {pct > 85 ? "⚠️" : pct > 60 ? "😐" : "✅"}
                </div>
              </>
            )}
          </div>

          {/* Nav */}
          <div style={{ display: "flex" }}>
            {NAV.map(n => (
              <button key={n.id} onClick={() => setTab(n.id)}
                style={{ flex: 1, background: tab === n.id ? "#F2F4F8" : "none", border: "none", borderRadius: tab === n.id ? "8px 8px 0 0" : 0, color: tab === n.id ? "#1A1D2E" : "#6B7280", padding: "7px 0 5px", fontSize: 9, fontWeight: 700, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, transition: "all 0.15s" }}>
                <span style={{ fontSize: 15 }}>{n.emoji}</span>{n.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "18px 16px 80px", animation: "fadeUp 0.3s ease" }}>

        {/* DASHBOARD */}
        {tab === "dashboard" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
              {[
                { label: "Lançamentos",       value: expenses.length,                              icon: "📋", color: "#3B6FE8" },
                { label: "Categorias usadas", value: byCategory.filter(c => c.total > 0).length,  icon: "🏷️", color: "#9B51E0" },
              ].map(s => (
                <div key={s.label} style={{ background: "#fff", borderRadius: 14, padding: "14px 16px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                  <div style={{ fontSize: 20 }}>{s.icon}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: s.color, marginTop: 6 }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: "#8B8FA8", marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Investment banner */}
            {totalInvested > 0 && (
              <div style={{ background: "linear-gradient(135deg,#0D9488,#0369A1)", borderRadius: 14, padding: "13px 16px", marginBottom: 12, display: "flex", alignItems: "center", gap: 12, boxShadow: "0 4px 16px rgba(13,148,136,0.25)" }}>
                <div style={{ fontSize: 26 }}>📈</div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: "#fff", fontWeight: 800, fontSize: 13 }}>Investimentos ativos</div>
                  <div style={{ color: "#99F6E4", fontSize: 12, marginTop: 1 }}>{investments.length} registro{investments.length !== 1 ? "s" : ""} · {fmt(totalInvested)} investidos</div>
                </div>
                <button onClick={() => setTab("invest")} style={{ background: "rgba(255,255,255,0.2)", border: "none", borderRadius: 8, color: "#fff", padding: "6px 12px", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>Ver →</button>
              </div>
            )}

            {/* Emergency banner */}
            {byCategory.find(c => c.id === "emergencial" && c.total > 0) && (() => {
              const ec = byCategory.find(c => c.id === "emergencial");
              return (
                <div style={{ background: "linear-gradient(135deg,#DC2626,#991B1B)", borderRadius: 14, padding: "13px 16px", marginBottom: 12, display: "flex", alignItems: "center", gap: 12, boxShadow: "0 4px 16px rgba(220,38,38,0.3)" }}>
                  <div style={{ fontSize: 26 }}>🚨</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: "#fff", fontWeight: 800, fontSize: 13 }}>Gastos Emergenciais</div>
                    <div style={{ color: "#FCA5A5", fontSize: 12, marginTop: 1 }}>{ec.count} ocorrência{ec.count !== 1 ? "s" : ""} · {fmt(ec.total)}</div>
                  </div>
                </div>
              );
            })()}

            <div style={{ fontSize: 11, fontWeight: 700, color: "#8B8FA8", marginBottom: 11, letterSpacing: 1, textTransform: "uppercase" }}>Por categoria</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {byCategory.filter(c => c.total > 0).sort((a, b) => b.total - a.total).map(cat => {
                const cp = income > 0 ? (cat.total / income) * 100 : 0;
                const isEmerg = cat.id === "emergencial";
                return (
                  <div key={cat.id} style={{ ...S.card, border: isEmerg ? "2px solid #DC2626" : "2px solid transparent", boxShadow: isEmerg ? "0 2px 12px rgba(220,38,38,0.18)" : "0 1px 4px rgba(0,0,0,0.07)" }}>
                    <div style={S.iconBox(cat.bg)}>{cat.icon}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{cat.label}</span>
                        <span style={{ fontSize: 13, fontWeight: 800, color: cat.color }}>{fmt(cat.total)}</span>
                      </div>
                      <div style={{ background: "#F0F2F8", borderRadius: 6, height: 5, overflow: "hidden" }}>
                        <div style={{ width: `${cp}%`, height: "100%", background: cat.color, borderRadius: 6, transition: "width 0.5s" }} />
                      </div>
                      <div style={{ fontSize: 10, color: "#8B8FA8", marginTop: 3 }}>
                        {cat.count} lançamento{cat.count !== 1 ? "s" : ""}{income > 0 ? ` · ${cp.toFixed(1)}% da renda` : ""}
                      </div>
                    </div>
                  </div>
                );
              })}
              {byCategory.every(c => c.total === 0) && (
                <div style={{ textAlign: "center", padding: "50px 20px", color: "#8B8FA8" }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>📊</div>
                  <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>Nenhum gasto ainda</div>
                  <div style={{ fontSize: 13 }}>Toque em ➕ Lançar para começar</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* GASTOS LIST */}
        {tab === "list" && (
          <div>
            <div style={{ display: "flex", gap: 6, marginBottom: 14, overflowX: "auto", paddingBottom: 4 }}>
              <button onClick={() => setFilterCat("all")} style={S.pill(filterCat === "all", "#1A1D2E")}>Todos ({expenses.length})</button>
              {CATEGORIES.filter(c => expenses.some(e => e.cat === c.id)).map(cat => (
                <button key={cat.id} onClick={() => setFilterCat(cat.id)} style={S.pill(filterCat === cat.id, cat.color)}>
                  {cat.icon} {cat.label}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {sortedExp.map(exp => {
                const cat = getCat(exp.cat);
                return (
                  <div key={exp.id} style={{ ...S.card, border: exp.cat === "emergencial" ? "2px solid #DC2626" : "2px solid transparent" }}>
                    <div style={S.iconBox(cat.bg)}>{cat.icon}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{exp.desc}</div>
                      <div style={{ fontSize: 11, color: "#8B8FA8" }}>
                        {cat.label} · {new Date(exp.date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                        {exp.by && exp.by !== name ? <span style={{ color: "#3B6FE8" }}> · {exp.by.split(" ")[0]}</span> : ""}
                      </div>
                    </div>
                    <div style={{ fontWeight: 800, color: cat.color, fontSize: 14, flexShrink: 0 }}>{fmt(exp.value)}</div>
                    <button onClick={() => setConfirm({ type: "expense", id: exp.id })}
                      style={{ background: "none", border: "none", color: "#D1D5DB", cursor: "pointer", fontSize: 16, padding: "4px 6px" }}>🗑️</button>
                  </div>
                );
              })}
              {sortedExp.length === 0 && (
                <div style={{ textAlign: "center", padding: "50px 20px", color: "#8B8FA8" }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
                  <div style={{ fontWeight: 600 }}>Nenhum lançamento</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ADICIONAR */}
        {tab === "add" && (
          <div style={{ background: "#fff", borderRadius: 18, padding: 22, boxShadow: "0 2px 12px rgba(0,0,0,0.08)" }}>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 18 }}>➕ Novo Gasto</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div><label style={S.lbl}>Descrição</label><input value={form.desc} onChange={e => setForm(f => ({ ...f, desc: e.target.value }))} placeholder="Ex: Conta de luz" style={S.inp} /></div>
              <div><label style={S.lbl}>Valor (R$)</label><input value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} placeholder="0,00" type="number" min="0" step="0.01" style={S.inp} /></div>
              <div>
                <label style={S.lbl}>Categoria</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
                  {CATEGORIES.map(cat => (
                    <button key={cat.id} onClick={() => setForm(f => ({ ...f, cat: cat.id }))}
                      style={{ padding: "10px 11px", borderRadius: 11, border: `2px solid ${form.cat === cat.id ? cat.color : "#E8E9F0"}`, background: form.cat === cat.id ? cat.bg : "#fff", color: form.cat === cat.id ? cat.color : "#666", fontSize: 12, fontWeight: 700, cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 7 }}>
                      {cat.icon} {cat.label}
                    </button>
                  ))}
                </div>
              </div>
              <div><label style={S.lbl}>Data</label><input value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} type="date" style={S.inp} /></div>
              <button onClick={addExpense} style={{ ...S.btn("#1A1D2E"), opacity: (!form.desc || !form.value) ? 0.5 : 1 }}>Salvar Gasto</button>
            </div>
          </div>
        )}

        {/* VIAGEM */}
        {tab === "travel" && (
          <div>
            <div style={{ display: "flex", gap: 6, marginBottom: 14, overflowX: "auto", paddingBottom: 2, alignItems: "center" }}>
              {trips.map(t => (
                <button key={t.id} onClick={() => setActiveTrip(t.id)} style={S.pill(activeTrip === t.id, "#E84393")}>✈️ {t.name}</button>
              ))}
              <button onClick={() => setNewTrip(v => ({ ...v, show: !v.show }))}
                style={{ ...S.pill(false), border: "2px dashed #E84393", color: "#E84393", paddingLeft: 12, paddingRight: 12 }}>+ Nova</button>
            </div>
            {newTrip.show && (
              <div style={{ background: "#fff", borderRadius: 14, padding: 16, marginBottom: 14, boxShadow: "0 1px 6px rgba(0,0,0,0.09)" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div><label style={S.lbl}>Destino</label><input value={newTrip.name} onChange={e => setNewTrip(v => ({ ...v, name: e.target.value }))} placeholder="Ex: Floripa" style={S.inp} /></div>
                  <div><label style={S.lbl}>Orçamento (R$)</label><input value={newTrip.budget} onChange={e => setNewTrip(v => ({ ...v, budget: e.target.value }))} placeholder="0,00" type="number" style={S.inp} /></div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => setNewTrip(v => ({ ...v, show: false }))} style={S.ghost}>Cancelar</button>
                    <button onClick={createTrip} style={S.btn("#E84393")}>Criar</button>
                  </div>
                </div>
              </div>
            )}
            {currentTrip ? (
              <>
                <div style={{ background: "linear-gradient(135deg,#E84393 0%,#9B51E0 100%)", borderRadius: 18, padding: "16px 18px", marginBottom: 14, color: "#fff" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 800 }}>✈️ {currentTrip.name}</div>
                      <div style={{ fontSize: 11, opacity: 0.75, marginTop: 2 }}>{currentTrip.items.length} lançamento{currentTrip.items.length !== 1 ? "s" : ""}</div>
                    </div>
                    <button onClick={() => setConfirm({ type: "trip", id: currentTrip.id, name: currentTrip.name })}
                      style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 8, color: "#fff", padding: "5px 10px", cursor: "pointer", fontSize: 12 }}>🗑️</button>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14 }}>
                    <div><div style={{ fontSize: 10, opacity: 0.7 }}>Gasto</div><div style={{ fontSize: 22, fontWeight: 800 }}>{fmt(tripTotal)}</div></div>
                    {currentTrip.budget > 0 && <div style={{ textAlign: "right" }}><div style={{ fontSize: 10, opacity: 0.7 }}>Restante</div><div style={{ fontSize: 22, fontWeight: 800, color: tripBal >= 0 ? "#A5F3B4" : "#FCA5A5" }}>{fmt(tripBal)}</div></div>}
                  </div>
                  {currentTrip.budget > 0 && (
                    <><div style={{ background: "rgba(0,0,0,0.2)", borderRadius: 6, height: 6, overflow: "hidden", marginTop: 10 }}>
                      <div style={{ width: `${Math.min((tripTotal / currentTrip.budget) * 100, 100)}%`, height: "100%", background: "#fff", borderRadius: 6 }} />
                    </div>
                    <div style={{ fontSize: 10, opacity: 0.7, marginTop: 4 }}>Orçamento: {fmt(currentTrip.budget)}</div></>
                  )}
                </div>
                <button onClick={() => setShowTripForm(v => !v)}
                  style={{ width: "100%", padding: "11px", borderRadius: 12, border: "2px dashed #E84393", background: "none", color: "#E84393", fontSize: 13, fontWeight: 700, cursor: "pointer", marginBottom: 12 }}>
                  {showTripForm ? "▲ Fechar" : "➕ Registrar gasto"}
                </button>
                {showTripForm && (
                  <div style={{ background: "#fff", borderRadius: 14, padding: 18, marginBottom: 14, boxShadow: "0 1px 6px rgba(0,0,0,0.09)" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      <div><label style={S.lbl}>Descrição</label><input value={tripForm.desc} onChange={e => setTripForm(f => ({ ...f, desc: e.target.value }))} placeholder="Ex: Jantar" style={S.inp} /></div>
                      <div><label style={S.lbl}>Valor (R$)</label><input value={tripForm.value} onChange={e => setTripForm(f => ({ ...f, value: e.target.value }))} type="number" placeholder="0,00" style={S.inp} /></div>
                      <div>
                        <label style={S.lbl}>Tipo</label>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6 }}>
                          {TRAVEL_CATS.map(tc => (
                            <button key={tc.id} onClick={() => setTripForm(f => ({ ...f, cat: tc.id }))}
                              style={{ padding: "8px 4px", borderRadius: 10, border: `2px solid ${tripForm.cat === tc.id ? "#E84393" : "#E8E9F0"}`, background: tripForm.cat === tc.id ? "#FDEEF6" : "#fff", color: tripForm.cat === tc.id ? "#E84393" : "#666", fontSize: 10, fontWeight: 600, cursor: "pointer", textAlign: "center", lineHeight: 1.5 }}>
                              <div style={{ fontSize: 16 }}>{tc.icon}</div>{tc.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div><label style={S.lbl}>Data</label><input value={tripForm.date} onChange={e => setTripForm(f => ({ ...f, date: e.target.value }))} type="date" style={S.inp} /></div>
                      <button onClick={addTripItem} style={S.btn("#E84393")}>Adicionar</button>
                    </div>
                  </div>
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  {[...currentTrip.items].sort((a, b) => new Date(b.date) - new Date(a.date)).map(item => {
                    const tc = getTravelCat(item.cat);
                    return (
                      <div key={item.id} style={S.card}>
                        <div style={{ ...S.iconBox("#FDEEF6"), fontSize: 20 }}>{tc.icon}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{item.desc}</div>
                          <div style={{ fontSize: 11, color: "#8B8FA8" }}>{tc.label} · {new Date(item.date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                            {item.by && item.by !== name ? <span style={{ color: "#E84393" }}> · {item.by.split(" ")[0]}</span> : ""}
                          </div>
                        </div>
                        <div style={{ fontWeight: 800, color: "#E84393", fontSize: 14, flexShrink: 0 }}>{fmt(item.value)}</div>
                        <button onClick={() => setConfirm({ type: "tripItem", id: item.id })}
                          style={{ background: "none", border: "none", color: "#D1D5DB", cursor: "pointer", fontSize: 16, padding: "4px 6px" }}>🗑️</button>
                      </div>
                    );
                  })}
                  {currentTrip.items.length === 0 && <div style={{ textAlign: "center", padding: "40px 20px", color: "#8B8FA8" }}><div style={{ fontSize: 40, marginBottom: 8 }}>✈️</div>Nenhum gasto registrado</div>}
                </div>
              </>
            ) : <div style={{ textAlign: "center", padding: "50px 20px", color: "#8B8FA8" }}><div style={{ fontSize: 48, marginBottom: 12 }}>✈️</div>Crie sua primeira viagem!</div>}
          </div>
        )}

        {/* COMPRAS */}
        {tab === "shop" && (
          <div>
            <div style={{ display: "flex", gap: 6, marginBottom: 14, overflowX: "auto", paddingBottom: 2, alignItems: "center" }}>
              {lists.map(l => <button key={l.id} onClick={() => setActiveList(l.id)} style={S.pill(activeList === l.id, "#27AE60")}>🛒 {l.name}</button>)}
              <button onClick={() => setShowNewList(v => !v)}
                style={{ ...S.pill(false), border: "2px dashed #27AE60", color: "#27AE60", paddingLeft: 12, paddingRight: 12 }}>+ Nova lista</button>
            </div>
            {showNewList && (
              <div style={{ background: "#fff", borderRadius: 14, padding: 14, marginBottom: 14, boxShadow: "0 1px 6px rgba(0,0,0,0.09)" }}>
                <div style={{ display: "flex", gap: 8 }}>
                  <input value={newListName} onChange={e => setNewListName(e.target.value)} placeholder="Nome da lista" style={{ ...S.inp, flex: 1 }} onKeyDown={e => e.key === "Enter" && createList()} />
                  <button onClick={createList} style={{ padding: "0 18px", borderRadius: 10, border: "none", background: "#27AE60", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Criar</button>
                </div>
              </div>
            )}
            {currentList && (
              <>
                <div style={{ background: "linear-gradient(135deg,#27AE60 0%,#2BBCB2 100%)", borderRadius: 18, padding: "16px 20px", marginBottom: 14, color: "#fff" }}>
                  <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 8 }}>🛒 {currentList.name}</div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <div><div style={{ fontSize: 10, opacity: 0.8 }}>Total</div><div style={{ fontSize: 20, fontWeight: 800 }}>{fmt(shopTotal)}</div></div>
                    <div style={{ textAlign: "right" }}><div style={{ fontSize: 10, opacity: 0.8 }}>No carrinho ✓</div><div style={{ fontSize: 20, fontWeight: 800, color: "#A5F3B4" }}>{fmt(shopChecked)}</div></div>
                  </div>
                  <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontSize: 11, opacity: 0.85 }}>{checkedCount} de {currentList.items.length} itens</div>
                    {checkedCount > 0 && <button onClick={() => setConfirm({ type: "clearChecked" })}
                      style={{ background: "rgba(255,255,255,0.18)", border: "none", borderRadius: 8, color: "#fff", padding: "4px 10px", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>Limpar marcados</button>}
                  </div>
                </div>
                <button onClick={() => setShowShopForm(v => !v)}
                  style={{ width: "100%", padding: "11px", borderRadius: 12, border: "2px dashed #27AE60", background: "none", color: "#27AE60", fontSize: 13, fontWeight: 700, cursor: "pointer", marginBottom: 12 }}>
                  {showShopForm ? "▲ Fechar" : "➕ Adicionar item"}
                </button>
                {showShopForm && (
                  <div style={{ background: "#fff", borderRadius: 14, padding: 18, marginBottom: 14, boxShadow: "0 1px 6px rgba(0,0,0,0.09)" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      <div><label style={S.lbl}>Produto</label><input value={shopForm.name} onChange={e => setShopForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Arroz 5kg" style={S.inp} /></div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                        <div><label style={S.lbl}>Qtd</label><input value={shopForm.qty} onChange={e => setShopForm(f => ({ ...f, qty: e.target.value }))} type="number" min="1" style={S.inp} /></div>
                        <div><label style={S.lbl}>Unidade</label>
                          <select value={shopForm.unit} onChange={e => setShopForm(f => ({ ...f, unit: e.target.value }))} style={{ ...S.inp, padding: "12px 8px" }}>
                            {["un","kg","g","L","ml","cx","pct","dz","m"].map(u => <option key={u}>{u}</option>)}
                          </select>
                        </div>
                        <div><label style={S.lbl}>Preço R$</label><input value={shopForm.price} onChange={e => setShopForm(f => ({ ...f, price: e.target.value }))} type="number" min="0" step="0.01" placeholder="0,00" style={S.inp} /></div>
                      </div>
                      <button onClick={addShopItem} style={S.btn("#27AE60")}>Adicionar item</button>
                    </div>
                  </div>
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  {[...currentList.items].sort((a, b) => a.checked - b.checked).map(item => (
                    <div key={item.id} style={{ ...S.card, opacity: item.checked ? 0.6 : 1 }}>
                      <button onClick={() => toggleItem(item.id)}
                        style={{ width: 28, height: 28, borderRadius: 8, border: `2.5px solid ${item.checked ? "#27AE60" : "#D1D5DB"}`, background: item.checked ? "#27AE60" : "#fff", color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {item.checked ? "✓" : ""}
                      </button>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, textDecoration: item.checked ? "line-through" : "none" }}>{item.name}</div>
                        <div style={{ fontSize: 11, color: "#8B8FA8" }}>{item.qty} {item.unit} × {fmt(item.price)}</div>
                      </div>
                      <div style={{ fontWeight: 800, color: item.checked ? "#27AE60" : "#1A1D2E", fontSize: 14, flexShrink: 0 }}>{fmt(item.price * item.qty)}</div>
                      <button onClick={() => removeShopItem(item.id)} style={{ background: "none", border: "none", color: "#D1D5DB", cursor: "pointer", fontSize: 16, padding: "4px 6px" }}>🗑️</button>
                    </div>
                  ))}
                  {currentList.items.length === 0 && <div style={{ textAlign: "center", padding: "40px 20px", color: "#8B8FA8" }}><div style={{ fontSize: 44, marginBottom: 8 }}>🛒</div>Lista vazia!</div>}
                </div>
              </>
            )}
          </div>
        )}

        {/* INVESTIMENTOS */}
        {tab === "invest" && (
          <div>
            <div style={{ background: "linear-gradient(135deg,#0D9488 0%,#0369A1 100%)", borderRadius: 18, padding: "18px 20px", marginBottom: 14, color: "#fff" }}>
              <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 10 }}>📈 Meus Investimentos</div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div><div style={{ fontSize: 10, opacity: 0.8 }}>Total investido</div><div style={{ fontSize: 24, fontWeight: 800 }}>{fmt(totalInvested)}</div></div>
                <div style={{ textAlign: "right" }}><div style={{ fontSize: 10, opacity: 0.8 }}>Lançamentos</div><div style={{ fontSize: 24, fontWeight: 800 }}>{investments.length}</div></div>
              </div>
              {income > 0 && totalInvested > 0 && <div style={{ marginTop: 10, fontSize: 12, opacity: 0.85 }}>💡 {((totalInvested / income) * 100).toFixed(1)}% da sua renda investida</div>}
            </div>
            {investments.length > 0 && (
              <div style={{ display: "flex", gap: 6, marginBottom: 14, overflowX: "auto", paddingBottom: 2 }}>
                {[["all","Todos"],["renda-fixa","Renda Fixa"],["renda-variavel","Renda Var."],["cripto","Cripto"],["fundo","Fundo"],["imovel","Imóvel"],["outro","Outro"]].map(([id, label]) => (
                  <button key={id} onClick={() => setFilterInv(id)} style={S.pill(filterInv === id, "#0D9488")}>{label}</button>
                ))}
              </div>
            )}
            <button onClick={() => setShowInvForm(v => !v)}
              style={{ width: "100%", padding: "11px", borderRadius: 12, border: "2px dashed #0D9488", background: "none", color: "#0D9488", fontSize: 13, fontWeight: 700, cursor: "pointer", marginBottom: 12 }}>
              {showInvForm ? "▲ Fechar" : "➕ Registrar investimento"}
            </button>
            {showInvForm && (
              <div style={{ background: "#fff", borderRadius: 14, padding: 18, marginBottom: 14, boxShadow: "0 1px 6px rgba(0,0,0,0.09)" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div><label style={S.lbl}>Descrição</label><input value={invForm.desc} onChange={e => setInvForm(f => ({ ...f, desc: e.target.value }))} placeholder="Ex: Tesouro Direto, PETR4..." style={S.inp} /></div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div><label style={S.lbl}>Valor (R$)</label><input value={invForm.value} onChange={e => setInvForm(f => ({ ...f, value: e.target.value }))} type="number" min="0" step="0.01" placeholder="0,00" style={S.inp} /></div>
                    <div><label style={S.lbl}>Meta (R$) — opcional</label><input value={invForm.meta} onChange={e => setInvForm(f => ({ ...f, meta: e.target.value }))} type="number" min="0" step="0.01" placeholder="0,00" style={S.inp} /></div>
                  </div>
                  <div>
                    <label style={S.lbl}>Tipo</label>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                      {[["renda-fixa","🏦","Renda Fixa"],["renda-variavel","📉","Renda Var."],["cripto","₿","Cripto"],["fundo","🧺","Fundo"],["imovel","🏢","Imóvel"],["outro","💼","Outro"]].map(([id, ico, label]) => (
                        <button key={id} onClick={() => setInvForm(f => ({ ...f, tipo: id }))}
                          style={{ padding: "9px 5px", borderRadius: 10, border: `2px solid ${invForm.tipo === id ? "#0D9488" : "#E8E9F0"}`, background: invForm.tipo === id ? "#F0FDFA" : "#fff", color: invForm.tipo === id ? "#0D9488" : "#666", fontSize: 11, fontWeight: 700, cursor: "pointer", textAlign: "center", lineHeight: 1.5 }}>
                          <div style={{ fontSize: 18 }}>{ico}</div>{label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div><label style={S.lbl}>Data</label><input value={invForm.date} onChange={e => setInvForm(f => ({ ...f, date: e.target.value }))} type="date" style={S.inp} /></div>
                  <button onClick={addInvestment} style={S.btn("#0D9488")}>Salvar investimento</button>
                </div>
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[...investments].filter(i => filterInv === "all" || i.tipo === filterInv).sort((a, b) => new Date(b.date) - new Date(a.date)).map(inv => {
                const tipoMap = { "renda-fixa":["🏦","#0369A1"],"renda-variavel":["📉","#7C3AED"],"cripto":["₿","#D97706"],"fundo":["🧺","#0D9488"],"imovel":["🏢","#059669"],"outro":["💼","#6B7280"] };
                const [ico, cor] = tipoMap[inv.tipo] || tipoMap["outro"];
                const metaPct = inv.meta > 0 ? Math.min((inv.value / inv.meta) * 100, 100) : 0;
                return (
                  <div key={inv.id} style={{ background: "#fff", borderRadius: 14, padding: "13px 15px", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 38, height: 38, borderRadius: 11, background: "#F0FDFA", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{ico}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{inv.desc}</div>
                        <div style={{ fontSize: 11, color: "#8B8FA8" }}>{inv.tipo.replace("-"," ")} · {new Date(inv.date+"T12:00:00").toLocaleDateString("pt-BR",{day:"2-digit",month:"short"})}
                          {inv.by && inv.by !== name ? <span style={{ color: "#0D9488" }}> · {inv.by.split(" ")[0]}</span> : ""}
                        </div>
                      </div>
                      <div style={{ fontWeight: 800, color: cor, fontSize: 14, flexShrink: 0 }}>{fmt(inv.value)}</div>
                      <button onClick={() => setConfirm({ type: "investment", id: inv.id })} style={{ background: "none", border: "none", color: "#D1D5DB", cursor: "pointer", fontSize: 16, padding: "4px 6px" }}>🗑️</button>
                    </div>
                    {inv.meta > 0 && (
                      <div style={{ marginTop: 10, paddingLeft: 50 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                          <span style={{ fontSize: 10, color: "#8B8FA8" }}>Meta: {fmt(inv.meta)}</span>
                          <span style={{ fontSize: 10, fontWeight: 700, color: "#0D9488" }}>{metaPct.toFixed(0)}%</span>
                        </div>
                        <div style={{ background: "#F0F2F8", borderRadius: 6, height: 5, overflow: "hidden" }}>
                          <div style={{ width: `${metaPct}%`, height: "100%", background: "#0D9488", borderRadius: 6 }} />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {investments.filter(i => filterInv === "all" || i.tipo === filterInv).length === 0 && (
                <div style={{ textAlign: "center", padding: "50px 20px", color: "#8B8FA8" }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>📈</div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>Nenhum investimento ainda</div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* LOGOUT MODAL */}
      {logoutDlg && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 24 }}>
          <div style={{ background: "#fff", borderRadius: 22, padding: 28, maxWidth: 300, width: "100%", textAlign: "center" }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "linear-gradient(135deg,#3B6FE8,#9B51E0)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 800, color: "#fff", margin: "0 auto 12px" }}>
              {avatar(name)}
            </div>
            <div style={{ fontWeight: 800, fontSize: 17 }}>{name}</div>
            <div style={{ color: "#8B8FA8", fontSize: 13, marginBottom: 8 }}>{user.email}</div>
            <div style={{ background: "#F7F8FC", borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "#6B7280", marginBottom: 22 }}>
              ☁️ Dados sincronizados na nuvem em tempo real
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setLogoutDlg(false)} style={S.ghost}>Fechar</button>
              <button onClick={onLogout} style={S.btn("#1A1D2E")}>Sair da conta</button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM MODALS */}
      {confirm?.type === "expense" && (
        <Confirm emoji="🗑️" title="Remover lançamento?" sub="Essa ação não pode ser desfeita."
          confirmLabel="Remover" confirmColor="#E85D3B"
          onConfirm={() => { setExpenses(p => p.filter(e => e.id !== confirm.id)); setConfirm(null); showToast("🗑️ Removido."); }}
          onCancel={() => setConfirm(null)} />
      )}
      {confirm?.type === "tripItem" && (
        <Confirm emoji="✈️" title="Remover gasto da viagem?"
          confirmLabel="Remover" confirmColor="#E84393"
          onConfirm={() => { setTrips(p => p.map(t => t.id === activeTrip ? { ...t, items: t.items.filter(i => i.id !== confirm.id) } : t)); setConfirm(null); showToast("🗑️ Removido."); }}
          onCancel={() => setConfirm(null)} />
      )}
      {confirm?.type === "trip" && (
        <Confirm emoji="⚠️" title={`Excluir viagem "${confirm.name}"?`} sub="Todos os gastos serão apagados."
          confirmLabel="Excluir" confirmColor="#E84393"
          onConfirm={() => { const r = trips.filter(t => t.id !== confirm.id); setTrips(r); setActiveTrip(r[0]?.id || null); setConfirm(null); showToast("🗑️ Viagem removida."); }}
          onCancel={() => setConfirm(null)} />
      )}
      {confirm?.type === "clearChecked" && (
        <Confirm emoji="🛒" title="Remover itens marcados?" sub="Apenas os ✓ marcados serão removidos."
          confirmLabel="Remover" confirmColor="#27AE60"
          onConfirm={clearChecked} onCancel={() => setConfirm(null)} />
      )}
      {confirm?.type === "investment" && (
        <Confirm emoji="📈" title="Remover investimento?"
          confirmLabel="Remover" confirmColor="#0D9488"
          onConfirm={() => { setInvestments(p => p.filter(i => i.id !== confirm.id)); setConfirm(null); showToast("🗑️ Removido."); }}
          onCancel={() => setConfirm(null)} />
      )}

      {toast && <Toast msg={toast} onDone={() => setToast("")} />}
    </div>
  );
}
