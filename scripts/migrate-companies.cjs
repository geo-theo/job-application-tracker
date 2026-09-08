const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const root = path.join(__dirname, "..");
const jobsPath = path.join(root, "db", "jobs.csv");
const companiesPath = path.join(root, "db", "companies.csv");

const jobColumns = [
  "id", "createdAt", "updatedAt", "link", "companyId", "title",
  "locationChoice", "locationOther", "location", "payType", "payMin",
  "payMax", "payMidpoint", "priority", "datePosted", "deadlineChoice",
  "deadline", "appliedStatus", "appliedDate", "applicationStatus",
  "lastHeardFrom", "responseStatus", "responseDate", "screenStatus",
  "screenDate", "interviewStatus", "interviewDate", "assessmentStatus",
  "assessmentDate", "finalStatus", "finalStatusDate", "applicationNeeds",
  "referenceCount", "jobLevel", "favoriteJob", "jobTypes", "roles",
  "roleOther", "descriptionFilename", "descriptionLength",
];

const companyColumns = [
  "id", "createdAt", "updatedAt", "name", "industry", "sector",
  "mission", "website", "rank",
];

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\r" || char === "\n") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  if (cell || row.length) rows.push([...row, cell]);
  return rows;
}

function recordsFromCsv(text) {
  const rows = parseCsv(text);
  const header = rows.shift() || [];
  return rows.filter((row) => row.some(Boolean)).map((row) =>
    Object.fromEntries(header.map((column, index) => [column, row[index] || ""])),
  );
}

function escapeCsv(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toCsv(columns, records) {
  return [columns, ...records.map((record) => columns.map((column) => record[column] || ""))]
    .map((row) => row.map(escapeCsv).join(","))
    .join("\r\n");
}

function industryOf(job) {
  const value = job.industry === "Other" ? job.industryOther : job.industry;
  const aliases = {
    "Defense & Security": "MIC",
    "Federal Govt": "Federal Government",
    "Think Tank": "Policy / Think Tank",
    Media: "Journalism / Media",
    Transport: "Transportation",
    Utilities: "Utilities / Telecommunications",
  };
  return aliases[value] || value || "";
}

const jobs = recordsFromCsv(fs.readFileSync(jobsPath, "utf8"));
if (jobs.every((job) => "companyId" in job) && fs.existsSync(companiesPath)) {
  console.log("Company migration already applied.");
  process.exit(0);
}

const companiesByName = new Map();
for (const job of jobs) {
  const name = job.company.trim();
  if (!name) {
    job.companyId = "";
    continue;
  }
  const key = name.toLocaleLowerCase();
  let company = companiesByName.get(key);
  if (!company) {
    company = {
      id: crypto.randomUUID(),
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      name,
      industry: industryOf(job),
      sector: "",
      mission: "",
      website: "",
      rank: "",
    };
    companiesByName.set(key, company);
  }
  if (!company.industry) company.industry = industryOf(job);
  const mission = new Set(
    [company.mission, job.helping]
      .flatMap((value) => String(value || "").split(";"))
      .map((value) => value.trim())
      .filter(Boolean),
  );
  company.mission = [...mission].join("; ");
  if (String(job.favoriteCompany).toLowerCase() === "true") company.rank = "Favorite";
  company.createdAt = [company.createdAt, job.createdAt].filter(Boolean).sort()[0] || "";
  company.updatedAt = [company.updatedAt, job.updatedAt].filter(Boolean).sort().at(-1) || "";
  job.companyId = company.id;
}

fs.writeFileSync(jobsPath, toCsv(jobColumns, jobs), "utf8");
fs.writeFileSync(
  companiesPath,
  toCsv(companyColumns, [...companiesByName.values()].sort((a, b) => a.name.localeCompare(b.name))),
  "utf8",
);
console.log(`Migrated ${jobs.length} jobs and ${companiesByName.size} companies.`);
