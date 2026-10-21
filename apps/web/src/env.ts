import { defineEnvVars } from '@sveltejs/kit/env';

// Built into the bundle, so set them before `bun run build` (e.g. in Vercel's project settings).
export const variables = defineEnvVars({
	API_URL: {
		public: true,
		static: true,
		description: 'Online server URL',
		schema: (value) => value || 'http://localhost:8787'
	},
	PUSHER_KEY: {
		public: true,
		static: true,
		description: 'Pusher app key; empty = poll the server instead of realtime',
		schema: (value) => value ?? ''
	},
	PUSHER_CLUSTER: {
		public: true,
		static: true,
		description: 'Pusher cluster, e.g. ap1',
		schema: (value) => value ?? ''
	}
});
