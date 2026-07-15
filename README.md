# Business Workflow Engine

A lightweight, general-purpose engine for modelling and running **business
workflows** — approvals, onboarding, order fulfilment, and any other
multi-step process — in plain Python with no external dependencies.

## Structure

```
.
├── src/workflow_engine/      # The reusable engine package
│   ├── __init__.py           # Public API
│   ├── models.py             # Step, Transition, WorkflowDefinition, enums
│   ├── context.py            # WorkflowContext (per-run mutable state)
│   ├── engine.py             # WorkflowEngine executor + StepResult
│   └── exceptions.py         # Error hierarchy
├── examples/
│   └── purchase_approval.py  # End-to-end purchase-order approval example
├── tests/
│   └── test_engine.py        # Unit tests
└── pyproject.toml            # Packaging & pytest configuration
```

## Core concepts

| Concept              | Description                                                        |
| -------------------- | ------------------------------------------------------------------ |
| `Step`               | A node of work: `TASK`, `DECISION`, `APPROVAL`, `START`, or `END`. |
| `Transition`         | A directed, optionally conditional link between two steps.         |
| `WorkflowDefinition` | The static graph of steps and transitions. Validate before running.|
| `WorkflowContext`    | Mutable state carried through one run (data, history, results).    |
| `WorkflowEngine`     | Executes a definition against a context.                           |

A workflow is a directed graph: execution starts at the `START` step and
follows the first *eligible* outgoing transition at each step (a transition
is eligible when it has no condition or its condition returns truthy) until
an `END` step is reached.

## Quick start

```python
from workflow_engine import (
    Step, StepType, WorkflowDefinition, WorkflowEngine, WorkflowContext,
)

wf = WorkflowDefinition(name="greeting")
wf.add_step(Step(id="start", type=StepType.START), start=True)
wf.add_step(Step(id="greet", type=StepType.TASK,
                 handler=lambda ctx: ctx.set("msg", "hello")))
wf.add_step(Step(id="end", type=StepType.END))
wf.steps["start"].add_transition("greet")
wf.steps["greet"].add_transition("end")

context = WorkflowEngine().run(wf)
print(context.status.value)   # completed
print(context.history)        # ['start', 'greet', 'end']
print(context.get("msg"))     # hello
```

## Running the example

After installing (see below) — or with `src` on your path:

```bash
pip install -e .            # once, so `workflow_engine` is importable
python -m examples.purchase_approval
# or without installing:
PYTHONPATH=src python -m examples.purchase_approval
```

## Development

Install in editable mode with the test extras and run the tests:

```bash
pip install -e ".[dev]"
pytest
```

## Design notes

* **Separation of definition and execution.** `models.py` describes *what*
  a workflow is; `engine.py` describes *how* it runs. The same definition
  can be run many times.
* **Stateless engine.** All mutable per-run state lives in
  `WorkflowContext`, so a single `WorkflowEngine` can run many workflows
  concurrently.
* **Fail fast.** `WorkflowDefinition.validate()` catches structural
  problems (missing start/end, dangling transitions, unreachable dead-ends)
  before execution, and a `max_steps` guard prevents runaway loops.
