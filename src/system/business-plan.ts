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

export interface DevelopmentTeamRole {
  role: string;
  focus: string;
  primaryRepository: string;
  responsibilities: string[];
}

export interface BusinessPlan {
  objective: string;
  operatingModel: string;
  repositories: BusinessRepositoryPlan[];
  workflow: BusinessWorkflowStage[];
  developmentTeam: DevelopmentTeamRole[];
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
  developmentTeam: [
    {
      role: 'Operations Lead',
      focus: 'Human-in-the-loop review and go-live readiness',
      primaryRepository: 'calasdan-sketch/Repository-1',
      responsibilities: [
        'Approve staged AI content and monitor fulfillment health',
        'Own production credentials and AutoDS plan configuration',
        'Decide when AUTO_PUBLISH / AUTO_FULFILL are safe to enable',
      ],
    },
    {
      role: 'Automation Engineer',
      focus: 'Orchestration, scheduler, and admin API surface',
      primaryRepository: 'calasdan-sketch/Repository-1',
      responsibilities: [
        'Maintain the source → generate → publish → fulfill → sync pipeline',
        'Keep the SQLite datastore, migrations, and tests healthy',
        'Extend the admin API for new operational needs',
      ],
    },
    {
      role: 'AI Gateway Engineer',
      focus: 'Multi-provider AI routing and public tool access',
      primaryRepository: 'calasdan-sketch/repository1',
      responsibilities: [
        'Operate the public AI gateway consumed by this control plane',
        'Publish the integration contract private agents rely on',
      ],
    },
    {
      role: 'Docs & Onboarding Maintainer',
      focus: 'Cross-repository runbooks and contributor onboarding',
      primaryRepository: 'calasdan-sketch/new-repository-',
      responsibilities: [
        'Keep shared operating conventions and templates current',
        'Bootstrap new contributors and agents into the three-repo workflow',
      ],
    },
    {
      role: 'Coding Agent (Claude)',
      focus: 'Implementation, content generation, and product scoring',
      primaryRepository: 'calasdan-sketch/Repository-1',
      responsibilities: [
        'Implement features and fixes across the three repositories on request',
        'Generate SEO product content and score product viability',
        'Surface machine-readable plans (this document) for future agent handoffs',
      ],
    },
    {
      role: 'Copywriter Agent',
      focus: 'Product and brand copy for the storefront and listings',
      primaryRepository: 'calasdan-sketch/Repository-1',
      responsibilities: [
        'Draft SEO product titles, descriptions, bullets, and tags for staged review',
        'Keep tone and terminology consistent across product listings',
        'Hand off approved copy to the Operations Lead for publish approval',
      ],
    },
    {
      role: 'Marketing Agent',
      focus: 'Product viability, positioning, and go-to-market messaging',
      primaryRepository: 'calasdan-sketch/Repository-1',
      responsibilities: [
        'Score candidate products for market viability ahead of import',
        'Propose campaign angles and pricing/promotion input for merchandising',
        'Flag underperforming listings surfaced through orders and sync data',
      ],
    },
    {
      role: 'Design Agent',
      focus: 'Visual presentation of products and storefront assets',
      primaryRepository: 'calasdan-sketch/Repository-1',
      responsibilities: [
        'Prepare product imagery and layout guidance for Shopify listings',
        'Maintain visual consistency across staged and published content',
        'Coordinate with the Copywriter Agent on combined listing review',
      ],
    },
  ],
};
