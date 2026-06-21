import { useEffect, useRef, useState } from 'react';
import { FiChevronDown } from 'react-icons/fi';

export const CustomSelect = ({
  label,
  value,
  onChange,
  options = [],
  placeholder = 'Seleccionar',
  className = ''
}) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  const selectedOption = options.find((option) => String(option.value) === String(value));

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`custom-select ${className}`} ref={rootRef}>
      {label && <span className="custom-select__label">{label}</span>}

      <button
        className="custom-select__button"
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{selectedOption?.label || placeholder}</span>
        <FiChevronDown />
      </button>

      {open && (
        <div className="custom-select__menu" role="listbox">
          {options.map((option) => {
            const active = String(option.value) === String(value);

            return (
              <button
                key={option.value || 'all'}
                type="button"
                className={active ? 'active' : ''}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
