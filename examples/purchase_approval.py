"""Example: a purchase-order approval business workflow.

This demonstrates how to assemble the building blocks from
:mod:`workflow_engine` into a realistic business process:

    start -> validate -> decision (amount threshold)
        -> manager approval (small amounts)   -> finalize -> end
        -> director approval (large amounts)  -> finalize -> end

Run it directly with ``python -m examples.purchase_approval``.
"""

from __future__ import annotations

from workflow_engine import (
    Step,
    StepType,
    WorkflowContext,
    WorkflowDefinition,
    WorkflowEngine,
)

# Amount above which a director (rather than a manager) must approve.
DIRECTOR_THRESHOLD = 10_000


def _validate_request(context: WorkflowContext) -> str:
    amount = context.get("amount")
    if amount is None or amount <= 0:
        raise ValueError("Purchase request must have a positive amount")
    return "validated"


def _manager_approval(context: WorkflowContext) -> str:
    # In a real system this would wait for an external decision; here we
    # read a decision previously recorded in the context.
    approved = context.get("manager_approved", False)
    context.set("approved", approved)
    return "approved" if approved else "rejected"


def _director_approval(context: WorkflowContext) -> str:
    approved = context.get("director_approved", False)
    context.set("approved", approved)
    return "approved" if approved else "rejected"


def _finalize(context: WorkflowContext) -> str:
    return "purchase created" if context.get("approved") else "purchase denied"


def build_workflow() -> WorkflowDefinition:
    """Build and return the purchase-approval workflow definition."""
    workflow = WorkflowDefinition(name="purchase-approval")

    workflow.add_step(Step(id="start", type=StepType.START), start=True)
    workflow.add_step(
        Step(id="validate", type=StepType.TASK, handler=_validate_request)
    )
    workflow.add_step(Step(id="route", type=StepType.DECISION))
    workflow.add_step(
        Step(
            id="manager_approval",
            type=StepType.APPROVAL,
            handler=_manager_approval,
        )
    )
    workflow.add_step(
        Step(
            id="director_approval",
            type=StepType.APPROVAL,
            handler=_director_approval,
        )
    )
    workflow.add_step(
        Step(id="finalize", type=StepType.TASK, handler=_finalize)
    )
    workflow.add_step(Step(id="end", type=StepType.END))

    workflow.steps["start"].add_transition("validate")
    workflow.steps["validate"].add_transition("route")

    # Decision branches: large amounts go to a director, others to a manager.
    workflow.steps["route"].add_transition(
        "director_approval",
        condition=lambda ctx: ctx.get("amount", 0) > DIRECTOR_THRESHOLD,
        name="requires director",
    )
    workflow.steps["route"].add_transition(
        "manager_approval", name="requires manager"
    )

    workflow.steps["manager_approval"].add_transition("finalize")
    workflow.steps["director_approval"].add_transition("finalize")
    workflow.steps["finalize"].add_transition("end")

    return workflow


def main() -> None:
    workflow = build_workflow()
    engine = WorkflowEngine()

    context = WorkflowContext(
        data={"amount": 25_000, "director_approved": True}
    )
    engine.run(workflow, context)

    print(f"Status:  {context.status.value}")
    print(f"Path:    {' -> '.join(context.history)}")
    print(f"Outcome: {context.results.get('finalize')}")


if __name__ == "__main__":
    main()
