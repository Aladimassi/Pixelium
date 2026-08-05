interface AuditEvent {
  timestamp: string;
  eventType: string;
  severity: string;
}

import { useDialog } from '../hooks/useDialog';

interface AdminModalProps {
  open: boolean;
  output: string;
  events: AuditEvent[];
  onClose: () => void;
  onDemoRealtime: () => void;
  onDemoDelegated: () => void;
}

export function AdminModal({ open, output, events, onClose, onDemoRealtime, onDemoDelegated }: AdminModalProps) {
  const dialogRef = useDialog(open);

  return (
    <dialog ref={dialogRef} id="admin-modal" className="admin-modal">
      <button type="button" id="btn-close-admin" className="modal-close" aria-label="Close" onClick={onClose}>
        ✕
      </button>
      <h2>Audit Console</h2>
      <div className="admin-actions button-row">
        <button type="button" id="btn-demo-realtime" className="btn-secondary" onClick={onDemoRealtime}>
          Demo Real-Time
        </button>
        <button type="button" id="btn-demo-delegated" className="btn-secondary" onClick={onDemoDelegated}>
          Demo Delegated
        </button>
      </div>
      <pre id="admin-output" className="output">
        {output}
      </pre>
      <div className="table-wrap" style={{ marginTop: '1.5rem' }}>
        <table id="events-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Event</th>
              <th>Severity</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e, i) => (
              <tr key={i}>
                <td>{new Date(e.timestamp).toLocaleTimeString()}</td>
                <td>{e.eventType}</td>
                <td className={`severity-${e.severity}`}>{e.severity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </dialog>
  );
}
