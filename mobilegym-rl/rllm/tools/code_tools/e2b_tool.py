import os
from typing import Any

try:
    from e2b_code_interpreter import Sandbox
except ImportError:
    Sandbox = None

from rllm.tools.code_tools.code_tool import CodeTool, CodeToolOutput

E2B_API_KEY = os.environ.get("E2B_API_KEY", None)


class E2BPythonInterpreter(CodeTool):
    """A tool for executing Python code in a sandboxed environment."""

    def __init__(self, n_sandboxes=1, api_key=E2B_API_KEY):
        if Sandbox is None:
            raise ImportError("e2b_code_interpreter is not installed. Please install it with `pip install e2b-code-interpreter`.")
        assert n_sandboxes > 0, "Number of sandboxes must be greater than 0"
        self.n_sandboxes = n_sandboxes
        self.api_key = api_key
        self._init_sandbox()
        super().__init__(name="e2b_python", description="A tool that executes python code in a sandbox and returns standard output/error.")

    def _init_sandbox(self):
        """Initialize multiple sandbox environments."""
        self.sandboxes = []
        self.cur_sandbox_idx = 0
        for _ in range(self.n_sandboxes):
            sandbox = Sandbox(api_key=self.api_key, timeout=3600)
            self.sandboxes.append(sandbox)

    def _kill_sandbox(self):
        """Clean up all sandbox resources."""
        for sandbox in self.sandboxes:
            try:
                sandbox.kill()
            except Exception as e:
                print(f"Error killing sandbox: {e}")
        self.sandboxes = []

    def _restart_sandbox(self, id: int = 0) -> Any:
        """Restart a sandbox and return a new one."""
        previous_sandbox = self.sandboxes[id]
        previous_sandbox.kill()
        sandbox = Sandbox(api_key=self.api_key, timeout=3600)
        self.sandboxes[id] = sandbox
        return sandbox

    def forward(self, code: str, timeout: int = 20, **kwargs) -> CodeToolOutput:
        """
        Execute Python code in one of the sandboxes using round-robin distribution.

        Args:
            code: Python code to execute
            timeout: Maximum execution time in seconds
            **kwargs: Additional parameters including id, max_retries

        Returns:
            CodeToolOutput containing execution results, stdout, and stderr
        """
        id = kwargs.get("id", None)
        max_retries = kwargs.get("max_retries", 3)

        if id:
            self.cur_sandbox_idx = id % self.n_sandboxes
        else:
            # Round-robin distribution
            self.cur_sandbox_idx = (self.cur_sandbox_idx + 1) % self.n_sandboxes
        sandbox = self.sandboxes[self.cur_sandbox_idx]

        while max_retries > 0:
            try:
                execution = sandbox.run_code(code, timeout=timeout)
                break
            except Exception:
                max_retries -= 1
                if max_retries == 0:
                    self._restart_sandbox(self.cur_sandbox_idx)
                    return CodeToolOutput(name=self.name or "e2b_python", error="Sandbox error, please try again.")

        # Create a CodeToolOutput object instead of a dictionary
        result = None
        stdout = None
        stderr = None

        if execution.results:
            assert len(execution.results) == 1, "Only one result is supported"
            result = execution.results[0].text

        if execution.logs:
            assert len(execution.logs.stdout) == 1, "Only one stdout is supported"
            stdout = execution.logs.stdout[0]

        if execution.error:
            stderr = f"{execution.error.traceback}"

        return CodeToolOutput(name=self.name or "e2b_python", stdout=stdout or None, stderr=stderr or None, output=result or None)

    @property
    def json(self) -> dict[str, Any]:
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": {
                    "type": "object",
                    "properties": {
                        "code": {
                            "type": "string",
                            "description": "Python code to execute in a E2B sandbox environment.",
                        }
                    },
                    "required": ["code"],
                },
            },
        }


if __name__ == "__main__":
    from pprint import pprint

    interpreter = E2BPythonInterpreter()
    pprint(interpreter("print('Hello, world!')\nprint('Run run run.')\nimport math\nmath.sqrt(4)\nmath.sqrt(3)"))

    # Run the code using asyncio
    import asyncio

    async def test_interpreter():
        coro = interpreter(code="print('Hello, world!')\nprint('Clown world.')\nimport math\nmath.sqrt(4)\nmath.sqrt(3)\nmath.lol", use_async=True)
        print("Starting coroutine...")
        result = await coro
        pprint(result)

    # Run the async test
    asyncio.run(test_interpreter())
