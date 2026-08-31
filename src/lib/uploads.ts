import { supabase, hasSupabaseKeys } from "./supabase";

export interface UploadedFileDetails {
  url: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
}

/**
 * Uploads a file or blob to Supabase Storage, or falls back to a Base64 Data URL if offline or if upload fails.
 * 
 * @param file The file or blob to upload
 * @param name The original filename or a friendly name
 * @param folder The storage folder prefix (e.g. "files", "media", "voice", "cvs")
 * @param options Additional options (e.g. accept type filter)
 */
export async function uploadFile(
  file: File | Blob,
  name: string,
  folder: string,
  options?: { accept?: string }
): Promise<UploadedFileDetails> {
  const mimeType = file.type || "application/octet-stream";
  const sizeBytes = file.size;

  if (!hasSupabaseKeys) {
    console.info("Offline mode: converting upload to Base64 Data URL");
    const url = await convertToBase64(file);
    return {
      url,
      storage_path: `offline/${folder}/${Date.now()}_${name}`,
      mime_type: mimeType,
      size_bytes: sizeBytes,
    };
  }

  try {
    // Automatically create/verify bucket exists (fails cleanly if exists)
    await supabase.storage.createBucket("documents", {
      public: true,
      fileSizeLimit: 52428800, // 50MB
    }).catch(() => {});

    const fileExt = name.split(".").pop() || "bin";
    const cleanFolder = folder.replace(/\/+$/, "");
    const uniqueId = typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).substring(2, 15);
    const storagePath = `${cleanFolder}/${uniqueId}_${Date.now()}.${fileExt}`;

    const { error } = await supabase.storage
      .from("documents")
      .upload(storagePath, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: mimeType,
      });

    if (error) throw error;

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("documents")
      .getPublicUrl(storagePath);

    return {
      url: urlData.publicUrl,
      storage_path: storagePath,
      mime_type: mimeType,
      size_bytes: sizeBytes,
    };
  } catch (err) {
    console.error("Supabase storage upload failed:", err);
    throw new Error(
      `File upload failed: ${err instanceof Error ? err.message : "Unknown storage error"}. Please check your connection and try again.`
    );
  }
}

/**
 * Removes a file from Supabase Storage bucket.
 * 
 * @param storagePath The path of the file inside the bucket
 */
export async function removeStorageObject(storagePath: string): Promise<void> {
  if (!hasSupabaseKeys || !storagePath || storagePath.startsWith("offline/") || storagePath.startsWith("fallback/")) {
    return;
  }
  try {
    const { error } = await supabase.storage
      .from("documents")
      .remove([storagePath]);
    if (error) throw error;
  } catch (err) {
    console.error(`Failed to delete storage path "${storagePath}":`, err);
  }
}

function convertToBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });
}
