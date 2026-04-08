import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Loader2, Mic, MoreVertical, Send, Square } from 'lucide-react';
import { Message as MessageType, Mode } from '../types';
import { generateContextSummary, generateResponse, generateSummary } from '../services/aiGatewayService';
import { transcribeRecording } from '../services/openAiTranscriptionService';
import Message from './Message';
import Summary from './Summary';
import { getStarterPrompts } from '../lib/supportPrompts';
import BrandMark from './BrandMark';

interface ChatScreenProps {
  mode: Mode;
  onReset: () => void;
  onChromeVisibilityChange: (visible: boolean) => void;
}

const RECENT_HISTORY_LIMIT = 8;

export default function ChatScreen({ mode, onReset, onChromeVisibilityChange }: ChatScreenProps) {
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [, setVoiceError] = useState<string | null>(null);
  const [soundLevel, setSoundLevel] = useState(0);
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  const [requestNotice, setRequestNotice] = useState<string | null>(null);
  const [contextSummary, setContextSummary] = useState('');
  const [archivedMessageCount, setArchivedMessageCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const actionMenuRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const meterFrameRef = useRef<number | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const contextSummaryRef = useRef('');
  const archivedMessageCountRef = useRef(0);

  useEffect(() => {
    contextSummaryRef.current = contextSummary;
  }, [contextSummary]);

  useEffect(() => {
    archivedMessageCountRef.current = archivedMessageCount;
  }, [archivedMessageCount]);

  useEffect(() => {
    return () => {
      onChromeVisibilityChange(true);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      if (meterFrameRef.current !== null) {
        cancelAnimationFrame(meterFrameRef.current);
      }
      audioSourceRef.current?.disconnect();
      analyserRef.current?.disconnect();
      void audioContextRef.current?.close();
    };
  }, [onChromeVisibilityChange]);
  
  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  useEffect(() => {
    const composer = composerRef.current;

    if (!composer) {
      return;
    }

    composer.style.height = '0px';
    const nextHeight = Math.min(composer.scrollHeight, 160);
    composer.style.height = `${Math.max(48, nextHeight)}px`;
    composer.style.overflowY = composer.scrollHeight > 160 ? 'auto' : 'hidden';
  }, [input]);

  useEffect(() => {
    if (!isActionMenuOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;

      if (actionMenuRef.current && target && !actionMenuRef.current.contains(target)) {
        setIsActionMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsActionMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isActionMenuOpen]);

  const stopRecordingStream = () => {
    if (meterFrameRef.current !== null) {
      cancelAnimationFrame(meterFrameRef.current);
      meterFrameRef.current = null;
    }

    audioSourceRef.current?.disconnect();
    audioSourceRef.current = null;
    analyserRef.current?.disconnect();
    analyserRef.current = null;

    if (audioContextRef.current) {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }

    setSoundLevel(0);
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
    mediaRecorderRef.current = null;
  };

  const revealChrome = () => {
    onChromeVisibilityChange(true);
  };

  const hideChrome = () => {
    onChromeVisibilityChange(false);
  };

  const startSoundMeter = (stream: MediaStream) => {
    const AudioContextCtor =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (!AudioContextCtor) {
      return;
    }

    const audioContext = new AudioContextCtor();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();

    analyser.fftSize = 256;
    source.connect(analyser);

    audioContextRef.current = audioContext;
    audioSourceRef.current = source;
    analyserRef.current = analyser;

    const levels = new Uint8Array(analyser.frequencyBinCount);

    const updateMeter = () => {
      const activeAnalyser = analyserRef.current;

      if (!activeAnalyser) {
        return;
      }

      activeAnalyser.getByteTimeDomainData(levels);

      let sumSquares = 0;

      for (let index = 0; index < levels.length; index += 1) {
        const normalized = (levels[index] - 128) / 128;
        sumSquares += normalized * normalized;
      }

      const rms = Math.sqrt(sumSquares / levels.length);
      const nextLevel = Math.min(1, Math.max(0, (rms - 0.02) / 0.22));

      setSoundLevel((current) => current * 0.65 + nextLevel * 0.35);
      meterFrameRef.current = requestAnimationFrame(updateMeter);
    };

    meterFrameRef.current = requestAnimationFrame(updateMeter);
  };

  const startRecording = async () => {
    if (isLoading || isTranscribing || isRecording) {
      return;
    }

    setVoiceError(null);

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setVoiceError('Voice input is not supported in this browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((type) =>
        MediaRecorder.isTypeSupported(type),
      );

      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

      audioChunksRef.current = [];
      mediaStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      startSoundMeter(stream);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const recordingBlob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || mimeType || 'audio/webm',
        });

        audioChunksRef.current = [];
        stopRecordingStream();
        setIsRecording(false);

        if (recordingBlob.size === 0) {
          setVoiceError('No audio was captured.');
          return;
        }

        setIsTranscribing(true);

        try {
          const transcript = await transcribeRecording(recordingBlob);
          const cleanedTranscript = transcript.trim();

          if (!cleanedTranscript) {
            setVoiceError('No speech was detected in the recording.');
            return;
          }

          setInput((current) => {
            const trimmedCurrent = current.trim();
            return trimmedCurrent ? `${trimmedCurrent} ${cleanedTranscript}` : cleanedTranscript;
          });
          setVoiceError(null);
        } catch (error) {
          setVoiceError(error instanceof Error ? error.message : 'Voice transcription failed.');
        } finally {
          setIsTranscribing(false);
        }
      };

      recorder.start();
      setIsRecording(true);
    } catch (error) {
      stopRecordingStream();
      setIsRecording(false);
      setVoiceError(error instanceof Error ? error.message : 'Could not access the microphone.');
    }
  };

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current;

    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
      return;
    }

    void startRecording();
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    await sendMessage(input);
  };

  const flushArchivedMessages = async (sourceMessages: MessageType[]) => {
    const archiveBoundary = Math.max(0, sourceMessages.length - RECENT_HISTORY_LIMIT);
    const currentArchivedCount = archivedMessageCountRef.current;

    if (archiveBoundary <= currentArchivedCount) {
      return {
        nextSummary: contextSummaryRef.current,
        nextArchivedCount: currentArchivedCount,
      };
    }

    const archivedSlice = sourceMessages.slice(currentArchivedCount, archiveBoundary);

    if (archivedSlice.length === 0) {
      return {
        nextSummary: contextSummaryRef.current,
        nextArchivedCount: currentArchivedCount,
      };
    }

    const nextSummary = await generateContextSummary(
      archivedSlice,
      mode,
      contextSummaryRef.current || undefined,
    );

    setContextSummary(nextSummary);
    setArchivedMessageCount(archiveBoundary);
    contextSummaryRef.current = nextSummary;
    archivedMessageCountRef.current = archiveBoundary;

    return {
      nextSummary,
      nextArchivedCount: archiveBoundary,
    };
  };

  const sendMessage = async (text: string) => {
    const normalizedText = text.trim();

    if (!normalizedText || isLoading || isRecording || isTranscribing) {
      return;
    }

    const userMessage: MessageType = {
      id: Date.now().toString(),
      role: 'user',
      content: normalizedText,
      timestamp: Date.now(),
    };

    const nextMessages = [...messages, userMessage];

    setMessages(nextMessages);
    setInput('');
    setVoiceError(null);
    setIsLoading(true);

    try {
      const { nextSummary, nextArchivedCount } = await flushArchivedMessages(messages);
      const trimmedHistory = messages.slice(nextArchivedCount);
      const response = await generateResponse(mode, trimmedHistory, normalizedText, nextSummary || undefined);

      const assistantMessage: MessageType = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.text,
        timestamp: Date.now(),
        followUpChips: response.followUpChips,
        ragDebug: response.ragDebug,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEndSession = async () => {
    setIsEnding(true);

    try {
      const { nextSummary, nextArchivedCount } = await flushArchivedMessages(messages);
      const sessionSummary = await generateSummary(
        messages.slice(nextArchivedCount),
        mode,
        nextSummary || undefined,
      );
      setSummary(sessionSummary);
    } finally {
      setIsEnding(false);
    }
  };

  const handleReset = () => {
    setRequestNotice(null);
    setContextSummary('');
    setArchivedMessageCount(0);
    contextSummaryRef.current = '';
    archivedMessageCountRef.current = 0;
    onReset();
  };

  const handleMarkForDrKristof = () => {
    const latestUserMessage = [...messages].reverse().find((message) => message.role === 'user')?.content;
    const preview = latestUserMessage
      ? latestUserMessage.length > 110
        ? `${latestUserMessage.slice(0, 110).trim()}...`
        : latestUserMessage
      : 'No message yet.';

    setRequestNotice(`Marked for Dr. Kristof. Allow up to 48 hours for response. Latest question: ${preview}`);
    setIsActionMenuOpen(false);
  };

  if (summary) {
    return <Summary summary={summary} messages={messages} title="ask-dr-kristof" onDone={handleReset} />;
  }

  return (
    <motion.div 
      key="chat"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex flex-col"
      onPointerDown={revealChrome}
      onTouchStart={revealChrome}
    >
      <div className="mb-4 flex shrink-0 items-start justify-between gap-4 md:mb-5">
        <BrandMark className="justify-start" />
        <div ref={actionMenuRef} className="relative">
          <button
            type="button"
            onClick={() => setIsActionMenuOpen((current) => !current)}
            aria-haspopup="menu"
            aria-expanded={isActionMenuOpen}
            aria-label="Open session actions"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-white/90 text-ink shadow-sm transition-colors hover:bg-white"
          >
            <MoreVertical size={18} />
          </button>
          {isActionMenuOpen ? (
            <div className="absolute right-0 top-full z-30 mt-3 w-72 overflow-hidden rounded-3xl border border-border bg-white p-2 shadow-lg">
              <button
                type="button"
                onClick={() => {
                  setIsActionMenuOpen(false);
                  handleReset();
                }}
                className="w-full rounded-2xl px-4 py-3 text-left transition-colors hover:bg-bg"
              >
                <div className="flex items-center gap-2 text-sm font-medium text-ink">
                  <ArrowLeft size={16} />
                  Start over
                </div>
                <div className="mt-1 text-xs leading-relaxed text-ink-muted">
                  Return to the home screen and clear this chat.
                </div>
              </button>
              <button
                type="button"
                onClick={handleMarkForDrKristof}
                disabled={messages.length === 0}
                className="w-full rounded-2xl px-4 py-3 text-left transition-colors hover:bg-bg disabled:cursor-not-allowed disabled:opacity-50"
              >
                <div className="text-sm font-medium text-ink">Send to Dr. Kristof</div>
                <div className="mt-1 text-xs leading-relaxed text-ink-muted">
                  Current clients only. Allow up to 48 hours for response.
                </div>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsActionMenuOpen(false);
                  handleEndSession();
                }}
                disabled={messages.length === 0 || isEnding}
                className="w-full rounded-2xl px-4 py-3 text-left transition-colors hover:bg-bg disabled:cursor-not-allowed disabled:opacity-50"
              >
                <div className="text-sm font-medium text-ink">{isEnding ? 'Ending...' : 'End session'}</div>
                <div className="mt-1 text-xs leading-relaxed text-ink-muted">
                  Generate the full-session summary and save the transcript.
                </div>
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col">
        <div className="space-y-6 pb-40">
          {messages.length === 0 ? (
            <div className="pt-2">
              <div className="mb-3 text-[10px] uppercase tracking-[0.3em] text-ink-muted">
                Start with
              </div>
              <div className="flex flex-wrap gap-2">
                {getStarterPrompts().map((prompt) => (
                  <button
                    key={prompt.label}
                    type="button"
                    onClick={() => void sendMessage(prompt.prompt)}
                    className="rounded-full border border-border bg-white/70 px-3 py-2 text-xs text-ink-muted transition-all hover:bg-white hover:text-ink"
                  >
                    {prompt.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {messages.map((msg) => (
            <div key={msg.id} className="space-y-2">
              <Message
                message={msg}
                actionChips={msg.role === 'assistant' ? msg.followUpChips ?? [] : []}
                onActionChipClick={(prompt) => {
                  void sendMessage(prompt.prompt);
                }}
              />
              {msg.role === 'assistant' && msg.ragDebug ? (
                <details className="rounded-2xl border border-border bg-white/65 px-4 py-3 text-xs text-ink-muted">
                  <summary className="cursor-pointer select-none font-medium text-ink">
                    RAG Debug • {msg.ragDebug.knowledgeItems.length} source
                    {msg.ragDebug.knowledgeItems.length === 1 ? '' : 's'}
                  </summary>
                  <div className="mt-3 space-y-2">
                    <div>
                      Mode: <span className="text-ink">{msg.ragDebug.mode}</span> • Intent:{' '}
                      <span className="text-ink">{msg.ragDebug.supportIntent}</span>
                    </div>
                    <div>
                      Verbatim guidance hit:{' '}
                      <span className="text-ink">{msg.ragDebug.usedVerbatimGuidance ? 'yes' : 'no'}</span>
                    </div>
                    {msg.ragDebug.guidanceMatchId ? (
                      <div>
                        Guidance match: <span className="text-ink">{msg.ragDebug.guidanceMatchId}</span>
                        {typeof msg.ragDebug.guidanceMatchScore === 'number'
                          ? ` (${msg.ragDebug.guidanceMatchScore.toFixed(3)})`
                          : ''}
                      </div>
                    ) : null}
                    {msg.ragDebug.knowledgeItems.length === 0 ? (
                      <div className="rounded-xl border border-border/70 bg-white/70 px-3 py-2">
                        No knowledge chunks retrieved for this turn.
                      </div>
                    ) : (
                      msg.ragDebug.knowledgeItems.map((item, index) => (
                        <div key={`${msg.id}-rag-${index}`} className="rounded-xl border border-border/70 bg-white/70 px-3 py-2">
                          <div className="font-medium text-ink">
                            {index + 1}. {item.source}
                            {typeof item.score === 'number' ? ` • score ${item.score.toFixed(4)}` : ''}
                          </div>
                          <div className="mt-1 text-[11px]">
                            corpus={item.corpus} • ruleType={item.ruleType} • priority={item.priority}
                          </div>
                          <div className="mt-1 text-[11px] leading-relaxed text-ink-muted">{item.excerpt}</div>
                        </div>
                      ))
                    )}
                  </div>
                </details>
              ) : null}
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white/60 p-4 rounded-3xl rounded-tl-none border border-border animate-pulse">
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 bg-ink-muted rounded-full animate-bounce" />
                  <div className="w-1.5 h-1.5 bg-ink-muted rounded-full animate-bounce [animation-delay:0.2s]" />
                  <div className="w-1.5 h-1.5 bg-ink-muted rounded-full animate-bounce [animation-delay:0.4s]" />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {requestNotice ? (
          <div className="mb-3 rounded-3xl border border-accent/15 bg-white/80 px-4 py-3 text-sm text-ink shadow-sm">
            <p className="font-medium">Marked for Dr. Kristof</p>
            <p className="mt-1 text-ink-muted">{requestNotice}</p>
          </div>
        ) : null}

      </div>

      <div className="fixed inset-x-0 bottom-16 z-20 px-4 pointer-events-none md:bottom-20">
        <div className="mx-auto w-full max-w-2xl pointer-events-auto">
          {isRecording ? (
            <div className="mb-3 flex justify-end">
              <div className="inline-flex items-end gap-1 rounded-full border border-red-200/70 bg-white/85 px-3 py-2 shadow-sm">
                {[0, 1, 2, 3, 4, 5].map((bar) => {
                  const baseHeight = 6 + (bar % 2 === 0 ? 4 : 0);
                  const dynamicHeight = baseHeight + soundLevel * (bar % 3 === 0 ? 22 : 16);

                  return (
                    <motion.span
                      key={bar}
                      className="w-1.5 rounded-full bg-red-500/85"
                      animate={{
                        height: dynamicHeight,
                        opacity: 0.35 + soundLevel * 0.65,
                        scaleY: 0.88 + soundLevel * 0.2,
                      }}
                      transition={{
                        type: 'spring',
                        stiffness: 260,
                        damping: 18,
                        mass: 0.45,
                      }}
                    />
                  );
                })}
              </div>
            </div>
          ) : null}

          <form onSubmit={handleSend} className="relative">
            <textarea
              ref={composerRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void handleSend();
                }
              }}
              placeholder="Type here..."
              rows={1}
              className="w-full rounded-[28px] border border-border bg-white/92 px-6 py-3.5 pr-28 font-sans leading-6 text-ink shadow-[0_12px_32px_rgba(68,60,44,0.08)] transition-all resize-none overflow-hidden focus:outline-none focus:ring-2 focus:ring-accent/20"
            />
            <div className="absolute right-2 top-1/2 flex -translate-y-[56%] items-center gap-2">
              <button
                type="button"
                onClick={toggleRecording}
                disabled={isLoading || isTranscribing}
                aria-pressed={isRecording}
                aria-label={isRecording ? 'Stop recording' : 'Start recording voice input'}
                title={isRecording ? 'Stop recording' : 'Record voice input'}
                className={`relative flex h-10 w-10 items-center justify-center rounded-full transition-all disabled:opacity-50 ${
                  isRecording
                    ? 'bg-red-500 text-white shadow-lg shadow-red-500/20'
                    : 'bg-accent-light text-accent hover:bg-accent-light/80'
                }`}
              >
                {isRecording ? (
                  <>
                    <span
                      aria-hidden="true"
                      className="absolute inset-0 rounded-full border border-red-300/70"
                      style={{
                        transform: `scale(${1 + soundLevel * 0.45})`,
                        opacity: 0.2 + soundLevel * 0.55,
                      }}
                    />
                    <Square size={16} className="relative z-10" />
                  </>
                ) : isTranscribing ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Mic size={16} />
                )}
              </button>
              <button
                type="submit"
                disabled={!input.trim() || isLoading || isRecording || isTranscribing}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-white transition-all disabled:opacity-50"
              >
                <Send size={18} />
              </button>
            </div>
          </form>
        </div>
      </div>
    </motion.div>
  );
}
