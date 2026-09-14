const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const context = vm.createContext({
  document: { querySelector: () => null, querySelectorAll: () => [], addEventListener() {} },
  window: { location: { hash: "#research" } },
});
for (const filename of ["app.js", "viz-geography.js", "viz.js", "research.js"]) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", filename), "utf8"), context);
}
const api = vm.runInContext("({ getResearchJobs, researchAnalyzeDescriptions, researchGroups, researchDescriptionSections, researchCandidateCorpus, researchDescriptionGroups, researchCandidateMetrics, researchRankedMetrics, researchEvidenceSnippets, researchNormalizeText, parseJobsCsv, parseCompaniesCsv, joinJobsWithCompanies, isAppliedJob, isReferenceJob })", context);
const plain = (value) => JSON.parse(JSON.stringify(value));

test("research defaults to unapplied and reference market evidence", () => {
  const rows = [
    { id: "active", roles: ["Researcher"], industry: "Tech" },
    { id: "reference", appliedStatus: "No", roles: ["Researcher"], industry: "Tech" },
    { id: "future", priority: "Future", appliedStatus: "Yes", roles: ["Analyst"], industry: "Policy / Think Tank" },
    { id: "applied", appliedStatus: "Yes", roles: ["Researcher"], industry: "Tech" },
  ];
  assert.deepEqual(plain(api.getResearchJobs(rows).map((job) => job.id)), ["active", "reference", "future"]);
  assert.deepEqual(plain(api.getResearchJobs(rows, { scope: "active" }).map((job) => job.id)), ["active"]);
  assert.deepEqual(plain(api.getResearchJobs(rows, { scope: "reference" }).map((job) => job.id)), ["reference", "future"]);
  assert.deepEqual(plain(api.getResearchJobs(rows, { role: "Researcher", industry: "Tech" }).map((job) => job.id)), ["active", "reference"]);
});

test("description signals use job coverage, expanded skills, and automatic phrases", () => {
  const jobs = [{ id: "one" }, { id: "two" }, { id: "empty" }];
  const entries = [
    { job: jobs[0], text: "Requirements: Python, Python, Spark and route optimization support data analysis and stakeholder engagement." },
    { job: jobs[1], text: "Required experience: Python, Spark and route optimization. Communicate effectively with stakeholders." },
    { job: jobs[2], text: "" },
  ];
  const analysis = api.researchAnalyzeDescriptions(entries);
  const python = analysis.signals.find((signal) => signal.label === "Python");
  const spark = analysis.signals.find((signal) => signal.label === "Spark / Hadoop");
  const stakeholder = analysis.signals.find((signal) => signal.label === "Stakeholder engagement");
  assert.equal(analysis.described.length, 2);
  assert.equal(python.jobCount, 2);
  assert.equal(python.mentions, 3);
  assert.equal(spark.jobCount, 2);
  assert.equal(stakeholder.jobCount, 2);
  const corpus = api.researchCandidateCorpus(entries, "requirements");
  assert.ok(corpus.candidates.some((term) => term.label === "route optimization" && term.jobCount === 2));
});

test("role profiles calculate within-group coverage and lift against the market", () => {
  const jobs = [
    { id: "a", roles: ["Data Analyst", "Researcher"], industry: "Tech" },
    { id: "b", roles: ["Data Analyst"], industry: "Tech" },
    { id: "c", roles: ["Researcher"], industry: "Policy / Think Tank" },
  ];
  const entries = [
    { job: jobs[0], text: "Requirements: Python and SQL." },
    { job: jobs[1], text: "Qualifications: SQL and Tableau." },
    { job: jobs[2], text: "Required: qualitative research methods." },
  ];
  const corpus = api.researchCandidateCorpus(entries, "requirements");
  const analyst = api.researchDescriptionGroups(corpus.analyzed, "role").find((group) => group.label === "Data Analyst");
  const metrics = api.researchCandidateMetrics(corpus, analyst.entries);
  const sql = metrics.find((metric) => metric.label === "SQL");
  assert.equal(sql.jobCount, 2);
  assert.equal(sql.coverage, 1);
  assert.ok(sql.lift > 10);
  assert.equal(api.researchRankedMetrics(metrics)[0].label, "SQL");
  assert.equal(api.researchGroups(jobs, "role").find((group) => group.label === "Researcher").jobs.length, 2);
  assert.equal(api.researchGroups(jobs, "industry").reduce((sum, group) => sum + group.jobs.length, 0), 3);
  assert.equal(api.researchNormalizeText("Bachelor’s"), "bachelor's");
});

test("requirement and responsibility extraction keeps source evidence traceable", () => {
  const job = { id: "one", company: "Example", title: "GIS Analyst" };
  const text = "Responsibilities\nBuild maps and maintain spatial databases.\nQualifications\nExperience with ArcGIS Pro and Python is required.";
  const sections = api.researchDescriptionSections(text);
  assert.ok(sections.responsibilities.some((line) => /Build maps/.test(line)));
  assert.ok(sections.requirements.some((line) => /ArcGIS Pro/.test(line)));
  const corpus = api.researchCandidateCorpus([{ job, text }], "requirements");
  const arcgis = corpus.candidates.find((candidate) => candidate.label === "ArcGIS");
  const evidence = api.researchEvidenceSnippets({ ...arcgis, groupSize: 1 }, [{ job, text }], "requirements");
  assert.equal(evidence.length, 1);
  assert.match(evidence[0].snippet, /ArcGIS Pro/);
});

test("current repository data reconciles with Research scope and descriptions", () => {
  const rawJobs = api.parseJobsCsv(fs.readFileSync(path.join(__dirname, "..", "db", "jobs.csv"), "utf8"));
  const companies = api.parseCompaniesCsv(fs.readFileSync(path.join(__dirname, "..", "db", "companies.csv"), "utf8"));
  const jobs = api.joinJobsWithCompanies(rawJobs, companies);
  const market = api.getResearchJobs(jobs);
  assert.ok(market.length);
  assert.ok(market.every((job) => !api.isAppliedJob(job) || api.isReferenceJob(job)));
  const expected = jobs.filter((job) => !api.isAppliedJob(job) || api.isReferenceJob(job)).length;
  assert.equal(market.length, expected);
  const available = market.filter((job) => job.descriptionFilename)
    .filter((job) => fs.existsSync(path.join(__dirname, "..", "db", "job-descriptions", job.descriptionFilename)));
  assert.ok(available.length > market.length * 0.75);
});

test("Research assets and navigation are wired into the page", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const nav = html.match(/<nav class="page-nav"[\s\S]*?<\/nav>/)?.[0] || "";
  assert.ok(nav.indexOf('data-page="companies"') < nav.indexOf('data-page="research"'));
  assert.ok(nav.indexOf('data-page="research"') < nav.indexOf('data-page="viz"'));
  assert.match(html, /href="research\.css"/);
  assert.match(html, /src="research\.js"/);
});
