import type { MatchCardData } from "@/components/MatchCard";
import type { LeaderboardData } from "@/components/Leaderboard";

/** Sample matches for the visual demo only (real data comes from the DB). */
export const DEMO_MATCHES: MatchCardData[] = [
  {
    homeCode: "ARG",
    awayCode: "BRA",
    kickoffAt: "2026-06-20T19:00:00Z",
    venue: "MetLife Stadium",
    status: "live",
    minute: 67,
    homeGoals: 1,
    awayGoals: 1,
  },
  {
    homeCode: "FRA",
    awayCode: "ENG",
    kickoffAt: "2026-06-21T16:00:00Z",
    venue: "SoFi Stadium",
    status: "scheduled",
  },
  {
    homeCode: "USA",
    awayCode: "MEX",
    kickoffAt: "2026-06-19T23:00:00Z",
    venue: "Estadio Azteca",
    status: "finished",
    homeGoals: 2,
    awayGoals: 2,
  },
  {
    homeCode: null,
    awayCode: null,
    homeLabel: "Winner Group A",
    awayLabel: "Runner-up Group B",
    kickoffAt: "2026-07-04T20:00:00Z",
    venue: "AT&T Stadium",
    status: "scheduled",
  },
];

export const DEMO_LEADERBOARD: LeaderboardData = {
  overall: [
    { displayName: "GoalMachine", points: 142, movement: 1 },
    { displayName: "Dad", points: 138, movement: -1 },
    { displayName: "Auntie Sam", points: 131, movement: 2 },
    { displayName: "ElPibe10", points: 119, movement: 0 },
    { displayName: "Grandpa Joe", points: 112, movement: 1 },
    { displayName: "Nina", points: 104, movement: -2 },
    { displayName: "CousinT", points: 97, movement: 0 },
  ],
  win: [
    { displayName: "Auntie Sam", points: 84, movement: 1 },
    { displayName: "GoalMachine", points: 78, movement: 0 },
    { displayName: "Grandpa Joe", points: 72, movement: 2 },
    { displayName: "Dad", points: 66, movement: -2 },
    { displayName: "Nina", points: 60, movement: 0 },
  ],
  scoreline: [
    { displayName: "Dad", points: 72, movement: 2 },
    { displayName: "GoalMachine", points: 64, movement: -1 },
    { displayName: "ElPibe10", points: 61, movement: 1 },
    { displayName: "CousinT", points: 55, movement: 0 },
    { displayName: "Auntie Sam", points: 47, movement: -1 },
  ],
};
