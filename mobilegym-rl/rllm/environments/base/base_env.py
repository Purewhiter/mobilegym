from abc import ABC, abstractmethod
from typing import Any


class BaseEnv(ABC):
    @property
    def idx(self) -> Any:
        """The index or identifier of the environment, often used within a batch.

        Returns:
            The assigned index or identifier, or None if not set.
        """
        # Return the stored _idx value if it exists, otherwise return None.
        return getattr(self, "_idx", None)

    @idx.setter
    def idx(self, value: Any):
        """Set the environment index or identifier.

        This allows assigning an index or identifier (e.g., its position in a batch)
        to the environment instance after it has been created.

        Example:
            env = MyEnvSubclass()  # Assuming MyEnvSubclass inherits from BaseEnv
            env.idx = 5            # Set the index externally

        Args:
            value: The index or identifier to set for this environment.
        """
        self._idx = value

    @abstractmethod
    def reset(self) -> tuple[dict, dict]:
        """Standard Gym reset method. Resets the environment to an initial state.

        Returns:
            A tuple typically containing the initial observation and auxiliary info.
        """
        pass

    @abstractmethod
    def step(self, action: Any) -> tuple[Any, float, bool, dict]:
        """Standard Gym step method. Executes one time step within the environment.

        Args:
            action: An action provided by the agent.

        Returns:
            A tuple containing (observation, reward, done, info).
        """
        pass

    def close(self):
        """Standard Gym close method. Performs any necessary cleanup."""
        return

    @staticmethod
    @abstractmethod
    def from_dict(info: dict) -> "BaseEnv":
        """Creates an environment instance from a dictionary.

        This method should be implemented by concrete subclasses to handle
        environment-specific initialization from serialized data.

        Args:
            info: A dictionary containing the necessary information to initialize the environment.

        Returns:
            An instance of the specific BaseEnv subclass.

        Raises:
            NotImplementedError: If the subclass does not implement this method.
        """
        # BaseEnv is abstract, subclasses must implement this factory method.
        raise NotImplementedError("Subclasses must implement the 'from_dict' static method.")

    @staticmethod
    def is_multithread_safe() -> bool:
        return True
