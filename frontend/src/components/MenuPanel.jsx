import { useState } from "react";
import menu from "../data/menu.json";
import Modal from "./Modal";

export default function MenuPanel({ cart, onAdd, onOpenCart, onClose }) {
  const [cat, setCat] = useState(menu.categories[0]);
  const items = menu.items.filter((i) => i.category === cat);
  const count = cart.reduce((n, i) => n + i.quantity, 0);

  return (
    <Modal title="MENU" onClose={onClose}>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {menu.categories.map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={`rounded-full border px-4 py-1 ${c === cat ? "bg-[#d9a441] text-[#03170e]" : "border-[#d9a441]"}`}
          >
            {c}
          </button>
        ))}
        <button onClick={onOpenCart} className="ml-auto rounded-full border border-[#d9a441] px-4 py-1">
          Cart ({count})
        </button>
      </div>

      <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3">
        {items.map((item) => (
          <div key={item.id} className="w-64 shrink-0 snap-center rounded-xl border border-[#d9a441]/40 bg-black/30 p-3">
            <div className="mb-3 grid h-36 place-items-center overflow-hidden rounded-lg bg-[#0b2a1b]">
              <img
                src={item.image}
                alt={item.name}
                className="h-full w-full object-cover"
                onError={(e) => (e.currentTarget.style.display = "none")}
              />
            </div>
            <h3 className="text-lg">{item.name}</h3>
            <p className="mb-2 min-h-[3rem] text-sm opacity-80">{item.description}</p>
            <div className="flex items-center justify-between">
              <span className="text-[#d9a441]">₹{item.price}</span>
              <button
                onClick={() => onAdd(item)}
                className="rounded-full bg-[#d9a441] px-4 py-1 text-[#03170e]"
              >
                Add
              </button>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs opacity-60">Sample menu data. Prices will be confirmed by the cafe.</p>
    </Modal>
  );
}