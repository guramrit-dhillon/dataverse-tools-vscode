import * as React from "react";

type FieldProps<E extends React.ElementType = "div"> = {
  label: string;
  fieldId: string;
  hint?: string;
  as?: E;
  children?: React.ReactNode;
} & Omit<React.ComponentPropsWithoutRef<E>, "label" | "children">;

/**
 * Form field wrapper — renders a label + input in a `.field` div.
 *
 * Two usage modes:
 *  1. Children wrapper:  `<Field label="Name" fieldId="x"><input id="x" /></Field>`
 *  2. Polymorphic `as`:  `<Field label="Name" as="input" id="x" type="text" />`
 *     When `as` is set, the element is rendered directly with all extra props forwarded.
 *     Children (e.g. `<option>` elements for `as="select"`) are passed through.
 */
export function Field<E extends React.ElementType = "div">({
  label,
  fieldId,
  hint,
  as,
  children,
  ...rest
}: FieldProps<E>): React.ReactElement {
  return (
    <div className="field">
      <label htmlFor={fieldId}>{label}</label>
      {as
        ? React.createElement(as, { id: fieldId, ...rest }, children)
        : children}
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}
