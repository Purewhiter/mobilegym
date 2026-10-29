# App UI Shell

This page collects app-facing shell rules: status bar space, navigation bar foreground, keyboard resize, pointer events, and URL-driven UI state. The complete app contract remains in [module-contract.md](module-contract.md).

## Status and Navigation Bars

Every page's outermost element must reserve status bar space:

```tsx
<main className="pt-10 ..." data-status-bar-foreground="dark">
  ...
</main>
```

Use:

| Attribute | Values | Purpose |
|---|---|---|
| `data-status-bar-foreground` | `dark` / `light` | Sets status bar icon/text color for that page. |
| `data-navigation-bar-foreground` | `dark` / `light` | Sets bottom gesture bar color when it differs from the status bar. |

The OS no longer relies on DOM color auto-detection fallback. Declare the foreground when a page differs from the manifest default.

### Device status bar profile

The status bar and gesture bar are drawn from a device profile in `os/chrome/` (`redmi-note12-turbo-hyperos3`): the phone's SystemUI icons, clock font and measured positions (37 dp status bar, 16 dp gesture area). It is the default for the launcher, recents and every app. It shows the current OS state — signal and network type, Wi-Fi level and generation (`hardware.wifi.standard`), battery and charging, NFC, Bluetooth, alarm, headset, silent mode, VPN — and one small icon per app with unread notifications. Set the `device_chrome_profile` preference to `legacy` for the earlier drawn status bar; a non-default status-bar theme also takes precedence.

Apps only declare foreground colors (below) and reserve the 37 dp; they never draw status-bar content themselves.

### Foreground fallback chain

The system chrome resolves its foreground color from declarative signals only — it never samples the page's background pixels.

**Status bar**:

1. The current page's `data-status-bar-foreground` (if set).
2. The app manifest's `theme.colors.statusBarForeground` (if set).
3. Default dark.

**Bottom gesture (navigation) bar**:

1. The current page's `data-navigation-bar-foreground` (if set).
2. The app manifest's `theme.colors.navigationBarForeground` (if set).
3. The current page's `data-status-bar-foreground` (status-bar fallback).
4. The app manifest's `theme.colors.statusBarForeground`.
5. Default dark.

Place declarative attributes on the **outermost page container**. Don't render a status-bar background of your own — the OS draws transparent chrome over your page, and `pt-10` is the only spacing convention.

## Keyboard Resize

The OS implements Android-like `adjustResize`: when the keyboard is visible, the active Activity container shrinks by keyboard height. App pages should use flex layouts so content reflows naturally.

Rules:

| Do | Avoid |
|---|---|
| Use `flex` layout and `flex-shrink-0` for chat/input bars. | `position: fixed; bottom: keyboardHeight`. |
| Add `data-keep-keyboard="true"` on keyboard-attached controls that should not blur input. | Manual keyboard-height positioning. |
| Add `data-hide-on-keyboard` for bottom tabs that should disappear while typing. | Letting tab bars get pushed above the keyboard. |

CSS zoom from `designViewportWidth` changes coordinate spaces; fixed bottom offsets are especially prone to drift.

## Pointer Events

Continuous interactions — drag, swipe, slider, bottom sheet, drawer, drag-to-reorder, page-turning — must use a single Pointer Event source:

```tsx
onPointerDown
onPointerMove
onPointerUp
onPointerCancel
```

Use `setPointerCapture` when dragging should continue after the pointer leaves the element.

Hard rules:

- **Do not** maintain parallel `touch*` + `mouse*` handlers on the same element. They fire from different event paths and create double-trigger bugs.
- **Do not** rely on `touchmove` for the drag body with a `click` "fallback" for mouse. Pointer events already unify both.
- The bench's `bindTap` / `bindLongPress` / `bindDoubleTap` / `bindBack` hooks **do not** replace a custom drag implementation — they're for discrete taps. Slider thumbs, reader pagination handles, and draggable overlays must implement their own pointer handlers.
- The `mousedown` handlers used to `preventDefault` and stop focus theft on inputs are acceptable; they don't drive a drag state machine.

> DevTools "touch device emulation" simulates touch then synthesizes mouse/click events, producing ghost double-fires that can mask Pointer-event correctness bugs. Use it for layout/scale checks only; validate continuous interactions against a real mouse and a non-emulated touch surface.

## URL-Driven UI State

Discrete UI state belongs in the route/history stack:

| UI state | Preferred modeling |
|---|---|
| Main tabs | Separate pathname routes such as `/`, `/contacts`, `/me`; switch with `replace`. |
| Dialogs / drawers | Push search params or dialog routes; close with back. |
| Finite substates | `uiStates` in `navigation.declaration.ts`. |

Avoid `useState` for modal visibility when Back should close the modal. App Back only understands URL/history state.

## Related Docs

- Keyboard and IME details → [../os/services/input-keyboard.md](../os/services/input-keyboard.md)
- Navigation declaration grammar → [../navigation/declaration.md](../navigation/declaration.md)
- App contract → [module-contract.md](module-contract.md)
