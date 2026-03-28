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
    sentTrackCount: 0,
    lastEventId: 0,
    logs: [],
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
