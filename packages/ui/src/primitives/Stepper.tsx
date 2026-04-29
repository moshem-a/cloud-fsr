export interface StepperProps {
  steps: string[];
  current: number;
  onStepClick?: (step: number) => void;
}

export function Stepper({ steps, current, onStepClick }: StepperProps) {
  return (
    <ol className="setup-stepper">
      {steps.map((label, i) => {
        const status = i < current ? "done" : i === current ? "active" : "pending";
        const clickable = onStepClick && i <= current;
        return (
          <li
            key={label}
            className={`stepper-step stepper-step-${status} ${clickable ? "clickable" : ""}`}
          >
            <button
              type="button"
              disabled={!clickable}
              onClick={() => clickable && onStepClick?.(i)}
            >
              <span className="stepper-num">{i + 1}</span>
              <span className="stepper-label">{label}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
