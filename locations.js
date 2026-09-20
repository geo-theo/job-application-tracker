"use strict";

const LOCATION_JOB_FIELDS = [
  "locationCanonical",
  "locationCountryCode",
  "locationCountry",
  "locationRegion",
  "locationCity",
  "locationLatitude",
  "locationLongitude",
  "locationPrecision",
  "locationResolutionSource",
];

// A compact offline starter catalog. Confirmed locations saved on jobs extend
// this catalog for later jobs with the same raw location text.
const LOCATION_DATABASE = [
  ["Missoula, MT", -113.994, 46.872, "us", "Montana", "Missoula", "city", ["Missoula"]],
  ["Helena, MT", -112.037, 46.589, "us", "Montana", "Helena", "city", ["Helena"]],
  ["Bozeman, MT", -111.043, 45.677, "us", "Montana", "Bozeman", "city", ["Bozeman"]],
  ["Glendive, MT", -104.712, 47.105, "us", "Montana", "Glendive", "city", ["Glendive"]],
  ["Arlee, MT", -114.085, 47.163, "us", "Montana", "Arlee", "city", ["Arlee"]],
  ["Seattle, WA", -122.332, 47.606, "us", "Washington", "Seattle", "city", ["Seattle"]],
  ["Olympia, WA", -122.901, 47.037, "us", "Washington", "Olympia", "city", ["Olympia"]],
  ["Redlands, CA", -117.182, 34.055, "us", "California", "Redlands", "city", ["Redlands"]],
  ["San Francisco, CA", -122.419, 37.775, "us", "California", "San Francisco", "city", ["San Francisco"]],
  ["San Bruno, CA", -122.411, 37.63, "us", "California", "San Bruno", "city", ["San Bruno"]],
  ["Silicon Valley", -122.04, 37.36, "us", "California", "Silicon Valley", "metro", ["Silicon Valley, CA", "Silicon Valley area", "Silicon Valley, USA"]],
  ["Los Angeles area", -118.244, 34.052, "us", "California", "Los Angeles", "metro", ["Los Angeles", "Los Angeles, CA", "Los Angeles area, CA", "Greater Los Angeles", "LA area"]],
  ["Washington, DC", -77.037, 38.907, "us", "District of Columbia", "Washington", "city", ["Washington DC"]],
  ["DMV region", -77.15, 39, "us", "DC / Maryland / Virginia", "Washington metropolitan area", "metro", ["DMV", "DMV area"]],
  ["Reston, VA", -77.357, 38.958, "us", "Virginia", "Reston", "city", ["Reston"]],
  ["Norfolk, VA", -76.286, 36.851, "us", "Virginia", "Norfolk", "city", ["Norfolk"]],
  ["Austin, TX", -97.743, 30.267, "us", "Texas", "Austin", "city", ["Austin"]],
  ["Houston, TX", -95.37, 29.76, "us", "Texas", "Houston", "city", ["Houston"]],
  ["Chicago, IL", -87.63, 41.878, "us", "Illinois", "Chicago", "city", ["Chicago"]],
  ["Rosemont, IL", -87.872, 41.995, "us", "Illinois", "Rosemont", "city", ["Rosemont"]],
  ["St Louis, MO", -90.199, 38.627, "us", "Missouri", "St Louis", "city", ["St. Louis", "St. Louis, MO"]],
  ["Kansas City, MO", -94.579, 39.1, "us", "Missouri", "Kansas City", "city", ["Kansas City"]],
  ["Denver, CO", -104.99, 39.739, "us", "Colorado", "Denver", "city", ["Denver"]],
  ["Colorado Springs, CO", -104.821, 38.834, "us", "Colorado", "Colorado Springs", "city", ["Colorado Springs"]],
  ["Phoenix, AZ", -112.074, 33.448, "us", "Arizona", "Phoenix", "city", ["Phoenix"]],
  ["Minneapolis, MN", -93.265, 44.978, "us", "Minnesota", "Minneapolis", "city", ["Minneapolis"]],
  ["Sioux Falls, SD", -96.732, 43.545, "us", "South Dakota", "Sioux Falls", "city", ["Sioux Falls"]],
  ["Anchorage, AK", -149.9, 61.218, "us", "Alaska", "Anchorage", "city", ["Anchorage"]],
  ["Atlanta, GA", -84.388, 33.749, "us", "Georgia", "Atlanta", "city", ["Atlanta"]],
  ["New York, NY", -74.006, 40.713, "us", "New York", "New York", "city", ["New York", "New York City", "NYC"]],
  ["Boston, MA", -71.059, 42.36, "us", "Massachusetts", "Boston", "city", ["Boston"]],
  ["Burlington, VT", -73.212, 44.476, "us", "Vermont", "Burlington", "city", ["Burlington"]],
  ["Annecy, France", 6.129, 45.899, "fr", "Auvergne-Rhône-Alpes", "Annecy", "city", ["Annecy"]],
  ["Nanterre, France", 2.207, 48.892, "fr", "Île-de-France", "Nanterre", "city", ["Nanterre", "Nanterre, Île-de-France, France"]],
  ["Rueil, France", 2.181, 48.877, "fr", "Île-de-France", "Rueil-Malmaison", "city", ["Rueil-Malmaison, France", "Rueil-Malmaison"]],
  ["Vélizy-Villacoublay, France", 2.19, 48.782, "fr", "Île-de-France", "Vélizy-Villacoublay", "city", ["Vélizy-Villacoublay, Yvelines, France", "Vélizy-Villacoublay"]],
  ["Paris area", 2.352, 48.857, "fr", "Île-de-France", "Paris", "metro", ["Paris", "Paris, France", "Paris area, France", "Greater Paris"]],
  ["Cardiff, UK", -3.18, 51.481, "gb", "Wales", "Cardiff", "city", ["Cardiff", "Cardiff, United Kingdom"]],
  ["London area", -0.128, 51.507, "gb", "England", "London", "metro", ["London", "London, UK", "London area, UK", "London, United Kingdom", "Greater London"]],
  ["Amsterdam area", 4.904, 52.368, "nl", "North Holland", "Amsterdam", "metro", ["Amsterdam", "Amsterdam, Netherlands", "Amsterdam area, Netherlands", "Amsterdam, The Netherlands"]],
].map(([label, lon, lat, countryCode, region, city, precision, aliases]) => ({
  label,
  lon,
  lat,
  countryCode,
  country: locationCountryLabel(countryCode),
  region,
  city,
  precision,
  aliases: [label, ...aliases],
}));

function normalizeLocationText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/,\s*/g, ", ")
    .replace(/\s+/g, " ")
    .trim();
}

function locationCountryLabel(code) {
  if (code === "us") return "United States";
  if (code === "gb") return "United Kingdom";
  return VIZ_COUNTRIES?.[code]?.label || "";
}

function rawJobLocation(job) {
  return String(
    job.location ||
      (job.locationChoice === "Other" ? job.locationOther : job.locationChoice) ||
      "",
  ).trim();
}

function locationCoordinate(value) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function locationCountryCode(raw) {
  const local = findLocalLocation(raw);
  if (local) return local.countryCode;
  const pieces = String(raw || "").split(",");
  const suffix = normalizeLocationText(pieces.at(-1));
  if (["usa", "us", "united states", "united states of america"].includes(suffix)) return "us";
  if (["uk", "gb", "united kingdom", "england", "scotland", "wales", "northern ireland"].includes(suffix)) return "gb";
  if (suffix === "the netherlands") return "nl";
  if (pieces.length > 1 && /^(AL|AK|AZ|AR|CA|CO|CT|DE|DC|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)$/i.test(pieces.at(-1).trim())) return "us";
  return Object.entries(VIZ_COUNTRIES || {}).find(([, country]) =>
    country.aliases.some((alias) => normalizeLocationText(alias) === suffix),
  )?.[0] || "unmapped";
}

function findLocalLocation(raw) {
  const normalized = normalizeLocationText(raw);
  if (!normalized) return null;
  const pieces = String(raw).split(",");
  const suffix = normalizeLocationText(pieces.at(-1));
  const hasCountrySuffix = Object.values(VIZ_COUNTRIES || {}).some((country) =>
    country.aliases.some((alias) => normalizeLocationText(alias) === suffix),
  );
  const variants = new Set([normalized]);
  if (hasCountrySuffix && pieces.length > 1) variants.add(normalizeLocationText(pieces.slice(0, -1).join(",")));
  return LOCATION_DATABASE.find((place) =>
    place.aliases.some((alias) => variants.has(normalizeLocationText(alias))),
  ) || null;
}

function locationFieldsFromPlace(place, source = "known") {
  return {
    locationCanonical: place.label || place.locationCanonical || "",
    locationCountryCode: place.countryCode || place.locationCountryCode || "",
    locationCountry: place.country || place.locationCountry || locationCountryLabel(place.countryCode || place.locationCountryCode),
    locationRegion: place.region || place.locationRegion || "",
    locationCity: place.city || place.locationCity || "",
    locationLatitude: place.lat ?? place.locationLatitude ?? "",
    locationLongitude: place.lon ?? place.locationLongitude ?? "",
    locationPrecision: place.precision || place.locationPrecision || "unknown",
    locationResolutionSource: source,
  };
}

function blankLocationFields() {
  return Object.fromEntries(LOCATION_JOB_FIELDS.map((field) => [field, ""]));
}

function savedJobLocation(job) {
  if (!job.locationResolutionSource && !job.locationPrecision && !job.locationCanonical) return null;
  const lat = locationCoordinate(job.locationLatitude);
  const lon = locationCoordinate(job.locationLongitude);
  const precision = job.locationPrecision || "unknown";
  const countryCode = job.locationCountryCode || locationCountryCode(job.locationCountry || rawJobLocation(job));
  return {
    label: job.locationCanonical || rawJobLocation(job) || "Location not recorded",
    lat,
    lon,
    countryCode,
    country: job.locationCountry || locationCountryLabel(countryCode),
    region: job.locationRegion || "",
    city: job.locationCity || "",
    precision,
    source: job.locationResolutionSource || "manual",
    reviewed: Boolean(job.locationResolutionSource),
  };
}

function reusableJobLocation(raw, records = []) {
  const key = normalizeLocationText(raw);
  if (!key) return null;
  const match = records.find((record) =>
    record.locationResolutionSource && normalizeLocationText(rawJobLocation(record)) === key,
  );
  return match ? savedJobLocation(match) : null;
}

function resolveJobLocation(job, records = []) {
  const raw = rawJobLocation(job);
  if (!raw) return { label: "Location not recorded", raw: "", kind: "missing", countryCode: "missing", country: "", precision: "unknown", source: "", reviewed: true };
  if (/^remote(?:$|[\s,(/-])/i.test(raw)) return { label: "Remote", raw, kind: "remote", countryCode: "remote", country: "", precision: "remote", source: "manual", reviewed: true };

  const saved = savedJobLocation(job) || reusableJobLocation(raw, records);
  const local = findLocalLocation(raw);
  const resolved = saved || (local ? { ...local, source: "known", reviewed: true } : null);
  if (resolved) {
    const lat = locationCoordinate(resolved.lat);
    const lon = locationCoordinate(resolved.lon);
    const precision = resolved.precision || "unknown";
    return {
      ...resolved,
      raw,
      lat,
      lon,
      countryCode: resolved.countryCode || locationCountryCode(raw),
      kind: lat !== null && lon !== null && !["unknown", "country"].includes(precision) ? "mapped" : "unmapped",
    };
  }

  const countryCode = locationCountryCode(raw);
  return {
    label: raw,
    raw,
    lat: null,
    lon: null,
    countryCode,
    country: locationCountryLabel(countryCode),
    region: "",
    city: "",
    precision: "unknown",
    source: "",
    reviewed: false,
    kind: "unmapped",
  };
}

function canonicalLocationFieldsForJob(raw, existing, records = []) {
  if (!raw) return blankLocationFields();
  if (/^remote(?:$|[\s,(/-])/i.test(raw)) {
    return locationFieldsFromPlace({ label: "Remote", precision: "remote" }, "manual");
  }
  if (existing && normalizeLocationText(rawJobLocation(existing)) === normalizeLocationText(raw)) {
    const saved = savedJobLocation(existing);
    if (saved) return locationFieldsFromPlace(saved, saved.source);
  }
  const reusable = reusableJobLocation(raw, records);
  if (reusable) return locationFieldsFromPlace(reusable, reusable.source);
  const local = findLocalLocation(raw);
  return local ? locationFieldsFromPlace(local, "known") : blankLocationFields();
}
