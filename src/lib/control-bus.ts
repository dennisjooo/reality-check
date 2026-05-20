export type ControlEvent = "continue" | "pause" | "reset";

export class ControlBus extends EventTarget {
  private _listeners = new Map<ControlEvent, Set<() => void>>();

  on(event: ControlEvent, handler: () => void): () => void {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event)!.add(handler);

    const boundHandler = () => handler();
    this.addEventListener(event, boundHandler);

    return () => {
      this._listeners.get(event)?.delete(handler);
      this.removeEventListener(event, boundHandler);
    };
  }

  continue() {
    this.dispatchEvent(new CustomEvent("continue"));
  }

  pause() {
    this.dispatchEvent(new CustomEvent("pause"));
  }

  reset() {
    this.dispatchEvent(new CustomEvent("reset"));
  }
}
