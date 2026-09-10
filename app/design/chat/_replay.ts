"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { eventDelay, expandToStream, reduceTranscript, type StoredEvent } from "@/components/patterns/chat";

/**
 * Plays a stored log back as the live stream that produced it. The thread is
 * always `reduceTranscript(stream.slice(0, cursor))` — the same call the app
 * makes on load with the whole log — so what the demo shows is what a
 * reconnect shows.
 */
export function useReplay(events: StoredEvent[], autoplay = false) {
  const stream = useMemo(() => expandToStream(events), [events]);
  const [cursor, setCursor] = useState(autoplay ? 0 : stream.length);
  const [armed, setArmed] = useState(autoplay);
  const playing = armed && cursor < stream.length;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!playing) return;
    timer.current = setTimeout(() => setCursor((c) => c + 1), eventDelay(stream[cursor]));
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [playing, cursor, stream]);

  const transcript = useMemo(() => reduceTranscript(stream.slice(0, cursor)), [stream, cursor]);

  const replay = useCallback(() => {
    setCursor(0);
    setArmed(true);
  }, []);
  const finish = useCallback(() => {
    setArmed(false);
    setCursor(stream.length);
  }, [stream.length]);

  return { transcript, playing, replay, finish, progress: stream.length ? cursor / stream.length : 1 };
}
