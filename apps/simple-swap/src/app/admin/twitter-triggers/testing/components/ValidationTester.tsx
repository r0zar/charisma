'use client';

import React, { useState } from 'react';
import { 
    CheckCircle, 
    XCircle, 
    AlertTriangle, 
    TestTube, 
    Loader2,
    Play
} from 'lucide-react';
import { toast } from 'sonner';

interface ValidationTest {
    name: string;
    description: string;
    testCases: Array<{
        input: string;
        expected: 'valid' | 'invalid';
        description: string;
    }>;
}

interface ValidationResult {
    testName: string;
    results: Array<{
        input: string;
        expected: 'valid' | 'invalid';
        actual: 'valid' | 'invalid';
        passed: boolean;
        error?: string;
        details?: any;
    }>;
    summary: {
        total: number;
        passed: number;
        failed: number;
        successRate: string;
    };
}

export default function ValidationTester() {
    const [testResults, setTestResults] = useState<ValidationResult[]>([]);
    const [runningTests, setRunningTests] = useState<Set<string>>(new Set());

    const validationTests: ValidationTest[] = [
        {
            name: 'Tweet URL Validation',
            description: 'Test various Twitter URL formats for validity',
            testCases: [
                { input: 'https://twitter.com/user/status/123456789', expected: 'valid', description: 'Standard Twitter URL' },
                { input: 'https://x.com/user/status/123456789', expected: 'valid', description: 'X.com URL' },
                { input: 'https://twitter.com/user/status/123456789?s=20', expected: 'valid', description: 'URL with query params' },
                { input: 'https://mobile.twitter.com/user/status/123456789', expected: 'valid', description: 'Mobile Twitter URL' },
                { input: 'https://twitter.com/user', expected: 'invalid', description: 'Profile URL without tweet' },
                { input: 'https://facebook.com/post/123', expected: 'invalid', description: 'Non-Twitter URL' },
                { input: 'not-a-url', expected: 'invalid', description: 'Invalid URL format' },
                { input: '', expected: 'invalid', description: 'Empty URL' }
            ]
        },
        {
            name: 'BNS Name Format Validation',
            description: 'Test various BNS name formats and extraction patterns',
            testCases: [
                { input: 'alice.btc', expected: 'valid', description: 'Standard BNS name' },
                { input: '@alice.btc', expected: 'valid', description: 'BNS name with @ prefix' },
                { input: 'alice.btc hey there!', expected: 'valid', description: 'BNS name in text' },
                { input: '@alice.btc 🚀 to the moon!', expected: 'valid', description: 'BNS name with emojis' },
                { input: 'Check out alice.btc profile', expected: 'valid', description: 'BNS name in sentence' },
                { input: 'user123.btc', expected: 'valid', description: 'BNS name with numbers' },
                { input: 'alice', expected: 'invalid', description: 'Username without .btc' },
                { input: 'alice.eth', expected: 'invalid', description: 'Non-BNS domain' },
                { input: '.btc', expected: 'invalid', description: 'Empty BNS name' },
                { input: '', expected: 'invalid', description: 'Empty input' }
            ]
        },
        {
            name: 'Token Amount Validation',
            description: 'Test token amount parsing and validation',
            testCases: [
                { input: '10.5', expected: 'valid', description: 'Decimal amount' },
                { input: '1000000', expected: 'valid', description: 'Large integer' },
                { input: '0.000001', expected: 'valid', description: 'Very small amount' },
                { input: '0', expected: 'invalid', description: 'Zero amount' },
                { input: '-10', expected: 'invalid', description: 'Negative amount' },
                { input: 'abc', expected: 'invalid', description: 'Non-numeric input' },
                { input: '', expected: 'invalid', description: 'Empty amount' },
                { input: '10.123456789', expected: 'valid', description: 'High precision decimal' }
            ]
        }
    ];

    const runValidationTest = async (test: ValidationTest) => {
        const testName = test.name;
        setRunningTests(prev => new Set(prev).add(testName));

        try {
            const results = [];

            for (const testCase of test.testCases) {
                try {
                    let actual: 'valid' | 'invalid' = 'invalid';
                    let details: any = {};

                    // Run the specific validation based on test type
                    if (testName === 'Tweet URL Validation') {
                        actual = await validateTweetUrl(testCase.input);
                    } else if (testName === 'BNS Name Format Validation') {
                        actual = await validateBnsName(testCase.input);
                    } else if (testName === 'Token Amount Validation') {
                        actual = await validateTokenAmount(testCase.input);
                    }

                    results.push({
                        input: testCase.input,
                        expected: testCase.expected,
                        actual,
                        passed: actual === testCase.expected,
                        details
                    });

                } catch (error) {
                    results.push({
                        input: testCase.input,
                        expected: testCase.expected,
                        actual: 'invalid' as const,
                        passed: testCase.expected === 'invalid',
                        error: error instanceof Error ? error.message : 'Unknown error'
                    });
                }
            }

            const passed = results.filter(r => r.passed).length;
            const total = results.length;

            const testResult: ValidationResult = {
                testName,
                results,
                summary: {
                    total,
                    passed,
                    failed: total - passed,
                    successRate: ((passed / total) * 100).toFixed(1) + '%'
                }
            };

            setTestResults(prev => {
                const filtered = prev.filter(r => r.testName !== testName);
                return [...filtered, testResult];
            });

            toast.success(`${testName} completed: ${passed}/${total} tests passed`);

        } catch (error) {
            console.error(`Error running ${testName}:`, error);
            toast.error(`Failed to run ${testName}`);
        } finally {
            setRunningTests(prev => {
                const newSet = new Set(prev);
                newSet.delete(testName);
                return newSet;
            });
        }
    };

    // Validation functions
    const validateTweetUrl = async (url: string): Promise<'valid' | 'invalid'> => {
        const response = await fetch('/api/v1/twitter-triggers/testing/scrape-tweet', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tweetUrl: url }),
        });
        
        return response.ok ? 'valid' : 'invalid';
    };

    const validateBnsName = async (input: string): Promise<'valid' | 'invalid'> => {
        const response = await fetch('/api/v1/twitter-triggers/testing/bns-batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bnsNames: [input] }),
        });

        if (response.ok) {
            const data = await response.json();
            const result = data.data?.results?.[0];
            return result?.bnsName ? 'valid' : 'invalid';
        }
        
        return 'invalid';
    };

    const validateTokenAmount = async (amount: string): Promise<'valid' | 'invalid'> => {
        if (!amount || amount.trim() === '') return 'invalid';
        
        const parsed = parseFloat(amount);
        if (isNaN(parsed) || parsed <= 0) return 'invalid';
        
        return 'valid';
    };

    const runAllTests = async () => {
        for (const test of validationTests) {
            if (!runningTests.has(test.name)) {
                await runValidationTest(test);
                // Small delay between tests
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
    };

    const getResultIcon = (result: ValidationResult['results'][0]) => {
        if (result.passed) {
            return <CheckCircle className="w-4 h-4 text-green-500" />;
        } else {
            return <XCircle className="w-4 h-4 text-red-500" />;
        }
    };

    return (
        <div className="space-y-6">
            {/* Test Controls */}
            <div className="bg-card rounded-lg border border-border p-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-orange-500/20 text-orange-400 flex items-center justify-center">
                            <TestTube className="w-5 h-5" />
                        </div>
                        <h3 className="text-lg font-semibold text-foreground">Validation Test Suite</h3>
                    </div>
                    
                    <button
                        onClick={runAllTests}
                        disabled={runningTests.size > 0}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {runningTests.size > 0 ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Play className="w-4 h-4" />
                        )}
                        Run All Tests
                    </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {validationTests.map((test) => (
                        <div key={test.name} className="border border-border rounded-lg p-4">
                            <h4 className="font-medium mb-2">{test.name}</h4>
                            <p className="text-sm text-muted-foreground mb-3">{test.description}</p>
                            <div className="text-xs text-muted-foreground mb-3">
                                {test.testCases.length} test cases
                            </div>
                            
                            <button
                                onClick={() => runValidationTest(test)}
                                disabled={runningTests.has(test.name)}
                                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                            >
                                {runningTests.has(test.name) ? (
                                    <>
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                        Running...
                                    </>
                                ) : (
                                    <>
                                        <Play className="w-3 h-3" />
                                        Run Test
                                    </>
                                )}
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Test Results */}
            {testResults.map((result) => (
                <div key={result.testName} className="bg-card rounded-lg border border-border p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h4 className="text-lg font-semibold">{result.testName}</h4>
                        <div className="flex items-center gap-4 text-sm">
                            <span className="text-green-600">{result.summary.passed} passed</span>
                            <span className="text-red-600">{result.summary.failed} failed</span>
                            <span className="font-semibold">{result.summary.successRate}</span>
                        </div>
                    </div>
                    
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                        {result.results.map((testResult, index) => (
                            <div
                                key={index}
                                className={`flex items-center justify-between p-3 rounded-lg border ${
                                    testResult.passed 
                                        ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950' 
                                        : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950'
                                }`}
                            >
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                    {getResultIcon(testResult)}
                                    <div className="min-w-0 flex-1">
                                        <div className="font-mono text-sm truncate">
                                            {testResult.input || '<empty>'}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            Expected: {testResult.expected} • Got: {testResult.actual}
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="text-right">
                                    {testResult.error && (
                                        <div className="text-xs text-red-600 max-w-48 truncate" title={testResult.error}>
                                            {testResult.error}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}

            {testResults.length === 0 && (
                <div className="bg-card rounded-lg border border-border p-6">
                    <div className="text-center py-8">
                        <TestTube className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                        <h4 className="text-lg font-medium text-foreground mb-2">
                            No Tests Run Yet
                        </h4>
                        <p className="text-muted-foreground">
                            Run validation tests to see detailed results here
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}