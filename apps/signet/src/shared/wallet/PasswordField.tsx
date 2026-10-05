/**
 * A password box with a Show / Hide switch.
 */
import { useState } from 'react';

export function PasswordField({ id, value, onChange, onEnter, placeholder, label }: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onEnter: () => void;
  placeholder: string;
  label: string;
}) {
  const [shown, setShown] = useState(false);
  return (
    <label className="w-field" htmlFor={id}>
      <span>{label}</span>
      <div className="w-input-wrap">
        <input
          id={id}
          className="w-input"
          type={shown ? 'text' : 'password'}
          value={value}
          placeholder={placeholder}
          autoComplete="current-password"
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && value) onEnter(); }}
        />
        <button type="button" className="cx-chip" onClick={() => setShown(s => !s)} aria-pressed={shown}>
          {shown ? 'Hide' : 'Show'}
        </button>
      </div>
    </label>
  );
}
