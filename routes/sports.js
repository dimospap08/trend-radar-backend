const express = require("express");
const router = express.Router();
const { upcomingMatches, searchCatalog, matchesForSelection, matchDetails } = require("../services/footballApi-global-search");

router.get("/matches", async (req, res) => {
  try {
    const matches = req.query.team || req.query.league
      ? await matchesForSelection(req.query)
      : await upcomingMatches(req.query.date);
    res.json({ updated_at: new Date().toISOString(), matches });
  } catch (error) {
    console.error("Football matches failed:", error.message);
    res.status(502).json({ error: "Could not load live football data" });
  }
});

router.get("/search", async (req, res) => {
  try {
    const catalog = await searchCatalog(req.query.q);
    res.json({ updated_at: new Date().toISOString(), ...catalog });
  } catch (error) {
    console.error("Football catalog search failed:", error.message);
    res.status(502).json({ error: "Could not search football leagues and teams" });
  }
});

router.get("/matches/:fixtureId", async (req, res) => {
  try {
    const data = await matchDetails(req.params.fixtureId);
    res.json({ updated_at: new Date().toISOString(), ...data });
  } catch (error) {
    console.error("Football match details failed:", error.message);
    res.status(502).json({ error: "Could not load match details" });
  }
});

module.exports = router;
