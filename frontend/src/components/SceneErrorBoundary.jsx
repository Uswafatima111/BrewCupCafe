import { Component } from "react";

export default class SceneErrorBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) {
      return (
        <div className="fixed inset-0 bg-cover bg-center" style={{ backgroundImage: "url(/images/facade_night.jpg)" }}>
          <p className="absolute bottom-24 w-full text-center text-[#f3e3b8]">3D view unavailable. You can still browse the menu.</p>
        </div>
      );
    }
    return this.props.children;
  }
}