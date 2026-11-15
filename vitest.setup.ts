import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach } from "vitest";

import { deviceClock, setGameClock } from "~/ui/game-clock";

// The game's clock asks the site's server for the time (app/ui/game-clock.ts). There is no
// server in the tests: they run on the device's clock, which fake timers can move.
beforeEach(() => {
  setGameClock(deviceClock());
});

afterEach(() => {
  cleanup();
});
