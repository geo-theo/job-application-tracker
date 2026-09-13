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
const api = vm.runInContext("({ getResearchJobs, researchAnalyzeDescriptions, researchGroups, researchSummaryText, researchNormalizeText, parseJobsCsv, parseCompaniesCsv, joinJobsWithCompanies, isAppliedJob, isReferenceJob })", context);
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

test("description signals use job coverage instead of inflated repetitions", () => {
  const jobs = [{ id: "one" }, { id: "two" }, { id: "empty" }];
  const analysis = api.researchAnalyzeDescriptions([
    { job: jobs[0], text: "Python, Python and SQL support data analysis and stakeholder engagement." },
    { job: jobs[1], text: "Use Python for spatial analysis and communicate effectively with stakeholders." },
    { job: jobs[2], text: "" },
  ]);
  const python = analysis.signals.find((signal) => signal.label === "Python");
  const stakeholder = analysis.signals.find((signal) => signal.label === "Stakeholder engagement");
  assert.equal(analysis.described.length, 2);
  assert.equal(python.jobCount, 2);
  assert.equal(python.mentions, 3);
  assert.equal(stakeholder.jobCount, 2);
  assert.ok(analysis.frequent.some((term) => term.label === "python" && term.jobCount === 2));
});

test("collective brief and grouped counts remain traceable", () => {
  const jobs = [{ id: "a", roles: ["Data Analyst", "Researcher"], industry: "Tech" }, { id: "b", roles: ["Researcher"], industry: "Tech" }];
  const entries = jobs.map((job, index) => ({ job, text: index ? "Python and project management." : "Python, SQL, and data analysis." }));
  const analysis = api.researchAnalyzeDescriptions(entries);
  assert.match(api.researchSummaryText(jobs, analysis), /Across 2 descriptions/);
  assert.equal(api.researchGroups(jobs, "role").find((group) => group.label === "Researcher").jobs.length, 2);
  assert.equal(api.researchGroups(jobs, "industry")[0].jobs.length, 2);
  assert.equal(api.researchNormalizeText("Bachelor’s"), "bachelor's");
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
