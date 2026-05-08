#!/usr/bin/env python3
"""
Replace hardcoded Tailwind pixel classes with CSS variable equivalents.
"""
import re
import sys
import os

# (old_pattern, new_pattern)  -- exact class token replacements
WECHAT_REPLACEMENTS = [
    # h-[Npx] → h-(--app-xxx)
    (r'\bh-\[56px\]', 'h-(--app-settings-item-height)'),
    (r'\bh-\[48px\]', 'h-(--app-chat-list-item-avatar-size)'),
    # w-[Npx]
    (r'\bw-\[48px\]', 'w-(--app-chat-list-item-avatar-size)'),
    # text-[Npx] → text-(--app-xxx)
    (r'\btext-\[17px\]', 'text-(--app-settings-item-text-size)'),
    (r'\btext-\[16px\]', 'text-(--app-chat-bubble-text-size)'),
    (r'\btext-\[14px\]', 'text-(--app-settings-group-title-size)'),
    (r'\btext-\[15px\]', 'text-(--app-search-filter-text-size)'),
    (r'\btext-\[12px\]', 'text-(--app-chat-time-label-text-size)'),
    (r'\btext-\[13px\]', 'text-(--app-chat-system-msg-text-size)'),
    (r'\btext-\[11px\]', 'text-(--app-chat-list-item-time-size)'),
    (r'\btext-\[20px\]', 'text-(--app-me-username-size)'),
]

WECHATREADING_REPLACEMENTS = [
    # h-[Npx] → h-(--app-xxx)
    (r'\bh-\[40px\]', 'h-(--app-header-search-bar-height)'),
    (r'\bh-\[56px\]', 'h-(--app-modal-action-row-height)'),
    (r'\bh-\[64px\]', 'h-(--app-book-detail-action-bar-height)'),
    # text-[Npx]
    (r'\btext-\[15px\]', 'text-(--app-settings-item-text-size)'),
    (r'\btext-\[13px\]', 'text-(--app-settings-item-value-size)'),
    (r'\btext-\[17px\]', 'text-(--app-modal-action-text-size)'),
    (r'\btext-\[19px\]', 'text-(--app-modal-title-size)'),
    (r'\btext-\[10px\]', 'text-(--app-tab-bar-label-size)'),
    (r'\btext-\[24px\]', 'text-(--app-bookshelf-title-size)'),
    (r'\btext-\[13px\]', 'text-(--app-bookshelf-item-title-size)'),
    (r'\btext-\[12px\]', 'text-(--app-bookshelf-footer-text-size)'),
]

compiled_cache = {}

def compile_replacements(replacements):
    return [(re.compile(pat), repl) for pat, repl in replacements]

def process_file(filepath, compiled_reps, verbose=False):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content
    for pattern, replacement in compiled_reps:
        content = pattern.sub(replacement, content)

    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        if verbose:
            print(f'Updated: {filepath}')
        return True
    return False

def process_dir(dirpath, compiled_reps, verbose=False):
    count = 0
    for root, dirs, files in os.walk(dirpath):
        dirs[:] = [d for d in dirs if d not in ('node_modules', '.git')]
        for fname in files:
            if fname.endswith(('.tsx', '.ts')):
                fp = os.path.join(root, fname)
                if process_file(fp, compiled_reps, verbose):
                    count += 1
    return count

if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('app', choices=['Wechat', 'WechatReading'])
    parser.add_argument('paths', nargs='+')
    parser.add_argument('-v', '--verbose', action='store_true')
    args = parser.parse_args()

    reps = WECHAT_REPLACEMENTS if args.app == 'Wechat' else WECHATREADING_REPLACEMENTS
    compiled = compile_replacements(reps)

    total = 0
    for path in args.paths:
        if os.path.isdir(path):
            total += process_dir(path, compiled, args.verbose)
        elif os.path.isfile(path):
            if process_file(path, compiled, args.verbose):
                total += 1
    print(f'Total files updated: {total}')
