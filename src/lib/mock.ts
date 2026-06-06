import type { Standings } from "@/lib/standings";

/** Sample leaderboard for the home-page visual demo (real data comes from the DB). */
export const DEMO_LEADERBOARD: Standings = {
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
