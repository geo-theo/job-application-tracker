"use strict";

// Charts use non-reference applications; only the ready-to-apply card uses pending jobs.
const vizState = { excludedJobTypes: [], salaryGroup: "industry", salaryMode: "annualized", region: "remote", mapMetric: "count", mapSelected: "", flowPeriod: "all", activityPeriod: "all", activityUnit: "auto", flowDates: {}, activityDates: {} };
const VIZ_ANNUAL_HOURS = 8 * 21 * 12;
const VIZ_DAY = 86400000;
let vizLastLocationSearchAt = 0;
const VIZ_PERIODS = [["week", "Last week", 7], ["month", "Last month", 30], ["quarter", "Last quarter", 90], ["year", "Last year", 365], ["all", "All time", null]];
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

function getVizJobs(records, scope = "all", excludedJobTypes = []) {
  return records.filter((job) => !isReferenceJob(job))
    .filter((job) => !excludedJobTypes.some((type) => hasJobType(job, type)))
    .filter((job) => scope === "applied" ? isAppliedJob(job) : scope === "pending" ? !isAppliedJob(job) : true);
}

function vizJobTypeFilters(excludedCount) {
  const fieldset = vizElement("fieldset", "viz-type-filters");
  fieldset.append(vizElement("legend", "", "Exclude job types"));
  const options = vizElement("div", "viz-type-options");
  [["Internship", "Internships"], ["Part-time", "Part-time"]].forEach(([type, caption]) => {
    const label = vizElement("label");
    const input = vizElement("input");
    input.type = "checkbox";
    input.id = `viz-exclude-${type.toLowerCase()}`;
    input.checked = vizState.excludedJobTypes.includes(type);
    input.addEventListener("change", () => {
      vizState.excludedJobTypes = input.checked ? [...vizState.excludedJobTypes, type] : vizState.excludedJobTypes.filter((value) => value !== type);
      const scrollTop = els.jobList.scrollTop;
      renderViz();
      els.jobList.scrollTop = scrollTop;
      document.getElementById(input.id).focus({ preventScroll: true });
    });
    label.append(input, vizElement("span", "", caption));
    options.append(label);
  });
  fieldset.append(options, vizElement("p", "viz-type-note", `Applies to all figures and charts.${vizState.excludedJobTypes.length ? ` ${excludedCount} ${excludedCount === 1 ? "job" : "jobs"} excluded by type.` : ""}`));
  return fieldset;
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
  return (job.mission || []).some((tag) => ["Govt", "Poor"].includes(tag));
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
  const factor = mode === "annualized" && job.payType === "Hourly" ? VIZ_ANNUAL_HOURS : 1;
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

function vizPaySummary(records) {
  const values = records.map((job) => vizPay(job, "annualized")?.midpoint).filter(Number.isFinite).sort((a, b) => a - b);
  const quantile = (p) => {
    if (!values.length) return null;
    const position = (values.length - 1) * p;
    const low = Math.floor(position);
    return values[low] + (values[Math.ceil(position)] - values[low]) * (position - low);
  };
  return { count: values.length, mean: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null, p25: quantile(.25), p75: quantile(.75) };
}

// Calendar dates are compared as UTC day numbers, using the user's local today.
// This avoids daylight-saving changes changing the length of a day or week.
function vizToday(now = new Date()) {
  return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
}

function vizCalendarRange(period, now = new Date()) {
  const today = vizToday(now);
  const date = new Date(today);
  let start = today;
  if (period === "week") start -= (date.getUTCDay() + 6) % 7 * VIZ_DAY;
  if (period === "month") start = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
  if (period === "quarter") start = Date.UTC(date.getUTCFullYear(), Math.floor(date.getUTCMonth() / 3) * 3, 1);
  if (period === "year") start = Date.UTC(date.getUTCFullYear(), 0, 1);
  return { start, end: today + VIZ_DAY };
}

function vizPeriodRange(period, now = new Date(), dates = {}) {
  if (period === "all") return null;
  if (period === "custom") {
    const start = vizDate(dates.start);
    const end = vizDate(dates.end);
    return start !== null && end !== null && start <= end ? { start, end: end + VIZ_DAY } : null;
  }
  const days = VIZ_PERIODS.find(([key]) => key === period)?.[2];
  const end = vizToday(now) + VIZ_DAY;
  return days ? { start: end - days * VIZ_DAY, end } : null;
}

function vizInRange(records, range) {
  if (!range) return records;
  return records.filter((job) => {
    const date = vizDate(job.appliedDate);
    return date !== null && date >= range.start && date < range.end;
  });
}

function vizRangeLabel(range) {
  if (!range) return "All time";
  const format = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  return `${format.format(range.start)} – ${format.format(range.end - VIZ_DAY)}`;
}

function vizMissionChange(records, now = new Date()) {
  const range = vizCalendarRange("month", now);
  const start = new Date(range.start);
  const previousRange = { start: Date.UTC(start.getUTCFullYear(), start.getUTCMonth() - 1, 1), end: range.start };
  const measure = (selected) => ({ total: selected.length, mission: selected.filter(vizIsPublicPurpose).length,
    share: selected.length ? selected.filter(vizIsPublicPurpose).length / selected.length : null });
  const current = measure(vizInRange(records, range));
  const previous = measure(vizInRange(records, previousRange));
  return { current, previous,
    relative: current.share !== null && previous.share > 0 ? (current.share - previous.share) / previous.share * 100 : null,
    points: current.share !== null && previous.share !== null ? (current.share - previous.share) * 100 : null };
}

function vizSigned(value, suffix = "%") {
  if (!Number.isFinite(value)) return "—";
  return `${value > 0 ? "+" : ""}${Number(value.toFixed(1))}${suffix}`;
}

function vizCalendarControl(key, onChange) {
  const control = vizElement("details", "viz-calendar");
  const summary = vizElement("summary");
  const icon = vizSvg("svg", { viewBox: "0 0 24 24", width: 16, height: 16, fill: "none", stroke: "currentColor", "stroke-width": 1.6, "aria-hidden": "true" });
  icon.append(vizSvg("rect", { x: 3, y: 5, width: 18, height: 16, rx: 3 }), vizSvg("path", { d: "M7 2v6M17 2v6M3 11h18" }));
  const caption = vizElement("span");
  summary.append(icon, caption);
  summary.setAttribute("aria-label", `${key === "flow" ? "Application flow" : "Activity"} calendar filter`);
  const choices = vizElement("div", "viz-calendar-options");
  choices.setAttribute("role", "group");
  choices.setAttribute("aria-label", "Date range");
  function update() {
    caption.textContent = VIZ_PERIODS.find(([period]) => period === vizState[`${key}Period`])?.[1] || "Custom dates";
    choices.querySelectorAll("button[data-period]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.period === vizState[`${key}Period`])));
  }
  function choose(period) {
    vizState[`${key}Period`] = period;
    control.open = false;
    update();
    onChange();
    summary.focus({ preventScroll: true });
  }
  VIZ_PERIODS.forEach(([period, label, days]) => {
    const button = vizElement("button", "", `${label}${days ? ` · ${days} days` : ""}`);
    button.type = "button";
    button.dataset.period = period;
    button.addEventListener("click", () => choose(period));
    choices.append(button);
  });
  const custom = vizElement("form", "viz-custom-dates");
  const inputs = {};
  ["start", "end"].forEach((field) => {
    const label = vizElement("label", "", field === "start" ? "From" : "Through");
    const input = vizElement("input");
    input.type = "date";
    input.required = true;
    input.value = vizState[`${key}Dates`][field] || "";
    input.addEventListener("input", () => inputs.end.setCustomValidity(""));
    inputs[field] = input;
    label.append(input);
    custom.append(label);
  });
  const apply = vizElement("button", "", "Apply dates");
  apply.type = "submit";
  custom.append(apply);
  custom.addEventListener("submit", (event) => {
    event.preventDefault();
    if (inputs.start.value > inputs.end.value) { inputs.end.setCustomValidity("End date must be on or after the start date."); inputs.end.reportValidity(); return; }
    vizState[`${key}Dates`] = { start: inputs.start.value, end: inputs.end.value };
    choose("custom");
  });
  control.addEventListener("keydown", (event) => { if (event.key === "Escape") { control.open = false; summary.focus(); } });
  control.addEventListener("focusout", () => { setTimeout(() => { if (!control.contains(document.activeElement)) control.open = false; }, 0); });
  const menu = vizElement("div", "viz-calendar-menu");
  menu.append(choices, custom);
  control.append(summary, menu);
  update();
  return control;
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

function vizStat(label, value, detail, tone, figures = []) {
  const card = vizElement("div", `viz-stat viz-stat-${tone}`);
  const values = vizElement("div", "viz-stat-values");
  values.append(vizElement("strong", "viz-stat-main", value));
  const extras = vizElement("div", "viz-stat-extras");
  if (figures.length <= 2) extras.classList.add("viz-stat-extras-compact");
  figures.forEach(({ label: caption, value: number, tone: color = tone, title }) => {
    const item = vizElement("span", `viz-stat-extra viz-extra-${color}`);
    item.append(vizElement("b", "", number), vizElement("span", "", caption));
    if (title) item.title = title;
    extras.append(item);
  });
  values.append(extras);
  card.append(vizElement("span", "viz-stat-label", label), values, vizElement("span", "viz-stat-detail", detail));
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
  const all = getVizJobs(jobs);
  const visible = getVizJobs(jobs, "all", vizState.excludedJobTypes);
  const applied = visible.filter(isAppliedJob);
  const pending = visible.filter((job) => !isAppliedJob(job));
  const publicPurpose = applied.filter(vizIsPublicPurpose);
  const pay = vizPaySummary(applied);
  const mission = vizMissionChange(applied);
  const priorityFigures = [["Urgent", "urgent"], ["High", "high"], ["Medium", "medium"], ["Low", "low"], ["Upcoming", "teal"]]
    .map(([priority, tone]) => ({ label: priority, tone, value: pending.filter((job) => normalizePriority(job.priority) === priority).length }));
  const unranked = pending.filter((job) => !["Urgent", "High", "Medium", "Low", "Upcoming"].includes(normalizePriority(job.priority))).length;
  if (unranked) priorityFigures.push({ label: "Unranked", tone: "gray", value: unranked });
  const timelines = [["week", "This week"], ["month", "This month"], ["quarter", "This quarter"], ["year", "This year"]]
    .map(([period, label]) => ({ label, value: vizInRange(applied, vizCalendarRange(period)).length, title: `${label}: ${vizRangeLabel(vizCalendarRange(period))}. Weeks start Monday.` }));
  const missingDates = applied.filter((job) => vizDate(job.appliedDate) === null).length;
  const missionDetail = `This month ${mission.current.mission}/${mission.current.total} (${vizPercent(mission.current.mission, mission.current.total)}) · last month ${mission.previous.mission}/${mission.previous.total} (${vizPercent(mission.previous.mission, mission.previous.total)})`;
  const changeTitle = mission.relative !== null ? "Relative change in mission-driven share: (this month − last month) / last month." : mission.current.share === null || mission.previous.share === null ? "No comparison: one month has no applications." : "Relative change is undefined because last month's share was 0%. The percentage-point change is shown separately.";
  els.recordCount.textContent = `${applied.length} applications · references excluded`;
  els.jobList.replaceChildren();
  const dashboard = vizElement("section", "viz-dashboard");
  const intro = vizElement("div", "viz-intro");
  const title = vizElement("div");
  title.append(vizElement("p", "eyebrow", "YOUR SEARCH, IN PERSPECTIVE"),
    vizElement("h2", "viz-title", "Where could your next chapter lead?"),
    vizElement("p", "viz-description", `${applied.length} applications to explore. ${pending.length} jobs ready for a first move. ${jobs.length - all.length} references excluded. Select a chart to see its jobs.`));
  intro.append(title, vizJobTypeFilters(all.length - visible.length));
  dashboard.append(intro);
  const stats = vizElement("div", "viz-stat-grid");
  stats.append(
    vizStat("Ready for a first move", pending.length, "Saved jobs you haven’t applied to", "orange", priorityFigures),
    vizStat("Applications sent · all time", applied.length, `Calendar periods to date · Monday starts the week${missingDates ? ` · ${missingDates} undated included only in all time` : ""}`, "blue", timelines),
    vizStat("Average annual salary", vizMoney(pay.mean), `${pay.count}/${applied.length} applications with pay · hourly × 8 × 21 × 12`, "teal", [
      { label: "25th percentile", value: vizMoney(pay.p25), tone: "blue" },
      { label: "75th percentile", value: vizMoney(pay.p75), tone: "teal" },
    ]),
    vizStat("Public-purpose applications", vizPercent(publicPurpose.length, applied.length), `${publicPurpose.length}/${applied.length} tagged Govt or Poor. ${missionDetail}`, "purple", [
      { label: mission.relative !== null ? "month-over-month" : mission.previous.share === 0 && mission.current.share !== null ? "MoM · 0% baseline" : "MoM · missing month", value: vizSigned(mission.relative), tone: mission.relative < 0 ? "urgent" : "teal", title: changeTitle },
      { label: "percentage points", value: vizSigned(mission.points, " pp"), tone: "purple", title: changeTitle },
    ]),
  );
  dashboard.append(stats, vizFlowPanel(applied), vizSalaryPanel(applied), vizImpactPanel(applied), vizMapPanel(applied), vizActivityPanel(applied));
  els.jobList.append(dashboard);
}

// A job follows only its recorded milestones, then exactly one current outcome.
// Columns follow the tracker’s stage order; they do not infer event chronology.
function vizFlowModel(records) {
  const stageNodes = VIZ_STAGES.filter((stage) => records.some((job) => vizHasStage(job, stage.key)));
  const waiting = records.filter(vizAwaitingReply);
  const hasContactColumn = waiting.length || stageNodes.some((stage) => stage.key === "response");
  let nextColumn = hasContactColumn ? 2 : 1;
  const milestones = stageNodes.map((stage) => ({ ...stage, column: stage.key === "response" ? 1 : nextColumn++, jobs: records.filter((job) => vizHasStage(job, stage.key)) }));
  if (waiting.length) milestones.unshift({ key: "no-response", label: "No response", color: VIZ_COLORS.gray, column: 1, jobs: waiting });
  const nodes = [
    { key: "applied", label: "Applied", color: VIZ_COLORS.blue, column: 0, jobs: records },
    ...milestones,
    ...VIZ_OUTCOMES.map((outcome) => ({ ...outcome, key: outcome.label, column: nextColumn, jobs: records.filter((job) => vizOutcome(job) === outcome.label) })).filter((node) => node.jobs.length),
  ];
  const links = new Map();
  records.forEach((job) => {
    const path = ["applied", ...(vizAwaitingReply(job) ? ["no-response"] : stageNodes.filter((stage) => vizHasStage(job, stage.key)).map((stage) => stage.key)), vizOutcome(job)];
    path.slice(1).forEach((key, index) => {
      const id = `${path[index]}:${key}`;
      if (!links.has(id)) links.set(id, { source: path[index], target: key, jobs: [] });
      links.get(id).jobs.push(job);
    });
  });
  return { nodes, links: [...links.values()], columns: nextColumn + 1 };
}

function vizAwaitingReply(job) {
  return !getFinalStatusForForm(job) && !VIZ_STAGES.some((stage) => vizHasStage(job, stage.key));
}

function vizFlowPanel(allRecords) {
  const panel = vizPanel("01", "Every application has a story", "Follow the streams from application to where things stand today.", "viz-wide viz-flow-panel");
  panel.querySelector(".viz-panel-header").append(vizCalendarControl("flow", draw));
  const content = vizElement("div", "viz-flow-content");
  panel.append(content);
  const showJobs = vizDrilldown(panel);
  function draw() {
    content.replaceChildren();
    panel.querySelector(".viz-drilldown").hidden = true;
    const range = vizPeriodRange(vizState.flowPeriod, new Date(), vizState.flowDates);
    const records = vizInRange(allRecords, range);
    const missing = allRecords.filter((job) => vizDate(job.appliedDate) === null).length;
    content.append(vizElement("p", "viz-period-caption", `${vizRangeLabel(range)} · ${records.length} applications${range && missing ? ` · ${missing} undated excluded` : ""}`));
    if (!records.length) { content.append(vizElement("p", "viz-empty", allRecords.length ? "No applications in this date range. Try All time or another range." : "Your first application will start the stream.")); return; }
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
      const label = column === 0 ? "START" : column === model.columns - 1 ? "CURRENT OUTCOME" : columnNodes.some((node) => node.key === "no-response") ? "RESPONSE" : "RECORDED MILESTONE";
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
    content.append(chart, milestones, vizElement("p", "viz-note", "Width = applications. No response means still in progress with no recorded milestones; it is never classified as Ghosted. Other unrecorded steps are skipped. Milestones follow form order, not event dates."));
  }
  draw();
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
    vizSelect("Compare", [["annualized", "Yearly pay · hourly included"], ["salary", "Salary postings only"], ["hourly", "Hourly postings only"]], vizState.salaryMode, (value) => { vizState.salaryMode = value; draw(); }),
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
    if (vizState.salaryMode === "annualized") content.append(vizElement("p", "viz-method", "Salary postings use their annual midpoint. Hourly postings use average hourly pay × 8 hours × 21 days × 12 months (2,016 hours/year). Missing pay is excluded."));
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
  ring.style.setProperty("--impact-share", `${publicJobs.length / Math.max(records.length, 1) * 100}%`);
  ring.append(vizElement("strong", "", vizPercent(publicJobs.length, records.length)), vizElement("span", "", "public purpose"));
  ring.setAttribute("aria-label", `${publicJobs.length} public-purpose jobs out of ${records.length}. Show jobs tagged Govt or Poor.`);
  ring.addEventListener("click", () => showJobs("Public purpose · Govt or Poor", publicJobs));
  const caption = vizElement("div");
  caption.append(vizElement("h3", "", `${publicJobs.length} opportunities to serve`), vizElement("p", "viz-description", "Jobs whose company mission helps government or people in poverty. Each job counts once in this total."));
  hero.append(ring, caption);
  const groups = [
    ["Govt", "Government & public service", VIZ_COLORS.teal],
    ["Poor", "People in poverty", VIZ_COLORS.blue],
    ["Environment", "The environment", "#6f8b4e"],
    ["Startup", "Startups", VIZ_COLORS.purple],
    ["Rich", "Wealthy beneficiaries", VIZ_COLORS.orange],
  ];
  const known = groups.map(([key]) => key);
  [...new Set(records.flatMap((job) => job.mission || []))].filter((tag) => !known.includes(tag)).forEach((tag) => groups.push([tag, tag, VIZ_COLORS.gray]));
  groups.push(["", "Not tagged yet", VIZ_COLORS.gray]);
  const bars = vizElement("div", "viz-impact-bars");
  groups.forEach(([tag, label, color]) => {
    const matching = records.filter((job) => tag ? (job.mission || []).includes(tag) : !job.mission?.length);
    const button = vizElement("button", "viz-impact-row");
    button.type = "button";
    const track = vizElement("span", "viz-impact-track");
    const fill = vizElement("span");
    fill.style.width = `${matching.length / Math.max(records.length, 1) * 100}%`;
    fill.style.background = color;
    track.append(fill);
    button.append(vizElement("span", "", label), vizElement("strong", "", `${matching.length} · ${vizPercent(matching.length, records.length)}`), track);
    button.addEventListener("click", () => showJobs(label, matching));
    bars.append(button);
  });
  const waiting = publicJobs.filter((job) => !getFinalStatusForForm(job));
  const callout = vizElement("button", "viz-impact-callout", `${waiting.length} public-purpose ${waiting.length === 1 ? "application is" : "applications are"} still in progress →`);
  callout.type = "button";
  callout.addEventListener("click", () => showJobs("Public-purpose applications in progress", waiting));
  panel.append(hero, bars, callout, vizElement("p", "viz-note", "Based on your Helping tags, not an independent impact rating. Tags can overlap, so the bars may sum to more than 100%. Environment is shown separately."));
  const showJobs = vizDrilldown(panel);
  return panel;
}

function vizLocation(job) {
  const place = resolveJobLocation(job, typeof jobs === "undefined" ? [] : jobs);
  return { ...place, country: place.countryCode };
}

function vizLocationGroups(records) {
  const groups = new Map();
  records.forEach((job) => {
    const resolved = resolveJobLocation(job, records);
    const place = { ...resolved, country: resolved.countryCode };
    const key = `${place.country}|${normalizeLocationText(place.label)}|${place.precision}`;
    if (!groups.has(key)) groups.set(key, { ...place, key, jobs: [], rawValues: new Set() });
    const group = groups.get(key);
    group.jobs.push(job);
    if (place.raw) group.rawValues.add(place.raw);
  });
  return [...groups.values()].map((group) => ({ ...group, rawValues: [...group.rawValues] }))
    .sort((a, b) => b.jobs.length - a.jobs.length || a.label.localeCompare(b.label));
}

function vizProject(lon, lat, bounds) {
  const [west, east, south, north] = bounds;
  return [(lon - west) / (east - west) * 800, (north - lat) / (north - south) * 380];
}

function vizMapCountries(groups) {
  const keys = [...new Set(groups.map((group) => group.country))];
  return ["remote", "missing", ...keys.filter((key) => !["remote", "missing", "unmapped"].includes(key))
    .sort((a, b) => vizCountryLabel(a).localeCompare(vizCountryLabel(b))), ...(keys.includes("unmapped") ? ["unmapped"] : [])]
    .filter((key) => groups.some((group) => group.country === key));
}

function vizCountryLabel(key) {
  return ({ remote: "Remote", missing: "Location not recorded", us: "USA", gb: "UK", unmapped: "Country not recognized" })[key] || locationCountryLabel(key) || key;
}

function vizCountryBounds(key, places = []) {
  if (["remote", "missing"].includes(key)) return [-122, -106, 43, 51];
  let bounds;
  if (key === "us") bounds = [-126, -66, 24, 51];
  else if (key === "unmapped") bounds = [-180, 180, -60, 85];
  else {
    const [west, east, south, north] = VIZ_COUNTRIES[key]?.bounds || [-180, 180, -60, 85];
    const centerLon = (west + east) / 2;
    const centerLat = (south + north) / 2;
    const ratio = 800 / 380 / Math.max(.3, Math.cos(centerLat * Math.PI / 180));
    const height = Math.max((north - south) * 1.2, (east - west) * 1.2 / ratio, 2);
    bounds = [centerLon - height * ratio / 2, centerLon + height * ratio / 2, centerLat - height / 2, centerLat + height / 2];
  }
  const points = places.filter((place) => Number.isFinite(place.lon) && Number.isFinite(place.lat));
  if (!points.some((place) => place.lon < bounds[0] || place.lon > bounds[1] || place.lat < bounds[2] || place.lat > bounds[3])) return bounds;
  let [west, east, south, north] = bounds;
  points.forEach((place) => {
    west = Math.min(west, place.lon);
    east = Math.max(east, place.lon);
    south = Math.min(south, place.lat);
    north = Math.max(north, place.lat);
  });
  const lonPad = Math.max(1, (east - west) * .04);
  const latPad = Math.max(1, (north - south) * .04);
  west -= lonPad;
  east += lonPad;
  south -= latPad;
  north += latPad;
  const mapRatio = 800 / 380;
  const centerLon = (west + east) / 2;
  const centerLat = (south + north) / 2;
  if ((east - west) / (north - south) > mapRatio) {
    const height = (east - west) / mapRatio;
    south = centerLat - height / 2;
    north = centerLat + height / 2;
  } else {
    const width = (north - south) * mapRatio;
    west = centerLon - width / 2;
    east = centerLon + width / 2;
  }
  return [west, east, south, north];
}

function vizMapBackground(svg, bounds, country) {
  const intersects = (ring) => {
    const lons = ring.map((point) => point[0]);
    const lats = ring.map((point) => point[1]);
    return Math.max(...lons) >= bounds[0] && Math.min(...lons) <= bounds[1] && Math.max(...lats) >= bounds[2] && Math.min(...lats) <= bounds[3];
  };
  const path = (ring) => `M${ring.map(([lon, lat]) => vizProject(lon, lat, bounds).map((n) => n.toFixed(1)).join(",")).join("L")}`;
  const land = vizSvg("g", { fill: "#f5f4e9", stroke: "#c7d2c0", "stroke-width": 1, "stroke-linejoin": "round", "aria-hidden": "true" });
  VIZ_LAND.filter(intersects).forEach((ring) => land.append(vizSvg("path", { d: `${path(ring)}Z` })));
  svg.append(land);
  if (country === "us") {
    const states = vizSvg("g", { fill: "none", stroke: "#d4dacb", "stroke-width": .8, "aria-hidden": "true" });
    VIZ_STATE_LINES.filter(intersects).forEach((line) => states.append(vizSvg("path", { d: path(line) })));
    svg.append(states);
  }
}

function vizPlaceSummary(place) {
  const pay = vizPaySummary(place.jobs);
  const roles = [...new Set(place.jobs.flatMap((job) => job.roles?.length ? job.roles.map((role) => role === "Other" ? job.roleOther || "Other" : role) : job.roleOther ? [job.roleOther] : []))].sort();
  const outcomes = Object.fromEntries(VIZ_OUTCOMES.map(({ label }) => [label, place.jobs.filter((job) => vizOutcome(job) === label).length]));
  return { pay, roles, outcomes };
}

function vizLocationChoices(records) {
  const choices = LOCATION_DATABASE.map((place) => locationFieldsFromPlace(place, "manual"));
  records.forEach((job) => {
    const saved = savedJobLocation(job);
    if (saved && saved.precision !== "remote") choices.push(locationFieldsFromPlace(saved, "manual"));
  });
  return [...new Map(choices.filter((choice) => choice.locationCanonical)
    .map((choice) => [`${normalizeLocationText(choice.locationCanonical)}|${choice.locationCountryCode}`, choice])).values()]
    .sort((a, b) => a.locationCanonical.localeCompare(b.locationCanonical));
}

function vizGeocodeResult(result) {
  const address = result.address || {};
  const countryCode = String(address.country_code || "").toLowerCase() || "unmapped";
  const city = address.city || address.town || address.village || address.municipality || address.hamlet || "";
  const region = address.state || address.region || address.county || "";
  const subdivision = countryCode === "us" ? String(address["ISO3166-2-lvl4"] || "").split("-").at(-1) || region : "";
  const precision = city ? "city" : region ? "region" : address.country ? "country" : "unknown";
  const label = city ? `${city}${countryCode === "us" && subdivision ? `, ${subdivision}` : address.country ? `, ${address.country}` : ""}` : region ? `${region}${address.country ? `, ${address.country}` : ""}` : address.country || result.display_name;
  return locationFieldsFromPlace({ label, countryCode, country: address.country || locationCountryLabel(countryCode), region, city, lat: Number(result.lat), lon: Number(result.lon), precision }, "geocoded");
}

async function vizSearchLocations(query) {
  const delay = Math.max(0, 1000 - (Date.now() - vizLastLocationSearchAt));
  if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
  vizLastLocationSearchAt = Date.now();
  const parameters = new URLSearchParams({ q: query, format: "jsonv2", addressdetails: "1", limit: "5", "accept-language": "en" });
  const response = await fetch(`https://nominatim.openstreetmap.org/search?${parameters}`);
  if (!response.ok) throw new Error("Location search failed");
  return (await response.json()).map(vizGeocodeResult);
}

async function vizSaveLocationResolution(place, fields) {
  const rawKeys = new Set(place.rawValues.map(normalizeLocationText));
  const matches = jobs.filter((job) => rawKeys.has(normalizeLocationText(rawJobLocation(job))));
  const now = new Date().toISOString();
  await Promise.all(matches.map((job) => putJob(stripLegacyCompanyFields({ ...job, ...fields, updatedAt: now }))));
  await refreshJobs();
  const syncStatus = await safeSyncToConnectedFolder();
  showToast(syncStatus === "failed" ? "Location saved in this tab. Folder export failed; export before closing." : `Location saved for ${matches.length} ${matches.length === 1 ? "job" : "jobs"}.`);
}

function vizLocationEditor(place, records) {
  const editor = vizElement("div", "viz-location-editor");
  editor.append(vizElement("h4", "", `Resolve “${place.rawValues[0] || place.label}”`),
    vizElement("p", "viz-note", `${place.jobs.length} ${place.jobs.length === 1 ? "job uses" : "jobs use"} this location. Saving updates every matching job and reuses the result next time.`));

  const existing = vizElement("div", "viz-location-resolve-row");
  const selectLabel = vizElement("label", "viz-select", "Resolve to an existing place");
  const select = vizElement("select");
  const choices = vizLocationChoices(records);
  const chooseOption = vizElement("option", "", "Choose a saved place…");
  chooseOption.value = "";
  chooseOption.disabled = true;
  chooseOption.selected = true;
  select.append(chooseOption);
  choices.forEach((choice, index) => {
    const option = vizElement("option", "", `${choice.locationCanonical}${choice.locationPrecision === "metro" ? " · metro" : ""}`);
    option.value = String(index);
    select.append(option);
  });
  selectLabel.append(select);
  const useExisting = vizElement("button", "viz-location-action", "Use selected place");
  useExisting.type = "button";
  useExisting.disabled = true;
  select.addEventListener("change", () => { useExisting.disabled = select.value === ""; });
  useExisting.addEventListener("click", () => {
    const choice = choices[Number(select.value)];
    if (choice) vizSaveLocationResolution(place, choice);
  });
  existing.append(selectLabel, useExisting);

  const search = vizElement("div", "viz-location-search");
  const searchButton = vizElement("button", "viz-location-action", "Find suggestions");
  searchButton.type = "button";
  const searchStatus = vizElement("p", "viz-location-search-status", "Search runs only when you choose this button.");
  searchStatus.setAttribute("aria-live", "polite");
  const results = vizElement("div", "viz-location-suggestions");
  searchButton.addEventListener("click", async () => {
    searchButton.disabled = true;
    searchStatus.textContent = "Searching OpenStreetMap…";
    results.replaceChildren();
    try {
      const suggestions = await vizSearchLocations(place.rawValues[0] || place.label);
      searchStatus.textContent = suggestions.length ? "Choose the correct result to save it." : "No suggestions found. Create the location manually below.";
      suggestions.forEach((suggestion) => {
        const button = vizElement("button", "viz-location-suggestion");
        button.type = "button";
        button.append(vizElement("strong", "", suggestion.locationCanonical), vizElement("small", "", [suggestion.locationRegion, suggestion.locationCountry].filter(Boolean).join(" · ")));
        button.addEventListener("click", () => vizSaveLocationResolution(place, suggestion));
        results.append(button);
      });
    } catch (error) {
      searchStatus.textContent = "Suggestions could not be loaded. You can still create the location manually.";
    } finally {
      searchButton.disabled = false;
    }
  });
  search.append(searchButton, searchStatus, results);

  const form = vizElement("form", "viz-location-form");
  const formTitle = vizElement("h5", "", "Create a city, metro, or region");
  const field = (caption, name, type = "text") => {
    const label = vizElement("label", "", caption);
    const input = vizElement("input");
    input.name = name;
    input.type = type;
    label.append(input);
    return { label, input };
  };
  const labelField = field("Canonical label", "label");
  labelField.input.value = place.label;
  labelField.input.required = true;
  const regionField = field("State or region", "region");
  const cityField = field("City or metro", "city");
  const latField = field("Latitude", "lat", "number");
  latField.input.step = "any";
  latField.input.min = "-90";
  latField.input.max = "90";
  const lonField = field("Longitude", "lon", "number");
  lonField.input.step = "any";
  lonField.input.min = "-180";
  lonField.input.max = "180";
  const countryLabel = vizElement("label", "", "Country");
  const countrySelect = vizElement("select");
  countrySelect.name = "country";
  const unknownCountry = vizElement("option", "", "Country not recognized");
  unknownCountry.value = "unmapped";
  countrySelect.append(unknownCountry);
  Object.keys(VIZ_COUNTRIES).sort((a, b) => vizCountryLabel(a).localeCompare(vizCountryLabel(b))).forEach((code) => {
    const option = vizElement("option", "", vizCountryLabel(code));
    option.value = code;
    countrySelect.append(option);
  });
  countrySelect.value = place.country === "unmapped" ? "unmapped" : place.country;
  countryLabel.append(countrySelect);
  const precisionLabel = vizElement("label", "", "Precision");
  const precision = vizElement("select");
  precision.name = "precision";
  [["city", "City"], ["metro", "Metro area"], ["region", "Region"], ["country", "Country only"]].forEach(([value, caption]) => {
    const option = vizElement("option", "", caption);
    option.value = value;
    precision.append(option);
  });
  precisionLabel.append(precision);
  const formStatus = vizElement("p", "viz-location-form-status");
  formStatus.setAttribute("role", "alert");
  const formActions = vizElement("div", "viz-location-form-actions");
  const save = vizElement("button", "viz-location-action primary", "Save new location");
  save.type = "submit";
  const leave = vizElement("button", "viz-location-action quiet", "Leave unmapped");
  leave.type = "button";
  leave.addEventListener("click", () => vizSaveLocationResolution(place, locationFieldsFromPlace({ label: place.label, countryCode: place.country === "unmapped" ? "" : place.country, precision: "unknown" }, "manual")));
  formActions.append(save, leave);
  form.append(formTitle, labelField.label, countryLabel, regionField.label, cityField.label, precisionLabel, latField.label, lonField.label, formStatus, formActions);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const selectedPrecision = data.get("precision");
    const region = String(data.get("region") || "").trim();
    const city = String(data.get("city") || "").trim();
    const lat = locationCoordinate(data.get("lat"));
    const lon = locationCoordinate(data.get("lon"));
    if (["city", "metro"].includes(selectedPrecision) && !city) {
      formStatus.textContent = "Enter the city or metro name for this location.";
      return;
    }
    if (selectedPrecision === "region" && !region) {
      formStatus.textContent = "Enter the state or region name for this location.";
      return;
    }
    if (["city", "metro"].includes(selectedPrecision) && (lat === null || lon === null)) {
      formStatus.textContent = "City and metro locations need latitude and longitude so they can be placed on the map.";
      return;
    }
    const countryCode = data.get("country");
    vizSaveLocationResolution(place, locationFieldsFromPlace({ label: String(data.get("label") || "").trim(), countryCode: countryCode === "unmapped" ? "" : countryCode, region, city, lat: lat ?? "", lon: lon ?? "", precision: selectedPrecision }, "manual"));
  });

  const privacy = vizElement("p", "viz-note");
  const osm = vizElement("a", "", "OpenStreetMap Nominatim");
  osm.href = "https://nominatim.openstreetmap.org/";
  osm.target = "_blank";
  osm.rel = "noopener noreferrer";
  const policy = vizElement("a", "", "usage policy");
  policy.href = "https://operations.osmfoundation.org/policies/nominatim/";
  policy.target = "_blank";
  policy.rel = "noopener noreferrer";
  privacy.append("Suggestions use ", osm, ". The raw location text is sent only after you choose Find suggestions. Results are saved in your jobs CSV. ", policy, ".");
  editor.append(existing, search, form, privacy);
  return editor;
}

function vizLocationDetail(place, showJobs) {
  const detail = vizElement("aside", "viz-location-detail");
  if (!place) {
    detail.append(vizElement("p", "viz-empty", "Choose a location to see its pay, roles, and outcomes."));
    return detail;
  }
  const { pay, roles, outcomes } = vizPlaceSummary(place);
  detail.append(vizElement("span", "viz-location-kicker", place.precision === "metro" ? "Metro area" : place.precision === "region" ? "Region" : place.kind === "remote" ? "Remote work" : place.kind === "missing" ? "Missing location" : "Location"),
    vizElement("h3", "", place.label));
  const stats = vizElement("div", "viz-location-detail-stats");
  [[place.jobs.length, "applications"], [vizMoney(pay.mean), `average pay · ${pay.count}/${place.jobs.length} covered`]].forEach(([value, caption]) => {
    const item = vizElement("div");
    item.append(vizElement("strong", "", value), vizElement("small", "", caption));
    stats.append(item);
  });
  const outcomeList = vizElement("div", "viz-location-outcomes");
  Object.entries(outcomes).filter(([, count]) => count).forEach(([label, count]) => outcomeList.append(vizElement("span", "", `${label} ${count}`)));
  const tags = vizElement("div", "viz-tooltip-roles");
  (roles.length ? roles : ["No roles recorded"]).forEach((role) => tags.append(vizElement("span", "", role)));
  const jobsButton = vizElement("button", "viz-location-action", `Show ${place.jobs.length} ${place.jobs.length === 1 ? "job" : "jobs"}`);
  jobsButton.type = "button";
  jobsButton.addEventListener("click", () => showJobs(place.label, place.jobs));
  detail.append(stats, outcomeList, tags, jobsButton);
  return detail;
}

function vizMapPanel(records) {
  const panel = vizPanel("04", "Where is the opportunity?", "Explore applied jobs by country and location, then resolve anything the map does not recognize.", "viz-map-panel viz-wide");
  const groups = vizLocationGroups(records);
  const countries = vizMapCountries(groups);
  if (!countries.includes(vizState.region)) vizState.region = countries[0] || "remote";
  const countryControls = vizElement("div", "viz-map-tabs");
  countryControls.setAttribute("role", "group");
  countryControls.setAttribute("aria-label", "Location view");
  countries.forEach((key) => {
    const count = groups.filter((place) => place.country === key).reduce((sum, place) => sum + place.jobs.length, 0);
    const button = vizElement("button", "", `${vizCountryLabel(key)} · ${count}`);
    button.type = "button";
    button.dataset.region = key;
    button.addEventListener("click", () => { vizState.region = key; vizState.mapSelected = ""; draw(); });
    countryControls.append(button);
  });
  const metricControls = vizElement("div", "viz-map-metrics");
  metricControls.setAttribute("role", "group");
  metricControls.setAttribute("aria-label", "Map measure");
  [["count", "Job count"], ["pay", "Average pay"]].forEach(([value, caption]) => {
    const button = vizElement("button", "", caption);
    button.type = "button";
    button.dataset.metric = value;
    button.addEventListener("click", () => { vizState.mapMetric = value; draw(); });
    metricControls.append(button);
  });
  const toolbar = vizElement("div", "viz-map-toolbar");
  toolbar.append(countryControls, metricControls);
  const summary = vizElement("div", "viz-map-summary");
  const map = vizElement("div", "viz-map");
  const detail = vizElement("div", "viz-location-detail-wrap");
  const layout = vizElement("div", "viz-map-layout");
  layout.append(map, detail);
  const coverage = vizElement("p", "viz-note");
  const locations = vizElement("div", "viz-location-list");
  const review = vizElement("section", "viz-location-review");
  panel.append(toolbar, summary, layout, coverage, locations, review,
    vizElement("p", "viz-note", "Count view sizes bubbles by applications. Pay view sizes and labels them by average annualized pay; hourly pay uses × 2,016. Remote and missing locations are separate summaries and never appear as geographic pins."));
  const attribution = vizElement("p", "viz-note");
  const source = vizElement("a", "", "Natural Earth");
  source.href = "https://www.naturalearthdata.com/";
  source.target = "_blank";
  source.rel = "noopener noreferrer";
  attribution.append("Map outlines: ", source, " · location matching starts with the bundled local catalog.");
  panel.append(attribution);
  const showJobs = vizDrilldown(panel);

  function choosePlace(place, openJobs = false) {
    vizState.mapSelected = place.key;
    draw();
    if (openJobs) showJobs(place.label, place.jobs);
  }

  function draw() {
    panel.querySelector(".viz-drilldown").hidden = true;
    countryControls.querySelectorAll("button").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.region === vizState.region)));
    metricControls.querySelectorAll("button").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.metric === vizState.mapMetric)));
    const country = vizState.region;
    const selected = groups.filter((place) => place.country === country);
    const count = selected.reduce((sum, place) => sum + place.jobs.length, 0);
    const visible = selected.filter((place) => place.kind === "mapped");
    const needsReview = selected.filter((place) => place.kind === "unmapped" && !place.reviewed);
    const selectedPay = vizPaySummary(selected.flatMap((place) => place.jobs));
    if (!selected.some((place) => place.key === vizState.mapSelected)) vizState.mapSelected = selected[0]?.key || "";
    const activePlace = selected.find((place) => place.key === vizState.mapSelected) || null;
    summary.replaceChildren();
    [[count, "applications"], [visible.length, "mapped places"], [vizMoney(selectedPay.mean), `${selectedPay.count}/${count} with pay`], [needsReview.reduce((sum, place) => sum + place.jobs.length, 0), "need review"]].forEach(([value, caption]) => {
      const item = vizElement("div");
      item.append(vizElement("strong", "", value), vizElement("small", "", caption));
      summary.append(item);
    });
    detail.replaceChildren(vizLocationDetail(activePlace, showJobs));
    metricControls.hidden = ["remote", "missing"].includes(country);

    if (["remote", "missing"].includes(country)) {
      const message = country === "remote" ? "Remote applications are summarized separately because they do not have a truthful map position." : "These applications have no recorded location. Add one in the job form when it becomes known.";
      const special = vizElement("div", `viz-map-special ${country}`);
      special.append(vizElement("strong", "", count), vizElement("span", "", vizCountryLabel(country)), vizElement("p", "", message));
      map.replaceChildren(special);
    } else {
      const bounds = vizCountryBounds(country, visible);
      const tooltip = vizElement("div", "viz-map-tooltip");
      tooltip.id = "viz-map-tooltip";
      tooltip.setAttribute("role", "tooltip");
      tooltip.hidden = true;
      const svg = vizSvg("svg", { viewBox: "0 0 800 380", role: "group", "aria-label": `${vizCountryLabel(country)} map showing ${vizState.mapMetric === "pay" ? "average annualized pay" : "application count"} by location.` });
      vizMapBackground(svg, bounds, country);
      const maxCount = Math.max(1, ...visible.map((place) => place.jobs.length));
      const maxPay = Math.max(1, ...visible.map((place) => vizPlaceSummary(place).pay.mean || 0));
      [...visible].sort((a, b) => b.jobs.length - a.jobs.length).forEach((place) => {
        const [x, y] = vizProject(place.lon, place.lat, bounds);
        const { pay, roles } = vizPlaceSummary(place);
        const radius = vizState.mapMetric === "pay" ? pay.mean ? 17 + 9 * Math.sqrt(pay.mean / maxPay) : 12 : 9 + 11 * Math.sqrt(place.jobs.length / maxCount);
        const marker = vizSvg("g", { class: `viz-map-marker${pay.mean ? "" : " no-pay"}` });
        const markerText = vizState.mapMetric === "pay" ? pay.mean ? vizMoney(pay.mean) : "—" : place.jobs.length;
        marker.append(vizSvg("circle", { cx: x, cy: y, r: radius, fill: VIZ_COLORS.teal, "fill-opacity": pay.mean || vizState.mapMetric === "count" ? ".82" : ".35", stroke: "#fffdf8", "stroke-width": 2 }),
          vizSvg("text", { x, y: y + 4, "text-anchor": "middle", class: `viz-map-count${vizState.mapMetric === "pay" ? " pay" : ""}` }, markerText));
        const description = `${place.label}: ${place.jobs.length} applications. Average annual pay ${vizMoney(pay.mean)}, ${pay.count} with pay. Roles: ${roles.join(", ") || "Not recorded"}.`;
        vizActivateSvg(marker, description, () => { choosePlace(place, true); });
        marker.querySelector("title").remove();
        marker.setAttribute("aria-describedby", tooltip.id);
        const showPopup = () => {
          tooltip.replaceChildren(vizElement("strong", "", place.label), vizElement("span", "viz-tooltip-pay", `${vizMoney(pay.mean)} / year · average`), vizElement("small", "", `${place.jobs.length} applications · ${pay.count} with pay`));
          const tags = vizElement("div", "viz-tooltip-roles");
          (roles.length ? roles : ["No roles recorded"]).forEach((role) => tags.append(vizElement("span", "", role)));
          tooltip.append(tags);
          tooltip.hidden = false;
          const mapWidth = map.clientWidth;
          const mapHeight = map.clientHeight;
          tooltip.style.left = `${Math.max(8, Math.min(mapWidth - tooltip.offsetWidth - 8, x / 800 * mapWidth + 14))}px`;
          tooltip.style.top = `${Math.max(8, Math.min(mapHeight - tooltip.offsetHeight - 8, y / 380 * mapHeight - tooltip.offsetHeight - 12))}px`;
        };
        marker.addEventListener("mouseenter", showPopup);
        marker.addEventListener("focus", showPopup);
        marker.addEventListener("mouseleave", () => { if (document.activeElement !== marker) tooltip.hidden = true; });
        marker.addEventListener("blur", () => { tooltip.hidden = true; });
        marker.addEventListener("keydown", (event) => { if (event.key === "Escape") tooltip.hidden = true; });
        svg.append(marker);
      });
      if (!visible.length) svg.append(vizSvg("text", { x: 400, y: 190, "text-anchor": "middle", class: "viz-svg-label" }, count ? "Resolve a location below to add its pin" : "No applications here yet"));
      map.replaceChildren(svg, tooltip);
    }

    coverage.textContent = `${count} of ${records.length} applications · ${vizCountryLabel(country)}${needsReview.length ? ` · ${needsReview.reduce((sum, place) => sum + place.jobs.length, 0)} awaiting location review` : ""}`;
    locations.replaceChildren();
    const ordered = [...selected].sort((a, b) => vizState.mapMetric === "pay" ? (vizPlaceSummary(b).pay.mean || -1) - (vizPlaceSummary(a).pay.mean || -1) : b.jobs.length - a.jobs.length || a.label.localeCompare(b.label));
    ordered.forEach((place) => {
      const { pay, outcomes } = vizPlaceSummary(place);
      const button = vizElement("button", `viz-location ${place.kind}${place.key === vizState.mapSelected ? " selected" : ""}`);
      button.type = "button";
      const label = vizElement("span", "", place.label);
      label.append(vizElement("small", "", place.kind === "unmapped" ? place.reviewed ? "Saved without coordinates" : "Needs location review" : `${pay.count}/${place.jobs.length} with pay · ${Object.entries(outcomes).filter(([, value]) => value).map(([name, value]) => `${name} ${value}`).join(" · ")}`));
      const value = vizElement("strong", "", vizState.mapMetric === "pay" ? vizMoney(pay.mean) : place.jobs.length);
      button.append(label, value);
      button.addEventListener("click", () => choosePlace(place, true));
      locations.append(button);
    });

    review.replaceChildren();
    if (needsReview.length) {
      review.append(vizElement("h3", "", `Needs location review · ${needsReview.length}`), vizElement("p", "viz-note", "Resolve these raw locations once. The saved country, city, coordinates, precision, and source are then reused by matching jobs."));
      const queue = vizElement("div", "viz-location-review-queue");
      const editor = vizElement("div");
      needsReview.forEach((place) => {
        const row = vizElement("div", "viz-location-review-row");
        const text = vizElement("span");
        text.append(vizElement("strong", "", place.rawValues[0] || place.label), vizElement("small", "", `${place.jobs.length} ${place.jobs.length === 1 ? "job" : "jobs"} · ${place.country === "unmapped" ? "country unknown" : vizCountryLabel(place.country)}`));
        const button = vizElement("button", "viz-location-action quiet", "Review");
        button.type = "button";
        button.addEventListener("click", () => { editor.replaceChildren(vizLocationEditor(place, jobs)); editor.scrollIntoView({ behavior: "smooth", block: "nearest" }); });
        row.append(text, button);
        queue.append(row);
      });
      review.append(queue, editor);
    }
  }
  draw();
  return panel;
}

function vizDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return null;
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value ? timestamp : null;
}

function vizActivityModel(records, range = null, requestedUnit = "auto") {
  const selected = vizInRange(records, range);
  const dated = selected.map((job) => ({ job, date: vizDate(job.appliedDate) })).filter((entry) => entry.date !== null);
  const missing = records.filter((job) => vizDate(job.appliedDate) === null).length;
  const bins = [];
  const first = range?.start ?? (dated.length ? Math.min(...dated.map((entry) => entry.date)) : null);
  const last = range ? range.end - VIZ_DAY : dated.length ? Math.max(...dated.map((entry) => entry.date)) : null;
  const days = first === null ? 0 : (last - first) / VIZ_DAY + 1;
  let unit = requestedUnit === "auto" ? range && days <= 31 ? "day" : range && days <= 180 ? "week" : "month" : requestedUnit;
  // Bound the number of visible bars when a long custom range is grouped daily.
  if (unit === "day" && days > 366) unit = "week";
  if (unit === "week" && days > 366 * 7) unit = "month";
  if (first !== null) {
    const date = new Date(first);
    const start = unit === "month" ? Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1) : unit === "week" ? first - (date.getUTCDay() + 6) % 7 * VIZ_DAY : first;
    let cursor = start;
    const formatter = new Intl.DateTimeFormat("en-US", { month: "short", ...(unit === "month" ? { year: "2-digit" } : { day: "numeric" }), timeZone: "UTC" });
    while (cursor <= last) {
      const date = new Date(cursor);
      const end = unit === "month" ? Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1) : cursor + (unit === "week" ? 7 : 1) * VIZ_DAY;
      bins.push({ key: date.toISOString().slice(0, unit === "month" ? 7 : 10), start: cursor, end,
        label: formatter.format(cursor), jobs: dated.filter((entry) => entry.date >= cursor && entry.date < end).map((entry) => entry.job) });
      cursor = end;
    }
  }
  return { bins, missing, unit, selected, dated };
}

function vizActivityMetrics(records, range, now = new Date()) {
  const selected = vizInRange(records, range);
  const dated = selected.filter((job) => vizDate(job.appliedDate) !== null);
  const first = dated.length ? Math.min(...dated.map((job) => vizDate(job.appliedDate))) : vizToday(now);
  const days = range ? (range.end - range.start) / VIZ_DAY : Math.max(1, (vizToday(now) - first) / VIZ_DAY + 1);
  const replyDays = selected.flatMap((job) => {
    const applied = vizDate(job.appliedDate);
    if (applied === null) return [];
    const dates = [...VIZ_STAGES.map((stage) => job[`${stage.key}Date`]), ...(["Accepted", "Rejected"].includes(vizOutcome(job)) ? [job.finalStatusDate] : [])]
      .map(vizDate).filter((date) => date !== null && date >= applied);
    return dates.length ? [(Math.min(...dates) - applied) / VIZ_DAY] : [];
  }).sort((a, b) => a - b);
  const middle = Math.floor(replyDays.length / 2);
  const medianReply = replyDays.length ? replyDays.length % 2 ? replyDays[middle] : (replyDays[middle - 1] + replyDays[middle]) / 2 : null;
  const previous = range ? vizInRange(records, { start: range.start - (range.end - range.start), end: range.start }).length : null;
  return { count: selected.length, pace: dated.length / (days / 7), engaged: selected.filter((job) => VIZ_STAGES.some((stage) => vizHasStage(job, stage.key))).length,
    interviews: selected.filter((job) => vizHasStage(job, "interview")).length, waiting: selected.filter(vizAwaitingReply).length,
    mission: selected.filter(vizIsPublicPurpose).length, meanPay: vizPaySummary(selected).mean, payCount: vizPaySummary(selected).count,
    medianReply, replyCount: replyDays.length, previous, volumeChange: previous > 0 ? (selected.length - previous) / previous * 100 : null };
}

function vizActivityPanel(records) {
  const panel = vizPanel("05", "The rhythm of your search", "Change the window, find your pace, and see what comes back.", "viz-activity-panel");
  panel.querySelector(".viz-panel-header").append(vizCalendarControl("activity", draw));
  const controls = vizElement("div", "viz-controls");
  controls.append(vizSelect("Group applications", [["auto", "Automatic"], ["day", "Daily"], ["week", "Weekly"], ["month", "Monthly"]], vizState.activityUnit, (value) => { vizState.activityUnit = value; draw(); }));
  const legend = vizElement("div", "viz-legend");
  VIZ_OUTCOMES.forEach((outcome) => {
    const item = vizElement("span", "", outcome.label);
    item.style.setProperty("--legend-color", outcome.color);
    legend.append(item);
  });
  const content = vizElement("div", "viz-activity-content");
  panel.append(controls, legend, content);
  const showJobs = vizDrilldown(panel);
  function draw() {
    content.replaceChildren();
    panel.querySelector(".viz-drilldown").hidden = true;
    const range = vizPeriodRange(vizState.activityPeriod, new Date(), vizState.activityDates);
    const { bins, missing, unit, dated } = vizActivityModel(records, range, vizState.activityUnit);
    const metrics = vizActivityMetrics(records, range);
    content.append(vizElement("p", "viz-period-caption", `${vizRangeLabel(range)} · ${unit === "day" ? "Daily" : unit === "week" ? "Weekly · Monday starts" : "Monthly"} bars`));
    if (!dated.length) content.append(vizElement("p", "viz-empty", "No dated applications in this window. Try another range or add application dates."));
    const max = Math.max(...bins.map((bin) => bin.jobs.length), 1);
    const plot = vizElement("div", "viz-activity-plot");
    const chart = vizElement("div", "viz-months");
    bins.forEach((bin) => {
      const column = vizElement("div", "viz-month");
      const total = vizElement("button", "viz-month-total", bin.jobs.length);
      total.type = "button";
      const label = `${unit === "week" ? "Week of " : ""}${bin.label}`;
      total.setAttribute("aria-label", `${label}: ${bin.jobs.length} applications. Show jobs.`);
      total.addEventListener("click", () => showJobs(label, bin.jobs));
      const bar = vizElement("div", "viz-month-bar");
      bar.style.height = `${bin.jobs.length / max * 180}px`;
      VIZ_OUTCOMES.forEach((outcome) => {
        const matching = bin.jobs.filter((job) => vizOutcome(job) === outcome.label);
        if (!matching.length) return;
        const segment = vizElement("button", "viz-month-segment");
        segment.type = "button";
        segment.style.height = `${matching.length / bin.jobs.length * 100}%`;
        segment.style.background = outcome.color;
        segment.title = `${label} · ${outcome.label}: ${matching.length}`;
        segment.setAttribute("aria-label", segment.title);
        segment.addEventListener("click", () => showJobs(`${label} · ${outcome.label}`, matching));
        bar.append(segment);
      });
      column.append(total, bar, vizElement("span", "viz-month-label", bin.label));
      chart.append(column);
    });
    plot.append(chart);
    if (bins.length) content.append(plot);
    const metricGrid = vizElement("div", "viz-activity-metrics");
    const volumeDetail = metrics.previous === null ? "All selected applications" : metrics.volumeChange !== null ? `${vizSigned(metrics.volumeChange)} vs previous ${Math.round((range.end - range.start) / VIZ_DAY)} days` : metrics.count ? "New activity · previous window had 0" : "No activity in either window";
    const figures = [
      ["Applications", metrics.count, volumeDetail],
      ["Applications / week", Number(metrics.pace.toFixed(1)), range ? "Average across the full selected window" : "Dated applications since the first, through today"],
      ["Reached a milestone", vizPercent(metrics.engaged, metrics.count), `${metrics.engaged} with a response, screen, interview or assessment`],
      ["Reached an interview", vizPercent(metrics.interviews, metrics.count), `${metrics.interviews} recorded interviews`],
      ["Awaiting a first reply", metrics.waiting, "In progress with no recorded milestones"],
      ["Mission-driven share", vizPercent(metrics.mission, metrics.count), `${metrics.mission} tagged Govt or Poor`],
      ["Average annual pay", vizMoney(metrics.meanPay), `${metrics.payCount} with pay · hourly annualized`],
      ["Median days to first reply", metrics.medianReply === null ? "—" : Number(metrics.medianReply.toFixed(1)), `${metrics.replyCount} with valid application and reply dates`],
    ];
    figures.forEach(([label, value, detail]) => {
      const item = vizElement("div", "viz-activity-metric");
      item.append(vizElement("span", "", label), vizElement("strong", "", value), vizElement("small", "", detail));
      metricGrid.append(item);
    });
    content.append(metricGrid, vizElement("p", "viz-note", `Dates select the application cohort; outcomes and milestones reflect its current saved state. ${missing} applications without valid dates are excluded from dated windows and bars, but included in all-time totals. First reply uses the earliest dated milestone or accepted/rejected decision; missing and negative intervals are excluded.`));
  }
  draw();
  return panel;
}
