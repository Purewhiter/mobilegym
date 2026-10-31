# Input and Keyboard

This page documents the simulated input stack: pointer events, soft keyboard state, IME behavior, and the `adjustResize` layout contract.

For service API signatures, see [`README.md`](README.md). For app UI rules, see [`../../app/module-contract.md`](../../app/module-contract.md).

## Components

| Area | Implementation | Responsibility |
|---|---|---|
| Soft keyboard state | `os/keyboard/KeyboardService.ts` | Volatile store for visibility, height, and mode. |
| Keyboard overlay UI | `os/components/KeyboardOverlay.tsx` | Renders the keyboard, handles focus, text insertion, dismissal, and smart scroll. |
| Activity resize | `os/components/ActivityHost.tsx` (`AdjustResizeContainer`) | Wraps each Activity in `data-adjust-resize` and shrinks the active one by keyboard height. |
| Global hide rule | `app.css` | Hides `[data-hide-on-keyboard]` inside an active resize container. |
| IME dictionary | `os/keyboard/pinyinData.ts`, `os/keyboard/pinyinLargeDict.ts`, `os/keyboard/pinyinIme.ts` | Chinese pinyin candidate generation. |
| IME build script | `scripts/ime/build_pinyin_dict.mjs` | Generates the large pinyin dictionary from source dictionaries. |

## KeyboardService

`KeyboardService` is exposed as `window.__OS__.keyboard`.

```ts
__OS__.keyboard.show();
__OS__.keyboard.hide();
__OS__.keyboard.isVisible();
__OS__.keyboard.getHeight();
__OS__.keyboard.setHeight(280);
__OS__.keyboard.setMode('zh'); // or 'en'
__OS__.keyboard.toggleMode();
__OS__.keyboard.subscribe(state => {});
```

Current state shape:

```ts
type KeyboardMode = 'en' | 'zh';

interface KeyboardServiceState {
  visible: boolean;
  mode: KeyboardMode;
  height: number;
}
```

The store is volatile. Refreshing the simulator resets it to hidden, English mode, height `0`.

When `show()` is called, height is set from `SIMULATOR_CONFIG.framework.keyboardHeight` unless overridden later with `setHeight()`.

## Back behavior

The keyboard registers a `BackDispatcher` handler named `keyboard.dismiss` at priority `700`.

When the keyboard is visible, system back hides the keyboard and consumes the event. App-level back handlers should not duplicate this behavior.

## Focus and dismissal

`KeyboardOverlay` listens globally:

| Event | Behavior |
|---|---|
| `focusin` on an editable element | Shows the keyboard and schedules smart scroll. |
| `focusout` | Hides the keyboard unless the blurred editable itself is inside a `data-keep-keyboard` container. |
| capture-phase `click` on an already focused editable element | Reopens or scrolls without disturbing pointer sequences. |
| capture-phase `pointerdown` outside the keyboard, editable element, gesture bar, or `data-keep-keyboard` | Hides the keyboard; pointer down inside `data-keep-keyboard` does not dismiss it. |
| DOM removal of the focused input | Hides the keyboard during route changes or unmounts. |

Editable detection is handled inside `KeyboardOverlay`; app components generally only need ordinary `<input>`, `<textarea>`, or content-editable elements.

## adjustResize

`SystemShell` wraps every mounted Activity:

```tsx
<div
  data-adjust-resize
  data-keyboard-active
  style={{ height: `calc(100% - ${keyboardHeight}px)` }}
>
  {activity}
</div>
```

Only the active Activity subscribes to keyboard height. Background activities remain mounted but do not re-render for keyboard changes.

Apps should therefore use normal flex layouts:

```tsx
<div className="h-full flex flex-col">
  <main className="flex-1 overflow-y-auto">...</main>
  <div className="flex-shrink-0" data-keep-keyboard="true">
    <input />
  </div>
</div>
```

Do not position chat inputs with `position: fixed` and a keyboard-height bottom offset. CSS zoom from `designViewportWidth` can make fixed positioning drift away from the resized Activity bounds.

## Layout attributes

| Attribute | Owner | Behavior |
|---|---|---|
| `data-adjust-resize` | OS only | Marks the Activity container whose height is reduced while the keyboard is visible. |
| `data-keyboard-active` | OS only | Added to the active resize container while keyboard height is non-zero. |
| `data-hide-on-keyboard` | App or OS UI | Hidden by global CSS when inside `[data-keyboard-active]`. Use for bottom tab bars or toasts that should not be pushed above the keyboard. |
| `data-keep-keyboard` | App or OS UI | Marks input accessories that should not dismiss the keyboard and should skip smart auto-scroll. |
| `data-keyboard-scroll="none"` | App UI | Disables smart auto-scroll for a specific editable region. |

The hide rule is currently:

```css
[data-keyboard-active] [data-hide-on-keyboard] {
  display: none !important;
}
```

## Smart scroll

When an editable element receives focus, `KeyboardOverlay` attempts a minimal scroll similar to Android `ScrollView.requestChildRectangleOnScreen()`.

The algorithm:

1. Find the nearest `[data-adjust-resize]` wrapper.
2. Use that wrapper's bottom edge as the visible bottom.
3. If the focused element would be covered, find the nearest scrollable parent.
4. Scroll only enough to expose the element plus a small margin.
5. Skip this work for elements inside `data-keep-keyboard` or `data-keyboard-scroll="none"`.

This is a fallback for ordinary form fields. Chat bars and bottom input toolbars should rely on flex layout plus `adjustResize`.

## Pointer events

App-level continuous gestures should use Pointer Events:

```tsx
onPointerDown
onPointerMove
onPointerUp
onPointerCancel
```

Use `setPointerCapture()` when the interaction must continue after the pointer leaves the element. Do not maintain parallel `touch*` and `mouse*` handlers for the same drag/slider/swipe behavior.

The simulator and keyboard internals may synthesize lower-level events for compatibility, but app code should expose a single pointer-event path for continuous interactions.

## IME modes

The current keyboard modes are:

| Mode | Behavior |
|---|---|
| `en` | Direct Latin keyboard input. |
| `zh` | Pinyin composition with candidates from the bundled pinyin dictionaries. |

`toggleMode()` switches between `en` and `zh`.

## App checklist

- Put page content in a full-height flex column when it has a bottom input/accessory.
- Mark keyboard-attached bars with `data-keep-keyboard="true"`.
- Mark bottom tab bars that should disappear with `data-hide-on-keyboard`.
- Use `flex-shrink-0` for input bars and let the Activity container resize.
- Use Pointer Events for drags, sheets, sliders, and other continuous gestures.
- Let system back dismiss the keyboard through `BackDispatcher`; do not register app-level keyboard dismissal handlers.
