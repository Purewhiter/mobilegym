import { useAlipayStrings } from '../hooks/useAlipayStrings';
import React from 'react';
import { IcNavBack, IcInfo, IcPiggyBank, IcWallet, IcCard } from '../res/icons';
import { useAlipayStore } from '../state';
import { useAlipayGestures } from '../hooks/useAlipayGestures';
type Mode = 'system' | 'custom';

type PaymentMethod = {
  id: string;
  label: string;
  icon: React.ReactNode;
};

const arrayMove = <T,>(arr: T[], from: number, to: number) => {
  const copy = [...arr];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
};

const DragHandle: React.FC = () => {
  return (
    <div className="w-6 h-6 flex flex-col items-center justify-center gap-1">
      <div className="w-4 h-[2px] bg-gray-300 rounded-full"></div>
      <div className="w-4 h-[2px] bg-gray-300 rounded-full"></div>
      <div className="w-4 h-[2px] bg-gray-300 rounded-full"></div>
    </div>
  );
};

export const PayOrderSettingsPage: React.FC = () => {
  const s = useAlipayStrings();
  const { bindTap, bindBack } = useAlipayGestures();
  const settings = useAlipayStore(s => s.settings);
  const setSettings = useAlipayStore(s => s.setSettings);

  const baseMethods = React.useMemo<PaymentMethod[]>(
    () => [
      { id: 'yuebao', label: s.yue_bao, icon: <IcPiggyBank size={20} className="text-[#FF6E30]" /> },
      { id: 'balance', label: s.account_balance, icon: <IcWallet size={20} className="text-app-primary" /> },
      { id: 'ccb', label: s.ccb_debit_card_5445, icon: <IcCard size={20} className="text-app-primary" /> },
    ],
    [s]
  );

  const mode: Mode = settings.payment.payOrder.mode;
  const setMode = (next: Mode) => {
    setSettings((prev) => {
      const nextCustomOrderIds =
        next === 'custom' && (!prev.payment.payOrder.customOrderIds || prev.payment.payOrder.customOrderIds.length === 0)
          ? baseMethods.map((m) => m.id)
          : prev.payment.payOrder.customOrderIds;
      return { ...prev, payment: { ...prev.payment, payOrder: { ...prev.payment.payOrder, mode: next, customOrderIds: nextCustomOrderIds } } };
    });
  };

  const [order, setOrder] = React.useState<PaymentMethod[]>(() => {
    const ids = settings.payment.payOrder.customOrderIds;
    if (!ids || ids.length === 0) return baseMethods;
    const map = new Map(baseMethods.map((m) => [m.id, m]));
    const picked: PaymentMethod[] = [];
    for (const id of ids) {
      const item = map.get(id);
      if (item) picked.push(item);
    }
    for (const m of baseMethods) {
      if (!picked.find((p) => p.id === m.id)) picked.push(m);
    }
    return picked;
  });
  const orderRef = React.useRef(order);
  React.useEffect(() => {
    orderRef.current = order;
  }, [order]);

  React.useEffect(() => {
    if (mode !== 'custom') return;
    setSettings((prev) => {
      const ids = order.map((m) => m.id);
      const prevIds = prev.payment.payOrder.customOrderIds || [];
      if (prevIds.length === ids.length && prevIds.every((x, i) => x === ids[i])) return prev;
      return { ...prev, payment: { ...prev.payment, payOrder: { ...prev.payment.payOrder, customOrderIds: ids } } };
    });
  }, [order, mode, setSettings]);

  const itemRefs = React.useRef<Record<string, HTMLDivElement | null>>({});
  const pressTimerRef = React.useRef<number | null>(null);
  const draggingRef = React.useRef<{
    id: string;
    pointerId: number;
    isDragging: boolean;
  } | null>(null);
  const [draggingId, setDraggingId] = React.useState<string | null>(null);
  const cleanupDragListenersRef = React.useRef<(() => void) | null>(null);

  const clearPressTimer = () => {
    if (pressTimerRef.current !== null) {
      window.clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  };

  const startPress = (id: string, e: React.PointerEvent) => {
    if (mode !== 'custom') return;
    clearPressTimer();
    draggingRef.current = { id, pointerId: e.pointerId, isDragging: false };

    pressTimerRef.current = window.setTimeout(() => {
      if (!draggingRef.current || draggingRef.current.id !== id) return;
      draggingRef.current.isDragging = true;
      setDraggingId(id);
      cleanupDragListenersRef.current?.();
      const onMove = (ev: PointerEvent) => {
        const d = draggingRef.current;
        if (!d || !d.isDragging) return;
        if (ev.pointerId !== d.pointerId) return;

        const pointerY = ev.clientY;
        const list = orderRef.current;
        const entries = list
          .map((m) => ({ id: m.id, el: itemRefs.current[m.id] }))
          .filter((x) => x.el) as { id: string; el: HTMLDivElement }[];

        const over = entries.find(({ el }) => {
          const r = el.getBoundingClientRect();
          return pointerY >= r.top && pointerY <= r.bottom;
        });
        if (!over) return;

        const fromIndex = list.findIndex((m) => m.id === d.id);
        const toIndex = list.findIndex((m) => m.id === over.id);
        if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;
        setOrder((prev) => arrayMove(prev, fromIndex, toIndex));
      };

      const onUp = (ev: PointerEvent) => {
        const d = draggingRef.current;
        if (!d || ev.pointerId !== d.pointerId) return;
        endPress();
      };

      window.addEventListener('pointermove', onMove, { passive: true });
      window.addEventListener('pointerup', onUp, { passive: true });
      window.addEventListener('pointercancel', onUp, { passive: true });
      cleanupDragListenersRef.current = () => {
        window.removeEventListener('pointermove', onMove as any);
        window.removeEventListener('pointerup', onUp as any);
        window.removeEventListener('pointercancel', onUp as any);
        cleanupDragListenersRef.current = null;
      };
    }, 260);
  };

  const endPress = () => {
    clearPressTimer();
    cleanupDragListenersRef.current?.();
    draggingRef.current = null;
    setDraggingId(null);
  };

  React.useEffect(() => {
    return () => {
      cleanupDragListenersRef.current?.();
      clearPressTimer();
    };
  }, []);

  const RadioRow: React.FC<{
    title: string;
    selected: boolean;
    tapProps: any;
  }> = ({ title, selected, tapProps }) => {
    return (
      <div className="bg-app-surface rounded-xl overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-4 py-4 active:bg-gray-50" {...tapProps}>
          <div className="flex items-center">
            <span className="text-sm font-medium text-gray-900">{title}</span>
            <div className="ml-2 w-4 h-4 rounded-full border border-gray-300 flex items-center justify-center">
              <IcInfo size={12} className="text-gray-400" />
            </div>
          </div>
          <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${selected ? 'border-app-primary bg-app-primary' : 'border-gray-300'}`}>
            {selected && <div className="w-2 h-1 border-l-2 border-b-2 border-white rotate-[-45deg] -mt-0.5"></div>}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-app-bg h-full w-full flex flex-col pt-10">
      <div className="fixed top-0 left-0 right-0 h-10 bg-app-bg z-10 pointer-events-none"></div>
      <div className="sticky top-0 z-20 bg-app-bg px-4 pt-4 pb-2 flex items-center justify-between">
        <button {...bindBack<HTMLButtonElement>()} className="p-1 -ml-1">
          <IcNavBack size={24} className="text-gray-800" />
        </button>
        <span className="text-lg font-medium text-gray-800">{s.payment_order}</span>
        <div className="w-6" />
      </div>

      <div className="flex-1 overflow-auto no-scrollbar px-4 pb-6">
        <div className="text-xs text-gray-400 mt-2 mb-2">{s.general_2}</div>

        <div className="space-y-3">
          <RadioRow
            title={s.auto_match}
            selected={mode === 'system'}
            tapProps={bindTap<HTMLDivElement>({ kind: 'action', id: 'payOrder.mode.select.system' }, { onTrigger: () => setMode('system') })}
          />

          <div className="bg-app-surface rounded-xl overflow-hidden shadow-sm">
            <div
              className="flex items-center justify-between px-4 py-4 active:bg-gray-50"
              {...bindTap<HTMLDivElement>({ kind: 'action', id: 'payOrder.mode.select.custom' }, { onTrigger: () => setMode('custom') })}
            >
              <div className="flex items-center">
                <span className="text-sm font-medium text-gray-900">{s.custom_order}</span>
                <div className="ml-2 w-4 h-4 rounded-full border border-gray-300 flex items-center justify-center">
                  <IcInfo size={12} className="text-gray-400" />
                </div>
              </div>
              <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${mode === 'custom' ? 'border-app-primary bg-app-primary' : 'border-gray-300'}`}>
                {mode === 'custom' && <div className="w-2 h-1 border-l-2 border-b-2 border-white rotate-[-45deg] -mt-0.5"></div>}
              </div>
            </div>

            {mode === 'custom' && (
              <div className="px-4 pb-3">
                <div className="flex items-center justify-between text-sm text-gray-500 pb-2">
                  <div className="flex items-center">
                    <span className="text-app-primary font-medium">{s.pay_in_list_order}</span>
                    <span className="ml-1 text-gray-400">˅</span>
                  </div>
                  <span className="text-gray-400">{s.long_press_to_drag}</span>
                </div>

                <div className="bg-app-surface rounded-xl overflow-hidden divide-y divide-gray-100 border border-gray-100">
                  {order.map((m) => (
                    <div
                      key={m.id}
                      ref={(el) => {
                        itemRefs.current[m.id] = el;
                      }}
                      className={`flex items-center justify-between px-4 py-4 ${draggingId === m.id ? 'opacity-60' : ''}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center flex-shrink-0">
                          {m.icon}
                        </div>
                        <div className="text-sm text-gray-900 truncate">{m.label}</div>
                      </div>

                      <div
                        className="ml-3 flex-shrink-0 touch-none"
                        onPointerDown={(e) => {
                          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                          startPress(m.id, e);
                        }}
                        onPointerUp={() => endPress()}
                        onPointerCancel={() => endPress()}
                      >
                        <DragHandle />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
