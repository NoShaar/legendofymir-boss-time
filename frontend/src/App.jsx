import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Skull, Sparkles, Copy, Download, Upload, Clock, Shield, ChevronRight } from "lucide-react";

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
    if (!deathTime) return { hours: 0, minutes: 0, seconds: 0, progress: 0 };
    const elapsed = currentTime - deathTime;
    const remaining = Math.max(0, RESPAWN_TIME - elapsed);
    const hours = Math.floor(remaining / 3600000);
    const minutes = Math.floor((remaining % 3600000) / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    const progress = (elapsed / RESPAWN_TIME) * 100;
    return { hours, minutes, seconds, progress: Math.min(progress, 100) };
  };

  const { hours, minutes, seconds, progress } = getTimeRemaining(state.deathTime);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-gradient-to-br ${
        isAlive 
          ? "from-gray-900 to-gray-800 border-green-500/30" 
          : "from-gray-900 to-gray-850 border-red-500/30"
      } rounded-2xl border-2 overflow-hidden transition-all duration-300 hover:shadow-xl ${
        isAlive ? "hover:shadow-green-500/10" : "hover:shadow-red-500/10"
      }`}
    >
      <div className="p-5">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${isAlive ? "bg-green-500/10" : "bg-red-500/10"}`}>
              <Shield className={`w-6 h-6 ${isAlive ? "text-green-400" : "text-red-400"}`} />
            </div>
            <div>
              <h4 className="text-xl font-bold text-white tracking-wide">{boss}</h4>
              <div className="flex items-center gap-2 mt-1">
                {isAlive ? (
                  <Sparkles className="w-4 h-4 text-green-400" />
                ) : (
                  <Skull className="w-4 h-4 text-red-400" />
                )}
                <span className={`text-sm font-semibold ${isAlive ? "text-green-400" : "text-red-400"}`}>
                  {state.status}
                </span>
              </div>
            </div>
          </div>
        </div>

        {!isAlive && (
          <div className="mb-4 space-y-3">
            <div className="flex items-center justify-center gap-2 p-3 bg-black/30 rounded-xl">
              <Clock className="w-5 h-5 text-blue-400" />
              <span className="font-mono text-2xl font-bold text-white">
                {String(hours).padStart(2, "0")}:
                {String(minutes).padStart(2, "0")}:
                {String(seconds).padStart(2, "0")}
              </span>
            </div>
            <div className="relative">
              <div className="w-full bg-gray-800 rounded-full h-2.5 overflow-hidden">
                <motion.div
                  className="bg-gradient-to-r from-blue-500 to-cyan-400 h-2.5 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
              <span className="text-xs text-gray-400 mt-1 block text-center">
                {progress.toFixed(0)}% concluído
              </span>
            </div>
          </div>
        )}

        <button
          onClick={() => toggleBossStatus(category, room, boss)}
          disabled={!token}
          className={`w-full py-3 px-4 rounded-xl font-bold text-sm transition-all duration-300 ${
            !token
              ? "bg-gray-800 text-gray-600 cursor-not-allowed"
              : isAlive
              ? "bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white shadow-lg hover:shadow-red-500/25"
              : "bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 text-white shadow-lg hover:shadow-green-500/25"
          }`}
        >
          {!token ? "🔒 Token necessário" : isAlive ? "Marcar como Morto" : "Reviver Boss"}
        </button>
      </div>
    </motion.div>
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
  const [selectedCategory, setSelectedCategory] = useState(null);

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
      if (res.status === 404) {
        alert("Token não encontrado!");
        return;
      }
      if (!res.ok) throw new Error((await res.text()) || "Erro ao buscar token");
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
    if (!token) {
      alert("Você precisa criar/importar um token primeiro.");
      return;
    }
    const key = `${category}-${room}-${boss}`;
    const currentStatus = bossStates[key]?.status || "VIVO";
    const newStatus = currentStatus === "VIVO" ? "MORTO" : "VIVO";
    const newDeathTime = newStatus === "MORTO" ? Date.now() : null;

    const updatedStates = {
      ...bossStates,
      [key]: { status: newStatus, deathTime: newDeathTime },
    };
    setBossStates(updatedStates);
    await saveTokenToDB(token, updatedStates);
  };

  const getBossState = useCallback(
    (category, room, boss) => {
      const key = `${category}-${room}-${boss}`;
      return bossStates[key] || { status: "VIVO", deathTime: null };
    },
    [bossStates]
  );

  return (
    <div className="min-h-screen bg-black text-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-5xl sm:text-6xl font-black bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-500 bg-clip-text text-transparent mb-3">
            Boss Tracker
          </h1>
          <p className="text-gray-400 text-lg">Sistema de controle de respawn de bosses</p>
        </motion.header>

        {/* Token Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-center items-center gap-4 mb-12 flex-wrap"
        >
          {!token ? (
            <>
              <button
                onClick={createToken}
                className="flex items-center gap-2 px-8 py-4 rounded-xl font-bold transition-all duration-300 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white shadow-lg hover:shadow-green-500/25 transform hover:scale-105"
              >
                <Download className="w-5 h-5" /> Criar Token
              </button>
              <button
                onClick={() => setShowTokenModal(true)}
                className="flex items-center gap-2 px-8 py-4 rounded-xl font-bold transition-all duration-300 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white shadow-lg hover:shadow-blue-500/25 transform hover:scale-105"
              >
                <Upload className="w-5 h-5" /> Importar Token
              </button>
            </>
          ) : (
            <div className="flex items-center gap-4 p-4 bg-gray-900 rounded-xl border border-gray-800 flex-wrap justify-center">
              <span className="text-gray-400 font-mono text-sm hidden md:inline">
                TOKEN: <span className="text-blue-400">{token}</span>
              </span>
              <button
                onClick={copyToken}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold transition-all duration-300 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-lg"
              >
                <Copy className="w-4 h-4" /> {copiedToken ? "Copiado!" : "Copiar"}
              </button>
              <button
                onClick={() => {
                  setToken(null);
                  setBossStates({});
                  setSelectedCategory(null);
                }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold transition-all duration-300 bg-red-600 hover:bg-red-500 text-white shadow-lg"
              >
                Limpar
              </button>
            </div>
          )}
        </motion.div>

        {/* Category Selection or Boss List */}
        <main>
          {!selectedCategory ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto"
            >
              {Object.entries(CATEGORIES).map(([catKey, catData]) => (
                <motion.button
                  key={catKey}
                  onClick={() => setSelectedCategory(catKey)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="group relative p-8 rounded-2xl bg-gradient-to-br from-gray-900 to-gray-800 border-2 border-blue-500/30 hover:border-blue-400/50 transition-all duration-300 overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-cyan-600/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="relative flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-4 rounded-xl bg-blue-500/10 group-hover:bg-blue-500/20 transition-colors">
                        <Sparkles className="w-8 h-8 text-blue-400" />
                      </div>
                      <div className="text-left">
                        <h2 className="text-3xl font-bold text-white mb-1">{catData.name}</h2>
                        <p className="text-gray-400 text-sm">
                          {catData.rooms.length} salas disponíveis
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-8 h-8 text-blue-400 group-hover:translate-x-1 transition-transform" />
                  </div>
                </motion.button>
              ))}
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="flex items-center gap-4 mb-8">
                <button
                  onClick={() => setSelectedCategory(null)}
                  className="px-6 py-3 rounded-xl bg-gray-900 hover:bg-gray-800 border border-gray-800 text-gray-300 font-semibold transition-colors"
                >
                  ← Voltar
                </button>
                <h2 className="text-3xl font-bold text-blue-400">
                  {CATEGORIES[selectedCategory].name}
                </h2>
              </div>

              {CATEGORIES[selectedCategory].rooms.map((room) => (
                <div key={room} className="mb-10">
                  <h3 className="text-xl font-bold text-gray-300 mb-5 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-cyan-400" />
                    Sala {room}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                    {BOSSES.map((boss) => (
                      <BossCard
                        key={`${selectedCategory}-${room}-${boss}`}
                        category={selectedCategory}
                        room={room}
                        boss={boss}
                        getBossState={getBossState}
                        toggleBossStatus={toggleBossStatus}
                        token={token}
                        currentTime={currentTime}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </motion.div>
          )}
        </main>
      </div>

      {/* Token Modal */}
      <AnimatePresence>
        {showTokenModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50"
            onClick={() => setShowTokenModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl p-8 w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-3xl font-bold mb-6 text-white">Importar Token</h3>
              <textarea
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="Cole seu token aqui..."
                className="w-full h-32 bg-black border border-gray-800 rounded-xl p-4 mb-6 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none text-white placeholder-gray-600"
              />
              <div className="flex justify-end gap-4">
                <button
                  onClick={() => importToken(tokenInput)}
                  className="px-6 py-3 rounded-xl font-bold transition-all duration-300 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white shadow-lg"
                >
                  Importar
                </button>
                <button
                  onClick={() => setShowTokenModal(false)}
                  className="px-6 py-3 rounded-xl font-bold transition-colors bg-gray-800 hover:bg-gray-700 text-white"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;