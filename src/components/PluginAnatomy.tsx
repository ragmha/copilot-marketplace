import { useEffect, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

type Tone = "default" | "accent" | "muted";

type BoxData = {
  title: string;
  subtitle?: string;
  tone?: Tone;
};

const toneClass: Record<Tone, string> = {
  default: "border-border bg-card text-card-foreground",
  accent: "border-primary/40 bg-primary/10 text-card-foreground",
  muted: "border-dashed border-border bg-background text-muted-foreground",
};

function Box({ data }: NodeProps & { data: BoxData }) {
  return (
    <div
      className={`h-full w-full rounded-md border px-3 py-2 text-left ${toneClass[data.tone ?? "default"]}`}
    >
      <Handle type="target" position={Position.Left} className="!opacity-0" />
      <p className="text-[11px] leading-tight font-bold tracking-tight">{data.title}</p>
      {data.subtitle && (
        <p className="mt-1 text-[10px] leading-snug text-muted-foreground">{data.subtitle}</p>
      )}
      <Handle type="source" position={Position.Right} className="!opacity-0" />
    </div>
  );
}

function Boundary({ data }: NodeProps & { data: BoxData }) {
  return (
    <div className="h-full w-full rounded-lg border-2 border-foreground/25 bg-muted/40 p-3">
      <Handle type="target" position={Position.Left} className="!opacity-0" />
      <p className="text-[11px] font-bold tracking-tight text-foreground">{data.title}</p>
      {data.subtitle && <p className="text-[10px] text-muted-foreground">{data.subtitle}</p>}
      <Handle type="source" position={Position.Right} className="!opacity-0" />
    </div>
  );
}

const nodeTypes = { box: Box, boundary: Boundary } as never;

// Laid out to fit a ~1040 x 372 canvas so the diagram reads at 1:1 on a
// desktop viewport instead of relying on zoom.
const GROUP_X = 250;
const GROUP_W = 520;
const CLIENT_X = 820;

const capabilities = [
  { id: "skills", title: "skills/", subtitle: "Reusable instructions the agent can follow." },
  { id: "agents", title: "agents/", subtitle: "Specialised roles, models, and tool access." },
  { id: "commands", title: "commands/", subtitle: "Slash-command entry points." },
  { id: "mcp", title: ".mcp.json", subtitle: "Connections to external tools and data." },
] as const;

const clients = [
  { id: "cli", title: "Copilot CLI", subtitle: "copilot plugin install" },
  { id: "app", title: "Copilot app", subtitle: "Customize → Plugins" },
  { id: "vscode", title: "VS Code", subtitle: "chat.plugins.enabled" },
  { id: "cloud", title: "Cloud agent", subtitle: ".github/copilot/settings.json" },
] as const;

const nodes: Node[] = [
  {
    id: "marketplace",
    type: "box",
    position: { x: 0, y: 148 },
    width: 200,
    height: 76,
    data: {
      title: "marketplace.json",
      subtitle: "The catalog. Lists every plugin and its version.",
      tone: "accent",
    } satisfies BoxData,
  },

  // The boundary is the point of the diagram: everything inside ships together.
  {
    id: "directory",
    type: "boundary",
    position: { x: GROUP_X, y: 0 },
    width: GROUP_W,
    height: 372,
    data: {
      title: "ONE PLUGIN",
      subtitle: "A directory that ships as a unit",
    } satisfies BoxData,
  },
  {
    id: "manifest",
    type: "box",
    parentId: "directory",
    extent: "parent",
    position: { x: 20, y: 54 },
    width: 480,
    height: 58,
    data: {
      title: "plugin.json  ·  required",
      subtitle: "name · version · metadata · component paths",
      tone: "accent",
    } satisfies BoxData,
  },
  ...capabilities.map((entry, index) => ({
    id: entry.id,
    type: "box",
    parentId: "directory",
    extent: "parent" as const,
    position: { x: 20 + (index % 2) * 248, y: 128 + Math.floor(index / 2) * 88 },
    width: 232,
    height: 72,
    data: { title: entry.title, subtitle: entry.subtitle } satisfies BoxData,
  })),
  {
    id: "extras",
    type: "box",
    parentId: "directory",
    extent: "parent",
    position: { x: 20, y: 304 },
    width: 480,
    height: 50,
    data: {
      title: "hooks.json · lsp.json · com.github.copilot/ · scripts",
      tone: "muted",
    } satisfies BoxData,
  },

  ...clients.map((entry, index) => ({
    id: entry.id,
    type: "box",
    position: { x: CLIENT_X, y: 8 + index * 92 },
    width: 220,
    height: 72,
    data: { title: entry.title, subtitle: entry.subtitle, tone: "accent" } satisfies BoxData,
  })),
];

const arrow = { type: MarkerType.ArrowClosed, width: 14, height: 14 };

const edges: Edge[] = [
  {
    id: "install",
    source: "marketplace",
    target: "directory",
    label: "install",
    animated: true,
    markerEnd: arrow,
  },
  ...clients.map((client, index) => ({
    id: `loads-${client.id}`,
    source: "manifest",
    target: client.id,
    label: index === 0 ? "loads into" : undefined,
    markerEnd: arrow,
  })),
];

/** Mirrors the `.dark` class the layout sets before paint. */
function useColorMode() {
  const [mode, setMode] = useState<"light" | "dark">("light");

  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setMode(root.classList.contains("dark") ? "dark" : "light");
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return mode;
}

export default function PluginAnatomy() {
  const colorMode = useColorMode();

  return (
    <div className="h-[420px] w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        colorMode={colorMode}
        fitView
        fitViewOptions={{ padding: 0.06 }}
        minZoom={0.3}
        maxZoom={1}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
        preventScrolling={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={18} size={1} />
      </ReactFlow>
    </div>
  );
}
