# Actions

Actions are non-navigation effects a user can trigger: send a message, like a post, submit a payment, delete an item. They are not declared anywhere; a control that performs one is tagged at the bind site so exploration and trajectory tools can find it.

## Action or navigation

| Navigation (`bindNav` / `nav.*`) | Action (`bindTap({ kind: 'action', id }, { onTrigger })`) |
|---|---|
| The URL changes: page, tab, dialog, drawer. | Data changes while the URL stays the same. |
| Tab switch, dialog open, drawer close. | Send, delete, like, follow, save, submit. |

- **Navigation + side effect on the same tap** → navigation, with the side effect in `beforeTrigger`.
- **"Submit then back" (确定 / 完成 / 发表)** → an action whose `onTrigger` performs the effect and then calls `nav.back()`.
- **Pure back / cancel / close overlay** → `bindBack()` (`data-trigger="system.back"`), no action id.

## Action ids

- **Regex**: `^[a-zA-Z0-9]+(\.[a-zA-Z0-9]+)+$`, at least three segments: `<domain>.<control>.<verb>` (recommended `<appId>.<page>.<control>.<verb>`). No `-` or `_`.
- Unique within the app. Per-list-item actions include `.item.` (`<appId>.<page>.item.<verb>`) and pass the item id in params.
- A toggle has one id, not separate enable / disable ids.
- Ids are **string literals** at the bind site.

## DOM binding

```text
data-action="<actionId>"
data-action-type="<gesture>"      // tap | longPress | doubleTap
data-action-params="<JSON>"        // when the action needs operands (item id, input value)
```

The gesture hooks produce these attributes; do not hand-craft them. Do not tag placeholders or disabled controls that do nothing.

A DOM node carries one meaning per gesture: a tap is either navigation or an action. Different gestures on one node may differ (an avatar that opens a profile on tap and cheers on double-tap); a single gesture must never both navigate and run an action.

## Related docs

- Route tables, `bindNav`, exploring an app's graph → [routes.md](routes.md)
- Runtime routing, back handling → [runtime-state.md](runtime-state.md)
