"use client";

import { useRef, useState, useTransition } from "react";
import type { PhotoState } from "@/lib/actions/photos";
import { Button, cx } from "@/components/ui";

const MAX_EDGE = 1600;

/** Shrinks a photo in the browser so uploads stay small; falls back to the original. */
async function downscale(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    return blob ?? file;
  } catch {
    return file;
  }
}

/**
 * "Change photo" / "Remove" for one image. Picks a file, downscales it,
 * and hands a FormData to the server action; `fields` ride along (e.g.
 * the event id).
 */
export function ImageUpload({
  upload,
  remove,
  hasImage,
  fields = {},
  label = "Change photo",
  className,
}: {
  upload: (formData: FormData) => Promise<PhotoState>;
  remove?: (formData: FormData) => Promise<PhotoState>;
  hasImage: boolean;
  fields?: Record<string, string>;
  label?: string;
  className?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function withFields(formData: FormData) {
    for (const [key, value] of Object.entries(fields)) formData.set(key, value);
    return formData;
  }

  return (
    <div className={cx("flex flex-wrap items-center gap-2", className)}>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          setError(null);
          start(async () => {
            const blob = await downscale(file);
            const formData = withFields(new FormData());
            formData.set("file", new File([blob], "photo.jpg", { type: blob.type || file.type }));
            const result = await upload(formData);
            if (result?.error) setError(result.error);
          });
        }}
      />
      <Button type="button" variant="secondary" size="sm" disabled={pending} onClick={() => input.current?.click()}>
        {pending ? "Uploading…" : hasImage ? label : label.replace("Change", "Add")}
      </Button>
      {hasImage && remove ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const result = await remove(withFields(new FormData()));
              if (result?.error) setError(result.error);
            })
          }
        >
          Remove
        </Button>
      ) : null}
      {error ? <p className="w-full text-[13px] text-danger">{error}</p> : null}
    </div>
  );
}
