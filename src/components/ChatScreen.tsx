import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Loader2, Mic, MoreVertical, Send, Square } from 'lucide-react';
import { Message as MessageType, Mode } from '../types';
import { generateResponse, generateSummary } from '../services/aiGatewayService';
import { transcribeRecording } from '../services/openAiTranscriptionService';
import Message from './Message';
import Summary from './Summary';
import { getNextSupportPrompts, getStarterPrompts } from '../lib/supportPrompts';
import BrandMark from './BrandMark';

interface ChatScreenProps {
  mode: Mode;
  onReset: () => void;
  onChromeVisibilityChange: (visible: boolean) => void;
}

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
      const response = await generateResponse(mode, messages, normalizedText);

      const assistantMessage: MessageType = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEndSession = async () => {
    setIsEnding(true);

    try {
      const sessionSummary = await generateSummary(messages, mode);
      setSummary(sessionSummary);
    } finally {
      setIsEnding(false);
    }
  };

  const handleReset = () => {
    setRequestNotice(null);
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
      className="flex flex-col h-full min-h-0"
      onPointerDown={revealChrome}
      onTouchStart={revealChrome}
    >
      <div className="flex items-center justify-between mb-4 md:mb-5 shrink-0">
        <button onClick={handleReset} className="btn-ghost flex items-center gap-2 -ml-4">
          <ArrowLeft size={18} />
          <span className="text-sm">Start over</span>
        </button>
        <div className="text-center">
          <BrandMark className="justify-center" />
        </div>
        <div ref={actionMenuRef} className="relative">
          <button
            type="button"
            onClick={() => setIsActionMenuOpen((current) => !current)}
            aria-haspopup="menu"
            aria-expanded={isActionMenuOpen}
            aria-label="Open session actions"
            className="btn-ghost -mr-3 inline-flex h-10 w-10 items-center justify-center"
          >
            <MoreVertical size={18} />
          </button>
          {isActionMenuOpen ? (
            <div className="absolute right-0 top-full z-30 mt-3 w-72 overflow-hidden rounded-3xl border border-border bg-white p-2 shadow-lg">
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

      <div className="flex-1 min-h-0 flex flex-col">
        <div
          className="flex-1 min-h-0 overflow-y-auto space-y-6 pb-4 scrollbar-hide"
          onScroll={hideChrome}
        >
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
            <Message
              key={msg.id}
              message={msg}
              actionChips={msg.role === 'assistant' ? getNextSupportPrompts(msg.content) : []}
              onActionChipClick={(prompt) => {
                void sendMessage(prompt.prompt);
              }}
            />
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

        <div className="shrink-0 bg-bg/95 backdrop-blur-md pt-3 pb-2">
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
              className="w-full bg-white/80 border border-border rounded-[28px] px-6 py-3.5 pr-28 focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all font-sans text-ink resize-none overflow-hidden leading-6"
            />
            <button
              type="button"
              onClick={toggleRecording}
              disabled={isLoading || isTranscribing}
              aria-pressed={isRecording}
              aria-label={isRecording ? 'Stop recording' : 'Start recording voice input'}
              title={isRecording ? 'Stop recording' : 'Record voice input'}
              className={`absolute right-14 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center transition-all disabled:opacity-50 ${
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
              className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-accent text-white rounded-full flex items-center justify-center disabled:opacity-50 transition-all"
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      </div>
    </motion.div>
  );
}
