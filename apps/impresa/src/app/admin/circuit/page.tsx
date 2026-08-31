"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { graphStratify, sugiyama, layeringSimplex, decrossOpt, coordQuad } from "d3-dag";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, Network, Play, Plug, RefreshCw, Trash2 } from "lucide-react";

type ApiNode = {
  id: number;
  name: string;
  is_composite: boolean;
  circuit_role: string | false;
  analyst_index: string | false;
  active: boolean;
  parent_id: number | false;
  cron_id: number | false;
  cron_name: string | false;
  cron_role: string | false;
  process_key: string | false;
  phase_gate_type: string | false;
  last_execution:
    | { id: number; status: string; output_data: any; error_message: string | false }
    | false;
};
type ApiPhase = {
  id: number;
  name: string;
  node_ids: number[];
  exit_gate_ids: number[];
  entry_gate_ids: number[];
};
// Denis, 29/08/2026: "impilare Circuito 6 Giudici, Circuito Validazione,
// Circuito Colori, Typst -- se premo su un circuito ho l'esplosione, se li
// tengo fuori ho la mia Adaptive". circuit_workspace_root e' il vero nodo
// radice (parent_id reale dei 4 circuiti sotto, non un trucco di layout) --
// primo in lista/selezionato di default, cosi' il foglio mostra sempre
// prima la vista d'insieme; le altre voci restano per saltare dritti dentro
// un circuito specifico senza passare dall'espansione.
const CIRCUITS: { xmlid: string; label: string; hasRun: boolean }[] = [
  { xmlid: "circuit_workspace_root", label: "Adaptive EOSv6 (tutti i circuiti)", hasRun: false },
  { xmlid: "circuit_six_judges", label: "Circuito 6 Giudici", hasRun: true },
  { xmlid: "circuit_produzione_fasi", label: "Circuito Produzione a Fasi", hasRun: false },
  { xmlid: "circuit_ipo_prototype", label: "Prototipo IPO/AIPO — 2 Giudici", hasRun: false },
  { xmlid: "circuit_color_prototype", label: "Prototipo Palette Colori (da erpv6_color)", hasRun: false },
];
type ApiArc = {
  id: number;
  source_node_id: number;
  target_node_id: number;
  action_type: string;
  is_and_join: boolean;
  active: boolean;
  max_iterations: number;
};
type ApiKbLink = {
  id: number;
  target_node_id: number;
  kb_id: number | false;
  kb_name: string | false;
  data_format: string;
  format_mismatch: boolean;
};
type ApiOutput = {
  id: number;
  source_node_id: number;
  output_type: "documento" | "tabella" | "testo" | "json";
  name: string;
};
type ApiOutputLink = {
  id: number;
  target_node_id: number;
  output_id: number;
  output_name: string;
  output_type: string;
  source_node_id: number;
  source_node_name: string;
};
type CircuitData = {
  nodes: ApiNode[];
  arcs: ApiArc[];
  kb_links: ApiKbLink[];
  phases: ApiPhase[];
  outputs: ApiOutput[];
  output_links: ApiOutputLink[];
  test_fixture_id: number | false;
};
type KbCatalogEntry = { id: number; name: string };
type ProcessOption = { key: string; label: string; family: "ipo" | "aipo" };
type CronTriggerOption = { key: string; label: string; model: string; call_style: "model" | "recordset" };

// Denis, 29/08/2026: "il gate non e' sui nodi, ma sulla fase" -- 'gate' e'
// sparito da circuit_role/ROLE_BORDER. Il colore del rettangolo ora segue
// due assi indipendenti, entrambi SUL rettangolo stesso ("deve stare sul
// rettangolo"): fill = famiglia Motore (cosa calcola), stroke = ruolo
// Circuito normalmente, ma se il nodo e' un Gate (phase_gate_type) lo
// stroke diventa oro spesso e sovrascrive quello di ruolo.
const ROLE_BORDER: Record<string, string> = {
  generico: "#a78bfa",
  pid: "#f59e0b",
};
const ROLE_LABEL: Record<string, string> = {
  generico: "CIRCUITO",
  pid: "PID",
};
const MOTORE_FILL: Record<string, string> = {
  ipo: "#1e3a8a", // blu -- Motore IPO deterministico
  aipo: "#065f46", // verde -- Motore AIPO (AI)
};
const NO_MOTORE_FILL = "#27272a"; // grigio neutro -- nessun Motore
const GATE_STROKE = "#eab308"; // oro -- Gate (umano o AI), qualunque famiglia sotto
const GATE_STROKE_WIDTH = 3.5;
const NODE_ANALYST_BORDER = "#38bdf8";
const KB_BORDER = "#ec4899";
const KB_MISMATCH_BORDER = "#ef4444";

const ARC_COLOR: Record<string, string> = {
  data_flow: "#e4e4e7",
  gate_check: "#eab308",
  pid_fallback: "#fb923c",
  retry_loop: "#c084fc",
  trigger: "#71717a",
};
const ACTION_TYPE_LABEL: Record<string, string> = {
  data_flow: "Flusso dati",
  gate_check: "Verifica di Gate",
  pid_fallback: "Attivazione PID",
  retry_loop: "Loop di retry",
  trigger: "Attivazione",
};

const BOX_W = 150;
const BOX_H = 56;
const KB_W = 140;
const KB_H = 56;
// Output "a documento" (Denis, 29/08/2026: "rettangoli con la base piu'
// stretta dell'altezza, a ricordare un documento") -- base < altezza,
// l'opposto di un box orizzontale normale.
const OUTPUT_W = 54;
const OUTPUT_H = 74;
const OUTPUT_BORDER = "#dc2626";
const COL_GAP = 210;
const ROW_GAP = 130;

function needsKb(node: ApiNode) {
  return !!node.analyst_index;
}

type LaidNode = ApiNode & { x: number; y: number };
type LaidKb = ApiKbLink & { x: number; y: number };
type LaidOutput = ApiOutput & { x: number; y: number };

// Layout gerarchico a flusso (non piu' fisica a molla): il DAG principale e'
// costruito SOLO dagli archi di esecuzione reale tra i nodi di primo
// livello (data_flow/gate_check/pid_fallback), escluso retry_loop che e'
// un arco "all'indietro" verso un nodo gia' a monte -- disegnato a parte
// come curva di ritorno, non entra nella gerarchia altrimenti d3-dag non
// lo accetterebbe come DAG valido. I nipoti (azioni dentro un Circuito
// composito espanso, Denis 29/08/2026: "se la esplodo deve farmi vedere
// tutte le azioni") NON entrano nel DAG principale -- sono posizionati
// come satelliti del loro genitore, stesso pattern gia' usato per i rombi
// KB, cosi' non serve rifare la gerarchia ogni volta che si espande/
// collassa un Circuito.
function computeFlowLayout(data: CircuitData, expandedIds: Set<number>) {
  const root = data.nodes.find((n) => !n.parent_id);
  const topLevel = root ? data.nodes.filter((n) => n.parent_id === root.id) : data.nodes;

  const forwardArcs = data.arcs.filter((a) => a.action_type !== "retry_loop");
  const parentsByNode = new Map<number, number[]>();
  forwardArcs.forEach((a) => {
    const arr = parentsByNode.get(a.target_node_id) || [];
    arr.push(a.source_node_id);
    parentsByNode.set(a.target_node_id, arr);
  });

  let laidTop: LaidNode[];
  try {
    const stratify = graphStratify();
    const dag = stratify(
      topLevel.map((n) => ({
        id: String(n.id),
        parentIds: (parentsByNode.get(n.id) || []).filter((id) => topLevel.some((t) => t.id === id)).map(String),
      }))
    );
    const layout = sugiyama().layering(layeringSimplex()).decross(decrossOpt()).coord(coordQuad());
    layout(dag);
    const posById = new Map([...dag.nodes()].map((n) => [Number(n.data.id), { x: n.x, y: n.y }]));
    laidTop = topLevel.map((n) => {
      const p = posById.get(n.id) || { x: 0, y: 0 };
      return { ...n, x: p.x * COL_GAP, y: p.y * ROW_GAP };
    });
  } catch {
    // fallback a griglia semplice se il grafo non e' un DAG valido (es. un
    // arco data_flow creato a mano introduce un ciclo)
    laidTop = topLevel.map((n, i) => ({ ...n, x: (i % 5) * COL_GAP, y: Math.floor(i / 5) * ROW_GAP }));
  }
  if (root) laidTop.push({ ...root, x: 0, y: -ROW_GAP * 1.5 });

  // Nipoti visibili SOLO se il genitore e' espanso -- riga di caselle
  // satellite sotto il genitore, come per i rombi KB.
  const laidTopById = new Map(laidTop.map((n) => [n.id, n]));
  const expandedChildren: LaidNode[] = [];
  topLevel
    .filter((n) => n.is_composite && expandedIds.has(n.id))
    .forEach((parent) => {
      const children = data.nodes.filter((n) => n.parent_id === parent.id);
      const p = laidTopById.get(parent.id);
      if (!p) return;
      children.forEach((child, i) => {
        expandedChildren.push({
          ...child,
          x: p.x + (i - (children.length - 1) / 2) * (BOX_W + 20),
          y: p.y + ROW_GAP * 0.9,
        });
      });
    });

  const laid = [...laidTop, ...expandedChildren];

  const byId = new Map(laid.map((n) => [n.id, n]));
  const kbLaid: LaidKb[] = data.kb_links.map((kb, i) => {
    const target = byId.get(kb.target_node_id);
    const siblings = data.kb_links.filter((k) => k.target_node_id === kb.target_node_id);
    const idx = siblings.findIndex((k) => k.id === kb.id);
    return {
      ...kb,
      x: (target?.x || 0) + (idx - (siblings.length - 1) / 2) * (KB_W + 10),
      y: (target?.y || 0) - ROW_GAP * 0.65,
    };
  });

  // Output "a documento" (Denis, 29/08/2026): satelliti del nodo
  // PRODUTTORE (source_node_id) -- l'opposto dei rombi KB, che sono
  // satelliti del CONSUMATORE -- posizionati sotto invece che sopra, cosi'
  // non si sovrappongono mai anche quando un nodo ha sia KB in ingresso sia
  // Output in uscita.
  const outputLaid: LaidOutput[] = data.outputs.map((o) => {
    const source = byId.get(o.source_node_id);
    const siblings = data.outputs.filter((s) => s.source_node_id === o.source_node_id);
    const idx = siblings.findIndex((s) => s.id === o.id);
    return {
      ...o,
      x: (source?.x || 0) + (idx - (siblings.length - 1) / 2) * (OUTPUT_W + 14),
      y: (source?.y || 0) + ROW_GAP * 0.65,
    };
  });

  // Fasi (quadrati che raggruppano) -- Denis, 29/08/2026: ora lette da
  // erpv6.core.phase reale (node_ids), non piu' ricostruite a mano da
  // analyst_index/circuit_role lato client. Il riquadro piu' esterno
  // ("racchiude tutto lo schema") resta calcolato su TUTTI i nodi del
  // circuito, sempre -- generico per qualunque circuito, non solo i 6
  // Giudici -- le Fasi vere disegnano i raggruppamenti INTERNI.
  const rootNode = laid.find((n) => !n.parent_id);
  const boxAround = (nodes: LaidNode[], pad: number) => {
    if (!nodes.length) return null;
    const xs = nodes.map((n) => n.x);
    const ys = nodes.map((n) => n.y);
    return {
      x: Math.min(...xs) - BOX_W / 2 - pad,
      y: Math.min(...ys) - BOX_H / 2 - pad,
      width: Math.max(...xs) - Math.min(...xs) + BOX_W + pad * 2,
      height: Math.max(...ys) - Math.min(...ys) + BOX_H + pad * 2,
    };
  };
  const outerBox = {
    label: rootNode ? `Circuito: ${rootNode.name}` : "Circuito",
    color: "#a78bfa",
    box: boxAround(laid, 90),
  };
  const innerBoxes = data.phases
    .filter((p) => p.node_ids.length < laid.length)
    .map((p) => {
      const phaseNodes = laid.filter((n) => p.node_ids.includes(n.id));
      const hasGate = phaseNodes.some((n) => n.phase_gate_type);
      return {
        label: `Fase: ${p.name}`,
        color: hasGate ? GATE_STROKE : "#38bdf8",
        box: boxAround(phaseNodes, phaseNodes.length === 1 ? 55 : 40),
      };
    });
  // Riquadro di un Circuito composito espanso: genitore + le sue azioni
  // satellite, cosi' "esplodere" un rettangolo aggregato mostra davvero
  // tutto quello che contiene (Denis, 29/08/2026).
  const expandedBoxes = topLevel
    .filter((n) => n.is_composite && expandedIds.has(n.id))
    .map((parent) => {
      const p = laidTopById.get(parent.id);
      const children = laid.filter((n) => n.parent_id === parent.id);
      if (!p) return null;
      return {
        label: `${parent.name} (espanso)`,
        color: "#f472b6",
        box: boxAround([p, ...children], 30),
      };
    })
    .filter(Boolean) as { label: string; color: string; box: NonNullable<ReturnType<typeof boxAround>> }[];

  const phaseBoxes = [outerBox, ...innerBoxes, ...expandedBoxes].filter((p) => p.box) as {
    label: string;
    color: string;
    box: NonNullable<ReturnType<typeof boxAround>>;
  }[];

  return { nodes: laid, kbNodes: kbLaid, outputNodes: outputLaid, phaseBoxes };
}

export default function AdminCircuitPage() {
  const [circuitXmlid, setCircuitXmlid] = useState(CIRCUITS[0].xmlid);
  const [data, setData] = useState<CircuitData | null>(null);
  const [kbCatalog, setKbCatalog] = useState<KbCatalogEntry[]>([]);
  const [processesList, setProcessesList] = useState<ProcessOption[]>([]);
  const processKeyFamily = useMemo(
    () => new Map(processesList.map((p) => [p.key, p.family])),
    [processesList]
  );
  const [cronTriggersList, setCronTriggersList] = useState<CronTriggerOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [kbId, setKbId] = useState("214");
  const [runResult, setRunResult] = useState<any>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);
  const [connectingFrom, setConnectingFrom] = useState<number | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const toggleExpanded = useCallback((nodeId: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/core-engine/circuit/${circuitXmlid}`, { cache: "no-store" });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
      // Materiale di test dedicato (Denis, 29/08/2026: "creiamo sempre del
      // materiale di test specifico, mai qualcosa di reale") -- l'ID KB di
      // default per "Esegui" diventa quello, non piu' un ID a caso digitato
      // a mano.
      if (json.test_fixture_id) {
        setKbId(String(json.test_fixture_id));
        setTestOrderId(String(json.test_fixture_id));
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [circuitXmlid]);

  useEffect(() => {
    setSelectedNodeId(null);
    setConnectingFrom(null);
    load();
  }, [load]);

  useEffect(() => {
    fetch("/api/core-engine/kb-catalog")
      .then((r) => r.json())
      .then((j) => Array.isArray(j) && setKbCatalog(j))
      .catch(() => {});
    fetch("/api/core-engine/processes")
      .then((r) => r.json())
      .then((j) => Array.isArray(j) && setProcessesList(j))
      .catch(() => {});
    fetch("/api/core-engine/cron-triggers")
      .then((r) => r.json())
      .then((j) => Array.isArray(j) && setCronTriggersList(j))
      .catch(() => {});
  }, []);

  const kbByNode = useMemo(() => {
    const m = new Map<number, ApiKbLink[]>();
    (data?.kb_links || []).forEach((l) => {
      const arr = m.get(l.target_node_id) || [];
      arr.push(l);
      m.set(l.target_node_id, arr);
    });
    return m;
  }, [data]);

  const selectedNode = useMemo(
    () => data?.nodes.find((n) => n.id === selectedNodeId) || null,
    [data, selectedNodeId]
  );
  const selectedNodeKbLink = selectedNodeId ? (kbByNode.get(selectedNodeId) || [])[0] : undefined;
  const selectedNodeOutArcs = useMemo(
    () => (data && selectedNodeId ? data.arcs.filter((a) => a.source_node_id === selectedNodeId) : []),
    [data, selectedNodeId]
  );
  const selectedNodeInArcs = useMemo(
    () => (data && selectedNodeId ? data.arcs.filter((a) => a.target_node_id === selectedNodeId) : []),
    [data, selectedNodeId]
  );

  const toggleArc = async (arcId: number) => {
    await fetch(`/api/core-engine/arc/${arcId}/toggle`, { method: "POST" });
    await load();
  };
  const deleteArc = async (arcId: number) => {
    await fetch(`/api/core-engine/arc/${arcId}/delete`, { method: "POST" });
    await load();
  };
  const setMaxIterations = async (arcId: number, value: number) => {
    await fetch(`/api/core-engine/arc/${arcId}/max-iterations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ max_iterations: value }),
    });
    await load();
  };
  const setKbForSelectedNode = async (kbId: number) => {
    if (!selectedNodeId) return;
    await fetch(`/api/core-engine/node/${selectedNodeId}/kb-link`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kb_id: kbId }),
    });
    await load();
  };
  const removeKbLink = async (linkId: number) => {
    await fetch(`/api/core-engine/kb-link/${linkId}/delete`, { method: "POST" });
    await load();
  };

  // Pannello costruzione (Denis, 29/08/2026): creare nodi/azioni e Fasi
  // dalla UI invece che solo gestire archi/KB su nodi gia' seminati.
  const [actionError, setActionError] = useState<string | null>(null);
  // Nessun controllo d'errore prima d'ora: una creazione fallita/andata
  // storta spariva in silenzio -- Denis, 29/08/2026, "se creo una fase
  // scrivendola non la crea" (in realta' veniva creata ma non attaccata a
  // nessun circuito, quindi invisibile: stesso bug del parent_id sotto,
  // ma senza questo helper l'utente non avrebbe modo di saperlo mai).
  const postAction = async (url: string, body: any) => {
    setActionError(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json?.error) {
        setActionError(json.error);
        return null;
      }
      return json;
    } catch (err: any) {
      setActionError(err.message || "Errore di rete");
      return null;
    }
  };

  const rootNodeId = data?.nodes.find((n) => !n.parent_id)?.id;

  // Test di un nodo Motore (Denis, 29/08/2026: come Step 7 Siemens --
  // costruzione, poi Test che illumina il nodo mentre passa l'esecuzione,
  // poi RUN separato per abilitare davvero in produzione -- il RUN e' gia'
  // lo stesso pulsante di attivazione Cron sopra, il Test e' questo).
  const [testOrderId, setTestOrderId] = useState("");
  const [testPrompt, setTestPrompt] = useState("Rispondi con una sola parola: OK");
  const [testRunning, setTestRunning] = useState(false);
  const [justExecutedNodeId, setJustExecutedNodeId] = useState<number | null>(null);
  // IPO (deterministico, es. Typst) prende order_id. AIPO (intelligente,
  // passa dal "rele'" erpv6_omni_bridge) prende prompt+task_type -- input
  // diversi perche' sono due famiglie di Motore diverse (Denis, 29/08/2026).
  const runNodeProcess = async (nodeId: number, processKey: string) => {
    const isAipo = processKey === "ai_analyze";
    if (isAipo && !testPrompt.trim()) return;
    if (!isAipo && !testOrderId.trim()) return;
    setTestRunning(true);
    const result = await postAction(
      `/api/core-engine/node/${nodeId}/run-process`,
      isAipo ? { task_type: "validation_analyst", prompt: testPrompt } : { order_id: Number(testOrderId) }
    );
    setTestRunning(false);
    if (!result) return;
    setJustExecutedNodeId(nodeId);
    setTimeout(() => setJustExecutedNodeId(null), 2200);
    await load();
  };

  // Esegui Circuito (Denis, 29/08/2026): ordine topologico reale lato
  // backend (erpv6.core.node.run_circuit), il log che torna e' quello che
  // e' successo davvero -- qui lo "riproduciamo" passo passo con un
  // ritardo breve tra un nodo e l'altro, cosi' si vede l'accensione in
  // sequenza invece di tutto insieme a fine chiamata.
  const [circuitLog, setCircuitLog] = useState<any[]>([]);
  const [circuitRunning, setCircuitRunning] = useState(false);
  const runFullCircuit = async () => {
    const root = data?.nodes.find((n) => !n.parent_id);
    if (!root) return;
    setCircuitRunning(true);
    setCircuitLog([]);
    const result = await postAction(`/api/core-engine/node/${root.id}/run-circuit`, {});
    if (!result?.log) {
      setCircuitRunning(false);
      return;
    }
    for (const step of result.log) {
      setJustExecutedNodeId(step.node_id);
      setCircuitLog((prev) => [...prev, step]);
      await new Promise((r) => setTimeout(r, 900));
      setJustExecutedNodeId(null);
      await new Promise((r) => setTimeout(r, 300));
    }
    setCircuitRunning(false);
    await load();
  };

  const [newNodeName, setNewNodeName] = useState("");
  const [newNodeParentId, setNewNodeParentId] = useState<string>("");
  const [newNodeComposite, setNewNodeComposite] = useState(false);
  // Ruolo Circuito (Denis, 29/08/2026: "se scelgo pid dovrei vedere la
  // tendina con i parametri obbligatori e se scelgo contenitore è solo una
  // etichetta") -- ha senso solo se newNodeComposite=true. "" = non ancora
  // scelto (form incompleto, submit disabilitato finche' is_composite e'
  // spuntato). 'gate' NON e' piu' un'opzione qui (Denis, 29/08/2026: "il
  // gate non e' sui nodi, ma sulla fase") -- vedi newNodePhaseGateType sotto,
  // indipendente da is_composite/circuit_role.
  const [newNodeCircuitRole, setNewNodeCircuitRole] = useState<"" | "generico" | "pid">("");
  useEffect(() => {
    if (!newNodeComposite) setNewNodeCircuitRole("");
  }, [newNodeComposite]);

  // Famiglia Motore (Denis, 29/08/2026: "a lato quando faccio nuovo motore
  // devo selezionare o motore IPO o motore AIPO, altrimenti non parto la
  // logica") -- "" = nessun Motore. Visibile su qualunque nodo TRANNE un
  // Circuito PID (il "motore" del PID e' il trigger cron, non un Motore
  // Input/Processo/Output).
  const [newNodeFamily, setNewNodeFamily] = useState<"" | "ipo" | "aipo">("");
  const [newNodeProcessKey, setNewNodeProcessKey] = useState<string>("");
  const showMotoreSelector = newNodeCircuitRole !== "pid";
  const familyProcesses = useMemo(
    () => processesList.filter((p) => p.family === newNodeFamily),
    [processesList, newNodeFamily]
  );
  useEffect(() => {
    // Cambiando famiglia, ripristina/auto-seleziona il process_key: se la
    // famiglia ha una sola voce (caso attuale) la sceglie subito, cosi' non
    // serve un terzo click per il caso comune.
    setNewNodeProcessKey(familyProcesses.length === 1 ? familyProcesses[0].key : "");
  }, [newNodeFamily]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tipo Gate Fase (Denis, 29/08/2026: "che tipo di gate? umano? attesa di
  // tempo... is_fase_human_gate ti dice al motore 'controlla di avere un
  // gate specifico, umano'") -- selezione tipizzata, non un booleano
  // ambiguo. Le opzioni valide dipendono dalla famiglia Motore scelta sopra
  // (vincolo reale lato backend, vedi _check_phase_gate_type_matches_motore):
  // nessun Motore -> solo "umano"; Motore AIPO -> solo "ai"; Motore IPO
  // deterministico -> nessuna (un Gate valuta/decide, non genera documenti).
  // "a tempo" e' stato citato come possibile terza famiglia ma non e'
  // ancora progettato, non lo invento qui.
  const [newNodePhaseGateType, setNewNodePhaseGateType] = useState<"" | "umano" | "ai">("");
  const gateTypeOptions: Array<{ value: "umano" | "ai"; label: string }> =
    newNodeFamily === "aipo" ? [{ value: "ai", label: "Gate AI — arbitro" }]
    : newNodeFamily === "ipo" ? []
    : [{ value: "umano", label: "Gate umano — conferma manuale" }];
  useEffect(() => {
    setNewNodePhaseGateType("");
  }, [newNodeFamily]);

  // Parametri obbligatori del PID (Denis, 29/08/2026): un Circuito PID
  // senza trigger reale e' solo un'etichetta decorativa, non "un circuito
  // assestante e parallelo" -- il trigger va scelto qui in creazione, mai
  // aggiunto dopo, cosi' un PID esiste solo se e' davvero collegato a un
  // cron reale (vedi create_cron_node).
  const [newNodeCronTriggerKey, setNewNodeCronTriggerKey] = useState<string>("");
  const [newNodeCronDomain, setNewNodeCronDomain] = useState<string>("");
  const selectedCronTrigger = cronTriggersList.find((t) => t.key === newNodeCronTriggerKey);
  useEffect(() => {
    setNewNodeCronTriggerKey("");
    setNewNodeCronDomain("");
  }, [newNodeCircuitRole]);

  const canCreateNode =
    !!newNodeName.trim() &&
    (!newNodeComposite || !!newNodeCircuitRole) &&
    !(showMotoreSelector && newNodeFamily && !newNodeProcessKey) &&
    !(newNodeCircuitRole === "pid" && !newNodeCronTriggerKey);

  const createNode = async () => {
    if (!canCreateNode) return;
    const name = newNodeName.trim();
    // "— nel Circuito (radice) —" deve significare "figlio diretto del
    // Circuito che sto guardando", non "nessun genitore" -- prima mandava
    // parent_id vuoto e il nodo diventava un orfano invisibile in
    // qualunque circuito (bug reale trovato da Denis il 29/08/2026, con
    // tanto di doppioni "validazione" ricreati perche' sembrava non
    // funzionasse).
    const parent_id = newNodeParentId || rootNodeId;
    let result;
    if (newNodeCircuitRole === "pid") {
      // Un PID e' sempre un vero cron collegato (mai un box decorativo):
      // passa dall'endpoint dedicato create_cron_node, che crea nodo +
      // ir.cron reale insieme (sempre active=False, va attivato a parte).
      result = await postAction("/api/core-engine/cron-node", {
        name,
        parent_id,
        cron_role: "attivazione",
        cron_trigger_key: newNodeCronTriggerKey,
        ...(selectedCronTrigger?.call_style === "recordset" && newNodeCronDomain.trim()
          ? { cron_domain: newNodeCronDomain.trim() }
          : {}),
      });
    } else {
      result = await postAction("/api/core-engine/node", {
        name,
        parent_id,
        is_composite: newNodeComposite,
        ...(newNodeComposite && newNodeCircuitRole ? { circuit_role: newNodeCircuitRole } : {}),
        ...(newNodeProcessKey ? { process_key: newNodeProcessKey } : {}),
        ...(newNodePhaseGateType ? { phase_gate_type: newNodePhaseGateType } : {}),
      });
    }
    if (!result) return;
    setNewNodeName("");
    setNewNodeComposite(false);
    setNewNodeCircuitRole("");
    setNewNodeFamily("");
    setNewNodeProcessKey("");
    setNewNodePhaseGateType("");
    setNewNodeCronTriggerKey("");
    setNewNodeCronDomain("");
    await load();
  };
  const makeComposite = async (nodeId: number) => {
    const result = await postAction(`/api/core-engine/node/${nodeId}/update`, {
      is_composite: true,
      circuit_role: "generico",
    });
    if (!result) return;
    await load();
  };
  const deleteNode = async (nodeId: number) => {
    const result = await postAction(`/api/core-engine/node/${nodeId}/delete`, {});
    if (!result) return;
    setSelectedNodeId(null);
    await load();
  };
  const insertNodeOnArc = async (arcId: number) => {
    const name = window.prompt("Nome del nuovo nodo da inserire qui in mezzo:");
    if (!name?.trim()) return;
    const result = await postAction(`/api/core-engine/arc/${arcId}/insert-node`, { name: name.trim() });
    if (!result) return;
    await load();
  };

  const [newPhaseName, setNewPhaseName] = useState("");
  const [newPhaseNodeIds, setNewPhaseNodeIds] = useState<Set<number>>(new Set());
  const togglePhaseNode = (id: number) =>
    setNewPhaseNodeIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const createPhase = async () => {
    if (!newPhaseName.trim() || !newPhaseNodeIds.size) return;
    // Il Gate di uscita si deriva DAI nodi selezionati (al massimo uno ha
    // phase_gate_type impostato, vincolo reale lato backend) -- niente
    // selettore separato: se hai gia' scelto come membro un nodo con
    // "Tipo Gate Fase" attivo in creazione, la Fase lo riconosce da solo.
    const nodeIds = [...newPhaseNodeIds];
    const gateNode = (data?.nodes || []).find((n) => nodeIds.includes(n.id) && n.phase_gate_type);
    const result = await postAction("/api/core-engine/phase", {
      name: newPhaseName.trim(),
      node_ids: nodeIds,
      ...(gateNode ? { exit_gate_ids: [gateNode.id] } : {}),
    });
    if (!result) return;
    setNewPhaseName("");
    setNewPhaseNodeIds(new Set());
    await load();
  };

  const handleNodeClick = useCallback(
    async (node: ApiNode) => {
      if (connectingFrom && connectingFrom !== node.id) {
        await fetch("/api/core-engine/arc", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source_node_id: connectingFrom,
            target_node_id: node.id,
            action_type: "data_flow",
            is_and_join: true,
          }),
        });
        setConnectingFrom(null);
        await load();
        return;
      }
      setSelectedNodeId(node.id);
    },
    [connectingFrom, load]
  );

  const layout = useMemo(
    () => (data ? computeFlowLayout(data, expandedIds) : { nodes: [], kbNodes: [], outputNodes: [], phaseBoxes: [] }),
    [data, expandedIds]
  );

  const contentBounds = useMemo(() => {
    const allX = [
      ...layout.nodes.map((n) => n.x),
      ...layout.kbNodes.map((n) => n.x),
      ...layout.outputNodes.map((n) => n.x),
    ];
    const allY = [
      ...layout.nodes.map((n) => n.y),
      ...layout.kbNodes.map((n) => n.y),
      ...layout.outputNodes.map((n) => n.y),
    ];
    if (!allX.length) return { minX: 0, minY: 0, width: 800, height: 500 };
    const pad = 100;
    const mnX = Math.min(...allX) - BOX_W / 2 - pad;
    const mxX = Math.max(...allX) + BOX_W / 2 + pad;
    const mnY = Math.min(...allY) - BOX_H / 2 - pad;
    const mxY = Math.max(...allY) + BOX_H / 2 + pad;
    return { minX: mnX, minY: mnY, width: mxX - mnX, height: mxY - mnY };
  }, [layout]);

  // Pan/zoom manuali (persi passando da react-force-graph-2d a SVG puro --
  // Denis, 29/08/2026): transform su un <g> interno invece del viewBox,
  // rotellina = zoom centrato sul cursore, drag sullo sfondo = pan.
  const svgContainerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 800, height: 560 });
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
  const panState = useRef<{ startX: number; startY: number; viewX: number; viewY: number } | null>(null);

  useEffect(() => {
    const el = svgContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width: w, height: h } = entry.contentRect;
      setContainerSize({ width: Math.max(w, 200), height: Math.max(h, 200) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Auto-fit quando cambiano i dati (nuovo layout) o la dimensione del
  // contenitore -- da quel momento in poi l'utente e' libero di zoomare/
  // spostarsi, non si sovrascrive piu' finche' non ricarica.
  useEffect(() => {
    const scale = Math.min(
      containerSize.width / contentBounds.width,
      containerSize.height / contentBounds.height,
      1
    );
    const x = containerSize.width / 2 - (contentBounds.minX + contentBounds.width / 2) * scale;
    const y = containerSize.height / 2 - (contentBounds.minY + contentBounds.height / 2) * scale;
    setView({ scale, x, y });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, containerSize.width, containerSize.height]);

  const handleWheel = useCallback((e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const rect = svgContainerRef.current!.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    setView((v) => {
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      const newScale = Math.min(4, Math.max(0.15, v.scale * factor));
      const contentX = (cx - v.x) / v.scale;
      const contentY = (cy - v.y) / v.scale;
      return { scale: newScale, x: cx - contentX * newScale, y: cy - contentY * newScale };
    });
  }, []);

  const handleBackgroundMouseDown = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      panState.current = { startX: e.clientX, startY: e.clientY, viewX: view.x, viewY: view.y };
    },
    [view.x, view.y]
  );
  const handleBackgroundMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const start = panState.current;
    if (!start) return;
    const dx = e.clientX - start.startX;
    const dy = e.clientY - start.startY;
    setView((v) => ({ ...v, x: start.viewX + dx, y: start.viewY + dy }));
  }, []);
  const stopPanning = useCallback(() => {
    panState.current = null;
  }, []);

  const runCircuit = async () => {
    setRunning(true);
    setRunResult(null);
    setRunError(null);
    try {
      const res = await fetch("/api/core-engine/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kb_id: Number(kbId) }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setRunResult(json);
    } catch (err: any) {
      setRunError(err.message || "Errore durante l'esecuzione");
    } finally {
      setRunning(false);
    }
  };

  // Gate umano reale (Denis, 29/08/2026: "finestra con approva/rifiuta a
  // lato") -- chiama davvero action_human_approve/reject sulla sessione,
  // non e' una simulazione.
  const [gateActing, setGateActing] = useState(false);
  const decideGate = async (approve: boolean) => {
    if (!runResult?.run_id) return;
    setGateActing(true);
    const result = await postAction(`/api/core-engine/circuit-run/${runResult.run_id}/${approve ? "approve" : "reject"}`, {});
    setGateActing(false);
    if (!result) return;
    setRunResult(result);
  };

  const nodesById = new Map((data?.nodes || []).map((n) => [n.id, n]));
  const laidById = new Map(layout.nodes.map((n) => [n.id, n]));
  const childCountByParent = new Map<number, number>();
  (data?.nodes || []).forEach((n) => {
    if (n.parent_id) childCountByParent.set(n.parent_id, (childCountByParent.get(n.parent_id) || 0) + 1);
  });

  return (
    <main className="min-h-screen bg-zinc-950 p-6 text-zinc-100">
      <div className="mx-auto max-w-7xl space-y-4">
        <header className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div className="flex items-center gap-3">
            <Link
              href="/admin/actions"
              className="rounded-md border border-zinc-800 p-2 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="flex items-center gap-2.5 text-xl font-semibold tracking-tight">
                <Network className="h-5 w-5 text-emerald-400" />
                Adaptive EOSv6 — dati reali da Odoo
              </h1>
              <p className="mt-0.5 text-xs text-zinc-500">
                {connectingFrom
                  ? "Clicca il rettangolo di destinazione per creare l'arco (clicca di nuovo lo stesso per annullare)."
                  : "Clicca un rettangolo per gestirlo: KB collegata, archi, nuovo collegamento."}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={circuitXmlid}
              onChange={(e) => setCircuitXmlid(e.target.value)}
              className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-300"
            >
              {CIRCUITS.map((c) => (
                <option key={c.xmlid} value={c.xmlid}>
                  {c.label}
                </option>
              ))}
            </select>
            {(data?.nodes || []).some((n) => n.process_key) && (
              <button
                onClick={runFullCircuit}
                disabled={circuitRunning}
                className="flex items-center gap-1.5 rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
              >
                <Play className={`h-3.5 w-3.5 ${circuitRunning ? "animate-pulse" : ""}`} />
                {circuitRunning ? "In corso…" : "Esegui Circuito"}
              </button>
            )}
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Ricarica
            </button>
          </div>
        </header>

        {(circuitRunning || circuitLog.length > 0) && (
          <div className="rounded-lg border border-emerald-900 bg-emerald-950/20 p-3">
            <p className="mb-2 text-xs font-medium text-emerald-300">
              Log esecuzione {circuitRunning && "(in corso…)"}
            </p>
            <div className="space-y-1 font-mono text-[11px]">
              {circuitLog.map((step, i) => (
                <div
                  key={i}
                  className={
                    step.status === "done"
                      ? "text-emerald-400"
                      : step.status === "failed"
                      ? "text-rose-400"
                      : "text-zinc-500"
                  }
                >
                  {i + 1}. {step.node_name} — {step.status}
                  {step.error ? `: ${step.error}` : ""}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_380px]">
          <div
            ref={svgContainerRef}
            className="relative h-[560px] overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950"
          >
            <div className="pointer-events-none absolute right-2 top-2 z-10 rounded bg-zinc-900/80 px-2 py-1 text-[10px] text-zinc-500">
              Rotella = zoom · trascina lo sfondo = pan
            </div>
            {data && (
              <svg
                width={containerSize.width}
                height={containerSize.height}
                onWheel={handleWheel}
                onMouseDown={handleBackgroundMouseDown}
                onMouseMove={handleBackgroundMouseMove}
                onMouseUp={stopPanning}
                onMouseLeave={stopPanning}
                onClick={() => {
                  setConnectingFrom(null);
                  setSelectedNodeId(null);
                }}
                style={{ cursor: panState.current ? "grabbing" : "grab" }}
              >
                <defs>
                  {Object.entries(ARC_COLOR).map(([type, color]) => (
                    <marker
                      key={type}
                      id={`arrow-${type}`}
                      viewBox="0 0 10 10"
                      refX="9"
                      refY="5"
                      markerWidth="7"
                      markerHeight="7"
                      orient="auto-start-reverse"
                    >
                      <path d="M0,0 L10,5 L0,10 z" fill={color} />
                    </marker>
                  ))}
                </defs>

                <g transform={`translate(${view.x},${view.y}) scale(${view.scale})`}>
                {/* Fasi (quadrati di raggruppamento): 5 analisti insieme, Sesto Giudice a parte */}
                {layout.phaseBoxes.map((p) => (
                  <g key={p.label}>
                    <rect
                      x={p.box.x}
                      y={p.box.y}
                      width={p.box.width}
                      height={p.box.height}
                      rx={14}
                      fill={`${p.color}0d`}
                      stroke={p.color}
                      strokeOpacity={0.5}
                      strokeWidth={1.5}
                      strokeDasharray="6,4"
                    />
                    <text x={p.box.x + 10} y={p.box.y + 18} fontSize={10} fill={p.color} fontFamily="monospace">
                      {p.label}
                    </text>
                  </g>
                ))}

                {/* Archi in avanti (flusso principale) */}
                {(data.arcs || [])
                  .filter((a) => a.action_type !== "retry_loop")
                  .map((a) => {
                    const s = laidById.get(a.source_node_id);
                    const t = laidById.get(a.target_node_id);
                    if (!s || !t) return null;
                    const color = a.active ? ARC_COLOR[a.action_type] || "#64748b" : "#3f3f46";
                    const y1 = s.y + BOX_H / 2;
                    const y2 = t.y - BOX_H / 2 - 8;
                    const midX = (s.x + t.x) / 2;
                    const midY = (y1 + y2) / 2;
                    const dx = t.x - s.x;
                    const dy = y2 - y1;
                    const len = Math.hypot(dx, dy) || 1;
                    const px = -dy / len;
                    const py = dx / len;
                    return (
                      <g key={a.id}>
                        <line
                          x1={s.x}
                          y1={y1}
                          x2={t.x}
                          y2={y2}
                          stroke={color}
                          strokeWidth={2}
                          strokeDasharray={a.active ? undefined : "5,4"}
                          markerEnd={`url(#arrow-${a.action_type})`}
                        />
                        {/* Contatto ladder: doppio trattino perpendicolare = AND
                            (in serie, is_and_join=true), niente = OR/trigger
                            libero -- Denis, 29/08/2026. */}
                        {a.is_and_join && (
                          <>
                            <line
                              x1={midX - dx * 0.06 - px * 6}
                              y1={midY - dy * 0.06 - py * 6}
                              x2={midX - dx * 0.06 + px * 6}
                              y2={midY - dy * 0.06 + py * 6}
                              stroke={color}
                              strokeWidth={2}
                            />
                            <line
                              x1={midX + dx * 0.06 - px * 6}
                              y1={midY + dy * 0.06 - py * 6}
                              x2={midX + dx * 0.06 + px * 6}
                              y2={midY + dy * 0.06 + py * 6}
                              stroke={color}
                              strokeWidth={2}
                            />
                          </>
                        )}
                      </g>
                    );
                  })}

                {/* Arco di loop (all'indietro): curva laterale, non nel flusso principale */}
                {(data.arcs || [])
                  .filter((a) => a.action_type === "retry_loop")
                  .map((a) => {
                    const s = laidById.get(a.source_node_id);
                    const t = laidById.get(a.target_node_id);
                    if (!s || !t) return null;
                    const color = a.active ? ARC_COLOR.retry_loop : "#3f3f46";
                    const midX = Math.max(s.x, t.x) + BOX_W * 1.3;
                    const path = `M ${s.x + BOX_W / 2} ${s.y} C ${midX} ${s.y}, ${midX} ${t.y}, ${t.x + BOX_W / 2} ${t.y}`;
                    return (
                      <path
                        key={a.id}
                        d={path}
                        fill="none"
                        stroke={color}
                        strokeWidth={2.5}
                        strokeDasharray={a.active ? undefined : "5,4"}
                        markerEnd="url(#arrow-retry_loop)"
                      />
                    );
                  })}

                {/* Archi KB -> nodo (rombo) */}
                {layout.kbNodes.map((kb) => {
                  const t = laidById.get(kb.target_node_id);
                  if (!t) return null;
                  return (
                    <line
                      key={`kbarc-${kb.id}`}
                      x1={kb.x}
                      y1={kb.y + KB_H / 2}
                      x2={t.x}
                      y2={t.y - BOX_H / 2}
                      stroke={kb.format_mismatch ? KB_MISMATCH_BORDER : KB_BORDER}
                      strokeWidth={1.5}
                      strokeDasharray="3,3"
                    />
                  );
                })}

                {/* Nodo -> Output (Denis, 29/08/2026): dal produttore
                    all'Output che dichiara. */}
                {layout.outputNodes.map((o) => {
                  const s = laidById.get(o.source_node_id);
                  if (!s) return null;
                  return (
                    <line
                      key={`outarc-${o.id}`}
                      x1={s.x}
                      y1={s.y + BOX_H / 2}
                      x2={o.x}
                      y2={o.y - OUTPUT_H / 2}
                      stroke={OUTPUT_BORDER}
                      strokeWidth={1.5}
                      strokeDasharray="3,3"
                    />
                  );
                })}

                {/* Output -> nodo consumatore (Denis, 29/08/2026:
                    "qualsiasi output finito puo' essere un input da
                    un'altra parte, non per forza sequenziali") --
                    collegamento via output_link_ids, indipendente da un
                    arco diretto, disegnato solo se entrambi gli estremi
                    sono visibili nel disegno corrente. */}
                {(data?.output_links || []).map((link) => {
                  const o = layout.outputNodes.find((n) => n.id === link.output_id);
                  const t = laidById.get(link.target_node_id);
                  if (!o || !t) return null;
                  return (
                    <line
                      key={`outlink-${link.id}`}
                      x1={o.x}
                      y1={o.y + OUTPUT_H / 2}
                      x2={t.x}
                      y2={t.y + BOX_H / 2}
                      stroke={OUTPUT_BORDER}
                      strokeWidth={1.5}
                      strokeDasharray="2,5"
                      markerEnd="url(#arrow-retry_loop)"
                    />
                  );
                })}

                {/* Nodi/Circuiti */}
                {layout.nodes.map((n) => {
                  const missing = needsKb(n) && !(kbByNode.get(n.id) || []).some((l) => l.kb_id);
                  const family = n.process_key ? processKeyFamily.get(n.process_key) : undefined;
                  const isGate = !!n.phase_gate_type;
                  // Fill = famiglia Motore (cosa calcola), stroke = ruolo
                  // Circuito, sovrascritto in oro/spesso se e' un Gate --
                  // entrambi sullo stesso <rect>, mai un elemento separato
                  // (Denis, 29/08/2026: "deve stare sul rettangolo").
                  const fill = family ? MOTORE_FILL[family] : NO_MOTORE_FILL;
                  const border = isGate
                    ? GATE_STROKE
                    : n.is_composite
                      ? ROLE_BORDER[n.circuit_role || "generico"]
                      : NODE_ANALYST_BORDER;
                  const selected = n.id === selectedNodeId || n.id === connectingFrom;
                  const justExecuted = n.id === justExecutedNodeId;
                  return (
                    <g
                      key={n.id}
                      transform={`translate(${n.x - BOX_W / 2}, ${n.y - BOX_H / 2})`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleNodeClick(n);
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                      style={{ cursor: "pointer" }}
                      opacity={n.active === false ? 0.4 : 1}
                    >
                      {/* Illuminazione "Test" (Denis, 29/08/2026, ispirato a
                          Step 7 Siemens): sempre montato, solo l'opacita'
                          cambia via transizione CSS -- piu' affidabile di
                          <animate> SMIL che a volte non ripartiva quando
                          il nodo veniva rieseguito piu' volte di fila. */}
                      <rect
                        x={-6}
                        y={-6}
                        width={BOX_W + 12}
                        height={BOX_H + 12}
                        rx={12}
                        fill="none"
                        stroke="#34d399"
                        strokeWidth={justExecuted ? 6 : 1}
                        opacity={justExecuted ? 1 : 0}
                        style={{ transition: justExecuted ? "none" : "opacity 2s ease-out, stroke-width 2s ease-out" }}
                        pointerEvents="none"
                      />
                      <rect
                        width={BOX_W}
                        height={BOX_H}
                        rx={8}
                        fill={justExecuted ? "#0a3d2e" : fill}
                        stroke={missing ? "#ef4444" : border}
                        strokeWidth={selected ? 3 : missing ? 2 : isGate ? GATE_STROKE_WIDTH : 1.5}
                        strokeDasharray={missing ? "4,3" : undefined}
                        style={{ transition: justExecuted ? "none" : "fill 2s ease-out" }}
                      />
                      {isGate ? (
                        <text x={8} y={14} fontSize={8} fill={GATE_STROKE} fontFamily="monospace">
                          ⚖ GATE {n.phase_gate_type === "ai" ? "AI" : "UMANO"}
                        </text>
                      ) : (
                        n.is_composite &&
                        n.circuit_role && (
                          <text x={8} y={14} fontSize={8} fill={border} fontFamily="monospace">
                            {ROLE_LABEL[n.circuit_role]}
                          </text>
                        )
                      )}
                      {n.is_composite && (childCountByParent.get(n.id) || 0) > 0 && (
                        <g
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleExpanded(n.id);
                          }}
                          onMouseDown={(e) => e.stopPropagation()}
                        >
                          <rect x={BOX_W - 34} y={BOX_H - 20} width={30} height={16} rx={4} fill="#27272a" />
                          <text x={BOX_W - 19} y={BOX_H - 8} textAnchor="middle" fontSize={9} fill="#e4e4e7">
                            {expandedIds.has(n.id) ? "▾" : "▸"} {childCountByParent.get(n.id)}
                          </text>
                        </g>
                      )}
                      <text
                        x={BOX_W / 2}
                        y={BOX_H / 2 + (isGate || (n.is_composite && n.circuit_role) ? 6 : 0)}
                        textAnchor="middle"
                        fontSize={11}
                        fill="#e4e4e7"
                      >
                        {n.name}
                      </text>
                      {missing && (
                        <text x={BOX_W - 8} y={14} textAnchor="end" fontSize={9} fill="#ef4444">
                          ⚠ KB
                        </text>
                      )}
                      {n.cron_id && (
                        <text
                          x={BOX_W - 8}
                          y={BOX_H - 6}
                          textAnchor="end"
                          fontSize={8}
                          fill={
                            n.cron_role === "attivazione"
                              ? "#fb923c"
                              : n.cron_role === "wrapped"
                                ? "#a78bfa"
                                : "#94a3b8"
                          }
                        >
                          ⏱ {n.cron_role === "wrapped" ? "avvolto" : n.cron_role || "lettura"}
                        </text>
                      )}
                      {n.process_key && (
                        <text
                          x={4}
                          y={BOX_H - 6}
                          fontSize={8}
                          fill={
                            n.last_execution
                              ? n.last_execution.status === "done"
                                ? "#34d399"
                                : n.last_execution.status === "failed"
                                ? "#f87171"
                                : "#94a3b8"
                              : "#52525b"
                          }
                        >
                          ⚙ {n.last_execution ? n.last_execution.status : "mai testato"}
                        </text>
                      )}
                    </g>
                  );
                })}

                {/* Rombi KB -- veri rombi (Denis, 29/08/2026: "le kb sono
                    ancora rettangoli, invece devono essere rombi"), non piu'
                    box rettangolari tratteggiati. */}
                {layout.kbNodes.map((kb) => {
                  const owner = laidById.get(kb.target_node_id);
                  return (
                    <g
                      key={kb.id}
                      transform={`translate(${kb.x - KB_W / 2}, ${kb.y - KB_H / 2})`}
                      opacity={0.9}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedNodeId(kb.target_node_id);
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                      style={{ cursor: "pointer" }}
                    >
                      <polygon
                        points={`${KB_W / 2},0 ${KB_W},${KB_H / 2} ${KB_W / 2},${KB_H} 0,${KB_H / 2}`}
                        fill="#1a1023"
                        stroke={kb.format_mismatch ? KB_MISMATCH_BORDER : KB_BORDER}
                        strokeWidth={1.5}
                      />
                      <text x={KB_W / 2} y={KB_H / 2 - 2} textAnchor="middle" fontSize={8} fill="#f0abfc">
                        {(kb.kb_name || `KB #${kb.kb_id}`).slice(0, 20)}
                      </text>
                      {/* Denis, 29/08/2026: "a chi appartengono? dovrei
                          vedere anche a cosa sono collegate" -- il nome del
                          nodo proprietario direttamente sul rombo, non solo
                          affidato alla linea tratteggiata di collegamento. */}
                      <text x={KB_W / 2} y={KB_H / 2 + 10} textAnchor="middle" fontSize={7} fill="#71717a">
                        → {(owner?.name || "?").slice(0, 22)}
                      </text>
                    </g>
                  );
                })}

                {/* Output "a documento", rossi (Denis, 29/08/2026): un
                    Output esiste indipendentemente da un arco -- referenziato
                    da output_link_ids su qualunque nodo, non solo a valle
                    diretto. Disegnati come satelliti del nodo produttore,
                    stesso principio dei rombi KB. */}
                {layout.outputNodes.map((o) => (
                  <g
                    key={`output-${o.id}`}
                    transform={`translate(${o.x - OUTPUT_W / 2}, ${o.y - OUTPUT_H / 2})`}
                    opacity={0.9}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedNodeId(o.source_node_id);
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    style={{ cursor: "pointer" }}
                  >
                    <polygon
                      points={`0,0 ${OUTPUT_W},0 ${OUTPUT_W},${OUTPUT_H} ${OUTPUT_W * 0.25},${OUTPUT_H} 0,${OUTPUT_H * 0.85}`}
                      fill="#2a0a0a"
                      stroke={OUTPUT_BORDER}
                      strokeWidth={1.5}
                    />
                    <text x={OUTPUT_W / 2} y={OUTPUT_H / 2 - 6} textAnchor="middle" fontSize={7} fill="#fca5a5">
                      {o.output_type}
                    </text>
                    <text x={OUTPUT_W / 2} y={OUTPUT_H / 2 + 8} textAnchor="middle" fontSize={7} fill="#fca5a5">
                      {(o.name || "").replace(/^Output \w+: /, "").slice(0, 12)}
                    </text>
                  </g>
                ))}
                </g>
              </svg>
            )}
          </div>

          <aside className="max-h-[560px] space-y-4 overflow-y-auto pr-1">
            {actionError && (
              <div className="flex items-start justify-between gap-2 rounded-md border border-rose-900 bg-rose-950/40 px-3 py-2 text-[11px] text-rose-300">
                <span>{actionError}</span>
                <button onClick={() => setActionError(null)} className="shrink-0 text-rose-400 hover:text-rose-200">
                  ✕
                </button>
              </div>
            )}
            {selectedNode ? (
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-zinc-200">{selectedNode.name}</h2>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setConnectingFrom(selectedNode.id)}
                      className="flex items-center gap-1 rounded-md border border-zinc-700 px-2 py-1 text-[11px] text-zinc-300 hover:bg-zinc-800"
                    >
                      <Plug className="h-3 w-3" /> Nuovo arco da qui
                    </button>
                    {!selectedNode.is_composite && (
                      <button
                        onClick={() => makeComposite(selectedNode.id)}
                        className="rounded-md border border-zinc-700 px-2 py-1 text-[11px] text-zinc-300 hover:bg-zinc-800"
                        title="Trasforma in Circuito composito (puoi poi aggiungere azioni figlie)"
                      >
                        → Circuito
                      </button>
                    )}
                    <button
                      onClick={() => deleteNode(selectedNode.id)}
                      className="rounded-md border border-zinc-700 p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-rose-400"
                      title="Elimina nodo (e i suoi archi/figli)"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {selectedNode.cron_id && (
                  <p className="mb-3 flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-[11px] text-zinc-400">
                    ⏱ <span className="text-zinc-300">{selectedNode.cron_name}</span>
                    <span
                      className={
                        selectedNode.cron_role === "attivazione"
                          ? "text-orange-400"
                          : selectedNode.cron_role === "wrapped"
                            ? "text-violet-400"
                            : "text-zinc-500"
                      }
                    >
                      ({selectedNode.cron_role === "wrapped" ? "avvolto — cron reale, non nostro" : selectedNode.cron_role || "lettura"})
                    </span>
                  </p>
                )}

                {selectedNode.phase_gate_type && (
                  <p className="mb-3 rounded-md border border-amber-900/50 bg-amber-950/20 px-2 py-1.5 text-[11px] text-amber-300">
                    ⚖ Gate {selectedNode.phase_gate_type === "ai" ? "AI (arbitro)" : "umano (conferma manuale)"} —
                    autorità di validazione della sua Fase
                  </p>
                )}

                {selectedNode.process_key && (
                  <div className="mb-4 rounded-md border border-emerald-900 bg-emerald-950/20 p-3">
                    <p className="mb-2 text-xs font-medium text-emerald-300">
                      ⚙ Motore {selectedNode.process_key === "ai_analyze" ? "AIPO" : "IPO"}: {selectedNode.process_key}
                    </p>
                    {selectedNode.process_key === "ai_analyze" ? (
                      <div className="space-y-2">
                        <textarea
                          value={testPrompt}
                          onChange={(e) => setTestPrompt(e.target.value)}
                          placeholder="Prompt di test (tienilo breve per una risposta veloce)"
                          rows={3}
                          className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-200"
                        />
                        <button
                          onClick={() => runNodeProcess(selectedNode.id, selectedNode.process_key!)}
                          disabled={testRunning || !testPrompt.trim()}
                          className="flex w-full items-center justify-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-40"
                        >
                          <Play className="h-3 w-3" /> {testRunning ? "..." : "Test"}
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <input
                          value={testOrderId}
                          onChange={(e) => setTestOrderId(e.target.value)}
                          placeholder="ID erpv6.production.order"
                          className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-200"
                        />
                        <button
                          onClick={() => runNodeProcess(selectedNode.id, selectedNode.process_key!)}
                          disabled={testRunning || !testOrderId.trim()}
                          className="flex shrink-0 items-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-40"
                        >
                          <Play className="h-3 w-3" /> {testRunning ? "..." : "Test"}
                        </button>
                      </div>
                    )}
                    {selectedNode.last_execution && (
                      <div className="mt-2 rounded bg-zinc-950 p-2 text-[11px]">
                        <p
                          className={
                            selectedNode.last_execution.status === "done"
                              ? "text-emerald-400"
                              : selectedNode.last_execution.status === "failed"
                              ? "text-rose-400"
                              : "text-zinc-400"
                          }
                        >
                          {selectedNode.last_execution.status}
                        </p>
                        {selectedNode.last_execution.output_data && (
                          <pre className="mt-1 overflow-x-auto text-zinc-400">
                            {JSON.stringify(selectedNode.last_execution.output_data, null, 2)}
                          </pre>
                        )}
                        {selectedNode.last_execution.error_message && (
                          <p className="text-rose-400">{selectedNode.last_execution.error_message}</p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {needsKb(selectedNode) && (
                  <div className="mb-4">
                    <p className="mb-1 flex items-center gap-1 text-xs text-zinc-500">
                      KB collegata (prompt)
                      {!selectedNodeKbLink?.kb_id && (
                        <span className="flex items-center gap-1 text-rose-400">
                          <AlertTriangle className="h-3 w-3" /> mancante — l&apos;esecuzione si bloccherà
                        </span>
                      )}
                    </p>
                    <div className="flex gap-2">
                      <select
                        value={selectedNodeKbLink?.kb_id || ""}
                        onChange={(e) => e.target.value && setKbForSelectedNode(Number(e.target.value))}
                        className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-200"
                      >
                        <option value="">— nessuna —</option>
                        {kbCatalog.map((kb) => (
                          <option key={kb.id} value={kb.id}>
                            {kb.name}
                          </option>
                        ))}
                      </select>
                      {selectedNodeKbLink && (
                        <button
                          onClick={() => removeKbLink(selectedNodeKbLink.id)}
                          className="shrink-0 rounded-md border border-zinc-800 p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-rose-400"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    <p className="mt-1 text-[10px] text-zinc-600">
                      Catalogo limitato alle KB destinate ai sei giudici (categoria Prompts di Sistema).
                    </p>
                  </div>
                )}

                <div className="space-y-3">
                  <div>
                    <p className="mb-1 text-xs text-zinc-500">Archi in uscita</p>
                    <div className="space-y-1">
                      {selectedNodeOutArcs.map((a) => (
                        <ArcRow key={a.id} arc={a} data={data!} onToggle={toggleArc} onDelete={deleteArc} onSetMax={setMaxIterations} onInsert={insertNodeOnArc} />
                      ))}
                      {!selectedNodeOutArcs.length && <p className="text-[11px] text-zinc-600">Nessuno</p>}
                    </div>
                  </div>
                  <div>
                    <p className="mb-1 text-xs text-zinc-500">Archi in ingresso</p>
                    <div className="space-y-1">
                      {selectedNodeInArcs.map((a) => (
                        <ArcRow key={a.id} arc={a} data={data!} onToggle={toggleArc} onDelete={deleteArc} onSetMax={setMaxIterations} onInsert={insertNodeOnArc} />
                      ))}
                      {!selectedNodeInArcs.length && <p className="text-[11px] text-zinc-600">Nessuno</p>}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 text-xs text-zinc-500">
                Nessun nodo selezionato. Clicca un rettangolo nel disegno per gestirlo (KB, archi, nuovo
                collegamento).
              </div>
            )}

            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
              <h2 className="mb-3 text-sm font-semibold text-zinc-200">+ Nuovo Nodo</h2>
              <div className="space-y-2">
                <input
                  value={newNodeName}
                  onChange={(e) => setNewNodeName(e.target.value)}
                  placeholder="Nome azione/nodo"
                  className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-200"
                />
                <select
                  value={newNodeParentId}
                  onChange={(e) => setNewNodeParentId(e.target.value)}
                  className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-200"
                >
                  <option value="">— nel Circuito (radice) —</option>
                  {(data?.nodes || [])
                    .filter((n) => n.is_composite)
                    .map((n) => (
                      <option key={n.id} value={n.id}>
                        dentro: {n.name}
                      </option>
                    ))}
                </select>
                <label className="flex items-center gap-2 text-[11px] text-zinc-400">
                  <input
                    type="checkbox"
                    checked={newNodeComposite}
                    onChange={(e) => setNewNodeComposite(e.target.checked)}
                  />
                  È un Circuito (contiene altri nodi)
                </label>

                {newNodeComposite && (
                  <div>
                    <p className="mb-1 text-[11px] text-zinc-500">
                      Ruolo Circuito — Contenitore è solo un'etichetta, PID ha parametri obbligatori (il Gate è
                      un attributo a parte, vedi sotto)
                    </p>
                    <div className="flex gap-1">
                      {(
                        [
                          ["generico", "Contenitore"],
                          ["pid", "PID"],
                        ] as const
                      ).map(([val, label]) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setNewNodeCircuitRole(val)}
                          className={`flex-1 rounded-md border px-2 py-1 text-[11px] ${
                            newNodeCircuitRole === val
                              ? "border-emerald-500 bg-emerald-500/20 text-emerald-200"
                              : "border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {newNodeCircuitRole === "pid" && (
                  <div className="space-y-1 rounded-md border border-amber-900/50 bg-amber-950/20 p-2">
                    <p className="text-[11px] text-amber-300">
                      Trigger di attivazione (obbligatorio — senza, il PID resta un'etichetta, non un circuito
                      reale)
                    </p>
                    <select
                      value={newNodeCronTriggerKey}
                      onChange={(e) => setNewNodeCronTriggerKey(e.target.value)}
                      className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-200"
                    >
                      <option value="">— seleziona il trigger —</option>
                      {cronTriggersList.map((t) => (
                        <option key={t.key} value={t.key}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                    {selectedCronTrigger?.call_style === "recordset" && (
                      <input
                        value={newNodeCronDomain}
                        onChange={(e) => setNewNodeCronDomain(e.target.value)}
                        placeholder={`Dominio ricerca su ${selectedCronTrigger.model} (default [])`}
                        className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-200"
                      />
                    )}
                  </div>
                )}

                {showMotoreSelector && (
                  <div>
                    <p className="mb-1 text-[11px] text-zinc-500">Motore (senza logica il nodo non esegue nulla)</p>
                    <div className="flex gap-1">
                      {(
                        [
                          ["", "Nessuno"],
                          ["ipo", "Motore IPO"],
                          ["aipo", "Motore AIPO"],
                        ] as const
                      ).map(([val, label]) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setNewNodeFamily(val)}
                          className={`flex-1 rounded-md border px-2 py-1 text-[11px] ${
                            newNodeFamily === val
                              ? "border-violet-500 bg-violet-500/20 text-violet-200"
                              : "border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {showMotoreSelector && newNodeFamily && (
                  <select
                    value={newNodeProcessKey}
                    onChange={(e) => setNewNodeProcessKey(e.target.value)}
                    className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-200"
                  >
                    <option value="">— seleziona il motore nel codice —</option>
                    {familyProcesses.map((p) => (
                      <option key={p.key} value={p.key}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                )}
                {showMotoreSelector && gateTypeOptions.length > 0 && (
                  <div>
                    <p className="mb-1 text-[11px] text-amber-300">
                      ⚖ Tipo Gate Fase (opzionale — questo nodo diventa l'autorità di validazione della Fase
                      che lo contiene)
                    </p>
                    <div className="flex gap-1">
                      {([{ value: "", label: "Nessuno" }, ...gateTypeOptions] as const).map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setNewNodePhaseGateType(opt.value as "" | "umano" | "ai")}
                          className={`flex-1 rounded-md border px-2 py-1 text-[11px] ${
                            newNodePhaseGateType === opt.value
                              ? "border-amber-500 bg-amber-500/20 text-amber-200"
                              : "border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <button
                  onClick={createNode}
                  disabled={!canCreateNode}
                  className="w-full rounded-md bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-700 disabled:opacity-40"
                >
                  Crea nodo
                </button>
              </div>
            </div>

            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
              <h2 className="mb-3 text-sm font-semibold text-zinc-200">+ Nuova Fase</h2>
              <input
                value={newPhaseName}
                onChange={(e) => setNewPhaseName(e.target.value)}
                placeholder="Nome fase"
                className="mb-2 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-200"
              />
              <div className="mb-2 max-h-32 space-y-1 overflow-y-auto rounded-md border border-zinc-800 bg-zinc-950 p-2">
                {(data?.nodes || [])
                  .filter((n) => n.parent_id)
                  .map((n) => (
                    <label key={n.id} className="flex items-center gap-2 text-[11px] text-zinc-400">
                      <input
                        type="checkbox"
                        checked={newPhaseNodeIds.has(n.id)}
                        onChange={() => togglePhaseNode(n.id)}
                      />
                      {n.name}
                    </label>
                  ))}
              </div>
              <button
                onClick={createPhase}
                disabled={!newPhaseName.trim() || !newPhaseNodeIds.size}
                className="w-full rounded-md bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-700 disabled:opacity-40"
              >
                Crea Fase (riquadro)
              </button>
            </div>

            {CIRCUITS.find((c) => c.xmlid === circuitXmlid)?.hasRun ? (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
              <h2 className="mb-3 text-sm font-semibold text-zinc-200">Esegui su una voce KB reale</h2>
              <div className="flex gap-2">
                <input
                  value={kbId}
                  onChange={(e) => setKbId(e.target.value)}
                  className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-200"
                  placeholder="ID voce erpv6.kb"
                />
                <button
                  onClick={runCircuit}
                  disabled={running}
                  className="flex shrink-0 items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  <Play className={`h-3.5 w-3.5 ${running ? "animate-pulse" : ""}`} />
                  {running ? "In corso…" : "Esegui"}
                </button>
              </div>
              <p className="mt-2 text-[11px] text-zinc-600">
                Sincrono, chiamate AI vere: può richiedere alcuni minuti. Un nodo senza KB collegata
                blocca l&apos;esecuzione con un errore.
              </p>

              {runError && <p className="mt-3 text-xs text-rose-400">{runError}</p>}
              {runResult?.status === "human_gate_pending" && (
                <div className="mt-3 rounded-md border border-amber-800 bg-amber-950/30 p-3">
                  <p className="mb-2 text-xs text-amber-300">
                    Gate umano: i giudici non convergono, serve una decisione reale.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => decideGate(true)}
                      disabled={gateActing}
                      className="flex-1 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-40"
                    >
                      ✓ Approva
                    </button>
                    <button
                      onClick={() => decideGate(false)}
                      disabled={gateActing}
                      className="flex-1 rounded-md bg-rose-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-600 disabled:opacity-40"
                    >
                      ✕ Rifiuta
                    </button>
                  </div>
                </div>
              )}
              {runResult && (
                <div className="mt-3 space-y-2 text-xs">
                  <p className="text-zinc-300">
                    Run #{runResult.run_id} — <span className="font-mono">{runResult.status}</span>
                  </p>
                  <p className="text-zinc-400">
                    Sessione #{runResult.session_id} — {runResult.session_status}
                  </p>
                  <ul className="space-y-1">
                    {runResult.node_runs?.map((nr: any, i: number) => (
                      <li key={i} className="rounded bg-zinc-950 px-2 py-1 font-mono text-[11px]">
                        {nr.analyst_index || "?"}: {nr.outcome}
                        {nr.is_ai_failure ? " (fallimento tecnico AI)" : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            ) : (
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 text-xs text-zinc-500">
                Nessun avvio reale collegato a questo circuito nel pilota — solo lettura/modifica della
                struttura (KB, archi, Fasi).
              </div>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}

function ArcRow({
  arc,
  data,
  onToggle,
  onDelete,
  onSetMax,
  onInsert,
}: {
  arc: ApiArc;
  data: CircuitData;
  onToggle: (id: number) => void;
  onDelete: (id: number) => void;
  onSetMax: (id: number, value: number) => void;
  onInsert: (id: number) => void;
}) {
  const source = data.nodes.find((n) => n.id === arc.source_node_id);
  const target = data.nodes.find((n) => n.id === arc.target_node_id);
  return (
    <div
      className={`rounded-md border px-2 py-1.5 text-[11px] ${
        arc.active ? "border-zinc-800 bg-zinc-950 text-zinc-300" : "border-zinc-900 bg-zinc-950/50 text-zinc-600"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <button onClick={() => onToggle(arc.id)} className="flex-1 text-left hover:text-zinc-100">
          {source?.name} → {target?.name}{" "}
          <span className="text-zinc-500">({ACTION_TYPE_LABEL[arc.action_type] || arc.action_type})</span>
        </button>
        <button
          onClick={() => onInsert(arc.id)}
          className="shrink-0 text-zinc-600 hover:text-emerald-400"
          title="Inserisci un nodo qui in mezzo (un solo passaggio, atomico)"
        >
          +
        </button>
        <button onClick={() => onDelete(arc.id)} className="shrink-0 text-zinc-600 hover:text-rose-400">
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
      {arc.action_type === "retry_loop" && (
        <div className="mt-1 flex items-center gap-1.5 text-zinc-500">
          <span>Max loop:</span>
          <input
            type="number"
            min={1}
            defaultValue={arc.max_iterations}
            onBlur={(e) => onSetMax(arc.id, Number(e.target.value))}
            className="w-14 rounded border border-zinc-800 bg-zinc-900 px-1 py-0.5 text-zinc-200"
          />
        </div>
      )}
    </div>
  );
}
