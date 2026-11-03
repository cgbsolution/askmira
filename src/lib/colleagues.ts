import { get } from "@/lib/api";
import type { Colleague } from "@/lib/types";

/** The colleague search answers from this many typed letters (the API's own rule). */
export const COLLEAGUE_MIN_CHARS = 2;

/** Shown in a picker until enough of a name is typed. */
export const COLLEAGUE_HINT = "Type two or more letters of a name or an employee code.";

/**
 * Colleagues matching a name or code, to pick one: names and titles only.
 *
 * Outside HR nobody browses the company — the directory shows a person only
 * their own circle — so screens that pick *any* colleague (kudos, nominations,
 * feedback, shift swaps, points) search here instead. Fewer than two letters
 * answers nobody without asking the server.
 */
export async function findColleagues(search: string): Promise<Colleague[]> {
  const term = search.trim();
  if (term.length < COLLEAGUE_MIN_CHARS) return [];
  return get<Colleague[]>(`/employees/colleagues?${new URLSearchParams({ search: term })}`);
}
