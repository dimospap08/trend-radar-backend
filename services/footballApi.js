const BASE_URL = "https://v3.football.api-sports.io";

function headers() {
  if (!process.env.API_FOOTBALL_KEY) throw new Error("API_FOOTBALL_KEY is not configured");
  return { "x-apisports-key": process.env.API_FOOTBALL_KEY };
}

async function apiFootball(path, params = {}) {
  const url = new URL(`${BASE_URL}${path}`);
  Object.entries(params).forEach(([key, value]) => { if (value !== undefined && value !== "") url.searchParams.set(key, value); });
  const response = await fetch(url, { headers: headers() });
  if (!response.ok) throw new Error(`Football API returned ${response.status}`);
  const data = await response.json();
  if (data.errors && Object.keys(data.errors).length) throw new Error(JSON.stringify(data.errors));
  return data.response || [];
}

async function upcomingMatches(date) {
  return apiFootball("/fixtures", { date: date || new Date().toISOString().slice(0, 10), timezone: "Europe/Athens" });
}

async function matchDetails(fixtureId) {
  const [fixtures, statistics, odds] = await Promise.all([
    apiFootball("/fixtures", { id: fixtureId }),
    apiFootball("/fixtures/statistics", { fixture: fixtureId }),
    apiFootball("/odds", { fixture: fixtureId }),
  ]);
  return { fixture: fixtures[0] || null, statistics, odds };
}

module.exports = { upcomingMatches, matchDetails };
