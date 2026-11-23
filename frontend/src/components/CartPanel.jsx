import Modal from "./Modal";

export default function CartPanel({ cart, onSetQty, onBack, onCheckout, onClose }) {
  // Display only. The server recalculates the real total from trusted prices.
  const total = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);

  return (
    <Modal title="YOUR CART" onClose={onClose}>
      {cart.length === 0 ? (
        <p className="py-6 text-center opacity-80">Your cart is empty.</p>
      ) : (
        <ul className="divide-y divide-[#d9a441]/20">
          {cart.map((i) => (
            <li key={i.id} className="flex items-center gap-3 py-3">
              <div className="flex-1">
                <p>{i.name}</p>
                <p className="text-sm opacity-70">₹{i.price} each</p>
              </div>
              <div className="flex items-center gap-2">
                <button className="h-8 w-8 rounded-full border border-[#d9a441]" onClick={() => onSetQty(i.id, i.quantity - 1)}>−</button>
                <span className="w-6 text-center">{i.quantity}</span>
                <button className="h-8 w-8 rounded-full border border-[#d9a441]" onClick={() => onSetQty(i.id, i.quantity + 1)}>+</button>
              </div>
              <span className="w-20 text-right text-[#d9a441]">₹{i.price * i.quantity}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex items-center justify-between border-t border-[#d9a441]/30 pt-4">
        <button className="underline" onClick={onBack}>← Back to menu</button>
        <div className="text-right">
          <p className="text-lg">Total: <span className="text-[#d9a441]">₹{total}</span></p>
          <button
            disabled={cart.length === 0}
            onClick={onCheckout}
            className="mt-2 rounded-full bg-[#d9a441] px-6 py-2 text-[#03170e] disabled:opacity-40"
          >
            Checkout
          </button>
        </div>
      </div>
    </Modal>
  );
}