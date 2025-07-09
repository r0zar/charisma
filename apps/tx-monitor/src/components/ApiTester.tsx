'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Play, Loader2, Copy, CheckCircle, AlertCircle } from 'lucide-react';

interface ApiResponse {
  status: number;
  data: any;
  error?: string;
  headers?: { [key: string]: string };
}

export function ApiTester() {
  const [loading, setLoading] = useState<{ [key: string]: boolean }>({});
  const [responses, setResponses] = useState<{ [key: string]: ApiResponse }>({});
  const [txid, setTxid] = useState('0x4de9ba6561796962d868d6dd3bdf6c2092bd612d1165914eafd6bae9332e0557');
  const [testTxids, setTestTxids] = useState(['0x4de9ba6561796962d868d6dd3bdf6c2092bd612d1165914eafd6bae9332e0557', '0x1234567890abcdef1234567890abcdef12345678']);
  const [countdown, setCountdown] = useState<{ [key: string]: number }>({});

  const formatJson = (obj: any) => {
    return JSON.stringify(obj, null, 2);
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const testEndpoint = async (endpoint: string, method: string = 'GET', body?: any) => {
    setLoading(prev => ({ ...prev, [endpoint]: true }));
    
    // Start countdown for status endpoints (30 seconds)
    let countdownInterval: NodeJS.Timeout | null = null;
    if (endpoint.includes('/status/')) {
      setCountdown(prev => ({ ...prev, [endpoint]: 30 }));
      
      countdownInterval = setInterval(() => {
        setCountdown(prev => {
          const newCount = (prev[endpoint] || 0) - 1;
          if (newCount <= 0) {
            clearInterval(countdownInterval!);
            return { ...prev, [endpoint]: 0 };
          }
          return { ...prev, [endpoint]: newCount };
        });
      }, 1000);
    }
    
    try {
      const options: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
      };

      if (body) {
        options.body = JSON.stringify(body);
      }

      const response = await fetch(endpoint, options);
      const data = await response.json();

      // Extract relevant headers
      const headers: { [key: string]: string } = {};
      headers['cache-control'] = response.headers.get('cache-control') || '';
      headers['etag'] = response.headers.get('etag') || '';
      headers['x-cache-status'] = response.headers.get('x-cache-status') || '';

      setResponses(prev => ({
        ...prev,
        [endpoint]: {
          status: response.status,
          data,
          headers,
        }
      }));
    } catch (error) {
      setResponses(prev => ({
        ...prev,
        [endpoint]: {
          status: 500,
          data: null,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }));
    } finally {
      setLoading(prev => ({ ...prev, [endpoint]: false }));
      setCountdown(prev => ({ ...prev, [endpoint]: 0 }));
      if (countdownInterval) {
        clearInterval(countdownInterval);
      }
    }
  };

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return 'text-green-600';
    if (status >= 400 && status < 500) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getStatusVariant = (status: number) => {
    if (status >= 200 && status < 300) return 'default';
    if (status >= 400 && status < 500) return 'secondary';
    return 'destructive';
  };

  return (
    <section className="mb-16">
      <div className="flex items-center gap-2 mb-6">
        <Play className="w-6 h-6 text-primary" />
        <h2 className="text-2xl font-bold">API Tester</h2>
      </div>
      <p className="text-muted-foreground mb-8">
        Test the API endpoints directly from the documentation
      </p>

      <div className="space-y-8">
        {/* Queue Stats Test */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Badge variant="outline">GET</Badge>
              <code className="text-sm">/api/v1/queue/stats</code>
            </CardTitle>
            <CardDescription>
              Get queue statistics and health metrics
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={() => testEndpoint('/api/v1/queue/stats')}
              disabled={loading['/api/v1/queue/stats']}
              className="w-full sm:w-auto"
            >
              {loading['/api/v1/queue/stats'] ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Play className="w-4 h-4 mr-2" />
              )}
              Test Endpoint
            </Button>

            {responses['/api/v1/queue/stats'] && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Response:</span>
                  <Badge variant={getStatusVariant(responses['/api/v1/queue/stats'].status)}>
                    {responses['/api/v1/queue/stats'].status}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(formatJson(responses['/api/v1/queue/stats'].data))}
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
                <div className="bg-muted border rounded p-4 overflow-x-auto">
                  <pre className="text-sm">
                    <code>{formatJson(responses['/api/v1/queue/stats'].data)}</code>
                  </pre>
                </div>
                {responses['/api/v1/queue/stats'].headers && (
                  <div>
                    <h4 className="font-semibold mb-2">Response Headers:</h4>
                    <div className="bg-muted/50 border rounded p-3 text-xs space-y-1">
                      {Object.entries(responses['/api/v1/queue/stats'].headers).map(([key, value]) => (
                        value && <div key={key} className="font-mono">
                          <span className="text-muted-foreground">{key}:</span> {value}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Transaction Status Test */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Badge variant="outline">GET</Badge>
              <code className="text-sm">/api/v1/status/{'{txid}'}</code>
            </CardTitle>
            <CardDescription>
              Get real-time transaction status
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                placeholder="Enter transaction ID"
                value={txid}
                onChange={(e) => setTxid(e.target.value)}
                className="flex-1"
              />
              <Button
                onClick={() => testEndpoint(`/api/v1/status/${txid}`)}
                disabled={loading[`/api/v1/status/${txid}`] || !txid.trim()}
                className="w-full sm:w-auto"
              >
                {loading[`/api/v1/status/${txid}`] ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    {countdown[`/api/v1/status/${txid}`] > 0 ? (
                      `Checking... ${countdown[`/api/v1/status/${txid}`]}s`
                    ) : (
                      'Checking...'
                    )}
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Test Endpoint
                  </>
                )}
              </Button>
            </div>

            {/* Progress bar for status endpoint */}
            {loading[`/api/v1/status/${txid}`] && countdown[`/api/v1/status/${txid}`] > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Real-time check progress</span>
                  <span>{countdown[`/api/v1/status/${txid}`]}s remaining</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all duration-1000 ease-linear"
                    style={{ 
                      width: `${((30 - countdown[`/api/v1/status/${txid}`]) / 30) * 100}%` 
                    }}
                  />
                </div>
              </div>
            )}

            {responses[`/api/v1/status/${txid}`] && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Response:</span>
                  <Badge variant={getStatusVariant(responses[`/api/v1/status/${txid}`].status)}>
                    {responses[`/api/v1/status/${txid}`].status}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(formatJson(responses[`/api/v1/status/${txid}`].data))}
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
                <div className="bg-muted border rounded p-4 overflow-x-auto">
                  <pre className="text-sm">
                    <code>{formatJson(responses[`/api/v1/status/${txid}`].data)}</code>
                  </pre>
                </div>
                {responses[`/api/v1/status/${txid}`].headers && (
                  <div>
                    <h4 className="font-semibold mb-2">Response Headers:</h4>
                    <div className="bg-muted/50 border rounded p-3 text-xs space-y-1">
                      {Object.entries(responses[`/api/v1/status/${txid}`].headers).map(([key, value]) => (
                        value && <div key={key} className="font-mono">
                          <span className="text-muted-foreground">{key}:</span> {value}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Queue Add Test */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Badge variant="outline">POST</Badge>
              <code className="text-sm">/api/v1/queue/add</code>
            </CardTitle>
            <CardDescription>
              Add transactions to the monitoring queue
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Transaction IDs (one per line):</label>
              <textarea
                className="w-full min-h-[80px] px-3 py-2 border rounded-md bg-background text-sm"
                placeholder="0x4de9ba6561796962d868d6dd3bdf6c2092bd612d1165914eafd6bae9332e0557&#10;0x1234567890abcdef1234567890abcdef12345678"
                value={testTxids.join('\n')}
                onChange={(e) => setTestTxids(e.target.value.split('\n').filter(Boolean))}
              />
            </div>
            
            <Button
              onClick={() => testEndpoint('/api/v1/queue/add', 'POST', { txids: testTxids })}
              disabled={loading['/api/v1/queue/add'] || testTxids.length === 0}
              className="w-full sm:w-auto"
            >
              {loading['/api/v1/queue/add'] ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Play className="w-4 h-4 mr-2" />
              )}
              Test Endpoint
            </Button>

            {responses['/api/v1/queue/add'] && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Response:</span>
                  <Badge variant={getStatusVariant(responses['/api/v1/queue/add'].status)}>
                    {responses['/api/v1/queue/add'].status}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(formatJson(responses['/api/v1/queue/add'].data))}
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
                <div className="bg-muted border rounded p-4 overflow-x-auto">
                  <pre className="text-sm">
                    <code>{formatJson(responses['/api/v1/queue/add'].data)}</code>
                  </pre>
                </div>
                {responses['/api/v1/queue/add'].headers && (
                  <div>
                    <h4 className="font-semibold mb-2">Response Headers:</h4>
                    <div className="bg-muted/50 border rounded p-3 text-xs space-y-1">
                      {Object.entries(responses['/api/v1/queue/add'].headers).map(([key, value]) => (
                        value && <div key={key} className="font-mono">
                          <span className="text-muted-foreground">{key}:</span> {value}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Note about testing */}
        <div className="border rounded-lg p-4 bg-muted/50">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="font-semibold mb-1">Testing Note</h4>
              <p className="text-sm text-muted-foreground mb-2">
                These are live API calls to the transaction monitor service. The endpoints will return real data 
                from the monitoring queue. Use placeholder transaction IDs for testing the POST endpoint.
              </p>
              <p className="text-sm text-muted-foreground">
                <strong>Status endpoint:</strong> Shows a 30-second countdown during real-time checking. 
                If a transaction isn't found after 30 seconds, it returns 404 (likely never broadcasted).
                <br />
                <strong>Caching:</strong> <code>fromCache</code> indicates our KV store cache. Browser may also cache HTTP responses (shown in dev tools).
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}