/**
 * ConsoleView component for the extension popup
 * Displays a terminal/console with transaction logs and subnet status
 * Features a water ripple effect on the text
 */

import { motion } from "framer-motion"
import { useSignetContext } from "~shared/context/SignetContext"
import { useEffect, useState } from "react"
import { useSpring, animated } from "@react-spring/web"

// Animate SVG filter elements
const AnimFeTurbulence = animated('feTurbulence')
const AnimFeDisplacementMap = animated('feDisplacementMap')

export function ConsoleView() {
  // Get state from the context
  const { messages, status, currentAccount, error } = useSignetContext();
  const [logText, setLogText] = useState<string[]>([]);
  const [displayedText, setDisplayedText] = useState<string[]>([]);
  const [isActive, setIsActive] = useState(false);
  const [glitchType, setGlitchType] = useState(0);

  // More frequent random glitch effects with variety
  useEffect(() => {
    // Random glitch every 2-8 seconds
    const randomGlitch = () => {
      const randomDelay = 2000 + Math.random() * 6000;

      return setTimeout(() => {
        // 80% chance of a glitch
        if (Math.random() > 0.2) {
          // Select a random glitch type (0-3)
          setGlitchType(Math.floor(Math.random() * 4));
          setIsActive(true);

          // Random duration for the glitch
          const glitchDuration = 100 + Math.random() * 150;
          setTimeout(() => setIsActive(false), glitchDuration);

          // Small chance of a second follow-up glitch
          if (Math.random() > 0.7) {
            setTimeout(() => {
              setGlitchType(Math.floor(Math.random() * 4));
              setIsActive(true);
              setTimeout(() => setIsActive(false), glitchDuration * 0.5);
            }, glitchDuration + 100);
          }
        }

        // Schedule next glitch
        timerRef.current = randomGlitch();
      }, randomDelay);
    };

    // Start the random glitch cycle
    const timerRef = { current: randomGlitch() };

    // Clean up on unmount
    return () => clearTimeout(timerRef.current);
  }, []);

  // Glitchy terminal effect animations with multiple possible effects
  const [{ rgbShift, glitchY, scanlinePos, scanlineHeight, noiseOpacity }] = useSpring(
    () => ({
      reverse: isActive,
      // Default starting state
      from: {
        rgbShift: 0,       // RGB channel offset
        glitchY: 0,        // Vertical glitch offset
        scanlinePos: -10,  // Horizontal scan line position
        scanlineHeight: 0, // Scan line height
        noiseOpacity: 0    // Static noise overlay opacity
      },
      // Target state based on randomly chosen glitch type - more subtle for readability
      to: {
        rgbShift: glitchType === 0 ? 0.4 : 0,      // Reduced RGB shift
        glitchY: glitchType === 1 ? 1 : 0,         // Reduced vertical offset
        scanlinePos: glitchType === 2 ? 100 : -10,
        scanlineHeight: glitchType === 2 ? 2 : 0,  // Thinner scan line
        noiseOpacity: glitchType === 3 ? 0.05 : 0  // Reduced noise
      },
      config: {
        duration: 250,
        tension: 300,
        friction: 10
      },
    }),
    [isActive, glitchType]
  );

  // Trigger glitch effect when messages change
  useEffect(() => {
    if (messages && messages.length > 0) {
      // Quick multi-glitch sequence with random glitch types
      setGlitchType(Math.floor(Math.random() * 4));
      setIsActive(true);

      const timers = [
        setTimeout(() => {
          setIsActive(false);
        }, 250),

        setTimeout(() => {
          setGlitchType(Math.floor(Math.random() * 4));
          setIsActive(true);
        }, 400),

        setTimeout(() => {
          setIsActive(false);
        }, 550),

        // One more glitch for good measure
        setTimeout(() => {
          setGlitchType(Math.floor(Math.random() * 4));
          setIsActive(true);
        }, 700),

        setTimeout(() => {
          setIsActive(false);
        }, 800)
      ];

      return () => timers.forEach(timer => clearTimeout(timer));
    }
  }, [messages]);

  // Update log text based on state changes
  useEffect(() => {
    const logs: string[] = ['SIGNET SUBNET MONITOR'];

    // Add version info
    logs.push('');

    // Check for connected subnets
    if (status && Object.keys(status).length > 0) {
      const subnetCount = Object.keys(status).length;
      logs.push(`[SYSTEM] Connected to ${subnetCount} subnet${subnetCount > 1 ? 's' : ''}`);

      // List each subnet
      Object.values(status).forEach(subnetStatus => {
        if (subnetStatus && subnetStatus.subnet) {
          const subnetName = subnetStatus.subnet.split('.')[1];
          logs.push(`  └─ ${subnetName}`);
        }
      });
    } else {
      logs.push('[SYSTEM] No subnets connected');
    }

    // Add signer info
    if (currentAccount && currentAccount.stxAddress) {
      logs.push(`[SIGNER] ${currentAccount.stxAddress.substring(0, 6)}...${currentAccount.stxAddress.substring(currentAccount.stxAddress.length - 4)}`);
    } else {
      logs.push('[SIGNER] No active signer');
    }

    // Count total pending transactions across all subnets
    const totalPendingTx = status
      ? Object.values(status).reduce((count, subnetStatus) => count + (subnetStatus.txQueue?.length || 0), 0)
      : 0;

    logs.push(`[MEMPOOL] ${totalPendingTx} transactions pending`);

    // Add error info if present
    if (error) {
      logs.push('');
      logs.push(`[ERROR] ${error}`);
    }

    // Add recent message logs (limit to last 3)
    if (messages && messages.length > 0) {
      logs.push('');
      logs.push('RECENT ACTIVITY:');

      const recentMessages = messages.slice(-3);
      recentMessages.forEach(msg => {
        const time = new Date(msg.timestamp).toLocaleTimeString().split(' ')[0];
        logs.push(`[${time}] ${msg.type}: ${JSON.stringify(msg.data).substring(0, 30)}...`);
      });
    }

    setLogText(logs);

    // Update displayed text
    setDisplayedText(logs);

    // Trigger glitch effect on render with random glitch type
    setIsActive(true);
    setGlitchType(Math.floor(Math.random() * 4));

    // Reset after brief delay
    setTimeout(() => {
      setIsActive(false);
    }, 350);
  }, [messages, status, currentAccount, error]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6, duration: 0.5 }}
      style={{
        background: 'rgba(1, 4, 9, 0.8)',
        border: '1px solid rgba(125, 249, 255, 0.3)',
        borderRadius: '2px',
        padding: '12px',
        position: 'relative',
        height: '110px',
        zIndex: 1,
        overflow: 'hidden'
      }}
      onClick={() => {
        // More intense triple glitch on click with random types
        setGlitchType(Math.floor(Math.random() * 4));
        setIsActive(true);

        // First glitch - 100ms
        setTimeout(() => {
          setIsActive(false);
        }, 100);

        // Second glitch - different type
        setTimeout(() => {
          setGlitchType(Math.floor(Math.random() * 4));
          setIsActive(true);
        }, 150);

        // End second glitch
        setTimeout(() => {
          setIsActive(false);
        }, 250);

        // Third glitch - different type
        setTimeout(() => {
          setGlitchType(Math.floor(Math.random() * 4));
          setIsActive(true);
        }, 300);

        // End third glitch
        setTimeout(() => {
          setIsActive(false);
        }, 400);
      }}
    >
      {/* Panel border effect - shimmer at top */}
      <motion.div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '2px',
          background: 'linear-gradient(90deg, transparent 0%, rgba(125, 249, 255, 0.6) 50%, transparent 100%)',
          opacity: 0.6
        }}
      >
        <motion.div
          animate={{ x: ['-100%', '100%'] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
          style={{
            width: '30%',
            height: '100%',
            background: 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.8) 50%, transparent 100%)'
          }}
        />
      </motion.div>

      {/* Panel detail - "circuit" lines */}
      <div style={{
        position: 'absolute',
        top: '10px',
        right: '6px',
        width: '25px',
        height: '30px',
        zIndex: 2
      }}>
        <div style={{
          position: 'absolute',
          top: '0px',
          right: '0px',
          width: '2px',
          height: '100%',
          background: 'rgba(125, 249, 255, 0.15)'
        }} />
        <div style={{
          position: 'absolute',
          top: '8px',
          right: '0px',
          width: '10px',
          height: '2px',
          background: 'rgba(125, 249, 255, 0.15)'
        }} />
        <div style={{
          position: 'absolute',
          top: '18px',
          right: '0px',
          width: '15px',
          height: '2px',
          background: 'rgba(125, 249, 255, 0.15)'
        }} />
        <div style={{
          position: 'absolute',
          top: '28px',
          right: '0px',
          width: '5px',
          height: '2px',
          background: 'rgba(125, 249, 255, 0.15)'
        }} />
      </div>

      {/* CRT scan lines effect */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: 'repeating-linear-gradient(0deg, rgba(125, 249, 255, 0.03) 0px, rgba(125, 249, 255, 0.03) 1px, transparent 1px, transparent 2px)',
        pointerEvents: 'none'
      }} />

      {/* Multiple cyberpunk glitch effects */}
      <svg style={{ position: 'absolute', width: 0, height: 0 }}>
        <defs>
          <filter id="glitch-effect">
            {/* Base image with slight vertical offset */}
            <feOffset in="SourceGraphic" dx="0" dy={glitchY as unknown as number} result="BASE" />

            {/* RGB shift - subtle pixel offset based on color channels */}
            <feOffset in="SourceGraphic" dx={rgbShift as unknown as number} dy="0" result="RED" />
            <feOffset in="SourceGraphic" dx="0" dy="0" result="GREEN" />
            <feOffset in="SourceGraphic" dx={-rgbShift as unknown as number} dy="0" result="BLUE" />

            {/* Recombine with modified color channels */}
            <feColorMatrix
              in="RED"
              type="matrix"
              values="1 0 0 0 0
                      0 0 0 0 0
                      0 0 0 0 0
                      0 0 0 1 0"
              result="R"
            />
            <feColorMatrix
              in="GREEN"
              type="matrix"
              values="0 0 0 0 0
                      0 1 0 0 0
                      0 0 0 0 0
                      0 0 0 1 0"
              result="G"
            />
            <feColorMatrix
              in="BLUE"
              type="matrix"
              values="0 0 0 0 0
                      0 0 0 0 0
                      0 0 1 0 0
                      0 0 0 1 0"
              result="B"
            />

            {/* Create a scan line effect - using rect with clipPath instead of feRect */}
            <feFlood floodColor="#36C758" floodOpacity="0.3" result="SCAN_COLOR" />
            <feOffset in="SourceGraphic" dx="0" dy={scanlinePos as unknown as number} result="SCAN_OFFSET" />
            <feComposite operator="in" in="SCAN_COLOR" in2="SCAN_OFFSET" result="SCAN" />

            {/* Random noise overlay */}
            <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="4" stitchTiles="stitch" result="NOISE" />
            <feColorMatrix type="matrix"
              values="1 0 0 0 0 
                      0 1 0 0 0 
                      0 0 1 0 0 
                      0 0 0 0 1"
              in="NOISE" result="COLORED_NOISE" />
            <feComposite operator="arithmetic" k1="0" k2={noiseOpacity as unknown as number} k3="0" k4="0"
              in="COLORED_NOISE" in2="SourceGraphic" result="NOISE_ALPHA" />

            {/* Merge all effects */}
            <feMerge>
              <feMergeNode in="R" />
              <feMergeNode in="G" />
              <feMergeNode in="B" />
              <feMergeNode in="SCAN" />
              <feMergeNode in="NOISE_ALPHA" />
            </feMerge>
          </filter>
        </defs>
      </svg>

      {/* Console text with glitch effect and typing animation */}
      <animated.div style={{
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#36C758', /* Green text */
        margin: 0,
        height: '100%',
        overflow: 'auto',
        lineHeight: '1.4',
        scrollbarWidth: 'thin',
        scrollbarColor: 'rgba(125, 249, 255, 0.3) rgba(1, 4, 9, 0.5)',
        filter: 'url(#glitch-effect)',
        fontWeight: 500, /* Slightly bolder for better readability */
        letterSpacing: '0.2px' /* Subtle letter spacing for readability */
      }}>
        {/* Display the text that's been "typed" so far */}
        {displayedText.map((line, index) => (
          <div key={index}>
            {line.startsWith('[ERROR]') ? (
              <span style={{ color: '#FF4E4E' }}>{line}</span>
            ) : line.startsWith('[SIGNER]') ? (
              <span style={{ color: '#36C758' }}>{line}</span>
            ) : line.includes('RECENT ACTIVITY:') ? (
              <span style={{ color: '#FFCC00' }}>{line}</span>
            ) : (
              line
            )}
          </div>
        ))}

        {/* Fixed cursor */}
        <span>_</span>
      </animated.div>
    </motion.div>
  );
}