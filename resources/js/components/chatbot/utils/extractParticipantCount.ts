/**
 * Extract participant count from text
 * Looks for patterns like "50 people", "for 40", "40 participants", etc.
 */
export function extractParticipantCount(text: string): number | null {
    const patterns = [
        /(\d+)\s+(?:people|participants|person|attendees|guests)/i,
        /(?:for|room|space|accommodate|fit|seat|capacity|hold)\s+(\d+)/i,
        /(\d+)\s+(?:person|people)(?:\s|$)/i,
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
            const num = parseInt(match[1], 10);
            if (num > 0 && num < 10000) {
                return num;
            }
        }
    }
    return null;
}
