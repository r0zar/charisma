/**
 * Password box that shows each typed character as a random alien symbol.
 */
import { useRef } from 'react';

export function PasswordField({ value, onChange, onEnter, placeholder, label }: {
  value: string;
  onChange: (value: string) => void;
  onEnter: (e: React.KeyboardEvent) => void;
  placeholder: string;
  label: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div
      tabIndex={0}
      onClick={() => input.current?.focus()}
      style={{
        position: 'relative',
        height: '60px',
        background: 'linear-gradient(180deg, rgba(1, 4, 9, 0.9) 0%, rgba(1, 4, 9, 0.7) 100%)',
        border: '1px solid rgba(125, 249, 255, 0.4)',
        borderRadius: '6px',
        padding: '8px 12px',
        boxShadow: '0 0 15px rgba(125, 249, 255, 0.2) inset',
        overflow: 'hidden',
        cursor: 'text',
        transition: 'border-color 0.2s ease, box-shadow 0.2s ease'
      }}
    >
      {/* Blinking cursor effect - only showing when there's no placeholder */}
      {value.length > 0 && (
        <div style={{
          display: 'none', // Hide cursor since we're using centered layout
          position: 'absolute',
          top: '50%',
          transform: 'translateY(-50%)',
          left: '50%',
          marginLeft: `${Math.min(value.length * 12, 120)}px`,
          width: '2px',
          height: '24px',
          background: 'rgba(125, 249, 255, 0.8)',
          animation: 'blink 1s infinite'
        }}></div>
      )}

      {/* Alien symbols for password visualization */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center', // Center the symbols horizontally
        gap: '8px',
        flexWrap: 'wrap',
        height: '100%',
        width: '100%'
      }}>
        {value.length === 0 ? (
          <span style={{
            color: 'rgba(125, 249, 255, 0.3)',
            fontSize: '14px',
            fontStyle: 'italic'
          }}>
            {placeholder}
          </span>
        ) : (
          value.split('').map((char, index) => {
            // Much larger set of unique alien/cyberpunk symbols
            const symbols = [
              '⌬', '⌖', '⍟', '⎔', '⎚', '⏣', '⏥', '⌘', '⍜', '⍚', '⍭', '⎊', '⎋', '⎓',
              '⌽', '⌾', '⍎', '⍕', '⍫', '⍰', '⎌', '⏧', '⌃', '⌔', '⌦', '⍉', '⏶', '⏷',
              '⌫', '⌯', '⏏', '⏭', '⍍', '⍢', '⍡', '⍖', '⍏', '⏯', '␣', '⏺', '⏹'
            ];

            // Complete randomization for each keystroke
            // Store a reference to already used symbols to avoid duplicates within this password
            const usedSymbols = value.split('').slice(0, index).map((_, i) => {
              const seed = value.length * 100 + i * 10;
              return (seed * 17) % symbols.length;
            });

            // Use a completely random seed with multiple factors
            let seed = Date.now() + index + value.length;
            let attempt = 0;
            let symbolIndex;

            // Try to generate a unique index not used yet in this password
            do {
              symbolIndex = Math.abs((seed * (index + 1) * (attempt + 1) * 31) % symbols.length);
              attempt++;
            } while (usedSymbols.includes(symbolIndex) && attempt < 5);

            // Create a completely unique set of used symbols for each render
            // This ensures even typing the same password twice will show different symbols
            // This adds to security as no visual pattern can be observed between sessions

            return (
              <span key={index} style={{
                color: `rgba(125, 249, 255, ${0.7 + (index % 5) * 0.06})`,
                fontSize: '20px',
                fontWeight: 'bold',
                display: 'inline-block',
                width: '22px',
                textAlign: 'center',
                textShadow: '0 0 5px rgba(125, 249, 255, 0.6)',
                animation: 'pulse 1.5s infinite',
                animationDelay: `${index * 0.1}s`
              }}>
                {symbols[symbolIndex]}
              </span>
            );
          })
        )}
      </div>

      {/* Actual password input, positioned absolutely to cover the container */}
      <input
        ref={input}
        aria-label={label}
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && value) {
            onEnter(e);
          }
        }}
        placeholder={placeholder}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          opacity: 0,
          cursor: 'text',
          zIndex: 1
        }}
        onFocus={(e) => {
          e.target.parentElement.style.borderColor = 'rgba(125, 249, 255, 0.8)';
          e.target.parentElement.style.boxShadow = '0 0 15px rgba(125, 249, 255, 0.3), 0 0 5px rgba(125, 249, 255, 0.5) inset';
          // Add subtle animation to the container when focused
          e.target.parentElement.style.animation = 'glow 1.5s infinite alternate';
        }}
        onBlur={(e) => {
          e.target.parentElement.style.borderColor = 'rgba(125, 249, 255, 0.4)';
          e.target.parentElement.style.boxShadow = '0 0 15px rgba(125, 249, 255, 0.2) inset';
          // Remove the animation when blurred
          e.target.parentElement.style.animation = 'none';
        }}
      />
    </div>
  );
}
