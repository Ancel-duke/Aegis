'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { cn } from '@/lib/utils';
import { AlertCircle, CheckCircle } from 'lucide-react';

// Dynamically import react-json-view to avoid SSR issues
const ReactJsonView = dynamic(() => import('react-json-view'), { ssr: false });

interface JsonEditorProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  label?: string;
  className?: string;
  readOnly?: boolean;
  height?: string;
}

export function JsonEditor({
  value,
  onChange,
  error,
  label,
  className,
  readOnly = false,
  height = '400px',
}: JsonEditorProps) {
  const [jsonValue, setJsonValue] = useState<Record<string, unknown>>({});
  const [isValid, setIsValid] = useState(true);
  const [parseError, setParseError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const parsed = value ? JSON.parse(value) : {};
      setJsonValue(parsed);
      setIsValid(true);
      setParseError(null);
    } catch (err) {
      setIsValid(false);
      setParseError(err instanceof Error ? err.message : 'Invalid JSON');
    }
  }, [value]);

  const handleEdit = (edit: { updated_src?: Record<string, unknown> }) => {
    if (!readOnly && edit.updated_src) {
      onChange(JSON.stringify(edit.updated_src, null, 2));
    }
  };

  return (
    <div className={cn('w-full', className)}>
      {label && (
        <label className="mb-2 block text-sm font-medium text-foreground">
          {label}
          {!isValid && (
            <span className="ml-2 text-red-500" role="alert">
              (Invalid JSON)
            </span>
          )}
        </label>
      )}
      
      <div
        className={cn(
          'rounded-md border overflow-hidden',
          error || !isValid
            ? 'border-red-500 focus-within:ring-2 focus-within:ring-red-500'
            : 'border-input focus-within:ring-2 focus-within:ring-ring'
        )}
        style={{ height }}
        role="textbox"
        aria-label={label || 'JSON Editor'}
        aria-invalid={!isValid || !!error}
        aria-describedby={error ? 'json-editor-error' : undefined}
      >
        {isValid ? (
          <ReactJsonView
            src={jsonValue}
            theme="monokai"
            onEdit={readOnly ? undefined : handleEdit}
            onAdd={readOnly ? undefined : handleEdit}
            onDelete={readOnly ? undefined : handleEdit}
            displayDataTypes={false}
            displayObjectSize={false}
            enableClipboard={true}
            collapsed={1}
            style={{
              padding: '12px',
              backgroundColor: 'hsl(var(--background))',
              fontSize: '13px',
            }}
          />
        ) : (
          <div className="h-full p-4 bg-muted flex items-center justify-center">
            <div className="text-center">
              <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
              <p className="text-sm text-red-500 font-medium">Invalid JSON</p>
              <p className="text-xs text-muted-foreground mt-1">{parseError}</p>
            </div>
          </div>
        )}
      </div>

      {error && (
        <p
          id="json-editor-error"
          className="mt-1 text-sm text-red-500 flex items-center gap-1"
          role="alert"
        >
          <AlertCircle className="h-4 w-4" />
          {error}
        </p>
      )}

      {isValid && !error && (
        <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
          <CheckCircle className="h-3 w-3" />
          Valid JSON
        </p>
      )}
    </div>
  );
}
