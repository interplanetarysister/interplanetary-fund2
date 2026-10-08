import React, { useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Image } from "@/components/ui/image";
import { Loader2, Sparkles, UploadCloud, X } from "lucide-react";
import { improveUploadedPhoto } from "@/lib/ifundPhotoService";

// Uploads pictures or video to the platform and reports the URL back. For
// photos, users can keep the original or render the same photo in the
// Interplanetary Fund signature style.
const isVideo = (url = "") => /\.(mp4|webm|ogg|mov|m4v)(\?|$)/i.test(url);

export default function MediaUpload({
  value,
  onChange,
  label = "Upload media",
  accept = "image/*,video/*",
  previewClassName = "w-full max-h-[32rem] rounded-xl object-contain bg-slate-950",
}) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [originalUrl, setOriginalUrl] = useState("");
  const [ifundUrl, setIfundUrl] = useState("");
  const [error, setError] = useState("");

  const handleFile = async (file) => {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      if (!file_url) throw new Error("Upload did not return an asset URL");
      setOriginalUrl(file_url);
      setIfundUrl("");
      onChange(file_url);
    } catch {
      setError("Couldn't upload that file. Please try again.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const renderIfundVersion = async () => {
    const source = originalUrl || (!isVideo(value) ? value : "");
    if (!source) return;
    setRendering(true);
    setError("");
    try {
      const result = await improveUploadedPhoto(base44, source);
      setIfundUrl(result.url);
      onChange(result.url);
    } catch {
      setError("Couldn't improve the photo right now. Your original photo is unchanged; retry when ready.");
    } finally {
      setRendering(false);
    }
  };

  const clearMedia = () => {
    setOriginalUrl("");
    setIfundUrl("");
    setError("");
    onChange("");
  };

  const originalAvailable = originalUrl && !isVideo(originalUrl);
  const photoSelected = value && !isVideo(value);

  return (
    <div className="space-y-2">
      {value && (
        <div className="relative">
          {isVideo(value) ? (
            <video src={value} controls className={previewClassName} />
          ) : (
            <Image src={value} alt="Preview" className={previewClassName} />
          )}
          <button
            type="button"
            onClick={clearMedia}
            className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1 hover:bg-black/80"
            aria-label="Remove media"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {photoSelected && (
        <div className="rounded-xl border border-violet-300/25 bg-violet-500/10 p-3">
          <p className="text-xs font-semibold text-violet-100 mb-2">Choose your photo look</p>
          <div className="flex flex-wrap gap-2">
            {originalAvailable && <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onChange(originalUrl)}
              disabled={uploading || rendering || value === originalUrl}
              className="rounded-xl"
            >
              Use original
            </Button>}
            {ifundUrl ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onChange(ifundUrl)}
                disabled={uploading || rendering || value === ifundUrl}
                className="rounded-xl"
              >
                <Sparkles className="w-4 h-4 mr-1.5" />
                Use IFund version
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={renderIfundVersion}
                disabled={uploading || rendering}
                className="rounded-xl"
              >
                {rendering ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1.5" />}
                {rendering ? "Improving photo…" : "Generate IFund-style improvement"}
              </Button>
            )}
          </div>
          <p className="mt-2 text-[11px] text-slate-300">
            Applies the IFund cyberpunk, interstellar, space-comic and restrained steampunk look to this actual photo. The original person and scene stay intact. Your upload remains available.
          </p>
        </div>
      )}

      {error && <p className="text-xs text-rose-300" role="alert">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      <Button
        type="button"
        variant="outline"
        onClick={() => inputRef.current?.click()}
        disabled={uploading || rendering}
        className="rounded-xl border-2 border-cyan-500 bg-white text-slate-950 font-semibold shadow-sm hover:bg-cyan-50 hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-cyan-400"
      >
        {uploading ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <UploadCloud className="w-4 h-4 mr-2" />
        )}
        {value ? "Replace media" : label}
      </Button>
    </div>
  );
}
