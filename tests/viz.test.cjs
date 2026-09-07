const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const context = vm.createContext({
  document: { querySelector: () => null, querySelectorAll: () => [], addEventListener() {} },
  window: { location: { hash: "#viz" } },
});
for (const filename of ["app.js", "viz.js"]) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", filename), "utf8"), context);
}
const api = vm.runInContext("({ getVizJobs, vizPay, vizAveragePay, vizSalaryGroups, vizFlowModel, vizIsPublicPurpose, vizLocationGroups, vizActivityModel, vizDate })", context);
const plain = (value) => JSON.parse(JSON.stringify(value));

test("reference definitions are excluded before all scopes and aggregations", () => {
  const rows = [
    { id: "pending", payType: "Salary", payMin: "60000", helping: ["Govt"] },
    { id: "applied", appliedStatus: "Yes", payType: "Salary", payMin: "80000" },
    { id: "no", appliedStatus: "No", payType: "Salary", payMin: "9999999", helping: ["Govt"] },
    { id: "future", priority: "Future", appliedStatus: "Yes", helping: ["Poor"] },
    { id: "legacy", appliedDate: "2026-08-01" },
  ];
  const all = api.getVizJobs(rows);
  assert.deepEqual(plain(all.map((job) => job.id)), ["pending", "applied", "legacy"]);
  assert.deepEqual(plain(api.getVizJobs(rows, "pending").map((job) => job.id)), ["pending"]);
  assert.equal(api.getVizJobs(rows, "applied").length, 2);
  assert.equal(api.vizAveragePay(all), 70000);
  assert.equal(all.filter(api.vizIsPublicPurpose).length, 1);
});

test("pay comparisons handle hourly equivalents, missing values, bounds and stale midpoints", () => {
  const hourly = { payType: "Hourly", payMin: "20", payMax: "30", payMidpoint: "999" };
  assert.equal(api.vizPay(hourly), null);
  assert.deepEqual(plain(api.vizPay(hourly, "annualized")), { low: 41600, high: 62400, midpoint: 52000 });
  assert.equal(api.vizPay(hourly, "hourly").midpoint, 25);
  assert.equal(api.vizPay({ payType: "Salary", payMin: "$80,000" }).midpoint, 80000);
  assert.equal(api.vizPay({ payType: "Salary", payMax: "90000" }).midpoint, 90000);
  assert.equal(api.vizPay({ payType: "Salary", payMidpoint: "70000" }).midpoint, 70000);
  assert.deepEqual(plain(api.vizPay({ payType: "Salary", payMin: "100000", payMax: "80000" })), { low: 80000, high: 100000, midpoint: 90000 });
  for (const value of ["", "   ", "0", "-5", "garbage", "Infinity"]) assert.equal(api.vizPay({ payType: "Salary", payMin: value }), null);
  assert.equal(api.vizPay({ payMin: "80000" }), null);
  assert.equal(api.vizAveragePay([{ payType: "Salary", payMin: "60000" }, {}]), 60000);
  assert.equal(api.vizAveragePay([{}]), null);
});

test("multi-role groups count jobs once per role and expose missing-pay coverage", () => {
  const rows = [
    { roles: ["Research", "Research", "Other"], roleOther: "GIS", payType: "Salary", payMin: "100000" },
    { roles: ["Research"] },
    { roles: [], industry: "Other", industryOther: "NGO", payType: "Salary", payMin: "60000" },
  ];
  const research = api.vizSalaryGroups(rows, "role", "salary").find((group) => group.label === "Research");
  assert.equal(research.jobs.length, 2);
  assert.equal(research.paid.length, 1);
  assert.equal(research.mean, 100000);
  assert.equal(api.vizSalaryGroups(rows, "role", "salary").find((group) => group.label === "GIS").jobs.length, 1);
  assert.equal(api.vizAveragePay(rows), 80000);
  assert.ok(api.vizSalaryGroups(rows, "industry", "salary").some((group) => group.label === "NGO"));
});

test("flow conserves applications and never invents skipped stages or decisions", () => {
  const rows = [
    { id: "a", appliedStatus: "Yes", responseStatus: "Yes", interviewDate: "2026-08-05", finalStatus: "Accepted" },
    { id: "b", appliedStatus: "Yes", screenStatus: "Yes", applicationStatus: "Rejected" },
    { id: "c", appliedStatus: "Yes", finalStatus: "Ghosted" },
    { id: "d", appliedStatus: "Yes" },
  ];
  const { nodes, links } = api.vizFlowModel(rows);
  const outcomeNodes = nodes.filter((node) => ["Accepted", "Rejected", "Ghosted", "In progress"].includes(node.key));
  assert.equal(outcomeNodes.reduce((sum, node) => sum + node.jobs.length, 0), 4);
  assert.equal(new Set(outcomeNodes.flatMap((node) => node.jobs.map((job) => job.id))).size, 4);
  assert.ok(!nodes.some((node) => node.key === "Decision" || node.key === "assessment"));
  assert.deepEqual(plain(links.find((link) => link.source === "applied" && link.target === "screen").jobs.map((job) => job.id)), ["b"]);
  assert.ok(links.some((link) => link.source === "response" && link.target === "interview"));
  nodes.forEach((node) => {
    if (node.key !== "applied") assert.equal(links.filter((link) => link.target === node.key).reduce((sum, link) => sum + link.jobs.length, 0), node.jobs.length);
    if (!outcomeNodes.includes(node)) assert.equal(links.filter((link) => link.source === node.key).reduce((sum, link) => sum + link.jobs.length, 0), node.jobs.length);
  });
});

test("public purpose uses Govt or Poor, with overlaps counted once", () => {
  const rows = [{ helping: ["Govt", "Poor"] }, { helping: ["Environment"] }, { helping: ["Rich"] }, {}, { helping: ["Poor"] }];
  assert.equal(rows.filter(api.vizIsPublicPurpose).length, 2);
});

test("locations merge explicit aliases while remote, unknown and missing jobs remain distinct", () => {
  const groups = api.vizLocationGroups([
    { location: "Seattle" }, { locationChoice: "Other", locationOther: "Seattle, WA" },
    { location: "Remote" }, { location: "Nanterre, Île-de-France, France" }, { location: "Nanterre, France" },
    { location: "New place" }, {},
  ]);
  assert.equal(groups.find((place) => place.label === "Seattle, WA").jobs.length, 2);
  assert.equal(groups.find((place) => place.label === "Nanterre, France").jobs.length, 2);
  assert.equal(groups.find((place) => place.label === "Remote").kind, "remote");
  assert.equal(groups.find((place) => place.label === "New place").kind, "unmapped");
  assert.equal(groups.reduce((sum, place) => sum + place.jobs.length, 0), 7);
});

test("monthly cohorts include quiet months, handle year boundaries and reject invalid dates", () => {
  const result = api.vizActivityModel([{ appliedDate: "2025-12-15" }, { appliedDate: "2026-02-01" }, { appliedDate: "2026-02-31" }, {}]);
  assert.deepEqual(plain(result.months.map((month) => [month.key, month.jobs.length])), [["2025-12", 1], ["2026-01", 0], ["2026-02", 1]]);
  assert.equal(result.missing, 2);
  assert.equal(api.vizDate("2026-02-29"), null);
  assert.ok(api.vizDate("2024-02-29"));
  assert.equal(api.vizActivityModel([]).months.length, 0);
});
