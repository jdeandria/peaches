// Custom bootstrap: serve CanvasKit from our own origin (it is copied into
// build/web/canvaskit by `flutter build web`) instead of Google's CDN, so
// the app works on restricted networks and has no third-party runtime
// dependency.
{{flutter_js}}
{{flutter_build_config}}

_flutter.loader.load({
  config: {
    canvasKitBaseUrl: "canvaskit/",
  },
});
