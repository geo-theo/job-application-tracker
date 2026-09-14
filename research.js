"use strict";

// Research treats unapplied jobs and anything deliberately kept as a reference
// as market evidence. Applied-job outcomes remain the responsibility of Viz.
const researchState = {
  scope: "market",
  jobType: "All",
  role: "All",
  industry: "All",
  analysisDimension: "role",
  analysisGroup: "",
  analysisSection: "requirements",
  salaryGroup: "industry",
  salaryMode: "annualized",
};

let researchRenderRequest = 0;

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
  ["git", "Git", "technology", ["git", "github", "gitlab", "version control"]],
  ["sas", "SAS", "technology", ["sas"]],
  ["spark", "Spark / Hadoop", "technology", ["apache spark", "spark", "hadoop", "hdfs", "mapreduce", "hive"]],
  ["snowflake", "Snowflake", "technology", ["snowflake"]],
  ["bigquery", "BigQuery", "technology", ["bigquery", "google bigquery"]],
  ["modern-data-stack", "Modern data stack", "technology", ["modern data stack", "fivetran", "dbt", "looker", "sigma computing"]],
  ["jupyter", "Jupyter", "technology", ["jupyter", "jupyter notebook", "jupyter notebooks"]],
  ["python-data", "Python data libraries", "technology", ["pandas", "numpy", "scipy", "geopandas"]],
  ["ml-frameworks", "ML frameworks", "technology", ["tensorflow", "pytorch", "scikit-learn", "sklearn"]],
  ["docker", "Docker", "technology", ["docker", "containerization", "containerized"]],
  ["kubernetes", "Kubernetes", "technology", ["kubernetes", "k8s"]],
  ["linux", "Linux / Unix", "technology", ["linux", "unix"]],
  ["cicd", "CI/CD", "technology", ["ci/cd", "continuous integration", "github actions", "azure devops"]],
  ["html-css", "HTML / CSS", "technology", ["html", "html5", "css", "css3"]],
  ["java", "Java", "technology", ["java"]],
  ["cpp", "C / C++", "technology", ["c++", "cplusplus", "c programming"]],
  ["csharp", "C# / .NET", "technology", ["c#", ".net", "dotnet"]],
  ["go-rust-scala", "Go / Rust / Scala", "technology", ["golang", "go language", "rust", "scala"]],
  ["frontend", "React / Angular", "technology", ["react", "react.js", "angular", "angularjs"]],
  ["python-web", "Django / Flask", "technology", ["django", "flask"]],
  ["mapbox-carto", "Mapbox / CARTO", "technology", ["mapbox", "carto"]],
  ["web-mapping-libraries", "Web mapping libraries", "technology", ["leaflet", "openlayers", "cesium", "maplibre"]],
  ["earth-engine", "Google Earth Engine", "technology", ["google earth engine", "earth engine"]],
  ["gdal", "GDAL", "technology", ["gdal", "ogr"]],
  ["alteryx", "Alteryx", "technology", ["alteryx"]],
  ["creative-tools", "Adobe / Figma", "technology", ["adobe creative suite", "adobe illustrator", "adobe photoshop", "figma"]],
  ["sap", "SAP", "technology", ["sap"]],
  ["esri-field", "Esri field apps", "technology", ["survey123", "field maps", "arcgis field apps", "quickcapture"]],
  ["esri-story", "StoryMaps / Experience Builder", "technology", ["storymaps", "story maps", "experience builder", "web appbuilder"]],
  ["esri-dev", "ArcPy / Arcade / ModelBuilder", "technology", ["arcpy", "arcade", "modelbuilder", "arcgis api for python"]],
  ["gps", "GPS / GNSS", "technology", ["gps", "gnss", "global positioning system"]],
  ["cad-bim", "CAD / BIM", "technology", ["cad", "autocad", "bim", "revit"]],
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
  ["communication", "Communication", "capability", ["communication skills", "written and verbal communication", "written communication", "verbal communication", "communicate effectively", "explain technical concepts", "explain technical"]],
  ["collaboration", "Cross-functional collaboration", "capability", ["cross-functional", "cross functional", "collaborative environment", "collaborate with"]],
  ["stakeholders", "Stakeholder engagement", "capability", ["stakeholder management", "stakeholder engagement", "stakeholders", "clients"]],
  ["problem-solving", "Problem solving", "capability", ["problem-solving", "problem solving", "analytical thinking", "critical thinking"]],
  ["research", "Research", "capability", ["research methods", "conduct research", "research and analysis", "research skills"]],
  ["technical-writing", "Technical writing", "capability", ["technical writing", "technical documentation", "write documentation", "documentation skills"]],
  ["leadership", "Leadership", "capability", ["leadership", "lead teams", "team lead", "mentor"]],
  ["requirements", "Requirements gathering", "capability", ["requirements gathering", "business requirements", "user requirements", "requirements analysis"]],
  ["quality", "Quality assurance", "capability", ["quality assurance", "quality control", "data quality", "qa/qc"]],
  ["attention-detail", "Attention to detail", "capability", ["attention to detail", "detail-oriented", "detail oriented"]],
  ["presentation", "Presentation / storytelling", "capability", ["presentation skills", "present findings", "present insights", "data storytelling", "storytelling"]],
  ["customer-service", "Customer service", "capability", ["customer service", "customer-facing", "client service"]],
  ["independent-work", "Independent work", "capability", ["work independently", "independent worker", "self-directed", "self directed", "self-starter"]],
  ["time-management", "Time management", "capability", ["time management", "manage competing priorities", "multiple priorities", "meet deadlines"]],
  ["process-improvement", "Process improvement", "capability", ["process improvement", "continuous improvement", "workflow optimization"]],
  ["agile", "Agile / Scrum", "capability", ["agile", "scrum", "sprint planning"]],
  ["reporting", "Reporting", "capability", ["develop reports", "create reports", "reporting tools", "analytical reports"]],
  ["active-listening", "Active listening", "capability", ["active listening", "listen actively"]],
  ["cartography", "Cartography", "domain", ["cartography", "cartographic", "map production", "map design"]],
  ["statistics", "Statistics", "domain", ["statistics", "statistical analysis", "quantitative analysis", "quantitative methods"]],
  ["data-governance", "Data governance", "domain", ["data governance", "metadata management", "data stewardship"]],
  ["supply-chain", "Supply chain", "domain", ["supply chain", "logistics", "demand planning"]],
  ["intelligence", "Intelligence analysis", "domain", ["intelligence analysis", "geospatial intelligence", "geopolitical analysis", "open source intelligence", "osint"]],
  ["policy", "Policy analysis", "domain", ["policy analysis", "public policy", "policy research"]],
  ["data-modeling", "Data modeling", "domain", ["data modeling", "data modelling", "database design", "dimensional modeling"]],
  ["data-cleaning", "Data cleaning", "domain", ["data cleaning", "cleaning data", "data wrangling", "data munging", "deduplication"]],
  ["data-management", "Data management", "domain", ["data management", "manage data", "data administration"]],
  ["data-integration", "Data integration", "domain", ["data integration", "integrating data", "data interoperability"]],
  ["data-collection", "Data collection", "domain", ["data collection", "collecting data", "data acquisition"]],
  ["data-processing", "Data processing", "domain", ["data processing", "processing data", "analyzing data", "analysing data"]],
  ["data-science", "Data science", "domain", ["data science", "data scientist"]],
  ["business-intelligence", "Business intelligence", "domain", ["business intelligence", "bi tools", "bi platform"]],
  ["predictive-modeling", "Predictive modeling", "domain", ["predictive modeling", "predictive analytics", "prescriptive modeling", "forecasting models"]],
  ["experimental-design", "Experimental design / A-B testing", "domain", ["experimental design", "a/b testing", "ab testing", "randomized controlled trial"]],
  ["survey-methods", "Survey methods", "domain", ["survey methodology", "survey design", "sample design", "survey research"]],
  ["web-development", "Web development", "domain", ["web development", "web applications", "web application development", "frontend development", "back-end development", "backend development"]],
  ["software-development", "Software development", "domain", ["software development", "software engineering", "application development"]],
  ["web-mapping", "Web mapping", "domain", ["web mapping", "interactive mapping", "web gis", "geospatial web applications"]],
  ["geoprocessing", "Geoprocessing", "domain", ["geoprocessing", "geospatial processing", "spatial processing"]],
  ["raster-vector", "Raster / vector data", "domain", ["raster and vector", "raster data", "vector data", "geotiff", "shapefile"]],
  ["projections", "Coordinate systems / projections", "domain", ["coordinate systems", "coordinate reference systems", "map projections", "spatial reference"]],
  ["imagery", "Imagery analysis", "domain", ["imagery analysis", "image analysis", "image processing", "geospatial imagery"]],
  ["lidar-sar", "LiDAR / SAR", "domain", ["lidar", "synthetic aperture radar", "sar imagery", "hyperspectral imagery"]],
  ["geodatabase", "Geodatabases", "domain", ["geodatabase", "geodatabases", "enterprise geodatabase", "sde database"]],
  ["metadata", "Metadata", "domain", ["metadata", "data catalog", "data lineage"]],
  ["location-intelligence", "Location intelligence", "domain", ["location intelligence", "location analytics", "site selection"]],
  ["asset-management", "Asset management", "domain", ["asset management", "infrastructure assets", "utility network"]],
  ["economics", "Economic analysis", "domain", ["economic analysis", "econometrics", "socioeconomic data", "economic research"]],
  ["public-health", "Public health", "domain", ["public health", "health data", "epidemiology", "population health"]],
  ["transportation", "Transportation analysis", "domain", ["transportation planning", "transportation data", "traffic analysis", "transit data"]],
  ["conservation", "Conservation / environment", "domain", ["conservation", "environmental planning", "natural resources", "wildlife management"]],
  ["computer-science", "Computer science", "qualification", ["computer science", "computer engineering", "information science"]],
  ["social-science", "Social science / public administration", "qualification", ["social science", "social sciences", "public administration"]],
  ["bachelors", "Bachelor’s degree", "qualification", ["bachelor's degree", "bachelors degree", "baccalaureate degree", "undergraduate degree"]],
  ["masters", "Master’s degree", "qualification", ["master's degree", "masters degree", "graduate degree"]],
  ["experience-years", "Years of experience", "qualification", ["years of experience", "years experience", "year of experience"]],
  ["clearance", "Security clearance", "qualification", ["security clearance", "top secret", "secret clearance", "ts/sci"]],
  ["drivers-license", "Driver’s license", "qualification", ["driver's license", "drivers license", "driving licence", "valid license"]],
  ["travel", "Travel", "qualification", ["willingness to travel", "ability to travel", "travel required", "domestic travel", "international travel"]],
  ["work-authorization", "Work authorization", "qualification", ["work authorization", "authorized to work", "sponsorship", "right to work"]],
  ["certification", "Professional certification", "qualification", ["gis certificate", "professional certification", "gisp", "pmp certification", "certified professional"]],
  ["citizenship", "Citizenship requirement", "qualification", ["u.s. citizen", "us citizen", "united states citizen", "citizenship required"]],
  ["background-check", "Background check", "qualification", ["background check", "criminal background", "pre-employment screening"]],
].map(([key, label, category, aliases]) => ({ key, label, category, aliases }));

const RESEARCH_PHRASE_EDGE_WORDS = new Set(`
  about above across after again against all also among an and any are as at be
  because been before being below between both but by can could each either for
  from further had has have having here how if in into is it its itself may more
  most must no nor not of on only or other our out over per same should so some
  such than that the their them then there these they this those through to under
  up very was we were what when where which while who will with within would you
  your job jobs role position candidate candidates company employer opportunity
  preferred required requirements responsibility responsibilities qualification
  qualifications duties include includes including related equivalent various
  a s experience degree field relevant working using knowledge ability minimum
  meet conditions employment desired desirable years year one two three four five
  six seven eight nine ten team teams member members support helping help successful
  best practices following areas high plus considered demonstrated strong excellent
  application applications applicant applicants apply cover letter time off salary
  pay compensation benefit benefits insurance leave vacation bonus page pages
  percent probationary federal united states dependent upon advanced new similar
  proficiency source sources tool tools technology technologies
`.trim().split(/\s+/));

const RESEARCH_PHRASE_REJECT = [
  /equal opportunity/,
  /qualified applicants?/,
  /terms and conditions/,
  /sexual orientation/,
  /gender identity/,
  /national origin/,
  /reasonable accommodation/,
  /without regard/,
  /benefits package/,
  /apply for this/,
  /click here/,
  /privacy policy/,
  /minimum qualifications?/,
  /preferred qualifications?/,
  /years? of experience/,
  /data sources?/,
];

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

function researchDescriptionSections(text) {
  const sections = { all: [], requirements: [], responsibilities: [] };
  let active = "";
  const requirementHeading = /^(?:(?:minimum|required|preferred|basic|desired|job|key)\s*)?(?:qualifications?|requirements?|skills(?:\s+and\s+(?:competencies|abilities))?|education(?:\s+and\s+experience)?|what\s+you(?:'ll)?\s+bring|who\s+you\s+are)/i;
  const responsibilityHeading = /^(?:(?:essential|key|primary|job)\s*)?(?:responsibilities|duties|what\s+you(?:'ll)?\s+do|what\s+you\s+will\s+do|the\s+role|day.to.day)/i;
  const neutralHeading = /^(?:benefits|compensation|salary|about\s+(?:us|the\s+company|our)|equal\s+opportunity|physical\s+(?:demands|requirements)|working\s+conditions)/i;
  const lines = String(text || "")
    .replace(/\r/g, "")
    .replace(/[•●▪◦]/g, "\n")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  lines.forEach((line) => {
    let forced = "";
    if (requirementHeading.test(line)) forced = active = "requirements";
    else if (responsibilityHeading.test(line)) forced = active = "responsibilities";
    else if (neutralHeading.test(line)) active = "";
    const units = line.split(/(?<=[.!?;])\s+(?=[A-Z0-9])/).map((unit) => unit.trim()).filter((unit) => unit.length > 3);
    units.forEach((unit) => {
      sections.all.push(unit);
      const normalized = researchNormalizeText(unit);
      const inferred = forced || (/\b(?:required|requirements?|qualifications?|proficien|experience (?:with|in|using)|knowledge of|familiarity with|ability to|must be|degree|certification)\b/.test(normalized)
        ? "requirements"
        : /\b(?:responsib|duties|you will|you'll|design|build|develop|create|analy[sz]e|manage|lead|coordinate|prepare|produce|maintain|implement|support)\b/.test(normalized)
          ? "responsibilities"
          : active);
      if (inferred) sections[inferred].push(unit);
    });
  });
  return sections;
}

function researchSectionUnits(entry, section = "all") {
  const sections = entry.sections || researchDescriptionSections(entry.text);
  return sections[section] || [];
}

function researchAnalyzeDescriptions(entries, section = "all") {
  const described = entries.filter((entry) => String(entry.text || "").trim());
  const withSections = described.map((entry) => ({ ...entry, sections: researchDescriptionSections(entry.text) }));
  const analyzed = withSections
    .map((entry) => ({ ...entry, normalizedText: researchNormalizeText(researchSectionUnits(entry, section).join(" ")) }))
    .filter((entry) => entry.normalizedText.trim());
  const signals = RESEARCH_SIGNALS.map((signal) => {
    const matches = analyzed.map((entry) => ({ entry, count: researchPhraseCount(entry.normalizedText, signal.aliases) })).filter(({ count }) => count);
    return {
      ...signal,
      source: "recognized",
      mentions: matches.reduce((sum, match) => sum + match.count, 0),
      jobCount: matches.length,
      jobs: matches.map(({ entry }) => entry.job),
    };
  }).filter((signal) => signal.jobCount)
    .sort((a, b) => b.jobCount - a.jobCount || b.mentions - a.mentions || a.label.localeCompare(b.label));
  return { described: withSections, analyzed, signals };
}

function researchMinePhrases(analyzed) {
  const phrases = new Map();
  const recognized = new Set(RESEARCH_SIGNALS.flatMap((signal) => [signal.label, ...signal.aliases]).map(researchNormalizeText));
  const recognizedPhrases = [...recognized].filter((phrase) => phrase.length > 2 && !["api", "apis", "gis", "sql", "sas", "git", "java", "linux", "unix", "aws", "gcp", "cad", "bim", "gps", "gnss"].includes(phrase));
  analyzed.forEach((entry) => {
    const seen = new Set();
    researchSectionUnits(entry, "all").forEach((unit) => {
      // Do not build phrases across commas, colons, parentheticals, or list
      // separators; those boundary-spanning n-grams are usually nonsense.
      researchNormalizeText(unit).split(/[,:;()[\]{}|/]+|\s+[–—]\s+/).forEach((segment) => {
        const tokens = segment.replace(/'s\b/g, "").match(/[a-z0-9][a-z0-9+#.-]*/g) || [];
        for (const size of [2, 3]) {
          for (let index = 0; index <= tokens.length - size; index += 1) {
            const slice = tokens.slice(index, index + size);
            const phrase = slice.join(" ").replace(/\.$/, "");
            if (slice.some((word) => RESEARCH_PHRASE_EDGE_WORDS.has(word) || /\d/.test(word))) continue;
            if (phrase.length < 7 || phrase.length > 58) continue;
            if (recognized.has(phrase) || recognizedPhrases.some((known) => phrase.includes(known)) || RESEARCH_PHRASE_REJECT.some((pattern) => pattern.test(phrase))) continue;
            if (!phrases.has(phrase)) phrases.set(phrase, { key: `phrase:${phrase}`, label: phrase, aliases: [phrase], category: "discovered", source: "discovered", mentions: 0, jobs: [] });
            const candidate = phrases.get(phrase);
            candidate.mentions += 1;
            if (!seen.has(phrase)) candidate.jobs.push(entry.job);
            seen.add(phrase);
          }
        }
      });
    });
  });
  const minimum = analyzed.length >= 5 ? 2 : 1;
  return [...phrases.values()]
    .map((phrase) => ({ ...phrase, jobCount: phrase.jobs.length }))
    .filter((phrase) => phrase.jobCount >= minimum)
    .sort((a, b) => b.jobCount - a.jobCount || b.mentions - a.mentions || a.label.localeCompare(b.label));
}

function researchCandidateCorpus(entries, section = "requirements") {
  const analysis = researchAnalyzeDescriptions(entries, section);
  // Mine only the selected requirement/responsibility sentences, already stored
  // as `all` on these reduced entries, so discovered phrases share the same scope.
  const reduced = analysis.analyzed.map((entry) => ({
    ...entry,
    sections: { all: researchSectionUnits(entry, section) },
  }));
  return { ...analysis, candidates: [...analysis.signals, ...researchMinePhrases(reduced)] };
}

function researchDescriptionGroups(entries, dimension) {
  const groups = new Map();
  entries.forEach((entry) => {
    const labels = dimension === "role"
      ? researchRoleLabels(entry.job).length ? researchRoleLabels(entry.job) : ["Unspecified role"]
      : [getIndustryDisplay(entry.job) || "Unspecified industry"];
    labels.forEach((label) => {
      if (!groups.has(label)) groups.set(label, { label, entries: [] });
      groups.get(label).entries.push(entry);
    });
  });
  return [...groups.values()].sort((a, b) => b.entries.length - a.entries.length || a.label.localeCompare(b.label));
}

function researchCandidateMetrics(corpus, groupEntries) {
  const groupIds = new Set(groupEntries.map((entry) => entry.job.id));
  const allIds = new Set(corpus.analyzed.map((entry) => entry.job.id));
  const restSize = Math.max(0, allIds.size - groupIds.size);
  return corpus.candidates.map((candidate) => {
    const groupJobs = candidate.jobs.filter((job) => groupIds.has(job.id));
    const restJobs = candidate.jobs.filter((job) => allIds.has(job.id) && !groupIds.has(job.id));
    const coverage = groupIds.size ? groupJobs.length / groupIds.size : 0;
    const restCoverage = restSize ? restJobs.length / restSize : 0;
    return {
      ...candidate,
      jobs: groupJobs,
      jobCount: groupJobs.length,
      coverage,
      restCoverage,
      lift: restSize ? (coverage + 0.025) / (restCoverage + 0.025) : null,
      groupSize: groupIds.size,
    };
  }).filter((candidate) => candidate.jobCount);
}

function researchRankedMetrics(metrics, source = "recognized") {
  const weights = { technology: 1.3, domain: 1.18, capability: 0.92, qualification: 0.82, discovered: 1 };
  return metrics.filter((metric) => metric.source === source)
    .map((metric) => ({ ...metric, score: metric.coverage * (weights[metric.category] || 1) * (1 + Math.min(Math.max((metric.lift || 1) - 1, 0), 3) * 0.12) }))
    .sort((a, b) => b.score - a.score || b.jobCount - a.jobCount || a.label.localeCompare(b.label));
}

function researchDistinctPhrases(metrics, limit = 14) {
  const selected = [];
  metrics.forEach((metric) => {
    if (selected.length >= limit) return;
    if (selected.some((existing) => existing.label.includes(metric.label) || metric.label.includes(existing.label))) return;
    selected.push(metric);
  });
  return selected;
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
    researchKeywordPanel(entries),
    researchDistributionPanel(records, "role", "02", "Roles in demand", "See which role families recur across the market sample.", "research-role-panel"),
    researchDistributionPanel(records, "industry", "03", "Industries represented", "Compare the industries contributing opportunities to this view.", "research-industry-panel"),
    researchSalaryPanel(records),
    researchDistributionPanel(records, "mission", "05", "Who the work serves", "Mission tags reveal who may benefit from the work.", "research-mission-panel"),
    researchDistributionPanel(records, "location", "06", "Where the opportunities are", "Compare normalized locations, including remote and unlocated work.", "research-location-panel research-wide"),
  );
  els.jobList.replaceChildren(dashboard);
}

function researchKeywordPanel(entries) {
  const panel = vizPanel("01", "What does each part of the market ask for?", "Compare role- or industry-specific skill profiles instead of flattening unlike jobs into one generic list.", "research-keyword-panel research-wide");
  const controls = vizElement("div", "research-analysis-controls");
  const content = vizElement("div", "research-keywords");
  panel.append(controls, content);
  const showJobs = vizDrilldown(panel);

  function draw() {
    content.replaceChildren();
    panel.querySelector(".viz-drilldown").hidden = true;
    const corpus = researchCandidateCorpus(entries, researchState.analysisSection);
    const groups = researchDescriptionGroups(corpus.analyzed, researchState.analysisDimension);
    if (researchState.analysisGroup && !groups.some((group) => group.label === researchState.analysisGroup)) researchState.analysisGroup = "";
    const groupLabel = researchState.analysisDimension === "role" ? "roles" : "industries";
    controls.replaceChildren(
      vizSelect("Compare descriptions by", [["role", "Role"], ["industry", "Industry"]], researchState.analysisDimension, (value) => {
        researchState.analysisDimension = value;
        researchState.analysisGroup = "";
        draw();
      }),
      vizSelect("Focus", [["", `Compare top ${groupLabel}`], ...groups.map((group) => [group.label, group.label])], researchState.analysisGroup, (value) => {
        researchState.analysisGroup = value;
        draw();
      }),
      vizSelect("Read from", [["requirements", "Requirements & qualifications"], ["responsibilities", "Responsibilities & duties"], ["all", "Whole descriptions"]], researchState.analysisSection, (value) => {
        researchState.analysisSection = value;
        draw();
      }),
    );
    if (!corpus.described.length) {
      content.append(vizElement("p", "viz-empty", "No saved descriptions in this view. Add or import description text to build role and industry profiles."));
      return;
    }
    if (!corpus.analyzed.length) {
      content.append(vizElement("p", "viz-empty", "No matching requirement or responsibility sections were detected. Try Whole descriptions."));
      return;
    }
    content.append(vizElement("p", "research-analysis-coverage", `${corpus.analyzed.length} of ${corpus.described.length} descriptions contain language classified as ${researchSectionLabel(researchState.analysisSection)}. Percentages below use that evidence set.`));
    const focused = groups.find((group) => group.label === researchState.analysisGroup);
    if (focused) researchFocusedProfile(content, focused, corpus, showJobs, draw);
    else researchProfileOverview(content, groups, corpus, draw);

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

function researchSectionLabel(section) {
  return section === "requirements" ? "requirements" : section === "responsibilities" ? "responsibilities" : "the selected descriptions";
}

function researchProfileOverview(content, groups, corpus, redraw) {
  const intro = vizElement("div", "research-analysis-intro");
  intro.append(
    vizElement("strong", "", `Skill profiles for ${researchState.analysisDimension === "role" ? "each role" : "each industry"}`),
    vizElement("span", "", "Coverage shows how often a skill appears inside that group. Distinctive signals appear more often there than in the rest of the selected market."),
  );
  const grid = vizElement("div", "research-profile-grid");
  groups.slice(0, 12).forEach((group) => {
    const metrics = researchCandidateMetrics(corpus, group.entries);
    const common = researchRankedMetrics(metrics).filter((metric) => metric.category !== "qualification").slice(0, 6);
    const distinctive = researchDistinctiveMetric(metrics);
    const card = vizElement("article", "research-profile-card");
    const open = vizElement("button", "research-profile-open");
    open.type = "button";
    open.append(
      vizElement("strong", "", group.label),
      vizElement("span", "", `${group.entries.length} ${group.entries.length === 1 ? "description" : "descriptions"} →`),
    );
    open.addEventListener("click", () => {
      researchState.analysisGroup = group.label;
      redraw();
      content.scrollIntoView({ block: "start" });
    });
    const skills = vizElement("div", "research-profile-skills");
    common.forEach((metric) => skills.append(researchProfileChip(metric)));
    card.append(open, skills);
    if (distinctive) card.append(vizElement("p", "research-distinctive", `${researchLiftLabel(distinctive)}: ${distinctive.label}`));
    if (!common.length) card.append(vizElement("p", "viz-note", "Not enough repeated skill language yet."));
    grid.append(card);
  });
  content.append(intro, grid);
  if (groups.length > 12) content.append(vizElement("p", "viz-note", `Showing the 12 largest groups. Use Focus to inspect any of the ${groups.length} groups with matching description evidence.`));
}

function researchProfileChip(metric) {
  const chip = vizElement("span", `research-profile-chip signal-${metric.category}`);
  chip.append(vizElement("span", "", metric.label), vizElement("strong", "", vizPercent(metric.jobCount, metric.groupSize)));
  return chip;
}

function researchDistinctiveMetric(metrics) {
  const minimumJobs = metrics[0]?.groupSize >= 5 ? 2 : 1;
  return metrics.filter((metric) => metric.source === "recognized" && metric.jobCount >= minimumJobs && metric.coverage >= 0.2 && metric.lift >= 1.5)
    .sort((a, b) => b.lift * b.coverage - a.lift * a.coverage || b.jobCount - a.jobCount)[0] || null;
}

function researchLiftLabel(metric) {
  if (!metric.lift || metric.lift < 1.5) return "Shared signal";
  if (metric.restCoverage === 0) return "Unique in this sample";
  return `${Number(metric.lift.toFixed(1))}× more common here`;
}

function researchFocusedProfile(content, group, corpus, showJobs, redraw) {
  const metrics = researchCandidateMetrics(corpus, group.entries);
  const recognized = researchRankedMetrics(metrics);
  const discovered = researchDistinctPhrases(researchRankedMetrics(metrics, "discovered")
    .filter((metric) => metric.coverage >= Math.min(0.34, 2 / Math.max(metric.groupSize, 1))));
  const heading = vizElement("div", "research-focused-heading");
  const back = vizElement("button", "research-back", `← Compare ${researchState.analysisDimension === "role" ? "roles" : "industries"}`);
  back.type = "button";
  back.addEventListener("click", () => {
    researchState.analysisGroup = "";
    redraw();
  });
  const title = vizElement("div");
  title.append(vizElement("span", "research-brief-label", `${researchState.analysisDimension.toUpperCase()} PROFILE`), vizElement("h3", "", group.label),
    vizElement("p", "", researchProfileSummary(group, recognized)));
  const copy = vizElement("button", "research-copy", "Copy profile");
  copy.type = "button";
  copy.addEventListener("click", () => researchCopyProfile(group, recognized, discovered));
  heading.append(back, title, copy);

  const categories = vizElement("div", "research-skill-columns");
  [
    ["technology", "Tools & platforms"],
    ["domain", "Methods & domain knowledge"],
    ["capability", "Ways of working"],
    ["qualification", "Credentials & conditions"],
  ].forEach(([category, label]) => {
    const column = vizElement("section", "research-skill-column");
    column.append(vizElement("h4", "", label));
    const matching = recognized.filter((metric) => metric.category === category).slice(0, 9);
    matching.forEach((metric) => column.append(researchMetricButton(metric, () => renderEvidence(metric))));
    if (!matching.length) column.append(vizElement("p", "viz-note", "No repeated recognized signals."));
    categories.append(column);
  });

  const discoveredSection = vizElement("section", "research-discovered");
  discoveredSection.append(vizElement("h4", "", "Automatically discovered phrases"),
    vizElement("p", "", "Exact multi-word language mined from this group, including terms outside the recognized skill library."));
  const phraseList = vizElement("div", "research-discovered-list");
  discovered.forEach((metric) => phraseList.append(researchMetricButton(metric, () => renderEvidence(metric))));
  if (!discovered.length) phraseList.append(vizElement("p", "viz-note", "No multi-word phrase repeats enough to report for this sample."));
  discoveredSection.append(phraseList);

  const evidence = vizElement("section", "research-evidence");
  content.append(heading, categories, discoveredSection, evidence);
  const initial = recognized.find((metric) => ["technology", "domain"].includes(metric.category)) || recognized[0] || discovered[0];
  if (initial) renderEvidence(initial);

  function renderEvidence(metric) {
    evidence.replaceChildren();
    const evidenceHeader = vizElement("div", "research-evidence-header");
    const evidenceTitle = vizElement("div");
    evidenceTitle.append(vizElement("span", "research-brief-label", "SOURCE EVIDENCE"), vizElement("h4", "", metric.label),
      vizElement("p", "", `${metric.jobCount} of ${metric.groupSize} descriptions · ${vizPercent(metric.jobCount, metric.groupSize)} coverage${metric.lift >= 1.5 ? ` · ${researchLiftLabel(metric).toLocaleLowerCase()}` : ""}`));
    const jobsButton = vizElement("button", "research-copy", `Show ${metric.jobCount} matching ${metric.jobCount === 1 ? "job" : "jobs"}`);
    jobsButton.type = "button";
    jobsButton.addEventListener("click", () => showJobs(`${group.label} · ${metric.label}`, metric.jobs));
    evidenceHeader.append(evidenceTitle, jobsButton);
    const snippets = researchEvidenceSnippets(metric, group.entries, researchState.analysisSection);
    const list = vizElement("div", "research-evidence-list");
    snippets.forEach(({ entry, snippet }) => {
      const item = vizElement("article", "research-evidence-item");
      item.append(vizElement("strong", "", `${entry.job.company || "Unnamed company"} · ${entry.job.title || "Untitled job"}`), vizElement("blockquote", "", snippet));
      list.append(item);
    });
    if (!snippets.length) list.append(vizElement("p", "viz-note", "The phrase was counted, but no short evidence excerpt could be isolated."));
    evidence.append(evidenceHeader, list);
  }
}

function researchProfileSummary(group, recognized) {
  const top = recognized.filter((metric) => ["technology", "domain"].includes(metric.category)).slice(0, 4);
  const ways = recognized.filter((metric) => metric.category === "capability").slice(0, 2);
  const clauses = [];
  if (top.length) clauses.push(`the strongest technical and domain signals are ${researchJoin(top.map((metric) => `${metric.label} (${vizPercent(metric.jobCount, metric.groupSize)})`))}`);
  if (ways.length) clauses.push(`recurring ways of working include ${researchJoin(ways.map((metric) => metric.label))}`);
  return `${group.entries.length} classified ${group.entries.length === 1 ? "description" : "descriptions"}; ${clauses.join("; ") || "not enough repeated signals for a stable summary"}.`;
}

async function researchCopyProfile(group, recognized, discovered) {
  const lines = [
    `${group.label} — ${researchProfileSummary(group, recognized)}`,
    ...[["Tools", "technology"], ["Methods/domain", "domain"], ["Ways of working", "capability"], ["Credentials", "qualification"]]
      .map(([label, category]) => `${label}: ${recognized.filter((metric) => metric.category === category).slice(0, 8).map((metric) => `${metric.label} (${vizPercent(metric.jobCount, metric.groupSize)})`).join(", ")}`),
    `Discovered phrases: ${discovered.slice(0, 10).map((metric) => metric.label).join(", ")}`,
  ];
  try {
    await navigator.clipboard.writeText(lines.join("\n"));
    showToast("Role or industry profile copied.");
  } catch (error) {
    showToast("Copy was blocked by the browser.");
  }
}

function researchMetricButton(metric, onClick) {
  const button = vizElement("button", `research-metric signal-${metric.category}`);
  button.type = "button";
  button.append(vizElement("span", "", metric.label), vizElement("strong", "", vizPercent(metric.jobCount, metric.groupSize)));
  if (metric.lift >= 1.5) button.append(vizElement("small", "", researchLiftLabel(metric)));
  button.title = `${metric.label}: ${metric.jobCount} of ${metric.groupSize} descriptions. Select to read source evidence.`;
  button.addEventListener("click", onClick);
  return button;
}

function researchEvidenceSnippets(metric, entries, section) {
  const matchingIds = new Set(metric.jobs.map((job) => job.id));
  return entries.filter((entry) => matchingIds.has(entry.job.id)).flatMap((entry) => {
    const sections = researchDescriptionSections(entry.text);
    const units = sections[section]?.length ? sections[section] : sections.all;
    const unit = units.find((candidate) => metric.aliases.some((alias) => researchPhraseCount(researchNormalizeText(candidate), [alias])));
    if (!unit) return [];
    const clean = unit.replace(/\s+/g, " ").trim();
    const snippet = clean.length > 260 ? `${clean.slice(0, 257).replace(/\s+\S*$/, "")}…` : clean;
    return [{ entry, snippet }];
  }).slice(0, 3);
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
