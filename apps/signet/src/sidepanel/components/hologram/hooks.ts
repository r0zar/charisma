import { useState, useEffect, DependencyList } from "react";

// Helper to calculate activity level - this smooths UI transitions
export function useActivityLevel(dependencies: DependencyList = []) {
  // Track activity level (0-10)
  const [activity, setActivity] = useState(0);
  
  // Recalculate when dependencies change
  useEffect(() => {
    // Boost activity on changes
    setActivity(10);
    
    // Decay activity over time
    const timer = setInterval(() => {
      setActivity(prev => Math.max(0, prev - 1));
    }, 100);
    
    return () => clearInterval(timer);
  }, dependencies);
  
  return activity;
}