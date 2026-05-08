/**
 * Agent Bridge - WebSocket 桥接，允许外部 Agent 控制模拟器
 * 
 * 使用方法：
 * 1. 前端自动连接到 ws://localhost:8765
 * 2. MCP 服务器发送命令，前端执行
 * 3. 支持 tap, swipe, type, open_app, back, home 等操作
 */

import { APP_REGISTRY, isValidAppId } from './data/appRegistry';
import PackageManagerService from './PackageManagerService';
import { now as timeNow } from './TimeService';

type CommandHandler = (params: any) => Promise<any>;

interface AgentCommand {
  id: string;
  action: string;
  params: any;
}

interface AgentResponse {
  id: string;
  success: boolean;
  data?: any;
  error?: string;
}

// 从 manifest 自动派生：应用名称 → appId 映射
function buildAppNameMap(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const m of APP_REGISTRY) {
    map[m.displayName] = m.id;                           // 中文主名
    if (m.displayNameEn) map[m.displayNameEn] = m.id;   // 英文名
    map[m.id] = m.id;                                    // appId 自身
    for (const alias of m.aliases ?? []) map[alias] = m.id;
  }
  return map;
}
const APP_NAME_MAP = buildAppNameMap();

function resolveAppId(name: string): string {
  const pmResolved = PackageManagerService.queryByAlias(name);
  if (pmResolved) return pmResolved;
  // 先尝试直接映射
  if (APP_NAME_MAP[name]) {
    return APP_NAME_MAP[name];
  }
  // Case-insensitive 回退
  const lower = name.toLowerCase();
  for (const [key, value] of Object.entries(APP_NAME_MAP)) {
    if (key.toLowerCase() === lower) return value;
  }
  // 如果已经是有效的 appId，直接返回
  if (isValidAppId(lower)) return lower;
  // 否则返回原值，让 OS 层报错
  return name;
}

class AgentBridge {
  private ws: WebSocket | null = null;
  private reconnectTimer: number | null = null;
  private reconnectDelay = 3000;
  private readonly wsUrl = 'ws://localhost:8765';
  private handlers: Map<string, CommandHandler> = new Map();
  private connected = false;

  constructor() {
    this.registerHandlers();
    this.connect();
  }

  private registerHandlers() {
    // 点击
    this.handlers.set('tap', async (params: { x: number; y: number }) => {
      const { x, y } = params;
      if (window.__SIM_INPUT__?.tap) {
        window.__SIM_INPUT__.tap(x, y);
        return { success: true };
      }
      throw new Error('__SIM_INPUT__.tap not available');
    });

    // 双击
    this.handlers.set('double_tap', async (params: { x: number; y: number }) => {
      const { x, y } = params;
      if (window.__SIM_INPUT__?.doubleTap) {
        window.__SIM_INPUT__.doubleTap(x, y);
        return { success: true };
      }
      throw new Error('__SIM_INPUT__.doubleTap not available');
    });

    // 长按
    this.handlers.set('long_press', async (params: { x: number; y: number; duration?: number }) => {
      const { x, y, duration = 800 } = params;
      if (window.__SIM_INPUT__?.longPress) {
        await window.__SIM_INPUT__.longPress(x, y, duration);
        return { success: true };
      }
      throw new Error('__SIM_INPUT__.longPress not available');
    });

    // 滑动
    this.handlers.set('swipe', async (params: { x1: number; y1: number; x2: number; y2: number; duration?: number }) => {
      const { x1, y1, x2, y2, duration = 400 } = params;
      if (window.__SIM_INPUT__?.swipe) {
        // NOTE:
        // Agent/bench environments may run the simulator tab in background, where timers are heavily clamped.
        // Use fewer steps + no inertia to keep commands responsive under MCP timeouts.
        await window.__SIM_INPUT__.swipe(
          { x: x1, y: y1 },
          { x: x2, y: y2 },
          { ms: duration, steps: 2, inertia: false },
        );
        return { success: true };
      }
      throw new Error('__SIM_INPUT__.swipe not available');
    });

    // 输入文本
    this.handlers.set('type', async (params: { text: string; clear?: boolean }) => {
      const { text, clear = false } = params;
      if (window.__SIM_INPUT__?.type) {
        await window.__SIM_INPUT__.type(text, { clear });
        return { success: true };
      }
      throw new Error('__SIM_INPUT__.type not available');
    });

    // 返回
    this.handlers.set('back', async () => {
      if (window.__OS__?.handleBack) {
        window.__OS__.handleBack();
        return { success: true };
      }
      history.back();
      return { success: true };
    });

    // 回主页
    this.handlers.set('home', async () => {
      if (window.__OS__?.goHome) {
        window.__OS__.goHome();
        return { success: true };
      }
      throw new Error('__OS__.goHome not available');
    });

    // 打开应用
    this.handlers.set('open_app', async (params: { app_name: string }) => {
      const { app_name } = params;
      const appId = resolveAppId(app_name);
      console.log(`[AgentBridge] open_app: ${app_name} -> ${appId}`);
      if (!isValidAppId(appId)) {
        throw new Error(`Unknown app: ${app_name}`);
      }
      if (window.__OS__?.openApp) {
        window.__OS__.openApp(appId);
        return { success: true, appId };
      }
      throw new Error('__OS__.openApp not available');
    });

    // 通过文本或选择器点击元素
    this.handlers.set('tap_element', async (params: { text?: string; selector?: string }) => {
      const { text, selector } = params;
      let element: HTMLElement | null = null;
      
      if (selector) {
        element = document.querySelector(selector);
      } else if (text) {
        // 通过文本内容查找元素
        const walker = document.createTreeWalker(
          document.body,
          NodeFilter.SHOW_TEXT,
          null
        );
        
        let node: Text | null;
        while ((node = walker.nextNode() as Text | null)) {
          if (node.textContent?.includes(text)) {
            element = node.parentElement;
            break;
          }
        }
      }
      
      if (!element) {
        throw new Error(`Element not found: ${text || selector}`);
      }
      
      // 获取元素位置并点击
      const rect = element.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      
      if (window.__SIM_INPUT__?.tap) {
        window.__SIM_INPUT__.tap(x, y);
        return { 
          success: true, 
          element: element.tagName,
          text: element.textContent?.slice(0, 50),
          position: { x, y }
        };
      }
      throw new Error('__SIM_INPUT__.tap not available');
    });

    // 通过文本或选择器双击元素
    this.handlers.set('double_tap_element', async (params: { text?: string; selector?: string }) => {
      const { text, selector } = params;
      let element: HTMLElement | null = null;
      
      if (selector) {
        element = document.querySelector(selector);
      } else if (text) {
        const walker = document.createTreeWalker(
          document.body,
          NodeFilter.SHOW_TEXT,
          null
        );
        
        let node: Text | null;
        while ((node = walker.nextNode() as Text | null)) {
          if (node.textContent?.includes(text)) {
            element = node.parentElement;
            break;
          }
        }
      }
      
      if (!element) {
        throw new Error(`Element not found: ${text || selector}`);
      }
      
      const rect = element.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      
      if (window.__SIM_INPUT__?.doubleTap) {
        window.__SIM_INPUT__.doubleTap(x, y);
        return { 
          success: true, 
          element: element.tagName,
          text: element.textContent?.slice(0, 50),
          position: { x, y }
        };
      }
      throw new Error('__SIM_INPUT__.doubleTap not available');
    });

    // 通过文本或选择器长按元素
    this.handlers.set('long_press_element', async (params: { text?: string; selector?: string; duration?: number }) => {
      const { text, selector, duration = 800 } = params;
      let element: HTMLElement | null = null;
      
      if (selector) {
        element = document.querySelector(selector);
      } else if (text) {
        const walker = document.createTreeWalker(
          document.body,
          NodeFilter.SHOW_TEXT,
          null
        );
        
        let node: Text | null;
        while ((node = walker.nextNode() as Text | null)) {
          if (node.textContent?.includes(text)) {
            element = node.parentElement;
            break;
          }
        }
      }
      
      if (!element) {
        throw new Error(`Element not found: ${text || selector}`);
      }
      
      const rect = element.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      
      if (window.__SIM_INPUT__?.longPress) {
        await window.__SIM_INPUT__.longPress(x, y, duration);
        return { 
          success: true, 
          element: element.tagName,
          text: element.textContent?.slice(0, 50),
          position: { x, y }
        };
      }
      throw new Error('__SIM_INPUT__.longPress not available');
    });

    // 获取页面元素列表
    this.handlers.set('get_elements', async (params: { selector?: string; limit?: number }) => {
      const selector = params.selector || '*';
      const limit = params.limit || 0; // 0 = 不限制
      const elements: any[] = [];
      
      document.querySelectorAll(selector).forEach((el) => {
        const rect = el.getBoundingClientRect();
        // 只返回可见元素
        if (rect.width > 0 && rect.height > 0 && rect.top < window.innerHeight && rect.bottom > 0 && rect.left < window.innerWidth && rect.right > 0) {
          elements.push({
            tag: el.tagName.toLowerCase(),
            text: el.textContent?.slice(0, 100)?.trim(),
            className: el.className,
            id: el.id,
            rect: {
              x: Math.round(rect.left),
              y: Math.round(rect.top),
              width: Math.round(rect.width),
              height: Math.round(rect.height),
            }
          });
        }
      });
      
      return { elements: limit > 0 ? elements.slice(0, limit) : elements };
    });

    // 获取页面布局 HTML（整页或仅当前视口）
    this.handlers.set('get_layout_html', async (params: { visible_only?: boolean }) => {
      const visibleOnly = !!params?.visible_only;
      const win = window as Window & {
        getSimLayoutHTML?: (options: { visibleOnly: boolean }) => string;
      };

      let html: string;
      if (typeof win.getSimLayoutHTML === 'function') {
        html = win.getSimLayoutHTML({ visibleOnly });
      } else {
        html = document.documentElement.outerHTML;
      }

      return {
        html,
        visible_only: visibleOnly,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
        },
      };
    });

    // 获取状态
    this.handlers.set('get_state', async () => {
      if (window.__SIM__?.getState) {
        return { state: window.__SIM__.getState() };
      }
      return { state: null };
    });

    // 获取路由
    this.handlers.set('get_route', async () => {
      return { route: window.__OS__?.getAppRoute?.() || null };
    });

    // 重置
    this.handlers.set('reset', async () => {
      if (window.__SIM__?.reset) {
        await window.__SIM__.reset();
        return { success: true };
      }
      location.reload();
      return { success: true };
    });

    // Ping（用于测试连接）
    this.handlers.set('ping', async () => {
      return { pong: true, timestamp: timeNow() };
    });
  }

  private connect() {
    if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) return;

    try {
      this.ws = new WebSocket(this.wsUrl);

      this.ws.onopen = () => {
        this.connected = true;
        this.reconnectDelay = 3000;
        console.log('[AgentBridge] Connected to MCP server');
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
      };

      this.ws.onmessage = async (event) => {
        try {
          const command: AgentCommand = JSON.parse(event.data);
          const response = await this.handleCommand(command);
          this.send(response);
        } catch (error) {
          console.error('[AgentBridge] Error handling message:', error);
        }
      };

      this.ws.onclose = () => {
        this.connected = false;
        this.ws = null;
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {};
    } catch {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, this.reconnectDelay);
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
  }

  private async handleCommand(command: AgentCommand): Promise<AgentResponse> {
    const { id, action, params } = command;
    
    const handler = this.handlers.get(action);
    if (!handler) {
      return {
        id,
        success: false,
        error: `Unknown action: ${action}`,
      };
    }

    try {
      const data = await handler(params);
      return { id, success: true, data };
    } catch (error) {
      return {
        id,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private send(response: AgentResponse) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(response));
    }
  }
}

// 自动初始化
let bridgeInstance: AgentBridge | null = null;

export function initAgentBridge() {
  if (!bridgeInstance) {
    bridgeInstance = new AgentBridge();
    console.log('[AgentBridge] Initialized');
  }
  return bridgeInstance;
}

// 自动启动
if (typeof window !== 'undefined') {
  // 延迟启动，等待 __SIM_INPUT__ 等初始化
  setTimeout(() => {
    initAgentBridge();
  }, 1000);
}

export default AgentBridge;
