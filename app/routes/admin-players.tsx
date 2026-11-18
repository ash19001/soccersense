// Moderation on the admin page (./admin.tsx): find a player with an account, give them a
// new name, take them off the leaderboards or put them back, or delete their account,
// through the admin API (worker/accounts/moderation.ts). A working tool, as plain as the
// approval desk beside it.

import { useCallback, useEffect, useState } from "react";

import { dayKeyFor } from "~/game";
import { strings } from "~/i18n";

const text = strings.admin.players;

/** An account as the API sends it (worker/accounts/moderation.ts, `PlayerView`). */
export interface PlayerView {
  id: string;
  nickname: string;
  email: string;
  createdAt: number;
  bannedAt: number | null;
  note: string;
  games: number;
  lastDay: number | null;
}

type Action = "rename" | "ban" | "unban" | "delete";

/** Asks the admin API (the page's `ask`): null when the desk turned the request away. */
export type Ask = (
  path: string,
  init?: RequestInit,
) => Promise<Response | null>;

const button =
  "rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-800 hover:bg-slate-100 disabled:opacity-50";
const danger =
  "rounded border border-rose-700 bg-rose-700 px-2 py-1 text-xs font-medium text-white hover:bg-rose-800 disabled:opacity-50";

/** A moment as a date: "2026-11-18". */
const dateOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function Players({ ask, failed }: { ask: Ask; failed: () => void }) {
  const [query, setQuery] = useState("");
  const [asked, setAsked] = useState<string | null>(null);
  const [found, setFound] = useState<PlayerView[]>([]);
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState("");

  /** Asks for the accounts matching `q`; their list, or null if that failed. */
  const lookUp = useCallback(
    async (q: string): Promise<PlayerView[] | null> => {
      const response = await ask(`/players?q=${encodeURIComponent(q)}`);
      if (response?.ok) {
        return ((await response.json()) as { players: PlayerView[] }).players;
      }
      if (response) failed();
      return null;
    },
    [ask, failed],
  );

  const search = async (q: string) => {
    setBusy(true);
    const players = await lookUp(q);
    if (players) {
      setFound(players);
      setAsked(q);
    }
    setBusy(false);
  };

  // The newest accounts, to begin with.
  useEffect(() => {
    let stale = false;
    void lookUp("").then((players) => {
      if (stale || !players) return;
      setFound(players);
      setAsked("");
    });
    return () => {
      stale = true;
    };
  }, [lookUp]);

  const act = useCallback(
    async (player: PlayerView, action: Action, note = "") => {
      setBusy(true);
      setSaid("");
      const response = await ask(`/players/${player.id}`, {
        method: "POST",
        body: JSON.stringify({ action, note }),
      });
      setBusy(false);
      if (!response) return;
      if (!response.ok) {
        failed();
        return;
      }
      const after = ((await response.json()) as { player: PlayerView | null })
        .player;
      if (after === null) {
        setFound((all) => all.filter((p) => p.id !== player.id));
        setSaid(text.removed(player.nickname));
      } else {
        setFound((all) => all.map((p) => (p.id === after.id ? after : p)));
      }
    },
    [ask, failed],
  );

  return (
    <section className="space-y-3">
      <p className="text-sm text-slate-600">{text.intro}</p>
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void search(query.trim());
        }}
      >
        <input
          aria-label={text.search}
          placeholder={text.search}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="min-w-64 flex-1 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded border border-emerald-700 bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          {text.find}
        </button>
      </form>
      {said && (
        <p role="status" className="text-sm text-emerald-800">
          {said}
        </p>
      )}
      {asked !== null && (
        <p className="text-sm text-slate-600">
          {found.length === 0
            ? text.none
            : asked === ""
              ? text.newest
              : text.found(found.length)}
        </p>
      )}
      {found.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse bg-white text-sm shadow-sm">
            <thead>
              <tr className="bg-slate-100 text-left">
                {Object.values(text.columns).map((heading) => (
                  <th key={heading} className="border border-slate-200 p-2">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {found.map((player) => (
                <PlayerRow
                  key={player.id}
                  player={player}
                  busy={busy}
                  act={act}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function PlayerRow({
  player,
  busy,
  act,
}: {
  player: PlayerView;
  busy: boolean;
  act: (player: PlayerView, action: Action, note?: string) => Promise<void>;
}) {
  const [asking, setAsking] = useState<"ban" | "delete" | null>(null);
  const [note, setNote] = useState("");
  const cell = "border border-slate-200 p-2 align-top";

  return (
    <tr>
      <td className={`${cell} font-medium`}>{player.nickname}</td>
      <td className={cell}>{player.email}</td>
      <td className={cell}>{dateOf(player.createdAt)}</td>
      <td className={cell}>{player.games}</td>
      <td className={cell}>
        {player.lastDay === null ? text.never : dayKeyFor(player.lastDay)}
      </td>
      <td className={cell}>
        {player.bannedAt === null ? (
          text.on
        ) : (
          <span className="text-rose-800">
            {text.off(dateOf(player.bannedAt))}
            {player.note && (
              <span className="block text-xs text-slate-600">
                {player.note}
              </span>
            )}
          </span>
        )}
      </td>
      <td className={cell}>
        {asking === "ban" ? (
          <div className="flex flex-wrap gap-1">
            <input
              aria-label={text.banNote}
              placeholder={text.banNote}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className="min-w-40 flex-1 rounded border border-slate-300 px-2 py-1 text-xs"
            />
            <button
              type="button"
              className={danger}
              disabled={busy}
              onClick={() => {
                setAsking(null);
                void act(player, "ban", note.trim());
              }}
            >
              {text.banConfirm}
            </button>
            <button
              type="button"
              className={button}
              onClick={() => setAsking(null)}
            >
              {text.cancel}
            </button>
          </div>
        ) : asking === "delete" ? (
          <div className="space-y-1">
            <p className="text-xs text-rose-800">{text.removeSure}</p>
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                className={danger}
                disabled={busy}
                onClick={() => {
                  setAsking(null);
                  void act(player, "delete");
                }}
              >
                {text.removeConfirm}
              </button>
              <button
                type="button"
                className={button}
                onClick={() => setAsking(null)}
              >
                {text.cancel}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              className={button}
              disabled={busy}
              title={text.renameHelp}
              onClick={() => void act(player, "rename")}
            >
              {text.rename}
            </button>
            {player.bannedAt === null ? (
              <button
                type="button"
                className={button}
                disabled={busy}
                onClick={() => {
                  setNote("");
                  setAsking("ban");
                }}
              >
                {text.ban}
              </button>
            ) : (
              <button
                type="button"
                className={button}
                disabled={busy}
                onClick={() => void act(player, "unban")}
              >
                {text.unban}
              </button>
            )}
            <button
              type="button"
              className={button}
              disabled={busy}
              onClick={() => setAsking("delete")}
            >
              {text.remove}
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}
