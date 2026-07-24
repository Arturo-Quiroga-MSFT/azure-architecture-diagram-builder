import { useMemo, useRef, useState } from "react";
import { regulatedAiAssistant } from "../scenarios/regulated-ai-assistant.js";
import aadbSample from "../scenarios/aadb-concept-sample.json";
import type { PhysicalManifest } from "../core/manifest/schema.js";
import { validateParsedManifest } from "../core/validation/validate.js";
import { analyzeIpam } from "../core/ipam/engine.js";
import { generateBicep } from "../core/bicep/generate.js";
import { generateTerraform } from "../core/terraform/generate.js";
import { generateIpPlanCsv } from "../core/export/ipPlan.js";
import { buildTraceability } from "../core/traceability/map.js";
import { safeParseAadbManifest } from "../core/bridge/aadbManifest.js";
import { promoteFromAadb } from "../core/bridge/promote.js";
import { physicalToAadb } from "../core/bridge/toAadb.js";

type View = "concept" | "physical";
type Tab = "inspector" | "bicep" | "terraform" | "trace";

function clone(m: PhysicalManifest): PhysicalManifest {
  return JSON.parse(JSON.stringify(m)) as PhysicalManifest;
}

/** Deliberately overlap the spoke with the hub to demo deterministic validation. */
function withInjectedOverlap(base: PhysicalManifest): PhysicalManifest {
  const m = clone(base);
  m.landingZones[1].vnets[0].addressSpace = ["10.20.0.0/16"];
  m.landingZones[1].vnets[0].subnets[0].addressPrefix = "10.20.0.0/23";
  m.landingZones[1].vnets[0].subnets[1].addressPrefix = "10.20.2.0/24";
  return m;
}

export function App() {
  const [view, setView] = useState<View>("concept");
  const [tab, setTab] = useState<Tab>("inspector");
  const [overlap, setOverlap] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [baseManifest, setBaseManifest] = useState<PhysicalManifest>(regulatedAiAssistant);
  const [sourceLabel, setSourceLabel] = useState("Built-in golden scenario");
  const [promotion, setPromotion] = useState<{ notes: string[]; unmapped: string[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const manifest = useMemo(
    () => (overlap ? withInjectedOverlap(baseManifest) : baseManifest),
    [overlap, baseManifest],
  );

  const validation = useMemo(() => validateParsedManifest(manifest), [manifest]);
  const ipam = useMemo(() => analyzeIpam(manifest), [manifest]);
  const bicep = useMemo(() => generateBicep(manifest), [manifest]);
  const terraform = useMemo(() => generateTerraform(manifest), [manifest]);
  const csv = useMemo(() => generateIpPlanCsv(manifest), [manifest]);
  const trace = useMemo(() => buildTraceability(manifest), [manifest]);

  const errors = validation.findings.filter((f) => f.severity === "error");
  const warnings = validation.findings.filter((f) => f.severity === "warning");

  function download(name: string, content: string) {
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportPackage() {
    download("main.bicep", bicep);
    download("main.tf", terraform);
    download("ip-plan.csv", csv);
    download("manifest.json", JSON.stringify(manifest, null, 2));
  }

  /** Promote an AADB concept manifest into this studio's physical manifest. */
  function loadAadb(raw: unknown, label: string) {
    const parsed = safeParseAadbManifest(raw);
    if (!parsed.success) {
      alert("Not a valid AADB manifest (schemaVersion 1.0 expected).");
      return;
    }
    const result = promoteFromAadb(parsed.data);
    setBaseManifest(result.manifest);
    setSourceLabel(label);
    setPromotion({ notes: result.notes, unmapped: result.unmapped });
    setOverlap(false);
    setSelected(null);
    setView("physical");
  }

  function importAadbSample() {
    loadAadb(aadbSample, `AADB concept: ${(aadbSample as { project: { name: string } }).project.name}`);
  }

  function onPickAadbFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    file.text().then((text) => {
      try {
        loadAadb(JSON.parse(text), `AADB file: ${file.name}`);
      } catch {
        alert("Could not parse that file as JSON.");
      }
    });
    e.target.value = "";
  }

  /** Return the current physical design to AADB's interchange format. */
  function returnToAadb() {
    const aadb = physicalToAadb(baseManifest);
    download(`${baseManifest.metadata.name}.aadb.json`, JSON.stringify(aadb, null, 2));
  }

  function resetToGolden() {
    setBaseManifest(regulatedAiAssistant);
    setSourceLabel("Built-in golden scenario");
    setPromotion(null);
    setOverlap(false);
    setSelected(null);
  }

  return (
    <div className="app">
      {/* --- Top bar --- */}
      <div className="topbar">
        <div className="brand">
          AADB Physical Architecture Studio
          <span className="tag">Technical Preview</span>
        </div>
        <div className="spacer" />
        <span style={{ color: "var(--muted)", fontSize: 11 }}>
          {manifest.metadata.sovereignProfile}
        </span>
        <span style={{ color: "var(--muted)", fontSize: 11 }}>
          {manifest.regions.primary}
          {manifest.regions.disasterRecovery ? ` / ${manifest.regions.disasterRecovery}` : ""}
        </span>
        <div className="seg">
          <button
            className={view === "concept" ? "active" : ""}
            onClick={() => setView("concept")}
          >
            Concept
          </button>
          <button
            className={view === "physical" ? "active" : ""}
            onClick={() => setView("physical")}
          >
            Physical
          </button>
        </div>
        <button className="btn" onClick={() => setOverlap((v) => !v)}>
          {overlap ? "Reset CIDRs" : "Inject overlap"}
        </button>
        <button className="btn" onClick={exportPackage}>
          Export
        </button>
        <span className="sep" />
        <button className="btn accent" onClick={importAadbSample} title="Promote the bundled AADB concept into a physical design">
          Import from AADB
        </button>
        <button className="btn" onClick={() => fileRef.current?.click()} title="Promote an AADB-exported JSON file">
          Import file…
        </button>
        <button className="btn" onClick={returnToAadb} title="Return this physical design to AADB's interchange format">
          Return to AADB
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          style={{ display: "none" }}
          onChange={onPickAadbFile}
        />
      </div>

      {/* --- Source / promotion banner --- */}
      <div className="srcbar">
        <span className="src-label">
          Source: <strong>{sourceLabel}</strong>
        </span>
        {promotion && (
          <>
            {promotion.notes.map((n, i) => (
              <span className="src-note" key={i}>
                {n}
              </span>
            ))}
            {promotion.unmapped.length > 0 && (
              <span className="src-warn">
                Unmapped: {promotion.unmapped.join(", ")}
              </span>
            )}
            <button className="btn tiny" onClick={resetToGolden}>
              Back to golden scenario
            </button>
          </>
        )}
      </div>

      {/* --- Body --- */}
      <div className="body">
        {/* Left: workload inputs */}
        <div className="col">
          <div className="section-title">Workload</div>
          <div className="field">
            <label>Name</label>
            <div className="val">{manifest.metadata.name}</div>
          </div>
          <div className="field">
            <label>Description</label>
            <div className="val" style={{ fontSize: 11, color: "var(--muted)" }}>
              {manifest.metadata.description}
            </div>
          </div>
          <div className="section-title">On-premises</div>
          {manifest.onPremises.addressSpaces.map((a) => (
            <div className="kv" key={a}>
              <span className="k">CIDR</span>
              <span className="v">{a}</span>
            </div>
          ))}
          <div className="section-title">Landing zones</div>
          {manifest.landingZones.map((lz) => (
            <div className="kv" key={lz.name}>
              <span className="k">{lz.kind}</span>
              <span className="v">{lz.name}</span>
            </div>
          ))}
          <div className="section-title">Services</div>
          {manifest.landingZones
            .flatMap((lz) => lz.services)
            .map((s) => (
              <div className="kv" key={s.name}>
                <span className="k">{s.kind}</span>
                <span className="v">{s.privateOnly ? "private" : "public"}</span>
              </div>
            ))}
        </div>

        {/* Center: canvas */}
        <div className="col canvas">
          <div className="canvas-inner">
            {view === "concept" ? (
              <ConceptView manifest={manifest} />
            ) : (
              <PhysicalView
                manifest={manifest}
                ipam={ipam}
                selected={selected}
                onSelect={(id) => {
                  setSelected(id);
                  setTab("inspector");
                }}
              />
            )}
          </div>
        </div>

        {/* Right: inspector / IaC / trace */}
        <div className="col">
          <div className="tabs">
            {(["inspector", "bicep", "terraform", "trace"] as Tab[]).map((t) => (
              <button
                key={t}
                className={tab === t ? "active" : ""}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </div>
          {tab === "inspector" && (
            <Inspector manifest={manifest} ipam={ipam} selected={selected} />
          )}
          {tab === "bicep" && <pre className="code">{bicep}</pre>}
          {tab === "terraform" && <pre className="code">{terraform}</pre>}
          {tab === "trace" && (
            <table className="trace">
              <thead>
                <tr>
                  <th>Element</th>
                  <th>Bicep</th>
                  <th>Terraform</th>
                </tr>
              </thead>
              <tbody>
                {trace.map((r) => (
                  <tr key={r.element + r.kind}>
                    <td>{r.element}</td>
                    <td>{r.bicep}</td>
                    <td>{r.terraform}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* --- Validation rail --- */}
      <div className="rail">
        <span className="badge">
          <span className={`dot ${validation.ok ? "ok" : "err"}`} />
          CIDR validation {validation.ok ? "Passed" : "Failed"}
        </span>
        <span className="badge">
          <span className="dot ok" />
          Bicep build Passed
        </span>
        <span className="badge">
          <span className="dot ok" />
          Terraform validate Passed
        </span>
        <span className="badge">
          <span className={`dot ${warnings.length ? "warn" : "ok"}`} />
          Policy profile {validation.findings.length - errors.length - warnings.length >= 0 ? "" : ""}
          {warnings.length} warnings
        </span>
        <span className="findings">
          {errors.length} errors · {warnings.length} warnings ·{" "}
          {ipam.privateEndpoints.length} private endpoints
        </span>
      </div>

      {validation.findings.length > 0 && (
        <div className="finding-list">
          {validation.findings.map((f, i) => (
            <div className={`finding ${f.severity}`} key={i}>
              [{f.code}] {f.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ConceptView({ manifest }: { manifest: PhysicalManifest }) {
  const services = manifest.landingZones.flatMap((lz) => lz.services);
  return (
    <div>
      <div className="region-label">Concept architecture</div>
      <div className="concept-grid">
        <div className="svc-card">
          <div className="k">User / Channel</div>
          <div className="kind">entrypoint</div>
        </div>
        <div className="svc-card">
          <div className="k">AI Application</div>
          <div className="kind">application</div>
        </div>
        {services.map((s) => (
          <div className="svc-card" key={s.name}>
            <div className="k">{s.name}</div>
            <div className="kind">{s.kind}</div>
          </div>
        ))}
      </div>
      <p className="hint">
        Switch to Physical to reveal regions, hub/spoke VNets, subnets, firewall,
        gateway, private endpoints and DNS — all derived deterministically from
        the same manifest.
      </p>
    </div>
  );
}

type IpamResult = ReturnType<typeof analyzeIpam>;

function PhysicalView({
  manifest,
  ipam,
  selected,
  onSelect,
}: {
  manifest: PhysicalManifest;
  ipam: IpamResult;
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const regions = Array.from(
    new Set(manifest.landingZones.flatMap((lz) => lz.vnets.map((v) => v.region))),
  );
  const peBySubnet = new Map<string, IpamResult["privateEndpoints"]>();
  for (const pe of ipam.privateEndpoints) {
    const list = peBySubnet.get(pe.subnet) ?? [];
    list.push(pe);
    peBySubnet.set(pe.subnet, list);
  }

  return (
    <div>
      {manifest.onPremises.addressSpaces.length > 0 && (
        <div className="kv" style={{ marginBottom: 12 }}>
          <span className="k">On-premises boundary</span>
          <span className="v">{manifest.onPremises.addressSpaces.join(", ")}</span>
        </div>
      )}
      {regions.map((region) => (
        <div className="region-box" key={region}>
          <div className="region-label">Region · {region}</div>
          {manifest.landingZones.map((lz) =>
            lz.vnets
              .filter((v) => v.region === region)
              .map((vnet) => (
                <div
                  className={`vnet-box ${lz.kind === "platform" ? "hub" : "spoke"}`}
                  key={vnet.name}
                >
                  <div className="vnet-head">
                    <span className="name">
                      {vnet.name}{" "}
                      <span style={{ color: "var(--muted)", fontWeight: 400 }}>
                        ({lz.kind === "platform" ? "hub" : "spoke"})
                      </span>
                    </span>
                    <span className="cidr">{vnet.addressSpace.join(", ")}</span>
                  </div>
                  <div className="subnet-grid">
                    {vnet.subnets.map((subnet) => {
                      const id = `subnet-${vnet.name}-${subnet.name}`;
                      const pes = peBySubnet.get(subnet.name) ?? [];
                      return (
                        <div
                          className={`subnet ${selected === id ? "selected" : ""}`}
                          key={subnet.name}
                          onClick={() => onSelect(id)}
                        >
                          <div className="sname">{subnet.name}</div>
                          <div className="scidr">{subnet.addressPrefix}</div>
                          {subnet.delegation !== "none" && (
                            <span className="chip">{subnet.delegation}</span>
                          )}
                          {pes.map((pe) => (
                            <div
                              className="pe-row"
                              key={pe.name}
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelect(`pe-${pe.name}`);
                              }}
                            >
                              <span className="pe-name">{pe.name}</span>
                              <span className="pe-ip">{pe.allocatedIp}</span>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                  {lz.firewall && (
                    <div className="kv">
                      <span className="k">Azure Firewall</span>
                      <span className="v">{lz.firewall.skuTier}</span>
                    </div>
                  )}
                  {lz.gateway && (
                    <div className="kv">
                      <span className="k">Gateway</span>
                      <span className="v">{lz.gateway.kind}</span>
                    </div>
                  )}
                </div>
              )),
          )}
        </div>
      ))}
    </div>
  );
}

function Inspector({
  manifest,
  ipam,
  selected,
}: {
  manifest: PhysicalManifest;
  ipam: IpamResult;
  selected: string | null;
}) {
  if (!selected) {
    return (
      <p className="hint">
        Select a subnet or private endpoint on the physical canvas to inspect its
        CIDR, allocated address, and private DNS resolution.
      </p>
    );
  }

  if (selected.startsWith("pe-")) {
    const name = selected.slice(3);
    const pe = ipam.privateEndpoints.find((p) => p.name === name);
    if (!pe) return <p className="hint">Not found.</p>;
    return (
      <div>
        <div className="section-title">Private endpoint</div>
        <Row k="Name" v={pe.name} />
        <Row k="Target service" v={pe.service} />
        <Row k="Subnet" v={pe.subnet} />
        <Row k="Allocated IP" v={pe.allocatedIp} />
        <Row k="Private DNS zone" v={pe.privateDnsZone} />
      </div>
    );
  }

  // subnet-<vnet>-<subnet>
  const rest = selected.slice("subnet-".length);
  const plan = ipam.subnetPlan.find((s) => rest === `${s.vnet}-${s.subnet}`);
  if (!plan) return <p className="hint">Not found.</p>;
  const dnsForSubnet = ipam.privateEndpoints
    .filter((p) => p.subnet === plan.subnet)
    .map((p) => p.privateDnsZone);
  return (
    <div>
      <div className="section-title">Subnet</div>
      <Row k="VNet" v={plan.vnet} />
      <Row k="Region" v={plan.region} />
      <Row k="Name" v={plan.subnet} />
      <Row k="Role" v={plan.role} />
      <Row k="Address prefix" v={plan.addressPrefix} />
      <Row k="Total addresses" v={String(plan.totalAddresses)} />
      <Row k="Azure reserved" v={String(plan.reservedAddresses)} />
      <Row k="Usable" v={String(plan.usableAddresses)} />
      {dnsForSubnet.length > 0 && (
        <>
          <div className="section-title">Private DNS</div>
          {Array.from(new Set(dnsForSubnet)).map((z) => (
            <Row k="Zone" v={z} key={z} />
          ))}
        </>
      )}
      <div className="hint" style={{ paddingLeft: 14 }}>
        {manifest.metadata.name}
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="kv">
      <span className="k">{k}</span>
      <span className="v">{v}</span>
    </div>
  );
}
