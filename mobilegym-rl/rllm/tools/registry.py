from rllm.tools.tool_base import Tool


class ToolRegistry:
    """
    A registry for tools that handles registration, retrieval, and management.
    """

    _instance = None
    _initialized = False

    def __new__(cls):
        """
        Implement singleton pattern to ensure there's only one registry instance.
        """
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        """
        Initialize the registry if it hasn't been initialized yet.
        """
        if not ToolRegistry._initialized:
            self._tools: dict[str, type[Tool]] = {}
            ToolRegistry._initialized = True

    def register(self, name: str, tool_cls: type[Tool]) -> None:
        """
        Register a tool with the registry.

        Args:
            name: The name to register the tool under
            tool_cls: The tool class to register
        """
        if not issubclass(tool_cls, Tool):
            raise TypeError(f"Tool class must be a subclass of Tool, got {tool_cls}")

        self._tools[name] = tool_cls

    def register_all(self, tools_dict: dict[str, type[Tool]]) -> None:
        """
        Register multiple tools at once.

        Args:
            tools_dict: A dictionary mapping names to tool classes
        """
        for name, tool_cls in tools_dict.items():
            self.register(name, tool_cls)

    def get(self, name: str) -> type[Tool] | None:
        """
        Get a tool class by name.

        Args:
            name: The name of the tool to retrieve

        Returns:
            The tool class if found, None otherwise
        """
        return self._tools.get(name)

    def instantiate(self, name: str, *args, **kwargs) -> Tool | None:
        """
        Instantiate a tool by name.

        Args:
            name: The name of the tool to instantiate
            *args: Positional arguments to pass to the tool constructor
            **kwargs: Keyword arguments to pass to the tool constructor

        Returns:
            An instance of the tool if found, None otherwise
        """
        tool_cls = self.get(name)
        if tool_cls is None:
            return None
        return tool_cls(*args, **kwargs)

    def list_tools(self) -> list[str]:
        """
        List all registered tool names.

        Returns:
            A list of tool names
        """
        return list(self._tools.keys())

    def clear(self) -> None:
        """
        Clear all registered tools.
        """
        self._tools.clear()

    def unregister(self, name: str) -> bool:
        """
        Unregister a tool by name.

        Args:
            name: The name of the tool to unregister

        Returns:
            True if the tool was unregistered, False if it wasn't found
        """
        if name in self._tools:
            del self._tools[name]
            return True
        return False

    def __contains__(self, name: str) -> bool:
        """
        Check if a tool is registered.

        Args:
            name: The name of the tool to check

        Returns:
            True if the tool is registered, False otherwise
        """
        return name in self._tools

    def __getitem__(self, name: str) -> type[Tool]:
        """
        Get a tool class by name using dictionary-like syntax.

        Args:
            name: The name of the tool to retrieve

        Returns:
            The tool class

        Raises:
            KeyError: If the tool is not found
        """
        if name not in self._tools:
            raise KeyError(f"Tool '{name}' not found in registry")
        return self._tools[name]

    def __setitem__(self, name: str, tool_cls: type[Tool]) -> None:
        """
        Register a tool using dictionary-like syntax.

        Args:
            name: The name to register the tool under
            tool_cls: The tool class to register
        """
        self.register(name, tool_cls)

    def __iter__(self):
        """
        Iterate over tool names.

        Returns:
            An iterator over tool names
        """
        return iter(self._tools)

    def __len__(self) -> int:
        """
        Get the number of registered tools.

        Returns:
            The number of registered tools
        """
        return len(self._tools)

    def to_dict(self) -> dict[str, type[Tool]]:
        """
        Convert the registry to a dictionary.

        Returns:
            A dictionary mapping tool names to tool classes
        """
        return self._tools
