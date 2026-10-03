import { useState, useCallback, useRef } from 'react';
import { sendChatMessage } from '../services/chatService';
import { createRequest } from '../services/requestService';
import type { Message, ChatRequest, CreateRequestPayload } from '../types';
import { collectPageContext, type ClientPageContext } from '../utils/pageContext';

const RETRY_DELAY_MS = 2 * 60 * 1000;

function isTransientAiFailure(error: unknown): boolean {
	if (!(error instanceof Error)) {
		return false;
	}

	const message = error.message.toLowerCase();
	return message.includes('429')
		|| message.includes('rate limit')
		|| message.includes('too many requests')
		|| message.includes('502')
		|| message.includes('503')
		|| message.includes('504')
		|| message.includes('timeout')
		|| message.includes('network')
		|| message.includes('failed to fetch')
		|| message.includes('temporarily unavailable');
}

function createAbortError(): DOMException {
	return new DOMException('Chat turn aborted', 'AbortError');
}

function isAbortError(error: unknown): boolean {
	return error instanceof DOMException && error.name === 'AbortError';
}

/**
 * Sleep that ends early when the turn is aborted, so a pending transient-failure
 * retry does not keep a stale turn alive after the user has navigated away.
 */
function waitForRetry(delayMs: number, signal: AbortSignal): Promise<void> {
	return new Promise((resolve, reject) => {
		if (signal.aborted) {
			reject(createAbortError());
			return;
		}

		const timer = window.setTimeout(() => {
			signal.removeEventListener('abort', onAbort);
			resolve();
		}, delayMs);

		function onAbort() {
			window.clearTimeout(timer);
			reject(createAbortError());
		}

		signal.addEventListener('abort', onAbort, { once: true });
	});
}

function typeOutContent(content: string, onToken?: (token: string) => void, signal?: AbortSignal): Promise<void> {
	return new Promise((resolve) => {
		if (!content || signal?.aborted) {
			resolve();
			return;
		}

		let index = 0;
		const chunkSize = 4;
		const interval = window.setInterval(() => {
			const nextIndex = Math.min(index + chunkSize, content.length);
			const token = content.slice(index, nextIndex);
			index = nextIndex;
			onToken?.(token);

			if (index >= content.length) {
				window.clearInterval(interval);
				resolve();
			}
		}, 16);

		signal?.addEventListener('abort', () => {
			window.clearInterval(interval);
			resolve();
		}, { once: true });
	});
}

function extractBookingPayloadFromText(content: string): string | null {
	let depth = 0;
	let start = -1;

	for (let index = 0; index < content.length; index += 1) {
		const char = content[index];

		if (char === '{') {
			if (depth === 0) {
				start = index;
			}
			depth += 1;
			continue;
		}

		if (char !== '}' || depth === 0) {
			continue;
		}

		depth -= 1;
		if (depth !== 0 || start < 0) {
			continue;
		}

		const candidate = content.slice(start, index + 1);

		try {
			const parsed = JSON.parse(candidate);
			if (parsed?.title && Array.isArray(parsed?.facility_bookings)) {
				return JSON.stringify(parsed);
			}
		} catch {
			// Continue scanning until a full valid JSON object is found.
		}
	}

	return null;
}

function extractNavigationSuggestion(content: string): { route: string; reason: string } | null {
	// Look for NAVIGATE_SUGGESTION marker: NAVIGATE_SUGGESTION:route=requests.index:reason=...
	const markerMatch = content.match(/NAVIGATE_SUGGESTION:route=([^:]+):reason=(.+)/);
	if (markerMatch) {
		return {
			route: markerMatch[1],
			reason: markerMatch[2].trim(),
		};
	}

	// Fall back to looking for a JSON object like {"navigate":"requests.index"} in the content
	const jsonMatch = content.match(/\{[^}]*\}/);
	if (jsonMatch) {
		try {
			const parsed = JSON.parse(jsonMatch[0]);
			if (parsed.navigate) {
				return {
					route: String(parsed.navigate),
					reason: 'Navigation suggested by AI',
				};
			}
		} catch {
			// Not a valid navigation suggestion, continue
		}
	}

	return null;
}

export function useChatAPI() {
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	/*
	 * The app shell is a persistent Inertia layout, so this hook does not unmount
	 * on navigation the way it used to. Every turn therefore owns an
	 * AbortController: a new send supersedes the previous turn, and callers abort
	 * on navigation/unmount (see chatbot.tsx) so a pending 2-minute transient
	 * retry can never resolve into a stale answer on a page the user has left.
	 */
	const activeTurnRef = useRef<AbortController | null>(null);

	const abortPendingTurn = useCallback(() => {
		activeTurnRef.current?.abort();
		activeTurnRef.current = null;
		setIsLoading(false);
	}, []);

	const sendMessage = useCallback(async (
		messages: Message[],
		participantCount?: number,
		bookingContext?: string,
		faqMode?: boolean,
		pageContext?: ClientPageContext,
		onToken?: (token: string) => void,
		onBookingPayload?: (json: string) => void,
		onDeterministic?: (payload: Record<string, unknown>) => void,
		devmode?: boolean,
		onDebugToolCalls?: (calls: unknown[]) => void,
	) => {
		// Supersede any turn still waiting to retry, then claim this turn's controller.
		activeTurnRef.current?.abort();
		const controller = new AbortController();
		activeTurnRef.current = controller;
		const { signal } = controller;

		setIsLoading(true);
		setError(null);

		const runRequest = async () => {
			const payload: ChatRequest = {
				messages,
				page_context: pageContext ?? collectPageContext(),
			};
			if (participantCount) payload.participant_count = participantCount;
			if (bookingContext) payload.booking_context = bookingContext;
			if (faqMode) payload.faq_mode = true;

			let fullContent = '';
			let attempt = 0;

			while (true) {
				try {
					const response = await sendChatMessage(payload, pageContext, devmode, signal);
					fullContent = response.content;

					if (response.deterministic) {
						onDeterministic?.(response.deterministic);
					}

					if (response.debug?.tool_calls?.length) {
						onDebugToolCalls?.(response.debug.tool_calls);
					}

					if (response.bookingPayload) {
						onBookingPayload?.(response.bookingPayload);
					} else {
						await typeOutContent(response.content, onToken, signal);
					}

					// Check for navigation suggestion in the AI response
					const navSuggestion = extractNavigationSuggestion(fullContent);
					if (navSuggestion) {
						// Render as a clickable Inertia Link
						const navToken = `NAVIGATE_SUGGESTION:${navSuggestion.route}:${navSuggestion.reason}`;
						onToken?.(navToken);
					}

					setIsLoading(false);
					setError(null);
					return fullContent;
				} catch (error) {
					// An aborted turn was cancelled on purpose — no retry, no error banner.
					if (signal.aborted || isAbortError(error)) {
						throw isAbortError(error) ? error : createAbortError();
					}

					const message = error instanceof Error ? error.message : 'Unknown error occurred';
					const retryable = isTransientAiFailure(error);

					if (!retryable || attempt >= 1) {
						setIsLoading(false);
						setError(message);
						throw error instanceof Error ? error : new Error(message);
					}

					attempt += 1;
					setError('AI request failed. Retrying automatically in 2 minutes…');
					await waitForRetry(RETRY_DELAY_MS, signal);
				}
			}
		};

		try {
			return await runRequest();
		} finally {
			// Only release this turn's slot; a newer send may already own the ref.
			if (activeTurnRef.current === controller) {
				activeTurnRef.current = null;
			}
		}
	}, []);

	const submitRequest = useCallback(async (payload: CreateRequestPayload) => {
		setIsLoading(true);
		setError(null);

		try {
			const result = await createRequest(payload); 
			return result;
		} catch (err) {
			const errorMsg = err instanceof Error ? err.message : 'Unknown error occurred';
			setError(errorMsg);
			throw err;
		} finally {
			setIsLoading(false);
		}
	}, []); 

	const detectAndSubmitRequest = useCallback(async (content: string, userConfirmed: boolean = false) => {
		if (!userConfirmed) return null;

		const jsonMatch = content.match(/\{[\s\S]*\}/);
		if (!jsonMatch) return null;

		try {
			const payload = JSON.parse(jsonMatch[0]);
			if (payload.title && payload.facility_bookings && Array.isArray(payload.facility_bookings)) {
				return await submitRequest(payload);
			}
		} catch (jsonError) {
			console.log('Could not parse JSON payload:', jsonError);
		}

		return null;
	}, [submitRequest]);

	return {
		isLoading,
		error,
		sendMessage,
		submitRequest,
		detectAndSubmitRequest,
		clearError: () => setError(null),
		abortPendingTurn,
	};
}