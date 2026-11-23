import { useState } from "react";
import Modal from "./Modal";
import { placeOrder } from "../lib/api";

const field = "w-full rounded-lg border border-[#d9a441]/50 bg-black/30 px-3 py-2 outline-none focus:border-[#d9a441]";

export default function CheckoutPanel({ cart, onBack, onDone, onClose }) {
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [status, setStatus] = useState("idle"); // idle | loading | error | success
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const total = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const validate = () => {
    if (form.name.trim().length < 2) return "Please enter your name.";
    if (!/^\S+@\S+\.\S+$/.test(form.email)) return "Please enter a valid email.";
    if (!/^\d{10}$/.test(form.phone.replace(/\D/g, ""))) return "Please enter a 10-digit phone number.";
    if (cart.length === 0) return "Your cart is empty.";
    return "";
  };

  const submit = async () => {
    const problem = validate();
    if (problem) { setError(problem); setStatus("error"); return; }
    setStatus("loading"); setError("");
    try {
      const items = cart.map(({ id, name, quantity }) => ({ id, name, quantity }));
      const data = await placeOrder(
        { name: form.name.trim(), email: form.email.trim(), phone: form.phone.replace(/\D/g, "") },
        items
      );
      if (!data.success) throw new Error(data.message || "Order could not be placed.");
      setResult(data); setStatus("success");
    } catch (e) {
      setError(e.message || "Something went wrong. Please try again."); setStatus("error");
    }
  };

  if (status === "success") {
    return (
      <Modal title="ORDER CONFIRMED" onClose={() => { onDone(); }}>
        <div className="py-4 text-center">
          <p className="text-4xl">✓</p>
          <p className="mt-2 text-lg">{result.message}</p>
          <p className="mt-4">Order ID: <span className="text-[#d9a441]">{result.orderId}</span></p>
          <p>Total: <span className="text-[#d9a441]">₹{result.total}</span></p>
          <p className="mt-3 text-sm opacity-70">A confirmation email is on its way to {form.email}.</p>
          <button onClick={onDone} className="mt-6 rounded-full bg-[#d9a441] px-6 py-2 text-[#03170e]">Done</button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="CHECKOUT" onClose={onClose}>
      <div className="grid gap-3">
        <input className={field} placeholder="Full name" value={form.name} onChange={set("name")} />
        <input className={field} placeholder="Email" type="email" value={form.email} onChange={set("email")} />
        <input className={field} placeholder="Phone (10 digits)" inputMode="numeric" value={form.phone} onChange={set("phone")} />
      </div>

      <p className="mt-4 text-sm opacity-80">
        {cart.map((i) => `${i.quantity} × ${i.name}`).join(", ")}
      </p>
      <p className="mt-1">Estimated total: <span className="text-[#d9a441]">₹{total}</span></p>

      {status === "error" && <p className="mt-3 rounded-lg bg-red-900/40 p-2 text-sm text-red-200">{error}</p>}

      <div className="mt-5 flex items-center justify-between">
        <button className="underline" onClick={onBack} disabled={status === "loading"}>← Back to cart</button>
        <button
          onClick={submit}
          disabled={status === "loading"}
          className="rounded-full bg-[#d9a441] px-6 py-2 text-[#03170e] disabled:opacity-50"
        >
          {status === "loading" ? "Placing order…" : "Place order"}
        </button>
      </div>
    </Modal>
  );
}