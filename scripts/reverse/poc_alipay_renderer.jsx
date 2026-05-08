import React from 'react';

/**
 * Proof of Concept: Alipay BirdNest DSL to React Converter
 * This simulates how we can "one-click" replicate Alipay's core pages
 * using the harvested JSON DSLs.
 */

const AlipayDslRenderer = ({ dslData, locale = 'zh_CN' }) => {
    if (!dslData || !dslData.data) return null;

    const i18n = dslData.data.children[0].children.find(c => c.type === 'i18n')?.locale?.[locale] || {};

    const renderNode = (node, index) => {
        if (node.tag === 'meta' || node.tag === 'script' || node.tag === 'style' || node.tag === 'link') return null;

        // Map tag to HTML/React elements
        const Tag = node.tag === 'text' ? 'span' : (node.tag === 'div' ? 'div' : 'div');

        // Handle text replacement from i18n
        let content = node.text || '';
        if (content.startsWith('{{') && content.endsWith('}}')) {
            const key = content.slice(2, -2);
            content = i18n[key] || key;
        }

        return (
            <Tag key={index} className={node._c} style={parseStyle(node._s)}>
                {content}
                {node.children && node.children.map((child, i) => renderNode(child, i))}
            </Tag>
        );
    };

    const parseStyle = (styleStr) => {
        if (!styleStr) return {};
        return styleStr.split(';').reduce((acc, curr) => {
            const [key, val] = curr.split(':');
            if (key && val) {
                const camelKey = key.trim().replace(/-([a-z])/g, g => g[1].toUpperCase());
                acc[camelKey] = val.trim();
            }
            return acc;
        }, {});
    };

    return (
        <div className="alipay-container" style={{ background: '#fff', padding: '20px' }}>
            {dslData.data.children.map((child, i) => renderNode(child, i))}
        </div>
    );
};

export default AlipayDslRenderer;
