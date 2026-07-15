"""Exceptions raised by the workflow engine."""


class WorkflowError(Exception):
    """Base class for all workflow-related errors."""


class WorkflowDefinitionError(WorkflowError):
    """Raised when a workflow definition is structurally invalid.

    Examples include a missing start step, a transition that points at an
    unknown step, or duplicate step identifiers.
    """


class WorkflowExecutionError(WorkflowError):
    """Raised when a workflow cannot make progress at run time.

    Examples include a step handler raising an unexpected error, or a
    non-terminal step having no satisfiable outgoing transition.
    """
