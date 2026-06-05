import { useState, useCallback } from "react";
import { QueryClient, QueryClientProvider, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import Logo from "./Logo";

const CATEGORIES = {
  income: [
    { id: "salary",       label: "Sueldo",        icon: "💼", color: "#4ade80" },
    { id: "freelance",    label: "Freelance",      icon: "💻", color: "#34d399" },
    { id: "investment",   label: "Inversiones",    icon: "📈", color: "#6ee7b7" },
    { id: "other_income", label: "Otros ingresos", icon: "💰", color: "#a7f3d0" },
  ],
  expense: [
    { id: "food",          label: "Alimentación",  icon: "🛒", color: "#f87171" },
    { id: "transport",     label: "Transporte",    icon: "🚗", color: "#fb923c" },
    { id: "housing",       label: "Vivienda",      icon: "🏠", color: "#fbbf24" },
    { id: "health",        label: "Salud",         icon: "❤️", color: "#e879f9" },
    { id: "entertainment", label: "Ocio",          icon: "🎬", color: "#818cf8" },
    { id: "shopping",      label: "Compras",       icon: "🛍️", color: "#60a5fa" },
    { id: "education",     label: "Educación",     icon: "📚", color: "#34d399" },
    { id: "restaurant",    label: "Restaurantes",  icon: "🍽️", color: "#f472b6" },
    { id: "subscriptions", label: "Suscripciones", icon: "📱", color: "#a78bfa" },
    { id: "other_expense", label: "Otros gastos",  icon: "💸", color: "#94a3b8" },
  ],
} as const;

type CategoryType = keyof typeof CATEGORIES;
const ALL_CATS = [...CATEGORIES.income, ...CATEGORIES.expense];
const getCatById = (id: string) =>
  ALL_CATS.find((c) => c.id === id) || { label: id, icon: "❓", color: "#94a3b8" };

const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const MONTHS_SHORT = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const THEME_KEY = "finanzas_theme";

interface TxItem {
  id: number;
  description: string;
  amount: number;
  type: "income" | "expense";
  category: string;
  date: string;
  createdAt: string;
}

interface TxPayload {
  description: string;
  amount: number;
  type: "income" | "expense";
  category: string;
  date: string;
}

const BASE = "";

async function apiFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  if (res.status === 204) return null;
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

function exportCSV(transactions: TxItem[]) {
  const header = "Fecha,Descripción,Tipo,Categoría,Importe (€)\n";
  const rows = transactions.map(t => {
    const cat = getCatById(t.category);
    return `${t.date},"${t.description}",${t.type === "income" ? "Ingreso" : "Gasto"},${cat.label},${t.type === "income" ? "+" : "-"}${Number(t.amount).toFixed(2)}`;
  }).join("\n");
  const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = "mis_finanzas.csv"; a.click();
  URL.revokeObjectURL(url);
}

const CustomTooltip = ({ active, payload, label, dark }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: dark ? "#1a1a24" : "#fff", border: `1px solid ${dark ? "#2a2a3a" : "#e2e8f0"}`, borderRadius: 10, padding: "10px 14px", fontSize: 13 }}>
      <p style={{ color: dark ? "#888" : "#666", marginBottom: 6, fontWeight: 600 }}>{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color, fontWeight: 700 }}>{p.name}: {Number(p.value).toFixed(2)}€</p>
      ))}
    </div>
  );
};

type View = "dashboard" | "transactions" | "categories" | "charts";

interface FormState {
  description: string;
  amount: string;
  type: CategoryType;
  category: string;
  date: string;
}

const defaultForm = (): FormState => ({
  description: "", amount: "", type: "expense", category: "",
  date: new Date().toISOString().slice(0, 10),
});

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}

function AppContent() {
  const [dark, setDark] = useState(() => localStorage.getItem(THEME_KEY) !== "light");
  const [view, setView] = useState<View>("dashboard");
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [showForm, setShowForm] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(defaultForm());

  const qc = useQueryClient();

  const { data: allTransactions = [], isLoading } = useQuery<TxItem[]>({
    queryKey: ["transactions"],
    queryFn: () => apiFetch("/api/transactions"),
  });

  const createMutation = useMutation({
    mutationFn: (payload: TxPayload) => apiFetch("/api/transactions", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["transactions"] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: TxPayload }) =>
      apiFetch(`/api/transactions?id=${id}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["transactions"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/transactions?id=${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["transactions"] }),
  });

  const bg      = dark ? "#0f0f13" : "#f4f4f8";
  const surface = dark ? "#1a1a24" : "#ffffff";
  const border  = dark ? "#2a2a3a" : "#e2e8f0";
  const text    = dark ? "#e8e8f0" : "#1a1a2e";
  const subtle  = dark ? "#888"    : "#94a3b8";
  const inputBg = dark ? "#0f0f13" : "#f8f8fc";

  const toggleDark = () => {
    setDark(d => { localStorage.setItem(THEME_KEY, !d ? "dark" : "light"); return !d; });
  };

  const transactions = allTransactions as TxItem[];
  const filtered     = transactions.filter(t => t.date.startsWith(selectedMonth));
  const totalIncome  = filtered.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
  const totalExpense = filtered.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
  const balance      = totalIncome - totalExpense;
  const expenseByCat = filtered.filter(t => t.type === "expense").reduce<Record<string, number>>((acc, t) => {
    acc[t.category] = (acc[t.category] || 0) + Number(t.amount);
    return acc;
  }, {});

  const [year, month] = selectedMonth.split("-").map(Number);
  const changeMonth = (dir: number) => {
    let m = month + dir, y = year;
    if (m > 12) { m = 1; y++; } if (m < 1) { m = 12; y--; }
    setSelectedMonth(`${y}-${String(m).padStart(2, "0")}`);
  };

  const chartData = (() => {
    const result = [];
    for (let i = 5; i >= 0; i--) {
      let m = month - i, y = year;
      if (m <= 0) { m += 12; y--; }
      const key = `${y}-${String(m).padStart(2, "0")}`;
      const txs = transactions.filter(t => t.date.startsWith(key));
      result.push({
        mes:      MONTHS_SHORT[m - 1],
        Ingresos: parseFloat(txs.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount), 0).toFixed(2)),
        Gastos:   parseFloat(txs.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0).toFixed(2)),
      });
    }
    return result;
  })();

  const classifyWithAI = useCallback(async (description: string) => {
    setAiLoading(true);
    try {
      const data = await apiFetch("/api/classify", {
        method: "POST",
        body: JSON.stringify({ description }),
      }) as { categoryId: string };
      const catId = data.categoryId;
      const valid = ALL_CATS.find(c => c.id === catId);
      if (valid) {
        setForm(f => ({
          ...f,
          category: catId,
          type: CATEGORIES.income.some(c => c.id === catId) ? "income" : "expense",
        }));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setAiLoading(false);
    }
  }, []);

  const handleDescriptionBlur = () => {
    if (form.description.trim().length > 2 && !form.category) {
      classifyWithAI(form.description);
    }
  };

  const handleSubmit = () => {
    if (!form.description || !form.amount || !form.category || !form.date) return;
    const payload: TxPayload = {
      description: form.description,
      amount: parseFloat(form.amount),
      type: form.type,
      category: form.category,
      date: form.date,
    };
    if (editingId !== null) {
      updateMutation.mutate({ id: editingId, data: payload }, { onSuccess: closeForm });
    } else {
      createMutation.mutate(payload, { onSuccess: closeForm });
    }
  };

  const closeForm = () => { setShowForm(false); setEditingId(null); setForm(defaultForm()); };
  const handleEdit = (tx: TxItem) => {
    setForm({ description: tx.description, amount: String(tx.amount), type: tx.type as CategoryType, category: tx.category, date: tx.date });
    setEditingId(tx.id);
    setShowForm(true);
  };
  const handleDelete = (id: number) => deleteMutation.mutate(id);

  const isBusy = createMutation.isPending || updateMutation.isPending;

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=Space+Grotesk:wght@700&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { font-size: 16px; }
    body { background: ${bg}; transition: background .3s; -webkit-font-smoothing: antialiased; }
    ::-webkit-scrollbar { width: 4px } ::-webkit-scrollbar-track { background: ${surface} } ::-webkit-scrollbar-thumb { background: ${border}; border-radius: 2px }
    input, select, button { font-family: inherit; outline: none; }
    .card { background: ${surface}; border: 1px solid ${border}; border-radius: 16px; }
    .btn-primary { background: linear-gradient(135deg,#6c63ff,#a855f7); color: white; border: none; border-radius: 12px; padding: 12px 24px; font-size: 15px; font-weight: 600; cursor: pointer; transition: transform .15s, opacity .15s; }
    .btn-primary:hover { transform: translateY(-1px); opacity: .92; }
    .btn-primary:disabled { opacity: .4; cursor: not-allowed; transform: none; }
    .input-field { background: ${inputBg}; border: 1px solid ${border}; border-radius: 10px; padding: 11px 14px; color: ${text}; font-size: 14px; transition: border-color .2s; width: 100%; }
    .input-field:focus { border-color: #6c63ff; }
    .pill { display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px; border-radius: 999px; font-size: 12px; font-weight: 500; }
    .nav-btn { background: none; border: none; color: ${subtle}; cursor: pointer; padding: 8px 14px; border-radius: 10px; font-size: 13px; font-weight: 500; transition: all .2s; white-space: nowrap; }
    .nav-btn.active { background: ${surface}; color: ${text}; border: 1px solid ${border}; }
    .tx-row { display: flex; align-items: center; gap: 12px; padding: 13px 16px; border-radius: 12px; transition: background .15s; }
    .tx-row:hover { background: ${dark ? "#1f1f2e" : "#f0f0f8"}; }
    .cat-chip { padding: 7px 13px; border-radius: 999px; font-size: 12px; font-weight: 600; border: 2px solid transparent; cursor: pointer; transition: all .15s; background: ${inputBg}; color: ${subtle}; }
    .overlay { position: fixed; inset: 0; background: rgba(0,0,0,.65); z-index: 100; display: flex; align-items: flex-end; justify-content: center; }
    @media (min-width: 640px) { .overlay { align-items: center; } }
    .modal { background: ${surface}; border: 1px solid ${border}; border-radius: 24px 24px 0 0; padding: 28px 24px; width: 100%; max-width: 520px; animation: slideUp .25s ease; max-height: 92vh; overflow-y: auto; }
    @media (min-width: 640px) { .modal { border-radius: 24px; max-height: 90vh; } }
    @keyframes slideUp { from { transform: translateY(100%); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
    .bar { height: 6px; border-radius: 3px; transition: width .5s ease; }
    .type-toggle { display: flex; background: ${inputBg}; border-radius: 10px; padding: 3px; }
    .type-btn { flex: 1; padding: 9px; border: none; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all .2s; background: none; color: ${subtle}; }
    .type-btn.active-income { background: #16a34a; color: white; }
    .type-btn.active-expense { background: #dc2626; color: white; }
    .ai-badge { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; color: #a855f7; background: rgba(168,85,247,.1); padding: 3px 8px; border-radius: 999px; border: 1px solid rgba(168,85,247,.2); }
    .action-btn { background: none; border: none; cursor: pointer; padding: 6px; border-radius: 6px; font-size: 14px; opacity: .4; transition: opacity .15s; }
    .action-btn:hover { opacity: 1; }
    .icon-btn { background: ${surface}; border: 1px solid ${border}; border-radius: 10px; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 16px; transition: background .2s; }
    .icon-btn:hover { background: ${dark ? "#2a2a3a" : "#e8e8f0"}; }
    .sync-badge { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; color: #4ade80; background: rgba(74,222,128,.1); padding: 3px 9px; border-radius: 999px; border: 1px solid rgba(74,222,128,.2); }
    .skeleton { background: linear-gradient(90deg, ${border} 25%, ${dark ? "#333" : "#f0f0f0"} 50%, ${border} 75%); background-size: 200% 100%; animation: shimmer 1.4s infinite; border-radius: 8px; }
    @keyframes shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }
  `;

  const maxW = "680px";

  return (
    <div style={{ minHeight: "100vh", background: bg, color: text, fontFamily: "'DM Sans', sans-serif", paddingBottom: 80, transition: "background .3s, color .3s" }}>
      <style>{css}</style>

      <div style={{ padding: "20px 20px 0", maxWidth: maxW, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Logo size={40} />
            <div>
              <p style={{ fontSize: 10, color: subtle, letterSpacing: 2, textTransform: "uppercase" }}>Panel financiero</p>
              <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 700, letterSpacing: -0.5 }}>Mis Finanzas</h1>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button className="icon-btn" onClick={toggleDark} title="Cambiar tema">{dark ? "☀️" : "🌙"}</button>
            <button className="icon-btn" onClick={() => exportCSV(transactions)} title="Exportar CSV">📥</button>
            <button className="btn-primary" style={{ padding: "9px 16px", fontSize: 13 }} onClick={() => { setForm(defaultForm()); setEditingId(null); setShowForm(true); }}>+ Añadir</button>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
          <span className="sync-badge">☁️ Sincronizado en la nube</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginBottom: 20 }}>
          <button onClick={() => changeMonth(-1)} style={{ background: surface, border: `1px solid ${border}`, color: subtle, borderRadius: 8, width: 32, height: 32, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>‹</button>
          <span style={{ fontWeight: 600, fontSize: 15, minWidth: 160, textAlign: "center" }}>{MONTHS[month - 1]} {year}</span>
          <button onClick={() => changeMonth(1)} style={{ background: surface, border: `1px solid ${border}`, color: subtle, borderRadius: 8, width: 32, height: 32, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>›</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <div className="card" style={{ padding: "18px 20px" }}>
            <p style={{ fontSize: 11, color: "#4ade80", letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>Ingresos</p>
            {isLoading ? <div className="skeleton" style={{ height: 28, width: 100 }} /> : <p style={{ fontSize: 24, fontWeight: 700 }}>+{totalIncome.toFixed(2)}€</p>}
          </div>
          <div className="card" style={{ padding: "18px 20px" }}>
            <p style={{ fontSize: 11, color: "#f87171", letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>Gastos</p>
            {isLoading ? <div className="skeleton" style={{ height: 28, width: 100 }} /> : <p style={{ fontSize: 24, fontWeight: 700 }}>-{totalExpense.toFixed(2)}€</p>}
          </div>
        </div>

        <div className="card" style={{ padding: "18px 22px", marginBottom: 20, background: balance >= 0 ? (dark ? "linear-gradient(135deg,#14532d22,#1a1a24)" : "linear-gradient(135deg,#dcfce7,#fff)") : (dark ? "linear-gradient(135deg,#7f1d1d22,#1a1a24)" : "linear-gradient(135deg,#fee2e2,#fff)") }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <p style={{ fontSize: 13, color: subtle }}>Balance del mes</p>
            <span className="ai-badge">✨ IA activa</span>
          </div>
          {isLoading
            ? <div className="skeleton" style={{ height: 38, width: 140, marginTop: 6 }} />
            : <p style={{ fontSize: 34, fontWeight: 700, color: balance >= 0 ? "#4ade80" : "#f87171", fontFamily: "'Space Grotesk', sans-serif", letterSpacing: -1.5 }}>
                {balance >= 0 ? "+" : ""}{balance.toFixed(2)}€
              </p>
          }
          {!isLoading && totalIncome > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: subtle, marginBottom: 5 }}>
                <span>% gastado</span><span>{Math.min(100, Math.round(totalExpense / totalIncome * 100))}%</span>
              </div>
              <div style={{ background: inputBg, borderRadius: 3, height: 5 }}>
                <div className="bar" style={{ width: `${Math.min(100, totalExpense / totalIncome * 100)}%`, background: totalExpense > totalIncome ? "#f87171" : "#6c63ff" }} />
              </div>
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 4, marginBottom: 20, overflowX: "auto", paddingBottom: 2 }}>
          {(["dashboard","transactions","categories","charts"] as View[]).map(v => (
            <button key={v} className={`nav-btn${view === v ? " active" : ""}`} onClick={() => setView(v)}>
              {v === "dashboard" ? "Resumen" : v === "transactions" ? "Movimientos" : v === "categories" ? "Categorías" : "📊 Gráficas"}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: "0 20px", maxWidth: maxW, margin: "0 auto" }}>

        {view === "dashboard" && (
          <div>
            {isLoading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 72 }} />)}
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 20px", color: subtle }}>
                <p style={{ fontSize: 48, marginBottom: 14 }}>📊</p>
                <p style={{ fontSize: 16 }}>Sin movimientos este mes</p>
                <p style={{ fontSize: 13, marginTop: 6 }}>Añade tu primer ingreso o gasto</p>
              </div>
            ) : (
              <>
                <p style={{ fontSize: 11, color: subtle, letterSpacing: 1, textTransform: "uppercase", marginBottom: 12 }}>Top gastos</p>
                {Object.entries(expenseByCat).sort((a,b) => b[1]-a[1]).slice(0,6).map(([catId, amount]) => {
                  const cat = getCatById(catId);
                  const pct = totalExpense > 0 ? amount / totalExpense * 100 : 0;
                  return (
                    <div key={catId} className="card" style={{ padding: "14px 18px", marginBottom: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 20 }}>{cat.icon}</span>
                          <span style={{ fontSize: 14, fontWeight: 500 }}>{cat.label}</span>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <span style={{ fontWeight: 700, fontSize: 15 }}>{amount.toFixed(2)}€</span>
                          <span style={{ fontSize: 11, color: subtle, marginLeft: 6 }}>{pct.toFixed(0)}%</span>
                        </div>
                      </div>
                      <div style={{ background: inputBg, borderRadius: 3, height: 4 }}>
                        <div className="bar" style={{ width: `${pct}%`, background: cat.color }} />
                      </div>
                    </div>
                  );
                })}
                <p style={{ fontSize: 11, color: subtle, letterSpacing: 1, textTransform: "uppercase", margin: "22px 0 12px" }}>Últimos movimientos</p>
                {filtered.slice(0,5).map(tx => {
                  const cat = getCatById(tx.category);
                  return (
                    <div key={tx.id} className="tx-row">
                      <div style={{ width: 40, height: 40, borderRadius: 11, background: cat.color + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 19, flexShrink: 0 }}>{cat.icon}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 14, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{tx.description}</p>
                        <p style={{ fontSize: 12, color: subtle }}>{tx.date}</p>
                      </div>
                      <span style={{ fontWeight: 700, color: tx.type === "income" ? "#4ade80" : "#f87171", fontSize: 15, whiteSpace: "nowrap" }}>
                        {tx.type === "income" ? "+" : "-"}{Number(tx.amount).toFixed(2)}€
                      </span>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}

        {view === "transactions" && (
          <div>
            {isLoading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 64 }} />)}
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 20px", color: subtle }}>
                <p style={{ fontSize: 48, marginBottom: 14 }}>🧾</p>
                <p style={{ fontSize: 16 }}>Sin movimientos este mes</p>
              </div>
            ) : (
              [...filtered].sort((a,b) => b.date.localeCompare(a.date)).map(tx => {
                const cat = getCatById(tx.category);
                return (
                  <div key={tx.id} className="tx-row" style={{ marginBottom: 4 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 11, background: cat.color + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 19, flexShrink: 0 }}>{cat.icon}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 14, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{tx.description}</p>
                      <span className="pill" style={{ background: cat.color + "22", color: cat.color, fontSize: 11, padding: "2px 8px" }}>{cat.label}</span>
                    </div>
                    <div style={{ textAlign: "right", marginRight: 4 }}>
                      <p style={{ fontWeight: 700, color: tx.type === "income" ? "#4ade80" : "#f87171", fontSize: 15 }}>
                        {tx.type === "income" ? "+" : "-"}{Number(tx.amount).toFixed(2)}€
                      </p>
                      <p style={{ fontSize: 11, color: subtle }}>{tx.date}</p>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <button className="action-btn" onClick={() => handleEdit(tx)}>✏️</button>
                      <button className="action-btn" onClick={() => handleDelete(tx.id)}>🗑️</button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {view === "categories" && (
          <div>
            <p style={{ fontSize: 11, color: subtle, letterSpacing: 1, textTransform: "uppercase", marginBottom: 12 }}>Gastos por categoría</p>
            {CATEGORIES.expense.map(cat => {
              const total = expenseByCat[cat.id] || 0;
              const count = filtered.filter(t => t.category === cat.id).length;
              if (!total) return null;
              const pct = totalExpense > 0 ? total / totalExpense * 100 : 0;
              return (
                <div key={cat.id} className="card" style={{ padding: "14px 18px", marginBottom: 8, display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ width: 46, height: 46, borderRadius: 13, background: cat.color + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>{cat.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 14, fontWeight: 500 }}>{cat.label}</span>
                      <span style={{ fontWeight: 700 }}>{total.toFixed(2)}€</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: subtle, marginTop: 2, marginBottom: 7 }}>
                      <span>{count} movimiento{count !== 1 ? "s" : ""}</span>
                      <span>{pct.toFixed(1)}%</span>
                    </div>
                    <div style={{ background: inputBg, borderRadius: 3, height: 4 }}>
                      <div className="bar" style={{ width: `${pct}%`, background: cat.color }} />
                    </div>
                  </div>
                </div>
              );
            }).filter(Boolean)}
            {!Object.values(expenseByCat).some(v => v > 0) && (
              <div style={{ textAlign: "center", padding: "48px 20px", color: subtle }}>
                <p style={{ fontSize: 48, marginBottom: 14 }}>📂</p><p style={{ fontSize: 16 }}>Sin categorías este mes</p>
              </div>
            )}
            <p style={{ fontSize: 11, color: subtle, letterSpacing: 1, textTransform: "uppercase", margin: "22px 0 12px" }}>Ingresos por categoría</p>
            {CATEGORIES.income.map(cat => {
              const total = filtered.filter(t => t.category === cat.id).reduce((s,t) => s + Number(t.amount), 0);
              if (!total) return null;
              return (
                <div key={cat.id} className="card" style={{ padding: "14px 18px", marginBottom: 8, display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ width: 46, height: 46, borderRadius: 13, background: cat.color + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>{cat.icon}</div>
                  <div style={{ flex: 1, display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 14, fontWeight: 500 }}>{cat.label}</span>
                    <span style={{ fontWeight: 700, color: "#4ade80" }}>+{total.toFixed(2)}€</span>
                  </div>
                </div>
              );
            }).filter(Boolean)}
          </div>
        )}

        {view === "charts" && (
          <div>
            <div className="card" style={{ padding: "20px 18px", marginBottom: 16 }}>
              <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Evolución 6 meses</p>
              <p style={{ fontSize: 11, color: subtle, marginBottom: 16 }}>Ingresos vs Gastos</p>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11, fill: subtle }} />
                  <YAxis tick={{ fontSize: 11, fill: subtle }} />
                  <Tooltip content={<CustomTooltip dark={dark} />} />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                  <Line type="monotone" dataKey="Ingresos" stroke="#4ade80" strokeWidth={2.5} dot={{ r: 4, fill: "#4ade80" }} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="Gastos"   stroke="#f87171" strokeWidth={2.5} dot={{ r: 4, fill: "#f87171" }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="card" style={{ padding: "20px 18px", marginBottom: 16 }}>
              <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Comparativa mensual</p>
              <p style={{ fontSize: 11, color: subtle, marginBottom: 16 }}>Barras agrupadas</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} margin={{ top: 0, right: 8, left: -20, bottom: 0 }} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11, fill: subtle }} />
                  <YAxis tick={{ fontSize: 11, fill: subtle }} />
                  <Tooltip content={<CustomTooltip dark={dark} />} />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                  <Bar dataKey="Ingresos" fill="#4ade80" radius={[4,4,0,0]} />
                  <Bar dataKey="Gastos"   fill="#f87171" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="card" style={{ padding: "20px 18px", marginBottom: 16 }}>
              <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Distribución de gastos</p>
              <p style={{ fontSize: 11, color: subtle, marginBottom: 16 }}>{MONTHS[month - 1]} {year}</p>
              {Object.entries(expenseByCat).length === 0 ? (
                <p style={{ color: subtle, textAlign: "center", padding: "20px 0", fontSize: 14 }}>Sin gastos este mes</p>
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(160, Object.keys(expenseByCat).length * 38)}>
                  <BarChart layout="vertical"
                    data={Object.entries(expenseByCat).sort((a,b)=>b[1]-a[1]).map(([id,v]) => ({
                      name: getCatById(id).label, value: v, color: getCatById(id).color,
                    }))}
                    margin={{ top: 0, right: 40, left: 10, bottom: 0 }}>
                    <XAxis type="number" tick={{ fontSize: 10, fill: subtle }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: text }} width={95} />
                    <Tooltip formatter={(v: number) => [`${Number(v).toFixed(2)}€`, "Gasto"]} contentStyle={{ background: surface, border: `1px solid ${border}`, borderRadius: 10, fontSize: 13 }} />
                    <Bar dataKey="value" radius={[0,6,6,0]} fill="#6c63ff" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {!isLoading && totalIncome > 0 && (() => {
              const rate = Math.max(0, (totalIncome - totalExpense) / totalIncome * 100);
              const color = rate >= 20 ? "#4ade80" : rate >= 10 ? "#fbbf24" : "#f87171";
              return (
                <div className="card" style={{ padding: "20px 18px", marginBottom: 16 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Tasa de ahorro</p>
                  <p style={{ fontSize: 11, color: subtle, marginBottom: 16 }}>Este mes</p>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
                    <span style={{ fontSize: 38, fontWeight: 700, color, fontFamily: "'Space Grotesk', sans-serif" }}>{rate.toFixed(1)}%</span>
                    <span style={{ fontSize: 12, color: subtle }}>{rate >= 20 ? "🟢 Excelente" : rate >= 10 ? "🟡 Mejorable" : "🔴 Atención"}</span>
                  </div>
                  <div style={{ background: inputBg, borderRadius: 6, height: 10 }}>
                    <div style={{ width: `${Math.min(100, rate)}%`, height: "100%", borderRadius: 6, background: color, transition: "width .5s ease" }} />
                  </div>
                  <p style={{ fontSize: 12, color: subtle, marginTop: 9 }}>Objetivo recomendado: 20% o más</p>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {showForm && (
        <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) closeForm(); }}>
          <div className="modal">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
              <h2 style={{ fontSize: 19, fontWeight: 700 }}>{editingId !== null ? "Editar" : "Añadir"} movimiento</h2>
              <button onClick={closeForm} style={{ background: "none", border: "none", color: subtle, fontSize: 24, cursor: "pointer", lineHeight: 1 }}>×</button>
            </div>
            <div className="type-toggle" style={{ marginBottom: 18 }}>
              <button className={`type-btn${form.type === "expense" ? " active-expense" : ""}`} onClick={() => setForm(f => ({ ...f, type: "expense", category: "" }))}>💸 Gasto</button>
              <button className={`type-btn${form.type === "income"  ? " active-income"  : ""}`} onClick={() => setForm(f => ({ ...f, type: "income",  category: "" }))}>💰 Ingreso</button>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, color: subtle, marginBottom: 6, display: "block" }}>Descripción</label>
              <div style={{ position: "relative" }}>
                <input className="input-field" placeholder="ej: Mercadona, Netflix, Sueldo..."
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  onBlur={handleDescriptionBlur} />
                {aiLoading && (
                  <div style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)" }}>
                    <span className="ai-badge">✨ Clasificando...</span>
                  </div>
                )}
              </div>
              {!aiLoading && <p style={{ fontSize: 11, color: subtle, marginTop: 5 }}>✨ La IA clasificará al salir del campo</p>}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div>
                <label style={{ fontSize: 12, color: subtle, marginBottom: 6, display: "block" }}>Importe (€)</label>
                <input className="input-field" type="number" min="0" step="0.01" placeholder="0.00"
                  value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: subtle, marginBottom: 6, display: "block" }}>Fecha</label>
                <input className="input-field" type="date" value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              </div>
            </div>
            <div style={{ marginBottom: 22 }}>
              <label style={{ fontSize: 12, color: subtle, marginBottom: 9, display: "flex", alignItems: "center", gap: 6 }}>
                Categoría {form.category && <span className="ai-badge">✨ auto</span>}
              </label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                {CATEGORIES[form.type].map(cat => (
                  <button key={cat.id} className="cat-chip"
                    onClick={() => setForm(f => ({ ...f, category: cat.id }))}
                    style={{
                      borderColor: form.category === cat.id ? cat.color : "transparent",
                      background: form.category === cat.id ? cat.color + "33" : inputBg,
                      color: form.category === cat.id ? cat.color : subtle,
                    }}>
                    {cat.icon} {cat.label}
                  </button>
                ))}
              </div>
            </div>
            <button className="btn-primary" style={{ width: "100%" }}
              onClick={handleSubmit}
              disabled={!form.description || !form.amount || !form.category || isBusy}>
              {isBusy ? "Guardando..." : editingId !== null ? "Guardar cambios" : "Añadir movimiento"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
