import React, { forwardRef, useRef } from 'react';
import ReactDatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { FiCalendar } from 'react-icons/fi';
import { Locale } from 'date-fns';
import Input, { InputProps } from '@/shared/components/Input';
import styles from './DatePicker.module.css';

// Omit all InputProps that conflict with our own or are handled internally
export interface DatePickerProps
  extends Omit<InputProps, 'rightIcon' | 'type' | 'onChange' | 'value' | 'defaultValue'> {
  /** Currently selected date (or null) */
  selected: Date | null;
  /** Callback when date changes */
  onChange: (date: Date | null) => void;
  /** Minimum selectable date */
  minDate?: Date;
  /** Maximum selectable date */
  maxDate?: Date;
  /** Whether to show time select (default false) */
  showTimeSelect?: boolean;
  /** Date format string (default 'yyyy-MM-dd') */
  dateFormat?: string;
  /** Locale object from date-fns (default browser locale) */
  locale?: Locale;
  /** Additional CSS class for the wrapper */
  wrapperClassName?: string;
}

/**
 * A theme‑aware date picker that uses the shared Input component.
 * All Input props (variant, size, error, fullWidth, leftIcon, etc.) are supported.
 *
 * @example
 * <DatePicker
 *   selected={date}
 *   onChange={setDate}
 *   placeholder="Select a date"
 *   variant="outline"
 *   size="md"
 * />
 */
const DatePicker = forwardRef<HTMLInputElement, DatePickerProps>(
  (
    {
      selected,
      onChange,
      minDate,
      maxDate,
      showTimeSelect = false,
      dateFormat = 'yyyy-MM-dd',
      locale,
      wrapperClassName = '',
      // Input props
      variant = 'outline',
      size = 'md',
      error = false,
      fullWidth = false,
      leftIcon,
      disabled,
      readOnly,
      placeholder,
      id,
      name,
      required,
      'aria-label': ariaLabel,
      className,
      ...rest
    },
    ref
  ) => {
    const datePickerRef = useRef<any>(null);

    // Custom input component that wraps the shared Input and makes the calendar icon clickable.
    const CustomInput = forwardRef<HTMLInputElement, any>(
      ({ value, onClick, onChange: onInputChange, onBlur, ...props }, inputRef) => {
        const handleIconClick = (e: React.MouseEvent) => {
          e.stopPropagation(); // prevent double trigger if event bubbles
          // Programmatically open the date picker
          datePickerRef.current?.setOpen(true);
          onClick?.(e);
        };

        return (
          <Input
            ref={inputRef}
            value={value}
            onChange={onInputChange}
            onBlur={onBlur}
            placeholder={placeholder}
            disabled={disabled}
            readOnly={readOnly}
            variant={variant}
            size={size}
            error={error}
            fullWidth={fullWidth}
            leftIcon={leftIcon}
            rightIcon={
              <span onClick={handleIconClick} className={styles.iconClickable}>
                <FiCalendar />
              </span>
            }
            id={id}
            name={name}
            required={required}
            aria-label={ariaLabel}
            className={className}
            {...props}
          />
        );
      }
    );
    CustomInput.displayName = 'DatePickerCustomInput';

    return (
      <div className={`${styles.container} ${wrapperClassName}`}>
        <ReactDatePicker
          ref={datePickerRef}
          selected={selected}
          onChange={onChange}
          minDate={minDate}
          maxDate={maxDate}
          disabled={disabled}
          showTimeSelect={showTimeSelect}
          dateFormat={dateFormat}
          locale={locale}
          customInput={<CustomInput ref={ref} />}
          popperClassName={styles.popper}
          calendarClassName={styles.calendar}
          dayClassName={() => styles.day}
          weekDayClassName={() => styles.weekDay}
          monthClassName={() => styles.month}
          timeClassName={() => styles.time}
        />
      </div>
    );
  }
);

DatePicker.displayName = 'DatePicker';

export default DatePicker;