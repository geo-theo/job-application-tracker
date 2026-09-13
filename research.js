"use strict";

// Research treats unapplied jobs and anything deliberately kept as a reference
// as market evidence. Applied-job outcomes remain the responsibility of Viz.
const researchState = {
  scope: "market",
  jobType: "All",
  role: "All",
  industry: "All",
  keywordView: "all",
  salaryGroup: "industry",
  salaryMode: "annualized",
};

let researchRenderRequest = 0;

const RESEARCH_SIGNAL_VIEWS = [
  ["all", "Resume signals"],
  ["technology", "Tools & technology"],
  ["capability", "Core capabilities"],
  ["domain", "Domain knowledge"],
  ["qualification", "Qualifications"],
  ["frequent", "Frequent words"],
];

// Aliases are matched case-insensitively and each job counts once per signal.
// The display label stays resume-friendly while common spelling variants are
// recognized in the source descriptions.
const RESEARCH_SIGNALS = [
  ["arcgis", "ArcGIS", "technology", ["arcgis", "arcgis pro", "arcgis online", "arcgis enterprise"]],
  ["gis", "GIS", "technology", ["gis", "geographic information system", "geospatial information system"]],
  ["python", "Python", "technology", ["python"]],
  ["sql", "SQL", "technology", ["sql", "structured query language"]],
  ["excel", "Excel", "technology", ["excel", "spreadsheets"]],
  ["power-bi", "Power BI", "technology", ["power bi"]],
  ["tableau", "Tableau", "technology", ["tableau"]],
  ["javascript", "JavaScript", "technology", ["javascript", "typescript", "node.js"]],
  ["r", "R", "technology", ["r programming", "r language", "r studio", "rstudio"]],
  ["cloud", "Cloud platforms", "technology", ["cloud computing", "aws", "amazon web services", "azure", "google cloud", "gcp"]],
  ["postgis", "PostGIS / PostgreSQL", "technology", ["postgis", "postgresql", "postgres"]],
  ["qgis", "QGIS", "technology", ["qgis"]],
  ["fme", "FME", "technology", ["safe software fme", "fme"]],
  ["git", "Git", "technology", ["github", "gitlab", "git version control"]],
  ["api", "APIs", "technology", ["api", "apis", "application programming interface", "restful"]],
  ["etl", "ETL / data pipelines", "technology", ["etl", "data pipeline", "data pipelines"]],
  ["machine-learning", "Machine learning", "technology", ["machine learning", "deep learning"]],
  ["ai", "AI", "technology", ["artificial intelligence", "generative ai", "large language model", "llm"]],
  ["remote-sensing", "Remote sensing", "technology", ["remote sensing", "satellite imagery", "earth observation"]],
  ["data-visualization", "Data visualization", "technology", ["data visualization", "data visualisation", "dashboards", "dashboarding"]],
  ["databases", "Databases", "technology", ["database", "databases", "data warehouse", "data warehousing"]],
  ["data-analysis", "Data analysis", "capability", ["data analysis", "data analytics", "analyze data", "analyse data"]],
  ["spatial-analysis", "Spatial analysis", "capability", ["spatial analysis", "geospatial analysis", "geographic analysis"]],
  ["project-management", "Project management", "capability", ["project management", "program management", "manage projects"]],
  ["communication", "Communication", "capability", ["communication skills", "written and verbal communication", "written communication", "verbal communication", "communicate effectively"]],
  ["collaboration", "Cross-functional collaboration", "capability", ["cross-functional", "cross functional", "collaborative environment", "collaborate with"]],
  ["stakeholders", "Stakeholder engagement", "capability", ["stakeholder management", "stakeholder engagement", "stakeholders", "clients"]],
  ["problem-solving", "Problem solving", "capability", ["problem-solving", "problem solving", "analytical thinking", "critical thinking"]],
  ["research", "Research", "capability", ["research methods", "conduct research", "research and analysis", "research skills"]],
  ["technical-writing", "Technical writing", "capability", ["technical writing", "technical documentation", "write documentation", "documentation skills"]],
  ["leadership", "Leadership", "capability", ["leadership", "lead teams", "team lead", "mentor"]],
  ["requirements", "Requirements gathering", "capability", ["requirements gathering", "business requirements", "user requirements", "requirements analysis"]],
  ["quality", "Quality assurance", "capability", ["quality assurance", "quality control", "data quality", "qa/qc"]],
  ["cartography", "Cartography", "domain", ["cartography", "cartographic", "map production", "map design"]],
  ["statistics", "Statistics", "domain", ["statistics", "statistical analysis", "quantitative analysis", "quantitative methods"]],
  ["data-governance", "Data governance", "domain", ["data governance", "metadata management", "data stewardship"]],
  ["supply-chain", "Supply chain", "domain", ["supply chain", "logistics", "demand planning"]],
  ["intelligence", "Intelligence analysis", "domain", ["intelligence analysis", "geospatial intelligence", "geopolitical analysis", "open source intelligence", "osint"]],
  ["policy", "Policy analysis", "domain", ["policy analysis", "public policy", "policy research"]],
  ["bachelors", "Bachelor’s degree", "qualification", ["bachelor's degree", "bachelors degree", "baccalaureate degree", "undergraduate degree"]],
  ["masters", "Master’s degree", "qualification", ["master's degree", "masters degree", "graduate degree"]],
  ["experience-years", "Years of experience", "qualification", ["years of experience", "years experience", "year of experience"]],
  ["clearance", "Security clearance", "qualification", ["security clearance", "top secret", "secret clearance", "ts/sci"]],
  ["drivers-license", "Driver’s license", "qualification", ["driver's license", "drivers license", "driving licence", "valid license"]],
  ["travel", "Travel", "qualification", ["willingness to travel", "ability to travel", "travel required", "domestic travel", "international travel"]],
  ["work-authorization", "Work authorization", "qualification", ["work authorization", "authorized to work", "sponsorship", "right to work"]],
].map(([key, label, category, aliases]) => ({ key, label, category, aliases }));

const RESEARCH_STOP_WORDS = new Set(`
  about above across after again against all also among and any are because been
  before being below between both but can company could day each employer equal
  etc for from further had has have having here how into its itself job jobs just
  may more most must new not now only other our out over per position preferred
  provide required requirements role same should such than that the their them
  then there these they this those through under use used using very want was were
  what when where which while who will with within would you your years work working
  ability experience including include includes knowledge opportunity responsibilities
  responsible qualified qualifications candidate candidates employment employee
  employees support team teams duties status time full part information related
  based ensure develop help needs level strong excellent demonstrated minimum
  please apply applications applicant perform performing successful equivalent
  various well make maintain benefits salary range location organization service
  services program programs project projects management data analysis skills
`.trim().split(/\s+/));

function researchRoleLabels(job) {
  const roles = job.roles?.length ? job.roles : job.roleOther ? ["Other"] : [];
  return [...new Set(roles.map((role) => role === "Other" ? job.roleOther || "Other" : role).filter(Boolean))];
}

function getResearchJobs(records, filters = {}) {
  const scope = filters.scope || "market";
  const jobType = filters.jobType || "All";
  const role = filters.role || "All";
  const industry = filters.industry || "All";
  return records
    .filter((job) => {
      if (scope === "active") return !isAppliedJob(job) && !isReferenceJob(job);
      if (scope === "reference") return isReferenceJob(job);
      return !isAppliedJob(job) || isReferenceJob(job);
    })
    .filter((job) => jobType === "All" || hasJobType(job, jobType))
    .filter((job) => role === "All" || researchRoleLabels(job).includes(role))
    .filter((job) => industry === "All" || (getIndustryDisplay(job) || "Unspecified industry") === industry);
}

function researchNormalizeText(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’‘]/g, "'")
    .toLocaleLowerCase();
}

function researchPhrasePattern(phrase) {
  const escaped = researchNormalizeText(phrase)
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/[\s/_-]+/g, "[\\s/_-]+");
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`, "g");
}

function researchPhraseCount(text, aliases) {
  return aliases.reduce((total, alias) => total + (text.match(researchPhrasePattern(alias)) || []).length, 0);
}

function researchFrequentTerms(entries) {
  const terms = new Map();
  entries.forEach(({ job, text }) => {
    const seen = new Set();
    const words = researchNormalizeText(text).match(/[a-z][a-z+#.]{2,}/g) || [];
    words.forEach((word) => {
      const normalized = word.replace(/^www\.?$/, "").replace(/\.$/, "");
      if (normalized.length < 4 || RESEARCH_STOP_WORDS.has(normalized) || /^https?$/.test(normalized)) return;
      if (!terms.has(normalized)) terms.set(normalized, { key: normalized, label: normalized, mentions: 0, jobs: [] });
      const term = terms.get(normalized);
      term.mentions += 1;
      if (!seen.has(normalized)) term.jobs.push(job);
      seen.add(normalized);
    });
  });
  return [...terms.values()]
    .map((term) => ({ ...term, jobCount: term.jobs.length, category: "frequent" }))
    .filter((term) => term.jobCount >= Math.min(2, entries.length))
    .sort((a, b) => b.jobCount - a.jobCount || b.mentions - a.mentions || a.label.localeCompare(b.label));
}

function researchAnalyzeDescriptions(entries) {
  const described = entries.filter((entry) => String(entry.text || "").trim());
  const normalized = described.map((entry) => ({ ...entry, normalizedText: researchNormalizeText(entry.text) }));
  const signals = RESEARCH_SIGNALS.map((signal) => {
    const matches = normalized.map((entry) => ({ entry, count: researchPhraseCount(entry.normalizedText, signal.aliases) })).filter(({ count }) => count);
    return {
      ...signal,
      mentions: matches.reduce((sum, match) => sum + match.count, 0),
      jobCount: matches.length,
      jobs: matches.map(({ entry }) => entry.job),
    };
  }).filter((signal) => signal.jobCount)
    .sort((a, b) => b.jobCount - a.jobCount || b.mentions - a.mentions || a.label.localeCompare(b.label));
  return { described, signals, frequent: researchFrequentTerms(described) };
}

function researchGroups(records, dimension) {
  const groups = new Map();
  records.forEach((job) => {
    const labels = dimension === "role"
      ? researchRoleLabels(job).length ? researchRoleLabels(job) : ["Unspecified role"]
      : dimension === "industry"
        ? [getIndustryDisplay(job) || "Unspecified industry"]
        : dimension === "mission"
          ? job.mission?.length ? job.mission : ["Not tagged yet"]
          : [vizLocation(job).label];
    labels.forEach((label) => {
      if (!groups.has(label)) groups.set(label, { label, jobs: [] });
      groups.get(label).jobs.push(job);
    });
  });
  return [...groups.values()].sort((a, b) => b.jobs.length - a.jobs.length || a.label.localeCompare(b.label));
}

function researchSummaryText(records, analysis) {
  if (!analysis.described.length) return "Add job descriptions to turn this market sample into a resume and cover-letter brief.";
  const top = (category, count) => analysis.signals.filter((signal) => signal.category === category).slice(0, count).map((signal) => signal.label);
  const technologies = top("technology", 3);
  const capabilities = top("capability", 3);
  const domains = top("domain", 2);
  const qualifications = top("qualification", 2);
  const clauses = [];
  if (technologies.length) clauses.push(`tool demand centers on ${researchJoin(technologies)}`);
  if (capabilities.length) clauses.push(`employers repeatedly emphasize ${researchJoin(capabilities)}`);
  if (domains.length) clauses.push(`the strongest domain signals are ${researchJoin(domains)}`);
  if (qualifications.length) clauses.push(`common screening language includes ${researchJoin(qualifications)}`);
  return `Across ${analysis.described.length} descriptions in this ${records.length}-job market view, ${clauses.length ? clauses.join("; ") : "the postings do not yet share enough recognized signals for a reliable pattern"}.`;
}

function researchJoin(items) {
  if (items.length < 2) return items[0] || "";
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

function researchScopeRecords(records, scope = researchState.scope) {
  return getResearchJobs(records, { scope });
}

function researchFilterOptions(records) {
  const scoped = researchScopeRecords(records);
  return {
    roles: [...new Set(scoped.flatMap(researchRoleLabels))].sort((a, b) => a.localeCompare(b)),
    industries: [...new Set(scoped.map((job) => getIndustryDisplay(job) || "Unspecified industry"))].sort((a, b) => a.localeCompare(b)),
  };
}

function researchFilterSelect(id, label, choices, value, onChange) {
  const wrap = vizElement("label", "research-filter");
  wrap.append(vizElement("span", "", label));
  const select = vizElement("select");
  select.id = id;
  choices.forEach(([key, caption]) => {
    const option = vizElement("option", "", caption);
    option.value = key;
    select.append(option);
  });
  select.value = value;
  select.addEventListener("change", () => onChange(select.value, id));
  wrap.append(select);
  return wrap;
}

function researchFilters(records) {
  const options = researchFilterOptions(records);
  if (researchState.role !== "All" && !options.roles.includes(researchState.role)) researchState.role = "All";
  if (researchState.industry !== "All" && !options.industries.includes(researchState.industry)) researchState.industry = "All";
  const form = vizElement("fieldset", "research-filters");
  form.append(vizElement("legend", "", "Shape the market sample"));
  const controls = vizElement("div", "research-filter-grid");
  controls.append(
    researchFilterSelect("research-scope", "Source", [
      ["market", "All unapplied + reference"],
      ["active", "Active prospects only"],
      ["reference", "Reference library only"],
    ], researchState.scope, (value, id) => { researchState.scope = value; researchState.role = "All"; researchState.industry = "All"; researchRefresh(id); }),
    researchFilterSelect("research-type", "Job type", [["All", "All job types"], ["Full-time", "Full-time"], ["Internship", "Internships"], ["Part-time", "Part-time"]], researchState.jobType,
      (value, id) => { researchState.jobType = value; researchRefresh(id); }),
    researchFilterSelect("research-role", "Role", [["All", "All roles"], ...options.roles.map((value) => [value, value])], researchState.role,
      (value, id) => { researchState.role = value; researchRefresh(id); }),
    researchFilterSelect("research-industry", "Industry", [["All", "All industries"], ...options.industries.map((value) => [value, value])], researchState.industry,
      (value, id) => { researchState.industry = value; researchRefresh(id); }),
  );
  const clear = vizElement("button", "research-clear", "Clear filters");
  clear.type = "button";
  clear.hidden = researchState.scope === "market" && researchState.jobType === "All" && researchState.role === "All" && researchState.industry === "All";
  clear.addEventListener("click", () => {
    researchState.scope = "market";
    researchState.jobType = "All";
    researchState.role = "All";
    researchState.industry = "All";
    researchRefresh("research-scope");
  });
  controls.append(clear);
  form.append(controls, vizElement("p", "viz-type-note", "Every card and chart below responds to these filters. Your saved data is only read, never changed."));
  return form;
}

async function researchRefresh(focusId) {
  const scrollTop = els.jobList.scrollTop;
  await renderResearch();
  if (activePage !== "research") return;
  els.jobList.scrollTop = scrollTop;
  document.getElementById(focusId)?.focus({ preventScroll: true });
}

async function researchDescriptionEntries(records) {
  return Promise.all(records.map(async (job) => ({ job, text: await getDescription(job.id) })));
}

async function renderResearch() {
  const request = ++researchRenderRequest;
  const records = getResearchJobs(jobs, researchState);
  const market = getResearchJobs(jobs, { scope: "market" });
  const references = records.filter(isReferenceJob);
  const active = records.filter((job) => !isAppliedJob(job) && !isReferenceJob(job));
  els.recordCount.textContent = `${records.length} market ${records.length === 1 ? "job" : "jobs"}`;
  els.jobList.replaceChildren(vizElement("div", "research-loading", "Reading saved job descriptions…"));
  const entries = await researchDescriptionEntries(records);
  if (request !== researchRenderRequest || activePage !== "research") return;

  const analysis = researchAnalyzeDescriptions(entries);
  const pay = vizPaySummary(records);
  const remote = records.filter((job) => ["remote", "missing"].includes(vizLocation(job).kind));
  const industries = new Set(records.map((job) => getIndustryDisplay(job)).filter(Boolean));
  const dashboard = vizElement("section", "research-dashboard");
  const intro = vizElement("div", "research-intro");
  const title = vizElement("div", "research-heading");
  title.append(
    vizElement("p", "eyebrow", "THE MARKET, IN ITS OWN WORDS"),
    vizElement("h2", "viz-title", "Turn saved postings into a sharper pitch."),
    vizElement("p", "viz-description", `${market.length} saved jobs form the full market sample. Filter the evidence, find repeated language, and carry the strongest signals into your resume and cover letters.`),
  );
  intro.append(title, researchFilters(jobs));

  const stats = vizElement("div", "viz-stat-grid");
  stats.append(
    vizStat("Market jobs in view", records.length, `${active.length} active prospects · ${references.length} reference ${references.length === 1 ? "job" : "jobs"}`, "blue", [
      { label: "companies", value: new Set(records.map((job) => job.companyId || job.company).filter(Boolean)).size, tone: "blue" },
      { label: "industries", value: industries.size, tone: "purple" },
    ]),
    vizStat("Descriptions analyzed", analysis.described.length, `${vizPercent(analysis.described.length, records.length)} coverage · empty descriptions are excluded from language signals`, "purple", [
      { label: "with text", value: analysis.described.length, tone: "teal" },
      { label: "missing", value: records.length - analysis.described.length, tone: "gray" },
    ]),
    vizStat("Average annual pay", vizMoney(pay.mean), `${pay.count}/${records.length} jobs with comparable pay · hourly × 2,016`, "teal", [
      { label: "25th percentile", value: vizMoney(pay.p25), tone: "blue" },
      { label: "75th percentile", value: vizMoney(pay.p75), tone: "teal" },
    ]),
    vizStat("Remote or flexible", vizPercent(remote.length, records.length), `${remote.length}/${records.length} remote or location not recorded`, "orange", [
      { label: "remote", value: records.filter((job) => vizLocation(job).kind === "remote").length, tone: "orange" },
      { label: "unlocated", value: records.filter((job) => vizLocation(job).kind === "missing").length, tone: "gray" },
    ]),
  );

  dashboard.append(
    intro,
    stats,
    researchKeywordPanel(records, entries, analysis),
    researchDistributionPanel(records, "role", "02", "Roles in demand", "See which role families recur across the market sample.", "research-role-panel"),
    researchDistributionPanel(records, "industry", "03", "Industries represented", "Compare the industries contributing opportunities to this view.", "research-industry-panel"),
    researchSalaryPanel(records),
    researchDistributionPanel(records, "mission", "05", "Who the work serves", "Mission tags reveal who may benefit from the work.", "research-mission-panel"),
    researchDistributionPanel(records, "location", "06", "Where the opportunities are", "Compare normalized locations, including remote and unlocated work.", "research-location-panel research-wide"),
  );
  els.jobList.replaceChildren(dashboard);
}

function researchKeywordPanel(records, entries, analysis) {
  const panel = vizPanel("01", "What are employers asking for?", "A collective read of the descriptions, ranked by the share of postings that mention each signal.", "research-keyword-panel research-wide");
  const brief = vizElement("div", "research-brief");
  const briefText = researchSummaryText(records, analysis);
  const briefCopy = vizElement("button", "research-copy", "Copy brief");
  briefCopy.type = "button";
  briefCopy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(briefText);
      showToast("Market brief copied.");
    } catch (error) {
      showToast("Copy was blocked by the browser.");
    }
  });
  const briefHeading = vizElement("div");
  briefHeading.append(vizElement("span", "research-brief-label", "COLLECTIVE BRIEF"), vizElement("p", "", briefText));
  brief.append(briefHeading, briefCopy);

  const controls = vizElement("div", "viz-controls");
  controls.append(vizSelect("Show", RESEARCH_SIGNAL_VIEWS, researchState.keywordView, (value) => {
    researchState.keywordView = value;
    draw();
  }));
  const content = vizElement("div", "research-keywords");
  panel.append(brief, controls, content);
  const showJobs = vizDrilldown(panel);
  function draw() {
    content.replaceChildren();
    panel.querySelector(".viz-drilldown").hidden = true;
    const source = researchState.keywordView === "frequent"
      ? analysis.frequent
      : analysis.signals.filter((signal) => researchState.keywordView === "all" || signal.category === researchState.keywordView);
    const visible = source.slice(0, 18);
    if (!analysis.described.length) {
      content.append(vizElement("p", "viz-empty", "No saved descriptions in this view. Add or import description text to reveal shared language."));
      return;
    }
    if (!visible.length) {
      content.append(vizElement("p", "viz-empty", "No recognized signals in this category for the current filters."));
      return;
    }
    const list = vizElement("div", "research-signal-list");
    const max = Math.max(...visible.map((signal) => signal.jobCount), 1);
    visible.forEach((signal) => {
      const button = vizElement("button", "research-signal-row");
      button.type = "button";
      const term = vizElement("span", "research-signal-name", signal.label);
      const count = vizElement("strong", "", `${signal.jobCount} · ${vizPercent(signal.jobCount, analysis.described.length)}`);
      const track = vizElement("span", "research-signal-track");
      const fill = vizElement("span");
      fill.style.width = `${signal.jobCount / max * 100}%`;
      track.append(fill);
      button.append(term, count, track);
      button.title = `${signal.label} appears in ${signal.jobCount} of ${analysis.described.length} descriptions (${signal.mentions} total mentions). Show matching jobs.`;
      button.setAttribute("aria-label", button.title);
      button.addEventListener("click", () => showJobs(signal.label, signal.jobs));
      list.append(button);
    });
    content.append(list, vizElement("p", "viz-note", researchState.keywordView === "frequent"
      ? "Frequent words are computed directly from the selected descriptions after common job-posting language is removed. Each percentage is description coverage, not raw repetition."
      : "Signals use a transparent local phrase dictionary and count a job once even when the phrase repeats. Select a row to inspect the evidence; use Frequent words to see uncategorized language."));
    const missing = entries.filter((entry) => !String(entry.text || "").trim()).map((entry) => entry.job);
    if (missing.length) {
      const missingButton = vizElement("button", "research-missing", `${missing.length} ${missing.length === 1 ? "job has" : "jobs have"} no description text →`);
      missingButton.type = "button";
      missingButton.addEventListener("click", () => showJobs("Missing description text", missing));
      content.append(missingButton);
    }
  }
  draw();
  return panel;
}

function researchDistributionPanel(records, dimension, number, title, description, className) {
  const panel = vizPanel(number, title, description, className);
  const groups = researchGroups(records, dimension);
  const bars = vizElement("div", "research-distribution");
  const max = Math.max(...groups.map((group) => group.jobs.length), 1);
  groups.slice(0, dimension === "mission" ? 20 : 14).forEach((group) => {
    const button = vizElement("button", "research-distribution-row");
    button.type = "button";
    const track = vizElement("span", "research-distribution-track");
    const fill = vizElement("span");
    fill.style.width = `${group.jobs.length / max * 100}%`;
    track.append(fill);
    button.append(vizElement("span", "", group.label), vizElement("strong", "", `${group.jobs.length} · ${vizPercent(group.jobs.length, records.length)}`), track);
    button.addEventListener("click", () => showJobs(group.label, group.jobs));
    bars.append(button);
  });
  if (!groups.length) bars.append(vizElement("p", "viz-empty", "No jobs in this market view."));
  panel.append(bars);
  if (groups.length > (dimension === "mission" ? 20 : 14)) panel.append(vizElement("p", "viz-note", `Showing the top ${dimension === "mission" ? 20 : 14} of ${groups.length} groups.`));
  if (["role", "mission"].includes(dimension)) panel.append(vizElement("p", "viz-note", `${dimension === "role" ? "Roles" : "Mission tags"} can overlap, so percentages may sum to more than 100%.`));
  const showJobs = vizDrilldown(panel);
  return panel;
}

function researchSalaryPanel(records) {
  const panel = vizPanel("04", "What does this market pay?", "Benchmark advertised compensation by industry, role, or location.", "research-salary-panel research-wide");
  const controls = vizElement("div", "viz-controls");
  controls.append(
    vizSelect("Group by", [["industry", "Industry"], ["role", "Role"], ["location", "Location"]], researchState.salaryGroup, (value) => { researchState.salaryGroup = value; draw(); }),
    vizSelect("Compare", [["annualized", "Yearly pay · hourly included"], ["salary", "Salary postings only"], ["hourly", "Hourly postings only"]], researchState.salaryMode, (value) => { researchState.salaryMode = value; draw(); }),
  );
  const content = vizElement("div", "viz-salary-content");
  panel.append(controls, content);
  const showJobs = vizDrilldown(panel);
  function draw() {
    content.replaceChildren();
    panel.querySelector(".viz-drilldown").hidden = true;
    const groups = vizSalaryGroups(records, researchState.salaryGroup, researchState.salaryMode);
    const paidCount = records.filter((job) => vizPay(job, researchState.salaryMode)).length;
    const step = researchState.salaryMode === "hourly" ? 25 : 50000;
    const axisMax = Math.max(step, Math.ceil(Math.max(0, ...groups.map((group) => group.high || 0)) / step) * step);
    const unit = researchState.salaryMode === "hourly" ? "/hr" : "/yr";
    const summary = vizElement("div", "viz-pay-summary");
    summary.append(vizElement("strong", "", `${vizMoney(vizAveragePay(records, researchState.salaryMode), researchState.salaryMode)}${paidCount ? unit : ""}`),
      vizElement("span", "", `average · ${paidCount} of ${records.length} market jobs with comparable pay`));
    content.append(summary);
    if (!paidCount) content.append(vizElement("p", "viz-empty", "No comparable pay recorded in this view. Try another pay type."));
    const axis = vizElement("div", "viz-pay-axis");
    const ticks = vizElement("div", "viz-pay-ticks");
    ticks.append(vizElement("span", "", "$0"), vizElement("span", "", vizMoney(axisMax / 2, researchState.salaryMode)), vizElement("span", "", `${vizMoney(axisMax, researchState.salaryMode)}${unit}`));
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
      row.append(caption, plot, vizElement("strong", "viz-pay-value", vizMoney(group.mean, researchState.salaryMode)));
      row.addEventListener("click", () => showJobs(group.label, group.jobs));
      rows.append(row);
    });
    content.append(rows, vizElement("p", "viz-note", "Dot = mean job midpoint. Line = lowest to highest advertised pay. Missing pay is excluded rather than treated as zero."));
    if (researchState.salaryMode === "annualized") content.append(vizElement("p", "viz-method", "Salary postings use their annual midpoint. Hourly postings use average hourly pay × 2,016 hours/year as a comparison equivalent."));
    if (researchState.salaryGroup === "role") content.append(vizElement("p", "viz-note", "Jobs with multiple roles appear in each role; the overall average counts each job once."));
  }
  draw();
  return panel;
}
