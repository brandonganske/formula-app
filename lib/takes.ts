import { api, extractData } from '@/lib/api';

// Upload a filmed take (plus a thumbnail) to Formula and register it, linked
// to the script/product it came from. Native modules are loaded lazily so
// older dev builds degrade to "saved to Photos only" instead of crashing.

export interface UploadTakeInput {
  uri: string;
  scriptId?: string | null;
  productName?: string | null;
  photosAssetId?: string | null;
  durationSec?: number | null;
  title?: string | null;
  onProgress?: (fraction: number) => void;
}

function loadFS(): any | null { try { return require('expo-file-system/legacy'); } catch { return null; } }
function loadThumbs(): any | null { try { return require('expo-video-thumbnails'); } catch { return null; } }

export async function uploadTake(input: UploadTakeInput): Promise<{ id: string } | null> {
  const FS = loadFS();
  if (!FS) throw new Error('Update the app to save takes to Formula.');

  // Thumbnail from ~0.5s in (skips the black first frame on some phones).
  let thumbUri: string | null = null;
  const Th = loadThumbs();
  if (Th) {
    try { const t = await Th.getThumbnailAsync(input.uri, { time: 500, quality: 0.7 }); thumbUri = t?.uri ?? null; } catch {}
  }

  const ext = (input.uri.split('.').pop() || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp4';
  const urls = extractData<{ video: { signed_url: string; storage_path: string }; thumb: { signed_url: string; storage_path: string } | null }>(
    await api.post('/creators/takes/upload-url', { ext, with_thumb: !!thumbUri }),
  );
  if (!urls?.video?.signed_url) throw new Error('Could not start the upload.');

  const put = async (url: string, fileUri: string, mime: string, track: boolean) => {
    const task = FS.createUploadTask(url, fileUri, {
      httpMethod: 'PUT',
      uploadType: FS.FileSystemUploadType.BINARY_CONTENT,
      headers: { 'content-type': mime },
    }, track && input.onProgress ? (p: any) => input.onProgress!(p.totalBytesExpectedToSend ? p.totalBytesSent / p.totalBytesExpectedToSend : 0) : undefined);
    const res = await task.uploadAsync();
    if (!res || res.status < 200 || res.status >= 300) throw new Error(`Upload failed (${res?.status ?? 'network'})`);
  };

  await put(urls.video.signed_url, input.uri, ext === 'mov' ? 'video/quicktime' : 'video/mp4', true);
  let thumb_path: string | null = null;
  if (thumbUri && urls.thumb) {
    try { await put(urls.thumb.signed_url, thumbUri, 'image/jpeg', false); thumb_path = urls.thumb.storage_path; } catch {}
  }

  let size_bytes: number | null = null;
  try { const info = await FS.getInfoAsync(input.uri, { size: true }); size_bytes = info?.size ?? null; } catch {}

  const created = extractData<{ take: { id: string } }>(await api.post('/creators/takes', {
    storage_path: urls.video.storage_path,
    thumb_path,
    script_id: input.scriptId ?? null,
    product_name: input.productName ?? null,
    photos_asset_id: input.photosAssetId ?? null,
    duration_sec: input.durationSec ?? null,
    size_bytes,
    title: input.title ?? null,
  }));
  return created?.take ? { id: created.take.id } : null;
}
