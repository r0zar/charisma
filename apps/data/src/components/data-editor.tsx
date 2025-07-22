'use client';

import { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Save, Download, Upload, RefreshCw } from 'lucide-react';
import { useTheme } from 'next-themes';

interface DataEditorProps {
  path: string | null;
  data: any;
  onSave: (path: string, data: any) => void;
}

export function DataEditor({ path, data, onSave }: DataEditorProps) {
  const [editorValue, setEditorValue] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { theme } = useTheme();
  const editorRef = useRef<any>(null);
  
  useEffect(() => {
    if (data !== null && data !== undefined) {
      // Show any actual data as JSON
      const formattedData = JSON.stringify(data, null, 2);
      setEditorValue(formattedData);
      setHasChanges(false);
      setError(null);
    } else if (data === null) {
      // No data at this path
      setEditorValue('');
      setHasChanges(false);
      setError(null);
    }
  }, [data]);
  
  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined) {
      setEditorValue(value);
      setHasChanges(true);
      setError(null);
    }
  };
  
  const validateJson = (jsonString: string): { valid: boolean; data?: any; error?: string } => {
    try {
      const parsed = JSON.parse(jsonString);
      return { valid: true, data: parsed };
    } catch (err) {
      return { 
        valid: false, 
        error: err instanceof Error ? err.message : 'Invalid JSON' 
      };
    }
  };
  
  const handleSave = async () => {
    if (!path) return;
    
    const validation = validateJson(editorValue);
    if (!validation.valid) {
      setError(validation.error || 'Invalid JSON');
      return;
    }
    
    setSaving(true);
    setError(null);
    
    try {
      console.log('Saving data to path:', path);
      console.log('Data size:', JSON.stringify(validation.data).length);
      
      const apiPath = path.replace('.json', '');
      const response = await fetch(`/api/v1/${apiPath}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(validation.data),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Save failed');
      }
      
      console.log('Save successful for path:', path);
      setHasChanges(false);
      onSave(path, validation.data);
      
      // Add debug info
      if (process.env.NODE_ENV === 'development') {
        const responseTime = response.headers.get('X-Response-Time');
        if (responseTime) {
          console.log('Save response time:', responseTime);
        }
      }
      
    } catch (err) {
      console.error('Save failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };
  
  const handleFormat = () => {
    const validation = validateJson(editorValue);
    if (validation.valid) {
      const formatted = JSON.stringify(validation.data, null, 2);
      setEditorValue(formatted);
      setError(null);
    } else {
      setError(validation.error || 'Cannot format invalid JSON');
    }
  };
  
  const handleDownload = () => {
    if (!path || !editorValue) return;
    
    const blob = new Blob([editorValue], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = path.split('/').pop() || 'data.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  const handleUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        const validation = validateJson(content);
        
        if (validation.valid) {
          setEditorValue(content);
          setHasChanges(true);
          setError(null);
        } else {
          setError(validation.error || 'Invalid JSON file');
        }
      };
      
      reader.readAsText(file);
    };
    
    input.click();
  };
  
  const handleRefresh = async () => {
    if (!path) return;
    
    setLoading(true);
    try {
      const apiPath = path.replace('.json', '');
      const response = await fetch(`/api/v1/${apiPath}`);
      
      if (response.ok) {
        const freshData = await response.json();
        const formatted = JSON.stringify(freshData, null, 2);
        setEditorValue(formatted);
        setHasChanges(false);
        setError(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh');
    } finally {
      setLoading(false);
    }
  };
  
  if (!path) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h3 className="text-lg font-medium mb-2">No Data Selected</h3>
          <p className="text-muted-foreground">
            Select a file from the tree navigator to start editing
          </p>
        </div>
      </div>
    );
  }

  
  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Button
            variant="default"
            size="sm"
            onClick={handleSave}
            disabled={!hasChanges || saving}
          >
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save'}
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleFormat}
            disabled={!editorValue}
          >
            Format JSON
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
        
        <div className="flex items-center gap-2">
          {hasChanges && (
            <Badge variant="secondary">Unsaved changes</Badge>
          )}
          
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDownload}
            disabled={!editorValue}
          >
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={handleUpload}
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload
          </Button>
        </div>
      </div>
      
      {/* Error Display */}
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-950/20 border-b border-red-200 dark:border-red-800">
          <p className="text-sm text-red-700 dark:text-red-400">
            {error}
          </p>
        </div>
      )}
      
      {/* Monaco Editor */}
      <div className="flex-1">
        <Editor
          height="100%"
          language="json"
          theme={theme === 'dark' ? 'vs-dark' : 'light'}
          value={editorValue}
          onChange={handleEditorChange}
          onMount={(editor) => {
            editorRef.current = editor;
          }}
          options={{
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            fontSize: 14,
            lineNumbers: 'on',
            renderWhitespace: 'selection',
            folding: true,
            autoIndent: 'full',
            formatOnPaste: true,
            formatOnType: true,
            wordWrap: 'on',
            wrappingIndent: 'indent',
            tabSize: 2,
            insertSpaces: true,
          }}
        />
      </div>
      
      {/* Status Bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-muted/30 border-t border-border text-xs text-muted-foreground">
        <div>
          Lines: {editorValue.split('\n').length}
        </div>
        <div>
          Characters: {editorValue.length}
        </div>
      </div>
    </div>
  );
}