import { useEffect } from 'react';

export default function Confirmation({ title, message, onConfirm, onCancel }) {
  useEffect(() => {
    const onKey = event => { if (event.key === 'Escape') { event.stopImmediatePropagation(); onCancel(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onCancel]);
  return <div className="confirmation-layer" onClick={onCancel}>
    <section className="confirmation" role="alertdialog" aria-modal="true" aria-labelledby="confirmation-title" aria-describedby="confirmation-message" onClick={event => event.stopPropagation()}>
      <h2 id="confirmation-title">{title}</h2>
      <p id="confirmation-message">{message}</p>
      <div className="confirmation-actions">
        <button onClick={onCancel} autoFocus>Cancelar</button>
        <button onClick={onConfirm}>Confirmar</button>
      </div>
    </section>
  </div>;
}
