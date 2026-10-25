import type { ComponentType } from "react";

/**
 * The pilots built for Agentio.
 *
 * Extracted from the pilot factory; each entry points at a folder under
 * `companies/agentio/`. Adding one by hand means creating that folder and
 * appending here, exactly as in the source repo.
 */
export type Pilot = {
  slug: string;
  title: string;
  company: string;
  useCase: string;
  demo: string;
  built: string;
  tier: "eval" | "outreach";
  load: () => Promise<{ default: ComponentType }>;
};

export const pilots: Pilot[] = [
  {
    slug: "agentio-attribution-truth",
    title: "Attribution truth harness",
    company: "agentio",
    useCase: "UC-2",
    demo: "414 conversions with a known cause for each: 161 were caused by the creator placement, and last click reports 7 of them \\u2014 because 92% of placements are watched without a click and 62% happen before the 7-day window opens.",
    built: "2026-10-25",
    tier: "eval",
    load: () => import("@companies/agentio/agentio-attribution-truth/Pilot"),
  },
];

export function getPilot(slug: string): Pilot | undefined {
  return pilots.find((p) => p.slug === slug);
}
