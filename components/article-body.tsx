"use client";

import { Fragment } from "react";

function inlineParts(value: string, keyPrefix: string) {
  const expression = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\(https:\/\/[^\s)]+\))/g;
  const output: React.ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;
  let index = 0;

  while ((match = expression.exec(value)) !== null) {
    if (match.index > cursor) output.push(value.slice(cursor, match.index));
    const token = match[0];
    if (token.startsWith("**")) {
      output.push(<strong key={keyPrefix + index}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("*")) {
      output.push(<em key={keyPrefix + index}>{token.slice(1, -1)}</em>);
    } else if (token.startsWith("`")) {
      output.push(<code key={keyPrefix + index}>{token.slice(1, -1)}</code>);
    } else {
      const link = /^\[([^\]]+)\]\((https:\/\/[^\s)]+)\)$/.exec(token);
      if (link) output.push(<a key={keyPrefix + index} href={link[2]} target="_blank" rel="noopener noreferrer">{link[1]} ↗</a>);
      else output.push(token);
    }
    cursor = match.index + token.length;
    index += 1;
  }
  if (cursor < value.length) output.push(value.slice(cursor));
  return output.map((node, index) => <Fragment key={keyPrefix + "-part-" + index}>{node}</Fragment>);
}

export default function ArticleBody({ markdown }: { markdown: string }) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: React.ReactNode[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];
  let ordered = false;

  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push(<p key={"p-" + blocks.length}>{inlineParts(paragraph.join(" "), "p-" + blocks.length)}</p>);
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list.length) {
      const items = list.map((item, index) => <li key={index}>{inlineParts(item, "li-" + blocks.length + "-" + index)}</li>);
      blocks.push(ordered
        ? <ol key={"ol-" + blocks.length}>{items}</ol>
        : <ul key={"ul-" + blocks.length}>{items}</ul>);
      list = [];
    }
  };

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      flushList();
      return;
    }
    const heading = /^(#{1,3})\s+(.+)$/.exec(trimmed);
    if (heading) {
      flushParagraph();
      flushList();
      const content = inlineParts(heading[2], "h-" + blocks.length);
      const key = "heading-" + blocks.length;
      if (heading[1].length === 1) blocks.push(<h2 key={key}>{content}</h2>);
      else if (heading[1].length === 2) blocks.push(<h3 key={key}>{content}</h3>);
      else blocks.push(<h4 key={key}>{content}</h4>);
      return;
    }
    if (/^>\s?/.test(trimmed)) {
      flushParagraph();
      flushList();
      blocks.push(<blockquote key={"q-" + blocks.length}>{inlineParts(trimmed.replace(/^>\s?/, ""), "q-" + blocks.length)}</blockquote>);
      return;
    }
    const bullet = /^[-*]\s+(.+)$/.exec(trimmed);
    const number = /^\d+[.)]\s+(.+)$/.exec(trimmed);
    if (bullet || number) {
      flushParagraph();
      if (list.length && ordered !== Boolean(number)) flushList();
      ordered = Boolean(number);
      list.push((bullet || number)![1]);
      return;
    }
    flushList();
    paragraph.push(trimmed);
  });
  flushParagraph();
  flushList();

  return <div className="oo-article-body">{blocks}</div>;
}
