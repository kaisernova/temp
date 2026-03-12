const fs = require("fs");

// Flatten nested objects into top-level keys
function flattenObject(obj, prefix = "") {
  let result = {};
  for (const key in obj) {
    const value = obj[key];
    const newKey = prefix ? `${prefix}_${key}` : key;

    if (value && typeof value === "object" && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value, newKey));
    } else if (Array.isArray(value)) {
      result[newKey] = value.map(v =>
        typeof v === "object" ? JSON.stringify(v) : v
      ).join(" | ");
    } else {
      result[newKey] = value;
    }
  }
  return result;
}

// Escape values for CSV
function escapeCsvValue(value) {
  if (value == null) return "";
  const str = String(value);
  if (str.includes(",") || str.includes("\"") || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// Convert JSON array/object to CSV string
function jsonToCsv(jsonArray) {
  if (!Array.isArray(jsonArray)) {
    jsonArray = [jsonArray];
  }
  const flatArray = jsonArray.map(obj => flattenObject(obj));
  const headers = Array.from(
    flatArray.reduce((set, obj) => {
      Object.keys(obj).forEach(k => set.add(k));
      return set;
    }, new Set())
  );
  headers.sort((a, b) => (a === "numeroRuc" ? -1 : b === "numeroRuc" ? 1 : 0));
  const rows = flatArray.map(obj =>
    headers.map(h => escapeCsvValue(obj[h])).join(",")
  );
  return [headers.join(","), ...rows].join("\n");
}

// Sleep helper
function sleep(seconds) {
  return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

// Fetch both endpoints for a given numeroRuc
async function fetchRucData(numeroRuc, authorization) {
  const baseHeaders = {
    "accept": "application/json, text/plain, */*",
    "authorization": authorization,
    "content-type": "application/json; charset=utf-8"
  };
  const urlContribuyente = `https://srienlinea.sri.gob.ec/sri-catastro-sujeto-servicio-internet/rest/ConsolidadoContribuyente/obtenerPorNumerosRuc?ruc=${numeroRuc}`;
  const urlEstablecimiento = `https://srienlinea.sri.gob.ec/sri-catastro-sujeto-servicio-internet/rest/Establecimiento/consultarPorNumeroRuc?numeroRuc=${numeroRuc}`;
  const [contribuyenteData, establecimientoData] = await Promise.all([
    fetch(urlContribuyente, { headers: baseHeaders }).then(r => r.json()),
    fetch(urlEstablecimiento, { headers: baseHeaders }).then(r => r.json())
  ]);
  return { contribuyenteData, establecimientoData };
}

// Handle multiple numeroRuc values with delay
async function fetchMultipleRucs(numeroRucList, authorization, delaySeconds = 0) {
  const allContribuyentes = [];
  const allEstablecimientos = [];

  for (const numeroRuc of numeroRucList) {
    try {
      const { contribuyenteData, establecimientoData } = await fetchRucData(numeroRuc, authorization);

      if (Array.isArray(contribuyenteData)) {
        allContribuyentes.push(...contribuyenteData);
      } else {
        allContribuyentes.push(contribuyenteData);
      }

      if (Array.isArray(establecimientoData)) {
        establecimientoData.forEach(est => {
          est.numeroRuc = numeroRuc;
          allEstablecimientos.push(est);
        });
      } else {
        establecimientoData.numeroRuc = numeroRuc;
        allEstablecimientos.push(establecimientoData);
      }

      console.log(`Fetched data for RUC ${numeroRuc}`);

      // Apply delay before next request
      if (delaySeconds > 0) {
        console.log(`Waiting ${delaySeconds} seconds before next request...`);
        await sleep(delaySeconds);
      }
    } catch (error) {
      console.error(`Error fetching data for RUC ${numeroRuc}:`, error);
    }
  }

  if (allContribuyentes.length > 0) {
    const contribuyenteCsv = jsonToCsv(allContribuyentes);
    fs.writeFileSync("contribuyentes.csv", contribuyenteCsv);
    console.log("Written contribuyentes.csv");
  }

  if (allEstablecimientos.length > 0) {
    const establecimientoCsv = jsonToCsv(allEstablecimientos);
    fs.writeFileSync("establecimientos.csv", establecimientoCsv);
    console.log("Written establecimientos.csv");
  }
}

// Example usage:
const authToken = "eyJhbGciOiJIUzI1NiJ9.eyJqdGkiOiJERUNMQVJBQ0lPTkVTIiwiaWF0IjoxNzczMzQ1OTY4LCJzdWIiOiJERUNMQVJBVE9SSUEgUFJFU0NSSVBDSU9OIEhFUkVOQ0lBIiwiZXhwIjoxNzczMzQ2NTY4fQ.djZlsCavnXGQmXNsJYpDGo1Gh65uOXPYF946Ey9xhW0";
const rucList = ["1719366757001", "1790016919001"];
fetchMultipleRucs(rucList, authToken, 5); // 5-second delay between calls






