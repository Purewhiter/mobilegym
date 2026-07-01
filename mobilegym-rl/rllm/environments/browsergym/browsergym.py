import multiprocessing as mp

import gymnasium as gym

from rllm.environments.base.base_env import BaseEnv


class BrowserGymEnv(BaseEnv):
    def __init__(self, env_id="browsergym/openended", task=None, **env_kwargs):
        self.parent_conn, self.child_conn = mp.Pipe()
        self.process = mp.Process(target=self._worker, args=(self.child_conn, env_id, task, env_kwargs))
        self.timeout = None  # in seconds
        self.process.start()

    def _worker(self, conn, env_id, task, env_kwargs):
        # Import browsergym modules in the worker process to register environments
        try:
            import browsergym.miniwob  # noqa: F401
        except ImportError:
            pass

        env = (
            gym.make(
                env_id,
                task_kwargs=task,
                **env_kwargs,
                browser_args=[
                    "--no-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-application-cache",
                    "--disk-cache-size=1",
                    "--media-cache-size=1",
                    "--disable-cache",
                    "--disable-gpu",
                    "--disable-software-rasterizer",
                    "--incognito",
                ],
                user_data_dir=None,  # Forces incognito
            )
            if task
            else gym.make(env_id, **env_kwargs)
        )
        try:
            while True:
                cmd, data = conn.recv()
                if cmd == "reset":
                    obs = env.reset()
                    conn.send(obs)
                elif cmd == "step":
                    action = data
                    obs, reward, terminated, truncated, extra_info = env.step(action)
                    conn.send((obs, reward, terminated or truncated, extra_info))
                elif cmd == "close":
                    env.close()
                    conn.close()
                    break
        except EOFError:
            env.close()

    def reset(self):
        self.parent_conn.send(("reset", None))
        if self.timeout is not None:
            if not self.parent_conn.poll(self.timeout):
                raise TimeoutError(f"Timeout after {self.timeout} seconds waiting for response.")
        return self.parent_conn.recv()

    def step(self, action):
        self.parent_conn.send(("step", action))
        if self.timeout is not None:
            if not self.parent_conn.poll(self.timeout):
                raise TimeoutError(f"Timeout after {self.timeout} seconds waiting for response.")
        return self.parent_conn.recv()

    def close(self):
        self.parent_conn.send(("close", None))
        self.process.join(60 * 2)
        if self.process.is_alive():
            print(f"Process still alive after {self.timeout} seconds. Killing it.")
            self.process.terminate()
            self.process.join()

    @staticmethod
    def from_dict(extra_info: dict) -> "BrowserGymEnv":
        headless = extra_info.get("headless", True)
        timeout_ms = extra_info.get("timeout", 5000)
        return BrowserGymEnv(env_id=extra_info["env_id"], headless=headless, timeout=timeout_ms)

    @staticmethod
    def is_multithread_safe() -> bool:
        return True
