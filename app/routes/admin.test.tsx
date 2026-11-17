/**
 * The approval desk (app/routes/admin.tsx) against a stand-in for the admin API: signing
 * in with the token, the week's table, looking at a day's questions, approving, rejecting
 * and correcting them.
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

import { HOME_QUESTIONS } from "~/data";
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

/** The desk's API, in memory: day 8 has HOME's seven sample questions as drafts. */
function server(options: { accept?: boolean; shut?: boolean } = {}) {
  const calls: Call[] = [];
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
        return json({ slots });
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
      return json({ error: "not_found" }, 404);
    },
  );
  vi.stubGlobal("fetch", fetcher);
  return { calls, slots };
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
