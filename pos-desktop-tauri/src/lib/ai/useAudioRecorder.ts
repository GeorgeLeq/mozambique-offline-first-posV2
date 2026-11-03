import { useState, useRef, useCallback, useEffect } from 'react';

export interface UseAudioRecorderReturn {
  isRecording: boolean;
  recordingDuration: number;
  audioLevel: number;
  error: string | null;
  startRecording: () => Promise<boolean>;
  stopRecording: () => Promise<Blob | null>;
  cancelRecording: () => void;
}

/**
 * Custom React hook for capturing crisp audio from the counter desk microphone
 * Configured with noise suppression and echo cancellation for noisy store environments.
 */
export function useAudioRecorder(): UseAudioRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Stop analysis and cleanup audio context
  const cleanupAudioNodes = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try {
        audioContextRef.current.close();
      } catch {
        // Ignore close errors
      }
      audioContextRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setAudioLevel(0);
  }, []);

  // Monitor live audio level for animated wave display
  const monitorAudioLevel = useCallback((stream: MediaStream) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateLevel = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);

        // Calculate average amplitude
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const average = sum / dataArray.length;
        const normalized = Math.min(100, Math.round((average / 128) * 100));
        setAudioLevel(normalized);

        animationFrameRef.current = requestAnimationFrame(updateLevel);
      };

      updateLevel();
    } catch (err) {
      console.warn('[AudioRecorder] Audio level monitoring unavailable:', err);
    }
  }, []);

  const startRecording = useCallback(async (): Promise<boolean> => {
    setError(null);
    audioChunksRef.current = [];

    try {
      // Request audio stream with noise suppression for retail environments
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: 16000,
        },
      });

      streamRef.current = stream;

      // Determine supported mime type
      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')
          ? 'audio/ogg;codecs=opus'
          : '';
      }

      const mediaRecorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(200); // Collect in 200ms slices
      setIsRecording(true);
      setRecordingDuration(0);

      // Start duration timer
      timerRef.current = window.setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);

      // Start live volume monitoring
      monitorAudioLevel(stream);

      return true;
    } catch (err: any) {
      console.error('[AudioRecorder] Failed to access microphone:', err);
      setError(
        err.name === 'NotAllowedError'
          ? 'Permissão de microfone negada no navegador ou sistema.'
          : 'Não foi possível aceder ao microfone.'
      );
      setIsRecording(false);
      cleanupAudioNodes();
      return false;
    }
  }, [cleanupAudioNodes, monitorAudioLevel]);

  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const mediaRecorder = mediaRecorderRef.current;
      if (!mediaRecorder || mediaRecorder.state === 'inactive') {
        cleanupAudioNodes();
        setIsRecording(false);
        resolve(null);
        return;
      }

      mediaRecorder.onstop = () => {
        const mimeType = mediaRecorder.mimeType || 'audio/webm';
        const finalBlob = new Blob(audioChunksRef.current, { type: mimeType });
        cleanupAudioNodes();
        setIsRecording(false);
        resolve(finalBlob);
      };

      try {
        mediaRecorder.stop();
      } catch {
        cleanupAudioNodes();
        setIsRecording(false);
        resolve(null);
      }
    });
  }, [cleanupAudioNodes]);

  const cancelRecording = useCallback(() => {
    const mediaRecorder = mediaRecorderRef.current;
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      try {
        mediaRecorder.stop();
      } catch {
        // Ignore
      }
    }
    audioChunksRef.current = [];
    cleanupAudioNodes();
    setIsRecording(false);
    setRecordingDuration(0);
  }, [cleanupAudioNodes]);

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      cleanupAudioNodes();
    };
  }, [cleanupAudioNodes]);

  return {
    isRecording,
    recordingDuration,
    audioLevel,
    error,
    startRecording,
    stopRecording,
    cancelRecording,
  };
}
