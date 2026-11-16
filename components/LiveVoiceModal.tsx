'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  AudioLines,
  Loader2,
  Mic,
  MicOff,
  PhoneOff,
  Send,
  Volume2,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface VoiceTopicContext {
  title: string;
  domain?: string;
  source?: string;
  summary?: string;
}

interface LiveVoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  topicContext?: VoiceTopicContext | null;
  onClearTopicContext?: () => void;
}

type VoiceName = 'Zephyr' | 'Puck' | 'Charon' | 'Kore' | 'Fenrir';

const VOICE_OPTIONS: ReadonlyArray<{ id: VoiceName; label: string }> = [
  { id: 'Zephyr', label: 'Zephyr (Balanced)' },
  { id: 'Puck', label: 'Puck (Upbeat)' },
  { id: 'Charon', label: 'Charon (Deep)' },
  { id: 'Kore', label: 'Kore (Warm)' },
  { id: 'Fenrir', label: 'Fenrir (Crisp)' },
];

type ConnectionPhase =
  | 'idle'
  | 'connecting'
  | 'listening'
  | 'speaking'
  | 'text-only';

interface TranscriptMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  finalized: boolean;
}

interface ServerBridgeMessage {
  type?: string;
  audio?: string;
  text?: string;
  finished?: boolean;
  interrupted?: boolean;
  error?: string;
  reason?: string;
}

function downsampleTo16k(input: Float32Array, sourceRate: number): Float32Array {
  if (sourceRate === 16000) return input;
  const ratio = sourceRate / 16000;
  const outputLength = Math.max(1, Math.round(input.length / ratio));
  const result = new Float32Array(outputLength);
  for (let i = 0; i < outputLength; i += 1) {
    const position = i * ratio;
    const lowerIndex = Math.floor(position);
    const upperIndex = Math.min(input.length - 1, lowerIndex + 1);
    const fraction = position - lowerIndex;
    result[i] =
      input[lowerIndex] + (input[upperIndex] - input[lowerIndex]) * fraction;
  }
  return result;
}

function encodePcm16Base64(floatSamples: Float32Array): string {
  const byteLength = floatSamples.length * 2;
  const buffer = new ArrayBuffer(byteLength);
  const view = new DataView(buffer);

  for (let i = 0; i < floatSamples.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, floatSamples[i]));
    const int16 =
      clamped < 0 ? Math.round(clamped * 0x8000) : Math.round(clamped * 0x7fff);
    view.setInt16(i * 2, int16, true);
  }

  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const slice = bytes.subarray(offset, offset + chunkSize);
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

function decodePcm16Base64(base64: string): Float32Array {
  const binary = atob(base64);
  const byteLength = binary.length;
  const bytes = new Uint8Array(byteLength);
  for (let i = 0; i < byteLength; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  const sampleCount = Math.floor(byteLength / 2);
  const floats = new Float32Array(sampleCount);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < sampleCount; i += 1) {
    floats[i] = view.getInt16(i * 2, true) / 32768;
  }
  return floats;
}

function buildContextPrompt(topic?: VoiceTopicContext | null): string {
  if (!topic) return '';
  const parts = [`Title: ${topic.title}`];
  if (topic.domain) parts.push(`Domain: ${topic.domain}`);
  if (topic.source) parts.push(`Source: ${topic.source}`);
  if (topic.summary) parts.push(`Summary: ${topic.summary}`);
  return parts.join('\n');
}

function buildLiveWebSocketUrl(voice: VoiceName): string {
  const url = new URL('./live', window.location.href);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.searchParams.set('voice', voice);
  return url.toString();
}

export function LiveVoiceModal({
  isOpen,
  onClose,
  topicContext = null,
  onClearTopicContext,
}: LiveVoiceModalProps) {
  const [selectedVoice, setSelectedVoice] = useState<VoiceName>('Zephyr');
  const [phase, setPhase] = useState<ConnectionPhase>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [micPermissionBlocked, setMicPermissionBlocked] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptMessage[]>([]);
  const [draftText, setDraftText] = useState('');

  // Mutable refs for real-time audio/socket callbacks (avoids stale closures)
  const wsRef = useRef<WebSocket | null>(null);
  const sessionReadyRef = useRef(false);
  const mutedRef = useRef(false);
  const textOnlyRef = useRef(false);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorNodeRef = useRef<ScriptProcessorNode | null>(null);
  const silentGainRef = useRef<GainNode | null>(null);
  const nextStartTimeRef = useRef(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const stoppingRef = useRef(false);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);
  const msgCounterRef = useRef(0);

  const stopQueuedPlayback = useCallback(() => {
    for (const src of activeSourcesRef.current) {
      try {
        src.stop();
      } catch {
        // Already stopped
      }
      try {
        src.disconnect();
      } catch {
        // Already disconnected
      }
    }
    activeSourcesRef.current.clear();
    if (outputAudioCtxRef.current) {
      nextStartTimeRef.current = outputAudioCtxRef.current.currentTime;
    } else {
      nextStartTimeRef.current = 0;
    }
  }, []);

  const cleanupSession = useCallback(() => {
    stoppingRef.current = true;
    sessionReadyRef.current = false;

    const ws = wsRef.current;
    wsRef.current = null;
    if (ws) {
      try {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'stop' }));
        }
        ws.close();
      } catch {
        // Ignore socket close error
      }
    }

    if (processorNodeRef.current) {
      processorNodeRef.current.onaudioprocess = null;
      try {
        processorNodeRef.current.disconnect();
      } catch {
        // Ignore disconnect error
      }
      processorNodeRef.current = null;
    }

    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.disconnect();
      } catch {
        // Ignore disconnect error
      }
      sourceNodeRef.current = null;
    }

    if (silentGainRef.current) {
      try {
        silentGainRef.current.disconnect();
      } catch {
        // Ignore disconnect error
      }
      silentGainRef.current = null;
    }

    if (mediaStreamRef.current) {
      for (const track of mediaStreamRef.current.getTracks()) {
        track.stop();
      }
      mediaStreamRef.current = null;
    }

    if (inputAudioCtxRef.current) {
      void inputAudioCtxRef.current.close().catch(() => {});
      inputAudioCtxRef.current = null;
    }

    stopQueuedPlayback();

    if (outputAudioCtxRef.current) {
      void outputAudioCtxRef.current.close().catch(() => {});
      outputAudioCtxRef.current = null;
    }

    mutedRef.current = false;
    textOnlyRef.current = false;
    setIsMuted(false);
    setPhase('idle');
  }, [stopQueuedPlayback]);

  useEffect(() => {
    return () => {
      cleanupSession();
    };
  }, [cleanupSession]);

  useEffect(() => {
    if (!isOpen) return;
    window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });
  }, [isOpen]);

  const handleCloseModal = useCallback(() => {
    cleanupSession();
    setError(null);
    setMicPermissionBlocked(false);
    onClose();
  }, [cleanupSession, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        handleCloseModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleCloseModal]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [transcript]);

  const appendOrUpdateTranscript = useCallback(
    (role: 'user' | 'assistant', chunk: string, finished: boolean) => {
      if (!chunk) return;
      setTranscript((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.role === role && !last.finalized) {
          const next = [...prev];
          next[next.length - 1] = {
            ...last,
            text: `${last.text}${chunk}`,
            finalized: finished,
          };
          return next;
        }
        msgCounterRef.current += 1;
        return [
          ...prev,
          {
            id: `${role}-${msgCounterRef.current}`,
            role,
            text: chunk,
            finalized: finished,
          },
        ];
      });
    },
    []
  );

  const finalizeOpenTurns = useCallback(() => {
    setTranscript((prev) =>
      prev.map((entry) =>
        entry.finalized ? entry : { ...entry, finalized: true }
      )
    );
  }, []);

  const scheduleAudioChunk = useCallback((base64Audio: string) => {
    const outCtx = outputAudioCtxRef.current;
    if (!outCtx) return;

    if (outCtx.state === 'suspended') {
      void outCtx.resume().catch(() => {});
    }

    const samples = decodePcm16Base64(base64Audio);
    if (samples.length === 0) return;

    const buffer = outCtx.createBuffer(1, samples.length, 24000);
    buffer.getChannelData(0).set(samples);

    const source = outCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(outCtx.destination);

    const startAt = Math.max(outCtx.currentTime, nextStartTimeRef.current);
    source.start(startAt);
    nextStartTimeRef.current = startAt + buffer.duration;

    activeSourcesRef.current.add(source);
    setPhase('speaking');

    source.onended = () => {
      activeSourcesRef.current.delete(source);
      try {
        source.disconnect();
      } catch {
        // Ignore
      }
      if (activeSourcesRef.current.size === 0 && !stoppingRef.current) {
        setPhase(textOnlyRef.current ? 'text-only' : 'listening');
      }
    };
  }, []);

  const startConversation = useCallback(
    async (withMicrophone: boolean) => {
      cleanupSession();
      stoppingRef.current = false;
      textOnlyRef.current = !withMicrophone;
      setError(null);
      setMicPermissionBlocked(false);
      setPhase('connecting');

      try {
        const outCtx = new AudioContext({ sampleRate: 24000 });
        outputAudioCtxRef.current = outCtx;
        nextStartTimeRef.current = outCtx.currentTime;

        let stream: MediaStream | null = null;
        if (withMicrophone) {
          if (
            typeof navigator === 'undefined' ||
            !navigator.mediaDevices ||
            typeof navigator.mediaDevices.getUserMedia !== 'function'
          ) {
            throw new Error(
              'Microphone capture is not supported in this browser context.'
            );
          }
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          mediaStreamRef.current = stream;
        }

        const ws = new WebSocket(buildLiveWebSocketUrl(selectedVoice));
        wsRef.current = ws;

        ws.onopen = () => {
          if (stoppingRef.current) return;
          ws.send(
            JSON.stringify({
              type: 'init',
              voice: selectedVoice,
              context: buildContextPrompt(topicContext),
            })
          );
        };

        ws.onmessage = (event) => {
          if (stoppingRef.current) return;

          let msg: ServerBridgeMessage;
          try {
            msg = JSON.parse(String(event.data)) as ServerBridgeMessage;
          } catch {
            return;
          }

          if (msg.type === 'ready') {
            sessionReadyRef.current = true;
            setPhase(textOnlyRef.current ? 'text-only' : 'listening');
            return;
          }

          if (msg.type === 'audio' && msg.audio) {
            scheduleAudioChunk(msg.audio);
            return;
          }

          if (msg.type === 'input_transcription' && msg.text) {
            appendOrUpdateTranscript(
              'user',
              msg.text,
              Boolean(msg.finished)
            );
            return;
          }

          if (msg.type === 'output_transcription' && msg.text) {
            appendOrUpdateTranscript(
              'assistant',
              msg.text,
              Boolean(msg.finished)
            );
            return;
          }

          if (msg.type === 'interrupted' || msg.interrupted) {
            stopQueuedPlayback();
            finalizeOpenTurns();
            setPhase(textOnlyRef.current ? 'text-only' : 'listening');
            return;
          }

          if (msg.type === 'turn_complete') {
            finalizeOpenTurns();
            return;
          }

          if (msg.type === 'error') {
            setError(msg.error || 'Voice session encountered an error.');
            cleanupSession();
            return;
          }

          if (msg.type === 'closed') {
            if (!stoppingRef.current) {
              cleanupSession();
            }
          }
        };

        ws.onerror = () => {
          if (!stoppingRef.current) {
            setError(
              'Unable to establish WebSocket connection to the Live voice bridge.'
            );
            cleanupSession();
          }
        };

        ws.onclose = () => {
          if (!stoppingRef.current) {
            cleanupSession();
          }
        };

        if (withMicrophone && stream) {
          const inCtx = new AudioContext({ sampleRate: 16000 });
          inputAudioCtxRef.current = inCtx;

          const source = inCtx.createMediaStreamSource(stream);
          sourceNodeRef.current = source;

          const processor = inCtx.createScriptProcessor(4096, 1, 1);
          processorNodeRef.current = processor;

          const silentGain = inCtx.createGain();
          silentGain.gain.value = 0;
          silentGainRef.current = silentGain;

          source.connect(processor);
          processor.connect(silentGain);
          silentGain.connect(inCtx.destination);

          processor.onaudioprocess = (audioEvent) => {
            if (
              stoppingRef.current ||
              mutedRef.current ||
              !sessionReadyRef.current
            ) {
              return;
            }
            const socket = wsRef.current;
            if (!socket || socket.readyState !== WebSocket.OPEN) return;

            const rawSamples = audioEvent.inputBuffer.getChannelData(0);
            const pcm16k = downsampleTo16k(rawSamples, inCtx.sampleRate);
            const base64 = encodePcm16Base64(pcm16k);
            socket.send(JSON.stringify({ type: 'audio', audio: base64 }));
          };
        }
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'Unable to start voice conversation.';
        if (withMicrophone) {
          setMicPermissionBlocked(true);
        }
        setError(message);
        cleanupSession();
      }
    },
    [
      appendOrUpdateTranscript,
      cleanupSession,
      finalizeOpenTurns,
      scheduleAudioChunk,
      selectedVoice,
      stopQueuedPlayback,
      topicContext,
    ]
  );

  const handleToggleMute = () => {
    const nextMuted = !mutedRef.current;
    mutedRef.current = nextMuted;
    setIsMuted(nextMuted);

    const socket = wsRef.current;
    if (nextMuted && socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'audio_end' }));
    }
  };

  const handleSendTextMessage = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = draftText.trim();
    if (!trimmed) return;
    const socket = wsRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN || !sessionReadyRef.current) {
      return;
    }

    finalizeOpenTurns();
    msgCounterRef.current += 1;
    setTranscript((prev) => [
      ...prev,
      {
        id: `user-${msgCounterRef.current}`,
        role: 'user',
        text: trimmed,
        finalized: true,
      },
    ]);
    socket.send(JSON.stringify({ type: 'text', text: trimmed }));
    setDraftText('');
  };

  if (!isOpen) return null;

  const isActive = phase !== 'idle';

  const statusLabel =
    phase === 'connecting'
      ? 'Connecting to Gemini Live...'
      : phase === 'speaking'
        ? 'STEM Radar speaking'
        : phase === 'text-only'
          ? 'Connected (text input + voice reply)'
          : phase === 'listening'
            ? isMuted
              ? 'Microphone muted'
              : 'Listening...'
            : 'Ready to start';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="live-voice-heading"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/55 backdrop-blur-xs"
      onClick={handleCloseModal}
    >
      <div
        className="w-full sm:max-w-xl max-h-[90vh] flex flex-col rounded-t-2xl sm:rounded-2xl border border-[#7c8899] dark:border-[#5a667a] bg-white dark:bg-[#111827] text-[#0f172a] dark:text-[#f1f5f9] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-[#7c8899]/60 dark:border-[#5a667a]/70 shrink-0">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#1b4dff]/10 dark:bg-[#4d7cff]/15 border border-[#1b4dff]/30 dark:border-[#7da1ff]/35 flex items-center justify-center shrink-0">
              <AudioLines
                className="w-5 h-5 text-[#1b4dff] dark:text-[#7da1ff]"
                aria-hidden="true"
              />
            </div>
            <div className="min-w-0">
              <h2
                id="live-voice-heading"
                className="font-heading text-lg font-bold tracking-tight text-[#0f172a] dark:text-[#f1f5f9]"
              >
                STEM Radar Live Voice
              </h2>
              <p className="text-xs text-[#475569] dark:text-[#94a3b8]">
                Real-time bidirectional voice conversation powered by Gemini Live
              </p>
            </div>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            onClick={handleCloseModal}
            aria-label="Close voice conversation"
            className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg text-[#475569] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-[#f1f5f9] cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Topic Context Pill */}
          {topicContext && (
            <div className="flex items-start justify-between gap-2 p-3 rounded-xl border border-[#1b4dff]/45 dark:border-[#7da1ff]/45 bg-[#1b4dff]/5 dark:bg-[#4d7cff]/10">
              <div className="min-w-0 space-y-0.5">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[#1b4dff] dark:text-[#8eb0ff]">
                  Discussing Discovery
                </div>
                <p className="text-xs sm:text-sm font-medium text-[#0f172a] dark:text-[#f1f5f9] break-words">
                  {topicContext.title}
                </p>
              </div>
              {onClearTopicContext && !isActive && (
                <button
                  type="button"
                  onClick={onClearTopicContext}
                  aria-label="Clear discovery topic context"
                  className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg text-[#475569] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-[#f1f5f9] shrink-0 cursor-pointer"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              )}
            </div>
          )}

          {/* Voice Selector + Live Status */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-[#7c8899]/60 dark:border-[#5a667a]/70 bg-[#f5f7fa] dark:bg-[#0b0f1a]">
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                className={cn(
                  'w-2.5 h-2.5 rounded-full shrink-0',
                  phase === 'speaking'
                    ? 'bg-emerald-500 animate-pulse motion-reduce:animate-none'
                    : phase === 'listening' && !isMuted
                      ? 'bg-[#1b4dff] dark:bg-[#7da1ff] animate-pulse motion-reduce:animate-none'
                      : phase === 'connecting'
                        ? 'bg-amber-500 animate-pulse motion-reduce:animate-none'
                        : phase === 'text-only'
                          ? 'bg-[#1b4dff] dark:bg-[#7da1ff]'
                          : 'bg-[#64748b]'
                )}
                aria-hidden="true"
              />
              <div className="min-w-0">
                <div
                  role="status"
                  aria-live="polite"
                  className="text-xs sm:text-sm font-semibold text-[#0f172a] dark:text-[#f1f5f9]"
                >
                  {statusLabel}
                </div>
                <div className="text-[11px] font-mono text-[#475569] dark:text-[#94a3b8]">
                  gemini-3.8-live · 16kHz / 24kHz PCM
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <label
                htmlFor="live-voice-select"
                className="text-xs font-medium text-[#475569] dark:text-[#94a3b8] shrink-0"
              >
                Voice
              </label>
              <select
                id="live-voice-select"
                value={selectedVoice}
                onChange={(e) => setSelectedVoice(e.target.value as VoiceName)}
                disabled={isActive}
                className="min-h-[44px] px-3 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-[#111827] border border-[#64748b] dark:border-[#64748b] text-[#0f172a] dark:text-[#f1f5f9] disabled:opacity-60 cursor-pointer"
              >
                {VOICE_OPTIONS.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Error Alert */}
          {error && (
            <div
              role="alert"
              className="p-3.5 rounded-xl border border-rose-700/70 dark:border-rose-400/60 bg-rose-500/10 text-xs sm:text-sm text-rose-800 dark:text-rose-300 space-y-2.5"
            >
              <div className="flex items-start gap-2.5">
                <AlertTriangle
                  className="w-4 h-4 shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                <span>{error}</span>
              </div>
              {micPermissionBlocked && !isActive && (
                <button
                  type="button"
                  onClick={() => {
                    void startConversation(false);
                  }}
                  className="inline-flex items-center justify-center gap-2 min-h-[44px] px-3.5 py-2 rounded-lg text-xs font-semibold bg-[#1b4dff] text-white dark:bg-[#4d7cff] dark:text-[#0b0f1a] hover:opacity-90 cursor-pointer"
                >
                  <Volume2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>Continue with text input &amp; spoken replies</span>
                </button>
              )}
            </div>
          )}

          {/* Live Transcript */}
          <div className="rounded-xl border border-[#7c8899]/60 dark:border-[#5a667a]/70 bg-[#f5f7fa] dark:bg-[#0b0f1a] p-3.5 min-h-[180px] max-h-[260px] overflow-y-auto space-y-3">
            {transcript.length === 0 ? (
              <div className="h-full min-h-[150px] flex flex-col items-center justify-center text-center px-4 gap-2 text-xs text-[#475569] dark:text-[#94a3b8]">
                <Volume2 className="w-5 h-5 opacity-70" aria-hidden="true" />
                <p className="max-w-sm leading-relaxed">
                  Start a live conversation to ask questions about recent STEM
                  breakthroughs, space missions, papers, or technical concepts.
                  You can interrupt naturally at any time while speaking.
                </p>
              </div>
            ) : (
              transcript.map((entry) => (
                <div
                  key={entry.id}
                  className={cn(
                    'flex flex-col gap-1',
                    entry.role === 'user' ? 'items-end' : 'items-start'
                  )}
                >
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#475569] dark:text-[#94a3b8]">
                    {entry.role === 'user' ? 'You' : 'STEM Radar'}
                  </span>
                  <p
                    className={cn(
                      'max-w-[88%] rounded-xl px-3.5 py-2 text-xs sm:text-sm leading-relaxed break-words',
                      entry.role === 'user'
                        ? 'bg-[#1b4dff] text-white dark:bg-[#4d7cff] dark:text-[#0b0f1a]'
                        : 'bg-white dark:bg-[#111827] border border-[#7c8899]/60 dark:border-[#5a667a]/70 text-[#0f172a] dark:text-[#f1f5f9]'
                    )}
                  >
                    {entry.text}
                  </p>
                </div>
              ))
            )}
            <div ref={transcriptEndRef} />
          </div>

          {/* Optional Text Input During Active Session */}
          {isActive && (
            <form onSubmit={handleSendTextMessage} className="flex gap-2">
              <label htmlFor="live-voice-text-input" className="sr-only">
                Send a typed prompt during the voice conversation
              </label>
              <input
                id="live-voice-text-input"
                type="text"
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                disabled={phase === 'connecting'}
                placeholder="Type a follow-up question..."
                className="flex-1 min-w-0 min-h-[44px] px-3.5 py-2 rounded-lg text-sm bg-[#f5f7fa] dark:bg-[#0b0f1a] border border-[#64748b] dark:border-[#64748b] text-[#0f172a] dark:text-[#f1f5f9] placeholder:text-[#475569] dark:placeholder:text-[#94a3b8]"
              />
              <button
                type="submit"
                disabled={phase === 'connecting' || !draftText.trim()}
                aria-label="Send message to voice session"
                className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-4 py-2 rounded-lg text-xs font-semibold border border-[#64748b] dark:border-[#64748b] bg-white dark:bg-[#111827] text-[#0f172a] dark:text-[#f1f5f9] hover:border-[#1b4dff] dark:hover:border-[#7da1ff] disabled:opacity-50 cursor-pointer shrink-0"
              >
                <Send className="w-4 h-4" aria-hidden="true" />
                <span className="hidden sm:inline">Send</span>
              </button>
            </form>
          )}
        </div>

        {/* Footer Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 px-5 py-4 border-t border-[#7c8899]/60 dark:border-[#5a667a]/70 bg-[#f5f7fa]/80 dark:bg-[#0b0f1a]/80 shrink-0">
          {!isActive ? (
            <button
              type="button"
              onClick={() => {
                void startConversation(true);
              }}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 rounded-lg text-sm font-semibold bg-[#1b4dff] text-white dark:bg-[#4d7cff] dark:text-[#0b0f1a] hover:opacity-90 transition-opacity cursor-pointer"
            >
              <Mic className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Start voice conversation</span>
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
              {phase !== 'text-only' && (
                <button
                  type="button"
                  onClick={handleToggleMute}
                  disabled={phase === 'connecting'}
                  aria-pressed={isMuted}
                  className={cn(
                    'flex-1 sm:flex-none inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-lg text-xs sm:text-sm font-semibold border transition-colors cursor-pointer disabled:opacity-50',
                    isMuted
                      ? 'border-amber-700/70 dark:border-amber-400/60 bg-amber-500/15 text-amber-900 dark:text-amber-200'
                      : 'border-[#64748b] dark:border-[#64748b] bg-white dark:bg-[#111827] text-[#0f172a] dark:text-[#f1f5f9] hover:border-[#1b4dff] dark:hover:border-[#7da1ff]'
                  )}
                >
                  {phase === 'connecting' ? (
                    <Loader2
                      className="w-4 h-4 animate-spin motion-reduce:animate-none shrink-0"
                      aria-hidden="true"
                    />
                  ) : isMuted ? (
                    <MicOff className="w-4 h-4 shrink-0" aria-hidden="true" />
                  ) : (
                    <Mic className="w-4 h-4 shrink-0" aria-hidden="true" />
                  )}
                  <span>{isMuted ? 'Unmute mic' : 'Mute mic'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={cleanupSession}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-lg text-xs sm:text-sm font-semibold bg-rose-600 text-white hover:bg-rose-700 transition-colors cursor-pointer"
              >
                <PhoneOff className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>End conversation</span>
              </button>
            </div>
          )}

          {transcript.length > 0 && (
            <button
              type="button"
              onClick={() => setTranscript([])}
              className="inline-flex items-center justify-center min-h-[44px] px-3 py-2 rounded-lg text-xs font-medium text-[#475569] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-[#f1f5f9] cursor-pointer"
            >
              Clear transcript
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
