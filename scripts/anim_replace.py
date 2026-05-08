#!/usr/bin/env python3
"""
Remove Tailwind animation classes from className strings and add CSS-var-based
inline style={{ transition: '...' }} after the className attribute.

Works on single-line className="..." and className={`...`} patterns only.
Multi-line or already-has-style cases are left unchanged (print a warning).
"""
import re
import sys
import os

DURATION_MAP = {
    'duration-100': 'var(--app-duration-quick)',
    'duration-150': 'var(--app-duration-quick)',
    'duration-200': 'var(--app-duration-short)',
    'duration-300': 'var(--app-duration-medium)',
    'duration-500': 'var(--app-duration-long)',
}
EASING_MAP = {
    'ease-in-out': 'var(--app-easing-standard)',
    'ease-out':    'var(--app-easing-decelerate)',
    'ease-in':     'var(--app-easing-accelerate)',
}
TRANSITION_CLASS_TO_PROPS = {
    'transition-colors':    'color, background-color, border-color',
    'transition-transform': 'transform',
    'transition-opacity':   'opacity',
    'transition-all':       'all',
    'transition':           'all',
}

ANIM_CLASSES = set(list(DURATION_MAP) + list(EASING_MAP) + list(TRANSITION_CLASS_TO_PROPS))

def strip_anim_from_classlist(cls_str):
    """
    Return (cleaned_cls_str, transition_value | None).
    cleaned_cls_str has the transition/duration/easing tokens removed.
    transition_value is the CSS string like 'background-color 200ms ease-in-out'.
    """
    tokens = cls_str.split()
    kept = []
    trans_cls = None
    dur_val = 'var(--app-duration-short)'   # default Tailwind ~150ms → use short
    ease_val = 'var(--app-easing-standard)' # default ease-in-out

    changed = False
    for tok in tokens:
        if tok in TRANSITION_CLASS_TO_PROPS:
            trans_cls = tok
            changed = True
        elif tok in DURATION_MAP:
            dur_val = DURATION_MAP[tok]
            changed = True
        elif tok in EASING_MAP:
            ease_val = EASING_MAP[tok]
            changed = True
        else:
            kept.append(tok)

    if not changed:
        return cls_str, None

    props = [p.strip() for p in TRANSITION_CLASS_TO_PROPS.get(trans_cls, 'all').split(',')]
    transition_val = ', '.join(f'{p} {dur_val} {ease_val}' for p in props)
    return ' '.join(kept), transition_val


# Matches:  className="..."   (no escaped quotes inside)
STATIC_CLASSNAME_RE = re.compile(r'(className=")([^"]*?)(")')
# Matches:  className={`...`}  (template literal, no nested backticks)
TEMPLATE_CLASSNAME_RE = re.compile(r'(className=\{`)([^`]*?)(`\})')


def replace_in_match(m, is_template):
    """Return (replacement_string, transition_val_or_None)."""
    prefix, cls_inner, suffix = m.group(1), m.group(2), m.group(3)

    if is_template:
        # Template literals may have ${...} expressions — split around them
        parts = re.split(r'(\$\{[^{}]*\})', cls_inner)
        new_parts = []
        combined_tv = None
        for part in parts:
            if part.startswith('${'):
                new_parts.append(part)
            else:
                cleaned, tv = strip_anim_from_classlist(part)
                new_parts.append(cleaned)
                if tv and not combined_tv:
                    combined_tv = tv
        new_inner = ''.join(new_parts)
        return prefix + new_inner + suffix, combined_tv
    else:
        cleaned, tv = strip_anim_from_classlist(cls_inner)
        return prefix + cleaned + suffix, tv


def process_file(filepath, verbose=False):
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    changed = False
    new_lines = []

    for line in lines:
        # Check for static className="..."
        m = STATIC_CLASSNAME_RE.search(line)
        if not m:
            m = TEMPLATE_CLASSNAME_RE.search(line)
            is_template = True
        else:
            is_template = False

        if m:
            replacement, tv = replace_in_match(m, is_template)
            if tv:
                # Check if there's already a style= on this line (rough check)
                before_cls = line[:m.start()]
                after_cls = line[m.end():]
                if 'style=' in before_cls or 'style=' in after_cls:
                    # Already has style — skip automatic add, leave a comment marker
                    new_line = line[:m.start()] + replacement + line[m.end():]
                    new_line = new_line.rstrip('\n') + '  {/* ANIM-MERGE: transition: \'' + tv + '\' */}\n'
                    new_lines.append(new_line)
                else:
                    # Insert style prop right after className
                    style_prop = f" style={{{{ transition: '{tv}' }}}}"
                    new_line = line[:m.start()] + replacement + style_prop + line[m.end():]
                    new_lines.append(new_line)
                changed = True
                continue

        new_lines.append(line)

    if changed:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.writelines(new_lines)
        if verbose:
            print(f'Updated: {filepath}')
    return changed


def process_dir(dirpath, verbose=False):
    count = 0
    for root, dirs, files in os.walk(dirpath):
        dirs[:] = [d for d in dirs if d not in ('node_modules', '.git')]
        for fname in files:
            if fname.endswith(('.tsx', '.ts')):
                fp = os.path.join(root, fname)
                if process_file(fp, verbose):
                    count += 1
    return count


if __name__ == '__main__':
    paths = sys.argv[1:]
    verbose = '-v' in paths
    paths = [p for p in paths if p != '-v']
    total = 0
    for path in paths:
        if os.path.isdir(path):
            total += process_dir(path, verbose)
        elif os.path.isfile(path):
            if process_file(path, verbose):
                total += 1
    print(f'Total files updated: {total}')
