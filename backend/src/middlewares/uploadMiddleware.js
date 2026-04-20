import multer from "multer";

const FREEIMAGE_UPLOAD_URL =
  process.env.FREEIMAGE_API_URL || "https://freeimage.host/api/1/upload";

const toHttpsUrl = (url) => {
  if (!url || typeof url !== "string") {
    return null;
  }

  return url.replace(/^http:\/\//i, "https://");
};

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 1024 * 1024 * 1, // 1MB
  },
});

export const uploadImageFromBuffer = async (buffer, options = {}) => {
  const apiKey = process.env.FREEIMAGE_API_KEY;

  if (!apiKey) {
    throw new Error("FREEIMAGE_API_KEY is not configured");
  }

  const formData = new FormData();
  formData.append("key", apiKey);
  formData.append("action", "upload");
  formData.append("format", "json");
  formData.append(
    "source",
    new Blob([buffer], {
      type: options.mimeType || "application/octet-stream",
    }),
    options.fileName || "avatar"
  );

  const response = await fetch(FREEIMAGE_UPLOAD_URL, {
    method: "POST",
    body: formData,
  });

  let payload;

  try {
    payload = await response.json();
  } catch {
    throw new Error("Invalid response from Freeimage API");
  }

  const statusCode = Number(payload?.status_code ?? response.status);

  if (!response.ok || payload?.error || statusCode >= 400) {
    const message = payload?.error?.message || payload?.status_txt || "Image upload failed";
    throw new Error(message);
  }

  const image = payload?.image;

  if (!image) {
    throw new Error("Freeimage response missing image payload");
  }

  const secureUrl =
    toHttpsUrl(image?.thumb?.url) ||
    toHttpsUrl(image?.display_url) ||
    toHttpsUrl(image?.url);

  if (!secureUrl) {
    throw new Error("Freeimage response missing uploaded image URL");
  }

  return {
    secure_url: secureUrl,
    public_id: image?.id_encoded || image?.filename || null,
  };
};
