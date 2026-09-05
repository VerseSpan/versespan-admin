import { describe, it, expect } from "vitest";

/**
 * Faithful simulation of useWatchSocket's message handling for speech
 * finals + Stage C revisions, to ground-truth what the UI shows vs what TTS
 * speaks. Mirrors the branch logic in hooks/useWatchSocket.ts exactly.
 */

interface T { id: number; target_text: string; utteranceId?: string }
type Msg = {
  type: "translation";
  status: "final" | "partial";
  utterance_id: string;
  target_text: string;
  revision: number;
  llm_revised?: boolean;
  llm_pending?: boolean;
};

function runWatch(msgs: Msg[]) {
  // state
  let translations: T[] = [];
  let lastText = "";
  let pendingUtterance: { utteranceId: string; text: string } | null = null;
  let lastFinalized: string | null = null;
  // Ordered TTS queue: slots in finalization order; text=null = awaiting revision.
  const queue: Array<{ uid?: string; text: string | null; opusText: string }> = [];
  const spoken: string[] = [];
  let idCounter = 0;

  const speak = (t: string) => spoken.push(t);
  const drain = () => {
    while (queue.length && queue[0].text !== null) speak(queue.shift()!.text!);
  };

  for (const msg of msgs) {
    const text = msg.target_text;
    if (msg.status === "partial") {
      if (msg.utterance_id === lastFinalized) continue;
      pendingUtterance = { utteranceId: msg.utterance_id, text };
      continue;
    }
    // revision — fill this utterance's slot in place, then drain in order
    if (msg.status === "final" && msg.llm_revised && msg.utterance_id) {
      for (let i = translations.length - 1; i >= 0; i--) {
        if (translations[i].utteranceId === msg.utterance_id) {
          translations = translations.slice();
          translations[i] = { ...translations[i], target_text: text };
          break;
        }
      }
      if (lastFinalized === msg.utterance_id) lastText = text;
      const slot = queue.find((s) => s.uid === msg.utterance_id && s.text === null);
      if (slot) {
        slot.text = text;
        drain();
      }
      continue;
    }
    // normal final
    if (msg.utterance_id) lastFinalized = msg.utterance_id;
    pendingUtterance = null;
    const entry: T = { id: ++idCounter, target_text: text, utteranceId: msg.utterance_id };
    translations = [...translations.slice(-49), entry];
    lastText = entry.target_text;
    if (msg.llm_pending && msg.utterance_id) {
      queue.push({ uid: msg.utterance_id, text: null, opusText: entry.target_text }); // deferred
    } else {
      queue.push({ uid: msg.utterance_id, text: entry.target_text, opusText: entry.target_text });
      drain();
    }
  }
  // fire any still-pending safety timers (Qwen never arrived) -> opus floor, in order
  for (const s of queue) if (s.text === null) s.text = s.opusText;
  drain();
  return { translations, lastText, pendingUtterance, spoken };
}

const F = (utt: string, text: string, rev = 2, llm_pending = true): Msg => ({
  type: "translation", status: "final", utterance_id: utt, target_text: text, revision: rev, llm_pending,
});
const R = (utt: string, text: string, rev = 3): Msg => ({
  type: "translation", status: "final", utterance_id: utt, target_text: text, revision: rev, llm_revised: true,
});
const P = (utt: string, text: string, rev = 1): Msg => ({
  type: "translation", status: "partial", utterance_id: utt, target_text: text, revision: rev,
});

describe("watch reducer: display vs audio for Stage C acting", () => {
  it("single utterance: history + lastText + audio all become Qwen", () => {
    const s = runWatch([F("u1", "OPUS one"), R("u1", "QWEN one")]);
    expect(s.translations.at(-1)!.target_text).toBe("QWEN one"); // history swapped
    expect(s.lastText).toBe("QWEN one"); // prominent line swapped
    expect(s.spoken).toEqual(["QWEN one"]); // audio spoke Qwen (once)
  });

  it("continuous speech: a NEW sentence starts forming before the revision lands", () => {
    // u1 opus final, then u2 starts forming, THEN u1's qwen revision arrives
    const s = runWatch([
      F("u1", "OPUS one"),
      P("u2", "forming two..."),
      R("u1", "QWEN one"),
    ]);
    // history for u1 IS swapped to Qwen...
    expect(s.translations.find((t) => t.utteranceId === "u1")!.target_text).toBe("QWEN one");
    expect(s.spoken).toEqual(["QWEN one"]);
    // ...but the PROMINENT live line is showing u2's opus partial, NOT Qwen
    expect(s.pendingUtterance?.text).toBe("forming two...");
    // lastText did update to Qwen (u1 still the last finalized), but it's hidden
    // behind the pendingUtterance in the UI
    expect(s.lastText).toBe("QWEN one");
  });

  it("rapid finals: u2 finalizes before u1 revision -> lastText tracks u2, u1 swap still in history", () => {
    const s = runWatch([
      F("u1", "OPUS one"),
      F("u2", "OPUS two"),
      R("u1", "QWEN one"),
      R("u2", "QWEN two"),
    ]);
    expect(s.translations.find((t) => t.utteranceId === "u1")!.target_text).toBe("QWEN one");
    expect(s.translations.find((t) => t.utteranceId === "u2")!.target_text).toBe("QWEN two");
    expect(s.lastText).toBe("QWEN two");
    expect(s.spoken).toEqual(["QWEN one", "QWEN two"]);
  });

  it("out-of-order revisions: u2's Qwen returns BEFORE u1's — audio stays in order", () => {
    // Regression: concurrent Qwen tasks finish out of order. u1 & u2 both defer;
    // u2's revision arrives first, but audio must still be [u1, u2].
    const s = runWatch([
      F("u1", "OPUS one"),
      F("u2", "OPUS two"),
      R("u2", "QWEN two"), // u2 ready first — must NOT speak yet (u1 still pending)
      R("u1", "QWEN one"), // now u1 ready — drains u1 then u2
    ]);
    expect(s.spoken).toEqual(["QWEN one", "QWEN two"]);
  });

  it("out-of-order with a stuck earlier slot: u1 never revises, its timeout releases both in order", () => {
    // u1's revision is lost; u2's arrives. Nothing speaks until u1's safety
    // timeout fires (end-of-stream here), then both drain in order (opus for u1).
    const s = runWatch([
      F("u1", "OPUS one"),
      F("u2", "OPUS two"),
      R("u2", "QWEN two"),
      // no R("u1") — end-of-stream timeout falls u1 back to opus
    ]);
    expect(s.spoken).toEqual(["OPUS one", "QWEN two"]);
  });
});
