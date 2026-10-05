import { useState, useCallback, useRef } from 'react';
import { sendChatMessageStream } from '../services/chatService';
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
		onProgress?: (status: string) => void,
		onNavigate?: (suggestion: { route: string; reason: string }) => void,
	) => {
		// Supersede any turn still waiting to retry, then claim this turn's controller.
		activeTurnRef.current?.abort();
		const controller = new AbortController();
		activeTurnRef.current = controller;
		const { signal } = controller;

		setIsLoading(true);
		setError(null);
		onProgress?.('thinking');

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
					/*
					 * Server-sent events. The server runs the tool loop and emits
					 * `{"tool":...}` while it works, so the UI can say what is
					 * happening instead of sitting silent until the turn ends.
					 */
					let streamError: string | null = null;

					await sendChatMessageStream(
						payload,
						(token) => {
							fullContent += token;
							onToken?.(token);
						},
						onBookingPayload ?? (() => {}),
						onDeterministic ?? (() => {}),
						(message) => {
							streamError = message;
						},
						() => {
							setIsLoading(false);
						},
						(message) => {
							streamError = message;
							setIsLoading(false);
						},
						pageContext,
						signal,
						onProgress,
						onNavigate,
					);

					if (streamError !== null) {
						throw new Error(streamError);
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
