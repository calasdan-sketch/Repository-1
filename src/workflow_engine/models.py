"""Domain models describing the static structure of a workflow.

These classes are intentionally free of execution logic; they describe
*what* a workflow looks like. Execution is handled by
:mod:`workflow_engine.engine`.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Callable, Dict, List, Optional

from workflow_engine.exceptions import WorkflowDefinitionError


class StepType(str, Enum):
    """The kind of work a step represents."""

    #: A step that performs an action (side effect) and continues.
    TASK = "task"
    #: A branching point that routes based on conditions.
    DECISION = "decision"
    #: A step that waits for an approval decision recorded in the context.
    APPROVAL = "approval"
    #: The entry point of a workflow.
    START = "start"
    #: A terminal step; reaching it ends the workflow.
    END = "end"


class WorkflowStatus(str, Enum):
    """The lifecycle status of a workflow run."""

    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


# A step handler receives the mutable context and may return anything;
# the return value is stored in the context history for the step.
StepHandler = Callable[["WorkflowContext"], object]

# A transition guard receives the context and returns whether the
# transition may be followed.
TransitionGuard = Callable[["WorkflowContext"], bool]


@dataclass
class Transition:
    """A directed link from one step to another.

    Attributes:
        target: The identifier of the step this transition leads to.
        condition: Optional guard. When provided, the transition is only
            eligible if the guard returns a truthy value. When omitted the
            transition is always eligible.
        name: Optional human-readable label, useful for decision branches.
    """

    target: str
    condition: Optional["TransitionGuard"] = None
    name: Optional[str] = None

    def is_eligible(self, context: "WorkflowContext") -> bool:
        """Return whether this transition may be followed for ``context``."""
        if self.condition is None:
            return True
        return bool(self.condition(context))


@dataclass
class Step:
    """A single node in a workflow.

    Attributes:
        id: Unique identifier of the step within its workflow.
        type: The :class:`StepType` of the step.
        handler: Optional callable executed when the step is entered.
        transitions: Outgoing transitions evaluated in order.
        name: Optional human-readable name.
    """

    id: str
    type: StepType = StepType.TASK
    handler: Optional["StepHandler"] = None
    transitions: List[Transition] = field(default_factory=list)
    name: Optional[str] = None

    def add_transition(
        self,
        target: str,
        condition: Optional["TransitionGuard"] = None,
        name: Optional[str] = None,
    ) -> "Step":
        """Add an outgoing transition and return ``self`` for chaining."""
        self.transitions.append(
            Transition(target=target, condition=condition, name=name)
        )
        return self

    def is_terminal(self) -> bool:
        """Return whether this step ends the workflow."""
        return self.type == StepType.END


@dataclass
class WorkflowDefinition:
    """The static description of a workflow.

    A definition owns a collection of steps and knows which step is the
    entry point. Call :meth:`validate` to ensure the graph is well formed
    before executing it.
    """

    name: str
    steps: Dict[str, Step] = field(default_factory=dict)
    start_step_id: Optional[str] = None

    def add_step(self, step: Step, *, start: bool = False) -> Step:
        """Register ``step`` with the workflow.

        Args:
            step: The step to add.
            start: When ``True`` mark this step as the workflow entry point.

        Raises:
            WorkflowDefinitionError: If a step with the same id already
                exists, or if ``start`` is requested but a start step is
                already set.
        """
        if step.id in self.steps:
            raise WorkflowDefinitionError(
                f"Duplicate step id {step.id!r} in workflow {self.name!r}"
            )
        self.steps[step.id] = step
        if start or step.type == StepType.START:
            if self.start_step_id is not None and self.start_step_id != step.id:
                raise WorkflowDefinitionError(
                    f"Workflow {self.name!r} already has a start step "
                    f"{self.start_step_id!r}"
                )
            self.start_step_id = step.id
        return step

    def validate(self) -> None:
        """Validate the structural integrity of the workflow.

        Raises:
            WorkflowDefinitionError: If the workflow has no start step, has
                no steps, references an unknown transition target, or has a
                non-terminal step without outgoing transitions.
        """
        if not self.steps:
            raise WorkflowDefinitionError(
                f"Workflow {self.name!r} has no steps"
            )
        if self.start_step_id is None:
            raise WorkflowDefinitionError(
                f"Workflow {self.name!r} has no start step"
            )
        if self.start_step_id not in self.steps:
            raise WorkflowDefinitionError(
                f"Start step {self.start_step_id!r} is not a registered step"
            )

        has_end = False
        for step in self.steps.values():
            if step.is_terminal():
                has_end = True
            for transition in step.transitions:
                if transition.target not in self.steps:
                    raise WorkflowDefinitionError(
                        f"Step {step.id!r} has a transition to unknown "
                        f"step {transition.target!r}"
                    )
            if not step.is_terminal() and not step.transitions:
                raise WorkflowDefinitionError(
                    f"Non-terminal step {step.id!r} has no outgoing "
                    f"transitions"
                )
        if not has_end:
            raise WorkflowDefinitionError(
                f"Workflow {self.name!r} has no terminal (END) step"
            )
