package com.britiumexpress.rider;

import android.app.Dialog;
import android.app.Activity;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Matrix;
import android.net.Uri;
import android.os.Build;
import android.os.ext.SdkExtensions;
import androidx.exifinterface.media.ExifInterface;
import androidx.activity.result.ActivityResult;
import androidx.activity.result.PickVisualMediaRequest;
import androidx.activity.result.contract.ActivityResultContracts;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.ActivityCallback;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import org.json.JSONArray;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "BritiumPhotoPicker")
public class BritiumPhotoPickerPlugin extends Plugin {
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private PluginCall activeCall;
    private Dialog dialog;
    private boolean externalPickerOpen;

    private String batchKey(PluginCall call) {
        String id = call.getString("batchId", "");
        if (!id.matches("[A-Za-z0-9-]{1,80}")) throw new IllegalArgumentException("Invalid photo batch.");
        return id;
    }

    private void releaseBatch(String key) {
        android.content.SharedPreferences preferences = getContext().getSharedPreferences("britium-photo-batches", 0);
        String value = preferences.getString(key, null);
        preferences.edit().remove(key).apply();
        try {
            JSONArray uris = new JSONArray(value == null ? "[]" : value);
            for (int i = 0; i < uris.length(); i++) {
                try { getContext().getContentResolver().releasePersistableUriPermission(Uri.parse(uris.getString(i)), Intent.FLAG_GRANT_READ_URI_PERMISSION); }
                catch (SecurityException ignored) { }
            }
        } catch (Exception ignored) { }
    }

    private void bulkError(PluginCall call, String message, boolean cancelled) {
        JSObject response = new JSObject();
        response.put("batchId", batchKey(call));
        response.put(cancelled ? "cancelled" : "error", cancelled ? true : message);
        activeCall = null;
        call.resolve(response);
    }

    @PluginMethod public void finishBatch(PluginCall call) {
        try { releaseBatch(batchKey(call)); call.resolve(); }
        catch (Exception error) { call.reject("Invalid photo batch."); }
    }

    /** Reuse the privately persisted URI grants if Android recreates us during normalization. */
    @PluginMethod public void resumeImages(PluginCall call) {
        if (activeCall != null) { call.reject("Photo selection is busy.", "PHOTO_PICKER_BUSY"); return; }
        try {
            String selected = getContext().getSharedPreferences("britium-photo-batches", 0).getString(batchKey(call), null);
            if (selected == null) { call.reject("No pending photo selection.", "NO_PENDING_SELECTION"); return; }
            JSONArray stored = new JSONArray(selected);
            int limit = Math.max(1, Math.min(10, call.getInt("limit", 10)));
            if (stored.length() == 0 || stored.length() > limit) throw new IllegalArgumentException("Invalid photo batch.");
            List<Uri> uris = new ArrayList<>();
            for (int i = 0; i < stored.length(); i++) uris.add(Uri.parse(stored.getString(i)));
            activeCall = call;
            prepareSelection(call, uris);
        } catch (Exception error) { call.reject("Unable to recover photos. Select the batch again.", "PHOTO_READ_FAILED"); }
    }

    /** Capacitor saves this call before launching, so the batch can be restored after Android recreates the Activity. */
    @PluginMethod public void pickImages(PluginCall call) {
        if (getActivity() == null) { call.reject("Photo picker is unavailable.", "UNAVAILABLE"); return; }
        getActivity().runOnUiThread(() -> {
            if (activeCall != null) { call.reject("Photo selection is already open.", "PHOTO_PICKER_BUSY"); return; }
            try { batchKey(call); } catch (Exception error) { call.reject("Invalid photo batch."); return; }
            // Opening a new selection intentionally abandons any older unfinished batch.
            for (String key : getContext().getSharedPreferences("britium-photo-batches", 0).getAll().keySet()) releaseBatch(key);
            int limit = Math.max(1, Math.min(10, call.getInt("limit", 10)));
            PickVisualMediaRequest request = new PickVisualMediaRequest.Builder()
                .setMediaType(ActivityResultContracts.PickVisualMedia.ImageOnly.INSTANCE).build();
            Intent intent = limit == 1
                ? new ActivityResultContracts.PickVisualMedia().createIntent(getContext(), request)
                : new ActivityResultContracts.PickMultipleVisualMedia(limit).createIntent(getContext(), request);
            activeCall = call;
            externalPickerOpen = true;
            try { startActivityForResult(call, intent, "selectedImages"); }
            catch (RuntimeException error) { externalPickerOpen = false; reject(call, "Unable to open photo picker.", "UNAVAILABLE"); }
        });
    }

    @ActivityCallback private void selectedImages(PluginCall call, ActivityResult result) {
        if (call == null) return;
        activeCall = call;
        externalPickerOpen = false;
        if (result.getResultCode() != Activity.RESULT_OK) { bulkError(call, "Photo selection was cancelled.", true); return; }
        Intent data = result.getData();
        LinkedHashSet<Uri> unique = new LinkedHashSet<>();
        if (data != null && data.getClipData() != null) {
            for (int i = 0; i < data.getClipData().getItemCount(); i++) unique.add(data.getClipData().getItemAt(i).getUri());
        } else if (data != null && data.getData() != null) unique.add(data.getData());
        unique.remove(null);
        int limit = Math.max(1, Math.min(10, call.getInt("limit", 10)));
        if (unique.isEmpty() || unique.size() > limit) { bulkError(call, "Select between 1 and " + limit + " photos.", unique.isEmpty()); return; }
        List<Uri> uris = new ArrayList<>(unique);
        JSONArray stored = new JSONArray();
        for (Uri uri : uris) {
            stored.put(uri.toString());
            try { getContext().getContentResolver().takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION); }
            catch (SecurityException ignored) { /* Some providers retain a task grant instead. */ }
        }
        if (!getContext().getSharedPreferences("britium-photo-batches", 0).edit().putString(batchKey(call), stored.toString()).commit()) {
            reject(call, "Unable to retain the selected batch. Retry selection.", "PHOTO_READ_FAILED"); return;
        }
        prepareSelection(call, uris);
    }

    private void prepareSelection(PluginCall call, List<Uri> uris) {
        worker.execute(() -> {
            List<File> prepared = new ArrayList<>();
            try {
                JSArray photos = new JSArray();
                for (Uri uri : uris) {
                    File file = selectedPhoto(uri);
                    prepared.add(file);
                    JSObject photo = new JSObject();
                    photo.put("path", Uri.fromFile(file).toString());
                    photo.put("format", "jpeg");
                    photos.put(photo);
                }
                JSObject response = new JSObject();
                response.put("photos", photos);
                response.put("batchId", batchKey(call));
                if (getActivity() != null) getActivity().runOnUiThread(() -> { activeCall = null; call.resolve(response); });
            } catch (Exception error) {
                for (File file : prepared) file.delete();
                if (getActivity() != null) getActivity().runOnUiThread(() -> bulkError(call, "Unable to prepare the selected photos. Retry a smaller batch.", false));
            }
        });
    }

    @PluginMethod public void pickImage(PluginCall call) {
        if (getActivity() == null) { call.reject("Photo picker is unavailable.", "EMBEDDED_UNAVAILABLE"); return; }
        getActivity().runOnUiThread(() -> {
            if (activeCall != null) { call.reject("Photo selection is already open.", "PHOTO_PICKER_BUSY"); return; }
            boolean supported = Build.VERSION.SDK_INT >= 36 || (Build.VERSION.SDK_INT >= 34 && SdkExtensions.getExtensionVersion(34) >= 15);
            if (!supported) { call.reject("Embedded picker is unavailable on this device.", "EMBEDDED_UNAVAILABLE"); return; }
            activeCall = call;
            try {
                dialog = EmbeddedPickerDialog.show(getActivity(), new EmbeddedPickerDialog.Result() {
                    @Override public void selected(Uri uri) {
                        worker.execute(() -> {
                            try {
                                File file = selectedPhoto(uri);
                                getActivity().runOnUiThread(() -> {
                                    if (activeCall != call) return;
                                    JSObject photo = new JSObject();
                                    photo.put("path", Uri.fromFile(file).toString());
                                    photo.put("format", "jpeg");
                                    activeCall = null;
                                    call.resolve(photo);
                                });
                            } catch (Exception error) {
                                if (getActivity() != null) getActivity().runOnUiThread(() -> reject(call, "Unable to read selected photo. Try a smaller image.", "PHOTO_READ_FAILED"));
                            }
                        });
                    }
                    @Override public void cancelled() { reject(call, "Photo selection was cancelled.", "PHOTO_PICKER_CANCELLED"); }
                    @Override public void unavailable() { reject(call, "Embedded picker is unavailable.", "EMBEDDED_UNAVAILABLE"); }
                });
            } catch (RuntimeException | LinkageError error) {
                if (dialog != null) dialog.dismiss();
                reject(call, "Embedded picker is unavailable.", "EMBEDDED_UNAVAILABLE");
            }
        });
    }

    private void reject(PluginCall call, String message, String code) {
        if (activeCall != call) return;
        activeCall = null;
        call.reject(message, code);
    }

    /** Copy only the granted selection, then normalize it for the existing preview/upload path. */
    private File selectedPhoto(Uri uri) throws Exception {
        String type = getContext().getContentResolver().getType(uri);
        if (type == null || !type.startsWith("image/")) throw new IllegalArgumentException("Select an image.");
        File directory = new File(getContext().getCacheDir(), "britium-selected-photos");
        if (!directory.isDirectory() && !directory.mkdirs()) throw new IllegalStateException("Photo cache unavailable.");
        File[] stale = directory.listFiles();
        if (stale != null) for (File file : stale) if (file.lastModified() < System.currentTimeMillis() - 86400000L) file.delete();
        File original = File.createTempFile("selected-", ".source", directory);
        File output = null;
        Bitmap bitmap = null;
        try {
            try (InputStream input = getContext().getContentResolver().openInputStream(uri); FileOutputStream destination = new FileOutputStream(original)) {
                if (input == null) throw new IllegalArgumentException("Selected photo unavailable.");
                byte[] buffer = new byte[32768];
                int count;
                long total = 0;
                while ((count = input.read(buffer)) != -1) {
                    if (Thread.currentThread().isInterrupted()) throw new InterruptedException();
                    total += count;
                    if (total > 25L * 1024 * 1024) throw new IllegalArgumentException("Selected photo too large.");
                    destination.write(buffer, 0, count);
                }
            }
            BitmapFactory.Options options = new BitmapFactory.Options();
            options.inJustDecodeBounds = true;
            BitmapFactory.decodeFile(original.getAbsolutePath(), options);
            if (options.outWidth < 1 || options.outHeight < 1) throw new IllegalArgumentException("Unsupported image.");
            options.inSampleSize = 1;
            while (Math.max(options.outWidth, options.outHeight) / options.inSampleSize > 1600) options.inSampleSize *= 2;
            options.inJustDecodeBounds = false;
            bitmap = BitmapFactory.decodeFile(original.getAbsolutePath(), options);
            if (bitmap == null) throw new IllegalArgumentException("Unable to decode image.");
            int orientation = new ExifInterface(original).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL);
            Matrix matrix = new Matrix();
            switch (orientation) {
                case ExifInterface.ORIENTATION_FLIP_HORIZONTAL: matrix.setScale(-1, 1); break;
                case ExifInterface.ORIENTATION_ROTATE_180: matrix.setRotate(180); break;
                case ExifInterface.ORIENTATION_FLIP_VERTICAL: matrix.setScale(1, -1); break;
                case ExifInterface.ORIENTATION_TRANSPOSE: matrix.setRotate(90); matrix.postScale(-1, 1); break;
                case ExifInterface.ORIENTATION_ROTATE_90: matrix.setRotate(90); break;
                case ExifInterface.ORIENTATION_TRANSVERSE: matrix.setRotate(270); matrix.postScale(-1, 1); break;
                case ExifInterface.ORIENTATION_ROTATE_270: matrix.setRotate(270); break;
                default: break;
            }
            float scale = Math.min(1f, 1600f / Math.max(bitmap.getWidth(), bitmap.getHeight()));
            matrix.postScale(scale, scale);
            Bitmap transformed = Bitmap.createBitmap(bitmap, 0, 0, bitmap.getWidth(), bitmap.getHeight(), matrix, true);
            if (transformed != bitmap) { bitmap.recycle(); bitmap = transformed; }
            output = File.createTempFile("britium-photo-", ".jpg", directory);
            try (FileOutputStream destination = new FileOutputStream(output)) {
                if (!bitmap.compress(Bitmap.CompressFormat.JPEG, 84, destination)) throw new IllegalStateException("Unable to prepare photo.");
            }
            return output;
        } catch (Exception error) {
            if (output != null) output.delete();
            throw error;
        } finally {
            original.delete();
            if (bitmap != null) bitmap.recycle();
        }
    }

    @Override protected void handleOnDestroy() {
        // Do not turn Activity recreation during the system picker into a user cancellation.
        // Capacitor owns the saved call and delivers selectedImages/appRestoredResult.
        if (activeCall != null && !externalPickerOpen && !activeCall.getMethodName().equals("pickImages") && !activeCall.getMethodName().equals("resumeImages")) reject(activeCall, "Photo selection was cancelled.", "PHOTO_PICKER_CANCELLED");
        if (dialog != null) dialog.dismiss();
        worker.shutdownNow();
        super.handleOnDestroy();
    }
}
