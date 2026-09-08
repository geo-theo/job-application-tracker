"use strict";

// Charts use non-reference applications; only the ready-to-apply card uses pending jobs.
const vizState = { excludedJobTypes: [], salaryGroup: "industry", salaryMode: "annualized", region: "remote", flowPeriod: "all", activityPeriod: "all", activityUnit: "auto", flowDates: {}, activityDates: {} };
const VIZ_ANNUAL_HOURS = 8 * 21 * 12;
const VIZ_DAY = 86400000;
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
  const priorityFigures = [["Urgent", "urgent"], ["High", "high"], ["Medium", "medium"], ["Low", "low"]]
    .map(([priority, tone]) => ({ label: priority, tone, value: pending.filter((job) => job.priority === priority).length }));
  const unranked = pending.filter((job) => !["Urgent", "High", "Medium", "Low"].includes(job.priority)).length;
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

// Offline city centers and explicit aliases for the locations in this search.
// Unknown locations stay in the list instead of being assigned guessed coordinates.
const VIZ_PLACES = [
  ["Missoula, MT", -113.994, 46.872, ["Missoula", "Missoula, MT"], "us"],
  ["Seattle, WA", -122.332, 47.606, ["Seattle", "Seattle, WA"], "us"],
  ["Redlands, CA", -117.182, 34.055, ["Redlands", "Redlands, CA"], "us"],
  ["Washington, DC", -77.037, 38.907, ["Washington, DC", "Washington DC"], "us"],
  ["DMV region", -77.15, 39.0, ["DMV", "DMV region"], "us"],
  ["Reston, VA", -77.357, 38.958, ["Reston, VA", "Reston"], "us"],
  ["San Bruno, CA", -122.411, 37.63, ["San Bruno, CA", "San Bruno"], "us"],
  ["Helena, MT", -112.037, 46.589, ["Helena, MT", "Helena"], "us"],
  ["Glendive, MT", -104.712, 47.105, ["Glendive, MT", "Glendive"], "us"],
  ["Bozeman, MT", -111.043, 45.677, ["Bozeman, MT", "Bozeman"], "us"],
  ["Arlee, MT", -114.085, 47.163, ["Arlee, MT", "Arlee"], "us"],
  ["Austin, TX", -97.743, 30.267, ["Austin, TX", "Austin"], "us"],
  ["Annecy, France", 6.129, 45.899, ["Annecy, France", "Annecy"], "fr"],
  ["Nanterre, France", 2.207, 48.892, ["Nanterre, France", "Nanterre, Île-de-France, France", "Nanterre"], "fr"],
  ["Rueil, France", 2.181, 48.877, ["Rueil, France", "Rueil-Malmaison, France"], "fr"],
  ["Vélizy-Villacoublay, France", 2.19, 48.782, ["Vélizy-Villacoublay, Yvelines, France", "Vélizy-Villacoublay, France"], "fr"],
  ["Cardiff, UK", -3.18, 51.481, ["Cardiff, United Kingdom", "Cardiff, UK", "Cardiff"], "gb"],
  ["Silicon Valley", -122.04, 37.36, ["Silicon Valley", "Silicon Valley, CA", "Silicon Valley area", "Silicon Valley, USA"], "us"],
  ["Los Angeles area", -118.244, 34.052, ["Los Angeles", "Los Angeles area", "Los Angeles, CA", "Los Angeles area, CA", "Greater Los Angeles", "LA area"], "us"],
  ["London area", -.128, 51.507, ["London", "London area", "London, UK", "London area, UK", "London, United Kingdom", "Greater London"], "gb"],
  ["Paris area", 2.352, 48.857, ["Paris", "Paris area", "Paris, France", "Paris area, France", "Greater Paris"], "fr"],
  ["Amsterdam area", 4.904, 52.368, ["Amsterdam", "Amsterdam area", "Amsterdam, Netherlands", "Amsterdam area, Netherlands", "Amsterdam, The Netherlands"], "nl"],
];

function vizNormalizePlace(value) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\./g, "").replace(/,\s*/g, ", ").replace(/\s+/g, " ").trim();
}

function vizCountry(raw) {
  const suffix = vizNormalizePlace(raw.split(",").pop());
  if (["usa", "us", "united states", "united states of america"].includes(suffix)) return "us";
  if (["uk", "gb", "united kingdom", "england", "scotland", "wales", "northern ireland"].includes(suffix)) return "gb";
  if (suffix === "the netherlands") return "nl";
  // State abbreviations need a comma so a bare country code is not misclassified.
  if (raw.includes(",") && /^(AL|AK|AZ|AR|CA|CO|CT|DE|DC|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)$/.test(raw.split(",").pop().trim())) return "us";
  return Object.entries(VIZ_COUNTRIES).find(([, country]) => country.aliases.some((alias) => vizNormalizePlace(alias) === suffix))?.[0] || "unmapped";
}

function vizLocation(job) {
  const raw = (job.location || (job.locationChoice === "Other" ? job.locationOther : job.locationChoice) || "").trim();
  if (!raw) return { label: "Location not recorded", kind: "missing", country: "remote" };
  if (/^remote(?:$|[\s,(/-])/i.test(raw)) return { label: "Remote", kind: "remote", country: "remote" };
  const country = vizCountry(raw);
  const normalized = vizNormalizePlace(raw);
  const withoutCountry = raw.split(",").slice(0, -1).join(",");
  const place = VIZ_PLACES.find((entry) => entry[3].some((alias) => vizNormalizePlace(alias) === normalized ||
    (entry[4] === country && vizNormalizePlace(alias) === vizNormalizePlace(withoutCountry))));
  return place ? { label: place[0], lon: place[1], lat: place[2], country: place[4], kind: "mapped" } : { label: raw, kind: "unmapped", country };
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

function vizMapCountries(groups) {
  return ["remote", "us", "fr", "gb", ...new Set(groups.map((group) => group.country))].filter((key, index, keys) => keys.indexOf(key) === index);
}

function vizCountryLabel(key) {
  return ({ remote: "Remote", us: "USA", gb: "UK", unmapped: "Unmapped" })[key] || VIZ_COUNTRIES[key]?.label || key;
}

function vizCountryBounds(key) {
  if (key === "remote") return [-122, -106, 43, 51];
  if (key === "us") return [-126, -66, 24, 51];
  if (key === "unmapped") return [-180, 180, -60, 85];
  const [west, east, south, north] = VIZ_COUNTRIES[key]?.bounds || [-180, 180, -60, 85];
  const centerLon = (west + east) / 2;
  const centerLat = (south + north) / 2;
  const ratio = 800 / 380 / Math.max(.3, Math.cos(centerLat * Math.PI / 180));
  const height = Math.max((north - south) * 1.2, (east - west) * 1.2 / ratio, 2);
  return [centerLon - height * ratio / 2, centerLon + height * ratio / 2, centerLat - height / 2, centerLat + height / 2];
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
  if (["us", "remote"].includes(country)) {
    const states = vizSvg("g", { fill: "none", stroke: "#d4dacb", "stroke-width": .8, "aria-hidden": "true" });
    VIZ_STATE_LINES.filter(intersects).forEach((line) => states.append(vizSvg("path", { d: path(line) })));
    svg.append(states);
  }
}

function vizPlaceSummary(place) {
  const pay = vizPaySummary(place.jobs);
  const roles = [...new Set(place.jobs.flatMap((job) => job.roles?.length ? job.roles.map((role) => role === "Other" ? job.roleOther || "Other" : role) : job.roleOther ? [job.roleOther] : []))].sort();
  return { pay, roles };
}

function vizMapPanel(records) {
  const panel = vizPanel("04", "A world of possibilities", "Your applications, country by country. Hover over a pin for pay and roles.", "viz-map-panel");
  const groups = vizLocationGroups(records);
  const countries = vizMapCountries(groups);
  if (!countries.includes(vizState.region)) vizState.region = "remote";
  const controls = vizElement("div", "viz-map-tabs");
  controls.setAttribute("role", "group");
  controls.setAttribute("aria-label", "Map country");
  countries.forEach((key) => {
    const count = groups.filter((place) => place.country === key).reduce((sum, place) => sum + place.jobs.length, 0);
    const button = vizElement("button", "", `${vizCountryLabel(key)} · ${count}`);
    button.type = "button";
    button.dataset.region = key;
    button.addEventListener("click", () => { vizState.region = key; draw(); });
    controls.append(button);
  });
  const map = vizElement("div", "viz-map");
  const tooltip = vizElement("div", "viz-map-tooltip");
  tooltip.id = "viz-map-tooltip";
  tooltip.setAttribute("role", "tooltip");
  tooltip.hidden = true;
  const coverage = vizElement("p", "viz-note");
  const locations = vizElement("div", "viz-location-list");
  panel.append(controls, map, coverage, locations,
    vizElement("p", "viz-note", "Bubble area = applications. City and area pins are approximate centers. Remote and missing-location applications share a home-base pin in Missoula; this is an anchor, not their job location. Salary includes hourly × 8 × 21 × 12."));
  const attribution = vizElement("p", "viz-note");
  const source = vizElement("a", "", "Natural Earth");
  source.href = "https://www.naturalearthdata.com/";
  source.target = "_blank";
  source.rel = "noopener noreferrer";
  attribution.append("Map outlines: ", source, " · stored locally, no geocoding requests.");
  panel.append(attribution);
  const showJobs = vizDrilldown(panel);
  function draw() {
    tooltip.hidden = true;
    panel.querySelector(".viz-drilldown").hidden = true;
    controls.querySelectorAll("button").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.region === vizState.region)));
    const country = vizState.region;
    const bounds = vizCountryBounds(country);
    const selected = groups.filter((place) => place.country === country);
    const count = selected.reduce((sum, place) => sum + place.jobs.length, 0);
    const svg = vizSvg("svg", { viewBox: "0 0 800 380", role: "group", "aria-label": `${vizCountryLabel(country)} application map. Focus a marker for salary and roles; activate to see jobs.` });
    vizMapBackground(svg, bounds, country);
    const visible = country === "remote" && count ? [{ label: "Remote & unlocated · Missoula home base", lon: -113.994, lat: 46.872, jobs: selected.flatMap((place) => place.jobs) }] : selected.filter((place) => place.kind === "mapped");
    locations.replaceChildren();
    selected.forEach((place) => {
      const button = vizElement("button", `viz-location ${place.kind}`);
      button.type = "button";
      const label = vizElement("span", "", place.label);
      if (place.kind === "unmapped") label.append(vizElement("small", "", "City not mapped yet"));
      button.append(label, vizElement("strong", "", place.jobs.length));
      button.addEventListener("click", () => showJobs(place.label, place.jobs));
      locations.append(button);
    });
    // Draw smaller bubbles last so nearby locations remain selectable.
    visible.forEach((place) => {
      const [x, y] = vizProject(place.lon, place.lat, bounds);
      const radius = 9 * Math.sqrt(place.jobs.length);
      const group = vizSvg("g", { class: "viz-map-marker" });
      group.append(vizSvg("circle", { cx: x, cy: y, r: radius, fill: VIZ_COLORS.teal, "fill-opacity": ".8", stroke: "#fffdf8", "stroke-width": 2 }),
        vizSvg("text", { x, y: y + 4, "text-anchor": "middle", class: "viz-map-count" }, place.jobs.length));
      const { pay, roles } = vizPlaceSummary(place);
      const description = `${place.label}: ${place.jobs.length} applications. Average annual salary ${vizMoney(pay.mean)}, ${pay.count} with pay. Roles: ${roles.join(", ") || "Not recorded"}.`;
      vizActivateSvg(group, description, () => { showPopup(); showJobs(place.label, place.jobs); });
      // Use the accessible custom popup instead of a second native title tooltip.
      group.querySelector("title").remove();
      group.setAttribute("aria-describedby", tooltip.id);
      function showPopup() {
        tooltip.replaceChildren(vizElement("strong", "", place.label), vizElement("span", "viz-tooltip-pay", `${vizMoney(pay.mean)} / year · average`),
          vizElement("small", "", `${pay.count} of ${place.jobs.length} applications with pay`));
        const tags = vizElement("div", "viz-tooltip-roles");
        (roles.length ? roles : ["No role attributes recorded"]).forEach((role) => tags.append(vizElement("span", "", role)));
        tooltip.append(tags);
        if (country === "remote") tooltip.append(vizElement("small", "", `${selected.find((place) => place.kind === "remote")?.jobs.length || 0} remote · ${selected.find((place) => place.kind === "missing")?.jobs.length || 0} location not recorded`));
        tooltip.hidden = false;
        const mapWidth = map.clientWidth;
        const mapHeight = map.clientHeight;
        tooltip.style.left = `${Math.max(8, Math.min(mapWidth - tooltip.offsetWidth - 8, x / 800 * mapWidth + 14))}px`;
        tooltip.style.top = `${Math.max(8, Math.min(mapHeight - tooltip.offsetHeight - 8, y / 380 * mapHeight - tooltip.offsetHeight - 12))}px`;
      }
      group.addEventListener("mouseenter", showPopup);
      group.addEventListener("focus", showPopup);
      group.addEventListener("mouseleave", () => { if (document.activeElement !== group) tooltip.hidden = true; });
      group.addEventListener("blur", () => { tooltip.hidden = true; });
      group.addEventListener("keydown", (event) => { if (event.key === "Escape") tooltip.hidden = true; });
      svg.append(group);
    });
    const unmapped = selected.filter((place) => place.kind === "unmapped").reduce((sum, place) => sum + place.jobs.length, 0);
    coverage.textContent = `${count} of ${records.length} applications · ${vizCountryLabel(country)}${unmapped ? ` · ${unmapped} without a mapped city` : ""}${country === "remote" ? " · home-base pin at Missoula, MT" : ""}`;
    if (!visible.length) svg.append(vizSvg("text", { x: 400, y: 190, "text-anchor": "middle", class: "viz-svg-label" }, count ? "Locations listed below; city pins not mapped yet" : "No applications here yet"));
    map.replaceChildren(svg, tooltip);
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
