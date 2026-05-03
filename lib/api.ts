// lib/api.ts
// API client for backend integration

// Step 2: Base URL and token helpers

interface User {
	id: string;
	email: string;
	name: string;
	church_id?: number;
}

const MOCK_MODE = process.env.NEXT_PUBLIC_API_MOCK === 'true';
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

function setToken(token: string) {
	if (typeof window !== 'undefined') {
		try {
			if (token) {
				localStorage.setItem('authToken', token);
				// Also set a cookie so middleware can check auth on the server/edge
				document.cookie = `authToken=${token}; path=/; SameSite=Strict`;
			} else {
				localStorage.removeItem('authToken');
				// Clear the cookie
				document.cookie = 'authToken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
			}
		} catch {
			// localStorage may be unavailable in some browsers (private mode)
		}
	}
}

function getToken(): string | null {
	if (typeof window !== 'undefined') {
		try {
			return localStorage.getItem('authToken');
		} catch {
			return null;
		}
	}
	return null;
}

export function getChurchId(): number {
	if (typeof window !== 'undefined') {
		try {
			const id = localStorage.getItem('churchId');
			return id ? parseInt(id) : 1;
		} catch {
			return 1;
		}
	}
	return 1;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function apiRequest<T = any>(
	path: string,
	options: RequestInit = {},
	requireAuth: boolean = true
): Promise<T> {
	if (MOCK_MODE) {
		// Return mock data for known endpoints
		if (path === "/api/sessions" && options.method === "GET") {
			return [
				{
					id: "sess_1",
					name: "Sunday Service - Dec 21",
					status: "ended",
					startedAt: "2024-12-21T10:00:00Z",
					endedAt: "2024-12-21T12:00:00Z",
					connectedUsers: 45,
					translationCount: 230,
				},
				{
					id: "sess_2",
					name: "Wednesday Prayer - Dec 18",
					status: "ended",
					startedAt: "2024-12-18T19:00:00Z",
					endedAt: "2024-12-18T20:30:00Z",
					connectedUsers: 12,
					translationCount: 87,
				},
			] as unknown as T;
		}
		if (path === "/api/songs" && options.method === "GET") {
			return [
				{
					id: "song_1",
					titleEs: "Cuán Grande Es Él",
					titleEn: "How Great Thou Art",
					lyricsEs: "Señor mi Dios...",
					lyricsEn: "O Lord my God...",
				},
				{
					id: "song_2",
					titleEs: "Santo, Santo, Santo",
					titleEn: "Holy, Holy, Holy",
					lyricsEs: "Santo, santo, santo...",
					lyricsEn: "Holy, holy, holy...",
				},
			] as unknown as T;
		}
		if (path === "/api/auth/login" && options.method === "POST") {
			return { token: "mock-token" } as unknown as T;
		}
		if (path === "/api/auth/register" && options.method === "POST") {
			return { token: "mock-token", user: { id: "user_1", email: "test@example.com", name: "Test User" } } as unknown as T;
		}
		if (path === "/api/auth/logout" && options.method === "POST") {
			return { success: true } as unknown as T;
		}
		if (path === "/api/auth/me" && options.method === "GET") {
			return { id: "user_1", email: "test@example.com", name: "Test User" } as unknown as T;
		}
		// Add more mock endpoints as needed
		throw new Error("Mock mode: endpoint not implemented");
	}
	// ...existing code...
	const url = `${API_BASE_URL}${path}`;
	let headers: Record<string, string> = { 'Content-Type': 'application/json' };
	if (options.headers) {
		if (options.headers instanceof Headers) {
			options.headers.forEach((value, key) => {
				headers[key] = value;
			});
		} else {
			headers = { ...headers, ...(options.headers as Record<string, string>) };
		}
	}
	if (requireAuth) {
		const token = getToken();
		if (token) headers['Authorization'] = `Bearer ${token}`;
	}
	const res = await fetch(url, { ...options, headers });
	if (!res.ok) {
		if (res.status === 401 && requireAuth) {
			// Token expired or invalid — clear and redirect to login
			setToken("");
			if (typeof window !== 'undefined') window.location.href = '/login';
		}
		let errorMsg = `API error: ${res.status}`;
		try {
			const err = await res.json();
			errorMsg = err.detail || err.message || errorMsg;
		} catch {}
		throw new Error(errorMsg);
	}
	if (res.status === 204) return undefined as T; // No content
	return res.json();
}

export { setToken, getToken, API_BASE_URL, apiRequest };

export const api = {
	// Auth
	async login(email: string, password: string) {
		const res = await apiRequest<{ token: string }>(
			"/api/auth/login",
			{
				method: "POST",
				body: JSON.stringify({ email, password }),
			},
			false // No auth required for login
		);
		setToken(res.token);
		// Fetch user info to store church_id
		try {
			const user = await apiRequest<User>("/api/auth/me", { method: "GET" });
			if (user.church_id && typeof window !== 'undefined') {
				localStorage.setItem('churchId', String(user.church_id));
			}
		} catch {}
		return res;
	},

	async register(email: string, password: string, name?: string) {
		const res = await apiRequest<{ token: string; user: User }>(
			"/api/auth/register",
			{
				method: "POST",
				body: JSON.stringify({ email, password, name }),
			},
			false // No auth required for register
		);
		setToken(res.token);
		return res;
	},

	async logout() {
		await apiRequest("/api/auth/logout", { method: "POST" });
		setToken("");
	},

	async getCurrentUser() {
		return apiRequest("/api/auth/me", { method: "GET" });
	},

	// Health / model status (no auth required)
	async getHealth() {
		return apiRequest<{
			status: string;
			models_ready: boolean;
			models: Record<string, boolean>;
			active_sessions: number;
		}>("/health", { method: "GET" }, false);
	},

	// Sessions
	async getSessions() {
		return apiRequest("/api/sessions", { method: "GET" });
	},
	async getSession(id: string) {
		return apiRequest(`/api/sessions/${id}`, { method: "GET" });
	},
	async createSession(data: { name: string; church_id?: number; source_language?: string; target_language?: string }) {
		return apiRequest("/api/sessions", {
			method: "POST",
			body: JSON.stringify({
				name: data.name,
				church_id: data.church_id || 1,
				source_language: data.source_language || "es",
				target_language: data.target_language || "en",
			}),
		});
	},
	async stopSession(id: string) {
		return apiRequest(`/api/sessions/${id}`, { method: "DELETE" });
	},
	async getSessionTranslations(sessionId: string) {
		return apiRequest(`/api/sessions/${sessionId}/translations`, { method: "GET" });
	},

	// Songs
	async getSongs(churchId: number = getChurchId()) {
		return apiRequest(`/api/songs?church_id=${churchId}`, { method: "GET" });
	},
	async getSong(id: string) {
		return apiRequest(`/api/songs/${id}`, { method: "GET" });
	},
	async createSong(data: { church_id: number; title: string; title_target?: string; is_active?: boolean }) {
		return apiRequest("/api/songs", {
			method: "POST",
			body: JSON.stringify(data),
		});
	},
	async updateSong(id: string, data: { title?: string; title_target?: string; is_active?: boolean }) {
		return apiRequest(`/api/songs/${id}`, {
			method: "PUT",
			body: JSON.stringify(data),
		});
	},
	async deleteSong(id: string) {
		return apiRequest(`/api/songs/${id}`, { method: "DELETE" });
	},

	// Song Sections
	async addSongSection(songId: string, data: { section_number: number; section_name: string; text_source: string; text_target?: string }) {
		return apiRequest(`/api/songs/${songId}/sections`, {
			method: "POST",
			body: JSON.stringify(data),
		});
	},
	async updateSongSection(songId: string, sectionId: string, data: { section_number?: number; section_name?: string; text_source?: string; text_target?: string }) {
		return apiRequest(`/api/songs/${songId}/sections/${sectionId}`, {
			method: "PUT",
			body: JSON.stringify(data),
		});
	},
	async deleteSongSection(songId: string, sectionId: string) {
		return apiRequest(`/api/songs/${songId}/sections/${sectionId}`, { method: "DELETE" });
	},

	// Song Import
	async importSongWithSections(data: {
		church_id: number;
		title: string;
		title_target?: string;
		sections: Array<{
			section_number: number;
			section_name: string;
			text_source: string;
			text_target?: string;
		}>;
	}) {
		return apiRequest("/api/songs/import/sections", {
			method: "POST",
			body: JSON.stringify(data),
		});
	},

	// Song Index
	async rebuildSongIndex() {
		return apiRequest("/api/songs/rebuild-index", { method: "POST" });
	},

	// Song Export
	async exportAllSongs(churchId: number = getChurchId()) {
		return apiRequest(`/api/songs/export/all?church_id=${churchId}`, { method: "GET" });
	},

	// ProPresenter
	async proPresenterStatus() {
		return apiRequest("/api/propresenter/status", { method: "GET" });
	},
	async proPresenterLibraries() {
		return apiRequest("/api/propresenter/libraries", { method: "GET" });
	},
	async proPresenterLibrary(id: string) {
		return apiRequest(`/api/propresenter/library/${encodeURIComponent(id)}`, { method: "GET" });
	},
	async proPresenterPresentation(uuid: string) {
		return apiRequest(`/api/propresenter/presentation/${encodeURIComponent(uuid)}`, { method: "GET" });
	},
	async proPresenterSaveSettings(data: { host: string; port: number }) {
		const params = new URLSearchParams({ host: data.host, port: String(data.port) });
		return apiRequest(`/api/propresenter/settings?${params}`, { method: "POST" });
	},
	proPresenterDownloadBridgeUrl(churchId: number, platform: "windows" | "mac"): string {
		const token = getToken() || "";
		return `${API_BASE_URL}/api/propresenter/download-bridge/${churchId}?token=${encodeURIComponent(token)}&platform=${platform}`;
	},
	async proPresenterConnectionCode(churchId: number): Promise<string> {
		const data = await apiRequest<{ connection_code: string }>(`/api/propresenter/connection-code/${churchId}`);
		return data.connection_code;
	},

	// Church Settings
	async getChurch(churchId: number) {
		return apiRequest(`/api/churches/${churchId}`, { method: "GET" });
	},
	async saveChurchSettings(churchId: number, settings: {
		source_language?: string;
		target_language?: string;
		bible_version_source?: string;
		bible_version_target?: string;
	}) {
		return apiRequest(`/api/churches/${churchId}/settings`, {
			method: "PUT",
			body: JSON.stringify(settings),
		});
	},
};
