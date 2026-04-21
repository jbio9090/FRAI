import { router, useForm } from '@inertiajs/react';
import { Check, ChevronDown, ChevronUp, Pencil, Plus, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { usePermission } from '@/hooks/use-permission';
import DefaultLayout from '@/layout.tsx/default.';

type RuleEntry = {
    id: number;
    rule: string;
    priority: number;
    forPolicy: 0 | 1;
    faq_answer: string | null;
    created_at: string;
};

type RulesPageProps = {
    policies: RuleEntry[];
    faqs: RuleEntry[];
};

type RuleFormData = {
    rule: string;
    forPolicy: 0 | 1;
    faq_answer: string;
};

export default function RulesPage({ policies, faqs }: RulesPageProps) {
    const { hasPermission } = usePermission();
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [createAsFaq, setCreateAsFaq] = useState(false);

    const { post, data, setData, processing, errors, reset } = useForm<RuleFormData>({
        rule: '',
        forPolicy: 0,
        faq_answer: '',
    });

    useEffect(() => {
        setData('forPolicy', createAsFaq ? 1 : 0);
        if (!createAsFaq) {
            setData('faq_answer', '');
        }
    }, [createAsFaq, setData]);

    const submitCreate = (e: React.FormEvent) => {
        e.preventDefault();
        post(route('rules.add'), {
            onSuccess: () => {
                reset();
                setCreateAsFaq(false);
                setShowCreateForm(false);
            },
        });
    };

    return (
        <DefaultLayout>
            <div className="flex flex-col gap-4">
                <h1 className="text-lg font-bold">Rules</h1>

                {hasPermission('modify rules') && (
                    <>
                        <p className="text-sm">
                            Manage policy rules for AI enforcement and FAQ entries for chatbot FAQ answers.
                        </p>

                        <div>
                            <Button variant="outline" size="sm" onClick={() => setShowCreateForm((prev) => !prev)}>
                                <Plus className="mr-1 h-4 w-4" />
                                Add Entry
                            </Button>
                        </div>

                        {showCreateForm && (
                            <form onSubmit={submitCreate} className="space-y-3 rounded-lg border p-4">
                                <div className="flex items-center gap-2">
                                    <input
                                        id="create-as-faq"
                                        type="checkbox"
                                        checked={createAsFaq}
                                        onChange={(e) => setCreateAsFaq(e.target.checked)}
                                    />
                                    <label htmlFor="create-as-faq" className="text-sm font-medium">
                                        Mark as FAQ entry
                                    </label>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-sm font-medium">{createAsFaq ? 'FAQ Question' : 'Policy Rule'}</label>
                                    <Input
                                        value={data.rule}
                                        onChange={(e) => setData('rule', e.target.value)}
                                        placeholder={createAsFaq ? 'Enter FAQ question' : 'Enter policy rule'}
                                    />
                                    {errors.rule && <p className="text-sm text-red-500">{errors.rule}</p>}
                                </div>

                                {createAsFaq && (
                                    <div className="space-y-1">
                                        <label className="text-sm font-medium">FAQ Answer</label>
                                        <Textarea
                                            value={data.faq_answer}
                                            onChange={(e) => setData('faq_answer', e.target.value)}
                                            placeholder="Enter the chatbot answer for this FAQ"
                                        />
                                        {errors.faq_answer && <p className="text-sm text-red-500">{errors.faq_answer}</p>}
                                    </div>
                                )}

                                <div className="flex gap-2">
                                    <Button type="submit" disabled={processing}>
                                        Save
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => {
                                            reset();
                                            setCreateAsFaq(false);
                                            setShowCreateForm(false);
                                        }}
                                    >
                                        Cancel
                                    </Button>
                                </div>
                            </form>
                        )}
                    </>
                )}

                <RuleSection title="Policy Rules" rows={policies} />
                <RuleSection title="FAQ Entries" rows={faqs} showFaqAnswer />
            </div>
        </DefaultLayout>
    );
}

function RuleSection({
    title,
    rows,
    showFaqAnswer = false,
}: {
    title: string;
    rows: RuleEntry[];
    showFaqAnswer?: boolean;
}) {
    return (
        <div className="rounded-lg border p-4">
            <h2 className="mb-3 text-base font-semibold">{title}</h2>
            {rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">No entries found.</p>
            ) : (
                <div className="space-y-3">
                    {rows.map((row, index) => (
                        <RuleRow
                            key={row.id}
                            row={row}
                            isFirst={index === 0}
                            isLast={index === rows.length - 1}
                            showFaqAnswer={showFaqAnswer}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

function RuleRow({
    row,
    isFirst,
    isLast,
    showFaqAnswer,
}: {
    row: RuleEntry;
    isFirst: boolean;
    isLast: boolean;
    showFaqAnswer: boolean;
}) {
    const { hasPermission } = usePermission();
    const [isEditing, setIsEditing] = useState(false);
    const [editRule, setEditRule] = useState(row.rule);
    const [editFaqAnswer, setEditFaqAnswer] = useState(row.faq_answer ?? '');
    const [editAsFaq, setEditAsFaq] = useState(row.forPolicy === 1);

    const submitUpdate = () => {
        router.put(route('rules.update'), {
            id: row.id,
            rule: editRule,
            forPolicy: editAsFaq ? 1 : 0,
            faq_answer: editAsFaq ? editFaqAnswer : null,
        }, {
            onSuccess: () => setIsEditing(false),
        });
    };

    const remove = () => {
        router.delete(route('rules.remove'), {
            data: { id: row.id },
        });
    };

    const reorder = (direction: 'up' | 'down') => {
        router.put(route('rules.reorder'), { id: row.id, direction });
    };

    return (
        <div className="rounded-md border p-3">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-2">
                    <div className="text-xs text-muted-foreground">
                        Priority #{row.priority + 1} • {row.forPolicy === 1 ? 'FAQ' : 'Policy'}
                    </div>

                    {isEditing ? (
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <input
                                    id={`edit-faq-${row.id}`}
                                    type="checkbox"
                                    checked={editAsFaq}
                                    onChange={(e) => {
                                        setEditAsFaq(e.target.checked);
                                        if (!e.target.checked) {
                                            setEditFaqAnswer('');
                                        }
                                    }}
                                />
                                <label htmlFor={`edit-faq-${row.id}`} className="text-sm font-medium">
                                    Mark as FAQ entry
                                </label>
                            </div>

                            <Input value={editRule} onChange={(e) => setEditRule(e.target.value)} />

                            {editAsFaq && (
                                <Textarea
                                    value={editFaqAnswer}
                                    onChange={(e) => setEditFaqAnswer(e.target.value)}
                                    placeholder="FAQ Answer"
                                />
                            )}
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <p className="text-sm">{row.rule}</p>
                            {showFaqAnswer && (
                                <p className="whitespace-pre-wrap rounded bg-muted p-2 text-sm text-muted-foreground">
                                    {row.faq_answer || 'No FAQ answer provided.'}
                                </p>
                            )}
                        </div>
                    )}
                </div>

                {hasPermission('modify rules') && (
                    <div className="flex shrink-0 flex-col gap-2">
                        {!isEditing && (
                            <>
                                <Button size="icon-xs" variant="ghost" disabled={isFirst} onClick={() => reorder('up')}>
                                    <ChevronUp />
                                </Button>
                                <Button size="icon-xs" variant="ghost" disabled={isLast} onClick={() => reorder('down')}>
                                    <ChevronDown />
                                </Button>
                            </>
                        )}

                        {isEditing ? (
                            <>
                                <Button size="icon-xs" variant="outline" onClick={submitUpdate}>
                                    <Check />
                                </Button>
                                <Button
                                    size="icon-xs"
                                    variant="outline"
                                    onClick={() => {
                                        setEditRule(row.rule);
                                        setEditFaqAnswer(row.faq_answer ?? '');
                                        setEditAsFaq(row.forPolicy === 1);
                                        setIsEditing(false);
                                    }}
                                >
                                    <X />
                                </Button>
                            </>
                        ) : (
                            <>
                                <Button size="icon-xs" variant="outline" onClick={() => setIsEditing(true)}>
                                    <Pencil />
                                </Button>
                                <Button size="icon-xs" variant="outline" onClick={remove}>
                                    <X />
                                </Button>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

