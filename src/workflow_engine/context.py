"""Runtime state carried through a single execution of a workflow."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from workflow_engine.models import WorkflowStatus


@dataclass
class WorkflowContext:
    """Mutable state for one run of a workflow.

    The context is passed to every step handler and transition guard,
    allowing business data to flow through the process. It also records
    the path taken and the current status.

    Attributes:
        data: Arbitrary business data shared between steps.
        history: Ordered list of step ids that have been executed.
        status: Current :class:`~workflow_engine.models.WorkflowStatus`.
        current_step_id: The step currently being processed, if any.
        results: Return values produced by step handlers, keyed by step id.
    """

    data: Dict[str, Any] = field(default_factory=dict)
    history: List[str] = field(default_factory=list)
    status: WorkflowStatus = WorkflowStatus.PENDING
    current_step_id: Optional[str] = None
    results: Dict[str, Any] = field(default_factory=dict)

    def get(self, key: str, default: Any = None) -> Any:
        """Return a value from the shared business data."""
        return self.data.get(key, default)

    def set(self, key: str, value: Any) -> None:
        """Set a value in the shared business data."""
        self.data[key] = value

    def record(self, step_id: str, result: Any = None) -> None:
        """Record that ``step_id`` executed, storing its ``result``."""
        self.history.append(step_id)
        if result is not None:
            self.results[step_id] = result
