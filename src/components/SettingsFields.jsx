export const RangeField = ({ label, value, min, max, step, suffix = 'px', disabled = false, onChange }) => (
    <label className={`field${disabled ? ' is-disabled' : ''}`}>
        <span className="field__label">{label}</span>
        <input
            type="range"
            aria-label={label}
            min={min}
            max={max}
            step={step}
            value={value}
            disabled={disabled}
            onChange={(event) => onChange(Number(event.target.value))}
        />
        <output className="field__value mono">{value}{suffix}</output>
    </label>
);

export const ChoiceGroup = ({ label, options, value, disabled = false, onChange }) => (
    <div className="choice" role="group" aria-label={label}>
        <span className="choice__label">{label}</span>
        <div className="choice__options">
            {options.map(([id, text, optionDisabled]) => (
                <button
                    key={id}
                    type="button"
                    className={value === id ? 'is-active' : ''}
                    aria-pressed={value === id}
                    disabled={disabled || optionDisabled}
                    onClick={() => onChange(id)}
                >
                    {text}
                </button>
            ))}
        </div>
    </div>
);
