#!/usr/bin/env python3
"""Replace semantic color classes in JSX/TSX files."""
import re
import sys
import os

# Replacements: only replace when NOT preceded by a colon (i.e., not active:bg-white etc.)
# Pattern: negative lookbehind for colon
replacements = [
    (re.compile(r'(?<!:)\bbg-white\b'), 'bg-app-surface'),
    (re.compile(r'(?<!:)\btext-black\b'), 'text-app-text'),
    (re.compile(r'(?<!:)\bborder-gray-200\b'), 'border-app-border'),
]

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content
    for pattern, replacement in replacements:
        content = pattern.sub(replacement, content)

    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f'Updated: {filepath}')

def process_dir(dirpath):
    for root, dirs, files in os.walk(dirpath):
        # Skip node_modules
        dirs[:] = [d for d in dirs if d != 'node_modules']
        for fname in files:
            if fname.endswith(('.tsx', '.ts')):
                process_file(os.path.join(root, fname))

if __name__ == '__main__':
    for path in sys.argv[1:]:
        if os.path.isdir(path):
            process_dir(path)
        elif os.path.isfile(path):
            process_file(path)
