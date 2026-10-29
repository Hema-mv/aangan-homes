import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useLiveEvents, STALE_MS } from "./useLiveEvents.js";

// Minimal stand-in for the browser's EventSource that tests can drive by hand.
class FakeEventSource {
  static CONNECTING = 0; static OPEN = 1; static CLOSED = 2;
  static all = [];
  constructor(url) { this.url = url; this.readyState = 0; this.listeners = {}; FakeEventSource.all.push(this); }
  addEventListener(name, fn) { (this.listeners[name] ??= []).push(fn); }
  open() { this.readyState = 1; this.onopen?.(); }
  emit(name, data) { for (const fn of this.listeners[name] ?? []) fn({ data: JSON.stringify(data) }); }
  close() { this.readyState = 2; }
}

beforeEach(() => {
  vi.useFakeTimers();
  FakeEventSource.all = [];
  vi.stubGlobal("EventSource", FakeEventSource);
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

test("delivers events to the latest handlers and tracks presence", () => {
  const onCreated = vi.fn();
  const { result } = renderHook(() => useLiveEvents({ "listing:created": onCreated }));
  const es = FakeEventSource.all[0];
  act(() => { es.open(); es.emit("presence", { online: 3 }); es.emit("listing:created", { id: "x" }); });
  expect(result.current).toEqual({ status: "live", online: 3 });
  expect(onCreated).toHaveBeenCalledWith({ id: "x" });
});

test("heartbeats keep a quiet connection alive", () => {
  renderHook(() => useLiveEvents({}));
  const es = FakeEventSource.all[0];
  act(() => es.open());
  for (let i = 0; i < 6; i++) act(() => { vi.advanceTimersByTime(25_000); es.emit("ping", {}); });
  expect(FakeEventSource.all).toHaveLength(1);
});

// Regression: a proxy dropped the upstream stream but kept the browser's side open,
// so the badge said "live" while no events arrived.
test("reconnects a silent stream and asks the app to resync", () => {
  const resync = vi.fn();
  const { result } = renderHook(() => useLiveEvents({ resync }));
  act(() => FakeEventSource.all[0].open());
  act(() => vi.advanceTimersByTime(STALE_MS + 10_000));
  expect(FakeEventSource.all[0].readyState).toBe(FakeEventSource.CLOSED);
  expect(FakeEventSource.all).toHaveLength(2);
  expect(result.current.status).toBe("connecting");
  expect(resync).not.toHaveBeenCalled();
  act(() => FakeEventSource.all[1].open());
  expect(resync).toHaveBeenCalledOnce();
  expect(result.current.status).toBe("live");
});
