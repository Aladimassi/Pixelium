interface ToastProps {
  message: string | null;
}

export function Toast({ message }: ToastProps) {
  return (
    <div id="toast" className={`toast${message ? '' : ' hidden'}`} role="status">
      {message ?? ''}
    </div>
  );
}
