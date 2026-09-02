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

async function searchCatalog(query) {
  const q = String(query || "").trim();
  if (!q) return { teams: [], leagues: [] };
  const [teams, leagues] = await Promise.all([
    apiFootball("/teams", { search: q }),
    apiFootball("/leagues", { search: q }),
  ]);
  return {
    teams: teams.slice(0, 10).map((item) => item.team).filter(Boolean),
    leagues: leagues.slice(0, 10).map((item) => item.league).filter(Boolean),
  };
}

async function matchesForSelection({ team, league, date }) {
  const from = date || new Date().toISOString().slice(0, 10);
  const to = date || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const requests = [];
  if (team) requests.push(apiFootball("/fixtures", { team, from, to, timezone: "Europe/Athens" }));
  if (league) requests.push(apiFootball("/fixtures", { league, season: new Date(from).getUTCFullYear(), from, to, timezone: "Europe/Athens" }));
  if (!requests.length) return [];
  const results = await Promise.all(requests);
  return results.flat().sort((a, b) => new Date(a.fixture?.date || 0) - new Date(b.fixture?.date || 0));
}

async function searchMatches(query, date) {
  const q = String(query || "").trim();
  if (!q) return [];
  const [teams, leagues] = await Promise.all([
    apiFootball("/teams", { search: q }),
    apiFootball("/leagues", { search: q }),
  ]);
  const teamIds = teams.slice(0, 5).map((item) => item.team?.id).filter(Boolean);
  const leagueIds = leagues.slice(0, 3).map((item) => item.league?.id).filter(Boolean);
  const from = date || new Date().toISOString().slice(0, 10);
  const to = date || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  if (!teamIds.length && !leagueIds.length) return [];
  const requests = [
    ...teamIds.map((team) => apiFootball("/fixtures", { team, from, to, timezone: "Europe/Athens" })),
    ...leagueIds.map((league) => apiFootball("/fixtures", { league, season: new Date(from).getUTCFullYear(), timezone: "Europe/Athens" })),
  ];
  const results = await Promise.all(requests);
  return results.flat().sort((a, b) => new Date(a.fixture?.date || 0) - new Date(b.fixture?.date || 0));
}

async function matchDetails(fixtureId) {
  const [fixtures, statistics, odds, predictions] = await Promise.all([
    apiFootball("/fixtures", { id: fixtureId }),
    apiFootball("/fixtures/statistics", { fixture: fixtureId }),
    apiFootball("/odds", { fixture: fixtureId }),
    apiFootball("/predictions", { fixture: fixtureId }),
  ]);
  return { fixture: fixtures[0] || null, statistics, odds, predictions: predictions[0] || null };
}

module.exports = { upcomingMatches, searchCatalog, matchesForSelection, searchMatches, matchDetails };
