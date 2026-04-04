music_dir := "/data/music"
default_mirrors := "https://frankfurt-1.monochrome.tf,https://eu-central.monochrome.tf,https://arran.monochrome.tf,https://hifi-one.spotisaver.net,https://hifi-two.spotisaver.net"

# Run all three services
dev:
    #!/usr/bin/env bash
    set -euo pipefail
    set -m
    pids=()
    cleanup() {
        echo "Shutting down..."
        for pid in "${pids[@]}"; do
            kill -- -"$pid" 2>/dev/null || true
        done
        wait 2>/dev/null
    }
    trap cleanup EXIT INT TERM

    mkdir -p {{music_dir}}

    # Preamp (Subsonic API :4533, Admin :4534)
    (cd ../preamp-server && PREAMP_MUSIC_DIR={{music_dir}} PREAMP_DATA_DIR=/tmp/preamp PREAMP_NO_AUTH=1 PREAMP_ADMIN_LISTEN=:4534 exec go run ./cmd/preamp/) &
    pids+=($!)

    # Gain backend (:8080)
    mirrors="${SOURCE_MIRRORS:-{{default_mirrors}}}"
    source_api="${SOURCE_API:-${mirrors%%,*}}"
    (cd ../gain-downloader/backend && MUSIC_DIR={{music_dir}} SOURCE_API="$source_api" SOURCE_MIRRORS="$mirrors" PREAMP_SCAN_URL=http://localhost:4534/admin/scan exec cargo run) &
    pids+=($!)

    # Rig (Next.js :3000)
    (GAIN_URL=http://localhost:8080 PREAMP_ADMIN_URL=http://localhost:4534 MUSIC_DIR={{music_dir}} exec npx next dev --hostname 0.0.0.0) &
    pids+=($!)

    wait

