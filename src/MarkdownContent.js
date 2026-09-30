import Markdown from 'react-markdown';
import { createElement } from 'react';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import rehypeSlug from 'rehype-slug';
import { markdownPrefix, markdownUrl } from './markdown-url.js';

function scopeIds({ prefix }) {
  return (tree) => {
    function walk(node) {
      if (typeof node.properties?.id === 'string' && !node.properties.id.startsWith(prefix)) {
        node.properties.id = prefix + node.properties.id;
      }
      node.children?.forEach(walk);
    }
    walk(tree);
  };
}

export default function MarkdownContent({ content, project, section = 'readme' }) {
  const prefix = markdownPrefix(project, section);
  return createElement('div', { className: 'markdown-content' }, createElement(Markdown, {
    remarkPlugins: [remarkGfm],
    rehypePlugins: [rehypeRaw, [rehypeSlug, { prefix }], [scopeIds, { prefix }], rehypeSanitize],
    urlTransform: (value, key) => markdownUrl(value, project, { image: key === 'src', section }),
    components: {
      a: ({ node, href, ...props }) => createElement('a', {
        ...props, href,
        target: href?.startsWith('#') ? undefined : '_blank',
        rel: href?.startsWith('#') ? undefined : 'noopener noreferrer',
      }),
      img: ({ node, ...props }) => createElement('img', { ...props, loading: 'lazy', decoding: 'async' }),
      table: ({ node, ...props }) => createElement('div', { className: 'markdown-table' }, createElement('table', props)),
    },
  }, content));
}
