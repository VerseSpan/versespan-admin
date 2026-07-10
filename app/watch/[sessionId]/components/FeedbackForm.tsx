"use client";

import type { I18NStrings } from "../types";

type FeedbackState = "idle" | "form" | "submitted";

interface FormValues {
  ratingOverall: number;
  ratingTranslation: number;
  ratingAudio: number;
  ratingAudioDelay: number;
  hadBugs: boolean | null;
  bugDescription: string;
  comment: string;
}

interface Props {
  feedbackState: FeedbackState;
  setFeedbackState: (s: FeedbackState) => void;
  form: FormValues;
  setForm: React.Dispatch<React.SetStateAction<FormValues>>;
  submitFeedback: () => void;
  t: I18NStrings;
}

const vsStyle = {
  background: "#09090F",
  color: "#F5F0E8",
  fontFamily: "var(--font-jakarta), 'Plus Jakarta Sans', sans-serif",
};

function StarRating({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm" style={{ color: "#6B6B7A" }}>{label}</span>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            className="text-2xl transition-transform active:scale-90"
            style={{ color: star <= value ? "#C9A84C" : "#1E1E2A" }}
          >
            ★
          </button>
        ))}
      </div>
    </div>
  );
}

export default function FeedbackForm({
  feedbackState,
  setFeedbackState,
  form,
  setForm,
  submitFeedback,
  t,
}: Props) {
  if (feedbackState === "submitted") {
    return (
      <div className="h-screen flex flex-col items-center justify-center px-8 text-center gap-5" style={vsStyle}>
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mb-2"
          style={{ background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.2)" }}
        >
          <svg className="w-8 h-8" style={{ color: "#4ADE80" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-2xl font-semibold" style={{ fontFamily: "var(--font-cormorant), 'Cormorant Garamond', serif", color: "#F5F0E8" }}>{t.thankYou}</p>
        <p className="text-sm max-w-xs" style={{ color: "#3A3A4A" }}>{t.thankYouSub}</p>
      </div>
    );
  }

  if (feedbackState === "form") {
    const canSubmit =
      form.ratingOverall > 0 &&
      form.ratingTranslation > 0 &&
      form.ratingAudio > 0 &&
      form.ratingAudioDelay > 0 &&
      form.hadBugs !== null;

    return (
      <div className="h-screen flex flex-col overflow-hidden" style={vsStyle}>
        <div
          className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
          style={{ background: "#0D0D17", borderBottom: "1px solid #1E1E2A" }}
        >
          <button
            onClick={() => setFeedbackState("idle")}
            className="p-1 transition"
            style={{ color: "#3A3A4A" }}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <p className="text-base font-semibold" style={{ color: "#F5F0E8" }}>{t.formTitle}</p>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
          <StarRating value={form.ratingOverall} onChange={(v) => setForm((f) => ({ ...f, ratingOverall: v }))} label={t.overall} />
          <StarRating value={form.ratingTranslation} onChange={(v) => setForm((f) => ({ ...f, ratingTranslation: v }))} label={t.translation} />
          <StarRating value={form.ratingAudio} onChange={(v) => setForm((f) => ({ ...f, ratingAudio: v }))} label={t.audio} />

          <div className="flex flex-col gap-1.5">
            <span className="text-sm" style={{ color: "#6B6B7A" }}>{t.audioDelay}</span>
            <div className="flex gap-2">
              {t.audioDelayLabels.map((label, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, ratingAudioDelay: i + 1 }))}
                  className="flex-1 py-1.5 rounded-lg text-xs font-medium transition"
                  style={
                    form.ratingAudioDelay === i + 1
                      ? { background: "#C9A84C", color: "#09090F" }
                      : { background: "#111118", color: "#3A3A4A", border: "1px solid #1E1E2A" }
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm" style={{ color: "#6B6B7A" }}>{t.hadBugs}</span>
            <div className="flex gap-3">
              {([true, false] as const).map((val) => (
                <button
                  key={String(val)}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, hadBugs: val, bugDescription: val ? f.bugDescription : "" }))}
                  className="flex-1 py-2 rounded-lg text-sm font-medium transition"
                  style={
                    form.hadBugs === val
                      ? { background: "#C9A84C", color: "#09090F" }
                      : { background: "#111118", color: "#3A3A4A", border: "1px solid #1E1E2A" }
                  }
                >
                  {val ? t.yes : t.no}
                </button>
              ))}
            </div>
            {form.hadBugs && (
              <textarea
                value={form.bugDescription}
                onChange={(e) => setForm((f) => ({ ...f, bugDescription: e.target.value }))}
                placeholder={t.bugDescriptionPlaceholder}
                rows={3}
                className="mt-1 w-full rounded-lg px-3 py-2 text-sm resize-none outline-none"
                style={{ background: "#111118", border: "1px solid #1E1E2A", color: "#F5F0E8" }}
              />
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm" style={{ color: "#6B6B7A" }}>{t.comment}</span>
            <textarea
              value={form.comment}
              onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value }))}
              placeholder={t.commentPlaceholder}
              rows={3}
              className="w-full rounded-lg px-3 py-2 text-sm resize-none outline-none"
              style={{ background: "#111118", border: "1px solid #1E1E2A", color: "#F5F0E8" }}
            />
          </div>
        </div>

        <div className="flex-shrink-0 px-5 py-4" style={{ borderTop: "1px solid #1E1E2A", background: "#09090F" }}>
          <button
            onClick={submitFeedback}
            disabled={!canSubmit}
            className="w-full py-3 rounded-xl text-base font-semibold transition"
            style={
              canSubmit
                ? { background: "#C9A84C", color: "#09090F" }
                : { background: "#111118", color: "#3A3A4A", cursor: "not-allowed" }
            }
          >
            {t.submit}
          </button>
        </div>
      </div>
    );
  }

  // feedbackState === "idle"
  return (
    <div className="h-screen flex flex-col items-center justify-center px-8 text-center gap-6" style={vsStyle}>
      <div>
        <div
          style={{
            fontFamily: "var(--font-cormorant), 'Cormorant Garamond', serif",
            fontSize: "1.75rem",
            fontWeight: 600,
            color: "#C9A84C",
            letterSpacing: "-0.02em",
            marginBottom: "4px",
          }}
        >
          Versespan
        </div>
      </div>
      <div className="space-y-2">
        <p
          className="text-2xl font-semibold"
          style={{ fontFamily: "var(--font-cormorant), 'Cormorant Garamond', serif", color: "#F5F0E8" }}
        >
          {t.sessionEnded}
        </p>
        <p className="text-sm" style={{ color: "#3A3A4A" }}>{t.thankYouJoining}</p>
      </div>
      <button
        onClick={() => setFeedbackState("form")}
        className="mt-2 px-8 py-3 rounded-xl font-semibold text-base transition active:scale-95"
        style={{ background: "#C9A84C", color: "#09090F" }}
      >
        {t.shareFeedback}
      </button>
      <button
        onClick={() => setFeedbackState("submitted")}
        className="text-sm transition"
        style={{ color: "#3A3A4A" }}
      >
        {t.skip}
      </button>
    </div>
  );
}
