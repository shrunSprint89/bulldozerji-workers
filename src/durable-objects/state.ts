export class ArrayTracker {
	state: DurableObjectState;

	constructor(state: DurableObjectState) {
		this.state = state;
	}

	async fetch(request: Request) {
		const url = new URL(request.url);
		switch (url.pathname) {
			case '/get-index':
				const currentIndex = (await this.state.storage.get('currentIndex')) || 0;
				return new Response(JSON.stringify({ currentIndex }));

			case '/set-index':
				const newIndex = await request.json();
				await this.state.storage.put('currentIndex', newIndex);
				return new Response('Index updated');

			default:
				return new Response('Not found', { status: 404 });
		}
	}
}
