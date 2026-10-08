import { resolveGeneratedImageUrl } from "./generatedMedia";
import { brandAndUploadGeneratedImage } from "./ifundImageBranding";
import { createIfundPhotoTreatment } from "./ifundPhotoTreatment";

// The ONLY entry point for any user-uploaded IFund photo transformation.
// A real reference-image API is preferred. Offline source-preserving styling
// is always available and never claims to be AI generated.
export async function improveUploadedPhoto(base44, originalUrl) {
  let brandedSource = originalUrl;
  let mode = "photo_treatment";
  let temporaryUrl = null;
  try {
    const response = await base44.functions.invoke("renderInterplanetaryPhoto", {
      source_url: originalUrl,
    }).catch(() => null);
    const serverUrl = response?.data?.mode === "ai_photo_edit"
      ? resolveGeneratedImageUrl(response.data) : "";
    if (serverUrl) {
      brandedSource = serverUrl;
      mode = "ai_photo_edit";
    } else {
      // No compatible provider (or its authorization expired). Stylize THIS
      // image's actual pixels instead of generating a new unrelated person.
      const image = await createIfundPhotoTreatment(originalUrl);
      temporaryUrl = URL.createObjectURL(image);
      brandedSource = temporaryUrl;
    }
    const url = await brandAndUploadGeneratedImage(base44, brandedSource);
    return { url, mode };
  } finally {
    if (temporaryUrl) URL.revokeObjectURL(temporaryUrl);
  }
}
