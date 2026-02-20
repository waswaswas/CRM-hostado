# Theme toggle not reacting – debug steps

Use these steps to find why the theme (palette) icon does nothing when clicked.

## 1. Enable console debug logs

**Option A – URL**

Open the app with:

```
http://localhost:3000/dashboard?theme_debug=1
```

(Replace with your real URL and path.)

**Option B – Console**

In DevTools Console run:

```js
window.__CRM_THEME_DEBUG__ = true
```

Then click the theme (palette) icon.

- If you see **`[DropdownMenu] trigger pointerdown`** and **`[DropdownMenu] toggle, open was false`**  
  → The trigger is receiving the event; the problem is likely menu visibility (position, z-index, or overflow).
- If you see **nothing**  
  → The trigger is not receiving the event (something is on top of it or blocking pointer events).

## 2. Check what’s under the cursor

In DevTools Console:

```js
// 1) Find the theme trigger (the palette icon area)
const wrapper = document.querySelector('[data-theme-trigger-wrapper]')
const trigger = document.querySelector('[data-theme-trigger]') || wrapper?.querySelector('button')
console.log('Trigger element', trigger)
if (trigger) {
  const r = trigger.getBoundingClientRect()
  const centerX = r.left + r.width / 2
  const centerY = r.top + r.height / 2
  // 2) What element is at the center of the icon?
  const atPoint = document.elementFromPoint(centerX, centerY)
  console.log('Element at icon center', atPoint, 'is trigger?', atPoint === trigger || trigger?.contains(atPoint))
}
```

- If **`atPoint`** is not the trigger (and not inside it), something is covering the icon.

## 3. Check overlays and stacking

- **Inspect** the theme icon in Elements: see if any parent has `overflow: hidden` or creates a stacking context that clips the dropdown.
- Check for a **fixed/absolute overlay** (e.g. loading overlay, modal backdrop) that might sit above the header and block clicks. Temporarily set that element to `pointer-events: none` and test again.

## 4. Test the dropdown in isolation

In Console:

```js
// Find the dropdown wrapper (has data-dropdown-menu)
const menu = document.querySelector('[data-dropdown-menu]')
console.log('Dropdown wrapper', menu)
// When the menu is open, a second [data-dropdown-menu] is portaled to body
const portaled = document.body.querySelectorAll('[data-dropdown-menu]')
console.log('All dropdown markers', portaled.length, portaled)
```

After clicking the icon, if debug is on you should see a log like **`[DropdownMenu] content rendering, trigger rect ...`**. If you see that but no menu on screen, the panel is likely off-screen or zero size (check `position` in the log).

## 5. Try both pointer and click

The menu opens on **pointerdown**. If you’re on a device or browser that doesn’t fire pointer events as expected, try:

- A normal mouse click.
- Tapping with a finger (touch).
- Running in a different browser (Chrome, Firefox, Safari).

## 6. Remove debug when done

- Close the tab or remove `?theme_debug=1`.
- Or run: `window.__CRM_THEME_DEBUG__ = false`

---

**Summary**

| What you see | Likely cause |
|--------------|----------------|
| No logs when clicking icon | Another element is capturing the click / overlay on top |
| Logs “trigger pointerdown” + “toggle” but no menu | Menu is opening but hidden (z-index, position, overflow) |
| Logs “content rendering” with a valid rect | Panel is rendered; check `position` and that it’s not clipped by a parent |
