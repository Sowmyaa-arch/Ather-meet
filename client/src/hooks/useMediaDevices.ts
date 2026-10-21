import { useState, useEffect, useRef, useCallback } from 'react';

export interface DeviceInfo {
  deviceId: string;
  label: string;
}

export interface UseMediaDevicesOptions {
  autoStart?: boolean;
  initialAudioMuted?: boolean;
  initialVideoOff?: boolean;
  displayName?: string;
}

// Helper to generate a simulated video track if the hardware camera is locked by another window/tab
export function createSimulatedVideoTrack(label: string | (() => string) = 'User'): MediaStreamTrack {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 360;
  const ctx = canvas.getContext('2d');
  let angle = 0;

  const draw = () => {
    if (!ctx) return;
    const currentLabel = (typeof label === 'function' ? label() : label) || 'User';
    const initials = currentLabel.split(' ').map(p => p[0]).filter(Boolean).join('').toUpperCase().slice(0, 2) || 'U';

    angle += 0.04;
    const pulse = Math.sin(angle) * 6;

    // Dark gradient background
    const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    grad.addColorStop(0, '#0f172a');
    grad.addColorStop(0.5, '#1e1b4b');
    grad.addColorStop(1, '#0f172a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Dynamic wave ring
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2, 64 + pulse, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.45)';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Central avatar circle
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2, 54, 0, Math.PI * 2);
    ctx.fillStyle = '#6366f1';
    ctx.shadowColor = 'rgba(99, 102, 241, 0.5)';
    ctx.shadowBlur = 16;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Initials text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initials, canvas.width / 2, canvas.height / 2);

    // Label text
    ctx.fillStyle = '#94a3b8';
    ctx.font = '14px Inter, sans-serif';
    ctx.fillText(currentLabel, canvas.width / 2, canvas.height / 2 + 76);
  };

  const timer = setInterval(draw, 1000 / 30);
  draw();

  const canvasStream = canvas.captureStream(30);
  const track = canvasStream.getVideoTracks()[0];
  if (track) {
    (track as any).isSimulated = true;
    try {
      Object.defineProperty(track, 'label', {
        value: 'Simulated Camera',
        writable: true,
      });
    } catch {}
    const origStop = track.stop.bind(track);
    track.stop = () => {
      clearInterval(timer);
      origStop();
    };
  }
  return track;
}

// Check if a stream contains a simulated canvas video track
export function isStreamSimulated(stream?: MediaStream | null): boolean {
  if (!stream) return false;
  const tracks = stream.getVideoTracks();
  if (!tracks.length) return false;
  return tracks.some(
    t =>
      (t as any).isSimulated === true ||
      t.label === 'Simulated Camera' ||
      t.label.toLowerCase().includes('simulated') ||
      t.label.toLowerCase() === 'canvas'
  );
}

export function useMediaDevices(options: boolean | UseMediaDevicesOptions = false) {
  const autoStart = typeof options === 'boolean' ? options : !!options.autoStart;
  const initialAudioMuted = typeof options === 'object' ? !!options.initialAudioMuted : false;
  const initialVideoOff = typeof options === 'object' ? !!options.initialVideoOff : false;
  const displayNameOption = typeof options === 'object' ? options.displayName : undefined;

  const displayNameRef = useRef(displayNameOption);
  useEffect(() => {
    displayNameRef.current = displayNameOption;
  }, [displayNameOption]);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(initialAudioMuted);
  const [isVideoOff, setIsVideoOff] = useState<boolean>(initialVideoOff);
  const [isScreenSharing, setIsScreenSharing] = useState<boolean>(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [isSimulated, setIsSimulated] = useState<boolean>(false);

  const isAudioMutedRef = useRef(initialAudioMuted);
  const isVideoOffRef = useRef(initialVideoOff);

  useEffect(() => {
    isAudioMutedRef.current = isAudioMuted;
  }, [isAudioMuted]);

  useEffect(() => {
    isVideoOffRef.current = isVideoOff;
  }, [isVideoOff]);

  // Available devices
  const [audioInputs, setAudioInputs] = useState<DeviceInfo[]>([]);
  const [videoInputs, setVideoInputs] = useState<DeviceInfo[]>([]);
  const [audioOutputs, setAudioOutputs] = useState<DeviceInfo[]>([]);
  const [selectedAudioInput, setSelectedAudioInput] = useState<string>('');
  const [selectedVideoInput, setSelectedVideoInput] = useState<string>('');
  const [selectedAudioOutput, setSelectedAudioOutput] = useState<string>('');

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Enumerate input and output devices
  const updateDeviceList = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) return;
      const devices = await navigator.mediaDevices.enumerateDevices();

      const aInputs: DeviceInfo[] = [];
      const vInputs: DeviceInfo[] = [];
      const aOutputs: DeviceInfo[] = [];

      devices.forEach(d => {
        if (d.kind === 'audioinput') {
          aInputs.push({ deviceId: d.deviceId, label: d.label || `Microphone ${aInputs.length + 1}` });
        } else if (d.kind === 'videoinput') {
          vInputs.push({ deviceId: d.deviceId, label: d.label || `Camera ${vInputs.length + 1}` });
        } else if (d.kind === 'audiooutput') {
          aOutputs.push({ deviceId: d.deviceId, label: d.label || `Speaker ${aOutputs.length + 1}` });
        }
      });

      setAudioInputs(aInputs);
      setVideoInputs(vInputs);
      setAudioOutputs(aOutputs);

      if (aInputs.length && !selectedAudioInput) setSelectedAudioInput(aInputs[0].deviceId);
      if (vInputs.length && !selectedVideoInput) setSelectedVideoInput(vInputs[0].deviceId);
      if (aOutputs.length && !selectedAudioOutput) setSelectedAudioOutput(aOutputs[0].deviceId);
    } catch (err) {
      console.warn('Error enumerating devices:', err);
    }
  }, [selectedAudioInput, selectedVideoInput, selectedAudioOutput]);

  // Audio volume visualizer setup
  const setupAudioMeter = useCallback((stream: MediaStream) => {
    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) return;

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.5;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const pcmData = new Uint8Array(analyser.frequencyBinCount);

      const checkVolume = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(pcmData);

        let sum = 0;
        for (let i = 0; i < pcmData.length; i++) {
          sum += pcmData[i];
        }
        const average = sum / pcmData.length;
        // Normalize to 0-100 scale
        const level = Math.min(100, Math.round((average / 128) * 100));
        setAudioLevel(level);

        animationFrameRef.current = requestAnimationFrame(checkVolume);
      };

      checkVolume();
    } catch (err) {
      console.warn('Could not initialize audio visualizer:', err);
    }
  }, []);

  const cleanupAudioMeter = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    setAudioLevel(0);
  }, []);

  // Start media stream
  const startMedia = useCallback(
    async (audioDeviceId?: string, videoDeviceId?: string) => {
      setPermissionError(null);
      cleanupAudioMeter();

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        const isHttps = window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        const msg = !isHttps
          ? 'Camera & Microphone access on other network devices requires enabling browser permissions for this local address, or using localhost/HTTPS.'
          : 'Camera & Microphone APIs are not available in this browser environment.';
        setPermissionError(msg);
        return null;
      }

      const constraints: MediaStreamConstraints = {
        audio: audioDeviceId ? { deviceId: { exact: audioDeviceId } } : true,
        video: videoDeviceId
          ? {
              deviceId: { exact: videoDeviceId },
              width: { ideal: 1280 },
              height: { ideal: 720 },
              frameRate: { ideal: 30 },
            }
          : {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              frameRate: { ideal: 30 },
            },
      };

      let stream: MediaStream | null = null;

      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (firstErr: any) {
        console.warn('Initial media capture with constraints failed, retrying relaxed capture:', firstErr);
        // Wait 250ms in case previous hardware capture was releasing
        await new Promise(r => setTimeout(r, 250));
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: audioDeviceId ? { deviceId: { exact: audioDeviceId } } : true,
            video: true,
          });
        } catch (secondErr: any) {
          console.warn('Relaxed camera capture failed:', secondErr);
          // Try to acquire real audio first
          try {
            const audioStream = await navigator.mediaDevices.getUserMedia({
              audio: audioDeviceId ? { deviceId: { exact: audioDeviceId } } : true,
              video: false,
            });

            // Camera hardware might be locked by another tab on same machine (NotReadableError)
            // Provide simulated canvas video track so user joins with camera on seamlessly!
            const simTrack = createSimulatedVideoTrack(
              () => displayNameRef.current || sessionStorage.getItem('aethermeet_display_name') || 'Guest'
            );
            audioStream.addTrack(simTrack);
            stream = audioStream;
            setIsSimulated(true);
          } catch (audioErr: any) {
            const msg =
              audioErr.name === 'NotAllowedError' || audioErr.name === 'PermissionDeniedError'
                ? 'Microphone and camera permissions were denied. Please enable them in your browser settings.'
                : 'Could not access camera or microphone hardware.';
            setPermissionError(msg);
            return null;
          }
        }
      }

      if (!stream) return null;

      // Check if real video track was acquired
      if (stream.getVideoTracks().length > 0 && !isStreamSimulated(stream)) {
        setIsSimulated(false);
      }

      if (isAudioMutedRef.current) {
        stream.getAudioTracks().forEach(t => {
          t.enabled = false;
        });
      }
      if (isVideoOffRef.current) {
        stream.getVideoTracks().forEach(t => {
          t.enabled = false;
        });
      }
      setLocalStream(stream);
      if (!isAudioMutedRef.current) {
        setupAudioMeter(stream);
      }
      await updateDeviceList();
      return stream;
    },
    [cleanupAudioMeter, setupAudioMeter, updateDeviceList]
  );

  // Stop all media tracks
  const stopMedia = useCallback(() => {
    cleanupAudioMeter();
    setIsSimulated(false);
    if (localStream) {
      localStream.getTracks().forEach(track => {
        track.stop();
      });
      setLocalStream(null);
    }
    if (screenStream) {
      screenStream.getTracks().forEach(track => {
        track.stop();
      });
      setScreenStream(null);
      setIsScreenSharing(false);
    }
  }, [cleanupAudioMeter, localStream, screenStream]);

  // Toggle Microphone
  const toggleAudio = useCallback(async () => {
    if (!localStream) {
      await startMedia();
      setIsAudioMuted(false);
      return;
    }
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack && audioTrack.readyState === 'live') {
      const nextState = !audioTrack.enabled;
      audioTrack.enabled = nextState;
      setIsAudioMuted(!nextState);
      setLocalStream(new MediaStream(localStream.getTracks()));
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: selectedAudioInput ? { deviceId: { exact: selectedAudioInput } } : true,
        });
        const newTrack = stream.getAudioTracks()[0];
        if (newTrack) {
          if (audioTrack) {
            localStream.removeTrack(audioTrack);
          }
          localStream.addTrack(newTrack);
          setIsAudioMuted(false);
          setLocalStream(new MediaStream(localStream.getTracks()));
        }
      } catch (err) {
        console.warn('Could not re-acquire audio track:', err);
      }
    }
  }, [localStream, selectedAudioInput, startMedia]);

  // Toggle Video / Camera
  const toggleVideo = useCallback(async () => {
    if (!localStream) {
      await startMedia();
      setIsVideoOff(false);
      return;
    }
    const videoTrack = localStream.getVideoTracks()[0];

    // If camera is currently ON, turn it OFF and stop track to release hardware lock on OS
    if (!isVideoOffRef.current && videoTrack) {
      videoTrack.stop();
      localStream.removeTrack(videoTrack);
      setIsVideoOff(true);
      setIsSimulated(false);
      setLocalStream(new MediaStream(localStream.getTracks()));
      return;
    }

    // Camera is OFF or currently simulated; try to acquire real physical webcam
    setPermissionError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: selectedVideoInput
          ? { deviceId: { exact: selectedVideoInput } }
          : { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
      });
      const newTrack = stream.getVideoTracks()[0];
      if (newTrack) {
        if (videoTrack) {
          videoTrack.stop();
          localStream.removeTrack(videoTrack);
        }
        localStream.addTrack(newTrack);
        setIsSimulated(false);
        setIsVideoOff(false);
        setPermissionError(null);
        setLocalStream(new MediaStream(localStream.getTracks()));
        return;
      }
    } catch (err: any) {
      console.warn('Could not acquire physical video track:', err);
      const isLocked = err.name === 'NotReadableError' || err.name === 'TrackStartError';
      const msg = isLocked
        ? 'Webcam is currently in use by another tab (Host) or application. Turn off camera in the other tab or test across 2 separate devices.'
        : 'Could not access physical camera hardware.';
      setPermissionError(msg);

      // Fallback: create simulated track so user still has visual presence in meeting
      const simTrack = createSimulatedVideoTrack(
        () => displayNameRef.current || sessionStorage.getItem('aethermeet_display_name') || 'User'
      );
      if (videoTrack) {
        videoTrack.stop();
        localStream.removeTrack(videoTrack);
      }
      localStream.addTrack(simTrack);
      setIsSimulated(true);
      setIsVideoOff(false);
      setLocalStream(new MediaStream(localStream.getTracks()));
    }
  }, [localStream, selectedVideoInput, startMedia]);

  // Start / Stop Screen Sharing
  const startScreenShare = useCallback(async (): Promise<MediaStream | null> => {
    try {
      if (!navigator.mediaDevices?.getDisplayMedia) {
        throw new Error('Screen sharing is not supported in this browser.');
      }
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });

      setScreenStream(stream);
      setIsScreenSharing(true);

      // Listen for system "Stop sharing" bar click
      stream.getVideoTracks()[0].onended = () => {
        setIsScreenSharing(false);
        setScreenStream(null);
      };

      return stream;
    } catch (err: any) {
      if (err.name !== 'NotAllowedError') {
        console.error('Error starting screen share:', err);
      }
      return null;
    }
  }, []);

  const stopScreenShare = useCallback(() => {
    if (screenStream) {
      screenStream.getTracks().forEach(t => t.stop());
      setScreenStream(null);
      setIsScreenSharing(false);
    }
  }, [screenStream]);

  useEffect(() => {
    if (autoStart) {
      startMedia();
    }
    return () => {
      stopMedia();
    };
  }, [autoStart]);

  return {
    localStream,
    screenStream,
    isAudioMuted,
    isVideoOff,
    isScreenSharing,
    permissionError,
    audioLevel,
    isSimulated,
    audioInputs,
    videoInputs,
    audioOutputs,
    selectedAudioInput,
    selectedVideoInput,
    selectedAudioOutput,
    setSelectedAudioInput,
    setSelectedVideoInput,
    setSelectedAudioOutput,
    startMedia,
    stopMedia,
    toggleAudio,
    toggleVideo,
    setIsAudioMuted,
    setIsVideoOff,
    startScreenShare,
    stopScreenShare,
  };
}
