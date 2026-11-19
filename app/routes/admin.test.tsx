/**
 * The approval desk (app/routes/admin.tsx) against a stand-in for the admin API: signing
 * in with the token, the week's table, looking at a day's questions, approving, rejecting
 * and correcting them; and its Players tab (./admin-players.tsx): finding a player, a new
 * name, off the leaderboards and back, deleting an account.
 */
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { CLOSEST_QUESTIONS, HOME_QUESTIONS } from "~/data";
import { PLACES, type Place, placeLabel } from "~/data/places";
import { STADIUMS } from "~/data/stadiums";
import { distanceKm, stadiumForDay } from "~/game";
import { strings } from "~/i18n";

import Admin from "./admin";

const text = strings.admin;
const TOKEN = "the-admin-token-for-these-tests-0123456789";

interface Call {
  url: string;
  method: string;
  token: string | null;
  body: unknown;
}

/** A player with an account, as the moderation API sends one. */
interface Player {
  id: string;
  nickname: string;
  email: string;
  createdAt: number;
  bannedAt: number | null;
  note: string;
  games: number;
  lastDay: number | null;
}

/**
 * The desk's API, in memory: day 8 has HOME's seven sample questions as drafts (and
 * CLOSEST's, if asked), and two players have accounts.
 */
function server(
  options: {
    accept?: boolean;
    shut?: boolean;
    closest?: boolean;
    /** Day 8's place, drafted or approved. */
    place?: { place: Place; status: string };
  } = {},
) {
  const calls: Call[] = [];
  const players: Player[] = [
    {
      id: "a1",
      nickname: "Row Z Rita",
      email: "rita@example.com",
      createdAt: Date.UTC(2026, 10, 17),
      bannedAt: null,
      note: "",
      games: 3,
      lastDay: 8,
    },
    {
      id: "b2",
      nickname: "soccerfan2",
      email: "two@example.com",
      createdAt: Date.UTC(2026, 10, 16),
      bannedAt: null,
      note: "",
      games: 0,
      lastDay: null,
    },
  ];
  const slots = HOME_QUESTIONS.map((question, slot) => ({
    day: 8,
    mode: "home",
    slot,
    status: "draft",
    question,
    note: slot === 0 ? "From the league's own records." : "",
    review: "",
    source: "ai",
    updatedAt: 1000,
  }));
  const places = options.place
    ? [
        {
          day: 8,
          status: options.place.status,
          place: options.place.place,
          note: "The ground's own site.",
          review: "",
          source: "ai",
          updatedAt: 1000,
        },
      ]
    : [];
  if (options.closest) {
    CLOSEST_QUESTIONS.forEach((question, slot) =>
      slots.push({
        day: 8,
        mode: "closest",
        slot,
        status: "draft",
        question,
        note: "",
        review: "",
        source: "ai",
        updatedAt: 1000,
      }),
    );
  }
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status });
  const fetcher = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const headers = new Headers(init?.headers);
      const auth = headers.get("authorization");
      const body = init?.body
        ? (JSON.parse(String(init.body)) as unknown)
        : null;
      calls.push({
        url,
        method: init?.method ?? "GET",
        token: auth ? auth.replace(/^Bearer /, "") : null,
        body,
      });
      if (url === "/api/today") return json({ day: 8 });
      if (options.shut) return json({ error: "admin_not_set_up" }, 503);
      if (options.accept === false) return json({ error: "unauthorized" }, 401);
      if (url.startsWith("/api/admin/questions?")) {
        return json({ slots, places });
      }
      const placeOf = /^\/api\/admin\/places\/(\d+)$/.exec(url);
      if (placeOf) {
        const day = places.find((p) => p.day === Number(placeOf[1]));
        if (!day) return json({ error: "not_found" }, 404);
        const sent = body as { status?: string; review?: string };
        if (sent.status) {
          day.status = sent.status;
          day.review = sent.review ?? "";
        }
        day.updatedAt += 1;
        return json({ place: day });
      }
      const one = /^\/api\/admin\/questions\/(\d+)\/home\/(\d)$/.exec(url);
      if (one) {
        const slot = slots[Number(one[2])];
        const sent = body as {
          status?: string;
          review?: string;
          question?: unknown;
        };
        if (sent.question !== undefined) {
          const q = sent.question as { prompt?: string };
          if (!q.prompt?.startsWith("Name ")) {
            return json(
              {
                error: "unfit",
                problems: ['the prompt must start "Name a ..."'],
              },
              422,
            );
          }
          slot.question = sent.question as (typeof slots)[number]["question"];
          slot.status = "draft";
        }
        if (sent.status) {
          slot.status = sent.status;
          slot.review = sent.review ?? "";
        }
        slot.updatedAt += 1;
        return json({ slot });
      }
      if (url.startsWith("/api/admin/players?q=")) {
        const q = decodeURIComponent(url.slice(21)).toLowerCase();
        return json({
          players: players.filter(
            (p) => p.nickname.toLowerCase().includes(q) || p.email.includes(q),
          ),
        });
      }
      const who = /^\/api\/admin\/players\/(\w+)$/.exec(url);
      if (who) {
        const at = players.findIndex((p) => p.id === who[1]);
        const sent = body as { action: string; note?: string };
        if (sent.action === "delete") {
          players.splice(at, 1);
          return json({ player: null });
        }
        const player = players[at];
        if (sent.action === "rename") player.nickname = "soccerfan99";
        if (sent.action === "ban") {
          player.bannedAt = Date.UTC(2026, 10, 18);
          player.note = sent.note ?? "";
        }
        if (sent.action === "unban") {
          player.bannedAt = null;
          player.note = "";
        }
        return json({ player: { ...player } });
      }
      return json({ error: "not_found" }, 404);
    },
  );
  vi.stubGlobal("fetch", fetcher);
  return { calls, slots, players, places };
}

async function signIn(): Promise<void> {
  fireEvent.change(screen.getByLabelText(text.tokenLabel), {
    target: { value: TOKEN },
  });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: text.signIn }));
  });
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  // the token is module state too: leave the desk as each test found it
  const out = screen.queryByRole("button", { name: text.signOut });
  if (out) fireEvent.click(out);
  vi.unstubAllGlobals();
});

describe("the approval desk", () => {
  test("asks for the token first, and asks the server nothing until it has one", () => {
    const { calls } = server();
    render(<Admin />);
    expect(
      screen.getByRole("heading", { name: text.title }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(text.tokenLabel)).toHaveAttribute(
      "type",
      "password",
    );
    expect(calls).toEqual([]);
  });

  test("with the token: the week from today, every request carrying it", async () => {
    const { calls } = server();
    render(<Admin />);
    await signIn();
    await waitFor(() =>
      expect(screen.getByText(text.counts(0, 7, 0))).toBeInTheDocument(),
    );
    expect(calls.map((c) => c.url)).toEqual([
      "/api/today",
      "/api/admin/questions?from=8&to=14",
    ]);
    expect(calls[1].token).toBe(TOKEN);
    // kept for next time, in this browser only
    expect(window.localStorage.getItem("soccersense:admin-token")).toBe(TOKEN);
    // seven days, today marked, the other modes with nothing drafted
    expect(screen.getAllByRole("row")).toHaveLength(8);
    expect(screen.getByText(/2026-11-17 \(day 8\), today/)).toBeInTheDocument();
    expect(screen.getAllByText(text.nothing).length).toBeGreaterThan(20);
  });

  test("a day's questions can be looked at, approved one by one or all at once", async () => {
    const { calls, slots } = server();
    render(<Admin />);
    await signIn();
    await waitFor(() => screen.getByText(text.counts(0, 7, 0)));
    fireEvent.click(screen.getByText(text.counts(0, 7, 0)));

    const first = screen
      .getByText(new RegExp(HOME_QUESTIONS[0].prompt))
      .closest("article") as HTMLElement;
    expect(within(first).getByText(text.status.draft)).toBeInTheDocument();
    expect(
      within(first).getByText(/From the league's own records/),
    ).toBeInTheDocument();

    // its answers, when asked for
    fireEvent.click(within(first).getByRole("button", { name: text.show }));
    expect(
      within(first).getByText(HOME_QUESTIONS[0].answers[0].name),
    ).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(
        within(first).getByRole("button", { name: text.approve }),
      );
    });
    expect(calls.at(-1)).toMatchObject({
      url: "/api/admin/questions/8/home/0",
      method: "POST",
      token: TOKEN,
      body: { status: "approved" },
    });
    await waitFor(() =>
      expect(screen.getByText(text.counts(1, 6, 0))).toBeInTheDocument(),
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: text.approveAll }));
    });
    await waitFor(() =>
      expect(slots.every((s) => s.status === "approved")).toBe(true),
    );
    // all seven approved: the day and mode is scheduled
    await waitFor(() =>
      expect(screen.getByText(text.scheduled)).toBeInTheDocument(),
    );
  });

  // the product owner, 2026-11-19: CLOSEST and FURTHEST drafted daily like the rest
  test("CLOSEST and FURTHEST are shown from the day's place: each answer's distance and its shot that day", async () => {
    // day 8's place, drafted for it and approved: not the fixed list's
    const place = PLACES.find((p) => p.id === "lagos") as Place;
    server({ closest: true, place: { place, status: "approved" } });
    render(<Admin />);
    await signIn();
    await waitFor(() => screen.getAllByText(text.counts(0, 7, 0)));
    // HOME's day 8, then CLOSEST's, in the menu's order of modes
    fireEvent.click(screen.getAllByText(text.counts(0, 7, 0))[1]);
    const question = CLOSEST_QUESTIONS[0];
    const card = screen
      .getByText(new RegExp(question.prompt))
      .closest("article") as HTMLElement;
    expect(
      within(card).getByText(text.fromPlace(placeLabel(place))),
    ).toBeInTheDocument();
    fireEvent.click(within(card).getByRole("button", { name: text.show }));
    expect(within(card).getByText(text.columns.distance)).toBeInTheDocument();
    // nearest first: a worldie, with its kilometres
    const nearest = [...question.answers].sort(
      (a, b) => distanceKm(place, a) - distanceKm(place, b),
    )[0];
    const first = within(card).getAllByRole("row")[1];
    expect(within(first).getByText(nearest.name)).toBeInTheDocument();
    expect(
      within(first).getByText(text.km(Math.round(distanceKm(place, nearest)))),
    ).toBeInTheDocument();
    expect(
      within(first).getByText(strings.play.shots.worldie),
    ).toBeInTheDocument();
  });

  // the product owner, 2026-11-19: "i dont want fixed places ... it should also be generated"
  test("the day's place: in its column, looked at, approved; with none, the fixed list's is said", async () => {
    const lagos = PLACES.find((p) => p.id === "lagos") as Place;
    const { calls, places } = server({
      closest: true,
      place: { place: lagos, status: "draft" },
    });
    render(<Admin />);
    await signIn();
    // its column: the place and its state
    const cell = await screen.findByRole("button", {
      name: new RegExp(`^${placeLabel(lagos)}`),
    });
    expect(within(cell).getByText(text.status.draft)).toBeInTheDocument();

    // a CLOSEST question before its place is approved says so
    fireEvent.click(screen.getAllByText(text.counts(0, 7, 0))[1]);
    const question = screen
      .getByText(new RegExp(CLOSEST_QUESTIONS[0].prompt))
      .closest("article") as HTMLElement;
    expect(
      within(question).getByText(text.fromDraftPlace(placeLabel(lagos))),
    ).toBeInTheDocument();

    // the place itself: where it is, a map, approve
    fireEvent.click(cell);
    const card = screen
      .getByRole("heading", { name: placeLabel(lagos) })
      .closest("article") as HTMLElement;
    expect(within(card).getByText(/The ground's own site/)).toBeInTheDocument();
    expect(
      within(card).getByRole("link", { name: text.places.onMap }),
    ).toHaveAttribute("href", expect.stringContaining(`mlat=${lagos.lat}`));
    await act(async () => {
      fireEvent.click(within(card).getByRole("button", { name: text.approve }));
    });
    expect(calls.find((c) => c.url === "/api/admin/places/8")).toMatchObject({
      method: "POST",
      token: TOKEN,
      body: { status: "approved" },
    });
    expect(places[0].status).toBe("approved");
    // the week is looked at again: the day's CLOSEST and FURTHEST may have gone back to draft
    await waitFor(() =>
      expect(
        calls.filter((c) => c.url.startsWith("/api/admin/questions?")).length,
      ).toBe(2),
    );
  });

  test("a day with no place drafted says the fixed list's is played until one is approved", async () => {
    server();
    render(<Admin />);
    await signIn();
    await waitFor(() => screen.getByText(text.counts(0, 7, 0)));
    // the place column of day 8: nothing drafted
    const row = screen
      .getByText(/\(day 8\), today/)
      .closest("tr") as HTMLElement;
    fireEvent.click(within(row).getAllByText(text.nothing)[0]);
    expect(
      screen.getByText(
        text.places.none(placeLabel(stadiumForDay(8, STADIUMS) as Place)),
      ),
    ).toBeInTheDocument();
  });

  test("a question is rejected with its reason", async () => {
    const { calls } = server();
    render(<Admin />);
    await signIn();
    await waitFor(() => screen.getByText(text.counts(0, 7, 0)));
    fireEvent.click(screen.getByText(text.counts(0, 7, 0)));
    const second = screen
      .getByText(new RegExp(HOME_QUESTIONS[1].prompt))
      .closest("article") as HTMLElement;
    fireEvent.change(within(second).getByLabelText(text.reason), {
      target: { value: "  Two winners are missing  " },
    });
    await act(async () => {
      fireEvent.click(
        within(second).getByRole("button", { name: text.reject }),
      );
    });
    expect(calls.at(-1)?.body).toEqual({
      status: "rejected",
      review: "Two winners are missing",
    });
    await waitFor(() =>
      expect(screen.getByText(text.counts(0, 6, 1))).toBeInTheDocument(),
    );
  });

  test("a correction that is not JSON, or that the server finds unfit, says why and saves nothing", async () => {
    const { calls } = server();
    render(<Admin />);
    await signIn();
    await waitFor(() => screen.getByText(text.counts(0, 7, 0)));
    fireEvent.click(screen.getByText(text.counts(0, 7, 0)));
    const first = screen
      .getByText(new RegExp(HOME_QUESTIONS[0].prompt))
      .closest("article") as HTMLElement;
    fireEvent.click(within(first).getByRole("button", { name: text.edit }));
    const box = within(first).getByLabelText(text.edit) as HTMLTextAreaElement;
    expect(JSON.parse(box.value).id).toBe(HOME_QUESTIONS[0].id);

    const before = calls.length;
    fireEvent.change(box, { target: { value: "{ not json" } });
    await act(async () => {
      fireEvent.click(within(first).getByRole("button", { name: text.save }));
    });
    expect(within(first).getByText(text.badJson)).toBeInTheDocument();
    expect(calls.length).toBe(before);

    fireEvent.change(box, {
      target: {
        value: JSON.stringify({ ...HOME_QUESTIONS[0], prompt: "Which club?" }),
      },
    });
    await act(async () => {
      fireEvent.click(within(first).getByRole("button", { name: text.save }));
    });
    await waitFor(() =>
      expect(within(first).getByText(/must start "Name a/)).toBeInTheDocument(),
    );
  });

  test("a token the server turns away signs the desk out, and is forgotten", async () => {
    server({ accept: false });
    render(<Admin />);
    await signIn();
    await waitFor(() =>
      expect(screen.getByText(text.wrongToken)).toBeInTheDocument(),
    );
    expect(screen.getByLabelText(text.tokenLabel)).toBeInTheDocument();
    expect(window.localStorage.getItem("soccersense:admin-token")).toBeNull();
  });

  test("a desk with no token set in Cloudflare says so", async () => {
    server({ shut: true });
    render(<Admin />);
    await signIn();
    await waitFor(() =>
      expect(screen.getByText(text.notSetUp)).toBeInTheDocument(),
    );
  });
});

describe("the Players tab", () => {
  const players = text.players;

  async function openPlayers() {
    render(<Admin />);
    await signIn();
    await waitFor(() => screen.getByText(text.counts(0, 7, 0)));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: text.tabs.players }));
    });
    await waitFor(() =>
      expect(screen.getByText("Row Z Rita")).toBeInTheDocument(),
    );
  }

  const rowOf = (name: string) =>
    screen.getByText(name).closest("tr") as HTMLElement;

  test("lists the newest accounts, and finds one by its name or address", async () => {
    const { calls } = server();
    await openPlayers();
    expect(
      screen.getByRole("heading", { name: players.title }),
    ).toBeInTheDocument();
    expect(screen.getByText(players.newest)).toBeInTheDocument();
    expect(screen.getByText("two@example.com")).toBeInTheDocument();
    const rita = rowOf("Row Z Rita");
    // joined, and last played, on day 8
    expect(within(rita).getAllByText("2026-11-17")).toHaveLength(2);
    expect(within(rita).getByText(players.on)).toBeInTheDocument();
    expect(
      within(rowOf("soccerfan2")).getByText(players.never),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(players.search), {
      target: { value: "rita" },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: players.find }));
    });
    await waitFor(() =>
      expect(screen.queryByText("soccerfan2")).not.toBeInTheDocument(),
    );
    expect(screen.getByText(players.found(1))).toBeInTheDocument();
    expect(calls.at(-1)?.url).toBe("/api/admin/players?q=rita");
    expect(calls.at(-1)?.token).toBe(TOKEN);
  });

  test("takes a player off the leaderboards with a note of why, and puts them back", async () => {
    const { calls } = server();
    await openPlayers();
    fireEvent.click(
      within(rowOf("Row Z Rita")).getByRole("button", { name: players.ban }),
    );
    fireEvent.change(
      within(rowOf("Row Z Rita")).getByLabelText(players.banNote),
      {
        target: { value: "  offensive name  " },
      },
    );
    await act(async () => {
      fireEvent.click(
        within(rowOf("Row Z Rita")).getByRole("button", {
          name: players.banConfirm,
        }),
      );
    });
    expect(calls.at(-1)).toMatchObject({
      url: "/api/admin/players/a1",
      method: "POST",
      body: { action: "ban", note: "offensive name" },
    });
    await waitFor(() =>
      expect(
        within(rowOf("Row Z Rita")).getByText(players.off("2026-11-18")),
      ).toBeInTheDocument(),
    );
    expect(
      within(rowOf("Row Z Rita")).getByText("offensive name"),
    ).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(
        within(rowOf("Row Z Rita")).getByRole("button", {
          name: players.unban,
        }),
      );
    });
    await waitFor(() =>
      expect(
        within(rowOf("Row Z Rita")).getByText(players.on),
      ).toBeInTheDocument(),
    );
    expect(calls.at(-1)?.body).toEqual({ action: "unban", note: "" });
  });

  test("gives a new name, and deletes an account only once asked a second time", async () => {
    const { calls } = server();
    await openPlayers();
    await act(async () => {
      fireEvent.click(
        within(rowOf("Row Z Rita")).getByRole("button", {
          name: players.rename,
        }),
      );
    });
    await waitFor(() =>
      expect(screen.getByText("soccerfan99")).toBeInTheDocument(),
    );
    expect(screen.queryByText("Row Z Rita")).not.toBeInTheDocument();

    fireEvent.click(
      within(rowOf("soccerfan2")).getByRole("button", { name: players.remove }),
    );
    expect(screen.getByText(players.removeSure)).toBeInTheDocument();
    const asked = calls.length;
    // not yet: cancel leaves it be
    fireEvent.click(
      within(rowOf("soccerfan2")).getByRole("button", { name: players.cancel }),
    );
    expect(calls.length).toBe(asked);
    fireEvent.click(
      within(rowOf("soccerfan2")).getByRole("button", { name: players.remove }),
    );
    await act(async () => {
      fireEvent.click(
        within(rowOf("soccerfan2")).getByRole("button", {
          name: players.removeConfirm,
        }),
      );
    });
    expect(calls.at(-1)?.body).toEqual({ action: "delete", note: "" });
    await waitFor(() =>
      expect(
        screen.getByText(players.removed("soccerfan2")),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByText("two@example.com")).not.toBeInTheDocument();
  });
});
