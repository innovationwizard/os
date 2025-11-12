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
  const [isSyncing, setIsSyncing] = useState(false)

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
    setIsSyncing(true)
    
    // Create a snapshot of the queue at the start of sync
    // This ensures we process all items that were in the queue when sync started
    const pending = [...queueRef.current]
    const syncedIds = new Set<string>()

    try {
      // Process items in reverse order (oldest first) to maintain chronological order
      for (let i = pending.length - 1; i >= 0; i--) {
        const entry = pending[i]
        if (!entry) continue

        try {
          const response = await fetch("/api/items", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: entry.content })
          })

          if (!response.ok) {
            console.warn(`Failed to sync item ${entry.id}:`, response.statusText)
            // Continue with next item instead of stopping
            continue
          }

          // Mark as synced only on success
          syncedIds.add(entry.id)
        } catch (itemError) {
          console.warn(`Error syncing item ${entry.id}:`, itemError)
          // Continue with next item instead of stopping
          continue
        }
      }

      // Update state once at the end with all successfully synced items removed
      // Use functional update to ensure we're working with the latest state
      // New items added during sync will be preserved
      if (syncedIds.size > 0) {
        // Add a small delay to ensure the user sees the syncing state
        await new Promise((resolve) => setTimeout(resolve, 300))
        
        setQueue((prev) => {
          // Filter out only the items that were successfully synced
          // This preserves any new items that were added during sync
          const next = prev.filter((item) => !syncedIds.has(item.id))
          // Update ref to match state
          queueRef.current = next
          console.log(`Synced ${syncedIds.size} item(s), ${next.length} remaining in queue`)
          return next
        })
      }
    } catch (error) {
      console.warn("Capture sync error:", error)
      // Individual items are handled in the loop, so this shouldn't happen
    } finally {
      syncingRef.current = false
      setIsSyncing(false)
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

    // Auto-detect language from speech - support English and Latin American Spanish
    // Language detection is based on what the user speaks, not browser/device settings
    const getSpeechLanguage = (): string => {
      // Latin American Spanish (not Mexico, not Spain)
      // es-419 is the standard Latin America code, prioritized first
      // Include additional Latin American country variants for better dialect support
      const languages = [
        "es-419", // Latin America (standard - prioritized)
        "es-AR", // Argentina
        "es-CO", // Colombia
        "es-CL", // Chile
        "es-PE", // Peru
        "es-VE", // Venezuela
        "es-EC", // Ecuador
        "en-US", // English (United States)
        "en", // English (generic)
      ].join(",")
      
      // The browser will auto-detect the language based on the actual speech
      // This works regardless of browser/device language settings
      return languages
    }

    const recognition: SpeechRecognitionInstance = new RecognitionCtor()
    const speechLang = getSpeechLanguage()
    recognition.lang = speechLang
    console.log("Speech recognition languages:", speechLang)
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
        console.log("skipClickRef before processing:", skipClickRef.current)
        
        if (transcript) {
          // Add transcript to input field
          setInput((prev) => {
            const updated = prev ? `${prev.trim()}\n${transcript}` : transcript
            console.log("Setting input to:", updated)
            return updated
          })
          
          // Reset skipClickRef immediately after transcript is set
          // This allows the user to click the capture button right away
          // skipClickRef was set to true in beginVoiceCapture to prevent button release from triggering capture
          // Now that voice capture is complete and transcript is set, we can reset it
          skipClickRef.current = false
          console.log("Voice capture complete, skipClickRef reset to false, ready for next action")
          
          setVoiceStatus("Transcript captured")
          // Clear status message after showing success
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
            setTimeout(() => {
              setVoiceStatus(null)
              // Reset skipClickRef after status clears
              skipClickRef.current = false
            }, 2000)
          } else {
            // Very short click - probably accidental, don't show error
            console.log("Short click detected, ignoring")
            // Reset immediately for accidental clicks
            skipClickRef.current = false
          }
        }
      }, 100) // Reduced delay - we don't need to wait as long since onresult already processed the transcript
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

  // Reset skipClickRef when recording ends and there's text in the input
  // This ensures the capture button works immediately after voice capture completes
  useEffect(() => {
    if (!isRecording && input.trim().length > 0) {
      // Small delay to ensure voice capture processing is complete
      const timeoutId = setTimeout(() => {
        if (!isRecording) {
          skipClickRef.current = false
          console.log("Recording ended with text, skipClickRef reset to false")
        }
      }, 200)
      return () => clearTimeout(timeoutId)
    }
  }, [isRecording, input])

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

      // Update both state and ref synchronously
      setQueue((prev) => {
        const next = [entry, ...prev]
        queueRef.current = next
        return next
      })

      // Only trigger sync if online and not already syncing
      // If a sync is in progress, the new item will be included in the next sync
      if (typeof navigator === "undefined" || navigator.onLine) {
        // Use a delay to ensure users can see the "waiting to sync" message
        // This also allows multiple rapid captures to batch together
        // Increased delay so users can see the status message before it changes to "Syncing..."
        setTimeout(() => {
          void syncQueue()
        }, 800)
      }
    },
    [syncQueue]
  )

  const handleCaptureClick = async () => {
    // If recording is active, stop recording
    if (isRecording) {
      recognitionRef.current?.stop()
      return
    }

    // Skip click only if we're still processing voice capture
    // Once recording is done, skipClickRef should be reset, but check it anyway
    if (skipClickRef.current) {
      console.log("Click skipped - voice capture still processing")
      skipClickRef.current = false
      return
    }

    const trimmed = input.trim()
    if (!trimmed) return

    await enqueueCapture(trimmed)
    setInput("")
  }

  const handleClear = () => {
    setInput("")
    liveTranscriptRef.current = ""
    setVoiceStatus(null)
    skipClickRef.current = false
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
          {variant === "pwa" ? "Step 1: Write your command" : "Step 1 · Capture"}
        </p>
        <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
          {variant === "pwa"
            ? "Command: "
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
          placeholder={variant === "pwa" ? "What should your husband remember to do? " : "What should we remember?"}
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
          {isSyncing ? (
            <span className="inline-flex items-center gap-2 text-blue-600">
              <span className="h-2 w-2 animate-pulse rounded-full bg-current" />
              Syncing...
            </span>
          ) : queue.length > 0 ? (
            <span>
              {queue.length} idea{queue.length === 1 ? "" : "s"} waiting to sync
            </span>
          ) : null}
        </div>
      </section>

      {voiceSupported ? (
        <p className="text-xs text-slate-400">
          {variant === "pwa"
            ? "Hold the button to dictate your command. Release to generate the transcript."
            : "Hold the button to dictate. Release to save the transcript."}
        </p>
      ) : (
        <p className="text-xs text-slate-400">
          Voice capture not supported in this browser.
        </p>
      )}

      <div className="flex flex-col gap-3">
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
              ? (variant === "pwa" ? "Click, and it shall be done!" : "Capture")
              : (variant === "pwa" ? "Your command, milady?" : "Hold to capture voice")}
        </button>

        {/* Status message container with fixed min-height to prevent layout shift */}
        <div className="min-h-[48px]">
          {voiceStatus && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              {voiceStatus}
            </div>
          )}
        </div>

        {/* Clear button - only show when there's text in the input */}
        {input.trim().length > 0 && !isRecording && (
          <button
            type="button"
            onClick={handleClear}
            className="w-full rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50 hover:text-slate-900"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  )
}


