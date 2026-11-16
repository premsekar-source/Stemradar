import { createServer, type IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import { parse } from 'node:url';
import next from 'next';
import { WebSocket, WebSocketServer } from 'ws';
import {
  GoogleGenAI,
  Modality,
  type LiveServerMessage,
} from '@google/genai';

const dev = process.argv.includes('--dev') || process.env.NODE_ENV !== 'production';
const port = Number.parseInt(process.env.PORT || '3000', 10) || 3000;

const ALLOWED_VOICES = new Set(['Zephyr', 'Puck', 'Charon', 'Kore', 'Fenrir']);
const LIVE_MODEL = 'gemini-3.8-live';

interface ClientControlMessage {
  type?: string;
  voice?: string;
  context?: string;
  audio?: string;
  data?: string;
  text?: string;
}

type LiveSession = Awaited<ReturnType<GoogleGenAI['live']['connect']>>;

function buildSystemInstruction(context?: string): string {
  const base =
    'You are the STEM Radar voice assistant. Help users explore breakthroughs across space science, astrophysics, aerospace, robotics, AI, electronics, scientific instruments, and peer-reviewed research. Speak naturally, concisely, and factually in plain spoken sentences without markdown formatting, bullet symbols, or URLs read aloud character-by-character. If you are unsure of a fact or recent figure, state that clearly instead of guessing.';

  const trimmed = context?.trim();
  if (!trimmed) return base;
  return `${base}\n\nCurrent discovery context:\n${trimmed.slice(0, 2000)}`;
}

function sendJson(ws: WebSocket, payload: Record<string, unknown>): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function createServerGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is not configured. Check your Settings > Secrets panel.'
    );
  }

  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function start(): Promise<void> {
  const app = next({ dev, port });
  const handle = app.getRequestHandler();

  await app.prepare();

  const nextUpgradeHandler = app.getUpgradeHandler();

  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url || '/', true);
    void handle(req, res, parsedUrl);
  });

  const wss = new WebSocketServer({ noServer: true });

  wss.on('connection', (clientWs: WebSocket, req: IncomingMessage) => {
    const reqUrl = new URL(req.url || '/live', 'http://localhost');
    const queryVoice = reqUrl.searchParams.get('voice') || 'Zephyr';

    let sessionPromise: Promise<LiveSession> | null = null;
    let activeSession: LiveSession | null = null;
    let socketClosed = false;

    const connectSession = (requestedVoice?: string, context?: string) => {
      if (sessionPromise) return sessionPromise;

      const selectedVoice =
        requestedVoice && ALLOWED_VOICES.has(requestedVoice)
          ? requestedVoice
          : ALLOWED_VOICES.has(queryVoice)
            ? queryVoice
            : 'Zephyr';

      sessionPromise = (async () => {
        const ai = createServerGeminiClient();
        const session = await ai.live.connect({
          model: LIVE_MODEL,
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: selectedVoice,
                },
              },
            },
            outputAudioTranscription: {},
            inputAudioTranscription: {},
            systemInstruction: buildSystemInstruction(context),
          },
          callbacks: {
            onmessage: (message: LiveServerMessage) => {
              if (socketClosed) return;

              const serverContent = message.serverContent;
              if (!serverContent) return;

              const parts = serverContent.modelTurn?.parts;
              if (Array.isArray(parts)) {
                for (const part of parts) {
                  const audioData = part.inlineData?.data;
                  const mimeType = part.inlineData?.mimeType;
                  if (audioData && (!mimeType || mimeType.startsWith('audio/'))) {
                    sendJson(clientWs, {
                      type: 'audio',
                      audio: audioData,
                      mimeType: mimeType || 'audio/pcm;rate=24000',
                    });
                  }
                }
              }

              if (serverContent.inputTranscription?.text) {
                sendJson(clientWs, {
                  type: 'input_transcription',
                  text: serverContent.inputTranscription.text,
                  finished: Boolean(serverContent.inputTranscription.finished),
                });
              }

              if (serverContent.outputTranscription?.text) {
                sendJson(clientWs, {
                  type: 'output_transcription',
                  text: serverContent.outputTranscription.text,
                  finished: Boolean(serverContent.outputTranscription.finished),
                });
              }

              if (serverContent.interrupted) {
                sendJson(clientWs, { type: 'interrupted', interrupted: true });
              }

              if (serverContent.turnComplete) {
                sendJson(clientWs, { type: 'turn_complete' });
              }
            },
            onerror: (err: unknown) => {
              if (socketClosed) return;
              const message =
                err instanceof Error
                  ? err.message
                  : 'Gemini Live session encountered an error.';
              sendJson(clientWs, { type: 'error', error: message });
            },
            onclose: (event: unknown) => {
              if (socketClosed) return;
              const reason =
                typeof event === 'object' &&
                event !== null &&
                'reason' in event &&
                typeof (event as { reason?: unknown }).reason === 'string'
                  ? (event as { reason: string }).reason
                  : '';
              sendJson(clientWs, { type: 'closed', reason });
            },
          },
        });

        activeSession = session;
        if (socketClosed) {
          try {
            session.close();
          } catch {
            // Ignore cleanup errors on already-closed sessions
          }
          return session;
        }

        sendJson(clientWs, { type: 'ready', voice: selectedVoice });
        return session;
      })();

      sessionPromise.catch((err: unknown) => {
        if (socketClosed) return;
        const message =
          err instanceof Error
            ? err.message
            : 'Unable to start Gemini Live voice session.';
        sendJson(clientWs, { type: 'error', error: message });
        clientWs.close();
      });

      return sessionPromise;
    };

    const cleanup = () => {
      if (socketClosed) return;
      socketClosed = true;
      if (activeSession) {
        try {
          activeSession.close();
        } catch {
          // Ignore close errors
        }
        activeSession = null;
      } else if (sessionPromise) {
        void sessionPromise
          .then((session) => {
            try {
              session.close();
            } catch {
              // Ignore close errors
            }
          })
          .catch(() => {
            // Error already handled
          });
      }
    };

    clientWs.on('message', async (rawData) => {
      if (socketClosed) return;

      let msg: ClientControlMessage;
      try {
        msg = JSON.parse(rawData.toString()) as ClientControlMessage;
      } catch {
        sendJson(clientWs, {
          type: 'error',
          error: 'Invalid JSON payload received by Live bridge.',
        });
        return;
      }

      if (msg.type === 'init') {
        connectSession(msg.voice, msg.context);
        return;
      }

      if (msg.type === 'stop') {
        cleanup();
        clientWs.close();
        return;
      }

      const audioBase64 =
        typeof msg.audio === 'string'
          ? msg.audio
          : typeof msg.data === 'string'
            ? msg.data
            : '';

      if (audioBase64 && (msg.type === 'audio' || !msg.type)) {
        try {
          const session = await connectSession(msg.voice, msg.context);
          if (!socketClosed) {
            session.sendRealtimeInput({
              audio: { data: audioBase64, mimeType: 'audio/pcm;rate=16000' },
            });
          }
        } catch {
          // Connection error already forwarded to client
        }
        return;
      }

      if (msg.type === 'audio_end') {
        try {
          const session = await connectSession(msg.voice, msg.context);
          if (!socketClosed) {
            session.sendRealtimeInput({ audioStreamEnd: true });
          }
        } catch {
          // Connection error already forwarded
        }
        return;
      }

      if (msg.type === 'text' && typeof msg.text === 'string' && msg.text.trim()) {
        try {
          const session = await connectSession(msg.voice, msg.context);
          if (!socketClosed) {
            session.sendRealtimeInput({ text: msg.text.trim() });
          }
        } catch {
          // Connection error already forwarded
        }
      }
    });

    clientWs.on('close', cleanup);
    clientWs.on('error', cleanup);
  });

  server.on(
    'upgrade',
    (req: IncomingMessage, socket: Duplex, head: Buffer) => {
      const pathname = new URL(req.url || '/', 'http://localhost').pathname;
      if (pathname === '/live') {
        wss.handleUpgrade(req, socket, head, (ws) => {
          wss.emit('connection', ws, req);
        });
      } else {
        void nextUpgradeHandler(req, socket, head);
      }
    }
  );

  server.listen(port, () => {
    console.log(
      `STEM Radar listening on http://localhost:${port} (${dev ? 'dev' : 'production'})`
    );
  });
}

start().catch((err) => {
  console.error('Failed to start STEM Radar server:', err);
  process.exit(1);
});
