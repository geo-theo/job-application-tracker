const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const context = vm.createContext({
  document: { querySelector: () => null, querySelectorAll: () => [], addEventListener() {} },
  window: { location: { hash: "#viz" } },
});
for (const filename of ["app.js", "viz-geography.js", "viz.js"]) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", filename), "utf8"), context);
}
const api = vm.runInContext("({ getVizJobs, vizPay, vizAveragePay, vizPaySummary, vizSalaryGroups, vizFlowModel, vizAwaitingReply, vizIsPublicPurpose, vizLocation, vizLocationGroups, vizMapCountries, vizCountryBounds, vizPlaceSummary, vizActivityModel, vizActivityMetrics, vizDate, vizToday, vizCalendarRange, vizPeriodRange, vizInRange, vizMissionChange })", context);
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
  assert.deepEqual(plain(api.vizPay(hourly, "annualized")), { low: 40320, high: 60480, midpoint: 50400 });
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
  assert.deepEqual(plain(nodes.find((node) => node.key === "no-response").jobs.map((job) => job.id)), ["d"]);
  assert.ok(links.some((link) => link.source === "no-response" && link.target === "In progress"));
  assert.equal(nodes.find((node) => node.key === "no-response").column, nodes.find((node) => node.key === "response").column);
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
  assert.deepEqual(plain(result.bins.map((bin) => [bin.key, bin.jobs.length])), [["2025-12", 1], ["2026-01", 0], ["2026-02", 1]]);
  assert.equal(result.missing, 2);
  assert.equal(api.vizDate("2026-02-29"), null);
  assert.ok(api.vizDate("2024-02-29"));
  assert.equal(api.vizActivityModel([]).bins.length, 0);
});

test("salary quartiles use annualized job midpoints and linear interpolation", () => {
  const result = api.vizPaySummary([{ payType: "Hourly", payMin: "20", payMax: "30" },
    { payType: "Salary", payMin: "100000" }, { payType: "Salary", payMin: "150000" }, {}]);
  assert.equal(result.count, 3);
  assert.equal(result.mean, 300400 / 3);
  assert.equal(result.p25, 75200);
  assert.equal(result.p75, 125000);
  assert.deepEqual(plain(api.vizPaySummary([])), { count: 0, mean: null, p25: null, p75: null });
  const singleton = api.vizPaySummary([{ payType: "Hourly", payMin: "30" }]);
  assert.equal(singleton.p25, 60480);
  assert.equal(singleton.p75, 60480);
});

test("calendar counts start Monday and respect month, quarter, year, and future boundaries", () => {
  const now = new Date(2026, 8, 7, 12); // Monday, September 7 in the user's timezone.
  const rows = ["2025-12-31", "2026-01-01", "2026-06-30", "2026-07-01", "2026-08-31", "2026-09-01", "2026-09-06", "2026-09-07", "2026-09-08", ""].map((appliedDate) => ({ appliedDate }));
  for (const [period, count] of [["week", 1], ["month", 3], ["quarter", 5], ["year", 7]]) {
    assert.equal(api.vizInRange(rows, api.vizCalendarRange(period, now)).length, count, period);
  }
  assert.equal(api.vizInRange(rows, null).length, 10);
  assert.equal(api.vizCalendarRange("quarter", new Date(2026, 0, 1, 12)).start, Date.UTC(2026, 0, 1));
});

test("rolling filters include today, have explicit day lengths, and custom dates include both endpoints", () => {
  const now = new Date(2026, 2, 10, 12); // Includes a daylight-saving transition in Denver.
  for (const [period, days] of [["week", 7], ["month", 30], ["quarter", 90], ["year", 365]]) {
    const range = api.vizPeriodRange(period, now);
    assert.equal(range.end - range.start, days * 86400000);
    assert.equal(range.end, Date.UTC(2026, 2, 11));
  }
  const range = api.vizPeriodRange("custom", now, { start: "2025-12-31", end: "2026-01-01" });
  assert.equal(api.vizInRange([{ appliedDate: "2025-12-31" }, { appliedDate: "2026-01-01" }, { appliedDate: "2026-01-02" }, {}], range).length, 2);
  assert.equal(api.vizPeriodRange("custom", now, { start: "2026-01-02", end: "2026-01-01" }), null);
});

test("mission comparison uses application-month shares, relative change and percentage points", () => {
  const now = new Date(2026, 8, 7, 12);
  const rows = [
    { appliedDate: "2026-08-01", helping: ["Govt", "Poor"] }, { appliedDate: "2026-08-31" },
    ...Array.from({ length: 3 }, () => ({ appliedDate: "2026-09-01", helping: ["Poor"] })),
    { appliedDate: "2026-09-07" }, { appliedDate: "2026-09-08", helping: ["Govt"] }, { helping: ["Govt"] },
  ];
  const result = api.vizMissionChange(rows, now);
  assert.equal(result.current.total, 4);
  assert.equal(result.current.share, .75);
  assert.equal(result.previous.share, .5);
  assert.equal(result.relative, 50);
  assert.equal(result.points, 25);
  assert.equal(api.vizMissionChange([{ appliedDate: "2026-08-01" }, { appliedDate: "2026-09-01", helping: ["Poor"] }], now).relative, null);
  const noPrevious = api.vizMissionChange([{ appliedDate: "2026-09-01" }], now);
  assert.equal(noPrevious.relative, null);
  assert.equal(noPrevious.points, null);
});

test("area aliases receive the right country and new countries become tabs", () => {
  for (const [location, country] of [["Silicon Valley", "us"], ["Los Angeles area", "us"], ["London area", "gb"], ["Paris area", "fr"], ["Amsterdam area", "nl"], ["DMV", "us"], ["Seattle, WA, USA", "us"]]) {
    const place = api.vizLocation({ location });
    assert.equal(place.country, country, location);
    assert.equal(place.kind, "mapped", location);
    const bounds = api.vizCountryBounds(country);
    assert.ok(place.lon >= bounds[0] && place.lon <= bounds[1] && place.lat >= bounds[2] && place.lat <= bounds[3]);
  }
  const groups = api.vizLocationGroups([{ location: "Amsterdam" }, { location: "Hamburg, Germany" }, { location: "Remote" }, {}, { location: "Unknown place" }]);
  assert.deepEqual(plain(api.vizMapCountries(groups).slice(0, 4)), ["remote", "us", "fr", "gb"]);
  assert.ok(api.vizMapCountries(groups).includes("nl"));
  assert.ok(api.vizMapCountries(groups).includes("de"));
  assert.equal(groups.filter((place) => place.country === "remote").reduce((sum, place) => sum + place.jobs.length, 0), 2);
  assert.equal(api.vizLocation({ location: "Hamburg, Germany" }).kind, "unmapped");
  assert.equal(api.vizLocation({ location: "Unknown place" }).country, "unmapped");
});

test("map popup pay includes hourly estimates and role attributes are deduplicated", () => {
  const result = api.vizPlaceSummary({ jobs: [{ payType: "Hourly", payMin: "25", roles: ["Research", "Other"], roleOther: "Mapping" },
    { payType: "Salary", payMin: "100000", roles: ["Research"] }, {}] });
  assert.equal(result.pay.mean, 75200);
  assert.equal(result.pay.count, 2);
  assert.deepEqual(plain(result.roles), ["Mapping", "Research"]);
});

test("daily and weekly activity bins conserve counts through year boundaries and quiet days", () => {
  const range = { start: Date.UTC(2025, 11, 29), end: Date.UTC(2026, 0, 5) };
  const rows = ["2025-12-28", "2025-12-29", "2026-01-01", "2026-01-04", "2026-01-05", ""].map((appliedDate) => ({ appliedDate }));
  const daily = api.vizActivityModel(rows, range);
  assert.equal(daily.unit, "day");
  assert.equal(daily.bins.length, 7);
  assert.equal(daily.bins.reduce((sum, bin) => sum + bin.jobs.length, 0), 3);
  const weekly = api.vizActivityModel(rows, range, "week");
  assert.equal(weekly.bins.length, 1);
  assert.equal(weekly.bins[0].key, "2025-12-29");
  assert.equal(weekly.bins[0].jobs.length, 3);
  assert.equal(weekly.missing, 1);
});

test("activity metrics use matching cohorts, valid reply intervals and previous windows", () => {
  const range = { start: Date.UTC(2026, 8, 1), end: Date.UTC(2026, 8, 8) };
  const rows = [
    { appliedDate: "2026-08-31" },
    { appliedDate: "2026-09-01", responseDate: "2026-09-03", helping: ["Poor"] },
    { appliedDate: "2026-09-01", interviewDate: "2026-09-05" },
    { appliedDate: "2026-09-01", finalStatus: "Rejected", finalStatusDate: "2026-09-11" },
    { appliedDate: "2026-09-02", responseDate: "2026-09-01" },
    { appliedDate: "2026-09-06", payType: "Hourly", payMin: "25" },
  ];
  const result = api.vizActivityMetrics(rows, range, new Date(2026, 8, 7, 12));
  assert.equal(result.count, 5);
  assert.equal(result.previous, 1);
  assert.equal(result.volumeChange, 400);
  assert.equal(result.pace, 5);
  assert.equal(result.medianReply, 4);
  assert.equal(result.replyCount, 3);
  assert.equal(result.waiting, 1);
  assert.equal(result.interviews, 1);
  assert.equal(result.meanPay, 50400);
  assert.equal(api.vizActivityMetrics([], range).medianReply, null);
});
