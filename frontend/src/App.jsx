import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Skull, Sparkles, Copy, Download, Upload, Clock, Shield } from "lucide-react";

// ======================
// CONFIG
// ======================
const RESPAWN_TIME = 90 * 60 * 1000; // 1h30m em ms
const API_URL = import.meta.env.PROD ? "/api" : "http://localhost:3001/api";

const CATEGORIES = {
  COMUM: { name: "COMUM", rooms: ["P1", "P2"] },
  UNIVERSAL: { name: "UNIVERSAL", rooms: ["P1", "P2"] },
};

const BOSSES = ["MAGO", "BARDO", "LANCEIRO", "BERSERKER"];

// ======================
// HELPERS
// ======================
const makeId = () => {
  try {
    if (crypto && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  } catch (e) {
    // ignore
  }
  return Math.random().toString(36).slice(2, 10);
};

// ======================
// CHILD COMPONENT
// ======================
const BossCard = ({ category, room, boss, getBossState, toggleBossStatus, token, currentTime }) => {
  const state = getBossState(category, room, boss);
  const isAlive = state.status === "VIVO";

  const getTimeRemaining = (deathTime) => {
    if (!deathTime) return { minutes: 0, seconds: 0, progress: 0 };
    const elapsed = currentTime - deathTime;
    const remaining = Math.max(0, RESPAWN_TIME - elapsed);
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    const progress = (elapsed / RESPAWN_TIME) * 100;
    return { minutes, seconds, progress: Math.min(progress, 100) };
  };

  const { minutes, seconds, progress } = getTimeRemaining(state.deathTime);

  const cardVariants = {
    alive: "border-green-500/50 shadow-green-500/10",
    dead: "border-red-500/50 shadow-red-500/10 opacity-80",
  };

  const buttonVariants = {
    disabled: "bg-gray-700 text-gray-500 cursor-not-allowed",
    kill: "bg-red-800 hover:bg-red-700 text-white",
    revive: "bg-green-800 hover:bg-green-700 text-white",
  };

  const buttonClass = !token ? buttonVariants.disabled : isAlive ? buttonVariants.kill : buttonVariants.revive;

  return (
    <div className={`bg-gray-800 rounded-xl shadow-md overflow-hidden transition-all duration-300 border ${isAlive ? cardVariants.alive : cardVariants.dead}`}>
      <div className="p-4 flex justify-between items-start">
        <div>
          <h4 className="text-lg font-bold text-white">{boss}</h4>
          <div className="flex items-center gap-1.5 mt-1">
            {isAlive ? <Sparkles className="w-4 h-4 text-green-400" /> : <Skull className="w-4 h-4 text-red-400" />}
            <span className={`text-sm font-medium ${isAlive ? "text-green-400" : "text-red-400"}`}>{state.status}</span>
          </div>
        </div>
        <Shield className="w-8 h-8 text-gray-600" />
      </div>

      <div className="px-4 h-12 flex flex-col justify-center">
        {!isAlive && (
          <>
            <div className="flex items-center gap-2 text-gray-300">
              <Clock className="w-4 h-4" />
              <span className="font-mono text-lg">{String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-1.5 mt-2">
              <div className="bg-cyan-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
          </>
        )}
      </div>

      <button onClick={() => toggleBossStatus(category, room, boss)} disabled={!token} className={`w-full p-3 font-bold text-center transition-colors duration-300 ${buttonClass}`}>
        {!token ? "🔒 Token necessário" : isAlive ? "Marcar como Morto" : "Marcar como Vivo"}
      </button>
    </div>
  );
};

// ======================
// MAIN APP COMPONENT
// ======================
function App() {
  const [token, setToken] = useState(null);
  const [bossStates, setBossStates] = useState({});
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [tokenInput, setTokenInput] = useState("");
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [copiedToken, setCopiedToken] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);
  
  useEffect(() => {
    if (!token) return;

    setBossStates((currentStates) => {
      let hasChanges = false;
      const updatedStates = { ...currentStates };

      for (const key in updatedStates) {
        const boss = updatedStates[key];
        if (boss?.status === "MORTO" && boss?.deathTime) {
          if (currentTime - boss.deathTime >= RESPAWN_TIME) {
            updatedStates[key] = { status: "VIVO", deathTime: null };
            hasChanges = true;
          }
        }
      }

      if (hasChanges) {
        return updatedStates;
      }
      return currentStates;
    });
  }, [currentTime, token]);
  
  const saveTokenToDB = useCallback(async (id, states) => {
    try {
      await fetch(`${API_URL}/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, states }),
      });
    } catch (e) {
      console.error("Erro ao salvar no servidor", e);
    }
  }, []);

  const createToken = async () => {
    const id = makeId();
    setToken(id);
    setBossStates({});
    await saveTokenToDB(id, {});
  };

  const importToken = async (tokenStr) => {
    if (!tokenStr) return alert("Cole um token para importar.");
    try {
      const res = await fetch(`${API_URL}/token/${encodeURIComponent(tokenStr)}`);
      if (res.status === 404) { alert("Token não encontrado!"); return; }
      if (!res.ok) throw new Error(await res.text() || "Erro ao buscar token");
      const data = await res.json();
      setBossStates(data.states || {});
      setToken(tokenStr);
      setShowTokenModal(false);
      setTokenInput("");
    } catch (e) {
      console.error(e);
      alert("Erro ao importar token. Veja o console para detalhes.");
    }
  };

  const copyToken = () => {
    if (token) {
      navigator.clipboard.writeText(token);
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    }
  };

  const toggleBossStatus = async (category, room, boss) => {
    if (!token) { alert("Você precisa criar/importar um token primeiro."); return; }
    const key = `${category}-${room}-${boss}`;
    const currentStatus = bossStates[key]?.status || "VIVO";
    const newStatus = currentStatus === "VIVO" ? "MORTO" : "VIVO";
    const newDeathTime = newStatus === "MORTO" ? Date.now() : null;

    const updatedStates = { ...bossStates, [key]: { status: newStatus, deathTime: newDeathTime } };
    setBossStates(updatedStates);
    await saveTokenToDB(token, updatedStates);
  };
  
  const getBossState = useCallback((category, room, boss) => {
      const key = `${category}-${room}-${boss}`;
      return bossStates[key] || { status: "VIVO", deathTime: null };
  }, [bossStates]);

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">
        <motion.header initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-bold text-cyan-400 tracking-tight">Boss Respawn Tracker</h1>
          <p className="text-lg text-gray-400 mt-2">Controle os respawns dos bosses em tempo real</p>
        </motion.header>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex justify-center items-center gap-4 mb-8 flex-wrap">
          {!token ? (
            <>
              <button onClick={createToken} className="flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all duration-300 shadow-lg bg-green-500 hover:bg-green-600 text-white">
                <Download className="w-5 h-5" /> Criar Token
              </button>
              <button onClick={() => setShowTokenModal(true)} className="flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all duration-300 shadow-lg bg-blue-500 hover:bg-blue-600 text-white">
                <Upload className="w-5 h-5" /> Importar Token
              </button>
            </>
          ) : (
            <div className="flex items-center gap-4 p-3 bg-gray-800 rounded-lg">
                <span className="text-gray-400 font-mono text-sm hidden md:inline">TOKEN: {token}</span>
                 <button onClick={copyToken} className="flex items-center gap-2 px-4 py-2 rounded-md font-semibold transition-all duration-300 shadow-lg bg-purple-500 hover:bg-purple-600 text-white">
                    <Copy className="w-5 h-5" /> {copiedToken ? "Copiado!" : "Copiar"}
                </button>
                <button onClick={() => { setToken(null); setBossStates({}); }} className="flex items-center gap-2 px-4 py-2 rounded-md font-semibold transition-all duration-300 shadow-lg bg-red-600 hover:bg-red-700 text-white">
                    Limpar
                </button>
            </div>
          )}
        </motion.div>

        <main>
          {Object.entries(CATEGORIES).map(([catKey, catData]) => (
            <motion.section key={catKey} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="mb-12">
              <h2 className="text-2xl font-bold text-cyan-300 mb-6 flex items-center gap-3 border-b-2 border-gray-700 pb-2">
                <Sparkles className="w-6 h-6" /> {catData.name}
              </h2>
              {catData.rooms.map((room) => (
                <div key={room} className="mb-8">
                  <h3 className="text-xl font-semibold text-gray-300 mb-4 ml-1">Sala {room}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {BOSSES.map((boss) => <BossCard key={`${catKey}-${room}-${boss}`} {...{ category: catKey, room, boss, getBossState, toggleBossStatus, token, currentTime }} />)}
                  </div>
                </div>
              ))}
            </motion.section>
          ))}
        </main>
      </div>

      <AnimatePresence>
        {showTokenModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50" onClick={() => setShowTokenModal(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-2xl font-bold mb-4">Importar Token</h3>
              <textarea value={tokenInput} onChange={(e) => setTokenInput(e.target.value)} placeholder="Cole seu token aqui..." className="w-full h-24 bg-gray-900 rounded p-2 mb-4 focus:ring-2 focus:ring-cyan-500 outline-none resize-none" />
              <div className="flex justify-end gap-4">
                <button onClick={() => importToken(tokenInput)} className="px-4 py-2 rounded font-semibold transition-colors bg-cyan-600 hover:bg-cyan-500 text-white">Importar</button>
                <button onClick={() => setShowTokenModal(false)} className="px-4 py-2 rounded font-semibold transition-colors bg-gray-600 hover:bg-gray-500 text-white">Cancelar</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
