import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';
import type { Components } from 'react-markdown';
import type { ReactElement, ReactNode } from 'react';
import Link from 'next/link';
import { Callout } from './Callout';
import { StepLi } from './Steps';
import { MarkdownOl, MarkdownUl } from './MarkdownLists';
import { CodeBlock } from './CodeBlock';
import { CopyHeadingLink } from './CopyHeadingLink';

function textFromChildren(children: unknown): string {
  if (typeof children === 'string') return children;
  if (Array.isArray(children)) return children.map(textFromChildren).join('');
  if (children && typeof children === 'object' && 'props' in (children as any)) {
    return textFromChildren((children as any).props?.children);
  }
  return '';
}

const CALLOUT_PREFIX = /^(?:💡|⚠️|✅|ℹ️)\s*/u;

function stripCalloutPrefix(children: ReactNode): ReactNode {
  if (typeof children === 'string') {
    return children.replace(CALLOUT_PREFIX, '');
  }
  if (Array.isArray(children)) {
    return children.map((child, i) => (i === 0 ? stripCalloutPrefix(child) : child));
  }
  if (children && typeof children === 'object' && 'props' in (children as any)) {
    const el = children as ReactElement<{ children?: ReactNode }>;
    return {
      ...el,
      props: {
        ...el.props,
        children: stripCalloutPrefix(el.props.children),
      },
    };
  }
  return children;
}

const components: Components = {
  a: ({ href, children, ...props }) => {
    const h = typeof href === 'string' ? href : '';
    if (h.startsWith('#')) {
      return (
        <a href={h} {...props}>
          {children}
        </a>
      );
    }
    if (h.startsWith('/')) {
      return (
        <Link href={h} {...(props as any)}>
          {children}
        </Link>
      );
    }
    return (
      <a href={h} target="_blank" rel="noreferrer" {...props}>
        {children}
      </a>
    );
  },
  blockquote: ({ children }) => {
    const text = textFromChildren(children).trim();
    const isInfo = text.startsWith('💡') || text.toLowerCase().startsWith('nota');
    const isWarn = text.startsWith('⚠️') || text.toLowerCase().startsWith('importante');
    const isSuccess = text.startsWith('✅');

    if (isInfo || isWarn || isSuccess) {
      return (
        <Callout type={isWarn ? 'warn' : isSuccess ? 'success' : 'info'}>
          {stripCalloutPrefix(children)}
        </Callout>
      );
    }
    return <blockquote className="docs-blockquote">{children}</blockquote>;
  },
  ol: ({ children }) => <MarkdownOl>{children}</MarkdownOl>,
  ul: ({ children }) => <MarkdownUl>{children}</MarkdownUl>,
  li: ({ children, ...props }) => <StepLi {...props}>{children}</StepLi>,
  pre: ({ children }) => <>{children}</>,
  code: ({ className, children }) => {
    const raw = String(children ?? '');
    const lang = className?.match(/language-(\w+)/)?.[1];

    const isBlock = !!lang || raw.includes('\n');

    if (!isBlock) {
      return <code className="docs-inline-code">{raw}</code>;
    }
    return <CodeBlock code={raw} language={lang} />;
  },
  h2: ({ children, ...props }) => {
    const id = (props as { id?: string }).id;
    return (
      <h2 {...props} className="docs-h2">
        <span className="docs-heading-text">{children}</span>
        {id && <CopyHeadingLink id={id} />}
      </h2>
    );
  },
  h3: ({ children, ...props }) => {
    const id = (props as { id?: string }).id;
    return (
      <h3 {...props} className="docs-h3">
        <span className="docs-heading-text">{children}</span>
        {id && <CopyHeadingLink id={id} />}
      </h3>
    );
  },
  p: ({ children, ...props }) => (
    <p {...props} className="docs-p">
      {children}
    </p>
  ),
  strong: ({ children, ...props }) => (
    <strong {...props} className="docs-strong">
      {children}
    </strong>
  ),
  table: ({ children }) => <div className="docs-table-wrap">{children}</div>,
};

export function MarkdownArticle({ markdown }: { markdown: string }) {
  return (
    <div className="docs-prose">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSlug]} components={components}>
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
