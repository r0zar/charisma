"use client";

import React from 'react';
import { useProModeContext } from '../../contexts/pro-mode-context';
import SingleOrderForm from './SingleOrderForm';
import DCAOrderForm from './DCAOrderForm';
import SandwichOrderForm from './SandwichOrderForm';

export default function OrderForm() {
    const { selectedOrderType } = useProModeContext();

    switch (selectedOrderType) {
        case 'single':
            return <SingleOrderForm />;
        case 'dca':
            return <DCAOrderForm />;
        case 'sandwich':
            return <SandwichOrderForm />;
        default:
            return <SingleOrderForm />;
    }
} 