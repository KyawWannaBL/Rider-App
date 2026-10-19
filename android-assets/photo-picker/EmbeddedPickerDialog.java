package com.britiumexpress.rider;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.Dialog;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.view.ViewGroup;
import android.view.Window;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.photopicker.EmbeddedPhotoPickerFeatureInfo;
import android.widget.photopicker.EmbeddedPhotoPickerSession;
import androidx.photopicker.EmbeddedPhotoPickerView.EmbeddedPhotoPickerStateChangeListener;
import androidx.photopicker.EmbeddedPhotoPickerView;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/** Loaded only after API/SDK-extension checks; never required by older Android devices. */
@SuppressLint({"NewApi", "UnsafeOptInUsageError"})
final class EmbeddedPickerDialog {
    interface Result {
        void selected(Uri uri);
        void cancelled();
        void unavailable();
    }

    static Dialog show(Activity activity, Result result) {
        Dialog dialog = new Dialog(activity);
        dialog.requestWindowFeature(Window.FEATURE_NO_TITLE);
        LinearLayout content = new LinearLayout(activity);
        content.setOrientation(LinearLayout.VERTICAL);
        TextView title = new TextView(activity);
        title.setText("Select delivery photo");
        title.setTextSize(20);
        int padding = (int) (16 * activity.getResources().getDisplayMetrics().density);
        title.setPadding(padding, padding, padding, padding);
        content.addView(title);
        EmbeddedPhotoPickerView picker = new EmbeddedPhotoPickerView(activity);
        content.addView(picker, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1));
        LinearLayout actions = new LinearLayout(activity);
        Button cancel = new Button(activity);
        cancel.setText("Cancel");
        Button standard = new Button(activity);
        standard.setText("Use system picker");
        actions.addView(cancel, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        actions.addView(standard, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        content.addView(actions);

        Set<Uri> selected = new LinkedHashSet<>();
        boolean[] finished = {false};
        boolean[] opened = {false};
        Handler handler = new Handler(Looper.getMainLooper());
        Runnable fallback = () -> {
            if (finished[0]) return;
            finished[0] = true;
            dialog.dismiss();
            result.unavailable();
        };
        Runnable cancelled = () -> {
            if (finished[0]) return;
            finished[0] = true;
            dialog.dismiss();
            result.cancelled();
        };
        picker.addEmbeddedPhotoPickerStateChangeListener(new EmbeddedPhotoPickerStateChangeListener() {
            @Override public void onSessionOpened(EmbeddedPhotoPickerSession session) {
                opened[0] = true;
                handler.removeCallbacks(fallback);
            }
            @Override public void onSessionError(Throwable error) { handler.post(fallback); }
            @Override public void onUriPermissionGranted(List<Uri> uris) { selected.addAll(uris); }
            @Override public void onUriPermissionRevoked(List<Uri> uris) { selected.removeAll(uris); }
            @Override public void onSelectionComplete() {
                if (finished[0]) return;
                if (selected.isEmpty()) { cancelled.run(); return; }
                Uri uri = selected.iterator().next();
                finished[0] = true;
                dialog.dismiss();
                result.selected(uri);
            }
        });
        picker.setEmbeddedPhotoPickerFeatureInfo(new EmbeddedPhotoPickerFeatureInfo.Builder()
            .setMaxSelectionLimit(1)
            .setMimeTypes(Collections.singletonList("image/*"))
            .build());
        cancel.setOnClickListener(view -> cancelled.run());
        standard.setOnClickListener(view -> fallback.run());
        dialog.setOnCancelListener(value -> cancelled.run());
        dialog.setOnDismissListener(value -> handler.removeCallbacks(fallback));
        dialog.setContentView(content);
        dialog.show();
        Window window = dialog.getWindow();
        if (window != null) window.setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT);
        if (!opened[0]) handler.postDelayed(fallback, 8000);
        return dialog;
    }
}
