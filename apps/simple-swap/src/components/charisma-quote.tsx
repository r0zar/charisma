'use client';

import React, { useEffect, useState } from 'react';

export default function CharismaQuote() {
    const [rate, setRate] = useState<string>('');

    useEffect(() => {
        async function fetchRate() {
            try {
                const res = await fetch('/api/quote');
                const json = await res.json();
                if (json.success) {
                    const formatted = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(json.rate);
                    setRate(`1 STX = ${formatted} CHA`);
                } else {
                    setRate('');
                }
            } catch {
                setRate('');
            }
        }
        fetchRate();
    }, []);

    return <span className="font-medium">{rate}</span>;
} 