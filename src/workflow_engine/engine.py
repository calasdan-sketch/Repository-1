"""Execution engine that runs a :class:`WorkflowDefinition`."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from workflow_engine.context import WorkflowContext
from workflow_engine.exceptions import WorkflowExecutionError
from workflow_engine.models import (
    Step,
    WorkflowDefinition,
    WorkflowStatus,
)


@dataclass
class StepResult:
    """The outcome of executing a single step.

    Attributes:
        step_id: The step that was executed.
        result: The value returned by the step handler (if any).
        next_step_id: The step selected to run next, or ``None`` if the
            workflow terminated at this step.
    """

    step_id: str
    result: object
    next_step_id: Optional[str]


class WorkflowEngine:
    """Executes workflow definitions against a context.

    The engine is stateless with respect to a single run: all mutable
    state lives in the :class:`WorkflowContext` that is passed in. This
    allows the same engine instance to run many workflows concurrently.

    Args:
        max_steps: Safety limit on the number of steps executed in a
            single run, guarding against accidental infinite loops.
    """

    def __init__(self, max_steps: int = 10_000) -> None:
        if max_steps <= 0:
            raise ValueError("max_steps must be positive")
        self.max_steps = max_steps

    def run(
        self,
        definition: WorkflowDefinition,
        context: Optional[WorkflowContext] = None,
    ) -> WorkflowContext:
        """Run ``definition`` to completion and return the final context.

        Args:
            definition: The workflow to execute. It is validated first.
            context: Optional pre-populated context. A fresh one is created
                when omitted.

        Returns:
            The context after execution, with ``status`` set to
            :attr:`WorkflowStatus.COMPLETED`.

        Raises:
            WorkflowDefinitionError: If the definition is invalid.
            WorkflowExecutionError: If execution cannot make progress.
        """
        definition.validate()
        context = context or WorkflowContext()
        context.status = WorkflowStatus.RUNNING

        current_id: Optional[str] = definition.start_step_id
        executed = 0
        try:
            while current_id is not None:
                if executed >= self.max_steps:
                    raise WorkflowExecutionError(
                        f"Workflow {definition.name!r} exceeded max_steps "
                        f"({self.max_steps}); possible infinite loop"
                    )
                step = definition.steps[current_id]
                outcome = self._execute_step(step, context)
                executed += 1
                current_id = outcome.next_step_id
        except WorkflowExecutionError:
            context.status = WorkflowStatus.FAILED
            raise

        context.status = WorkflowStatus.COMPLETED
        context.current_step_id = None
        return context

    def _execute_step(
        self, step: Step, context: WorkflowContext
    ) -> StepResult:
        """Execute a single step and select the next one."""
        context.current_step_id = step.id
        result = None
        if step.handler is not None:
            try:
                result = step.handler(context)
            except Exception as exc:  # noqa: BLE001 - surfaced as workflow error
                raise WorkflowExecutionError(
                    f"Step {step.id!r} handler raised: {exc}"
                ) from exc
        context.record(step.id, result)

        if step.is_terminal():
            return StepResult(step_id=step.id, result=result, next_step_id=None)

        next_step_id = self._select_transition(step, context)
        return StepResult(
            step_id=step.id, result=result, next_step_id=next_step_id
        )

    @staticmethod
    def _select_transition(step: Step, context: WorkflowContext) -> str:
        """Return the target of the first eligible outgoing transition."""
        for transition in step.transitions:
            if transition.is_eligible(context):
                return transition.target
        raise WorkflowExecutionError(
            f"No eligible transition from step {step.id!r}"
        )
