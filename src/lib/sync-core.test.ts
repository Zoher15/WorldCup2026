import { test } from "node:test";
import assert from "node:assert/strict";
import {
  matchApiFixtureToLocal,
  deriveMatchUpdate,
  type LocalMatchRef,
} from "./sync-core.ts";
import { isFinalStatus, statusToOurs, type ApiFixture } from "./football-api.ts";
import { resolveApiTeam } from "./fifa.ts";

function fixture(over: Partial<ApiFixture> = {}): ApiFixture {
  return {
    fixture: {
      id: 1,
      date: "2026-06-11T19:00:00+00:00",
      status: { short: "NS", elapsed: null },
    },
    teams: {
      home: { id: 1, name: "Mexico" },
      away: { id: 2, name: "South Africa" },
    },
    goals: { home: null, away: null },
    score: { penalty: { home: null, away: null } },
    ...over,
  };
}

test("status helpers classify codes", () => {
  assert.equal(statusToOurs("NS"), "scheduled");
  assert.equal(statusToOurs("1H"), "live");
  assert.equal(statusToOurs("HT"), "live");
  assert.equal(statusToOurs("FT"), "finished");
  assert.equal(statusToOurs("PEN"), "finished");
  assert.equal(statusToOurs("PST"), "postponed");
  assert.equal(statusToOurs("CANC"), "cancelled");
  for (const s of ["FT", "AET", "PEN"]) assert.ok(isFinalStatus(s));
  for (const s of ["NS", "1H", "HT", "ET"]) assert.ok(!isFinalStatus(s));
});

test("resolveApiTeam handles API naming quirks", () => {
  assert.equal(resolveApiTeam("Korea Republic"), "KOR");
  assert.equal(resolveApiTeam("IR Iran"), "IRN");
  assert.equal(resolveApiTeam("Czech Republic"), "CZE");
  assert.equal(resolveApiTeam("USA"), "USA");
  assert.equal(resolveApiTeam("Côte d'Ivoire"), "CIV");
  assert.equal(resolveApiTeam("Curaçao"), "CUW");
  assert.equal(resolveApiTeam("Brazil"), "BRA");
  assert.equal(resolveApiTeam("Narnia"), null);
});

test("a live fixture maps to live status with score and minute", () => {
  const u = deriveMatchUpdate(
    fixture({
      fixture: { id: 1, date: "x", status: { short: "2H", elapsed: 67 } },
      goals: { home: 1, away: 1 },
    }),
    { isKnockout: false, resolveCode: resolveApiTeam },
  );
  assert.equal(u.status, "live");
  assert.equal(u.minute, 67);
  assert.equal(u.homeGoals, 1);
  assert.equal(u.resultConfirmed, false);
  assert.equal(u.advancedCode, null);
});

test("a full-time group match is confirmed with no advance", () => {
  const u = deriveMatchUpdate(
    fixture({
      fixture: { id: 1, date: "x", status: { short: "FT", elapsed: 90 } },
      goals: { home: 2, away: 0 },
    }),
    { isKnockout: false, resolveCode: resolveApiTeam },
  );
  assert.equal(u.resultConfirmed, true);
  assert.equal(u.homeGoals, 2);
  assert.equal(u.advancedCode, null);
  assert.equal(u.homeCode, "MEX");
  assert.equal(u.awayCode, "RSA");
});

test("a knockout decided on penalties advances the shootout winner", () => {
  const u = deriveMatchUpdate(
    {
      fixture: { id: 9, date: "x", status: { short: "PEN", elapsed: 120 } },
      teams: { home: { id: 1, name: "Argentina" }, away: { id: 2, name: "Brazil" } },
      goals: { home: 1, away: 1 }, // level after ET
      score: { penalty: { home: 4, away: 3 } },
    },
    { isKnockout: true, resolveCode: resolveApiTeam },
  );
  assert.equal(u.resultConfirmed, true);
  assert.equal(u.homeGoals, 1); // scoreline excludes shootout
  assert.equal(u.advancedCode, "ARG");
});

test("a knockout won in extra time advances the higher scorer", () => {
  const u = deriveMatchUpdate(
    {
      fixture: { id: 9, date: "x", status: { short: "AET", elapsed: 120 } },
      teams: { home: { id: 1, name: "France" }, away: { id: 2, name: "Spain" } },
      goals: { home: 2, away: 3 },
      score: { penalty: { home: null, away: null } },
    },
    { isKnockout: true, resolveCode: resolveApiTeam },
  );
  assert.equal(u.advancedCode, "ESP");
});

const locals: LocalMatchRef[] = [
  { id: "a", kickoffAt: "2026-06-26T18:00:00Z", homeCode: "USA", awayCode: "ENG" },
  { id: "b", kickoffAt: "2026-06-26T18:00:00Z", homeCode: "MEX", awayCode: "BRA" },
  { id: "c", kickoffAt: "2026-06-27T22:00:00Z", homeCode: "FRA", awayCode: "GER" },
];

test("fixture matching uses time, disambiguating simultaneous games by teams", () => {
  // unique by time
  assert.equal(
    matchApiFixtureToLocal(
      fixture({ fixture: { id: 1, date: "2026-06-27T22:00:00+00:00", status: { short: "NS", elapsed: null } } }),
      locals,
      resolveApiTeam,
    ),
    "c",
  );
  // two at the same time -> disambiguate by team pair
  assert.equal(
    matchApiFixtureToLocal(
      {
        fixture: { id: 2, date: "2026-06-26T18:00:00+00:00", status: { short: "NS", elapsed: null } },
        teams: { home: { id: 1, name: "Brazil" }, away: { id: 2, name: "Mexico" } },
        goals: { home: null, away: null },
        score: { penalty: { home: null, away: null } },
      },
      locals,
      resolveApiTeam,
    ),
    "b",
  );
  // nothing near in time
  assert.equal(
    matchApiFixtureToLocal(
      fixture({ fixture: { id: 3, date: "2026-07-15T18:00:00+00:00", status: { short: "NS", elapsed: null } } }),
      locals,
      resolveApiTeam,
    ),
    null,
  );
});
