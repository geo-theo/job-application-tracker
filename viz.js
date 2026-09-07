"use strict";

// Every chart starts with this cohort. Board filters intentionally do not apply.
const vizState = { scope: "all", salaryGroup: "industry", salaryMode: "salary", region: "us" };
const VIZ_COLORS = { teal: "#177b70", blue: "#497baf", purple: "#8873ad", orange: "#c18441", gray: "#82918e", red: "#bd6b60" };
const VIZ_STAGES = [
  { key: "response", label: "Responded", color: VIZ_COLORS.teal },
  { key: "screen", label: "Screened", color: VIZ_COLORS.blue },
  { key: "interview", label: "Interviewed", color: VIZ_COLORS.purple },
  { key: "assessment", label: "Assessed", color: VIZ_COLORS.orange },
];
const VIZ_OUTCOMES = [
  { label: "In progress", color: VIZ_COLORS.blue },
  { label: "Accepted", color: VIZ_COLORS.teal },
  { label: "Rejected", color: VIZ_COLORS.red },
  { label: "Ghosted", color: VIZ_COLORS.gray },
];

function getVizJobs(records, scope = "all") {
  return records.filter((job) => !isReferenceJob(job))
    .filter((job) => scope === "applied" ? isAppliedJob(job) : scope === "pending" ? !isAppliedJob(job) : true);
}

function vizElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function vizSvg(tag, attributes = {}, text) {
  const element = document.createElementNS("http://www.w3.org/2000/svg", tag);
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
  if (text !== undefined) element.textContent = text;
  return element;
}

function vizPercent(part, total) {
  return total ? `${Math.round(part / total * 100)}%` : "—";
}

function vizMoney(value, mode = "salary") {
  if (!Number.isFinite(value)) return "—";
  return mode === "hourly" ? `$${Number(value.toFixed(2))}` : `$${Number((value / 1000).toFixed(1))}k`;
}

function vizOutcome(job) {
  return getFinalStatusForForm(job) || "In progress";
}

function vizHasStage(job, key) {
  return job[`${key}Status`] === "Yes" || Boolean(job[`${key}Date`]);
}

function vizIsPublicPurpose(job) {
  return (job.helping || []).some((tag) => ["Govt", "Poor"].includes(tag));
}

function vizPay(job, mode = "salary") {
  if (mode === "salary" && job.payType !== "Salary") return null;
  if (mode === "hourly" && job.payType !== "Hourly") return null;
  if (!["Salary", "Hourly"].includes(job.payType)) return null;
  const positive = (value) => { const number = parseNumber(value); return Number.isFinite(number) && number > 0 ? number : null; };
  const min = positive(job.payMin);
  const max = positive(job.payMax);
  const savedMidpoint = positive(job.payMidpoint);
  const midpoint = min !== null && max !== null ? (min + max) / 2 : min ?? max ?? savedMidpoint;
  if (midpoint === null) return null;
  const factor = mode === "annualized" && job.payType === "Hourly" ? 2080 : 1;
  return {
    low: Math.min(min ?? midpoint, max ?? midpoint) * factor,
    high: Math.max(min ?? midpoint, max ?? midpoint) * factor,
    midpoint: midpoint * factor,
  };
}

function vizAveragePay(records, mode = "salary") {
  const values = records.map((job) => vizPay(job, mode)).filter(Boolean);
  return values.length ? values.reduce((sum, pay) => sum + pay.midpoint, 0) / values.length : null;
}

function vizSelect(label, choices, value, onChange) {
  const wrap = vizElement("label", "viz-select");
  wrap.append(vizElement("span", "", label));
  const select = vizElement("select");
  choices.forEach(([key, caption]) => {
    const option = vizElement("option", "", caption);
    option.value = key;
    select.append(option);
  });
  select.value = value;
  select.addEventListener("change", () => onChange(select.value));
  wrap.append(select);
  return wrap;
}

function vizPanel(number, title, description, className = "") {
  const panel = vizElement("section", `viz-panel ${className}`);
  const header = vizElement("header", "viz-panel-header");
  header.append(vizElement("span", "viz-panel-number", number));
  const text = vizElement("div");
  text.append(vizElement("h2", "", title), vizElement("p", "viz-description", description));
  header.append(text);
  panel.append(header);
  return panel;
}

function vizStat(label, value, detail, tone) {
  const card = vizElement("div", `viz-stat viz-stat-${tone}`);
  card.append(vizElement("span", "viz-stat-label", label), vizElement("strong", "", value), vizElement("span", "viz-stat-detail", detail));
  return card;
}

function vizDrilldown(panel) {
  const details = vizElement("details", "viz-drilldown");
  details.hidden = true;
  panel.append(details);
  return (title, records) => {
    details.replaceChildren(vizElement("summary", "", `${title} · ${records.length} ${records.length === 1 ? "job" : "jobs"}`));
    const list = vizElement("div", "viz-job-list");
    records.forEach((job) => {
      const button = vizElement("button", "viz-job-link");
      button.type = "button";
      button.append(vizElement("strong", "", job.company || "Unnamed company"), vizElement("span", "", job.title || "Untitled job"),
        vizElement("small", "", `${vizLocation(job).label} · ${isAppliedJob(job) ? vizOutcome(job) : "To apply"}`));
      button.addEventListener("click", () => openEditJobForm(job.id));
      list.append(button);
    });
    if (!records.length) list.append(vizElement("p", "viz-note", "No jobs in this group yet."));
    details.append(list);
    details.hidden = false;
    details.open = true;
    details.scrollIntoView({ block: "nearest" });
  };
}

function vizActivateSvg(element, label, onActivate) {
  element.setAttribute("tabindex", "0");
  element.setAttribute("role", "button");
  element.setAttribute("aria-label", label);
  element.append(vizSvg("title", {}, label));
  element.addEventListener("click", onActivate);
  element.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onActivate(); }
  });
}

function renderViz() {
  const records = getVizJobs(jobs, vizState.scope);
  const all = getVizJobs(jobs);
  const applied = records.filter(isAppliedJob);
  const pending = records.filter((job) => !isAppliedJob(job));
  const active = applied.filter((job) => !getFinalStatusForForm(job));
  const publicPurpose = records.filter(vizIsPublicPurpose);
  const salaryCount = records.filter((job) => vizPay(job)).length;
  els.recordCount.textContent = `${records.length} jobs · references excluded`;
  els.jobList.replaceChildren();
  const dashboard = vizElement("section", "viz-dashboard");
  const intro = vizElement("div", "viz-intro");
  const title = vizElement("div");
  title.append(vizElement("p", "eyebrow", "YOUR SEARCH, IN PERSPECTIVE"),
    vizElement("h2", "viz-title", "Where could your next chapter lead?"),
    vizElement("p", "viz-description", `${all.length} opportunities. ${jobs.length - all.length} reference jobs excluded from every chart. Select a chart to explore its jobs.`));
  const scope = vizSelect("Explore", [["all", "All opportunities"], ["applied", "Applied jobs"], ["pending", "Jobs to apply to"]], vizState.scope, (value) => {
    vizState.scope = value;
    renderViz();
    els.jobList.querySelector(".viz-scope select").focus({ preventScroll: true });
  });
  scope.classList.add("viz-scope");
  intro.append(title, scope);
  dashboard.append(intro);
  if (!records.length) {
    dashboard.append(vizElement("div", "empty-state viz-wide", all.length ? "No jobs in this view yet. Try All opportunities." : "Add a non-reference job to start exploring your search."));
    els.jobList.append(dashboard);
    return;
  }
  const stats = vizElement("div", "viz-stat-grid");
  stats.append(
    vizStat("Ready for a first move", pending.length, "Saved jobs you haven’t applied to", "orange"),
    vizStat("Applications sent", applied.length, `${active.length} in progress · ${applied.length - active.length} closed`, "blue"),
    vizStat("Average annual salary", vizMoney(vizAveragePay(records)), `${salaryCount} jobs with salary · hourly excluded`, "teal"),
    vizStat("Public-purpose work", publicPurpose.length, `${vizPercent(publicPurpose.length, records.length)} tagged Govt or Poor`, "purple"),
  );
  dashboard.append(stats, vizFlowPanel(applied), vizSalaryPanel(records), vizImpactPanel(records), vizMapPanel(records), vizActivityPanel(applied));
  els.jobList.append(dashboard);
}

// A job follows only its recorded milestones, then exactly one current outcome.
// Columns follow the tracker’s stage order; they do not infer event chronology.
function vizFlowModel(records) {
  const stageNodes = VIZ_STAGES.filter((stage) => records.some((job) => vizHasStage(job, stage.key)));
  const nodes = [
    { key: "applied", label: "Applied", color: VIZ_COLORS.blue, column: 0, jobs: records },
    ...stageNodes.map((stage, index) => ({ ...stage, column: index + 1, jobs: records.filter((job) => vizHasStage(job, stage.key)) })),
    ...VIZ_OUTCOMES.map((outcome) => ({ ...outcome, key: outcome.label, column: stageNodes.length + 1, jobs: records.filter((job) => vizOutcome(job) === outcome.label) })).filter((node) => node.jobs.length),
  ];
  const links = new Map();
  records.forEach((job) => {
    const path = ["applied", ...stageNodes.filter((stage) => vizHasStage(job, stage.key)).map((stage) => stage.key), vizOutcome(job)];
    path.slice(1).forEach((key, index) => {
      const id = `${path[index]}:${key}`;
      if (!links.has(id)) links.set(id, { source: path[index], target: key, jobs: [] });
      links.get(id).jobs.push(job);
    });
  });
  return { nodes, links: [...links.values()], columns: stageNodes.length + 2 };
}

function vizFlowPanel(records) {
  const panel = vizPanel("01", "Every application has a story", "Follow the streams from application to where things stand today.", "viz-wide viz-flow-panel");
  if (!records.length) { panel.append(vizElement("p", "viz-empty", "Your first application will start the stream. Saved, unapplied jobs stay out of this flow.")); return panel; }
  const model = vizFlowModel(records);
  const chart = vizElement("div", "viz-flow-scroll");
  const svg = vizSvg("svg", { viewBox: "0 0 1100 330", class: "viz-flow", role: "group", "aria-label": "Application flow. Activate a stream or stage to see its jobs." });
  const scale = 188 / records.length;
  const nodeWidth = 15;
  const byKey = new Map(model.nodes.map((node) => [node.key, node]));
  for (let column = 0; column < model.columns; column++) {
    const columnNodes = model.nodes.filter((node) => node.column === column);
    const height = columnNodes.reduce((sum, node) => sum + node.jobs.length * scale, 0) + (columnNodes.length - 1) * 30;
    let y = 54 + (242 - height) / 2;
    columnNodes.forEach((node) => {
      node.x = 35 + column / (model.columns - 1) * 880;
      node.y = y;
      node.height = node.jobs.length * scale;
      node.inOffset = 0;
      node.outOffset = 0;
      y += node.height + 30;
    });
    const label = column === 0 ? "START" : column === model.columns - 1 ? "CURRENT OUTCOME" : "RECORDED MILESTONE";
    svg.append(vizSvg("text", { x: columnNodes[0].x, y: 22, class: "viz-svg-eyebrow" }, label));
  }
  const linksGroup = vizSvg("g", { class: "viz-flow-links" });
  // Put long bypasses first so recorded-stage paths remain visible on top.
  model.links.sort((a, b) => (byKey.get(b.target).column - byKey.get(b.source).column) - (byKey.get(a.target).column - byKey.get(a.source).column));
  model.links.forEach((link) => {
    const source = byKey.get(link.source);
    const target = byKey.get(link.target);
    const thickness = link.jobs.length * scale;
    const x1 = source.x + nodeWidth;
    const x2 = target.x;
    const y1 = source.y + source.outOffset;
    const y2 = target.y + target.inOffset;
    const middle = (x1 + x2) / 2;
    const path = vizSvg("path", {
      d: `M${x1},${y1} C${middle},${y1} ${middle},${y2} ${x2},${y2} L${x2},${y2 + thickness} C${middle},${y2 + thickness} ${middle},${y1 + thickness} ${x1},${y1 + thickness} Z`,
      fill: target.color, class: "viz-flow-link",
    });
    source.outOffset += thickness;
    target.inOffset += thickness;
    vizActivateSvg(path, `${source.label} → ${target.label}: ${link.jobs.length} jobs`, () => showJobs(`${source.label} → ${target.label}`, link.jobs));
    linksGroup.append(path);
  });
  svg.append(linksGroup);
  model.nodes.forEach((node) => {
    const group = vizSvg("g", { class: "viz-flow-node" });
    group.append(vizSvg("rect", { x: node.x, y: node.y, width: nodeWidth, height: node.height, rx: 4, fill: node.color }));
    const isOutcome = node.column === model.columns - 1;
    const y = isOutcome ? node.y + node.height / 2 - 3 : node.y - 13;
    group.append(vizSvg("text", { x: node.x + (isOutcome ? 25 : 0), y, class: "viz-svg-label" }, `${node.label} · ${node.jobs.length}`));
    if (isOutcome) group.append(vizSvg("text", { x: node.x + 25, y: y + 19, class: "viz-svg-detail" }, `${vizPercent(node.jobs.length, records.length)} of applications`));
    vizActivateSvg(group, `${node.label}: ${node.jobs.length} jobs`, () => showJobs(node.label, node.jobs));
    svg.append(group);
  });
  chart.append(svg);
  const milestones = vizElement("div", "viz-milestones");
  VIZ_STAGES.forEach((stage) => {
    const count = records.filter((job) => vizHasStage(job, stage.key)).length;
    milestones.append(vizElement("span", count ? "" : "viz-muted", `${stage.label} ${count}`));
  });
  VIZ_OUTCOMES.filter((outcome) => !records.some((job) => vizOutcome(job) === outcome.label)).forEach((outcome) => milestones.append(vizElement("span", "viz-muted", `${outcome.label} 0`)));
  panel.append(chart, milestones, vizElement("p", "viz-note", "Width = number of applications. Only logged milestones appear; unrecorded steps are skipped. Milestones follow form order, not event dates. Ghosted is a saved outcome, never inferred from silence."));
  const showJobs = vizDrilldown(panel);
  return panel;
}

function vizSalaryGroups(records, dimension, mode) {
  const groups = new Map();
  records.forEach((job) => {
    const labels = dimension === "role" ? (job.roles?.length ? job.roles.map((role) => role === "Other" ? job.roleOther || "Other" : role) : [job.roleOther || "Unspecified role"])
      : [dimension === "location" ? vizLocation(job).label : getIndustryDisplay(job) || "Unspecified industry"];
    [...new Set(labels)].forEach((label) => {
      if (!groups.has(label)) groups.set(label, { label, jobs: [], paid: [] });
      const group = groups.get(label);
      group.jobs.push(job);
      const pay = vizPay(job, mode);
      if (pay) group.paid.push({ job, ...pay });
    });
  });
  return [...groups.values()].map((group) => ({ ...group,
    mean: group.paid.length ? group.paid.reduce((sum, pay) => sum + pay.midpoint, 0) / group.paid.length : null,
    low: group.paid.length ? Math.min(...group.paid.map((pay) => pay.low)) : null,
    high: group.paid.length ? Math.max(...group.paid.map((pay) => pay.high)) : null,
  })).sort((a, b) => (b.mean ?? -1) - (a.mean ?? -1) || a.label.localeCompare(b.label));
}

function vizSalaryPanel(records) {
  const panel = vizPanel("02", "What does the work pay?", "Compare advertised pay, with the sample size in plain sight.", "viz-salary-panel");
  const controls = vizElement("div", "viz-controls");
  controls.append(
    vizSelect("Group by", [["industry", "Industry"], ["role", "Role"], ["location", "Location"]], vizState.salaryGroup, (value) => { vizState.salaryGroup = value; draw(); }),
    vizSelect("Compare", [["salary", "Annual salary"], ["annualized", "Annual equivalent"], ["hourly", "Hourly pay"]], vizState.salaryMode, (value) => { vizState.salaryMode = value; draw(); }),
  );
  const content = vizElement("div", "viz-salary-content");
  panel.append(controls, content);
  const showJobs = vizDrilldown(panel);
  function draw() {
    content.replaceChildren();
    panel.querySelector(".viz-drilldown").hidden = true;
    const groups = vizSalaryGroups(records, vizState.salaryGroup, vizState.salaryMode);
    const paidCount = records.filter((job) => vizPay(job, vizState.salaryMode)).length;
    const step = vizState.salaryMode === "hourly" ? 25 : 50000;
    const axisMax = Math.max(step, Math.ceil(Math.max(0, ...groups.map((group) => group.high || 0)) / step) * step);
    const unit = vizState.salaryMode === "hourly" ? "/hr" : "/yr";
    const summary = vizElement("div", "viz-pay-summary");
    summary.append(vizElement("strong", "", `${vizMoney(vizAveragePay(records, vizState.salaryMode), vizState.salaryMode)}${paidCount ? unit : ""}`),
      vizElement("span", "", `average · ${paidCount} of ${records.length} jobs with comparable pay`));
    content.append(summary);
    if (!paidCount) content.append(vizElement("p", "viz-empty", "No comparable pay recorded in this view. Try another pay type."));
    const axis = vizElement("div", "viz-pay-axis");
    const ticks = vizElement("div", "viz-pay-ticks");
    ticks.append(vizElement("span", "", "$0"), vizElement("span", "", vizMoney(axisMax / 2, vizState.salaryMode)), vizElement("span", "", `${vizMoney(axisMax, vizState.salaryMode)}${unit}`));
    axis.append(ticks);
    content.append(axis);
    const rows = vizElement("div", "viz-salary-rows");
    groups.forEach((group) => {
      const row = vizElement("button", "viz-pay-row");
      row.type = "button";
      const caption = vizElement("span", "viz-pay-caption");
      caption.append(vizElement("strong", "", group.label), vizElement("small", "", `n=${group.paid.length} / ${group.jobs.length} jobs`));
      const plot = vizElement("span", "viz-pay-track");
      if (group.paid.length) {
        const range = vizElement("span", "viz-pay-range");
        range.style.left = `${group.low / axisMax * 100}%`;
        range.style.width = `${(group.high - group.low) / axisMax * 100}%`;
        const dot = vizElement("span", "viz-pay-dot");
        dot.style.left = `${group.mean / axisMax * 100}%`;
        plot.append(range, dot);
      }
      const value = vizElement("strong", "viz-pay-value", vizMoney(group.mean, vizState.salaryMode));
      const description = group.paid.length ? `Average ${vizMoney(group.mean, vizState.salaryMode)}${unit}; advertised range ${vizMoney(group.low, vizState.salaryMode)}–${vizMoney(group.high, vizState.salaryMode)}${unit}` : "No comparable pay";
      row.title = `${group.label}: ${description}. ${group.paid.length} of ${group.jobs.length} jobs with pay. Click to see all jobs in this group.`;
      row.setAttribute("aria-label", row.title);
      row.append(caption, plot, value);
      row.addEventListener("click", () => showJobs(group.label, group.jobs));
      rows.append(row);
    });
    content.append(rows, vizElement("p", "viz-note", "Dot = mean of each job’s pay midpoint. Line = lowest to highest advertised pay. A single bound is used when no range exists. Missing pay is excluded, not counted as zero."));
    if (vizState.salaryMode === "annualized") content.append(vizElement("p", "viz-method", "Hourly × 2,080 hours (40 hours × 52 weeks). This is a comparison equivalent, not expected earnings for part-time work or internships."));
    if (vizState.salaryGroup === "role") content.append(vizElement("p", "viz-note", "Jobs with multiple roles appear in each role; the overall average counts each job once."));
  }
  draw();
  return panel;
}

function vizImpactPanel(records) {
  const panel = vizPanel("03", "Who benefits from your work?", "A closer look at the people and purposes behind the postings.", "viz-impact-panel");
  const publicJobs = records.filter(vizIsPublicPurpose);
  const hero = vizElement("div", "viz-impact-hero");
  const ring = vizElement("button", "viz-impact-ring");
  ring.type = "button";
  ring.style.setProperty("--impact-share", `${publicJobs.length / records.length * 100}%`);
  ring.append(vizElement("strong", "", vizPercent(publicJobs.length, records.length)), vizElement("span", "", "public purpose"));
  ring.setAttribute("aria-label", `${publicJobs.length} public-purpose jobs out of ${records.length}. Show jobs tagged Govt or Poor.`);
  ring.addEventListener("click", () => showJobs("Public purpose · Govt or Poor", publicJobs));
  const caption = vizElement("div");
  caption.append(vizElement("h3", "", `${publicJobs.length} opportunities to serve`), vizElement("p", "viz-description", "Jobs you’ve tagged as helping government or people in poverty. Each job counts once in this total."));
  hero.append(ring, caption);
  const groups = [
    ["Govt", "Government & public service", VIZ_COLORS.teal],
    ["Poor", "People in poverty", VIZ_COLORS.blue],
    ["Environment", "The environment", "#6f8b4e"],
    ["Startup", "Startups", VIZ_COLORS.purple],
    ["Rich", "Wealthy beneficiaries", VIZ_COLORS.orange],
  ];
  const known = groups.map(([key]) => key);
  [...new Set(records.flatMap((job) => job.helping || []))].filter((tag) => !known.includes(tag)).forEach((tag) => groups.push([tag, tag, VIZ_COLORS.gray]));
  groups.push(["", "Not tagged yet", VIZ_COLORS.gray]);
  const bars = vizElement("div", "viz-impact-bars");
  groups.forEach(([tag, label, color]) => {
    const matching = records.filter((job) => tag ? (job.helping || []).includes(tag) : !job.helping?.length);
    const button = vizElement("button", "viz-impact-row");
    button.type = "button";
    const track = vizElement("span", "viz-impact-track");
    const fill = vizElement("span");
    fill.style.width = `${matching.length / records.length * 100}%`;
    fill.style.background = color;
    track.append(fill);
    button.append(vizElement("span", "", label), vizElement("strong", "", `${matching.length} · ${vizPercent(matching.length, records.length)}`), track);
    button.addEventListener("click", () => showJobs(label, matching));
    bars.append(button);
  });
  const waiting = publicJobs.filter((job) => !isAppliedJob(job));
  const callout = vizElement("button", "viz-impact-callout", `${waiting.length} public-purpose ${waiting.length === 1 ? "job is" : "jobs are"} still waiting for an application →`);
  callout.type = "button";
  callout.addEventListener("click", () => showJobs("Public-purpose jobs to apply to", waiting));
  panel.append(hero, bars, callout, vizElement("p", "viz-note", "Based on your Helping tags, not an independent impact rating. Tags can overlap, so the bars may sum to more than 100%. Environment is shown separately."));
  const showJobs = vizDrilldown(panel);
  return panel;
}

// Offline city centers and explicit aliases for the locations in this search.
// Unknown locations stay in the list instead of being assigned guessed coordinates.
const VIZ_PLACES = [
  ["Missoula, MT", -113.994, 46.872, ["Missoula", "Missoula, MT"]],
  ["Seattle, WA", -122.332, 47.606, ["Seattle", "Seattle, WA"]],
  ["Redlands, CA", -117.182, 34.055, ["Redlands", "Redlands, CA"]],
  ["Washington, DC", -77.037, 38.907, ["Washington, DC", "Washington DC"]],
  ["DMV region", -77.15, 39.0, ["DMV", "DMV region"]],
  ["Reston, VA", -77.357, 38.958, ["Reston, VA", "Reston"]],
  ["San Bruno, CA", -122.411, 37.63, ["San Bruno, CA", "San Bruno"]],
  ["Helena, MT", -112.037, 46.589, ["Helena, MT", "Helena"]],
  ["Glendive, MT", -104.712, 47.105, ["Glendive, MT", "Glendive"]],
  ["Bozeman, MT", -111.043, 45.677, ["Bozeman, MT", "Bozeman"]],
  ["Arlee, MT", -114.085, 47.163, ["Arlee, MT", "Arlee"]],
  ["Austin, TX", -97.743, 30.267, ["Austin, TX", "Austin"]],
  ["Annecy, France", 6.129, 45.899, ["Annecy, France", "Annecy"]],
  ["Nanterre, France", 2.207, 48.892, ["Nanterre, France", "Nanterre, Île-de-France, France", "Nanterre"]],
  ["Rueil, France", 2.181, 48.877, ["Rueil, France", "Rueil-Malmaison, France"]],
  ["Vélizy-Villacoublay, France", 2.19, 48.782, ["Vélizy-Villacoublay, Yvelines, France", "Vélizy-Villacoublay, France"]],
  ["Cardiff, United Kingdom", -3.18, 51.481, ["Cardiff, United Kingdom", "Cardiff, UK", "Cardiff"]],
];
const VIZ_REGIONS = {
  us: { label: "United States", bounds: [-126, -66, 24, 51] },
  europe: { label: "Europe", bounds: [-12, 18, 40, 57] },
  world: { label: "World", bounds: [-180, 180, -60, 85] },
};

function vizLocation(job) {
  const raw = (job.location || (job.locationChoice === "Other" ? job.locationOther : job.locationChoice) || "").trim();
  if (!raw) return { label: "Location not recorded", kind: "missing" };
  if (/^remote$/i.test(raw)) return { label: "Remote", kind: "remote" };
  const normalize = (value) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  const place = VIZ_PLACES.find((entry) => entry[3].some((alias) => normalize(alias) === normalize(raw)));
  return place ? { label: place[0], lon: place[1], lat: place[2], kind: "mapped" } : { label: raw, kind: "unmapped" };
}

function vizLocationGroups(records) {
  const groups = new Map();
  records.forEach((job) => {
    const place = vizLocation(job);
    if (!groups.has(place.label)) groups.set(place.label, { ...place, jobs: [] });
    groups.get(place.label).jobs.push(job);
  });
  return [...groups.values()].sort((a, b) => b.jobs.length - a.jobs.length || a.label.localeCompare(b.label));
}

function vizProject(lon, lat, bounds) {
  const [west, east, south, north] = bounds;
  return [(lon - west) / (east - west) * 800, (north - lat) / (north - south) * 380];
}

function vizMapPanel(records) {
  const panel = vizPanel("04", "A world of possibilities", "Where the opportunities are, from home turf to farther afield.", "viz-map-panel");
  const groups = vizLocationGroups(records);
  const controls = vizElement("div", "viz-map-tabs");
  controls.setAttribute("role", "group");
  controls.setAttribute("aria-label", "Map region");
  Object.entries(VIZ_REGIONS).forEach(([key, region]) => {
    const button = vizElement("button", "", region.label);
    button.type = "button";
    button.dataset.region = key;
    button.addEventListener("click", () => { vizState.region = key; draw(); });
    controls.append(button);
  });
  const map = vizElement("div", "viz-map");
  const coverage = vizElement("p", "viz-note");
  const locations = vizElement("div", "viz-location-list");
  groups.forEach((place) => {
    const button = vizElement("button", `viz-location ${place.kind}`);
    button.type = "button";
    const label = vizElement("span", "", place.label);
    if (place.kind === "unmapped") label.append(vizElement("small", "", "Not mapped"));
    button.append(label, vizElement("strong", "", place.jobs.length));
    button.addEventListener("click", () => showJobs(place.label, place.jobs));
    locations.append(button);
  });
  panel.append(controls, map, coverage, locations,
    vizElement("p", "viz-note", "Bubble area = job count. Markers use city centers; DMV uses a regional center. Remote jobs have no map pin. All locations are listed below the map, including missing and unmapped entries."));
  const attribution = vizElement("p", "viz-note");
  const source = vizElement("a", "", "Natural Earth");
  source.href = "https://www.naturalearthdata.com/";
  source.target = "_blank";
  source.rel = "noopener noreferrer";
  attribution.append("Map outlines: ", source, " · stored locally, no geocoding requests.");
  panel.append(attribution);
  const showJobs = vizDrilldown(panel);
  function draw() {
    controls.querySelectorAll("button").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.region === vizState.region)));
    const region = VIZ_REGIONS[vizState.region];
    const svg = vizSvg("svg", { viewBox: "0 0 800 380", role: "group", "aria-label": `${region.label} job map. Activate a marker or use the location list below.` });
    svg.append(vizSvg("image", { href: `img/maps/${vizState.region}.svg`, width: 800, height: 380 }));
    const visible = groups.filter((place) => place.kind === "mapped" && place.lon >= region.bounds[0] && place.lon <= region.bounds[1] && place.lat >= region.bounds[2] && place.lat <= region.bounds[3]);
    // Draw smaller bubbles last so nearby locations remain selectable.
    visible.forEach((place) => {
      const [x, y] = vizProject(place.lon, place.lat, region.bounds);
      const radius = 9 * Math.sqrt(place.jobs.length);
      const group = vizSvg("g", { class: "viz-map-marker" });
      group.append(vizSvg("circle", { cx: x, cy: y, r: radius, fill: VIZ_COLORS.teal, "fill-opacity": ".8", stroke: "#fffdf8", "stroke-width": 2 }),
        vizSvg("text", { x, y: y + 4, "text-anchor": "middle", class: "viz-map-count" }, place.jobs.length));
      vizActivateSvg(group, `${place.label}: ${place.jobs.length} jobs`, () => showJobs(place.label, place.jobs));
      svg.append(group);
    });
    const count = visible.reduce((sum, place) => sum + place.jobs.length, 0);
    coverage.textContent = `${count} of ${records.length} jobs in this map view · ${records.filter((job) => vizLocation(job).kind === "remote").length} remote · ${records.filter((job) => ["missing", "unmapped"].includes(vizLocation(job).kind)).length} missing or unmapped`;
    if (!count) svg.append(vizSvg("text", { x: 400, y: 190, "text-anchor": "middle", class: "viz-svg-label" }, "No mapped jobs in this region"));
    map.replaceChildren(svg);
  }
  draw();
  return panel;
}

function vizDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return null;
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value ? timestamp : null;
}

function vizActivityModel(records) {
  const dated = records.map((job) => ({ job, date: vizDate(job.appliedDate) })).filter((entry) => entry.date !== null);
  const months = [];
  if (dated.length) {
    const first = new Date(Math.min(...dated.map((entry) => entry.date)));
    const last = new Date(Math.max(...dated.map((entry) => entry.date)));
    const cursor = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), 1));
    while (cursor <= last) {
      const key = cursor.toISOString().slice(0, 7);
      months.push({ key, jobs: dated.filter((entry) => entry.job.appliedDate.startsWith(key)).map((entry) => entry.job) });
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
  }
  return { months, missing: records.length - dated.length };
}

function vizActivityPanel(records) {
  const panel = vizPanel("05", "The rhythm of your search", "Applications by month, colored by their current outcome.", "viz-activity-panel");
  const { months, missing } = vizActivityModel(records);
  const legend = vizElement("div", "viz-legend");
  VIZ_OUTCOMES.forEach((outcome) => {
    const item = vizElement("span", "", outcome.label);
    item.style.setProperty("--legend-color", outcome.color);
    legend.append(item);
  });
  panel.append(legend);
  if (!months.length) { panel.append(vizElement("p", "viz-empty", "Add application dates to see your rhythm."), vizElement("p", "viz-note", `${missing} applications without a valid date.`)); return panel; }
  const max = Math.max(...months.map((month) => month.jobs.length), 1);
  const plot = vizElement("div", "viz-activity-plot");
  const chart = vizElement("div", "viz-months");
  const dateFormat = new Intl.DateTimeFormat("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });
  months.forEach((month) => {
    const column = vizElement("div", "viz-month");
    const total = vizElement("button", "viz-month-total", month.jobs.length);
    total.type = "button";
    const label = dateFormat.format(new Date(`${month.key}-01T00:00:00Z`));
    total.setAttribute("aria-label", `${label}: ${month.jobs.length} applications. Show jobs.`);
    total.addEventListener("click", () => showJobs(`Applied in ${label}`, month.jobs));
    const bar = vizElement("div", "viz-month-bar");
    bar.style.height = `${month.jobs.length / max * 180}px`;
    VIZ_OUTCOMES.forEach((outcome) => {
      const matching = month.jobs.filter((job) => vizOutcome(job) === outcome.label);
      if (!matching.length) return;
      const segment = vizElement("button", "viz-month-segment");
      segment.type = "button";
      segment.style.height = `${matching.length / month.jobs.length * 100}%`;
      segment.style.background = outcome.color;
      segment.title = `${label} · ${outcome.label}: ${matching.length}`;
      segment.setAttribute("aria-label", segment.title);
      segment.addEventListener("click", () => showJobs(`${label} · ${outcome.label}`, matching));
      bar.append(segment);
    });
    column.append(total, bar, vizElement("span", "viz-month-label", label));
    chart.append(column);
  });
  plot.append(chart);
  const latest = months[months.length - 1];
  const pulse = vizElement("div", "viz-activity-pulse");
  pulse.append(vizElement("strong", "", latest.jobs.length), vizElement("span", "", `applications in ${dateFormat.format(new Date(`${latest.key}-01T00:00:00Z`))}`));
  panel.append(plot, pulse, vizElement("p", "viz-note", `Months use the application date, not the outcome date. Colors reflect today’s saved outcome; they are not a historical status timeline. ${missing} applications without a valid date excluded.`));
  const showJobs = vizDrilldown(panel);
  return panel;
}
