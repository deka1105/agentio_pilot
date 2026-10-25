/**
 * Attribution truth harness — Agentio P-1.
 *
 * Agentio's whole commercial argument is that creator media works and the
 * buyer's measurement cannot see it. Their case studies assert that with
 * customer-reported multipliers (Turo and Suri at 2.5–4x via MMM vs last-click,
 * Maev at 3x PPS), which a sceptical performance marketer has no way to check.
 *
 * So this does not assert it. It generates customer journeys where the true
 * cause of every conversion is known by construction, runs four attribution
 * models over only the *observable* touches, and scores each against that
 * truth. The output is an error measurement, not an opinion.
 *
 * The mechanism being demonstrated is structural, not statistical: creator
 * video is seen and not clicked, days before the purchase, and the last thing
 * before a conversion is usually a branded search the brand was going to get
 * anyway. Any model that credits the last click therefore cannot see it — and
 * that is arithmetic, not a finding about the world.
 */

export type Channel = "creator" | "paid_search" | "branded_search" | "direct" | "email";

export type Touch = {
  channel: Channel;
  /** Days before the conversion (or before the end of the window). */
  day: number;
  /** Creator video is watched, not clicked. This single fact is the whole story. */
  clicked: boolean;
};

export type Journey = {
  id: number;
  converted: boolean;
  /**
   * Known by construction, never shown to the attribution models. "creator"
   * means this conversion would not have happened without the creator
   * exposure — incrementality, not involvement.
   */
  trueCause: "creator" | "baseline" | null;
  touches: Touch[];
  /** The answer this person would give a post-purchase survey, if asked. */
  surveyAnswer: Channel | "unsure" | null;
};

export type Params = {
  /** How many people enter the funnel. */
  audience: number;
  /** Share of the audience exposed to a creator video. */
  creatorReach: number;
  /** Conversion rate with no creator exposure. */
  baselineRate: number;
  /** Extra conversion rate among the exposed — the real incremental effect. */
  creatorUplift: number;
  /** Median days between watching the video and converting. */
  considerationDays: number;
  /** How often a converter correctly recalls the creator in a survey, at zero lag. */
  surveyRecall: number;
  /**
   * Share of creator placements that are clicked rather than only watched.
   * Not zero — a link in bio or a swipe-up does get clicked sometimes — and
   * setting it to zero would make the demo look rigged.
   */
  creatorClickRate: number;
  /**
   * The attribution lookback window, in days. This is the mechanism that
   * decides whether an ad platform can see a touch at all: a view 20 days
   * before the purchase is outside a 7-day window and is not merely
   * under-credited, it is invisible.
   */
  lookbackDays: number;
  seed: number;
};

export const DEFAULTS: Params = {
  audience: 20000,
  creatorReach: 0.35,
  baselineRate: 0.012,
  creatorUplift: 0.022,
  considerationDays: 11,
  surveyRecall: 0.55,
  creatorClickRate: 0.08,
  lookbackDays: 7,
  seed: 7,
};

/* ----------------------------------------------------------- generation --- */

/** Mulberry32 — small, fast, and identical every run for a given seed. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Draws a lag in days with a long right tail, which is what consideration looks like. */
function drawLag(r: () => number, median: number) {
  const u = Math.max(1e-6, r());
  return Math.max(0, Math.round(median * (-Math.log(u) / Math.LN2)));
}

export function generate(p: Params): Journey[] {
  const r = rng(p.seed);
  const out: Journey[] = [];

  for (let i = 0; i < p.audience; i++) {
    const exposed = r() < p.creatorReach;
    const touches: Touch[] = [];

    // Everyone has some ambient contact with the brand.
    const baseConverts = r() < p.baselineRate;
    // The uplift only exists for the exposed, and only that slice is incremental.
    const upliftConverts = exposed && !baseConverts && r() < p.creatorUplift;
    const converted = baseConverts || upliftConverts;

    let lag = exposed ? drawLag(r, p.considerationDays) : 0;
    const creatorClicked = exposed && r() < p.creatorClickRate;

    /*
      Not every purchase has a later touch. Someone who clicks the link in a
      creator's description and buys in that session is a direct response, and
      it is the only path on which last-click can ever see creator media at
      all. Modelling every converter with a day-0 branded search would have
      forced last-click to exactly zero, which is tidier than the truth and
      would make this whole harness look rigged.
    */
    const directResponse = converted && creatorClicked && r() < 0.45;
    if (directResponse) lag = 0;

    if (exposed) touches.push({ channel: "creator", day: lag, clicked: creatorClicked });

    if (converted && !directResponse) {
      // Pre-purchase research, and then the last thing before buying. For a
      // creator-driven purchase that is almost always the person typing the
      // brand name — a touch the brand would have received anyway.
      if (r() < 0.35) touches.push({ channel: "email", day: Math.max(1, Math.round(lag * 0.4)), clicked: true });
      if (!exposed && r() < 0.55) touches.push({ channel: "paid_search", day: 1, clicked: true });
      const closer: Channel = upliftConverts
        ? r() < 0.75 ? "branded_search" : "direct"
        : r() < 0.5 ? "paid_search" : r() < 0.7 ? "branded_search" : "direct";
      touches.push({ channel: closer, day: 0, clicked: closer !== "direct" });
    } else if (!converted && !exposed && r() < 0.2) {
      touches.push({ channel: "paid_search", day: Math.round(r() * 10), clicked: true });
    }

    touches.sort((a, b) => b.day - a.day);

    let surveyAnswer: Journey["surveyAnswer"] = null;
    if (converted) {
      // Recall decays with the consideration window: someone who watched the
      // video three weeks ago is less likely to name it than someone who
      // watched it yesterday.
      const recall = p.surveyRecall / (1 + lag / 14);
      if (exposed && r() < recall) surveyAnswer = "creator";
      else {
        // Recall decays with time, so the recent closer gets named instead.
        const last = touches[touches.length - 1];
        surveyAnswer = r() < 0.25 ? "unsure" : last?.channel ?? "direct";
      }
    }

    out.push({
      id: i,
      converted,
      trueCause: converted ? (upliftConverts ? "creator" : "baseline") : null,
      touches,
      surveyAnswer,
    });
  }
  return out;
}

/* ---------------------------------------------------------- attribution --- */

export type ModelResult = {
  key: string;
  label: string;
  note: string;
  /** Conversions this model hands to the creator channel. */
  credited: number;
};

/**
 * Each model sees `touches` and `surveyAnswer` only. None of them is allowed to
 * look at `trueCause` — that is the point of the exercise.
 */
export function attribute(journeys: Journey[], lookbackDays: number): ModelResult[] {
  const conv = journeys.filter((j) => j.converted);
  // Only touches inside the window exist as far as an ad platform is concerned.
  const inWindow = (j: Journey) => j.touches.filter((t) => t.day <= lookbackDays);

  const lastClick = conv.filter((j) => {
    const clicks = inWindow(j).filter((t) => t.clicked);
    return clicks.length > 0 && clicks[clicks.length - 1].channel === "creator";
  }).length;

  const lastTouch = conv.filter((j) => inWindow(j).at(-1)?.channel === "creator").length;

  const firstTouch = conv.filter((j) => inWindow(j)[0]?.channel === "creator").length;

  const survey = conv.filter((j) => j.surveyAnswer === "creator").length;

  /*
    A deliberately plain stand-in for a marketing-mix model: compare the
    conversion rate of the exposed group against the unexposed one and scale by
    the exposed population. It is not MMM — no seasonality, no adstock, no
    regression — it is the incrementality estimate MMM is reaching for, and it
    is the only one of the five with access to the unexposed group.
  */
  const exposed = journeys.filter((j) => j.touches.some((t) => t.channel === "creator"));
  const unexposed = journeys.filter((j) => !j.touches.some((t) => t.channel === "creator"));
  const rateE = exposed.length ? exposed.filter((j) => j.converted).length / exposed.length : 0;
  const rateU = unexposed.length ? unexposed.filter((j) => j.converted).length / unexposed.length : 0;
  const incremental = Math.max(0, Math.round((rateE - rateU) * exposed.length));

  return [
    { key: "last-click", label: `Last click (${lookbackDays}-day window)`, note: "Credits the final clicked touch inside the window. Creator video is mostly watched, not clicked — and often watched before the window opens.", credited: lastClick },
    { key: "last-touch", label: `Last touch (${lookbackDays}-day window)`, note: "Credits the final touch of any kind inside the window, clicked or not.", credited: lastTouch },
    { key: "first-touch", label: `First touch (${lookbackDays}-day window)`, note: "Credits the first touch inside the window.", credited: firstTouch },
    { key: "survey", label: "Post-purchase survey", note: "Asks the buyer. Limited by recall, which decays over the consideration window.", credited: survey },
    { key: "incrementality", label: "Incrementality (exposed vs not)", note: "Compares converted share of the exposed against the unexposed. The only method here that uses a control group.", credited: incremental },
  ];
}

export type Scored = ModelResult & {
  /** Signed error against the known incremental truth. */
  error: number;
  errorPct: number | null;
  /** How many times it under- or over-states the truth. */
  ratio: number | null;
};

export type Analysis = {
  conversions: number;
  trueCreator: number;
  exposedShare: number;
  medianLag: number;
  unclickedShare: number;
  /** Share of creator touches that fall outside the attribution window entirely. */
  outsideWindowShare: number;
  models: Scored[];
};

export function analyse(journeys: Journey[], lookbackDays: number): Analysis {
  const conv = journeys.filter((j) => j.converted);
  const trueCreator = conv.filter((j) => j.trueCause === "creator").length;
  const exposed = journeys.filter((j) => j.touches.some((t) => t.channel === "creator"));

  const lags = conv
    .filter((j) => j.trueCause === "creator")
    .map((j) => j.touches.find((t) => t.channel === "creator")?.day ?? 0)
    .sort((a, b) => a - b);

  const creatorTouches = journeys.flatMap((j) => j.touches.filter((t) => t.channel === "creator"));

  const models: Scored[] = attribute(journeys, lookbackDays).map((m) => ({
    ...m,
    error: m.credited - trueCreator,
    errorPct: trueCreator > 0 ? ((m.credited - trueCreator) / trueCreator) * 100 : null,
    ratio: m.credited > 0 ? trueCreator / m.credited : null,
  }));

  return {
    conversions: conv.length,
    trueCreator,
    exposedShare: journeys.length ? exposed.length / journeys.length : 0,
    medianLag: lags.length ? lags[Math.floor(lags.length / 2)] : 0,
    unclickedShare: creatorTouches.length ? creatorTouches.filter((t) => !t.clicked).length / creatorTouches.length : 1,
    outsideWindowShare: creatorTouches.length
      ? creatorTouches.filter((t) => t.day > lookbackDays).length / creatorTouches.length
      : 0,
    models,
  };
}

/** The lag sweep: last-click's blindness is a function of the consideration window. */
export function lagSweep(p: Params, days: number[]): { day: number; lastClick: number; survey: number; incrementality: number; truth: number }[] {
  return days.map((d) => {
    const a = analyse(generate({ ...p, considerationDays: d }), p.lookbackDays);
    const get = (k: string) => a.models.find((m) => m.key === k)?.credited ?? 0;
    return { day: d, lastClick: get("last-click"), survey: get("survey"), incrementality: get("incrementality"), truth: a.trueCreator };
  });
}

export const DEMO_NOTE =
  "Every journey here is generated for this demo — no Agentio campaign, creator or brand is involved, and the figures in their published case studies are not reproduced or checked. What is real is the arithmetic: the true cause of each conversion is set when the journey is created, the attribution models below see only the observable touches, and the error is measured against that.";
