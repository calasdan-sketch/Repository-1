"""A lightweight, general-purpose business workflow engine.

This package provides the building blocks for modelling and running
business workflows such as approvals, onboarding, order fulfilment, and
other multi-step processes.

Core concepts:

* :class:`~workflow_engine.models.Step` -- a single unit of work in a
  workflow (an action, a decision, or an approval).
* :class:`~workflow_engine.models.Transition` -- a directed, optionally
  conditional link between two steps.
* :class:`~workflow_engine.models.WorkflowDefinition` -- the static
  description of a workflow (its steps and transitions).
* :class:`~workflow_engine.context.WorkflowContext` -- the mutable state
  carried through a single run of a workflow.
* :class:`~workflow_engine.engine.WorkflowEngine` -- executes a workflow
  definition against a context.
"""

from workflow_engine.context import WorkflowContext
from workflow_engine.engine import WorkflowEngine, StepResult
from workflow_engine.exceptions import (
    WorkflowError,
    WorkflowDefinitionError,
    WorkflowExecutionError,
)
from workflow_engine.models import (
    Step,
    StepType,
    Transition,
    WorkflowDefinition,
    WorkflowStatus,
)

__all__ = [
    "WorkflowContext",
    "WorkflowEngine",
    "StepResult",
    "WorkflowError",
    "WorkflowDefinitionError",
    "WorkflowExecutionError",
    "Step",
    "StepType",
    "Transition",
    "WorkflowDefinition",
    "WorkflowStatus",
]

__version__ = "0.1.0"
