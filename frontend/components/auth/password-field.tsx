"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

type PasswordFieldProps = {
  id: string;
  name: string;
  label: string;
  autoComplete: string;
  value?: string;
  onChange?: (value: string) => void;
  describedBy?: string;
};

export function PasswordField({
  id,
  name,
  label,
  autoComplete,
  value,
  onChange,
  describedBy,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="form-field">
      <label htmlFor={id}>{label}</label>
      <div className="password-control">
        <input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={onChange ? (event) => onChange(event.target.value) : undefined}
          aria-describedby={describedBy}
          required
        />
        <button
          type="button"
          aria-label={visible ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
          title={visible ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}
