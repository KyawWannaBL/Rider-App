package com.britiumexpress.rider;

import android.app.Dialog;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Matrix;
import android.net.Uri;
import android.os.Build;
import android.os.ext.SdkExtensions;
import androidx.exifinterface.media.ExifInterface;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "BritiumPhotoPicker")
public class BritiumPhotoPickerPlugin extends Plugin {
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private PluginCall activeCall;
    private Dialog dialog;

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
            while (Math.max(options.outWidth, options.outHeight) / options.inSampleSize > 3200) options.inSampleSize *= 2;
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
        if (activeCall != null) reject(activeCall, "Photo selection was cancelled.", "PHOTO_PICKER_CANCELLED");
        if (dialog != null) dialog.dismiss();
        worker.shutdownNow();
        super.handleOnDestroy();
    }
}
