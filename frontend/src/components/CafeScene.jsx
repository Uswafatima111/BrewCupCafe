// TEMPORARY placeholder. Replace with Shura's real CafeScene.jsx when it arrives.
export default function CafeScene({ onInteract }) {
  return (
    <div className="fixed inset-0 bg-cover bg-center" style={{ backgroundImage: "url(/images/facade_night.jpg)" }}>
      <div className="absolute bottom-6 w-full text-center space-x-3">
        <button className="rounded-full border border-[#d9a441] px-5 py-2" onClick={() => onInteract("INTERACT_MenuDisplay")}>Menu (test)</button>
        <button className="rounded-full border border-[#d9a441] px-5 py-2" onClick={() => onInteract("INTERACT_Telephone")}>Chat (test)</button>
      </div>
    </div>
  );
}
