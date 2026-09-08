import React, { useEffect, useRef, useState } from "react";

interface NewItemInputProps {
  initialValue?: string;
  onConfirm: (name: string) => void;
  onCancel: () => void;
  isDir?: boolean;
}

export const NewItemInput: React.FC<NewItemInputProps> = ({
  initialValue = "",
  onConfirm,
  onCancel,
}) => {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      const trimmed = value.trim();
      if (trimmed) {
        onConfirm(trimmed);
      } else {
        onCancel();
      }
    } else if (e.key === "Escape") {
      onCancel();
    }
  };

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={onCancel}
      className="w-full min-w-0 bg-vscode-bg border border-vscode-activityBarActive text-vscode-textBright text-xs px-1 py-0.5 rounded outline-none shadow-inner"
    />
  );
};
