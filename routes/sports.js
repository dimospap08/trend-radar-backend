const express = require("express");
const router = express.Router();
const { upcomingMatches, matchDetails } = require("../services/footballApi");

router.get("/matches", async (req, res) => {
  try {
    const matches = await upcomingMatches(req.query.date);
    res.json({ updated_at: new Date().toISOString(), matches });
  } catch (error) {
    console.error("Football matches failed:", error.message);
    res.status(502).json({ error: "Could not load live football data" });
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
