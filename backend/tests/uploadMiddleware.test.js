import assert from "node:assert/strict";
import test from "node:test";

import { uploadImageFromBuffer } from "../src/middlewares/uploadMiddleware.js";

test("uploadImageFromBuffer prefers original URL over thumbnail URL", async (t) => {
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.FREEIMAGE_API_KEY;

  t.after(() => {
    globalThis.fetch = originalFetch;
    process.env.FREEIMAGE_API_KEY = originalApiKey;
  });

  process.env.FREEIMAGE_API_KEY = "test-key";
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      status_code: 200,
      image: {
        id_encoded: "img-id",
        url: "http://cdn.example.com/original.png",
        display_url: "http://cdn.example.com/display.png",
        thumb: {
          url: "http://cdn.example.com/thumb.png",
        },
      },
    }),
  });

  const result = await uploadImageFromBuffer(Buffer.from("image-bytes"), {
    fileName: "sample.png",
    mimeType: "image/png",
  });

  assert.equal(result.secure_url, "https://cdn.example.com/original.png");
});
