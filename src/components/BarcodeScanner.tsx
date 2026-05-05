import { useEffect, useRef, useState, useCallback } from "react";
import { X, Camera, AlertCircle, QrCode, Loader2 } from "lucide-react";
import { cn } from "../lib/utils";

interface BarcodeScannerProps {
  onScan: (value: string) => void;
  onClose: () => void;
  title?: string;
  description?: string;
}

declare class BarcodeDetector {
  constructor(options?: { formats: string[] });
  detect(image: ImageBitmapSource): Promise<Array<{ rawValue: string; format: string }>>;
  static getSupportedFormats(): Promise<string[]>;
}

export function BarcodeScanner({ onScan, onClose, title, description }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animRef = useRef<number>(0);
  const detectorRef = useRef<BarcodeDetector | null>(null);
  const scannedRef = useRef(false);

  const [status, setStatus] = useState<"starting" | "scanning" | "error" | "no-support">("starting");
  const [errorMsg, setErrorMsg] = useState("");
  const [manualUrl, setManualUrl] = useState("");
  const [showManual, setShowManual] = useState(false);
  const [detected, setDetected] = useState(false);

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(animRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const handleScan = useCallback(
    (value: string) => {
      if (scannedRef.current) return;
      scannedRef.current = true;
      setDetected(true);
      stopCamera();
      setTimeout(() => onScan(value), 600);
    },
    [onScan, stopCamera],
  );

  useEffect(() => {
    let cancelled = false;

    const start = async () => {
      if (!("BarcodeDetector" in window)) {
        setStatus("no-support");
        setShowManual(true);
        return;
      }

      const isLocalHost = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
      if (!navigator.mediaDevices?.getUserMedia || (!window.isSecureContext && !isLocalHost)) {
        setErrorMsg("הדפדפן חוסם מצלמה בכתובת לא מאובטחת. ניתן להדביק את קישור ה-QR ידנית.");
        setStatus("error");
        setShowManual(true);
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
        });

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        detectorRef.current = new BarcodeDetector({ formats: ["qr_code", "code_128", "code_39", "ean_13", "ean_8", "upc_a", "upc_e"] });
        setStatus("scanning");

        const scanFrame = async () => {
          if (cancelled || scannedRef.current || !videoRef.current || !detectorRef.current) return;
          if (videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
            try {
              const results = await detectorRef.current.detect(videoRef.current);
              if (results.length > 0) {
                handleScan(results[0].rawValue);
                return;
              }
            } catch {}
          }
          animRef.current = requestAnimationFrame(scanFrame);
        };

        animRef.current = requestAnimationFrame(scanFrame);
      } catch (err: any) {
        if (cancelled) return;
        if (err?.name === "NotAllowedError") {
          setErrorMsg("אנא אשר גישה למצלמה בהגדרות הדפדפן ונסה שוב.");
        } else if (err?.name === "NotFoundError") {
          setErrorMsg("לא נמצאה מצלמה במכשיר.");
        } else {
          setErrorMsg("לא ניתן להפעיל את המצלמה: " + (err?.message ?? "שגיאה לא ידועה"));
        }
        setStatus("error");
        setShowManual(true);
      }
    };

    start();

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [handleScan, stopCamera]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const url = manualUrl.trim();
    if (!url) return;
    handleScan(url);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center p-0 sm:p-4" dir="rtl">
      <div
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
        onClick={onClose}
      />

      <div className="relative z-10 max-h-[94dvh] w-full max-w-md overflow-y-auto bg-white rounded-t-[40px] sm:rounded-[40px] shadow-2xl animate-in slide-in-from-bottom-8 sm:zoom-in-95 duration-500 no-scrollbar">
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-slate-900 flex items-center justify-center text-white">
              <QrCode size={20} />
            </div>
            <div>
              <p className="text-sm font-black text-slate-900">{title ?? "סריקת קוד QR"}</p>
              <p className="text-[10px] font-bold text-slate-400">{description ?? "כוון את המצלמה לקוד"}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="סגור סורק"
            className="h-10 w-10 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* Camera Preview */}
        <div className="relative bg-slate-950 aspect-square overflow-hidden">
          <video
            ref={videoRef}
            muted
            playsInline
            className={cn(
              "w-full h-full object-cover transition-opacity duration-500",
              status === "scanning" ? "opacity-100" : "opacity-30"
            )}
          />
          <canvas ref={canvasRef} className="hidden" />

          {/* Scanning overlay */}
          {status === "scanning" && !detected && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="relative w-56 h-56">
                {/* Corner brackets */}
                {[
                  "top-0 right-0 border-t-4 border-r-4 rounded-tr-2xl",
                  "top-0 left-0 border-t-4 border-l-4 rounded-tl-2xl",
                  "bottom-0 right-0 border-b-4 border-r-4 rounded-br-2xl",
                  "bottom-0 left-0 border-b-4 border-l-4 rounded-bl-2xl",
                ].map((cls, i) => (
                  <div key={i} className={cn("absolute h-10 w-10 border-white", cls)} />
                ))}
                {/* Scanning line */}
                <div className="absolute inset-x-0 top-0 h-0.5 bg-blue-400 shadow-[0_0_12px_rgba(96,165,250,0.8)] animate-[scanline_2s_ease-in-out_infinite]" />
              </div>
              <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
                <span className="px-4 py-2 bg-white/10 backdrop-blur-md rounded-full text-[11px] font-black text-white border border-white/10">
                  מחפש קוד QR...
                </span>
              </div>
            </div>
          )}

          {/* Starting state */}
          {status === "starting" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-white">
              <Loader2 size={40} className="animate-spin opacity-50" />
              <p className="text-sm font-bold opacity-70">מפעיל מצלמה...</p>
            </div>
          )}

          {/* Detected success */}
          {detected && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-emerald-500/20 backdrop-blur-sm">
              <div className="h-24 w-24 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-2xl animate-in zoom-in duration-300">
                <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="mt-4 text-white font-black text-lg">קוד זוהה!</p>
            </div>
          )}

          {/* Error / No support */}
          {(status === "error" || status === "no-support") && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
              <div className="h-16 w-16 rounded-full bg-white/10 flex items-center justify-center">
                <Camera size={28} className="text-white/50" />
              </div>
              <p className="text-sm font-bold text-white/70">
                {status === "no-support"
                  ? "הדפדפן אינו תומך בסריקה אוטומטית"
                  : errorMsg}
              </p>
            </div>
          )}
        </div>

        {/* Manual URL Input */}
        <div className="p-6 space-y-4">
          {showManual ? (
            <form onSubmit={handleManualSubmit} className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                הזנת כתובת ידנית
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="text"
                  value={manualUrl}
                  onChange={(e) => setManualUrl(e.target.value)}
                  placeholder="הדבק כתובת או קוד נכס..."
                  className="h-12 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold outline-none transition-all focus:border-slate-900 focus:bg-white"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={!manualUrl.trim()}
                  className="h-12 rounded-2xl bg-slate-900 px-5 text-xs font-black text-white transition-all hover:bg-black disabled:opacity-30"
                >
                  אישור
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setShowManual(true)}
              className="w-full py-3 text-[12px] font-black text-slate-400 hover:text-slate-900 transition-colors"
            >
              הזנה ידנית במקום
            </button>
          )}

          {status === "error" && (
            <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-100 rounded-2xl">
              <AlertCircle size={16} className="text-amber-600 mt-0.5 shrink-0" />
              <p className="text-xs font-bold text-amber-700">{errorMsg}</p>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes scanline {
          0%, 100% { transform: translateY(0); opacity: 1; }
          50% { transform: translateY(224px); opacity: 0.8; }
        }
      `}</style>
    </div>
  );
}
