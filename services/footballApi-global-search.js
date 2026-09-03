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

async function fallbackMatchesForDays(date, days) {
  const range = dateRange(date, days);
  const events = [];
  for (let offset = 0; offset < range.span; offset += 1) {
    const day = new Date(`${range.from}T00:00:00Z`);
    day.setUTCDate(day.getUTCDate() + offset);
    const dayValue = day.toISOString().slice(0, 10);
    const response = await fetch(`https://www.thesportsdb.com/api/v1/json/3/eventsday.php?d=${dayValue}&s=Soccer`);
    if (!response.ok) continue;
    const data = await response.json();
    (Array.isArray(data?.events) ? data.events : []).forEach((event) => {
      events.push({
        fixture: { id: `tsdb-${event.idEvent}`, date: event.strTimestamp || `${event.dateEvent}T${event.strTime || "00:00:00"}Z`, status: { short: event.strStatus || "NS" } },
        league: { name: event.strLeague || "Football", country: event.strCountry || "Worldwide", logo: event.strLeagueBadge || null },
        teams: {
          home: { id: event.idHomeTeam, name: event.strHomeTeam || "Home", logo: event.strHomeTeamBadge || null },
          away: { id: event.idAwayTeam, name: event.strAwayTeam || "Away", logo: event.strAwayTeamBadge || null },
        },
        goals: { home: event.intHomeScore ?? null, away: event.intAwayScore ?? null },
        _provider: "TheSportsDB fallback",
      });
    });
  }
  return events.sort((a, b) => new Date(a.fixture.date) - new Date(b.fixture.date));
}

function dateRange(date, days) {
  const from = date || new Date().toISOString().slice(0, 10);
  const span = Math.min(7, Math.max(1, Number(days) || 1));
  const end = new Date(`${from}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + span - 1);
  return { from, to: end.toISOString().slice(0, 10), span };
}

async function matchesForDays(date, days) {
  const range = dateRange(date, days);
  try {
    if (range.span === 1) return await upcomingMatches(range.from);
  // Free API-Football plans reject date queries beyond their small rolling
  // window. `next` is the provider-supported way to request future fixtures.
    const fixtures = await apiFootball("/fixtures", { next: 100, timezone: "Europe/Athens" });
    const end = new Date(`${range.to}T23:59:59Z`).getTime();
    return fixtures
      .filter((fixture) => {
        const time = new Date(fixture.fixture?.date || 0).getTime();
        return Number.isFinite(time) && time <= end;
      })
      .sort((a, b) => new Date(a.fixture?.date || 0) - new Date(b.fixture?.date || 0));
  } catch (error) {
    console.warn("Using TheSportsDB football fallback:", error.message);
    return fallbackMatchesForDays(date, range.span);
  }
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

async function matchesForSelection({ team, league, date, days }) {
  const { from, to } = dateRange(date, days || 7);
  const requests = [];
  if (team) requests.push(apiFootball("/fixtures", { team, from, to, timezone: "Europe/Athens" }));
  if (league) requests.push(apiFootball("/fixtures", { league, season: new Date(from).getUTCFullYear(), from, to, timezone: "Europe/Athens" }));
  if (!requests.length) return [];
  const results = await Promise.all(requests);
  return results.flat().sort((a, b) => new Date(a.fixture?.date || 0) - new Date(b.fixture?.date || 0));
}

async function searchMatches(query, date, days) {
  const q = String(query || "").trim();
  if (!q) return [];
  const [teams, leagues] = await Promise.all([
    apiFootball("/teams", { search: q }),
    apiFootball("/leagues", { search: q }),
  ]);
  // Search results are supplied by API-Football worldwide. Keep several
  // matches for broad names, rather than reducing the dashboard to a handful
  // of famous clubs.
  const teamIds = teams.map((item) => item.team?.id).filter(Boolean).slice(0, 20);
  const leagueIds = leagues.map((item) => item.league?.id).filter(Boolean).slice(0, 10);
  const { from, to } = dateRange(date, days || 7);
  if (!teamIds.length && !leagueIds.length) return [];
  const requests = [
    ...teamIds.map((team) => apiFootball("/fixtures", { team, from, to, timezone: "Europe/Athens" })),
    ...leagueIds.map((league) => apiFootball("/fixtures", { league, season: new Date(from).getUTCFullYear(), timezone: "Europe/Athens" })),
  ];
  const results = await Promise.all(requests);
  const unique = new Map();
  results.flat().forEach((fixture) => {
    if (fixture?.fixture?.id != null) unique.set(String(fixture.fixture.id), fixture);
  });
  return Array.from(unique.values()).sort((a, b) => new Date(a.fixture?.date || 0) - new Date(b.fixture?.date || 0));
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

module.exports = { upcomingMatches, matchesForDays, searchCatalog, matchesForSelection, searchMatches, matchDetails };
