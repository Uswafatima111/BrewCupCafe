
import { useEffect, useState, lazy, Suspense } from "react";
import SceneErrorBoundary from "./components/SceneErrorBoundary";
import Modal from "./components/Modal";
import MenuPanel from "./components/MenuPanel";
import CartPanel from "./components/CartPanel";
import CheckoutPanel from "./components/CheckoutPanel";
import ChatPanel from "./components/ChatPanel";

const CafeScene = lazy(() => import("./components/CafeScene"));

function LoadingScreen({ done }) {
  return (
    <div
      className={`fixed inset-0 z-50 grid place-items-center bg-[#03170e] text-[#d9a441] transition-opacity duration-700 ${
        done ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      <div className="text-center">
        <img
          src="/images/logo.jpg"
          alt="Brew Cup Cafe"
          className="mx-auto mb-4 h-24 rounded-full"
          onError={(e) => (e.currentTarget.style.display = "none")}
        />
        <p className="tracking-[0.4em]">BREW CUP CAFE</p>
      </div>
    </div>
  );
}

export default function App() {
  const [loaded, setLoaded] = useState(false);
  const [overlay, setOverlay] = useState(null);
  const [cart, setCart] = useState([]);

  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 1500);
    return () => clearTimeout(t);
  }, []);

  const handleInteract = (name) => {
    if (name === "INTERACT_Telephone") {
      setOverlay("chat");
    } else {
      setOverlay("menu");
    }
  };

  const addToCart = (item) =>
    setCart((c) => {
      const found = c.find((i) => i.id === item.id);

      if (found) {
        return c.map((i) =>
          i.id === item.id
            ? { ...i, quantity: i.quantity + 1 }
            : i
        );
      }

      return [
        ...c,
        {
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: 1,
        },
      ];
    });

  const setQty = (id, quantity) =>
    setCart((c) =>
      quantity <= 0
        ? c.filter((i) => i.id !== id)
        : c.map((i) =>
            i.id === id ? { ...i, quantity } : i
          )
    );

  const close = () => setOverlay(null);

  return (
    <>
      <LoadingScreen done={loaded} />

      <SceneErrorBoundary>
        <Suspense fallback={null}>
          <CafeScene onInteract={handleInteract} />
        </Suspense>
      </SceneErrorBoundary>

      {overlay === "menu" && (
        <MenuPanel
          cart={cart}
          onAdd={addToCart}
          onOpenCart={() => setOverlay("cart")}
          onClose={close}
        />
      )}

      {overlay === "cart" && (
        <CartPanel
          cart={cart}
          onSetQty={setQty}
          onBack={() => setOverlay("menu")}
          onCheckout={() => setOverlay("checkout")}
          onClose={close}
        />
      )}

      {overlay === "checkout" && (
        <CheckoutPanel
          cart={cart}
          onBack={() => setOverlay("cart")}
          onDone={() => {
            setCart([]);
            setOverlay(null);
          }}
          onClose={close}
        />
      )}

      {overlay === "chat" && (
        <ChatPanel onClose={close} />
      )}
    </>
  );
}
