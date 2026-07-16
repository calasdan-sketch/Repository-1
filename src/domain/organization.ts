/**
 * Static definition of the "business as an arcade command center".
 *
 * The owner sits at the Headquarters (HQ) in the middle of the map and issues
 * orders. Each surrounding building is a division (branch) staffed by autonomous
 * agents/bots that carry out a specific facet of the business. This module is
 * the single source of truth for the org chart the visual UI renders and the
 * API exposes.
 *
 * Coordinates are expressed on a normalised grid where {@link HQ} sits at the
 * centre `{ x: 0, y: 0 }` and divisions orbit around it. The frontend maps this
 * grid onto the canvas so the layout stays consistent between server and client.
 */

/** A single autonomous worker (agent/bot) inside a division. */
export interface Agent {
  /** Stable identifier, unique across the whole organization. */
  id: string;
  /** Human-friendly display name shown on the arcade map. */
  name: string;
  /** One-line summary of what this agent is responsible for. */
  role: string;
}

/** Identifier for one of the business divisions (branch buildings). */
export type DivisionId =
  'software' | 'qa' | 'social' | 'marketing' | 'operations';

/** A branch building on the map: one division of the business. */
export interface Division {
  id: DivisionId;
  /** Display name, e.g. "Software Development". */
  name: string;
  /** Short description of the division's mandate. */
  mission: string;
  /** Arcade building tint (hex) used by the UI. */
  color: string;
  /** Position on the normalised grid relative to HQ at the centre. */
  position: { x: number; y: number };
  /** The agents/bots stationed in this division. */
  agents: Agent[];
}

/** The Headquarters where the owner issues orders. */
export const HQ = {
  id: 'hq' as const,
  name: 'Headquarters',
  role: 'Command & control — you issue the orders here',
  color: '#ffd447',
  position: { x: 0, y: 0 },
};

/**
 * The divisions surrounding HQ. Positions are laid out clockwise so the UI can
 * draw connection lines from HQ to each building.
 */
export const DIVISIONS: Division[] = [
  {
    id: 'software',
    name: 'Software Development',
    mission: 'Build and ship the software that runs the business.',
    color: '#4fc3f7',
    position: { x: 0, y: -1 },
    agents: [
      {
        id: 'sw-architect',
        name: 'Architect',
        role: 'Designs systems and turns HQ orders into build specs',
      },
      {
        id: 'sw-builder',
        name: 'Builder',
        role: 'Implements features and integrations',
      },
      {
        id: 'sw-shipper',
        name: 'Shipper',
        role: 'Packages and deploys releases',
      },
    ],
  },
  {
    id: 'qa',
    name: 'Error Correction (QA)',
    mission: 'Detect, triage and fix errors before customers do.',
    color: '#ef5350',
    position: { x: 1, y: -0.4 },
    agents: [
      {
        id: 'qa-watcher',
        name: 'Watcher',
        role: 'Monitors logs and health for anomalies',
      },
      {
        id: 'qa-triage',
        name: 'Triage',
        role: 'Reproduces and prioritises defects',
      },
      {
        id: 'qa-fixer',
        name: 'Fixer',
        role: 'Patches bugs and verifies regressions',
      },
    ],
  },
  {
    id: 'social',
    name: 'Social Media',
    mission: 'Grow and engage the audience across social channels.',
    color: '#ab47bc',
    position: { x: 0.7, y: 0.9 },
    agents: [
      {
        id: 'so-creator',
        name: 'Creator',
        role: 'Drafts posts, reels and community replies',
      },
      {
        id: 'so-scheduler',
        name: 'Scheduler',
        role: 'Plans and publishes the content calendar',
      },
      {
        id: 'so-listener',
        name: 'Listener',
        role: 'Tracks mentions, trends and sentiment',
      },
    ],
  },
  {
    id: 'marketing',
    name: 'Marketing',
    mission: 'Drive demand through campaigns, ads and SEO.',
    color: '#66bb6a',
    position: { x: -0.7, y: 0.9 },
    agents: [
      {
        id: 'mk-strategist',
        name: 'Strategist',
        role: 'Sets campaign goals and budgets',
      },
      {
        id: 'mk-copywriter',
        name: 'Copywriter',
        role: 'Writes ad and landing-page copy',
      },
      {
        id: 'mk-analyst',
        name: 'Analyst',
        role: 'Measures ROI and optimises spend',
      },
    ],
  },
  {
    id: 'operations',
    name: 'Operations',
    mission: 'Keep fulfilment, inventory and finances running smoothly.',
    color: '#ffa726',
    position: { x: -1, y: -0.4 },
    agents: [
      {
        id: 'op-buyer',
        name: 'Buyer',
        role: 'Sources products and proposes purchases',
      },
      {
        id: 'op-fulfiller',
        name: 'Fulfiller',
        role: 'Processes orders and tracking',
      },
      {
        id: 'op-treasurer',
        name: 'Treasurer',
        role: 'Watches cash flow and flags spend',
      },
    ],
  },
];

/** Look up a division by id, or `undefined` when it does not exist. */
export function getDivision(id: string): Division | undefined {
  return DIVISIONS.find((division) => division.id === id);
}

/**
 * The complete org chart the API and UI consume: HQ plus every division.
 */
export function organizationChart(): {
  hq: typeof HQ;
  divisions: Division[];
} {
  return { hq: HQ, divisions: DIVISIONS };
}
