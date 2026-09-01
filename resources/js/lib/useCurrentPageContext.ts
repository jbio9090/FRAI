import { usePage } from '@inertiajs/react';
import { collectPageContext } from '@/components/chatbot/utils/pageContext';

export function useCurrentPageContext() {
    const { component } = usePage();

    return collectPageContext(typeof component === 'string' ? component : undefined);
}
