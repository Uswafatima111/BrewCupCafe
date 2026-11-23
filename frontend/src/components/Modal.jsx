export default function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/60 p-3" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-[#d9a441]/40 bg-[#03170e] p-5 text-[#f3e3b8]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl tracking-widest text-[#d9a441]">{title}</h2>
          <button className="text-2xl leading-none" onClick={onClose} aria-label="Close">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}