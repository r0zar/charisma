"use client";

import { useEffect, useRef, useCallback } from 'react';

/**
 * Custom hook to observe layout changes and trigger chart resize events
 * when the order form panel or other layout elements change height
 */
export function useLayoutObserver(dependencies: any[] = []) {
    const resizeTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
    const observerRef = useRef<ResizeObserver | undefined>(undefined);
    const observedElementsRef = useRef<Set<Element>>(new Set());

    // Debounced resize trigger function
    const triggerChartResize = useCallback(() => {
        // Clear any existing timeout
        if (resizeTimeoutRef.current) {
            clearTimeout(resizeTimeoutRef.current);
        }

        // Debounce multiple rapid changes
        resizeTimeoutRef.current = setTimeout(() => {
            // Dispatch multiple resize events for different chart libraries
            window.dispatchEvent(new Event('resize'));
            window.dispatchEvent(new CustomEvent('chartContainerResize'));
            window.dispatchEvent(new CustomEvent('proModeLayoutChange'));

            console.log('🔄 Chart resize triggered due to layout change');
        }, 50); // 50ms debounce
    }, []);

    // Function to observe specific elements
    const observeElement = useCallback((element: Element) => {
        if (!element || observedElementsRef.current.has(element)) return;

        if (!observerRef.current) {
            observerRef.current = new ResizeObserver((entries) => {
                // Check if any observed element actually changed size
                let hasSignificantChange = false;

                for (const entry of entries) {
                    const { height } = entry.contentRect;
                    const element = entry.target;

                    // Get previous height from data attribute
                    const previousHeight = parseFloat(element.getAttribute('data-previous-height') || '0');

                    // Only trigger if height changed by more than 5px (avoid micro-changes)
                    if (Math.abs(height - previousHeight) > 5) {
                        hasSignificantChange = true;
                        element.setAttribute('data-previous-height', height.toString());
                        console.log(`📏 Layout change detected: ${element.className} height changed from ${previousHeight}px to ${height}px`);
                    }
                }

                if (hasSignificantChange) {
                    triggerChartResize();
                }
            });
        }

        observerRef.current.observe(element);
        observedElementsRef.current.add(element);

        // Set initial height
        const rect = element.getBoundingClientRect();
        element.setAttribute('data-previous-height', rect.height.toString());

        console.log(`👀 Started observing element: ${element.className} (initial height: ${rect.height}px)`);
    }, [triggerChartResize]);

    // Auto-observe order controls and form elements
    const startAutoObservation = useCallback(() => {
        // Wait for DOM to be ready
        const observe = () => {
            // Observe order controls container
            const orderControls = document.querySelector('[data-order-controls]') ||
                document.querySelector('.border-t.border-border\\/40.bg-card\\/50');
            if (orderControls) {
                observeElement(orderControls);
            }

            // Observe individual order forms that might change height
            const orderForms = document.querySelectorAll('[data-order-form], .space-y-6, .grid');
            orderForms.forEach(form => {
                if (form.closest('[data-order-controls]') || form.closest('.border-t.border-border\\/40.bg-card\\/50')) {
                    observeElement(form);
                }
            });

            // Observe sidebar state changes
            const sidebars = document.querySelectorAll('[data-sidebar]');
            sidebars.forEach(sidebar => observeElement(sidebar));
        };

        // Try immediately and also after a delay for dynamic content
        observe();
        setTimeout(observe, 100);
        setTimeout(observe, 500);
    }, [observeElement]);

    // Effect to start observation and handle dependency changes
    useEffect(() => {
        startAutoObservation();

        // Also trigger resize when dependencies change
        triggerChartResize();

        return () => {
            // Cleanup timeouts
            if (resizeTimeoutRef.current) {
                clearTimeout(resizeTimeoutRef.current);
            }
        };
    }, dependencies);

    // Cleanup effect
    useEffect(() => {
        return () => {
            if (observerRef.current) {
                observerRef.current.disconnect();
            }
            if (resizeTimeoutRef.current) {
                clearTimeout(resizeTimeoutRef.current);
            }
        };
    }, []);

    return {
        triggerChartResize,
        observeElement,
        startAutoObservation
    };
} 