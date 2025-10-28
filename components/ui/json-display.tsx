'use client';

import React from 'react';

interface JsonDisplayProps {
  content: string;
  className?: string;
}

export function JsonDisplay({ content, className = '' }: JsonDisplayProps) {
  const [isJson, setIsJson] = React.useState(false);
  const [formatted, setFormatted] = React.useState(content);

  React.useEffect(() => {
    try {
      const parsed = JSON.parse(content);
      setFormatted(JSON.stringify(parsed, null, 2));
      setIsJson(true);
    } catch {
      setFormatted(content);
      setIsJson(false);
    }
  }, [content]);

  if (isJson) {
    return (
      <div className={`relative ${className}`}>
        <SyntaxHighlightedJson content={formatted} />
      </div>
    );
  }

  return (
    <pre className={`text-xs whitespace-pre-wrap break-words ${className}`}>
      {content}
    </pre>
  );
}

interface SyntaxHighlightedJsonProps {
  content: string;
}

function SyntaxHighlightedJson({ content }: SyntaxHighlightedJsonProps) {
  const highlightJson = (json: string) => {
    return json
      .split('\n')
      .map((line, lineIndex) => {
        const parts: React.ReactNode[] = [];
        let match;
        let lastIndex = 0;

        // Match JSON keys (strings before colons)
        const keyRegex = /"([^"]+)":/g;
        const stringRegex = /:"([^"]*)"/g;
        const numberRegex = /:\s*(-?\d+\.?\d*)/g;
        const boolNullRegex = /:\s*(true|false|null)/g;

        // Process the line to find keys
        const keyMatches = Array.from(line.matchAll(keyRegex));
        const stringMatches = Array.from(line.matchAll(stringRegex));
        const numberMatches = Array.from(line.matchAll(numberRegex));
        const boolNullMatches = Array.from(line.matchAll(boolNullRegex));

        // Combine all matches and sort by position
        const allMatches = [
          ...keyMatches.map(m => ({ type: 'key', match: m })),
          ...stringMatches.map(m => ({ type: 'string', match: m })),
          ...numberMatches.map(m => ({ type: 'number', match: m })),
          ...boolNullMatches.map(m => ({ type: 'bool', match: m })),
        ].sort((a, b) => (a.match.index || 0) - (b.match.index || 0));

        // Build the highlighted line
        let currentIndex = 0;
        allMatches.forEach(({ type, match }, i) => {
          const matchIndex = match.index || 0;

          // Add text before this match
          if (matchIndex > currentIndex) {
            parts.push(
              <span key={`text-${lineIndex}-${i}`}>
                {line.substring(currentIndex, matchIndex)}
              </span>
            );
          }

          // Add the matched content with color
          if (type === 'key') {
            parts.push(
              <span key={`match-${lineIndex}-${i}`} className="text-blue-600 dark:text-blue-400">
                {match[0]}
              </span>
            );
          } else if (type === 'string') {
            parts.push(
              <span key={`match-${lineIndex}-${i}`}>
                :<span className="text-green-600 dark:text-green-400">{match[0].substring(1)}</span>
              </span>
            );
          } else if (type === 'number') {
            parts.push(
              <span key={`match-${lineIndex}-${i}`}>
                : <span className="text-purple-600 dark:text-purple-400">{match[1]}</span>
              </span>
            );
          } else if (type === 'bool') {
            parts.push(
              <span key={`match-${lineIndex}-${i}`}>
                : <span className="text-orange-600 dark:text-orange-400">{match[1]}</span>
              </span>
            );
          }

          currentIndex = matchIndex + match[0].length;
        });

        // Add remaining text
        if (currentIndex < line.length) {
          parts.push(
            <span key={`text-${lineIndex}-end`}>
              {line.substring(currentIndex)}
            </span>
          );
        }

        return (
          <div key={lineIndex}>
            {parts.length > 0 ? parts : line}
          </div>
        );
      });
  };

  return (
    <pre className="text-xs whitespace-pre font-mono">
      {highlightJson(content)}
    </pre>
  );
}
