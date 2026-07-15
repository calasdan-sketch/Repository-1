"""Tests for the business workflow engine."""

import pytest

from workflow_engine import (
    Step,
    StepType,
    WorkflowContext,
    WorkflowDefinition,
    WorkflowEngine,
    WorkflowStatus,
)
from workflow_engine.exceptions import (
    WorkflowDefinitionError,
    WorkflowExecutionError,
)


def _linear_workflow() -> WorkflowDefinition:
    wf = WorkflowDefinition(name="linear")
    wf.add_step(Step(id="start", type=StepType.START), start=True)
    wf.add_step(
        Step(
            id="work",
            type=StepType.TASK,
            handler=lambda ctx: ctx.set("done", True) or "worked",
        )
    )
    wf.add_step(Step(id="end", type=StepType.END))
    wf.steps["start"].add_transition("work")
    wf.steps["work"].add_transition("end")
    return wf


def test_linear_workflow_runs_to_completion():
    engine = WorkflowEngine()
    context = engine.run(_linear_workflow())

    assert context.status == WorkflowStatus.COMPLETED
    assert context.history == ["start", "work", "end"]
    assert context.get("done") is True
    assert context.results["work"] == "worked"
    assert context.current_step_id is None


def test_conditional_branch_selects_first_eligible_transition():
    wf = WorkflowDefinition(name="branch")
    wf.add_step(Step(id="start", type=StepType.START), start=True)
    wf.add_step(Step(id="decide", type=StepType.DECISION))
    wf.add_step(Step(id="high", type=StepType.END))
    wf.add_step(Step(id="low", type=StepType.END))
    wf.steps["start"].add_transition("decide")
    wf.steps["decide"].add_transition(
        "high", condition=lambda ctx: ctx.get("value", 0) > 100
    )
    wf.steps["decide"].add_transition("low")

    engine = WorkflowEngine()

    high_ctx = engine.run(wf, WorkflowContext(data={"value": 500}))
    assert high_ctx.history[-1] == "high"

    low_ctx = engine.run(wf, WorkflowContext(data={"value": 5}))
    assert low_ctx.history[-1] == "low"


def test_missing_start_step_is_rejected():
    wf = WorkflowDefinition(name="broken")
    wf.add_step(Step(id="only", type=StepType.END))
    with pytest.raises(WorkflowDefinitionError):
        wf.validate()


def test_transition_to_unknown_step_is_rejected():
    wf = WorkflowDefinition(name="broken")
    wf.add_step(Step(id="start", type=StepType.START), start=True)
    wf.add_step(Step(id="end", type=StepType.END))
    wf.steps["start"].add_transition("missing")
    with pytest.raises(WorkflowDefinitionError):
        wf.validate()


def test_duplicate_step_id_is_rejected():
    wf = WorkflowDefinition(name="dup")
    wf.add_step(Step(id="a", type=StepType.START), start=True)
    with pytest.raises(WorkflowDefinitionError):
        wf.add_step(Step(id="a", type=StepType.END))


def test_non_terminal_step_without_transitions_is_rejected():
    wf = WorkflowDefinition(name="stuck")
    wf.add_step(Step(id="start", type=StepType.START), start=True)
    wf.add_step(Step(id="end", type=StepType.END))
    # start has no transitions
    with pytest.raises(WorkflowDefinitionError):
        wf.validate()


def test_no_eligible_transition_fails_at_runtime():
    wf = WorkflowDefinition(name="dead-end")
    wf.add_step(Step(id="start", type=StepType.START), start=True)
    wf.add_step(Step(id="decide", type=StepType.DECISION))
    wf.add_step(Step(id="end", type=StepType.END))
    wf.steps["start"].add_transition("decide")
    wf.steps["decide"].add_transition("end", condition=lambda ctx: False)

    engine = WorkflowEngine()
    context = WorkflowContext()
    with pytest.raises(WorkflowExecutionError):
        engine.run(wf, context)
    assert context.status == WorkflowStatus.FAILED


def test_handler_error_marks_workflow_failed():
    wf = WorkflowDefinition(name="boom")
    wf.add_step(Step(id="start", type=StepType.START), start=True)

    def _boom(ctx):
        raise RuntimeError("kaboom")

    wf.add_step(Step(id="task", type=StepType.TASK, handler=_boom))
    wf.add_step(Step(id="end", type=StepType.END))
    wf.steps["start"].add_transition("task")
    wf.steps["task"].add_transition("end")

    engine = WorkflowEngine()
    context = WorkflowContext()
    with pytest.raises(WorkflowExecutionError):
        engine.run(wf, context)
    assert context.status == WorkflowStatus.FAILED


def test_infinite_loop_is_bounded_by_max_steps():
    wf = WorkflowDefinition(name="loop")
    wf.add_step(Step(id="start", type=StepType.START), start=True)
    wf.add_step(Step(id="a", type=StepType.TASK))
    wf.add_step(Step(id="end", type=StepType.END))
    wf.steps["start"].add_transition("a")
    wf.steps["a"].add_transition("start")  # loops back forever

    engine = WorkflowEngine(max_steps=50)
    with pytest.raises(WorkflowExecutionError):
        engine.run(wf)


def test_purchase_approval_example_director_path():
    from examples.purchase_approval import build_workflow

    engine = WorkflowEngine()
    context = WorkflowContext(
        data={"amount": 25_000, "director_approved": True}
    )
    engine.run(build_workflow(), context)

    assert context.status == WorkflowStatus.COMPLETED
    assert "director_approval" in context.history
    assert "manager_approval" not in context.history
    assert context.results["finalize"] == "purchase created"


def test_purchase_approval_example_manager_rejection():
    from examples.purchase_approval import build_workflow

    engine = WorkflowEngine()
    context = WorkflowContext(
        data={"amount": 500, "manager_approved": False}
    )
    engine.run(build_workflow(), context)

    assert "manager_approval" in context.history
    assert context.results["finalize"] == "purchase denied"
