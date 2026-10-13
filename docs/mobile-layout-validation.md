# Mobile layout validation

Scope: responsive shell/navigation and notification panel geometry. No authentication, backend transactions, camera, GPS or physical-device sign-off is claimed.

Run a production build, install a Chromium browser locally, then run:

```sh
CHROMIUM_EXECUTABLE_PATH=/absolute/path/to/chromium npm run verify:mobile-layout
```

The verifier renders actual Layout TSX with read-only auth/router adapters and actual production CSS. It checks 320x568,360x640,390x844,360x300 (reduced keyboard-height geometry),640x360,768x1024,1024x768,1280x800,1920x1080. Navigation remains inside viewport and scrolls to the last link; notification Close remains inside the visible height.

Baseline reproduced notification overflow at640x360. Repair bounds panel height and lets the message list shrink/scroll; tablet navigation scrolls horizontally. Basic fallback offsets and viewport-height calculation precede modern max()/env()/dvh declarations for older WebViews.

Physical Android8+ phone/tablet testing with actual keyboard, camera return, screen rotation, font scaling and display scaling remains required. Browser layout checks do not establish universal-device compatibility.
