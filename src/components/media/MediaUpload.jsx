import React, { useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Image } from "@/components/ui/image";
import { Loader2, UploadCloud, X } from "lucide-react";

// Uploads pictures or video to the platform and reports the URL back. Used for
// campaign covers, profile photos, and update attachments.
const isVideo = (url = "") => /\.(mp4|webm|ogg|mov|m4v)(\?|$)/i.test(url);

export default function MediaUpload({
  value,
  onChange,
  label = "Upload media",
  accept = "image/*,video/*",
  previewClassName = "w-full h-44 rounded-xl object-cover",
}) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      onChange(file_url);
    } catch (e) {
      /* ignore — preview stays unchanged */
    }
    setUploading(false);
  };

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
            onClick={() => onChange("")}
            className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1 hover:bg-black/80"
            aria-label="Remove media"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
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
        disabled={uploading}
        className="rounded-xl"
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