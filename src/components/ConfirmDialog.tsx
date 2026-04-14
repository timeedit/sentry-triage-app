"use client";

import type { ConfirmEvent } from "@/lib/types";

export function ConfirmDialog({
  confirm,
  onResolve,
}: {
  confirm: ConfirmEvent;
  onResolve: (confirmed: boolean) => void;
}) {
  return (
    <div className="confirm-overlay">
      <div className="confirm-dialog">
        <h3>Confirm Jira Ticket</h3>
        <p>{confirm.preview}</p>
        <div className="confirm-details">
          {Object.entries(confirm.input).map(([key, value]) => (
            <div key={key} className="confirm-field">
              <span className="confirm-label">{key}:</span>
              <span className="confirm-value">
                {typeof value === "string" ? value : JSON.stringify(value)}
              </span>
            </div>
          ))}
        </div>
        <div className="confirm-actions">
          <button className="btn-cancel" onClick={() => onResolve(false)}>
            Cancel
          </button>
          <button className="btn-confirm" onClick={() => onResolve(true)}>
            Create Ticket
          </button>
        </div>
      </div>
    </div>
  );
}
