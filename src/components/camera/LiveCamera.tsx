import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Camera, CameraOff, Maximize, Minimize, AlertCircle, RefreshCw, 
  VolumeX, ShieldAlert, Radio, Video, Bug, CheckCircle2, XCircle, Info 
} from 'lucide-react';

export type CameraState = 'IDLE' | 'STARTING' | 'LIVE' | 'ERROR' | 'STOPPED';

interface LiveCameraProps {
  patientName: string;
  roomNumber: string;
  bedNumber?: string;
  customStreamUrl?: string;
  autoStart?: boolean;
}

interface CameraDiagnostics {
  permission: 'GRANTED' | 'DENIED' | 'PROMPT' | 'UNKNOWN';
  selectedCamera: string;
  streamState: 'CONNECTED' | 'DISCONNECTED';
  videoTrackCount: number;
  trackState: 'LIVE' | 'ENDED' | 'NONE';
  videoWidth: number;
  videoHeight: number;
  readyState: number;
  readyStateName: string;
  paused: 'YES' | 'NO';
  error: string | null;
}

const READY_STATE_NAMES: Record<number, string> = {
  0: 'HAVE_NOTHING (0)',
  1: 'HAVE_METADATA (1)',
  2: 'HAVE_CURRENT_DATA (2)',
  3: 'HAVE_FUTURE_DATA (3)',
  4: 'HAVE_ENOUGH_DATA (4)',
};

export const LiveCamera: React.FC<LiveCameraProps> = ({
  patientName,
  roomNumber,
  bedNumber = 'Bed A',
  customStreamUrl,
  autoStart = false,
}) => {
  const [cameraState, setCameraState] = useState<CameraState>('IDLE');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorName, setErrorName] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showDiagnostics, setShowDiagnostics] = useState<boolean>(false);

  // Available devices & selection
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');

  // Diagnostic metrics
  const [diagnostics, setDiagnostics] = useState<CameraDiagnostics>({
    permission: 'UNKNOWN',
    selectedCamera: 'None selected',
    streamState: 'DISCONNECTED',
    videoTrackCount: 0,
    trackState: 'NONE',
    videoWidth: 0,
    videoHeight: 0,
    readyState: 0,
    readyStateName: 'HAVE_NOTHING (0)',
    paused: 'YES',
    error: null,
  });

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mountedRef = useRef<boolean>(true);

  // Safe track release and video detach
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
      streamRef.current = null;
    }

    if (videoRef.current) {
      try {
        videoRef.current.pause();
        videoRef.current.srcObject = null;
      } catch {
        // ignore
      }
    }

    if (mountedRef.current) {
      setCameraState('STOPPED');
      setDiagnostics((prev) => ({
        ...prev,
        streamState: 'DISCONNECTED',
        videoTrackCount: 0,
        trackState: 'NONE',
        paused: 'YES',
      }));
    }
  }, []);

  // Enumerate video devices
  const populateDevices = useCallback(async () => {
    if (!navigator?.mediaDevices?.enumerateDevices) return [];
    try {
      const devList = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devList.filter((d) => d.kind === 'videoinput');
      if (mountedRef.current) {
        setDevices(videoInputs);
        if (videoInputs.length > 0 && !selectedDeviceId) {
          // Select built-in laptop camera if found, else first device
          const preferred =
            videoInputs.find((d) =>
              /integrated|internal|webcam|facetime|front/i.test(d.label)
            ) || videoInputs[0];
          setSelectedDeviceId(preferred.deviceId);
          setDiagnostics((prev) => ({
            ...prev,
            selectedCamera: preferred.label || 'Default Camera',
          }));
        }
      }
      return videoInputs;
    } catch (err) {
      console.warn('enumerateDevices error:', err);
      return [];
    }
  }, [selectedDeviceId]);

  // Check initial browser permission status if supported
  useEffect(() => {
    mountedRef.current = true;

    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .query({ name: 'camera' as any })
        .then((status) => {
          if (!mountedRef.current) return;
          const map: Record<string, 'GRANTED' | 'DENIED' | 'PROMPT'> = {
            granted: 'GRANTED',
            denied: 'DENIED',
            prompt: 'PROMPT',
          };
          setDiagnostics((prev) => ({
            ...prev,
            permission: map[status.state] || 'UNKNOWN',
          }));
          status.onchange = () => {
            if (!mountedRef.current) return;
            setDiagnostics((prev) => ({
              ...prev,
              permission: map[status.state] || 'UNKNOWN',
            }));
          };
        })
        .catch(() => {
          // Permissions API might not support 'camera' in all contexts
        });
    }

    populateDevices();

    return () => {
      mountedRef.current = false;
      stopCamera();
    };
  }, [stopCamera, populateDevices]);

  // Handle Fullscreen state changes
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.warn('Fullscreen toggle error:', err);
    }
  };

  // Core Camera Initializer
  const startCamera = async (targetDeviceId?: string) => {
    setCameraState('STARTING');
    setErrorMessage(null);
    setErrorName(null);

    // If custom URL stream (e.g. RTSP/WebRTC gateway)
    if (customStreamUrl) {
      if (videoRef.current) {
        videoRef.current.src = customStreamUrl;
        videoRef.current.play().catch(console.warn);
      }
      setCameraState('LIVE');
      return;
    }

    // Validate browser capability
    if (!navigator?.mediaDevices?.getUserMedia) {
      const msg = 'Camera access is not supported in this browser or context requires HTTPS/localhost.';
      setErrorMessage(msg);
      setErrorName('UnsupportedError');
      setCameraState('ERROR');
      setDiagnostics((prev) => ({ ...prev, error: msg }));
      return;
    }

    try {
      // 1. Clean up existing stream first
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }

      const activeDevId = targetDeviceId || selectedDeviceId;
      const constraints: MediaStreamConstraints = {
        video: activeDevId
          ? { deviceId: { exact: activeDevId }, width: { ideal: 1280 }, height: { ideal: 720 } }
          : { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: false,
      };

      // 2. Request getUserMedia
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      const videoTracks = stream.getVideoTracks();
      const primaryTrack = videoTracks[0];

      // Update diagnostics with stream metadata
      setDiagnostics((prev) => ({
        ...prev,
        permission: 'GRANTED',
        streamState: 'CONNECTED',
        videoTrackCount: videoTracks.length,
        trackState: primaryTrack ? (primaryTrack.readyState === 'live' ? 'LIVE' : 'ENDED') : 'NONE',
        selectedCamera: primaryTrack?.label || prev.selectedCamera,
      }));

      // 3. Attach directly to video element
      const videoEl = videoRef.current;
      if (!videoEl) {
        throw new Error('Video DOM element unavailable.');
      }

      // Ensure proper attributes before assigning srcObject
      videoEl.muted = true;
      videoEl.playsInline = true;
      videoEl.autoplay = true;
      videoEl.srcObject = stream;

      // 4. Verify playback and video dimensions before setting LIVE state
      await videoEl.play();

      // Listen for when video actually starts painting frames
      const handleVideoReady = () => {
        if (!mountedRef.current || !videoRef.current) return;

        const width = videoRef.current.videoWidth;
        const height = videoRef.current.videoHeight;
        const readyState = videoRef.current.readyState;
        const isPaused = videoRef.current.paused;

        setDiagnostics((prev) => ({
          ...prev,
          videoWidth: width,
          videoHeight: height,
          readyState,
          readyStateName: READY_STATE_NAMES[readyState] || `STATE_${readyState}`,
          paused: isPaused ? 'YES' : 'NO',
        }));

        // Strict verification: only LIVE if valid track, valid dimensions, and playing
        if (primaryTrack && primaryTrack.readyState === 'live' && width > 0 && height > 0 && !isPaused) {
          setCameraState('LIVE');
        }
      };

      if (videoEl.readyState >= 2 && videoEl.videoWidth > 0 && !videoEl.paused) {
        handleVideoReady();
      } else {
        videoEl.onloadedmetadata = () => {
          videoEl.play().then(handleVideoReady).catch(console.warn);
        };
        videoEl.onplaying = handleVideoReady;
        videoEl.ontimeupdate = () => {
          if (videoEl.videoWidth > 0 && videoEl.currentTime > 0) {
            handleVideoReady();
            videoEl.ontimeupdate = null; // Unbind after first painted frame
          }
        };
      }

      // Enumerate available cameras now that permission is granted
      await populateDevices();
    } catch (err: unknown) {
      stopCamera();
      const domError = err as { name?: string; message?: string };
      console.error('Camera initialization error:', domError);

      let friendlyMsg = 'Unable to start camera feed: ' + (domError.message || 'Unknown device error');
      const errName = domError.name || 'CameraError';

      if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
        friendlyMsg = 'Camera permission was denied. Please allow camera permissions in your browser address bar.';
      } else if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
        friendlyMsg = 'No camera hardware detected on this laptop/device.';
      } else if (errName === 'NotReadableError' || errName === 'TrackStartError') {
        friendlyMsg = 'The camera is currently locked or in use by another application (e.g. Zoom, Teams, Meet).';
      } else if (errName === 'OverconstrainedError') {
        friendlyMsg = 'Requested video resolution is not supported by the camera device.';
      } else if (errName === 'SecurityError') {
        friendlyMsg = 'Camera access blocked by browser security policy. Verify localhost or HTTPS context.';
      } else if (errName === 'AbortError') {
        friendlyMsg = 'Camera startup was interrupted or aborted.';
      }

      if (mountedRef.current) {
        setErrorMessage(friendlyMsg);
        setErrorName(errName);
        setCameraState('ERROR');
        setDiagnostics((prev) => ({
          ...prev,
          permission: errName === 'NotAllowedError' ? 'DENIED' : prev.permission,
          error: `${errName}: ${friendlyMsg}`,
        }));
      }
    }
  };

  // Switch camera device
  const handleDeviceChange = async (newDeviceId: string) => {
    setSelectedDeviceId(newDeviceId);
    const selected = devices.find((d) => d.deviceId === newDeviceId);
    if (selected) {
      setDiagnostics((prev) => ({ ...prev, selectedCamera: selected.label }));
    }
    if (cameraState === 'LIVE' || cameraState === 'STARTING') {
      await startCamera(newDeviceId);
    }
  };

  // Optional auto-start
  useEffect(() => {
    if (autoStart) {
      startCamera();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={containerRef}
      className={`relative bg-slate-900 rounded-2xl overflow-hidden border border-slate-700/80 shadow-md text-white transition-all ${
        isFullscreen ? 'w-full h-full p-4 flex flex-col justify-between' : 'w-full'
      }`}
    >
      {/* 1. TOP HEADER OVERLAY */}
      <div className="flex flex-wrap items-center justify-between p-3.5 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 z-10 gap-2">
        <div className="flex items-center gap-2.5">
          {/* Strictly verified LIVE indicator */}
          {cameraState === 'LIVE' ? (
            <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-600 text-white">
              <Radio className="w-3.5 h-3.5" />
              🔴 LIVE
            </span>
          ) : cameraState === 'STARTING' ? (
            <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500 text-white">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              Connecting...
            </span>
          ) : (
            <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
              <CameraOff className="w-3.5 h-3.5" />
              Camera Standby
            </span>
          )}

          <div>
            <span className="text-xs font-bold text-white tracking-wide">
              {roomNumber} • {bedNumber}
            </span>
            <span className="text-[11px] text-slate-400 ml-2 hidden sm:inline">
              • {patientName} (Bedside Live Monitor)
            </span>
          </div>
        </div>

        {/* Right Tools: Device Selector, Fullscreen, Diagnostics Toggle, Stop Button */}
        <div className="flex items-center gap-2">
          {/* Device Selection Dropdown (Section 15) */}
          {devices.length > 0 ? (
            <div className="flex items-center gap-1.5 text-xs bg-slate-800 px-2 py-1 rounded-lg border border-slate-700">
              <Video className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <label htmlFor="camera-device-select" className="text-[10px] text-slate-400 font-bold uppercase hidden sm:inline">Camera:</label>
              <select
                id="camera-device-select"
                value={selectedDeviceId}
                onChange={(e) => handleDeviceChange(e.target.value)}
                className="bg-transparent text-slate-200 text-xs focus:outline-none max-w-[130px] sm:max-w-[180px] truncate cursor-pointer"
                aria-label="Select camera hardware device"
              >
                {devices.map((dev, idx) => (
                  <option key={dev.deviceId || idx} value={dev.deviceId} className="bg-slate-900 text-slate-200">
                    {dev.label || `Camera ${idx + 1}`}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-[11px] text-slate-400 bg-slate-800/80 px-2 py-1 rounded-lg border border-slate-700/60">
              <Video className="w-3.5 h-3.5 text-slate-500" />
              <span>Camera: Laptop / USB Webcam</span>
            </div>
          )}

          {/* Diagnostics Inspector Button */}
          <button
            type="button"
            onClick={() => setShowDiagnostics(!showDiagnostics)}
            className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors border ${
              showDiagnostics
                ? 'bg-blue-600 text-white border-blue-500'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
            title="Inspect camera hardware diagnostics"
          >
            <Bug className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Diagnostics</span>
          </button>

          {cameraState === 'LIVE' && (
            <>
              <button
                type="button"
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                title="Audio muted for patient bedside privacy"
                aria-label="Audio muted"
              >
                <VolumeX className="w-4 h-4 text-slate-400" />
              </button>

              <button
                type="button"
                onClick={toggleFullscreen}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
                title={isFullscreen ? 'Exit Fullscreen' : 'View Fullscreen'}
                aria-label="Toggle Fullscreen"
              >
                {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
              </button>

              <button
                type="button"
                onClick={stopCamera}
                className="px-3 py-1.5 text-xs font-bold rounded-lg bg-red-600 hover:bg-red-500 text-white transition-colors"
              >
                Stop Feed
              </button>
            </>
          )}
        </div>
      </div>

      {/* 2. VIDEO VIEWPORT CONTAINER */}
      <div className={`relative flex items-center justify-center bg-slate-950 ${isFullscreen ? 'flex-1 my-2' : 'aspect-video'}`}>
        {/* PERMANENTLY MOUNTED HTML5 VIDEO ELEMENT */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover transform scale-x-[-1] transition-opacity duration-300 ${
            cameraState === 'LIVE' ? 'opacity-100 relative' : 'opacity-0 pointer-events-none absolute inset-0'
          }`}
        />

        {/* OVERLAYS FOR IDLE, STARTING, OR ERROR STATES */}
        {cameraState !== 'LIVE' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto z-10">
            {cameraState === 'STARTING' ? (
              <div className="flex flex-col items-center gap-3">
                <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
                <h4 className="text-sm font-bold text-slate-200">Starting Bedside Camera Stream...</h4>
                <p className="text-xs text-slate-400">
                  Hospital bedside camera — simulated using laptop webcam. Connecting device pipeline...
                </p>
              </div>
            ) : cameraState === 'ERROR' ? (
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-red-950 border border-red-800 flex items-center justify-center text-red-400">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-red-400 mb-1">
                    {errorName || 'Camera Error'}
                  </h4>
                  <p className="text-[11px] text-slate-300 mb-3 leading-relaxed">
                    {errorMessage}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => startCamera()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Retry Connection
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-slate-800/90 border border-slate-700 flex items-center justify-center text-blue-400 shadow-inner">
                  <Camera className="w-7 h-7" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-100 mb-1">Hospital Bedside Camera</h4>
                  <div className="inline-block px-2.5 py-0.5 rounded-full bg-blue-900/60 border border-blue-500/40 text-[10px] font-semibold text-blue-300 mb-2">
                    Demo using Laptop / USB Webcam
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed mb-4 max-w-xs">
                    Continuous video feed for bedside observation. Verify patient comfort, posture, and glove positioning.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => startCamera()}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-md shadow-blue-900/40"
                >
                  <Camera className="w-4 h-4" />
                  Start Bedside Camera
                </button>
              </div>
            )}
          </div>
        )}

        {/* Live Watermark Overlay */}
        {cameraState === 'LIVE' && (
          <div className="absolute bottom-3 left-3 bg-slate-900/80 backdrop-blur-md px-2.5 py-1 rounded-md text-[10px] text-slate-300 border border-slate-700/60 pointer-events-none flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
            <span>{roomNumber} • Bedside Cam ({diagnostics.videoWidth}x{diagnostics.videoHeight}) • AES-256</span>
          </div>
        )}

        {/* 3. IN-DEPTH HARDWARE DIAGNOSTICS HUD */}
        {showDiagnostics && (
          <div className="absolute inset-x-2 top-2 bottom-2 bg-slate-900/95 backdrop-blur-lg border border-slate-700 rounded-xl p-4 text-xs overflow-y-auto z-20 space-y-3 font-mono">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2 text-amber-400 font-bold font-sans">
                <Bug className="w-4 h-4" />
                <span>Webcam Telemetry & Hardware Diagnostics</span>
              </div>
              <button
                type="button"
                onClick={() => setShowDiagnostics(false)}
                className="text-slate-400 hover:text-white font-sans text-xs"
              >
                ✕ Close
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
              <div className="p-2 rounded bg-slate-950 border border-slate-800 space-y-0.5">
                <span className="text-slate-500 block">Camera Permission:</span>
                <span className={`font-bold ${diagnostics.permission === 'GRANTED' ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {diagnostics.permission}
                </span>
              </div>

              <div className="p-2 rounded bg-slate-950 border border-slate-800 space-y-0.5">
                <span className="text-slate-500 block">Selected Camera Device:</span>
                <span className="font-bold text-slate-200 truncate block">
                  {diagnostics.selectedCamera}
                </span>
              </div>

              <div className="p-2 rounded bg-slate-950 border border-slate-800 space-y-0.5">
                <span className="text-slate-500 block">MediaStream Link:</span>
                <span className={`font-bold ${diagnostics.streamState === 'CONNECTED' ? 'text-emerald-400' : 'text-slate-400'}`}>
                  {diagnostics.streamState} ({diagnostics.videoTrackCount} track)
                </span>
              </div>

              <div className="p-2 rounded bg-slate-950 border border-slate-800 space-y-0.5">
                <span className="text-slate-500 block">VideoTrack State:</span>
                <span className={`font-bold ${diagnostics.trackState === 'LIVE' ? 'text-emerald-400' : 'text-red-400'}`}>
                  {diagnostics.trackState}
                </span>
              </div>

              <div className="p-2 rounded bg-slate-950 border border-slate-800 space-y-0.5">
                <span className="text-slate-500 block">Rendered Dimensions:</span>
                <span className="font-bold text-slate-200">
                  {diagnostics.videoWidth} x {diagnostics.videoHeight} px
                </span>
              </div>

              <div className="p-2 rounded bg-slate-950 border border-slate-800 space-y-0.5">
                <span className="text-slate-500 block">HTML5 Video ReadyState:</span>
                <span className="font-bold text-slate-200">
                  {diagnostics.readyStateName}
                </span>
              </div>

              <div className="p-2 rounded bg-slate-950 border border-slate-800 space-y-0.5">
                <span className="text-slate-500 block">Playback Paused:</span>
                <span className={`font-bold ${diagnostics.paused === 'NO' ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {diagnostics.paused}
                </span>
              </div>

              <div className="p-2 rounded bg-slate-950 border border-slate-800 space-y-0.5">
                <span className="text-slate-500 block">State Machine:</span>
                <span className={`font-bold ${cameraState === 'LIVE' ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {cameraState}
                </span>
              </div>
            </div>

            {diagnostics.error && (
              <div className="p-2.5 rounded bg-red-950/80 border border-red-800 text-red-200 text-[11px]">
                <strong>Error Log:</strong> {diagnostics.error}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 4. ARCHITECTURE FOOTER NOTE */}
      <div className="px-3.5 py-2 bg-slate-950/80 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          <span>
            <strong className="text-slate-300">Hospital bedside camera — simulated using laptop webcam:</strong> Live visual verification for {patientName} ({roomNumber}).
          </span>
        </div>
        <span className="text-[10px] text-slate-500 font-mono">Stream: H.264 WebRTC</span>
      </div>
    </div>
  );
};
