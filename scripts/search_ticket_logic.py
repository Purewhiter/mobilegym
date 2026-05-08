#!/usr/bin/env python3
import json, sys

with open('/tmp/mobileticket_full.json') as f:
    data = json.load(f)

keywords = ['ticket', 'query', 'train', 'yp_info', 'seat', 'leftticket', 'cover', 'price', 'sort']
found = []

for bundle in data.get('amr_bundles', []):
    for js in bundle.get('js_files', []):
        a = js.get('analysis', {})
        if not a:
            continue
        apis = a.get('api_calls', [])
        funcs = a.get('functions', [])
        maps = list(a.get('constant_maps', {}).keys())
        switches = a.get('switch_maps', [])
        display = a.get('display_logic', [])
        sorts = a.get('sort_logic', [])
        routes = a.get('routes', [])
        all_text = ' '.join(apis + funcs + maps + routes).lower()
        hits = [kw for kw in keywords if kw in all_text]
        if hits:
            found.append({
                'bundle': bundle['file'], 'js': js['file'], 'size': js['size'],
                'hits': hits, 'apis': apis[:15],
                'relevant_funcs': [f for f in funcs if any(k in f.lower() for k in keywords)][:20],
                'maps': maps, 'switches': switches[:3],
                'display': [d['name'] for d in display][:10],
                'sorts': sorts[:3],
                'routes': [r for r in routes if any(k in r.lower() for k in keywords)][:10],
            })

for js in data.get('direct_js', []):
    a = js.get('analysis', {})
    if not a:
        continue
    funcs = a.get('functions', [])
    maps = list(a.get('constant_maps', {}).keys())
    all_text = ' '.join(funcs + maps).lower()
    hits = [kw for kw in keywords if kw in all_text]
    if hits:
        found.append({
            'source': 'direct_js', 'js': js['file'], 'size': js['size'],
            'hits': hits,
            'relevant_funcs': [f for f in funcs if any(k in f.lower() for k in keywords)][:20],
            'maps': maps,
        })

print(f"找到 {len(found)} 个相关 JS 文件\n")
for item in found:
    src = item.get('bundle', item.get('source', '?'))
    print(f"[{src}] {item['js']} ({item['size']//1024}KB)")
    print(f"  命中: {item['hits']}")
    if item.get('apis'): print(f"  APIs: {item['apis']}")
    if item.get('relevant_funcs'): print(f"  相关函数: {item['relevant_funcs']}")
    if item.get('maps'): print(f"  常量映射: {item['maps']}")
    if item.get('switches'): print(f"  Switch: {json.dumps(item['switches'], ensure_ascii=False)[:200]}")
    if item.get('display'): print(f"  显示逻辑: {item['display']}")
    if item.get('sorts'): print(f"  排序: {[s[:60] for s in item['sorts']]}")
    if item.get('routes'): print(f"  路由: {item['routes']}")
    print()
