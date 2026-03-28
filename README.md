# Rig

Music library management frontend. Search and download music, browse and fix your library, discover albums blindly, and mint credentials for Subsonic clients.

Built with Next.js 16, React 19, and Tailwind CSS v4. Orchestrates two backend services: **Preamp** (Go, Subsonic-compatible server) and **Gain** (Rust, downloader/transcoder).

## Tabs

**Download** — Search for albums, queue downloads, and track progress via real-time status streaming.

**Library** — Browse artists and albums, scan for new files, and fix metadata issues (missing art, genres, years, zero-duration tracks). Inline editing for quick fixes.

**Reverb** — Blind music discovery. Listen to anonymous 30-second clips, swipe to skip or commit to the full album. Joy Division-style oscilloscope visualizer reacts to the audio in real time.

**Credentials** — Create, renew, and revoke authentication credentials for Subsonic-compatible music clients (DSub, Symfonium, etc.).

## Deployment

Designed for Kubernetes. The Helm chart (`chart/rig`) deploys Rig, Preamp, and Gain together as sub-charts.

```bash
helm install rig oci://ghcr.io/benrachmiel/rig/charts/rig
```

Authentication is handled by an oauth2-proxy sidecar using OIDC. Configure an OIDC provider (Dex, Keycloak, etc.) and set the issuer URL, client ID, and secrets in your Helm values.

A Docker image is also available for standalone use:

```bash
docker pull ghcr.io/benrachmiel/rig:latest
```

### Environment

| Variable | Default | Purpose |
|----------|---------|---------|
| `GAIN_URL` | `http://localhost:3000` | Gain backend |
| `PREAMP_ADMIN_URL` | `http://localhost:4534` | Preamp admin API |
| `PREAMP_URL` | `http://localhost:4533` | Preamp Subsonic API |
| `MUSIC_DIR` | `/music` | Path to music library |

## Development

```bash
just dev       # full stack (Preamp + Gain + Rig)
just dev-rig   # Rig only (assumes backends running)
npm test       # run tests
npm run build  # production build
```

## PWA

Installable as a progressive web app. Fullscreen mode on mobile for an immersive experience. Screen wake lock keeps the display on during playback.

Static assets (`manifest.json`, `sw.js`, icons) must be excluded from auth if running behind an OAuth proxy.
