import { create } from "zustand";
import type {
  Album,
  Source,
  Track,
  ResolveMeta,
  JobState,
  JobUpdateEvent,
  TrackUpdateEvent,
} from "@/types/api";
import * as gainApi from "@/lib/gain-api";

interface AppState {
  // Source
  source: Source;

  // Search
  albums: Album[];
  searchLoading: boolean;
  searchError: string | null;
  searchQuery: string;
  searchPage: number;
  hasMore: boolean;

  // Resolution
  resolvingAlbumId: string | null;
  resolvingSource: Source | null;
  resolveMeta: ResolveMeta | null;
  resolvedTracks: Track[];
  selectedTrackIndices: Set<number>;
  resolvedCount: number;
  totalTracks: number;

  // Jobs
  jobs: Map<string, JobState>;
  pendingJobId: string | null;

  // SSE
  lastEventId: number;

  // UI
  dockOpen: boolean;
  dockTab: "preview" | "jobs";

  // Actions
  setSource: (source: Source) => void;
  search: (q: string) => Promise<void>;
  loadMore: () => Promise<void>;
  startResolve: (albumId: string) => void;
  setResolveMeta: (meta: ResolveMeta) => void;
  addResolvedTrack: (track: Track) => void;
  finishResolve: () => void;
  cancelResolve: () => void;
  toggleTrack: (index: number) => void;
  selectAllTracks: () => void;
  deselectAllTracks: () => void;
  queueJob: (artist: string, album: string) => Promise<void>;
  handleJobUpdate: (evt: JobUpdateEvent) => void;
  handleTrackUpdate: (evt: TrackUpdateEvent) => void;
  clearCompletedJobs: () => Promise<void>;
  loadExistingJobs: () => Promise<void>;
  setLastEventId: (id: number) => void;

  // UI
  setDockOpen: (open: boolean) => void;
  setDockTab: (tab: "preview" | "jobs") => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  source: "tidal" as Source,
  albums: [],
  searchLoading: false,
  searchError: null,
  searchQuery: "",
  searchPage: 1,
  hasMore: false,
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

  setSource: (source) => set({ source }),

  search: async (q) => {
    const { source } = get();
    set({ searchLoading: true, searchError: null, searchQuery: q, searchPage: 1 });
    try {
      const albums = await gainApi.searchAlbums(q, source, 1);
      set({ albums, searchLoading: false, hasMore: albums.length >= 20 });
    } catch (e) {
      set({
        searchError: e instanceof Error ? e.message : String(e),
        searchLoading: false,
      });
    }
  },

  loadMore: async () => {
    const { source, searchQuery, searchPage, albums, searchLoading } = get();
    if (searchLoading || !searchQuery) return;
    const nextPage = searchPage + 1;
    set({ searchLoading: true });
    try {
      const more = await gainApi.searchAlbums(searchQuery, source, nextPage);
      set({
        albums: [...albums, ...more],
        searchPage: nextPage,
        searchLoading: false,
        hasMore: more.length >= 20,
      });
    } catch (e) {
      set({
        searchError: e instanceof Error ? e.message : String(e),
        searchLoading: false,
      });
    }
  },

  startResolve: (albumId) => {
    const { source } = get();
    set({
      resolvingAlbumId: albumId,
      resolvingSource: source,
      resolveMeta: null,
      resolvedTracks: [],
      selectedTrackIndices: new Set(),
      resolvedCount: 0,
      totalTracks: 0,
      pendingJobId: null,
    });
  },

  setResolveMeta: (meta) => set({ resolveMeta: meta, totalTracks: meta.total }),

  addResolvedTrack: (track) => {
    const { pendingJobId } = get();
    if (pendingJobId) {
      gainApi.appendTracks(pendingJobId, [track]);
      set({ resolvedCount: get().resolvedCount + 1 });
    } else {
      set((s) => {
        const arrayIndex = s.resolvedTracks.length;
        const newSelected = new Set(s.selectedTrackIndices);
        newSelected.add(arrayIndex);
        return {
          resolvedTracks: [...s.resolvedTracks, track],
          selectedTrackIndices: newSelected,
          resolvedCount: s.resolvedCount + 1,
        };
      });
    }
  },

  finishResolve: () => {
    const { pendingJobId } = get();
    if (pendingJobId) gainApi.resolveJob(pendingJobId);
    set({ resolvingAlbumId: null });
  },

  cancelResolve: () =>
    set({
      resolvingAlbumId: null,
      resolvingSource: null,
      resolveMeta: null,
      resolvedTracks: [],
      selectedTrackIndices: new Set(),
      resolvedCount: 0,
      totalTracks: 0,
    }),

  toggleTrack: (index) =>
    set((s) => {
      const next = new Set(s.selectedTrackIndices);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return { selectedTrackIndices: next };
    }),

  selectAllTracks: () =>
    set((s) => ({
      selectedTrackIndices: new Set(s.resolvedTracks.map((_, i) => i)),
    })),

  deselectAllTracks: () => set({ selectedTrackIndices: new Set() }),

  queueJob: async (artist, album) => {
    const {
      resolvedTracks,
      selectedTrackIndices,
      totalTracks,
      resolvingAlbumId,
      resolveMeta,
    } = get();
    const resolved = resolvingAlbumId === null;
    const selectedTracks = resolvedTracks.filter((_, i) =>
      selectedTrackIndices.has(i)
    );

    const jobId = await gainApi.startJob({
      artist,
      album,
      tracks: selectedTracks,
      resolved,
      total_tracks: totalTracks || selectedTracks.length,
      cover_url: resolveMeta?.cover_url,
      total_discs: resolveMeta?.total_discs ?? 1,
    });

    const newJob: JobState = {
      id: jobId,
      artist,
      album,
      status: "queued",
      current_track: null,
      track_count: totalTracks || selectedTracks.length,
      tracks_done: 0,
    };

    set((s) => {
      const jobs = new Map(s.jobs);
      jobs.set(jobId, newJob);
      return {
        jobs,
        pendingJobId: resolved ? null : jobId,
        dockTab: "jobs" as const,
      };
    });
  },

  handleJobUpdate: (evt) =>
    set((s) => {
      const jobs = new Map(s.jobs);
      const existing = jobs.get(evt.job_id);
      if (existing) {
        const updated = {
          ...existing,
          status: evt.status as JobState["status"],
        };
        if (evt.track_count != null) updated.track_count = evt.track_count;
        if (evt.status === "done" || evt.status === "error") {
          updated.tracks_done = updated.track_count;
        }
        jobs.set(evt.job_id, updated);
      } else if (evt.artist) {
        jobs.set(evt.job_id, {
          id: evt.job_id,
          artist: evt.artist,
          album: evt.album ?? "",
          status: evt.status as JobState["status"],
          current_track: null,
          track_count: evt.track_count ?? 0,
          tracks_done: 0,
        });
      }
      return { jobs };
    }),

  handleTrackUpdate: (evt) =>
    set((s) => {
      const jobs = new Map(s.jobs);
      const job = jobs.get(evt.job_id);
      if (job && (evt.status === "done" || evt.status === "error")) {
        jobs.set(evt.job_id, {
          ...job,
          tracks_done: job.tracks_done + 1,
        });
      }
      return { jobs };
    }),

  clearCompletedJobs: async () => {
    await gainApi.clearJobs();
    set((s) => {
      const jobs = new Map(s.jobs);
      for (const [id, job] of jobs) {
        if (job.status === "done" || job.status === "error") jobs.delete(id);
      }
      return { jobs };
    });
  },

  loadExistingJobs: async () => {
    const existing = await gainApi.getJobs();
    set(() => {
      const jobs = new Map<string, JobState>();
      for (const j of existing) jobs.set(j.id, { ...j });
      return { jobs };
    });
  },

  setLastEventId: (id) => set({ lastEventId: id }),

  setDockOpen: (open) => set({ dockOpen: open }),
  setDockTab: (tab) => set({ dockTab: tab }),
}));
