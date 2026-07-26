"use strict";

const DB_NAME = "job-application-tracker";
const DB_VERSION = 1;
const JOB_STORE = "jobs";
const DESCRIPTION_STORE = "descriptions";
const SETTINGS_STORE = "settings";

const ROLE_OPTIONS = [
  "GIS / Geospatial",
  "Intelligence / Risk",
  "Research",
  "Data Analysis",
  "Policy",
  "Program Management",
  "Community Engagement",
  "Field Work",
  "Writing / Editing",
  "Operations",
  "Business Development",
  "Other",
];

const ROLE_ICONS = {
  "GIS / Geospatial": "GIS",
  "Intelligence / Risk": "IR",
  Research: "R",
  "Data Analysis": "DA",
  Policy: "P",
  "Program Management": "PM",
  "Community Engagement": "CE",
  "Field Work": "FW",
  "Writing / Editing": "WE",
  Operations: "O",
  "Business Development": "BD",
};

const CSV_COLUMNS = [
  "id",
  "createdAt",
  "updatedAt",
  "link",
  "company",
  "favoriteCompany",
  "title",
  "locationChoice",
  "locationOther",
  "location",
  "payType",
  "payMin",
  "payMax",
  "payMidpoint",
  "priority",
  "datePosted",
  "deadline",
  "appliedStatus",
  "appliedDate",
  "applicationNeeds",
  "favoriteJob",
  "roles",
  "roleOther",
  "industry",
  "industryOther",
  "helping",
  "descriptionFilename",
  "descriptionLength",
];

const els = {
  form: document.querySelector("#job-form"),
  recordId: document.querySelector("#record-id"),
  newRecordButton: document.querySelector("#new-record-button"),
  cancelEditButton: document.querySelector("#cancel-edit-button"),
  editBanner: document.querySelector("#edit-banner"),
  editBannerText: document.querySelector("#edit-banner-text"),
  jobLink: document.querySelector("#job-link"),
  company: document.querySelector("#company"),
  favoriteCompany: document.querySelector("#favorite-company"),
  jobTitle: document.querySelector("#job-title"),
  locationOther: document.querySelector("#location-other"),
  payMin: document.querySelector("#pay-min"),
  payMax: document.querySelector("#pay-max"),
  payMidpoint: document.querySelector("#pay-midpoint"),
  datePosted: document.querySelector("#date-posted"),
  deadline: document.querySelector("#deadline"),
  appliedStatus: document.querySelectorAll("input[name='appliedStatus']"),
  appliedDate: document.querySelector("#applied-date"),
  applicationNeeds: document.querySelectorAll("input[name='applicationNeeds']"),
  favoriteJob: document.querySelector("#favorite-job"),
  roles: document.querySelector("#roles"),
  roleOtherWrap: document.querySelector("#role-other-wrap"),
  roleOther: document.querySelector("#role-other"),
  industry: document.querySelector("#industry"),
  industryOtherWrap: document.querySelector("#industry-other-wrap"),
  industryOther: document.querySelector("#industry-other"),
  helping: document.querySelector("#helping"),
  scrapeButton: document.querySelector("#scrape-button"),
  downloadDescriptionButton: document.querySelector("#download-description-button"),
  scrapeStatus: document.querySelector("#scrape-status"),
  jobDescription: document.querySelector("#job-description"),
  saveButton: document.querySelector("#save-button"),
  deleteButton: document.querySelector("#delete-button"),
  statusButtons: document.querySelectorAll("[data-status]"),
  sortButtons: document.querySelectorAll("[data-sort]"),
  accordionTriggers: document.querySelectorAll(".accordion-trigger"),
  priorityFilterButton: document.querySelector("#priority-filter-button"),
  sortFilterButton: document.querySelector("#sort-filter-button"),
  roleFilter: document.querySelector("#role-filter"),
  connectFolderButton: document.querySelector("#connect-folder-button"),
  exportCsvButton: document.querySelector("#export-csv-button"),
  exportDescriptionsButton: document.querySelector("#export-descriptions-button"),
  importCsvButton: document.querySelector("#import-csv-button"),
  csvInput: document.querySelector("#csv-input"),
  jobList: document.querySelector("#job-list"),
  recordCount: document.querySelector("#record-count"),
  toast: document.querySelector("#toast"),
};

let db;
let jobs = [];
let editingId = "";
let directoryHandle = null;
let toastTimer = null;
let isResettingForm = false;

const filters = {
  status: "All",
  sortBy: "",
  roles: [],
};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  populateRoleOptions();
  bindEvents();
  updateFilterControls();
  resetForm();
  els.saveButton.disabled = true;
  try {
    db = await openDatabase();
    await restoreDirectoryHandle();
    await refreshJobs();
    els.saveButton.disabled = false;
  } catch (error) {
    showToast("Local database could not be opened.");
  }
}

function bindEvents() {
  els.form.addEventListener("submit", handleSubmit);
  els.form.addEventListener("reset", (event) => {
    if (isResettingForm) return;
    event.preventDefault();
    resetForm();
  });
  els.newRecordButton.addEventListener("click", resetForm);
  els.cancelEditButton.addEventListener("click", resetForm);
  els.deleteButton.addEventListener("click", handleDelete);
  els.payMin.addEventListener("input", updatePayMidpoint);
  els.payMax.addEventListener("input", updatePayMidpoint);
  els.roles.addEventListener("change", syncConditionalFields);
  els.industry.addEventListener("change", syncConditionalFields);
  els.appliedStatus.forEach((input) => input.addEventListener("change", syncConditionalFields));
  els.scrapeButton.addEventListener("click", scrapeJobDescription);
  els.downloadDescriptionButton.addEventListener("click", downloadCurrentDescription);
  els.statusButtons.forEach((button) => {
    button.addEventListener("click", () => {
      filters.status = button.dataset.status;
      updateFilterControls();
      closeFilterAccordions();
      renderJobs();
    });
  });
  els.sortButtons.forEach((button) => {
    button.addEventListener("click", () => {
      filters.sortBy = filters.sortBy === button.dataset.sort ? "" : button.dataset.sort;
      updateFilterControls();
      closeFilterAccordions();
      renderJobs();
    });
  });
  els.accordionTriggers.forEach((button) => {
    button.addEventListener("click", () => {
      const panel = document.querySelector(`#${button.getAttribute("aria-controls")}`);
      const expanded = button.getAttribute("aria-expanded") === "true";
      const shouldExpand = !expanded;
      closeFilterAccordions(button);
      button.setAttribute("aria-expanded", String(shouldExpand));
      if (panel) panel.hidden = !shouldExpand;
    });
  });
  els.roleFilter.addEventListener("change", () => {
    filters.roles = getSelectedValues(els.roleFilter);
    renderJobs();
  });
  els.connectFolderButton.addEventListener("click", connectFolder);
  els.exportCsvButton.addEventListener("click", exportCsv);
  els.exportDescriptionsButton.addEventListener("click", exportDescriptions);
  els.importCsvButton.addEventListener("click", () => els.csvInput.click());
  els.csvInput.addEventListener("change", importCsv);

  document.querySelectorAll("input[name='locationChoice']").forEach((input) => {
    input.addEventListener("change", syncConditionalFields);
  });
}

function populateRoleOptions() {
  ROLE_OPTIONS.forEach((role) => {
    els.roles.append(new Option(role, role));
  });
  updateRoleFilterOptions([]);
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const nextDb = request.result;
      if (!nextDb.objectStoreNames.contains(JOB_STORE)) {
        nextDb.createObjectStore(JOB_STORE, { keyPath: "id" });
      }
      if (!nextDb.objectStoreNames.contains(DESCRIPTION_STORE)) {
        nextDb.createObjectStore(DESCRIPTION_STORE, { keyPath: "jobId" });
      }
      if (!nextDb.objectStoreNames.contains(SETTINGS_STORE)) {
        nextDb.createObjectStore(SETTINGS_STORE, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transaction(storeNames, mode = "readonly") {
  return db.transaction(storeNames, mode);
}

function getStore(storeName, mode = "readonly") {
  return transaction(storeName, mode).objectStore(storeName);
}

function idbRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getAllJobs() {
  return idbRequest(getStore(JOB_STORE).getAll());
}

async function putJob(job) {
  return idbRequest(getStore(JOB_STORE, "readwrite").put(job));
}

async function deleteJobRecord(id) {
  const tx = transaction([JOB_STORE, DESCRIPTION_STORE], "readwrite");
  tx.objectStore(JOB_STORE).delete(id);
  tx.objectStore(DESCRIPTION_STORE).delete(id);
  return transactionDone(tx);
}

async function getDescription(jobId) {
  const record = await idbRequest(getStore(DESCRIPTION_STORE).get(jobId));
  return record?.text ?? "";
}

async function putDescription(jobId, text) {
  return idbRequest(
    getStore(DESCRIPTION_STORE, "readwrite").put({
      jobId,
      text,
      updatedAt: new Date().toISOString(),
    }),
  );
}

async function deleteDescription(jobId) {
  return idbRequest(getStore(DESCRIPTION_STORE, "readwrite").delete(jobId));
}

async function putSetting(key, value) {
  return idbRequest(getStore(SETTINGS_STORE, "readwrite").put({ key, value }));
}

async function getSetting(key) {
  const record = await idbRequest(getStore(SETTINGS_STORE).get(key));
  return record?.value;
}

function transactionDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function refreshJobs() {
  jobs = (await getAllJobs()).sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
  updateRoleFilterOptions(jobs);
  renderJobs();
}

function collectFormData() {
  const now = new Date().toISOString();
  const existing = editingId ? jobs.find((job) => job.id === editingId) : null;
  const id = editingId || createId();
  const locationChoice = getRadioValue("locationChoice");
  const locationOther = els.locationOther.value.trim();
  const location = locationChoice === "Other" ? locationOther : locationChoice;
  const payMin = normalizeNumberString(els.payMin.value);
  const payMax = normalizeNumberString(els.payMax.value);
  const payMidpoint = calculateMidpoint(payMin, payMax);
  const roles = getSelectedValues(els.roles);
  const roleOther = els.roleOther.value.trim();
  const allRoles = rolesToSave(roles, roleOther);
  const industry = els.industry.value;
  const industryOther = els.industryOther.value.trim();
  const appliedStatus = getRadioValue("appliedStatus");
  const descriptionText = els.jobDescription.value.trim();

  return {
    job: {
      id,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      link: els.jobLink.value.trim(),
      company: els.company.value.trim(),
      favoriteCompany: els.favoriteCompany.checked,
      title: els.jobTitle.value.trim(),
      locationChoice,
      locationOther,
      location,
      payType: getRadioValue("payType"),
      payMin,
      payMax,
      payMidpoint,
      priority: getRadioValue("priority"),
      datePosted: els.datePosted.value,
      deadline: els.deadline.value,
      appliedStatus,
      appliedDate: appliedStatus === "Yes" ? els.appliedDate.value : "",
      applicationNeeds: getCheckedValues(els.applicationNeeds),
      favoriteJob: els.favoriteJob.checked,
      roles: allRoles,
      roleOther,
      industry,
      industryOther,
      helping: getSelectedValues(els.helping),
      descriptionFilename: descriptionText
        ? existing?.descriptionFilename || makeDescriptionFilename(id)
        : "",
      descriptionLength: descriptionText.length,
    },
    descriptionText,
  };
}

async function handleSubmit(event) {
  event.preventDefault();
  const { job, descriptionText } = collectFormData();

  await putJob(job);
  if (descriptionText) {
    await putDescription(job.id, descriptionText);
  } else {
    await deleteDescription(job.id);
  }

  editingId = job.id;
  els.recordId.value = job.id;
  await refreshJobs();
  setEditMode(job);
  const syncStatus = await safeSyncToConnectedFolder();
  showToast(syncStatus === "failed" ? "Job saved locally. Folder export failed." : "Job saved.");
}

async function handleDelete() {
  if (!editingId) return;
  const job = jobs.find((item) => item.id === editingId);
  const label = job?.title || job?.company || "this job";
  if (!window.confirm(`Delete ${label}?`)) return;

  await deleteJobRecord(editingId);
  resetForm();
  await refreshJobs();
  const syncStatus = await safeSyncToConnectedFolder();
  showToast(syncStatus === "failed" ? "Job deleted locally. Folder export failed." : "Job deleted.");
}

function resetForm() {
  editingId = "";
  isResettingForm = true;
  els.form.reset();
  isResettingForm = false;
  els.recordId.value = "";
  els.payMidpoint.value = "";
  els.scrapeStatus.textContent = "";
  els.saveButton.textContent = "Save Job";
  els.deleteButton.hidden = true;
  els.editBanner.hidden = true;
  els.downloadDescriptionButton.hidden = true;
  syncConditionalFields();
  updatePayMidpoint();
}

async function loadJobIntoForm(jobId) {
  const job = jobs.find((item) => item.id === jobId);
  if (!job) return;

  editingId = job.id;
  els.recordId.value = job.id;
  els.jobLink.value = job.link || "";
  els.company.value = job.company || "";
  els.favoriteCompany.checked = Boolean(job.favoriteCompany);
  els.jobTitle.value = job.title || "";
  setRadioValue("locationChoice", job.locationChoice || "");
  els.locationOther.value = job.locationOther || "";
  setRadioValue("payType", job.payType || "");
  els.payMin.value = job.payMin || "";
  els.payMax.value = job.payMax || "";
  setRadioValue("priority", job.priority || "");
  els.datePosted.value = job.datePosted || "";
  els.deadline.value = job.deadline || "";
  setRadioValue("appliedStatus", getAppliedStatus(job));
  els.appliedDate.value = job.appliedDate || "";
  setCheckedValues(els.applicationNeeds, job.applicationNeeds || []);
  els.favoriteJob.checked = Boolean(job.favoriteJob);
  setMultiSelectValues(els.roles, normalizeRolesForForm(job.roles || [], job.roleOther));
  els.roleOther.value = job.roleOther || "";
  els.industry.value = job.industry || "";
  els.industryOther.value = job.industryOther || "";
  setMultiSelectValues(els.helping, job.helping || []);
  els.jobDescription.value = await getDescription(job.id);
  els.scrapeStatus.textContent = "";

  setEditMode(job);
  syncConditionalFields();
  updatePayMidpoint();
  document.querySelector(".form-pane").scrollTo({ top: 0, behavior: "smooth" });
}

function setEditMode(job) {
  els.saveButton.textContent = "Update Job";
  els.deleteButton.hidden = false;
  els.editBanner.hidden = false;
  els.editBannerText.textContent = `Editing ${job.title || job.company || "record"}`;
  els.downloadDescriptionButton.hidden = !job.descriptionLength;
}

function syncConditionalFields() {
  const locationChoice = getRadioValue("locationChoice");
  els.locationOther.hidden = locationChoice !== "Other";

  const selectedRoles = getSelectedValues(els.roles);
  els.roleOtherWrap.hidden = !selectedRoles.includes("Other");
  if (els.roleOtherWrap.hidden) els.roleOther.value = "";

  const appliedStatus = getRadioValue("appliedStatus");
  els.appliedDate.hidden = appliedStatus !== "Yes";
  if (appliedStatus !== "Yes") els.appliedDate.value = "";

  els.industryOtherWrap.hidden = els.industry.value !== "Other";
  if (els.industryOtherWrap.hidden) els.industryOther.value = "";
}

function updatePayMidpoint() {
  const midpoint = calculateMidpoint(normalizeNumberString(els.payMin.value), normalizeNumberString(els.payMax.value));
  els.payMidpoint.value = midpoint ? formatCurrency(midpoint) : "";
}

function calculateMidpoint(min, max) {
  const minNumber = parseNumber(min);
  const maxNumber = parseNumber(max);
  if (Number.isFinite(minNumber) && Number.isFinite(maxNumber)) {
    return String((minNumber + maxNumber) / 2);
  }
  return "";
}

function renderJobs() {
  const visibleJobs = getVisibleJobs();
  els.recordCount.textContent = `${jobs.length} ${jobs.length === 1 ? "job" : "jobs"}`;
  els.jobList.replaceChildren();

  if (!visibleJobs.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = jobs.length ? "No jobs match the current filters." : "No saved jobs yet.";
    els.jobList.append(empty);
    return;
  }

  visibleJobs.forEach((job) => {
    els.jobList.append(createJobCard(job));
  });
}

function getVisibleJobs() {
  let visible = [...jobs];
  if (filters.status === "Reference") {
    visible = visible.filter(isReferenceJob);
  } else {
    visible = visible.filter((job) => !isReferenceJob(job));
  }
  if (filters.status !== "All" && filters.status !== "Reference") {
    visible = visible.filter((job) => {
      if (filters.status === "Applied") return isAppliedJob(job);
      return (job.priority || "") === filters.status;
    });
  }
  if (filters.roles.length) {
    visible = visible.filter((job) => filters.roles.some((role) => (job.roles || []).includes(role)));
  }
  if (filters.sortBy === "deadline") {
    visible.sort((a, b) => deadlineRank(a) - deadlineRank(b));
  } else if (filters.sortBy === "priority") {
    visible.sort((a, b) => priorityRank(a) - priorityRank(b));
  }
  return visible;
}

function deadlineRank(job) {
  if (!job.deadline) return 0;
  return new Date(`${job.deadline}T00:00:00`).getTime();
}

function priorityRank(job) {
  const ranks = {
    Urgent: 0,
    High: 1,
    Low: 2,
    Future: 3,
  };
  return ranks[job.priority] ?? 4;
}

function updateFilterControls() {
  els.statusButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.status === filters.status);
  });
  els.sortButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.sort === filters.sortBy);
  });

  const priorityStatuses = ["Urgent", "High", "Low"];
  const activePriority = priorityStatuses.includes(filters.status) ? filters.status : "";
  els.priorityFilterButton.classList.toggle("active", Boolean(activePriority));
  els.priorityFilterButton.textContent = activePriority ? `Priority: ${activePriority}` : "Priority";

  const sortLabels = {
    deadline: "Deadline",
    priority: "Priority",
  };
  els.sortFilterButton.classList.toggle("active", Boolean(filters.sortBy));
  els.sortFilterButton.textContent = filters.sortBy ? `Sort by: ${sortLabels[filters.sortBy]}` : "Sort by";
}

function closeFilterAccordions(exceptButton = null) {
  els.accordionTriggers.forEach((button) => {
    if (button === exceptButton) return;
    const panel = document.querySelector(`#${button.getAttribute("aria-controls")}`);
    button.setAttribute("aria-expanded", "false");
    if (panel) panel.hidden = true;
  });
}

function createJobCard(job) {
  const card = document.createElement("article");
  card.className = `job-card${job.favoriteJob ? " favorite" : ""}`;
  card.tabIndex = 0;
  card.setAttribute("role", "button");
  card.addEventListener("click", () => loadJobIntoForm(job.id));
  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      loadJobIntoForm(job.id);
    }
  });

  const logo = createCompanyLogo(job);

  const main = document.createElement("div");
  main.className = "job-main";
  const titleRow = document.createElement("div");
  titleRow.className = "job-title-row";
  const title = document.createElement("p");
  title.className = "job-title";
  title.textContent = job.title || "";
  titleRow.append(title);
  if (job.favoriteJob) {
    const favoriteStar = document.createElement("span");
    favoriteStar.className = "favorite-star";
    favoriteStar.setAttribute("aria-label", "Favorite job");
    favoriteStar.innerHTML = "&starf;";
    titleRow.append(favoriteStar);
  }
  const company = document.createElement("div");
  company.className = "job-company";
  company.textContent = job.company || "";
  main.append(titleRow, company);

  const location = cell(job.location || "");
  const pay = cell("", "job-pay");
  const payInfo = getPayDisplay(job);
  pay.textContent = payInfo.main;
  if (payInfo.detail) {
    const detail = document.createElement("small");
    detail.textContent = payInfo.detail;
    pay.append(detail);
  }

  const deadline = cell("");
  if (job.deadline) {
    deadline.textContent = formatDate(job.deadline);
  } else {
    const asap = document.createElement("span");
    asap.className = "asap";
    asap.textContent = "ASAP";
    deadline.append(asap);
  }

  const industry = cell(getIndustryDisplay(job), "job-industry");

  const roleChips = document.createElement("div");
  roleChips.className = "chips";
  (job.roles || []).forEach((role) => {
    roleChips.append(roleChip(role));
  });

  const priorityChips = document.createElement("div");
  priorityChips.className = "chips";
  priorityChips.append(statusChip(job));

  const linkWrap = document.createElement("div");
  const link = document.createElement("a");
  link.className = "link-button";
  link.textContent = "Link";
  if (job.link) {
    link.href = job.link;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
  } else {
    link.href = "#";
    link.setAttribute("aria-disabled", "true");
    link.addEventListener("click", (event) => event.preventDefault());
  }
  link.addEventListener("click", (event) => event.stopPropagation());
  linkWrap.append(link);

  card.append(logo, main, location, pay, deadline, industry, roleChips, priorityChips, linkWrap);
  return card;
}

function cell(text, className = "") {
  const div = document.createElement("div");
  div.className = `job-cell ${className}`.trim();
  div.textContent = text;
  return div;
}

function createCompanyLogo(job) {
  const logo = document.createElement("div");
  logo.className = "company-logo";
  const logoSources = getCompanyLogoSources(job.company);

  const image = document.createElement("img");
  image.alt = job.company ? `${job.company} logo` : "Company logo";
  image.loading = "lazy";
  image.src = logoSources.shift();
  image.addEventListener("error", () => {
    const nextSource = logoSources.shift();
    if (nextSource) {
      image.src = nextSource;
      return;
    }
    image.remove();
    logo.classList.add("show-fallback");
  });
  logo.append(image);

  const fallback = document.createElement("span");
  fallback.className = "company-logo-fallback";
  fallback.textContent = "Logo";
  logo.append(fallback);
  return logo;
}

function getCompanyLogoSources(company) {
  const trimmedCompany = (company || "").trim();
  const fileBase = trimmedCompany ? encodeURIComponent(trimmedCompany) : "";
  const sources = fileBase
    ? [".jpg", ".png", ".jpeg"].map((extension) => `img/${fileBase}${extension}`)
    : [];
  return [...sources, "img/placeholder.jpg"];
}

function chip(text, extraClass) {
  const span = document.createElement("span");
  span.className = `chip ${extraClass}`;
  span.textContent = text;
  return span;
}

function roleChip(role) {
  const span = chip(role, `role-${getRoleStyleIndex(role)}`);
  const icon = document.createElement("span");
  icon.className = "chip-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = getRoleIcon(role);
  span.prepend(icon);
  return span;
}

function getRoleStyleIndex(role) {
  const optionIndex = ROLE_OPTIONS.indexOf(role);
  if (optionIndex >= 0) return optionIndex % 8;
  return hashString(role) % 8;
}

function getRoleIcon(role) {
  if (ROLE_ICONS[role]) return ROLE_ICONS[role];
  const words = role
    .split(/[^a-z0-9]+/i)
    .filter(Boolean)
    .slice(0, 2);
  return (words.map((word) => word[0]).join("") || "?").toUpperCase();
}

function getIndustryDisplay(job) {
  if (job.industry === "Other") return job.industryOther || "Other";
  return job.industry || "";
}

function statusChip(job) {
  if (isAppliedJob(job)) return chip("Applied", "applied");
  const priority = job.priority || "";
  if (priority === "Urgent") return chip("Urgent", "urgent");
  if (priority === "High") return chip("High", "high");
  if (priority === "Low") return chip("Low", "low");
  if (priority === "Future") return chip("Future", "future");
  if (isAppliedNo(job)) return chip("Reference", "reference");
  return chip("", "low");
}

function isReferenceJob(job) {
  return (job.priority || "") === "Future" || isAppliedNo(job);
}

function isAppliedJob(job) {
  return getAppliedStatus(job) === "Yes";
}

function isAppliedNo(job) {
  return getAppliedStatus(job) === "No";
}

function getAppliedStatus(job) {
  if (job.appliedStatus) return job.appliedStatus;
  return job.appliedDate ? "Yes" : "";
}

function getPayDisplay(job) {
  const min = parseNumber(job.payMin);
  const max = parseNumber(job.payMax);
  const midpoint = parseNumber(job.payMidpoint);
  const suffix = job.payType ? ` ${job.payType.toLowerCase()}` : "";
  if (Number.isFinite(min) && Number.isFinite(max)) {
    return {
      main: `${formatCurrency(min)} - ${formatCurrency(max)}`,
      detail: midpoint ? `Mid ${formatCurrency(midpoint)}${suffix}` : job.payType || "",
    };
  }
  if (Number.isFinite(midpoint)) {
    return { main: `Avg ${formatCurrency(midpoint)}`, detail: job.payType || "" };
  }
  if (Number.isFinite(min)) {
    return { main: `Avg ${formatCurrency(min)}`, detail: job.payType || "" };
  }
  if (Number.isFinite(max)) {
    return { main: `Avg ${formatCurrency(max)}`, detail: job.payType || "" };
  }
  return { main: "", detail: "" };
}

function updateRoleFilterOptions(sourceJobs) {
  const selected = new Set(filters.roles);
  const knownRoles = unique([
    ...ROLE_OPTIONS,
    ...sourceJobs.flatMap((job) => job.roles || []),
  ]).filter((role) => role && role !== "Other");

  els.roleFilter.replaceChildren();
  knownRoles.forEach((role) => {
    const option = new Option(role, role);
    option.selected = selected.has(role);
    els.roleFilter.append(option);
  });
}

async function scrapeJobDescription() {
  const url = els.jobLink.value.trim();
  if (!url) {
    showToast("Add a job link first.");
    return;
  }

  els.scrapeButton.disabled = true;
  els.scrapeStatus.textContent = "Trying direct scrape...";

  try {
    const response = await fetch(url, { mode: "cors" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const html = await response.text();
    const text = extractReadableText(html);
    if (!text || text.length < 120) throw new Error("No readable description found");
    els.jobDescription.value = text;
    els.scrapeStatus.textContent = "Description scraped.";
    showToast("Description scraped.");
  } catch (error) {
    els.scrapeStatus.textContent = "Scrape blocked. Paste the description manually.";
    showToast("This site blocked direct scraping.");
  } finally {
    els.scrapeButton.disabled = false;
  }
}

function extractReadableText(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  doc.querySelectorAll("script, style, noscript, svg, iframe, nav, header, footer").forEach((node) => node.remove());
  const selectors = [
    "[data-testid*='description' i]",
    "[class*='description' i]",
    "[id*='description' i]",
    "[class*='job' i]",
    "main",
    "article",
    "body",
  ];
  const candidates = selectors
    .flatMap((selector) => [...doc.querySelectorAll(selector)])
    .map((node) => normalizeWhitespace(node.textContent || ""))
    .filter((text) => text.length > 120)
    .sort((a, b) => b.length - a.length);

  return (candidates[0] || "").slice(0, 50000);
}

async function connectFolder() {
  if (!("showDirectoryPicker" in window)) {
    showToast("Folder writing is not supported in this browser.");
    return;
  }

  try {
    directoryHandle = await window.showDirectoryPicker({ mode: "readwrite" });
    try {
      await putSetting("directoryHandle", directoryHandle);
    } catch (error) {
      // Some browsers support folder writing but do not persist handles.
    }
    await safeSyncToConnectedFolder(true);
    showToast("Folder connected.");
  } catch (error) {
    showToast("Folder connection canceled.");
  }
}

async function restoreDirectoryHandle() {
  if (!("showDirectoryPicker" in window)) return;
  try {
    const handle = await getSetting("directoryHandle");
    if (!handle) return;
    const permission = await handle.queryPermission({ mode: "readwrite" });
    if (permission === "granted") {
      directoryHandle = handle;
    }
  } catch (error) {
    directoryHandle = null;
  }
}

async function syncToConnectedFolder(forceNotice = false) {
  if (!directoryHandle) return "skipped";
  const permission = await requestDirectoryPermission(directoryHandle);
  if (permission !== "granted") {
    directoryHandle = null;
    showToast("Folder permission is needed to export files.");
    return "failed";
  }

  const csv = await buildCsv();
  await writeFile(directoryHandle, "jobs.csv", csv);
  const descriptionsDir = await directoryHandle.getDirectoryHandle("job-descriptions", { create: true });
  await Promise.all(
    jobs.map(async (job) => {
      if (!job.descriptionFilename || !job.descriptionLength) return;
      const text = await getDescription(job.id);
      if (text) await writeFile(descriptionsDir, job.descriptionFilename, text);
    }),
  );
  if (forceNotice) showToast("CSV and TXT files exported.");
  return "synced";
}

async function safeSyncToConnectedFolder(forceNotice = false) {
  try {
    return await syncToConnectedFolder(forceNotice);
  } catch (error) {
    return "failed";
  }
}

async function requestDirectoryPermission(handle) {
  const options = { mode: "readwrite" };
  if ((await handle.queryPermission(options)) === "granted") return "granted";
  return handle.requestPermission(options);
}

async function writeFile(parentHandle, fileName, contents) {
  const fileHandle = await parentHandle.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(contents);
  await writable.close();
}

async function exportCsv() {
  const csv = await buildCsv();
  downloadBlob(csv, "jobs.csv", "text/csv");
  showToast("CSV exported.");
}

async function buildCsv() {
  const rows = jobs.map((job) => CSV_COLUMNS.map((column) => serializeCsvValue(job[column])));
  return [CSV_COLUMNS, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\r\n");
}

async function exportDescriptions() {
  const jobsWithDescriptions = jobs.filter((job) => job.descriptionFilename && job.descriptionLength);
  if (!jobsWithDescriptions.length) {
    showToast("No descriptions to export.");
    return;
  }

  if (directoryHandle) {
    const syncStatus = await safeSyncToConnectedFolder(true);
    if (syncStatus === "failed") showToast("Folder export failed.");
    return;
  }

  for (const job of jobsWithDescriptions) {
    const text = await getDescription(job.id);
    if (text) downloadBlob(text, job.descriptionFilename, "text/plain");
    await wait(160);
  }
  showToast("TXT export started.");
}

async function downloadCurrentDescription() {
  if (!editingId) return;
  const job = jobs.find((item) => item.id === editingId);
  const text = await getDescription(editingId);
  if (!job || !text) {
    showToast("No description saved for this job.");
    return;
  }
  downloadBlob(text, job.descriptionFilename || makeDescriptionFilename(job.id), "text/plain");
}

async function importCsv(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const rows = parseCsv(text);
    const header = rows.shift() || [];
    const imported = rows
      .filter((row) => row.some((value) => value.trim()))
      .map((row) => csvRowToJob(header, row));
    for (const job of imported) {
      await putJob(job);
    }
    await refreshJobs();
    const syncStatus = await safeSyncToConnectedFolder();
    showToast(
      syncStatus === "failed"
        ? `${imported.length} imported locally. Folder export failed.`
        : `${imported.length} ${imported.length === 1 ? "job" : "jobs"} imported.`,
    );
  } catch (error) {
    showToast("CSV import failed.");
  } finally {
    event.target.value = "";
  }
}

function csvRowToJob(header, row) {
  const record = {};
  header.forEach((column, index) => {
    record[column] = row[index] ?? "";
  });
  const now = new Date().toISOString();
  return {
    id: record.id || createId(),
    createdAt: record.createdAt || now,
    updatedAt: record.updatedAt || now,
    link: record.link || "",
    company: record.company || "",
    favoriteCompany: parseBoolean(record.favoriteCompany),
    title: record.title || "",
    locationChoice: record.locationChoice || "",
    locationOther: record.locationOther || "",
    location: record.location || "",
    payType: record.payType || "",
    payMin: record.payMin || "",
    payMax: record.payMax || "",
    payMidpoint: record.payMidpoint || calculateMidpoint(record.payMin || "", record.payMax || ""),
    priority: record.priority || "",
    datePosted: record.datePosted || "",
    deadline: record.deadline || "",
    appliedStatus: record.appliedStatus || (record.appliedDate ? "Yes" : ""),
    appliedDate: record.appliedDate || "",
    applicationNeeds: splitList(record.applicationNeeds),
    favoriteJob: parseBoolean(record.favoriteJob),
    roles: splitList(record.roles),
    roleOther: record.roleOther || "",
    industry: record.industry || "",
    industryOther: record.industryOther || "",
    helping: splitList(record.helping),
    descriptionFilename: record.descriptionFilename || "",
    descriptionLength: 0,
  };
}

function serializeCsvValue(value) {
  if (Array.isArray(value)) return value.join("; ");
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  return value ?? "";
}

function escapeCsv(value) {
  const text = String(value);
  if (!/[",\r\n]/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      i += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function getRadioValue(name) {
  return document.querySelector(`input[name='${name}']:checked`)?.value || "";
}

function setRadioValue(name, value) {
  document.querySelectorAll(`input[name='${name}']`).forEach((input) => {
    input.checked = input.value === value;
  });
}

function getSelectedValues(select) {
  return [...select.selectedOptions].map((option) => option.value);
}

function getCheckedValues(inputs) {
  return [...inputs].filter((input) => input.checked).map((input) => input.value);
}

function setMultiSelectValues(select, values) {
  const valueSet = new Set(values);
  [...select.options].forEach((option) => {
    option.selected = valueSet.has(option.value);
  });
}

function setCheckedValues(inputs, values) {
  const valueSet = new Set(values);
  [...inputs].forEach((input) => {
    input.checked = valueSet.has(input.value);
  });
}

function normalizeRolesForForm(roles, roleOther) {
  const known = new Set(ROLE_OPTIONS);
  const normalized = roles.map((role) => (known.has(role) ? role : "Other"));
  if (roleOther) normalized.push("Other");
  return unique(normalized);
}

function rolesToSave(roles, roleOther) {
  const selected = roles.filter((role) => role !== "Other");
  if (roles.includes("Other")) selected.push(roleOther || "Other");
  return unique(selected);
}

function normalizeNumberString(value) {
  return value.replace(/[$,\s]/g, "").trim();
}

function parseNumber(value) {
  if (value === null || value === undefined || value === "") return NaN;
  return Number(String(value).replace(/[$,\s]/g, ""));
}

function formatCurrency(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "";
  const hasCents = Math.abs(number % 1) > 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: hasCents ? 2 : 0,
  }).format(number);
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
}

function makeDescriptionFilename(id) {
  const company = slugify(els.company.value || "company");
  const title = slugify(els.jobTitle.value || "job");
  return `${company}-${title}-${id.slice(0, 8)}.txt`;
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 42) || "job";
}

function createId() {
  if ("crypto" in window && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function hashString(value) {
  return [...value].reduce((hash, char) => hash + char.charCodeAt(0), 0);
}

function splitList(value) {
  if (!value) return [];
  return value
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseBoolean(value) {
  return String(value).toLowerCase() === "true";
}

function normalizeWhitespace(value) {
  return value.replace(/\s+/g, " ").trim();
}

function downloadBlob(contents, fileName, type) {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  els.toast.textContent = message;
  els.toast.hidden = false;
  toastTimer = window.setTimeout(() => {
    els.toast.hidden = true;
  }, 2800);
}
