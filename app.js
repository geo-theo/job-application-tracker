"use strict";

const DB_NAME = "job-application-tracker";
const DB_VERSION = 2;
const JOB_STORE = "jobs";
const COMPANY_STORE = "companies";
const DESCRIPTION_STORE = "descriptions";
const SETTINGS_STORE = "settings";

const ROLE_OPTIONS = [
  "Cartographer",
  "Geospatial Analyst",
  "Data Analyst",
  "Data Governance",
  "Data Viz",
  "Data Engineer",
  "Product Engineer",
  "Software Engineer",
  "Geopolitical Risk",
  "Intelligence",
  "Supply Chain",
  "Researcher",
  "Project Manager",
  "Ops / Mgmt",
  "Business Development",
  "Technical Writer",
  "Technician",
  "Teacher",
  "Retail / Customer Service",
  "Other",
];

const ROLE_ICONS = {
  Cartographer: "GIS",
  "Geospatial Analyst": "GIS",
  "Data Analyst": "DATA",
  "Data Governance": "DATA",
  "Data Viz": "DATA",
  "Data Engineer": "CODE",
  "Product Engineer": "CODE",
  "Software Engineer": "CODE",
  "Geopolitical Risk": "IR",
  Intelligence: "IR",
  "Supply Chain": "SC",
  Researcher: "RSC",
  "Project Manager": "PM",
  "Ops / Mgmt": "OPS",
  "Business Development": "BD",
  "Technical Writer": "TW",
  Technician: "TECH",
  "Retail / Customer Service": "!",
};

const JOB_CSV_COLUMNS = [
  "id",
  "createdAt",
  "updatedAt",
  "link",
  "companyId",
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
  "deadlineChoice",
  "deadline",
  "appliedStatus",
  "appliedDate",
  "applicationStatus",
  "lastHeardFrom",
  "responseStatus",
  "responseDate",
  "screenStatus",
  "screenDate",
  "interviewStatus",
  "interviewDate",
  "assessmentStatus",
  "assessmentDate",
  "finalStatus",
  "finalStatusDate",
  "applicationNeeds",
  "referenceCount",
  "jobLevel",
  "favoriteJob",
  "jobTypes",
  "roles",
  "roleOther",
  "descriptionFilename",
  "descriptionLength",
];

const COMPANY_CSV_COLUMNS = [
  "id",
  "createdAt",
  "updatedAt",
  "name",
  "industry",
  "sector",
  "mission",
  "website",
  "rank",
];

// Edit these lists to change the dependent Sector menu. Custom values are
// stored directly in companies.csv and reopen through the Other option.
const SECTOR_OPTIONS_BY_INDUSTRY = {
  Geospatial: [
    "GIS Software",
    "Earth Observation",
    "Surveying / Mapping",
    "Location Intelligence",
  ],
  "Geopolitical Risk": [
    "Risk Intelligence",
    "Political Risk Consulting",
    "Due Diligence",
  ],
  "Intl Development": [
    "Humanitarian Aid",
    "Economic Development",
    "Global Health",
  ],
  MIC: ["Defense Technology", "Weapons", "Government Contracting"],
  Tech: ["Software", "Hardware", "Cloud Services"],
  "Intl Government": [
    "Multilateral",
    "Foreign Government",
    "Intergovernmental",
  ],
  "Federal Government": ["Civilian Agency", "Defense", "Intelligence"],
  "Local Government": ["City", "County", "Regional"],
  NGO: ["Humanitarian", "Conservation", "Advocacy"],
  "Policy / Think Tank": ["Public Policy", "Research", "Advocacy"],
  "Journalism / Media": ["News", "Digital Media", "Publishing"],
  Academia: ["Higher Education", "Research Institute", "K-12"],
  Energy: ["Oil & Gas", "Renewable Energy", "Mining"],
  "Utilities / Telecommunications": ["Electric", "Water", "Telecommunications"],
  Engineering: ["Civil Engineering", "Architecture", "Construction"],
  Transportation: ["Aviation", "Rail", "Logistics"],
  "Tourism / Leisure": ["Outdoor Recreation", "Hospitality", "Travel"],
  "Consumer Products": [
    "Food & Beverage",
    "Apparel",
    "Consumer Packaged Goods",
  ],
  "Retail / Customer Experience": ["Retail", "E-commerce", "Customer Service"],
};

const PAGE_CONFIG = {
  all: { title: "All Jobs", empty: "No saved jobs yet." },
  "full-time": {
    title: "Full-time",
    empty: "No full-time jobs match this view.",
  },
  internship: {
    title: "Internships",
    empty: "No internships match this view.",
  },
  "part-time": {
    title: "Part-time",
    empty: "No part-time jobs match this view.",
  },
  favorites: {
    title: "Favorites",
    empty: "No favorited jobs or companies yet.",
  },
  companies: { title: "Companies", empty: "No companies saved yet." },
  applied: { title: "Applied", empty: "No applied jobs match this view." },
  reference: {
    title: "Reference",
    empty: "No reference jobs match this view.",
  },
  viz: { title: "Viz", empty: "" },
};

const els = {
  trackerApp: document.querySelector("#tracker-app"),
  folderGate: document.querySelector("#folder-gate"),
  folderGateButton: document.querySelector("#folder-gate-button"),
  folderGateStatus: document.querySelector("#folder-gate-status"),
  formDialog: document.querySelector("#job-form-dialog"),
  formBackdrop: document.querySelector("#form-backdrop"),
  formCloseButton: document.querySelector("#form-close-button"),
  form: document.querySelector("#job-form"),
  recordId: document.querySelector("#record-id"),
  newRecordButton: document.querySelector("#new-record-button"),
  cancelEditButton: document.querySelector("#cancel-edit-button"),
  editBanner: document.querySelector("#edit-banner"),
  editBannerText: document.querySelector("#edit-banner-text"),
  jobLink: document.querySelector("#job-link"),
  company: document.querySelector("#company"),
  companyId: document.querySelector("#company-id"),
  companyOptions: document.querySelector("#company-options"),
  editCompanyInfoButton: document.querySelector("#edit-company-info-button"),
  jobTitle: document.querySelector("#job-title"),
  locationOther: document.querySelector("#location-other"),
  payMin: document.querySelector("#pay-min"),
  payMax: document.querySelector("#pay-max"),
  payMidpoint: document.querySelector("#pay-midpoint"),
  datePosted: document.querySelector("#date-posted"),
  deadlineChoice: document.querySelector("#deadline-choice"),
  deadline: document.querySelector("#deadline"),
  priorityInputs: document.querySelectorAll("input[name='priority']"),
  appliedStatus: document.querySelectorAll("input[name='appliedStatus']"),
  appliedDate: document.querySelector("#applied-date"),
  appliedTrackingPanel: document.querySelector("#applied-tracking-panel"),
  responseStatus: document.querySelectorAll("input[name='responseStatus']"),
  responseDate: document.querySelector("#response-date"),
  screenStatus: document.querySelectorAll("input[name='screenStatus']"),
  screenDate: document.querySelector("#screen-date"),
  interviewStatus: document.querySelectorAll("input[name='interviewStatus']"),
  interviewDate: document.querySelector("#interview-date"),
  assessmentStatus: document.querySelectorAll("input[name='assessmentStatus']"),
  assessmentDate: document.querySelector("#assessment-date"),
  finalStatus: document.querySelectorAll("input[name='finalStatus']"),
  finalStatusDate: document.querySelector("#final-status-date"),
  applicationNeeds: document.querySelectorAll("input[name='applicationNeeds']"),
  needsReferences: document.querySelector("#needs-references"),
  referenceCountWrap: document.querySelector("#reference-count-wrap"),
  referenceCount: document.querySelector("#reference-count"),
  favoriteJob: document.querySelector("#favorite-job"),
  roles: document.querySelector("#roles"),
  roleOtherWrap: document.querySelector("#role-other-wrap"),
  roleOther: document.querySelector("#role-other"),
  companyFormDialog: document.querySelector("#company-form-dialog"),
  companyFormCloseButton: document.querySelector("#company-form-close-button"),
  companyForm: document.querySelector("#company-form"),
  companyRecordId: document.querySelector("#company-record-id"),
  companyName: document.querySelector("#company-name"),
  companyIndustry: document.querySelector("#company-industry"),
  companyIndustryOtherWrap: document.querySelector(
    "#company-industry-other-wrap",
  ),
  companyIndustryOther: document.querySelector("#company-industry-other"),
  companySector: document.querySelector("#company-sector"),
  companySectorOtherWrap: document.querySelector("#company-sector-other-wrap"),
  companySectorOther: document.querySelector("#company-sector-other"),
  companyMission: document.querySelector("#company-mission"),
  companyWebsite: document.querySelector("#company-website"),
  scrapeButton: document.querySelector("#scrape-button"),
  downloadDescriptionButton: document.querySelector(
    "#download-description-button",
  ),
  scrapeStatus: document.querySelector("#scrape-status"),
  jobDescription: document.querySelector("#job-description"),
  saveButton: document.querySelector("#save-button"),
  deleteButton: document.querySelector("#delete-button"),
  pageButtons: document.querySelectorAll("[data-page]"),
  pageTypeFilterWrap: document.querySelector("#page-type-filter-wrap"),
  pageTypeFilterButton: document.querySelector("#page-type-filter-button"),
  pageTypeButtons: document.querySelectorAll("[data-page-type-filter]"),
  appliedStatusFilterWrap: document.querySelector(
    "#applied-status-filter-wrap",
  ),
  appliedStatusFilterButton: document.querySelector(
    "#applied-status-filter-button",
  ),
  appliedStatusButtons: document.querySelectorAll(
    "[data-applied-status-filter]",
  ),
  priorityFilterWrap: document.querySelector("#priority-filter-wrap"),
  priorityButtons: document.querySelectorAll("[data-priority-filter]"),
  sortButtons: document.querySelectorAll("[data-sort]"),
  accordionTriggers: document.querySelectorAll(".accordion-trigger"),
  priorityFilterButton: document.querySelector("#priority-filter-button"),
  sortFilterButton: document.querySelector("#sort-filter-button"),
  roleFilterButton: document.querySelector("#role-filter-button"),
  roleFilter: document.querySelector("#role-filter"),
  industryFilterButton: document.querySelector("#industry-filter-button"),
  industryFilter: document.querySelector("#industry-filter"),
  boardTitle: document.querySelector("#board-title"),
  boardControls: document.querySelector("#board-controls"),
  connectFolderButton: document.querySelector("#connect-folder-button"),
  exportCsvButton: document.querySelector("#export-csv-button"),
  exportCompaniesButton: document.querySelector("#export-companies-button"),
  exportDescriptionsButton: document.querySelector(
    "#export-descriptions-button",
  ),
  importCsvButton: document.querySelector("#import-csv-button"),
  csvInput: document.querySelector("#csv-input"),
  importCompaniesButton: document.querySelector("#import-companies-button"),
  companiesCsvInput: document.querySelector("#companies-csv-input"),
  jobList: document.querySelector("#job-list"),
  recordCount: document.querySelector("#record-count"),
  toast: document.querySelector("#toast"),
};

let db;
let jobs = [];
let companies = [];
let editingId = "";
let editingCompanyId = "";
let directoryHandle = null;
let toastTimer = null;
let isResettingForm = false;
let isResettingCompanyForm = false;
let activePage = getPageFromHash();
let lastFocusedElement = null;
let lastCompanyFocusedElement = null;
let companyEditorOpenedFromJob = false;

const filters = {
  type: "All",
  applicationStatus: "All",
  priorities: [],
  sortBy: "deadline",
  roles: [],
  industries: [],
};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  populateRoleOptions();
  populateSectorOptions();
  bindEvents();
  syncPageFromHash();
  updateFilterControls();
  resetForm();
  els.saveButton.disabled = true;
  try {
    db = await openDatabase();
    setFolderGate(true);
  } catch (error) {
    setFolderGate(
      true,
      "The folder could not be opened. Try connecting again.",
    );
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
  els.newRecordButton.addEventListener("click", openNewJobForm);
  els.formCloseButton.addEventListener("click", closeFormDialog);
  els.formBackdrop.addEventListener("click", () => {
    if (!els.companyFormDialog.hidden) closeCompanyFormDialog();
    else closeFormDialog();
  });
  els.cancelEditButton.addEventListener("click", () => {
    resetForm();
    closeFormDialog();
  });
  els.deleteButton.addEventListener("click", handleDelete);
  els.payMin.addEventListener("input", updatePayMidpoint);
  els.payMax.addEventListener("input", updatePayMidpoint);
  els.roles.addEventListener("change", syncConditionalFields);
  els.company.addEventListener("input", syncJobCompanySelection);
  els.company.addEventListener("change", syncJobCompanySelection);
  els.editCompanyInfoButton.addEventListener("click", () =>
    openCompanyEditorFromJob(),
  );
  els.companyForm.addEventListener("submit", handleCompanySubmit);
  els.companyForm.addEventListener("reset", (event) => {
    if (isResettingCompanyForm) return;
    event.preventDefault();
    resetCompanyForm();
  });
  els.companyFormCloseButton.addEventListener("click", closeCompanyFormDialog);
  els.companyIndustry.addEventListener("change", () => {
    populateSectorOptions();
    syncCompanyConditionalFields();
  });
  els.companyName.addEventListener("input", () =>
    els.companyName.setCustomValidity(""),
  );
  els.companySector.addEventListener("change", syncCompanyConditionalFields);
  els.deadlineChoice.addEventListener("change", handleDeadlineChoiceChange);
  document
    .querySelectorAll(
      "input[name='priority'], input[name='jobLevel'], input[name='appliedStatus'], input[name='responseStatus'], input[name='screenStatus'], input[name='interviewStatus'], input[name='assessmentStatus'], input[name='finalStatus'], input[name='companyRank']",
    )
    .forEach((input) => {
      input.addEventListener("pointerdown", rememberRadioState);
      input.addEventListener("click", toggleCheckedRadio);
      input.addEventListener("keydown", toggleCheckedRadioWithKeyboard);
    });
  document
    .querySelector(".priority-group")
    ?.addEventListener("pointerdown", rememberToggleableGroupRadioState);
  document
    .querySelector(".level-group")
    ?.addEventListener("pointerdown", rememberToggleableGroupRadioState);
  document
    .querySelector(".company-rank-group")
    ?.addEventListener("pointerdown", rememberToggleableGroupRadioState);
  document
    .querySelector(".applied-group")
    ?.addEventListener("pointerdown", rememberToggleableGroupRadioState);
  document
    .querySelectorAll(".lifecycle-toggle, .lifecycle-status-group")
    .forEach((group) => {
      group.addEventListener("pointerdown", rememberToggleableGroupRadioState);
    });
  els.priorityInputs.forEach((input) =>
    input.addEventListener("change", handlePriorityChange),
  );
  els.appliedStatus.forEach((input) =>
    input.addEventListener("change", handleAppliedStatusChange),
  );
  [
    ...els.responseStatus,
    ...els.screenStatus,
    ...els.interviewStatus,
    ...els.assessmentStatus,
    ...els.finalStatus,
  ].forEach((input) => {
    input.addEventListener("change", syncConditionalFields);
  });
  els.needsReferences.addEventListener("change", syncConditionalFields);
  els.scrapeButton.addEventListener("click", scrapeJobDescription);
  els.downloadDescriptionButton.addEventListener(
    "click",
    downloadCurrentDescription,
  );
  els.pageButtons.forEach((button) => {
    button.addEventListener("click", () =>
      setActivePage(button.dataset.page || "all"),
    );
  });
  els.pageTypeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      filters.type = button.dataset.pageTypeFilter || "All";
      updateFilterControls();
      closeFilterAccordions();
      renderJobs();
    });
  });
  els.appliedStatusButtons.forEach((button) => {
    button.addEventListener("click", () => {
      filters.applicationStatus = button.dataset.appliedStatusFilter || "All";
      updateFilterControls();
      closeFilterAccordions();
      renderJobs();
    });
  });
  els.priorityButtons.forEach((button) => {
    button.addEventListener("click", (event) => {
      filters.priorities = updateOptionSelection(
        filters.priorities,
        button.dataset.priorityFilter,
        event,
      );
      updateFilterControls();
      if (!event.ctrlKey && !event.metaKey) closeFilterAccordions();
      renderJobs();
    });
  });
  els.sortButtons.forEach((button) => {
    button.addEventListener("click", () => {
      filters.sortBy = button.dataset.sort || "deadline";
      updateFilterControls();
      closeFilterAccordions();
      renderJobs();
    });
  });
  els.accordionTriggers.forEach((button) => {
    button.addEventListener("click", () => {
      const panel = document.querySelector(
        `#${button.getAttribute("aria-controls")}`,
      );
      const expanded = button.getAttribute("aria-expanded") === "true";
      const shouldExpand = !expanded;
      closeFilterAccordions(button);
      button.setAttribute("aria-expanded", String(shouldExpand));
      if (panel) panel.hidden = !shouldExpand;
    });
  });
  els.roleFilter.addEventListener("click", (event) => {
    const button =
      event.target instanceof Element
        ? event.target.closest("[data-role-filter]")
        : null;
    if (!button) return;
    filters.roles = updateOptionSelection(
      filters.roles,
      button.dataset.roleFilter,
      event,
    );
    updateFilterControls();
    if (!event.ctrlKey && !event.metaKey) closeFilterAccordions();
    renderJobs();
  });
  els.industryFilter.addEventListener("click", (event) => {
    const button =
      event.target instanceof Element
        ? event.target.closest("[data-industry-filter]")
        : null;
    if (!button) return;
    filters.industries = updateOptionSelection(
      filters.industries,
      button.dataset.industryFilter,
      event,
    );
    updateFilterControls();
    if (!event.ctrlKey && !event.metaKey) closeFilterAccordions();
    renderJobs();
  });
  els.connectFolderButton.addEventListener("click", connectFolder);
  els.folderGateButton.addEventListener("click", connectFolder);
  els.exportCsvButton.addEventListener("click", exportCsv);
  els.exportCompaniesButton.addEventListener("click", exportCompaniesCsv);
  els.exportDescriptionsButton.addEventListener("click", exportDescriptions);
  els.importCsvButton.addEventListener("click", () => els.csvInput.click());
  els.csvInput.addEventListener("change", importCsv);
  els.importCompaniesButton.addEventListener("click", () =>
    els.companiesCsvInput.click(),
  );
  els.companiesCsvInput.addEventListener("change", importCompaniesCsv);

  document.querySelectorAll("input[name='locationChoice']").forEach((input) => {
    input.addEventListener("change", syncConditionalFields);
  });

  document.addEventListener("keydown", handleDocumentKeydown);
  window.addEventListener("hashchange", syncPageFromHash);
}

function populateRoleOptions() {
  ROLE_OPTIONS.forEach((role) => {
    els.roles.append(new Option(role, role));
  });
  updateRoleFilterOptions([]);
  updateIndustryFilterOptions([]);
}

function populateSectorOptions(selectedValue = "") {
  const industry = getCompanyIndustryFormValue();
  const presets = SECTOR_OPTIONS_BY_INDUSTRY[industry] || [];
  const current = selectedValue || els.companySector.value;
  els.companySector.replaceChildren(new Option("", ""));
  presets.forEach((sector) =>
    els.companySector.append(new Option(sector, sector)),
  );
  els.companySector.append(new Option("Other", "Other"));
  els.companySector.value =
    presets.includes(current) || current === "Other" ? current : "";
}

function ensureRoleOptions(roles) {
  const existing = new Set(
    [...els.roles.options].map((option) => option.value),
  );
  const otherOption =
    [...els.roles.options].find((option) => option.value === "Other") || null;
  roles.filter(Boolean).forEach((role) => {
    if (existing.has(role)) return;
    els.roles.insertBefore(new Option(role, role), otherOption);
    existing.add(role);
  });
}

function getPageFromHash() {
  const page = window.location.hash.replace(/^#\/?/, "");
  return PAGE_CONFIG[page] ? page : "all";
}

function syncPageFromHash() {
  const nextPage = getPageFromHash();
  if (nextPage === activePage) {
    updatePageControls();
    return;
  }
  activePage = nextPage;
  closeFilterAccordions();
  updateFilterControls();
  renderJobs();
}

function setActivePage(page) {
  const nextPage = PAGE_CONFIG[page] ? page : "all";
  if (nextPage === activePage) return;
  activePage = nextPage;
  const hash = nextPage === "all" ? "" : `#${nextPage}`;
  if (window.location.hash !== hash) {
    window.location.hash = hash;
  }
  closeFilterAccordions();
  updateFilterControls();
  renderJobs();
}

function updatePageControls() {
  const config = PAGE_CONFIG[activePage] || PAGE_CONFIG.all;
  const showScopedTypeFilter = usesScopedTypeFilter(activePage);
  const showAppliedStatusFilter = activePage === "applied";
  const showPriorityFilter = usesPriorityFilter(activePage);
  els.boardTitle.textContent = config.title;
  const isCompanyPage = activePage === "companies";
  els.boardControls.hidden = activePage === "viz" || isCompanyPage;
  els.newRecordButton.textContent = isCompanyPage ? "Add Company" : "Add Job";
  els.pageTypeFilterWrap.hidden = !showScopedTypeFilter;
  if (!showScopedTypeFilter) {
    els.pageTypeFilterButton.setAttribute("aria-expanded", "false");
    document.querySelector("#page-type-filter-panel").hidden = true;
  }
  els.appliedStatusFilterWrap.hidden = !showAppliedStatusFilter;
  if (!showAppliedStatusFilter) {
    els.appliedStatusFilterButton.setAttribute("aria-expanded", "false");
    document.querySelector("#applied-status-filter-panel").hidden = true;
  }
  els.priorityFilterWrap.hidden = !showPriorityFilter;
  if (!showPriorityFilter) {
    els.priorityFilterButton.setAttribute("aria-expanded", "false");
    document.querySelector("#priority-filter-panel").hidden = true;
  }
  els.pageButtons.forEach((button) => {
    const isActive = button.dataset.page === activePage;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-current", isActive ? "page" : "false");
  });
}

function usesScopedTypeFilter(page = activePage) {
  return ["favorites", "applied", "reference"].includes(page);
}

function usesPriorityFilter(page = activePage) {
  return !["applied", "reference", "companies", "viz"].includes(page);
}

function setFolderGate(
  isVisible,
  statusMessage = "Folder connection is required to continue.",
) {
  els.folderGate.hidden = !isVisible;
  els.trackerApp.inert = isVisible;
  els.saveButton.disabled = isVisible;
  if (isVisible) {
    els.folderGateStatus.textContent = statusMessage;
    els.folderGateButton.disabled = !("showDirectoryPicker" in window);
    els.folderGateButton.focus();
  }
}

function openNewJobForm() {
  if (activePage === "companies") {
    openCompanyEditor();
    return;
  }
  resetForm();
  openFormDialog();
}

async function openEditJobForm(jobId) {
  await loadJobIntoForm(jobId);
  openFormDialog();
}

function openFormDialog() {
  lastFocusedElement =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
  els.formBackdrop.hidden = false;
  els.formDialog.hidden = false;
  document.body.classList.add("modal-open");
  els.formDialog.scrollTo({ top: 0 });
  window.setTimeout(() => {
    (els.jobLink || els.formDialog).focus();
  }, 0);
}

function closeFormDialog() {
  if (els.formDialog.hidden) return;
  els.formDialog.hidden = true;
  if (els.companyFormDialog.hidden) {
    els.formBackdrop.hidden = true;
    document.body.classList.remove("modal-open");
  }
  if (lastFocusedElement && document.contains(lastFocusedElement)) {
    lastFocusedElement.focus();
  }
}

function handleDocumentKeydown(event) {
  if (!els.companyFormDialog.hidden) {
    if (event.key === "Escape") {
      closeCompanyFormDialog();
      return;
    }
    if (event.key === "Tab") trapDialogFocus(event, els.companyFormDialog);
    return;
  }
  if (els.formDialog.hidden) return;
  if (event.key === "Escape") {
    closeFormDialog();
    return;
  }
  if (event.key === "Tab") trapFormDialogFocus(event);
}

function trapFormDialogFocus(event) {
  trapDialogFocus(event, els.formDialog);
}

function trapDialogFocus(event, dialog) {
  const focusable = [
    ...dialog.querySelectorAll(
      "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])",
    ),
  ].filter((element) => element.offsetParent !== null);
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function updateCompanyOptions() {
  els.companyOptions.replaceChildren(
    ...companies.map((company) => {
      const option = document.createElement("option");
      option.value = company.name;
      return option;
    }),
  );
}

function normalizeCompanyName(value) {
  return normalizeWhitespace(String(value || "")).toLocaleLowerCase();
}

function findCompanyByName(name) {
  const key = normalizeCompanyName(name);
  return key
    ? companies.find((company) => normalizeCompanyName(company.name) === key)
    : null;
}

function getCompanyById(id) {
  return id ? companies.find((company) => company.id === id) || null : null;
}

function syncJobCompanySelection() {
  const selected = findCompanyByName(els.company.value);
  els.companyId.value = selected?.id || "";
}

async function ensureCompanyForJob(name, preferredId = "") {
  const normalizedName = normalizeWhitespace(String(name || ""));
  if (!normalizedName) return null;

  const preferred = getCompanyById(preferredId);
  if (
    preferred &&
    normalizeCompanyName(preferred.name) ===
      normalizeCompanyName(normalizedName)
  ) {
    return preferred;
  }

  const existing = findCompanyByName(normalizedName);
  if (existing) return existing;

  const now = new Date().toISOString();
  const company = normalizeCompanyRecord({
    id: createId(),
    createdAt: now,
    updatedAt: now,
    name: normalizedName,
  });
  await putCompany(company);
  companies.push(company);
  companies.sort(compareCompanies);
  updateCompanyOptions();
  els.companyId.value = company.id;
  return company;
}

function openCompanyEditorFromJob() {
  syncJobCompanySelection();
  companyEditorOpenedFromJob = true;
  openCompanyEditor(els.companyId.value, els.company.value.trim());
}

function openCompanyEditor(companyId = "", initialName = "") {
  companyEditorOpenedFromJob =
    companyEditorOpenedFromJob && !els.formDialog.hidden;
  const company = getCompanyById(companyId) || findCompanyByName(initialName);
  loadCompanyIntoForm(company, company ? "" : initialName);
  lastCompanyFocusedElement =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
  els.formBackdrop.hidden = false;
  els.companyFormDialog.hidden = false;
  document.body.classList.add("modal-open");
  els.companyFormDialog.scrollTo({ top: 0 });
  window.setTimeout(() => els.companyName.focus(), 0);
}

function loadCompanyIntoForm(company, initialName = "") {
  editingCompanyId = company?.id || "";
  isResettingCompanyForm = true;
  els.companyForm.reset();
  isResettingCompanyForm = false;
  els.companyRecordId.value = editingCompanyId;
  els.companyName.value = company?.name || initialName;
  els.companyName.setCustomValidity("");

  const industry = industryForForm(
    { industry: company?.industry || "" },
    [...els.companyIndustry.options].map((option) => option.value),
  );
  els.companyIndustry.value = industry.value;
  els.companyIndustryOther.value = industry.other;
  populateSectorOptions();

  const sector = company?.sector || "";
  const knownSectors = [...els.companySector.options].map(
    (option) => option.value,
  );
  if (!sector) {
    els.companySector.value = "";
    els.companySectorOther.value = "";
  } else if (knownSectors.includes(sector)) {
    els.companySector.value = sector;
    els.companySectorOther.value = "";
  } else {
    els.companySector.value = "Other";
    els.companySectorOther.value = sector;
  }

  setMultiSelectValues(els.companyMission, company?.mission || []);
  els.companyWebsite.value = company?.website || "";
  setRadioValue("companyRank", company?.rank || "");
  syncCompanyConditionalFields();
}

function resetCompanyForm() {
  loadCompanyIntoForm(
    null,
    companyEditorOpenedFromJob ? els.company.value.trim() : "",
  );
}

function closeCompanyFormDialog() {
  if (els.companyFormDialog.hidden) return;
  els.companyFormDialog.hidden = true;
  if (els.formDialog.hidden) {
    els.formBackdrop.hidden = true;
    document.body.classList.remove("modal-open");
  }
  const focusTarget = companyEditorOpenedFromJob
    ? els.editCompanyInfoButton
    : lastCompanyFocusedElement;
  companyEditorOpenedFromJob = false;
  if (focusTarget && document.contains(focusTarget)) focusTarget.focus();
}

function getCompanyIndustryFormValue() {
  return els.companyIndustry.value === "Other"
    ? els.companyIndustryOther.value.trim()
    : els.companyIndustry.value;
}

function getCompanySectorFormValue() {
  return els.companySector.value === "Other"
    ? els.companySectorOther.value.trim()
    : els.companySector.value;
}

function syncCompanyConditionalFields() {
  els.companyIndustryOtherWrap.hidden = els.companyIndustry.value !== "Other";
  if (els.companyIndustryOtherWrap.hidden) els.companyIndustryOther.value = "";
  els.companySectorOtherWrap.hidden = els.companySector.value !== "Other";
  if (els.companySectorOtherWrap.hidden) els.companySectorOther.value = "";
}

async function handleCompanySubmit(event) {
  event.preventDefault();
  const name = normalizeWhitespace(els.companyName.value);
  if (!name) {
    els.companyName.setCustomValidity("Enter a company name.");
    els.companyName.reportValidity();
    return;
  }
  const duplicate = findCompanyByName(name);
  if (duplicate && duplicate.id !== editingCompanyId) {
    els.companyName.setCustomValidity(
      "A company with this name already exists.",
    );
    els.companyName.reportValidity();
    return;
  }
  els.companyName.setCustomValidity("");

  const now = new Date().toISOString();
  const existing = getCompanyById(editingCompanyId);
  const company = normalizeCompanyRecord({
    id: existing?.id || createId(),
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    name,
    industry: getCompanyIndustryFormValue(),
    sector: getCompanySectorFormValue(),
    mission: getSelectedValues(els.companyMission),
    website: els.companyWebsite.value.trim(),
    rank: getRadioValue("companyRank"),
  });

  await putCompany(company);
  if (companyEditorOpenedFromJob) {
    els.company.value = company.name;
    els.companyId.value = company.id;
  }
  await refreshJobs();
  const syncStatus = await safeSyncToConnectedFolder();
  closeCompanyFormDialog();
  showToast(
    syncStatus === "failed"
      ? "Company saved locally. Folder export failed."
      : "Company saved.",
  );
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const nextDb = request.result;
      if (!nextDb.objectStoreNames.contains(JOB_STORE)) {
        nextDb.createObjectStore(JOB_STORE, { keyPath: "id" });
      }
      if (!nextDb.objectStoreNames.contains(COMPANY_STORE)) {
        nextDb.createObjectStore(COMPANY_STORE, { keyPath: "id" });
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

async function getAllCompanies() {
  return idbRequest(getStore(COMPANY_STORE).getAll());
}

async function putJob(job) {
  return idbRequest(getStore(JOB_STORE, "readwrite").put(job));
}

async function putCompany(company) {
  return idbRequest(getStore(COMPANY_STORE, "readwrite").put(company));
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

function transactionDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function refreshJobs() {
  let storedJobs = await getAllJobs();
  const legacyJobs = storedJobs.filter((job) => !job.companyId && job.company);
  if (legacyJobs.length) {
    await migrateLegacyCompanies(legacyJobs);
    await Promise.all(
      legacyJobs.map((job) => putJob(stripLegacyCompanyFields(job))),
    );
    storedJobs = await getAllJobs();
  }
  companies = (await getAllCompanies()).sort(compareCompanies);
  jobs = joinJobsWithCompanies(storedJobs, companies).sort((a, b) =>
    (b.updatedAt || "").localeCompare(a.updatedAt || ""),
  );
  updateCompanyOptions();
  updateRoleFilterOptions(jobs);
  updateIndustryFilterOptions(jobs);
  renderJobs();
}

function collectFormData(companyId = "") {
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
  const deadlineChoice = els.deadlineChoice.value;
  const appliedStatus = getRadioValue("appliedStatus");
  const priority =
    appliedStatus === "No" ? "Future" : getRadioValue("priority");
  const responseStatus = getAppliedLifecycleChoice(
    "responseStatus",
    appliedStatus,
  );
  const responseDate = responseStatus === "Yes" ? els.responseDate.value : "";
  const screenStatus = getAppliedLifecycleChoice("screenStatus", appliedStatus);
  const screenDate = screenStatus === "Yes" ? els.screenDate.value : "";
  const interviewStatus = getAppliedLifecycleChoice(
    "interviewStatus",
    appliedStatus,
  );
  const interviewDate =
    interviewStatus === "Yes" ? els.interviewDate.value : "";
  const assessmentStatus = getAppliedLifecycleChoice(
    "assessmentStatus",
    appliedStatus,
  );
  const assessmentDate =
    assessmentStatus === "Yes" ? els.assessmentDate.value : "";
  const finalStatus =
    appliedStatus === "Yes" ? getRadioValue("finalStatus") : "";
  const finalStatusDate = isDatedFinalStatus(finalStatus)
    ? els.finalStatusDate.value
    : "";
  const jobLevel = getRadioValue("jobLevel");
  const jobTypes = getSelectedJobTypes(jobLevel);
  const descriptionText = els.jobDescription.value.trim();

  return {
    job: {
      id,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      link: els.jobLink.value.trim(),
      companyId,
      title: els.jobTitle.value.trim(),
      locationChoice,
      locationOther,
      location,
      payType: getRadioValue("payType"),
      payMin,
      payMax,
      payMidpoint,
      priority,
      datePosted: els.datePosted.value,
      deadlineChoice,
      deadline: deadlineChoice === "Select Date" ? els.deadline.value : "",
      appliedStatus,
      appliedDate: appliedStatus === "Yes" ? els.appliedDate.value : "",
      applicationStatus: getApplicationStatus(appliedStatus, finalStatus),
      lastHeardFrom: getLastHeardFrom([
        responseDate,
        screenDate,
        interviewDate,
        assessmentDate,
        finalStatusDate,
      ]),
      responseStatus,
      responseDate,
      screenStatus,
      screenDate,
      interviewStatus,
      interviewDate,
      assessmentStatus,
      assessmentDate,
      finalStatus,
      finalStatusDate,
      applicationNeeds: getCheckedValues(els.applicationNeeds),
      referenceCount: els.needsReferences.checked
        ? normalizeIntegerString(els.referenceCount.value)
        : "",
      jobLevel,
      favoriteJob: els.favoriteJob.checked,
      jobTypes,
      roles: allRoles,
      roleOther,
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
  const company = await ensureCompanyForJob(
    els.company.value,
    els.companyId.value,
  );
  const { job, descriptionText } = collectFormData(company?.id || "");

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
  closeFormDialog();
  const syncStatus = await safeSyncToConnectedFolder();
  showToast(
    syncStatus === "failed"
      ? "Job saved locally. Folder export failed."
      : "Job saved.",
  );
}

async function handleDelete() {
  if (!editingId) return;
  const job = jobs.find((item) => item.id === editingId);
  const label = job?.title || job?.company || "this job";
  if (!window.confirm(`Delete ${label}?`)) return;

  await deleteJobRecord(editingId);
  resetForm();
  await refreshJobs();
  closeFormDialog();
  const syncStatus = await safeSyncToConnectedFolder();
  showToast(
    syncStatus === "failed"
      ? "Job deleted locally. Folder export failed."
      : "Job deleted.",
  );
}

function resetForm() {
  editingId = "";
  isResettingForm = true;
  els.form.reset();
  isResettingForm = false;
  els.recordId.value = "";
  els.companyId.value = "";
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
  els.companyId.value = job.companyId || "";
  els.jobTitle.value = job.title || "";
  setRadioValue("locationChoice", job.locationChoice || "");
  els.locationOther.value = job.locationOther || "";
  setRadioValue("payType", job.payType || "");
  els.payMin.value = job.payMin || "";
  els.payMax.value = job.payMax || "";
  setRadioValue("priority", job.priority || "");
  els.datePosted.value = job.datePosted || "";
  els.deadlineChoice.value = getDeadlineChoice(job);
  els.deadline.value = job.deadline || "";
  setRadioValue("appliedStatus", getAppliedStatus(job));
  els.appliedDate.value = job.appliedDate || "";
  setRadioValue(
    "responseStatus",
    getLifecycleStatusForForm(
      job.responseStatus,
      job.responseDate,
      getAppliedStatus(job),
    ),
  );
  els.responseDate.value = job.responseDate || "";
  setRadioValue(
    "screenStatus",
    getLifecycleStatusForForm(
      job.screenStatus,
      job.screenDate,
      getAppliedStatus(job),
    ),
  );
  els.screenDate.value = job.screenDate || "";
  setRadioValue(
    "interviewStatus",
    getLifecycleStatusForForm(
      job.interviewStatus,
      job.interviewDate,
      getAppliedStatus(job),
    ),
  );
  els.interviewDate.value = job.interviewDate || "";
  setRadioValue(
    "assessmentStatus",
    getLifecycleStatusForForm(
      job.assessmentStatus,
      job.assessmentDate,
      getAppliedStatus(job),
    ),
  );
  els.assessmentDate.value = job.assessmentDate || "";
  setRadioValue("finalStatus", getFinalStatusForForm(job));
  els.finalStatusDate.value = job.finalStatusDate || "";
  setCheckedValues(els.applicationNeeds, job.applicationNeeds || []);
  els.referenceCount.value = job.referenceCount || "";
  setRadioValue("jobLevel", getJobLevelForForm(job));
  els.favoriteJob.checked = Boolean(job.favoriteJob);
  const formRoles = normalizeRolesForForm(job.roles || [], job.roleOther);
  ensureRoleOptions(formRoles.filter((role) => role !== "Other"));
  setMultiSelectValues(els.roles, formRoles);
  els.roleOther.value = job.roleOther || "";
  els.jobDescription.value = await getDescription(job.id);
  els.scrapeStatus.textContent = "";

  setEditMode(job);
  syncConditionalFields();
  updatePayMidpoint();
  els.formDialog.scrollTo({ top: 0 });
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

  const deadlineChoice = els.deadlineChoice.value;
  els.deadline.hidden = deadlineChoice !== "Select Date";
  if (deadlineChoice !== "Select Date") els.deadline.value = "";

  const appliedStatus = getRadioValue("appliedStatus");
  const isApplied = appliedStatus === "Yes";
  els.appliedTrackingPanel.hidden = !isApplied;
  if (isApplied) {
    ensureDefaultRadioValue("responseStatus", "No");
    ensureDefaultRadioValue("screenStatus", "No");
    ensureDefaultRadioValue("interviewStatus", "No");
    ensureDefaultRadioValue("assessmentStatus", "No");
  } else {
    clearApplicationTrackingFields();
  }
  syncLifecycleDateField("responseStatus", els.responseDate);
  syncLifecycleDateField("screenStatus", els.screenDate);
  syncLifecycleDateField("interviewStatus", els.interviewDate);
  syncLifecycleDateField("assessmentStatus", els.assessmentDate);
  els.finalStatusDate.hidden = !isDatedFinalStatus(
    getRadioValue("finalStatus"),
  );
  if (els.finalStatusDate.hidden) els.finalStatusDate.value = "";

  els.referenceCountWrap.hidden = !els.needsReferences.checked;
  if (els.referenceCountWrap.hidden) els.referenceCount.value = "";
}

function handlePriorityChange(event) {
  const changedInput = event.currentTarget;
  if (changedInput.value === "Future" && changedInput.checked) {
    setRadioValue("appliedStatus", "No");
  } else if (changedInput.checked && getRadioValue("appliedStatus") === "No") {
    setRadioValue("appliedStatus", "");
  } else if (
    changedInput.value === "Future" &&
    !changedInput.checked &&
    getRadioValue("appliedStatus") === "No"
  ) {
    setRadioValue("appliedStatus", "");
  }
  syncConditionalFields();
}

function handleAppliedStatusChange(event) {
  const changedInput = event.currentTarget;
  const appliedStatus = getRadioValue("appliedStatus");
  if (appliedStatus === "No") {
    setRadioValue("priority", "Future");
  } else if (
    appliedStatus === "Yes" &&
    getRadioValue("priority") === "Future"
  ) {
    setRadioValue("priority", "");
  } else if (
    changedInput.value === "No" &&
    !changedInput.checked &&
    getRadioValue("priority") === "Future"
  ) {
    setRadioValue("priority", "");
  }
  syncConditionalFields();
}

function syncLifecycleDateField(statusName, dateInput) {
  dateInput.hidden = getRadioValue(statusName) !== "Yes";
  if (dateInput.hidden) dateInput.value = "";
}

function clearApplicationTrackingFields() {
  els.appliedDate.value = "";
  clearRadioValue("responseStatus");
  els.responseDate.value = "";
  clearRadioValue("screenStatus");
  els.screenDate.value = "";
  clearRadioValue("interviewStatus");
  els.interviewDate.value = "";
  clearRadioValue("assessmentStatus");
  els.assessmentDate.value = "";
  clearRadioValue("finalStatus");
  els.finalStatusDate.value = "";
}

function handleDeadlineChoiceChange() {
  syncConditionalFields();
  if (els.deadlineChoice.value !== "Select Date") return;
  els.deadline.focus();
  if (typeof els.deadline.showPicker === "function") {
    try {
      els.deadline.showPicker();
    } catch (error) {
      // Some browsers focus the field but block programmatic picker opening.
    }
  }
}

function updatePayMidpoint() {
  const midpoint = calculateMidpoint(
    normalizeNumberString(els.payMin.value),
    normalizeNumberString(els.payMax.value),
  );
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
  updatePageControls();
  els.jobList.classList.toggle("viz-board", activePage === "viz");
  els.jobList.classList.toggle("companies-board", activePage === "companies");
  if (activePage === "viz") {
    renderViz();
    return;
  }
  if (activePage === "companies") {
    renderCompanies();
    return;
  }
  const visibleJobs = getVisibleJobs();
  els.recordCount.textContent = `${visibleJobs.length} ${visibleJobs.length === 1 ? "job" : "jobs"}`;
  els.jobList.replaceChildren();

  if (!visibleJobs.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = getEmptyMessage();
    els.jobList.append(empty);
    return;
  }

  visibleJobs.forEach((job) => {
    els.jobList.append(createJobCard(job));
  });
}

function renderCompanies() {
  els.recordCount.textContent = `${companies.length} ${companies.length === 1 ? "company" : "companies"}`;
  els.jobList.replaceChildren();
  if (!companies.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = PAGE_CONFIG.companies.empty;
    els.jobList.append(empty);
    return;
  }
  companies.forEach((company) =>
    els.jobList.append(createCompanyCard(company)),
  );
}

function getVisibleJobs() {
  let visible = getPageJobs();
  if (usesScopedTypeFilter() && filters.type !== "All") {
    visible = visible.filter((job) => matchesJobType(job, filters.type));
  }
  if (activePage === "applied" && filters.applicationStatus !== "All") {
    visible = visible.filter(
      (job) => getApplicationStatusDisplay(job) === filters.applicationStatus,
    );
  }
  if (usesPriorityFilter() && filters.priorities.length) {
    visible = visible.filter((job) =>
      filters.priorities.includes(job.priority || ""),
    );
  }
  if (filters.roles.length) {
    visible = visible.filter((job) =>
      filters.roles.some((role) => (job.roles || []).includes(role)),
    );
  }
  if (filters.industries.length) {
    visible = visible.filter((job) =>
      filters.industries.includes(getIndustryDisplay(job)),
    );
  }
  const sortBy = filters.sortBy || "deadline";
  if (sortBy === "deadline") {
    visible.sort((a, b) => deadlineRank(a) - deadlineRank(b));
  } else if (sortBy === "priority") {
    visible.sort(comparePriorityJobs);
  }
  return visible;
}

function getPageJobs(page = activePage) {
  if (page === "reference") return jobs.filter(isReferenceJob);
  if (page === "applied")
    return jobs.filter((job) => isAppliedJob(job) && !isReferenceJob(job));
  const pendingJobs = jobs.filter(
    (job) => !isAppliedJob(job) && !isReferenceJob(job),
  );
  if (page === "full-time")
    return pendingJobs.filter((job) => matchesJobType(job, "Full-time"));
  if (page === "internship")
    return pendingJobs.filter((job) => matchesJobType(job, "Internship"));
  if (page === "part-time")
    return pendingJobs.filter((job) => matchesJobType(job, "Part-time"));
  if (page === "favorites") return pendingJobs.filter(isFavoriteJob);
  return pendingJobs;
}

function getEmptyMessage() {
  if (!jobs.length) return "No saved jobs yet.";
  const config = PAGE_CONFIG[activePage] || PAGE_CONFIG.all;
  return (usesScopedTypeFilter() && filters.type !== "All") ||
    (activePage === "applied" && filters.applicationStatus !== "All") ||
    (usesPriorityFilter() && filters.priorities.length) ||
    filters.roles.length ||
    filters.industries.length
    ? "No jobs match the current filters."
    : config.empty;
}

function deadlineRank(job) {
  const deadlineChoice = getDeadlineChoice(job);
  if (deadlineChoice === "Select Date" && job.deadline) {
    const timestamp = new Date(`${job.deadline}T00:00:00`).getTime();
    if (Number.isFinite(timestamp)) return timestamp;
  }
  if (deadlineChoice === "ASAP") return Number.MAX_SAFE_INTEGER - 1;
  return Number.MAX_SAFE_INTEGER;
}

function priorityRank(job) {
  const ranks = {
    Urgent: 0,
    High: 1,
    Medium: 2,
    Low: 3,
    Upcoming: 4,
    Future: 5,
  };
  return ranks[job.priority] ?? 5;
}

function comparePriorityJobs(a, b) {
  const priorityDifference = priorityRank(a) - priorityRank(b);
  if (priorityDifference) return priorityDifference;
  return deadlineRank(a) - deadlineRank(b);
}

function updateFilterControls() {
  updatePageControls();
  els.pageTypeButtons.forEach((button) => {
    const isSelected = button.dataset.pageTypeFilter === filters.type;
    button.classList.toggle("active", isSelected);
  });
  els.pageTypeFilterButton.classList.toggle(
    "active",
    usesScopedTypeFilter() && filters.type !== "All",
  );
  els.pageTypeFilterButton.textContent = `Type: ${filters.type}`;

  els.appliedStatusButtons.forEach((button) => {
    const isSelected =
      button.dataset.appliedStatusFilter === filters.applicationStatus;
    button.classList.toggle("active", isSelected);
  });
  els.appliedStatusFilterButton.classList.toggle(
    "active",
    activePage === "applied" && filters.applicationStatus !== "All",
  );
  els.appliedStatusFilterButton.textContent = `Status: ${filters.applicationStatus}`;

  els.priorityButtons.forEach((button) => {
    button.classList.toggle(
      "active",
      filters.priorities.includes(button.dataset.priorityFilter),
    );
  });
  els.sortButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.sort === filters.sortBy);
  });

  els.priorityFilterButton.classList.toggle(
    "active",
    Boolean(filters.priorities.length),
  );
  els.priorityFilterButton.textContent = getFilterButtonLabel(
    "Priority",
    filters.priorities,
  );

  const sortLabels = {
    deadline: "Deadline",
    priority: "Priority",
    updated: "Last updated",
  };
  els.sortFilterButton.classList.toggle("active", Boolean(filters.sortBy));
  els.sortFilterButton.textContent = filters.sortBy
    ? `Sort by: ${sortLabels[filters.sortBy]}`
    : "Sort by";

  els.roleFilterButton.classList.toggle(
    "active",
    Boolean(filters.roles.length),
  );
  els.roleFilterButton.textContent = getFilterButtonLabel(
    "Role",
    filters.roles,
  );
  syncFilterOptionButtons(els.roleFilter, filters.roles, "roleFilter");

  els.industryFilterButton.classList.toggle(
    "active",
    Boolean(filters.industries.length),
  );
  els.industryFilterButton.textContent = getFilterButtonLabel(
    "Industry",
    filters.industries,
  );
  syncFilterOptionButtons(
    els.industryFilter,
    filters.industries,
    "industryFilter",
  );
}

function getFilterButtonLabel(label, values, emptyLabel = label) {
  if (!values.length) return emptyLabel;
  if (values.length === 1) return `${label}: ${values[0]}`;
  return `${label}: ${values.length}`;
}

function closeFilterAccordions(exceptButton = null) {
  els.accordionTriggers.forEach((button) => {
    if (button === exceptButton) return;
    const panel = document.querySelector(
      `#${button.getAttribute("aria-controls")}`,
    );
    button.setAttribute("aria-expanded", "false");
    if (panel) panel.hidden = true;
  });
}

function updateOptionSelection(values, value, event) {
  if (!value || value === "All") return [];
  const selected = values.includes(value);
  if (event.ctrlKey || event.metaKey) {
    return selected
      ? values.filter((item) => item !== value)
      : [...values, value];
  }
  return selected ? [] : [value];
}

function matchesJobType(job, type) {
  if (type === "Internship") return hasJobType(job, "Internship");
  if (type === "Part-time") return hasJobType(job, "Part-time");
  if (type === "Full-time") return hasJobType(job, "Full-time");
  return true;
}

function getSelectedJobTypes(jobLevel) {
  const normalizedLevel = normalizeJobLevel(jobLevel);
  if (normalizedLevel === "PT") return ["Part-time"];
  if (normalizedLevel === "Intern") return ["Internship"];
  return ["Full-time"];
}

function getJobTypes(job) {
  if (Array.isArray(job.jobTypes) && job.jobTypes.length)
    return normalizeJobTypes(job.jobTypes);
  if (typeof job.jobTypes === "string" && job.jobTypes.trim())
    return normalizeJobTypes(splitList(job.jobTypes));

  const legacyTypes = [];
  const normalizedLevel = normalizeJobLevel(job.jobLevel);
  if (normalizedLevel === "PT") legacyTypes.push("Part-time");
  if (normalizedLevel === "Intern") legacyTypes.push("Internship");
  if (job.fullTime === true) legacyTypes.push("Full-time");
  if (job.internship) legacyTypes.push("Internship");
  if (job.partTime) legacyTypes.push("Part-time");
  if (legacyTypes.length) return unique(legacyTypes);
  if (job.fullTime === false) return [];
  return ["Full-time"];
}

function normalizeJobTypes(values) {
  const labels = {
    fulltime: "Full-time",
    "full-time": "Full-time",
    internship: "Internship",
    intern: "Internship",
    pt: "Part-time",
    parttime: "Part-time",
    "part-time": "Part-time",
  };
  return unique(
    values
      .map((value) => labels[String(value).trim().toLowerCase()] || "")
      .filter(Boolean),
  );
}

function hasJobType(job, type) {
  return getJobTypes(job).includes(type);
}

function normalizeJobLevel(value) {
  const levels = {
    pt: "PT",
    "part-time": "PT",
    parttime: "PT",
    intern: "Intern",
    internship: "Intern",
    jr: "Jr",
    junior: "Jr",
    mid: "Mid",
    sr: "Sr",
    senior: "Sr",
  };
  return (
    levels[
      String(value || "")
        .trim()
        .toLowerCase()
    ] || ""
  );
}

function getJobLevelForForm(job) {
  const normalizedLevel = normalizeJobLevel(job.jobLevel);
  if (normalizedLevel) return normalizedLevel;
  if (hasJobType(job, "Part-time")) return "PT";
  if (hasJobType(job, "Internship")) return "Intern";
  return "";
}

function syncFilterOptionButtons(container, selectedValues, dataKey) {
  const selected = new Set(selectedValues);
  container
    .querySelectorAll(`[data-${toKebabCase(dataKey)}]`)
    .forEach((button) => {
      const isSelected = selected.has(button.dataset[dataKey]);
      button.classList.toggle("active", isSelected);
      button.setAttribute("aria-selected", String(isSelected));
    });
}

function toKebabCase(value) {
  return value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

function normalizeCompanyRecord(record) {
  const rank = ["Favorite", "Target", "Normal", "Agency"].includes(record.rank)
    ? record.rank
    : "";
  return {
    id: record.id || createId(),
    createdAt: record.createdAt || new Date().toISOString(),
    updatedAt: record.updatedAt || record.createdAt || new Date().toISOString(),
    name: normalizeWhitespace(String(record.name || "")),
    industry: getIndustryDisplay({ industry: record.industry || "" }),
    sector: normalizeWhitespace(String(record.sector || "")),
    mission: Array.isArray(record.mission)
      ? unique(record.mission)
      : splitList(record.mission),
    website: String(record.website || "").trim(),
    rank,
  };
}

function compareCompanies(a, b) {
  const ranks = { Favorite: 0, Target: 1, Normal: 2, Agency: 3, "": 4 };
  const rankDifference = (ranks[a.rank] ?? 4) - (ranks[b.rank] ?? 4);
  return (
    rankDifference ||
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  );
}

function joinJobsWithCompanies(records, companyRecords) {
  const byId = new Map(companyRecords.map((company) => [company.id, company]));
  return records.map((job) => {
    const company = byId.get(job.companyId);
    if (!company) return { ...job };
    return {
      ...job,
      company: company.name,
      favoriteCompany: company.rank === "Favorite",
      industry: company.industry,
      industryOther: "",
      mission: company.mission,
      companySector: company.sector,
      companyWebsite: company.website,
      companyRank: company.rank,
    };
  });
}

function createCompanyCard(company) {
  const card = document.createElement("article");
  card.className = `company-card${company.rank ? ` rank-${company.rank.toLowerCase()}` : ""}`;
  const companyJobs = jobs.filter((job) => job.companyId === company.id);
  card.append(
    createCompanyLogo({
      company: company.name,
      favoriteCompany: company.rank === "Favorite",
    }),
  );

  const main = document.createElement("div");
  main.className = "company-card-main";
  const name = document.createElement("p");
  name.className = "job-title";
  name.textContent = company.name;
  const count = document.createElement("span");
  count.className = "company-job-count";
  count.textContent = `${companyJobs.length} ${companyJobs.length === 1 ? "job" : "jobs"}`;
  main.append(name, count);

  const mission = cell((company.mission || []).join(" · "), "company-mission");
  const rank = document.createElement("div");
  rank.className = "chips company-rank";
  if (company.rank) {
    rank.append(chip(company.rank, `company-${company.rank.toLowerCase()}`));
  }

  const website = document.createElement("div");
  website.className = "company-website";
  if (company.website) {
    const link = document.createElement("a");
    link.className = "link-button";
    link.href = company.website;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "Website";
    website.append(link);
  }

  const edit = document.createElement("button");
  edit.type = "button";
  edit.className = "edit-row-button";
  edit.textContent = "Edit";
  edit.setAttribute("aria-label", `Edit ${company.name}`);
  edit.addEventListener("click", () => {
    companyEditorOpenedFromJob = false;
    openCompanyEditor(company.id);
  });

  const jobsDetails = document.createElement("details");
  jobsDetails.className = "company-jobs";
  const jobsSummary = document.createElement("summary");
  jobsSummary.textContent = companyJobs.length
    ? `Show ${companyJobs.length === 1 ? "job" : "jobs"}`
    : "No linked jobs";
  jobsDetails.append(jobsSummary);
  if (companyJobs.length) {
    const jobsList = document.createElement("div");
    jobsList.className = "company-job-list";
    companyJobs.forEach((job) => {
      const row = document.createElement("div");
      row.className = "company-job-row";
      const jobMain = document.createElement("div");
      jobMain.className = "company-job-main";
      const jobTitle = document.createElement("button");
      jobTitle.type = "button";
      jobTitle.className = "company-job-title";
      jobTitle.textContent = job.title || "Untitled job";
      jobTitle.addEventListener("click", () => openEditJobForm(job.id));
      const jobMeta = document.createElement("span");
      jobMeta.className = "company-job-meta";
      const meta = [
        job.location,
        getApplicationStatusDisplay(job) || job.priority,
        job.deadline && formatDate(job.deadline),
      ].filter(Boolean);
      jobMeta.textContent = meta.join(" · ");
      jobMain.append(jobTitle, jobMeta);
      const jobEdit = document.createElement("button");
      jobEdit.type = "button";
      jobEdit.className = "edit-row-button company-job-edit";
      jobEdit.textContent = "Edit job";
      jobEdit.addEventListener("click", () => openEditJobForm(job.id));
      row.append(jobMain, jobEdit);
      jobsList.append(row);
    });
    jobsDetails.append(jobsList);
  }

  card.append(
    main,
    cell(company.industry, "company-industry"),
    cell(company.sector, "company-sector"),
    mission,
    rank,
    website,
    edit,
    jobsDetails,
  );
  return card;
}

function createJobCard(job) {
  const card = document.createElement("article");
  card.className = `${getJobCardClassName(job)}${activePage === "applied" ? " applied-card" : ""}`;

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
  const pay =
    activePage === "applied"
      ? labelledDateCell("Date applied", job.appliedDate)
      : createPayCell(job);
  const deadline =
    activePage === "applied"
      ? labelledDateCell("Last responded", getLastRespondedDate(job), true)
      : createDeadlineCell(job);

  const industry = cell(getIndustryDisplay(job), "job-industry");

  const roleChips = document.createElement("div");
  roleChips.className = "chips";
  (job.roles || []).forEach((role) => {
    roleChips.append(roleChip(role));
  });

  const levelChips = document.createElement("div");
  levelChips.className = "chips level-chips";
  if (activePage === "applied") {
    levelChips.append(applicationStageChip(job));
  } else {
    const jobLevel = normalizeJobLevel(job.jobLevel);
    if (jobLevel)
      levelChips.append(chip(jobLevel, `level-${jobLevel.toLowerCase()}`));
  }

  const priorityChips = document.createElement("div");
  priorityChips.className = "chips priority-chips";
  priorityChips.append(
    activePage === "applied" ? applicationStatusChip(job) : statusChip(job),
  );

  const actions = document.createElement("div");
  actions.className = "job-actions";
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
  const edit = document.createElement("button");
  edit.type = "button";
  edit.className = "edit-row-button";
  edit.textContent = "Edit";
  edit.setAttribute("aria-label", `Edit ${job.title || job.company || "job"}`);
  edit.addEventListener("click", () => openEditJobForm(job.id));
  actions.append(link, edit);

  card.append(
    logo,
    main,
    location,
    pay,
    deadline,
    industry,
    roleChips,
    levelChips,
    priorityChips,
    actions,
  );
  return card;
}

function createPayCell(job) {
  const pay = cell("", "job-pay");
  const payInfo = getPayDisplay(job);
  pay.textContent = payInfo.main;
  if (payInfo.detail) {
    const detail = document.createElement("small");
    detail.textContent = payInfo.detail;
    pay.append(detail);
  }
  return pay;
}

function createDeadlineCell(job) {
  const deadline = cell("");
  if (job.deadline) {
    deadline.textContent = formatDate(job.deadline);
  } else if (getDeadlineChoice(job) === "ASAP") {
    const asap = document.createElement("span");
    asap.className = "asap";
    asap.textContent = "ASAP";
    deadline.append(asap);
  }
  return deadline;
}

function labelledDateCell(label, date, showMissing = false) {
  const wrapper = cell("", "job-date");
  const value = document.createElement("span");
  if (date) {
    value.textContent = formatDate(date);
  } else {
    value.textContent = showMissing ? "N/A" : "";
    if (showMissing) value.className = "na-value";
  }
  const detail = document.createElement("small");
  detail.textContent = label;
  wrapper.append(value, detail);
  return wrapper;
}

function getJobCardClassName(job) {
  return [
    "job-card",
    job.favoriteJob ? "favorite" : "",
    hasJobType(job, "Internship") ? "internship" : "",
    hasJobType(job, "Part-time") ? "part-time" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function cell(text, className = "") {
  const div = document.createElement("div");
  div.className = `job-cell ${className}`.trim();
  div.textContent = text;
  return div;
}

function createCompanyLogo(job) {
  const logo = document.createElement("div");
  logo.className = `company-logo${job.favoriteCompany ? " favorite-company-logo" : ""}`;
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
    ? [".jpg", ".png", ".jpeg"].map(
        (extension) => `img/${fileBase}${extension}`,
      )
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
  const value = job.industry === "Other" ? job.industryOther : job.industry;
  const aliases = {
    "Defense & Security": "MIC",
    "Federal Govt": "Federal Government",
    "Think Tank": "Policy / Think Tank",
    Media: "Journalism / Media",
    Transport: "Transportation",
    Utilities: "Utilities / Telecommunications",
  };
  const label = String(value || "").trim();
  return aliases[label] || label;
}

function industryForForm(job, options) {
  const rawIndustry = String(job.industry || "").trim();
  const displayed = getIndustryDisplay(job);
  if (!displayed) return { value: "", other: "" };
  if (rawIndustry === "Other" && job.industryOther)
    return { value: "Other", other: displayed };
  if (options.includes(displayed)) return { value: displayed, other: "" };
  return { value: "Other", other: displayed };
}

function statusChip(job) {
  if (isAppliedJob(job)) {
    const applicationStatus = getApplicationStatusDisplay(job);
    return chip(applicationStatus, applicationStatus.toLowerCase());
  }
  const priority = job.priority || "";
  if (priority === "Urgent") return chip("Urgent", "urgent");
  if (priority === "High") return chip("High", "high");
  if (priority === "Medium") return chip("Medium", "medium");
  if (priority === "Low") return chip("Low", "low");
  if (priority === "Upcoming") return chip("Upcoming", "upcoming");
  if (priority === "Future") return chip("Future", "future");
  if (isAppliedNo(job)) return chip("Reference", "reference");
  return chip("", "low");
}

function applicationStageChip(job) {
  const stage = getApplicationStage(job);
  return chip(stage, `stage-${stage.toLowerCase()}`);
}

function applicationStatusChip(job) {
  const applicationStatus = getApplicationStatusDisplay(job);
  return chip(applicationStatus, applicationStatus.toLowerCase());
}

function getApplicationStatusDisplay(job) {
  return getFinalStatusForForm(job) || (isAppliedJob(job) ? "In-progress" : "");
}

function getApplicationStage(job) {
  if (isDecisionApplicationStatus(getFinalStatusForForm(job)))
    return "Decision";
  if (job.assessmentDate || job.assessmentStatus === "Yes") return "Assessed";
  if (job.interviewDate || job.interviewStatus === "Yes") return "Interviewed";
  if (job.screenDate || job.screenStatus === "Yes") return "Screened";
  if (job.responseDate || job.responseStatus === "Yes") return "Responded";
  return "Applied";
}

function getLastRespondedDate(job) {
  return (
    job.lastHeardFrom ||
    getLastHeardFrom([
      job.responseDate,
      job.screenDate,
      job.interviewDate,
      job.assessmentDate,
      job.finalStatusDate,
    ])
  );
}

function isFavoriteJob(job) {
  return Boolean(job.favoriteJob || job.favoriteCompany);
}

function isReferenceJob(job) {
  return (
    String(job.priority || "").toLowerCase() === "future" || isAppliedNo(job)
  );
}

function isAppliedJob(job) {
  return getAppliedStatus(job) === "Yes" || Boolean(getFinalStatusForForm(job));
}

function isAppliedNo(job) {
  return getAppliedStatus(job) === "No";
}

function getAppliedStatus(job) {
  if (job.appliedStatus) return job.appliedStatus;
  return job.appliedDate ? "Yes" : "";
}

function getAppliedLifecycleChoice(name, appliedStatus) {
  if (appliedStatus !== "Yes") return "";
  return getRadioValue(name) || "No";
}

function getLifecycleStatusForForm(status, date, appliedStatus) {
  if (status) return status;
  if (date) return "Yes";
  return appliedStatus === "Yes" ? "No" : "";
}

function getFinalStatusForForm(job) {
  if (isFinalApplicationStatus(job.finalStatus)) return job.finalStatus;
  if (isFinalApplicationStatus(job.applicationStatus))
    return job.applicationStatus;
  return "";
}

function getApplicationStatus(appliedStatus, finalStatus) {
  if (appliedStatus !== "Yes") return "";
  return isFinalApplicationStatus(finalStatus) ? finalStatus : "In-progress";
}

function isFinalApplicationStatus(status) {
  return ["Ghosted", "Rejected", "Accepted"].includes(status);
}

function isDecisionApplicationStatus(status) {
  return ["Rejected", "Accepted"].includes(status);
}

function isDatedFinalStatus(status) {
  return isDecisionApplicationStatus(status);
}

function getLastHeardFrom(dates) {
  const sortedDates = dates.filter(Boolean).sort();
  return sortedDates[sortedDates.length - 1] || "";
}

function getDeadlineChoice(job) {
  if (job.deadlineChoice) return job.deadlineChoice;
  return job.deadline ? "Select Date" : "Blank";
}

function getPayDisplay(job) {
  const min = parseNumber(job.payMin);
  const max = parseNumber(job.payMax);
  const midpoint = parseNumber(job.payMidpoint);
  const suffix = job.payType ? ` ${job.payType.toLowerCase()}` : "";
  if (Number.isFinite(min) && Number.isFinite(max)) {
    return {
      main: `${formatCurrency(min)} - ${formatCurrency(max)}`,
      detail: midpoint
        ? `Mid ${formatCurrency(midpoint)}${suffix}`
        : job.payType || "",
    };
  }
  if (Number.isFinite(midpoint)) {
    return {
      main: `Avg ${formatCurrency(midpoint)}`,
      detail: job.payType || "",
    };
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
    els.roleFilter.append(
      createFilterOptionButton(role, "roleFilter", selected.has(role)),
    );
  });
}

function updateIndustryFilterOptions(sourceJobs) {
  const selected = new Set(filters.industries);
  const standardIndustries = [...els.companyIndustry.options]
    .map((option) => option.value)
    .filter((value) => value && value !== "Other");
  const knownIndustries = unique([
    ...standardIndustries,
    ...sourceJobs.map(getIndustryDisplay),
  ]);

  els.industryFilter.replaceChildren();
  knownIndustries.forEach((industry) => {
    els.industryFilter.append(
      createFilterOptionButton(
        industry,
        "industryFilter",
        selected.has(industry),
      ),
    );
  });
}

function createFilterOptionButton(label, dataKey, selected) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "filter-button filter-option";
  button.dataset[dataKey] = label;
  button.setAttribute("role", "option");
  button.setAttribute("aria-selected", String(selected));
  button.classList.toggle("active", selected);
  button.textContent = label;
  return button;
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
    if (!text || text.length < 120)
      throw new Error("No readable description found");
    els.jobDescription.value = text;
    els.scrapeStatus.textContent = "Description scraped.";
    showToast("Description scraped.");
  } catch (error) {
    els.scrapeStatus.textContent =
      "Scrape blocked. Paste the description manually.";
    showToast("This site blocked direct scraping.");
  } finally {
    els.scrapeButton.disabled = false;
  }
}

function extractReadableText(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  doc
    .querySelectorAll(
      "script, style, noscript, svg, iframe, nav, header, footer",
    )
    .forEach((node) => node.remove());
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
    setFolderGate(
      true,
      "This browser does not support folder access. Use a browser with File System Access support.",
    );
    showToast("Folder writing is not supported in this browser.");
    return;
  }

  try {
    const pickedHandle = await window.showDirectoryPicker({
      mode: "readwrite",
    });
    const permission = await requestDirectoryPermission(pickedHandle);
    if (permission !== "granted") {
      directoryHandle = null;
      showToast("Folder permission is needed to import and export files.");
      return;
    }
    directoryHandle = await getDataDirectoryHandle(pickedHandle);
    const importResult = await importFromConnectedFolder(directoryHandle);
    await refreshJobs();
    const syncStatus = await safeSyncToConnectedFolder();
    if (syncStatus === "failed") {
      setFolderGate(
        true,
        "The folder connected, but synchronization failed. Try again.",
      );
      showToast("Folder connected, but export failed.");
      return;
    }
    setFolderGate(false);
    const importedParts = [];
    if (importResult.jobs) {
      importedParts.push(
        `${importResult.jobs} ${importResult.jobs === 1 ? "job" : "jobs"}`,
      );
    }
    if (importResult.companies) {
      importedParts.push(
        `${importResult.companies} ${importResult.companies === 1 ? "company" : "companies"}`,
      );
    }
    showToast(
      importedParts.length
        ? `Folder connected. ${importedParts.join(" and ")} imported.`
        : "Folder connected.",
    );
  } catch (error) {
    setFolderGate(true);
    showToast("Folder connection canceled.");
  }
}

async function syncToConnectedFolder(forceNotice = false) {
  if (!directoryHandle) return "skipped";
  const permission = await requestDirectoryPermission(directoryHandle);
  if (permission !== "granted") {
    directoryHandle = null;
    setFolderGate(true, "Folder permission is needed to continue.");
    showToast("Folder permission is needed to export files.");
    return "failed";
  }

  const jobsCsv = await buildCsv();
  const companiesCsv = buildCompaniesCsv();
  await writeFile(directoryHandle, "jobs.csv", jobsCsv);
  await writeFile(directoryHandle, "companies.csv", companiesCsv);
  const descriptionsDir = await directoryHandle.getDirectoryHandle(
    "job-descriptions",
    { create: true },
  );
  await Promise.all(
    jobs.map(async (job) => {
      if (!job.descriptionFilename || !job.descriptionLength) return;
      const text = await getDescription(job.id);
      if (text) await writeFile(descriptionsDir, job.descriptionFilename, text);
    }),
  );
  if (forceNotice) showToast("Job, company, and description files exported.");
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
  const fileHandle = await parentHandle.getFileHandle(fileName, {
    create: true,
  });
  const writable = await fileHandle.createWritable();
  await writable.write(contents);
  await writable.close();
}

async function readTextFile(parentHandle, fileName) {
  try {
    const fileHandle = await parentHandle.getFileHandle(fileName);
    const file = await fileHandle.getFile();
    return file.text();
  } catch (error) {
    if (error.name === "NotFoundError") return null;
    throw error;
  }
}

async function getExistingDirectoryHandle(parentHandle, directoryName) {
  try {
    return await parentHandle.getDirectoryHandle(directoryName);
  } catch (error) {
    if (error.name === "NotFoundError") return null;
    throw error;
  }
}

async function getDataDirectoryHandle(pickedHandle) {
  if (pickedHandle.name === "db") return pickedHandle;
  const dbHandle = await getExistingDirectoryHandle(pickedHandle, "db");
  if (!dbHandle) return pickedHandle;
  const [jobsCsv, companiesCsv] = await Promise.all([
    readTextFile(dbHandle, "jobs.csv"),
    readTextFile(dbHandle, "companies.csv"),
  ]);
  if (jobsCsv !== null || companiesCsv !== null) return dbHandle;
  const descriptionsDir = await getExistingDirectoryHandle(
    dbHandle,
    "job-descriptions",
  );
  return descriptionsDir || pickedHandle;
}

async function exportCsv() {
  const csv = await buildCsv();
  downloadBlob(csv, "jobs.csv", "text/csv");
  showToast("Jobs CSV exported.");
}

async function buildCsv() {
  const rows = jobs.map((job) =>
    JOB_CSV_COLUMNS.map((column) =>
      serializeCsvValue(getCsvColumnValue(job, column)),
    ),
  );
  return [JOB_CSV_COLUMNS, ...rows]
    .map((row) => row.map(escapeCsv).join(","))
    .join("\r\n");
}

function exportCompaniesCsv() {
  downloadBlob(buildCompaniesCsv(), "companies.csv", "text/csv");
  showToast("Companies CSV exported.");
}

function buildCompaniesCsv() {
  const rows = [...companies]
    .sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    )
    .map((company) =>
      COMPANY_CSV_COLUMNS.map((column) => serializeCsvValue(company[column])),
    );
  return [COMPANY_CSV_COLUMNS, ...rows]
    .map((row) => row.map(escapeCsv).join(","))
    .join("\r\n");
}

async function exportDescriptions() {
  const jobsWithDescriptions = jobs.filter(
    (job) => job.descriptionFilename && job.descriptionLength,
  );
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
  downloadBlob(
    text,
    job.descriptionFilename || makeDescriptionFilename(job.id),
    "text/plain",
  );
}

async function importCsv(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const imported = parseJobsCsv(text);
    await importJobs(imported);
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

async function importCompaniesCsv(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const imported = parseCompaniesCsv(await file.text());
    const result = await importCompanies(imported);
    await refreshJobs();
    const syncStatus = await safeSyncToConnectedFolder();
    showToast(
      syncStatus === "failed"
        ? `${result.saved} companies imported locally. Folder export failed.`
        : `${result.saved} ${result.saved === 1 ? "company" : "companies"} imported.`,
    );
  } catch (error) {
    showToast("Companies CSV import failed.");
  } finally {
    event.target.value = "";
  }
}

async function importFromConnectedFolder(handle) {
  const [jobsCsv, companiesCsv] = await Promise.all([
    readTextFile(handle, "jobs.csv"),
    readTextFile(handle, "companies.csv"),
  ]);
  if (!jobsCsv && !companiesCsv) {
    return { jobs: 0, companies: 0, descriptions: 0 };
  }

  const companyImport = companiesCsv
    ? await importCompanies(parseCompaniesCsv(companiesCsv))
    : { saved: 0, idMap: new Map() };
  const imported = jobsCsv ? parseJobsCsv(jobsCsv) : [];
  imported.forEach((job) => {
    job.companyId = companyImport.idMap.get(job.companyId) || job.companyId;
  });
  const existingJobs = await getAllJobs();
  const existingById = new Map(existingJobs.map((job) => [job.id, job]));
  const jobsToImport = imported.filter((job) =>
    shouldImportJob(job, existingById.get(job.id)),
  );
  const descriptionsDir = await getExistingDirectoryHandle(
    handle,
    "job-descriptions",
  );
  let descriptionCount = 0;

  if (descriptionsDir) {
    for (const job of jobsToImport) {
      if (!job.descriptionFilename) continue;
      const text = await readTextFile(descriptionsDir, job.descriptionFilename);
      if (text === null) continue;
      await putDescription(job.id, text);
      job.descriptionLength = text.length;
      descriptionCount += 1;
    }
  }

  const savedJobs = await importJobs(imported);
  return {
    jobs: savedJobs,
    companies: companyImport.saved,
    descriptions: descriptionCount,
  };
}

async function importFromRepositoryFiles() {
  const [jobsCsv, companiesCsv] = await Promise.all([
    fetchTextFile("db/jobs.csv"),
    fetchTextFile("db/companies.csv"),
  ]);
  if (!jobsCsv && !companiesCsv) {
    return { jobs: 0, companies: 0, descriptions: 0 };
  }

  const companyImport = companiesCsv
    ? await importCompanies(parseCompaniesCsv(companiesCsv))
    : { saved: 0, idMap: new Map() };
  const imported = jobsCsv ? parseJobsCsv(jobsCsv) : [];
  imported.forEach((job) => {
    job.companyId = companyImport.idMap.get(job.companyId) || job.companyId;
  });
  const descriptionCount = await importDescriptionsFromRepository(imported);
  const savedJobs = await importJobs(imported);
  return {
    jobs: savedJobs,
    companies: companyImport.saved,
    descriptions: descriptionCount,
  };
}

async function importDescriptionsFromRepository(imported) {
  const counts = await Promise.all(
    imported.map(async (job) => {
      if (!job.descriptionFilename) return 0;
      const text = await fetchTextFile(
        `db/job-descriptions/${encodeURIComponent(job.descriptionFilename)}`,
      );
      if (text === null) return 0;
      await putDescription(job.id, text);
      job.descriptionLength = text.length;
      return 1;
    }),
  );
  return counts.reduce((total, count) => total + count, 0);
}

async function fetchTextFile(path) {
  try {
    const response = await fetch(path, { cache: "no-store" });
    if (!response.ok) return null;
    return response.text();
  } catch (error) {
    return null;
  }
}

async function importJobs(imported) {
  await migrateLegacyCompanies(imported);
  const existingJobs = await getAllJobs();
  const existingById = new Map(existingJobs.map((job) => [job.id, job]));
  let savedJobs = 0;
  for (const job of imported) {
    if (!shouldImportJob(job, existingById.get(job.id))) continue;
    await putJob(stripLegacyCompanyFields(job));
    savedJobs += 1;
  }
  return savedJobs;
}

async function importCompanies(imported) {
  const existingCompanies = await getAllCompanies();
  const byId = new Map(
    existingCompanies.map((company) => [company.id, company]),
  );
  const byName = new Map(
    existingCompanies.map((company) => [
      normalizeCompanyName(company.name),
      company,
    ]),
  );
  const idMap = new Map();
  let saved = 0;

  for (const importedCompany of imported) {
    const normalized = normalizeCompanyRecord(importedCompany);
    if (!normalized.name) continue;
    const existing =
      byId.get(normalized.id) ||
      byName.get(normalizeCompanyName(normalized.name));
    const company = existing ? { ...normalized, id: existing.id } : normalized;
    idMap.set(normalized.id, company.id);
    if (existing && !shouldImportRecord(company, existing)) continue;
    await putCompany(company);
    byId.set(company.id, company);
    byName.set(normalizeCompanyName(company.name), company);
    saved += 1;
  }
  return { saved, idMap };
}

async function migrateLegacyCompanies(importedJobs) {
  const existingCompanies = await getAllCompanies();
  const byName = new Map(
    existingCompanies.map((company) => [
      normalizeCompanyName(company.name),
      company,
    ]),
  );

  for (const job of importedJobs) {
    if (job.companyId || !job.company) continue;
    const key = normalizeCompanyName(job.company);
    let company = byName.get(key);
    const legacyIndustry = getIndustryDisplay(job);
    const legacyMission = Array.isArray(job.helping)
      ? job.helping
      : splitList(job.helping);
    const legacyRank = job.favoriteCompany ? "Favorite" : "";

    if (!company) {
      company = normalizeCompanyRecord({
        id: createId(),
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        name: job.company,
        industry: legacyIndustry,
        mission: legacyMission,
        rank: legacyRank,
      });
      await putCompany(company);
      byName.set(key, company);
    } else {
      const merged = normalizeCompanyRecord({
        ...company,
        industry: company.industry || legacyIndustry,
        mission: unique([...(company.mission || []), ...legacyMission]),
        rank: company.rank || legacyRank,
        updatedAt:
          [company.updatedAt, job.updatedAt].filter(Boolean).sort().at(-1) ||
          company.updatedAt,
      });
      if (JSON.stringify(merged) !== JSON.stringify(company)) {
        company = merged;
        await putCompany(company);
        byName.set(key, company);
      }
    }
    job.companyId = company.id;
  }
}

function stripLegacyCompanyFields(job) {
  const {
    company,
    favoriteCompany,
    industry,
    industryOther,
    helping,
    companySector,
    companyWebsite,
    companyRank,
    ...record
  } = job;
  return record;
}

function shouldImportJob(imported, existing) {
  return shouldImportRecord(imported, existing);
}

function shouldImportRecord(imported, existing) {
  if (!existing) return true;
  const importedUpdatedAt = Date.parse(imported.updatedAt || "");
  const existingUpdatedAt = Date.parse(existing.updatedAt || "");
  if (
    Number.isFinite(importedUpdatedAt) &&
    Number.isFinite(existingUpdatedAt)
  ) {
    return importedUpdatedAt >= existingUpdatedAt;
  }
  return Boolean(imported.updatedAt && !existing.updatedAt);
}

function parseJobsCsv(text) {
  const rows = parseCsv(text);
  const header = rows.shift() || [];
  return rows
    .filter((row) => row.some((value) => value.trim()))
    .map((row) => csvRowToJob(header, row));
}

function parseCompaniesCsv(text) {
  const rows = parseCsv(text);
  const header = rows.shift() || [];
  return rows
    .filter((row) => row.some((value) => value.trim()))
    .map((row) => {
      const record = {};
      header.forEach((column, index) => {
        record[column] = row[index] ?? "";
      });
      return normalizeCompanyRecord(record);
    })
    .filter((company) => company.name);
}

function csvRowToJob(header, row) {
  const record = {};
  header.forEach((column, index) => {
    record[column] = row[index] ?? "";
  });
  const now = new Date().toISOString();
  const deadlineChoice =
    record.deadlineChoice || (record.deadline ? "Select Date" : "Blank");
  const applicationNeeds = splitList(record.applicationNeeds);
  if (record.referenceCount && !applicationNeeds.includes("References")) {
    applicationNeeds.push("References");
  }
  const jobTypes = getImportedJobTypes(record);
  const appliedStatus =
    record.appliedStatus || (record.appliedDate ? "Yes" : "");
  const priority = appliedStatus === "No" ? "Future" : record.priority || "";
  const finalStatus = getImportedFinalStatus(record);
  const finalStatusDate = isDatedFinalStatus(finalStatus)
    ? record.finalStatusDate || ""
    : "";
  const responseStatus = getImportedLifecycleStatus(
    record.responseStatus,
    record.responseDate,
    appliedStatus,
  );
  const responseDate =
    responseStatus === "Yes" ? record.responseDate || "" : "";
  const screenStatus = getImportedLifecycleStatus(
    record.screenStatus,
    record.screenDate,
    appliedStatus,
  );
  const screenDate = screenStatus === "Yes" ? record.screenDate || "" : "";
  const interviewStatus = getImportedLifecycleStatus(
    record.interviewStatus,
    record.interviewDate,
    appliedStatus,
  );
  const interviewDate =
    interviewStatus === "Yes" ? record.interviewDate || "" : "";
  const assessmentStatus = getImportedLifecycleStatus(
    record.assessmentStatus,
    record.assessmentDate,
    appliedStatus,
  );
  const assessmentDate =
    assessmentStatus === "Yes" ? record.assessmentDate || "" : "";
  return {
    id: record.id || createId(),
    createdAt: record.createdAt || now,
    updatedAt: record.updatedAt || now,
    link: record.link || "",
    companyId: record.companyId || "",
    company: record.company || "",
    favoriteCompany: parseBoolean(record.favoriteCompany),
    title: record.title || "",
    locationChoice: record.locationChoice || "",
    locationOther: record.locationOther || "",
    location: record.location || "",
    payType: record.payType || "",
    payMin: record.payMin || "",
    payMax: record.payMax || "",
    payMidpoint:
      record.payMidpoint ||
      calculateMidpoint(record.payMin || "", record.payMax || ""),
    priority,
    datePosted: record.datePosted || "",
    deadlineChoice,
    deadline: deadlineChoice === "Select Date" ? record.deadline || "" : "",
    appliedStatus,
    appliedDate: appliedStatus === "Yes" ? record.appliedDate || "" : "",
    applicationStatus:
      record.applicationStatus ||
      getApplicationStatus(appliedStatus, finalStatus),
    lastHeardFrom:
      record.lastHeardFrom ||
      getLastHeardFrom([
        responseDate,
        screenDate,
        interviewDate,
        assessmentDate,
        finalStatusDate,
      ]),
    responseStatus,
    responseDate,
    screenStatus,
    screenDate,
    interviewStatus,
    interviewDate,
    assessmentStatus,
    assessmentDate,
    finalStatus,
    finalStatusDate,
    applicationNeeds,
    referenceCount: record.referenceCount || "",
    jobLevel: normalizeJobLevel(record.jobLevel),
    favoriteJob: parseBoolean(record.favoriteJob),
    jobTypes,
    roles: splitList(record.roles),
    roleOther: record.roleOther || "",
    industry: record.industry || "",
    industryOther: record.industryOther || "",
    helping: splitList(record.helping),
    descriptionFilename: record.descriptionFilename || "",
    descriptionLength: 0,
  };
}

function getCsvColumnValue(job, column) {
  if (column === "jobTypes") return getJobTypes(job);
  return job[column];
}

function getImportedJobTypes(record) {
  if (record.jobTypes) return normalizeJobTypes(splitList(record.jobTypes));

  const legacyTypes = [];
  const normalizedLevel = normalizeJobLevel(record.jobLevel);
  const hasFullTimeColumn = Object.prototype.hasOwnProperty.call(
    record,
    "fullTime",
  );
  const internship = parseBoolean(record.internship);
  const partTime = parseBoolean(record.partTime);
  if (normalizedLevel === "PT") legacyTypes.push("Part-time");
  if (normalizedLevel === "Intern") legacyTypes.push("Internship");
  if (
    parseBoolean(record.fullTime) ||
    (!hasFullTimeColumn && !internship && !partTime && !legacyTypes.length)
  ) {
    legacyTypes.push("Full-time");
  }
  if (internship) legacyTypes.push("Internship");
  if (partTime) legacyTypes.push("Part-time");
  return unique(legacyTypes);
}

function getImportedLifecycleStatus(status, date, appliedStatus) {
  if (status) return status;
  if (date) return "Yes";
  return appliedStatus === "Yes" ? "No" : "";
}

function getImportedFinalStatus(record) {
  if (isFinalApplicationStatus(record.finalStatus)) return record.finalStatus;
  if (isFinalApplicationStatus(record.applicationStatus))
    return record.applicationStatus;
  return "";
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

function clearRadioValue(name) {
  setRadioValue(name, "");
}

function ensureDefaultRadioValue(name, value) {
  if (!getRadioValue(name)) setRadioValue(name, value);
}

function rememberRadioState(event) {
  event.currentTarget.dataset.wasChecked = String(event.currentTarget.checked);
}

function rememberToggleableGroupRadioState(event) {
  const input = event.target
    .closest("label")
    ?.querySelector("input[type='radio']");
  if (input) input.dataset.wasChecked = String(input.checked);
}

function toggleCheckedRadio(event) {
  const input = event.currentTarget;
  if (input.dataset.wasChecked !== "true") return;
  input.checked = false;
  input.dataset.wasChecked = "false";
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function toggleCheckedRadioWithKeyboard(event) {
  const input = event.currentTarget;
  if (!input.checked || (event.key !== " " && event.key !== "Enter")) return;
  event.preventDefault();
  input.checked = false;
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function getSelectedValues(select) {
  return unique([...select.selectedOptions].map((option) => option.value));
}

function getCheckedValues(inputs) {
  return [...inputs]
    .filter((input) => input.checked)
    .map((input) => input.value);
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
  const normalized = unique((roles || []).filter(Boolean));
  if (roleOther && (!normalized.length || normalized.includes("Other")))
    normalized.push("Other");
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

function normalizeIntegerString(value) {
  const number = Number.parseInt(String(value).trim(), 10);
  return Number.isFinite(number) && number > 0 ? String(number) : "";
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
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function makeDescriptionFilename(id) {
  const company = slugify(els.company.value || "company");
  const title = slugify(els.jobTitle.value || "job");
  return `${company}-${title}-${id.slice(0, 8)}.txt`;
}

function slugify(value) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 42) || "job"
  );
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
  return unique(
    value
      .split(";")
      .map((item) => item.trim())
      .filter(Boolean),
  );
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
