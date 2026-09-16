import React from 'react';
import { IconLink } from './Icons';

interface ClickableTextProps {
  text?: string | null;
  buttonLabel?: string;
  asButton?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export default function ClickableText({
  text,
  buttonLabel,
  asButton = true,
  className,
  style,
}: ClickableTextProps) {
  if (!text || !text.trim()) return <span className={className} style={{ color: 'var(--text-dim)', ...style }}>-</span>;

  // Regex to match URLs starting with http://, https://, or www.
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/g;
  const isPureUrl = /^https?:\/\/[^\s]+$|^www\.[^\s]+$/i.test(text.trim());

  const parts = text.split(urlRegex);
  const hasUrl = parts.some((p) => p.match(urlRegex));

  if (!hasUrl) {
    return <span className={className} style={style}>{text}</span>;
  }

  if (asButton || isPureUrl) {
    return (
      <span className={className} style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center', ...style }}>
        {parts.map((part, index) => {
          if (part.match(urlRegex)) {
            const href = part.startsWith('http') ? part : `https://${part}`;
            return (
              <a
                key={index}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary btn-sm btn-secondary"
                onClick={(e) => e.stopPropagation()}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.3rem 0.65rem',
                  borderRadius: '6px',
                  fontSize: '0.775rem',
                  fontWeight: 600,
                  textDecoration: 'none',
                  background: '#e0f2fe',
                  color: '#0369a1',
                  border: '1px solid #bae6fd',
                  cursor: 'pointer',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
                }}
              >
                <IconLink size={14} color="#0369a1" />
                {buttonLabel || 'Buka Link'}
              </a>
            );
          }
          return part ? <span key={index} style={{ marginRight: '0.25rem' }}>{part}</span> : null;
        })}
      </span>
    );
  }

  return (
    <span className={className} style={style}>
      {parts.map((part, index) => {
        if (part.match(urlRegex)) {
          const href = part.startsWith('http') ? part : `https://${part}`;
          return (
            <a
              key={index}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary btn-sm btn-secondary"
              onClick={(e) => e.stopPropagation()}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                padding: '0.2rem 0.5rem',
                borderRadius: '4px',
                fontSize: '0.75rem',
                fontWeight: 600,
                textDecoration: 'none',
                background: '#e0f2fe',
                color: '#0369a1',
                border: '1px solid #bae6fd',
                margin: '0 0.2rem'
              }}
            >
              <IconLink size={13} color="#0369a1" />
              {buttonLabel || 'Buka Link'}
            </a>
          );
        }
        return part;
      })}
    </span>
  );
}
