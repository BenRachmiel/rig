import { describe, it, expect, vi, beforeEach } from "vitest";
import { useAppStore } from "./app-store";

vi.mock("@/lib/gain-api", () => ({
  searchAlbums: vi.fn(),
  startJob: vi.fn(),
  appendTracks: vi.fn(),
  resolveJob: vi.fn(),
  getJobs: vi.fn(),
  clearJobs: vi.fn(),
  statusStreamUrl: vi.fn(),
  resolveStreamUrl: vi.fn(),
}));

import * as gainApi from "@/lib/gain-api";

const mockedGainApi = vi.mocked(gainApi);

beforeEach(() => {
  // Reset store to initial state
  useAppStore.setState({
    source: "tidal",
    albums: [],
    searchLoading: false,
    searchError: null,
    resolvingAlbumId: null,
    resolvingSource: null,
    resolveMeta: null,
    resolvedTracks: [],
    selectedTrackIndices: new Set(),
    resolvedCount: 0,
    totalTracks: 0,
    jobs: new Map(),
    pendingJobId: null,
    lastEventId: 0,
    dockOpen: false,
    dockTab: "preview",
  });
  vi.clearAllMocks();
});

describe("source selector", () => {
  it("defaults to tidal", () => {
    expect(useAppStore.getState().source).toBe("tidal");
  });

  it("setSource changes source", () => {
    useAppStore.getState().setSource("youtube");
    expect(useAppStore.getState().source).toBe("youtube");
  });

  it("search passes current source", async () => {
    mockedGainApi.searchAlbums.mockResolvedValue([]);
    useAppStore.getState().setSource("youtube");
    await useAppStore.getState().search("test query");
    expect(mockedGainApi.searchAlbums).toHaveBeenCalledWith(
      "test query",
      "youtube",
      1
    );
  });

  it("search passes tidal by default", async () => {
    mockedGainApi.searchAlbums.mockResolvedValue([]);
    await useAppStore.getState().search("test query");
    expect(mockedGainApi.searchAlbums).toHaveBeenCalledWith(
      "test query",
      "tidal",
      1
    );
  });
});

describe("resolve flow", () => {
  it("startResolve stores resolvingSource", () => {
    useAppStore.getState().setSource("youtube");
    useAppStore.getState().startResolve("yt:abc123");
    const state = useAppStore.getState();
    expect(state.resolvingAlbumId).toBe("yt:abc123");
    expect(state.resolvingSource).toBe("youtube");
  });

  it("addResolvedTrack uses array index for selection", () => {
    useAppStore.getState().startResolve("12345");
    const track1 = { index: 1, title: "A", artist: "X", album: "Y", duration: "3:00", url: "http://a" };
    const track2 = { index: 1, title: "B", artist: "X", album: "Y", duration: "4:00", url: "http://b" };
    useAppStore.getState().addResolvedTrack(track1);
    useAppStore.getState().addResolvedTrack(track2);
    const state = useAppStore.getState();
    expect(state.resolvedTracks).toHaveLength(2);
    expect(state.selectedTrackIndices.has(0)).toBe(true);
    expect(state.selectedTrackIndices.has(1)).toBe(true);
    expect(state.selectedTrackIndices.size).toBe(2);
  });

  it("startResolve with tidal source", () => {
    useAppStore.getState().startResolve("12345");
    const state = useAppStore.getState();
    expect(state.resolvingAlbumId).toBe("12345");
    expect(state.resolvingSource).toBe("tidal");
  });

  it("cancelResolve clears resolvingSource", () => {
    useAppStore.getState().setSource("youtube");
    useAppStore.getState().startResolve("yt:abc");
    useAppStore.getState().cancelResolve();
    const state = useAppStore.getState();
    expect(state.resolvingAlbumId).toBeNull();
    expect(state.resolvingSource).toBeNull();
  });
});

describe("handleJobUpdate", () => {
  it("updates status of existing job", () => {
    useAppStore.setState({
      jobs: new Map([
        ["job-1", { id: "job-1", artist: "A", album: "B", status: "queued", current_track: null, track_count: 10, tracks_done: 0 }],
      ]),
    });

    useAppStore.getState().handleJobUpdate({ job_id: "job-1", status: "active" });
    expect(useAppStore.getState().jobs.get("job-1")?.status).toBe("active");
  });

  it("updates track_count when provided", () => {
    useAppStore.setState({
      jobs: new Map([
        ["job-1", { id: "job-1", artist: "A", album: "B", status: "queued", current_track: null, track_count: 0, tracks_done: 0 }],
      ]),
    });

    useAppStore.getState().handleJobUpdate({ job_id: "job-1", status: "active", track_count: 12 });
    expect(useAppStore.getState().jobs.get("job-1")?.track_count).toBe(12);
  });

  it("sets tracks_done to track_count on done", () => {
    useAppStore.setState({
      jobs: new Map([
        ["job-1", { id: "job-1", artist: "A", album: "B", status: "active", current_track: null, track_count: 10, tracks_done: 5 }],
      ]),
    });

    useAppStore.getState().handleJobUpdate({ job_id: "job-1", status: "done" });
    const job = useAppStore.getState().jobs.get("job-1");
    expect(job?.status).toBe("done");
    expect(job?.tracks_done).toBe(10);
  });

  it("creates new job entry when unknown job has artist", () => {
    useAppStore.getState().handleJobUpdate({
      job_id: "new-job",
      status: "queued",
      artist: "New Artist",
      album: "New Album",
      track_count: 8,
    });
    const job = useAppStore.getState().jobs.get("new-job");
    expect(job).toBeDefined();
    expect(job?.artist).toBe("New Artist");
    expect(job?.track_count).toBe(8);
  });

  it("ignores unknown job without artist", () => {
    useAppStore.getState().handleJobUpdate({ job_id: "unknown", status: "active" });
    expect(useAppStore.getState().jobs.has("unknown")).toBe(false);
  });
});

describe("handleTrackUpdate", () => {
  it("increments tracks_done on done status", () => {
    useAppStore.setState({
      jobs: new Map([
        ["job-1", { id: "job-1", artist: "A", album: "B", status: "active", current_track: null, track_count: 10, tracks_done: 3 }],
      ]),
    });

    useAppStore.getState().handleTrackUpdate({ job_id: "job-1", index: 4, title: "Track 4", status: "done" });
    expect(useAppStore.getState().jobs.get("job-1")?.tracks_done).toBe(4);
  });

  it("increments tracks_done on error status", () => {
    useAppStore.setState({
      jobs: new Map([
        ["job-1", { id: "job-1", artist: "A", album: "B", status: "active", current_track: null, track_count: 10, tracks_done: 3 }],
      ]),
    });

    useAppStore.getState().handleTrackUpdate({ job_id: "job-1", index: 4, title: "Track 4", status: "error", error: "fail" });
    expect(useAppStore.getState().jobs.get("job-1")?.tracks_done).toBe(4);
  });

  it("ignores unknown job_id", () => {
    useAppStore.getState().handleTrackUpdate({ job_id: "nonexistent", index: 1, title: "T", status: "done" });
    expect(useAppStore.getState().jobs.size).toBe(0);
  });
});

describe("loadMore", () => {
  it("appends results and increments page", async () => {
    useAppStore.setState({
      searchQuery: "test",
      searchPage: 1,
      albums: [{ id: "1", title: "A", artist: "X", cover: "", tracks: 10, year: "2024", source: "tidal" }],
    });
    mockedGainApi.searchAlbums.mockResolvedValue([
      { id: "2", title: "B", artist: "Y", cover: "", tracks: 8, year: "2023", source: "tidal" },
    ]);

    await useAppStore.getState().loadMore();
    const state = useAppStore.getState();
    expect(state.albums).toHaveLength(2);
    expect(state.searchPage).toBe(2);
    expect(state.hasMore).toBe(false);
  });

  it("sets hasMore true when page is full", async () => {
    useAppStore.setState({ searchQuery: "test", searchPage: 1, albums: [] });
    mockedGainApi.searchAlbums.mockResolvedValue(
      Array.from({ length: 20 }, (_, i) => ({
        id: String(i), title: `T${i}`, artist: "A", cover: "", tracks: 1, year: "2024", source: "tidal" as const,
      })),
    );

    await useAppStore.getState().loadMore();
    expect(useAppStore.getState().hasMore).toBe(true);
  });

  it("does not load when already loading", async () => {
    useAppStore.setState({ searchQuery: "test", searchLoading: true });
    await useAppStore.getState().loadMore();
    expect(mockedGainApi.searchAlbums).not.toHaveBeenCalled();
  });

  it("does not load when no search query", async () => {
    useAppStore.setState({ searchQuery: "" });
    await useAppStore.getState().loadMore();
    expect(mockedGainApi.searchAlbums).not.toHaveBeenCalled();
  });
});

describe("search stale result prevention", () => {
  it("discards stale search results", async () => {
    let resolveFirst: (v: never[]) => void;
    const firstCall = new Promise<never[]>((r) => { resolveFirst = r; });

    mockedGainApi.searchAlbums
      .mockImplementationOnce(() => firstCall)
      .mockResolvedValueOnce([
        { id: "2", title: "Second", artist: "A", cover: "", tracks: 1, year: "2024", source: "tidal" },
      ]);

    // Launch first search
    const p1 = useAppStore.getState().search("first");
    // Launch second search before first resolves
    const p2 = useAppStore.getState().search("second");

    // Resolve second first
    await p2;
    expect(useAppStore.getState().albums).toHaveLength(1);
    expect(useAppStore.getState().albums[0].title).toBe("Second");

    // Now resolve first — should be discarded
    resolveFirst!([] as never[]);
    await p1;
    // Albums should still be the second search result
    expect(useAppStore.getState().albums).toHaveLength(1);
    expect(useAppStore.getState().albums[0].title).toBe("Second");
  });
});
