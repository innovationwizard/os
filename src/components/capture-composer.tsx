"use client"

import { useCallback, useEffect, useRef, useState } from "react"

type QueueItem = {
  id: string
  content: string
  createdAt: string
}

// Minimal types for Web Speech API
interface SpeechRecognitionAlternative {
  transcript: string
  confidence?: number
}

interface SpeechRecognitionResult {
  [index: number]: SpeechRecognitionAlternative
  length: number
  isFinal: boolean
  item(index: number): SpeechRecognitionAlternative
}

interface SpeechRecognitionResultList {
  [index: number]: SpeechRecognitionResult
  length: number
  item(index: number): SpeechRecognitionResult
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList
  resultIndex: number
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string
  message?: string
}

interface SpeechRecognitionInstance {
  lang: string
  interimResults: boolean
  maxAlternatives?: number
  continuous?: boolean
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  onstart: (() => void) | null
  onsoundstart: (() => void) | null
  onsoundend: (() => void) | null
  onspeechstart: (() => void) | null
  onspeechend: (() => void) | null
  onaudiostart: (() => void) | null
  onaudioend: (() => void) | null
  onnomatch: (() => void) | null
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance

const STORAGE_KEY = "ssot.capture.queue.v1"

type CaptureVariant = "full" | "pwa"

interface CaptureComposerProps {
  variant?: CaptureVariant
}

export function CaptureComposer({ variant = "full" }: CaptureComposerProps) {
  const [input, setInput] = useState("")
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [isOnline, setIsOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine
  )
  const [isRecording, setIsRecording] = useState(false)
  const [voiceSupported, setVoiceSupported] = useState(false)
  const [voiceStatus, setVoiceStatus] = useState<string | null>(null)

  const queueLoadedRef = useRef(false)
  const queueRef = useRef<QueueItem[]>([])
  const syncingRef = useRef(false)
  const skipClickRef = useRef(false)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const liveTranscriptRef = useRef("")
  const recordingStartTimeRef = useRef<number>(0)
  const hasReceivedAudioRef = useRef<boolean>(false)

  const persistQueue = useCallback((next: QueueItem[]) => {
    if (typeof window === "undefined") return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as QueueItem[]
        setQueue(parsed)
        queueRef.current = parsed
      }
    } catch (error) {
      console.error("Failed to hydrate capture queue", error)
    } finally {
      queueLoadedRef.current = true
    }
  }, [])

  useEffect(() => {
    if (!queueLoadedRef.current) return
    queueRef.current = queue
    persistQueue(queue)
  }, [queue, persistQueue])

  const syncQueue = useCallback(async () => {
    if (syncingRef.current) return
    if (typeof navigator !== "undefined" && !navigator.onLine) return
    if (!queueRef.current.length) return

    syncingRef.current = true
    const pending = [...queueRef.current].reverse()

    try {
      for (const entry of pending) {
        const response = await fetch("/api/items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: entry.content })
        })

        if (!response.ok) {
          throw new Error("Failed to sync captured idea.")
        }

        setQueue((prev) => {
          const next = prev.filter((item) => item.id !== entry.id)
          queueRef.current = next
          return next
        })
      }
    } catch (error) {
      console.warn("Capture sync paused", error)
    } finally {
      syncingRef.current = false
    }
  }, [])

  useEffect(() => {
    const updateConnection = () => {
      if (typeof navigator === "undefined") return
      setIsOnline(navigator.onLine)
      if (navigator.onLine) {
        void syncQueue()
      }
    }

    window.addEventListener("online", updateConnection)
    window.addEventListener("offline", updateConnection)

    return () => {
      window.removeEventListener("online", updateConnection)
      window.removeEventListener("offline", updateConnection)
    }
  }, [syncQueue])

  useEffect(() => {
    if (typeof window === "undefined") return
    const globalWindow = window as typeof window & {
      SpeechRecognition?: SpeechRecognitionConstructor
      webkitSpeechRecognition?: SpeechRecognitionConstructor
    }
    const RecognitionCtor =
      globalWindow.SpeechRecognition || globalWindow.webkitSpeechRecognition || null

    if (!RecognitionCtor) return

    const recognition: SpeechRecognitionInstance = new RecognitionCtor()
    recognition.lang = "en-US"
    recognition.interimResults = true
    recognition.continuous = true // Keep listening until we explicitly stop
    if ("maxAlternatives" in recognition) {
      recognition.maxAlternatives = 1
    }

    recognition.onresult = (event: any) => {
      // Use any type for browser compatibility - different browsers implement the API slightly differently
      const results = event.results
      
      // Accumulate transcript (the API gives us all results each time, so we rebuild from scratch)
      if (results.length > 0) {
        let completeTranscript = ""
        let hasFinalResult = false
        
        for (let i = 0; i < results.length; i += 1) {
          try {
            // Access result - try array index first, then item method
            const result = results[i] ?? (typeof results.item === "function" ? results.item(i) : null)
            if (!result) continue
            
            // Access first alternative - try array index first, then item method
            const alternative = result[0] ?? (typeof result.item === "function" ? result.item(0) : null)
            if (alternative?.transcript) {
              completeTranscript += alternative.transcript + " "
              // Mark that we've received audio
              hasReceivedAudioRef.current = true
            }
            // Check if this is a final result
            if (result.isFinal) {
              hasFinalResult = true
            }
          } catch (error) {
            console.warn("Error processing result at index", i, error)
          }
        }
        
        const trimmedTranscript = completeTranscript.trim()
        if (trimmedTranscript) {
          liveTranscriptRef.current = trimmedTranscript
          console.log("Voice transcript:", trimmedTranscript, "| Results:", results.length, "| Has final:", hasFinalResult, "| Has audio:", hasReceivedAudioRef.current)
        }
      }
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error("Voice capture error", event.error, event.message)
      setVoiceStatus(`Voice capture error: ${event.error}`)
      setIsRecording(false)
      skipClickRef.current = true
      liveTranscriptRef.current = ""
    }

    recognition.onend = () => {
      setIsRecording(false)
      
      // Increased delay to ensure final results are processed
      setTimeout(() => {
        const transcript = liveTranscriptRef.current.trim()
        const recordingDuration = Date.now() - recordingStartTimeRef.current
        const receivedAudio = hasReceivedAudioRef.current
        
        console.log("Voice recognition ended. Final transcript:", transcript, "| Duration:", recordingDuration, "ms | Has audio:", receivedAudio)
        
        if (transcript) {
          // Add transcript to input field
          setInput((prev) => {
            const updated = prev ? `${prev.trim()}\n${transcript}` : transcript
            console.log("Setting input to:", updated)
            return updated
          })
          setVoiceStatus("Transcript captured")
          // Clear transcript after showing success message
          setTimeout(() => {
            liveTranscriptRef.current = ""
            setVoiceStatus(null)
          }, 1500)
        } else {
          // Only show "No speech detected" if:
          // 1. We recorded for at least 500ms (user actually tried to speak)
          // 2. OR we received some audio but no transcript (unlikely but possible)
          if (recordingDuration >= 500 || receivedAudio) {
            console.warn("No transcript captured in onend, but recording was substantial")
            setVoiceStatus("No speech detected")
            setTimeout(() => setVoiceStatus(null), 2000)
          } else {
            // Very short click - probably accidental, don't show error
            console.log("Short click detected, ignoring")
          }
        }
        
        skipClickRef.current = true
      }, 300) // Increased delay to allow final onresult to process
    }
    
    recognition.onnomatch = () => {
      const recordingDuration = Date.now() - recordingStartTimeRef.current
      const receivedAudio = hasReceivedAudioRef.current
      
      console.warn("No speech match found. Duration:", recordingDuration, "ms | Has audio:", receivedAudio)
      
      // Only show error if we've been recording for a while or received audio
      // This prevents false positives from quick clicks
      if (recordingDuration >= 500 || receivedAudio) {
        setVoiceStatus("No speech detected")
        setTimeout(() => setVoiceStatus(null), 2000)
      }
      
      setIsRecording(false)
      skipClickRef.current = true
      liveTranscriptRef.current = ""
    }
    
    // Track when audio starts being captured
    recognition.onsoundstart = () => {
      console.log("Sound detected - audio capture started")
      hasReceivedAudioRef.current = true // Any sound means we're capturing audio
    }
    
    recognition.onspeechstart = () => {
      console.log("Speech detected - processing audio")
      hasReceivedAudioRef.current = true
    }

    recognitionRef.current = recognition
    setVoiceSupported(true)

    return () => {
      recognition.stop()
      recognitionRef.current = null
    }
  }, [])

  useEffect(() => {
    if (isOnline) {
      void syncQueue()
    }
  }, [isOnline, syncQueue])

  const generateId = () => {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID()
    }
    return Math.random().toString(36).slice(2)
  }

  const enqueueCapture = useCallback(
    async (content: string) => {
      const trimmed = content.trim()
      if (!trimmed) return

      const entry: QueueItem = {
        id: generateId(),
        content: trimmed,
        createdAt: new Date().toISOString()
      }

      setQueue((prev) => {
        const next = [entry, ...prev]
        queueRef.current = next
        return next
      })

      if (typeof navigator === "undefined" || navigator.onLine) {
        await syncQueue()
      }
    },
    [syncQueue]
  )

  const handleCaptureClick = async () => {
    if (skipClickRef.current) {
      skipClickRef.current = false
      return
    }

    if (isRecording) {
      recognitionRef.current?.stop()
      return
    }

    const trimmed = input.trim()
    if (!trimmed) return

    await enqueueCapture(trimmed)
    setInput("")
  }

  const beginVoiceCapture = () => {
    if (!voiceSupported || isRecording || input.trim()) return

    try {
      liveTranscriptRef.current = ""
      hasReceivedAudioRef.current = false
      recordingStartTimeRef.current = Date.now()
      
      recognitionRef.current?.start()
      setIsRecording(true)
      setVoiceStatus("Listening… release to capture")
      skipClickRef.current = true
      console.log("Voice recognition started")
    } catch (error) {
      console.warn("Unable to start voice capture", error)
      setVoiceStatus("Voice capture unavailable.")
      setIsRecording(false)
      skipClickRef.current = false
    }
  }

  const endVoiceCapture = () => {
    if (!isRecording) return
    
    const recordingDuration = Date.now() - recordingStartTimeRef.current
    console.log("User released button. Recording duration:", recordingDuration, "ms")
    
    // If recording was very short (< 300ms), wait longer to allow audio processing
    // Otherwise, stop after a brief delay to finalize results
    const stopDelay = recordingDuration < 300 ? 800 : 500
    
    setTimeout(() => {
      if (recognitionRef.current && isRecording) {
        console.log("Calling recognition.stop() after", stopDelay, "ms delay")
        recognitionRef.current.stop()
      }
    }, stopDelay)
  }

  const handlePointerDown = () => {
    if (!voiceSupported) return
    if (input.trim().length > 0) return
    beginVoiceCapture()
  }

  const handlePointerUp = () => {
    endVoiceCapture()
  }

  const handlePointerLeave = () => {
    if (isRecording) {
      recognitionRef.current?.abort()
      setIsRecording(false)
      liveTranscriptRef.current = ""
      setVoiceStatus("Voice capture cancelled.")
      skipClickRef.current = true
    }
  }

  const layoutStyles =
    variant === "pwa"
      ? "flex min-h-screen flex-col gap-4 bg-white px-4 py-6 sm:px-6"
      : "flex min-h-full flex-col gap-6"

  const buttonClasses =
    variant === "pwa"
      ? "flex h-14 w-full items-center justify-center rounded-full bg-slate-900 text-base font-medium text-white transition-colors hover:bg-slate-800 active:scale-[0.99]"
      : "flex h-12 w-full items-center justify-center rounded-full bg-slate-900 text-sm font-medium text-white transition-colors hover:bg-slate-800 active:scale-[0.99] sm:h-14 sm:text-base"

  const textareaClasses =
    variant === "pwa"
      ? "w-full min-h-[200px] resize-none rounded-3xl border border-slate-200 bg-white px-4 py-3 text-base shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
      : "w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 sm:text-lg"

  return (
    <div className={layoutStyles}>
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Step 1 · Capture
        </p>
        <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
          {variant === "pwa"
            ? "Capture quickly"
            : "Get it out of your head"}
        </h1>
        {variant === "full" && (
          <p className="text-sm text-slate-500">
            Type or hold the button to dictate. We will safely store everything,
            even if you&apos;re offline.
          </p>
        )}
      </header>

      <section className="flex flex-col gap-3">
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="What should we remember?"
          rows={variant === "pwa" ? 5 : 6}
          className={textareaClasses}
        />

        <div className="flex items-center justify-between text-xs text-slate-500">
          <span
            className={
              isOnline
                ? "inline-flex items-center gap-2 text-emerald-600"
                : "inline-flex items-center gap-2 text-amber-600"
            }
          >
            <span className="h-2 w-2 rounded-full bg-current" />
            {isOnline ? "Online" : "Offline — will sync later"}
          </span>
          {queue.length > 0 && (
            <span>
              {queue.length} idea{queue.length === 1 ? "" : "s"} waiting to sync
            </span>
          )}
        </div>
      </section>

      {voiceSupported ? (
        <p className="text-xs text-slate-400">
          Hold the button to dictate. Release to save the transcript.
        </p>
      ) : (
        <p className="text-xs text-slate-400">
          Voice capture not supported in this browser.
        </p>
      )}

      {voiceStatus && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          {voiceStatus}
        </div>
      )}

      <button
        type="button"
        onClick={handleCaptureClick}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        className={buttonClasses}
      >
        {isRecording
          ? "Listening…"
          : input.trim()
            ? "Capture"
            : "Hold to capture voice"}
      </button>
    </div>
  )
}


