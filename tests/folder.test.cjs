const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { webcrypto } = require("node:crypto");

const source = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const geographySource = fs.readFileSync(
  path.join(__dirname, "..", "viz-geography.js"),
  "utf8",
);
const locationsSource = fs.readFileSync(
  path.join(__dirname, "..", "locations.js"),
  "utf8",
);
const plain = (value) => JSON.parse(JSON.stringify(value));

function app() {
  const elements = new Map();
  const context = vm.createContext({
    structuredClone, crypto: webcrypto,
    document: {
      querySelector(selector) {
        if (!elements.has(selector)) elements.set(selector, { focus() {} });
        return elements.get(selector);
      },
      querySelectorAll: () => [],
      addEventListener() {},
    },
    window: { location: { hash: "#all" }, showDirectoryPicker: async () => {} },
    // A browser with old records must never be accessed, even on startup.
    get indexedDB() { throw new Error("Old browser database accessed"); },
    get localStorage() { throw new Error("Old browser storage accessed"); },
    fetch() { throw new Error("Unexpected repository fetch"); },
  });
  vm.runInContext(geographySource, context);
  vm.runInContext(locationsSource, context);
  vm.runInContext(source, context);
  // Keep the real startup, storage, folder, parsing, joining and sync behavior;
  // replace only DOM rendering and event wiring in this integration harness.
  vm.runInContext(`
    populateRoleOptions = populateSectorOptions = bindEvents =
    syncPageFromHash = updateFilterControls = resetForm =
    updateCompanyOptions = updateCompanyFilterOptions =
    updateRoleFilterOptions = updateIndustryFilterOptions = renderJobs = () => {};
    showToast = (message) => { window.lastToast = message; };
  `, context);
  return {
    context, elements,
    api: vm.runInContext(`({ init, connectFolder, refreshJobs, putJob, putCompany,
      putDescription, getAllJobs, getAllCompanies, getDescription,
      getDataDirectoryHandle, syncToConnectedFolder,
      state: () => ({ jobs, companies, directoryHandle }) })`, context),
  };
}

function folder(name, initialFiles = {}, dirs = {}) {
  const files = new Map(Object.entries(initialFiles));
  const writes = [];
  const missing = () => Object.assign(new Error("Missing"), { name: "NotFoundError" });
  return {
    name, files, writes,
    queryPermission: async () => "granted",
    async getFileHandle(filename, options = {}) {
      if (!files.has(filename) && !options.create) throw missing();
      return {
        getFile: async () => ({ text: async () => files.get(filename) }),
        createWritable: async () => ({
          async write(text) { writes.push(filename); files.set(filename, text); },
          async close() {},
        }),
      };
    },
    async getDirectoryHandle(dirname, options = {}) {
      if (!dirs[dirname] && options.create) dirs[dirname] = folder(dirname);
      if (!dirs[dirname]) throw missing();
      return dirs[dirname];
    },
  };
}

const csvFiles = {
  "jobs.csv": "id,companyId,title,updatedAt,descriptionFilename\nshared,csv-company,CSV job,2020-01-01,shared.txt\n",
  "companies.csv": "id,name,updatedAt\ncsv-company,CSV Company,2020-01-01\n",
};

async function connect(instance, handle) {
  instance.context.window.showDirectoryPicker = async () => handle;
  await instance.api.connectFolder();
}

test("every launch starts empty behind the folder gate without reading browser storage", async () => {
  const first = app();
  await first.api.init();
  await first.api.putJob({ id: "old", title: "Browser-only job" });
  const reloaded = app();
  await reloaded.api.init();
  assert.deepEqual(plain(await reloaded.api.getAllJobs()), []);
  assert.deepEqual(plain(await reloaded.api.getAllCompanies()), []);
  assert.equal(reloaded.api.state().directoryHandle, null);
  assert.equal(reloaded.elements.get("#folder-gate").hidden, false);
  assert.equal(reloaded.elements.get("#tracker-app").inert, true);
});

test("folder CSV replaces newer old rows, absent rows, companies and descriptions without writing", async () => {
  const instance = app();
  await instance.api.init();
  await instance.api.putJob({ id: "shared", title: "Stale override", updatedAt: "2099-01-01" });
  await instance.api.putJob({ id: "browser-only" });
  await instance.api.putCompany({ id: "browser-company", name: "CSV Company", updatedAt: "2099-01-01" });
  await instance.api.putDescription("shared", "Stale description");
  await instance.api.putDescription("browser-only", "Orphan description");
  const descriptions = folder("job-descriptions", { "shared.txt": "Folder description" });
  const data = folder("db", csvFiles, { "job-descriptions": descriptions });
  await connect(instance, folder("repository", {}, { db: data }));
  const state = instance.api.state();
  assert.equal(state.jobs.length, 1);
  assert.equal(state.jobs[0].title, "CSV job");
  assert.equal(state.jobs[0].companyId, "csv-company");
  assert.equal(state.jobs[0].company, "CSV Company");
  assert.deepEqual(plain(state.companies.map((company) => company.id)), ["csv-company"]);
  assert.equal(await instance.api.getDescription("shared"), "Folder description");
  assert.equal(await instance.api.getDescription("browser-only"), "");
  assert.deepEqual(data.writes, []);
  assert.deepEqual(descriptions.writes, []);
  assert.equal(instance.elements.get("#folder-gate").hidden, true);
  assert.equal(state.directoryHandle, data);
});

test("reconnecting reads disk edits regardless of timestamps and clears missing descriptions", async () => {
  const instance = app();
  const data = folder("db", csvFiles);
  await connect(instance, data);
  await instance.api.putDescription("shared", "Old text");
  data.files.set("jobs.csv", csvFiles["jobs.csv"].replace("CSV job", "Changed on disk"));
  await connect(instance, data);
  assert.equal(instance.api.state().jobs[0].title, "Changed on disk");
  assert.equal(await instance.api.getDescription("shared"), "");
  assert.equal(instance.api.state().jobs[0].descriptionLength, 0);
  assert.deepEqual(data.writes, []);
});

test("switching to an empty folder clears all records and does not populate its files", async () => {
  const instance = app();
  await connect(instance, folder("db", csvFiles));
  const empty = folder("empty");
  await connect(instance, empty);
  assert.deepEqual(plain(instance.api.state().jobs), []);
  assert.deepEqual(plain(instance.api.state().companies), []);
  assert.equal(empty.files.size, 0);
  assert.equal(instance.api.state().directoryHandle, empty);
});

test("read errors and denied permissions leave the session empty and gated, with no writes", async () => {
  for (const failure of ["read", "permission"]) {
    const instance = app();
    await connect(instance, folder("db", csvFiles));
    const broken = folder("db", csvFiles);
    if (failure === "read") broken.getFileHandle = async () => { throw new Error("Unreadable"); };
    else {
      broken.queryPermission = async () => "denied";
      broken.requestPermission = async () => "denied";
    }
    await connect(instance, broken);
    assert.deepEqual(plain(await instance.api.getAllJobs()), []);
    assert.equal(instance.api.state().directoryHandle, null);
    assert.equal(instance.elements.get("#folder-gate").hidden, false);
    assert.deepEqual(broken.writes, []);
  }
});

test("canceling the first picker keeps the blank gate; canceling a switch preserves the active folder", async () => {
  const instance = app();
  await instance.api.init();
  const cancel = async () => { throw Object.assign(new Error("Canceled"), { name: "AbortError" }); };
  instance.context.window.showDirectoryPicker = cancel;
  await instance.api.connectFolder();
  assert.equal(instance.elements.get("#folder-gate").hidden, false);
  const data = folder("db", csvFiles);
  await connect(instance, data);
  instance.context.window.showDirectoryPicker = cancel;
  await instance.api.connectFolder();
  assert.equal(instance.api.state().directoryHandle, data);
  assert.equal(instance.api.state().jobs.length, 1);
});

test("saving session changes still writes the selected folder and reloads from its CSV", async () => {
  const instance = app();
  const data = folder("db", csvFiles);
  await connect(instance, data);
  const [job] = await instance.api.getAllJobs();
  await instance.api.putJob({ ...job, title: "Saved edit" });
  await instance.api.refreshJobs();
  assert.equal(await instance.api.syncToConnectedFolder(), "synced");
  assert.match(data.files.get("jobs.csv"), /Saved edit/);
  const reloaded = app();
  await reloaded.api.init();
  assert.deepEqual(plain(reloaded.api.state().jobs), []);
  await connect(reloaded, data);
  assert.equal(reloaded.api.state().jobs[0].title, "Saved edit");
});

test("repository selection resolves its db folder even when CSV files are absent", async () => {
  const instance = app();
  const data = folder("db", {}, { "job-descriptions": folder("job-descriptions") });
  assert.equal(await instance.api.getDataDirectoryHandle(folder("repo", {}, { db: data })), data);
  assert.equal(await instance.api.getDataDirectoryHandle(data), data);
});

test("applied CSV rows discard pre-application priority", () => {
  const instance = app();
  const parseJobsCsv = vm.runInContext("parseJobsCsv", instance.context);
  const rows = parseJobsCsv([
    "id,appliedStatus,appliedDate,finalStatus,priority",
    "pending,,,,Urgent",
    "applied,Yes,2026-09-20,,High",
    "accepted,,,Accepted,Medium",
    "reference,No,,,Low",
  ].join("\n"));
  const priorities = Object.fromEntries(rows.map((job) => [job.id, job.priority]));
  assert.deepEqual(priorities, {
    pending: "Urgent",
    applied: "",
    accepted: "",
    reference: "Future",
  });
});

test("the actual repository CSVs load exclusively from the selected folder", async () => {
  const instance = app();
  const files = Object.fromEntries(["jobs.csv", "companies.csv"].map((name) =>
    [name, fs.readFileSync(path.join(__dirname, "..", "db", name), "utf8")]));
  const descriptions = Object.fromEntries(fs.readdirSync(path.join(__dirname, "..", "db", "job-descriptions"))
    .map((name) => [name, fs.readFileSync(path.join(__dirname, "..", "db", "job-descriptions", name), "utf8")]));
  const data = folder("db", files, { "job-descriptions": folder("job-descriptions", descriptions) });
  await connect(instance, data);
  const expected = vm.runInContext("parseJobsCsv", instance.context)(files["jobs.csv"]);
  assert.ok(expected.length > 0);
  assert.deepEqual(plain(instance.api.state().jobs.map((job) => job.id).sort()), plain(expected.map((job) => job.id).sort()));
  assert.deepEqual(data.writes, []);
});
