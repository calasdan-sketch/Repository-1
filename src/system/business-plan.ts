export interface BusinessRepositoryPlan {
  name: string;
  visibility: 'private' | 'public';
  language: string;
  currentState: string;
  role: string;
  responsibilities: string[];
  nextStep: string;
}

export interface BusinessWorkflowStage {
  name: string;
  owner: string;
  outcome: string;
}

export interface BusinessPlan {
  objective: string;
  operatingModel: string;
  repositories: BusinessRepositoryPlan[];
  workflow: BusinessWorkflowStage[];
}

/**
 * Machine-readable operating plan for the three-repository business system.
 *
 * This gives agents and maintainers one place to discover which repository
 * owns each part of the workflow without changing the existing automation
 * behaviour.
 */
export const businessPlan: BusinessPlan = {
  objective: 'Build a self-sustaining, agent-assisted business workflow.',
  operatingModel:
    'Repository-1 acts as the private operations control plane, repository1 provides the public AI gateway product surface, and new-repository- is reserved for public-facing operating assets and reusable automation templates.',
  repositories: [
    {
      name: 'calasdan-sketch/Repository-1',
      visibility: 'private',
      language: 'TypeScript',
      currentState:
        'Operational Shopify + AutoDS + Claude automation scaffold with admin API, scheduler, and tests.',
      role: 'Private business operations control plane',
      responsibilities: [
        'Own internal sourcing, publishing, fulfillment, and review workflows',
        'Expose agent-readable admin endpoints for operations status and plans',
        'Coordinate human-in-the-loop approvals for revenue operations',
      ],
      nextStep:
        'Connect production credentials and verify AutoDS endpoints for the active plan before go-live.',
    },
    {
      name: 'calasdan-sketch/repository1',
      visibility: 'public',
      language: 'TypeScript',
      currentState:
        'Active public OmniRoute codebase for multi-provider AI routing and agent tool access.',
      role: 'Public AI product and traffic acquisition surface',
      responsibilities: [
        'Provide the external AI gateway that users and agents integrate with',
        'Generate public product adoption, usage signals, and distribution',
        'Supply reusable AI connectivity patterns that private operations can consume',
      ],
      nextStep:
        'Document the integration contract that private operations agents should use when calling the public gateway.',
    },
    {
      name: 'calasdan-sketch/new-repository-',
      visibility: 'public',
      language: 'Markdown-first',
      currentState: 'Repository contains only a placeholder README.',
      role: 'Public business operations hub',
      responsibilities: [
        'Publish lightweight runbooks, onboarding docs, and automation templates',
        'Hold cross-repository conventions that can be shared safely in public',
        'Serve as the bootstrap point for contributors and future agents',
      ],
      nextStep:
        'Add a public README, operating principles, and starter templates for cross-repository automation tasks.',
    },
  ],
  workflow: [
    {
      name: 'Acquire and route AI capability',
      owner: 'calasdan-sketch/repository1',
      outcome: 'Provide a public AI gateway that can power downstream agents.',
    },
    {
      name: 'Operate revenue workflows',
      owner: 'calasdan-sketch/Repository-1',
      outcome:
        'Run internal product sourcing, merchandising, order handling, and review loops.',
    },
    {
      name: 'Document and standardize repeatable operations',
      owner: 'calasdan-sketch/new-repository-',
      outcome:
        'Publish reusable templates and operating guidance for maintainers and agents.',
    },
  ],
};
