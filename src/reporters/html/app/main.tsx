import { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";

import type { AnalysisJsonFile, AnalysisJsonFinding } from "../../analysis-json/index.js";

import "./styles.css";

declare global {
  interface Window {
    __ARCOVIA_ANALYSIS__?: AnalysisJsonFile;
  }
}

const SEVERITIES = ["critical", "error", "warning", "info"] as const;
type Severity = (typeof SEVERITIES)[number];
type Page = "dashboard" | "findings" | "graph" | "metrics" | "recommendations";
type GraphView = "graph" | "list";
type AnalysisGraphNode = AnalysisJsonFile["graph"]["nodes"][number];

interface GraphGroup {
  readonly id: string;
  readonly kind: "external" | "missing" | "user";
  readonly label: string;
  readonly nodes: readonly AnalysisGraphNode[];
}

interface PositionedGraphGroup {
  readonly group: GraphGroup;
  readonly x: number;
  readonly y: number;
}

function severityRank(severity: Severity): number {
  return SEVERITIES.indexOf(severity);
}

function App({ analysis }: { readonly analysis: AnalysisJsonFile }) {
  const [page, setPage] = useState<Page>("dashboard");
  const [query, setQuery] = useState("");
  const [severity, setSeverity] = useState<Severity | "all">("all");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const findings = useMemo(
    () =>
      analysis.findings
        .filter((finding) => {
          const text = [
            finding.ruleId,
            finding.title,
            finding.description,
            finding.recommendation,
            finding.location.file,
          ]
            .join(" ")
            .toLowerCase();
          return (
            (severity === "all" || finding.severity === severity) &&
            text.includes(query.toLowerCase())
          );
        })
        .sort(
          (left, right) =>
            severityRank(left.severity) - severityRank(right.severity) ||
            left.ruleId.localeCompare(right.ruleId) ||
            left.location.file.localeCompare(right.location.file) ||
            left.location.line - right.location.line,
        ),
    [analysis.findings, query, severity],
  );
  const pages: readonly { readonly id: Page; readonly label: string }[] = [
    { id: "dashboard", label: "Overview" },
    { id: "findings", label: "Findings" },
    { id: "graph", label: "Dependency graph" },
    { id: "metrics", label: "Metrics" },
    { id: "recommendations", label: "Recommendations" },
  ];

  return (
    <main className="shell" data-theme={theme}>
      <aside className="rail" aria-label="Report navigation">
        <div className="brand">
          <span>arcovia</span>
          <small>architecture observatory</small>
        </div>
        <nav>
          {pages.map((item) => (
            <button
              className={page === item.id ? "nav active" : "nav"}
              key={item.id}
              onClick={() => setPage(item.id)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </nav>
        <footer>
          AAF {analysis.metadata.version}
          <br />
          {analysis.metadata.generatedAt}
        </footer>
      </aside>
      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">
              {analysis.project.framework} · {analysis.project.workspace}
            </p>
            <h1>{analysis.project.name}</h1>
          </div>
          <section
            className="score-chip"
            aria-label={`Architecture score ${analysis.score.overall}, grade ${analysis.score.grade}`}
          >
            <strong>{analysis.score.overall}</strong>
            <span>{analysis.score.grade}</span>
          </section>
          <label className="search">
            <span>Search</span>
            <input
              onChange={(event) => setQuery(event.target.value)}
              placeholder="rules, files, recommendations"
              value={query}
            />
          </label>
          <button
            aria-label="Toggle color theme"
            className="theme-toggle"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            type="button"
          >
            {theme === "dark" ? "Light" : "Dark"}
          </button>
        </header>
        <section className="content">
          {page === "dashboard" && (
            <Dashboard analysis={analysis} onCategory={() => setPage("findings")} />
          )}
          {page === "findings" && (
            <Findings findings={findings} severity={severity} setSeverity={setSeverity} />
          )}
          {page === "graph" && <Graph analysis={analysis} />}
          {page === "metrics" && <Metrics analysis={analysis} />}
          {page === "recommendations" && <Recommendations analysis={analysis} />}
        </section>
      </section>
    </main>
  );
}

function Dashboard({
  analysis,
  onCategory,
}: {
  readonly analysis: AnalysisJsonFile;
  readonly onCategory: () => void;
}) {
  return (
    <>
      <section className="hero">
        <p className="eyebrow">ARCHITECTURE HEALTH</p>
        <div>
          <span className="score-number">{analysis.score.overall}</span>
          <span className="out-of">/100</span>
        </div>
        <h2>Grade {analysis.score.grade}</h2>
        <p>
          {analysis.score.overall >= 75
            ? "A resilient foundation with focused opportunities."
            : "Structural debt needs focused attention."}
        </p>
      </section>
      <section className="stat-grid" aria-label="Project summary">
        <Stat label="Findings" value={analysis.summary.totalFindings} />
        <Stat label="Files" value={analysis.project.sourceFiles} />
        <Stat label="Modules" value={analysis.metrics.modules} />
        <Stat label="Dependencies" value={analysis.metrics.dependencies} />
      </section>
      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">SIGNAL MAP</p>
            <h2>Category health</h2>
          </div>
          <button onClick={onCategory} type="button">
            Explore findings →
          </button>
        </div>
        <div className="category-grid">
          {analysis.score.categories.map((category) => (
            <button className="category" key={category.category} onClick={onCategory} type="button">
              <span>{category.category}</span>
              <strong>{category.score}</strong>
              <i>
                <b style={{ width: `${category.score}%` }} />
              </i>
            </button>
          ))}
        </div>
      </section>
      <section className="two-column">
        <section className="panel">
          <p className="eyebrow">TOP RISKS</p>
          {analysis.findings
            .slice()
            .sort((a, b) => severityRank(a.severity) - severityRank(b.severity))
            .slice(0, 4)
            .map((finding) => (
              <div className="risk" key={finding.id}>
                <Badge severity={finding.severity} />
                <div>
                  <strong>{finding.title}</strong>
                  <small>
                    {finding.location.file}:{finding.location.line}
                  </small>
                </div>
              </div>
            ))}
        </section>
        <section className="panel">
          <p className="eyebrow">EXECUTION</p>
          <dl>
            <dt>Analysis duration</dt>
            <dd>{formatDuration(analysis.metadata.duration)}</dd>
            <dt>Framework</dt>
            <dd>{analysis.project.framework}</dd>
            <dt>Package manager</dt>
            <dd>{analysis.project.packageManager}</dd>
            <dt>Confidence</dt>
            <dd>{Math.round(analysis.score.metadata.confidence.value * 100)}%</dd>
          </dl>
        </section>
      </section>
    </>
  );
}

function Findings({
  findings,
  severity,
  setSeverity,
}: {
  readonly findings: readonly AnalysisJsonFinding[];
  readonly severity: Severity | "all";
  readonly setSeverity: (value: Severity | "all") => void;
}) {
  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">FINDINGS EXPLORER</p>
          <h2>{findings.length} matching signals</h2>
        </div>
        <div className="filters">
          {(["all", ...SEVERITIES] as const).map((value) => (
            <button
              className={severity === value ? "selected" : ""}
              key={value}
              onClick={() => setSeverity(value)}
              type="button"
            >
              {value}
            </button>
          ))}
        </div>
      </div>
      <section className="findings">
        {findings.slice(0, 250).map((finding) => (
          <FindingCard finding={finding} key={finding.id} />
        ))}
        {findings.length > 250 && (
          <p className="notice">
            Showing the first 250 results. Refine your search to focus the explorer.
          </p>
        )}
      </section>
    </>
  );
}

function FindingCard({ finding }: { readonly finding: AnalysisJsonFinding }) {
  return (
    <article className="finding">
      <div>
        <Badge severity={finding.severity} />
        <span className="rule">{finding.ruleId}</span>
      </div>
      <h3>{finding.title}</h3>
      <p>{finding.description}</p>
      <dl>
        <dt>Location</dt>
        <dd>
          {finding.location.file}:{finding.location.line}
        </dd>
        <dt>Recommendation</dt>
        <dd>{finding.recommendation}</dd>
        {finding.evidence.length > 0 && (
          <>
            <dt>Evidence</dt>
            <dd>
              {finding.evidence
                .map((evidence) => `${evidence.metric}: ${String(evidence.actual)}`)
                .join(" · ")}
            </dd>
          </>
        )}
      </dl>
    </article>
  );
}
function Graph({ analysis }: { readonly analysis: AnalysisJsonFile }) {
  const [view, setView] = useState<GraphView>("graph");
  const [selectedGroupId, setSelectedGroupId] = useState<string | undefined>();
  const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>();
  const [isFocused, setIsFocused] = useState(false);
  const groups = useMemo(() => createGraphGroups(analysis.graph.nodes), [analysis.graph.nodes]);
  const groupByNodeId = useMemo(
    () => new Map(groups.flatMap((group) => group.nodes.map((node) => [node.id, group.id]))),
    [groups],
  );
  const positionedGroups = useMemo(() => layoutGroups(groups), [groups]);
  const positionsByGroupId = useMemo(
    () => new Map(positionedGroups.map((positioned) => [positioned.group.id, positioned])),
    [positionedGroups],
  );
  const groupEdges = useMemo(
    () => createGroupEdges(analysis.graph.edges, groupByNodeId),
    [analysis.graph.edges, groupByNodeId],
  );
  const selectedGroup = groups.find((group) => group.id === selectedGroupId);
  const selectedNode = selectedGroup?.nodes.find((node) => node.id === selectedNodeId);
  const selectedNodeEdges = selectedNodeId
    ? analysis.graph.edges.filter(
        (edge) => edge.source === selectedNodeId || edge.target === selectedNodeId,
      )
    : [];

  const selectGroup = (groupId: string): void => {
    setSelectedGroupId(groupId);
    setSelectedNodeId(undefined);
    setIsFocused(false);
  };

  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">DEPENDENCY MAP</p>
          <h2>
            {analysis.graph.nodes.length} nodes · {analysis.graph.edges.length} edges
          </h2>
        </div>
        <fieldset className="view-switch">
          <legend>Dependency graph view</legend>
          <button
            aria-pressed={view === "graph"}
            className={view === "graph" ? "selected" : ""}
            onClick={() => setView("graph")}
            type="button"
          >
            Graph view
          </button>
          <button
            aria-pressed={view === "list"}
            className={view === "list" ? "selected" : ""}
            onClick={() => setView("list")}
            type="button"
          >
            List view
          </button>
        </fieldset>
      </div>
      {view === "graph" ? (
        <section className="dependency-map">
          <svg
            aria-label="Grouped dependency graph. Select a group to inspect its modules."
            className="dependency-canvas"
            role="img"
            viewBox="0 0 1180 680"
          >
            <defs>
              <marker
                id="dependency-arrow"
                markerHeight="6"
                markerWidth="6"
                orient="auto-start-reverse"
                refX="7"
                refY="3"
              >
                <path className="graph-arrow" d="M0,0 L0,6 L7,3 z" />
              </marker>
            </defs>
            {groupEdges.map((edge) => {
              const source = positionsByGroupId.get(edge.source);
              const target = positionsByGroupId.get(edge.target);
              if (source === undefined || target === undefined) return null;
              const isConnectedToSelection =
                selectedGroupId === edge.source || selectedGroupId === edge.target;
              return (
                <line
                  className={
                    isFocused && !isConnectedToSelection
                      ? "graph-edge dimmed"
                      : isConnectedToSelection
                        ? "graph-edge selected"
                        : "graph-edge"
                  }
                  key={edge.id}
                  markerEnd="url(#dependency-arrow)"
                  strokeWidth={Math.min(4, 1 + edge.count / 2)}
                  x1={source.x + 70}
                  x2={target.x + 70}
                  y1={source.y + 32}
                  y2={target.y + 32}
                />
              );
            })}
            {positionedGroups.map((positioned) => {
              const { group } = positioned;
              const isSelected = group.id === selectedGroupId;
              return (
                <foreignObject
                  className={isFocused && !isSelected ? "graph-group dimmed" : "graph-group"}
                  height="64"
                  key={group.id}
                  width="140"
                  x={positioned.x}
                  y={positioned.y}
                >
                  <button
                    aria-pressed={isSelected}
                    className={`graph-group-button ${group.kind} ${isSelected ? "selected" : ""}`}
                    onClick={() => selectGroup(group.id)}
                    type="button"
                  >
                    <span>{group.label}</span>
                    <small>
                      {group.nodes.length} {group.kind === "external" ? "packages" : "modules"}
                    </small>
                  </button>
                </foreignObject>
              );
            })}
          </svg>
          <aside className="graph-inspector">
            {selectedGroup === undefined ? (
              <>
                <p>Select a group to inspect its modules and direct dependencies.</p>
                <dl>
                  <dt>Blue</dt>
                  <dd>User code groups</dd>
                  <dt>Amber</dt>
                  <dd>External packages</dd>
                  <dt>Red</dt>
                  <dd>Unresolved imports</dd>
                </dl>
              </>
            ) : (
              <>
                <p className="eyebrow">SELECTED GROUP</p>
                <h3>{selectedGroup.label}</h3>
                <button
                  className={isFocused ? "focus-toggle selected" : "focus-toggle"}
                  onClick={() => setIsFocused(!isFocused)}
                  type="button"
                >
                  {isFocused ? "Show all groups" : "Focus connections"}
                </button>
                <div className="module-picker">
                  {selectedGroup.nodes.map((node) => (
                    <button
                      className={node.id === selectedNodeId ? "selected" : ""}
                      key={node.id}
                      onClick={() => setSelectedNodeId(node.id)}
                      type="button"
                    >
                      {node.label}
                    </button>
                  ))}
                </div>
                {selectedNode !== undefined && (
                  <section className="node-details">
                    <strong>{selectedNode.label}</strong>
                    <small>{selectedNode.path}</small>
                    <p>{selectedNodeEdges.length} direct connections</p>
                  </section>
                )}
              </>
            )}
          </aside>
        </section>
      ) : (
        <section className="graph-list">
          {groups.map((group) => (
            <article key={group.id}>
              <span className={`node-dot ${group.kind === "external" ? "package" : group.kind}`} />
              <div>
                <strong>{group.label}</strong>
                <small>{group.nodes.map((node) => node.path).join(" · ")}</small>
              </div>
              <em>{group.nodes.length} nodes</em>
            </article>
          ))}
        </section>
      )}
    </>
  );
}

function createGraphGroups(nodes: readonly AnalysisGraphNode[]): readonly GraphGroup[] {
  const groups = new Map<string, AnalysisGraphNode[]>();
  for (const node of nodes) {
    const group = groupForNode(node);
    groups.set(group.id, [...(groups.get(group.id) ?? []), node]);
  }
  return [...groups].map(([id, groupedNodes]) => {
    const descriptor = groupForNode(groupedNodes[0] as AnalysisGraphNode);
    return {
      ...descriptor,
      id,
      nodes: groupedNodes.sort((left, right) => left.label.localeCompare(right.label)),
    };
  });
}

function groupForNode(node: AnalysisGraphNode): Omit<GraphGroup, "nodes"> {
  if (node.type === "package") {
    return { id: "external-packages", kind: "external", label: "External packages" };
  }
  if (node.type === "missing") {
    return { id: "unresolved-imports", kind: "missing", label: "Unresolved imports" };
  }
  const segments = node.path.split("/");
  const root = segments[0] === "src" && segments.length > 1 ? `src/${segments[1]}` : segments[0];
  return { id: `user:${root}`, kind: "user", label: root || "User code" };
}

function createGroupEdges(
  edges: readonly AnalysisJsonFile["graph"]["edges"][number][],
  groupByNodeId: ReadonlyMap<string, string>,
): readonly {
  readonly count: number;
  readonly id: string;
  readonly source: string;
  readonly target: string;
}[] {
  const grouped = new Map<
    string,
    { readonly count: number; readonly source: string; readonly target: string }
  >();
  for (const edge of edges) {
    const source = groupByNodeId.get(edge.source);
    const target = groupByNodeId.get(edge.target);
    if (source === undefined || target === undefined || source === target) continue;
    const id = `${source}\u0000${target}`;
    const existing = grouped.get(id);
    grouped.set(id, { count: (existing?.count ?? 0) + 1, source, target });
  }
  return [...grouped].map(([id, edge]) => ({ ...edge, id }));
}

function layoutGroups(groups: readonly GraphGroup[]): readonly PositionedGraphGroup[] {
  const userGroups = groups.filter((group) => group.kind === "user");
  const specialGroups = groups.filter((group) => group.kind !== "user");
  const userPositions = userGroups.map((group, index) => ({
    group,
    x: 60 + (index % 3) * 250,
    y: 95 + Math.floor(index / 3) * 145,
  }));
  const specialPositions = specialGroups.map((group, index) => ({
    group,
    x: 895,
    y: 130 + index * 180,
  }));
  return [...userPositions, ...specialPositions];
}
function Metrics({ analysis }: { readonly analysis: AnalysisJsonFile }) {
  const metrics = Object.entries(analysis.metrics);
  return (
    <>
      <p className="eyebrow">MEASUREMENTS</p>
      <h2>Project profile</h2>
      <section className="metric-grid">
        {metrics.map(([name, value]) => (
          <Stat key={name} label={name.replace(/([A-Z])/gu, " $1")} value={value} />
        ))}
      </section>
    </>
  );
}
function Recommendations({ analysis }: { readonly analysis: AnalysisJsonFile }) {
  return (
    <>
      <p className="eyebrow">PRIORITY ACTIONS</p>
      <h2>Recommended next moves</h2>
      <ol className="recommendations">
        {[...new Set(analysis.findings.map((finding) => finding.recommendation))]
          .slice(0, 6)
          .map((recommendation) => (
            <li key={recommendation}>{recommendation}</li>
          ))}
      </ol>
    </>
  );
}
function Stat({ label, value }: { readonly label: string; readonly value: string | number }) {
  return (
    <article className="stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}
function Badge({ severity }: { readonly severity: Severity }) {
  return <span className={`badge ${severity}`}>{severity}</span>;
}
function formatDuration(duration: number): string {
  return duration >= 1000 ? `${(duration / 1000).toFixed(1)}s` : `${duration}ms`;
}

const analysis = window.__ARCOVIA_ANALYSIS__;
if (!analysis) throw new Error("Arcovia report data is missing.");
const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Arcovia report root is missing.");
createRoot(rootElement).render(<App analysis={analysis} />);
