type BackHandler = {
  id: string;
  priority: number;
  handler: () => boolean;
};

const handlers = new Map<string, BackHandler>();

// 帧级去重：浏览器的 mouseup→click 在同一帧内触发，
// 当 edge-swipe(mouseup) 和 backdrop.onClick(click) 都调用 handleBack() 时，
// 只有第一次生效，第二次被锁跳过。rAF 在下一帧释放锁。
let _backLock = false;

export const BackDispatcher = {
  register(id: string, handler: () => boolean, priority: number = 0): () => void {
    if (!id || typeof handler !== 'function') return () => {};
    handlers.set(id, { id, priority, handler });
    return () => {
      const current = handlers.get(id);
      if (current && current.handler === handler) {
        handlers.delete(id);
      }
    };
  },

  handleBack(): boolean {
    if (_backLock) return false;

    const chain = [...handlers.values()].sort((a, b) => b.priority - a.priority);
    for (const item of chain) {
      try {
        if (item.handler()) {
          _backLock = true;
          requestAnimationFrame(() => { _backLock = false; });
          return true;
        }
      } catch (err) {
        console.error(`[BackDispatcher] handler failed: ${item.id}`, err);
      }
    }
    return false;
  },
};

export default BackDispatcher;
